import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { assertPortableRelativePath, portablePathKey } from "../dist/core/paths.js";
import { decodeConfig, loadProject } from "../dist/index.js";
import { createDefaultConfig } from "../dist/templates/defaults.js";
import {
  createNestedTemporaryProject,
  createTemporaryDirectory,
  diagnosticCodes,
  removeTemporaryDirectory,
} from "./helpers.mjs";

test("decodes a valid strict v1 configuration", () => {
  const input = createDefaultConfig("Example", ["codex", "claude"]);
  const result = decodeConfig(input);
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.config.project.name, "Example");
});

test("reports multiple schema errors in one pass", () => {
  const input = createDefaultConfig("Example", ["codex"]);
  input.version = 3;
  input.unknown = true;
  input.documents[0].load = "sometimes";
  input.policies.maxAlwaysCharacters = 10;
  const result = decodeConfig(input);
  assert.equal(result.config, undefined);
  assert.deepEqual(
    new Set(diagnosticCodes(result)),
    new Set(["E_UNKNOWN_KEY", "E_CONFIG_VERSION", "E_LOAD_POLICY", "E_CONTEXT_BUDGET"]),
  );
});

test("rejects case-insensitive and Unicode-normalized path collisions", () => {
  const input = createDefaultConfig("Example", ["codex", "claude"]);
  input.documents[1].path = input.documents[0].path.toUpperCase();
  input.adapters[1].output = "agents.md";
  const result = decodeConfig(input);
  assert.equal(result.config, undefined);
  assert.equal(diagnosticCodes(result).includes("E_DOCUMENT_PATH_DUPLICATE"), true);
  assert.equal(diagnosticCodes(result).includes("E_ADAPTER_OUTPUT_DUPLICATE"), true);
  assert.equal(portablePathKey("cafe\u0301.md"), portablePathKey("caf\u00e9.md"));
  assert.equal(portablePathKey("Σ.md"), portablePathKey("ς.md"));
  assert.equal(portablePathKey("ß.md"), portablePathKey("SS.md"));
  assert.equal(portablePathKey("ẞ.md"), portablePathKey("ss.md"));

  const compatibility = createDefaultConfig("Example", ["codex", "claude"]);
  compatibility.documents[1].path = "Σ.md";
  compatibility.documents[2].path = "ς.md";
  compatibility.adapters[0].output = "ß.md";
  compatibility.adapters[1].output = "SS.md";
  const compatibilityResult = decodeConfig(compatibility);
  assert.equal(diagnosticCodes(compatibilityResult).includes("E_DOCUMENT_PATH_DUPLICATE"), true);
  assert.equal(diagnosticCodes(compatibilityResult).includes("E_ADAPTER_OUTPUT_DUPLICATE"), true);
});

for (const invalidPath of [
  "../outside.md",
  "/absolute.md",
  "C:/absolute.md",
  "nested\\windows.md",
  "nested//empty.md",
  "NUL.txt",
  "folder/name?.md",
  "trailing. ",
  "COM¹.txt",
  "LPT³",
  "line\u2028separator.md",
  "paragraph\u2029separator.md",
  "\ud800.md",
  "\ud801.md",
  "\udc00.md",
]) {
  test(`rejects non-portable path: ${invalidPath}`, () => {
    assert.throws(() => assertPortableRelativePath(invalidPath));
  });
}

test("rejects multiline and managed-marker metadata", () => {
  const input = createDefaultConfig("Example", ["codex"]);
  input.documents[0].description = "first\nsecond";
  input.documents[1].triggers = ["agent-context-kit:managed:start"];
  input.documents[2].description = "control\u001bsequence";
  input.documents[3].triggers = ["unicode\u2028separator"];
  const result = decodeConfig(input);
  assert.equal(diagnosticCodes(result).includes("E_SINGLE_LINE"), true);
  assert.equal(diagnosticCodes(result).includes("E_RESERVED_MARKER"), true);
  assert.equal(diagnosticCodes(result).includes("E_SINGLE_LINE"), true);
});

test("bounds document, adapter, and trigger catalog sizes", () => {
  const input = createDefaultConfig("Example", ["codex"]);
  input.documents = Array.from({ length: 257 }, (_, index) => ({
    ...input.documents[0],
    id: `doc-${index}`,
    path: `doc-${index}.md`,
    triggers: index === 0 ? Array.from({ length: 33 }, () => "large catalog") : undefined,
  }));
  input.adapters = Array.from({ length: 33 }, (_, index) => ({
    type: "codex",
    output: `agents-${index}.md`,
  }));
  const result = decodeConfig(input);
  const codes = diagnosticCodes(result);
  assert.equal(codes.includes("E_DOCUMENT_LIMIT"), true);
  assert.equal(codes.includes("E_ADAPTER_LIMIT"), true);
  assert.equal(codes.includes("E_TRIGGER_LIMIT"), true);
});

test("finds the project configuration from a nested working directory", async () => {
  const { root, nested } = await createNestedTemporaryProject();
  try {
    await mkdir(path.join(root, ".agent-context"));
    const config = createDefaultConfig("Nested", ["codex"]);
    await writeFile(
      path.join(root, ".agent-context", "config.yaml"),
      JSON.stringify(config),
      "utf8",
    );
    const project = await loadProject(nested);
    assert.equal(project.root, root);
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("reports malformed and duplicate-key YAML", async () => {
  const root = await createTemporaryDirectory();
  try {
    await mkdir(path.join(root, ".agent-context"));
    await writeFile(
      path.join(root, ".agent-context", "config.yaml"),
      "version: 1\nversion: 1\nproject: [",
      "utf8",
    );
    await assert.rejects(
      () => loadProject(root),
      (error) => error.code === "E_CONFIG_YAML",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("reports syntactically valid but structurally invalid configuration", async () => {
  const root = await createTemporaryDirectory();
  try {
    await mkdir(path.join(root, ".agent-context"));
    await writeFile(path.join(root, ".agent-context", "config.yaml"), "version: 1\n", "utf8");
    await assert.rejects(
      () => loadProject(root),
      (error) =>
        error.code === "E_CONFIG_INVALID" &&
        error.diagnostics.some((diagnostic) => diagnostic.code === "E_PROJECT_TYPE"),
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("reports a missing configuration after searching ancestors", async () => {
  const root = await createTemporaryDirectory();
  try {
    await assert.rejects(
      () => loadProject(root),
      (error) => error.code === "E_CONFIG_MISSING",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("rejects an oversized configuration before YAML parsing", async () => {
  const root = await createTemporaryDirectory();
  try {
    await mkdir(path.join(root, ".agent-context"));
    await writeFile(
      path.join(root, ".agent-context", "config.yaml"),
      Buffer.alloc(1024 * 1024 + 1, 0x20),
    );
    await assert.rejects(
      () => loadProject(root),
      (error) => error.code === "E_FILE_TOO_LARGE",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});

test("rejects missing and non-directory project roots", async () => {
  const root = await createTemporaryDirectory();
  const file = path.join(root, "file.txt");
  await writeFile(file, "not a directory", "utf8");
  try {
    await assert.rejects(
      () => loadProject(path.join(root, "missing")),
      (error) => error.code === "E_ROOT_MISSING",
    );
    await assert.rejects(
      () => loadProject(file),
      (error) => error.code === "E_ROOT_NOT_DIRECTORY",
    );
  } finally {
    await removeTemporaryDirectory(root);
  }
});
