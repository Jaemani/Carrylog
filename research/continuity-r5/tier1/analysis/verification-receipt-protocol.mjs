import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";

export const VERIFICATION_RECEIPT_FORMAT_VERSION = 5;

export function createVerificationInvocationId() {
  return randomBytes(16).toString("hex");
}

export function createVerificationBrokerId() {
  return randomBytes(16).toString("hex");
}

export function createVerificationStartRecord({
  invocationId,
  commandId,
  registrySha256,
  commandSha256,
  executionMode,
  origin,
  brokerId,
}) {
  const record = {
    formatVersion: VERIFICATION_RECEIPT_FORMAT_VERSION,
    recordType: "start",
    invocationId,
    commandId,
    registrySha256,
    commandSha256,
    executionMode,
    origin,
    brokerId,
  };
  assertInvocationIdentity(record);
  assert.deepEqual(Object.keys(record).sort(), invocationStartKeys);
  return record;
}

export function createVerificationBrokerRecord({
  recordType,
  brokerId,
  registrySha256,
  executionMode,
}) {
  const record = {
    formatVersion: VERIFICATION_RECEIPT_FORMAT_VERSION,
    recordType,
    brokerId,
    registrySha256,
    executionMode,
  };
  assertBrokerIdentity(record);
  assert.deepEqual(Object.keys(record).sort(), brokerRecordKeys);
  return record;
}

export function appendVerificationRecord(receiptPath, record) {
  assert.equal(typeof receiptPath, "string");
  assertVerificationRecord(record);
  const before = readFileSync(receiptPath);
  const beforeState = parseVerificationInvocationStream(before.toString("utf8"));
  assert.equal(beforeState.seal, null, "verification receipt stream is sealed");
  if (record.recordType === "seal") {
    assert.equal(beforeState.unsettledStarts.length, 0, "cannot seal an active invocation");
    assert.equal(beforeState.unsettledBrokers.length, 0, "cannot seal an active broker");
    assert.equal(record.priorBytes, before.length, "verification seal byte count differs");
    assert.equal(record.priorSha256, digest(before), "verification seal digest differs");
    assert.equal(record.priorRecords, beforeState.records.length);
  }
  const line = Buffer.from(`${JSON.stringify(record)}\n`, "utf8");
  appendFileSync(receiptPath, line, { mode: 0o600 });
  const after = readFileSync(receiptPath);
  assert.equal(
    after.length,
    before.length + line.length,
    "verification receipt append raced with another writer",
  );
  assert.equal(
    after.subarray(0, before.length).equals(before),
    true,
    "verification receipt append changed prior history",
  );
  assert.equal(
    after.subarray(before.length).equals(line),
    true,
    "verification receipt append differs from the bound record",
  );
  parseVerificationInvocationStream(after.toString("utf8"));
  return after;
}

export function sealVerificationReceiptStream(receiptPath, { registrySha256, executionMode }) {
  const before = readFileSync(receiptPath);
  const state = parseVerificationInvocationStream(before.toString("utf8"));
  assert.equal(state.seal, null, "verification receipt stream is already sealed");
  const seal = {
    formatVersion: VERIFICATION_RECEIPT_FORMAT_VERSION,
    recordType: "seal",
    registrySha256,
    executionMode,
    priorRecords: state.records.length,
    priorBytes: before.length,
    priorSha256: digest(before),
  };
  appendVerificationRecord(receiptPath, seal);
  return seal;
}

