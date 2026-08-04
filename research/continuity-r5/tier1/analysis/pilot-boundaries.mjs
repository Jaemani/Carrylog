import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import {
  access,
  constants as fsConstants,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  readlink,
  realpath,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { assertExecutionPredecessors } from "./harness-contract.mjs";

export const PILOT_CACHE_ROOT_ENV = "CARRYLOG_PILOT_CACHE_ROOT";
export const BUSYCAFE_SOURCE_ENV = "CARRYLOG_PILOT_BUSYCAFE_SOURCE";
const PILOT_CACHE_CLAIM = ".carrylog-tier1-cache-claim.json";
const PILOT_CACHE_READY = ".carrylog-tier1-cache-ready.json";
export const SETUP_NETWORK_DENY_PROFILE = `(version 1)
(allow default)
(deny network*)
`;

const execFileAsync = promisify(execFile);

export function assertMacosPilotPlatform(
  platform = process.platform,
  architecture = process.arch,
  expectedArchitecture = "arm64",
) {
  assert.equal(platform, "darwin", "Tier 1 research harness is macOS-only");
  assert.equal(
    architecture,
    expectedArchitecture,
    `Tier 1 research harness requires ${expectedArchitecture}`,
  );
}

export function buildSetupInvocation(executable, arguments_, { allowNetwork }) {
  assert.equal(typeof executable, "string");
  assert.notEqual(executable, "");
  assert.ok(Array.isArray(arguments_) && arguments_.every((value) => typeof value === "string"));
  assert.equal(typeof allowNetwork, "boolean");
  if (allowNetwork) return { executable, arguments: [...arguments_], networkPolicy: "allowed" };
  return {
    executable: "/usr/bin/sandbox-exec",
    arguments: ["-p", SETUP_NETWORK_DENY_PROFILE, "/usr/bin/env", executable, ...arguments_],
    networkPolicy: "seatbelt-denied",
  };
}

export async function resolvePilotCacheRoot(
  environment,
  { allowSetupNetwork = false, repositoryId, systemTemporaryRoots = [tmpdir(), "/tmp"] } = {},
) {
  assert.ok(environment && typeof environment === "object");
  assert.equal(typeof allowSetupNetwork, "boolean");
  assert.ok(["carrylog", "busycafe"].includes(repositoryId), "cache repository ID is invalid");
  const configured = environment[PILOT_CACHE_ROOT_ENV];
  assert.equal(typeof configured, "string", `${PILOT_CACHE_ROOT_ENV} must be set`);
  assert.equal(path.isAbsolute(configured), true, `${PILOT_CACHE_ROOT_ENV} must be absolute`);
  await assertProspectiveDirectoryInsideTemporaryRoot(
    configured,
    systemTemporaryRoots,
    "pilot cache root",
  );
  if (allowSetupNetwork) {
    try {
      await mkdir(configured, { mode: 0o700 });
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
    }
  }
  const canonicalRoot = await assertRealDirectoryInsideTemporaryRoot(
    configured,
    systemTemporaryRoots,
    "pilot cache root",
  );
  await assertPrivateOwnedDirectory(canonicalRoot, "pilot cache root");
  const cachePaths = {
    root: canonicalRoot,
    artifacts: path.join(canonicalRoot, "artifacts"),
    npm: path.join(canonicalRoot, "npm"),
    uv: path.join(canonicalRoot, "uv"),
  };

  let lifecycle;
  if (allowSetupNetwork) {
    assert.deepEqual(
      await readdir(canonicalRoot),
      [],
      "online cache population requires a new empty root",
    );
    const claim = {
      formatVersion: 1,
      cacheId: randomBytes(16).toString("hex"),
      repositoryId,
      state: "populating",
      createdAt: new Date().toISOString(),
    };
    const claimBytes = await writeJsonExclusive(path.join(canonicalRoot, PILOT_CACHE_CLAIM), claim);
    lifecycle = {
      mode: "cold-population",
      cacheId: claim.cacheId,
      repositoryId,
      claimSha256: sha256(claimBytes),
      readySha256: null,
      populatedByRunId: null,
      toolTreeSha256: null,
      carrylogTarballSha256: null,
    };
    for (const name of ["artifacts", "npm", "uv"]) {
      await mkdir(path.join(canonicalRoot, name), { mode: 0o700 });
    }
  } else {
    await assertPilotCacheLayout(cachePaths);
    const claimRecord = await readBoundedRegularJson(
      path.join(canonicalRoot, PILOT_CACHE_CLAIM),
      "pilot cache claim",
    );
    const readyRecord = await readBoundedRegularJson(
      path.join(canonicalRoot, PILOT_CACHE_READY),
      "pilot cache ready receipt",
    );
    validateCacheClaim(claimRecord.value, repositoryId);
    validateCacheReady(readyRecord.value, claimRecord, repositoryId);
    lifecycle = {
      mode: "sealed-offline-reuse",
      cacheId: claimRecord.value.cacheId,
      repositoryId,
      claimSha256: claimRecord.sha256,
      readySha256: readyRecord.sha256,
      populatedByRunId: readyRecord.value.populatedByRunId,
      toolTreeSha256: readyRecord.value.toolTreeSha256,
      carrylogTarballSha256: readyRecord.value.carrylogTarballSha256,
    };
  }
  const cache = {
    ...cachePaths,
    lifecycle,
  };
  await assertPilotCacheLayout(cache);
  return cache;
}

export async function completePilotCachePopulation(
  cache,
  { repositoryId, runId, toolTreeSha256, carrylogTarballSha256 },
) {
  assert.equal(cache?.lifecycle?.mode, "cold-population");
  assert.equal(cache.lifecycle.repositoryId, repositoryId);
  assert.match(runId, /^t1-[0-9]{3}$/);
  assert.match(toolTreeSha256, /^[0-9a-f]{64}$/);
  assert.match(carrylogTarballSha256, /^[0-9a-f]{64}$/);
  await assertPilotCacheLayout(cache);
  const claimRecord = await readBoundedRegularJson(
    path.join(cache.root, PILOT_CACHE_CLAIM),
    "pilot cache claim",
  );
  validateCacheClaim(claimRecord.value, repositoryId);
  assert.equal(claimRecord.sha256, cache.lifecycle.claimSha256, "pilot cache claim changed");
  const ready = {
    formatVersion: 1,
    cacheId: claimRecord.value.cacheId,
    repositoryId,
    state: "ready",
    populatedByRunId: runId,
    toolTreeSha256,
    carrylogTarballSha256,
    claimSha256: claimRecord.sha256,
    completedAt: new Date().toISOString(),
  };
  const readyBytes = await writeJsonExclusive(path.join(cache.root, PILOT_CACHE_READY), ready);
  return {
    mode: "sealed-online-population",
    cacheId: ready.cacheId,
    repositoryId,
    claimSha256: claimRecord.sha256,
    readySha256: sha256(readyBytes),
    populatedByRunId: runId,
    toolTreeSha256,
    carrylogTarballSha256,
  };
}

export async function resolveBusyCafeBareSource(
  environment,
  systemTemporaryRoots = [tmpdir(), "/tmp"],
) {
  assert.ok(environment && typeof environment === "object");
  const configured = environment[BUSYCAFE_SOURCE_ENV];
  assert.equal(typeof configured, "string", `${BUSYCAFE_SOURCE_ENV} must be set`);
  assert.equal(path.isAbsolute(configured), true, `${BUSYCAFE_SOURCE_ENV} must be absolute`);
  const source = await assertRealDirectoryInsideTemporaryRoot(
    configured,
    systemTemporaryRoots,
    "BusyCafe source",
  );
  const bare = (
    await execFileAsync("git", ["-C", source, "rev-parse", "--is-bare-repository"], {
      encoding: "utf8",
      timeout: 30_000,
      env: {
        PATH: environment.PATH ?? process.env.PATH ?? "/usr/bin:/bin",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_OPTIONAL_LOCKS: "0",
      },
    })
  ).stdout.trim();
  assert.equal(bare, "true", "BusyCafe source must be a bare Git repository");
  return source;
}

export async function digestInstalledToolTree(directory) {
  assert.equal(path.isAbsolute(directory), true);
  const root = await realpath(directory);
  const records = [];
  async function visit(current, relative) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) {
        records.push(`d\0${childRelative}\n`);
        await visit(child, childRelative);
      } else if (entry.isFile()) {
        records.push(`f\0${childRelative}\0${sha256(await readFile(child))}\n`);
      } else if (entry.isSymbolicLink()) {
        const target = await readlink(child);
        assert.equal(
          path.isAbsolute(target),
          false,
          `installed tool symlink is absolute: ${childRelative}`,
        );
        const resolvedTarget = path.resolve(path.dirname(child), target);
        const relativeTarget = path.relative(root, resolvedTarget);
        assert.equal(
          relativeTarget !== ".." &&
            !relativeTarget.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relativeTarget),
          true,
          `installed tool symlink escapes its tree: ${childRelative}`,
        );
        records.push(`l\0${childRelative}\0${target}\n`);
      } else {
        throw new Error(`unsupported installed tool entry: ${childRelative}`);
      }
    }
  }
  await visit(root, "");
  return sha256(records.join(""));
}

