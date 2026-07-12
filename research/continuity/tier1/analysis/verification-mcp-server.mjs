import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const expectedRegistrySha256 = "__CARRYLOG_VERIFICATION_REGISTRY_SHA256_PLACEHOLDER__";
assert.deepEqual(process.argv.slice(2), [], "verification MCP accepts no path or mode arguments");
const selfDirectory = realpathSync(path.dirname(fileURLToPath(import.meta.url)));
const wrapper = path.join(selfDirectory, "run-check.mjs");
const registryPath = path.join(selfDirectory, "commands.json");
const registryBytes = readFileSync(registryPath);
assert.equal(createHash("sha256").update(registryBytes).digest("hex"), expectedRegistrySha256);
const registry = JSON.parse(registryBytes.toString("utf8"));
assert.equal(registry.formatVersion, 1, "unsupported verification registry format");
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

async function handle(message) {
  if (message.method === "notifications/initialized") return;
  if (message.method === "initialize") {
    respond(message.id, {
      protocolVersion: message.params?.protocolVersion ?? "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: "carrylog-tier1-verification", version: "2" },
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
    const result = spawnSync(process.execPath, [wrapper, tool.commandId], {
      cwd: registry.checkout,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        LANG: "C.UTF-8",
        LC_ALL: "C.UTF-8",
        NO_COLOR: "1",
        CI: "1",
      },
      encoding: "utf8",
      timeout: 310_000,
      maxBuffer: 12 * 1024 * 1024,
      shell: false,
    });
    const after = readFileSync(registry.receiptPath);
    assert.equal(after.subarray(0, before.length).equals(before), true, "receipt history changed");
    const appended = after.subarray(before.length).toString("utf8");
    assert.match(appended, /^\{[^\r\n]+\}\n$/);
    const receipt = JSON.parse(appended);
    assert.equal(receipt.formatVersion, 2);
    assert.equal(receipt.commandId, tool.commandId);
    assert.equal(receipt.registrySha256, expectedRegistrySha256);
    const command = registry.commands.find((candidate) => candidate.id === tool.commandId);
    assert.ok(command);
    assert.equal(receipt.commandSha256, command.commandSha256);
    assert.equal(receipt.executionMode, registry.execution.mode);
    assert.equal(receipt.preCommandStateSha256, digestCanonicalJson(receipt.preCommandState));
    assert.equal(receipt.exitStatus, result.status);
    assert.equal(receipt.signal, result.signal);
    assert.equal(receipt.timedOut, result.error?.code === "ETIMEDOUT");
    assert.equal(receipt.spawnError, result.error?.code ?? null);
    assert.equal(receipt.stdoutBytes, Buffer.byteLength(result.stdout ?? ""));
    assert.equal(receipt.stderrBytes, Buffer.byteLength(result.stderr ?? ""));
    assert.equal(receipt.stdoutSha256, digest(result.stdout ?? ""));
    assert.equal(receipt.stderrSha256, digest(result.stderr ?? ""));
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    respond(message.id, {
      content: [
        {
          type: "text",
          text: output === "" ? `(exit ${result.status ?? 1})` : output,
        },
      ],
      isError: result.status !== 0 || result.error !== undefined,
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
