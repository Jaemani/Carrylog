import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  inspectGitProjectWithRunner,
  parseGitNumstat,
  parseGitStatus,
  runGitProcess,
} from "../dist/git/inspect.js";
import {
  HANDOFF_SNAPSHOT_END,
  HANDOFF_SNAPSHOT_START,
  initProject,
  inspectGitProject,
  loadProject,
  refreshHandoff,
  renderHandoffSnapshot,
  upsertHandoffSnapshot,
  validateProject,
} from "../dist/index.js";
import {
  createTemporaryDirectory,
  diagnosticCodes,
  removeTemporaryDirectory,
  writeProjectConfig,
} from "./helpers.mjs";

const execFileAsync = promisify(execFile);

function createVersionedGitRunner(versions) {
  let observationCount = 0;
  let version = versions[0];
  const run = async (_root, arguments_) => {
    if (arguments_[0] === "rev-parse" && arguments_[1] === "--is-inside-work-tree") {
      return gitResult("true\n");
    }
    if (arguments_[0] === "symbolic-ref") {
      version = versions[observationCount] ?? versions.at(-1);
      observationCount += 1;
      return gitResult(`main-${version}\n`);
    }
    if (arguments_[0] === "rev-parse" && arguments_[1] === "--show-prefix") {
      return gitResult("");
    }
    if (arguments_[0] === "show") return gitResult(commitLine(version));
    if (arguments_[0] === "rev-parse" && arguments_.includes("@{upstream}")) {
      return gitResult("origin/main\n");
    }
    if (arguments_[0] === "rev-list") return gitResult(`${versionNumber(version)}\t0\n`);
    if (arguments_.includes("status")) {
      return gitResult(`MM tracked-${version}.txt\0`);
    }
    if (arguments_[0] === "diff" && arguments_.includes("--cached")) {
      return gitResult(`${versionNumber(version)}\t0\ttracked-${version}.txt\0`);
    }
    if (arguments_[0] === "diff") {
      return gitResult(`0\t${versionNumber(version)}\ttracked-${version}.txt\0`);
    }
    if (arguments_[0] === "log") return gitResult(commitLine(version));
    throw new Error(`Unexpected fake Git command: ${arguments_.join(" ")}`);
  };
  return { run, getObservationCount: () => observationCount };
}

function gitResult(stdout, code = 0, stderr = "") {
  return { code, stdout: Buffer.from(stdout), stderr: Buffer.from(stderr) };
}

function commitLine(version) {
  const sha = version.repeat(40);
  return `${sha}\t${version.repeat(7)}\t2026-07-10T00:00:00+00:00\tcommit ${version}\n`;
}

function versionNumber(version) {
  return version.charCodeAt(0) - "a".charCodeAt(0) + 1;
}

async function git(root, arguments_) {
  return await execFileAsync("git", arguments_, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", LC_ALL: "C" },
  });
}

async function initializeGitProject(root, options = {}) {
  await git(root, ["init", "-b", "main"]);
  await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
  await git(root, ["config", "user.name", "Carrylog Tests"]);
  await initProject({ root, adapters: ["codex"], adopt: false, dryRun: false });
  await writeFile(path.join(root, "tracked.txt"), "initial\n", "utf8");
  if (options.commit !== false) {
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "initial fixture"]);
  }
}