export async function claimExecutionRun({ tierRoot, order, selectedRun }) {
  assert.equal(path.isAbsolute(tierRoot), true);
  assert.ok(Array.isArray(order?.runs) && order.runs.length > 0);
  assert.ok(selectedRun && typeof selectedRun === "object");
  const quarantineRoot = path.join(tierRoot, "raw-quarantine");
  await mkdir(quarantineRoot, { recursive: true });
  return await withExclusiveSchedulerLock(path.join(quarantineRoot, "execution.lock"), async () => {
    const states = {};
    for (const planned of order.runs) {
      states[planned.runId] = {
        quarantine: await inspectResultSurface(tierRoot, "raw-quarantine", planned),
        reviewed: await inspectResultSurface(tierRoot, "raw-reviewed", planned),
      };
    }
    assertExecutionPredecessors(order.runs, selectedRun.runId, states);

    const byRunPath = path.join(quarantineRoot, "by-run", selectedRun.runId);
    const blindPath = path.join(quarantineRoot, "blind", selectedRun.blindId);
    await mkdir(path.dirname(byRunPath), { recursive: true });
    await mkdir(path.dirname(blindPath), { recursive: true });
    await mkdir(byRunPath);
    try {
      await mkdir(blindPath);
      await writeJsonExclusive(path.join(byRunPath, "claim.json"), {
        formatVersion: 1,
        runId: selectedRun.runId,
        blindId: selectedRun.blindId,
        claimedAt: new Date().toISOString(),
      });
    } catch (error) {
      await rm(blindPath, { recursive: true, force: true }).catch(() => undefined);
      await rm(byRunPath, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
    return { byRunPath, blindPath };
  });
}

export async function withExclusiveSchedulerLock(
  lockPath,
  operation,
  { waitTimeoutMs = 30_000, pollIntervalMs = 10 } = {},
) {
  assert.equal(path.isAbsolute(lockPath), true);
  assert.equal(typeof operation, "function");
  assert.equal(Number.isInteger(waitTimeoutMs) && waitTimeoutMs >= 0, true);
  assert.equal(Number.isInteger(pollIntervalMs) && pollIntervalMs > 0, true);
  const token = `${process.pid}:${Date.now()}:${randomBytes(16).toString("hex")}`;
  const deadline = Date.now() + waitTimeoutMs;
  let handle;
  while (handle === undefined) {
    try {
      handle = await open(lockPath, "wx", 0o600);
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `execution scheduler lock exists: ${lockPath}; verify that no runner remains, then remove it explicitly`,
          { cause: error },
        );
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }
  try {
    await handle.writeFile(`${token}\n`, "utf8");
    await handle.sync();
    return await operation();
  } finally {
    await handle.close().catch(() => undefined);
    assert.equal(await readFile(lockPath, "utf8"), `${token}\n`, "scheduler lock changed");
    await rm(lockPath);
  }
}

async function inspectResultSurface(tierRoot, surface, planned) {
  const byRunPath = path.join(tierRoot, surface, "by-run", planned.runId);
  const blindPath = path.join(tierRoot, surface, "blind", planned.blindId);
  const byRunPresent = await exists(byRunPath);
  const blindPresent = await exists(blindPath);
  if (!byRunPresent) return { byRun: "absent", blind: blindPresent ? "present" : "absent" };
  const claim = await exists(path.join(byRunPath, "claim.json"));
  const complete = await exists(path.join(byRunPath, "complete.json"));
  const failure = await exists(path.join(byRunPath, "failure.json"));
  return {
    byRun:
      complete && failure
        ? "conflicting-terminals"
        : complete
          ? "complete"
          : failure
            ? "failure"
            : claim
              ? "claim-only"
              : "non-terminal",
    blind: blindPresent ? "present" : "absent",
  };
}

async function assertRealDirectoryInsideTemporaryRoot(candidate, systemTemporaryRoots, label) {
  const candidateMetadata = await lstat(candidate);
  assert.equal(candidateMetadata.isDirectory(), true, `${label} must be a directory`);
  assert.equal(candidateMetadata.isSymbolicLink(), false, `${label} must not be a symbolic link`);
  const roots = Array.isArray(systemTemporaryRoots) ? systemTemporaryRoots : [systemTemporaryRoots];
  assert.ok(roots.length > 0);
  const canonicalCandidate = await realpath(candidate);
  const canonicalTemporaryRoots = await Promise.all(roots.map((root) => realpath(root)));
  const inside = canonicalTemporaryRoots.some((canonicalTemporaryRoot) => {
    const relative = path.relative(canonicalTemporaryRoot, canonicalCandidate);
    return (
      relative !== "" &&
      !relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative)
    );
  });
  assert.equal(inside, true, `${label} must be a child of the system temporary directory`);
  return canonicalCandidate;
}

async function assertProspectiveDirectoryInsideTemporaryRoot(
  candidate,
  systemTemporaryRoots,
  label,
) {
  const roots = Array.isArray(systemTemporaryRoots) ? systemTemporaryRoots : [systemTemporaryRoots];
  assert.ok(roots.length > 0);
  let existing = candidate;
  while (true) {
    try {
      await lstat(existing);
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
      const parent = path.dirname(existing);
      assert.notEqual(parent, existing, `${label} has no existing ancestor`);
      existing = parent;
    }
  }
  const [canonicalExisting, ...canonicalRoots] = await Promise.all([
    realpath(existing),
    ...roots.map((root) => realpath(root)),
  ]);
  const prospective = path.resolve(canonicalExisting, path.relative(existing, candidate));
  const inside = canonicalRoots.some((root) => {
    const relative = path.relative(root, prospective);
    return (
      relative !== "" &&
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative)
    );
  });
  assert.equal(inside, true, `${label} must be a child of the system temporary directory`);
}

