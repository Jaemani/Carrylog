import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import {
  chmod,
  link,
  mkdir,
  readFile,
  rename,
  rmdir,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import { upsertManagedBlock } from "../dist/adapters/managed-block.js";
import { renderAdapter } from "../dist/adapters/render.js";
import { refreshHandoff } from "../dist/commands/handoff.js";
import { initProject } from "../dist/commands/init.js";
import { createResumeEnvelope } from "../dist/commands/resume.js";
import { syncProject } from "../dist/commands/sync.js";
import { loadProject } from "../dist/config/load.js";
import {
  CHECKPOINT_SECTION_NAMES,
  parseCheckpointSections,
  validateCheckpointStructure,
} from "../dist/continuity/checkpoint.js";
import {
  AGENT_SKILL_PATH,
  CLAUDE_SKILL_PATH,
  PROJECT_LOCAL_CARRYLOG_PROBE,
  renderAgentContinuitySkill,
} from "../dist/continuity/skills.js";
import { inspectGitProject } from "../dist/git/inspect.js";
import { renderHandoffSnapshot, upsertHandoffSnapshot } from "../dist/handoff/snapshot-block.js";
import { PUBLIC_SCHEMA_PATH } from "../dist/schema/public-schema.js";
import { createDefaultConfig, createTemplateFiles } from "../dist/templates/defaults.js";
import {
  createTemporaryDirectory,
  removeTemporaryDirectory,
  writeProjectConfig,
} from "./helpers.mjs";

const cli = path.resolve("dist/cli.js");
const execFileAsync = promisify(execFile);
const checkpointPath = ".agent-context/handoff.md";

test("continuity skill resolves source and pinned executables before a compatible global", () => {
  const skill = renderAgentContinuitySkill();
  assert.match(skill, /npx --no-install carrylog resume --json/);
  assert.match(skill, /node_modules\/\.bin\/carrylog/);
  assert.match(skill, /process\.platform===\x27win32\x27\?\x27carrylog\.cmd\x27:\x27carrylog\x27/);
  assert.match(skill, /f\.lstatSync/);
  assert.match(skill, /f\.statSync/);
  assert.match(skill, /f\.accessSync/);
  assert.match(skill, /Do not use Glob, Read, or directory listings/);
  assert.match(skill, /Exit 1 means it is\s+absent and permits checking the global candidate/);
  assert.match(skill, /present but unusable or uncertain/);
  assert.match(skill, /node dist\/cli\.js resume --json/);
  assert.match(skill, /node dist\/cli\.js resume --help/);
  assert.match(skill, /npx --no-install carrylog resume --help/);
  assert.match(skill, /carrylog resume --help/);
  const source = skill.indexOf("node dist/cli.js resume --json");
  const pinnedProbe = skill.indexOf("f.accessSync");
  const pinned = skill.indexOf("npx --no-install carrylog resume --json");
  const compatibleGlobal = skill.lastIndexOf("carrylog resume --help");
  assert.equal(
    source >= 0 && source < pinnedProbe && pinnedProbe < pinned && pinned < compatibleGlobal,
    true,
  );
  assert.match(skill, /selected version lacks `resume`/);
  assert.match(skill, /W_CONTEXT_PLACEHOLDER/);
  assert.match(skill, /Do not claim continuity/);
  assert.match(skill, /do not fall through to a different global version/);
  assert.match(skill, /stage every\s+reviewed non-checkpoint change before `carrylog checkpoint`/);
  assert.match(skill, /Carrylog never stages or commits/);
  assert.doesNotMatch(skill, /npx --yes|npm install/);
});

test("project-local executable probe observes the platform bin without a global fallback", async () => {
  const root = await createTemporaryDirectory("carrylog-local-probe-");
  try {
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 1,
    );

    const modulesDirectory = path.join(root, "node_modules");
    const binDirectory = path.join(modulesDirectory, ".bin");
    const executable = path.join(
      binDirectory,
      process.platform === "win32" ? "carrylog.cmd" : "carrylog",
    );
    await writeFile(modulesDirectory, "not a directory\n", "utf8");
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 2,
    );
    await unlink(modulesDirectory);
    await mkdir(binDirectory, { recursive: true });
    await mkdir(executable);
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 2,
    );
    await rmdir(executable);
    await writeFile(executable, process.platform === "win32" ? "@exit /b 0\r\n" : "#!/bin/sh\n", {
      encoding: "utf8",
      mode: 0o755,
    });
    if (process.platform !== "win32") await chmod(executable, 0o755);

    await execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root });

    if (process.platform !== "win32") {
      const linkedTarget = path.join(root, "linked-carrylog");
      await unlink(executable);
      await writeFile(linkedTarget, "#!/bin/sh\n", { encoding: "utf8", mode: 0o755 });
      await symlink(linkedTarget, executable, "file");
      await execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root });
    }
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("project-local executable probe rejects directory and dangling filesystem candidates", async (context) => {
  const root = await createTemporaryDirectory("carrylog-dangling-probe-");
  try {
    const modulesDirectory = path.join(root, "node_modules");
    try {
      await symlink(
        path.join(root, "missing-modules"),
        modulesDirectory,
        process.platform === "win32" ? "junction" : "dir",
      );
    } catch (error) {
      if (
        process.platform === "win32" &&
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EPERM"
      ) {
        context.skip("Windows host does not permit creation of the required junction fixture.");
        return;
      }
      throw error;
    }
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 2,
    );

    await unlink(modulesDirectory);
    const binDirectory = path.join(modulesDirectory, ".bin");
    await mkdir(binDirectory, { recursive: true });
    const executable = path.join(
      binDirectory,
      process.platform === "win32" ? "carrylog.cmd" : "carrylog",
    );
    const linkedTarget = path.join(root, "linked-carrylog-target");
    await mkdir(linkedTarget);
    await symlink(linkedTarget, executable, process.platform === "win32" ? "junction" : "dir");
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 2,
    );
    await rmdir(linkedTarget);
    await assert.rejects(
      execFileAsync(process.execPath, ["-e", PROJECT_LOCAL_CARRYLOG_PROBE], { cwd: root }),
      (error) => error !== null && typeof error === "object" && error.code === 2,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint parser requires every canonical section exactly once", () => {
  const missing = checkpointDocument(
    CHECKPOINT_SECTION_NAMES.filter((name) => name !== "Decisions"),
  );
  assert.deepEqual(diagnosticCodes(missing), ["E_CHECKPOINT_SECTION_MISSING"]);

  const duplicate = `${checkpointDocument()}\n## Objective\n\nduplicate objective\n`;
  assert.deepEqual(diagnosticCodes(duplicate), ["E_CHECKPOINT_SECTION_DUPLICATE"]);
});

