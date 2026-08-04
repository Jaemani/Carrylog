import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { processStatus } from "./harness-contract.mjs";

export function filterCodexHarnessResult(result) {
  const visibleEvents = [];
  const commandRecords = [];
  const commandRecordsById = new Map();
  let finalResponse = "";
  let usage = null;
  let completedEventObserved = false;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      visibleEvents.push(projectOpaqueVisibleOutput("unparsed-visible-output", line));
      continue;
    }
    const lifecycle = codexCommandLifecycle(event.type);
    if (lifecycle !== null && event.item?.type === "command_execution") {
      const projected = projectCodexCommandExecution(event.item, lifecycle);
      if (typeof event.item.id === "string" && event.item.id !== "") {
        const existing = commandRecordsById.get(event.item.id);
        commandRecordsById.set(event.item.id, mergeCodexCommandRecord(existing, projected));
      } else {
        commandRecords.push(projected);
      }
    } else if (event.type === "item.completed" && event.item?.type === "agent_message") {
      finalResponse = event.item.text ?? finalResponse;
      visibleEvents.push({ type: "agent_message", text: event.item.text ?? "" });
    } else if (event.type === "turn.completed") {
      usage = event.usage ?? null;
      completedEventObserved = true;
    } else if (event.type === "error" || event.type === "turn.failed") {
      visibleEvents.push(
        projectOpaqueVisibleOutput(
          event.type,
          event.message ?? event.error?.message ?? "",
          "message",
        ),
      );
    }
  }
  commandRecords.push(...commandRecordsById.values());
  if (result.stderr.trim() !== "") {
    visibleEvents.push(projectOpaqueVisibleOutput("stderr", result.stderr));
  }
  return {
    finalResponse,
    visibleEvents,
    commandRecords,
    usage,
    estimatedCostUsd: null,
    exitStatus: result.exitCode,
    process: processStatus(result),
    completedEventObserved,
  };
}

export function filterClaudeHarnessResult(result) {
  const parsedEvents = [];
  const visibleEvents = [];
  const commandRecords = [];
  let finalResponse = "";
  let usage = null;
  let estimatedCostUsd = null;
  let completedEventObserved = false;
  const responseModels = [];
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    try {
      parsedEvents.push(JSON.parse(line));
    } catch {
      visibleEvents.push(projectOpaqueVisibleOutput("unparsed-visible-output", line));
    }
  }
  const bashToolUseIds = new Set();
  for (const event of parsedEvents) {
    if (event.type !== "assistant") continue;
    for (const block of event.message?.content ?? []) {
      if (block.type === "tool_use" && block.name === "Bash") {
        if (typeof block.id === "string" && block.id !== "") bashToolUseIds.add(block.id);
        commandRecords.push(projectClaudeBashToolUse(block.input));
      }
    }
  }
  const bashDeviationObserved = commandRecords.length > 0;
  for (const event of parsedEvents) {
    if (event.type === "assistant") {
      if (typeof event.message?.model === "string") responseModels.push(event.message.model);
      for (const block of event.message?.content ?? []) {
        if (block.type === "text") {
          finalResponse = block.text;
          visibleEvents.push({ type: "agent_message", text: block.text });
        } else if (block.type === "tool_use" && block.name !== "Bash") {
          visibleEvents.push({ type: "tool_use", tool: block.name, input: block.input });
        }
      }
    } else if (event.type === "user") {
      for (const block of event.message?.content ?? []) {
        if (block.type !== "tool_result") continue;
        if (bashDeviationObserved) {
          visibleEvents.push(
            projectClaudeBashToolResult(
              block,
              typeof block.tool_use_id === "string" && bashToolUseIds.has(block.tool_use_id),
            ),
          );
        } else {
          visibleEvents.push({
            type: "tool_result",
            content: block.content,
            isError: block.is_error,
          });
        }
      }
    } else if (event.type === "result") {
      finalResponse = event.result ?? finalResponse;
      usage = event.usage ?? null;
      estimatedCostUsd = event.total_cost_usd ?? null;
      completedEventObserved = event.subtype === "success" && event.is_error !== true;
    }
  }
  if (result.stderr.trim() !== "") {
    visibleEvents.push(projectOpaqueVisibleOutput("stderr", result.stderr));
  }
  return {
    finalResponse,
    visibleEvents,
    commandRecords,
    usage,
    estimatedCostUsd,
    exitStatus: result.exitCode,
    process: processStatus(result),
    completedEventObserved,
    responseModels,
  };
}