async function assertPilotCacheLayout(cache) {
  assert.equal(path.isAbsolute(cache.root), true);
  await assertPrivateOwnedDirectory(cache.root, "pilot cache root");
  for (const name of ["artifacts", "npm", "uv"]) {
    const expected = path.join(cache.root, name);
    assert.equal(cache[name], expected, `pilot cache ${name} path differs`);
    await assertPrivateOwnedDirectory(expected, `pilot cache ${name}`);
    assert.equal(
      await realpath(expected),
      expected,
      `pilot cache ${name} must not escape its root`,
    );
  }
}

async function assertPrivateOwnedDirectory(directory, label) {
  const metadata = await lstat(directory);
  assert.equal(metadata.isDirectory(), true, `${label} must be a directory`);
  assert.equal(metadata.isSymbolicLink(), false, `${label} must not be a symbolic link`);
  assert.equal(
    metadata.mode & 0o077,
    0,
    `${label} permissions must exclude group and other access`,
  );
  if (typeof process.getuid === "function") {
    assert.equal(metadata.uid, process.getuid(), `${label} must be owned by the current user`);
  }
}

async function readBoundedRegularJson(filePath, label) {
  let before;
  try {
    before = await lstat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`${label} is absent`, { cause: error });
    }
    throw error;
  }
  assert.equal(before.isFile(), true, `${label} must be a regular file`);
  assert.equal(before.isSymbolicLink(), false, `${label} must not be a symbolic link`);
  assert.equal(
    before.size > 0 && before.size <= 16 * 1024,
    true,
    `${label} size is outside bounds`,
  );
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  let bytes;
  try {
    const opened = await handle.stat();
    assertSameFileIdentity(before, opened, `${label} changed before read`);
    bytes = await handle.readFile();
    const after = await handle.stat();
    assertSameFileIdentity(opened, after, `${label} changed during read`);
  } finally {
    await handle.close();
  }
  assert.equal(bytes.length, before.size, `${label} byte count changed`);
  return { value: JSON.parse(bytes.toString("utf8")), sha256: sha256(bytes) };
}