test("checkpoint parser rejects out-of-order and unknown H2 sections", () => {
  const outOfOrder = checkpointDocument([
    "Completed",
    "Objective",
    "Verification",
    "Decisions",
    "Risks",
    "Next action",
  ]);
  assert.equal(diagnosticCodes(outOfOrder).includes("E_CHECKPOINT_SECTION_ORDER"), true);

  const unknown = checkpointDocument(undefined, ["## Notes", "", "unsupported checkpoint notes"]);
  assert.deepEqual(diagnosticCodes(unknown), ["E_CHECKPOINT_SECTION_UNKNOWN"]);
});

test("checkpoint parser ignores fenced and blockquoted fake headings", () => {
  const content = checkpointDocument(undefined, [
    "```markdown",
    "## Objective",
    "fake fenced objective",
    "## Notes",
    "fake fenced notes",
    "```",
    "",
    "> ## Risks",
    "> fake blockquoted risks",
  ]);
  assert.deepEqual(validateCheckpointStructure(content, checkpointPath), []);
  const sections = parseCheckpointSections(content, checkpointPath);
  assert.equal(sections.Objective, sectionBody("Objective"));
  assert.equal(sections.Risks, sectionBody("Risks"));
});

test("checkpoint parser honors CommonMark fence lengths and indented blockquotes", () => {
  const content = checkpointDocument(undefined, [
    "````markdown",
    "```",
    "## Notes",
    "still fenced after a shorter delimiter",
    "````",
    "",
    "  > ## Objective",
    "  > fake indented blockquote objective",
  ]);
  assert.deepEqual(validateCheckpointStructure(content, checkpointPath), []);
});

test("checkpoint parser does not treat backticks in a backtick info string as a fence", () => {
  const invalidBacktickFence = checkpointDocument(undefined, [
    "```markdown`",
    "## Objective",
    "visible duplicate objective",
  ]);
  assert.deepEqual(diagnosticCodes(invalidBacktickFence), ["E_CHECKPOINT_SECTION_DUPLICATE"]);

  const validTildeFence = checkpointDocument(undefined, [
    "~~~markdown`",
    "## Objective",
    "hidden fenced objective",
    "~~~",
  ]);
  assert.deepEqual(validateCheckpointStructure(validTildeFence, checkpointPath), []);
});

test("checkpoint parser ignores headings hidden inside CommonMark HTML blocks", () => {
  const hiddenComment = checkpointDocument(
    CHECKPOINT_SECTION_NAMES.filter((name) => name !== "Objective"),
    ["<!--", "## Objective", "hidden objective", "-->"],
  );
  assert.deepEqual(diagnosticCodes(hiddenComment), ["E_CHECKPOINT_SECTION_MISSING"]);

  const hiddenBlockTag = checkpointDocument(
    CHECKPOINT_SECTION_NAMES.filter((name) => name !== "Objective"),
    ["<div>", "## Objective", "hidden objective", "</div>", ""],
  );
  assert.deepEqual(diagnosticCodes(hiddenBlockTag), ["E_CHECKPOINT_SECTION_MISSING"]);
});

