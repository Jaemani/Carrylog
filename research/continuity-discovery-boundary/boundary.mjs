import assert from "node:assert/strict";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

export const GIT_CONTEXT_POLICIES = Object.freeze({
  none: "none",
  repository: "repository",
  discovery: "repository-discovery",
});

export const MACOS_GIT_READ_PATHS = Object.freeze(["/etc/gitconfig", "/usr/share/i18n"]);

const BASE_GIT_VARIABLES = new Set([
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_NOSYSTEM",
  "GIT_CONFIG_SYSTEM",
]);

export function assertCommandGitContext(command) {
  assert.ok(command && typeof command === "object", "registered command is required");
  assert.equal(typeof command.executable, "string", "registered executable is required");
  assert.equal(
    Object.values(GIT_CONTEXT_POLICIES).includes(command.gitContext),
    true,
    "unknown Git context policy",
  );
  const directGit = command.executable === "git";
  assert.equal(
    command.gitContext === GIT_CONTEXT_POLICIES.repository,
    directGit,
    "only a direct Git command may receive repository-selection variables",
  );
}

export function buildVerificationEnvironment({ policy, baseEnvironment, checkout, gitDirectory }) {
  assertPolicy(policy);
  assert.ok(baseEnvironment && typeof baseEnvironment === "object");
  for (const name of Object.keys(baseEnvironment).filter((candidate) =>
    candidate.startsWith("GIT_"),
  )) {
    assert.equal(BASE_GIT_VARIABLES.has(name), true, `base environment contains forbidden ${name}`);
  }
  if (policy !== GIT_CONTEXT_POLICIES.repository) return { ...baseEnvironment };
  assertAbsolute(checkout, "checkout");
  assertAbsolute(gitDirectory, "Git directory");
  return {
    ...baseEnvironment,
    GIT_DIR: gitDirectory,
    GIT_WORK_TREE: checkout,
    GIT_OPTIONAL_LOCKS: "0",
  };
}

export function validateRepositoryDiscoveryLayout({ checkout, gitDirectory, scratchRoot }) {
  for (const [label, value] of [
    ["checkout", checkout],
    ["Git directory", gitDirectory],
    ["scratch root", scratchRoot],
  ]) {
    assertAbsolute(value, label);
    assert.equal(realpathSync(value), value, `${label} must be canonical`);
    const status = lstatSync(value);
    assert.equal(status.isDirectory(), true, `${label} must be a directory`);
    assert.equal(status.isSymbolicLink(), false, `${label} must not be a symbolic link`);
  }
  assert.equal(pathsOverlap(checkout, gitDirectory), false, "Git metadata overlaps checkout");
  assert.equal(pathsOverlap(scratchRoot, gitDirectory), false, "Git metadata overlaps scratch");
  assert.equal(pathsOverlap(checkout, scratchRoot), false, "checkout overlaps scratch");

  const gitfile = path.join(checkout, ".git");
  const gitfileStatus = lstatSync(gitfile);
  assert.equal(gitfileStatus.isFile(), true, "checkout .git must be a regular gitfile");
  assert.equal(gitfileStatus.isSymbolicLink(), false, "checkout .git must not be a symbolic link");
  assert.equal(
    readFileSync(gitfile, "utf8"),
    `gitdir: ${gitDirectory}\n`,
    "checkout gitfile must name the exact canonical external Git directory",
  );
}

