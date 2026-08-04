import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  assertClaudeDeniedToolUse,
  assertClaudeResponseModels,
  assertClaudeSuccessfulToolUse,
  assertCodexProbeEvidence,
  assertExecutionPredecessors,
  assertReceiptBinding,
  bindVerificationProgram,
  buildCarrylogToolInstallArguments,
  buildClaudeInvocation,
  buildCodexInvocation,
  buildLocalExactCommitFetchArguments,
  buildRepositoryDiscoverySeatbeltProfile,
  buildVerificationEnvironment,
  buildVerificationExecutablePath,
  buildVerificationMcpConfiguration,
  buildVerificationRegistry,
  buildVerificationScratch,
  classifyClaudeAuthenticationFailure,
  classifyNetworkProbeEvidence,
  createAuthenticationEvidence,
  deriveMacosRuntimeReadPaths,
  detachGitMetadata,
  digestRegistryBytes,
  enforceSerialClaudeToolExecution,
  parseClaudeJsonEvents,
  parseCodexJsonEvents,
  partitionVerificationRuntimeReadPaths,
  processStatus,
  projectMinimalClaudeOAuth,
  recordAuthenticationCleanup,
  redactHarnessDiagnostic,
  renderCodexRuntimePermissions,
  renderCodexVerificationPermissions,
  resolveMacosPythonTimezoneDirectory,
  validateRepositoryDiscoveryLayout,
} from "../harness-contract.mjs";
import {
  appendVerificationRecord,
  createVerificationInvocationId,
  createVerificationStartRecord,
  parseVerificationInvocationStream,
} from "../verification-receipt-protocol.mjs";
import {
  loadVerificationSupport,
  writeVerificationSupportFiles,
} from "../verification-support.mjs";

test("Carrylog tool installation permits setup network only when explicitly selected", () => {
  const tarball = path.join(tmpdir(), "carrylog.tgz");
  const online = buildCarrylogToolInstallArguments(tarball, {
    allowNetwork: true,
  });
  const offline = buildCarrylogToolInstallArguments(tarball, {
    allowNetwork: false,
  });
  assert.equal(online.includes("--offline"), false);
  assert.equal(offline.includes("--offline"), true);
  assert.equal(online.at(-1), tarball);
  assert.equal(offline.at(-1), tarball);
  assert.throws(
    () => buildCarrylogToolInstallArguments("relative.tgz", { allowNetwork: true }),
    /must be absolute/,
  );
});

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tierRoot = path.resolve(analysisRoot, "..");
const verificationSupport = await loadVerificationSupport({ analysisRoot, tierRoot });

test("Codex runner and canary invocation contract carries the explicit permission profile", () => {
  const verification = {
    mcpServer: "/verification/server.mjs",
    mcpTools: ["mcp__carrylog_verification__verify_registered"],
  };
  const invocation = buildCodexInvocation({
    executable: "/native/codex",
    prompt: "PROMPT",
    model: "codex-model",
    reasoningEffort: "medium",
    permissionProfile: "pilot-read",
    verification,
  });
  assert.equal(invocation.executable, "/native/codex");
  assert.deepEqual(invocation.arguments, [
    "exec",
    "--ephemeral",
    "--ignore-rules",
    "--strict-config",
    "--skip-git-repo-check",
    "-m",
    "codex-model",
    "-c",
    'model_reasoning_effort="medium"',
    "-c",
    'default_permissions="pilot-read"',
    "-c",
    'web_search="disabled"',
    "-c",
    `mcp_servers.carrylog_verification.command=${JSON.stringify(process.execPath)}`,
    "-c",
    'mcp_servers.carrylog_verification.args=["/verification/server.mjs"]',
    "-c",
    "mcp_servers.carrylog_verification.required=true",
    "-c",
    'mcp_servers.carrylog_verification.tools.verify_registered.approval_mode="approve"',
    "--json",
    "PROMPT",
  ]);
  assert.equal(
    invocation.arguments.some((argument) =>
      ["--dangerously-bypass-approvals-and-sandbox", "--dangerously-bypass-hook-trust"].includes(
        argument,
      ),
    ),
    false,
    "non-interactive MCP approval must not weaken the permission-profile sandbox",
  );
  assert.equal(
    invocation.arguments.some((argument) => argument.startsWith("approval_policy=")),
    false,
    "broker approval must be scoped to the exact MCP tool",
  );
  assert.throws(() =>
    buildCodexInvocation({
      executable: "/native/codex",
      prompt: "PROMPT",
      model: "codex-model",
      reasoningEffort: "medium",
      permissionProfile: "pilot-read",
      verification: {
        mcpServer: "/verification/server.mjs",
        mcpTools: ["mcp__other_server__verify_registered"],
      },
    }),
  );
  assert.throws(
    () =>
      buildCodexInvocation({
        executable: "codex",
        prompt: "PROMPT",
        model: "codex-model",
        reasoningEffort: "medium",
        permissionProfile: "pilot-read",
        verification,
      }),
    /must be absolute/,
  );
});

