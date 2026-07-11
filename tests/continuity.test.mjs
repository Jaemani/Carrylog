import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { link, mkdir, readFile, writeFile } from "node:fs/promises";
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
import { renderAgentContinuitySkill } from "../dist/continuity/skills.js";
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
  assert.match(skill, /node dist\/cli\.js resume --json/);
  assert.match(skill, /node dist\/cli\.js resume --help/);
  assert.match(skill, /npx --no-install carrylog resume --help/);
  assert.match(skill, /carrylog resume --help/);
  const source = skill.indexOf("node dist/cli.js resume --json");
  const pinned = skill.indexOf("npx --no-install carrylog resume --json");
  const compatibleGlobal = skill.lastIndexOf("carrylog resume --help");
  assert.equal(source >= 0 && source < pinned && pinned < compatibleGlobal, true);
  assert.match(skill, /selected version lacks `resume`/);
  assert.match(skill, /do not fall through to a different global version/);
  assert.doesNotMatch(skill, /npx --yes|npm install/);
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
    assert.deepEqual(envelope.diagnostics, []);
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
    assert.equal(result.stderr, "");
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

async function git(root, arguments_) {
  await execFileAsync("git", arguments_, {
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
