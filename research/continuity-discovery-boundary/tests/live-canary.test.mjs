import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("live boundary pins TAP output before parsing test metrics", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const source = await readFile(path.join(root, "live-canary.mjs"), "utf8");
  assert.match(source, /"--test-reporter=tap"/);
});

test("macOS live boundary discovers outer Git while preserving nested and isolation guarantees", {
  skip: process.platform !== "darwin" ? "macOS Seatbelt is required" : false,
  timeout: 150_000,
}, async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await command(process.execPath, [path.join(root, "live-canary.mjs")], {
    cwd: path.resolve(root, "../.."),
    env: {
      ...process.env,
      GIT_COMMON_DIR: "/must/not/select",
      GIT_OBJECT_DIRECTORY: "/must/not/select/objects",
    },
    timeout: 140_000,
  });
  assert.equal(result.exitCode, 0, result.stderr);
  const summary = JSON.parse(result.stdout.trim());
  assert.deepEqual(summary, {
    checkoutWrite: "allowed",
    externalSymlinkWrite: "denied",
    focusedTests: { fail: 0, pass: 5, selected: 5 },
    gitEnvironment: "absent",
    gitfileReplace: "denied",
    gitfileWrite: "denied",
    metadata: "unchanged",
    metadataWrite: "denied",
    nestedGit: "independent",
    network: "denied",
    outerRepository: "discovered",
  });
});

function command(executable, arguments_, options) {
  return new Promise((resolve) => {
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const stdout = [];
    const stderr = [];
    const timer = setTimeout(() => child.kill("SIGTERM"), options.timeout);
    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));
    child.once("error", (error) => {
      clearTimeout(timer);
      resolve({ exitCode: 1, stdout: "", stderr: String(error) });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}
