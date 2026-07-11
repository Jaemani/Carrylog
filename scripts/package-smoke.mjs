import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { resolveNpmInvocation, resolveNpxInvocation } from "./lib/npm-cli.mjs";
import { parseSingleNpmPackArtifact } from "./lib/npm-pack-json.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-package-smoke-"));
const isolatedNpmCache = path.join(temporaryRoot, "npm-cache");
const releaseMode = process.argv.includes("--release");
const publishDryRunMode = process.argv.includes("--publish-dry-run");
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const binaryName = "carrylog";

assert.equal(manifest.name, "carrylog", "package smoke must exercise the canonical package");
assert.deepEqual(manifest.bin, { [binaryName]: "dist/cli.js" });

try {
  const packDirectory = path.join(temporaryRoot, "pack with spaces");
  const consumerDirectory = path.join(temporaryRoot, "consumer");
  const sampleDirectory = path.join(temporaryRoot, "sample project");
  const migrationDirectory = path.join(temporaryRoot, "v1 migration project");
  const globalPrefix = path.join(temporaryRoot, "global-prefix");
  await Promise.all([
    mkdir(packDirectory, { recursive: true }),
    mkdir(consumerDirectory, { recursive: true }),
    mkdir(sampleDirectory, { recursive: true }),
    mkdir(migrationDirectory, { recursive: true }),
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
    `${JSON.stringify({ name: "carrylog-smoke-consumer", private: true }, null, 2)}\n`,
    "utf8",
  );
  await runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], {
    cwd: consumerDirectory,
  });

  const installedRoot = path.join(consumerDirectory, "node_modules", ...manifest.name.split("/"));
  const installedManifest = JSON.parse(
    await readFile(path.join(installedRoot, "package.json"), "utf8"),
  );
  assert.deepEqual(installedManifest.bin, { [binaryName]: "dist/cli.js" });
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
  const installedSchemaV2 = await readFile(
    path.join(installedRoot, "schemas", "config-v2.schema.json"),
    "utf8",
  );
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
  await assert.rejects(() => stat(path.join(installedRoot, "research")), { code: "ENOENT" });
  await stat(path.join(installedRoot, "docs", "configuration.md"));
  await stat(
    path.join(
      installedRoot,
      "docs",
      "decisions",
      "0012-evidence-gates-before-continuity-expansion.md",
    ),
  );
  await stat(path.join(installedRoot, "CHANGELOG.md"));

  await writeFile(
    path.join(consumerDirectory, "consumer.mjs"),
    [
      'import assert from "node:assert/strict";',
      "import {",
      "  AckitError,",
      "  CarrylogError,",
      "  CONFIG_PATH,",
      "  CONFIG_VERSION,",
      "  CONFIG_VERSION_2,",
      "  LATEST_CONFIG_VERSION,",
      "  EXIT_INTERNAL,",
      "  EXIT_ISSUES,",
      "  EXIT_SUCCESS,",
      "  EXIT_USAGE,",
      "  readPublicSchema,",
      `} from ${JSON.stringify(manifest.name)};`,
      "assert.equal(AckitError, CarrylogError);",
      'const error = new CarrylogError("E_CONSUMER", "consumer fixture");',
      "assert.equal(error instanceof AckitError, true);",
      'assert.equal(error.code, "E_CONSUMER");',
      "assert.equal(error.exitCode, EXIT_ISSUES);",
      'assert.equal(CONFIG_PATH, ".agent-context/config.yaml");',
      "assert.equal(CONFIG_VERSION, 1);",
      "assert.equal(CONFIG_VERSION_2, 2);",
      "assert.equal(LATEST_CONFIG_VERSION, 2);",
      "assert.deepEqual([EXIT_SUCCESS, EXIT_ISSUES, EXIT_USAGE, EXIT_INTERNAL], [0, 1, 2, 3]);",
      "process.stdout.write(JSON.stringify([readPublicSchema(), readPublicSchema(2)]));",
      "",
    ].join("\n"),
    "utf8",
  );
  const esmConsumer = await run(process.execPath, [path.join(consumerDirectory, "consumer.mjs")], {
    cwd: consumerDirectory,
  });
  assert.deepEqual(JSON.parse(esmConsumer.stdout), [installedSchema, installedSchemaV2]);

  await writeFile(
    path.join(consumerDirectory, "consumer.mts"),
    [
      "import {",
      "  AckitError,",
      "  CarrylogError,",
      "  CONFIG_VERSION,",
      "  CONFIG_VERSION_2,",
      "  LATEST_CONFIG_VERSION,",
      "  readPublicSchema,",
      "  type Diagnostic,",
      "  type HarnessType,",
      "  type LoadPolicy,",
      "  type MigrateOptions,",
      "  type MigrateResult,",
      "  type ProjectConfig,",
      "  type ProjectConfigV2,",
      `} from ${JSON.stringify(manifest.name)};`,
      "const schema: string = readPublicSchema();",
      "const schemaV2: string = readPublicSchema(2);",
      "const config: ProjectConfig | undefined = undefined;",
      "const configV2: ProjectConfigV2 | undefined = undefined;",
      'const harness: HarnessType = "cursor";',
      'const policy: LoadPolicy = "always";',
      'const diagnostic: Diagnostic = { level: "error", code: "E_CONSUMER", message: "test" };',
      "const migrateOptions: MigrateOptions = {",
      "  to: 2,",
      "  universal: true,",
      "  adopt: false,",
      "  check: true,",
      "  dryRun: false,",
      "};",
      "const migrateResult: MigrateResult = {",
      "  from: 1,",
      "  to: 2,",
      "  changes: [],",
      "  wrote: false,",
      "  drift: true,",
      "};",
      "const error: CarrylogError = new CarrylogError(diagnostic.code, diagnostic.message);",
      "const legacyError: AckitError = error;",
      "const version: 1 = CONFIG_VERSION;",
      "const version2: 2 = CONFIG_VERSION_2;",
      "const latestVersion: 2 = LATEST_CONFIG_VERSION;",
      "void schema;",
      "void schemaV2;",
      "void config;",
      "void configV2;",
      "void harness;",
      "void policy;",
      "void migrateOptions;",
      "void migrateResult;",
      "void error;",
      "void legacyError;",
      "void version;",
      "void version2;",
      "void latestVersion;",
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
          skipLibCheck: false,
          types: ["node"],
          typeRoots: [path.join(repositoryRoot, "node_modules", "@types")],
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
  const binaryVersion = await runNpm(["exec", "--", binaryName, "--version"], {
    cwd: consumerDirectory,
  });
  assert.equal(binaryVersion.stdout.trim(), installedManifest.version);
  const localNpx = await resolveNpxInvocation(["--no-install", binaryName, "--version"]);
  const localNpxVersion = await run(localNpx.command, localNpx.arguments, {
    cwd: consumerDirectory,
  });
  assert.equal(localNpxVersion.stdout.trim(), installedManifest.version);
  const npx = await resolveNpxInvocation([
    "--yes",
    "--package",
    tarball,
    "--",
    binaryName,
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
      ? path.join(globalPrefix, `${binaryName}.cmd`)
      : path.join(globalPrefix, "bin", binaryName);
  const globalVersion =
    process.platform === "win32"
      ? await runWindowsCommandShim(globalBinary, ["--version"], { cwd: consumerDirectory })
      : await run(globalBinary, ["--version"], { cwd: consumerDirectory });
  assert.equal(globalVersion.stdout.trim(), installedManifest.version);

  await createV1MigrationFixture(migrationDirectory, installedSchema);
  const v1Snapshot = await snapshotTree(migrationDirectory);
  const migrationCheck = await run(
    process.execPath,
    [installedCli, "migrate", "--to", "2", "--universal", "--check", "--root", migrationDirectory],
    { cwd: consumerDirectory, allowedExitCodes: [1] },
  );
  assert.equal(migrationCheck.code, 1, "v1 migration check must report drift with exit 1");
  assert.match(migrationCheck.stdout, /~ \.agent-context\/config\.yaml \(update\)/);
  assert.deepEqual(
    await snapshotTree(migrationDirectory),
    v1Snapshot,
    "migration --check must not mutate the v1 project",
  );

  const migrationDryRun = await run(
    process.execPath,
    [
      installedCli,
      "migrate",
      "--to",
      "2",
      "--universal",
      "--dry-run",
      "--root",
      migrationDirectory,
    ],
    { cwd: consumerDirectory },
  );
  assert.equal(migrationDryRun.code, 0, "v1 migration dry-run must exit successfully");
  assert.match(migrationDryRun.stdout, /~ \.agent-context\/config\.yaml \(update\)/);
  assert.deepEqual(
    await snapshotTree(migrationDirectory),
    v1Snapshot,
    "migration --dry-run must not mutate the v1 project",
  );

  const migration = await run(
    process.execPath,
    [installedCli, "migrate", "--to", "2", "--universal", "--root", migrationDirectory],
    { cwd: consumerDirectory },
  );
  assert.equal(migration.code, 0);
  assert.match(migration.stdout, /migrated: [1-9][0-9]* change\(s\)/);
  assert.notDeepEqual(
    await snapshotTree(migrationDirectory),
    v1Snapshot,
    "real migration must change the v1 project",
  );

  const migratedConfig = await readFile(
    path.join(migrationDirectory, ".agent-context", "config.yaml"),
    "utf8",
  );
  assert.match(migratedConfig, /^version: 2$/m);
  assert.match(migratedConfig, /^\s+- type: agents$/m);
  assert.match(migratedConfig, /^\s+- type: claude$/m);
  assert.match(migratedConfig, /^\s+- type: gemini$/m);
  assert.match(migratedConfig, /^\s+generateSkills: true$/m);
  await Promise.all([
    stat(path.join(migrationDirectory, "AGENTS.md")),
    stat(path.join(migrationDirectory, "CLAUDE.md")),
    stat(path.join(migrationDirectory, "GEMINI.md")),
    stat(path.join(migrationDirectory, ".agents", "skills", "carrylog-continuity", "SKILL.md")),
    stat(path.join(migrationDirectory, ".claude", "skills", "carrylog-continuity", "SKILL.md")),
  ]);
  const migratedValidation = await run(
    process.execPath,
    [installedCli, "validate", "--root", migrationDirectory, "--json"],
    { cwd: consumerDirectory },
  );
  assert.equal(JSON.parse(migratedValidation.stdout).valid, true);

  const migratedSnapshot = await snapshotTree(migrationDirectory);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const cleanCheck = await run(
      process.execPath,
      [
        installedCli,
        "migrate",
        "--to",
        "2",
        "--universal",
        "--check",
        "--root",
        migrationDirectory,
      ],
      { cwd: consumerDirectory },
    );
    assert.equal(cleanCheck.code, 0, `repeated migration check ${attempt + 1} must be clean`);
    assert.match(cleanCheck.stdout, /checked: 0 change\(s\)/);
    assert.deepEqual(
      await snapshotTree(migrationDirectory),
      migratedSnapshot,
      `repeated migration check ${attempt + 1} must not mutate the migrated project`,
    );
  }

  await run(process.execPath, [installedCli, "init", "--root", sampleDirectory], {
    cwd: consumerDirectory,
  });
  const validation = await run(
    process.execPath,
    [installedCli, "validate", "--root", sampleDirectory, "--json"],
    { cwd: consumerDirectory },
  );
  assert.equal(JSON.parse(validation.stdout).valid, true);

  await Promise.all([
    stat(path.join(sampleDirectory, "AGENTS.md")),
    stat(path.join(sampleDirectory, "CLAUDE.md")),
    stat(path.join(sampleDirectory, "GEMINI.md")),
    stat(path.join(sampleDirectory, ".agents", "skills", "carrylog-continuity", "SKILL.md")),
    stat(path.join(sampleDirectory, ".claude", "skills", "carrylog-continuity", "SKILL.md")),
  ]);
  await run("git", ["init", "-b", "main"], { cwd: sampleDirectory });
  await run("git", ["config", "user.email", "carrylog-smoke@example.invalid"], {
    cwd: sampleDirectory,
  });
  await run("git", ["config", "user.name", "Carrylog Package Smoke"], {
    cwd: sampleDirectory,
  });
  await run("git", ["add", "."], { cwd: sampleDirectory });
  await run("git", ["commit", "-m", "Initialize Carrylog package smoke"], {
    cwd: sampleDirectory,
  });
  await run(process.execPath, [installedCli, "checkpoint", "--root", sampleDirectory], {
    cwd: consumerDirectory,
  });
  const resumed = await run(
    process.execPath,
    [installedCli, "resume", "--root", sampleDirectory, "--check", "--json"],
    { cwd: consumerDirectory },
  );
  const envelope = JSON.parse(resumed.stdout);
  assert.equal(envelope.project.configVersion, 2);
  assert.equal(envelope.checkpoint.stale, false);
  assert.equal(
    envelope.alwaysContext.some((document) => document.id === "handoff"),
    false,
  );

  process.stdout.write(
    `Package smoke passed: ${filename}; ${publishDryRunMode ? "publish dry-run, " : ""}local, ephemeral, global, ESM, strict types, v1-to-v2 migration, init, validate, checkpoint, and resume succeeded.\n`,
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

async function createV1MigrationFixture(root, schema) {
  const contextDirectory = path.join(root, ".agent-context");
  await mkdir(contextDirectory, { recursive: true });
  const config = `# yaml-language-server: $schema=./config.schema.json
version: 1
project:
  name: Installed package migration fixture
documents:
  - id: instructions
    path: instructions.md
    load: always
    description: Operating rules
  - id: project
    path: project.md
    load: always
    description: Project brief
  - id: current-state
    path: current-state.md
    load: always
    description: Current state
  - id: handoff
    path: handoff.md
    load: always
    description: Latest handoff
  - id: architecture
    path: architecture.md
    load: on-demand
    description: Architecture
    triggers:
      - architecture changes
  - id: decisions
    path: decisions.md
    load: on-demand
    description: Decisions
    triggers:
      - design choices
  - id: conventions
    path: conventions.md
    load: on-demand
    description: Conventions
    triggers:
      - editing code
adapters:
  - type: codex
    output: AGENTS.md
policies:
  maxAlwaysCharacters: 16000
  maxAdapterCharacters: 12000
`;
  const legacyHandoff = `# Handoff

## Last verified

Not yet verified.

## Objective

State the objective of the latest work session.

## Changes

- List meaningful changes and the reason for each.

## Verification

- List exact checks and their results. Do not claim checks that were not run.

## Unresolved

- List known defects, decisions still needed, and assumptions that require validation.

## Next action

State the safest high-value continuation step.
`;
  await Promise.all([
    writeFile(path.join(contextDirectory, "config.yaml"), config, "utf8"),
    writeFile(path.join(contextDirectory, "config.schema.json"), schema, "utf8"),
    writeFile(path.join(contextDirectory, "instructions.md"), "# Operating rules\n", "utf8"),
    writeFile(path.join(contextDirectory, "project.md"), "# Project brief\n", "utf8"),
    writeFile(path.join(contextDirectory, "current-state.md"), "# Current state\n", "utf8"),
    writeFile(path.join(contextDirectory, "handoff.md"), legacyHandoff, "utf8"),
    writeFile(path.join(contextDirectory, "architecture.md"), "# Architecture\n", "utf8"),
    writeFile(path.join(contextDirectory, "decisions.md"), "# Decisions\n", "utf8"),
    writeFile(path.join(contextDirectory, "conventions.md"), "# Conventions\n", "utf8"),
  ]);
}

async function snapshotTree(root) {
  const entries = [];
  await visit(root, "");
  return entries;

  async function visit(directory, relativeDirectory) {
    const children = await readdir(directory, { withFileTypes: true });
    children.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const child of children) {
      const relativePath = path.posix.join(relativeDirectory, child.name);
      const absolutePath = path.join(directory, child.name);
      const metadata = await stat(absolutePath);
      if (child.isDirectory()) {
        entries.push({
          path: `${relativePath}/`,
          type: "directory",
          mode: metadata.mode,
          mtimeMs: metadata.mtimeMs,
        });
        await visit(absolutePath, relativePath);
      } else if (child.isFile()) {
        const content = await readFile(absolutePath);
        entries.push({
          path: relativePath,
          type: "file",
          mode: metadata.mode,
          size: metadata.size,
          mtimeMs: metadata.mtimeMs,
          sha256: createHash("sha256").update(content).digest("hex"),
        });
      } else {
        entries.push({ path: relativePath, type: "other" });
      }
    }
  }
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
      const allowedExitCodes = options.allowedExitCodes ?? [0];
      if (allowedExitCodes.includes(code)) {
        resolve({ code, stdout, stderr });
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
