import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, lstat, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateAnalysisDependencies } from "./analysis-dependencies.mjs";
import { verifyCommittedFreeze } from "./freeze.mjs";

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const rootArgument = process.argv.indexOf("--root");
const root =
  rootArgument === -1
    ? defaultRoot
    : path.resolve(process.argv[rootArgument + 1] ?? assert.fail("--root requires a path"));
await validateAnalysisDependencies(root);
const { default: Ajv2020 } = await import("ajv/dist/2020.js");
const projectRoot = path.resolve(root, "../../..");
const rawRoot = path.join(root, "raw-reviewed");
const quarantineRoot = path.join(root, "raw-quarantine");
const order = await readJson("run-order.json");
const preregistration = await readJson("preregistration.json");
const scoringCodebookBytes = await readFile(path.join(root, "scoring-codebook.json"));
const scoringCodebook = JSON.parse(scoringCodebookBytes);
const scoringCodebookSha256 = sha256(scoringCodebookBytes);
const exclusionCodebook = await readJson("exclusion-codebook.json");
const freezeManifest = await readOptionalJson(path.join(root, "freeze-manifest.json"));
const evaluationSchema = await readJson("evaluation.schema.json");
const validateEvaluation = new Ajv2020({
  allErrors: true,
  strict: true,
}).compile(evaluationSchema);
const knownRunIds = new Set(order.runs.map((run) => run.runId));
const knownBlindIds = new Set(order.runs.map((run) => run.blindId));
const protocolDiagnostics = [];
const runIssues = new Map();
const tasks = new Map();
for (const file of (await readdir(path.join(root, "tasks"))).filter((entry) =>
  entry.endsWith(".json"),
)) {
  const task = JSON.parse(await readFile(path.join(root, "tasks", file), "utf8"));
  tasks.set(task.fixtureId, task);
}
const exclusions = parseExclusions(await readFile(path.join(root, "exclusions.csv"), "utf8"));
const exclusionByRun = new Map();
for (const exclusion of exclusions) {
  if (!knownRunIds.has(exclusion.run_id)) {
    protocolDiagnostics.push({
      code: "unknown-exclusion",
      reference: "exclusions.csv",
      diagnostic: sanitizeDiagnostic(`unknown excluded run ${exclusion.run_id}`),
    });
    continue;
  }
  if (exclusionByRun.has(exclusion.run_id)) {
    addRunIssue(exclusion.run_id, "duplicate exclusion run_id");
    continue;
  }
  exclusionByRun.set(exclusion.run_id, exclusion);
}
const evaluations = await loadEvaluations();
protocolDiagnostics.push(...(await inspectOrphanDirectories(rawRoot, "raw-reviewed")));
protocolDiagnostics.push(...(await inspectOrphanDirectories(quarantineRoot, "raw-quarantine")));
const verifiedFreezeCommit = await inspectScoredSuiteIdentities();

const reconciled = [];
for (const run of order.runs) {
  try {
    const issue = runIssues.get(run.runId) ?? runIssues.get(run.blindId);
    if (issue) {
      reconciled.push(
        baseRecord(
          run,
          "protocol-invalid",
          exclusionByRun.get(run.runId) ?? null,
          null,
          issue,
          await buildReferences(run),
        ),
      );
    } else {
      reconciled.push(await reconcileRun(run));
    }
  } catch (error) {
    reconciled.push(
      baseRecord(
        run,
        "protocol-invalid",
        exclusionByRun.get(run.runId) ?? null,
        null,
        errorDiagnostic(error),
        await buildReferencesSafely(run),
      ),
    );
  }
}
const records = reconciled.filter((record) => record.metrics !== null);
const pairedContrasts = buildPairedContrasts(records);
const manualRegressionFlags = buildManualRegressionFlags(records);
const tier2Decision = buildTier2Decision(reconciled, records, manualRegressionFlags);
const result = {
  formatVersion: 1,
  plannedRuns: order.runs.length,
  reconciledRuns: reconciled.length,
  statusCounts: countBy(reconciled, (record) => record.state),
  attrition: groupAttrition(reconciled),
  runReconciliation: reconciled.map(renderRunReconciliation),
  protocolDiagnostics,
  scoredRuns: records.length,
  descriptiveGroups: buildDescriptiveGroups(reconciled),
  pairedContrasts,
  manualRegressionFlags,
  tier2Decision,
  operationalEvidence: buildOperationalEvidence(reconciled),
  unavailableEvidence: countUnavailable(records),
  conditionPositions: buildConditionPositions(),
  limitations: [
    "Intervals describe variation across the selected fixtures only; there is one stochastic run per cell.",
    "Tier 1 is exploratory regression screening and does not establish formal non-inferiority.",
    "Provider token and cost fields remain null when the harness did not expose them; null is never zero.",
    "Unbounded count outcomes have no worst-case missingness bound; attrition is reported instead.",
    "No composite utility score is calculated and evaluator confidence never weights or excludes outcomes.",
  ],
};

if (process.argv.includes("--write-derived")) {
  await writeFile(path.join(root, "scores.csv"), renderDerivedScores(records), "utf8");
}
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

