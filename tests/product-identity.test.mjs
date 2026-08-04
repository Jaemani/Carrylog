import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { parse } from "yaml";
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

test("release publication is OIDC-only after the first-package bootstrap", async () => {
  const source = await readFile(path.resolve(".github/workflows/release.yml"), "utf8");
  const workflow = parse(source);
  const publish = workflow.jobs.publish;
  const steps = publish.steps;

  assert.equal(publish.environment, "npm");
  assert.deepEqual(publish.needs, ["preflight", "active-research"]);
  assert.deepEqual(publish.permissions, {
    contents: "read",
    "id-token": "write",
  });
  assert.doesNotMatch(source, /\$\{\{\s*secrets\./u);
  assert.doesNotMatch(source, /NODE_AUTH_TOKEN|NPM_TOKEN|_authToken/u);

  const releaseClient = steps.findIndex(
    (step) => step.name === "Pin trusted-publishing npm client",
  );
  const publishArtifact = steps.findIndex((step) => step.name === "Publish the verified tarball");
  const verifyRegistry = steps.findIndex(
    (step) => step.name === "Verify registry installation and beta tag",
  );
  assert.notEqual(releaseClient, -1);
  assert.equal(steps[releaseClient].run, "npm install --global npm@11.18.0");
  assert.notEqual(publishArtifact, -1);
  assert.equal(steps[publishArtifact].run, "npm run release:publish");
  assert.notEqual(verifyRegistry, -1);
  assert.equal(steps[verifyRegistry].run, "node scripts/verify-published.mjs");
  assert.equal(releaseClient < publishArtifact && publishArtifact < verifyRegistry, true);
});

test("product and macOS research gates remain separate and release-blocking", async () => {
  const manifest = JSON.parse(await readFile(path.resolve("package.json"), "utf8"));
  assert.equal(
    manifest.scripts.quality,
    "npm run format:check && npm run check && npm run test:coverage",
  );
  assert.equal(
    manifest.scripts["quality:research"],
    "npm run quality && npm run test:research:active",
  );
  assert.match(manifest.scripts["test:research:active"], /^npm run build && node --test /);

  const ci = parse(await readFile(path.resolve(".github/workflows/ci.yml"), "utf8"));
  const research = ci.jobs["active-research"];
  assert.equal(research["runs-on"], "macos-15");
  assert.deepEqual(research.strategy.matrix.node, [22, 24]);
  assert.equal(
    research.steps.find((step) => step.name === "Run macOS active research gates").run,
    "npm run test:research:active",
  );
  assert.equal(
    ci.jobs.quality.steps.find((step) => step.name === "Run quality gates").run,
    "npm run quality",
  );

  const release = parse(await readFile(path.resolve(".github/workflows/release.yml"), "utf8"));
  const releaseResearch = release.jobs["active-research"];
  assert.equal(releaseResearch["runs-on"], "macos-15");
  assert.deepEqual(releaseResearch.strategy.matrix.node, [22, 24]);
  assert.equal(
    releaseResearch.steps.find((step) => step.name === "Run macOS active research gates").run,
    "npm run test:research:active",
  );
  assert.deepEqual(release.jobs.publish.needs, ["preflight", "active-research"]);
});
