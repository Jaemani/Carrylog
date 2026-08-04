import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const expectedRegistrySha256 = "__CARRYLOG_VERIFICATION_REGISTRY_SHA256_PLACEHOLDER__";
const [commandId, invocationId, ...extra] = process.argv.slice(2);
assert.ok(
  commandId && invocationId && extra.length === 0,
  "one registered command ID and one bound invocation ID are required",
);

const selfDirectory = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const registryPath = path.join(selfDirectory, "commands.json");
const registryBytes = readFileSync(registryPath);
const registrySha256 = digest(registryBytes);
assert.equal(registrySha256, expectedRegistrySha256, "verification registry binding differs");
const registry = JSON.parse(registryBytes.toString("utf8"));
assert.equal(registry.formatVersion, 1, "unsupported verification registry format");
assert.deepEqual(Object.keys(registry.programs).sort(), [
  "hostGitPolicySha256",
  "processSupervisorSha256",
  "verificationReceiptProtocolSha256",
]);
const processSupervisorPath = assertBoundProgram(
  "process-supervisor.mjs",
  registry.programs.processSupervisorSha256,
);
const hostGitPolicyPath = assertBoundProgram(
  "host-git-policy.mjs",
  registry.programs.hostGitPolicySha256,
);
const receiptProtocolPath = assertBoundProgram(
  "verification-receipt-protocol.mjs",
  registry.programs.verificationReceiptProtocolSha256,
);
const { superviseProcess, PROCESS_STATES } = await import(
  pathToFileURL(processSupervisorPath).href
);
const { assertHostGitPolicy } = await import(pathToFileURL(hostGitPolicyPath).href);
const { appendVerificationRecord, parseVerificationInvocationStream } = await import(
  pathToFileURL(receiptProtocolPath).href
);
assert.deepEqual(Object.keys(registry.limits).sort(), ["commandOutputBytes", "wrapperOutputBytes"]);
assert.ok(Number.isSafeInteger(registry.limits.commandOutputBytes));
assert.ok(registry.limits.commandOutputBytes > 0);
assert.ok(registry.limits.wrapperOutputBytes > registry.limits.commandOutputBytes);
assert.equal(realpathSync(registry.verificationDirectory), selfDirectory);
assert.equal(realpathSync(registry.checkout), realpathSync(registry.git.workTree));
assert.equal(realpathSync(registry.git.directory), registry.git.directory);
assert.equal(registry.git.optionalLocks, "0");
assert.equal(
  path.join(realpathSync(path.dirname(registry.receiptPath)), path.basename(registry.receiptPath)),
  path.join(selfDirectory, "receipts.jsonl"),
);

const executionModes = {
  codex: "seatbelt-broker-isolated",
  claude: "seatbelt-workspace-isolated",
};
assert.ok(Object.hasOwn(executionModes, registry.harness), "unknown verification harness");
assert.equal(
  registry.execution?.mode,
  executionModes[registry.harness],
  "verification execution mode does not match its fixed harness",
);
assert.deepEqual(Object.keys(registry.execution.sandboxProfiles).sort(), [
  "none",
  "repository",
  "repository-discovery",
]);
const command = registry.commands.find((candidate) => candidate.id === commandId);
assert.ok(command, `unregistered verification command: ${commandId}`);
const { commandSha256, ...commandContract } = command;
assert.equal(
  commandSha256,
  digestCanonicalJson(commandContract),
  "registered command digest differs",
);

