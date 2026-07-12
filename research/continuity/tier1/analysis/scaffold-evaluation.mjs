import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnalysisDependencies } from "./analysis-dependencies.mjs";

const arguments_ = parseArguments(process.argv.slice(2));
const root = arguments_.root;
await validateAnalysisDependencies(root);
const { default: Ajv2020 } = await import("ajv/dist/2020.js");

if (arguments_.mode === "scaffold") {
  const destination = path.resolve(arguments_.output);
  const canonicalRoot = path.join(root, "evaluations");
  assert.equal(
    destination === canonicalRoot || destination.startsWith(`${canonicalRoot}${path.sep}`),
    false,
    "scaffolds must be edited outside evaluations/ and finalized explicitly",
  );
  await assertAbsent(destination);
  const bundle = await readBundle(arguments_.blindId);
  const artifactBytes = await readArtifact(arguments_.blindId);
  const draft = buildDraft(bundle, artifactBytes, arguments_.evaluator);
  await writeFile(destination, `${JSON.stringify(draft, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  process.stdout.write(`Wrote blinded evaluation scaffold to ${destination}.\n`);
} else {
  const input = path.resolve(arguments_.input);
  const evaluation = JSON.parse(await readFile(input, "utf8"));
  await validateEvaluation(evaluation);
  if (arguments_.mode === "finalize") {
    const destination = path.join(root, "evaluations", `${evaluation.blindId}.json`);
    await assertAbsent(destination);
    await writeFile(destination, `${JSON.stringify(evaluation, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    });
    process.stdout.write(`Finalized ${evaluation.blindId} to evaluations/.\n`);
  } else process.stdout.write(`Validated blinded evaluation ${evaluation.blindId}.\n`);
}

async function validateEvaluation(evaluation) {
  const schema = JSON.parse(await readFile(path.join(root, "evaluation.schema.json"), "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(evaluation), true, JSON.stringify(validate.errors));
  const bundle = await readBundle(evaluation.blindId);
  const artifactBytes = await readArtifact(evaluation.blindId);
  assert.equal(evaluation.artifactSha256, sha256(artifactBytes));
  assert.equal(evaluation.scoringCodebookSha256, bundle.scoringCodebookSha256);
  assertExactIds(evaluation.facts, bundle.rubric.facts, "facts");
  assertExactIds(evaluation.completionCriteria, bundle.rubric.completionCriteria, "criteria");
  assertExactIds(evaluation.prohibitedReversals, bundle.rubric.prohibitedReversals, "reversals");
  assertExactIds(evaluation.repeatedWork, bundle.rubric.repeatedWork, "repeated work");
  assertExactIds(evaluation.sensitiveExposures, bundle.rubric.sensitiveExposures, "exposures");
}

function buildDraft(bundle, artifactBytes, evaluatorId) {
  const unavailable = (item, values) => ({
    id: item.id,
    available: false,
    ...values,
    unavailableReason: "evaluator-cannot-determine",
    evidence: [],
    confidence: 0,
  });
  return {
    formatVersion: 1,
    blindId: bundle.blindId,
    artifactSha256: sha256(artifactBytes),
    scoringCodebookSha256: bundle.scoringCodebookSha256,
    evaluatorId,
    evaluatedAt: new Date().toISOString(),
    facts: bundle.rubric.facts.map((item) =>
      unavailable(item, { credited: null, contradicted: null }),
    ),
    completionCriteria: bundle.rubric.completionCriteria.map((item) =>
      unavailable(item, { awardedPoints: null }),
    ),
    prohibitedReversals: bundle.rubric.prohibitedReversals.map((item) =>
      unavailable(item, { count: null }),
    ),
    repeatedWork: bundle.rubric.repeatedWork.map((item) => unavailable(item, { count: null })),
    unnecessaryClarifications: [],
    clarificationsAvailable: false,
    clarificationEvidence: [],
    sensitiveExposures: bundle.rubric.sensitiveExposures.map((item) =>
      unavailable(item, { exposed: null }),
    ),
    deliveryEvidenceLevel: "none",
    evaluatorConfidence: 0,
    unavailableEvidence: ["evaluator-cannot-determine"],
    notes:
      "DRAFT: replace unavailable placeholders only when the blinded artifact supports a score.",
  };
}

function assertExactIds(actual, expected, label) {
  const actualIds = actual.map((item) => item.id).sort();
  assert.equal(new Set(actualIds).size, actualIds.length, `duplicate ${label}`);
  assert.deepEqual(actualIds, expected.map((item) => item.id).sort(), `${label} IDs differ`);
}

async function readBundle(blindId) {
  assert.match(blindId, /^b-[0-9a-f]{12}$/);
  const bundle = JSON.parse(
    await readFile(path.join(root, "evaluation-bundles", `${blindId}.json`), "utf8"),
  );
  assert.equal(bundle.blindId, blindId);
  return bundle;
}

async function readArtifact(blindId) {
  return readFile(path.join(root, "raw-reviewed", "blind", blindId, "artifact.json"));
}

function parseArguments(values) {
  const result = {
    mode: "",
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    blindId: "",
    evaluator: "",
    output: "",
    input: "",
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--scaffold") result.mode = setMode(result.mode, "scaffold");
    else if (value === "--validate") result.mode = setMode(result.mode, "validate");
    else if (value === "--finalize") result.mode = setMode(result.mode, "finalize");
    else if (value === "--root")
      result.root = path.resolve(values[++index] ?? assert.fail("--root requires a path"));
    else if (value === "--blind-id") result.blindId = values[++index] ?? "";
    else if (value === "--evaluator") result.evaluator = values[++index] ?? "";
    else if (value === "--output") result.output = values[++index] ?? "";
    else if (value === "--input") result.input = values[++index] ?? "";
    else throw new Error(`unknown argument: ${value}`);
  }
  if (result.mode === "scaffold") {
    assert.match(result.blindId, /^b-[0-9a-f]{12}$/);
    assert.match(result.evaluator, /^[a-z][a-z0-9-]{1,31}$/);
    assert.notEqual(result.output, "", "--scaffold requires --output");
  } else {
    assert.ok(result.mode === "validate" || result.mode === "finalize", "select one mode");
    assert.notEqual(result.input, "", `${result.mode} requires --input`);
  }
  return result;
}

function setMode(current, next) {
  assert.equal(current, "", "select exactly one mode");
  return next;
}

async function assertAbsent(filePath) {
  try {
    await access(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`refusing to overwrite: ${filePath}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
