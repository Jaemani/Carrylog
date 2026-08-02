import assert from "node:assert/strict";
import { access, lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureReviewFiles,
  digestReviewManifest,
  materializeCapturedReviewFiles,
} from "./review-capture.mjs";
import {
  buildExclusionRecord,
  ensureExactExclusion,
  publishReviewTransaction,
} from "./review-transaction.mjs";

const arguments_ = parseArguments(process.argv.slice(2));
const root = arguments_.root;
const order = JSON.parse(await readFile(path.join(root, "run-order.json"), "utf8"));
const exclusionCodebook = JSON.parse(
  await readFile(path.join(root, "exclusion-codebook.json"), "utf8"),
);
const run = order.runs.find((candidate) => candidate.runId === arguments_.runId);
assert.ok(run, `unknown run ID: ${arguments_.runId}`);
const quarantine = path.join(root, "raw-quarantine");
const reviewed = path.join(root, "raw-reviewed");
const sourceRun = path.join(quarantine, "by-run", run.runId);
const sourceBlind = path.join(quarantine, "blind", run.blindId);
const destinationRun = path.join(reviewed, "by-run", run.runId);
const destinationBlind = path.join(reviewed, "blind", run.blindId);
await assertDirectory(sourceRun);
await assertDirectory(sourceBlind);
const sourceFiles = await captureReviewFiles([
  [sourceRun, `by-run/${run.runId}`],
  [sourceBlind, `blind/${run.blindId}`],
]);
assertAllowedFiles(
  sourceFiles.map((file) => file.path),
  run,
);
const sourceDigest = digestReviewManifest(sourceFiles);
const sourceFailure = readCapturedJson(sourceFiles, `by-run/${run.runId}/failure.json`);
const reviewDecision =
  arguments_.decision === "approved"
    ? { decision: "approved" }
    : { decision: "rejected", reasonCode: arguments_.reason };