async function reconcileRun(run) {
  const byRun = path.join(rawRoot, "by-run", run.runId);
  const blind = path.join(rawRoot, "blind", run.blindId);
  const hasRun = await exists(byRun);
  const hasBlind = await exists(blind);
  const quarantineRun = path.join(quarantineRoot, "by-run", run.runId);
  const quarantineBlind = path.join(quarantineRoot, "blind", run.blindId);
  const hasQuarantineRun = await exists(quarantineRun);
  const hasQuarantineBlind = await exists(quarantineBlind);
  const evaluation = evaluations.get(run.blindId) ?? null;
  const exclusion = exclusionByRun.get(run.runId) ?? null;
  const references = await buildReferences(run);
  if (!hasRun && !hasBlind) {
    assert.equal(evaluation, null, `${run.runId} has an evaluation without an artifact`);
    if (hasQuarantineRun || hasQuarantineBlind) {
      assert.equal(exclusion, null, `${run.runId} has an exclusion before privacy review`);
      return reconcileQuarantineRun(
        run,
        quarantineRun,
        hasQuarantineRun,
        hasQuarantineBlind,
        references,
      );
    }
    assert.equal(exclusion, null, `${run.runId} has an exclusion without reviewed evidence`);
    return baseRecord(run, "not-started", exclusion, null, null, references);
  }
  if (!hasRun)
    return baseRecord(
      run,
      "protocol-invalid",
      exclusion,
      null,
      "orphan run or blind directory",
      references,
    );
  const privacyReview = await readRequiredJson(path.join(byRun, "privacy-review.json"));
  assert.equal(privacyReview.runId, run.runId);
  assert.equal(privacyReview.blindId, run.blindId);
  assert.match(privacyReview.sourceDigest, /^[0-9a-f]{64}$/);
  if (privacyReview.decision === "rejected") {
    assert.equal(hasBlind, false, `${run.runId} rejected review promoted a blind artifact`);
    assert.ok(exclusion, `${run.runId} rejected review lacks an exclusion row`);
    const failure = await readRequiredJson(path.join(byRun, "failure.json"));
    assert.equal(failure.runId, run.runId);
    assert.equal(failure.blindId, run.blindId);
    assert.equal(failure.stage, "privacy-review");
    assert.equal(failure.reasonCode, exclusion.reason_code);
    validateExclusion(run, failure, exclusion);
    return baseRecord(run, "privacy-rejected", exclusion, null, null, references);
  }
  assert.equal(privacyReview.decision, "approved", `${run.runId} has no review decision`);
  assert.equal(hasBlind, true, `${run.runId} approved review lacks a blind artifact`);
  const claim = await readOptionalJson(path.join(byRun, "claim.json"));
  if (claim === null || claim.runId !== run.runId || claim.blindId !== run.blindId) {
    return baseRecord(
      run,
      "protocol-invalid",
      exclusion,
      null,
      "missing or mismatched claim",
      references,
    );
  }
  await verifyApprovedSourceDigest(run, privacyReview);
  const failure = await readOptionalJson(path.join(byRun, "failure.json"));
  const complete = await readOptionalJson(path.join(byRun, "complete.json"));
  if (failure !== null && complete !== null) {
    return baseRecord(
      run,
      "protocol-invalid",
      exclusion,
      null,
      "both failure and complete markers exist",
      references,
    );
  }
  if (failure !== null) {
    assert.equal(evaluation, null, `${run.runId} failure cannot have a score`);
    const state = classifyFailure(failure.stage);
    validateExclusion(run, failure, exclusion);
    return baseRecord(run, state, exclusion, null, null, references);
  }
  if (complete === null) {
    assert.equal(evaluation, null, `${run.runId} incomplete claim cannot have a score`);
    return baseRecord(run, "claimed-incomplete", exclusion, null, null, references);
  }
  assert.equal(exclusion, null, `${run.runId} completed run cannot also be excluded`);
  const artifactPath = path.join(blind, "artifact.json");
  const metadataPath = path.join(byRun, "metadata.json");
  const manifestPath = path.join(byRun, "bundle-manifest.json");
  const [artifactBytes, metadata, manifest, completeBytes] = await Promise.all([
    readFile(artifactPath),
    readRequiredJson(metadataPath),
    readRequiredJson(manifestPath),
    readFile(path.join(byRun, "complete.json")),
  ]);
  const artifact = JSON.parse(artifactBytes);
  assert.equal(artifact.blindId, run.blindId);
  assert.equal(metadata.runId, run.runId);
  assert.equal(metadata.blindId, run.blindId);
  assert.equal(metadata.condition, run.condition);
  assert.equal(metadata.harness, run.harness);
  assert.equal(metadata.artifactSha256, sha256(artifactBytes));
  assert.equal(complete.bundleManifestSha256, sha256(`${JSON.stringify(manifest, null, 2)}\n`));
  assert.ok(completeBytes.length > 0);
  await verifyBundleManifest(manifest);
  if (evaluation === null) {
    return baseRecord(run, "completed-unscored", null, metadata, null, references);
  }
  validateScoredSuiteIdentity(run, metadata);
  validateEvaluationForRun(evaluation, run, artifactBytes);
  const task = tasks.get(run.fixtureId);
  assert.ok(task);
  const metrics = scoreEvaluation(task, evaluation);
  return {
    ...baseRecord(run, "scored", null, metadata, null, references),
    evaluation,
    metrics,
  };
}

async function reconcileQuarantineRun(
  run,
  quarantineRun,
  hasQuarantineRun,
  hasQuarantineBlind,
  references,
) {
  if (!hasQuarantineRun) {
    return baseRecord(
      run,
      "protocol-invalid",
      null,
      null,
      "orphan quarantine blind directory",
      references,
    );
  }
  const claim = await readMinimalClaim(path.join(quarantineRun, "claim.json"), run);
  if (claim === null || !hasQuarantineBlind) {
    return baseRecord(run, "claim-incomplete", null, null, null, references);
  }
  const hasComplete = await exists(path.join(quarantineRun, "complete.json"));
  const hasFailure = await exists(path.join(quarantineRun, "failure.json"));
  if (hasComplete && hasFailure) {
    return baseRecord(
      run,
      "protocol-invalid",
      null,
      null,
      "quarantine contains both terminal markers",
      references,
    );
  }
  return baseRecord(
    run,
    hasComplete || hasFailure ? "awaiting-privacy-review" : "claim-incomplete",
    null,
    null,
    null,
    references,
  );
}

function baseRecord(run, state, exclusion, metadata, diagnostic, references = {}) {
  return {
    ...run,
    repository: run.fixtureId.startsWith("r1-") ? "carrylog" : "busycafe",
    taskFamily: tasks.get(run.fixtureId)?.taskFamily.key ?? "unknown",
    state,
    exclusion,
    metadata,
    artifactReference: references.artifactReference ?? null,
    privacyReviewReference: references.privacyReviewReference ?? null,
    diagnostic: diagnostic === null ? null : sanitizeDiagnostic(diagnostic),
    evaluation: null,
    metrics: null,
  };
}

function classifyFailure(stage) {
  if (stage === "fixture-preparation") return "preparation-failure";
  if (stage === "carrylog-delivery") return "delivery-failure";
  if (stage === "harness-authentication" || stage === "harness-execution") return "harness-failure";
  return "protocol-invalid";
}

function validateExclusion(run, failure, exclusion) {
  assert.ok(exclusion, `${run.runId} failure lacks a retained exclusion row`);
  assert.equal(exclusion.blind_id, run.blindId);
  assert.equal(exclusion.stage, failure.stage);
  assert.ok(exclusionCodebook.stages.includes(exclusion.stage));
  assert.ok(exclusionCodebook.reasonCodes.includes(exclusion.reason_code));
  assert.ok(
    exclusionCodebook.reasonStageCompatibility[exclusion.reason_code].includes(exclusion.stage),
    `${run.runId} exclusion reason is incompatible with its stage`,
  );
  assert.equal(
    exclusion.retained_artifact_path,
    `raw-reviewed/by-run/${run.runId}`,
    `${run.runId} exclusion retained path differs`,
  );
  assert.equal(exclusion.replacement_run_id, "", "Tier 1 replacements are forbidden");
}

async function verifyApprovedSourceDigest(run, privacyReview) {
  const files = await collectReviewedSourceFiles(run);
  assertAllowedReviewedFiles(
    files.map((file) => file.path),
    run,
  );
  assert.equal(
    digestFileSet(files),
    privacyReview.sourceDigest,
    `${run.runId} reviewed artifact bytes differ from the approved sourceDigest`,
  );
}

