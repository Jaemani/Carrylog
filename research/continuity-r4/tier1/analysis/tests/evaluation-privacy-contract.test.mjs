import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import {
  buildEvaluationBundles,
  checkEvaluationBundles,
  writeEvaluationBundles,
} from "../evaluation-bundles.mjs";
import {
  captureReviewFiles,
  digestReviewManifest,
  materializeCapturedReviewFiles,
} from "../review-capture.mjs";
import {
  buildExclusionRecord,
  ensureExactExclusion,
  publishReviewTransaction,
} from "../review-transaction.mjs";

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tierRoot = path.resolve(analysisRoot, "..");
const execFileAsync = promisify(execFile);

test("blind bundles bind exact task bytes without exposing allocation metadata", async () => {
  const bundles = await buildEvaluationBundles(tierRoot);
  assert.equal(bundles.size, 60);
  for (const [blindId, bytes] of bundles) {
    const bundle = JSON.parse(bytes);
    assert.equal(bundle.blindId, blindId);
    assert.match(bundle.taskFixtureSha256, /^[0-9a-f]{64}$/);
    assert.match(bundle.scoringCodebookSha256, /^[0-9a-f]{64}$/);
    const rendered = JSON.stringify(bundle);
    for (const key of ["runId", "ordinal", "fixtureId", "condition", "harness", "runOrder"])
      assert.equal(Object.hasOwn(bundle, key), false, key);
    assert.doesNotMatch(rendered, /"(?:runId|ordinal|fixtureId|condition|harness|runOrder)"\s*:/);
  }

  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-bundle-contract-"));
  try {
    await cp(path.join(tierRoot, "run-order.json"), path.join(temporaryRoot, "run-order.json"));
    await cp(
      path.join(tierRoot, "scoring-codebook.json"),
      path.join(temporaryRoot, "scoring-codebook.json"),
    );
    await cp(path.join(tierRoot, "tasks"), path.join(temporaryRoot, "tasks"), {
      recursive: true,
    });
    assert.equal(await writeEvaluationBundles(temporaryRoot), 60);
    assert.equal(await checkEvaluationBundles(temporaryRoot), 60);
    const first = [...bundles.keys()].sort()[0];
    await writeFile(path.join(temporaryRoot, "evaluation-bundles", `${first}.json`), "{}\n");
    await assert.rejects(checkEvaluationBundles(temporaryRoot), /evaluation bundle drift/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("scaffold and finalize need only blind inputs plus the frozen dependency contract", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-scaffold-contract-"));
  const blindId = [...(await buildEvaluationBundles()).keys()].sort()[0];
  const draft = path.join(temporaryRoot, "draft.json");
  try {
    await mkdir(path.join(temporaryRoot, "evaluation-bundles"));
    await mkdir(path.join(temporaryRoot, "raw-reviewed", "blind", blindId), {
      recursive: true,
    });
    await mkdir(path.join(temporaryRoot, "evaluations"));
    await cp(
      path.join(tierRoot, "evaluation-bundles", `${blindId}.json`),
      path.join(temporaryRoot, "evaluation-bundles", `${blindId}.json`),
    );
    await cp(
      path.join(tierRoot, "evaluation.schema.json"),
      path.join(temporaryRoot, "evaluation.schema.json"),
    );
    await cp(
      path.join(tierRoot, "analysis-dependencies.json"),
      path.join(temporaryRoot, "analysis-dependencies.json"),
    );
    await writeFile(
      path.join(temporaryRoot, "raw-reviewed", "blind", blindId, "artifact.json"),
      `${JSON.stringify({ formatVersion: 1, blindId, finalResponse: "visible" }, null, 2)}\n`,
    );
    const tool = path.join(analysisRoot, "scaffold-evaluation.mjs");
    await execute(tool, [
      "--scaffold",
      "--root",
      temporaryRoot,
      "--blind-id",
      blindId,
      "--evaluator",
      "reviewer-1",
      "--output",
      draft,
    ]);
    await execute(tool, ["--validate", "--root", temporaryRoot, "--input", draft]);
    await execute(tool, ["--finalize", "--root", temporaryRoot, "--input", draft]);
    assert.equal(
      JSON.parse(await readFile(path.join(temporaryRoot, "evaluations", `${blindId}.json`)))
        .blindId,
      blindId,
    );
    await assert.rejects(
      execute(tool, ["--finalize", "--root", temporaryRoot, "--input", draft]),
      /refusing to overwrite/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("quarantined terminal and incomplete claims are not classified as unstarted", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-quarantine-contract-"));
  try {
    await cp(tierRoot, temporaryRoot, { recursive: true });
    await rm(path.join(temporaryRoot, "raw-reviewed"), {
      recursive: true,
      force: true,
    });
    await rm(path.join(temporaryRoot, "raw-quarantine"), {
      recursive: true,
      force: true,
    });
    await rm(path.join(temporaryRoot, "evaluations"), {
      recursive: true,
      force: true,
    });
    await mkdir(path.join(temporaryRoot, "raw-reviewed"));
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "by-run"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "blind"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryRoot, "evaluations"));
    const order = JSON.parse(await readFile(path.join(temporaryRoot, "run-order.json")));
    const [terminal, incomplete] = order.runs;
    await materializeQuarantineClaim(temporaryRoot, terminal, true);
    await materializeQuarantineClaim(temporaryRoot, incomplete, false);
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "by-run", "unknown-run"));
    const analyzed = JSON.parse(
      (await execute(path.join(analysisRoot, "analyze.mjs"), ["--root", temporaryRoot])).stdout,
    );
    assert.equal(findRun(analyzed, terminal).state, "awaiting-privacy-review");
    assert.equal(findRun(analyzed, incomplete).state, "claim-incomplete");
    assert.equal(
      analyzed.protocolDiagnostics.some(
        (diagnostic) => diagnostic.reference === "raw-quarantine/by-run/unknown-run",
      ),
      true,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("privacy rejection retains quarantine and becomes a safe terminal exclusion", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-rejection-contract-"));
  try {
    await cp(tierRoot, temporaryRoot, { recursive: true });
    for (const directory of ["raw-reviewed", "raw-quarantine", "evaluations"]) {
      await rm(path.join(temporaryRoot, directory), {
        recursive: true,
        force: true,
      });
    }
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "by-run"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "blind"), {
      recursive: true,
    });
    await mkdir(path.join(temporaryRoot, "evaluations"));
    await writeFile(
      path.join(temporaryRoot, "exclusions.csv"),
      "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
    );
    const run = JSON.parse(await readFile(path.join(temporaryRoot, "run-order.json"))).runs.find(
      (candidate) => candidate.condition === "carrylog-resume",
    );
    assert.ok(run);
    const byRun = path.join(temporaryRoot, "raw-quarantine", "by-run", run.runId);
    const blind = path.join(temporaryRoot, "raw-quarantine", "blind", run.blindId);
    await mkdir(byRun);
    await mkdir(blind);
    await writeFile(
      path.join(byRun, "claim.json"),
      `${JSON.stringify({ formatVersion: 1, runId: run.runId, blindId: run.blindId })}\n`,
    );
    await writeFile(
      path.join(byRun, "failure.json"),
      `${JSON.stringify({
        formatVersion: 1,
        runId: run.runId,
        blindId: run.blindId,
        stage: "harness-execution",
        error: "sk-abcdefghijklmnopqrstuvwxyz",
      })}\n`,
    );
    await writeFile(
      path.join(blind, "artifact.json"),
      `${JSON.stringify({ blindId: run.blindId, finalResponse: "sk-abcdefghijklmnopqrstuvwxyz" })}\n`,
    );
    await execute(path.join(analysisRoot, "review-artifact.mjs"), [
      "--root",
      temporaryRoot,
      "--run-id",
      run.runId,
      "--reviewer",
      "reviewer-1",
      "--reject",
      "--reason",
      "manual-privacy-exclusion",
    ]);
    const analyzed = JSON.parse(
      (await execute(path.join(analysisRoot, "analyze.mjs"), ["--root", temporaryRoot])).stdout,
    );
    assert.equal(findRun(analyzed, run).state, "privacy-rejected");
    assert.equal(findRun(analyzed, run).exclusion.reason_code, "manual-privacy-exclusion");
    assert.equal(analyzed.tier2Decision.classification, "STOP");
    assert.equal(analyzed.tier2Decision.stop.reasons.includes("carrylog-privacy-rejection"), true);
    await assert.rejects(
      readFile(path.join(temporaryRoot, "raw-reviewed", "blind", run.blindId, "artifact.json")),
      /ENOENT/,
    );
    assert.match(await readFile(path.join(blind, "artifact.json"), "utf8"), /sk-abcdef/);
    assert.doesNotMatch(
      await readFile(
        path.join(temporaryRoot, "raw-reviewed", "by-run", run.runId, "failure.json"),
        "utf8",
      ),
      /sk-abcdef/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("privacy promotion materializes captured bytes instead of changed live source", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-review-capture-race-"));
  const sourceRun = path.join(temporaryRoot, "source", "by-run", "t1-001");
  const sourceBlind = path.join(temporaryRoot, "source", "blind", "b-0123456789ab");
  const staging = path.join(temporaryRoot, "staging");
  try {
    await mkdir(sourceRun, { recursive: true });
    await mkdir(sourceBlind, { recursive: true });
    const artifactPath = path.join(sourceBlind, "artifact.json");
    await writeFile(path.join(sourceRun, "claim.json"), '{"state":"captured"}\n');
    await writeFile(artifactPath, '{"finalResponse":"reviewed-safe"}\n');
    const captured = await captureReviewFiles([
      [sourceRun, "by-run/t1-001"],
      [sourceBlind, "blind/b-0123456789ab"],
    ]);
    const approvedDigest = digestReviewManifest(captured);

    await writeFile(artifactPath, '{"finalResponse":"sk-abcdefghijklmnopqrstuvwxyz"}\n');
    await materializeCapturedReviewFiles(staging, captured);

    const promoted = await readFile(
      path.join(staging, "blind", "b-0123456789ab", "artifact.json"),
      "utf8",
    );
    assert.match(promoted, /reviewed-safe/);
    assert.doesNotMatch(promoted, /sk-abcdefghijklmnopqrstuvwxyz/);
    const materialized = await captureReviewFiles([
      [path.join(staging, "by-run", "t1-001"), "by-run/t1-001"],
      [path.join(staging, "blind", "b-0123456789ab"), "blind/b-0123456789ab"],
    ]);
    assert.equal(digestReviewManifest(materialized), approvedDigest);
    await assert.rejects(
      materializeCapturedReviewFiles(staging, [
        { path: "../escape.json", bytes: Buffer.from("unsafe") },
      ]),
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("exclusion-first privacy rejection survives interrupted publication and retries exactly", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-review-exclusion-first-"));
  try {
    await cp(tierRoot, temporaryRoot, { recursive: true });
    for (const directory of ["raw-reviewed", "raw-quarantine", "evaluations"]) {
      await rm(path.join(temporaryRoot, directory), { recursive: true, force: true });
    }
    await mkdir(path.join(temporaryRoot, "raw-reviewed", "by-run"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "raw-quarantine"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "evaluations"));
    const exclusionPath = path.join(temporaryRoot, "exclusions.csv");
    await writeFile(
      exclusionPath,
      "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
    );
    const run = JSON.parse(await readFile(path.join(temporaryRoot, "run-order.json"))).runs.find(
      (candidate) => candidate.condition === "carrylog-resume",
    );
    assert.ok(run);
    const exclusion = buildExclusionRecord(run, "privacy-review", "sensitive-exposure");
    assert.equal(await ensureExactExclusion(exclusionPath, exclusion), true);
    assert.equal(await ensureExactExclusion(exclusionPath, exclusion), false);

    const source = path.join(temporaryRoot, "rejection-staging", run.runId);
    const destination = path.join(temporaryRoot, "raw-reviewed", "by-run", run.runId);
    await mkdir(source, { recursive: true });
    await writeJson(path.join(source, "privacy-review.json"), {
      formatVersion: 1,
      runId: run.runId,
      blindId: run.blindId,
      reviewerId: "reviewer-1",
      reviewedAt: "2026-07-13T00:00:00.000Z",
      sourceDigest: "a".repeat(64),
      decision: "rejected",
      reasonCode: "sensitive-exposure",
    });
    await writeJson(path.join(source, "failure.json"), {
      formatVersion: 1,
      runId: run.runId,
      blindId: run.blindId,
      failedAt: "2026-07-13T00:00:00.000Z",
      stage: "privacy-review",
      reasonCode: "sensitive-exposure",
    });
    await assert.rejects(
      publishReviewTransaction([{ source, destination }], {
        beforePublish() {
          throw new Error("injected-before-publish");
        },
      }),
      /injected-before-publish/,
    );
    assert.match(await readFile(exclusionPath, "utf8"), new RegExp(run.runId));
    const interrupted = JSON.parse(
      (await execute(path.join(analysisRoot, "analyze.mjs"), ["--root", temporaryRoot])).stdout,
    );
    assert.equal(findRun(interrupted, run).state, "protocol-invalid");
    assert.equal(interrupted.tier2Decision.classification, "STOP");
    assert.equal(
      interrupted.tier2Decision.stop.reasons.includes("carrylog-privacy-rejection"),
      true,
    );

    await publishReviewTransaction([{ source, destination }]);
    const recovered = JSON.parse(
      (await execute(path.join(analysisRoot, "analyze.mjs"), ["--root", temporaryRoot])).stdout,
    );
    assert.equal(findRun(recovered, run).state, "privacy-rejected");
    assert.equal(recovered.tier2Decision.classification, "STOP");
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("concurrent exclusion writers preserve every distinct privacy outcome", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-exclusion-concurrency-"));
  try {
    const exclusionPath = path.join(temporaryRoot, "exclusions.csv");
    await writeFile(
      exclusionPath,
      "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
    );
    const transactionModule = pathToFileURL(path.join(analysisRoot, "review-transaction.mjs")).href;
    const worker = `import { ensureExactExclusion } from ${JSON.stringify(transactionModule)};
const [exclusionPath, ordinal] = process.argv.slice(1);
const suffix = ordinal.padStart(2, "0");
await ensureExactExclusion(exclusionPath, {
  run_id: "t1-concurrent-" + suffix,
  blind_id: "b-concurrent-" + suffix,
  stage: "privacy-review",
  reason_code: "sensitive-exposure",
  retained_artifact_path: "raw-reviewed/by-run/t1-concurrent-" + suffix,
  replacement_run_id: "",
});`;
    await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        execFileAsync(
          process.execPath,
          ["--input-type=module", "-e", worker, exclusionPath, String(index)],
          { encoding: "utf8", timeout: 30_000 },
        ),
      ),
    );
    const lines = (await readFile(exclusionPath, "utf8")).trim().split(/\r?\n/);
    assert.equal(lines.length, 13);
    assert.equal(new Set(lines.slice(1).map((line) => line.split(",", 1)[0])).size, 12);
    await assert.rejects(readFile(`${exclusionPath}.lock`), /ENOENT/);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("review publication recovers an identical partial transaction and rejects drift", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-review-transaction-"));
  const reviewed = path.join(temporaryRoot, "reviewed");
  const blindDestination = path.join(reviewed, "blind", "b-0123456789ab");
  const runDestination = path.join(reviewed, "by-run", "t1-001");
  try {
    await mkdir(path.dirname(blindDestination), { recursive: true });
    await mkdir(path.dirname(runDestination), { recursive: true });
    const firstStaging = path.join(temporaryRoot, "first-staging");
    const firstOperations = await createPublicationStaging(
      firstStaging,
      blindDestination,
      runDestination,
      "reviewed-safe",
    );
    await assert.rejects(
      publishReviewTransaction(firstOperations, {
        afterPublish(index) {
          if (index === 0) throw new Error("injected-after-blind-publish");
        },
      }),
      /injected-after-blind-publish/,
    );
    assert.equal(
      await readFile(path.join(blindDestination, "artifact.json"), "utf8"),
      "reviewed-safe\n",
    );
    await assert.rejects(readFile(path.join(runDestination, "claim.json")), /ENOENT/);

    const retryStaging = path.join(temporaryRoot, "retry-staging");
    await publishReviewTransaction(
      await createPublicationStaging(
        retryStaging,
        blindDestination,
        runDestination,
        "reviewed-safe",
      ),
    );
    assert.equal(await readFile(path.join(runDestination, "claim.json"), "utf8"), "claim-safe\n");

    const driftStaging = path.join(temporaryRoot, "drift-staging");
    await assert.rejects(
      publishReviewTransaction(
        await createPublicationStaging(
          driftStaging,
          blindDestination,
          runDestination,
          "changed-after-review",
        ),
      ),
      /published review destination differs/,
    );
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

test("approved sanitized failures receive deterministic exclusions and retry idempotently", async () => {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-approved-failure-"));
  try {
    await cp(tierRoot, temporaryRoot, { recursive: true });
    for (const directory of ["raw-reviewed", "raw-quarantine", "evaluations"]) {
      await rm(path.join(temporaryRoot, directory), { recursive: true, force: true });
    }
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "by-run"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "raw-quarantine", "blind"), { recursive: true });
    await mkdir(path.join(temporaryRoot, "evaluations"));
    await writeFile(
      path.join(temporaryRoot, "exclusions.csv"),
      "run_id,blind_id,stage,reason_code,retained_artifact_path,replacement_run_id\n",
    );
    const run = JSON.parse(await readFile(path.join(temporaryRoot, "run-order.json"))).runs.find(
      (candidate) => candidate.condition === "carrylog-resume",
    );
    assert.ok(run);
    const byRun = path.join(temporaryRoot, "raw-quarantine", "by-run", run.runId);
    const blind = path.join(temporaryRoot, "raw-quarantine", "blind", run.blindId);
    await mkdir(byRun);
    await mkdir(blind);
    await writeJson(path.join(byRun, "claim.json"), {
      formatVersion: 1,
      runId: run.runId,
      blindId: run.blindId,
    });
    await writeJson(path.join(byRun, "failure.json"), {
      formatVersion: 1,
      runId: run.runId,
      blindId: run.blindId,
      stage: "harness-execution",
      error: "synthetic timeout after sanitization",
      execution: {
        process: { exitCode: null, signal: null, timedOut: true, spawnError: null },
      },
    });
    await writeJson(path.join(blind, "artifact.json"), {
      formatVersion: 1,
      blindId: run.blindId,
      finalResponse: "safe bounded output",
    });
    const reviewArguments = [
      "--root",
      temporaryRoot,
      "--run-id",
      run.runId,
      "--reviewer",
      "reviewer-1",
      "--approve",
    ];
    await execute(path.join(analysisRoot, "review-artifact.mjs"), reviewArguments);
    await execute(path.join(analysisRoot, "review-artifact.mjs"), reviewArguments);
    const exclusionLines = (await readFile(path.join(temporaryRoot, "exclusions.csv"), "utf8"))
      .trim()
      .split(/\r?\n/);
    assert.equal(exclusionLines.length, 2);
    assert.equal(
      exclusionLines[1],
      `${run.runId},${run.blindId},harness-execution,provider-timeout,raw-reviewed/by-run/${run.runId},`,
    );
    const analyzed = JSON.parse(
      (await execute(path.join(analysisRoot, "analyze.mjs"), ["--root", temporaryRoot])).stdout,
    );
    assert.equal(findRun(analyzed, run).state, "harness-failure");
    assert.equal(findRun(analyzed, run).diagnostic, null);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});

async function materializeQuarantineClaim(root, run, terminal) {
  const byRun = path.join(root, "raw-quarantine", "by-run", run.runId);
  await mkdir(byRun);
  await mkdir(path.join(root, "raw-quarantine", "blind", run.blindId));
  await writeFile(
    path.join(byRun, "claim.json"),
    `${JSON.stringify({ formatVersion: 1, runId: run.runId, blindId: run.blindId })}\n`,
  );
  if (terminal) await writeFile(path.join(byRun, "complete.json"), "{}\n");
}

function findRun(result, run) {
  return result.runReconciliation.find((record) => record.runId === run.runId);
}

async function createPublicationStaging(staging, blindDestination, runDestination, artifact) {
  const blindSource = path.join(staging, "blind");
  const runSource = path.join(staging, "by-run");
  await mkdir(blindSource, { recursive: true });
  await mkdir(runSource, { recursive: true });
  await writeFile(path.join(blindSource, "artifact.json"), `${artifact}\n`);
  await writeFile(path.join(runSource, "claim.json"), "claim-safe\n");
  return [
    { source: blindSource, destination: blindDestination },
    { source: runSource, destination: runDestination },
  ];
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function execute(script, arguments_) {
  return execFileAsync(process.execPath, [script, ...arguments_], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
}
