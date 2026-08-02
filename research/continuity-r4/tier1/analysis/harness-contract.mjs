import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, lstat, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";

export const REGISTRY_DIGEST_PLACEHOLDER = "__CARRYLOG_VERIFICATION_REGISTRY_SHA256_PLACEHOLDER__";

export const VERIFICATION_EXECUTION_MODES = Object.freeze({
  codex: "seatbelt-broker-isolated",
  claude: "seatbelt-workspace-isolated",
});

export const VERIFICATION_GIT_CONTEXTS = Object.freeze({
  none: "none",
  repository: "repository",
});

export function buildCarrylogToolInstallArguments(tarball, { allowNetwork }) {
  assertNonEmptyString(tarball, "tarball");
  assert.equal(path.isAbsolute(tarball), true, "tarball must be absolute");
  assert.equal(typeof allowNetwork, "boolean");
  return [
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--no-save",
    "--package-lock=false",
    ...(!allowNetwork ? ["--offline"] : []),
    tarball,
  ];
}

export function buildCodexInvocation({
  executable,
  prompt,
  model,
  reasoningEffort,
  permissionProfile,
  verification,
}) {
  assertNonEmptyString(executable, "executable");
  assert.equal(path.isAbsolute(executable), true, "Codex executable must be absolute");
  assertNonEmptyString(prompt, "prompt");
  assertNonEmptyString(model, "model");
  assertNonEmptyString(reasoningEffort, "reasoningEffort");
  assertNonEmptyString(permissionProfile, "permissionProfile");
  assertNonEmptyString(verification.mcpServer, "verification.mcpServer");
  assert.ok(Array.isArray(verification.mcpTools) && verification.mcpTools.length > 0);
  const broker = buildVerificationMcpConfiguration(verification).mcpServers.carrylog_verification;
  const approvedBrokerTools = verification.mcpTools.map((tool) => {
    assert.match(tool, /^mcp__carrylog_verification__verify_[a-z][a-z0-9_]*$/);
    return tool.slice("mcp__carrylog_verification__".length);
  });
  assert.equal(new Set(approvedBrokerTools).size, approvedBrokerTools.length);
  return {
    executable,
    arguments: [
      "exec",
      "--ephemeral",
      "--ignore-rules",
      "--strict-config",
      "--skip-git-repo-check",
      "-m",
      model,
      "-c",
      `model_reasoning_effort=${JSON.stringify(reasoningEffort)}`,
      "-c",
      `default_permissions=${JSON.stringify(permissionProfile)}`,
      "-c",
      'web_search="disabled"',
      "-c",
      `mcp_servers.carrylog_verification.command=${JSON.stringify(broker.command)}`,
      "-c",
      `mcp_servers.carrylog_verification.args=${JSON.stringify(broker.args)}`,
      ...approvedBrokerTools.flatMap((tool) => [
        "-c",
        `mcp_servers.carrylog_verification.tools.${tool}.approval_mode="approve"`,
      ]),
      "--json",
      prompt,
    ],
  };
}

export function buildClaudeInvocation({
  executable = "claude",
  prompt,
  model,
  effort,
  maximumBudgetUsd,
  writable,
  checkout,
  verification,
}) {
  assertNonEmptyString(executable, "executable");
  assertNonEmptyString(prompt, "prompt");
  assertNonEmptyString(model, "model");
  assertNonEmptyString(effort, "effort");
  assert.ok(Number.isFinite(maximumBudgetUsd) && maximumBudgetUsd > 0);
  assert.equal(typeof writable, "boolean");
  assertNonEmptyString(checkout, "checkout");
  assertNonEmptyString(verification.mcpServer, "verification.mcpServer");
  assertNonEmptyString(verification.wrapper, "verification.wrapper");
  assertNonEmptyString(verification.registry, "verification.registry");
  assert.ok(Array.isArray(verification.mcpTools) && verification.mcpTools.length > 0);
  const tools = writable ? "Read,Glob,Grep,Edit,Write" : "Read,Glob,Grep";
  const allowed = [
    `Read(${checkout}/**)`,
    `Glob(${checkout}/**)`,
    `Grep(${checkout}/**)`,
    ...(writable ? [`Edit(${checkout}/**)`, `Write(${checkout}/**)`] : []),
    ...verification.mcpTools,
  ].join(",");
  return {
    executable,
    arguments: [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--no-session-persistence",
      "--model",
      model,
      "--effort",
      effort,
      "--max-budget-usd",
      String(maximumBudgetUsd),
      "--permission-mode",
      writable ? "acceptEdits" : "dontAsk",
      "--tools",
      tools,
      "--allowedTools",
      allowed,
      "--disallowedTools",
      "Bash,WebFetch,WebSearch",
      "--strict-mcp-config",
      "--mcp-config",
      JSON.stringify(buildVerificationMcpConfiguration(verification)),
      "--setting-sources",
      "project",
    ],
  };
}

