import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { resolveNativeClaudeExecutable } from "./claude-router-auth.mjs";
import { resolveNativeCodexExecutable } from "./codex-executable.mjs";
import { redactHarnessDiagnostic } from "./harness-contract.mjs";

const analysisRoot = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(analysisRoot, "..");
const execFileAsync = promisify(execFile);
const harnesses = ["codex", "claude"];
const criticalPaths = [
  "analysis/claude-router-auth.mjs",
  "analysis/codex-executable.mjs",
  "analysis/fixture-command-wrapper.mjs",
  "analysis/harness-contract.mjs",
  "analysis/harness-isolation-canary.mjs",
  "analysis/harness-prerequisites.mjs",
  "analysis/pilot-boundaries.mjs",
  "analysis/run-contract.mjs",
  "analysis/run.mjs",
  "analysis/verification-mcp-server.mjs",
  "verification-commands.json",
];
const pendingSummary = "Authenticated canary has not passed for the current critical bytes.";
const passedSummary =
  "Authenticated canary passed workspace access, external-filesystem denial, registered verification, and model-tool network-denial assertions.";

export async function validateHarnessPrerequisites(
  root = defaultRoot,
  { requirePassed = false } = {},
) {
  const document = JSON.parse(
    await readFile(path.join(root, "harness-prerequisites.json"), "utf8"),
  );
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  assert.deepEqual(Object.keys(document).sort(), [
    "criticalFiles",
    "formatVersion",
    "harnessConfigurationSha256",
    "harnesses",
  ]);
  assert.equal(document.formatVersion, 1);
  assert.equal(
    document.harnessConfigurationSha256,
    configurationDigest(preregistration),
    "harness prerequisite configuration binding differs",
  );
  assert.deepEqual(
    document.criticalFiles.map((file) => file.path),
    criticalPaths,
    "harness-critical file set differs",
  );
  for (const file of document.criticalFiles) {
    assert.deepEqual(Object.keys(file).sort(), ["path", "sha256"]);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.equal(
      file.sha256,
      sha256(await readFile(path.join(root, ...file.path.split("/")))),
      `harness-critical digest differs: ${file.path}`,
    );
  }
  assert.deepEqual(Object.keys(document.harnesses).sort(), [...harnesses].sort());
  for (const harness of harnesses) {
    const attestation = document.harnesses[harness];
    assert.deepEqual(Object.keys(attestation).sort(), [
      "cliVersion",
      "model",
      "resultSha256",
      "resultSummary",
      "status",
      "testedAt",
    ]);
    assert.ok(["pending", "passed"].includes(attestation.status));
    if (attestation.status === "pending") {
      assert.equal(attestation.testedAt, null);
      assert.equal(attestation.cliVersion, null);
      assert.equal(attestation.model, null);
      assert.equal(attestation.resultSha256, null);
      assert.equal(attestation.resultSummary, pendingSummary);
    } else {
      assert.match(attestation.testedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
      assert.equal(attestation.cliVersion, preregistration.harnesses[harness].cli);
      assert.equal(attestation.model, preregistration.harnesses[harness].model);
      assert.match(attestation.resultSha256, /^[0-9a-f]{64}$/);
      assert.equal(attestation.resultSummary, passedSummary);
    }
    if (requirePassed) {
      assert.equal(
        attestation.status,
        "passed",
        `${harness} authenticated harness prerequisite is pending`,
      );
    }
  }
  return document;
}

export async function refreshHarnessPrerequisites(root = defaultRoot) {
  const current = await readOptionalJson(path.join(root, "harness-prerequisites.json"));
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  const criticalFiles = await currentCriticalFiles(root);
  const harnessConfigurationSha256 = configurationDigest(preregistration);
  const bindingsUnchanged =
    current !== null &&
    JSON.stringify(current.criticalFiles) === JSON.stringify(criticalFiles) &&
    current.harnessConfigurationSha256 === harnessConfigurationSha256;
  const document = {
    formatVersion: 1,
    harnessConfigurationSha256,
    criticalFiles,
    harnesses: Object.fromEntries(
      harnesses.map((harness) => [
        harness,
        bindingsUnchanged && current.harnesses?.[harness]?.status === "passed"
          ? current.harnesses[harness]
          : pendingAttestation(),
      ]),
    ),
  };
  await writeDocument(root, document);
  return document;
}

export async function runAuthenticatedHarnessPrerequisite(harness, root = defaultRoot) {
  assert.ok(harnesses.includes(harness), `unknown harness: ${harness}`);
  const document = await validateHarnessPrerequisites(root);
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  const executable =
    harness === "codex"
      ? await resolveNativeCodexExecutable({
          expectedSha256: preregistration.harnesses.codex.nativeExecutableSha256,
          environment: process.env,
        })
      : await resolveNativeClaudeExecutable({
          expectedSha256: preregistration.harnesses.claude.nativeExecutableSha256,
          environment: process.env,
        });
  let cliVersion;
  try {
    cliVersion = (
      await execFileAsync(executable, ["--version"], {
        cwd: path.resolve(root, "../../.."),
        encoding: "utf8",
        timeout: 30_000,
      })
    ).stdout.trim();
  } catch {
    throw new Error(`${harness} CLI version check failed; prerequisite remains pending`);
  }
  assert.equal(cliVersion, preregistration.harnesses[harness].cli);
  let result;
  try {
    result = await execFileAsync(
      process.execPath,
      [path.join(root, "analysis", "harness-isolation-canary.mjs"), "--harness", harness],
      {
        cwd: path.resolve(root, "../../.."),
        encoding: "utf8",
        timeout: 20 * 60_000,
        maxBuffer: 10 * 1024 * 1024,
      },
    );
  } catch (error) {
    const diagnostic = redactHarnessDiagnostic(
      `${error?.stdout ?? ""}\n${error?.stderr ?? ""}\n${error instanceof Error ? error.message : String(error)}`,
    ).slice(0, 6000);
    throw new Error(
      `${harness} authenticated canary failed; prerequisite remains pending; redacted diagnostic: ${diagnostic}`,
    );
  }
  const resultSha256 = sha256(
    `${harness}\0${Buffer.byteLength(result.stdout)}\0${sha256(result.stdout)}\0${Buffer.byteLength(result.stderr)}\0${sha256(result.stderr)}\n`,
  );
  document.harnesses[harness] = {
    status: "passed",
    testedAt: new Date().toISOString(),
    cliVersion,
    model: preregistration.harnesses[harness].model,
    resultSummary: passedSummary,
    resultSha256,
  };
  await writeDocument(root, document);
  return document.harnesses[harness];
}

async function currentCriticalFiles(root) {
  return Promise.all(
    criticalPaths.map(async (relativePath) => ({
      path: relativePath,
      sha256: sha256(await readFile(path.join(root, ...relativePath.split("/")))),
    })),
  );
}

function configurationDigest(preregistration) {
  return sha256(
    JSON.stringify({
      executionPlatform: preregistration.executionPlatform,
      harnesses: preregistration.harnesses,
    }),
  );
}

function pendingAttestation() {
  return {
    status: "pending",
    testedAt: null,
    cliVersion: null,
    model: null,
    resultSummary: pendingSummary,
    resultSha256: null,
  };
}

async function writeDocument(root, document) {
  const destination = path.join(root, "harness-prerequisites.json");
  const temporary = `${destination}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await rename(temporary, destination);
}

async function readOptionalJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseArguments(values) {
  const result = { mode: "", harness: "", root: defaultRoot };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (["--check", "--require-passed", "--refresh", "--run"].includes(value)) {
      assert.equal(result.mode, "", "select exactly one prerequisite mode");
      result.mode = value.slice(2);
    } else if (value === "--harness") {
      result.harness = values[++index] ?? "";
    } else if (value === "--root") {
      result.root = path.resolve(values[++index] ?? assert.fail("--root requires a path"));
    } else throw new Error(`unknown argument: ${value}`);
  }
  assert.notEqual(result.mode, "", "select one prerequisite mode");
  if (result.mode === "run") assert.ok(harnesses.includes(result.harness));
  else assert.equal(result.harness, "", "--harness is valid only with --run");
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const arguments_ = parseArguments(process.argv.slice(2));
  if (arguments_.mode === "check") {
    await validateHarnessPrerequisites(arguments_.root);
    process.stdout.write("Harness prerequisite structure and critical digests are current.\n");
  } else if (arguments_.mode === "require-passed") {
    await validateHarnessPrerequisites(arguments_.root, {
      requirePassed: true,
    });
    process.stdout.write("Both authenticated harness prerequisites passed for current bytes.\n");
  } else if (arguments_.mode === "refresh") {
    const document = await refreshHarnessPrerequisites(arguments_.root);
    process.stdout.write(
      `${JSON.stringify(Object.fromEntries(harnesses.map((harness) => [harness, document.harnesses[harness].status])))}\n`,
    );
  } else {
    const attestation = await runAuthenticatedHarnessPrerequisite(
      arguments_.harness,
      arguments_.root,
    );
    process.stdout.write(
      `${arguments_.harness} authenticated prerequisite recorded at ${attestation.testedAt}.\n`,
    );
  }
}
