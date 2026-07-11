import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./helpers.mjs";

const cli = path.resolve("dist/cli.js");
const execFileAsync = promisify(execFile);
const manifest = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));

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
  assert.match(help.stdout, /Carrylog/);
  assert.match(help.stdout, /Usage: carrylog/);
  assert.match(help.stdout, /checkpoint/);
  assert.match(help.stdout, /resume/);
  assert.match(help.stdout, /migrate/);
  const migrateHelp = await runCli(["migrate", "--help"]);
  assert.equal(migrateHelp.code, 0);
  assert.match(
    migrateHelp.stdout,
    /Ensure agents \(Codex\/Cursor\), Claude, and Gemini surfaces and Skills/,
  );
  const invalidMigration = await runCli(["migrate", "--to", "3"]);
  assert.equal(invalidMigration.code, 2);
  assert.match(invalidMigration.stderr, /E_MIGRATION_TARGET/);
  const version = await runCli(["--version"]);
  assert.equal(version.code, 0);
  assert.equal(version.stdout.trim(), manifest.version);
});

test("unknown commands and invalid adapters use the usage exit code", async () => {
  assert.equal((await runCli(["unknown"])).code, 2);
  const root = await createTemporaryDirectory();
  try {
    const result = await runCli(["init", "--root", root, "--adapters", "aider"]);
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
    assert.match(initialized.stdout, /initialized: 14 change/);

    const valid = await runCli(["validate", "--root", root, "--json"]);
    assert.equal(valid.code, 0);
    assert.equal(JSON.parse(valid.stdout).valid, true);

    const agentsPath = path.join(root, "AGENTS.md");
    const agents = await readFile(agentsPath, "utf8");
    await writeFile(
      agentsPath,
      agents.replace("Codex and Cursor project context", "drift"),
      "utf8",
    );

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

test("human diagnostics escape repository-controlled Unicode formatting", async () => {
  const root = await createTemporaryDirectory();
  try {
    assert.equal((await runCli(["init", "--root", root])).code, 0);
    const configPath = path.join(root, ".agent-context", "config.yaml");
    const config = await readFile(configPath, "utf8");
    const hostilePath = "hostile-\u200e.md";
    await writeFile(
      configPath,
      config
        .replace("path: architecture.md", `path: ${hostilePath}`)
        .replace("path: decisions.md", `path: ${hostilePath}`),
      "utf8",
    );

    const result = await runCli(["validate", "--root", root]);
    assert.equal(result.code, 1);
    const output = `${result.stdout}${result.stderr}`;
    assert.equal(output.includes("\u200e"), false);
    assert.match(output, /hostile-\\u200e\.md/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("human success output escapes repository-controlled paths", async () => {
  const root = await createTemporaryDirectory();
  try {
    assert.equal((await runCli(["init", "--root", root])).code, 0);
    const configPath = path.join(root, ".agent-context", "config.yaml");
    const config = await readFile(configPath, "utf8");
    const hostileOutput = "safe-\u202e.md";
    await writeFile(
      configPath,
      config.replace("output: AGENTS.md", `output: ${hostileOutput}`),
      "utf8",
    );

    const result = await runCli(["sync", "--root", root]);
    assert.equal(result.code, 0);
    assert.equal(result.stdout.includes("\u202e"), false);
    assert.match(result.stdout, /safe-\\u202e\.md/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("CLI handoff refresh, check, dry-run, and JSON form one stable lifecycle", async () => {
  const root = await createTemporaryDirectory();
  try {
    assert.equal((await runCli(["init", "--root", root])).code, 0);
    const git = async (...arguments_) =>
      await execFileAsync("git", arguments_, {
        cwd: root,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
      });
    await git("init", "-b", "main");
    await git("config", "user.email", "carrylog-tests@example.invalid");
    await git("config", "user.name", "Carrylog Tests");
    await git("add", ".");
    await git("commit", "-m", "CLI handoff fixture");

    const handoffPath = path.join(root, ".agent-context", "handoff.md");
    const before = await readFile(handoffPath, "utf8");
    const dryRun = await runCli(["handoff", "--root", root, "--dry-run", "--json"]);
    assert.equal(dryRun.code, 0);
    assert.equal(JSON.parse(dryRun.stdout).wrote, false);
    assert.equal(await readFile(handoffPath, "utf8"), before);

    const stale = await runCli(["handoff", "--root", root, "--check", "--json"]);
    assert.equal(stale.code, 1);
    assert.equal(JSON.parse(stale.stdout).drift, true);

    const refreshed = await runCli(["handoff", "--root", root, "--refresh", "--json"]);
    assert.equal(refreshed.code, 0);
    assert.equal(JSON.parse(refreshed.stdout).wrote, true);
    assert.match(await readFile(handoffPath, "utf8"), /CLI handoff fixture/);

    const current = await runCli(["handoff", "--root", root, "--check"]);
    assert.equal(current.code, 0);
    assert.match(current.stdout, /unchanged/);

    const checkpoint = await runCli(["checkpoint", "--root", root, "--check", "--json"]);
    assert.equal(checkpoint.code, 0);
    assert.equal(JSON.parse(checkpoint.stdout).drift, false);
    const resumed = await runCli(["resume", "--root", root, "--check", "--json"]);
    assert.equal(resumed.code, 0);
    assert.equal(JSON.parse(resumed.stdout).project.configVersion, 2);
  } finally {
    await removeTemporaryDirectory(root);
  }
});