test("resume JSON is byte-deterministic, portable, and reports stale checkpoints", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-resume-");
  try {
    await initializeV2GitProject(root);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });

    const first = await runCli(["resume", "--root", root, "--json"]);
    const second = await runCli(["resume", "--root", root, "--json"]);
    assert.equal(first.code, 0);
    assert.equal(second.code, 0);
    assert.equal(first.stderr, "");
    assert.equal(second.stderr, "");
    assert.equal(second.stdout, first.stdout);

    const envelope = JSON.parse(first.stdout);
    assert.equal(envelope.formatVersion, 1);
    assert.equal(envelope.project.configVersion, 2);
    assert.equal(envelope.project.configPath, ".agent-context/config.yaml");
    assert.equal(envelope.checkpoint.document, checkpointPath);
    assert.equal(envelope.checkpoint.stale, false);
    assert.deepEqual(
      envelope.diagnostics.map((diagnostic) => diagnostic.code),
      ["W_CONTEXT_PLACEHOLDER"],
    );
    assert.match(envelope.diagnostics[0].message, /project\.md/);
    assert.match(envelope.diagnostics[0].message, /current-state\.md/);
    assert.match(envelope.diagnostics[0].message, /handoff\.md/);
    assert.deepEqual(Object.keys(envelope.checkpoint.sections), [...CHECKPOINT_SECTION_NAMES]);

    const serialized = JSON.stringify(envelope);
    assert.equal(
      serialized.includes(root),
      false,
      "resume metadata must not expose its absolute root",
    );
    assert.equal(serialized.includes("committedAt"), false);
    assert.doesNotMatch(serialized, /session[_-]?id/i);
    assert.deepEqual(findForbiddenMetadataKeys(envelope), []);

    await writeFile(path.join(root, "tracked.txt"), "changed after checkpoint\n", "utf8");
    const stale = await runCli(["resume", "--root", root, "--check", "--json"]);
    assert.equal(stale.code, 1);
    assert.equal(stale.stderr, "");
    const staleEnvelope = JSON.parse(stale.stdout);
    assert.equal(staleEnvelope.checkpoint.stale, true);
    assert.equal(
      staleEnvelope.diagnostics.some((diagnostic) => diagnostic.code === "W_CHECKPOINT_STALE"),
      true,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume exposes stock placeholders without treating reviewed context as stock", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-placeholders-");
  try {
    await initializeV2GitProject(root);
    const original = await loadProject(root);
    const config = structuredClone(original.config);
    const stockProjectReference = await readFile(
      path.join(root, ".agent-context", "project.md"),
      "utf8",
    );
    config.documents.push({
      id: "stock-reference",
      path: "reference/stock-project.md",
      load: "on-demand",
      description: "Initialization template retained as an on-demand reference",
      triggers: ["template reference"],
    });
    await mkdir(path.join(root, ".agent-context", "reference"), { recursive: true });
    await writeFile(
      path.join(root, ".agent-context", "reference", "stock-project.md"),
      stockProjectReference,
      "utf8",
    );
    const renamedDocuments = [
      {
        originalId: "project",
        id: "project-memory",
        path: "product/project-memory.md",
      },
      {
        originalId: "current-state",
        id: "state",
        path: "status/current.md",
      },
      {
        originalId: "handoff",
        id: "transfer",
        path: "checkpoints/latest.md",
      },
    ];
    for (const renamedDocument of renamedDocuments) {
      const document = config.documents.find(
        (candidate) => candidate.id === renamedDocument.originalId,
      );
      assert.ok(document);
      const originalPath = document.path;
      document.id = renamedDocument.id;
      document.path = renamedDocument.path;
      await mkdir(path.dirname(path.join(root, ".agent-context", renamedDocument.path)), {
        recursive: true,
      });
      await rename(
        path.join(root, ".agent-context", originalPath),
        path.join(root, ".agent-context", renamedDocument.path),
      );
    }
    config.continuity.checkpointDocument = "transfer";
    await writeProjectConfig(root, config);
    await syncProject(await loadProject(root), { adopt: false, check: false, dryRun: false });
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });

    for (const relativePath of ["status/current.md", "checkpoints/latest.md"]) {
      const target = path.join(root, ".agent-context", relativePath);
      await writeFile(target, (await readFile(target, "utf8")).replaceAll("\n", "\r\n"), "utf8");
    }

    const human = await runCli(["resume", "--root", root]);
    assert.equal(human.code, 0);
    assert.match(human.stderr, /W_CONTEXT_PLACEHOLDER/);
    assert.match(human.stderr, /product\/project-memory\.md/);
    assert.match(human.stderr, /status\/current\.md/);
    assert.match(human.stderr, /checkpoints\/latest\.md/);
    assert.doesNotMatch(human.stderr, /reference\/stock-project\.md/);

    await writeFile(
      path.join(root, ".agent-context", "product", "project-memory.md"),
      "# Project brief\n\nVerified project purpose.\n",
      "utf8",
    );
    const currentStatePath = path.join(root, ".agent-context", "status", "current.md");
    const stockCurrentState = await readFile(currentStatePath, "utf8");
    await writeFile(currentStatePath, `${stockCurrentState.trimEnd()}  \r\n\r\n\r\n`, "utf8");
    const partial = await runCli(["resume", "--root", root, "--json"]);
    assert.equal(partial.code, 0);
    const partialWarning = JSON.parse(partial.stdout).diagnostics.find(
      (diagnostic) => diagnostic.code === "W_CONTEXT_PLACEHOLDER",
    );
    assert.ok(partialWarning);
    assert.doesNotMatch(partialWarning.message, /project-memory\.md/);
    assert.match(partialWarning.message, /status\/current\.md/);
    assert.match(partialWarning.message, /checkpoints\/latest\.md/);

    await writeFile(currentStatePath, "# Current state\n\nVerified current state.\n", "utf8");
    await writeFile(
      path.join(root, ".agent-context", "checkpoints", "latest.md"),
      checkpointDocument(CHECKPOINT_SECTION_NAMES),
      "utf8",
    );
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
    const reviewed = await runCli(["resume", "--root", root, "--json"]);
    assert.equal(reviewed.code, 0);
    assert.equal(
      JSON.parse(reviewed.stdout).diagnostics.some(
        (diagnostic) => diagnostic.code === "W_CONTEXT_PLACEHOLDER",
      ),
      false,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement accepts staged project changes and a checkpoint-only commit", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-success-");
  try {
    await initializeV2GitProject(root);
    await writeFile(path.join(root, "tracked.txt"), "settled project change\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
    const recorded = await readFile(path.join(root, checkpointPath), "utf8");
    assert.match(recorded, /carrylog:checkpoint-settlement:v1/);
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle staged checkpoint"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);

    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle checkpoint only"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("legacy exact snapshot freshness remains valid without settlement metadata", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-legacy-");
  try {
    await initializeV2GitProject(root);
    const handoff = await readFile(path.join(root, checkpointPath), "utf8");
    const snapshot = await inspectGitProject(root, checkpointPath);
    await writeFile(
      path.join(root, checkpointPath),
      upsertHandoffSnapshot(handoff, renderHandoffSnapshot(snapshot)),
      "utf8",
    );
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("configuration v1 handoff output remains frozen without settlement metadata", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-v1-frozen-");
  try {
    await initializeV1Project(root);
    await git(root, ["init", "-b", "main"]);
    await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(root, ["config", "user.name", "Carrylog Tests"]);
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "V1 settlement fixture"]);
    const result = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    const handoff = await readFile(path.join(root, ".agent-context", "handoff.md"), "utf8");
    assert.equal(result.settlementEligible, false);
    assert.doesNotMatch(handoff, /carrylog:checkpoint-settlement/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement supports SHA-256 Git repositories when available", async (context) => {
  const root = await createTemporaryDirectory("carrylog-settlement-sha256-");
  try {
    try {
      await git(root, ["init", "--object-format=sha256", "-b", "main"]);
    } catch {
      context.skip("installed Git does not support SHA-256 repositories");
      return;
    }
    await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(root, ["config", "user.name", "Carrylog Tests"]);
    await initProject({
      root,
      name: "SHA-256 settlement fixture",
      adapters: ["codex", "claude", "gemini"],
      adopt: false,
      dryRun: false,
    });
    await writeFile(path.join(root, "tracked.txt"), "sha256 baseline\n", "utf8");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "SHA-256 fixture baseline"]);
    await writeFile(path.join(root, "tracked.txt"), "sha256 settled change\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    const result = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(result.settlementEligible, true);
    const handoff = await readFile(path.join(root, checkpointPath), "utf8");
    assert.match(handoff, /"objectFormat":"sha256"/);
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle SHA-256 checkpoint"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement is unavailable while the project index is conflicted", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-conflict-");
  try {
    await initializeV2GitProject(root);
    await git(root, ["checkout", "-b", "conflict-side"]);
    await writeFile(path.join(root, "tracked.txt"), "side conflict\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await git(root, ["commit", "-m", "Side conflict"]);
    await git(root, ["checkout", "main"]);
    await writeFile(path.join(root, "tracked.txt"), "main conflict\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await git(root, ["commit", "-m", "Main conflict"]);
    await assert.rejects(git(root, ["merge", "conflict-side"]));
    const checkpoint = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(checkpoint.snapshot.conflicted, 1);
    assert.equal(checkpoint.settlementEligible, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement rejects unstaged capture, partial commit, and altered committed content", async () => {
  const unstaged = await createTemporaryDirectory("carrylog-settlement-unstaged-");
  const partial = await createTemporaryDirectory("carrylog-settlement-partial-");
  const altered = await createTemporaryDirectory("carrylog-settlement-altered-");
  try {
    await initializeV2GitProject(unstaged);
    await writeFile(path.join(unstaged, "tracked.txt"), "unstaged capture\n", "utf8");
    await refreshHandoff(await loadProject(unstaged), { check: false, dryRun: false });
    await git(unstaged, ["add", checkpointPath]);
    await git(unstaged, ["commit", "-m", "Commit checkpoint after dirty capture"]);
    assert.equal((await createResumeEnvelope(await loadProject(unstaged))).checkpoint.stale, true);

    await initializeV2GitProject(partial);
    await writeFile(path.join(partial, "tracked.txt"), "first staged change\n", "utf8");
    await writeFile(path.join(partial, "second.txt"), "second staged change\n", "utf8");
    await git(partial, ["add", "tracked.txt", "second.txt"]);
    await refreshHandoff(await loadProject(partial), { check: false, dryRun: false });
    await git(partial, ["restore", "--staged", "second.txt"]);
    await git(partial, ["add", checkpointPath]);
    await git(partial, ["commit", "-m", "Partially settle checkpoint"]);
    await unlink(path.join(partial, "second.txt"));
    assert.equal((await createResumeEnvelope(await loadProject(partial))).checkpoint.stale, true);

    await initializeV2GitProject(altered);
    await writeFile(path.join(altered, "tracked.txt"), "captured staged content\n", "utf8");
    await git(altered, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(altered), { check: false, dryRun: false });
    await writeFile(path.join(altered, "tracked.txt"), "altered committed content\n", "utf8");
    await git(altered, ["add", "tracked.txt", checkpointPath]);
    await git(altered, ["commit", "-m", "Commit altered checkpoint"]);
    assert.equal((await createResumeEnvelope(await loadProject(altered))).checkpoint.stale, true);
  } finally {
    await removeTemporaryDirectory(unstaged);
    await removeTemporaryDirectory(partial);
    await removeTemporaryDirectory(altered);
  }
});

test("checkpoint settlement rejects later, altered amend, merge, and dirty post-commit states", async () => {
  const later = await createTemporaryDirectory("carrylog-settlement-later-");
  const amended = await createTemporaryDirectory("carrylog-settlement-amended-");
  const merged = await createTemporaryDirectory("carrylog-settlement-merge-");
  const dirty = await createTemporaryDirectory("carrylog-settlement-dirty-");
  try {
    await commitSettledCheckpoint(later);
    await writeFile(path.join(later, "later.txt"), "later commit\n", "utf8");
    await git(later, ["add", "later.txt"]);
    await git(later, ["commit", "-m", "Later project commit"]);
    assert.equal((await createResumeEnvelope(await loadProject(later))).checkpoint.stale, true);

    await commitSettledCheckpoint(amended);
    await git(amended, ["commit", "--amend", "--no-edit"]);
    assert.equal((await createResumeEnvelope(await loadProject(amended))).checkpoint.stale, false);
    await writeFile(path.join(amended, "tracked.txt"), "amended project content\n", "utf8");
    await git(amended, ["add", "tracked.txt"]);
    await git(amended, ["commit", "--amend", "--no-edit"]);
    assert.equal((await createResumeEnvelope(await loadProject(amended))).checkpoint.stale, true);

    const base = await commitSettledCheckpoint(merged);
    await git(merged, ["branch", "settlement-side", base]);
    await git(merged, ["checkout", "settlement-side"]);
    await writeFile(path.join(merged, "side.txt"), "side branch\n", "utf8");
    await git(merged, ["add", "side.txt"]);
    await git(merged, ["commit", "-m", "Side branch commit"]);
    await git(merged, ["checkout", "main"]);
    await git(merged, ["merge", "--no-ff", "settlement-side", "-m", "Merge side branch"]);
    assert.equal((await createResumeEnvelope(await loadProject(merged))).checkpoint.stale, true);

    await commitSettledCheckpoint(dirty);
    await writeFile(path.join(dirty, "tracked.txt"), "unstaged after commit\n", "utf8");
    assert.equal((await createResumeEnvelope(await loadProject(dirty))).checkpoint.stale, true);
    await git(dirty, ["restore", "tracked.txt"]);
    await writeFile(path.join(dirty, "staged.txt"), "staged after commit\n", "utf8");
    await git(dirty, ["add", "staged.txt"]);
    assert.equal((await createResumeEnvelope(await loadProject(dirty))).checkpoint.stale, true);
    await git(dirty, ["restore", "--staged", "staged.txt"]);
    await unlink(path.join(dirty, "staged.txt"));
    await writeFile(path.join(dirty, "untracked.txt"), "untracked after commit\n", "utf8");
    assert.equal((await createResumeEnvelope(await loadProject(dirty))).checkpoint.stale, true);
    await unlink(path.join(dirty, "untracked.txt"));
    await writeFile(path.join(dirty, checkpointPath), "\n", { encoding: "utf8", flag: "a" });
    assert.equal((await createResumeEnvelope(await loadProject(dirty))).checkpoint.stale, true);
  } finally {
    await removeTemporaryDirectory(later);
    await removeTemporaryDirectory(amended);
    await removeTemporaryDirectory(merged);
    await removeTemporaryDirectory(dirty);
  }
});

test("checkpoint settlement scopes its commitment to a nested project", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-nested-");
  const nested = path.join(root, "packages", "feature");
  try {
    await mkdir(nested, { recursive: true });
    await initProject({
      root: nested,
      name: "Nested settlement fixture",
      adapters: ["codex", "claude", "gemini"],
      adopt: false,
      dryRun: false,
    });
    await writeFile(path.join(nested, "tracked.txt"), "nested baseline\n", "utf8");
    await git(root, ["init", "-b", "main"]);
    await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(root, ["config", "user.name", "Carrylog Tests"]);
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "Nested fixture baseline"]);
    await writeFile(path.join(nested, "tracked.txt"), "nested settled change\n", "utf8");
    await git(nested, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(nested), { check: false, dryRun: false });
    await git(nested, ["add", checkpointPath]);
    await git(nested, ["commit", "-m", "Settle nested checkpoint"]);
    assert.equal((await createResumeEnvelope(await loadProject(nested))).checkpoint.stale, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement ignores files outside the Git-visible evidence boundary", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-ignored-");
  try {
    await initializeV2GitProject(root);
    await writeFile(path.join(root, ".gitignore"), "ignored-output/\n", "utf8");
    await git(root, ["add", ".gitignore"]);
    await git(root, ["commit", "-m", "Add ignored-output policy"]);
    await mkdir(path.join(root, "ignored-output"));
    await writeFile(path.join(root, "ignored-output", "artifact.bin"), "ignored\n", "utf8");
    await writeFile(path.join(root, "tracked.txt"), "settled with ignored output\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    const checkpoint = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(checkpoint.snapshot.untracked, 0);
    assert.equal(checkpoint.settlementEligible, true);
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle with ignored output"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement cannot hide dirty submodules through repository ignore config", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-submodule-");
  const source = await createTemporaryDirectory("carrylog-settlement-submodule-source-");
  const child = path.join(root, "vendor", "child");
  try {
    await git(source, ["init", "-b", "main"]);
    await git(source, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(source, ["config", "user.name", "Carrylog Tests"]);
    await writeFile(path.join(source, "child.txt"), "submodule baseline\n", "utf8");
    await git(source, ["add", "child.txt"]);
    await git(source, ["commit", "-m", "Submodule baseline"]);

    await initializeV2GitProject(root);
    await git(root, [
      "-c",
      "protocol.file.allow=always",
      "submodule",
      "add",
      source,
      "vendor/child",
    ]);
    await git(root, ["add", ".gitmodules", "vendor/child"]);
    await git(root, ["commit", "-m", "Add submodule fixture"]);
    await git(root, ["config", "submodule.vendor/child.ignore", "all"]);

    await writeFile(path.join(child, "child.txt"), "dirty before capture\n", "utf8");
    const ineligible = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(ineligible.snapshot.unstaged, 1);
    assert.equal(ineligible.settlementEligible, false);

    await git(child, ["restore", "child.txt"]);
    await writeFile(path.join(root, "tracked.txt"), "settled with clean submodule\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    const eligible = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(eligible.settlementEligible, true);
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle checkpoint with submodule"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);

    await writeFile(path.join(child, "child.txt"), "dirty after settlement\n", "utf8");
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, true);
  } finally {
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(source);
  }
});

test("checkpoint settlement accepts a detached transition and rejects attaching a branch", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-detached-");
  try {
    await initializeV2GitProject(root);
    await git(root, ["checkout", "--detach"]);
    await writeFile(path.join(root, "tracked.txt"), "detached settled change\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    const checkpoint = await refreshHandoff(await loadProject(root), {
      check: false,
      dryRun: false,
    });
    assert.equal(checkpoint.settlementEligible, true);
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle detached checkpoint"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
    await git(root, ["switch", "-c", "attached-after-settlement"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, true);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("checkpoint settlement survives push and fresh clone but rejects a branch transition", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-upstream-");
  const remote = await createTemporaryDirectory("carrylog-settlement-remote-");
  const cloneParent = await createTemporaryDirectory("carrylog-settlement-clone-");
  const clone = path.join(cloneParent, "project");
  try {
    await initializeV2GitProject(root);
    await git(remote, ["init", "--bare"]);
    await git(root, ["remote", "add", "origin", remote]);
    await git(root, ["push", "-u", "origin", "main"]);
    await git(remote, ["symbolic-ref", "HEAD", "refs/heads/main"]);
    await writeFile(path.join(root, "tracked.txt"), "upstream settled change\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Settle with upstream"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
    await git(root, ["push"]);
    await git(cloneParent, ["-c", "core.autocrlf=true", "clone", remote, clone]);
    await git(clone, ["config", "core.autocrlf", "true"]);
    for (const generatedPath of [PUBLIC_SCHEMA_PATH, AGENT_SKILL_PATH, CLAUDE_SKILL_PATH]) {
      assert.match(
        await readFile(path.join(clone, ...generatedPath.split("/")), "utf8"),
        /\r\n/,
        `${generatedPath} must exercise an autocrlf checkout`,
      );
    }
    const clonedProject = await loadProject(clone);
    assert.equal(
      (await syncProject(clonedProject, { adopt: false, check: true, dryRun: false })).drift,
      false,
    );
    assert.equal((await createResumeEnvelope(clonedProject)).checkpoint.stale, false);
    await git(root, ["checkout", "-b", "different-branch"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, true);
  } finally {
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(remote);
    await removeTemporaryDirectory(cloneParent);
  }
});

test("malformed or object-format-mismatched metadata cannot make a checkpoint fresh", async () => {
  const root = await createTemporaryDirectory("carrylog-settlement-malformed-");
  const mismatched = await createTemporaryDirectory("carrylog-settlement-object-mismatch-");
  try {
    await initializeV2GitProject(root);
    await writeFile(path.join(root, "tracked.txt"), "captured project change\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
    const handoff = await readFile(path.join(root, checkpointPath), "utf8");
    await writeFile(
      path.join(root, checkpointPath),
      handoff.replace('"indexCommitment"', '"invalidCommitment"'),
      "utf8",
    );
    await git(root, ["add", checkpointPath]);
    await git(root, ["commit", "-m", "Commit malformed settlement metadata"]);
    assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, true);

    await initializeV2GitProject(mismatched);
    await writeFile(path.join(mismatched, "tracked.txt"), "captured object format\n", "utf8");
    await git(mismatched, ["add", "tracked.txt"]);
    await refreshHandoff(await loadProject(mismatched), { check: false, dryRun: false });
    const formatHandoff = await readFile(path.join(mismatched, checkpointPath), "utf8");
    const changedFormat = formatHandoff.replace(
      /"objectFormat":"sha1","baseHead":"([0-9a-f]{40})"/,
      (_match, baseHead) => `"objectFormat":"sha256","baseHead":"${baseHead}${"0".repeat(24)}"`,
    );
    assert.notEqual(changedFormat, formatHandoff);
    await writeFile(path.join(mismatched, checkpointPath), changedFormat, "utf8");
    await git(mismatched, ["add", checkpointPath]);
    await git(mismatched, ["commit", "-m", "Commit mismatched object format"]);
    assert.equal(
      (await createResumeEnvelope(await loadProject(mismatched))).checkpoint.stale,
      true,
    );
  } finally {
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(mismatched);
  }
});

test("portable resume rejects configuration v1 with migration guidance", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-v1-");
  try {
    await initializeV1Project(root);
    const result = await runCli(["resume", "--root", root, "--json"]);
    assert.equal(result.code, 1);
    const error = JSON.parse(result.stderr);
    assert.equal(error.code, "E_RESUME_REQUIRES_V2");
    assert.match(error.diagnostics[0].hint, /migrate --to 2/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume enforces an aggregate canonical-context read budget", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-aggregate-");
  try {
    await initializeV2GitProject(root);
    const loaded = await loadProject(root);
    const config = structuredClone(loaded.config);
    for (let index = 0; index < 9; index += 1) {
      const id = `large-${index}`;
      const documentPath = `${id}.md`;
      config.documents.push({
        id,
        path: documentPath,
        load: "on-demand",
        description: `Large aggregate fixture ${index}`,
        triggers: [`large fixture ${index}`],
      });
      await mkdir(path.join(root, ".agent-context"), { recursive: true });
      await writeFile(
        path.join(root, ".agent-context", documentPath),
        "x".repeat(1024 * 1024 - 1),
        "utf8",
      );
    }
    await writeProjectConfig(root, config);
    await syncProject(await loadProject(root), { adopt: false, check: false, dryRun: false });

    await assert.rejects(
      async () => createResumeEnvelope(await loadProject(root)),
      (error) => error.code === "E_CONTEXT_AGGREGATE_TOO_LARGE",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume JSON escapes Git-controlled Unicode controls while preserving their values", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-json-controls-");
  try {
    await initializeV2GitProject(root);
    const hostileCharacters = [
      "\u0007",
      "\u007f",
      "\u0085",
      "\u200e",
      "\u2028",
      "\u2029",
      "\u{e0001}",
    ];
    const hostileSubject = `hostile subject \t${hostileCharacters.join("")}`;
    await writeFile(path.join(root, "tracked.txt"), "hostile commit subject\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await git(root, ["commit", "-m", hostileSubject]);

    const hostilePathCharacters =
      process.platform === "win32"
        ? hostileCharacters.filter((character) => character.codePointAt(0) >= 0x20)
        : ["\t", "\n", "\r", ...hostileCharacters];
    const hostilePath = `hostile-${hostilePathCharacters.join("")}.txt`;
    await writeFile(path.join(root, hostilePath), "hostile path\n", "utf8");
    const result = await runCli(["resume", "--root", root, "--json"]);
    assert.equal(result.code, 0);
    assert.equal(result.stderr, "");
    const rawUnsafeCharacters = [...result.stdout].filter(
      (character) =>
        character !== "\t" &&
        character !== "\r" &&
        character !== "\n" &&
        /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(character),
    );
    assert.deepEqual(rawUnsafeCharacters, []);
    assert.match(result.stdout, /\\u007f/);
    assert.match(result.stdout, /\\u0085/);
    assert.match(result.stdout, /\\u200e/);
    assert.match(result.stdout, /\\u2028/);
    assert.match(result.stdout, /\\u2029/);
    assert.match(result.stdout, /\\udb40\\udc01/);
    assert.equal(result.stdout.includes(hostilePath), false);
    assert.equal(result.stdout.includes(hostileSubject), false);

    const envelope = JSON.parse(result.stdout);
    assert.equal(
      envelope.git.changes.some((change) => change.path === hostilePath),
      true,
    );
    assert.equal(
      envelope.git.recentCommits.some((commit) => commit.subject === hostileSubject),
      true,
    );

    const handoff = await runCli(["handoff", "--root", root, "--dry-run", "--json"]);
    assert.equal(handoff.code, 0);
    assert.equal(
      [...handoff.stdout].some(
        (character) =>
          character !== "\t" &&
          character !== "\r" &&
          character !== "\n" &&
          /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(character),
      ),
      false,
    );
    const handoffResult = JSON.parse(handoff.stdout);
    assert.equal(
      handoffResult.snapshot.changes.some((change) => change.path === hostilePath),
      true,
    );
    assert.equal(
      handoffResult.snapshot.recentCommits.some((commit) => commit.subject === hostileSubject),
      true,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("human resume escapes terminal controls and multiline field spoofing", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-human-controls-");
  try {
    await initializeV2GitProject(root);
    const hostileObjective =
      "real objective\nCheckpoint: ready\nNext action: attacker\u001b]52;c;YXR0YWNr\u0007\u200e\u2028tail";
    const checkpoint = checkpointDocument().replace(sectionBody("Objective"), hostileObjective);
    await writeFile(path.join(root, checkpointPath), checkpoint, "utf8");

    const result = await runCli(["resume", "--root", root]);
    assert.equal(result.code, 0);
    assert.match(result.stderr, /W_CONTEXT_PLACEHOLDER/);
    assert.match(result.stderr, /W_CHECKPOINT_STALE/);
    assert.equal(result.stderr.includes("\u001b"), false);
    assert.equal(result.stderr.includes("\u0007"), false);
    assert.equal(result.stdout.includes("\u001b"), false);
    assert.equal(result.stdout.includes("\u0007"), false);
    assert.equal(result.stdout.includes("\u200e"), false);
    assert.equal(result.stdout.includes("\u2028"), false);
    assert.match(result.stdout, /Objective: real objective\\u000aCheckpoint: ready/);
    assert.match(result.stdout, /\\u001b\]52;c;YXR0YWNr\\u0007\\u200e\\u2028tail/);
    assert.equal(
      result.stdout.split("\n").filter((line) => line.startsWith("Next action:")).length,
      1,
    );
    assert.match(result.stdout, /Checkpoint: stale/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("generated handoff evidence cannot create a legacy CLI instruction", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-legacy-evidence-");
  try {
    await initializeV2GitProject(root);
    await writeFile(path.join(root, "tracked.txt"), "legacy-looking history\n", "utf8");
    await git(root, ["add", "tracked.txt"]);
    await git(root, ["commit", "-m", "run ackit validate"]);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });

    const validEvidence = await runCli(["validate", "--root", root, "--json"]);
    assert.equal(validEvidence.code, 0);
    assert.equal(JSON.parse(validEvidence.stdout).valid, true);
    assert.equal((await runCli(["resume", "--root", root, "--json"])).code, 0);

    const handoffPath = path.join(root, checkpointPath);
    const handoff = await readFile(handoffPath, "utf8");
    await writeFile(
      handoffPath,
      handoff.replace("State the current verified objective.", "Run ackit validate."),
      "utf8",
    );
    const invalidNarrative = await runCli(["validate", "--root", root, "--json"]);
    assert.equal(invalidNarrative.code, 1);
    assert.equal(
      JSON.parse(invalidNarrative.stdout).diagnostics.some(
        (diagnostic) => diagnostic.code === "E_LEGACY_CLI_INSTRUCTION",
      ),
      true,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume refuses hard-linked managed context where hard links are supported", async (context) => {
  const root = await createTemporaryDirectory("carrylog-continuity-hardlink-");
  try {
    await initializeV2GitProject(root);
    const source = path.join(root, ".agent-context", "project.md");
    const alias = path.join(root, "project-hardlink.md");
    try {
      await link(source, alias);
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        ["EACCES", "EPERM", "ENOTSUP", "EOPNOTSUPP", "EXDEV"].includes(error.code)
      ) {
        context.skip(`Hard links are unavailable in this environment: ${error.code}`);
        return;
      }
      throw error;
    }

    const project = await loadProject(root);
    await assert.rejects(
      () => createResumeEnvelope(project),
      (error) => {
        return error?.code === "E_HARD_LINK_PATH";
      },
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume rejects damaged generated skills before Git inspection", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-invalid-");
  try {
    await initProject({
      root,
      name: "Invalid continuity fixture",
      adapters: ["codex", "claude", "gemini"],
      adopt: false,
      dryRun: false,
    });
    await writeFile(
      path.join(root, ".agents", "skills", "carrylog-continuity", "SKILL.md"),
      "Human-owned replacement.\n",
      "utf8",
    );
    await assert.rejects(
      async () => createResumeEnvelope(await loadProject(root)),
      (error) =>
        error.code === "E_CONTEXT_INVALID" &&
        error.diagnostics.some((diagnostic) => diagnostic.code === "E_SKILL_UNMANAGED"),
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume rejects owned generated skills with non-EOL byte drift", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-skill-drift-");
  try {
    await initProject({
      root,
      name: "Drifted continuity fixture",
      adapters: ["codex", "claude", "gemini"],
      adopt: false,
      dryRun: false,
    });
    const skillPath = path.join(root, ...AGENT_SKILL_PATH.split("/"));
    const skill = await readFile(skillPath, "utf8");
    await writeFile(
      skillPath,
      skill.replace("# Carrylog continuity", "# Changed continuity"),
      "utf8",
    );
    await assert.rejects(
      async () => createResumeEnvelope(await loadProject(root)),
      (error) =>
        error.code === "E_CONTEXT_INVALID" &&
        error.diagnostics.some((diagnostic) => diagnostic.code === "E_SKILL_DRIFT"),
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("resume deduplicates warnings and projects detached Git without machine-local metadata", async () => {
  const root = await createTemporaryDirectory("carrylog-continuity-detached-");
  try {
    await initializeV2GitProject(root);
    await writeFile(path.join(root, ".agent-context", "architecture.md"), "", "utf8");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "Empty optional architecture"]);
    await git(root, ["checkout", "--detach", "HEAD"]);
    await refreshHandoff(await loadProject(root), { check: false, dryRun: false });

    const envelope = await createResumeEnvelope(await loadProject(root));
    assert.equal(envelope.git.detached, true);
    assert.equal(Object.hasOwn(envelope.git, "branch"), false);
    assert.equal(Object.hasOwn(envelope.git, "upstream"), false);
    assert.equal(
      envelope.diagnostics.filter((diagnostic) => diagnostic.code === "W_DOCUMENT_EMPTY").length,
      1,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

function checkpointDocument(order = CHECKPOINT_SECTION_NAMES, prelude = []) {
  return [
    "# Handoff",
    "",
    ...prelude,
    ...(prelude.length === 0 ? [] : [""]),
    ...order.flatMap((name) => [`## ${name}`, "", sectionBody(name), ""]),
  ].join("\n");
}

function sectionBody(name) {
  return `verified ${name.toLowerCase()} content`;
}

function diagnosticCodes(content) {
  return validateCheckpointStructure(content, checkpointPath).map((diagnostic) => diagnostic.code);
}

async function initializeV2GitProject(root) {
  await initProject({
    root,
    name: "Continuity fixture",
    adapters: ["codex", "claude", "gemini"],
    adopt: false,
    dryRun: false,
  });
  await writeFile(path.join(root, "tracked.txt"), "checkpoint baseline\n", "utf8");
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
  await git(root, ["config", "user.name", "Carrylog Tests"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-m", "Continuity fixture"]);
}

async function initializeV1Project(root) {
  const config = createDefaultConfig("V1 resume fixture", ["codex", "claude"]);
  for (const file of createTemplateFiles(config)) {
    const target = path.join(root, ...file.path.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
  for (const adapter of config.adapters) {
    await writeFile(
      path.join(root, adapter.output),
      upsertManagedBlock(undefined, renderAdapter(config, adapter), { adopt: false }),
      "utf8",
    );
  }
}

async function commitSettledCheckpoint(root) {
  await initializeV2GitProject(root);
  const base = (await gitOutput(root, ["rev-parse", "HEAD"])).stdout.trim();
  await writeFile(path.join(root, "tracked.txt"), "settled project change\n", "utf8");
  await git(root, ["add", "tracked.txt"]);
  await refreshHandoff(await loadProject(root), { check: false, dryRun: false });
  await git(root, ["add", checkpointPath]);
  await git(root, ["commit", "-m", "Settle project checkpoint"]);
  assert.equal((await createResumeEnvelope(await loadProject(root))).checkpoint.stale, false);
  return base;
}

async function git(root, arguments_) {
  await gitOutput(root, arguments_);
}

async function gitOutput(root, arguments_) {
  return await execFileAsync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
}

async function runCli(arguments_) {
  return await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...arguments_], {
      cwd: path.dirname(cli),
      env: { ...process.env, NO_COLOR: "1" },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function findForbiddenMetadataKeys(value, pathParts = []) {
  if (value === null || typeof value !== "object") return [];
  const findings = [];
  for (const [key, nested] of Object.entries(value)) {
    const current = [...pathParts, key];
    if (/^(?:committedAt|timestamp|sessionId|absolutePath|root)$/i.test(key)) {
      findings.push(current.join("."));
    }
    findings.push(...findForbiddenMetadataKeys(nested, current));
  }
  return findings;
}
