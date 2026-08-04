import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("scored Claude execution fixes tool concurrency before authentication staging", async () => {
  const source = await readFile(path.join(analysisRoot, "run.mjs"), "utf8");
  const serial = source.indexOf("enforceSerialClaudeToolExecution(environment);");
  const authentication = source.indexOf(
    "routerAuthentication = await stageClaudeRouterAuthentication",
    serial,
  );
  assert.ok(serial >= 0, "scored Claude environment omitted serial tool execution");
  assert.ok(authentication > serial, "tool concurrency must be fixed before provider access");
});

test("scored freeze verification cannot read the setup environment in its temporal dead zone", async () => {
  const source = await readFile(path.join(analysisRoot, "run.mjs"), "utf8");
  const declaration = source.indexOf("let deterministicSetupEnvironment;");
  const freezeCall = source.indexOf("freezeEvidence = await assertFrozenSuite();");
  assert.notEqual(declaration, -1);
  assert.notEqual(freezeCall, -1);
  assert.ok(
    declaration < freezeCall,
    "setup environment must be declared before freeze verification",
  );

  const freezeFunction = source.slice(
    source.indexOf("async function assertFrozenSuite()"),
    source.indexOf("async function resolveSource("),
  );
  assert.match(freezeFunction, /env: process\.env/);
});

test("failure and artifact writers initialize their sequence before top-level execution awaits", async () => {
  const source = await readFile(path.join(analysisRoot, "run.mjs"), "utf8");
  const declaration = source.indexOf("let atomicSequence = 0;");
  const firstExecutionAwait = source.indexOf(
    'const preregistration = await readJson(path.join(tierRoot, "preregistration.json"));',
  );
  const writerUse = source.indexOf("atomicSequence++");

  assert.notEqual(declaration, -1);
  assert.notEqual(firstExecutionAwait, -1);
  assert.notEqual(writerUse, -1);
  assert.ok(
    declaration < firstExecutionAwait,
    "atomic writer state must initialize before top-level execution can suspend",
  );
  assert.ok(declaration < writerUse);
});

test("verification containment failure precedes artifacts and forces fixture cleanup", async () => {
  const source = await readFile(path.join(analysisRoot, "run.mjs"), "utf8");
  const receiptRead = source.indexOf("verificationReceipts = await readVerificationReceipts(");
  const containmentGate = source.indexOf(
    "assertRegisteredVerificationOnly(result.commandRecords, verificationReceipts)",
    receiptRead,
  );
  const artifactCapture = source.indexOf('stage = "artifact-sanitization"', containmentGate);
  const artifactPublication = source.indexOf('stage = "artifact-publication"', artifactCapture);
  assert.ok(receiptRead >= 0);
  assert.ok(containmentGate > receiptRead);
  assert.ok(artifactCapture > containmentGate);
  assert.ok(artifactPublication > artifactCapture);
  assert.match(source, /stage = "protocol";\s*forceFixtureCleanup = true/);
  assert.match(
    source,
    /\(!keepTemporary \|\| forceFixtureCleanup\) && temporaryRoot !== undefined/,
  );
  assert.match(source, /assertRegisteredVerificationOnly\(\[\], verificationReceipts\)/);
  const failureReceiptRead = source.indexOf(
    "const receiptResult = await readVerificationReceiptsForFailure(verification)",
  );
  const invalidReceiptBranch = source.indexOf(
    "if (receiptResult.diagnostic !== null)",
    failureReceiptRead,
  );
  const protocolPromotion = source.indexOf('stage = "protocol"', invalidReceiptBranch);
  const terminalPromotion = source.indexOf(
    "terminalError = createProtocolContainmentError",
    invalidReceiptBranch,
  );
  assert.ok(failureReceiptRead > artifactPublication);
  assert.ok(invalidReceiptBranch > failureReceiptRead);
  assert.ok(protocolPromotion > invalidReceiptBranch);
  assert.ok(terminalPromotion > protocolPromotion);
});