test("Claude invocation exposes no Bash and wires the self-bound MCP server", () => {
  const verification = {
    mcpServer: "/verification/server.mjs",
    wrapper: "/verification/wrapper.mjs",
    registry: "/verification/commands.json",
    mcpTools: ["mcp__carrylog_verification__verify_registered"],
  };
  const invocation = buildClaudeInvocation({
    prompt: "PROMPT",
    model: "claude-model",
    effort: "medium",
    maximumBudgetUsd: 0.75,
    writable: false,
    checkout: "/workspace",
    verification,
  });
  assert.equal(invocation.executable, "claude");
  const budgetIndex = invocation.arguments.indexOf("--max-budget-usd");
  assert.ok(budgetIndex >= 0);
  assert.equal(invocation.arguments[budgetIndex + 1], "0.75");
  assert.equal(invocation.arguments.includes("Bash,WebFetch,WebSearch"), true);
  assert.equal(invocation.arguments.includes("Read,Glob,Grep"), true);
  assert.equal(
    invocation.arguments.some((value) => value === "Read,Glob,Grep,Edit,Write"),
    false,
  );
  const configIndex = invocation.arguments.indexOf("--mcp-config");
  assert.ok(configIndex >= 0);
  assert.deepEqual(
    JSON.parse(invocation.arguments[configIndex + 1]),
    buildVerificationMcpConfiguration(verification),
  );
  assert.deepEqual(
    JSON.parse(invocation.arguments[configIndex + 1]).mcpServers.carrylog_verification.args,
    ["/verification/server.mjs"],
  );

  const writable = buildClaudeInvocation({
    prompt: "PROMPT",
    model: "claude-model",
    effort: "medium",
    maximumBudgetUsd: 0.75,
    writable: true,
    checkout: "/workspace",
    verification,
  });
  assert.equal(writable.arguments.includes("Read,Glob,Grep,Edit,Write"), true);
  const allowedIndex = writable.arguments.indexOf("--allowedTools");
  assert.ok(allowedIndex >= 0);
  assert.equal(
    writable.arguments[allowedIndex + 1],
    "Read(/workspace/**),Glob(/workspace/**),Grep(/workspace/**),Edit(/workspace/**),Write(/workspace/**),mcp__carrylog_verification__verify_registered",
  );
  const readOnlyAllowedIndex = invocation.arguments.indexOf("--allowedTools");
  assert.equal(invocation.arguments[readOnlyAllowedIndex + 1].includes("Edit("), false);
  assert.equal(invocation.arguments[readOnlyAllowedIndex + 1].includes("Write("), false);
});

test("Claude tool execution concurrency is fixed once and rejects inherited policy", () => {
  const environment = { HOME: "/synthetic-home" };
  assert.equal(enforceSerialClaudeToolExecution(environment), environment);
  assert.equal(environment.CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY, "1");
  assert.throws(
    () => enforceSerialClaudeToolExecution(environment),
    /must not be inherited or preconfigured/,
  );
  assert.throws(
    () =>
      enforceSerialClaudeToolExecution({
        CLAUDE_CODE_MAX_TOOL_USE_CONCURRENCY: "2",
      }),
    /must not be inherited or preconfigured/,
  );
});

test("Codex verification is broker-only and fixes the copied wrapper and registry contract", () => {
  assert.equal(
    renderCodexVerificationPermissions(
      "/verification",
      "/verification/receipts.jsonl",
      "/verification-scratch",
    ),
    '"/verification" = "read"',
  );
  assert.equal(
    renderCodexVerificationPermissions(
      "/verification",
      "/verification/receipts.jsonl",
      "/verification-scratch",
    ).includes('"write"'),
    false,
    "the model permission profile must not grant receipt or scratch writes",
  );
  assert.throws(() =>
    renderCodexVerificationPermissions(
      "/verification",
      "/other/receipts.jsonl",
      "/verification-scratch",
    ),
  );
});