export function buildVerificationMcpConfiguration(verification) {
  return {
    mcpServers: {
      carrylog_verification: {
        type: "stdio",
        command: process.execPath,
        args: [verification.mcpServer],
      },
    },
  };
}

export function buildVerificationRegistry({
  harness,
  commands,
  scratch,
  executablePath,
  receiptPath,
  checkout,
  verificationDirectory,
  runtimeReadPaths = [],
  developerDirectory,
  gitDirectory,
}) {
  assert.ok(Object.hasOwn(VERIFICATION_EXECUTION_MODES, harness));
  assert.ok(Array.isArray(commands) && commands.length > 0);
  validateVerificationScratch(scratch);
  assertNonEmptyString(executablePath, "executablePath");
  assertNonEmptyString(receiptPath, "receiptPath");
  assert.equal(path.isAbsolute(checkout), true);
  assert.equal(path.isAbsolute(verificationDirectory), true);
  assert.equal(path.dirname(receiptPath), verificationDirectory);
  assert.equal(path.isAbsolute(developerDirectory), true);
  assert.equal(path.isAbsolute(gitDirectory), true);
  const resolvedGitDirectory = path.resolve(gitDirectory);
  for (const runtimePath of runtimeReadPaths) {
    assert.equal(path.isAbsolute(runtimePath), true);
    assert.equal(
      pathsOverlap(runtimePath, resolvedGitDirectory),
      false,
      "runtime read paths must not grant detached Git metadata",
    );
  }
  const ids = new Set();
  for (const command of commands) {
    assert.match(command.id, /^[a-z][a-z0-9-]+$/);
    assert.equal(ids.has(command.id), false, `duplicate verification command: ${command.id}`);
    ids.add(command.id);
    assertNonEmptyString(command.cwd, `commands.${command.id}.cwd`);
    assertNonEmptyString(command.executable, `commands.${command.id}.executable`);
    assert.ok(Array.isArray(command.arguments));
    assert.ok(Number.isInteger(command.timeoutMs) && command.timeoutMs > 0);
    assert.ok(
      Object.hasOwn(VERIFICATION_GIT_CONTEXTS, command.gitContext),
      `commands.${command.id}.gitContext must be explicit`,
    );
    assert.equal(
      command.gitContext === VERIFICATION_GIT_CONTEXTS.repository,
      command.executable === "git",
      `commands.${command.id} Git context must match the registered executable`,
    );
  }
  const executionMode = VERIFICATION_EXECUTION_MODES[harness];
  const sandboxProfileInputs = {
    checkout,
    verificationDirectory,
    receiptPath,
    scratchRoot: scratch.root,
  };
  return {
    formatVersion: 1,
    harness,
    execution: {
      mode: executionMode,
      ...(executionMode === "seatbelt-workspace-isolated" ||
      executionMode === "seatbelt-broker-isolated"
        ? {
            sandboxExecutable: "/usr/bin/sandbox-exec",
            sandboxProfiles: {
              none: buildLeastPrivilegeSeatbeltProfile({
                ...sandboxProfileInputs,
                runtimeReadPaths: [...runtimeReadPaths, developerDirectory],
              }),
              repository: buildLeastPrivilegeSeatbeltProfile({
                ...sandboxProfileInputs,
                runtimeReadPaths: [...runtimeReadPaths, developerDirectory, gitDirectory],
              }),
            },
          }
        : {}),
    },
    commands: commands.map((command) => {
      const value = { ...command, arguments: [...command.arguments] };
      return { ...value, commandSha256: digestCanonicalJson(value) };
    }),
    scratch: { ...scratch },
    developerDirectory,
    checkout,
    verificationDirectory,
    git: {
      directory: gitDirectory,
      workTree: checkout,
      optionalLocks: "0",
    },
    path: executablePath,
    receiptPath,
  };
}

