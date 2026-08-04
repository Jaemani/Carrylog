import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  FINALIZATION_GRACE_MS,
  PROCESS_STATE_PRECEDENCE,
  PROCESS_STATES,
  superviseProcess,
  TERMINATION_GRACE_MS,
} from "../process-supervisor.mjs";

const node = process.execPath;
const script = (source) => ["-e", source];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("terminal-state precedence is explicit and deterministic", () => {
  assert.deepEqual(PROCESS_STATE_PRECEDENCE, {
    completed: 0,
    signal: 1,
    timeout: 2,
    "output-limit": 3,
    "spawn-error": 4,
  });
});

test("captures separate streams and exact complete byte evidence", async () => {
  const result = await superviseProcess({
    executable: node,
    arguments: script("process.stdout.write('out'); process.stderr.write('err')"),
    timeoutMs: 1_000,
    maxOutputBytes: 64,
  });
  assert.equal(result.state, PROCESS_STATES.completed);
  assert.equal(result.exitCode, 0);
  assert.equal(result.termination, null);
  assert.equal(result.output.retainedBytes, 6);
  assert.equal(result.output.stdout.buffer.toString(), "out");
  assert.equal(result.output.stderr.buffer.toString(), "err");
  for (const stream of [result.output.stdout, result.output.stderr]) {
    assert.equal(stream.complete, true);
    assert.equal(stream.receivedBytes, stream.retainedBytes);
    assert.equal(stream.sha256, stream.retainedSha256);
    assert.match(stream.sha256, /^[0-9a-f]{64}$/);
  }
});

test("enforces one shared retained-output cap while keeping streams separate", async () => {
  const result = await superviseProcess({
    executable: node,
    arguments: script(
      "process.stdout.write('abcdef'); process.stderr.write('uvwxyz'); setInterval(() => {}, 1000)",
    ),
    timeoutMs: 2_000,
    maxOutputBytes: 8,
  });
  assert.equal(result.state, PROCESS_STATES.outputLimit);
  assert.equal(result.output.limitBytes, 8);
  assert.equal(result.output.retainedBytes, 8);
  assert.equal(result.output.stdout.retainedBytes + result.output.stderr.retainedBytes, 8);
  assert.equal(result.output.stdout.complete, false);
  assert.equal(result.output.stderr.complete, false);
  assert.equal(result.output.stdout.sha256, null);
  assert.equal(result.output.stderr.sha256, null);
  assert.equal(result.output.stdout.retainedSha256, sha256(result.output.stdout.buffer));
  assert.deepEqual(result.termination, {
    firstSignal: "SIGTERM",
    firstSignalSent: true,
    signalScope: process.platform === "win32" ? "process" : "process-group",
    graceMs: TERMINATION_GRACE_MS,
    escalationSignal: "SIGKILL",
    escalationSent: false,
    finalizationGraceMs: FINALIZATION_GRACE_MS,
    completionForced: false,
    signalFailure: null,
  });
});

test("allows output exactly equal to the combined cap", async () => {
  const result = await superviseProcess({
    executable: node,
    arguments: script("process.stdout.write('abcd'); process.stderr.write('efgh')"),
    timeoutMs: 1_000,
    maxOutputBytes: 8,
  });
  assert.equal(result.state, PROCESS_STATES.completed);
  assert.equal(result.output.retainedBytes, 8);
  assert.equal(result.output.limitReached, false);
  assert.equal(result.output.stdout.complete, true);
  assert.equal(result.output.stderr.complete, true);
});

test("timeout uses SIGTERM followed by the fixed SIGKILL grace path", async () => {
  const started = performance.now();
  const result = await superviseProcess({
    executable: node,
    arguments: script("process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"),
    timeoutMs: 300,
    maxOutputBytes: 64,
  });
  assert.equal(result.state, PROCESS_STATES.timeout);
  assert.equal(result.signal, "SIGKILL");
  assert.ok(performance.now() - started >= TERMINATION_GRACE_MS - 30);
  assert.equal(result.termination.graceMs, TERMINATION_GRACE_MS);
  assert.equal(result.termination.firstSignalSent, true);
  assert.equal(result.termination.escalationSent, true);
  assert.equal(result.termination.completionForced, false);
});

