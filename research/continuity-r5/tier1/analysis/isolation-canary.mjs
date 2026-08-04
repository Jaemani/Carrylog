import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  bindVerificationProgram,
  buildVerificationExecutablePath,
  buildVerificationRegistry,
  buildVerificationScratch,
  deriveMacosRuntimeReadPaths,
  digestRegistryBytes,
  resolveMacosPythonTimezoneDirectory,
} from "./harness-contract.mjs";
import {
  appendVerificationRecord,
  createVerificationInvocationId,
  createVerificationStartRecord,
  parseVerificationInvocationStream,
} from "./verification-receipt-protocol.mjs";
import { loadVerificationSupport, writeVerificationSupportFiles } from "./verification-support.mjs";

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const tierRoot = path.resolve(here, "..");
const verificationSupport = await loadVerificationSupport({ analysisRoot: here, tierRoot });
const temporaryRoot = await realpath(await mkdtemp(path.join(tmpdir(), "carrylog-tier1-canary-")));
const checkout = path.join(temporaryRoot, "checkout");
const gitDirectory = path.join(temporaryRoot, "repository.git");
const verificationDirectory = path.join(temporaryRoot, "verification");
const scratch = buildVerificationScratch(path.join(temporaryRoot, "verification-scratch"));
const receiptPath = path.join(verificationDirectory, "receipts.jsonl");
const registryPath = path.join(verificationDirectory, "commands.json");
const wrapper = path.join(verificationDirectory, "run-check.mjs");
const externalSentinel = path.join(temporaryRoot, "external-sentinel.txt");
const server = net.createServer((socket) => socket.end("unexpected"));
let verificationRegistry;
let verificationRegistrySha256;
try {
  await mkdir(checkout);
  await execFileAsync("git", ["init", "--quiet", "--bare", gitDirectory], {
    cwd: checkout,
  });
  await writeFile(
    path.join(checkout, "package.json"),
    `${JSON.stringify({ private: true, scripts: { verify: "node verify.mjs" } }, null, 2)}\n`,
  );
  const gitEnv = {
    ...process.env,
    GIT_DIR: await realpath(gitDirectory),
    GIT_WORK_TREE: await realpath(checkout),
    GIT_OPTIONAL_LOCKS: "0",
  };
  await execFileAsync("git", ["config", "core.bare", "false"], {
    cwd: checkout,
    env: gitEnv,
  });
  await execFileAsync("git", ["add", "-A"], { cwd: checkout, env: gitEnv });
  await execFileAsync(
    "git",
    [
      "-c",
      "user.name=Pilot",
      "-c",
      "user.email=pilot.invalid",
      "commit",
      "--quiet",
      "-m",
      "baseline",
    ],
    { cwd: checkout, env: gitEnv },
  );
  await writeFile(path.join(checkout, ".git"), `gitdir: ${await realpath(gitDirectory)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  await writeFile(
    path.join(checkout, "verify.mjs"),
    "import { writeFileSync } from 'node:fs'; import path from 'node:path'; writeFileSync(path.join(process.env.TMPDIR, 'npm-script-ok.txt'), 'ok'); process.stdout.write('NPM_SCRIPT_OK');\n",
  );
  await mkdir(verificationDirectory);
  await prepareScratch(scratch);
  await writeFile(externalSentinel, "EXTERNAL_SECRET\n", { mode: 0o600 });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const developerDirectory = await resolveDeveloperDirectory();
  const pythonRealPath = await realpath("/opt/homebrew/bin/python3");
  await mkdir(path.join(checkout, ".venv", "bin"), { recursive: true });
  await symlink(pythonRealPath, path.join(checkout, ".venv", "bin", "python"));
  const runtimes = await resolveRuntimes(["node", "npm", "git", "uv", pythonRealPath]);
  const registry = buildVerificationRegistry({
    harness: "codex",
    commands: [
      {
        id: "local-pass",
        cwd: ".",
        executable: process.execPath,
        gitContext: "none",
        arguments: [
          "-e",
          `const a=require('node:assert/strict'),c=require('node:child_process'),f=require('node:fs'),p=require('node:path');a.equal(process.env.HOME,${JSON.stringify(scratch.home)});a.equal(process.env.TMPDIR,${JSON.stringify(scratch.tmp)});for(const n of ['GIT_DIR','GIT_WORK_TREE','GIT_OPTIONAL_LOCKS'])a.equal(process.env[n],undefined,n);a.equal(process.env.GIT_CONFIG_GLOBAL,'/dev/null');a.equal(process.env.GIT_CONFIG_SYSTEM,'/dev/null');a.equal(process.env.npm_config_userconfig,${JSON.stringify(scratch.npmUserConfig)});a.equal(process.env.npm_config_globalconfig,${JSON.stringify(scratch.npmGlobalConfig)});a.notEqual(process.env.npm_config_userconfig,process.env.npm_config_globalconfig);a.equal(f.readFileSync(process.env.npm_config_userconfig,'utf8'),'');a.equal(f.readFileSync(process.env.npm_config_globalconfig,'utf8'),'');const nested=f.mkdtempSync(p.join(process.env.TMPDIR,'nested-git-'));const initialized=c.spawnSync('git',['init','--quiet',nested],{encoding:'utf8'});a.equal(initialized.status,0,initialized.stderr);a.equal(f.existsSync(p.join(nested,'.git')),true);let denied=false;try{f.readFileSync(${JSON.stringify(path.join(gitDirectory, "HEAD"))})}catch(error){denied=['EPERM','EACCES'].includes(error.code)}a.equal(denied,true,'detached metadata readable');f.writeFileSync(p.join(process.env.HOME,'home-ok'),'ok');f.writeFileSync(p.join(process.env.TMPDIR,'tmp-ok'),'ok')`,
        ],
        timeoutMs: 10_000,
      },
      {
        id: "receipt-access-denied",
        cwd: ".",
        executable: process.execPath,
        gitContext: "none",
        arguments: [
          "-e",
          `const a=require('node:assert/strict'),f=require('node:fs');for(const [name,attack] of [['read',()=>f.readFileSync(${JSON.stringify(receiptPath)})],['append',()=>f.appendFileSync(${JSON.stringify(receiptPath)},'FORGED_RECEIPT_CHILD\\n')],['truncate',()=>f.truncateSync(${JSON.stringify(receiptPath)},0)]]){let denied=false;try{attack()}catch(error){denied=['EPERM','EACCES'].includes(error.code)}a.equal(denied,true,name+' receipt access was not denied')}process.stdout.write('CHILD_RECEIPT_ACCESS_DENIED')`,
        ],
        timeoutMs: 10_000,
      },
      {
        id: "external-read-denied",
        cwd: ".",
        executable: process.execPath,
        gitContext: "none",
        arguments: [
          "-e",
          `const f=require('node:fs');try{f.readFileSync(${JSON.stringify(externalSentinel)},'utf8');process.exit(0)}catch(error){process.exit(['EPERM','EACCES'].includes(error.code)?42:43)}`,
        ],
        timeoutMs: 10_000,
      },
      {
        id: "localhost-denied",
        cwd: ".",
        executable: process.execPath,
        gitContext: "none",
        arguments: [
          "-e",
          `const n=require('node:net').connect(${address.port},'127.0.0.1');n.on('connect',()=>process.exit(0));n.on('error',()=>process.exit(42));setTimeout(()=>process.exit(43),2000)`,
        ],
        timeoutMs: 10_000,
      },
      {
        id: "dns-denied",
        cwd: ".",
        executable: process.execPath,
        gitContext: "none",
        arguments: [
          "-e",
          "require('node:dns').resolve4('example.com',(error)=>process.exit(error?42:0))",
        ],
        timeoutMs: 10_000,
      },
      {
        id: "npm-smoke",
        cwd: ".",
        executable: "npm",
        gitContext: "none",
        arguments: ["--version"],
        timeoutMs: 10_000,
      },
      {
        id: "git-smoke",
        cwd: ".",
        executable: "git",
        gitContext: "repository",
        arguments: ["status", "--short"],
        timeoutMs: 10_000,
      },
      {
        id: "repository-discovery-smoke",
        cwd: ".",
        executable: process.execPath,
        gitContext: "repository-discovery",
        arguments: [
          "-e",
          `const a=require('node:assert/strict'),c=require('node:child_process'),f=require('node:fs'),p=require('node:path');for(const n of ['GIT_DIR','GIT_WORK_TREE','GIT_OPTIONAL_LOCKS'])a.equal(process.env[n],undefined,n);const outer=c.spawnSync('git',['rev-parse','--show-toplevel','--absolute-git-dir','HEAD'],{encoding:'utf8'});a.equal(outer.status,0,outer.stderr);const lines=outer.stdout.trim().split(/\\r?\\n/);a.equal(lines[0],${JSON.stringify(await realpath(checkout))});a.equal(lines[1],${JSON.stringify(await realpath(gitDirectory))});a.match(lines[2],/^[0-9a-f]{40}$/);const nested=f.mkdtempSync(p.join(process.env.TMPDIR,'nested-discovery-'));const initialized=c.spawnSync('git',['init','--quiet',nested],{encoding:'utf8'});a.equal(initialized.status,0,initialized.stderr);const nestedTop=c.spawnSync('git',['-C',nested,'rev-parse','--show-toplevel'],{encoding:'utf8'});a.equal(nestedTop.status,0,nestedTop.stderr);a.equal(nestedTop.stdout.trim(),nested);const denied=fn=>{try{fn();return false}catch(e){return ['EPERM','EACCES'].includes(e.code)}};a.equal(denied(()=>f.appendFileSync(${JSON.stringify(path.join(gitDirectory, "HEAD"))},'x')),true,'metadata write');const gitfile=${JSON.stringify(path.join(checkout, ".git"))};a.equal(denied(()=>f.appendFileSync(gitfile,'x')),true,'gitfile write');a.equal(denied(()=>f.writeFileSync(p.join(${JSON.stringify(checkout)},'checkout-write'),'x')),true,'checkout write');const link=p.join(process.env.TMPDIR,'outside-link');f.symlinkSync(${JSON.stringify(externalSentinel)},link);a.equal(denied(()=>f.writeFileSync(link,'overwrite')),true,'external symlink write');process.stdout.write('REPOSITORY_DISCOVERY_OK CHECKOUT_READ_ONLY')`,
        ],
        timeoutMs: 30_000,
      },
      {
        id: "uv-smoke",
        cwd: ".",
        executable: "uv",
        gitContext: "none",
        arguments: ["--version"],
        timeoutMs: 10_000,
      },
      {
        id: "npm-script-smoke",
        cwd: ".",
        executable: "npm",
        gitContext: "none",
        arguments: ["run", "verify"],
        timeoutMs: 30_000,
      },
      {
        id: "uv-python-smoke",
        cwd: ".",
        executable: "uv",
        gitContext: "none",
        arguments: [
          "run",
          "--offline",
          "--no-project",
          "--python",
          ".venv/bin/python",
          "python",
          "-c",
          "print('UV_PYTHON_OK')",
        ],
        timeoutMs: 30_000,
      },
    ],
    scratch,
    executablePath: buildVerificationExecutablePath(
      runtimes.map((runtime) => runtime.invocationPath),
      developerDirectory,
    ),
    receiptPath,
    checkout,
    verificationDirectory,
    runtimeReadPaths: deriveMacosRuntimeReadPaths(runtimes),
    developerDirectory,
    gitDirectory: await realpath(gitDirectory),
    programDigests: verificationSupport.programDigests,
    hostGitPolicy: verificationSupport.hostGitPolicy,
    pythonTimezoneDirectory: resolveMacosPythonTimezoneDirectory(),
  });
  const registryBytes = `${JSON.stringify(registry, null, 2)}\n`;
  const registrySha256 = digestRegistryBytes(registryBytes);
  verificationRegistry = registry;
  verificationRegistrySha256 = registrySha256;
  await writeFile(registryPath, registryBytes);
  await writeFile(receiptPath, "", { mode: 0o600, flag: "wx" });
  await writeFile(
    wrapper,
    bindVerificationProgram(
      await readFile(path.join(here, "fixture-command-wrapper.mjs"), "utf8"),
      registrySha256,
    ),
  );
  await writeVerificationSupportFiles(verificationDirectory, verificationSupport);
  const localPass = await invoke("local-pass");
  const localReceipt = await readFile(receiptPath, "utf8").catch(() => "<missing receipt>");
  assert.equal(
    localPass.exitCode,
    0,
    `local subprocess should remain allowed: ${JSON.stringify({ localPass, localReceipt })}`,
  );
  const receiptAttack = await invoke("receipt-access-denied");
  assert.equal(receiptAttack.exitCode, 0, receiptAttack.stderr);
  assert.equal(receiptAttack.stdout, "CHILD_RECEIPT_ACCESS_DENIED");
  assert.equal(
    (await readFile(receiptPath, "utf8")).includes("FORGED_RECEIPT_CHILD"),
    false,
    "verification child changed receipt history",
  );
  assert.equal(
    (await invoke("external-read-denied")).exitCode,
    42,
    "external sentinel read was not denied",
  );
  assert.equal((await invoke("localhost-denied")).exitCode, 42, "localhost network was not denied");
  assert.equal((await invoke("dns-denied")).exitCode, 42, "DNS network was not denied");
  for (const [commandId, label] of [
    ["npm-smoke", "npm"],
    ["git-smoke", "Git"],
    ["repository-discovery-smoke", "repository discovery"],
    ["uv-smoke", "uv"],
    ["npm-script-smoke", "npm script"],
    ["uv-python-smoke", "uv Python"],
  ]) {
    const smoke = await invoke(commandId);
    const receiptsSoFar = await readFile(receiptPath, "utf8").catch(() => "<missing receipt>");
    assert.equal(
      smoke.exitCode,
      0,
      `${label} runtime was not allowed: ${JSON.stringify({ smoke, receiptsSoFar })}`,
    );
  }
  assert.notEqual((await invoke("missing-command")).exitCode, 0, "unknown command ID was accepted");
  assert.notEqual(
    (await invoke("local-pass", ["unexpected-suffix"])).exitCode,
    0,
    "wrapper accepted argument injection",
  );
  const receipts = parseVerificationInvocationStream(
    await readFile(receiptPath, "utf8"),
  ).terminalReceipts;
  assert.deepEqual(
    receipts.map((receipt) => [receipt.commandId, receipt.executionMode, receipt.exitStatus]),
    [
      ["local-pass", "seatbelt-broker-isolated", 0],
      ["receipt-access-denied", "seatbelt-broker-isolated", 0],
      ["external-read-denied", "seatbelt-broker-isolated", 42],
      ["localhost-denied", "seatbelt-broker-isolated", 42],
      ["dns-denied", "seatbelt-broker-isolated", 42],
      ["npm-smoke", "seatbelt-broker-isolated", 0],
      ["git-smoke", "seatbelt-broker-isolated", 0],
      ["repository-discovery-smoke", "seatbelt-broker-isolated", 0],
      ["uv-smoke", "seatbelt-broker-isolated", 0],
      ["npm-script-smoke", "seatbelt-broker-isolated", 0],
      ["uv-python-smoke", "seatbelt-broker-isolated", 0],
    ],
  );
  process.stdout.write(
    "Tier 1 verification isolation canary passed: scratch allowed; external files, localhost, DNS, unknown IDs, and argument injection denied.\n",
  );
} finally {
  server.close();
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function prepareScratch(scratch_) {
  for (const directory of [
    scratch_.root,
    scratch_.home,
    scratch_.tmp,
    scratch_.xdgConfig,
    scratch_.xdgCache,
    scratch_.npmCache,
    scratch_.uvCache,
  ]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  await writeFile(scratch_.npmUserConfig, "", { mode: 0o600, flag: "wx" });
  await writeFile(scratch_.npmGlobalConfig, "", { mode: 0o600, flag: "wx" });
}

async function resolveRuntimes(executableNames) {
  const resolved = [];
  for (const executableName of executableNames) {
    const invocationPath = path.isAbsolute(executableName)
      ? executableName
      : (await execFileAsync("which", [executableName], { encoding: "utf8" })).stdout.trim();
    const realPath = await realpath(invocationPath);
    const inspected = await execFileAsync("otool", ["-L", realPath], {
      encoding: "utf8",
    }).catch(() => ({ stdout: "" }));
    const linkedLibraries = [];
    for (const line of inspected.stdout.split(/\r?\n/).slice(1)) {
      const libraryPath = line.trim().split(/\s+\(/, 1)[0];
      if (!path.isAbsolute(libraryPath)) continue;
      linkedLibraries.push({
        invocationPath: libraryPath,
        realPath: await realpathIfPresent(libraryPath),
      });
    }
    resolved.push({ invocationPath, realPath, linkedLibraries });
  }
  return resolved;
}

async function resolveDeveloperDirectory() {
  const developerDirectory = await realpath("/Library/Developer/CommandLineTools");
  await execFileAsync(path.join(developerDirectory, "usr", "bin", "git"), ["--version"], {
    encoding: "utf8",
  });
  return developerDirectory;
}

async function realpathIfPresent(filePath) {
  try {
    return await realpath(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return filePath;
    }
    throw error;
  }
}

async function invoke(commandId, extra = []) {
  const command = verificationRegistry?.commands.find((candidate) => candidate.id === commandId);
  let arguments_ = [wrapper, commandId, "0".repeat(32), ...extra];
  if (command !== undefined && extra.length === 0) {
    const invocationId = createVerificationInvocationId();
    appendVerificationRecord(
      receiptPath,
      createVerificationStartRecord({
        invocationId,
        commandId,
        registrySha256: verificationRegistrySha256,
        commandSha256: command.commandSha256,
        executionMode: verificationRegistry.execution.mode,
        origin: "direct-screen",
        brokerId: null,
      }),
    );
    arguments_ = [wrapper, commandId, invocationId];
  }
  try {
    const result = await execFileAsync(process.execPath, arguments_, {
      encoding: "utf8",
      timeout: 15_000,
    });
    return { exitCode: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      exitCode: typeof error.code === "number" ? error.code : 1,
      stdout: typeof error.stdout === "string" ? error.stdout : "",
      stderr: typeof error.stderr === "string" ? error.stderr : "",
    };
  }
}