export function deriveMacosRuntimeReadPaths(resolvedExecutables) {
  assert.ok(Array.isArray(resolvedExecutables) && resolvedExecutables.length > 0);
  const paths = new Set([
    "/bin/sh",
    "/bin/bash",
    "/dev/null",
    "/dev/urandom",
    "/Library/Apple/System/Library",
    "/private/var/db/timezone",
    "/private/var/select/sh",
    "/System/Library",
    "/usr/bin/env",
    "/usr/lib",
    "/usr/libexec/git-core",
  ]);
  for (const executable of resolvedExecutables) {
    assert.equal(path.isAbsolute(executable.invocationPath), true);
    assert.equal(path.isAbsolute(executable.realPath), true);
    paths.add(executable.invocationPath);
    // Invocation symlinks are granted literally; package/keg roots are granted only
    // when runtime module loading actually needs their descendants.
    const cellarMatch = executable.realPath.match(/^(.*\/Cellar\/[^/]+\/[^/]+)(?:\/|$)/);
    paths.add(cellarMatch?.[1] ?? executable.realPath);
    if (executable.packageRoot !== undefined) {
      assert.equal(path.isAbsolute(executable.packageRoot), true);
      paths.add(executable.packageRoot);
    }
    for (const library of executable.linkedLibraries ?? []) {
      assert.equal(path.isAbsolute(library.invocationPath), true);
      assert.equal(path.isAbsolute(library.realPath), true);
      paths.add(library.invocationPath);
      const optKeg = library.invocationPath.match(/^(.*\/opt\/[^/]+)(?:\/|$)/);
      if (optKeg !== null) {
        paths.add(optKeg[1]);
        if (path.basename(optKeg[1]).startsWith("openssl@")) {
          paths.add(
            path.join(path.dirname(path.dirname(optKeg[1])), "etc", path.basename(optKeg[1])),
          );
        }
      }
      const libraryCellar = library.realPath.match(/^(.*\/Cellar\/[^/]+\/[^/]+)(?:\/|$)/);
      paths.add(libraryCellar?.[1] ?? library.realPath);
    }
  }
  return [...paths].sort();
}

export function partitionVerificationRuntimeReadPaths({
  resolvedRuntimes,
  nodeRealPath,
  gitDirectory,
  developerDirectory,
}) {
  assert.ok(Array.isArray(resolvedRuntimes) && resolvedRuntimes.length > 0);
  for (const value of [nodeRealPath, gitDirectory, developerDirectory]) {
    assert.equal(path.isAbsolute(value), true);
  }
  const broker = [...deriveMacosRuntimeReadPaths(resolvedRuntimes), developerDirectory];
  const brokerLaunchRuntimes = resolvedRuntimes.filter(
    (runtime) => runtime.realPath === nodeRealPath,
  );
  assert.ok(brokerLaunchRuntimes.length > 0, "verification broker Node runtime was not resolved");
  const model = deriveMacosRuntimeReadPaths(brokerLaunchRuntimes);
  assert.equal(broker.includes(gitDirectory), false);
  assert.equal(model.includes(gitDirectory), false);
  assert.equal(model.includes(developerDirectory), false);
  return { broker: [...new Set(broker)], model };
}

export function buildVerificationExecutablePath(invocationPaths, developerDirectory) {
  assert.ok(Array.isArray(invocationPaths) && invocationPaths.length > 0);
  // Verification executes inside macOS Seatbelt even when this pure contract is
  // checked by a non-macOS CI host. Compile the target PATH with POSIX semantics.
  assert.equal(path.posix.isAbsolute(developerDirectory), true);
  const directories = new Set([path.posix.join(developerDirectory, "usr", "bin")]);
  for (const invocationPath of invocationPaths) {
    assert.equal(path.posix.isAbsolute(invocationPath), true);
    directories.add(path.posix.dirname(invocationPath));
  }
  directories.add("/usr/bin");
  directories.add("/bin");
  return [...directories].join(":");
}

export function buildVerificationScratch(root) {
  assert.equal(path.isAbsolute(root), true);
  return {
    root,
    home: path.join(root, "home"),
    tmp: path.join(root, "tmp"),
    xdgConfig: path.join(root, "xdg-config"),
    xdgCache: path.join(root, "xdg-cache"),
    npmUserConfig: path.join(root, "npm-user.npmrc"),
    npmGlobalConfig: path.join(root, "npm-global.npmrc"),
    npmCache: path.join(root, "npm-cache"),
    uvCache: path.join(root, "uv-cache"),
  };
}

