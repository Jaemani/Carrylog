import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnalysisDependencies } from "./analysis-dependencies.mjs";
import { validateHarnessPrerequisites } from "./harness-prerequisites.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(here, "..");
const rootOptionIndex = process.argv.indexOf("--root");
const rootArgument = rootOptionIndex === -1 ? undefined : process.argv[rootOptionIndex + 1];
if (rootOptionIndex !== -1 && rootArgument === undefined) throw new Error("--root requires a path");
const root = rootArgument === undefined ? defaultRoot : path.resolve(rootArgument);
const projectRoot = path.resolve(root, "../../..");
await validateAnalysisDependencies(root);
const [{ default: Ajv }, { default: Ajv2020 }] = await Promise.all([
  import("ajv"),
  import("ajv/dist/2020.js"),
]);
const frozenSourceRef = "refs/carrylog-pilot/source";
const ordinalKeys = [
  "objective-and-next-action",
  "bounded-continuation",
  "protected-decision",
  "failed-approach",
  "verification-and-limits",
];

const preregistration = await readJson("preregistration.json");
const repositories = await readJson("repositories.json");
const order = await readJson("run-order.json");
const scoringCodebook = await readJson("scoring-codebook.json");
const exclusionCodebook = await readJson("exclusion-codebook.json");
const evaluationSchema = await readJson("evaluation.schema.json");
const verificationRegistry = await readJson("verification-commands.json");
const reviewAttestations = await readJson("review-attestations.json");
await validateHarnessPrerequisites(root);

