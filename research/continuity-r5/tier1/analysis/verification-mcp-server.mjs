import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";

const expectedRegistrySha256 = "__CARRYLOG_VERIFICATION_REGISTRY_SHA256_PLACEHOLDER__";
assert.deepEqual(process.argv.slice(2), [], "verification MCP accepts no path or mode arguments");
const selfDirectory = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const wrapper = path.join(selfDirectory, "run-check.mjs");
const registryPath = path.join(selfDirectory, "commands.json");
const registryBytes = readFileSync(registryPath);
assert.equal(createHash("sha256").update(registryBytes).digest("hex"), expectedRegistrySha256);
const registry = JSON.parse(registryBytes.toString("utf8"));
assert.equal(registry.formatVersion, 1, "unsupported verification registry format");
assert.deepEqual(Object.keys(registry.programs).sort(), [
  "hostGitPolicySha256",
  "processSupervisorSha256",
  "verificationReceiptProtocolSha256",
]);
const supervisorPath = path.join(selfDirectory, "process-supervisor.mjs");
const supervisorStatus = lstatSync(supervisorPath);
assert.equal(supervisorStatus.isSymbolicLink(), false);
assert.equal(supervisorStatus.isFile(), true);
assert.equal(realpathSync(supervisorPath), supervisorPath);
assert.equal(
  digest(readFileSync(supervisorPath)),
  registry.programs.processSupervisorSha256,
  "process supervisor binding differs",
);
const { superviseProcess, PROCESS_STATES } = await import(pathToFileURL(supervisorPath).href);
const receiptProtocolPath = path.join(selfDirectory, "verification-receipt-protocol.mjs");
const receiptProtocolStatus = lstatSync(receiptProtocolPath);
assert.equal(receiptProtocolStatus.isSymbolicLink(), false);
assert.equal(receiptProtocolStatus.isFile(), true);
assert.equal(realpathSync(receiptProtocolPath), receiptProtocolPath);
assert.equal(
  digest(readFileSync(receiptProtocolPath)),
  registry.programs.verificationReceiptProtocolSha256,
  "verification receipt protocol binding differs",
);
const {
  appendVerificationRecord,
  createVerificationBrokerId,
  createVerificationBrokerRecord,
  createVerificationInvocationId,
  createVerificationStartRecord,
  parseVerificationInvocationStream,
} = await import(pathToFileURL(receiptProtocolPath).href);
const executionModes = {
  codex: "seatbelt-broker-isolated",
  claude: "seatbelt-workspace-isolated",
};
assert.ok(Object.hasOwn(executionModes, registry.harness), "unknown verification harness");
assert.equal(realpathSync(registry.verificationDirectory), selfDirectory);
assert.equal(
  registry.execution?.mode,
  executionModes[registry.harness],
  "verification MCP execution mode differs from its harness",
);
const brokerId = createVerificationBrokerId();
appendVerificationRecord(
  registry.receiptPath,
  createVerificationBrokerRecord({
    recordType: "broker-start",
    brokerId,
    registrySha256: expectedRegistrySha256,
    executionMode: registry.execution.mode,
  }),
);
const tools = new Map(
  registry.commands.map((command) => [
    `verify_${command.id.replaceAll("-", "_")}`,
    {
      commandId: command.id,
      definition: {
        name: `verify_${command.id.replaceAll("-", "_")}`,
        description: `Run the frozen local verification command ${command.id}. No arguments are accepted.`,
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
    },
  ]),
);
const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});
let requestQueue = Promise.resolve();
let brokerSettlement;
input.on("line", (line) => {
  if (line.trim() === "") return;
  const message = JSON.parse(line);
  requestQueue = requestQueue
    .then(() => handle(message))
    .catch((error) => {
      if (message.id !== undefined)
        fail(message.id, -32603, error instanceof Error ? error.message : String(error));
    });
});
input.once("close", () => {
  settleBroker().catch(() => {
    process.exitCode = 1;
  });
});
for (const signal of ["SIGTERM", "SIGHUP", "SIGINT"]) {
  process.once(signal, () => {
    input.close();
    settleBroker().then(
      () => process.exit(0),
      () => process.exit(1),
    );
  });
}