const checkout = realpathSync(registry.checkout);
const cwd = path.resolve(checkout, command.cwd);
assert.ok(cwd === checkout || cwd.startsWith(`${checkout}${path.sep}`));
const scratch = registry.scratch;
assert.ok(scratch && typeof scratch === "object", "verification scratch is required");
assert.equal(path.isAbsolute(scratch.root), true);
assert.deepEqual(Object.keys(scratch).sort(), [
  "home",
  "npmCache",
  "npmGlobalConfig",
  "npmUserConfig",
  "root",
  "tmp",
  "uvCache",
  "xdgCache",
  "xdgConfig",
]);
assert.deepEqual(
  scratch,
  {
    root: scratch.root,
    home: path.join(scratch.root, "home"),
    tmp: path.join(scratch.root, "tmp"),
    xdgConfig: path.join(scratch.root, "xdg-config"),
    xdgCache: path.join(scratch.root, "xdg-cache"),
    npmUserConfig: path.join(scratch.root, "npm-user.npmrc"),
    npmGlobalConfig: path.join(scratch.root, "npm-global.npmrc"),
    npmCache: path.join(scratch.root, "npm-cache"),
    uvCache: path.join(scratch.root, "uv-cache"),
  },
  "verification scratch layout differs",
);
assert.deepEqual(Object.keys(registry.runtimeEnvironment), ["PYTHONTZPATH"]);
assert.equal(path.isAbsolute(registry.runtimeEnvironment.PYTHONTZPATH), true);
assert.ok(registry.runtimeEnvironment.PYTHONTZPATH.startsWith("/private/var/db/timezone/tz/"));
assert.equal(path.isAbsolute(registry.developerDirectory), true);
const baseEnvironment = {
  HOME: scratch.home,
  USER: "carrylog-verification",
  LOGNAME: "carrylog-verification",
  PATH: `${path.join(registry.developerDirectory, "usr", "bin")}${path.delimiter}${registry.path}`,
  TMPDIR: scratch.tmp,
  XDG_CONFIG_HOME: scratch.xdgConfig,
  XDG_CACHE_HOME: scratch.xdgCache,
  LANG: "C.UTF-8",
  LC_ALL: "C.UTF-8",
  NO_COLOR: "1",
  CI: "1",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_GLOBAL: "/dev/null",
  DEVELOPER_DIR: registry.developerDirectory,
  UV_OFFLINE: "1",
  UV_CACHE_DIR: scratch.uvCache,
  PYTHONDONTWRITEBYTECODE: "1",
  PYTHONPYCACHEPREFIX: path.join(scratch.root, "python-pycache"),
  PYTEST_ADDOPTS: "-p no:cacheprovider",
  PYTHONTZPATH: registry.runtimeEnvironment.PYTHONTZPATH,
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_userconfig: scratch.npmUserConfig,
  npm_config_globalconfig: scratch.npmGlobalConfig,
  npm_config_cache: scratch.npmCache,
};

assert.ok(
  ["none", "repository", "repository-discovery"].includes(command.gitContext),
  "unknown Git context policy",
);
assert.equal(
  command.gitContext === "repository",
  command.executable === "git",
  "Git context policy does not match executable",
);
const repositoryEnvironment = {
  ...baseEnvironment,
  GIT_DIR: registry.git.directory,
  GIT_WORK_TREE: checkout,
  GIT_OPTIONAL_LOCKS: "0",
};
const childEnvironment =
  command.gitContext === "repository" ? repositoryEnvironment : baseEnvironment;
