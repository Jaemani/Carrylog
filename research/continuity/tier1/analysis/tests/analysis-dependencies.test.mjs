import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  buildAnalysisDependencySnapshot,
  validateAnalysisDependencies,
} from "../analysis-dependencies.mjs";
import { buildManifest, runFreezePreflight } from "../freeze.mjs";

const tierRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const projectRoot = path.resolve(tierRoot, "../../..");
const execFileAsync = promisify(execFile);
const dependencyPaths = [
  "node_modules/ajv",
  "node_modules/fast-deep-equal",
  "node_modules/fast-uri",
  "node_modules/json-schema-traverse",
  "node_modules/require-from-string",
];

test("frozen analysis dependency snapshot matches lock inputs and installed artifacts", async () => {
  const expected = JSON.parse(
    await readFile(path.join(tierRoot, "analysis-dependencies.json"), "utf8"),
  );
  assert.deepEqual(await buildAnalysisDependencySnapshot(), expected);
  assert.deepEqual(await validateAnalysisDependencies(), expected);
});

test("analysis dependency validation rejects lock and installed-artifact drift", async () => {
  const temporaryProject = await mkdtemp(path.join(tmpdir(), "carrylog-analysis-dependencies-"));
  try {
    await cp(
      path.join(projectRoot, "package-lock.json"),
      path.join(temporaryProject, "package-lock.json"),
    );
    for (const packagePath of dependencyPaths) {
      const destination = path.join(temporaryProject, ...packagePath.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(projectRoot, ...packagePath.split("/")), destination, { recursive: true });
    }
    await validateAnalysisDependencies(tierRoot, { projectRoot: temporaryProject });

    const lockPath = path.join(temporaryProject, "package-lock.json");
    const lockBytes = await readFile(lockPath, "utf8");
    const lock = JSON.parse(lockBytes);
    lock.packages["node_modules/ajv"].version = "8.20.1-drift";
    await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
    await assert.rejects(
      validateAnalysisDependencies(tierRoot, { projectRoot: temporaryProject }),
      /analysis dependency lock input differs: node_modules\/ajv/,
    );

    await writeFile(lockPath, lockBytes);
    const artifactPath = path.join(temporaryProject, "node_modules", "ajv", "dist", "2020.js");
    await writeFile(artifactPath, `${await readFile(artifactPath, "utf8")}\n`);
    await assert.rejects(
      validateAnalysisDependencies(tierRoot, { projectRoot: temporaryProject }),
      /installed analysis dependency artifact differs: node_modules\/ajv/,
    );
  } finally {
    await rm(temporaryProject, { recursive: true, force: true });
  }
});

test("freeze, preflight, validator, and analyzer reject a drifted frozen dependency surface", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-analysis-dependency-gates-"));
  const root = path.join(parent, "tier1");
  try {
    await cp(tierRoot, root, { recursive: true });
    const dependencyPath = path.join(root, "analysis-dependencies.json");
    const dependencies = JSON.parse(await readFile(dependencyPath, "utf8"));
    dependencies.packages[0].artifactSha256 = "0".repeat(64);
    await writeFile(dependencyPath, `${JSON.stringify(dependencies, null, 2)}\n`);

    await assert.rejects(buildManifest(root), /installed analysis dependency artifact differs/);
    let invoked = false;
    await assert.rejects(
      runFreezePreflight(root, async () => {
        invoked = true;
        return { stdout: "", stderr: "" };
      }),
      /installed analysis dependency artifact differs/,
    );
    assert.equal(invoked, false, "preflight must reject dependency drift before child checks");

    const analysisCommands = [
      { script: "validate.mjs", arguments: ["--root", root] },
      { script: "analyze.mjs", arguments: ["--root", root] },
      {
        script: "scaffold-evaluation.mjs",
        arguments: ["--validate", "--input", path.join(parent, "not-read.json"), "--root", root],
      },
    ];
    for (const command of analysisCommands) {
      await assert.rejects(
        execFileAsync(
          process.execPath,
          [path.join(tierRoot, "analysis", command.script), ...command.arguments],
          {
            cwd: projectRoot,
            encoding: "utf8",
          },
        ),
        /installed analysis dependency artifact differs/,
      );
    }
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("analysis dependency surface rejects missing transitive packages", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-analysis-dependency-closure-"));
  try {
    const dependencies = JSON.parse(
      await readFile(path.join(tierRoot, "analysis-dependencies.json"), "utf8"),
    );
    dependencies.packages = dependencies.packages.filter(
      (entry) => entry.path !== "node_modules/fast-uri",
    );
    await writeFile(
      path.join(root, "analysis-dependencies.json"),
      `${JSON.stringify(dependencies, null, 2)}\n`,
    );
    await assert.rejects(validateAnalysisDependencies(root), /analysis dependency closure differs/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