test("handoff refresh is deterministic and excludes its own file", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    const project = await loadProject(root);
    const checked = await refreshHandoff(project, { check: true, dryRun: false });
    assert.equal(checked.drift, true);
    assert.equal(checked.wrote, false);

    const refreshed = await refreshHandoff(project, { check: false, dryRun: false });
    assert.equal(refreshed.wrote, true);
    assert.equal(refreshed.snapshot.branch, "main");
    assert.equal(refreshed.snapshot.changes.length, 0);
    const content = await readFile(path.join(root, ".agent-context", "handoff.md"), "utf8");
    assert.match(content, /## Repository evidence/);
    assert.match(content, /initial fixture/);

    const repeated = await refreshHandoff(project, { check: false, dryRun: false });
    assert.equal(repeated.drift, false);
    assert.equal(repeated.wrote, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("snapshot reports staged, unstaged, untracked, rename, and unusual paths", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    await writeFile(path.join(root, "tracked.txt"), "modified\n", "utf8");
    await writeFile(path.join(root, "staged file.txt"), "staged\n", "utf8");
    await git(root, ["add", "staged file.txt"]);
    await writeFile(path.join(root, "한글 untracked.txt"), "untracked\n", "utf8");

    const snapshot = await inspectGitProject(root, ".agent-context/handoff.md");
    assert.equal(snapshot.staged, 1);
    assert.equal(snapshot.unstaged, 1);
    assert.equal(snapshot.untracked, 1);
    assert.deepEqual(snapshot.stagedDiff, {
      files: 1,
      insertions: 1,
      deletions: 0,
      binaryFiles: 0,
    });
    assert.deepEqual(snapshot.unstagedDiff, {
      files: 1,
      insertions: 1,
      deletions: 1,
      binaryFiles: 0,
    });
    const rendered = renderHandoffSnapshot(snapshot);
    assert.match(rendered, /staged file\.txt/);
    assert.match(rendered, /한글 untracked\.txt/);

    await git(root, ["mv", "tracked.txt", "renamed.txt"]);
    const renamed = await inspectGitProject(root, ".agent-context/handoff.md");
    const rename = renamed.changes.find((change) => change.status.includes("R"));
    assert.equal(rename.path, "renamed.txt");
    assert.equal(rename.originalPath, "tracked.txt");

    if (process.platform !== "win32") {
      await writeFile(path.join(root, "line\nbreak.txt"), "newline path\n", "utf8");
      const newline = await inspectGitProject(root, ".agent-context/handoff.md");
      assert.match(renderHandoffSnapshot(newline), /line\\nbreak\.txt/);
    }
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("snapshot handles unborn and detached HEAD states", async () => {
  const unbornRoot = await createTemporaryDirectory();
  const detachedRoot = await createTemporaryDirectory();
  try {
    await initializeGitProject(unbornRoot, { commit: false });
    const unborn = await inspectGitProject(unbornRoot, ".agent-context/handoff.md");
    assert.equal(unborn.branch, "main");
    assert.equal(unborn.head, undefined);
    assert.deepEqual(unborn.recentCommits, []);

    await initializeGitProject(detachedRoot);
    await git(detachedRoot, ["checkout", "--detach"]);
    const detached = await inspectGitProject(detachedRoot, ".agent-context/handoff.md");
    assert.equal(detached.detached, true);
    assert.equal(detached.branch, undefined);
    assert.notEqual(detached.head, undefined);
  } finally {
    await removeTemporaryDirectory(unbornRoot);
    await removeTemporaryDirectory(detachedRoot);
  }
});

test("snapshot caps rendered paths while preserving aggregate counts", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    const directory = path.join(root, "many");
    await mkdir(directory);
    await Promise.all(
      Array.from({ length: 205 }, (_, index) =>
        writeFile(path.join(directory, `${String(index).padStart(3, "0")}.txt`), "x", "utf8"),
      ),
    );
    const snapshot = await inspectGitProject(root, ".agent-context/handoff.md");
    assert.equal(snapshot.changes.length, 200);
    assert.equal(snapshot.omittedChanges, 5);
    assert.equal(snapshot.untracked, 205);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("handoff rejects non-Git projects and missing handoff configuration", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initProject({ root, adapters: ["codex"], adopt: false, dryRun: false });
    let project = await loadProject(root);
    await assert.rejects(
      () => refreshHandoff(project, { check: false, dryRun: false }),
      (error) => error.code === "E_NOT_GIT_REPOSITORY",
    );
    const config = structuredClone(project.config);
    config.documents = config.documents.filter((document) => document.id !== "handoff");
    await writeProjectConfig(root, config);
    project = await loadProject(root);
    await assert.rejects(
      () => refreshHandoff(project, { check: false, dryRun: false }),
      (error) => error.code === "E_HANDOFF_DOCUMENT",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("handoff markers preserve CRLF and reject partial or duplicate blocks", () => {
  const base = "# Handoff\r\n\r\nHuman narrative\r\n";
  const once = upsertHandoffSnapshot(base, "## Repository evidence\n\nClean.");
  assert.match(once, /handoff-snapshot:start -->\r\n## Repository evidence/);
  const twice = upsertHandoffSnapshot(once, "## Repository evidence\n\nUpdated.");
  assert.match(twice, /Updated\./);
  assert.match(twice, /Human narrative/);
  assert.throws(
    () => upsertHandoffSnapshot(`${HANDOFF_SNAPSHOT_START}\n`, "body"),
    (error) => error.code === "E_HANDOFF_MARKERS",
  );
  assert.throws(
    () =>
      upsertHandoffSnapshot(
        `${HANDOFF_SNAPSHOT_START}\n${HANDOFF_SNAPSHOT_END}\n${HANDOFF_SNAPSHOT_START}\n${HANDOFF_SNAPSHOT_END}`,
        "body",
      ),
    (error) => error.code === "E_HANDOFF_MARKERS",
  );
  const embedded = upsertHandoffSnapshot(
    `# Handoff\n\nMention ${HANDOFF_SNAPSHOT_START} inline.\n`,
    "body",
  );
  assert.match(embedded, /Mention .*handoff-snapshot:start.* inline/);
  assert.throws(
    () => upsertHandoffSnapshot("# Handoff\n", HANDOFF_SNAPSHOT_START),
    (error) => error.code === "E_HANDOFF_BODY_MARKER",
  );
  assert.throws(
    () =>
      upsertHandoffSnapshot(`${HANDOFF_SNAPSHOT_END}\nbody\n${HANDOFF_SNAPSHOT_START}\n`, "body"),
    (error) => error.code === "E_HANDOFF_MARKERS",
  );
});

test("handoff rendering safely escapes invisible Unicode without losing evidence", () => {
  const hostilePath = `before\u2028${HANDOFF_SNAPSHOT_START}\u2029after\u202efile.txt`;
  const rendered = renderHandoffSnapshot({
    branch: "main\u2066spoof",
    detached: false,
    changes: [{ status: "??", path: hostilePath }],
    omittedChanges: 0,
    staged: 0,
    unstaged: 0,
    untracked: 1,
    conflicted: 0,
    stagedDiff: { files: 0, insertions: 0, deletions: 0, binaryFiles: 0 },
    unstagedDiff: { files: 0, insertions: 0, deletions: 0, binaryFiles: 0 },
    recentCommits: [],
  });
  assert.doesNotMatch(rendered, /[\u2028\u2029\u202e\u2066]/u);
  assert.match(rendered, /before\\u2028.*\\u2029after\\u202efile\.txt/);
  const record = rendered.split("\n").find((line) => line.includes('"status":"??"'));
  assert.equal(JSON.parse(record.trim()).path, hostilePath);
  assert.doesNotThrow(() => upsertHandoffSnapshot("# Handoff\n", rendered));
});

test("handoff validates the prospective context budget before writing", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    let project = await loadProject(root);
    const handoffPath = path.join(root, ".agent-context", "handoff.md");
    const before = await readFile(handoffPath, "utf8");
    const alwaysContents = await Promise.all(
      project.config.documents
        .filter((document) => document.load === "always")
        .map((document) => readFile(path.join(root, ".agent-context", document.path), "utf8")),
    );
    const config = structuredClone(project.config);
    config.policies.maxAlwaysCharacters = alwaysContents.reduce(
      (total, content) => total + content.length,
      0,
    );
    await writeProjectConfig(root, config);
    project = await loadProject(root);

    await assert.rejects(
      () => refreshHandoff(project, { check: false, dryRun: false }),
      (error) =>
        error.code === "E_HANDOFF_CONTEXT_INVALID" &&
        error.diagnostics.some((diagnostic) => diagnostic.code === "E_ALWAYS_BUDGET_EXCEEDED"),
    );
    assert.equal(await readFile(handoffPath, "utf8"), before);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("handoff rejects a configuration changed after project loading", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    const project = await loadProject(root);
    const handoffPath = path.join(root, ".agent-context", "handoff.md");
    const before = await readFile(handoffPath, "utf8");
    await writeFile(project.configPath, `${project.configSource}\n# concurrent edit\n`, "utf8");
    for (const options of [
      { check: true, dryRun: false },
      { check: false, dryRun: true },
      { check: false, dryRun: false },
    ]) {
      await assert.rejects(
        () => refreshHandoff(project, options),
        (error) => error.code === "E_CONCURRENT_MODIFICATION",
      );
    }
    assert.equal(await readFile(handoffPath, "utf8"), before);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("validate reports damaged handoff evidence markers without invoking Git", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initProject({ root, adapters: ["codex"], adopt: false, dryRun: false });
    await writeFile(
      path.join(root, ".agent-context", "handoff.md"),
      `# Handoff\n\n${HANDOFF_SNAPSHOT_START}\nmissing end\n`,
      "utf8",
    );
    const result = await validateProject(await loadProject(root));
    assert.equal(result.valid, false);
    assert.equal(diagnosticCodes(result).includes("E_HANDOFF_MARKERS"), true);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("porcelain parser preserves invalid UTF-8 paths as reversible hex", () => {
  const status = Buffer.concat([
    Buffer.from("?? ", "ascii"),
    Buffer.from([0xff]),
    Buffer.from([0]),
    Buffer.from("?? ", "ascii"),
    Buffer.from([0xfe]),
    Buffer.from([0]),
  ]);
  const parsed = parseGitStatus(status);
  assert.deepEqual(
    parsed.changes.map((change) => ({ path: change.path, encoding: change.pathEncoding })),
    [
      { path: "fe", encoding: "hex" },
      { path: "ff", encoding: "hex" },
    ],
  );
});

test("porcelain and numstat parsers cover conflicts, mixed states, binary files, and overflow", () => {
  const parsed = parseGitStatus(
    Buffer.from("MM both.txt\0UU conflict.txt\0 D deleted.txt\0T  type.txt\0"),
  );
  assert.equal(parsed.staged, 3);
  assert.equal(parsed.unstaged, 3);
  assert.equal(parsed.conflicted, 1);
  assert.deepEqual(parseGitNumstat(Buffer.from("2\t1\ttext.txt\0-\t-\tbinary.bin\0")), {
    files: 2,
    insertions: 2,
    deletions: 1,
    binaryFiles: 1,
  });
  assert.throws(
    () => parseGitNumstat(Buffer.from("x\t1\tbad.txt\0")),
    (error) => error.code === "E_GIT_DIFF_FORMAT",
  );
  assert.throws(
    () => parseGitNumstat(Buffer.from("999999999999999999999\t1\tlarge.txt\0")),
    (error) => error.code === "E_GIT_DIFF_FORMAT",
  );
});

test("Git inspection retries mixed observations and returns only a stable snapshot", async () => {
  const fake = createVersionedGitRunner(["a", "b", "c", "c"]);
  const snapshot = await inspectGitProjectWithRunner(
    "/fake/project",
    ".agent-context/handoff.md",
    fake.run,
  );

  assert.equal(fake.getObservationCount(), 4);
  assert.equal(snapshot.branch, "main-c");
  assert.equal(snapshot.head.shortSha, "ccccccc");
  assert.equal(snapshot.ahead, 3);
  assert.deepEqual(snapshot.changes, [{ status: "MM", path: "tracked-c.txt" }]);
  assert.deepEqual(snapshot.stagedDiff, {
    files: 1,
    insertions: 3,
    deletions: 0,
    binaryFiles: 0,
  });
  assert.deepEqual(snapshot.unstagedDiff, {
    files: 1,
    insertions: 0,
    deletions: 3,
    binaryFiles: 0,
  });
  assert.equal(snapshot.recentCommits[0].shortSha, "ccccccc");
});

test("Git inspection fails closed after bounded concurrent modifications", async () => {
  const fake = createVersionedGitRunner(["a", "b", "c", "d", "e", "f"]);
  await assert.rejects(
    () => inspectGitProjectWithRunner("/fake/project", ".agent-context/handoff.md", fake.run),
    (error) => error.code === "E_GIT_CONCURRENT_MODIFICATION",
  );
  assert.equal(fake.getObservationCount(), 6);
});

test("Git subprocess runner enforces combined output and hard timeout bounds", async () => {
  const root = await createTemporaryDirectory();
  try {
    await assert.rejects(
      () =>
        runGitProcess(
          root,
          ["-e", "process.stdout.write('x'.repeat(80));process.stderr.write('y'.repeat(80))"],
          { command: process.execPath, maxOutputBytes: 100, timeoutMs: 2_000 },
        ),
      (error) => error.code === "E_GIT_OUTPUT_LIMIT",
    );
    await assert.rejects(
      () =>
        runGitProcess(root, ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"], {
          command: process.execPath,
          timeoutMs: 50,
          terminationGraceMs: 25,
        }),
      (error) => error.code === "E_GIT_TIMEOUT",
    );
    await assert.rejects(
      () => runGitProcess(root, [], { command: "carrylog-definitely-missing-git" }),
      (error) => error.code === "E_GIT_UNAVAILABLE",
    );
    await assert.rejects(() => runGitProcess(root, [], { timeoutMs: 0 }), TypeError);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("Git inspection ignores repository-selection environment overrides", async () => {
  const root = await createTemporaryDirectory();
  const previous = {
    GIT_DIR: process.env.GIT_DIR,
    GIT_INDEX_FILE: process.env.GIT_INDEX_FILE,
    GIT_CONFIG_COUNT: process.env.GIT_CONFIG_COUNT,
  };
  try {
    await initializeGitProject(root);
    process.env.GIT_DIR = path.join(root, "missing-git-dir");
    process.env.GIT_INDEX_FILE = path.join(root, "missing-index");
    process.env.GIT_CONFIG_COUNT = "999";
    const snapshot = await inspectGitProject(root, ".agent-context/handoff.md");
    assert.equal(snapshot.branch, "main");
    assert.equal(snapshot.changes.length, 0);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    await removeTemporaryDirectory(root);
  }
});

test("nested projects report only project-relative Git paths", async () => {
  const root = await createTemporaryDirectory();
  try {
    await git(root, ["init", "-b", "main"]);
    await git(root, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(root, ["config", "user.name", "Carrylog Tests"]);
    const projectRoot = path.join(root, "packages", "project");
    await mkdir(projectRoot, { recursive: true });
    await initProject({ root: projectRoot, adapters: ["codex"], adopt: false, dryRun: false });
    await writeFile(path.join(projectRoot, "inside.txt"), "initial\n", "utf8");
    await writeFile(path.join(root, "sibling.txt"), "initial\n", "utf8");
    await git(root, ["add", "."]);
    await git(root, ["commit", "-m", "monorepo fixture"]);
    await writeFile(path.join(projectRoot, "inside.txt"), "changed\n", "utf8");
    await writeFile(path.join(root, "sibling.txt"), "changed\n", "utf8");

    const snapshot = await inspectGitProject(projectRoot, ".agent-context/handoff.md");
    assert.deepEqual(
      snapshot.changes.map((change) => change.path),
      ["inside.txt"],
    );
    assert.match(renderHandoffSnapshot(snapshot), /changed paths are project-relative/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("snapshot reports deterministic upstream divergence", async () => {
  const root = await createTemporaryDirectory();
  const remoteParent = await createTemporaryDirectory();
  const cloneRoot = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    const remote = path.join(remoteParent, "remote.git");
    await git(root, ["init", "--bare", remote]);
    await git(root, ["remote", "add", "origin", remote]);
    await git(root, ["push", "-u", "origin", "main"]);

    await writeFile(path.join(root, "local.txt"), "local\n", "utf8");
    await git(root, ["add", "local.txt"]);
    await git(root, ["commit", "-m", "local ahead"]);
    let snapshot = await inspectGitProject(root, ".agent-context/handoff.md");
    assert.equal(snapshot.ahead, 1);
    assert.equal(snapshot.behind, 0);

    await execFileAsync("git", ["clone", "--branch", "main", remote, cloneRoot], {
      encoding: "utf8",
    });
    await git(cloneRoot, ["config", "user.email", "carrylog-tests@example.invalid"]);
    await git(cloneRoot, ["config", "user.name", "Carrylog Tests"]);
    await writeFile(path.join(cloneRoot, "remote.txt"), "remote\n", "utf8");
    await git(cloneRoot, ["add", "remote.txt"]);
    await git(cloneRoot, ["commit", "-m", "remote ahead"]);
    await git(cloneRoot, ["push", "origin", "main"]);
    await git(root, ["fetch", "origin"]);

    snapshot = await inspectGitProject(root, ".agent-context/handoff.md");
    assert.equal(snapshot.ahead, 1);
    assert.equal(snapshot.behind, 1);
  } finally {
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(remoteParent);
    await removeTemporaryDirectory(cloneRoot);
  }
});

test("Git inspection supports linked worktrees", async () => {
  const root = await createTemporaryDirectory();
  const worktreeParent = await createTemporaryDirectory();
  const linked = path.join(worktreeParent, "linked");
  try {
    await initializeGitProject(root);
    await git(root, ["branch", "linked-fixture"]);
    await git(root, ["worktree", "add", linked, "linked-fixture"]);
    await writeFile(path.join(linked, "tracked.txt"), "worktree change\n", "utf8");
    const snapshot = await inspectGitProject(linked, ".agent-context/handoff.md");
    assert.equal(snapshot.branch, "linked-fixture");
    assert.deepEqual(
      snapshot.changes.map((change) => change.path),
      ["tracked.txt"],
    );
  } finally {
    await git(root, ["worktree", "remove", "--force", linked]).catch(() => undefined);
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(worktreeParent);
  }
});

test("Git inspection disables repository-configured fsmonitor execution", async (context) => {
  if (process.platform === "win32") {
    context.skip("Executable fsmonitor fixture uses a POSIX script.");
    return;
  }
  const root = await createTemporaryDirectory();
  try {
    await initializeGitProject(root);
    const monitor = path.join(root, "fsmonitor-test.sh");
    const sentinel = path.join(root, "fsmonitor-invoked");
    await writeFile(monitor, "#!/bin/sh\nprintf invoked > fsmonitor-invoked\n", "utf8");
    await chmod(monitor, 0o755);
    await git(root, ["config", "core.fsmonitor", monitor]);
    await inspectGitProject(root, ".agent-context/handoff.md");
    await assert.rejects(() => stat(sentinel), { code: "ENOENT" });
  } finally {
    await removeTemporaryDirectory(root);
  }
});
