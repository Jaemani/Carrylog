import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const analysisDirectory = path.dirname(fileURLToPath(import.meta.url));
const defaultTierRoot = path.resolve(analysisDirectory, "..");
const defaultProjectRoot = path.resolve(defaultTierRoot, "../../..");
const dependencyFileName = "analysis-dependencies.json";
const packageLockName = "package-lock.json";
const rootPackagePath = "node_modules/ajv";
const lockKeys = [
  "version",
  "resolved",
  "integrity",
  "dev",
  "dependencies",
  "optionalDependencies",
  "peerDependencies",
  "peerDependenciesMeta",
  "engines",
  "os",
  "cpu",
];

export async function validateAnalysisDependencies(
  tierRoot = defaultTierRoot,
  { projectRoot = defaultProjectRoot } = {},
) {
  const expected = await readJsonRegularFile(
    path.join(tierRoot, dependencyFileName),
    "analysis dependency snapshot",
  );
  assert.deepEqual(Object.keys(expected).sort(), [
    "formatVersion",
    "lockfileVersion",
    "packages",
    "rootRequirements",
  ]);
  assert.equal(expected.formatVersion, 1);
  assert.equal(expected.lockfileVersion, 3);
  assert.deepEqual(Object.keys(expected.rootRequirements), ["ajv"]);
  assert.equal(typeof expected.rootRequirements.ajv, "string");
  assert.ok(expected.rootRequirements.ajv.length > 0);
  assert.ok(Array.isArray(expected.packages));
  assert.ok(expected.packages.length > 0);

  const lock = await readJsonRegularFile(
    path.join(projectRoot, packageLockName),
    "analysis package lock",
  );
  assert.equal(lock.lockfileVersion, expected.lockfileVersion, "analysis lockfile version differs");
  assert.equal(
    lock.packages?.[""]?.devDependencies?.ajv,
    expected.rootRequirements.ajv,
    "analysis Ajv root requirement differs",
  );

  const closure = resolveLockClosure(lock.packages ?? {}, rootPackagePath);
  assert.deepEqual(
    expected.packages.map((entry) => entry.path),
    closure,
    "analysis dependency closure differs",
  );
  for (const expectedPackage of expected.packages) {
    assert.deepEqual(Object.keys(expectedPackage).sort(), ["artifactSha256", "lock", "path"]);
    assert.match(
      expectedPackage.path,
      /^node_modules\/(?:@[^/]+\/)?[^/]+(?:\/node_modules\/(?:@[^/]+\/)?[^/]+)*$/,
      "invalid analysis dependency package path",
    );
    assert.match(expectedPackage.artifactSha256, /^[0-9a-f]{64}$/);
    const locked = lock.packages[expectedPackage.path];
    assert.ok(locked, `analysis dependency is absent from package lock: ${expectedPackage.path}`);
    assert.deepEqual(
      expectedPackage.lock,
      normalizedLockRecord(locked),
      `analysis dependency lock input differs: ${expectedPackage.path}`,
    );
    const installedPath = path.join(projectRoot, ...expectedPackage.path.split("/"));
    assert.equal(
      await digestPackageTree(installedPath),
      expectedPackage.artifactSha256,
      `installed analysis dependency artifact differs: ${expectedPackage.path}`,
    );
  }
  return expected;
}

export async function buildAnalysisDependencySnapshot(projectRoot = defaultProjectRoot) {
  const lock = await readJsonRegularFile(
    path.join(projectRoot, packageLockName),
    "analysis package lock",
  );
  assert.equal(lock.lockfileVersion, 3, "Tier 1 analysis requires package-lock v3");
  const rootRequirement = lock.packages?.[""]?.devDependencies?.ajv;
  assert.equal(typeof rootRequirement, "string", "Ajv must be a root development dependency");
  const closure = resolveLockClosure(lock.packages ?? {}, rootPackagePath);
  const packages = [];
  for (const packagePath of closure) {
    const locked = lock.packages[packagePath];
    packages.push({
      path: packagePath,
      lock: normalizedLockRecord(locked),
      artifactSha256: await digestPackageTree(path.join(projectRoot, ...packagePath.split("/"))),
    });
  }
  return {
    formatVersion: 1,
    lockfileVersion: 3,
    rootRequirements: { ajv: rootRequirement },
    packages,
  };
}

