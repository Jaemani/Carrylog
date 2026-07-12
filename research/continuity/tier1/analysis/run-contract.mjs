import assert from "node:assert/strict";

export function assertNoIndexDiffResult(result, relativePath, fileSize) {
  assert.ok(result && typeof result === "object", "untracked diff returned no process result");
  assert.match(relativePath, /\S/, "untracked diff path must not be empty");
  assert.ok(Number.isSafeInteger(fileSize) && fileSize >= 0, "untracked file size is invalid");
  assert.equal(result.signal, null, `untracked diff was signaled: ${relativePath}`);
  assert.equal(result.timedOut, false, `untracked diff timed out: ${relativePath}`);
  assert.equal(result.spawnError, null, `untracked diff failed to spawn: ${relativePath}`);
  assert.equal(result.stderr, "", `untracked diff emitted an error diagnostic: ${relativePath}`);
  assert.equal(
    result.exitCode,
    fileSize === 0 ? 0 : 1,
    `untracked diff returned an unexpected exit code: ${relativePath}`,
  );
}

export function blindReceiptProjection(receipt) {
  return {
    formatVersion: receipt.formatVersion,
    commandId: receipt.commandId,
    preCommandStateSha256: receipt.preCommandStateSha256,
    exitStatus: receipt.exitStatus,
    signal: receipt.signal,
    timedOut: receipt.timedOut,
    spawnError: receipt.spawnError,
    stdoutBytes: receipt.stdoutBytes,
    stderrBytes: receipt.stderrBytes,
    stdoutSha256: receipt.stdoutSha256,
    stderrSha256: receipt.stderrSha256,
  };
}
