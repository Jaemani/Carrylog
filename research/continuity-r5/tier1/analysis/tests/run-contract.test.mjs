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
  monitorVerificationContainment,
  parseTapSummary,
  projectClaudeBashToolUse,
  projectCodexCommandExecution,
} from "../run-contract.mjs";
import {
  appendVerificationRecord,
  createVerificationBrokerRecord,
  createVerificationStartRecord,
  parseVerificationInvocationStream,
  readVerificationInvocationStream,
  sealVerificationReceiptStream,
  waitForVerificationBrokersSettled,
} from "../verification-receipt-protocol.mjs";

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
    formatVersion: 5,
    recordType: "terminal",
    invocationId: "f".repeat(32),
    commandId: "quality",
    registrySha256: "a".repeat(64),
    commandSha256: "b".repeat(64),
    executionMode: "direct-under-codex-permission-profile",
    origin: "mcp-broker",
    brokerId: "1".repeat(32),
    preCommandState: { trackedStatus: " M src/index.ts" },
    preCommandStateSha256: "c".repeat(64),
    processState: "completed",
    exitStatus: 0,
    signal: null,
    timedOut: false,
    outputLimited: false,
    spawnError: null,
    termination: null,
    stdoutBytes: 1,
    stderrBytes: 0,
    stdoutRetainedBytes: 1,
    stderrRetainedBytes: 0,
    stdoutSha256: "d".repeat(64),
    stderrSha256: "e".repeat(64),
    stdoutRetainedSha256: "d".repeat(64),
    stderrRetainedSha256: "e".repeat(64),
  });
  assert.equal(Object.hasOwn(projected, "executionMode"), false);
  assert.equal(Object.hasOwn(projected, "registrySha256"), false);
  assert.equal(Object.hasOwn(projected, "commandSha256"), false);
  assert.equal(Object.hasOwn(projected, "preCommandState"), false);
  assert.equal(Object.hasOwn(projected, "invocationId"), false);
  assert.equal(Object.hasOwn(projected, "recordType"), false);
  assert.equal(Object.hasOwn(projected, "origin"), false);
  assert.equal(Object.hasOwn(projected, "brokerId"), false);
  assert.equal(projected.commandId, "quality");
});