export function bindVerificationProgram(source, registrySha256) {
  assertNonEmptyString(source, "source");
  assert.match(registrySha256, /^[0-9a-f]{64}$/);
  const occurrences = source.split(REGISTRY_DIGEST_PLACEHOLDER).length - 1;
  assert.equal(occurrences, 1, "verification program must contain exactly one binding placeholder");
  return source.replace(REGISTRY_DIGEST_PLACEHOLDER, registrySha256);
}

export function digestCanonicalJson(value) {
  return createHash("sha256")
    .update(JSON.stringify(sortJson(value)))
    .digest("hex");
}

export function digestRegistryBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertReceiptBinding(receipt, expected) {
  assert.equal(receipt.registrySha256, expected.registrySha256, "receipt registry binding differs");
  assert.equal(
    receipt.commandSha256,
    expected.commandDigests[receipt.commandId],
    `receipt command binding differs for ${receipt.commandId}`,
  );
  assert.equal(
    receipt.preCommandStateSha256,
    digestCanonicalJson(receipt.preCommandState),
    "receipt pre-command state digest differs",
  );
}

export function renderCodexRuntimePermissions(runtimeReadPaths) {
  assert.ok(Array.isArray(runtimeReadPaths) && runtimeReadPaths.length > 0);
  const unique = [...new Set(runtimeReadPaths)].sort();
  for (const runtimePath of unique) {
    assert.equal(path.isAbsolute(runtimePath), true);
    assert.equal(runtimePath === "/opt/homebrew" || runtimePath === "/usr/local", false);
  }
  return unique.map((runtimePath) => `${JSON.stringify(runtimePath)} = "read"`).join("\n");
}

export function renderCodexVerificationPermissions(
  verificationDirectory,
  receiptPath,
  scratchRoot,
) {
  assert.equal(path.isAbsolute(verificationDirectory), true);
  assert.equal(path.isAbsolute(receiptPath), true);
  assert.equal(path.isAbsolute(scratchRoot), true);
  assert.equal(path.dirname(receiptPath), verificationDirectory);
  assert.notEqual(scratchRoot, verificationDirectory);
  assert.equal(scratchRoot.startsWith(`${verificationDirectory}${path.sep}`), false);
  return `${JSON.stringify(verificationDirectory)} = "read"`;
}

export function createAuthenticationEvidence(
  stagedAuthenticationFiles,
  stagedAuthenticationEnvironmentFields = [],
) {
  assert.ok(Array.isArray(stagedAuthenticationFiles));
  assert.ok(Array.isArray(stagedAuthenticationEnvironmentFields));
  const staged =
    stagedAuthenticationFiles.length > 0 || stagedAuthenticationEnvironmentFields.length > 0;
  return {
    ephemeralAuthenticationStaged: staged,
    stagedAuthenticationFiles: [...stagedAuthenticationFiles],
    stagedAuthenticationEnvironmentFields: [...stagedAuthenticationEnvironmentFields],
    cleanupAttempted: false,
    cleanupSucceeded: null,
    cleanupDiagnostic: null,
    residualAuthenticationPossible: staged,
    cleanupNotGuaranteedAfter: ["SIGKILL", "host-crash", "power-loss"],
  };
}

export function recordAuthenticationCleanup(evidence, succeeded, diagnostic = null) {
  assert.equal(evidence.cleanupAttempted, false, "authentication cleanup recorded twice");
  assert.equal(typeof succeeded, "boolean");
  assert.ok(diagnostic === null || typeof diagnostic === "string");
  evidence.cleanupAttempted = true;
  evidence.cleanupSucceeded = succeeded;
  evidence.cleanupDiagnostic = diagnostic;
  evidence.residualAuthenticationPossible = evidence.ephemeralAuthenticationStaged && !succeeded;
  return evidence;
}

export function processStatus(result) {
  return {
    exitCode: Number.isInteger(result.exitCode) ? result.exitCode : null,
    signal: typeof result.signal === "string" ? result.signal : null,
    timedOut: result.timedOut === true,
    spawnError: typeof result.spawnError === "string" ? result.spawnError : null,
  };
}

export function classifyNetworkProbeEvidence(output, observedConnections) {
  assert.equal(typeof output, "string");
  assert.ok(Number.isInteger(observedConnections) && observedConnections >= 0);
  assert.equal(observedConnections, 0, "network probe reached the canary listener");
  assert.equal(output.includes("NETWORK_CONNECTED"), false, "network probe reported a connection");
  const connectDenied = output.includes("NETWORK_CONNECT_DENIED");
  const spawnDenied = output.includes("NETWORK_PROBE_SPAWN_DENIED");
  assert.notEqual(connectDenied, spawnDenied, "network probe has no unique denial classification");
  return connectDenied ? "connect-denied" : "probe-spawn-denied";
}