export function parseVerificationInvocationStream(rendered) {
  assert.equal(typeof rendered, "string", "verification receipt stream must be text");
  if (rendered === "") {
    return {
      records: [],
      terminalReceipts: [],
      unsettledStarts: [],
      unsettledBrokers: [],
      seal: null,
    };
  }
  assert.equal(rendered.endsWith("\n"), true, "verification receipt stream is partial");
  const lines = rendered.slice(0, -1).split("\n");
  assert.equal(
    lines.every((line) => line !== "" && !line.endsWith("\r")),
    true,
  );
  const records = lines.map((line) => JSON.parse(line));
  const invocations = new Map();
  const brokers = new Map();
  const terminalReceipts = [];
  let seal = null;
  for (const [index, record] of records.entries()) {
    assert.equal(seal, null, "verification receipt record follows the seal");
    assertVerificationRecord(record);
    if (record.recordType === "start") {
      assert.deepEqual(Object.keys(record).sort(), invocationStartKeys);
      assert.equal(
        invocations.has(record.invocationId),
        false,
        `duplicate verification invocation start: ${record.invocationId}`,
      );
      if (record.origin === "mcp-broker") {
        const broker = brokers.get(record.brokerId);
        assert.ok(broker, `verification invocation has no broker: ${record.invocationId}`);
        assert.equal(
          broker.terminal,
          null,
          `verification invocation started after broker terminal: ${record.invocationId}`,
        );
      } else {
        assert.equal(brokers.size, 0, "direct verification cannot share a broker stream");
      }
      invocations.set(record.invocationId, { start: record, terminal: null });
      continue;
    }
    if (record.recordType === "terminal") {
      const invocation = invocations.get(record.invocationId);
      assert.ok(invocation, `terminal receipt has no start: ${record.invocationId}`);
      assert.equal(
        invocation.terminal,
        null,
        `duplicate verification invocation terminal: ${record.invocationId}`,
      );
      for (const name of [
        "commandId",
        "registrySha256",
        "commandSha256",
        "executionMode",
        "origin",
        "brokerId",
      ]) {
        assert.equal(record[name], invocation.start[name], `terminal ${name} differs from start`);
      }
      if (record.origin === "mcp-broker") {
        const broker = brokers.get(record.brokerId);
        assert.ok(broker, `verification terminal has no broker: ${record.invocationId}`);
        assert.equal(
          broker.terminal,
          null,
          `verification invocation terminal follows broker terminal: ${record.invocationId}`,
        );
      }
      invocation.terminal = record;
      terminalReceipts.push(record);
      continue;
    }
    if (record.recordType === "broker-start") {
      assert.deepEqual(Object.keys(record).sort(), brokerRecordKeys);
      assert.equal(
        [...invocations.values()].some((invocation) => invocation.start.origin === "direct-screen"),
        false,
        "broker verification cannot share a direct stream",
      );
      assert.equal(
        [...brokers.values()].some((broker) => broker.terminal === null),
        false,
        "verification brokers cannot overlap",
      );
      assert.equal(
        brokers.has(record.brokerId),
        false,
        `duplicate verification broker start: ${record.brokerId}`,
      );
      brokers.set(record.brokerId, { start: record, terminal: null });
      continue;
    }
    if (record.recordType === "broker-terminal") {
      assert.deepEqual(Object.keys(record).sort(), brokerRecordKeys);
      const broker = brokers.get(record.brokerId);
      assert.ok(broker, `terminal broker has no start: ${record.brokerId}`);
      assert.equal(
        broker.terminal,
        null,
        `duplicate verification broker terminal: ${record.brokerId}`,
      );
      assert.equal(
        [...invocations.values()].some(
          (invocation) =>
            invocation.start.brokerId === record.brokerId && invocation.terminal === null,
        ),
        false,
        `verification broker terminal precedes invocation terminal: ${record.brokerId}`,
      );
      for (const name of ["registrySha256", "executionMode"]) {
        assert.equal(
          record[name],
          broker.start[name],
          `terminal broker ${name} differs from start`,
        );
      }
      broker.terminal = record;
      continue;
    }
    assert.equal(record.recordType, "seal", "unknown verification receipt record type");
    assert.deepEqual(Object.keys(record).sort(), sealRecordKeys);
    const prefix = Buffer.from(`${lines.slice(0, index).join("\n")}${index === 0 ? "" : "\n"}`);
    assert.equal(record.priorRecords, index, "verification seal record count differs");
    assert.equal(record.priorBytes, prefix.length, "verification seal byte count differs");
    assert.equal(record.priorSha256, digest(prefix), "verification seal digest differs");
    seal = record;
  }
  return {
    records,
    terminalReceipts,
    unsettledStarts: [...invocations.values()]
      .filter((invocation) => invocation.terminal === null)
      .map((invocation) => invocation.start),
    unsettledBrokers: [...brokers.values()]
      .filter((broker) => broker.terminal === null)
      .map((broker) => broker.start),
    seal,
  };
}

export function readVerificationInvocationStream(receiptPath) {
  assert.equal(typeof receiptPath, "string");
  assert.ok(receiptPath.length > 0);
  return parseVerificationInvocationStream(readFileSync(receiptPath, "utf8"));
}

function assertVerificationRecord(record) {
  assert.ok(record && typeof record === "object" && !Array.isArray(record));
  assert.equal(record.formatVersion, VERIFICATION_RECEIPT_FORMAT_VERSION);
  if (record.recordType === "start" || record.recordType === "terminal") {
    assertInvocationIdentity(record);
    return;
  }
  if (record.recordType === "broker-start" || record.recordType === "broker-terminal") {
    assertBrokerIdentity(record);
    return;
  }
  assert.equal(record.recordType, "seal", "unknown verification receipt record type");
  assert.match(record.registrySha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof record.executionMode, "string");
  assert.ok(record.executionMode.length > 0);
  assert.ok(Number.isSafeInteger(record.priorRecords) && record.priorRecords >= 0);
  assert.ok(Number.isSafeInteger(record.priorBytes) && record.priorBytes >= 0);
  assert.match(record.priorSha256, /^[0-9a-f]{64}$/);
}

function assertInvocationIdentity(record) {
  assert.match(record.invocationId, /^[0-9a-f]{32}$/);
  assert.match(record.commandId, /^[a-z][a-z0-9-]+$/);
  assert.match(record.registrySha256, /^[0-9a-f]{64}$/);
  assert.match(record.commandSha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof record.executionMode, "string");
  assert.ok(record.executionMode.length > 0);
  assert.ok(["mcp-broker", "direct-screen"].includes(record.origin));
  if (record.origin === "mcp-broker") assert.match(record.brokerId, /^[0-9a-f]{32}$/);
  else assert.equal(record.brokerId, null);
}

function assertBrokerIdentity(record) {
  assert.match(record.brokerId, /^[0-9a-f]{32}$/);
  assert.match(record.registrySha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof record.executionMode, "string");
  assert.ok(record.executionMode.length > 0);
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

const invocationStartKeys = Object.freeze(
  [
    "formatVersion",
    "recordType",
    "invocationId",
    "commandId",
    "registrySha256",
    "commandSha256",
    "executionMode",
    "origin",
    "brokerId",
  ].sort(),
);
const brokerRecordKeys = Object.freeze(
  ["formatVersion", "recordType", "brokerId", "registrySha256", "executionMode"].sort(),
);
const sealRecordKeys = Object.freeze(
  [
    "formatVersion",
    "recordType",
    "registrySha256",
    "executionMode",
    "priorRecords",
    "priorBytes",
    "priorSha256",
  ].sort(),
);