export function buildRepositoryDiscoverySeatbeltProfile({
  policy,
  checkout,
  gitDirectory,
  scratchRoot,
  runtimeReadPaths,
  writableCheckout = true,
}) {
  assertPolicy(policy);
  validateRepositoryDiscoveryLayout({ checkout, gitDirectory, scratchRoot });
  assert.ok(Array.isArray(runtimeReadPaths) && runtimeReadPaths.length > 0);
  assert.equal(typeof writableCheckout, "boolean");
  for (const runtimePath of runtimeReadPaths) {
    assertAbsolute(runtimePath, "runtime read path");
    const physicalRuntimePath = realpathIfPresent(runtimePath);
    assert.equal(
      pathsOverlap(runtimePath, gitDirectory) || pathsOverlap(physicalRuntimePath, gitDirectory),
      false,
      "runtime read path overlaps protected Git metadata",
    );
  }

  const exposesRepository = policy !== GIT_CONTEXT_POLICIES.none;
  const readRoots = [checkout, scratchRoot, ...runtimeReadPaths];
  if (exposesRepository) {
    readRoots.push(gitDirectory, ...MACOS_GIT_READ_PATHS);
  }
  const uniqueReadRoots = [...new Set(readRoots)].sort();
  const readRules = uniqueReadRoots
    .map(
      (allowedPath) =>
        `(literal ${JSON.stringify(allowedPath)})\n  (subpath ${JSON.stringify(allowedPath)})`,
    )
    .join("\n  ");
  const runtimeAncestors = new Set();
  for (const runtimePath of uniqueReadRoots) {
    let parent = path.dirname(runtimePath);
    while (parent !== path.dirname(parent)) {
      runtimeAncestors.add(parent);
      parent = path.dirname(parent);
    }
  }
  const metadataRules = [...runtimeAncestors]
    .sort()
    .map((allowedPath) => `(literal ${JSON.stringify(allowedPath)})`)
    .join("\n  ");
  const directoryDataRules = [...runtimeAncestors]
    .filter((allowedPath) => !allowedPath.startsWith("/Users/"))
    .sort()
    .map((allowedPath) => `(literal ${JSON.stringify(allowedPath)})`)
    .join("\n  ");
  const writeRoots = [scratchRoot, ...(writableCheckout ? [checkout] : [])];
  const writeRules = writeRoots
    .map((allowedPath) => `(subpath ${JSON.stringify(allowedPath)})`)
    .join("\n  ");

  return `(version 1)
(deny default)
(allow process*)
(allow sysctl-read
  (sysctl-name "hw.machine")
  (sysctl-name "hw.memsize")
  (sysctl-name "hw.pagesize_compat")
  (sysctl-name "kern.hostname")
  (sysctl-name "kern.osproductversion")
  (sysctl-name "kern.osrelease")
  (sysctl-name "kern.ostype")
  (sysctl-name "kern.version"))
(allow file-read-data
  (literal "/")
  ${directoryDataRules})
(allow file-read-metadata
  (literal "/")
  ${metadataRules})
(allow file-read*
  ${readRules})
(allow file-write*
  (literal "/dev/null")
  ${writeRules})
(deny file-write*
  (literal ${JSON.stringify(path.join(checkout, ".git"))}))
(deny network*)
`;
}

export function deriveMacosRuntimeReadPaths(resolvedExecutables) {
  assert.ok(Array.isArray(resolvedExecutables) && resolvedExecutables.length > 0);
  const paths = new Set([
    "/bin/sh",
    "/bin/bash",
    "/dev/null",
    "/dev/urandom",
    "/Library/Apple/System/Library",
    "/private/var/db/timezone",
    "/private/var/select/sh",
    "/System/Library",
    "/usr/bin/env",
    "/usr/lib",
    "/usr/libexec/git-core",
  ]);
  for (const executable of resolvedExecutables) {
    assertAbsolute(executable.invocationPath, "runtime invocation path");
    assertAbsolute(executable.realPath, "runtime real path");
    paths.add(executable.invocationPath);
    const cellarMatch = executable.realPath.match(/^(.*\/Cellar\/[^/]+\/[^/]+)(?:\/|$)/);
    paths.add(cellarMatch?.[1] ?? executable.realPath);
    if (executable.packageRoot !== undefined) {
      assertAbsolute(executable.packageRoot, "runtime package root");
      paths.add(executable.packageRoot);
    }
    for (const library of executable.linkedLibraries ?? []) {
      assertAbsolute(library.invocationPath, "runtime library invocation path");
      assertAbsolute(library.realPath, "runtime library real path");
      paths.add(library.invocationPath);
      const optKeg = library.invocationPath.match(/^(.*\/opt\/[^/]+)(?:\/|$)/);
      if (optKeg !== null) {
        paths.add(optKeg[1]);
        if (path.basename(optKeg[1]).startsWith("openssl@")) {
          paths.add(
            path.join(path.dirname(path.dirname(optKeg[1])), "etc", path.basename(optKeg[1])),
          );
        }
      }
      const libraryCellar = library.realPath.match(/^(.*\/Cellar\/[^/]+\/[^/]+)(?:\/|$)/);
      paths.add(libraryCellar?.[1] ?? library.realPath);
    }
  }
  return [...paths].sort();
}

function assertPolicy(policy) {
  assert.equal(
    Object.values(GIT_CONTEXT_POLICIES).includes(policy),
    true,
    "unknown Git context policy",
  );
}

function assertAbsolute(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.equal(path.isAbsolute(value), true, `${label} must be absolute`);
}

function realpathIfPresent(value) {
  try {
    return realpathSync(value);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return value;
    }
    throw error;
  }
}

function pathsOverlap(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}${path.sep}`) ||
    normalizedRight.startsWith(`${normalizedLeft}${path.sep}`)
  );
}