function settleBroker() {
  brokerSettlement ??= requestQueue.then(() => {
    appendVerificationRecord(
      registry.receiptPath,
      createVerificationBrokerRecord({
        recordType: "broker-terminal",
        brokerId,
        registrySha256: expectedRegistrySha256,
        executionMode: registry.execution.mode,
      }),
    );
  });
  return brokerSettlement;
}

async function handle(message) {
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "carrylog-tier1-verification", version: "3" },
    });
    return;
  }
  if (message.method === "tools/list") {
    respond(message.id, {
      tools: [...tools.values()].map((entry) => entry.definition),
    });
    return;
  }
  if (message.method === "tools/call") {
    const tool = tools.get(message.params?.name);
    if (!tool || Object.keys(message.params?.arguments ?? {}).length !== 0) {
      fail(message.id, -32602, "Unknown verification tool or unexpected arguments");
      return;
    }
    const before = readFileSync(registry.receiptPath);
    const command = registry.commands.find((candidate) => candidate.id === tool.commandId);
    assert.ok(command);
    const invocationId = createVerificationInvocationId();
    const startRecord = createVerificationStartRecord({
      invocationId,
      commandId: tool.commandId,
      registrySha256: expectedRegistrySha256,
      commandSha256: command.commandSha256,
      executionMode: registry.execution.mode,
      origin: "mcp-broker",
      brokerId,
    });
    const afterStart = appendVerificationRecord(registry.receiptPath, startRecord);
    assert.equal(afterStart.subarray(0, before.length).equals(before), true);
    const result = await superviseProcess({
      executable: process.execPath,
      arguments: [wrapper, tool.commandId, invocationId],
      cwd: registry.checkout,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        NO_COLOR: "1",
        CI: "1",
      },
      timeoutMs: command.timeoutMs + 5_000,
      maxOutputBytes: registry.limits.wrapperOutputBytes,
    });
    const after = readFileSync(registry.receiptPath);
    assert.equal(
      after.subarray(0, afterStart.length).equals(afterStart),
      true,
      "receipt history changed after invocation start",
    );
    const stream = parseVerificationInvocationStream(after.toString("utf8"));
    assert.equal(stream.unsettledStarts.length, 0, "verification invocation did not settle");
    const receipt = stream.terminalReceipts.find(
      (candidate) => candidate.invocationId === invocationId,
    );
    assert.ok(receipt, "verification terminal receipt is missing");
    assert.equal(receipt.formatVersion, 5);
    assert.equal(receipt.recordType, "terminal");
    assert.equal(receipt.commandId, tool.commandId);
    assert.equal(receipt.registrySha256, expectedRegistrySha256);
    assert.equal(receipt.commandSha256, command.commandSha256);
    assert.equal(receipt.executionMode, registry.execution.mode);
    assert.equal(receipt.preCommandStateSha256, digestCanonicalJson(receipt.preCommandState));
    assert.equal(result.state, PROCESS_STATES.completed, "verification wrapper did not settle");
    assert.ok(Object.values(PROCESS_STATES).includes(receipt.processState));
    assert.equal(
      result.exitCode,
      receipt.processState === PROCESS_STATES.completed ? (receipt.exitStatus ?? 1) : 1,
      "wrapper exit does not represent its child receipt",
    );
    assert.equal(receipt.stdoutRetainedBytes, result.output.stdout.receivedBytes);
    assert.equal(receipt.stderrRetainedBytes, result.output.stderr.receivedBytes);
    assert.equal(receipt.stdoutRetainedSha256, result.output.stdout.sha256);
    assert.equal(receipt.stderrRetainedSha256, result.output.stderr.sha256);
    const output = Buffer.concat([
      result.output.stdout.buffer,
      result.output.stderr.buffer,
    ]).toString("utf8");
    respond(message.id, {
      content: [
        {
          type: "text",
          text: output === "" ? `(exit ${receipt.exitStatus ?? 1})` : output,
        },
      ],
      isError: receipt.processState !== PROCESS_STATES.completed || receipt.exitStatus !== 0,
    });
    return;
  }
  if (message.id !== undefined) fail(message.id, -32601, "Method not found");
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

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, result })}\n`);
}

function fail(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } })}\n`);
}
