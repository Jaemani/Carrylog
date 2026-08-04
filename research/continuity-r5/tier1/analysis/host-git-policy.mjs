import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";

export const SYSTEM_GIT_CONFIG_PATH = "/etc/gitconfig";

export async function captureHostGitPolicy(systemConfigPath = SYSTEM_GIT_CONFIG_PATH) {
  assert.equal(path.isAbsolute(systemConfigPath), true, "system Git config path must be absolute");
  return {
    formatVersion: 1,
    policy: "observed-system-config-read-only",
    systemConfig: await observeSystemGitConfig(systemConfigPath),
  };
}

export async function assertHostGitPolicy(expected) {
  assert.deepEqual(Object.keys(expected).sort(), ["formatVersion", "policy", "systemConfig"]);
  assert.equal(expected.formatVersion, 1, "unsupported host Git policy format");
  assert.equal(expected.policy, "observed-system-config-read-only");
  assert.deepEqual(Object.keys(expected.systemConfig).sort(), ["bytes", "path", "sha256", "state"]);
  const observed = await captureHostGitPolicy(expected.systemConfig.path);
  assert.deepEqual(
    observed,
    expected,
    "host system Git configuration differs from the frozen policy",
  );
  return observed;
}

async function observeSystemGitConfig(systemConfigPath) {
  let before;
  try {
    before = await lstat(systemConfigPath, { bigint: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {
        path: systemConfigPath,
        state: "absent",
        bytes: null,
        sha256: null,
      };
    }
    throw error;
  }
  assert.equal(before.isSymbolicLink(), false, "system Git config must not be a symbolic link");
  assert.equal(before.isFile(), true, "system Git config must be a regular file");
  const bytes = await readFile(systemConfigPath);
  const after = await lstat(systemConfigPath, { bigint: true });
  assert.equal(after.isSymbolicLink(), false, "system Git config became a symbolic link");
  assert.equal(after.isFile(), true, "system Git config ceased to be a regular file");
  assert.deepEqual(
    stableIdentity(after),
    stableIdentity(before),
    "system Git config changed while read",
  );
  assert.equal(BigInt(bytes.length), after.size, "system Git config size changed while read");
  return {
    path: systemConfigPath,
    state: "regular-file",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function stableIdentity(stats) {
  return {
    dev: stats.dev,
    ino: stats.ino,
    size: stats.size,
    mtimeNs: stats.mtimeNs,
    ctimeNs: stats.ctimeNs,
  };
}