const reviewedAt = await resolveReviewedAt(destinationRun, reviewDecision);
const staging = path.join(reviewed, `.staging-${run.runId}-${process.pid}`);
await assertAbsent(staging);
try {
  await mkdir(path.join(staging, "by-run"), { recursive: true });
  if (arguments_.decision === "approved") {
    for (const file of sourceFiles) scanArtifact(file.bytes, file.path);
    const capturedRun = path.join(staging, "by-run", run.runId);
    const capturedBlind = path.join(staging, "blind", run.blindId);
    await mkdir(capturedRun, { recursive: true });
    await mkdir(capturedBlind, { recursive: true });
    await materializeCapturedReviewFiles(staging, sourceFiles);
    await writeReview(capturedRun, reviewedAt, {
      decision: "approved",
      attestation:
        "I reviewed the sanitized visible artifacts for credentials, private provider state, ignored source data, absolute local paths, and task-specific sensitive exclusions, and approved the exact bytes bound by sourceDigest.",
    });
  } else {
    const rejectedRun = path.join(staging, "by-run", run.runId);
    await mkdir(rejectedRun);
    await writeReview(rejectedRun, reviewedAt, {
      decision: "rejected",
      reasonCode: arguments_.reason,
      attestation:
        "I rejected the quarantined bundle after privacy review. No quarantined artifact bytes were promoted.",
    });
    await writeFile(
      path.join(rejectedRun, "failure.json"),
      `${JSON.stringify(
        {
          formatVersion: 1,
          runId: run.runId,
          blindId: run.blindId,
          failedAt: reviewedAt,
          stage: "privacy-review",
          reasonCode: arguments_.reason,
          diagnostic: "Quarantined bundle rejected; sensitive bytes were not promoted.",
        },
        null,
        2,
      )}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
  }
  const exclusion =
    arguments_.decision === "rejected"
      ? buildExclusionRecord(run, "privacy-review", arguments_.reason)
      : sourceFailure === null
        ? null
        : buildExclusionRecord(
            run,
            sourceFailure.stage,
            classifyApprovedFailureReason(sourceFailure, exclusionCodebook),
          );
  if (exclusion !== null) {
    await ensureExactExclusion(path.join(root, "exclusions.csv"), exclusion);
  }
  await mkdir(path.dirname(destinationRun), { recursive: true });
  const operations = [];
  if (arguments_.decision === "approved") {
    await mkdir(path.dirname(destinationBlind), { recursive: true });
    operations.push({
      source: path.join(staging, "blind", run.blindId),
      destination: destinationBlind,
    });
  }
  operations.push({
    source: path.join(staging, "by-run", run.runId),
    destination: destinationRun,
  });
  await publishReviewTransaction(operations);
  process.stdout.write(
    arguments_.decision === "approved"
      ? `Promoted reviewed artifacts for ${run.runId} (${sourceDigest}).\n`
      : `Recorded privacy rejection for ${run.runId}; quarantine retained.\n`,
  );
} finally {
  await rm(staging, { recursive: true, force: true });
}

async function writeReview(directory, reviewedAt, decision) {
  const review = {
    formatVersion: 1,
    runId: run.runId,
    blindId: run.blindId,
    reviewerId: arguments_.reviewer,
    reviewedAt,
    sourceDigest,
    ...decision,
  };
  await writeFile(
    path.join(directory, "privacy-review.json"),
    `${JSON.stringify(review, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
      flag: "wx",
    },
  );
}

function parseArguments(values) {
  const result = {
    runId: "",
    reviewer: "",
    decision: "",
    decisionCount: 0,
    reason: "",
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--run-id") {
      result.runId = values[++index] ?? "";
    } else if (value === "--reviewer") {
      result.reviewer = values[++index] ?? "";
    } else if (value === "--root") {
      result.root = path.resolve(values[++index] ?? assert.fail("--root requires a path"));
    } else if (value === "--approve") {
      result.decision = "approved";
      result.decisionCount += 1;
    } else if (value === "--reject") {
      result.decision = "rejected";
      result.decisionCount += 1;
    } else if (value === "--reason") result.reason = values[++index] ?? "";
    else throw new Error(`unknown argument: ${value}`);
  }
  assert.match(result.runId, /^t1-[0-9]{3}$/);
  assert.match(result.reviewer, /^[a-z][a-z0-9-]{1,31}$/);
  assert.equal(result.decisionCount, 1, "exactly one of --approve or --reject is required");
  if (result.decision === "rejected") {
    assert.ok(
      ["sensitive-exposure", "manual-privacy-exclusion"].includes(result.reason),
      "--reject requires --reason sensitive-exposure|manual-privacy-exclusion",
    );
  } else assert.equal(result.reason, "", "--reason is only valid with --reject");
  return result;
}

function assertAllowedFiles(paths, run) {
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
    assert.ok(allowed.has(filePath), `unexpected review artifact: ${filePath}`);
  assert.ok(paths.includes(`by-run/${run.runId}/claim.json`));
  assert.ok(
    paths.includes(`by-run/${run.runId}/failure.json`) ||
      paths.includes(`by-run/${run.runId}/complete.json`),
    "review input has no terminal marker",
  );
}

function scanArtifact(bytes, label) {
  const value = bytes.toString("utf8");
  const forbidden = [
    /\/Users\//,
    /\/home\//,
    /[A-Za-z]:\\Users\\/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(?:ghp_|github_pat_|npm_|jmr_|sk-)[A-Za-z0-9_-]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/,
    /\bBearer\s+(?!<REDACTED_TOKEN>)[A-Za-z0-9._~+/-]{16,}=*\b/i,
    /"(?:accessToken|refreshToken|apiKey|cookie|authorization|mcpOAuth|claudeAiOauth)"\s*:/i,
  ];
  for (const pattern of forbidden)
    assert.equal(pattern.test(value), false, `${label} failed privacy scan`);
}

function readCapturedJson(files, relativePath) {
  const matches = files.filter((file) => file.path === relativePath);
  assert.ok(matches.length <= 1, `duplicate captured review artifact: ${relativePath}`);
  if (matches.length === 0) return null;
  const parsed = JSON.parse(matches[0].bytes.toString("utf8"));
  assert.ok(parsed !== null && typeof parsed === "object" && !Array.isArray(parsed));
  return parsed;
}

async function resolveReviewedAt(directory, decision) {
  let metadata;
  try {
    metadata = await lstat(directory);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return new Date().toISOString();
    }
    throw error;
  }
  assert.equal(metadata.isDirectory(), true, `review destination is not a directory: ${directory}`);
  assert.equal(metadata.isSymbolicLink(), false, `review destination is a symlink: ${directory}`);
  const reviewPath = path.join(directory, "privacy-review.json");
  const reviewMetadata = await lstat(reviewPath);
  assert.equal(reviewMetadata.isFile(), true, "existing privacy review must be a regular file");
  assert.equal(
    reviewMetadata.isSymbolicLink(),
    false,
    "existing privacy review cannot be a symlink",
  );
  const review = JSON.parse(await readFile(reviewPath, "utf8"));
  assert.equal(review.formatVersion, 1);
  assert.equal(review.runId, run.runId);
  assert.equal(review.blindId, run.blindId);
  assert.equal(review.reviewerId, arguments_.reviewer);
  assert.equal(review.sourceDigest, sourceDigest);
  assert.equal(review.decision, decision.decision);
  if (decision.decision === "rejected") assert.equal(review.reasonCode, decision.reasonCode);
  else assert.equal(Object.hasOwn(review, "reasonCode"), false);
  assert.equal(new Date(review.reviewedAt).toISOString(), review.reviewedAt);
  return review.reviewedAt;
}

