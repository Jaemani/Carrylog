import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ackit-pack-check-"));

try {
  const result = await runNpmPack(temporaryRoot);
  const payload = JSON.parse(result);
  assert.equal(Array.isArray(payload), true);
  assert.equal(payload.length, 1);
  const artifact = payload[0];
  const files = new Set(artifact.files.map((file) => file.path));
  assert.equal(files.has("package.json"), true);
  assert.equal(files.has("README.md"), true);
  assert.equal(files.has("dist/cli.js"), true);
  assert.equal(
    [...files].some((file) => file.startsWith("src/")),
    false,
  );
  assert.equal(
    [...files].some((file) => file.startsWith("tests/")),
    false,
  );
  assert.equal(
    [...files].some((file) => file.startsWith("scripts/")),
    false,
  );
  process.stdout.write(
    `Package dry-run passed: ${artifact.filename}; ${artifact.entryCount} files, ${artifact.size} bytes.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function runNpmPack(cacheDirectory) {
  return await new Promise((resolve, reject) => {
    const command = process.platform === "win32" ? "npm.cmd" : "npm";
    const child = spawn(command, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NO_COLOR: "1",
        npm_config_cache: cacheDirectory,
      },
      shell: false,
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `npm pack dry-run failed with exit ${code} signal ${signal ?? "none"}\n${stdout}\n${stderr}`,
          ),
        );
      }
    });
  });
}
