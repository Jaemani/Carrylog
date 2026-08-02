import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import Ajv2020 from "ajv/dist/2020.js";
import { buildManifest } from "../freeze.mjs";
import { generateOrder } from "../generate-order.mjs";
import {
  assertReceiptBinding,
  bindVerificationProgram,
  buildVerificationExecutablePath,
  buildVerificationRegistry,
  buildVerificationScratch,
  deriveMacosRuntimeReadPaths,
  digestRegistryBytes,
} from "../harness-contract.mjs";

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tierRoot = path.resolve(analysisRoot, "..");
const execFileAsync = promisify(execFile);
const syntheticSuiteSha256 = "b".repeat(64);

test("run order covers the matrix and balances every condition position", async () => {
  const order = await generateOrder();
  assert.equal(order.runs.length, 60);
  assert.equal(
    new Set(order.runs.map((run) => `${run.fixtureId}|${run.condition}|${run.harness}`)).size,
    60,
  );
  const positions = {};
  order.runs.forEach((run, index) => {
    positions[run.condition] ??= [0, 0, 0];
    positions[run.condition][index % 3] += 1;
  });
  for (const counts of Object.values(positions)) {
    assert.ok(counts.every((count) => count === 6 || count === 7));
  }
});

test("freeze manifest is deterministic and excludes mutable result surfaces", async () => {
  const first = await buildManifest();
  const second = await buildManifest();
  assert.deepEqual(first, second);
  const paths = first.files.map((file) => file.path);
  assert.deepEqual(
    paths.filter((filePath) => filePath.startsWith("evaluations/")),
    ["evaluations/.gitkeep"],
  );
  assert.deepEqual(
    paths.filter((filePath) => filePath.startsWith("raw-quarantine/")),
    ["raw-quarantine/.gitignore", "raw-quarantine/.gitkeep"],
  );
  assert.deepEqual(
    paths.filter((filePath) => filePath.startsWith("raw-reviewed/")),
    ["raw-reviewed/.gitkeep"],
  );
  assert.equal(paths.includes("scores.csv"), false);
  assert.equal(paths.includes("report.md"), false);
  assert.equal(paths.includes("report-template.md"), true);
  assert.equal(paths.includes("../tier1-pilot-protocol.md"), true);
});

test("evaluation schema accepts item-level evidence and rejects undeclared fields", async () => {
  const schema = JSON.parse(await readFile(path.join(tierRoot, "evaluation.schema.json"), "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const task = JSON.parse(
    await readFile(path.join(tierRoot, "tasks", "r1-carrylog-01-objective.json"), "utf8"),
  );
  const codebook = await readFile(path.join(tierRoot, "scoring-codebook.json"));
  const evaluation = {
    formatVersion: 1,
    blindId: "b-0123456789ab",
    artifactSha256: "a".repeat(64),
    scoringCodebookSha256: createHash("sha256").update(codebook).digest("hex"),
    evaluatorId: "reviewer-1",
    evaluatedAt: "2026-07-12T00:00:00Z",
    facts: task.relevantFacts.map((fact) => ({
      id: fact.id,
      available: true,
      credited: false,
      contradicted: false,
      unavailableReason: null,
      evidence: [syntheticEvidence(`fact-${fact.id}-negative`)],
      confidence: 1,
    })),
    completionCriteria: task.scoring.taskCompletion.criteria.map((criterion) => ({
      id: criterion.id,
      available: true,
      awardedPoints: 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`criterion-${criterion.id}-zero`)],
      confidence: 1,
    })),
    prohibitedReversals: task.prohibitedReversals.map((item) => ({
      id: item.id,
      available: true,
      count: 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`reversal-${item.id}-zero`)],
      confidence: 1,
    })),
    repeatedWork: task.repeatedWorkIndicators.map((item) => ({
      id: item.id,
      available: true,
      count: 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`repeated-${item.id}-zero`)],
      confidence: 1,
    })),
    unnecessaryClarifications: [],
    clarificationsAvailable: true,
    clarificationEvidence: [syntheticEvidence("clarifications-reviewed")],
    sensitiveExposures: task.sensitiveExclusions.map((item) => ({
      id: item.id,
      available: true,
      exposed: false,
      unavailableReason: null,
      evidence: [syntheticEvidence(`exposure-${item.id}-negative`)],
      confidence: 1,
    })),
    deliveryEvidenceLevel: "none",
    evaluatorConfidence: 1,
    unavailableEvidence: [],
    notes: "Synthetic contract fixture.",
  };
  assert.equal(validate(evaluation), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...evaluation, undeclared: true }), false);
  assert.equal(
    validate({
      ...evaluation,
      facts: evaluation.facts.map((fact, index) =>
        index === 0 ? { ...fact, confidence: 0 } : fact,
      ),
    }),
    false,
    "available scores require positive confidence",
  );
  assert.equal(
    validate({
      ...evaluation,
      facts: evaluation.facts.map((fact, index) =>
        index === 0
          ? {
              ...fact,
              available: false,
              credited: null,
              contradicted: null,
              unavailableReason: "evaluator-cannot-determine",
              confidence: 1,
            }
          : fact,
      ),
      unavailableEvidence: ["evaluator-cannot-determine"],
    }),
    false,
    "unavailable scores require zero confidence",
  );
  const unavailableFact = {
    ...evaluation.facts[0],
    available: false,
    credited: null,
    contradicted: null,
    unavailableReason: "evaluator-cannot-determine",
    evidence: [],
    confidence: 0,
  };
  const partlyUnavailable = {
    ...evaluation,
    facts: evaluation.facts.map((fact, index) => (index === 0 ? unavailableFact : fact)),
    unavailableEvidence: ["evaluator-cannot-determine"],
  };
  assert.equal(validate(partlyUnavailable), true, JSON.stringify(validate.errors));
  assert.equal(
    validate({
      ...partlyUnavailable,
      facts: partlyUnavailable.facts.map((fact, index) =>
        index === 0 ? { ...fact, credited: false } : fact,
      ),
    }),
    false,
    "unavailable fact values must be null",
  );
  assert.equal(
    validate({
      ...partlyUnavailable,
      facts: partlyUnavailable.facts.map((fact, index) =>
        index === 0 ? { ...fact, evidence: [syntheticEvidence("unavailable")] } : fact,
      ),
    }),
    false,
    "unavailable scores cannot retain affirmative evidence",
  );
  assert.equal(
    validate({
      ...partlyUnavailable,
      facts: partlyUnavailable.facts.map((fact, index) =>
        index === 0 ? { ...fact, unavailableReason: null } : fact,
      ),
    }),
    false,
    "unavailable scores require a reason",
  );
  assert.equal(
    validate({ ...evaluation, evaluatorConfidence: 0 }),
    false,
    "zero evaluator confidence cannot describe available scored evidence",
  );
  const whollyUnavailable = {
    ...evaluation,
    facts: evaluation.facts.map((fact) => ({
      ...fact,
      available: false,
      credited: null,
      contradicted: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    })),
    completionCriteria: evaluation.completionCriteria.map((criterion) => ({
      ...criterion,
      available: false,
      awardedPoints: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    })),
    prohibitedReversals: evaluation.prohibitedReversals.map((item) => ({
      ...item,
      available: false,
      count: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    })),
    repeatedWork: evaluation.repeatedWork.map((item) => ({
      ...item,
      available: false,
      count: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    })),
    unnecessaryClarifications: [],
    clarificationsAvailable: false,
    clarificationEvidence: [],
    sensitiveExposures: evaluation.sensitiveExposures.map((item) => ({
      ...item,
      available: false,
      exposed: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    })),
    deliveryEvidenceLevel: "verified-receipt",
    evaluatorConfidence: 0,
    unavailableEvidence: ["evaluator-cannot-determine"],
  };
  assert.equal(
    validate(whollyUnavailable),
    true,
    `delivery receipts remain orthogonal to score availability: ${JSON.stringify(validate.errors)}`,
  );
  assert.equal(
    validate({
      ...whollyUnavailable,
      unavailableEvidence: ["provider-cost-unavailable"],
    }),
    false,
    "zero confidence and unavailable clarification scoring require an outcome reason",
  );
  assert.equal(validate({ ...evaluation, evaluatorConfidence: 4 }), false);
  assert.equal(validate({ ...evaluation, deliveryEvidenceLevel: "receipt-is-success" }), false);
  assert.equal(
    validate({
      ...evaluation,
      facts: evaluation.facts.map((fact, index) =>
        index === 0 ? { ...fact, evidence: [] } : fact,
      ),
    }),
    false,
    "negative fact judgments also require evidence",
  );
  assert.equal(
    validate({ ...evaluation, clarificationEvidence: [] }),
    false,
    "clarification availability requires explicit evidence",
  );
});