test("verification registry fixes execution mode from harness and rejects ambiguous builders", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "carrylog-r5-registry-contract-")));
  const checkout = path.join(root, "checkout");
  const gitDirectory = path.join(root, "metadata.git");
  const scratchRoot = path.join(root, "verification-scratch");
  const verificationDirectory = path.join(root, "verification");
  await Promise.all([
    mkdir(checkout),
    mkdir(gitDirectory),
    mkdir(scratchRoot),
    mkdir(verificationDirectory),
  ]);
  await writeFile(path.join(checkout, ".git"), `gitdir: ${gitDirectory}\n`);
  try {
    const command = {
      id: "registered",
      cwd: ".",
      executable: process.execPath,
      gitContext: "none",
      arguments: ["-e", "process.exit(0)"],
      timeoutMs: 10_000,
    };
    const common = {
      commands: [command],
      scratch: buildVerificationScratch(scratchRoot),
      executablePath: "/usr/bin:/bin",
      receiptPath: path.join(verificationDirectory, "receipts.jsonl"),
      checkout,
      verificationDirectory,
      runtimeReadPaths: ["/runtime"],
      developerDirectory: "/Developer",
      gitDirectory,
      programDigests: verificationSupport.programDigests,
      hostGitPolicy: verificationSupport.hostGitPolicy,
      pythonTimezoneDirectory: "/private/var/db/timezone/tz/test/zoneinfo",
    };
    const codex = buildVerificationRegistry({ harness: "codex", ...common });
    assert.equal(codex.execution.mode, "seatbelt-broker-isolated");
    assert.equal(codex.execution.sandboxExecutable, "/usr/bin/sandbox-exec");
    assert.match(codex.execution.sandboxProfiles.none, /deny network/);
    assert.doesNotMatch(codex.execution.sandboxProfiles.none, new RegExp(gitDirectory));
    assert.match(codex.execution.sandboxProfiles.repository, new RegExp(gitDirectory));
    assert.match(codex.execution.sandboxProfiles["repository-discovery"], new RegExp(gitDirectory));
    const claude = buildVerificationRegistry({ harness: "claude", ...common });
    assert.equal(claude.execution.mode, "seatbelt-workspace-isolated");
    assert.equal(claude.execution.sandboxExecutable, "/usr/bin/sandbox-exec");
    assert.match(claude.execution.sandboxProfiles.none, /deny default/);
    assert.doesNotMatch(claude.execution.sandboxProfiles.none, /allow default/);
    assert.match(claude.execution.sandboxProfiles.none, /deny network/);
    assert.equal(
      buildVerificationExecutablePath(["/opt/tools/bin/node", "/usr/bin/git"], "/Developer"),
      "/Developer/usr/bin:/opt/tools/bin:/usr/bin:/bin",
    );
    assert.throws(() => buildVerificationRegistry({ harness: "unknown", ...common }));
    assert.throws(() =>
      buildVerificationRegistry({
        harness: "codex",
        ...common,
        commands: [{ ...command, gitContext: undefined }],
      }),
    );
    assert.throws(() =>
      buildVerificationRegistry({
        harness: "codex",
        ...common,
        commands: [{ ...command, gitContext: "repository" }],
      }),
    );
    assert.throws(() =>
      buildVerificationRegistry({
        harness: "codex",
        ...common,
        commands: [{ ...command, executable: "git", gitContext: "none" }],
      }),
    );
    assert.throws(() =>
      buildVerificationRegistry({
        harness: "codex",
        ...common,
        commands: [command, command],
      }),
    );
    assert.equal(
      renderCodexRuntimePermissions(["/opt/homebrew/Cellar/node/22.1.0", "/opt/homebrew/bin/node"]),
      '"/opt/homebrew/Cellar/node/22.1.0" = "read"\n"/opt/homebrew/bin/node" = "read"',
    );
    assert.throws(() => renderCodexRuntimePermissions(["/opt/homebrew"]));
    assert.throws(() => renderCodexRuntimePermissions(["/usr/local"]));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("repository discovery validates an exact regular gitfile and isolates metadata writes", async () => {
  const root = await realpath(
    await mkdtemp(path.join(tmpdir(), "carrylog-r5-discovery-contract-")),
  );
  const checkout = path.join(root, "checkout");
  const gitDirectory = path.join(root, "metadata.git");
  const scratchRoot = path.join(root, "scratch");
  const verificationDirectory = path.join(root, "verification");
  await Promise.all([
    mkdir(checkout),
    mkdir(gitDirectory),
    mkdir(scratchRoot),
    mkdir(verificationDirectory),
  ]);
  const gitfile = path.join(checkout, ".git");
  await writeFile(gitfile, `gitdir: ${gitDirectory}\n`);
  try {
    assert.doesNotThrow(() =>
      validateRepositoryDiscoveryLayout({
        checkout,
        gitDirectory,
        scratchRoot,
      }),
    );
    const environment = buildVerificationEnvironment({
      policy: "repository-discovery",
      baseEnvironment: { HOME: "/scratch/home", GIT_CONFIG_NOSYSTEM: "1" },
      checkout,
      gitDirectory,
    });
    assert.equal(Object.hasOwn(environment, "GIT_DIR"), false);
    assert.deepEqual(
      buildVerificationEnvironment({
        policy: "repository",
        baseEnvironment: { HOME: "/scratch/home" },
        checkout,
        gitDirectory,
      }),
      {
        HOME: "/scratch/home",
        GIT_DIR: gitDirectory,
        GIT_WORK_TREE: checkout,
        GIT_OPTIONAL_LOCKS: "0",
      },
    );
    const profile = buildRepositoryDiscoverySeatbeltProfile({
      policy: "repository-discovery",
      checkout,
      gitDirectory,
      scratchRoot,
      verificationDirectory,
      receiptPath: path.join(verificationDirectory, "receipts.jsonl"),
      runtimeReadPaths: ["/runtime"],
    });
    assert.match(profile, new RegExp(`\\(subpath ${JSON.stringify(gitDirectory)}\\)`));
    assert.match(profile, /"\/etc\/gitconfig"/);
    assert.match(profile, /"\/usr\/share\/i18n"/);
    const writeSection = profile.slice(profile.indexOf("(allow file-write*"));
    assert.equal(writeSection.includes(JSON.stringify(gitDirectory)), false);
    assert.match(writeSection, new RegExp(`\\(literal ${JSON.stringify(gitfile)}\\)`));
    await writeFile(gitfile, `gitdir: ${gitDirectory}\r\n`);
    assert.throws(
      () =>
        validateRepositoryDiscoveryLayout({
          checkout,
          gitDirectory,
          scratchRoot,
        }),
      /exact canonical external/,
    );
    await rm(gitfile);
    await symlink(gitDirectory, gitfile);
    assert.throws(
      () =>
        validateRepositoryDiscoveryLayout({
          checkout,
          gitDirectory,
          scratchRoot,
        }),
      /regular gitfile/,
    );
    await rm(gitfile);
    await writeFile(gitfile, `gitdir: ${gitDirectory}\n`);
    const alias = path.join(root, "metadata-alias");
    await symlink(gitDirectory, alias);
    assert.throws(
      () =>
        buildRepositoryDiscoverySeatbeltProfile({
          policy: "repository-discovery",
          checkout,
          gitDirectory,
          scratchRoot,
          verificationDirectory,
          receiptPath: path.join(verificationDirectory, "receipts.jsonl"),
          runtimeReadPaths: [alias],
        }),
      /runtime read path overlaps protected Git metadata/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Codex broker wrapper preserves exact command, receipt, state, unknown-ID, and no-argument contracts", async (context) => {
  if (process.platform !== "darwin") {
    context.skip("Codex broker execution requires the frozen macOS Seatbelt runtime.");
    return;
  }
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "carrylog-direct-wrapper-contract-")),
  );
  const checkout = path.join(temporaryRoot, "checkout");
  const verificationDirectory = path.join(temporaryRoot, "verification");
  const scratch = buildVerificationScratch(path.join(temporaryRoot, "verification-scratch"));
  const registryPath = path.join(verificationDirectory, "commands.json");
  const receiptPath = path.join(verificationDirectory, "receipts.jsonl");
  const wrapper = path.join(verificationDirectory, "run-check.mjs");
  const gitDirectory = path.join(temporaryRoot, "repository.git");
  try {
    await mkdir(checkout);
    await mkdir(verificationDirectory);
    assert.equal(spawnSync("git", ["init", "--quiet", "--bare", gitDirectory]).status, 0);
    const gitEnv = {
      ...process.env,
      GIT_DIR: await realpath(gitDirectory),
      GIT_WORK_TREE: await realpath(checkout),
      GIT_OPTIONAL_LOCKS: "0",
    };
    await writeFile(path.join(checkout, "tracked.txt"), "before\n");
    assert.equal(spawnSync("git", ["add", "-A"], { env: gitEnv }).status, 0);
    assert.equal(
      spawnSync(
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
        { env: gitEnv },
      ).status,
      0,
    );
    await writeFile(path.join(checkout, ".git"), `gitdir: ${await realpath(gitDirectory)}\n`);
    for (const directory of [
      scratch.root,
      scratch.home,
      scratch.tmp,
      scratch.xdgConfig,
      scratch.xdgCache,
      scratch.npmCache,
      scratch.uvCache,
    ]) {
      await mkdir(directory, { recursive: true });
    }
    await writeFile(scratch.npmUserConfig, "");
    await writeFile(scratch.npmGlobalConfig, "");
    const registry = buildVerificationRegistry({
      harness: "codex",
      commands: [
        {
          id: "registered",
          cwd: ".",
          executable: process.execPath,
          gitContext: "none",
          arguments: [
            "-e",
            `const a=require('node:assert/strict'),c=require('node:child_process'),f=require('node:fs'),p=require('node:path');for(const n of ['GIT_DIR','GIT_WORK_TREE','GIT_OPTIONAL_LOCKS'])a.equal(process.env[n],undefined,n);const nested=f.mkdtempSync(p.join(process.env.TMPDIR,'nested-git-'));const initialized=c.spawnSync('git',['init','--quiet',nested],{encoding:'utf8'});a.equal(initialized.status,0,initialized.stderr);a.equal(f.existsSync(p.join(nested,'.git')),true);let denied=false;try{f.readFileSync(${JSON.stringify(path.join(gitDirectory, "HEAD"))})}catch(error){denied=['EPERM','EACCES'].includes(error.code)}a.equal(denied,true,'detached metadata readable');process.stdout.write('DIRECT_OK')`,
          ],
          timeoutMs: 10_000,
        },
        {
          id: "receipt-attack",
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
          id: "output-limit",
          cwd: ".",
          executable: process.execPath,
          gitContext: "none",
          arguments: [
            "-e",
            "process.stdout.write(Buffer.alloc(1024 * 1024 + 1, 120)); setInterval(() => {}, 1000)",
          ],
          timeoutMs: 10_000,
        },
        {
          id: "timeout",
          cwd: ".",
          executable: process.execPath,
          gitContext: "none",
          arguments: ["-e", "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)"],
          timeoutMs: 100,
        },
        {
          id: "signal",
          cwd: ".",
          executable: process.execPath,
          gitContext: "none",
          arguments: ["-e", "process.kill(process.pid, 'SIGTERM')"],
          timeoutMs: 10_000,
        },
      ],
      scratch,
      executablePath: buildVerificationExecutablePath(
        [process.execPath],
        "/Library/Developer/CommandLineTools",
      ),
      receiptPath,
      checkout,
      verificationDirectory,
      runtimeReadPaths: await processRuntimeReadPaths(),
      developerDirectory: "/Library/Developer/CommandLineTools",
      gitDirectory: await realpath(gitDirectory),
      programDigests: verificationSupport.programDigests,
      hostGitPolicy: verificationSupport.hostGitPolicy,
      pythonTimezoneDirectory: resolveMacosPythonTimezoneDirectory(),
    });
    const registryBytes = `${JSON.stringify(registry, null, 2)}\n`;
    const registrySha256 = digestRegistryBytes(registryBytes);
    await writeFile(registryPath, registryBytes);
    await writeFile(receiptPath, "", { mode: 0o600, flag: "wx" });
    await writeFile(
      wrapper,
      bindVerificationProgram(
        await readFile(path.join(analysisRoot, "fixture-command-wrapper.mjs"), "utf8"),
        registrySha256,
      ),
    );
    await writeVerificationSupportFiles(verificationDirectory, verificationSupport);
    const invokeRaw = (...extra) =>
      spawnSync(process.execPath, [wrapper, ...extra], {
        cwd: checkout,
        encoding: "utf8",
        maxBuffer: 2 * 1024 * 1024,
        shell: false,
      });
    const invoke = (...extra) => {
      if (extra.length !== 1) return invokeRaw(...extra);
      const command = registry.commands.find((candidate) => candidate.id === extra[0]);
      if (command === undefined) return invokeRaw(extra[0], "0".repeat(32));
      const invocationId = createVerificationInvocationId();
      appendVerificationRecord(
        receiptPath,
        createVerificationStartRecord({
          invocationId,
          commandId: command.id,
          registrySha256,
          commandSha256: command.commandSha256,
          executionMode: registry.execution.mode,
          origin: "direct-screen",
          brokerId: null,
        }),
      );
      return invokeRaw(command.id, invocationId);
    };
    const accepted = invoke("registered");
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.equal(accepted.stdout, "DIRECT_OK");
    const receipt = parseVerificationInvocationStream(await readFile(receiptPath, "utf8"))
      .terminalReceipts[0];
    assert.equal(receipt.formatVersion, 5);
    assert.equal(receipt.commandId, "registered");
    assert.equal(receipt.executionMode, "seatbelt-broker-isolated");
    assert.equal(receipt.exitStatus, 0);
    assertReceiptBinding(receipt, {
      registrySha256,
      commandDigests: { registered: registry.commands[0].commandSha256 },
    });
    assert.throws(
      () =>
        assertReceiptBinding(
          { ...receipt, preCommandStateSha256: "0".repeat(64) },
          {
            registrySha256,
            commandDigests: { registered: registry.commands[0].commandSha256 },
          },
        ),
      /pre-command state digest differs/,
    );
    const attack = invoke("receipt-attack");
    assert.equal(attack.status, 0, attack.stderr);
    assert.equal(attack.stdout, "CHILD_RECEIPT_ACCESS_DENIED");
    assert.equal(
      (await readFile(receiptPath, "utf8")).includes("FORGED_RECEIPT_CHILD"),
      false,
      "verification child forged receipt content",
    );
    await writeFile(path.join(checkout, "tracked.txt"), "modified\n");
    assert.equal(invoke("registered").status, 0);
    const stateReceipts = parseVerificationInvocationStream(
      await readFile(receiptPath, "utf8"),
    ).terminalReceipts;
    assert.notEqual(
      stateReceipts[0].preCommandStateSha256,
      stateReceipts[2].preCommandStateSha256,
      "pre-command receipt concealed a modified tracked file",
    );

    assert.equal(invoke("output-limit").status, 1);
    assert.equal(invoke("timeout").status, 1);
    assert.equal(invoke("signal").status, 1);
    const failureReceipts = parseVerificationInvocationStream(
      await readFile(receiptPath, "utf8"),
    ).terminalReceipts;
    const outputLimit = failureReceipts.at(-3);
    assert.equal(outputLimit.processState, "output-limit");
    assert.equal(outputLimit.outputLimited, true);
    assert.equal(outputLimit.stdoutRetainedBytes + outputLimit.stderrRetainedBytes, 1024 * 1024);
    assert.equal(outputLimit.stdoutSha256, null);
    assert.match(outputLimit.stdoutRetainedSha256, /^[0-9a-f]{64}$/);
    const timeout = failureReceipts.at(-2);
    assert.equal(timeout.processState, "timeout");
    assert.equal(timeout.timedOut, true);
    assert.equal(timeout.signal, "SIGKILL");
    assert.equal(timeout.termination.escalationSent, true);
    const signalled = failureReceipts.at(-1);
    assert.equal(signalled.processState, "signal");
    assert.equal(signalled.signal, "SIGTERM");

    assert.notEqual(invoke("missing").status, 0, "unknown command ID was accepted");
    assert.notEqual(
      invoke("registered", "seatbelt-workspace-isolated").status,
      0,
      "caller selected or injected an execution mode",
    );

    const forgedCommand = {
      ...registry,
      commands: [{ ...registry.commands[0], arguments: ["-e", "process.exit(99)"] }],
    };
    await writeFile(registryPath, `${JSON.stringify(forgedCommand, null, 2)}\n`);
    assert.notEqual(invoke("registered").status, 0, "forged command registry was accepted");
    await writeFile(registryPath, registryBytes);

    const alternate = path.join(temporaryRoot, "alternate-verification");
    await mkdir(alternate);
    await copyFile(wrapper, path.join(alternate, "run-check.mjs"));
    await copyFile(registryPath, path.join(alternate, "commands.json"));
    const copied = spawnSync(
      process.execPath,
      [path.join(alternate, "run-check.mjs"), "registered"],
      {
        cwd: checkout,
        encoding: "utf8",
      },
    );
    assert.notEqual(copied.status, 0, "wrapper copy escaped its canonical directory binding");

    const forgedMode = {
      ...registry,
      execution: { mode: "seatbelt-workspace-isolated" },
    };
    await writeFile(registryPath, `${JSON.stringify(forgedMode, null, 2)}\n`);
    assert.notEqual(invoke("registered").status, 0, "forged execution mode was accepted");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("authentication evidence separates staging, cleanup outcome, and abnormal termination risk", () => {
  const staged = createAuthenticationEvidence(["codex/auth.json"]);
  assert.deepEqual(staged, {
    ephemeralAuthenticationStaged: true,
    stagedAuthenticationFiles: ["codex/auth.json"],
    stagedAuthenticationEnvironmentFields: [],
    cleanupAttempted: false,
    cleanupSucceeded: null,
    cleanupDiagnostic: null,
    residualAuthenticationPossible: true,
    cleanupNotGuaranteedAfter: ["SIGKILL", "host-crash", "power-loss"],
  });
  recordAuthenticationCleanup(staged, true);
  assert.equal(staged.cleanupAttempted, true);
  assert.equal(staged.cleanupSucceeded, true);
  assert.equal(staged.cleanupDiagnostic, null);
  assert.equal(staged.residualAuthenticationPossible, false);
  assert.throws(() => recordAuthenticationCleanup(staged, true), /recorded twice/);

  const failed = createAuthenticationEvidence(["claude/.credentials.json"]);
  recordAuthenticationCleanup(failed, false, "permission denied");
  assert.equal(failed.cleanupSucceeded, false);
  assert.equal(failed.cleanupDiagnostic, "permission denied");
  assert.equal(failed.residualAuthenticationPossible, true);

  const unstaged = createAuthenticationEvidence([]);
  assert.equal(unstaged.ephemeralAuthenticationStaged, false);
  assert.equal(unstaged.cleanupAttempted, false);
  assert.equal(unstaged.cleanupSucceeded, null);
  assert.equal(unstaged.cleanupDiagnostic, null);
  assert.equal(unstaged.residualAuthenticationPossible, false);

  const environmentOnly = createAuthenticationEvidence([], ["ANTHROPIC_API_KEY"]);
  assert.equal(environmentOnly.ephemeralAuthenticationStaged, true);
  assert.deepEqual(environmentOnly.stagedAuthenticationFiles, []);
  assert.deepEqual(environmentOnly.stagedAuthenticationEnvironmentFields, ["ANTHROPIC_API_KEY"]);
});

test("process evidence preserves exit, signal, timeout, and spawn failure independently", () => {
  assert.deepEqual(
    processStatus({
      exitCode: 143,
      signal: "SIGTERM",
      timedOut: true,
      spawnError: "max-buffer-exceeded",
    }),
    {
      exitCode: 143,
      signal: "SIGTERM",
      timedOut: true,
      spawnError: "max-buffer-exceeded",
    },
  );
});

test("network canary distinguishes connect denial from probe-spawn denial", () => {
  assert.equal(classifyNetworkProbeEvidence("NETWORK_CONNECT_DENIED\n", 0), "connect-denied");
  assert.equal(
    classifyNetworkProbeEvidence("NETWORK_PROBE_SPAWN_DENIED\n", 0),
    "probe-spawn-denied",
  );
  assert.throws(() => classifyNetworkProbeEvidence("NETWORK_CONNECTED\n", 1));
  assert.throws(() => classifyNetworkProbeEvidence("", 0));
  assert.throws(() =>
    classifyNetworkProbeEvidence("NETWORK_CONNECT_DENIED\nNETWORK_PROBE_SPAWN_DENIED\n", 0),
  );
});

test("Codex canary binds denial markers to one exact trusted probe command", () => {
  const expectedCommand = '/bin/zsh -lc "/bin/bash .carrylog-canary-probe.sh"';
  const requiredMarkers = ["WORKSPACE_OK", "OUTSIDE_DENIED", "NETWORK_CONNECT_DENIED"];
  const forbiddenMarkers = ["WORKSPACE_INVALID", "OUTSIDE_READABLE", "NETWORK_CONNECTED"];
  const exact = parseCodexJsonEvents(
    `${JSON.stringify({
      type: "item.completed",
      item: {
        type: "command_execution",
        command: expectedCommand,
        aggregated_output: `${requiredMarkers.join("\n")}\n`,
        exit_code: 0,
        status: "completed",
      },
    })}\n`,
  );
  assert.equal(
    assertCodexProbeEvidence(exact, {
      expectedCommand,
      requiredMarkers,
      forbiddenMarkers,
      observedNetworkConnections: 0,
    }),
    "connect-denied",
  );

  const markerOnlySpoof = structuredClone(exact);
  markerOnlySpoof[0].command = `/bin/zsh -lc ${JSON.stringify(`printf '%s\\n' ${requiredMarkers.join(" ")}`)}`;
  assert.throws(
    () =>
      assertCodexProbeEvidence(markerOnlySpoof, {
        expectedCommand,
        requiredMarkers,
        forbiddenMarkers,
        observedNetworkConnections: 0,
      }),
    /different shell probe/,
  );
  assert.throws(
    () =>
      assertCodexProbeEvidence([...exact, ...markerOnlySpoof], {
        expectedCommand,
        requiredMarkers,
        forbiddenMarkers,
        observedNetworkConnections: 0,
      }),
    /exactly one shell probe/,
  );
});

test("Claude canary binds tool results and permission denials to exact tool-use inputs", () => {
  const allowed = {
    name: "Read",
    input: { file_path: "/workspace/allowed.txt" },
  };
  const denied = {
    name: "Read",
    input: { file_path: "/outside/sentinel.txt" },
  };
  const diagnostic = parseClaudeJsonEvents(
    [
      {
        type: "assistant",
        message: {
          model: "gpt-5.6-sol",
          content: [
            { type: "tool_use", id: "tool-allowed", ...allowed },
            { type: "tool_use", id: "tool-denied", ...denied },
          ],
        },
      },
      {
        type: "user",
        message: {
          content: [
            {
              type: "tool_result",
              tool_use_id: "tool-allowed",
              content: "WORKSPACE_OK",
              is_error: false,
            },
          ],
        },
      },
      {
        type: "result",
        permission_denials: [
          {
            tool_name: "Read",
            tool_use_id: "tool-denied",
            tool_input: denied.input,
          },
        ],
      },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n"),
  );
  assert.doesNotThrow(() => assertClaudeSuccessfulToolUse(diagnostic, allowed, "WORKSPACE_OK"));
  assert.doesNotThrow(() => assertClaudeDeniedToolUse(diagnostic, denied));
  assert.deepEqual(assertClaudeResponseModels(diagnostic, ["gpt-5.6-sol"]), ["gpt-5.6-sol"]);
  assert.throws(
    () => assertClaudeResponseModels(diagnostic, ["gpt-5.6-terra"]),
    /unregistered model/,
  );
  assert.throws(
    () => assertClaudeResponseModels({ ...diagnostic, responseModels: [] }, ["gpt-5.6-sol"]),
    /omitted resolved model/,
  );
  const missingModel = parseClaudeJsonEvents(
    [
      { type: "assistant", message: { model: "gpt-5.6-sol", content: [] } },
      { type: "assistant", message: { content: [] } },
    ]
      .map((event) => JSON.stringify(event))
      .join("\n"),
  );
  assert.deepEqual(missingModel.responseModels, ["gpt-5.6-sol", null]);
  assert.throws(
    () => assertClaudeResponseModels(missingModel, ["gpt-5.6-sol"]),
    /omitted resolved model/,
  );

  const wrongTarget = structuredClone(diagnostic);
  wrongTarget.permissionDenials[0].tool_input.file_path = "/outside/other.txt";
  assert.throws(
    () => assertClaudeDeniedToolUse(wrongTarget, denied),
    /not bound to the exact Read input/,
  );
  const markerOnly = structuredClone(diagnostic);
  markerOnly.toolUses[1].input.file_path = "/workspace/fake.txt";
  assert.throws(
    () => assertClaudeDeniedToolUse(markerOnly, denied),
    /did not attempt the exact denied Read input/,
  );
});

test("harness diagnostics redact paths, tokens, bearer values, and auth fields", () => {
  const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJwcml2YXRlIn0.c2lnbmF0dXJlMTIzNDU2";
  const rendered = redactHarnessDiagnostic(
    `/private/tmp/run auth={"claudeAiOauth":"secret"} Bearer abcdefghijklmnop ghp_abcdefghijklmnop jmr_0123456789abcdef /Users/person/.claude ${jwt} ANTHROPIC_API_KEY=private-api-key-value OPENAI_API_KEY="quoted private value" GH_TOKEN='private token value' DATABASE_URL=postgres://user:opaque@db/x PUBLIC_URL=https://example.invalid/public`,
    ["/private/tmp/run"],
  );
  assert.equal(rendered.includes("secret"), false);
  assert.equal(rendered.includes("abcdefghijklmnop"), false);
  assert.equal(rendered.includes("jmr_0123456789abcdef"), false);
  assert.equal(rendered.includes("/Users/person"), false);
  assert.equal(rendered.includes(jwt), false);
  assert.equal(rendered.includes("private-api-key-value"), false);
  assert.equal(rendered.includes("quoted private value"), false);
  assert.equal(rendered.includes("private token value"), false);
  assert.equal(rendered.includes("user:opaque"), false);
  assert.equal(rendered.includes("PUBLIC_URL=https://example.invalid/public"), true);
  assert.match(rendered, /REDACTED/);
});

test("Claude authentication keeps only OAuth and classifies organization policy failures", () => {
  const projected = projectMinimalClaudeOAuth({
    claudeAiOauth: { accessToken: "opaque", expiresAt: 1 },
    history: ["private"],
    settings: { hooks: true },
  });
  assert.deepEqual(Object.keys(projected), ["claudeAiOauth"]);
  assert.deepEqual(projected.claudeAiOauth, {
    accessToken: "opaque",
    expiresAt: 1,
  });
  assert.throws(() => projectMinimalClaudeOAuth({ history: [] }));
  assert.equal(
    classifyClaudeAuthenticationFailure(
      "Your organization has disabled Claude subscription access for Claude Code",
    ),
    "subscription-disabled-by-organization",
  );
  assert.equal(classifyClaudeAuthenticationFailure("unrelated harness failure"), null);
});

test("scored execution permits only terminal predecessors and prepare-only remains outside the gate", () => {
  const runs = [{ runId: "t1-001" }, { runId: "t1-002" }, { runId: "t1-003" }];
  assertExecutionPredecessors(runs, "t1-001", {});
  assertExecutionPredecessors(runs, "t1-003", {
    "t1-001": {
      quarantine: { byRun: "complete", blind: "present" },
      reviewed: { byRun: "complete", blind: "present" },
    },
    "t1-002": {
      quarantine: { byRun: "failure", blind: "present" },
      reviewed: { byRun: "failure", blind: "absent" },
    },
  });
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-003", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "present" },
        },
      }),
    /t1-002 is absent from quarantine/,
  );
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-003", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "present" },
        },
        "t1-002": {
          quarantine: { byRun: "claim-only", blind: "present" },
          reviewed: { byRun: "absent", blind: "absent" },
        },
      }),
    /non-terminal quarantine claim/,
  );
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-003", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "present" },
        },
        "t1-002": {
          quarantine: { byRun: "failure", blind: "present" },
          reviewed: { byRun: "conflicting-terminals", blind: "absent" },
        },
      }),
    /conflicting reviewed terminal/,
  );
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-002", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "present" },
        },
        "t1-002": {
          quarantine: { byRun: "claim-only", blind: "present" },
          reviewed: { byRun: "absent", blind: "absent" },
        },
      }),
    /selected run t1-002 already has result state/,
  );
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-002", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "present" },
        },
        "t1-003": {
          quarantine: { byRun: "absent", blind: "present" },
          reviewed: { byRun: "absent", blind: "absent" },
        },
      }),
    /later run t1-003 already has result state/,
  );
  assert.throws(
    () =>
      assertExecutionPredecessors(runs, "t1-002", {
        "t1-001": {
          quarantine: { byRun: "complete", blind: "present" },
          reviewed: { byRun: "complete", blind: "absent" },
        },
      }),
    /lacks its reviewed blind surface/,
  );
});

