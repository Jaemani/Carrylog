import assert from "node:assert/strict";
import test from "node:test";
import { assertNoIndexDiffResult, blindReceiptProjection } from "../run-contract.mjs";

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
