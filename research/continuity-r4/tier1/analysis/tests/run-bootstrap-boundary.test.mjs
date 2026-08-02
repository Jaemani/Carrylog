import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