test("macOS runtime reads retain exact invocation, package, keg, dylib, and CLT paths without broad prefixes", () => {
  const paths = deriveMacosRuntimeReadPaths([
    {
      invocationPath: "/opt/homebrew/bin/npm",
      realPath: "/opt/homebrew/lib/node_modules/npm/bin/npm-cli.js",
      packageRoot: "/opt/homebrew/lib/node_modules/npm",
      linkedLibraries: [
        {
          invocationPath: "/opt/homebrew/opt/openssl@3/lib/libssl.3.dylib",
          realPath: "/opt/homebrew/Cellar/openssl@3/3.5.1/lib/libssl.3.dylib",
        },
      ],
    },
  ]);
  assert.equal(paths.includes("/opt/homebrew"), false);
  assert.equal(paths.includes("/usr/local"), false);
  assert.equal(paths.includes("/opt/homebrew/bin"), false);
  assert.equal(paths.includes("/opt/homebrew/bin/npm"), true);
  assert.equal(paths.includes("/opt/homebrew/lib/node_modules/npm"), true);
  assert.equal(paths.includes("/opt/homebrew/Cellar/openssl@3/3.5.1"), true);
  assert.equal(paths.includes("/opt/homebrew/opt/openssl@3"), true);
  assert.equal(paths.includes("/Library/Developer/CommandLineTools"), false);
  assert.equal(paths.includes("/private/var/db/timezone"), true);
});