export function parseCodexJsonEvents(stdout) {
  assert.equal(typeof stdout, "string");
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "item.completed" && event.item?.type === "command_execution") {
        events.push({
          type: event.type,
          itemType: event.item.type,
          command: event.item.command ?? null,
          exitCode: event.item.exit_code,
          status: event.item.status,
          output: event.item.aggregated_output ?? "",
        });
      } else if (event.type === "item.completed" && event.item?.type === "mcp_tool_call") {
        events.push({
          type: event.type,
          itemType: event.item.type,
          status: event.item.status ?? null,
          server: event.item.server ?? null,
          tool: event.item.tool ?? null,
          output: renderStructuredDiagnostic(event.item.result),
          error: renderStructuredDiagnostic(event.item.error),
        });
      } else if (event.type === "item.completed" && event.item?.type === "agent_message") {
        events.push({
          type: event.type,
          itemType: event.item.type,
          text: event.item.text ?? "",
        });
      } else if (event.type === "error" || event.type === "turn.failed") {
        events.push({
          type: event.type,
          message: event.message ?? event.error?.message ?? "",
        });
      } else events.push({ type: event.type, itemType: event.item?.type ?? null });
    } catch {
      events.push({ type: "unparsed" });
    }
  }
  return events;
}

export function assertCodexProbeEvidence(
  events,
  { expectedCommand, requiredMarkers, forbiddenMarkers, observedNetworkConnections },
) {
  assert.ok(Array.isArray(events));
  const expectedCommands = Array.isArray(expectedCommand) ? expectedCommand : [expectedCommand];
  assert.ok(expectedCommands.length > 0);
  for (const command of expectedCommands) assertNonEmptyString(command, "expectedCommand");
  assert.ok(Array.isArray(requiredMarkers) && requiredMarkers.length > 0);
  assert.ok(Array.isArray(forbiddenMarkers) && forbiddenMarkers.length > 0);
  const commands = events.filter(
    (event) => event.type === "item.completed" && event.itemType === "command_execution",
  );
  assert.equal(commands.length, 1, "Codex canary must execute exactly one shell probe");
  const [probe] = commands;
  assert.equal(
    expectedCommands.includes(probe.command),
    true,
    "Codex executed a different shell probe",
  );
  assert.equal(probe.status, "completed", "Codex shell probe did not complete");
  assert.equal(probe.exitCode, 0, "Codex shell probe failed");
  const lines = new Set(String(probe.output).split(/\r?\n/).filter(Boolean));
  for (const marker of requiredMarkers) {
    assertNonEmptyString(marker, "required marker");
    assert.equal(lines.has(marker), true, `Codex shell probe omitted ${marker}`);
  }
  for (const marker of forbiddenMarkers) {
    assertNonEmptyString(marker, "forbidden marker");
    assert.equal(
      String(probe.output).includes(marker),
      false,
      `Codex shell probe emitted ${marker}`,
    );
  }
  return classifyNetworkProbeEvidence(probe.output, observedNetworkConnections);
}

export function parseClaudeJsonEvents(stdout) {
  assert.equal(typeof stdout, "string");
  const toolResults = [];
  const toolUses = [];
  const permissionDenials = [];
  const responseModels = [];
  const events = [];
  for (const line of stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      events.push({ type: "unparsed-visible-output" });
      continue;
    }
    if (event.type === "user") {
      for (const block of event.message?.content ?? []) {
        if (block.type === "tool_result") {
          toolResults.push({
            toolUseId: block.tool_use_id,
            content: renderToolResult(block.content),
            isError: block.is_error,
          });
        }
      }
    } else if (event.type === "assistant") {
      if (typeof event.message?.model === "string") responseModels.push(event.message.model);
      const blocks = [];
      for (const block of event.message?.content ?? []) {
        if (block.type === "tool_use") {
          const toolUse = {
            id: block.id ?? null,
            name: block.name ?? null,
            input: block.input ?? null,
          };
          toolUses.push(toolUse);
          blocks.push({ type: block.type, toolUseId: toolUse.id, tool: toolUse.name });
        } else blocks.push({ type: block.type, toolUseId: null, tool: null });
      }
      events.push({ type: event.type, blocks });
    } else if (event.type === "result") {
      permissionDenials.push(...(event.permission_denials ?? []));
      events.push({
        type: event.type,
        subtype: event.subtype ?? null,
        isError: event.is_error ?? null,
        result: event.result ?? "",
      });
    } else if (event.type === "system") {
      events.push({ type: event.type, subtype: event.subtype ?? null });
    }
  }
  return { toolResults, toolUses, permissionDenials, responseModels, events };
}