async function readJsonRegularFile(filePath, label) {
  const metadata = await lstat(filePath);
  assert.equal(metadata.isSymbolicLink(), false, `${label} cannot be a symlink`);
  assert.equal(metadata.isFile(), true, `${label} must be a regular file`);
  return JSON.parse(await readFile(filePath, "utf8"));
}

function resolveLockClosure(packages, entryPath) {
  assert.ok(packages[entryPath], `analysis dependency is absent from package lock: ${entryPath}`);
  const visited = new Set();
  const pending = [entryPath];
  while (pending.length > 0) {
    const packagePath = pending.shift();
    if (visited.has(packagePath)) continue;
    visited.add(packagePath);
    const record = packages[packagePath];
    assert.ok(record, `analysis dependency is absent from package lock: ${packagePath}`);
    const dependencyNames = [
      ...Object.keys(record.dependencies ?? {}),
      ...Object.keys(record.optionalDependencies ?? {}),
    ].sort();
    for (const dependencyName of dependencyNames) {
      const resolved = resolveLockedPackage(packages, packagePath, dependencyName);
      assert.ok(
        resolved,
        `analysis dependency cannot be resolved in package lock: ${packagePath} -> ${dependencyName}`,
      );
      pending.push(resolved);
    }
  }
  return [...visited].sort();
}

function resolveLockedPackage(packages, dependentPath, dependencyName) {
  let ancestor = dependentPath;
  while (ancestor !== null) {
    const candidate = `${ancestor}/node_modules/${dependencyName}`;
    if (packages[candidate]) return candidate;
    ancestor = parentInstalledPackage(ancestor);
  }
  const rootCandidate = `node_modules/${dependencyName}`;
  return packages[rootCandidate] ? rootCandidate : null;
}

function parentInstalledPackage(packagePath) {
  const segments = packagePath.split("/");
  const lastNodeModules = segments.lastIndexOf("node_modules");
  if (lastNodeModules <= 0) return null;
  return segments.slice(0, lastNodeModules).join("/");
}

function normalizedLockRecord(record) {
  assert.ok(record && typeof record === "object" && !Array.isArray(record));
  const normalized = {};
  for (const key of lockKeys) {
    if (Object.hasOwn(record, key)) normalized[key] = record[key];
  }
  assert.equal(typeof normalized.version, "string", "locked analysis dependency lacks a version");
  assert.equal(typeof normalized.integrity, "string", "locked analysis dependency lacks integrity");
  return normalized;
}

async function digestPackageTree(directory) {
  const rootMetadata = await lstat(directory);
  assert.equal(
    rootMetadata.isSymbolicLink(),
    false,
    `analysis dependency cannot be a symlink: ${directory}`,
  );
  assert.equal(
    rootMetadata.isDirectory(),
    true,
    `analysis dependency must be a directory: ${directory}`,
  );
  const files = [];
  await visitPackage(directory, "", files);
  assert.ok(files.length > 0, `analysis dependency artifact is empty: ${directory}`);
  files.sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  return sha256(files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""));
}

async function visitPackage(directory, relativeDirectory, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);
    const metadata = await lstat(absolutePath);
    assert.equal(
      metadata.isSymbolicLink(),
      false,
      `analysis dependency artifact cannot contain a symlink: ${relativePath}`,
    );
    if (metadata.isDirectory()) await visitPackage(absolutePath, relativePath, files);
    else if (metadata.isFile()) {
      const bytes = await readFile(absolutePath);
      files.push({ path: relativePath, bytes: bytes.length, sha256: sha256(bytes) });
    } else throw new Error(`unsupported analysis dependency artifact entry: ${relativePath}`);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
