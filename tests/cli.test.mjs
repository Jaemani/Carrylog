import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./helpers.mjs";

const cli = path.resolve("dist/cli.js");

async function runCli(arguments_) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...arguments_], {
      cwd: path.dirname(cli),
      env: { ...process.env, NO_COLOR: "1" },
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
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("help and version are available without a project", async () => {
  const help = await runCli(["--help"]);
  assert.equal(help.code, 0);
  assert.match(help.stdout, /Usage: ackit/);
  const version = await runCli(["--version"]);
  assert.equal(version.code, 0);
  assert.match(version.stdout, /^0\.1\.0-alpha\.0/);
});

test("unknown commands and invalid adapters use the usage exit code", async () => {
  assert.equal((await runCli(["unknown"])).code, 2);
  const root = await createTemporaryDirectory();
  try {
    const result = await runCli(["init", "--root", root, "--adapters", "cursor"]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /E_ADAPTER_ARGUMENT/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("CLI lifecycle returns stable status codes and JSON diagnostics", async () => {
  const root = await createTemporaryDirectory();
  try {
    const initialized = await runCli(["init", "--root", root]);
    assert.equal(initialized.code, 0);
    assert.match(initialized.stdout, /initialized: 10 change/);

    const valid = await runCli(["validate", "--root", root, "--json"]);
    assert.equal(valid.code, 0);
    assert.equal(JSON.parse(valid.stdout).valid, true);

    const agentsPath = path.join(root, "AGENTS.md");
    const agents = await readFile(agentsPath, "utf8");
    await writeFile(agentsPath, agents.replace("Codex project context", "drift"), "utf8");

    const drift = await runCli(["sync", "--root", root, "--check"]);
    assert.equal(drift.code, 1);
    assert.match(drift.stdout, /update/);

    assert.equal((await runCli(["sync", "--root", root])).code, 0);
    assert.equal((await runCli(["validate", "--root", root])).code, 0);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("configuration failures are machine-readable", async () => {
  const root = await createTemporaryDirectory();
  try {
    const result = await runCli(["validate", "--root", root, "--json"]);
    assert.equal(result.code, 1);
    const payload = JSON.parse(result.stderr);
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "E_CONFIG_MISSING");
  } finally {
    await removeTemporaryDirectory(root);
  }
});
