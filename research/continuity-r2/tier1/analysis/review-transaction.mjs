import assert from "node:assert/strict";
import { access, lstat, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { captureReviewFiles, digestReviewManifest } from "./review-capture.mjs";

export function buildExclusionRecord(run, stage, reasonCode) {
  return {
    run_id: run.runId,
    blind_id: run.blindId,
    stage,
    reason_code: reasonCode,
    retained_artifact_path: `raw-reviewed/by-run/${run.runId}`,
    replacement_run_id: "",
  };
}

export async function ensureExactExclusion(exclusionPath, record) {
  return withExclusionLock(exclusionPath, () => writeExactExclusion(exclusionPath, record));
}

async function writeExactExclusion(exclusionPath, record) {
  const metadata = await lstat(exclusionPath);
  assert.equal(metadata.isFile(), true, "exclusions.csv must be a regular file");
  assert.equal(metadata.isSymbolicLink(), false, "exclusions.csv cannot be a symlink");
  const current = await readFile(exclusionPath, "utf8");
  const lines = current.split(/\r?\n/).filter((line) => line !== "");
  const line = renderExclusionRecord(record);
  const existing = lines.filter((candidate) => candidate.startsWith(`${record.run_id},`));
  if (existing.length > 0) {
    assert.deepEqual(existing, [line], `exclusion retry differs for ${record.run_id}`);
    return false;
  }
  const next = `${current.endsWith("\n") ? current : `${current}\n`}${line}\n`;
  const temporary = `${exclusionPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await writeFile(temporary, next, {
      encoding: "utf8",
      mode: metadata.mode & 0o777,
      flag: "wx",
    });
    await rename(temporary, exclusionPath);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
  return true;
}

async function withExclusionLock(exclusionPath, operation) {
  const lockPath = `${exclusionPath}.lock`;
  const token = `${process.pid}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  const deadline = Date.now() + 30_000;
  let handle;
  while (handle === undefined) {
    try {
      handle = await open(lockPath, "wx", 0o600);
      await handle.writeFile(`${token}\n`, "utf8");
      await handle.sync();
    } catch (error) {
      if (handle !== undefined) {
        await handle.close().catch(() => undefined);
        await rm(lockPath, { force: true }).catch(() => undefined);
        throw error;
      }
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      assert.ok(Date.now() < deadline, "timed out waiting for exclusions.csv lock");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  try {
    return await operation();
  } finally {
    await handle.close();
    assert.equal(await readFile(lockPath, "utf8"), `${token}\n`, "exclusions.csv lock changed");
    await rm(lockPath);
  }
}

export async function publishReviewTransaction(operations, hooks = {}) {
  assert.ok(Array.isArray(operations) && operations.length > 0);
  await hooks.beforePublish?.();
  for (const [index, operation] of operations.entries()) {
    await assertDirectory(operation.source);
    if (await exists(operation.destination)) {
      await assertDirectoriesEqual(operation.source, operation.destination);
      await rm(operation.source, { recursive: true });
    } else {
      await rename(operation.source, operation.destination);
    }
    await hooks.afterPublish?.(index, operation);
  }
}

function renderExclusionRecord(record) {
  const values = [
    record.run_id,
    record.blind_id,
    record.stage,
    record.reason_code,
    record.retained_artifact_path,
    record.replacement_run_id,
  ];
  for (const value of values) {
    assert.equal(typeof value, "string");
    assert.equal(/[\r\n,]/.test(value), false, "exclusion fields cannot contain CSV delimiters");
  }
  return values.join(",");
}

async function assertDirectoriesEqual(left, right) {
  await assertDirectory(right);
  const [leftFiles, rightFiles] = await Promise.all([
    captureReviewFiles([[left, "root"]]),
    captureReviewFiles([[right, "root"]]),
  ]);
  assert.equal(
    digestReviewManifest(leftFiles),
    digestReviewManifest(rightFiles),
    `published review destination differs: ${path.basename(right)}`,
  );
}

async function assertDirectory(directory) {
  const metadata = await lstat(directory);
  assert.equal(
    metadata.isDirectory(),
    true,
    `review transaction path is not a directory: ${directory}`,
  );
  assert.equal(
    metadata.isSymbolicLink(),
    false,
    `review transaction path is a symlink: ${directory}`,
  );
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}