test("TAP projection retains only bounded aggregate counts", () => {
  const output = Buffer.from(
    "TAP version 13\n# tests 16\n# pass 16\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n",
  );
  assert.deepEqual(parseTapSummary(output, false), {
    tests: 16,
    pass: 16,
    fail: 0,
    cancelled: 0,
    skipped: 0,
    todo: 0,
  });
  assert.equal(parseTapSummary(output, true), null);
  assert.equal(parseTapSummary(Buffer.from("not TAP\n"), false), null);
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
  assert.deepEqual(
    assertRegisteredVerificationOnly(
      [],
      [
        {
          commandId: "quality",
          termination: { completionForced: false, signalFailure: null },
        },
      ],
    ),
    { directCommandExecutions: 0, verifiedWrapperReceipts: 1 },
  );
  for (const termination of [
    { completionForced: true, signalFailure: null },
    { completionForced: false, signalFailure: "SIGKILL:EPERM" },
  ]) {
    assert.throws(
      () => assertRegisteredVerificationOnly([], [{ commandId: "quality", termination }]),
      (error) => {
        assert.equal(error.stage, "protocol");
        assert.match(error.message, /verification containment failed for quality/);
        return true;
      },
    );
  }

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

test("containment monitor aborts the harness on a protocol-fatal receipt", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-containment-monitor-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const controller = new AbortController();
  try {
    await writeFile(receiptPath, "");
    const monitor = monitorVerificationContainment({
      receiptPath,
      controller,
      intervalMs: 5,
      parseReceiptStream: (rendered) => ({
        terminalReceipts: rendered
          .trim()
          .split(/\r?\n/)
          .map((line) => JSON.parse(line)),
        unsettledStarts: [],
        unsettledBrokers: [],
      }),
    });
    await writeFile(
      receiptPath,
      `${JSON.stringify({
        commandId: "quality",
        termination: { completionForced: true, signalFailure: null },
      })}\n`,
    );
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("containment monitor did not abort")),
        1_000,
      );
      controller.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timeout);
          resolve();
        },
        { once: true },
      );
    });
    const failure = await monitor.stop();
    assert.equal(controller.signal.aborted, true);
    assert.equal(failure.stage, "protocol");
    assert.match(failure.message, /verification containment failed for quality/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("containment monitor rejects an invocation that has started but not settled", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-containment-unsettled-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const controller = new AbortController();
  const start = createVerificationStartRecord({
    invocationId: "1".repeat(32),
    commandId: "quality",
    registrySha256: "2".repeat(64),
    commandSha256: "3".repeat(64),
    executionMode: "seatbelt-broker-isolated",
    origin: "direct-screen",
    brokerId: null,
  });
  try {
    await writeFile(receiptPath, `${JSON.stringify(start)}\n`);
    const monitor = monitorVerificationContainment({
      receiptPath,
      controller,
      intervalMs: 5,
      parseReceiptStream: parseVerificationInvocationStream,
    });
    const failure = await monitor.stop();
    assert.equal(controller.signal.aborted, true);
    assert.equal(failure.stage, "protocol");
    assert.match(failure.message, /verification invocation did not settle for quality/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("containment monitor rejects truncation and rewriting after observing a valid prefix", async () => {
  for (const mutation of [
    "",
    `${JSON.stringify(
      createVerificationStartRecord({
        invocationId: "2".repeat(32),
        commandId: "quality",
        registrySha256: "3".repeat(64),
        commandSha256: "5".repeat(64),
        executionMode: "seatbelt-broker-isolated",
        origin: "direct-screen",
        brokerId: null,
      }),
    )}\n`,
  ]) {
    const directory = await mkdtemp(path.join(tmpdir(), "carrylog-containment-prefix-"));
    const receiptPath = path.join(directory, "receipts.jsonl");
    const controller = new AbortController();
    const start = createVerificationStartRecord({
      invocationId: "2".repeat(32),
      commandId: "quality",
      registrySha256: "3".repeat(64),
      commandSha256: "4".repeat(64),
      executionMode: "seatbelt-broker-isolated",
      origin: "direct-screen",
      brokerId: null,
    });
    let observedResolve;
    const observed = new Promise((resolve) => {
      observedResolve = resolve;
    });
    try {
      await writeFile(receiptPath, `${JSON.stringify(start)}\n`);
      const monitor = monitorVerificationContainment({
        receiptPath,
        controller,
        intervalMs: 5,
        parseReceiptStream: (rendered) => {
          const stream = parseVerificationInvocationStream(rendered);
          observedResolve();
          return stream;
        },
      });
      await observed;
      const aborted = new Promise((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("containment monitor did not detect prefix mutation")),
          1_000,
        );
        controller.signal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true },
        );
      });
      await writeFile(receiptPath, mutation);
      await aborted;
      const failure = await monitor.stop();
      assert.equal(failure.stage, "protocol");
      assert.match(failure.message, /not append-only/);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("verification invocation stream requires one bound terminal for every start", () => {
  const start = createVerificationStartRecord({
    invocationId: "4".repeat(32),
    commandId: "quality",
    registrySha256: "5".repeat(64),
    commandSha256: "6".repeat(64),
    executionMode: "seatbelt-broker-isolated",
    origin: "direct-screen",
    brokerId: null,
  });
  const terminal = {
    ...start,
    recordType: "terminal",
    processState: "completed",
  };
  const settled = parseVerificationInvocationStream(
    `${JSON.stringify(start)}\n${JSON.stringify(terminal)}\n`,
  );
  assert.equal(settled.unsettledStarts.length, 0);
  assert.equal(settled.terminalReceipts.length, 1);
  assert.throws(
    () => parseVerificationInvocationStream(`${JSON.stringify(terminal)}\n`),
    /terminal receipt has no start/,
  );
  assert.throws(
    () =>
      parseVerificationInvocationStream(
        `${JSON.stringify(start)}\n${JSON.stringify({ ...terminal, commandSha256: "7".repeat(64) })}\n`,
      ),
    /terminal commandSha256 differs from start/,
  );
  assert.throws(() => parseVerificationInvocationStream(`${JSON.stringify(start)}`), /partial/);
});

test("verification invocation stream enforces explicit direct or nested broker ownership", () => {
  const registrySha256 = "7".repeat(64);
  const executionMode = "seatbelt-broker-isolated";
  const broker = createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId: "8".repeat(32),
    registrySha256,
    executionMode,
  });
  const start = createVerificationStartRecord({
    invocationId: "9".repeat(32),
    commandId: "quality",
    registrySha256,
    commandSha256: "a".repeat(64),
    executionMode,
    origin: "mcp-broker",
    brokerId: broker.brokerId,
  });
  const terminal = { ...start, recordType: "terminal", processState: "completed" };
  const brokerTerminal = { ...broker, recordType: "broker-terminal" };
  for (const invalidOwnership of [
    { origin: "mcp-broker", brokerId: null },
    { origin: "direct-screen", brokerId: broker.brokerId },
  ]) {
    assert.throws(() =>
      createVerificationStartRecord({
        invocationId: "d".repeat(32),
        commandId: "quality",
        registrySha256,
        commandSha256: "e".repeat(64),
        executionMode,
        ...invalidOwnership,
      }),
    );
  }
  assert.throws(
    () => parseVerificationInvocationStream(`${JSON.stringify(start)}\n`),
    /invocation has no broker/,
  );
  assert.throws(
    () =>
      parseVerificationInvocationStream(
        `${[broker, start, brokerTerminal, terminal]
          .map((record) => JSON.stringify(record))
          .join("\n")}\n`,
      ),
    /broker terminal precedes invocation terminal/,
  );
  assert.throws(
    () =>
      parseVerificationInvocationStream(
        `${[broker, brokerTerminal, start].map((record) => JSON.stringify(record)).join("\n")}\n`,
      ),
    /started after broker terminal/,
  );
  const direct = createVerificationStartRecord({
    invocationId: "b".repeat(32),
    commandId: "quality",
    registrySha256,
    commandSha256: "c".repeat(64),
    executionMode,
    origin: "direct-screen",
    brokerId: null,
  });
  assert.throws(
    () =>
      parseVerificationInvocationStream(`${JSON.stringify(direct)}\n${JSON.stringify(broker)}\n`),
    /cannot share a direct stream/,
  );
});

test("broker settlement waits for one exact terminal before another session may start", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-settlement-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const broker = createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId: "b".repeat(32),
    registrySha256: "c".repeat(64),
    executionMode: "seatbelt-workspace-isolated",
  });
  try {
    await writeFile(receiptPath, "");
    appendVerificationRecord(receiptPath, broker);
    const terminalWrite = new Promise((resolve) => {
      setTimeout(() => {
        appendVerificationRecord(receiptPath, {
          ...broker,
          recordType: "broker-terminal",
        });
        resolve();
      }, 20);
    });
    const settled = await waitForVerificationBrokersSettled(receiptPath, {
      expectedBrokerCount: 1,
      timeoutMs: 1_000,
      pollIntervalMs: 5,
    });
    await terminalWrite;
    assert.equal(settled.unsettledBrokers.length, 0);
    assert.equal(
      settled.records.filter((record) => record.recordType === "broker-terminal").length,
      1,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("broker settlement times out without weakening an active broker", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-timeout-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  try {
    await writeFile(receiptPath, "");
    appendVerificationRecord(
      receiptPath,
      createVerificationBrokerRecord({
        recordType: "broker-start",
        brokerId: "d".repeat(32),
        registrySha256: "e".repeat(64),
        executionMode: "seatbelt-workspace-isolated",
      }),
    );
    await assert.rejects(
      waitForVerificationBrokersSettled(receiptPath, {
        expectedBrokerCount: 1,
        timeoutMs: 20,
        pollIntervalMs: 5,
      }),
      /verification broker settlement timed out/,
    );
    assert.equal(readVerificationInvocationStream(receiptPath).unsettledBrokers.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("broker settlement rejects an extra settled broker immediately", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-extra-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  try {
    await writeFile(receiptPath, "");
    for (const brokerId of ["1".repeat(32), "2".repeat(32)]) {
      const broker = createVerificationBrokerRecord({
        recordType: "broker-start",
        brokerId,
        registrySha256: "3".repeat(64),
        executionMode: "seatbelt-workspace-isolated",
      });
      appendVerificationRecord(receiptPath, broker);
      appendVerificationRecord(receiptPath, { ...broker, recordType: "broker-terminal" });
    }
    await assert.rejects(
      waitForVerificationBrokersSettled(receiptPath, {
        expectedBrokerCount: 1,
        timeoutMs: 1_000,
        pollIntervalMs: 5,
      }),
      /exceeded the expected count/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("broker settlement retries a transient partial stream but times out persistent corruption", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-partial-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const broker = createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId: "4".repeat(32),
    registrySha256: "5".repeat(64),
    executionMode: "seatbelt-workspace-isolated",
  });
  const settledBytes = `${JSON.stringify(broker)}\n${JSON.stringify({ ...broker, recordType: "broker-terminal" })}\n`;
  try {
    await writeFile(receiptPath, "{");
    const completion = new Promise((resolve, reject) => {
      setTimeout(() => writeFile(receiptPath, settledBytes).then(resolve, reject), 20);
    });
    const settled = await waitForVerificationBrokersSettled(receiptPath, {
      expectedBrokerCount: 1,
      timeoutMs: 1_000,
      pollIntervalMs: 5,
    });
    await completion;
    assert.equal(settled.unsettledBrokers.length, 0);

    await writeFile(receiptPath, "{");
    await assert.rejects(
      waitForVerificationBrokersSettled(receiptPath, {
        expectedBrokerCount: 1,
        timeoutMs: 20,
        pollIntervalMs: 5,
      }),
      /"parseValid":false/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("broker settlement rejects a sealed stream before another process starts", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-sealed-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const registrySha256 = "6".repeat(64);
  const executionMode = "seatbelt-workspace-isolated";
  try {
    await writeFile(receiptPath, "");
    const broker = createVerificationBrokerRecord({
      recordType: "broker-start",
      brokerId: "7".repeat(32),
      registrySha256,
      executionMode,
    });
    appendVerificationRecord(receiptPath, broker);
    appendVerificationRecord(receiptPath, { ...broker, recordType: "broker-terminal" });
    sealVerificationReceiptStream(receiptPath, { registrySha256, executionMode });
    await assert.rejects(
      waitForVerificationBrokersSettled(receiptPath, {
        expectedBrokerCount: 1,
        timeoutMs: 1_000,
        pollIntervalMs: 5,
      }),
      /found a sealed stream/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("broker settlement never accepts a terminal broker with an unsettled invocation", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-broker-unsettled-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const registrySha256 = "8".repeat(64);
  const executionMode = "seatbelt-workspace-isolated";
  const broker = createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId: "9".repeat(32),
    registrySha256,
    executionMode,
  });
  const invocation = createVerificationStartRecord({
    invocationId: "a".repeat(32),
    commandId: "quality",
    registrySha256,
    commandSha256: "b".repeat(64),
    executionMode,
    origin: "mcp-broker",
    brokerId: broker.brokerId,
  });
  try {
    await writeFile(
      receiptPath,
      `${JSON.stringify(broker)}\n${JSON.stringify(invocation)}\n${JSON.stringify({ ...broker, recordType: "broker-terminal" })}\n`,
    );
    await assert.rejects(
      waitForVerificationBrokersSettled(receiptPath, {
        expectedBrokerCount: 1,
        timeoutMs: 20,
        pollIntervalMs: 5,
      }),
      /"parseValid":false/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("verification stream seals only settled broker and invocation history", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-verification-seal-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  const registrySha256 = "8".repeat(64);
  const executionMode = "seatbelt-broker-isolated";
  const broker = createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId: "9".repeat(32),
    registrySha256,
    executionMode,
  });
  const start = createVerificationStartRecord({
    invocationId: "a".repeat(32),
    commandId: "quality",
    registrySha256,
    commandSha256: "b".repeat(64),
    executionMode,
    origin: "mcp-broker",
    brokerId: broker.brokerId,
  });
  try {
    await writeFile(receiptPath, "");
    appendVerificationRecord(receiptPath, broker);
    appendVerificationRecord(receiptPath, start);
    assert.throws(
      () => sealVerificationReceiptStream(receiptPath, { registrySha256, executionMode }),
      /active invocation/,
    );
    appendVerificationRecord(receiptPath, { ...start, recordType: "terminal" });
    assert.throws(
      () => sealVerificationReceiptStream(receiptPath, { registrySha256, executionMode }),
      /active broker/,
    );
    appendVerificationRecord(receiptPath, { ...broker, recordType: "broker-terminal" });
    const seal = sealVerificationReceiptStream(receiptPath, { registrySha256, executionMode });
    const stream = readVerificationInvocationStream(receiptPath);
    assert.deepEqual(stream.seal, seal);
    assert.equal(stream.unsettledStarts.length, 0);
    assert.equal(stream.unsettledBrokers.length, 0);
    assert.throws(
      () => appendVerificationRecord(receiptPath, { ...broker, recordType: "broker-start" }),
      /sealed/,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("a sealed receipt stream that disappears is never reconstructed as empty history", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "carrylog-verification-disappeared-"));
  const receiptPath = path.join(directory, "receipts.jsonl");
  try {
    await writeFile(receiptPath, "");
    sealVerificationReceiptStream(receiptPath, {
      registrySha256: "c".repeat(64),
      executionMode: "seatbelt-broker-isolated",
    });
    await rm(receiptPath);
    assert.throws(
      () => readVerificationInvocationStream(receiptPath),
      (error) => error && typeof error === "object" && error.code === "ENOENT",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
