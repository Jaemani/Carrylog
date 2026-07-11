import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import {
  decodeConfig,
  extractHandoffSnapshotBody,
  loadProject,
  migrateProject,
  readPublicSchema,
  refreshHandoff,
  renderAdapter,
  upsertManagedBlock,
  validateProject,
} from "../dist/index.js";
import {
  createDefaultConfig,
  createDefaultConfigV2,
  createTemplateFiles,
} from "../dist/templates/defaults.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./helpers.mjs";

const execFileAsync = promisify(execFile);

async function createV1Project(root, { crlf = false, adapters = ["codex", "claude"] } = {}) {
  const config = createDefaultConfig("Migration fixture", adapters);
  for (const file of createTemplateFiles(config)) {
    const target = path.join(root, ...file.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, crlf ? file.content.replace(/\n/g, "\r\n") : file.content, "utf8");
  }
  for (const adapter of config.adapters) {
    await writeFile(
      path.join(root, adapter.output),
      upsertManagedBlock(undefined, renderAdapter(config, adapter), { adopt: false }),
      "utf8",
    );
  }
  return config;
}

async function runGit(root, arguments_) {
  await execFileAsync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
}

test("configuration v2 schema accepts universal defaults and runtime rejects cross-version adapters", () => {
  const config = createDefaultConfigV2("Universal fixture", [
    "codex",
    "claude",
    "cursor",
    "gemini",
  ]);
  assert.deepEqual(
    config.adapters.map((adapter) => adapter.type),
    ["agents", "claude", "gemini"],
  );
  assert.notEqual(decodeConfig(config).config, undefined);
  const schema = JSON.parse(readPublicSchema(2));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(config), true, JSON.stringify(validate.errors));

  const invalidV1 = createDefaultConfig("v1", ["codex"]);
  invalidV1.adapters[0].type = "agents";
  assert.equal(decodeConfig(invalidV1).config, undefined);
  config.adapters[0].type = "codex";
  assert.equal(decodeConfig(config).config, undefined);
});