async function collectReviewedSourceFiles(run) {
  const files = [];
  await visitReviewed(path.join(rawRoot, "by-run", run.runId), `by-run/${run.runId}`, files);
  await visitReviewed(path.join(rawRoot, "blind", run.blindId), `blind/${run.blindId}`, files);
  return files
    .filter((file) => file.path !== `by-run/${run.runId}/privacy-review.json`)
    .sort((left, right) => left.path.localeCompare(right.path));
}

async function visitReviewed(directory, relative, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const child = path.posix.join(relative, entry.name);
    const metadata = await lstat(absolute);
    assert.equal(
      metadata.isSymbolicLink(),
      false,
      `reviewed artifact cannot be a symlink: ${child}`,
    );
    if (metadata.isDirectory()) await visitReviewed(absolute, child, files);
    else if (metadata.isFile()) files.push({ path: child, bytes: await readFile(absolute) });
    else throw new Error(`unsupported reviewed artifact: ${child}`);
  }
}

function assertAllowedReviewedFiles(paths, run) {
  const allowed = new Set([
    `by-run/${run.runId}/bundle-manifest.json`,
    `by-run/${run.runId}/claim.json`,
    `by-run/${run.runId}/complete.json`,
    `by-run/${run.runId}/delivery-audit.json`,
    `by-run/${run.runId}/failure.json`,
    `by-run/${run.runId}/metadata.json`,
    `by-run/${run.runId}/resume-envelope.json`,
    `blind/${run.blindId}/artifact.json`,
  ]);
  for (const filePath of paths)
    assert.ok(allowed.has(filePath), `unexpected reviewed artifact: ${filePath}`);
}

function digestFileSet(files) {
  return sha256(
    files.map((file) => `${file.path}\0${file.bytes.length}\0${sha256(file.bytes)}\n`).join(""),
  );
}

function validateScoredSuiteIdentity(run, metadata) {
  assert.ok(freezeManifest, `${run.runId} scored metadata has no freeze manifest`);
  assert.match(verifiedFreezeCommit, /^[0-9a-f]{40}$/);
  assert.match(metadata.freezeCommit, /^[0-9a-f]{40}$/);
  assert.match(metadata.frozenSuiteSha256, /^[0-9a-f]{64}$/);
  assert.equal(
    metadata.frozenSuiteSha256,
    freezeManifest.suiteSha256,
    `${run.runId} metadata suite differs from freeze manifest`,
  );
  assert.equal(
    metadata.freezeCommit,
    verifiedFreezeCommit,
    `${run.runId} metadata freeze commit differs from the permanent first-ADD boundary`,
  );
}

