import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  AckitError,
  CarrylogError,
  CLI_NAME,
  CONFIG_PATH,
  DEBUG_ENV_NAME,
  HANDOFF_SNAPSHOT_END,
  HANDOFF_SNAPSHOT_START,
  LEGACY_DEBUG_ENV_NAME,
  MANAGED_END,
  MANAGED_START,
  PRODUCT_NAME,
  readPublicSchema,
} from "../dist/index.js";
import { isDebugEnabled } from "../dist/product.js";

test("active product, package, and executable identity is Carrylog", async () => {
  const manifest = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  assert.equal(PRODUCT_NAME, "Carrylog");
  assert.equal(CLI_NAME, "carrylog");
  assert.equal(manifest.name, "carrylog");
  assert.deepEqual(manifest.bin, { carrylog: "dist/cli.js" });
  assert.equal(manifest.repository.url, "git+https://github.com/Jaemani/Carrylog.git");
  assert.equal(Object.hasOwn(manifest.bin, "ackit"), false);
  assert.equal(Object.hasOwn(manifest.bin, "cl"), false);
});

test("CarrylogError preserves the beta.3 AckitError constructor identity", () => {
  assert.equal(CarrylogError, AckitError);
  const error = new CarrylogError("E_FIXTURE", "fixture");
  assert.equal(error.name, "CarrylogError");
  assert.equal(error instanceof CarrylogError, true);
  assert.equal(error instanceof AckitError, true);
});

test("canonical debug configuration takes precedence over the legacy alias", () => {
  assert.equal(DEBUG_ENV_NAME, "CARRYLOG_DEBUG");
  assert.equal(LEGACY_DEBUG_ENV_NAME, "ACKIT_DEBUG");
  assert.equal(isDebugEnabled({}), false);
  assert.equal(isDebugEnabled({ ACKIT_DEBUG: "1" }), true);
  assert.equal(isDebugEnabled({ CARRYLOG_DEBUG: "1" }), true);
  assert.equal(isDebugEnabled({ CARRYLOG_DEBUG: "0", ACKIT_DEBUG: "1" }), false);
  assert.equal(isDebugEnabled({ CARRYLOG_DEBUG: "", ACKIT_DEBUG: "1" }), false);
});

test("configuration v1 keeps its published repository wire identities", () => {
  assert.equal(CONFIG_PATH, ".agent-context/config.yaml");
  assert.equal(MANAGED_START, "<!-- agent-context-kit:managed:start -->");
  assert.equal(MANAGED_END, "<!-- agent-context-kit:managed:end -->");
  assert.equal(HANDOFF_SNAPSHOT_START, "<!-- agent-context-kit:handoff-snapshot:start -->");
  assert.equal(HANDOFF_SNAPSHOT_END, "<!-- agent-context-kit:handoff-snapshot:end -->");

  const schemaSource = readPublicSchema();
  assert.equal(
    createHash("sha256").update(schemaSource).digest("hex"),
    "f30d6c906dba10059032ce13c74257b6ab41ebdd30308ca56b65408f039369ab",
  );
  const schema = JSON.parse(schemaSource);
  assert.equal(
    schema.$id,
    "https://raw.githubusercontent.com/Jaemani/Agent-Context-Kit/main/schemas/config-v1.schema.json",
  );
  assert.equal(schema.title, "Agent Context Kit configuration v1");
});
