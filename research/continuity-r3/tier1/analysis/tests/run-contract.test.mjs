import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  assertNoIndexDiffResult,
  assertRegisteredVerificationOnly,
  blindReceiptProjection,
  captureWorkspaceDelta,
  classifyHarnessResultFailure,
  filterClaudeHarnessResult,
  filterCodexHarnessResult,
  projectClaudeBashToolUse,
  projectCodexCommandExecution,
} from "../run-contract.mjs";

const execFileAsync = promisify(execFile);

const cleanDifference = {
  stdout: "diff --git a/example b/example\n",
  stderr: "",
  exitCode: 1,
  signal: null,
  timedOut: false,
  spawnError: null,
};

test("untracked diff accepts only the exact successful no-index process contract", () => {
  assert.doesNotThrow(() => assertNoIndexDiffResult(cleanDifference, "new.txt", 1));
  assert.doesNotThrow(() =>
    assertNoIndexDiffResult({ ...cleanDifference, stdout: "", exitCode: 0 }, "empty.txt", 0),
  );
  for (const mutation of [
    { exitCode: 2 },
    { signal: "SIGTERM" },
    { timedOut: true },
    { spawnError: "ERR_CHILD_PROCESS_STDIO_MAXBUFFER" },
    { stderr: "fatal: cannot read file\n" },
  ]) {
    assert.throws(() => assertNoIndexDiffResult({ ...cleanDifference, ...mutation }, "new.txt", 1));
  }
  assert.throws(() => assertNoIndexDiffResult({ ...cleanDifference, exitCode: 1 }, "empty.txt", 0));
});

test("blind receipt projection removes direct harness and registry identifiers", () => {
  const projected = blindReceiptProjection({
    formatVersion: 2,
    commandId: "quality",
    registrySha256: "a".repeat(64),
    commandSha256: "b".repeat(64),
    executionMode: "direct-under-codex-permission-profile",
    preCommandState: { trackedStatus: " M src/index.ts" },
    preCommandStateSha256: "c".repeat(64),
    exitStatus: 0,
    signal: null,
    timedOut: false,
    spawnError: null,
    stdoutBytes: 1,
    stderrBytes: 0,
    stdoutSha256: "d".repeat(64),
    stderrSha256: "e".repeat(64),
  });
  assert.equal(Object.hasOwn(projected, "executionMode"), false);
  assert.equal(Object.hasOwn(projected, "registrySha256"), false);
  assert.equal(Object.hasOwn(projected, "commandSha256"), false);
  assert.equal(Object.hasOwn(projected, "preCommandState"), false);
  assert.equal(projected.commandId, "quality");
});

