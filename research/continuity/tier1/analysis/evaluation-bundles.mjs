import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forbiddenKeys = new Set([
  "runId",
  "ordinal",
  "fixtureId",
  "condition",
  "harness",
  "runOrder",
]);

export async function buildEvaluationBundles(root = defaultRoot) {
  const order = await readJson(path.join(root, "run-order.json"));
  const scoringCodebookBytes = await readFile(path.join(root, "scoring-codebook.json"));
  const scoringCodebookSha256 = sha256(scoringCodebookBytes);
  const tasks = new Map();
  for (const run of order.runs) {
    if (!tasks.has(run.fixtureId)) {
      const taskPath = path.join(root, "tasks", `${run.fixtureId}.json`);
      const bytes = await readFile(taskPath);
      tasks.set(run.fixtureId, {
        value: JSON.parse(bytes),
        sha256: sha256(bytes),
      });
    }
  }
  const bundles = new Map();
  for (const run of order.runs) {
    assert.equal(bundles.has(run.blindId), false, `duplicate blind ID: ${run.blindId}`);
    const task = tasks.get(run.fixtureId);
    assert.ok(task);
    const bundle = {
      formatVersion: 1,
      blindId: run.blindId,
      taskFixtureSha256: task.sha256,
      scoringCodebookSha256,
      rubric: {
        facts: task.value.relevantFacts,
        completionCriteria: task.value.scoring.taskCompletion.criteria,
        prohibitedReversals: task.value.prohibitedReversals,
        repeatedWork: task.value.repeatedWorkIndicators,
        allowedClarificationQuestions: task.value.allowedClarificationQuestions,
        otherClarificationsCountAsUnnecessary: task.value.otherClarificationsCountAsUnnecessary,
        sensitiveExposures: task.value.sensitiveExclusions,
        scoringRules: {
          scorerInputs: task.value.scoring.scorerInputs,
          factCreditRule: task.value.scoring.factCreditRule,
          contradictionRule: task.value.scoring.contradictionRule,
          maximumCompletionPoints: task.value.scoring.taskCompletion.maximumPoints,
        },
      },
    };
    assertNoForbiddenKeys(bundle);
    bundles.set(run.blindId, `${JSON.stringify(bundle, null, 2)}\n`);
  }
  return bundles;
}

export async function writeEvaluationBundles(root = defaultRoot) {
  const bundles = await buildEvaluationBundles(root);
  const directory = path.join(root, "evaluation-bundles");
  await mkdir(directory, { recursive: true });
  const expected = new Set([...bundles.keys()].map((blindId) => `${blindId}.json`));
  for (const entry of await readdir(directory)) {
    assert.ok(expected.has(entry), `refusing to remove unexpected evaluation bundle: ${entry}`);
  }
  for (const [blindId, bytes] of bundles) {
    await writeFile(path.join(directory, `${blindId}.json`), bytes, "utf8");
  }
  return bundles.size;
}

export async function checkEvaluationBundles(root = defaultRoot) {
  const bundles = await buildEvaluationBundles(root);
  const directory = path.join(root, "evaluation-bundles");
  const actual = (await readdir(directory)).sort();
  const expected = [...bundles.keys()].map((blindId) => `${blindId}.json`).sort();
  assert.deepEqual(actual, expected, "evaluation bundle filenames differ");
  for (const [blindId, bytes] of bundles) {
    assert.equal(
      await readFile(path.join(directory, `${blindId}.json`), "utf8"),
      bytes,
      `evaluation bundle drift: ${blindId}`,
    );
  }
  return bundles.size;
}

function assertNoForbiddenKeys(value) {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  if (value === null || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    assert.equal(forbiddenKeys.has(key), false, `blind bundle exposes forbidden key: ${key}`);
    assertNoForbiddenKeys(item);
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function parseRoot(values) {
  const rootIndex = values.indexOf("--root");
  return rootIndex === -1
    ? defaultRoot
    : path.resolve(values[rootIndex + 1] ?? assert.fail("--root requires a path"));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const mode = process.argv[2];
  const root = parseRoot(process.argv.slice(2));
  if (mode === "--write") {
    process.stdout.write(`Wrote ${await writeEvaluationBundles(root)} blind evaluation bundles.\n`);
  } else if (mode === "--check") {
    process.stdout.write(
      `Validated ${await checkEvaluationBundles(root)} blind evaluation bundles.\n`,
    );
  } else {
    throw new Error("Usage: node analysis/evaluation-bundles.mjs --write|--check [--root PATH]");
  }
}
