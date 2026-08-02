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
