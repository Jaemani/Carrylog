import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const platformTargets = Object.freeze({
  "darwin:arm64": {
    packageName: "@openai/codex-darwin-arm64",
    targetTriple: "aarch64-apple-darwin",
  },
  "darwin:x64": {
    packageName: "@openai/codex-darwin-x64",
    targetTriple: "x86_64-apple-darwin",
  },
  "linux:arm64": {
    packageName: "@openai/codex-linux-arm64",
    targetTriple: "aarch64-unknown-linux-musl",
  },
  "linux:x64": {
    packageName: "@openai/codex-linux-x64",
    targetTriple: "x86_64-unknown-linux-musl",
  },
  "win32:arm64": {
    packageName: "@openai/codex-win32-arm64",
    targetTriple: "aarch64-pc-windows-msvc",
  },
  "win32:x64": {
    packageName: "@openai/codex-win32-x64",
    targetTriple: "x86_64-pc-windows-msvc",
  },
});

export async function resolveNativeCodexExecutable({
  expectedSha256,
  environment,
  platform = process.platform,
  architecture = process.arch,
  locateImplementation = locateCodexEntrypoint,
}) {
  assert.match(expectedSha256, /^[0-9a-f]{64}$/);
  assert.ok(environment && typeof environment === "object");
  assert.equal(typeof locateImplementation, "function");
  const target = platformTargets[`${platform}:${architecture}`];
  assert.ok(target, `unsupported Codex platform: ${platform} (${architecture})`);

  const located = await locateImplementation("codex", environment);
  assert.equal(path.isAbsolute(located), true, "Codex executable path must be absolute");
  const entrypoint = await realpath(located);
  let executable = entrypoint;
  if (path.basename(entrypoint) === "codex.js") {
    const packageRoot = path.resolve(path.dirname(entrypoint), "..");
    const packageDocument = JSON.parse(
      await readFile(path.join(packageRoot, "package.json"), "utf8"),
    );
    assert.equal(packageDocument.name, "@openai/codex", "Codex launcher package identity differs");
    const executableName = platform === "win32" ? "codex.exe" : "codex";
    const packageSegments = target.packageName.split("/");
    const candidates = [
      path.join(
        packageRoot,
        "node_modules",
        ...packageSegments,
        "vendor",
        target.targetTriple,
        "bin",
        executableName,
      ),
      path.join(packageRoot, "vendor", target.targetTriple, "bin", executableName),
    ];
    executable = await firstExistingRealFile(candidates);
  }

  const metadata = await lstat(executable);
  assert.equal(metadata.isFile(), true, "Codex native executable must be a regular file");
  await access(executable, fsConstants.X_OK);
  assert.equal(
    createHash("sha256")
      .update(await readFile(executable))
      .digest("hex"),
    expectedSha256,
    "Codex native executable digest differs",
  );
  return executable;
}

async function locateCodexEntrypoint(command, environment) {
  return (
    await execFileAsync("/usr/bin/which", [command], {
      env: environment,
      encoding: "utf8",
      timeout: 30_000,
    })
  ).stdout.trim();
}

async function firstExistingRealFile(candidates) {
  for (const candidate of candidates) {
    try {
      const resolved = await realpath(candidate);
      const metadata = await lstat(resolved);
      if (metadata.isFile()) return resolved;
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw error;
      }
    }
  }
  throw new Error("Codex native executable is absent from the resolved package");
}