test("isolated baseline capture ignores the reset index but retains exact later handoff edits", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-workspace-delta-"));
  const workTree = path.join(parent, "repository");
  const handoff = path.join(workTree, ".agent-context", "handoff.md");
  try {
    await mkdir(path.dirname(handoff), { recursive: true });
    await git(workTree, ["init", "--quiet", "--initial-branch=main"]);
    await writeFile(handoff, "original checkpoint\n");
    await git(workTree, ["add", ".agent-context/handoff.md"]);
    await git(workTree, [
      "-c",
      "user.name=Carrylog Test",
      "-c",
      "user.email=test.invalid",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ]);
    await writeFile(handoff, "delivered checkpoint\n");
    await git(workTree, ["add", ".agent-context/handoff.md"]);
    const tree = await git(workTree, ["write-tree"]);
    const head = await git(workTree, ["rev-parse", "HEAD"]);
    const baselineCommit = await git(
      workTree,
      ["commit-tree", tree, "-p", head, "-m", "delivery baseline"],
      {
        ...process.env,
        GIT_AUTHOR_NAME: "Carrylog Test",
        GIT_AUTHOR_EMAIL: "test.invalid",
        GIT_COMMITTER_NAME: "Carrylog Test",
        GIT_COMMITTER_EMAIL: "test.invalid",
      },
    );
    await git(workTree, ["reset", "--quiet", "HEAD", "--", ".agent-context/handoff.md"]);
    await git(workTree, ["update-index", "--assume-unchanged", ".agent-context/handoff.md"]);
    assert.equal(await git(workTree, ["status", "--porcelain=v1"]), "");

    const gitState = { directory: path.join(workTree, ".git"), workTree };
    const clean = await captureWorkspaceDelta({
      gitState,
      baselineCommit,
      captureRoot: path.join(parent, "clean-capture"),
      environment: process.env,
      runCommand,
      assumeUnchangedPaths: [".agent-context/handoff.md"],
    });
    assert.deepEqual(clean, { patch: "", untrackedPaths: [] });
    assert.match(await git(workTree, ["ls-files", "-v", ".agent-context/handoff.md"]), /^H /);

    await writeFile(handoff, "model checkpoint edit\n");
    const edited = await captureWorkspaceDelta({
      gitState,
      baselineCommit,
      captureRoot: path.join(parent, "edited-capture"),
      environment: process.env,
      runCommand,
    });
    assert.deepEqual(edited.untrackedPaths, []);
    assert.match(edited.patch, /-delivered checkpoint/);
    assert.match(edited.patch, /\+model checkpoint edit/);
    await assert.rejects(readFile(path.join(parent, "edited-capture", "baseline.index")), /ENOENT/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("verification boundary accepts no-command and registered-wrapper cases only", () => {
  assert.deepEqual(assertRegisteredVerificationOnly([], []), {
    directCommandExecutions: 0,
    verifiedWrapperReceipts: 0,
  });
  assert.deepEqual(assertRegisteredVerificationOnly([], [{ commandId: "quality" }]), {
    directCommandExecutions: 0,
    verifiedWrapperReceipts: 1,
  });

  const successful = projectCodexCommandExecution({
    command: "npm test",
    aggregated_output: "all passed\n",
    exit_code: 0,
    status: "completed",
  });
  assert.equal(Object.hasOwn(successful, "command"), false);
  assert.equal(Object.hasOwn(successful, "output"), false);
  assert.equal(successful.commandBytes, 8);
  assert.equal(successful.outputBytes, 11);
  assert.throws(
    () => assertRegisteredVerificationOnly([successful], []),
    (error) => {
      assert.equal(error.stage, "protocol");
      assert.match(error.message, /observed 1 direct shell execution event/);
      return true;
    },
  );

  const failed = projectCodexCommandExecution({
    command: "npm test",
    aggregated_output: "failed\n",
    exit_code: 1,
    status: "failed",
  });
  assert.equal(failed.exitCode, 1);
  assert.throws(
    () => assertRegisteredVerificationOnly([failed], [{ commandId: "quality" }]),
    /only registered verification wrapper receipts are permitted/,
  );

  const claude = projectClaudeBashToolUse({ command: "npm test" });
  assert.equal(Object.hasOwn(claude, "input"), false);
  assert.throws(() => assertRegisteredVerificationOnly([claude], []), /protocol deviation/);
});

test("Codex stream filter accepts no-command and registered MCP-only successful turns", () => {
  const noCommand = filterCodexHarnessResult(
    processResult([
      {
        type: "item.completed",
        item: { type: "agent_message", text: "answer" },
      },
      { type: "turn.completed", usage: { input_tokens: 10, output_tokens: 2 } },
    ]),
  );
  assert.deepEqual(noCommand.commandRecords, []);
  assert.equal(noCommand.finalResponse, "answer");
  assert.equal(classifyHarnessResultFailure("codex", noCommand.process, noCommand), null);

  const registeredMcpOnly = filterCodexHarnessResult(
    processResult([
      {
        type: "item.completed",
        item: {
          id: "mcp-secret-transient-id",
          type: "mcp_tool_call",
          server: "carrylog_verification",
          tool: "quality",
          status: "completed",
        },
      },
      {
        type: "item.completed",
        item: { type: "agent_message", text: "verified" },
      },
      { type: "turn.completed" },
    ]),
  );
  assert.deepEqual(registeredMcpOnly.commandRecords, []);
  assert.equal(
    classifyHarnessResultFailure("codex", registeredMcpOnly.process, registeredMcpOnly),
    null,
  );
  assert.equal(JSON.stringify(registeredMcpOnly).includes("mcp-secret-transient-id"), false);
});

test("Codex stream filter detects and deduplicates direct-command lifecycle events without raw data", () => {
  const command = "printf super-secret-command";
  const output = "super-secret-output\n";
  const transientId = "transient-command-id";
  const filtered = filterCodexHarnessResult(
    processResult([
      {
        type: "item.started",
        item: { id: transientId, type: "command_execution", command, status: "in_progress" },
      },
      {
        type: "item.updated",
        item: { id: transientId, type: "command_execution", command, status: "in_progress" },
      },
      {
        type: "item.completed",
        item: {
          id: transientId,
          type: "command_execution",
          command,
          aggregated_output: output,
          exit_code: 0,
          status: "completed",
        },
      },
      { type: "item.completed", item: { type: "agent_message", text: "done" } },
      { type: "turn.completed" },
    ]),
  );
  assert.equal(filtered.commandRecords.length, 1);
  assert.equal(filtered.commandRecords[0].lifecycle, "completed");
  assert.equal(filtered.commandRecords[0].lifecycleEvents, 3);
  assert.equal(filtered.commandRecords[0].commandBytes, Buffer.byteLength(command));
  assert.equal(filtered.commandRecords[0].outputBytes, Buffer.byteLength(output));
  const rendered = JSON.stringify(filtered);
  for (const forbidden of [command, output.trim(), transientId]) {
    assert.equal(rendered.includes(forbidden), false);
  }
  assert.deepEqual(classifyHarnessResultFailure("codex", filtered.process, filtered), {
    stage: "protocol",
    message:
      "protocol deviation: observed 1 direct shell execution event(s); only registered verification wrapper receipts are permitted",
  });
});

test("Codex completed failed direct commands remain protocol deviations", () => {
  const filtered = filterCodexHarnessResult(
    processResult([
      {
        type: "item.completed",
        item: {
          type: "command_execution",
          command: "false",
          aggregated_output: "failed output",
          exit_code: 1,
          status: "failed",
        },
      },
      { type: "item.completed", item: { type: "agent_message", text: "failed" } },
      { type: "turn.completed" },
    ]),
  );
  assert.equal(filtered.commandRecords[0].exitCode, 1);
  assert.equal(
    classifyHarnessResultFailure("codex", filtered.process, filtered)?.stage,
    "protocol",
  );
});

test("Codex started-only commands outrank timeout, nonzero, and truncated-stream failures", () => {
  const truncatedSecret = "truncated-command-secret";
  const started = JSON.stringify({
    type: "item.started",
    item: {
      id: "started-only-transient-id",
      type: "command_execution",
      command: "long-running-command",
      status: "in_progress",
    },
  });
  for (const mutation of [{ timedOut: true }, { exitCode: 1 }, { exitCode: 1, timedOut: true }]) {
    const result = rawProcessResult(
      `${started}\n{"type":"truncated","command":"${truncatedSecret}`,
      mutation,
    );
    const filtered = filterCodexHarnessResult(result);
    assert.equal(filtered.commandRecords.length, 1);
    assert.equal(filtered.commandRecords[0].lifecycle, "started");
    assert.equal(filtered.completedEventObserved, false);
    assert.equal(classifyHarnessResultFailure("codex", result, filtered)?.stage, "protocol");
    assert.equal(JSON.stringify(filtered).includes(truncatedSecret), false);
  }
});

test("harness filters retain only digests for malformed output, diagnostics, and provider failures", () => {
  const malformedSecret = "malformed-output-secret";
  const stderrSecret = "stderr-secret";
  const providerSecret = "provider-error-secret";
  const codex = filterCodexHarnessResult(
    rawProcessResult(
      [
        `{"broken":"${malformedSecret}`,
        JSON.stringify({ type: "turn.failed", error: { message: providerSecret } }),
      ].join("\n"),
      { stderr: stderrSecret },
    ),
  );
  const claude = filterClaudeHarnessResult(
    rawProcessResult(`{"broken":"${malformedSecret}`, { stderr: stderrSecret }),
  );
  for (const filtered of [codex, claude]) {
    const rendered = JSON.stringify(filtered);
    for (const forbidden of [malformedSecret, stderrSecret, providerSecret]) {
      assert.equal(rendered.includes(forbidden), false);
    }
    for (const event of filtered.visibleEvents) {
      assert.equal(Object.hasOwn(event, "text"), false);
      assert.equal(Object.hasOwn(event, "content"), false);
      assert.equal(Object.hasOwn(event, "message"), false);
    }
  }
  assert.deepEqual(
    codex.visibleEvents.map((event) => event.type),
    ["unparsed-visible-output", "turn.failed", "stderr"],
  );
});

test("Claude Bash tool results retain only digests after a direct-command deviation", () => {
  const commandSecret = "command-secret-value";
  const stringSecret = "string-result-secret";
  const structuredSecret = "structured-result-secret";
  const bashToolUseId = "bash-transient-id";
  const filtered = filterClaudeHarnessResult(
    processResult([
      {
        type: "assistant",
        message: {
          model: "gpt-5.6-sol",
          content: [
            {
              type: "tool_use",
              id: bashToolUseId,
              name: "Bash",
              input: { command: `printf ${commandSecret}` },
            },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: bashToolUseId,
              content: stringSecret,
              is_error: false,
            },
            {
              type: "tool_result",
              tool_use_id: "another-tool-id",
              content: [{ type: "text", text: structuredSecret }],
              is_error: true,
            },
          ],
        },
      },
      {
        type: "result",
        subtype: "success",
        is_error: false,
        result: "done",
      },
    ]),
  );
  assert.equal(filtered.commandRecords.length, 1);
  assert.deepEqual(
    filtered.visibleEvents.map((event) => event.type),
    ["bash_tool_result_digest", "bash_tool_result_digest"],
  );
  assert.equal(filtered.visibleEvents[0].correlated, true);
  assert.equal(filtered.visibleEvents[1].correlated, false);
  const rendered = JSON.stringify(filtered);
  for (const forbidden of [commandSecret, stringSecret, structuredSecret, bashToolUseId]) {
    assert.equal(rendered.includes(forbidden), false);
  }
  assert.equal(
    classifyHarnessResultFailure("claude", filtered.process, filtered)?.stage,
    "protocol",
  );
});

test("provider failures remain harness-execution failures when no protocol deviation exists", () => {
  const result = processResult([], { exitCode: 1, timedOut: true });
  const filtered = filterCodexHarnessResult(result);
  assert.deepEqual(classifyHarnessResultFailure("codex", result, filtered), {
    stage: "harness-execution",
    message: "codex harness failure timeout,exit:1,missing-success-event,missing-final-response",
  });
});

function processResult(events, mutation = {}) {
  return rawProcessResult(events.map((event) => JSON.stringify(event)).join("\n"), mutation);
}

function rawProcessResult(stdout, mutation = {}) {
  return {
    stdout,
    stderr: "",
    exitCode: 0,
    signal: null,
    timedOut: false,
    spawnError: null,
    ...mutation,
  };
}

async function git(cwd, arguments_, env = process.env) {
  return (await execFileAsync("git", arguments_, { cwd, env, encoding: "utf8" })).stdout.trim();
}

async function runCommand(executable, arguments_, options) {
  try {
    const result = await execFileAsync(executable, arguments_, {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      maxBuffer: options.maxBuffer,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      signal: null,
      timedOut: false,
      spawnError: null,
    };
  } catch (error) {
    if (options.allowExit && typeof error.code === "number") {
      return {
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? "",
        exitCode: error.code,
        signal: error.signal ?? null,
        timedOut: false,
        spawnError: null,
      };
    }
    throw error;
  }
}
