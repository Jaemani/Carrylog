import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { initProject, loadProject, syncProject, validateProject } from "../dist/index.js";
import { createTemporaryDirectory, removeTemporaryDirectory } from "./helpers.mjs";

test("adoption scenario: greenfield repository is immediately valid and idempotent", async () => {
  const root = await createTemporaryDirectory();
  try {
    const initialized = await initProject({
      root,
      name: "Greenfield service",
      adapters: ["codex", "claude"],
      adopt: false,
      dryRun: false,
    });
    assert.equal(initialized.changes.length, 13);
    const project = await loadProject(root);
    assert.equal((await validateProject(project)).valid, true);
    assert.equal(
      (await syncProject(project, { adopt: false, check: true, dryRun: false })).drift,
      false,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("adoption scenario: established mixed-newline agent files preserve human instructions", async () => {
  const root = await createTemporaryDirectory();
  try {
    await writeFile(path.join(root, "AGENTS.md"), "# Team rules\n\n- Keep this.\n", "utf8");
    await writeFile(
      path.join(root, "CLAUDE.md"),
      "# Local guide\r\n\r\nKeep this too.\r\n",
      "utf8",
    );
    await initProject({
      root,
      name: "Established service",
      adapters: ["codex", "claude"],
      adopt: true,
      dryRun: false,
    });
    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    const claude = await readFile(path.join(root, "CLAUDE.md"), "utf8");
    assert.match(agents, /^# Team rules\n\n- Keep this\./);
    assert.match(claude, /^# Local guide\r\n\r\nKeep this too\./);
    assert.match(agents, /agent-context-kit:managed:start/);
    assert.match(claude, /agent-context-kit:managed:start/);
    assert.equal((await validateProject(await loadProject(root))).valid, true);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("adoption scenario: a monorepo package owns local context without changing root guidance", async () => {
  const root = await createTemporaryDirectory();
  try {
    const rootGuide = "# Monorepo-wide human guidance\n";
    await writeFile(path.join(root, "AGENTS.md"), rootGuide, "utf8");
    const projectRoot = path.join(root, "packages", "payments");
    const nested = path.join(projectRoot, "src", "handlers");
    await mkdir(nested, { recursive: true });
    await initProject({
      root: projectRoot,
      name: "Payments package",
      adapters: ["codex", "claude"],
      adopt: false,
      dryRun: false,
    });
    const project = await loadProject(nested);
    assert.equal(project.root, projectRoot);
    assert.equal((await validateProject(project)).valid, true);
    assert.equal(await readFile(path.join(root, "AGENTS.md"), "utf8"), rootGuide);
    assert.match(await readFile(path.join(projectRoot, "AGENTS.md"), "utf8"), /Codex/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});