test("verification MCP exposes only frozen no-argument commands", async (context) => {
  if (process.platform !== "darwin") {
    context.skip("Verification MCP execution requires the frozen macOS Seatbelt runtime.");
    return;
  }
  const temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), "carrylog-mcp-contract-")),
  );
  const verificationDirectory = path.join(temporaryRoot, "verification");
  const checkout = path.join(temporaryRoot, "checkout");
  const gitDirectory = path.join(temporaryRoot, "repository.git");
  const receiptPath = path.join(verificationDirectory, "receipts.jsonl");
  const registryPath = path.join(verificationDirectory, "commands.json");
  try {
    const scratch = buildVerificationScratch(path.join(temporaryRoot, "scratch"));
    for (const directory of [
      scratch.root,
      scratch.home,
      scratch.tmp,
      scratch.xdgConfig,
      scratch.xdgCache,
      scratch.npmCache,
      scratch.uvCache,
    ]) {
      await mkdir(directory, { recursive: true });
    }
    await writeFile(scratch.npmUserConfig, "");
    await writeFile(scratch.npmGlobalConfig, "");
    await mkdir(verificationDirectory);
    await mkdir(checkout);
    await execFileAsync("git", ["init", "--quiet", "--bare", gitDirectory]);
    const gitEnvironment = {
      ...process.env,
      GIT_DIR: await realpath(gitDirectory),
      GIT_WORK_TREE: await realpath(checkout),
      GIT_OPTIONAL_LOCKS: "0",
    };
    await writeFile(path.join(checkout, "tracked.txt"), "baseline\n");
    await execFileAsync("git", ["add", "-A"], { env: gitEnvironment });
    await execFileAsync(
      "git",
      [
        "-c",
        "user.name=Pilot",
        "-c",
        "user.email=pilot.invalid",
        "commit",
        "--quiet",
        "-m",
        "baseline",
      ],
      { env: gitEnvironment },
    );
    const developerDirectory = await resolveDeveloperDirectory();
    const registry = buildVerificationRegistry({
      harness: "claude",
      commands: [
        {
          id: "registered",
          cwd: ".",
          executable: process.execPath,
          gitContext: "none",
          arguments: ["-e", "process.stdout.write('MCP_OK')"],
          timeoutMs: 10_000,
        },
      ],
      scratch,
      executablePath: buildVerificationExecutablePath([process.execPath], developerDirectory),
      receiptPath,
      checkout,
      verificationDirectory,
      runtimeReadPaths: await nodeRuntimeReadPaths(),
      developerDirectory,
      gitDirectory: await realpath(gitDirectory),
    });
    const registryBytes = `${JSON.stringify(registry, null, 2)}\n`;
    const registrySha256 = digestRegistryBytes(registryBytes);
    await writeFile(registryPath, registryBytes);
    await writeFile(receiptPath, "", { mode: 0o600, flag: "wx" });
    const server = path.join(verificationDirectory, "verification-mcp-server.mjs");
    const wrapper = path.join(verificationDirectory, "run-check.mjs");
    await writeFile(
      server,
      bindVerificationProgram(
        await readFile(path.join(analysisRoot, "verification-mcp-server.mjs"), "utf8"),
        registrySha256,
      ),
    );
    await writeFile(
      wrapper,
      bindVerificationProgram(
        await readFile(path.join(analysisRoot, "fixture-command-wrapper.mjs"), "utf8"),
        registrySha256,
      ),
    );
    const responses = await invokeMcp(server, registryPath);
    assert.equal(responses[0].result.serverInfo.name, "carrylog-tier1-verification");
    assert.deepEqual(
      responses[1].result.tools.map((tool) => tool.name),
      ["verify_registered"],
    );
    assert.equal(responses[2].result.content[0].text, "MCP_OK");
    assert.equal(responses[2].result.isError, false);
    assert.equal(responses[3].error.code, -32602);
    const receipts = (await readFile(receiptPath, "utf8"))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line));
    assert.equal(receipts.length, 1, "broker must append exactly one receipt per command call");
    assertReceiptBinding(receipts[0], {
      registrySha256,
      commandDigests: { registered: registry.commands[0].commandSha256 },
    });
    assert.equal(receipts[0].stdoutSha256, sha256("MCP_OK"));
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("analysis reconciles scored, failed, and unstarted runs from auditable items", async () => {
  const temporaryParent = await mkdtemp(path.join(tmpdir(), "carrylog-analysis-contract-"));
  const temporaryTier = path.join(temporaryParent, "research", "continuity", "tier1");
  try {
    await mkdir(path.dirname(temporaryTier), { recursive: true });
    await cp(tierRoot, temporaryTier, { recursive: true });
    await resetSyntheticResultSurfaces(temporaryTier);
    await rm(path.join(temporaryTier, "raw-reviewed"), {
      recursive: true,
      force: true,
    });
    await rm(path.join(temporaryTier, "evaluations"), {
      recursive: true,
      force: true,
    });
    await mkdir(path.join(temporaryTier, "raw-reviewed", "by-run"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryTier, "raw-reviewed", "blind"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryTier, "evaluations"), { recursive: true });
    await writeJson(path.join(temporaryTier, "freeze-manifest.json"), {
      formatVersion: 1,
      protocolVersion: 1,
      suiteSha256: syntheticSuiteSha256,
      files: [],
    });
    const syntheticFreezeCommit = await commitFreezeManifest(temporaryParent, temporaryTier);
    const order = JSON.parse(await readFile(path.join(temporaryTier, "run-order.json"), "utf8"));
    const [scoredRun, failedRun] = order.runs;
    const task = JSON.parse(
      await readFile(path.join(temporaryTier, "tasks", `${scoredRun.fixtureId}.json`), "utf8"),
    );
    const scoredByRun = path.join(temporaryTier, "raw-reviewed", "by-run", scoredRun.runId);
    const scoredBlind = path.join(temporaryTier, "raw-reviewed", "blind", scoredRun.blindId);
    await mkdir(scoredByRun);
    await mkdir(scoredBlind);
    const artifact = {
      formatVersion: 1,
      blindId: scoredRun.blindId,
      finalResponse: "Synthetic visible result.",
      workspaceDiff: "",
      untrackedPaths: [],
      exitStatus: 0,
      verificationReceipts: [],
    };
    const artifactBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
    const metadata = {
      runId: scoredRun.runId,
      blindId: scoredRun.blindId,
      condition: scoredRun.condition,
      harness: scoredRun.harness,
      freezeCommit: syntheticFreezeCommit,
      frozenSuiteSha256: syntheticSuiteSha256,
      artifactSha256: sha256(artifactBytes),
      preparationLatencyMs: 100,
      latencyMs: 200,
      promptBytes: 300,
      promptCharacters: 250,
      usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 2 },
      estimatedCostUsd: null,
    };
    const delivery = {
      formatVersion: 1,
      visibleEvents: [],
      commandRecords: [],
      verificationReceipts: [],
    };
    await writeFile(path.join(scoredBlind, "artifact.json"), artifactBytes);
    await writeJson(path.join(scoredByRun, "claim.json"), {
      formatVersion: 1,
      runId: scoredRun.runId,
      blindId: scoredRun.blindId,
    });
    await writeJson(path.join(scoredByRun, "metadata.json"), metadata);
    await writeJson(path.join(scoredByRun, "delivery-audit.json"), delivery);
    const bundleFiles = [];
    for (const [relative, absolute] of [
      [`blind/${scoredRun.blindId}/artifact.json`, path.join(scoredBlind, "artifact.json")],
      [
        `by-run/${scoredRun.runId}/delivery-audit.json`,
        path.join(scoredByRun, "delivery-audit.json"),
      ],
      [`by-run/${scoredRun.runId}/metadata.json`, path.join(scoredByRun, "metadata.json")],
    ]) {
      const bytes = await readFile(absolute);
      bundleFiles.push({
        path: relative,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
    bundleFiles.sort((left, right) => left.path.localeCompare(right.path));
    const manifest = {
      formatVersion: 1,
      files: bundleFiles,
      bundleSha256: sha256(
        bundleFiles.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""),
      ),
    };
    await writeJson(path.join(scoredByRun, "bundle-manifest.json"), manifest);
    await writeJson(path.join(scoredByRun, "complete.json"), {
      formatVersion: 1,
      runId: scoredRun.runId,
      blindId: scoredRun.blindId,
      bundleManifestSha256: sha256(`${JSON.stringify(manifest, null, 2)}\n`),
    });
    await writeApprovedPrivacyReview(scoredByRun, scoredBlind, scoredRun);
    const codebookBytes = await readFile(path.join(temporaryTier, "scoring-codebook.json"));
    const evaluationPath = path.join(temporaryTier, "evaluations", `${scoredRun.blindId}.json`);
    const scoredEvaluation = buildEvaluation(
      task,
      scoredRun.blindId,
      sha256(artifactBytes),
      sha256(codebookBytes),
    );
    await writeJson(evaluationPath, scoredEvaluation);

    const regressionCarrylog = order.runs.find(
      (run) =>
        run.condition === "carrylog-resume" &&
        run.runId !== failedRun.runId &&
        `${run.harness}|${run.fixtureId}` !== `${scoredRun.harness}|${scoredRun.fixtureId}`,
    );
    assert.ok(regressionCarrylog);
    const regressionManual = order.runs.find(
      (run) =>
        run.harness === regressionCarrylog.harness &&
        run.fixtureId === regressionCarrylog.fixtureId &&
        run.condition === "manual-handoff",
    );
    assert.ok(regressionManual);
    const regressionTask = JSON.parse(
      await readFile(
        path.join(temporaryTier, "tasks", `${regressionCarrylog.fixtureId}.json`),
        "utf8",
      ),
    );
    await materializeScoredRun(
      temporaryTier,
      regressionManual,
      regressionTask,
      codebookBytes,
      syntheticFreezeCommit,
    );
    await materializeScoredRun(
      temporaryTier,
      regressionCarrylog,
      regressionTask,
      codebookBytes,
      syntheticFreezeCommit,
      (evaluation) => {
        evaluation.facts[0] = {
          ...evaluation.facts[0],
          available: false,
          credited: null,
          contradicted: null,
          unavailableReason: "evaluator-cannot-determine",
          evidence: [],
          confidence: 0,
        };
        evaluation.unavailableEvidence.push("evaluator-cannot-determine");
      },
    );

    const failedByRun = path.join(temporaryTier, "raw-reviewed", "by-run", failedRun.runId);
    const failedBlind = path.join(temporaryTier, "raw-reviewed", "blind", failedRun.blindId);
    await mkdir(failedByRun);
    await mkdir(failedBlind);
    await writeJson(path.join(failedByRun, "claim.json"), {
      formatVersion: 1,
      runId: failedRun.runId,
      blindId: failedRun.blindId,
    });
    await writeJson(path.join(failedByRun, "failure.json"), {
      formatVersion: 1,
      runId: failedRun.runId,
      blindId: failedRun.blindId,
      stage: "harness-execution",
      error: "synthetic timeout",
    });
    await writeApprovedPrivacyReview(failedByRun, failedBlind, failedRun);
    await writeFile(
      path.join(temporaryTier, "exclusions.csv"),
      `run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n${failedRun.runId},${failedRun.blindId},harness-execution,provider-timeout,raw-reviewed/by-run/${failedRun.runId},\n`,
    );
    const analyzed = await execFileAsync(
      process.execPath,
      [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const result = JSON.parse(analyzed.stdout);
    assert.equal(result.plannedRuns, 60);
    assert.equal(result.statusCounts.scored, 3);
    assert.equal(result.statusCounts["harness-failure"], 1);
    assert.equal(result.statusCounts["not-started"], 56);
    assert.equal(result.scoredRuns, 3);
    assert.equal(result.tier2Decision.classification, "REDESIGN");
    assert.equal(result.tier2Decision.ruleInputs.contrastDefinition.expectedContrastVectors, 40);
    assert.equal(result.tier2Decision.ruleInputs.contrastDefinition.contrastVectors.length, 40);
    assert.equal(result.tier2Decision.ruleInputs.contrastDefinition.screenableContrastVectors, 0);
    assert.equal(result.runReconciliation.length, 60);
    assert.deepEqual(Object.keys(result.runReconciliation[0]), [
      "runId",
      "blindId",
      "state",
      "exclusion",
      "artifactReference",
      "privacyReviewReference",
      "diagnostic",
    ]);
    assert.equal(
      result.runReconciliation.find((record) => record.runId === scoredRun.runId).artifactReference,
      `raw-reviewed/blind/${scoredRun.blindId}/artifact.json`,
    );
    const scoredGroupKey = `${scoredRun.harness}|${scoredRun.condition}`;
    const zeroGroupKey = Object.entries(result.descriptiveGroups["harness-condition"]).find(
      ([key, group]) => key !== scoredGroupKey && group.scoredRuns === 0,
    )?.[0];
    assert.ok(zeroGroupKey);
    assert.equal(result.descriptiveGroups["harness-condition"][zeroGroupKey].plannedRuns, 10);
    assert.equal(result.manualRegressionFlags.screenablePairs, 1);
    assert.equal(result.manualRegressionFlags.missingPairs.length, 19);
    assert.equal(
      result.manualRegressionFlags.unavailableItems.some(
        (item) =>
          item.pairKey === `${regressionCarrylog.harness}|${regressionCarrylog.fixtureId}` &&
          item.itemId === regressionTask.relevantFacts[0].id,
      ),
      true,
    );
    assert.equal(result.descriptiveGroups["harness-condition"][zeroGroupKey].scoredRuns, 0);
    assert.equal(result.descriptiveGroups["harness-condition"][zeroGroupKey].missingRuns, 10);
    assert.equal(
      result.operationalEvidence[`${scoredRun.harness}|${scoredRun.condition}`].inputTokens.summary
        .mean,
      10,
    );
    const unavailableEvaluation = structuredClone(scoredEvaluation);
    unavailableEvaluation.facts[0] = {
      ...unavailableEvaluation.facts[0],
      available: false,
      credited: null,
      contradicted: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    };
    unavailableEvaluation.completionCriteria[0] = {
      ...unavailableEvaluation.completionCriteria[0],
      available: false,
      awardedPoints: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    };
    unavailableEvaluation.prohibitedReversals[0] = {
      ...unavailableEvaluation.prohibitedReversals[0],
      available: false,
      count: null,
      unavailableReason: "evaluator-cannot-determine",
      evidence: [],
      confidence: 0,
    };
    unavailableEvaluation.unavailableEvidence.push("evaluator-cannot-determine");
    await writeJson(evaluationPath, unavailableEvaluation);
    const unavailableAnalysis = await execFileAsync(
      process.execPath,
      [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier, "--write-derived"],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const unavailableResult = JSON.parse(unavailableAnalysis.stdout);
    const group =
      unavailableResult.descriptiveGroups["harness-condition"][
        `${scoredRun.harness}|${scoredRun.condition}`
      ];
    assert.equal(group.recall.available, 0);
    assert.equal(group.recall.missing, group.plannedRuns);
    assert.equal(group.completion.available, 0);
    assert.equal(group.completion.missing, group.plannedRuns);
    assert.equal(group.prohibitedReversals.available, 0);
    assert.equal(group.prohibitedReversals.missing, group.plannedRuns);
    assert.equal(unavailableResult.manualRegressionFlags.screenablePairs, 1);
    assert.equal(unavailableResult.manualRegressionFlags.missingPairs.length, 19);
    const paired =
      unavailableResult.pairedContrasts[scoredRun.harness]["carrylog-resume-vs-manual-handoff"]
        .recall;
    assert.equal(paired.available, 0);
    assert.equal(paired.missingPairIds.length, 10);
    assert.match(await readFile(path.join(temporaryTier, "scores.csv"), "utf8"), /,NA,NA,/);

    const scoredRuns = [scoredRun, regressionManual, regressionCarrylog];
    for (const candidate of scoredRuns) {
      const byRun = path.join(temporaryTier, "raw-reviewed", "by-run", candidate.runId);
      const blind = path.join(temporaryTier, "raw-reviewed", "blind", candidate.blindId);
      const metadataPath = path.join(byRun, "metadata.json");
      const candidateMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
      candidateMetadata.freezeCommit = "d".repeat(40);
      await writeJson(metadataPath, candidateMetadata);
      await writeApprovedPrivacyReview(byRun, blind, candidate);
    }
    const falseBoundaryAnalysis = await execFileAsync(
      process.execPath,
      [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const falseBoundaryResult = JSON.parse(falseBoundaryAnalysis.stdout);
    assert.equal(
      falseBoundaryResult.scoredRuns,
      0,
      "a common invented freeze commit must not replace the permanent first-ADD boundary",
    );
    assert.equal(
      falseBoundaryResult.runReconciliation.filter((record) => record.state === "protocol-invalid")
        .length,
      3,
    );
    for (const candidate of scoredRuns) {
      const byRun = path.join(temporaryTier, "raw-reviewed", "by-run", candidate.runId);
      const blind = path.join(temporaryTier, "raw-reviewed", "blind", candidate.blindId);
      const metadataPath = path.join(byRun, "metadata.json");
      const candidateMetadata = JSON.parse(await readFile(metadataPath, "utf8"));
      candidateMetadata.freezeCommit = syntheticFreezeCommit;
      await writeJson(metadataPath, candidateMetadata);
      await writeApprovedPrivacyReview(byRun, blind, candidate);
    }

    const mixedByRun = path.join(temporaryTier, "raw-reviewed", "by-run", regressionCarrylog.runId);
    const mixedBlind = path.join(
      temporaryTier,
      "raw-reviewed",
      "blind",
      regressionCarrylog.blindId,
    );
    const mixedMetadataPath = path.join(mixedByRun, "metadata.json");
    const mixedMetadata = JSON.parse(await readFile(mixedMetadataPath, "utf8"));
    mixedMetadata.freezeCommit = "c".repeat(40);
    await writeJson(mixedMetadataPath, mixedMetadata);
    await writeApprovedPrivacyReview(mixedByRun, mixedBlind, regressionCarrylog);
    const mixedAnalysis = await execFileAsync(
      process.execPath,
      [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const mixedResult = JSON.parse(mixedAnalysis.stdout);
    assert.equal(mixedResult.scoredRuns, 0, "mixed freeze identities invalidate every scored run");
    assert.equal(
      mixedResult.runReconciliation.filter((record) => record.state === "protocol-invalid").length,
      3,
    );
    mixedMetadata.freezeCommit = syntheticFreezeCommit;
    await writeJson(mixedMetadataPath, mixedMetadata);
    await writeApprovedPrivacyReview(mixedByRun, mixedBlind, regressionCarrylog);

    await writeFile(path.join(scoredBlind, "artifact.json"), "{ malformed\n");
    await mkdir(path.join(temporaryTier, "raw-reviewed", "by-run", "orphan-run"));
    const malformedEvaluationRun = order.runs.find(
      (run) =>
        ![
          scoredRun.runId,
          failedRun.runId,
          regressionCarrylog.runId,
          regressionManual.runId,
        ].includes(run.runId),
    );
    assert.ok(malformedEvaluationRun);
    await writeFile(
      path.join(temporaryTier, "evaluations", `${malformedEvaluationRun.blindId}.json`),
      "{ malformed\n",
    );
    await writeFile(path.join(temporaryTier, "evaluations", "b-ffffffffffff.json"), "{}\n");
    const malformedAnalysis = await execFileAsync(
      process.execPath,
      [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier],
      { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
    );
    const malformedResult = JSON.parse(malformedAnalysis.stdout);
    assert.equal(
      malformedResult.runReconciliation.find((record) => record.runId === scoredRun.runId).state,
      "protocol-invalid",
    );
    assert.match(
      malformedResult.runReconciliation.find((record) => record.runId === scoredRun.runId)
        .diagnostic,
      /approved sourceDigest/,
    );
    assert.equal(
      malformedResult.runReconciliation.find(
        (record) => record.runId === malformedEvaluationRun.runId,
      ).state,
      "protocol-invalid",
    );
    assert.equal(
      malformedResult.protocolDiagnostics.some(
        (diagnostic) => diagnostic.code === "orphan-run-artifact",
      ),
      true,
    );
    assert.equal(
      malformedResult.protocolDiagnostics.some(
        (diagnostic) => diagnostic.code === "unknown-evaluation",
      ),
      true,
    );
  } finally {
    await rm(temporaryParent, { recursive: true, force: true });
  }
});

test("Tier 2 decision applies the frozen 40-vector STOP, GO, REDESIGN rule mechanically", async () => {
  const repositoryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-tier2-contract-"));
  const temporaryTier = path.join(repositoryRoot, "research", "continuity", "tier1");
  try {
    await mkdir(path.dirname(temporaryTier), { recursive: true });
    await cp(tierRoot, temporaryTier, { recursive: true });
    await resetSyntheticResultSurfaces(temporaryTier);
    await rm(path.join(temporaryTier, "raw-reviewed"), {
      recursive: true,
      force: true,
    });
    await rm(path.join(temporaryTier, "evaluations"), {
      recursive: true,
      force: true,
    });
    await mkdir(path.join(temporaryTier, "raw-reviewed", "by-run"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryTier, "raw-reviewed", "blind"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryTier, "evaluations"), { recursive: true });
    await writeJson(path.join(temporaryTier, "freeze-manifest.json"), {
      formatVersion: 1,
      protocolVersion: 1,
      suiteSha256: syntheticSuiteSha256,
      files: [],
    });
    const freezeCommit = await commitFreezeManifest(repositoryRoot, temporaryTier);
    const order = JSON.parse(await readFile(path.join(temporaryTier, "run-order.json"), "utf8"));
    const codebookBytes = await readFile(path.join(temporaryTier, "scoring-codebook.json"));
    for (const run of order.runs) {
      const task = JSON.parse(
        await readFile(path.join(temporaryTier, "tasks", `${run.fixtureId}.json`), "utf8"),
      );
      await materializeScoredRun(
        temporaryTier,
        run,
        task,
        codebookBytes,
        freezeCommit,
        (evaluation) => {
          const eligibleFact = task.relevantFacts.findIndex((fact) => fact.continuityEligible);
          assert.ok(eligibleFact >= 0);
          evaluation.facts[eligibleFact].credited = run.condition !== "repository-only";
          evaluation.completionCriteria[0].awardedPoints =
            run.condition === "repository-only"
              ? 0
              : task.scoring.taskCompletion.criteria[0].points;
        },
      );
    }
    const analyze = async () =>
      JSON.parse(
        (
          await execFileAsync(
            process.execPath,
            [path.join(analysisRoot, "analyze.mjs"), "--root", temporaryTier],
            { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
          )
        ).stdout,
      );
    const evaluationPath = (run) => path.join(temporaryTier, "evaluations", `${run.blindId}.json`);
    const baselineEvaluations = new Map(
      await Promise.all(
        order.runs.map(async (run) => [run.blindId, await readFile(evaluationPath(run))]),
      ),
    );
    const restoreEvaluations = async () => {
      await Promise.all(
        order.runs.map((run) =>
          writeFile(evaluationPath(run), baselineEvaluations.get(run.blindId)),
        ),
      );
    };
    const editEvaluation = async (run, mutate) => {
      const target = evaluationPath(run);
      const evaluation = JSON.parse(await readFile(target, "utf8"));
      const task = JSON.parse(
        await readFile(path.join(temporaryTier, "tasks", `${run.fixtureId}.json`), "utf8"),
      );
      mutate(evaluation, task);
      await writeJson(target, evaluation);
    };
    const go = await analyze();
    assert.equal(go.tier2Decision.classification, "GO");
    assert.equal(go.tier2Decision.stop.satisfied, false);
    assert.equal(go.tier2Decision.go.satisfied, true);
    assert.equal(go.tier2Decision.ruleInputs.contrastDefinition.expectedContrastVectors, 40);
    assert.equal(go.tier2Decision.ruleInputs.contrastDefinition.screenableContrastVectors, 40);
    assert.equal(go.tier2Decision.ruleInputs.reviewedTerminalRunIds.length, 60);
    assert.equal(go.tier2Decision.ruleInputs.protocolInvalidRunIds.length, 0);
    for (const harness of ["codex", "claude"]) {
      const macro = go.tier2Decision.ruleInputs.repositoryOnlyMacroMeansByHarness[harness];
      assert.equal(macro.allSixNonAdverse, true);
      assert.ok(macro.strictlyFavorableCount >= 2);
    }

    const sensitiveRun = order.runs.find((run) => run.condition === "carrylog-resume");
    assert.ok(sensitiveRun);
    await editEvaluation(sensitiveRun, (evaluation) => {
      evaluation.sensitiveExposures[0].exposed = true;
    });
    const sensitiveStop = await analyze();
    assert.equal(sensitiveStop.tier2Decision.classification, "STOP");
    assert.deepEqual(sensitiveStop.tier2Decision.stop.reasons, ["carrylog-sensitive-exposure"]);
    assert.equal(sensitiveStop.tier2Decision.go.satisfied, false);
    assert.equal(sensitiveStop.tier2Decision.redesign.satisfied, false);
    await restoreEvaluations();

    const regressionFixture = order.runs.find(
      (run) => run.harness === "codex" && run.condition === "carrylog-resume",
    ).fixtureId;
    const codexRegression = order.runs.find(
      (run) =>
        run.fixtureId === regressionFixture &&
        run.harness === "codex" &&
        run.condition === "carrylog-resume",
    );
    const claudeRegression = order.runs.find(
      (run) =>
        run.fixtureId === regressionFixture &&
        run.harness === "claude" &&
        run.condition === "carrylog-resume",
    );
    assert.ok(codexRegression && claudeRegression);
    const removeEligibleFact = (evaluation, task) => {
      const eligibleFact = task.relevantFacts.findIndex((fact) => fact.continuityEligible);
      assert.ok(eligibleFact >= 0);
      evaluation.facts[eligibleFact].credited = false;
    };

    await editEvaluation(codexRegression, removeEligibleFact);
    const isolatedRegression = await analyze();
    assert.equal(isolatedRegression.tier2Decision.classification, "REDESIGN");
    assert.equal(isolatedRegression.tier2Decision.stop.satisfied, false);
    assert.equal(
      isolatedRegression.tier2Decision.ruleInputs.manualRegression.replicatedSameItemFlags.length,
      0,
    );
    assert.ok(
      isolatedRegression.tier2Decision.ruleInputs.manualRegression.flags.some(
        (flag) => flag.pairKey === `codex|${regressionFixture}` && flag.type === "fact-miss",
      ),
    );
    await restoreEvaluations();

    await editEvaluation(codexRegression, removeEligibleFact);
    await editEvaluation(claudeRegression, removeEligibleFact);
    const replicatedRegression = await analyze();
    assert.equal(replicatedRegression.tier2Decision.classification, "STOP");
    assert.deepEqual(replicatedRegression.tier2Decision.stop.reasons, [
      "replicated-manual-regression",
    ]);
    assert.equal(
      replicatedRegression.tier2Decision.ruleInputs.manualRegression.replicatedSameItemFlags.length,
      1,
    );
    await restoreEvaluations();

    for (const run of order.runs) {
      await editEvaluation(run, (evaluation, task) => {
        const eligibleFact = task.relevantFacts.findIndex((fact) => fact.continuityEligible);
        assert.ok(eligibleFact >= 0);
        const repositoryOnly = run.condition === "repository-only";
        evaluation.facts[eligibleFact].credited = repositoryOnly;
        evaluation.completionCriteria[0].awardedPoints = repositoryOnly
          ? task.scoring.taskCompletion.criteria[0].points
          : 0;
        evaluation.prohibitedReversals[0].count = repositoryOnly ? 0 : 1;
      });
    }
    const sharedAdverse = await analyze();
    assert.equal(sharedAdverse.tier2Decision.classification, "STOP");
    assert.deepEqual(sharedAdverse.tier2Decision.stop.reasons, [
      "shared-adverse-repository-macro-means",
    ]);
    assert.deepEqual(sharedAdverse.tier2Decision.ruleInputs.sharedAdverseMetrics, [
      "recall",
      "completion",
      "reversals",
    ]);
    await restoreEvaluations();

    const invalidRun = order.runs.find((run) => run.condition === "repository-only");
    assert.ok(invalidRun);
    await writeFile(evaluationPath(invalidRun), "{ malformed\n");
    const incomplete = await analyze();
    assert.equal(incomplete.tier2Decision.classification, "REDESIGN");
    assert.equal(incomplete.tier2Decision.stop.satisfied, false);
    assert.deepEqual(incomplete.tier2Decision.ruleInputs.protocolInvalidRunIds, [invalidRun.runId]);
    assert.equal(
      incomplete.tier2Decision.ruleInputs.contrastDefinition.screenableContrastVectors,
      39,
    );
    await restoreEvaluations();

    const privacyRejectedRun = order.runs.find(
      (run) => run.condition === "carrylog-resume" && run.runId !== sensitiveRun.runId,
    );
    assert.ok(privacyRejectedRun);
    const rejectedByRun = path.join(
      temporaryTier,
      "raw-reviewed",
      "by-run",
      privacyRejectedRun.runId,
    );
    await rm(rejectedByRun, { recursive: true, force: true });
    await rm(path.join(temporaryTier, "raw-reviewed", "blind", privacyRejectedRun.blindId), {
      recursive: true,
      force: true,
    });
    await rm(evaluationPath(privacyRejectedRun));
    await mkdir(rejectedByRun);
    await writeJson(path.join(rejectedByRun, "privacy-review.json"), {
      formatVersion: 1,
      runId: privacyRejectedRun.runId,
      blindId: privacyRejectedRun.blindId,
      reviewerId: "reviewer-1",
      reviewedAt: "2026-07-12T00:00:00Z",
      sourceDigest: "c".repeat(64),
      decision: "rejected",
      reasonCode: "manual-privacy-exclusion",
      attestation: "Synthetic rejected privacy review.",
    });
    await writeJson(path.join(rejectedByRun, "failure.json"), {
      formatVersion: 1,
      runId: privacyRejectedRun.runId,
      blindId: privacyRejectedRun.blindId,
      stage: "privacy-review",
      reasonCode: "manual-privacy-exclusion",
    });
    await writeFile(
      path.join(temporaryTier, "exclusions.csv"),
      `run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n${privacyRejectedRun.runId},${privacyRejectedRun.blindId},privacy-review,manual-privacy-exclusion,raw-reviewed/by-run/${privacyRejectedRun.runId},\n`,
    );
    const privacyStop = await analyze();
    assert.equal(privacyStop.tier2Decision.classification, "STOP");
    assert.deepEqual(privacyStop.tier2Decision.stop.reasons, ["carrylog-privacy-rejection"]);
    assert.deepEqual(privacyStop.tier2Decision.ruleInputs.carrylogSafety.privacyRejectedRunIds, [
      privacyRejectedRun.runId,
    ]);

    await editEvaluation(sensitiveRun, (evaluation) => {
      evaluation.sensitiveExposures[0].exposed = true;
    });
    const multipleStop = await analyze();
    assert.equal(multipleStop.tier2Decision.classification, "STOP");
    assert.deepEqual(multipleStop.tier2Decision.stop.reasons, [
      "carrylog-privacy-rejection",
      "carrylog-sensitive-exposure",
    ]);
    assert.equal(multipleStop.tier2Decision.go.satisfied, false);
    assert.equal(multipleStop.tier2Decision.redesign.satisfied, false);
  } finally {
    await rm(repositoryRoot, { recursive: true, force: true });
  }
});

test("privacy review promotes clean failures and rejects credential-like content", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-review-contract-"));
  try {
    await cp(path.join(tierRoot, "run-order.json"), path.join(temporaryRoot, "run-order.json"));
    await cp(
      path.join(tierRoot, "exclusion-codebook.json"),
      path.join(temporaryRoot, "exclusion-codebook.json"),
    );
    await writeFile(
      path.join(temporaryRoot, "exclusions.csv"),
      "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
    );
    const order = JSON.parse(await readFile(path.join(temporaryRoot, "run-order.json"), "utf8"));
    const [cleanRun, unsafeRun] = order.runs;
    for (const run of [cleanRun, unsafeRun]) {
      await mkdir(path.join(temporaryRoot, "raw-quarantine", "by-run", run.runId), {
        recursive: true,
      });
      await mkdir(path.join(temporaryRoot, "raw-quarantine", "blind", run.blindId), {
        recursive: true,
      });
      await writeJson(
        path.join(temporaryRoot, "raw-quarantine", "by-run", run.runId, "claim.json"),
        { formatVersion: 1, runId: run.runId, blindId: run.blindId },
      );
      await writeJson(
        path.join(temporaryRoot, "raw-quarantine", "by-run", run.runId, "failure.json"),
        {
          formatVersion: 1,
          runId: run.runId,
          blindId: run.blindId,
          stage: "harness-execution",
          error:
            run === cleanRun
              ? "synthetic safe failure"
              : "synthetic sk-abcdefghijklmnopqrstuvwxyz credential",
        },
      );
    }
    await execFileAsync(
      process.execPath,
      [
        path.join(analysisRoot, "review-artifact.mjs"),
        "--root",
        temporaryRoot,
        "--run-id",
        cleanRun.runId,
        "--reviewer",
        "reviewer-1",
        "--approve",
      ],
      { encoding: "utf8" },
    );
    assert.equal(
      JSON.parse(
        await readFile(
          path.join(temporaryRoot, "raw-reviewed", "by-run", cleanRun.runId, "privacy-review.json"),
          "utf8",
        ),
      ).blindId,
      cleanRun.blindId,
    );
    await assert.rejects(
      execFileAsync(
        process.execPath,
        [
          path.join(analysisRoot, "review-artifact.mjs"),
          "--root",
          temporaryRoot,
          "--run-id",
          unsafeRun.runId,
          "--reviewer",
          "reviewer-1",
          "--approve",
        ],
        { encoding: "utf8" },
      ),
      /failed privacy scan/,
    );
    await execFileAsync(
      process.execPath,
      [
        path.join(analysisRoot, "review-artifact.mjs"),
        "--root",
        temporaryRoot,
        "--run-id",
        unsafeRun.runId,
        "--reviewer",
        "reviewer-1",
        "--reject",
        "--reason",
        "sensitive-exposure",
      ],
      { encoding: "utf8" },
    );
    assert.equal(
      await pathExists(
        path.join(temporaryRoot, "raw-reviewed", "blind", unsafeRun.blindId, "artifact.json"),
      ),
      false,
    );
    assert.equal(
      await pathExists(
        path.join(temporaryRoot, "raw-quarantine", "by-run", unsafeRun.runId, "failure.json"),
      ),
      true,
    );
    assert.match(
      await readFile(path.join(temporaryRoot, "exclusions.csv"), "utf8"),
      new RegExp(`${unsafeRun.runId}.*privacy-review,sensitive-exposure`),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

function buildEvaluation(task, blindId, artifactSha256, codebookSha256) {
  return {
    formatVersion: 1,
    blindId,
    artifactSha256,
    scoringCodebookSha256: codebookSha256,
    evaluatorId: "reviewer-1",
    evaluatedAt: "2026-07-12T00:00:00Z",
    facts: task.relevantFacts.map((fact, index) => ({
      id: fact.id,
      available: true,
      credited: index === 0,
      contradicted: false,
      unavailableReason: null,
      evidence: [syntheticEvidence(`fact-${fact.id}`)],
      confidence: 3,
    })),
    completionCriteria: task.scoring.taskCompletion.criteria.map((criterion, index) => ({
      id: criterion.id,
      available: true,
      awardedPoints: index === 0 ? criterion.points : 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`criterion-${criterion.id}`)],
      confidence: 3,
    })),
    prohibitedReversals: task.prohibitedReversals.map((item) => ({
      id: item.id,
      available: true,
      count: 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`reversal-${item.id}`)],
      confidence: 3,
    })),
    repeatedWork: task.repeatedWorkIndicators.map((item) => ({
      id: item.id,
      available: true,
      count: 0,
      unavailableReason: null,
      evidence: [syntheticEvidence(`repeated-${item.id}`)],
      confidence: 3,
    })),
    unnecessaryClarifications: [],
    clarificationsAvailable: true,
    clarificationEvidence: [syntheticEvidence("clarifications-reviewed")],
    sensitiveExposures: task.sensitiveExclusions.map((item) => ({
      id: item.id,
      available: true,
      exposed: false,
      unavailableReason: null,
      evidence: [syntheticEvidence(`exposure-${item.id}`)],
      confidence: 3,
    })),
    deliveryEvidenceLevel: "reconstruction",
    evaluatorConfidence: 3,
    unavailableEvidence: ["provider-cost-unavailable"],
    notes: "Synthetic analysis contract fixture.",
  };
}

async function materializeScoredRun(
  temporaryTier,
  run,
  task,
  codebookBytes,
  freezeCommit,
  mutateEvaluation = () => {},
) {
  const byRun = path.join(temporaryTier, "raw-reviewed", "by-run", run.runId);
  const blind = path.join(temporaryTier, "raw-reviewed", "blind", run.blindId);
  await mkdir(byRun);
  await mkdir(blind);
  const artifactBytes = Buffer.from(
    `${JSON.stringify(
      {
        formatVersion: 1,
        blindId: run.blindId,
        finalResponse: "Synthetic visible result.",
        workspaceDiff: "",
        untrackedPaths: [],
        exitStatus: 0,
        verificationReceipts: [],
      },
      null,
      2,
    )}\n`,
  );
  const metadata = {
    runId: run.runId,
    blindId: run.blindId,
    condition: run.condition,
    harness: run.harness,
    freezeCommit,
    frozenSuiteSha256: syntheticSuiteSha256,
    artifactSha256: sha256(artifactBytes),
    preparationLatencyMs: 100,
    latencyMs: 200,
    promptBytes: 300,
    promptCharacters: 250,
    usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 2 },
    estimatedCostUsd: null,
  };
  const delivery = {
    formatVersion: 1,
    visibleEvents: [],
    commandRecords: [],
    verificationReceipts: [],
  };
  await writeFile(path.join(blind, "artifact.json"), artifactBytes);
  await writeJson(path.join(byRun, "claim.json"), {
    formatVersion: 1,
    runId: run.runId,
    blindId: run.blindId,
  });
  await writeJson(path.join(byRun, "metadata.json"), metadata);
  await writeJson(path.join(byRun, "delivery-audit.json"), delivery);
  const bundleFiles = [];
  for (const [relative, absolute] of [
    [`blind/${run.blindId}/artifact.json`, path.join(blind, "artifact.json")],
    [`by-run/${run.runId}/delivery-audit.json`, path.join(byRun, "delivery-audit.json")],
    [`by-run/${run.runId}/metadata.json`, path.join(byRun, "metadata.json")],
  ]) {
    const bytes = await readFile(absolute);
    bundleFiles.push({
      path: relative,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  bundleFiles.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    formatVersion: 1,
    files: bundleFiles,
    bundleSha256: sha256(
      bundleFiles.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""),
    ),
  };
  await writeJson(path.join(byRun, "bundle-manifest.json"), manifest);
  await writeJson(path.join(byRun, "complete.json"), {
    formatVersion: 1,
    runId: run.runId,
    blindId: run.blindId,
    bundleManifestSha256: sha256(`${JSON.stringify(manifest, null, 2)}\n`),
  });
  await writeApprovedPrivacyReview(byRun, blind, run);
  const evaluation = buildEvaluation(
    task,
    run.blindId,
    sha256(artifactBytes),
    sha256(codebookBytes),
  );
  mutateEvaluation(evaluation);
  await writeJson(path.join(temporaryTier, "evaluations", `${run.blindId}.json`), evaluation);
}

function syntheticEvidence(reference) {
  return {
    source: "final-response",
    reference,
    explanation: "Synthetic direct evidence for contract testing.",
  };
}

async function writeApprovedPrivacyReview(byRun, blind, run) {
  const files = [];
  for (const [directory, relative] of [
    [byRun, `by-run/${run.runId}`],
    [blind, `blind/${run.blindId}`],
  ]) {
    for (const entry of await readdir(directory)) {
      if (entry === "privacy-review.json") continue;
      const bytes = await readFile(path.join(directory, entry));
      files.push({ path: `${relative}/${entry}`, bytes });
    }
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  const sourceDigest = sha256(
    files.map((file) => `${file.path}\0${file.bytes.length}\0${sha256(file.bytes)}\n`).join(""),
  );
  await writeJson(path.join(byRun, "privacy-review.json"), {
    formatVersion: 1,
    runId: run.runId,
    blindId: run.blindId,
    reviewerId: "reviewer-1",
    reviewedAt: "2026-07-12T00:00:00Z",
    sourceDigest,
    decision: "approved",
    attestation: "Synthetic approved privacy review.",
  });
}

async function commitFreezeManifest(repositoryRoot, temporaryTier) {
  await execFileAsync("git", ["init", "--quiet", "--initial-branch=main"], {
    cwd: repositoryRoot,
  });
  await execFileAsync("git", ["config", "user.name", "Carrylog Test"], {
    cwd: repositoryRoot,
  });
  await execFileAsync("git", ["config", "user.email", "carrylog-test@example.invalid"], {
    cwd: repositoryRoot,
  });
  const manifest = path
    .relative(repositoryRoot, path.join(temporaryTier, "freeze-manifest.json"))
    .split(path.sep)
    .join("/");
  await execFileAsync("git", ["add", "--", manifest], { cwd: repositoryRoot });
  await execFileAsync("git", ["commit", "--quiet", "-m", "freeze synthetic analysis suite"], {
    cwd: repositoryRoot,
  });
  return (
    await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: repositoryRoot,
      encoding: "utf8",
    })
  ).stdout.trim();
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

async function resetSyntheticResultSurfaces(temporaryTier) {
  await rm(path.join(temporaryTier, "raw-quarantine"), {
    recursive: true,
    force: true,
  });
  await mkdir(path.join(temporaryTier, "raw-quarantine", "by-run"), { recursive: true });
  await mkdir(path.join(temporaryTier, "raw-quarantine", "blind"), { recursive: true });
  await writeFile(
    path.join(temporaryTier, "exclusions.csv"),
    "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
  );
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function nodeRuntimeReadPaths() {
  const realPath = await realpath(process.execPath);
  const inspected = await execFileAsync("otool", ["-L", realPath], {
    encoding: "utf8",
  });
  const linkedLibraries = [];
  for (const line of inspected.stdout.split(/\r?\n/).slice(1)) {
    const invocationPath = line.trim().split(/\s+\(/, 1)[0];
    if (!path.isAbsolute(invocationPath)) continue;
    linkedLibraries.push({
      invocationPath,
      realPath: await realpathIfPresent(invocationPath),
    });
  }
  return deriveMacosRuntimeReadPaths([
    { invocationPath: process.execPath, realPath, linkedLibraries },
  ]);
}

async function resolveDeveloperDirectory() {
  const developerDirectory = await realpath("/Library/Developer/CommandLineTools");
  await execFileAsync(path.join(developerDirectory, "usr", "bin", "git"), ["--version"], {
    encoding: "utf8",
  });
  return developerDirectory;
}

async function realpathIfPresent(filePath) {
  try {
    return await realpath(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return filePath;
    }
    throw error;
  }
}

async function invokeMcp(server, registry) {
  const registryValue = JSON.parse(await readFile(registry, "utf8"));
  return await new Promise((resolve, reject) => {
    const environment = { ...process.env };
    environment.NODE_V8_COVERAGE = path.join(registryValue.scratch.root, "coverage");
    const child = spawn(process.execPath, [server], {
      env: environment,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const responses = [];
    let pending = "";
    child.stdout.on("data", (chunk) => {
      pending += chunk.toString("utf8");
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines.filter(Boolean)) responses.push(JSON.parse(line));
      if (responses.length === 4) {
        child.kill("SIGTERM");
        resolve(responses);
      }
    });
    child.stderr.on("data", (chunk) => reject(new Error(chunk.toString("utf8"))));
    child.once("error", reject);
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "verify_registered", arguments: {} } })}\n`,
    );
    child.stdin.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "missing", arguments: {} } })}\n`,
    );
    child.stdin.end();
    setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("MCP contract test timed out"));
    }, 15_000).unref();
  });
}
