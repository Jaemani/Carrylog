import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { resolveNpmInvocation, resolveNpxInvocation } from "./lib/npm-cli.mjs";
import { parseSingleNpmPackArtifact } from "./lib/npm-pack-json.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ackit-package-smoke-"));
const isolatedNpmCache = path.join(temporaryRoot, "npm-cache");
const releaseMode = process.argv.includes("--release");
const publishDryRunMode = process.argv.includes("--publish-dry-run");
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));

try {
  const packDirectory = path.join(temporaryRoot, "pack with spaces");
  const consumerDirectory = path.join(temporaryRoot, "consumer");
  const sampleDirectory = path.join(temporaryRoot, "sample project");
  const globalPrefix = path.join(temporaryRoot, "global-prefix");
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
    mkdir(sampleDirectory, { recursive: true }),
  ]);

  let expectedArtifact;
  let filename;
  let tarball;
  if (releaseMode) {
    const release = JSON.parse(
      await readFile(path.join(repositoryRoot, "release", "artifact.json"), "utf8"),
    );
    expectedArtifact = release;
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
    const packResult = parseSingleNpmPackArtifact(packed.stdout, manifest);
    expectedArtifact = packResult;
    filename = packResult.filename;
    tarball = path.join(packDirectory, filename);
  }
  await stat(tarball);
  assert.equal(path.isAbsolute(tarball), true, "package smoke tarball path must be absolute");

  if (publishDryRunMode) {
    const publishDryRun = parsePublishDryRun(
      (
        await runNpm(
          ["publish", tarball, "--dry-run", "--json", "--ignore-scripts", "--provenance=false"],
          { cwd: consumerDirectory },
        )
      ).stdout,
    );
    assert.equal(publishDryRun.name, manifest.name, "publish dry-run package differs");
    assert.equal(publishDryRun.version, manifest.version, "publish dry-run version differs");
    assert.equal(publishDryRun.filename, filename, "publish dry-run filename differs");
    assert.equal(publishDryRun.shasum, expectedArtifact.shasum, "publish dry-run SHA-1 differs");
    assert.equal(
      publishDryRun.integrity,
      expectedArtifact.integrity,
      "publish dry-run integrity differs",
    );
  }

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
  assert.equal(installedManifest.license, "MIT");
  assert.deepEqual(installedManifest.publishConfig, {
    access: "public",
    tag: "beta",
    provenance: true,
  });
  const installedSchemaPath = path.join(installedRoot, "schemas", "config-v1.schema.json");
  const installedSchema = await readFile(installedSchemaPath, "utf8");
  const installedLicense = await readFile(path.join(installedRoot, "LICENSE"));
  const installedLicensePolicy = JSON.parse(
    await readFile(path.join(installedRoot, "docs", "license-policy.json"), "utf8"),
  );
  assert.equal(installedLicensePolicy.spdx, installedManifest.license);
  assert.equal(
    createHash("sha256").update(installedLicense).digest("hex"),
    installedLicensePolicy.sha256,
  );
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
    `Package smoke passed: ${filename}; ${publishDryRunMode ? "publish dry-run, " : ""}local, ephemeral, global, ESM, types, init, and validate succeeded.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function runNpm(arguments_, options) {
  const invocation = await resolveNpmInvocation(arguments_);
  return await run(invocation.command, invocation.arguments, options);
}

function parsePublishDryRun(output) {
  const payload = JSON.parse(output);
  if (payload !== null && typeof payload === "object" && !Array.isArray(payload)) {
    if (payload.name === manifest.name) return payload;
    const entries = Object.entries(payload);
    if (entries.length === 1 && entries[0][0] === manifest.name) {
      const candidate = entries[0][1];
      if (candidate !== null && typeof candidate === "object" && !Array.isArray(candidate)) {
        return candidate;
      }
    }
  }
  throw new Error("npm publish dry-run returned an unsupported package envelope");
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
