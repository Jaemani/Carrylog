import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const expectedRegistrySha256 = "__CARRYLOG_VERIFICATION_REGISTRY_SHA256_PLACEHOLDER__";
const [commandId, ...extra] = process.argv.slice(2);
assert.ok(commandId && extra.length === 0, "one registered command ID is required");

const selfDirectory = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const registryPath = path.join(selfDirectory, "commands.json");
const registryBytes = readFileSync(registryPath);
const registrySha256 = digest(registryBytes);
assert.equal(registrySha256, expectedRegistrySha256, "verification registry binding differs");
const registry = JSON.parse(registryBytes.toString("utf8"));
assert.equal(registry.formatVersion, 1, "unsupported verification registry format");
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
assert.equal(path.isAbsolute(registry.developerDirectory), true);
const environment = {
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
  GIT_DIR: registry.git.directory,
  GIT_WORK_TREE: checkout,
  GIT_OPTIONAL_LOCKS: "0",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_SYSTEM: "/dev/null",
  GIT_CONFIG_GLOBAL: "/dev/null",
  DEVELOPER_DIR: registry.developerDirectory,
  UV_OFFLINE: "1",
  UV_CACHE_DIR: scratch.uvCache,
  npm_config_offline: "true",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_userconfig: scratch.npmUserConfig,
  npm_config_globalconfig: scratch.npmGlobalConfig,
  npm_config_cache: scratch.npmCache,
};

const preCommandState = capturePreCommandState(environment, checkout);
const receiptHistoryBeforeChild = readFileSync(registry.receiptPath);
let executable = command.executable;
let arguments_ = command.arguments;
if (
  registry.execution.mode === "seatbelt-workspace-isolated" ||
  registry.execution.mode === "seatbelt-broker-isolated"
) {
  assert.deepEqual(Object.keys(registry.execution).sort(), [
    "mode",
    "sandboxExecutable",
    "sandboxProfile",
  ]);
  assert.equal(registry.execution.sandboxExecutable, "/usr/bin/sandbox-exec");
  assert.equal(typeof registry.execution.sandboxProfile, "string");
  assert.ok(registry.execution.sandboxProfile.includes("(deny default)"));
  assert.equal(registry.execution.sandboxProfile.includes("(allow default)"), false);
  assert.ok(registry.execution.sandboxProfile.includes("(deny network*)"));
  executable = registry.execution.sandboxExecutable;
  arguments_ = ["-p", registry.execution.sandboxProfile, command.executable, ...command.arguments];
} else {
  assert.deepEqual(Object.keys(registry.execution), ["mode"]);
}
const result = spawnSync(executable, arguments_, {
  cwd,
  env: environment,
  encoding: "utf8",
  timeout: command.timeoutMs,
  maxBuffer: 10 * 1024 * 1024,
  shell: false,
});
assert.equal(
  readFileSync(registry.receiptPath).equals(receiptHistoryBeforeChild),
  true,
  "verification child changed receipt history",
);
const receipt = {
  formatVersion: 2,
  commandId,
  registrySha256,
  commandSha256,
  executionMode: registry.execution.mode,
  preCommandState,
  preCommandStateSha256: digestCanonicalJson(preCommandState),
  exitStatus: result.status,
  signal: result.signal,
  timedOut: result.error?.code === "ETIMEDOUT",
  spawnError: result.error?.code ?? null,
  stdoutBytes: Buffer.byteLength(result.stdout ?? ""),
  stderrBytes: Buffer.byteLength(result.stderr ?? ""),
  stdoutSha256: digest(result.stdout ?? ""),
  stderrSha256: digest(result.stderr ?? ""),
};
const receiptLine = `${JSON.stringify(receipt)}\n`;
appendFileSync(registry.receiptPath, receiptLine, {
  encoding: "utf8",
  mode: 0o600,
});
const receiptHistoryAfterWrapper = readFileSync(registry.receiptPath);
assert.equal(
  receiptHistoryAfterWrapper
    .subarray(0, receiptHistoryBeforeChild.length)
    .equals(receiptHistoryBeforeChild),
  true,
  "wrapper receipt append changed prior history",
);
assert.equal(
  receiptHistoryAfterWrapper.subarray(receiptHistoryBeforeChild.length).toString("utf8"),
  receiptLine,
  "wrapper did not append exactly one bound receipt",
);
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

function capturePreCommandState(environment_, checkout_) {
  const observations = {};
  for (const [id, arguments_] of [
    ["head", ["rev-parse", "HEAD"]],
    ["trackedDiff", ["diff", "--binary", "--no-ext-diff", "HEAD", "--"]],
    ["stagedDiff", ["diff", "--cached", "--binary", "--no-ext-diff", "HEAD", "--"]],
    ["status", ["status", "--porcelain=v1", "--untracked-files=all"]],
    ["config", ["config", "--list", "--show-origin", "--null"]],
  ]) {
    const observed = spawnSync("git", arguments_, {
      cwd: checkout_,
      env: environment_,
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
      shell: false,
    });
    assert.equal(observed.error, undefined, `pre-command ${id} spawn failed`);
    assert.equal(observed.signal, null, `pre-command ${id} was signalled`);
    assert.equal(
      observed.status,
      0,
      `pre-command ${id} exited nonzero: ${String(observed.stderr).slice(0, 1000)}`,
    );
    observations[id] = {
      bytes: Buffer.byteLength(observed.stdout),
      sha256: digest(observed.stdout),
    };
  }
  return observations;
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