test("migration public API rejects invalid runtime options before project mutation", async () => {
  const root = await createTemporaryDirectory();
  try {
    await createV1Project(root);
    const project = await loadProject(root);
    const configBefore = await readFile(project.configPath, "utf8");
    await assert.rejects(
      () =>
        migrateProject(project, {
          to: 3,
          universal: false,
          adopt: false,
          check: false,
          dryRun: false,
        }),
      (error) => error.code === "E_MIGRATION_TARGET" && error.exitCode === 2,
    );
    await assert.rejects(
      () =>
        migrateProject(project, {
          to: 2,
          universal: "true",
          adopt: false,
          check: false,
          dryRun: false,
        }),
      (error) => error.code === "E_MIGRATION_OPTIONS" && error.exitCode === 2,
    );
    assert.equal(await readFile(project.configPath, "utf8"), configBefore);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("v1 to v2 universal migration is explicit, comment-preserving, atomic, and idempotent", async () => {
  const root = await createTemporaryDirectory();
  try {
    await createV1Project(root);
    const configPath = path.join(root, ".agent-context", "config.yaml");
    const source = await readFile(configPath, "utf8");
    await writeFile(
      configPath,
      source.replace("project:\n", "# retained root comment\nproject:\n"),
    );
    let project = await loadProject(root);

    const checked = await migrateProject(project, {
      to: 2,
      universal: true,
      adopt: false,
      check: true,
      dryRun: false,
    });
    assert.equal(checked.drift, true);
    assert.equal((await loadProject(root)).config.version, 1);

    const migrated = await migrateProject(project, {
      to: 2,
      universal: true,
      adopt: false,
      check: false,
      dryRun: false,
    });
    assert.equal(migrated.wrote, true);
    project = await loadProject(root);
    assert.equal(project.config.version, 2);
    assert.deepEqual(
      project.config.adapters.map((adapter) => adapter.type),
      ["agents", "claude", "gemini"],
    );
    assert.equal(project.config.continuity.generateSkills, true);
    assert.match(project.configSource, /# retained root comment/);
    assert.equal((await validateProject(project)).valid, true);
    await stat(path.join(root, ".agents", "skills", "carrylog-continuity", "SKILL.md"));
    await stat(path.join(root, ".claude", "skills", "carrylog-continuity", "SKILL.md"));

    const repeated = await migrateProject(project, {
      to: 2,
      universal: true,
      adopt: false,
      check: true,
      dryRun: false,
    });
    assert.equal(repeated.drift, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("migration refuses customized checkpoint meaning and unowned skill conflicts without partial writes", async () => {
  for (const conflict of ["checkpoint", "skill"]) {
    const root = await createTemporaryDirectory();
    try {
      await createV1Project(root);
      const configPath = path.join(root, ".agent-context", "config.yaml");
      const originalConfig = await readFile(configPath, "utf8");
      const handoffPath = path.join(root, ".agent-context", "handoff.md");
      const originalHandoff = await readFile(handoffPath, "utf8");
      if (conflict === "checkpoint") {
        await writeFile(handoffPath, `${originalHandoff}\nHuman customization.\n`, "utf8");
      } else {
        const skillPath = path.join(root, ".agents", "skills", "carrylog-continuity", "SKILL.md");
        await mkdir(path.dirname(skillPath), { recursive: true });
        await writeFile(skillPath, "---\nname: carrylog-continuity\n---\nHuman-owned.\n", "utf8");
      }
      const project = await loadProject(root);
      await assert.rejects(
        () =>
          migrateProject(project, {
            to: 2,
            universal: true,
            adopt: false,
            check: false,
            dryRun: false,
          }),
        (error) =>
          conflict === "checkpoint"
            ? error.code === "E_CHECKPOINT_REVIEW_REQUIRED"
            : error.code === "E_SKILL_PLAN",
      );
      assert.equal(await readFile(configPath, "utf8"), originalConfig);
      assert.equal((await loadProject(root)).config.version, 1);
    } finally {
      await removeTemporaryDirectory(root);
    }
  }
});

test("migration preserves CRLF for stock configuration and checkpoint", async () => {
  const root = await createTemporaryDirectory();
  try {
    await createV1Project(root, { crlf: true });
    const project = await loadProject(root);
    await migrateProject(project, {
      to: 2,
      universal: false,
      adopt: false,
      check: false,
      dryRun: false,
    });
    const config = await readFile(path.join(root, ".agent-context", "config.yaml"), "utf8");
    const checkpoint = await readFile(path.join(root, ".agent-context", "handoff.md"), "utf8");
    assert.equal(/(^|[^\r])\n/.test(config), false);
    assert.equal(/(^|[^\r])\n/.test(checkpoint), false);
    assert.equal((await loadProject(root)).config.version, 2);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("migration accepts a stock v1 handoff with generated evidence and preserves that evidence", async () => {
  for (const crlf of [false, true]) {
    const root = await createTemporaryDirectory();
    try {
      await createV1Project(root, { crlf });
      await runGit(root, ["init", "-b", "main"]);
      await runGit(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
      await runGit(root, ["config", "user.name", "Carrylog Tests"]);
      await runGit(root, ["add", "."]);
      await runGit(root, ["commit", "-m", "Published v1 handoff fixture"]);
      await refreshHandoff(await loadProject(root), { check: false, dryRun: false });

      const handoffPath = path.join(root, ".agent-context", "handoff.md");
      const before = await readFile(handoffPath, "utf8");
      const evidenceBefore = extractHandoffSnapshotBody(before);
      assert.notEqual(evidenceBefore, undefined);

      await migrateProject(await loadProject(root), {
        to: 2,
        universal: true,
        adopt: false,
        check: false,
        dryRun: false,
      });
      const after = await readFile(handoffPath, "utf8");
      assert.equal(extractHandoffSnapshotBody(after), evidenceBefore);
      assert.match(after, /## Completed/);
      assert.doesNotMatch(after, /## Changes/);
      assert.match(after, /Published v1 handoff fixture/);
      assert.equal(/(^|[^\r])\n/.test(after), !crlf);
      assert.equal((await validateProject(await loadProject(root))).valid, true);
    } finally {
      await removeTemporaryDirectory(root);
    }
  }
});

test("universal migration fills every harness surface from partial v1 and v2 configurations", async () => {
  for (const startingAdapters of [["codex"], ["claude"]]) {
    const root = await createTemporaryDirectory();
    try {
      await createV1Project(root);
      const configPath = path.join(root, ".agent-context", "config.yaml");
      const project = await loadProject(root);
      const source = project.configSource.replace(
        /adapters:\n(?: {2}- .*\n(?: {4}.*\n)*)+policies:/,
        `adapters:\n${startingAdapters
          .map(
            (type) =>
              `  - type: ${type}\n    output: ${type === "codex" ? "AGENTS.md" : "CLAUDE.md"}\n`,
          )
          .join("")}policies:`,
      );
      await writeFile(configPath, source, "utf8");
      await migrateProject(await loadProject(root), {
        to: 2,
        universal: true,
        adopt: false,
        check: false,
        dryRun: false,
      });
      let migrated = await loadProject(root);
      assert.deepEqual(
        new Set(migrated.config.adapters.map((adapter) => adapter.type)),
        new Set(["agents", "claude", "gemini"]),
      );

      const firstV2Source = migrated.configSource;
      const disabled = firstV2Source
        .replace(/ {2}- type: gemini\n {4}output: GEMINI\.md\n/, "")
        .replace("generateSkills: true", "generateSkills: false");
      await writeFile(configPath, disabled, "utf8");
      const upgraded = await migrateProject(await loadProject(root), {
        to: 2,
        universal: true,
        adopt: false,
        check: false,
        dryRun: false,
      });
      assert.equal(upgraded.from, 2);
      assert.equal(upgraded.wrote, true);
      migrated = await loadProject(root);
      assert.equal(migrated.config.continuity.generateSkills, true);
      assert.equal(
        migrated.config.adapters.some((adapter) => adapter.type === "gemini"),
        true,
      );
    } finally {
      await removeTemporaryDirectory(root);
    }
  }
});

test("skill ownership requires exactly one standalone marker and never accepts marker prose", async () => {
  for (const existing of [
    "Human skill mentioning <!-- agent-context-kit:continuity-skill:managed --> inline.\n",
    "<!-- agent-context-kit:continuity-skill:managed -->\nHuman content.\n<!-- agent-context-kit:continuity-skill:managed -->\n",
  ]) {
    const root = await createTemporaryDirectory();
    try {
      await createV1Project(root);
      const skillPath = path.join(root, ".agents", "skills", "carrylog-continuity", "SKILL.md");
      await mkdir(path.dirname(skillPath), { recursive: true });
      await writeFile(skillPath, existing, "utf8");
      await assert.rejects(
        async () =>
          migrateProject(await loadProject(root), {
            to: 2,
            universal: true,
            adopt: true,
            check: false,
            dryRun: false,
          }),
        (error) => error.code === "E_SKILL_PLAN",
      );
      assert.equal(await readFile(skillPath, "utf8"), existing);
      assert.equal((await loadProject(root)).config.version, 1);
    } finally {
      await removeTemporaryDirectory(root);
    }
  }
});

test("non-universal migration preserves the selected surface and leaves skills disabled", async () => {
  const root = await createTemporaryDirectory();
  try {
    await createV1Project(root, { adapters: ["claude"] });
    await migrateProject(await loadProject(root), {
      to: 2,
      universal: false,
      adopt: false,
      check: false,
      dryRun: false,
    });
    const project = await loadProject(root);
    assert.equal(project.config.version, 2);
    assert.deepEqual(
      project.config.adapters.map((adapter) => adapter.type),
      ["claude"],
    );
    assert.equal(project.config.continuity.generateSkills, false);
    const repeated = await migrateProject(project, {
      to: 2,
      universal: false,
      adopt: false,
      check: true,
      dryRun: false,
    });
    assert.deepEqual(repeated, {
      from: 2,
      to: 2,
      changes: [],
      wrote: false,
      drift: false,
    });
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("universal migration rejects generated-output collisions without any write", async () => {
  const root = await createTemporaryDirectory();
  try {
    await createV1Project(root, { adapters: ["claude"] });
    const configPath = path.join(root, ".agent-context", "config.yaml");
    const original = await readFile(configPath, "utf8");
    const colliding = original.replace("output: CLAUDE.md", "output: GEMINI.md");
    await writeFile(configPath, colliding, "utf8");
    await assert.rejects(
      async () =>
        migrateProject(await loadProject(root), {
          to: 2,
          universal: true,
          adopt: false,
          check: false,
          dryRun: false,
        }),
      (error) => error.code === "E_CONFIG_INVALID",
    );
    assert.equal(await readFile(configPath, "utf8"), colliding);
    await assert.rejects(() => stat(path.join(root, "GEMINI.md")), { code: "ENOENT" });
    await assert.rejects(
      () => stat(path.join(root, ".agents", "skills", "carrylog-continuity", "SKILL.md")),
      { code: "ENOENT" },
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});
