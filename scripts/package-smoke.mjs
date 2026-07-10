import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ackit-package-smoke-"));
const isolatedNpmCache = path.join(temporaryRoot, "npm-cache");

try {
  const packDirectory = path.join(temporaryRoot, "pack");
  const consumerDirectory = path.join(temporaryRoot, "consumer");
  const sampleDirectory = path.join(temporaryRoot, "sample project");
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
    mkdir(sampleDirectory, { recursive: true }),
  ]);

  const packed = await run(
    npmCommand(),
    ["pack", "--json", "--ignore-scripts", "--pack-destination", packDirectory],
    {
      cwd: repositoryRoot,
    },
  );
  const packResult = JSON.parse(packed.stdout);
  assert.equal(Array.isArray(packResult), true, "npm pack must return a JSON array");
  assert.equal(packResult.length, 1, "npm pack must produce exactly one artifact");
  const filename = packResult[0]?.filename;
  assert.equal(typeof filename, "string", "npm pack result must include the artifact filename");
  const tarball = path.join(packDirectory, filename);
  await stat(tarball);

  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({ name: "ackit-smoke-consumer", private: true }, null, 2)}\n`,
    "utf8",
  );
  await run(npmCommand(), ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: consumerDirectory,
  });

  const installedRoot = path.join(
    consumerDirectory,
    "node_modules",
    "@jaemani",
    "agent-context-kit",
  );
  const installedManifest = JSON.parse(
    await readFile(path.join(installedRoot, "package.json"), "utf8"),
  );
  assert.equal(installedManifest.bin.ackit, "dist/cli.js");
  await assert.rejects(() => stat(path.join(installedRoot, "src")), { code: "ENOENT" });
  await assert.rejects(() => stat(path.join(installedRoot, "tests")), { code: "ENOENT" });

  const installedCli = path.join(installedRoot, "dist", "cli.js");
  const version = await run(process.execPath, [installedCli, "--version"], {
    cwd: consumerDirectory,
  });
  assert.equal(version.stdout.trim(), installedManifest.version);
  const binaryVersion = await run(npmCommand(), ["exec", "--", "ackit", "--version"], {
    cwd: consumerDirectory,
  });
  assert.equal(binaryVersion.stdout.trim(), installedManifest.version);

  await run(process.execPath, [installedCli, "init", "--root", sampleDirectory], {
    cwd: consumerDirectory,
  });
  const validation = await run(
    process.execPath,
    [installedCli, "validate", "--root", sampleDirectory, "--json"],
    { cwd: consumerDirectory },
  );
  assert.equal(JSON.parse(validation.stdout).valid, true);

  process.stdout.write(
    `Package smoke passed: ${filename}; clean install, version, init, and validate succeeded.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function run(command, arguments_, options) {
  return await new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd: options.cwd,
      env: {
        ...process.env,
        NO_COLOR: "1",
        npm_config_cache: isolatedNpmCache,
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
        resolve({ stdout, stderr });
      } else {
        reject(
          new Error(
            `${command} ${arguments_.join(" ")} failed with exit ${code} signal ${signal ?? "none"}\n${stdout}\n${stderr}`,
          ),
        );
      }
    });
  });
}
