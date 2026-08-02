import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { resolveNativeCodexExecutable } from "../codex-executable.mjs";

test("Codex resolution bypasses the npm launcher and binds native executable bytes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-native-codex-"));
  try {
    const packageRoot = path.join(root, "node_modules", "@openai", "codex");
    const launcher = path.join(packageRoot, "bin", "codex.js");
    const native = path.join(
      packageRoot,
      "node_modules",
      "@openai",
      "codex-darwin-arm64",
      "vendor",
      "aarch64-apple-darwin",
      "bin",
      "codex",
    );
    const nativeBytes = "NATIVE_CODEX_BYTES";
    await mkdir(path.dirname(launcher), { recursive: true });
    await mkdir(path.dirname(native), { recursive: true });
    await writeFile(path.join(packageRoot, "package.json"), '{"name":"@openai/codex"}\n');
    await writeFile(launcher, "#!/usr/bin/env node\n", { mode: 0o700 });
    await writeFile(native, nativeBytes, { mode: 0o700 });
    const expectedSha256 = createHash("sha256").update(nativeBytes).digest("hex");
    const environment = { PATH: path.join(root, "bin") };
    assert.equal(
      await resolveNativeCodexExecutable({
        expectedSha256,
        environment,
        platform: "darwin",
        architecture: "arm64",
        locateImplementation: async (command, observedEnvironment) => {
          assert.equal(command, "codex");
          assert.equal(observedEnvironment, environment);
          return launcher;
        },
      }),
      await realpath(native),
    );
    await assert.rejects(
      resolveNativeCodexExecutable({
        expectedSha256: "0".repeat(64),
        environment,
        platform: "darwin",
        architecture: "arm64",
        locateImplementation: async () => launcher,
      }),
      /native executable digest differs/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex resolution accepts a directly installed native binary and rejects unsafe identity", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-direct-codex-"));
  try {
    const executable = path.join(root, "codex");
    const bytes = "DIRECT_NATIVE_CODEX";
    await writeFile(executable, bytes, { mode: 0o700 });
    const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(
      await resolveNativeCodexExecutable({
        expectedSha256,
        environment: { PATH: root },
        platform: "darwin",
        architecture: "arm64",
        locateImplementation: async () => executable,
      }),
      await realpath(executable),
    );
    await assert.rejects(
      resolveNativeCodexExecutable({
        expectedSha256,
        environment: { PATH: root },
        platform: "plan9",
        architecture: "arm64",
        locateImplementation: async () => executable,
      }),
      /unsupported Codex platform/,
    );
    await assert.rejects(
      resolveNativeCodexExecutable({
        expectedSha256,
        environment: { PATH: root },
        platform: "darwin",
        architecture: "arm64",
        locateImplementation: async () => "relative/codex",
      }),
      /path must be absolute/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
