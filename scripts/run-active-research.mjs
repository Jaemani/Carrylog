import { spawnSync } from "node:child_process";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const MACOS_NETWORK_TEST =
  "offline setup invocation denies OS network while online setup remains explicit";
export const PORTABLE_PILOT_TESTS = [
  "Tier 1 runner fails before setup on non-macOS platforms",
  "pilot cache requires one explicit temporary root for artifact, npm, and uv state",
  "pilot cache rejects artifact, npm, and uv child links before external use",
  "BusyCafe fixture source is mandatory, temporary, and bare",
  "installed tool digest binds internal npm links and rejects escaping links",
  "scheduler lock is fail-closed and never removes an unexplained stale lock",
  "concurrent predecessor checks and claims cannot admit a later run first",
  "single-process claim retains the exact run and blind identity",
];
const PORTABLE_PILOT_TEST_COUNT = 8;

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleRoot, "..");
const activeTestDirectories = [
  "research/continuity-r5/tier1/analysis/tests",
  "research/continuity-discovery-boundary/tests",
];

export function buildActiveResearchInvocations(platform, files) {
  const base = ["--test", "--test-concurrency=1"];
  if (platform === "darwin") return [[...base, ...files]];

  const pilotFiles = files.filter((file) => path.basename(file) === "pilot-boundaries.test.mjs");
  if (pilotFiles.length !== 1) {
    throw new Error(`expected one frozen pilot-boundaries test file, found ${pilotFiles.length}`);
  }
  const pilotFile = pilotFiles[0];
  if (pilotFile === undefined) throw new Error("frozen pilot-boundaries test file is unavailable");
  if (
    PORTABLE_PILOT_TESTS.length !== PORTABLE_PILOT_TEST_COUNT ||
    new Set(PORTABLE_PILOT_TESTS).size !== PORTABLE_PILOT_TEST_COUNT
  ) {
    throw new Error("portable pilot allowlist must contain exactly eight unique test names");
  }
  const portableFiles = files.filter((file) => file !== pilotFile);
  const portablePattern = PORTABLE_PILOT_TESTS.map(escapeRegularExpression).join("|");
  return [
    [...base, ...portableFiles],
    [...base, "--test-reporter=tap", `--test-name-pattern=^(?:${portablePattern})$`, pilotFile],
  ];
}

export function validatePortablePilotOutput(output) {
  const metric = (name) => {
    const match = output.match(new RegExp(`^# ${name} (\\d+)$`, "m"));
    if (match === null) throw new Error(`portable pilot output is missing TAP metric: ${name}`);
    return Number(match[1]);
  };
  const observed = {
    tests: metric("tests"),
    pass: metric("pass"),
    fail: metric("fail"),
    skipped: metric("skipped"),
  };
  if (
    observed.tests !== PORTABLE_PILOT_TEST_COUNT ||
    observed.pass !== PORTABLE_PILOT_TEST_COUNT ||
    observed.fail !== 0 ||
    observed.skipped !== 0
  ) {
    throw new Error(
      `portable pilot selection did not pass exactly eight tests: ${JSON.stringify(observed)}`,
    );
  }
}

async function activeTestFiles() {
  const files = [];
  for (const directory of activeTestDirectories) {
    const absoluteDirectory = path.join(projectRoot, directory);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".test.mjs")) {
        files.push(path.join(absoluteDirectory, entry.name));
      }
    }
  }
  return files.sort();
}

async function main() {
  const files = await activeTestFiles();
  const invocations = buildActiveResearchInvocations(process.platform, files);
  for (const [index, arguments_] of invocations.entries()) {
    const capturePortablePilot = process.platform !== "darwin" && index === invocations.length - 1;
    const result = spawnSync(process.execPath, arguments_, {
      cwd: projectRoot,
      env: process.env,
      stdio: capturePortablePilot ? ["ignore", "pipe", "pipe"] : "inherit",
      ...(capturePortablePilot ? { encoding: "utf8" } : {}),
      shell: false,
    });
    if (result.error !== undefined) throw result.error;
    if (capturePortablePilot) {
      if (typeof result.stdout === "string") process.stdout.write(result.stdout);
      if (typeof result.stderr === "string") process.stderr.write(result.stderr);
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      return;
    }
    if (capturePortablePilot && typeof result.stdout === "string") {
      validatePortablePilotOutput(result.stdout);
    }
  }
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const invocation = process.argv[1];
if (invocation !== undefined && pathToFileURL(path.resolve(invocation)).href === import.meta.url) {
  await main();
}