export function assertClaudeResponseModels(diagnostic, allowedModels) {
  assert.ok(diagnostic && typeof diagnostic === "object");
  assert.ok(Array.isArray(allowedModels) && allowedModels.length > 0);
  for (const model of allowedModels) assertNonEmptyString(model, "allowed Claude response model");
  assert.ok(
    Array.isArray(diagnostic.responseModels) && diagnostic.responseModels.length > 0,
    "Claude response omitted resolved model identity",
  );
  for (const model of diagnostic.responseModels) {
    assert.equal(
      allowedModels.includes(model),
      true,
      `Claude response resolved to an unregistered model: ${model}`,
    );
  }
  return [...new Set(diagnostic.responseModels)];
}

export function assertClaudeDeniedToolUse(diagnostic, expectedToolUse) {
  assert.ok(diagnostic && typeof diagnostic === "object");
  assertNonEmptyString(expectedToolUse.name, "expected Claude tool name");
  assert.ok(expectedToolUse.input && typeof expectedToolUse.input === "object");
  const matchingUses = diagnostic.toolUses.filter(
    (toolUse) =>
      toolUse.name === expectedToolUse.name &&
      isDeepStrictEqual(toolUse.input, expectedToolUse.input),
  );
  assert.equal(
    matchingUses.length,
    1,
    `Claude did not attempt the exact denied ${expectedToolUse.name} input`,
  );
  const [toolUse] = matchingUses;
  const matchingDenials = diagnostic.permissionDenials.filter(
    (denial) =>
      denial &&
      typeof denial === "object" &&
      denial.tool_use_id === toolUse.id &&
      denial.tool_name === toolUse.name &&
      isDeepStrictEqual(denial.tool_input, toolUse.input),
  );
  assert.equal(
    matchingDenials.length,
    1,
    `Claude permission denial was not bound to the exact ${expectedToolUse.name} input`,
  );
  return toolUse;
}

export function assertClaudeSuccessfulToolUse(diagnostic, expectedToolUse, expectedOutput = null) {
  assert.ok(expectedOutput === null || typeof expectedOutput === "string");
  if (expectedOutput !== null) assertNonEmptyString(expectedOutput, "expected Claude tool output");
  const matchingUses = diagnostic.toolUses.filter(
    (toolUse) =>
      toolUse.name === expectedToolUse.name &&
      isDeepStrictEqual(toolUse.input, expectedToolUse.input),
  );
  assert.equal(
    matchingUses.length,
    1,
    `Claude did not call the exact ${expectedToolUse.name} input`,
  );
  const [toolUse] = matchingUses;
  const matchingResults = diagnostic.toolResults.filter(
    (result) =>
      result.toolUseId === toolUse.id &&
      result.isError !== true &&
      (expectedOutput === null || result.content.includes(expectedOutput)),
  );
  assert.equal(
    matchingResults.length,
    1,
    `Claude successful result was not bound to the exact ${expectedToolUse.name} input`,
  );
  return toolUse;
}

function renderStructuredDiagnostic(value) {
  if (value === undefined || value === null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function renderToolResult(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (item && typeof item === "object" && "text" in item ? item.text : ""))
      .join("\n");
  }
  return JSON.stringify(content ?? "");
}