for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_OPTIONAL_LOCKS"]) {
  assert.equal(
    Object.hasOwn(childEnvironment, name),
    command.gitContext === "repository",
    `child ${name} policy differs`,
  );
}
await assertHostGitPolicy(registry.hostGitPolicy);
const receiptHistoryBeforeChild = readFileSync(registry.receiptPath);
const invocationStream = parseVerificationInvocationStream(
  receiptHistoryBeforeChild.toString("utf8"),
);
assert.equal(
  invocationStream.unsettledStarts.length,
  1,
  "verification wrapper requires exactly one unsettled start claim",
);
const startRecord = invocationStream.unsettledStarts[0];
assert.equal(startRecord.invocationId, invocationId, "verification invocation claim differs");
assert.equal(startRecord.commandId, commandId, "verification command claim differs");
assert.equal(startRecord.registrySha256, registrySha256, "verification registry claim differs");
assert.equal(startRecord.commandSha256, commandSha256, "verification command digest claim differs");
assert.equal(startRecord.executionMode, registry.execution.mode, "verification mode claim differs");
assert.equal(
  invocationStream.records.at(-1)?.invocationId,
  invocationId,
  "verification invocation claim is not the newest receipt record",
);
const preCommandState = await capturePreCommandState(repositoryEnvironment, checkout);
let executable = command.executable;
let arguments_ = command.arguments;
if (
  registry.execution.mode === "seatbelt-workspace-isolated" ||
  registry.execution.mode === "seatbelt-broker-isolated"
) {
  assert.deepEqual(Object.keys(registry.execution).sort(), [
    "mode",
    "sandboxExecutable",
    "sandboxProfiles",
  ]);
  assert.equal(registry.execution.sandboxExecutable, "/usr/bin/sandbox-exec");
  const sandboxProfile = registry.execution.sandboxProfiles[command.gitContext];
  assert.equal(typeof sandboxProfile, "string");
  assert.ok(sandboxProfile.includes("(deny default)"));
  assert.equal(sandboxProfile.includes("(allow default)"), false);
  assert.ok(sandboxProfile.includes("(deny network*)"));
  executable = registry.execution.sandboxExecutable;
  arguments_ = ["-p", sandboxProfile, command.executable, ...command.arguments];
} else {
  assert.deepEqual(Object.keys(registry.execution), ["mode"]);
}
await assertHostGitPolicy(registry.hostGitPolicy);
const result = await superviseProcess({
  executable,
  arguments: arguments_,
  cwd,
  env: childEnvironment,
  timeoutMs: command.timeoutMs,
  maxOutputBytes: registry.limits.commandOutputBytes,
});
assert.equal(
  readFileSync(registry.receiptPath).equals(receiptHistoryBeforeChild),
  true,
  "verification child changed receipt history",
);
const receipt = {
  formatVersion: 5,
  recordType: "terminal",
  invocationId,
  commandId,
  registrySha256,
  commandSha256,
  executionMode: registry.execution.mode,
  origin: startRecord.origin,
  brokerId: startRecord.brokerId,
  preCommandState,
  preCommandStateSha256: digestCanonicalJson(preCommandState),
  processState: result.state,
  exitStatus: result.exitCode,
  signal: result.signal,
  timedOut: result.state === PROCESS_STATES.timeout,
  outputLimited: result.state === PROCESS_STATES.outputLimit,
  spawnError: result.spawnError,
  termination: result.termination,
  stdoutBytes: result.output.stdout.receivedBytes,
  stderrBytes: result.output.stderr.receivedBytes,
  stdoutRetainedBytes: result.output.stdout.retainedBytes,
  stderrRetainedBytes: result.output.stderr.retainedBytes,
  stdoutSha256: result.output.stdout.sha256,
  stderrSha256: result.output.stderr.sha256,
  stdoutRetainedSha256: result.output.stdout.retainedSha256,
  stderrRetainedSha256: result.output.stderr.retainedSha256,
};
appendVerificationRecord(registry.receiptPath, receipt);
if (result.output.stdout.buffer.length > 0) process.stdout.write(result.output.stdout.buffer);
if (result.output.stderr.buffer.length > 0) process.stderr.write(result.output.stderr.buffer);
process.exitCode = result.state === PROCESS_STATES.completed ? (result.exitCode ?? 1) : 1;

async function capturePreCommandState(environment_, checkout_) {
  const observations = {};
  for (const [id, arguments_] of [
    ["head", ["rev-parse", "HEAD"]],
    ["trackedDiff", ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]],
    ["stagedDiff", ["diff", "--cached", "--binary", "--no-ext-diff", "HEAD", "--"]],
    ["status", ["status", "--porcelain=v1", "--untracked-files=all"]],
    ["config", ["config", "--list", "--show-origin", "--null"]],
  ]) {
    const observed = await superviseProcess({
      executable: "git",
      arguments: arguments_,
      cwd: checkout_,
      env: environment_,
      timeoutMs: 30_000,
      maxOutputBytes: registry.limits.commandOutputBytes,
    });
    assert.equal(observed.state, PROCESS_STATES.completed, `pre-command ${id} failed`);
    assert.equal(observed.signal, null, `pre-command ${id} was signalled`);
    assert.equal(observed.exitCode, 0, `pre-command ${id} exited nonzero`);
    observations[id] = {
      bytes: observed.output.stdout.receivedBytes,
      sha256: observed.output.stdout.sha256,
    };
  }
  return observations;
}

function assertBoundProgram(fileName, expectedSha256) {
  assert.match(expectedSha256, /^[0-9a-f]{64}$/);
  const candidate = path.join(selfDirectory, fileName);
  const status = lstatSync(candidate);
  assert.equal(status.isSymbolicLink(), false, `${fileName} must not be a symbolic link`);
  assert.equal(status.isFile(), true, `${fileName} must be a regular file`);
  assert.equal(realpathSync(candidate), candidate, `${fileName} path must be canonical`);
  assert.equal(digest(readFileSync(candidate)), expectedSha256, `${fileName} binding differs`);
  return candidate;
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function digestCanonicalJson(value) {
  return digest(JSON.stringify(sortJson(value)));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}