export function classifyHarnessResultFailure(harness, processResult, filtered) {
  try {
    assertRegisteredVerificationOnly(filtered.commandRecords, []);
  } catch (error) {
    return {
      stage:
        error && typeof error === "object" && error.stage === "protocol"
          ? "protocol"
          : "harness-execution",
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const failures = [];
  if (processResult.timedOut) failures.push("timeout");
  if (processResult.spawnError !== null) failures.push(`spawn:${processResult.spawnError}`);
  if (processResult.exitCode !== 0) failures.push(`exit:${processResult.exitCode}`);
  if (!filtered.completedEventObserved) failures.push("missing-success-event");
  if (filtered.finalResponse.trim() === "") failures.push("missing-final-response");
  return failures.length === 0
    ? null
    : {
        stage: "harness-execution",
        message: `${harness} harness failure ${failures.join(",")}`,
      };
}

export async function captureWorkspaceDelta({
  gitState,
  baselineCommit,
  captureRoot,
  environment,
  runCommand,
  assumeUnchangedPaths = [],
}) {
  assert.ok(gitState && typeof gitState === "object");
  assert.equal(path.isAbsolute(gitState.directory), true);
  assert.equal(path.isAbsolute(gitState.workTree), true);
  assert.match(baselineCommit, /^[0-9a-f]{40}$/);
  assert.equal(path.isAbsolute(captureRoot), true);
  assert.equal(typeof runCommand, "function");
  assert.ok(Array.isArray(assumeUnchangedPaths));
  for (const relativePath of assumeUnchangedPaths) {
    assert.equal(typeof relativePath, "string");
    assert.equal(
      relativePath !== "" &&
        !path.isAbsolute(relativePath) &&
        relativePath !== ".." &&
        !relativePath.startsWith(`..${path.sep}`),
      true,
      "assume-unchanged path must stay inside the worktree",
    );
  }
  const captureRelative = path.relative(gitState.workTree, captureRoot);
  assert.equal(
    captureRelative === ".." || captureRelative.startsWith(`..${path.sep}`),
    true,
    "delta capture state must remain outside the model worktree",
  );
  const repositoryEnvironment = {
    ...environment,
    GIT_DIR: gitState.directory,
    GIT_WORK_TREE: gitState.workTree,
    GIT_OPTIONAL_LOCKS: "0",
  };
  if (assumeUnchangedPaths.length > 0) {
    assertSuccessfulProcess(
      await runCommand(
        "git",
        ["update-index", "--no-assume-unchanged", "--", ...assumeUnchangedPaths],
        { cwd: gitState.workTree, env: repositoryEnvironment },
      ),
      "clearing assume-unchanged paths",
    );
  }

  await mkdir(captureRoot, { mode: 0o700 });
  const indexPath = path.join(captureRoot, "baseline.index");
  const captureEnvironment = {
    ...repositoryEnvironment,
    GIT_INDEX_FILE: indexPath,
  };
  try {
    assertSuccessfulProcess(
      await runCommand("git", ["read-tree", "--reset", baselineCommit], {
        cwd: gitState.workTree,
        env: captureEnvironment,
      }),
      "materializing baseline capture index",
    );
    const tracked = await runCommand("git", ["diff-files", "--binary", "--no-ext-diff", "--"], {
      cwd: gitState.workTree,
      env: captureEnvironment,
      maxBuffer: 20 * 1024 * 1024,
    });
    assertSuccessfulProcess(tracked, "capturing tracked workspace delta");
    const untracked = await runCommand(
      "git",
      ["ls-files", "-z", "--others", "--exclude-standard"],
      {
        cwd: gitState.workTree,
        env: captureEnvironment,
      },
    );
    assertSuccessfulProcess(untracked, "enumerating untracked workspace paths");
    const untrackedPaths = untracked.stdout === "" ? [] : untracked.stdout.split("\0").slice(0, -1);
    let patch = tracked.stdout;
    for (const relativePath of untrackedPaths) {
      const filePath = path.join(gitState.workTree, relativePath);
      const metadata = await lstat(filePath);
      if (metadata.isSymbolicLink()) {
        patch += `\nUntracked symbolic link omitted from diff: ${relativePath}\n`;
        continue;
      }
      if (!metadata.isFile() || metadata.size > 1024 * 1024) {
        patch += `\nUntracked file omitted from diff: ${relativePath} (${metadata.size} bytes)\n`;
        continue;
      }
      const addition = await runCommand(
        "git",
        ["diff", "--no-index", "--binary", "--", "/dev/null", filePath],
        {
          cwd: gitState.workTree,
          env: environment,
          allowExit: true,
          maxBuffer: 2 * 1024 * 1024,
        },
      );
      assertNoIndexDiffResult(addition, relativePath, metadata.size);
      patch += addition.stdout;
    }
    return { patch, untrackedPaths };
  } finally {
    await rm(captureRoot, { recursive: true, force: true });
  }
}

export function projectCodexCommandExecution(item, lifecycle = "completed") {
  const command = typeof item?.command === "string" ? item.command : "";
  const output = typeof item?.aggregated_output === "string" ? item.aggregated_output : "";
  return {
    formatVersion: 1,
    source: "codex-command-execution",
    commandBytes: Buffer.byteLength(command),
    commandSha256: sha256(command),
    outputBytes: Buffer.byteLength(output),
    outputSha256: sha256(output),
    exitCode: Number.isInteger(item?.exit_code) ? item.exit_code : null,
    status: normalizeCommandStatus(item?.status),
    lifecycle,
    lifecycleEvents: 1,
    payloadDrift: false,
  };
}

export function projectClaudeBashToolUse(input) {
  const rendered = JSON.stringify(input ?? null);
  return {
    formatVersion: 1,
    source: "claude-bash-tool-use",
    inputBytes: Buffer.byteLength(rendered),
    inputSha256: sha256(rendered),
    exitCode: null,
    status: "requested",
  };
}

export function projectClaudeBashToolResult(block, correlated) {
  const rendered = renderToolResultContent(block?.content);
  return {
    type: "bash_tool_result_digest",
    correlated,
    contentBytes: Buffer.byteLength(rendered),
    contentSha256: sha256(rendered),
    isError: block?.is_error === true,
  };
}

export function assertRegisteredVerificationOnly(commandRecords, verificationReceipts) {
  assert.ok(Array.isArray(commandRecords), "direct command records must be an array");
  assert.ok(Array.isArray(verificationReceipts), "verification receipts must be an array");
  if (commandRecords.length > 0) {
    const error = new Error(
      `protocol deviation: observed ${commandRecords.length} direct shell execution event(s); only registered verification wrapper receipts are permitted`,
    );
    error.stage = "protocol";
    throw error;
  }
  for (const receipt of verificationReceipts) {
    const termination = receipt?.termination;
    if (
      termination?.completionForced === true ||
      (typeof termination?.signalFailure === "string" && termination.signalFailure !== "")
    ) {
      const commandId =
        typeof receipt?.commandId === "string" && receipt.commandId !== ""
          ? receipt.commandId
          : "unknown";
      const error = new Error(
        `protocol deviation: verification containment failed for ${commandId}; escaped process activity may remain`,
      );
      error.stage = "protocol";
      throw error;
    }
  }
  return { directCommandExecutions: 0, verifiedWrapperReceipts: verificationReceipts.length };
}

export function monitorVerificationContainment({
  receiptPath,
  controller,
  parseReceiptStream,
  intervalMs = 25,
}) {
  assert.equal(path.isAbsolute(receiptPath), true, "receipt path must be absolute");
  assert.ok(controller && typeof controller.abort === "function");
  assert.equal(typeof parseReceiptStream, "function");
  assert.ok(Number.isSafeInteger(intervalMs) && intervalMs > 0);
  let stopped = false;
  let timer = null;
  let inFlight = Promise.resolve();
  let failure = null;
  let observed = "";

  const scan = async (final = false) => {
    if (failure !== null) return;
    let rendered;
    try {
      rendered = await readFile(receiptPath, "utf8");
    } catch (error) {
      failure = createProtocolContainmentError(
        error && typeof error === "object" && error.code === "ENOENT"
          ? "verification receipt stream disappeared"
          : "verification receipt stream became unreadable",
      );
      controller.abort();
      return;
    }
    if (!rendered.startsWith(observed)) {
      failure = createProtocolContainmentError("verification receipt stream is not append-only");
      controller.abort();
      return;
    }
    observed = rendered;
    if (rendered === "") return;
    if (!rendered.endsWith("\n") && !final) return;
    try {
      const stream = parseReceiptStream(rendered);
      assert.ok(Array.isArray(stream.terminalReceipts));
      assert.ok(Array.isArray(stream.unsettledStarts));
      assert.ok(Array.isArray(stream.unsettledBrokers));
      assertRegisteredVerificationOnly([], stream.terminalReceipts);
      if (final && stream.unsettledStarts.length > 0) {
        const commandId = stream.unsettledStarts[0]?.commandId ?? "unknown";
        throw createProtocolContainmentError(
          `verification invocation did not settle for ${commandId}`,
        );
      }
      if (final && stream.unsettledBrokers.length > 0) {
        throw createProtocolContainmentError("verification MCP broker did not settle");
      }
    } catch (error) {
      failure =
        error && typeof error === "object" && error.stage === "protocol"
          ? error
          : createProtocolContainmentError("verification receipt stream is invalid");
      controller.abort();
    }
  };
  const schedule = () => {
    if (stopped || failure !== null) return;
    timer = setTimeout(() => {
      inFlight = scan().finally(schedule);
    }, intervalMs);
  };
  schedule();
  return {
    async stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      await inFlight;
      await scan(true);
      return failure;
    },
  };
}

export function createProtocolContainmentError(message) {
  const error = new Error(`protocol deviation: ${message}`);
  error.stage = "protocol";
  return error;
}

export function assertNoIndexDiffResult(result, relativePath, fileSize) {
  assert.ok(result && typeof result === "object", "untracked diff returned no process result");
  assert.match(relativePath, /\S/, "untracked diff path must not be empty");
  assert.ok(Number.isSafeInteger(fileSize) && fileSize >= 0, "untracked file size is invalid");
  assert.equal(result.signal, null, `untracked diff was signaled: ${relativePath}`);
  assert.equal(result.timedOut, false, `untracked diff timed out: ${relativePath}`);
  assert.equal(result.spawnError, null, `untracked diff failed to spawn: ${relativePath}`);
  assert.equal(result.stderr, "", `untracked diff emitted an error diagnostic: ${relativePath}`);
  assert.equal(
    result.exitCode,
    fileSize === 0 ? 0 : 1,
    `untracked diff returned an unexpected exit code: ${relativePath}`,
  );
}

export function blindReceiptProjection(receipt) {
  return {
    formatVersion: receipt.formatVersion,
    commandId: receipt.commandId,
    preCommandStateSha256: receipt.preCommandStateSha256,
    processState: receipt.processState,
    exitStatus: receipt.exitStatus,
    signal: receipt.signal,
    timedOut: receipt.timedOut,
    outputLimited: receipt.outputLimited,
    spawnError: receipt.spawnError,
    termination: receipt.termination,
    stdoutBytes: receipt.stdoutBytes,
    stderrBytes: receipt.stderrBytes,
    stdoutRetainedBytes: receipt.stdoutRetainedBytes,
    stderrRetainedBytes: receipt.stderrRetainedBytes,
    stdoutSha256: receipt.stdoutSha256,
    stderrSha256: receipt.stderrSha256,
    stdoutRetainedSha256: receipt.stdoutRetainedSha256,
    stderrRetainedSha256: receipt.stderrRetainedSha256,
  };
}

export function parseTapSummary(stdout, outputLimited) {
  if (outputLimited || !Buffer.isBuffer(stdout)) return null;
  const values = {};
  for (const line of stdout.toString("utf8").split(/\r?\n/)) {
    const match = line.match(/^# (tests|pass|fail|cancelled|skipped|todo) (\d+)$/);
    if (match !== null) values[match[1]] = Number(match[2]);
  }
  return ["tests", "pass", "fail"].every((name) => Number.isSafeInteger(values[name]))
    ? values
    : null;
}

function assertSuccessfulProcess(result, label) {
  assert.ok(result && typeof result === "object", `${label} returned no process result`);
  assert.equal(result.exitCode, 0, `${label} exited nonzero`);
  assert.equal(result.signal, null, `${label} was signaled`);
  assert.equal(result.timedOut, false, `${label} timed out`);
  assert.equal(result.spawnError, null, `${label} failed to spawn`);
  assert.equal(result.stderr, "", `${label} emitted an error diagnostic`);
}

function normalizeCommandStatus(status) {
  return ["completed", "failed", "in_progress"].includes(status) ? status : "unknown";
}

function codexCommandLifecycle(type) {
  if (type === "item.started") return "started";
  if (type === "item.updated") return "updated";
  if (type === "item.completed") return "completed";
  return null;
}

function mergeCodexCommandRecord(existing, next) {
  if (existing === undefined) return next;
  const preferNext = lifecycleRank(next.lifecycle) >= lifecycleRank(existing.lifecycle);
  const preferred = preferNext ? next : existing;
  const fallback = preferNext ? existing : next;
  return {
    ...preferred,
    commandBytes: preferred.commandBytes === 0 ? fallback.commandBytes : preferred.commandBytes,
    commandSha256: preferred.commandBytes === 0 ? fallback.commandSha256 : preferred.commandSha256,
    outputBytes: preferred.outputBytes === 0 ? fallback.outputBytes : preferred.outputBytes,
    outputSha256: preferred.outputBytes === 0 ? fallback.outputSha256 : preferred.outputSha256,
    lifecycleEvents: existing.lifecycleEvents + next.lifecycleEvents,
    payloadDrift:
      existing.payloadDrift ||
      next.payloadDrift ||
      (existing.commandBytes > 0 &&
        next.commandBytes > 0 &&
        existing.commandSha256 !== next.commandSha256),
  };
}

function lifecycleRank(lifecycle) {
  return { started: 1, updated: 2, completed: 3 }[lifecycle] ?? 0;
}

function renderToolResultContent(content) {
  if (typeof content === "string") return content;
  const rendered = JSON.stringify(content ?? null);
  return rendered === undefined ? "null" : rendered;
}

function projectOpaqueVisibleOutput(type, value, field = "content") {
  const rendered = typeof value === "string" ? value : "";
  return {
    type,
    [`${field}Bytes`]: Buffer.byteLength(rendered),
    [`${field}Sha256`]: sha256(rendered),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
