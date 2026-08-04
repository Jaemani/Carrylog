import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildRepositoryDiscoverySeatbeltProfile,
  buildVerificationEnvironment,
  deriveMacosRuntimeReadPaths,
  GIT_CONTEXT_POLICIES,
  validateRepositoryDiscoveryLayout,
} from "./boundary.mjs";

assert.equal(process.platform, "darwin", "the live repository-discovery canary requires macOS");
assert.equal(existsSync("/usr/bin/sandbox-exec"), true, "sandbox-exec is unavailable");

const moduleRoot = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = realpathSync(path.resolve(moduleRoot, "../.."));
const sourceModules = realpathSync(path.join(sourceRoot, "node_modules"));
const temporaryRoot = realpathSync(
  mkdtempSync(path.join(tmpdir(), "carrylog-repository-discovery-")),
);
const checkout = path.join(temporaryRoot, "checkout");
const gitDirectory = path.join(temporaryRoot, "metadata.git");
const scratchRoot = path.join(temporaryRoot, "scratch");
const scratchHome = path.join(scratchRoot, "home");
const scratchTmp = path.join(scratchRoot, "tmp");
const externalReadRoot = path.join(temporaryRoot, "external-readonly");
const externalSentinel = path.join(externalReadRoot, "sentinel.txt");
const externalWriteTarget = path.join(externalReadRoot, "must-not-write.txt");
const metadataWriteTarget = path.join(gitDirectory, "must-not-write.txt");
const checkoutWriteTarget = path.join(checkout, "seatbelt-workspace-write.txt");
const runnerPath = path.join(scratchRoot, "runner.mjs");
const nodeInvocation = process.execPath;
const developerDirectory = realpathSync("/Library/Developer/CommandLineTools");
const gitInvocation = path.join(developerDirectory, "usr", "bin", "git");
let server;

