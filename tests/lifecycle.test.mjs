import assert from "node:assert/strict";
import {
  chmod,
  mkdir,
  readFile,
  realpath,
  stat,
  symlink,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { atomicWriteText, readTextIfExists } from "../dist/core/files.js";
import { initProject, loadProject, syncProject, validateProject } from "../dist/index.js";
import { createTemporaryDirectory, diagnosticCodes, removeTemporaryDirectory } from "./helpers.mjs";

async function initialize(root, overrides = {}) {
  return await initProject({
    root,
    adapters: ["codex", "claude"],
    adopt: false,
    dryRun: false,
    ...overrides,
  });
}

test("dry-run initialization produces a full plan and writes nothing", async () => {
  const root = await createTemporaryDirectory();
  try {
    const result = await initialize(root, { dryRun: true });
    assert.equal(result.changes.length, 10);
    assert.equal(result.wrote, false);
    await assert.rejects(() => stat(path.join(root, ".agent-context")), { code: "ENOENT" });
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("initialization, validation, and repeated synchronization are clean", async () => {
  const root = await createTemporaryDirectory();
  try {
    const initialized = await initialize(root, { name: "Unicode 프로젝트" });
    assert.equal(
      initialized.changes.every((change) => change.kind === "create"),
      true,
    );
    const project = await loadProject(root);
    assert.equal(project.config.project.name, "Unicode 프로젝트");
    assert.equal((await validateProject(project)).valid, true);
    const synced = await syncProject(project, { adopt: false, check: false, dryRun: false });
    assert.equal(synced.drift, false);
    assert.equal(synced.wrote, false);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("initialization validates public API inputs before writing", async () => {
  const root = await createTemporaryDirectory();
  try {
    await assert.rejects(
      () => initialize(root, { name: "  \n  " }),
      (error) => error.code === "E_CONFIG_INVALID",
    );
    await assert.rejects(
      () => initialize(root, { adapters: [] }),
      (error) => error.code === "E_CONFIG_INVALID",
    );
    await assert.rejects(() => stat(path.join(root, ".agent-context")), { code: "ENOENT" });
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("initialization refuses context conflicts without partial writes", async () => {
  const root = await createTemporaryDirectory();
  try {
    await mkdir(path.join(root, ".agent-context"));
    await writeFile(path.join(root, ".agent-context", "project.md"), "existing", "utf8");
    await assert.rejects(
      () => initialize(root),
      (error) => error.code === "E_INIT_CONFLICT",
    );
    await assert.rejects(() => stat(path.join(root, "AGENTS.md")), { code: "ENOENT" });
    await assert.rejects(() => stat(path.join(root, ".agent-context", "config.yaml")), {
      code: "ENOENT",
    });
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("initialization refuses unmanaged adapters unless explicitly adopted", async () => {
  const root = await createTemporaryDirectory();
  try {
    await writeFile(path.join(root, "AGENTS.md"), "# Human instructions\n", "utf8");
    await assert.rejects(
      () => initialize(root),
      (error) => error.code === "E_INIT_ADAPTER_CONFLICT",
    );
    await assert.rejects(() => stat(path.join(root, ".agent-context")), { code: "ENOENT" });

    await initialize(root, { adopt: true });
    const agents = await readFile(path.join(root, "AGENTS.md"), "utf8");
    assert.match(agents, /^# Human instructions/);
    assert.match(agents, /agent-context-kit:managed:start/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("check mode detects drift without writing and normal sync repairs it", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initialize(root);
    const agentsPath = path.join(root, "AGENTS.md");
    const original = await readFile(agentsPath, "utf8");
    await writeFile(agentsPath, original.replace("Codex project context", "stale content"), "utf8");
    const project = await loadProject(root);
    const checked = await syncProject(project, { adopt: false, check: true, dryRun: false });
    assert.equal(checked.drift, true);
    assert.match(await readFile(agentsPath, "utf8"), /stale content/);
    const repaired = await syncProject(project, { adopt: false, check: false, dryRun: false });
    assert.equal(repaired.wrote, true);
    assert.equal(await readFile(agentsPath, "utf8"), original);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("sync preflights every adapter before writing any adapter", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initialize(root);
    const agentsPath = path.join(root, "AGENTS.md");
    const originalAgents = await readFile(agentsPath, "utf8");
    await writeFile(agentsPath, originalAgents.replace("Codex", "Old Codex"), "utf8");
    await writeFile(path.join(root, "CLAUDE.md"), "unmanaged", "utf8");
    const project = await loadProject(root);
    await assert.rejects(
      () => syncProject(project, { adopt: false, check: false, dryRun: false }),
      (error) => error.code === "E_ADAPTER_PLAN",
    );
    assert.match(await readFile(agentsPath, "utf8"), /Old Codex/);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("validation reports missing, empty, over-budget, and overlapping sources", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initialize(root);
    const project = await loadProject(root);
    await unlink(path.join(root, ".agent-context", "project.md"));
    await writeFile(path.join(root, ".agent-context", "current-state.md"), "", "utf8");
    project.config.policies.maxAlwaysCharacters = 1;
    project.config.policies.maxAdapterCharacters = 1_000;
    project.config.adapters[0].output = ".agent-context/HANDOFF.md";
    const result = await validateProject(project);
    const codes = diagnosticCodes(result);
    assert.equal(result.valid, false);
    assert.equal(codes.includes("E_DOCUMENT_MISSING"), true);
    assert.equal(codes.includes("W_DOCUMENT_EMPTY"), true);
    assert.equal(codes.includes("E_ALWAYS_BUDGET_EXCEEDED"), true);
    assert.equal(codes.includes("E_ADAPTER_BUDGET_EXCEEDED"), true);
    assert.equal(codes.includes("E_OUTPUT_OVERLAPS_SOURCE"), true);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("validation distinguishes missing, unmanaged, drifted, and damaged adapters", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initialize(root);
    const agentsPath = path.join(root, "AGENTS.md");
    const original = await readFile(agentsPath, "utf8");
    const project = await loadProject(root);

    await unlink(agentsPath);
    assert.equal(
      diagnosticCodes(await validateProject(project)).includes("E_ADAPTER_MISSING"),
      true,
    );

    await writeFile(agentsPath, "# Human only\n", "utf8");
    assert.equal(
      diagnosticCodes(await validateProject(project)).includes("E_ADAPTER_UNMANAGED"),
      true,
    );

    await writeFile(agentsPath, original.replace("Codex project context", "stale"), "utf8");
    assert.equal(diagnosticCodes(await validateProject(project)).includes("E_ADAPTER_DRIFT"), true);

    await writeFile(
      agentsPath,
      original.replace("<!-- agent-context-kit:managed:end -->", ""),
      "utf8",
    );
    assert.equal(
      diagnosticCodes(await validateProject(project)).includes("E_MANAGED_MARKERS"),
      true,
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("validation rejects context paths that traverse a symbolic link", async (context) => {
  if (process.platform === "win32") {
    context.skip("Creating symlinks requires platform-specific privileges on Windows.");
    return;
  }
  const root = await createTemporaryDirectory();
  const outside = await createTemporaryDirectory("ackit-outside-");
  try {
    await initialize(root);
    await unlink(path.join(root, ".agent-context", "project.md"));
    await writeFile(path.join(outside, "project.md"), "outside", "utf8");
    await symlink(
      path.join(outside, "project.md"),
      path.join(root, ".agent-context", "project.md"),
    );
    const result = await validateProject(await loadProject(root));
    assert.equal(diagnosticCodes(result).includes("E_SYMLINK_PATH"), true);
  } finally {
    await removeTemporaryDirectory(root);
    await removeTemporaryDirectory(outside);
  }
});

test("atomic updates preserve existing file permissions", async (context) => {
  if (process.platform === "win32") {
    context.skip("POSIX file modes do not apply on Windows.");
    return;
  }
  const root = await createTemporaryDirectory();
  try {
    const file = path.join(root, "mode.txt");
    await writeFile(file, "before", "utf8");
    await chmod(file, 0o640);
    await atomicWriteText(file, "after");
    assert.equal((await stat(file)).mode & 0o777, 0o640);
    assert.equal(await readFile(file, "utf8"), "after");
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("bounded text reads reject large, binary, and non-file inputs", async () => {
  const root = await createTemporaryDirectory();
  try {
    const large = path.join(root, "large.txt");
    const binary = path.join(root, "binary.txt");
    const directory = path.join(root, "directory");
    await writeFile(large, "12345", "utf8");
    await writeFile(binary, Buffer.from([0xff, 0xfe]));
    await mkdir(directory);

    await assert.rejects(
      () => readTextIfExists(large, { maxBytes: 4 }),
      (error) => error.code === "E_FILE_TOO_LARGE",
    );
    await assert.rejects(
      () => readTextIfExists(binary),
      (error) => error.code === "E_FILE_ENCODING",
    );
    await assert.rejects(
      () => readTextIfExists(directory),
      (error) => error.code === "E_NOT_REGULAR_FILE",
    );
    await assert.rejects(() => readTextIfExists(large, { maxBytes: 0 }), TypeError);
    assert.equal(await readTextIfExists(path.join(root, "missing.txt")), undefined);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("synchronization returns non-blocking context warnings", async () => {
  const root = await createTemporaryDirectory();
  try {
    await initialize(root);
    await writeFile(path.join(root, ".agent-context", "conventions.md"), "", "utf8");
    const result = await syncProject(await loadProject(root), {
      adopt: false,
      check: true,
      dryRun: false,
    });
    assert.equal(diagnosticCodes(result).includes("W_DOCUMENT_EMPTY"), true);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("a symlinked root is canonicalized before initialization", async (context) => {
  if (process.platform === "win32") {
    context.skip("Creating symlinks requires platform-specific privileges on Windows.");
    return;
  }
  const parent = await createTemporaryDirectory();
  try {
    const target = path.join(parent, "target");
    const alias = path.join(parent, "alias");
    await mkdir(target);
    await symlink(target, alias);
    await initialize(alias);
    const project = await loadProject(alias);
    assert.equal(project.root, await realpath(target));
    await stat(path.join(target, "AGENTS.md"));
  } finally {
    await removeTemporaryDirectory(parent);
  }
});