async function verifyBundleManifest(manifest) {
  assert.equal(manifest.formatVersion, 1);
  const rendered = manifest.files
    .map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`)
    .join("");
  assert.equal(sha256(rendered), manifest.bundleSha256);
  for (const file of manifest.files) {
    const absolute = path.resolve(rawRoot, file.path);
    assert.ok(absolute.startsWith(`${rawRoot}${path.sep}`));
    const bytes = await readFile(absolute);
    assert.equal(bytes.length, file.bytes, `bundle bytes differ for ${file.path}`);
    assert.equal(sha256(bytes), file.sha256, `bundle digest differs for ${file.path}`);
  }
}

function validateEvaluationForRun(evaluation, run, artifactBytes) {
  assert.equal(validateEvaluation(evaluation), true, JSON.stringify(validateEvaluation.errors));
  assertEvaluationEvidenceContract(evaluation);
  assert.equal(evaluation.blindId, run.blindId);
  assert.equal(evaluation.artifactSha256, sha256(artifactBytes));
  assert.equal(evaluation.scoringCodebookSha256, scoringCodebookSha256);
  assert.ok(
    scoringCodebook.deliveryEvidenceLevels.some(
      (entry) => entry.value === evaluation.deliveryEvidenceLevel,
    ),
  );
  for (const code of evaluation.unavailableEvidence) {
    assert.ok(
      scoringCodebook.unavailableEvidenceCodes.includes(code),
      `unknown unavailable code ${code}`,
    );
  }
}

function assertEvaluationEvidenceContract(evaluation) {
  for (const [collectionName, collection] of [
    ["facts", evaluation.facts],
    ["completionCriteria", evaluation.completionCriteria],
    ["prohibitedReversals", evaluation.prohibitedReversals],
    ["repeatedWork", evaluation.repeatedWork],
    ["sensitiveExposures", evaluation.sensitiveExposures],
  ]) {
    for (const item of collection) {
      if (item.available) {
        assert.ok(
          item.evidence.length >= 1,
          `${collectionName}:${item.id} available negative and positive scores require evidence`,
        );
        assert.ok(item.confidence >= 1 && item.confidence <= 3);
        assert.equal(item.unavailableReason, null);
      } else {
        assert.equal(item.evidence.length, 0);
        assert.equal(item.confidence, 0);
        assert.equal(typeof item.unavailableReason, "string");
      }
    }
  }
  if (evaluation.clarificationsAvailable) {
    assert.ok(
      evaluation.clarificationEvidence.length >= 1,
      "clarification availability requires explicit evidence",
    );
  } else {
    assert.equal(evaluation.clarificationEvidence.length, 0);
    assert.equal(evaluation.unnecessaryClarifications.length, 0);
  }
}

function scoreEvaluation(task, evaluation) {
  const facts = exactItems(task.relevantFacts, evaluation.facts, "facts");
  const criteria = exactItems(
    task.scoring.taskCompletion.criteria,
    evaluation.completionCriteria,
    "completion criteria",
  );
  const reversals = exactItems(
    task.prohibitedReversals,
    evaluation.prohibitedReversals,
    "reversals",
  );
  const repeated = exactItems(
    task.repeatedWorkIndicators,
    evaluation.repeatedWork,
    "repeated work",
  );
  const exposures = exactItems(
    task.sensitiveExclusions,
    evaluation.sensitiveExposures,
    "exposures",
  );
  const itemUnavailableReasons = [facts, criteria, reversals, repeated, exposures]
    .flat()
    .map(([, score]) => score.unavailableReason)
    .filter((reason) => reason !== null);
  if (!evaluation.clarificationsAvailable) {
    itemUnavailableReasons.push("evaluator-cannot-determine");
  }
  for (const reason of itemUnavailableReasons) {
    assert.ok(
      evaluation.unavailableEvidence.includes(reason),
      `${task.fixtureId} item unavailable reason is absent from run-level unavailable evidence: ${reason}`,
    );
  }
  const eligible = facts.filter(([fact]) => fact.continuityEligible);
  const promptFacts = facts.filter(([fact]) => !fact.continuityEligible);
  const eligibleWeight = sum(eligible.map(([fact]) => fact.weight));
  const promptWeight = sum(promptFacts.map(([fact]) => fact.weight));
  for (const [criterion, scored] of criteria) {
    if (!scored.available) continue;
    assert.ok(
      scored.awardedPoints === 0 || scored.awardedPoints === criterion.points,
      `${task.fixtureId}:${criterion.id} must be all-or-nothing`,
    );
  }
  const allAvailable = (items) => items.every(([, score]) => score.available);
  return {
    recall: allAvailable(eligible)
      ? ratio(
          sum(eligible.filter(([, score]) => score.credited).map(([fact]) => fact.weight)),
          eligibleWeight,
        )
      : null,
    contradiction: allAvailable(eligible)
      ? ratio(
          sum(eligible.filter(([, score]) => score.contradicted).map(([fact]) => fact.weight)),
          eligibleWeight,
        )
      : null,
    promptCompliance:
      promptFacts.length === 0
        ? null
        : allAvailable(promptFacts)
          ? ratio(
              sum(promptFacts.filter(([, score]) => score.credited).map(([fact]) => fact.weight)),
              promptWeight,
            )
          : null,
    reversals: allAvailable(reversals) ? sum(reversals.map(([, score]) => score.count)) : null,
    repeated: allAvailable(repeated) ? sum(repeated.map(([, score]) => score.count)) : null,
    clarifications: evaluation.clarificationsAvailable
      ? evaluation.unnecessaryClarifications.filter((item) => item.unnecessary).length
      : null,
    completion: allAvailable(criteria)
      ? sum(criteria.map(([, score]) => score.awardedPoints))
      : null,
    sensitiveExposures: allAvailable(exposures)
      ? exposures.filter(([, score]) => score.exposed).length
      : null,
    deliveryEvidenceLevel: evaluation.deliveryEvidenceLevel,
    confidence: evaluation.evaluatorConfidence,
    unavailableEvidence: evaluation.unavailableEvidence,
    itemScores: { facts, criteria, reversals, repeated, exposures },
  };
}

function exactItems(frozen, scored, label) {
  const byId = new Map(scored.map((item) => [item.id, item]));
  assert.equal(byId.size, scored.length, `duplicate ${label}`);
  assert.deepEqual(
    [...byId.keys()].sort(),
    frozen.map((item) => item.id).sort(),
    `${label} IDs differ from fixture`,
  );
  return frozen.map((item) => [item, byId.get(item.id)]);
}

function buildDescriptiveGroups(reconciledRecords) {
  const dimensions = [
    ["harness-condition", (record) => `${record.harness}|${record.condition}`],
    [
      "harness-repository-condition",
      (record) => `${record.harness}|${record.repository}|${record.condition}`,
    ],
    [
      "harness-task-family-condition",
      (record) => `${record.harness}|${record.taskFamily}|${record.condition}`,
    ],
  ];
  const output = {};
  for (const [name, keyOf] of dimensions) {
    const groups = groupBy(reconciledRecords, keyOf);
    output[name] = Object.fromEntries(
      [...groups.entries()].sort().map(([key, group]) => [key, summarizePlannedGroup(group)]),
    );
  }
  return output;
}

function summarizePlannedGroup(group) {
  const scored = group.filter((record) => record.metrics !== null);
  return {
    plannedRuns: group.length,
    scoredRuns: scored.length,
    missingRuns: group.length - scored.length,
    terminalStateCounts: countBy(group, (record) => record.state),
    ...summarizeMetrics(group),
  };
}

function summarizeMetrics(group) {
  const metric = (record, key) => record.metrics?.[key] ?? null;
  const scored = group.filter((record) => record.metrics !== null);
  return {
    recall: describeAvailable(group.map((record) => metric(record, "recall"))),
    contradiction: describeAvailable(group.map((record) => metric(record, "contradiction"))),
    promptExplicitInstructionCompliance: describeAvailable(
      group.map((record) => metric(record, "promptCompliance")),
    ),
    completion: describeAvailable(group.map((record) => metric(record, "completion"))),
    prohibitedReversals: describeAvailable(group.map((record) => metric(record, "reversals"))),
    repeatedWork: describeAvailable(group.map((record) => metric(record, "repeated"))),
    unnecessaryClarifications: describeAvailable(
      group.map((record) => metric(record, "clarifications")),
    ),
    sensitiveExposures: describeAvailable(
      group.map((record) => metric(record, "sensitiveExposures")),
    ),
    evaluatorConfidence: describeAvailable(group.map((record) => metric(record, "confidence"))),
    deliveryEvidenceLevels: countBy(scored, (record) => record.metrics.deliveryEvidenceLevel),
  };
}

function buildPairedContrasts(records) {
  const byPair = groupBy(records, (record) => `${record.harness}|${record.fixtureId}`);
  const comparisons = ["repository-only", "manual-handoff"];
  const measures = [
    ["recall", 1],
    ["contradiction", -1],
    ["completion", 1],
    ["reversals", -1],
    ["repeated", -1],
    ["clarifications", -1],
    ["sensitiveExposures", -1],
  ];
  const output = {};
  for (const harness of preregistration.matrix.harnesses) {
    const expectedPairIds = [
      ...new Set(
        order.runs
          .filter((run) => run.harness === harness)
          .map((run) => `${run.harness}|${run.fixtureId}`),
      ),
    ].sort();
    output[harness] = {};
    for (const comparison of comparisons) {
      const comparisonResult = {};
      for (const [measure, direction] of measures) {
        const deltas = [];
        for (const pairId of expectedPairIds) {
          const pair = byPair.get(pairId) ?? [];
          const treatment = pair.find((record) => record.condition === "carrylog-resume");
          const control = pair.find((record) => record.condition === comparison);
          if (
            treatment &&
            control &&
            Number.isFinite(treatment.metrics[measure]) &&
            Number.isFinite(control.metrics[measure])
          ) {
            deltas.push({
              pairId,
              value: direction * (treatment.metrics[measure] - control.metrics[measure]),
            });
          }
        }
        comparisonResult[measure] = summarizeDeltas(
          deltas,
          `${preregistration.controls.runOrderSeed}|${harness}|${comparison}|${measure}`,
          expectedPairIds,
        );
      }
      output[harness][`carrylog-resume-vs-${comparison}`] = comparisonResult;
    }
  }
  return output;
}

function buildManualRegressionFlags(records) {
  const byPair = groupBy(records, (record) => `${record.harness}|${record.fixtureId}`);
  const flags = [];
  const missingPairs = [];
  const unavailableItems = [];
  const expectedPairKeys = [
    ...new Set(order.runs.map((run) => `${run.harness}|${run.fixtureId}`)),
  ].sort();
  let screenablePairs = 0;
  for (const pairKey of expectedPairKeys) {
    const pair = byPair.get(pairKey) ?? [];
    const carrylog = pair.find((record) => record.condition === "carrylog-resume");
    const manual = pair.find((record) => record.condition === "manual-handoff");
    if (!carrylog || !manual) {
      missingPairs.push({
        pairKey,
        carrylogAvailable: Boolean(carrylog),
        manualAvailable: Boolean(manual),
      });
      continue;
    }
    screenablePairs += 1;
    compareBinaryItems(
      flags,
      unavailableItems,
      pairKey,
      "fact-miss",
      manual,
      carrylog,
      "facts",
      (_frozen, score) => score.credited,
      (frozen) => frozen.continuityEligible,
    );
    compareBinaryItems(
      flags,
      unavailableItems,
      pairKey,
      "contradiction",
      carrylog,
      manual,
      "facts",
      (_frozen, score) => score.contradicted,
    );
    compareBinaryItems(
      flags,
      unavailableItems,
      pairKey,
      "completion-miss",
      manual,
      carrylog,
      "criteria",
      (_frozen, score) => score.awardedPoints > 0,
    );
    compareCountItems(
      flags,
      unavailableItems,
      pairKey,
      "prohibited-reversal",
      manual,
      carrylog,
      "reversals",
    );
    compareCountItems(
      flags,
      unavailableItems,
      pairKey,
      "repeated-work",
      manual,
      carrylog,
      "repeated",
    );
    if (carrylog.metrics.clarifications === null || manual.metrics.clarifications === null) {
      unavailableItems.push({ pairKey, type: "unnecessary-clarification" });
    } else if (carrylog.metrics.clarifications > manual.metrics.clarifications)
      flags.push({
        pairKey,
        type: "unnecessary-clarification",
        manual: manual.metrics.clarifications,
        carrylog: carrylog.metrics.clarifications,
      });
    compareBinaryItems(
      flags,
      unavailableItems,
      pairKey,
      "sensitive-exposure",
      carrylog,
      manual,
      "exposures",
      (_frozen, score) => score.exposed,
    );
  }
  return {
    expectedPairs: expectedPairKeys.length,
    screenablePairs,
    missingPairs,
    unavailableItems,
    flags,
  };
}

function buildTier2Decision(reconciledRecords, scoredRecords, manualRegression) {
  const rule = preregistration.analysisRules.tier2DecisionRule;
  const primaryMetrics = [
    "recall",
    "contradiction",
    "completion",
    "reversals",
    "repeated",
    "clarifications",
  ];
  assert.deepEqual(rule.primaryMetrics, primaryMetrics, "Tier 2 primary metrics differ");
  assert.deepEqual(rule.precedence, ["stop", "go", "redesign"]);
  const directions = {
    recall: 1,
    contradiction: -1,
    completion: 1,
    reversals: -1,
    repeated: -1,
    clarifications: -1,
  };
  const byHarnessFixture = groupBy(
    scoredRecords,
    (record) => `${record.harness}|${record.fixtureId}`,
  );
  const fixtures = [...new Set(order.runs.map((run) => run.fixtureId))].sort();
  const comparators = ["repository-only", "manual-handoff"];
  const contrastVectors = [];
  for (const harness of preregistration.matrix.harnesses) {
    for (const fixtureId of fixtures) {
      const pair = byHarnessFixture.get(`${harness}|${fixtureId}`) ?? [];
      const carrylog = pair.find((record) => record.condition === "carrylog-resume");
      for (const comparator of comparators) {
        const control = pair.find((record) => record.condition === comparator);
        const deltas = {};
        const missingMetrics = [];
        for (const metric of primaryMetrics) {
          const treatmentValue = carrylog?.metrics?.[metric];
          const controlValue = control?.metrics?.[metric];
          if (Number.isFinite(treatmentValue) && Number.isFinite(controlValue)) {
            deltas[metric] = directions[metric] * (treatmentValue - controlValue);
          } else {
            deltas[metric] = null;
            missingMetrics.push(metric);
          }
        }
        contrastVectors.push({
          contrastId: `${harness}|${fixtureId}|carrylog-resume-vs-${comparator}`,
          harness,
          fixtureId,
          comparator,
          screenable: missingMetrics.length === 0,
          missingMetrics,
          favorableOrientedDeltas: deltas,
        });
      }
    }
  }
  const expectedContrastCount =
    preregistration.matrix.harnesses.length * fixtures.length * comparators.length;
  assert.equal(expectedContrastCount, 40, "Tier 1 must define exactly 40 contrast vectors");
  assert.equal(contrastVectors.length, expectedContrastCount);
  const screenableContrastCount = contrastVectors.filter((vector) => vector.screenable).length;

  const repositoryMacroMeans = {};
  for (const harness of preregistration.matrix.harnesses) {
    const vectors = contrastVectors.filter(
      (vector) => vector.harness === harness && vector.comparator === "repository-only",
    );
    const metrics = {};
    for (const metric of primaryMetrics) {
      const values = vectors
        .map((vector) => vector.favorableOrientedDeltas[metric])
        .filter((value) => Number.isFinite(value));
      metrics[metric] = {
        available: values.length,
        missing: vectors.length - values.length,
        mean: values.length === 0 ? null : mean(values),
      };
    }
    const means = Object.values(metrics).map((metric) => metric.mean);
    repositoryMacroMeans[harness] = {
      expectedFixtures: vectors.length,
      metrics,
      allSixNonAdverse:
        means.length === primaryMetrics.length &&
        means.every((value) => Number.isFinite(value) && value >= 0),
      strictlyFavorableCount: means.filter((value) => Number.isFinite(value) && value > 0).length,
    };
  }
  const sharedAdverseMetrics = primaryMetrics.filter((metric) =>
    preregistration.matrix.harnesses.every((harness) => {
      const value = repositoryMacroMeans[harness].metrics[metric].mean;
      return Number.isFinite(value) && value < 0;
    }),
  );

  const replicatedManualRegressionFlags = buildReplicatedManualRegressionFlags(
    manualRegression.flags,
  );
  const carrylogRecords = reconciledRecords.filter(
    (record) => record.condition === "carrylog-resume",
  );
  const privacyRejectedRunIds = carrylogRecords
    .filter(
      (record) =>
        record.state === "privacy-rejected" ||
        (record.exclusion?.stage === "privacy-review" &&
          ["sensitive-exposure", "manual-privacy-exclusion"].includes(
            record.exclusion.reason_code,
          )),
    )
    .map((record) => record.runId);
  const sensitiveExposureRunIds = carrylogRecords
    .filter(
      (record) =>
        (Number.isFinite(record.metrics?.sensitiveExposures) &&
          record.metrics.sensitiveExposures > 0) ||
        record.exclusion?.reason_code === "sensitive-exposure",
    )
    .map((record) => record.runId);
  const sensitiveExposureUnavailableRunIds = carrylogRecords
    .filter((record) => !Number.isFinite(record.metrics?.sensitiveExposures))
    .map((record) => record.runId);
  const prohibitedReversalRunIds = carrylogRecords
    .filter((record) => Number.isFinite(record.metrics?.reversals) && record.metrics.reversals > 0)
    .map((record) => record.runId);
  const prohibitedReversalUnavailableRunIds = carrylogRecords
    .filter((record) => !Number.isFinite(record.metrics?.reversals))
    .map((record) => record.runId);
  const reviewedTerminalRunIds = reconciledRecords
    .filter(isReviewedTerminal)
    .map((record) => record.runId);
  const protocolInvalidRunIds = reconciledRecords
    .filter((record) => record.state === "protocol-invalid")
    .map((record) => record.runId);
  const manualScreenComplete =
    manualRegression.missingPairs.length === 0 && manualRegression.unavailableItems.length === 0;

  const stopReasons = [];
  if (privacyRejectedRunIds.length > 0) stopReasons.push("carrylog-privacy-rejection");
  if (sensitiveExposureRunIds.length > 0) stopReasons.push("carrylog-sensitive-exposure");
  if (sharedAdverseMetrics.length >= 3) stopReasons.push("shared-adverse-repository-macro-means");
  if (replicatedManualRegressionFlags.length > 0) stopReasons.push("replicated-manual-regression");
  const stopSatisfied = stopReasons.length > 0;
  const goChecks = {
    allRunsReviewedTerminal: reviewedTerminalRunIds.length === order.runs.length,
    zeroProtocolInvalidRuns: protocolInvalidRunIds.length === 0,
    allContrastVectorsScreenable: screenableContrastCount === expectedContrastCount,
    carrylogSensitiveExposureOutcomesAvailable: sensitiveExposureUnavailableRunIds.length === 0,
    zeroCarrylogSensitiveExposures: sensitiveExposureRunIds.length === 0,
    carrylogProhibitedReversalOutcomesAvailable: prohibitedReversalUnavailableRunIds.length === 0,
    zeroCarrylogProhibitedReversals: prohibitedReversalRunIds.length === 0,
    manualRegressionScreenComplete: manualScreenComplete,
    zeroManualRegressionFlags: manualRegression.flags.length === 0,
    eachHarnessNonAdverseWithTwoFavorable: preregistration.matrix.harnesses.every(
      (harness) =>
        repositoryMacroMeans[harness].allSixNonAdverse &&
        repositoryMacroMeans[harness].strictlyFavorableCount >= 2,
    ),
  };
  const goSatisfied = Object.values(goChecks).every(Boolean);
  return {
    classification: stopSatisfied ? "STOP" : goSatisfied ? "GO" : "REDESIGN",
    precedence: ["STOP", "GO", "REDESIGN"],
    ruleInputs: {
      primaryMetrics,
      contrastDefinition: {
        harnesses: preregistration.matrix.harnesses.length,
        fixtures: fixtures.length,
        comparators,
        expectedContrastVectors: expectedContrastCount,
        screenableContrastVectors: screenableContrastCount,
        contrastVectors,
      },
      reviewedTerminalRunIds,
      protocolInvalidRunIds,
      carrylogSafety: {
        privacyRejectedRunIds,
        sensitiveExposureRunIds,
        sensitiveExposureUnavailableRunIds,
        prohibitedReversalRunIds,
        prohibitedReversalUnavailableRunIds,
      },
      manualRegression: {
        missingPairs: manualRegression.missingPairs,
        unavailableItems: manualRegression.unavailableItems,
        flags: manualRegression.flags,
        replicatedSameItemFlags: replicatedManualRegressionFlags,
      },
      repositoryOnlyMacroMeansByHarness: repositoryMacroMeans,
      sharedAdverseMetrics,
    },
    stop: { satisfied: stopSatisfied, reasons: stopReasons },
    go: { satisfied: goSatisfied, checks: goChecks },
    redesign: { satisfied: !stopSatisfied && !goSatisfied },
  };
}

function buildReplicatedManualRegressionFlags(flags) {
  const grouped = new Map();
  for (const flag of flags) {
    const separator = flag.pairKey.indexOf("|");
    assert.ok(separator > 0, `invalid manual regression pair key: ${flag.pairKey}`);
    const harness = flag.pairKey.slice(0, separator);
    const fixtureId = flag.pairKey.slice(separator + 1);
    const key = `${fixtureId}|${flag.type}|${flag.itemId ?? "<aggregate>"}`;
    const entry = grouped.get(key) ?? {
      fixtureId,
      type: flag.type,
      itemId: flag.itemId ?? null,
      harnesses: [],
    };
    if (!entry.harnesses.includes(harness)) entry.harnesses.push(harness);
    grouped.set(key, entry);
  }
  return [...grouped.values()]
    .filter((entry) =>
      preregistration.matrix.harnesses.every((harness) => entry.harnesses.includes(harness)),
    )
    .map((entry) => ({ ...entry, harnesses: [...entry.harnesses].sort() }))
    .sort((left, right) =>
      `${left.fixtureId}|${left.type}|${left.itemId ?? ""}`.localeCompare(
        `${right.fixtureId}|${right.type}|${right.itemId ?? ""}`,
      ),
    );
}

function isReviewedTerminal(record) {
  return (
    record.privacyReviewReference !== null &&
    !["not-started", "claim-incomplete", "claimed-incomplete", "awaiting-privacy-review"].includes(
      record.state,
    )
  );
}

function compareBinaryItems(
  flags,
  unavailableItems,
  pairKey,
  type,
  positiveRecord,
  negativeRecord,
  collection,
  predicate,
  eligible = () => true,
) {
  const negativeById = new Map(
    negativeRecord.metrics.itemScores[collection].map(([frozen, score]) => [
      frozen.id,
      [frozen, score],
    ]),
  );
  for (const [frozen, score] of positiveRecord.metrics.itemScores[collection]) {
    if (!eligible(frozen)) continue;
    const negative = negativeById.get(frozen.id);
    if (!score.available || !negative?.[1].available) {
      unavailableItems.push({ pairKey, type, itemId: frozen.id });
      continue;
    }
    if (predicate(frozen, score) && negative && !predicate(negative[0], negative[1]))
      flags.push({ pairKey, type, itemId: frozen.id });
  }
}

function compareCountItems(flags, unavailableItems, pairKey, type, manual, carrylog, collection) {
  const manualById = new Map(
    manual.metrics.itemScores[collection].map(([frozen, score]) => [frozen.id, score]),
  );
  for (const [frozen, score] of carrylog.metrics.itemScores[collection]) {
    const baselineScore = manualById.get(frozen.id);
    if (!score.available || !baselineScore?.available) {
      unavailableItems.push({ pairKey, type, itemId: frozen.id });
      continue;
    }
    const baseline = baselineScore.count;
    if (score.count > baseline)
      flags.push({
        pairKey,
        type,
        itemId: frozen.id,
        manual: baseline,
        carrylog: score.count,
      });
  }
}

function buildOperationalEvidence(records) {
  const completed = records.filter((record) => record.metadata !== null);
  return Object.fromEntries(
    [...groupBy(completed, (record) => `${record.harness}|${record.condition}`).entries()]
      .sort()
      .map(([key, group]) => [
        key,
        {
          n: group.length,
          preparationLatencyMs: describe(
            group.map((record) => record.metadata.preparationLatencyMs),
          ),
          harnessLatencyMs: describe(group.map((record) => record.metadata.latencyMs)),
          promptBytes: describe(group.map((record) => record.metadata.promptBytes)),
          promptCharacters: describe(group.map((record) => record.metadata.promptCharacters)),
          inputTokens: describeAvailable(
            group.map((record) => normalizeUsage(record.metadata.usage).inputTokens),
          ),
          outputTokens: describeAvailable(
            group.map((record) => normalizeUsage(record.metadata.usage).outputTokens),
          ),
          cacheTokens: describeAvailable(
            group.map((record) => normalizeUsage(record.metadata.usage).cacheTokens),
          ),
          estimatedCostUsd: describeAvailable(
            group.map((record) => record.metadata.estimatedCostUsd),
          ),
          deliveryBundle: {
            packetDeliveredRuns: group.filter(
              (record) => record.metadata.deliveryManifest?.priorSessionPacket?.delivered,
            ).length,
            resumeEnvelopeRuns: group.filter(
              (record) => record.metadata.deliveryManifest?.resumeEnvelope?.delivered,
            ).length,
            repositoryDiscoverySurfaceCounts: describe(
              group.map(
                (record) =>
                  record.metadata.deliveryManifest?.repositoryDiscoverySurfaces?.length ?? 0,
              ),
            ),
          },
        },
      ]),
  );
}

function normalizeUsage(usage) {
  if (!usage || typeof usage !== "object")
    return { inputTokens: null, outputTokens: null, cacheTokens: null };
  return {
    inputTokens: finiteOrNull(usage.input_tokens),
    outputTokens: finiteOrNull(usage.output_tokens),
    cacheTokens: finiteOrNull(usage.cached_input_tokens ?? usage.cache_read_input_tokens),
  };
}

function groupAttrition(records) {
  const groups = groupBy(records, (record) => `${record.harness}|${record.condition}`);
  return Object.fromEntries(
    [...groups.entries()]
      .sort()
      .map(([key, group]) => [key, countBy(group, (record) => record.state)]),
  );
}

function countUnavailable(records) {
  const countCodes = (group) => {
    const counts = {};
    for (const record of group) {
      for (const code of record.metrics.unavailableEvidence) {
        counts[code] = (counts[code] ?? 0) + 1;
      }
    }
    return counts;
  };
  return {
    overall: countCodes(records),
    byHarnessCondition: Object.fromEntries(
      [...groupBy(records, (record) => `${record.harness}|${record.condition}`).entries()]
        .sort()
        .map(([key, group]) => [key, countCodes(group)]),
    ),
  };
}

function buildConditionPositions() {
  const counts = Object.fromEntries(
    preregistration.matrix.conditions.map((condition) => [condition, [0, 0, 0]]),
  );
  order.runs.forEach((run, index) => {
    counts[run.condition][index % 3] += 1;
  });
  return counts;
}

function summarizeDeltas(entries, seed, expectedPairIds) {
  const values = entries.map((entry) => entry.value);
  const availablePairIds = entries.map((entry) => entry.pairId);
  const availableSet = new Set(availablePairIds);
  const positives = values.filter((value) => value > 0).length;
  const ties = values.filter((value) => value === 0).length;
  const negatives = values.filter((value) => value < 0).length;
  return {
    available: values.length,
    missing: expectedPairIds.length - values.length,
    availablePairIds,
    missingPairIds: expectedPairIds.filter((pairId) => !availableSet.has(pairId)),
    ...describe(values),
    positive: positives,
    tie: ties,
    negative: negatives,
    fixtureBootstrap95: bootstrapMean(values, seed),
  };
}

function bootstrapMean(values, seed) {
  if (values.length === 0) return null;
  const random = seededRandom(seed);
  const means = [];
  for (let iteration = 0; iteration < 10_000; iteration += 1) {
    let total = 0;
    for (let index = 0; index < values.length; index += 1)
      total += values[Math.floor(random() * values.length)];
    means.push(total / values.length);
  }
  means.sort((left, right) => left - right);
  return {
    lower: quantile(means, 0.025),
    upper: quantile(means, 0.975),
    resamples: 10_000,
  };
}

function describe(values) {
  if (values.length === 0)
    return {
      n: 0,
      mean: null,
      median: null,
      sampleSd: null,
      iqr: null,
      min: null,
      max: null,
    };
  const sorted = [...values].sort((left, right) => left - right);
  const average = mean(sorted);
  return {
    n: sorted.length,
    mean: average,
    median: quantile(sorted, 0.5),
    sampleSd:
      sorted.length < 2
        ? null
        : Math.sqrt(sum(sorted.map((value) => (value - average) ** 2)) / (sorted.length - 1)),
    iqr: quantile(sorted, 0.75) - quantile(sorted, 0.25),
    min: sorted[0],
    max: sorted.at(-1),
  };
}

function describeAvailable(values) {
  const available = values.filter((value) => value !== null && Number.isFinite(value));
  return {
    available: available.length,
    missing: values.length - available.length,
    summary: describe(available),
  };
}

async function loadEvaluations() {
  const output = new Map();
  for (const file of await readdirSafe(path.join(root, "evaluations"))) {
    if (!file.endsWith(".json")) continue;
    const filenameBlindId = file.slice(0, -".json".length);
    const reference = `evaluations/${file}`;
    if (!knownBlindIds.has(filenameBlindId)) {
      protocolDiagnostics.push({
        code: "unknown-evaluation",
        reference,
        diagnostic: sanitizeDiagnostic(`unknown evaluation ${filenameBlindId}`),
      });
      continue;
    }
    try {
      const evaluation = JSON.parse(await readFile(path.join(root, "evaluations", file), "utf8"));
      assert.equal(
        validateEvaluation(evaluation),
        true,
        `${file}: ${JSON.stringify(validateEvaluation.errors)}`,
      );
      assert.equal(file, `${evaluation.blindId}.json`);
      assert.equal(output.has(evaluation.blindId), false);
      output.set(evaluation.blindId, evaluation);
    } catch (error) {
      addRunIssue(filenameBlindId, `malformed evaluation: ${errorDiagnostic(error)}`);
    }
  }
  return output;
}

async function inspectScoredSuiteIdentities() {
  const identities = new Map();
  const evaluatedRuns = order.runs.filter((run) => evaluations.has(run.blindId));
  if (evaluatedRuns.length === 0) return null;
  if (freezeManifest === null) {
    for (const run of evaluatedRuns) addRunIssue(run.runId, "scored run has no freeze manifest");
    return null;
  }
  assert.match(freezeManifest.suiteSha256, /^[0-9a-f]{64}$/);
  let permanentFreezeCommit;
  try {
    permanentFreezeCommit = await verifyCommittedFreeze(freezeManifest, {
      tierDirectory: root,
      repositoryDirectory: projectRoot,
    });
  } catch (error) {
    for (const run of evaluatedRuns) {
      addRunIssue(run.runId, `invalid committed freeze boundary: ${errorDiagnostic(error)}`);
    }
    return null;
  }
  for (const run of evaluatedRuns) {
    try {
      const metadata = await readRequiredJson(
        path.join(rawRoot, "by-run", run.runId, "metadata.json"),
      );
      assert.match(metadata.freezeCommit, /^[0-9a-f]{40}$/);
      assert.match(metadata.frozenSuiteSha256, /^[0-9a-f]{64}$/);
      assert.equal(
        metadata.frozenSuiteSha256,
        freezeManifest.suiteSha256,
        "metadata suite differs from freeze manifest",
      );
      const identity = `${metadata.freezeCommit}|${metadata.frozenSuiteSha256}`;
      const runs = identities.get(identity) ?? [];
      runs.push(run.runId);
      identities.set(identity, runs);
      assert.equal(
        metadata.freezeCommit,
        permanentFreezeCommit,
        "metadata freeze commit differs from the permanent first-ADD boundary",
      );
    } catch (error) {
      addRunIssue(run.runId, `invalid scored suite identity: ${errorDiagnostic(error)}`);
    }
  }
  if (identities.size > 1) {
    for (const runIds of identities.values()) {
      for (const runId of runIds) addRunIssue(runId, "mixed scored freeze identities");
    }
  }
  return permanentFreezeCommit;
}

async function inspectOrphanDirectories(surfaceRoot, surfaceLabel) {
  const diagnostics = [];
  for (const entry of await readdirSafe(path.join(surfaceRoot, "by-run"))) {
    if (!knownRunIds.has(entry)) {
      diagnostics.push({
        code: "orphan-run-artifact",
        reference: `${surfaceLabel}/by-run/${entry}`,
        diagnostic: sanitizeDiagnostic(`orphan run directory ${entry}`),
      });
    }
  }
  for (const entry of await readdirSafe(path.join(surfaceRoot, "blind"))) {
    if (!knownBlindIds.has(entry)) {
      diagnostics.push({
        code: "orphan-blind-artifact",
        reference: `${surfaceLabel}/blind/${entry}`,
        diagnostic: sanitizeDiagnostic(`orphan blind directory ${entry}`),
      });
    }
  }
  return diagnostics;
}

async function buildReferences(run) {
  const artifact = `raw-reviewed/blind/${run.blindId}/artifact.json`;
  const retained = `raw-reviewed/by-run/${run.runId}`;
  const privacyReview = `${retained}/privacy-review.json`;
  const quarantineRetained = `raw-quarantine/by-run/${run.runId}`;
  const quarantineArtifact = `raw-quarantine/blind/${run.blindId}/artifact.json`;
  return {
    artifactReference: (await exists(path.join(root, artifact)))
      ? artifact
      : (await exists(path.join(root, retained)))
        ? retained
        : (await exists(path.join(root, quarantineArtifact)))
          ? quarantineArtifact
          : (await exists(path.join(root, quarantineRetained)))
            ? quarantineRetained
            : null,
    privacyReviewReference: (await exists(path.join(root, privacyReview))) ? privacyReview : null,
  };
}

async function buildReferencesSafely(run) {
  try {
    return await buildReferences(run);
  } catch {
    return { artifactReference: null, privacyReviewReference: null };
  }
}

function renderRunReconciliation(record) {
  return {
    runId: record.runId,
    blindId: record.blindId,
    state: record.state,
    exclusion: record.exclusion,
    artifactReference: record.artifactReference,
    privacyReviewReference: record.privacyReviewReference,
    diagnostic: record.diagnostic,
  };
}

function addRunIssue(runOrBlindId, diagnostic) {
  const previous = runIssues.get(runOrBlindId);
  runIssues.set(
    runOrBlindId,
    previous ? `${previous}; ${sanitizeDiagnostic(diagnostic)}` : sanitizeDiagnostic(diagnostic),
  );
}

function errorDiagnostic(error) {
  if (error instanceof Error) return sanitizeDiagnostic(error.message);
  return sanitizeDiagnostic(String(error));
}

function sanitizeDiagnostic(value) {
  const withoutControlCharacters = [...String(value)]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      return codePoint !== undefined && (codePoint < 32 || codePoint === 127) ? " " : character;
    })
    .join("");
  return withoutControlCharacters
    .replaceAll(root, "<tier1-root>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

function parseExclusions(value) {
  const rows = parseCsv(value);
  const required = [
    "run_id",
    "blind_id",
    "stage",
    "reason_code",
    "retained_artifact_path",
    "replacement_run_id",
  ];
  if (rows.header.length > 0) assert.deepEqual(rows.header, required);
  return rows.records;
}

function parseCsv(value) {
  const parsed = [];
  let row = [],
    field = "",
    quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      parsed.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    parsed.push(row);
  }
  assert.equal(quoted, false, "unterminated CSV quote");
  const nonempty = parsed.filter((record) => record.some((item) => item !== ""));
  const header = nonempty.shift() ?? [];
  return {
    header,
    records: nonempty.map((record) => {
      assert.equal(record.length, header.length);
      return Object.fromEntries(header.map((name, index) => [name, record[index]]));
    }),
  };
}

function renderDerivedScores(records) {
  const header =
    "blind_id,weighted_relevant_fact_recall,weighted_contradiction_rate,prohibited_reversal_count,repeated_work_count,unnecessary_clarification_count,task_completion_score_0_to_10,delivery_evidence_level,evaluator_confidence_0_to_3,unavailable_evidence,evaluator_notes";
  const rows = records.map((record) =>
    [
      record.blindId,
      record.metrics.recall,
      record.metrics.contradiction,
      record.metrics.reversals,
      record.metrics.repeated,
      record.metrics.clarifications,
      record.metrics.completion,
      record.metrics.deliveryEvidenceLevel,
      record.metrics.confidence,
      record.metrics.unavailableEvidence.join(";"),
      record.evaluation.notes,
    ]
      .map(csvField)
      .join(","),
  );
  return `${[header, ...rows].join("\n")}\n`;
}

function csvField(value) {
  if (value === null || value === undefined) return scoringCodebook.missingValue;
  const rendered = String(value);
  return /[",\n]/.test(rendered) ? `"${rendered.replaceAll('"', '""')}"` : rendered;
}

function groupBy(values, keyOf) {
  const groups = new Map();
  for (const value of values) {
    const key = keyOf(value);
    const group = groups.get(key) ?? [];
    group.push(value);
    groups.set(key, group);
  }
  return groups;
}

function countBy(values, keyOf) {
  const counts = {};
  for (const value of values) {
    const key = keyOf(value);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function quantile(sorted, probability) {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position),
    upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

function seededRandom(seed) {
  let state = Number.parseInt(sha256(seed).slice(0, 8), 16) || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4_294_967_296;
  };
}

function finiteOrNull(value) {
  return Number.isFinite(value) ? value : null;
}
function ratio(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}
function mean(values) {
  return sum(values) / values.length;
}
function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}
async function readRequiredJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}
async function readOptionalJson(filePath) {
  try {
    return await readRequiredJson(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return null;
    throw error;
  }
}
async function readMinimalClaim(filePath, run) {
  try {
    const claim = await readRequiredJson(filePath);
    return claim?.runId === run.runId && claim?.blindId === run.blindId ? claim : null;
  } catch {
    return null;
  }
}
async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}
async function readdirSafe(directory) {
  try {
    return await readdir(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}