test("model runtime permissions exclude external Git metadata reserved for the broker", () => {
  const node = {
    invocationPath: "/opt/homebrew/bin/node",
    realPath: "/opt/homebrew/Cellar/node/22.1.0/bin/node",
    linkedLibraries: [],
  };
  const git = {
    invocationPath: "/Library/Developer/CommandLineTools/usr/bin/git",
    realPath: "/Library/Developer/CommandLineTools/usr/bin/git",
    linkedLibraries: [],
  };
  const partitions = partitionVerificationRuntimeReadPaths({
    resolvedRuntimes: [node, git],
    nodeRealPath: node.realPath,
    gitDirectory: "/private/tmp/repository.git",
    developerDirectory: "/Library/Developer/CommandLineTools",
  });
  assert.equal(partitions.broker.includes("/private/tmp/repository.git"), false);
  assert.equal(partitions.broker.includes("/Library/Developer/CommandLineTools"), true);
  assert.equal(partitions.model.includes("/private/tmp/repository.git"), false);
  assert.equal(partitions.model.includes("/Library/Developer/CommandLineTools"), false);
  assert.equal(partitions.model.includes("/opt/homebrew/Cellar/node/22.1.0"), true);
  assert.equal(partitions.model.includes(git.realPath), false);
  assert.throws(() =>
    partitionVerificationRuntimeReadPaths({
      resolvedRuntimes: [git],
      nodeRealPath: node.realPath,
      gitDirectory: "/private/tmp/repository.git",
      developerDirectory: "/Library/Developer/CommandLineTools",
    }),
  );
});

