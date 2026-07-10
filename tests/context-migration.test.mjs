import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { hasLegacyCliInvocation, planContextV1Migrations } from "../dist/migrations/context-v1.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./helpers.mjs";

test("v1 migration is a no-op when no configured document matches the frozen template", async () => {
  const root = await createTemporaryDirectory("carrylog-migration-no-instructions-");
  try {
    assert.deepEqual(
      await planContextV1Migrations(projectFixture(root, [{ id: "project", path: "project.md" }])),
      [],
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("v1 migration leaves a missing configured instructions document to normal validation", async () => {
  const root = await createTemporaryDirectory("carrylog-migration-missing-instructions-");
  try {
    assert.deepEqual(
      await planContextV1Migrations(
        projectFixture(root, [{ id: "instructions", path: "instructions.md" }]),
      ),
      [],
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("v1 migration skips larger customized documents before normal context validation", async () => {
  const root = await createTemporaryDirectory("carrylog-migration-customized-size-");
  try {
    await mkdir(path.join(root, ".agent-context"));
    await writeFile(
      path.join(root, ".agent-context", "instructions.md"),
      `# Customized instructions\n\n${"Team-owned content. ".repeat(1_000)}`,
      "utf8",
    );
    assert.deepEqual(
      await planContextV1Migrations(
        projectFixture(root, [{ id: "instructions", path: "instructions.md" }]),
      ),
      [],
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("legacy executable detection covers command forms without blocking historical prose", () => {
  for (const command of [
    "Run `ackit validate`.",
    'Run "ackit" validate.',
    "/usr/local/bin/ackit sync --check",
    "$(ackit handoff)",
    "ackit; echo done",
    "$ ackit&& echo done",
    "build && ackit&& echo done",
    '"check": "ackit validate"',
    "ackit --version",
    "ackit -h",
    "ackit -v",
    "ackit help",
    ".\\node_modules\\.bin\\ackit.cmd validate",
    "ackit.ps1 handoff",
    "ACKIT validate",
    "Ackit -v",
    "ACKIT.CMD validate",
    "ackit.PS1 handoff",
  ]) {
    assert.equal(hasLegacyCliInvocation(command), true, command);
  }

  for (const prose of [
    "The old command was `ackit`.",
    "Do not use ackit; it was removed.",
    "Compatibility label: ackit-compatible.",
    "Use brackit validate.",
    "Run `carrylog validate`.",
  ]) {
    assert.equal(hasLegacyCliInvocation(prose), false, prose);
  }

  const nearLimit = `${"brackit ".repeat(100_000)}ackit validate`;
  assert.equal(hasLegacyCliInvocation(nearLimit), true);
});

function projectFixture(root, documents) {
  return {
    root,
    configPath: path.join(root, ".agent-context", "config.yaml"),
    configSource: "fixture",
    config: {
      version: 1,
      project: { name: "fixture" },
      documents: documents.map((document) => ({
        ...document,
        load: "always",
        description: "fixture",
      })),
      adapters: [],
      policies: { maxAlwaysCharacters: 16_000, maxAdapterCharacters: 12_000 },
    },
  };
}
