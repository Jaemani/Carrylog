import assert from "node:assert/strict";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { assertHostGitPolicy, captureHostGitPolicy } from "../host-git-policy.mjs";

test("host Git policy binds absence and detects later creation", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-host-git-absent-"));
  const config = path.join(root, "gitconfig");
  try {
    const policy = await captureHostGitPolicy(config);
    assert.deepEqual(policy.systemConfig, {
      path: config,
      state: "absent",
      bytes: null,
      sha256: null,
    });
    await assertHostGitPolicy(policy);
    await writeFile(config, "[core]\n\tautocrlf = false\n");
    await assert.rejects(assertHostGitPolicy(policy), /differs from the frozen policy/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("host Git policy binds regular-file bytes and rejects drift", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-host-git-file-"));
  const config = path.join(root, "gitconfig");
  try {
    await writeFile(config, "[core]\n\tautocrlf = false\n");
    const policy = await captureHostGitPolicy(config);
    assert.equal(policy.systemConfig.state, "regular-file");
    assert.equal(policy.systemConfig.bytes, 25);
    assert.match(policy.systemConfig.sha256, /^[0-9a-f]{64}$/);
    await assertHostGitPolicy(policy);
    await writeFile(config, "[core]\n\tautocrlf = true\n");
    await assert.rejects(assertHostGitPolicy(policy), /differs from the frozen policy/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("host Git policy rejects symbolic links", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-host-git-link-"));
  const target = path.join(root, "target");
  const config = path.join(root, "gitconfig");
  try {
    await writeFile(target, "[core]\n");
    await symlink(target, config);
    await assert.rejects(captureHostGitPolicy(config), /must not be a symbolic link/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