export function redactHarnessDiagnostic(value, sensitivePrefixes = []) {
  assert.ok(Array.isArray(sensitivePrefixes));
  let rendered = String(value);
  for (const prefix of sensitivePrefixes) {
    assert.equal(typeof prefix, "string");
    if (prefix !== "") rendered = rendered.replaceAll(prefix, "<REDACTED_PATH>");
  }
  return rendered
    .replace(/\/Users\/[^\s'"`]+/g, "<REDACTED_PATH>")
    .replace(/\/home\/[^\s'"`]+/g, "<REDACTED_PATH>")
    .replace(/[A-Za-z]:\\Users\\[^\s'"`]+/g, "<REDACTED_PATH>")
    .replace(/\b(?:ghp_|github_pat_|npm_|jmr_|sk-)[A-Za-z0-9_-]{16,}\b/g, "<REDACTED_TOKEN>")
    .replace(/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, "<REDACTED_JWT>")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*\b/gi, "Bearer <REDACTED_TOKEN>")
    .replace(
      /\b((?:[A-Z][A-Z0-9_]*(?:_(?:TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY|ACCESS_KEY|AUTH|AUTHORIZATION|CREDENTIAL|CREDENTIALS)))|(?:DATABASE_URL|REDIS_URL|MONGODB_URI|MONGO_URL|AMQP_URL))=(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s'"`,;]+)/gi,
      "$1=<REDACTED_TOKEN>",
    )
    .replace(
      /"(?:accessToken|refreshToken|apiKey|cookie|authorization|mcpOAuth|claudeAiOauth)"\s*:\s*"[^"]*"/gi,
      '"<REDACTED_AUTH_FIELD>":"<REDACTED>"',
    );
}

export function projectMinimalClaudeOAuth(credentials) {
  assert.ok(credentials && typeof credentials === "object");
  assert.ok(
    credentials.claudeAiOauth && typeof credentials.claudeAiOauth === "object",
    "Claude OAuth credentials are unavailable",
  );
  return { claudeAiOauth: structuredClone(credentials.claudeAiOauth) };
}

export function classifyClaudeAuthenticationFailure(diagnostic) {
  assert.equal(typeof diagnostic, "string");
  if (/organization has disabled Claude subscription access for Claude Code/i.test(diagnostic)) {
    return "subscription-disabled-by-organization";
  }
  if (/use an Anthropic API key instead/i.test(diagnostic)) {
    return "api-key-required";
  }
  return null;
}

export function assertExecutionPredecessors(runs, selectedRunId, states) {
  assert.ok(Array.isArray(runs) && runs.length > 0);
  assert.ok(states && typeof states === "object");
  const index = runs.findIndex((candidate) => candidate.runId === selectedRunId);
  assert.ok(index >= 0, `unknown selected run: ${selectedRunId}`);
  for (const [runIndex, candidate] of runs.entries()) {
    const surfaces = states[candidate.runId] ?? emptyResultSurfaces();
    assert.deepEqual(
      Object.keys(surfaces).sort(),
      ["quarantine", "reviewed"],
      `run ${candidate.runId} result surfaces differ`,
    );
    for (const [surface, state] of Object.entries(surfaces)) {
      assert.deepEqual(
        Object.keys(state).sort(),
        ["blind", "byRun"],
        `run ${candidate.runId} ${surface} shape differs`,
      );
      assert.ok(
        ["absent", "claim-only", "complete", "failure", "conflicting-terminals"].includes(
          state.byRun,
        ),
        `unknown ${surface} by-run state for ${candidate.runId}: ${state.byRun}`,
      );
      assert.ok(
        ["absent", "present"].includes(state.blind),
        `unknown ${surface} blind state for ${candidate.runId}: ${state.blind}`,
      );
    }
    if (runIndex < index) {
      assertTerminalByRun(candidate.runId, "quarantine", surfaces.quarantine.byRun);
      assert.equal(
        surfaces.quarantine.blind,
        "present",
        `earlier run ${candidate.runId} lacks its quarantine blind surface`,
      );
      assertTerminalByRun(candidate.runId, "reviewed", surfaces.reviewed.byRun);
      if (surfaces.reviewed.byRun === "complete") {
        assert.equal(
          surfaces.reviewed.blind,
          "present",
          `earlier completed run ${candidate.runId} lacks its reviewed blind surface`,
        );
      }
      continue;
    }
    assert.deepEqual(
      surfaces,
      emptyResultSurfaces(),
      `${runIndex === index ? "selected" : "later"} run ${candidate.runId} already has result state`,
    );
  }
}

function emptyResultSurfaces() {
  return {
    quarantine: { byRun: "absent", blind: "absent" },
    reviewed: { byRun: "absent", blind: "absent" },
  };
}

function assertTerminalByRun(runId, surface, state) {
  assert.equal(
    state === "complete" || state === "failure",
    true,
    state === "claim-only"
      ? `earlier run ${runId} has a non-terminal ${surface} claim`
      : state === "absent"
        ? `earlier run ${runId} is absent from ${surface}`
        : `earlier run ${runId} has conflicting ${surface} terminal states`,
  );
}

export async function detachGitMetadata(checkout, externalDirectory) {
  assert.equal(path.isAbsolute(checkout), true);
  assert.equal(path.isAbsolute(externalDirectory), true);
  const canonicalCheckout = await realpath(checkout);
  const internalDirectory = path.join(canonicalCheckout, ".git");
  const metadata = await lstat(internalDirectory);
  assert.equal(metadata.isDirectory(), true, "checkout .git must be a directory before detachment");
  assert.equal(metadata.isSymbolicLink(), false, "checkout .git must not be a symbolic link");
  await assertPathAbsent(externalDirectory, "external Git metadata destination already exists");
  await rename(internalDirectory, externalDirectory);
  await assertPathAbsent(internalDirectory, "checkout Git metadata remained after detachment");
  return {
    directory: await realpath(externalDirectory),
    workTree: canonicalCheckout,
  };
}

export function buildLocalExactCommitFetchArguments(source, commit, reference) {
  assert.equal(path.isAbsolute(source), true, "fixture source must be absolute");
  assert.match(commit, /^[0-9a-f]{40}$/, "fixture commit must be a full SHA-1");
  assert.match(reference, /^refs\/[a-z0-9][a-z0-9./-]+$/, "fixture reference is invalid");
  return [
    "-c",
    "protocol.file.allow=always",
    "fetch",
    "--quiet",
    "--depth=1",
    "--no-tags",
    "--no-write-fetch-head",
    pathToFileURL(source).href,
    `${commit}:${reference}`,
  ];
}

function assertNonEmptyString(value, label) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  assert.ok(value.length > 0, `${label} must not be empty`);
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

async function assertPathAbsent(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

function validateVerificationScratch(scratch) {
  assert.ok(scratch && typeof scratch === "object");
  const expected = buildVerificationScratch(scratch.root);
  assert.deepEqual(scratch, expected, "verification scratch paths must use the fixed layout");
  assert.notEqual(scratch.npmUserConfig, scratch.npmGlobalConfig);
}

function buildLeastPrivilegeSeatbeltProfile({
  checkout,
  verificationDirectory,
  receiptPath,
  scratchRoot,
  runtimeReadPaths,
}) {
  assert.ok(Array.isArray(runtimeReadPaths) && runtimeReadPaths.length > 0);
  for (const runtimePath of runtimeReadPaths) assert.equal(path.isAbsolute(runtimePath), true);
  assert.equal(pathsOverlap(verificationDirectory, checkout), false);
  assert.equal(pathsOverlap(verificationDirectory, scratchRoot), false);
  assert.equal(path.dirname(receiptPath), verificationDirectory);
  for (const runtimePath of runtimeReadPaths)
    assert.equal(pathsOverlap(runtimePath, verificationDirectory), false);
  const readRules = [checkout, scratchRoot, ...runtimeReadPaths]
    .map(
      (allowedPath) =>
        `(literal ${JSON.stringify(allowedPath)})\n  (subpath ${JSON.stringify(allowedPath)})`,
    )
    .join("\n  ");
  const runtimeAncestors = new Set();
  for (const runtimePath of [checkout, scratchRoot, ...runtimeReadPaths]) {
    let parent = path.dirname(runtimePath);
    while (parent !== path.dirname(parent)) {
      runtimeAncestors.add(parent);
      parent = path.dirname(parent);
    }
  }
  const metadataRules = [...runtimeAncestors]
    .sort()
    .map((allowedPath) => `(literal ${JSON.stringify(allowedPath)})`)
    .join("\n  ");
  const directoryDataRules = [...runtimeAncestors]
    .filter((allowedPath) => !allowedPath.startsWith("/Users/"))
    .sort()
    .map((allowedPath) => `(literal ${JSON.stringify(allowedPath)})`)
    .join("\n  ");
  return `(version 1)
(deny default)
(allow process*)
(allow sysctl-read
  (sysctl-name "hw.machine")
  (sysctl-name "hw.memsize")
  (sysctl-name "hw.pagesize_compat")
  (sysctl-name "kern.hostname")
  (sysctl-name "kern.osproductversion")
  (sysctl-name "kern.osrelease")
  (sysctl-name "kern.ostype")
  (sysctl-name "kern.version"))
(allow file-read-data
  (literal "/")
  ${directoryDataRules})
(allow file-read-metadata
  (literal "/")
  ${metadataRules})
(allow file-read*
  ${readRules})
(allow file-write*
  (literal "/dev/null")
  (subpath ${JSON.stringify(checkout)})
  (subpath ${JSON.stringify(scratchRoot)}))
(deny network*)
`;
}

function pathsOverlap(left, right) {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(`${normalizedRight}${path.sep}`) ||
    normalizedRight.startsWith(`${normalizedLeft}${path.sep}`)
  );
}