assert.equal(preregistration.formatVersion, 1);
assert.ok(["draft-until-committed", "frozen"].includes(preregistration.status));
assert.deepEqual(preregistration.matrix.repositories, ["carrylog", "busycafe"]);
assert.deepEqual(preregistration.matrix.conditions, [
  "repository-only",
  "manual-handoff",
  "carrylog-resume",
]);
assert.deepEqual(preregistration.matrix.harnesses, ["codex", "claude"]);
assert.equal(preregistration.matrix.plannedRuns, 60);
assert.equal(preregistration.controls.networkDuringTask, false);
assert.equal(preregistration.controls.productionAccess, false);
assert.equal(preregistration.controls.fixtureSourceRef, frozenSourceRef);
assert.deepEqual(preregistration.controls.initialComparisonBlocks, [
  "r1-carrylog-05-verify-readiness|codex",
  "r1-carrylog-05-verify-readiness|claude",
]);
assert.equal(preregistration.privacy.storeHiddenReasoning, false);
assert.equal(preregistration.privacy.storeCredentials, false);
assert.equal(preregistration.harnesses.claude.authenticationMode, "router-key-environment");
assert.match(preregistration.harnesses.claude.nativeExecutableSha256, /^[0-9a-f]{64}$/);
assert.match(preregistration.harnesses.claude.routerBaseUrl, /^https:\/\//);
assert.match(preregistration.harnesses.claude.routeCatalogSha256, /^[0-9a-f]{64}$/);
assert.equal(preregistration.harnesses.claude.model, "gpt-5.6-sol");
assert.equal(
  preregistration.harnesses.claude.routeCatalogSha256,
  "229d0d794270e15f3da521962cc7d2521bd61e07a1e1c3b7e0af70f7b444cc9d",
);
assert.deepEqual(preregistration.harnesses.claude.allowedResolvedModels, ["gpt-5.6-sol"]);
assert.equal(preregistration.harnesses.claude.providerIdentityClaimed, false);
assert.equal(preregistration.analysisRules.formalNonInferiorityClaimed, false);
assert.deepEqual(preregistration.analysisRules.tier2DecisionRule.precedence, [
  "stop",
  "go",
  "redesign",
]);
assert.deepEqual(preregistration.analysisRules.tier2DecisionRule.primaryMetrics, [
  "recall",
  "contradiction",
  "completion",
  "reversals",
  "repeated",
  "clarifications",
]);
assert.match(
  preregistration.analysisRules.tier2DecisionRule.contrastDefinition,
  /Exactly 40 contrast vectors: 2 harnesses x 10 fixtures x 2 comparators/,
);
assert.equal(preregistration.reviewGate.requiredIndependentReviewers, 2);
assert.equal(preregistration.reviewGate.requiredVerdict, "GO");
assert.equal(preregistration.reviewGate.unresolvedFindingsAllowed, 0);
assert.equal(scoringCodebook.formatVersion, 1);
assert.equal(exclusionCodebook.formatVersion, 1);
assert.equal(exclusionCodebook.replacementPolicy.includes("No replacement"), true);
assert.deepEqual(Object.keys(reviewAttestations).sort(), [
  "formatVersion",
  "reviewDigest",
  "reviews",
]);
assert.equal(reviewAttestations.formatVersion, 1);
assert.ok(Array.isArray(reviewAttestations.reviews));
if (reviewAttestations.reviews.length === 0) {
  assert.equal(reviewAttestations.reviewDigest, null);
} else {
  assert.match(reviewAttestations.reviewDigest, /^[0-9a-f]{64}$/);
}

const repositoryIds = new Map(
  repositories.repositories.map((repository) => [repository.id, repository]),
);
assert.deepEqual([...repositoryIds.keys()], ["carrylog", "busycafe"]);
for (const repository of repositoryIds.values()) {
  assert.match(repository.commit, /^[0-9a-f]{40}$/);
  assert.match(repository.url, /^https:\/\/github\.com\//);
}
assert.equal(repositories.carrylogRuntime.version, "0.1.0-beta.7");
assert.equal(
  repositories.carrylogRuntime.releaseCommit,
  "515b1709cdc4522c190543b984d926775883e57a",
);
assert.equal(
  repositories.carrylogRuntime.integrity,
  "sha512-7vt+b2SFVvjlM9NOB3XZnHCdPBqckbnGleoDqlyNZ3MdcpZTbmXDi+fP5ug3QdZs0KGmHJLFxGa/+5YX18ShmA==",
);
assert.match(repositories.carrylogRuntime.tarballSha256, /^[0-9a-f]{64}$/);

const taskDirectory = path.join(root, "tasks");
const taskSchema = await readJson("task-fixture.schema.json");
const validateTask = new Ajv({ allErrors: true, strict: true }).compile(taskSchema);
const taskFiles = (await readdir(taskDirectory)).filter((entry) => entry.endsWith(".json")).sort();
assert.equal(taskFiles.length, 10, "exactly ten task fixtures are required");
const tasks = [];
const taskBytesByFixture = new Map();
const repositoryByFixture = new Map();
const familyCoverage = new Map();
for (const taskFile of taskFiles) {
  const taskBytes = await readFile(path.join(taskDirectory, taskFile));
  const task = JSON.parse(taskBytes.toString("utf8"));
  tasks.push(task);
  taskBytesByFixture.set(task.fixtureId, taskBytes);
  assert.equal(
    validateTask(task),
    true,
    `${task.fixtureId ?? taskFile} schema errors: ${JSON.stringify(validateTask.errors)}`,
  );
  assert.equal(task.fixtureVersion, 1);
  assert.equal(task.status, "preregisterable");
  assert.match(task.fixtureId, /^r(1-carrylog|2-busycafe)-0[1-5]-[a-z-]+$/);
  assert.equal(taskFile, `${task.fixtureId}.json`);
  const repositoryId = task.repository.id === "r1-carrylog" ? "carrylog" : "busycafe";
  const repository = repositoryIds.get(repositoryId);
  assert.ok(repository, `unknown repository for ${task.fixtureId}`);
  repositoryByFixture.set(task.fixtureId, repositoryId);
  assert.equal(task.repository.commit, repository.commit);
  assert.equal(task.repository.cleanCheckoutRequired, true);
  assert.equal(task.taskFamily.key, ordinalKeys[task.taskFamily.ordinal - 1]);
  const coverageKey = `${repositoryId}:${task.taskFamily.ordinal}`;
  assert.equal(familyCoverage.has(coverageKey), false, `duplicate family ${coverageKey}`);
  familyCoverage.set(coverageKey, task.fixtureId);

  const promptPath = path.resolve(projectRoot, task.prompt.path);
  assert.ok(promptPath.startsWith(`${root}${path.sep}`), "prompt must stay in the Tier 1 root");
  const prompt = await readFile(promptPath);
  assert.equal(sha256(prompt), task.prompt.sha256, `prompt digest drift: ${task.fixtureId}`);
  const packetPath = path.resolve(projectRoot, task.deliveryPacket.path);
  assert.ok(packetPath.startsWith(`${root}${path.sep}`), "packet must stay in the Tier 1 root");
  const packet = await readFile(packetPath);
  assert.equal(
    sha256(packet),
    task.deliveryPacket.sha256,
    `packet digest drift: ${task.fixtureId}`,
  );
  assert.equal(task.deliveryPacket.language, repositoryId === "busycafe" ? "ko" : "en");
  assertPacketSections(packet.toString("utf8"), task.fixtureId);

  assert.ok(task.relevantFacts.length >= 3);
  assertUnique(
    task.relevantFacts.map((fact) => fact.id),
    `${task.fixtureId} fact IDs`,
  );
  assert.ok(task.relevantFacts.every((fact) => Number.isInteger(fact.weight) && fact.weight > 0));
  assert.ok(task.relevantFacts.some((fact) => fact.continuityEligible));
  for (const fact of task.relevantFacts) {
    assert.equal(
      fact.origin === "prompt",
      fact.continuityEligible === false,
      `${task.fixtureId}:${fact.id} prompt origin and continuity eligibility differ`,
    );
  }
  assert.ok(task.relevantFacts.reduce((sum, fact) => sum + fact.weight, 0) > 0);
  assert.ok(task.prohibitedReversals.length > 0);
  assert.ok(task.repeatedWorkIndicators.length > 0);
  assert.equal(task.otherClarificationsCountAsUnnecessary, true);
  assert.ok(task.expectedVerification.requiredCommands.length > 0);
  if (task.taskFamily.key === "objective-and-next-action") {
    assert.ok(
      task.expectedVerification.requiredCommands.includes(`git rev-parse ${frozenSourceRef}`),
      `${task.fixtureId} must verify the immutable fixture source ref`,
    );
    assert.equal(
      task.expectedVerification.requiredCommands.includes("git rev-parse HEAD"),
      false,
      `${task.fixtureId} must not use mutable HEAD as source identity`,
    );
  }
  assert.ok(task.expectedVerification.forbiddenActions.length > 0);
  assert.ok(task.sensitiveExclusions.length >= 6);
  assert.equal(task.scoring.conditionBlind, false);
  assert.deepEqual(task.scoring.blindTo, ["run-order"]);
  assert.deepEqual(task.scoring.scorerInputs, [
    "sanitized-visible-output",
    "workspace-diff",
    "verification-receipt",
    "exit-status",
  ]);
  assert.equal(task.scoring.taskCompletion.maximumPoints, 10);
  assert.equal(
    task.scoring.taskCompletion.criteria.reduce((sum, criterion) => sum + criterion.points, 0),
    10,
    `${task.fixtureId} completion criteria must total ten`,
  );
  rejectSensitiveLiteral(JSON.stringify(task), task.fixtureId);
}
const carrylogBounded = tasks.find(
  (task) => task.fixtureId === "r1-carrylog-02-bounded-continuation",
);
assert.ok(carrylogBounded);
const carrylogBoundedF1 = carrylogBounded.relevantFacts.find((fact) => fact.id === "f1");
assert.ok(carrylogBoundedF1);
assert.equal(carrylogBoundedF1.origin, "prompt");
assert.equal(carrylogBoundedF1.continuityEligible, false);
assertVerificationRegistry(tasks, verificationRegistry);

const expectedRunKeys = new Set();
for (const task of tasks) {
  for (const condition of preregistration.matrix.conditions) {
    for (const harness of preregistration.matrix.harnesses) {
      expectedRunKeys.add(`${task.fixtureId}|${condition}|${harness}`);
    }
  }
}
assert.equal(expectedRunKeys.size, 60);
assert.equal(order.formatVersion, 1);
assert.equal(order.seed, preregistration.controls.runOrderSeed);
assert.equal(order.runs.length, 60);
assertUnique(
  order.runs.map((run) => run.runId),
  "run IDs",
);
assertUnique(
  order.runs.map((run) => run.blindId),
  "blind IDs",
);
for (const [index, run] of order.runs.entries()) {
  assert.equal(run.ordinal, index + 1);
  assert.ok(expectedRunKeys.delete(`${run.fixtureId}|${run.condition}|${run.harness}`));
  assert.match(run.runId, /^t1-[0-9]{3}$/);
  assert.match(run.blindId, /^b-[0-9a-f]{12}$/);
}
assert.equal(expectedRunKeys.size, 0, "run order does not cover the full matrix exactly once");
assert.deepEqual(
  order.runs.slice(0, 6).map((run) => `${run.fixtureId}|${run.harness}`),
  [
    ...Array(3).fill("r1-carrylog-05-verify-readiness|codex"),
    ...Array(3).fill("r1-carrylog-05-verify-readiness|claude"),
  ],
  "the bounded second-repository comparison must remain the first two execution blocks",
);
const positionCounts = new Map(
  preregistration.matrix.conditions.map((condition) => [condition, [0, 0, 0]]),
);
const harnessPositionCounts = new Map();
const harnessRepositoryPositionCounts = new Map();
for (let index = 0; index < order.runs.length; index += 3) {
  const block = order.runs.slice(index, index + 3);
  assert.equal(new Set(block.map((run) => `${run.fixtureId}|${run.harness}`)).size, 1);
  const { harness, fixtureId } = block[0];
  const repository = repositoryByFixture.get(fixtureId);
  assert.ok(repository, `run order references unknown fixture ${fixtureId}`);
  block.forEach((run, position) => {
    positionCounts.get(run.condition)[position] += 1;
    incrementPositionCount(harnessPositionCounts, harness, run.condition, position);
    incrementPositionCount(
      harnessRepositoryPositionCounts,
      `${harness}|${repository}`,
      run.condition,
      position,
    );
  });
}
assertPositionBalance(new Map([["all", positionCounts]]), "global");
assertPositionBalance(harnessPositionCounts, "harness");
assertPositionBalance(harnessRepositoryPositionCounts, "harness-repository");

const regenerated = await import("./generate-order.mjs");
assert.deepEqual(
  order,
  await regenerated.generateOrder(root),
  "run-order.json drifted from its seed",
);

const scoringCodebookBytes = await readFile(path.join(root, "scoring-codebook.json"));
const evaluationBundleDirectory = path.join(root, "evaluation-bundles");
const evaluationBundleFiles = (await readdir(evaluationBundleDirectory))
  .filter((entry) => entry.endsWith(".json"))
  .sort();
assert.equal(evaluationBundleFiles.length, 60, "exactly 60 blind evaluation bundles are required");
assert.deepEqual(
  evaluationBundleFiles,
  order.runs.map((run) => `${run.blindId}.json`).sort(),
  "evaluation bundle filenames must exactly match planned blind IDs",
);
const runByBlindId = new Map(order.runs.map((run) => [run.blindId, run]));
for (const bundleFile of evaluationBundleFiles) {
  const bundle = JSON.parse(
    await readFile(path.join(evaluationBundleDirectory, bundleFile), "utf8"),
  );
  assert.deepEqual(Object.keys(bundle).sort(), [
    "blindId",
    "formatVersion",
    "rubric",
    "scoringCodebookSha256",
    "taskFixtureSha256",
  ]);
  rejectBlindBundleMetadata(bundle, bundleFile);
  assert.equal(bundle.formatVersion, 1);
  assert.equal(bundleFile, `${bundle.blindId}.json`);
  const plannedRun = runByBlindId.get(bundle.blindId);
  assert.ok(plannedRun, `${bundleFile} has no planned run`);
  assert.equal(
    bundle.taskFixtureSha256,
    sha256(taskBytesByFixture.get(plannedRun.fixtureId)),
    `${bundleFile} task fixture binding differs`,
  );
  assert.equal(bundle.scoringCodebookSha256, sha256(scoringCodebookBytes));
  assert.deepEqual(Object.keys(bundle.rubric).sort(), [
    "allowedClarificationQuestions",
    "completionCriteria",
    "facts",
    "otherClarificationsCountAsUnnecessary",
    "prohibitedReversals",
    "repeatedWork",
    "scoringRules",
    "sensitiveExposures",
  ]);
  for (const field of ["condition", "fixtureId", "harness", "ordinal", "runId", "runOrder"]) {
    assert.equal(
      Object.hasOwn(bundle, field),
      false,
      `${bundleFile} exposes condition or run-order metadata: ${field}`,
    );
  }
}

const scoreLines = splitCsvLines(await readFile(path.join(root, "scores.csv"), "utf8"));
assert.equal(
  scoreLines[0],
  "blind_id,weighted_relevant_fact_recall,weighted_contradiction_rate,prohibited_reversal_count,repeated_work_count,unnecessary_clarification_count,task_completion_score_0_to_10,delivery_evidence_level,evaluator_confidence_0_to_3,unavailable_evidence,evaluator_notes",
);
const exclusionLines = splitCsvLines(await readFile(path.join(root, "exclusions.csv"), "utf8"));
assert.equal(
  exclusionLines[0],
  "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id",
);
assertExclusions(
  exclusionLines.slice(1).map((line) => parseExclusionRow(line)),
  order.runs,
  exclusionCodebook,
);

const validateEvaluation = new Ajv2020({
  allErrors: true,
  strict: true,
}).compile(evaluationSchema);
const evaluationDirectory = path.join(root, "evaluations");
const evaluationFiles = (await readdir(evaluationDirectory))
  .filter((entry) => entry.endsWith(".json"))
  .sort();
for (const evaluationFile of evaluationFiles) {
  const evaluation = JSON.parse(
    await readFile(path.join(evaluationDirectory, evaluationFile), "utf8"),
  );
  assert.equal(
    validateEvaluation(evaluation),
    true,
    `${evaluationFile} schema errors: ${JSON.stringify(validateEvaluation.errors)}`,
  );
  assert.equal(evaluationFile, `${evaluation.blindId}.json`);
}

process.stdout.write(
  `Tier 1 preregistration is structurally valid: ${tasks.length} tasks, ${order.runs.length} runs, ${evaluationFiles.length} evaluations.\n`,
);

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function incrementPositionCount(groups, groupKey, condition, position) {
  if (!groups.has(groupKey)) {
    groups.set(
      groupKey,
      new Map(preregistration.matrix.conditions.map((entry) => [entry, [0, 0, 0]])),
    );
  }
  groups.get(groupKey).get(condition)[position] += 1;
}

function assertPositionBalance(groups, label) {
  for (const [groupKey, conditions] of groups) {
    for (const [condition, counts] of conditions) {
      assert.ok(
        Math.max(...counts) - Math.min(...counts) <= 1,
        `${label} ${groupKey} ${condition} position counts are not balanced: ${counts.join("/")}`,
      );
    }
  }
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} must be unique`);
}

function rejectSensitiveLiteral(value, label) {
  const forbidden = [
    /\/Users\//,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /(?:ghp_|github_pat_|npm_|jmr_|sk-)[A-Za-z0-9_-]{16,}/,
    /(?:DATABASE_URL|SEOUL_API_KEY)\s*=/,
  ];
  for (const pattern of forbidden) {
    assert.equal(pattern.test(value), false, `${label} contains a forbidden sensitive literal`);
  }
}

function rejectBlindBundleMetadata(value, label) {
  if (Array.isArray(value)) {
    for (const item of value) rejectBlindBundleMetadata(item, label);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const forbidden = new Set(["condition", "fixtureId", "harness", "ordinal", "runId", "runOrder"]);
  for (const [key, item] of Object.entries(value)) {
    assert.equal(forbidden.has(key), false, `${label} exposes forbidden blind metadata: ${key}`);
    rejectBlindBundleMetadata(item, label);
  }
}

function assertPacketSections(value, label) {
  const matches = [
    ...value.matchAll(/^## (Objective|Completed|Verification|Decisions|Risks|Next action)$/gm),
  ].map((match) => match[1]);
  assert.deepEqual(
    matches,
    ["Objective", "Completed", "Verification", "Decisions", "Risks", "Next action"],
    `${label} packet sections differ`,
  );
}

export function assertVerificationRegistry(tasksToCheck, registry) {
  assert.equal(registry.formatVersion, 1);
  assert.deepEqual(
    Object.keys(registry.fixtures).sort(),
    tasksToCheck.map((task) => task.fixtureId).sort(),
    "verification registry fixture keys must exactly match task fixtures",
  );
  for (const task of tasksToCheck) {
    const commands = registry.fixtures[task.fixtureId];
    assert.ok(Array.isArray(commands), `${task.fixtureId} verification registry is missing`);
    assertUnique(
      commands.map((command) => command.id),
      `${task.fixtureId} verification command IDs`,
    );
    const registered = commands.map((command) => normalizeRegisteredCommand(command));
    const required = task.expectedVerification.requiredCommands.map(normalizeCommand);
    assertUnique(registered, `${task.fixtureId} normalized registered commands`);
    assertUnique(required, `${task.fixtureId} normalized required commands`);
    assert.deepEqual(
      [...registered].sort(),
      [...required].sort(),
      `${task.fixtureId} verification registry must exactly match requiredCommands`,
    );
  }
}

export function assertExclusions(rows, plannedRuns, codebook) {
  assertUnique(codebook.stages, "exclusion stages");
  assertUnique(codebook.reasonCodes, "exclusion reason codes");
  assert.deepEqual(
    Object.keys(codebook.reasonStageCompatibility).sort(),
    [...codebook.reasonCodes].sort(),
    "every exclusion reason must have exactly one compatibility entry",
  );
  for (const [reason, stages] of Object.entries(codebook.reasonStageCompatibility)) {
    assert.ok(stages.length > 0, `${reason} must allow at least one stage`);
    assertUnique(stages, `${reason} compatible stages`);
    for (const stage of stages) {
      assert.ok(codebook.stages.includes(stage), `${reason} references unknown stage ${stage}`);
    }
  }
  assert.deepEqual(
    codebook.reasonStageCompatibility["strict-resume-failure"],
    ["carrylog-delivery"],
    "strict resume failure must remain a Carrylog delivery outcome",
  );
  assert.match(
    codebook.productFeasibilityRule,
    /remains a Carrylog delivery outcome/,
    "strict resume feasibility rule must remain explicit",
  );

  const runById = new Map(plannedRuns.map((run) => [run.runId, run]));
  assertUnique(
    rows.map((row) => row.run_id),
    "exclusion run IDs",
  );
  assertUnique(
    rows.map((row) => row.blind_id),
    "exclusion blind IDs",
  );
  for (const row of rows) {
    const run = runById.get(row.run_id);
    assert.ok(run, `unknown exclusion run ${row.run_id}`);
    assert.equal(row.blind_id, run.blindId, `${row.run_id} exclusion blind ID differs`);
    assert.ok(codebook.stages.includes(row.stage), `${row.run_id} has unknown exclusion stage`);
    assert.ok(
      codebook.reasonCodes.includes(row.reason_code),
      `${row.run_id} has unknown exclusion reason`,
    );
    assert.ok(
      codebook.reasonStageCompatibility[row.reason_code].includes(row.stage),
      `${row.run_id} exclusion reason is incompatible with its stage`,
    );
    assert.equal(
      row.retained_artifact_path,
      `raw-reviewed/by-run/${row.run_id}`,
      `${row.run_id} exclusion retained path differs`,
    );
    assert.equal(row.replacement_run_id, "", "Tier 1 replacements are forbidden");
  }
}

function normalizeRegisteredCommand(command) {
  assert.deepEqual(Object.keys(command).sort(), [
    "arguments",
    "cwd",
    "executable",
    "gitContext",
    "id",
  ]);
  assert.match(command.id, /^[a-z][a-z0-9-]*$/);
  assert.equal(typeof command.cwd, "string");
  assert.ok(
    command.cwd === "." ||
      (/^[A-Za-z0-9_./-]+$/.test(command.cwd) &&
        !path.posix.isAbsolute(command.cwd) &&
        !command.cwd.split("/").includes("..")),
    `${command.id} cwd must stay within the fixture checkout`,
  );
  assert.equal(typeof command.executable, "string");
  assert.ok(command.executable.length > 0);
  assert.ok(["none", "repository"].includes(command.gitContext));
  assert.equal(
    command.gitContext === "repository",
    command.executable === "git",
    `${command.id} Git context must match its executable`,
  );
  assert.ok(Array.isArray(command.arguments));
  assert.ok(command.arguments.every((argument) => typeof argument === "string"));
  const invocation = [command.executable, ...command.arguments].map(shellToken).join(" ");
  return normalizeCommand(command.cwd === "." ? invocation : `cd ${command.cwd} && ${invocation}`);
}

function normalizeCommand(command) {
  assert.equal(typeof command, "string");
  const normalized = command.trim().replace(/\s+/g, " ");
  assert.ok(normalized.length > 0);
  return normalized;
}

function shellToken(token) {
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(token)) return token;
  return `'${token.replaceAll("'", `'\\''`)}'`;
}

function splitCsvLines(value) {
  return value.trimEnd().split(/\r?\n/);
}

function parseExclusionRow(line) {
  assert.equal(line.includes('"'), false, "exclusion rows must not use quoted CSV fields");
  const values = line.split(",");
  assert.equal(values.length, 6, "exclusion row must have exactly six fields");
  const [run_id, blind_id, stage, reason_code, retained_artifact_path, replacement_run_id] = values;
  return {
    run_id,
    blind_id,
    stage,
    reason_code,
    retained_artifact_path,
    replacement_run_id,
  };
}