function classifyApprovedFailureReason(failure, codebook) {
  assert.ok(failure !== null && typeof failure === "object" && !Array.isArray(failure));
  const stage = failure.stage;
  assert.equal(typeof stage, "string", "approved failure has no stage");
  let reasonCode;
  if (stage === "claim" || stage === "fixture-preparation") {
    reasonCode = "setup-failure";
  } else if (stage === "carrylog-delivery") {
    reasonCode = "strict-resume-failure";
  } else if (stage === "harness-authentication") {
    reasonCode = "authentication-failure";
  } else if (stage === "harness-execution") {
    const processEvidence = failure.execution?.process;
    if (processEvidence?.timedOut === true) reasonCode = "provider-timeout";
    else if (
      typeof processEvidence?.spawnError === "string" ||
      typeof processEvidence?.signal === "string" ||
      (Number.isInteger(processEvidence?.exitCode) && processEvidence.exitCode !== 0)
    ) {
      reasonCode = "provider-nonzero-exit";
    } else {
      reasonCode = "provider-malformed-output";
    }
  } else if (stage === "artifact-sanitization") {
    reasonCode = "sensitive-exposure";
  } else if (stage === "artifact-publication") {
    reasonCode = "partial-bundle";
  } else if (stage === "protocol") {
    reasonCode = "protocol-deviation";
  } else {
    assert.fail(`approved failure has an unknown stage: ${stage}`);
  }
  assert.ok(codebook.stages.includes(stage), `failure stage is absent from codebook: ${stage}`);
  assert.ok(
    codebook.reasonCodes.includes(reasonCode),
    `failure reason is absent from codebook: ${reasonCode}`,
  );
  assert.ok(
    codebook.reasonStageCompatibility[reasonCode]?.includes(stage),
    `failure reason ${reasonCode} is incompatible with stage ${stage}`,
  );
  return reasonCode;
}

async function assertDirectory(directory) {
  const metadata = await lstat(directory);
  assert.equal(metadata.isDirectory(), true, `missing directory: ${directory}`);
}

async function assertAbsent(target) {
  try {
    await access(target);
  } catch {
    return;
  }
  throw new Error(`refusing to replace reviewed artifact: ${target}`);
}