test("Git metadata remains discoverable during setup and detaches atomically before model access", async () => {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "carrylog-git-detach-contract-")),
  );
  const checkout = path.join(temporaryRoot, "checkout");
  const externalDirectory = path.join(temporaryRoot, "external.git");
  try {
    await mkdir(checkout);
    assert.equal(
      spawnSync("git", ["init", "--quiet", "--initial-branch=main"], {
        cwd: checkout,
      }).status,
      0,
    );
    await writeFile(path.join(checkout, "tracked.txt"), "baseline\n");
    assert.equal(spawnSync("git", ["add", "-A"], { cwd: checkout }).status, 0);
    assert.equal(
      spawnSync(
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
        { cwd: checkout },
      ).status,
      0,
    );
    assert.equal(spawnSync("git", ["rev-parse", "HEAD"], { cwd: checkout }).status, 0);
    const detached = await detachGitMetadata(checkout, externalDirectory);
    const gitfile = path.join(checkout, ".git");
    assert.equal((await lstat(gitfile)).isFile(), true);
    assert.equal(await readFile(gitfile, "utf8"), `gitdir: ${detached.directory}\n`);
    assert.equal(detached.directory, await realpath(externalDirectory));
    assert.equal(detached.workTree, await realpath(checkout));
    assert.equal(
      spawnSync("git", ["rev-parse", "HEAD"], {
        cwd: checkout,
        env: {
          ...process.env,
          GIT_DIR: detached.directory,
          GIT_WORK_TREE: detached.workTree,
          GIT_OPTIONAL_LOCKS: "0",
        },
      }).status,
      0,
    );
    await assert.rejects(
      detachGitMetadata(checkout, path.join(temporaryRoot, "second.git")),
      /must be a directory before detachment/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("exact local fixture fetch retains one shallow source commit and rejects parent history", async () => {
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "carrylog-shallow-source-contract-")),
  );
  const source = path.join(temporaryRoot, "source");
  const checkout = path.join(temporaryRoot, "checkout");
  const externalDirectory = path.join(temporaryRoot, "external.git");
  try {
    await mkdir(source);
    await mkdir(checkout);
    assert.equal(
      spawnSync("git", ["init", "--quiet", "--initial-branch=main"], {
        cwd: source,
      }).status,
      0,
    );
    for (let index = 1; index <= 3; index += 1) {
      await writeFile(path.join(source, "history.txt"), `revision-${index}\n`);
      assert.equal(spawnSync("git", ["add", "-A"], { cwd: source }).status, 0);
      assert.equal(
        spawnSync(
          "git",
          [
            "-c",
            "user.name=Pilot",
            "-c",
            "user.email=pilot.invalid",
            "commit",
            "--quiet",
            "-m",
            `source-${index}`,
          ],
          { cwd: source },
        ).status,
        0,
      );
    }
    const commit = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: source,
      encoding: "utf8",
    }).stdout.trim();
    assert.equal(
      spawnSync("git", ["rev-list", "--count", "HEAD"], {
        cwd: source,
        encoding: "utf8",
      }).stdout.trim(),
      "3",
    );
    assert.equal(
      spawnSync("git", ["init", "--quiet", "--initial-branch=main"], {
        cwd: checkout,
      }).status,
      0,
    );
    const reference = "refs/carrylog-pilot/source";
    const fetch = spawnSync(
      "git",
      buildLocalExactCommitFetchArguments(await realpath(source), commit, reference),
      { cwd: checkout, encoding: "utf8" },
    );
    assert.equal(fetch.status, 0, fetch.stderr);
    const detached = await detachGitMetadata(checkout, externalDirectory);
    const environment = {
      ...process.env,
      GIT_DIR: detached.directory,
      GIT_WORK_TREE: detached.workTree,
      GIT_OPTIONAL_LOCKS: "0",
    };
    assert.equal(
      spawnSync("git", ["rev-parse", reference], {
        cwd: checkout,
        env: environment,
        encoding: "utf8",
      }).stdout.trim(),
      commit,
    );
    assert.equal(
      spawnSync("git", ["rev-list", "--count", reference], {
        cwd: checkout,
        env: environment,
        encoding: "utf8",
      }).stdout.trim(),
      "1",
    );
    assert.equal((await readFile(path.join(detached.directory, "shallow"), "utf8")).trim(), commit);
    assert.notEqual(
      spawnSync("git", ["cat-file", "-e", `${commit}^`], {
        cwd: checkout,
        env: environment,
      }).status,
      0,
    );
    assert.notEqual(
      spawnSync("git", ["show", `${commit}^:history.txt`], {
        cwd: checkout,
        env: environment,
      }).status,
      0,
    );
    assert.throws(() => buildLocalExactCommitFetchArguments("relative", commit, reference));
    assert.throws(() =>
      buildLocalExactCommitFetchArguments("/absolute/source", commit.slice(0, 12), reference),
    );
    assert.throws(() =>
      buildLocalExactCommitFetchArguments("/absolute/source", commit, "refs/unsafe ref"),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

async function processRuntimeReadPaths() {
  const realPath = await realpath(process.execPath);
  const inspected = spawnSync("otool", ["-L", realPath], { encoding: "utf8" });
  assert.equal(inspected.status, 0, inspected.stderr);
  const linkedLibraries = [];
  for (const line of inspected.stdout.split(/\r?\n/).slice(1)) {
    const invocationPath = line.trim().split(/\s+\(/, 1)[0];
    if (!path.isAbsolute(invocationPath)) continue;
    linkedLibraries.push({
      invocationPath,
      realPath: await realpathIfPresent(invocationPath),
    });
  }
  return deriveMacosRuntimeReadPaths([
    { invocationPath: process.execPath, realPath, linkedLibraries },
  ]);
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