try {
  commandSync(
    gitInvocation,
    ["clone", "--quiet", "--no-local", `--separate-git-dir=${gitDirectory}`, sourceRoot, checkout],
    { cwd: temporaryRoot, env: hostGitEnvironment() },
  );
  mkdirSync(scratchHome, { recursive: true, mode: 0o700 });
  mkdirSync(scratchTmp, { recursive: true, mode: 0o700 });
  mkdirSync(externalReadRoot, { mode: 0o700 });
  writeFileSync(externalSentinel, "READ_ONLY_SENTINEL\n", { mode: 0o600 });
  cpSync(path.join(sourceRoot, "dist"), path.join(checkout, "dist"), { recursive: true });
  for (const testFile of ["continuity.test.mjs", "helpers.mjs"]) {
    cpSync(path.join(sourceRoot, "tests", testFile), path.join(checkout, "tests", testFile));
  }
  symlinkSync(sourceModules, path.join(checkout, "node_modules"));
  symlinkSync(externalReadRoot, path.join(checkout, "external-runtime-link"));

  const layout = {
    checkout: realpathSync(checkout),
    gitDirectory: realpathSync(gitDirectory),
    scratchRoot: realpathSync(scratchRoot),
  };
  validateRepositoryDiscoveryLayout(layout);
  const expectedHead = commandSync(gitInvocation, ["-C", checkout, "rev-parse", "HEAD"], {
    env: hostGitEnvironment(),
  }).stdout.trim();
  const metadataBefore = digestDirectory(gitDirectory);
  const gitfileBefore = digestFile(path.join(checkout, ".git"));
  const externalBefore = digestDirectory(externalReadRoot);

  let observedConnections = 0;
  server = net.createServer((socket) => socket.end("UNEXPECTED_NETWORK_CONNECTION"));
  server.on("connection", () => {
    observedConnections += 1;
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");

  writeFileSync(
    runnerPath,
    renderRunner({
      checkout,
      gitDirectory,
      scratchTmp,
      expectedHead,
      externalSentinel,
      metadataWriteTarget,
      checkoutWriteTarget,
      port: address.port,
    }),
    { mode: 0o500, flag: "wx" },
  );

  const runtimeReadPaths = deriveMacosRuntimeReadPaths([resolveRuntime(nodeInvocation)]);
  runtimeReadPaths.push(developerDirectory, sourceModules, externalReadRoot);
  const profile = buildRepositoryDiscoverySeatbeltProfile({
    policy: GIT_CONTEXT_POLICIES.discovery,
    ...layout,
    runtimeReadPaths: [...new Set(runtimeReadPaths)].sort(),
  });
  const baseEnvironment = {
    HOME: scratchHome,
    USER: "carrylog-verification",
    LOGNAME: "carrylog-verification",
    PATH: `${path.dirname(nodeInvocation)}:${path.join(developerDirectory, "usr", "bin")}:/usr/bin:/bin`,
    TMPDIR: scratchTmp,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    CI: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_GLOBAL: "/dev/null",
    DEVELOPER_DIR: developerDirectory,
  };
  const childEnvironment = buildVerificationEnvironment({
    policy: GIT_CONTEXT_POLICIES.discovery,
    baseEnvironment,
    checkout,
    gitDirectory,
  });
  const result = await command(
    "/usr/bin/sandbox-exec",
    ["-p", profile, nodeInvocation, runnerPath],
    { cwd: checkout, env: childEnvironment, timeout: 120_000 },
  );
  server.close();
  server = undefined;

  assert.equal(
    result.exitCode,
    0,
    `live discovery canary failed: ${JSON.stringify({ stdout: result.stdout.slice(-4000), stderr: result.stderr.slice(-4000) })}`,
  );
  const summary = JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
  assert.deepEqual(summary, {
    checkoutWrite: "allowed",
    externalSymlinkWrite: "denied",
    focusedTests: { fail: 0, pass: 5, selected: 5 },
    gitEnvironment: "absent",
    gitfileReplace: "denied",
    gitfileWrite: "denied",
    metadataWrite: "denied",
    nestedGit: "independent",
    network: "denied",
    outerRepository: "discovered",
  });
  assert.equal(observedConnections, 0, "sandboxed child reached the localhost listener");
  assert.equal(readFileSync(checkoutWriteTarget, "utf8"), "CHECKOUT_WRITE_ALLOWED\n");
  assert.equal(existsSync(metadataWriteTarget), false);
  assert.equal(existsSync(externalWriteTarget), false);
  assert.equal(digestDirectory(gitDirectory), metadataBefore, "external Git metadata changed");
  assert.equal(digestFile(path.join(checkout, ".git")), gitfileBefore, "checkout gitfile changed");
  assert.equal(digestDirectory(externalReadRoot), externalBefore, "external read root changed");
  process.stdout.write(`${JSON.stringify({ ...summary, metadata: "unchanged" })}\n`);
} finally {
  if (server !== undefined) server.close();
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function renderRunner({
  checkout,
  gitDirectory,
  scratchTmp,
  expectedHead,
  externalSentinel,
  metadataWriteTarget,
  checkoutWriteTarget,
  port,
}) {
  return `import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const gitEnvironmentKeys = Object.keys(process.env).filter((name) => name.startsWith("GIT_")).sort();
assert.deepEqual(gitEnvironmentKeys, [
  "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_SYSTEM",
]);
const outer = spawnSync("git", ["rev-parse", "--show-toplevel", "--absolute-git-dir", "HEAD"], {
  cwd: ${JSON.stringify(checkout)}, encoding: "utf8", shell: false,
});
assert.equal(outer.error, undefined);
assert.equal(outer.status, 0, outer.stderr);
assert.deepEqual(outer.stdout.trim().split(/\\r?\\n/), [
  ${JSON.stringify(checkout)}, ${JSON.stringify(gitDirectory)}, ${JSON.stringify(expectedHead)},
]);

const focused = spawnSync(
  process.execPath,
  [
    "--test",
    "--test-concurrency=1",
    "--test-reporter=tap",
    "--test-name-pattern=" + [
      "resume JSON is byte-deterministic, portable, and reports stale checkpoints",
      "resume JSON escapes Git-controlled Unicode controls while preserving their values",
      "human resume escapes terminal controls and multiline field spoofing",
      "generated handoff evidence cannot create a legacy CLI instruction",
      "resume deduplicates warnings and projects detached Git without machine-local metadata",
    ].join("|"),
    "tests/continuity.test.mjs",
  ],
  { cwd: ${JSON.stringify(checkout)}, encoding: "utf8", shell: false, timeout: 90_000 },
);
assert.equal(focused.error, undefined);
assert.equal(focused.status, 0, focused.stderr + "\\n" + focused.stdout);
const metric = (name) => {
  const match = focused.stdout.match(new RegExp("^# " + name + " (\\\\d+)$", "m"));
  assert.ok(match, "missing TAP metric: " + name);
  return Number(match[1]);
};
const focusedTests = { fail: metric("fail"), pass: metric("pass"), selected: 5 };
assert.deepEqual(focusedTests, { fail: 0, pass: 5, selected: 5 });

const nested = path.join(${JSON.stringify(scratchTmp)}, "nested-repository");
mkdirSync(nested);
const initialized = spawnSync("git", ["init", "--quiet", nested], { encoding: "utf8", shell: false });
assert.equal(initialized.status, 0, initialized.stderr);
assert.equal(existsSync(path.join(nested, ".git")), true);
const nestedProbe = spawnSync("git", ["-C", nested, "rev-parse", "--show-toplevel", "--absolute-git-dir"], {
  encoding: "utf8", shell: false,
});
assert.equal(nestedProbe.status, 0, nestedProbe.stderr);
assert.deepEqual(nestedProbe.stdout.trim().split(/\\r?\\n/), [nested, path.join(nested, ".git")]);

assert.equal(readFileSync(${JSON.stringify(externalSentinel)}, "utf8"), "READ_ONLY_SENTINEL\\n");
writeFileSync(${JSON.stringify(checkoutWriteTarget)}, "CHECKOUT_WRITE_ALLOWED\\n");
const deniedAction = (action) => {
  try {
    action();
  } catch (error) {
    if (["EPERM", "EACCES"].includes(error?.code)) return "denied";
    throw error;
  }
  return "not-denied";
};
const deniedWrite = (target) => deniedAction(() => writeFileSync(target, "MUST_NOT_WRITE"));
const metadataWrite = deniedWrite(${JSON.stringify(metadataWriteTarget)});
const gitfile = path.join(${JSON.stringify(checkout)}, ".git");
const gitfileWrite = deniedWrite(gitfile);
const replacement = path.join(${JSON.stringify(checkout)}, "gitfile-replacement");
writeFileSync(replacement, "gitdir: /must/not/replace\\n");
const gitfileReplace = deniedAction(() => renameSync(replacement, gitfile));
const externalSymlinkWrite = deniedWrite(
  path.join(${JSON.stringify(checkout)}, "external-runtime-link", "must-not-write.txt"),
);
assert.equal(metadataWrite, "denied");
assert.equal(gitfileWrite, "denied");
assert.equal(gitfileReplace, "denied");
assert.equal(externalSymlinkWrite, "denied");

const network = await new Promise((resolve, reject) => {
  const socket = net.createConnection({ host: "127.0.0.1", port: ${port} });
  socket.setTimeout(2000);
  socket.once("connect", () => reject(new Error("network connected")));
  socket.once("timeout", () => reject(new Error("network denial timed out")));
  socket.once("error", (error) => {
    if (["EPERM", "EACCES"].includes(error.code)) resolve("denied");
    else reject(error);
  });
});

process.stdout.write(JSON.stringify({
  checkoutWrite: "allowed",
  externalSymlinkWrite,
  focusedTests,
  gitEnvironment: "absent",
  gitfileReplace,
  gitfileWrite,
  metadataWrite,
  nestedGit: "independent",
  network,
  outerRepository: "discovered",
}) + "\\n");
`;
}

function resolveRuntime(invocationPath) {
  const realPath = realpathSync(invocationPath);
  const linkedLibraries = [];
  const inspected = spawnSync("otool", ["-L", realPath], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr);
  for (const line of inspected.stdout.split(/\r?\n/).slice(1)) {
    const library = line.trim().split(/\s+\(/, 1)[0];
    if (!path.isAbsolute(library)) continue;
    linkedLibraries.push({
      invocationPath: library,
      realPath: existsSync(library) ? realpathSync(library) : library,
    });
  }
  return { invocationPath, realPath, linkedLibraries };
}

function hostGitEnvironment() {
  const environment = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!name.startsWith("GIT_")) environment[name] = value;
  }
  environment.GIT_CONFIG_NOSYSTEM = "1";
  environment.GIT_CONFIG_SYSTEM = "/dev/null";
  environment.GIT_CONFIG_GLOBAL = "/dev/null";
  environment.GIT_OPTIONAL_LOCKS = "0";
  environment.GIT_TERMINAL_PROMPT = "0";
  environment.GIT_PAGER = "cat";
  environment.LC_ALL = "C";
  return environment;
}

function commandSync(executable, arguments_, options = {}) {
  const result = spawnSync(executable, arguments_, {
    cwd: options.cwd ?? sourceRoot,
    env: options.env ?? process.env,
    encoding: "utf8",
    shell: false,
    timeout: 120_000,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, `${executable} failed: ${String(result.stderr).slice(0, 2000)}`);
  return { stdout: result.stdout, stderr: result.stderr };
}

function digestFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function digestDirectory(directory) {
  const records = [];
  const visit = (current, relative) => {
    const entries = readdirSync(current, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) visit(child, childRelative);
      else if (entry.isFile()) records.push(`${childRelative}\0${digestFile(child)}\n`);
      else throw new Error(`unsupported evidence entry: ${childRelative}`);
    }
  };
  visit(directory, "");
  return createHash("sha256").update(records.join("")).digest("hex");
}

function command(executable, arguments_, options) {
  return new Promise((resolve) => {
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.env,
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