function validateCacheClaim(claim, repositoryId) {
  assert.deepEqual(Object.keys(claim).sort(), [
    "cacheId",
    "createdAt",
    "formatVersion",
    "repositoryId",
    "state",
  ]);
  assert.equal(claim.formatVersion, 1);
  assert.match(claim.cacheId, /^[0-9a-f]{32}$/);
  assert.equal(claim.repositoryId, repositoryId);
  assert.equal(claim.state, "populating");
  assert.equal(Number.isNaN(Date.parse(claim.createdAt)), false);
}

function validateCacheReady(ready, claimRecord, repositoryId) {
  assert.deepEqual(Object.keys(ready).sort(), [
    "cacheId",
    "carrylogTarballSha256",
    "claimSha256",
    "completedAt",
    "formatVersion",
    "populatedByRunId",
    "repositoryId",
    "state",
    "toolTreeSha256",
  ]);
  assert.equal(ready.formatVersion, 1);
  assert.equal(ready.cacheId, claimRecord.value.cacheId);
  assert.equal(ready.repositoryId, repositoryId);
  assert.equal(ready.state, "ready");
  assert.match(ready.populatedByRunId, /^t1-[0-9]{3}$/);
  assert.match(ready.toolTreeSha256, /^[0-9a-f]{64}$/);
  assert.match(ready.carrylogTarballSha256, /^[0-9a-f]{64}$/);
  assert.equal(ready.claimSha256, claimRecord.sha256);
  assert.equal(Number.isNaN(Date.parse(ready.completedAt)), false);
}

function assertSameFileIdentity(left, right, message) {
  for (const field of ["dev", "ino", "size", "mtimeMs", "ctimeMs"]) {
    assert.equal(right[field], left[field], message);
  }
}

async function writeJsonExclusive(filePath, value) {
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  const handle = await open(filePath, "wx", 0o600);
  try {
    await handle.writeFile(rendered, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  return rendered;
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