test("timeout terminates ordinary descendants in the child process group", async (context) => {
  if (process.platform === "win32") {
    context.skip("Windows does not expose POSIX process-group signaling.");
    return;
  }
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-process-tree-"));
  const marker = path.join(directory, "orphan-marker");
  const descendant = `process.on('SIGTERM',()=>{});setTimeout(()=>require('node:fs').writeFileSync(${JSON.stringify(marker)},'orphan'),1200)`;
  const parent = `const{spawn}=require('node:child_process');spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{stdio:'inherit'});process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`;
  try {
    const started = performance.now();
    const result = await superviseProcess({
      executable: node,
      arguments: script(parent),
      timeoutMs: 100,
      maxOutputBytes: 64,
    });
    assert.equal(result.state, PROCESS_STATES.timeout);
    assert.equal(result.termination.signalScope, "process-group");
    assert.equal(result.termination.escalationSent, true);
    assert.equal(result.termination.completionForced, false);
    assert.ok(
      performance.now() - started < 1_100,
      "process-tree termination exceeded its bounded grace path",
    );
    await new Promise((resolve) => setTimeout(resolve, 750));
    await assert.rejects(access(marker), { code: "ENOENT" });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("escaped inherited pipes cannot exceed the absolute completion bound", async (context) => {
  if (process.platform === "win32") {
    context.skip("Windows does not expose POSIX process-group signaling.");
    return;
  }
  const descendant = "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)";
  const parent = `const{spawn}=require('node:child_process');const child=spawn(process.execPath,['-e',${JSON.stringify(descendant)}],{detached:true,stdio:['ignore',1,2]});process.stdout.write('PID:'+child.pid);process.on('SIGTERM',()=>{});setInterval(()=>{},1000)`;
  let escapedPid = null;
  context.after(() => {
    if (escapedPid !== null) {
      try {
        process.kill(escapedPid, "SIGKILL");
      } catch (error) {
        if (!error || typeof error !== "object" || error.code !== "ESRCH") throw error;
      }
    }
  });
  const started = performance.now();
  const result = await superviseProcess({
    executable: node,
    arguments: script(parent),
    timeoutMs: 100,
    maxOutputBytes: 64,
  });
  const elapsed = performance.now() - started;
  const match = /^PID:(\d+)$/.exec(result.output.stdout.buffer.toString());
  assert.ok(match, "escaped descendant PID was not captured");
  escapedPid = Number(match[1]);
  assert.equal(result.state, PROCESS_STATES.timeout);
  assert.equal(result.termination.completionForced, true);
  assert.ok(
    elapsed >= TERMINATION_GRACE_MS + FINALIZATION_GRACE_MS - 30,
    "supervisor settled before the finalization grace elapsed",
  );
  assert.ok(elapsed < 1_500, "escaped inherited pipe exceeded the absolute completion bound");
});

test("spawn error wins deterministically over an already-aborted signal", async () => {
  const controller = new AbortController();
  controller.abort();
  const result = await superviseProcess({
    executable: "/definitely/not/a/carrylog-command",
    arguments: [],
    timeoutMs: 1_000,
    maxOutputBytes: 64,
    signal: controller.signal,
  });
  assert.equal(result.state, PROCESS_STATES.spawnError);
  assert.equal(result.spawnError, "ENOENT");
});

test("an external abort is signal state, while an unprompted child signal is also signal state", async () => {
  const controller = new AbortController();
  const pending = superviseProcess({
    executable: node,
    arguments: script("setInterval(() => {}, 1000)"),
    timeoutMs: 2_000,
    maxOutputBytes: 64,
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 30);
  const aborted = await pending;
  assert.equal(aborted.state, PROCESS_STATES.signal);
  assert.equal(aborted.termination.graceMs, TERMINATION_GRACE_MS);

  const selfSignalled = await superviseProcess({
    executable: node,
    arguments: script("process.kill(process.pid, 'SIGTERM')"),
    timeoutMs: 1_000,
    maxOutputBytes: 64,
  });
  assert.equal(selfSignalled.state, PROCESS_STATES.signal);
  assert.equal(selfSignalled.signal, "SIGTERM");
});
