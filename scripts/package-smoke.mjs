import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { resolveNpmInvocation, resolveNpxInvocation } from "./lib/npm-cli.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ackit-package-smoke-"));
const isolatedNpmCache = path.join(temporaryRoot, "npm-cache");
const releaseMode = process.argv.includes("--release");

try {
  const packDirectory = path.join(temporaryRoot, "pack");
  const consumerDirectory = path.join(temporaryRoot, "consumer");
  const sampleDirectory = path.join(temporaryRoot, "sample project");
  const globalPrefix = path.join(temporaryRoot, "global-prefix");
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
    mkdir(sampleDirectory, { recursive: true }),
  ]);

  let filename;
  let tarball;
  if (releaseMode) {
    const release = JSON.parse(
      await readFile(path.join(repositoryRoot, "release", "artifact.json"), "utf8"),
    );
    filename = release.filename;
    tarball = path.join(repositoryRoot, "release", filename);
    const actualHash = createHash("sha256")
      .update(await readFile(tarball))
      .digest("hex");
    assert.equal(actualHash, release.sha256, "release artifact hash changed before smoke test");
  } else {
    const packed = await runNpm(
      ["pack", "--json", "--ignore-scripts", "--pack-destination", packDirectory],
      { cwd: repositoryRoot },
    );
    const packResult = JSON.parse(packed.stdout);
    assert.equal(Array.isArray(packResult), true, "npm pack must return a JSON array");
    assert.equal(packResult.length, 1, "npm pack must produce exactly one artifact");
    filename = packResult[0]?.filename;
    assert.equal(typeof filename, "string", "npm pack result must include the artifact filename");
    tarball = path.join(packDirectory, filename);
  }
  await stat(tarball);

  await writeFile(
    path.join(consumerDirectory, "package.json"),
    `${JSON.stringify({ name: "ackit-smoke-consumer", private: true }, null, 2)}\n`,
    "utf8",
  );
  await runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
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
  assert.equal(installedManifest.main, "dist/index.js");
  assert.equal(installedManifest.types, "dist/index.d.ts");
  assert.deepEqual(installedManifest.publishConfig, {
    access: "public",
    tag: "beta",
    provenance: true,
  });
  const installedSchemaPath = path.join(installedRoot, "schemas", "config-v1.schema.json");
  const installedSchema = await readFile(installedSchemaPath, "utf8");
  await assert.rejects(() => stat(path.join(installedRoot, "src")), { code: "ENOENT" });
  await assert.rejects(() => stat(path.join(installedRoot, "tests")), { code: "ENOENT" });
  await stat(path.join(installedRoot, "docs", "configuration.md"));
  await stat(path.join(installedRoot, "CHANGELOG.md"));

  await writeFile(
    path.join(consumerDirectory, "consumer.mjs"),
    [
      'import assert from "node:assert/strict";',
      "import {",
      "  AckitError,",
      "  CONFIG_PATH,",
      "  CONFIG_VERSION,",
      "  EXIT_INTERNAL,",
      "  EXIT_ISSUES,",
      "  EXIT_SUCCESS,",
      "  EXIT_USAGE,",
      "  readPublicSchema,",
      '} from "@jaemani/agent-context-kit";',
      'const error = new AckitError("E_CONSUMER", "consumer fixture");',
      'assert.equal(error.code, "E_CONSUMER");',
      "assert.equal(error.exitCode, EXIT_ISSUES);",
      'assert.equal(CONFIG_PATH, ".agent-context/config.yaml");',
      "assert.equal(CONFIG_VERSION, 1);",
      "assert.deepEqual([EXIT_SUCCESS, EXIT_ISSUES, EXIT_USAGE, EXIT_INTERNAL], [0, 1, 2, 3]);",
      "process.stdout.write(readPublicSchema());",
      "",
    ].join("\n"),
    "utf8",
  );
  const esmConsumer = await run(process.execPath, [path.join(consumerDirectory, "consumer.mjs")], {
    cwd: consumerDirectory,
  });
  assert.equal(esmConsumer.stdout, installedSchema);

  await writeFile(
    path.join(consumerDirectory, "consumer.mts"),
    [
      "import {",
      "  AckitError,",
      "  CONFIG_VERSION,",
      "  readPublicSchema,",
      "  type Diagnostic,",
      "  type LoadPolicy,",
      "  type ProjectConfig,",
      '} from "@jaemani/agent-context-kit";',
      "const schema: string = readPublicSchema();",
      "const config: ProjectConfig | undefined = undefined;",
      'const policy: LoadPolicy = "always";',
      'const diagnostic: Diagnostic = { level: "error", code: "E_CONSUMER", message: "test" };',
      "const error: AckitError = new AckitError(diagnostic.code, diagnostic.message);",
      "const version: 1 = CONFIG_VERSION;",
      "void schema;",
      "void config;",
      "void policy;",
      "void error;",
      "void version;",
      "",
    ].join("\n"),
    "utf8",
  );
  await writeFile(
    path.join(consumerDirectory, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          target: "ES2022",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["consumer.mts"],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  await run(
    process.execPath,
    [
      path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      path.join(consumerDirectory, "tsconfig.json"),
    ],
    {
      cwd: consumerDirectory,
    },
  );

  const installedCli = path.join(installedRoot, "dist", "cli.js");
  const version = await run(process.execPath, [installedCli, "--version"], {
    cwd: consumerDirectory,
  });
  assert.equal(version.stdout.trim(), installedManifest.version);
  const binaryVersion = await runNpm(["exec", "--", "ackit", "--version"], {
    cwd: consumerDirectory,
  });
  assert.equal(binaryVersion.stdout.trim(), installedManifest.version);
  const localNpx = await resolveNpxInvocation(["--no-install", "ackit", "--version"]);
  const localNpxVersion = await run(localNpx.command, localNpx.arguments, {
    cwd: consumerDirectory,
  });
  assert.equal(localNpxVersion.stdout.trim(), installedManifest.version);
  const npx = await resolveNpxInvocation([
    "--yes",
    "--package",
    tarball,
    "--",
    "ackit",
    "--version",
  ]);
  const ephemeralVersion = await run(npx.command, npx.arguments, { cwd: consumerDirectory });
  assert.equal(ephemeralVersion.stdout.trim(), installedManifest.version);

  await runNpm(
    [
      "install",
      "--global",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--prefix",
      globalPrefix,
      tarball,
    ],
    { cwd: consumerDirectory },
  );
  const globalBinary =
    process.platform === "win32"
      ? path.join(globalPrefix, "ackit.cmd")
      : path.join(globalPrefix, "bin", "ackit");
  const globalVersion =
    process.platform === "win32"
      ? await runWindowsCommandShim(globalBinary, ["--version"], { cwd: consumerDirectory })
      : await run(globalBinary, ["--version"], { cwd: consumerDirectory });
  assert.equal(globalVersion.stdout.trim(), installedManifest.version);

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
    `Package smoke passed: ${filename}; local, ephemeral, global, ESM, types, init, and validate succeeded.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function runNpm(arguments_, options) {
  const invocation = await resolveNpmInvocation(arguments_);
  return await run(invocation.command, invocation.arguments, options);
}

async function runWindowsCommandShim(command, arguments_, options) {
  const shell = process.env.ComSpec ?? "cmd.exe";
  const values = [command, ...arguments_];
  if (values.some((value) => /["%&|<>^!\r\n]/.test(value))) {
    throw new Error("Windows command-shim smoke path contains unsupported shell metacharacters.");
  }
  const commandLine = values.map((value) => `"${value}"`).join(" ");
  return await run(shell, ["/d", "/s", "/c", `"${commandLine}"`], {
    ...options,
    windowsVerbatimArguments: true,
  });
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
      windowsVerbatimArguments: options.windowsVerbatimArguments === true,
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
