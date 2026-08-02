import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  access,
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { rejectUnsafeArtifact, sanitize, sanitizeValue } from "./artifact-sanitizer.mjs";
import {
  clearClaudeRouterAuthentication,
  resolveNativeClaudeExecutable,
  stageClaudeRouterAuthentication,
  verifyClaudePreSpawnIdentity,
} from "./claude-router-auth.mjs";
import { resolveNativeCodexExecutable } from "./codex-executable.mjs";
import {
  assertClaudeResponseModels,
  assertReceiptBinding,
  bindVerificationProgram,
  buildCarrylogToolInstallArguments,
  buildClaudeInvocation,
  buildCodexInvocation,
  buildLocalExactCommitFetchArguments,
  buildVerificationExecutablePath,
  buildVerificationRegistry,
  buildVerificationScratch,
  createAuthenticationEvidence,
  detachGitMetadata,
  digestRegistryBytes,
  partitionVerificationRuntimeReadPaths,
  recordAuthenticationCleanup,
  renderCodexRuntimePermissions,
  renderCodexVerificationPermissions,
} from "./harness-contract.mjs";
import {
  assertMacosPilotPlatform,
  buildSetupInvocation,
  claimExecutionRun,
  completePilotCachePopulation,
  digestInstalledToolTree,
  resolveBusyCafeBareSource,
  resolvePilotCacheRoot,
} from "./pilot-boundaries.mjs";
import {
  blindReceiptProjection,
  captureWorkspaceDelta,
  classifyHarnessResultFailure,
  filterClaudeHarnessResult,
  filterCodexHarnessResult,
} from "./run-contract.mjs";

class HarnessExecutionError extends Error {
  constructor(message, evidence, stage = "harness-execution") {
    super(message);
    this.name = "HarnessExecutionError";
    this.evidence = evidence;
    this.stage = stage;
  }
}

class HarnessEnvironmentError extends Error {
  constructor(message, cause, harnessEnvironment_) {
    super(message, { cause });
    this.name = "HarnessEnvironmentError";
    this.harnessEnvironment = harnessEnvironment_;
  }
}

const execFileAsync = promisify(execFile);
const analysisRoot = path.dirname(fileURLToPath(import.meta.url));
const tierRoot = path.resolve(analysisRoot, "..");
const projectRoot = path.resolve(tierRoot, "../../..");
let atomicSequence = 0;
const args = parseArguments(process.argv.slice(2));
assert.equal(
  args.execute && args.allowSetupNetwork,
  false,
  "scored execution cannot enable setup network access",
);
assert.equal(
  args.execute && args.keep,
  false,
  "scored execution cannot retain an unsanitized fixture",
);
const preregistration = await readJson(path.join(tierRoot, "preregistration.json"));
const repositories = await readJson(path.join(tierRoot, "repositories.json"));
const order = await readJson(path.join(tierRoot, "run-order.json"));
assertMacosPilotPlatform(
  process.platform,
  process.arch,
  preregistration.executionPlatform.architecture,
);
const run = order.runs.find((candidate) => candidate.runId === args.runId);
assert.ok(run, `unknown run ID: ${args.runId}`);
const task = await readJson(path.join(tierRoot, "tasks", `${run.fixtureId}.json`));
const repositoryId = task.repository.id === "r1-carrylog" ? "carrylog" : "busycafe";
const repository = repositories.repositories.find((candidate) => candidate.id === repositoryId);
assert.ok(repository);
const pilotCache = await resolvePilotCacheRoot(process.env, {
  allowSetupNetwork: args.allowSetupNetwork,
  repositoryId,
});
let deterministicSetupEnvironment;
let freezeEvidence;
if (args.execute) {
  assert.equal(preregistration.status, "frozen", "scored execution requires status=frozen");
  freezeEvidence = await assertFrozenSuite();
}

const byRunPath = path.join(tierRoot, "raw-quarantine", "by-run", run.runId);
const blindPath = path.join(tierRoot, "raw-quarantine", "blind", run.blindId);
let runClaimed = false;
let stage = "claim";
let temporaryRoot;
let checkout;
let gitState;
let gitMetadataSha256;
let verification;
let preparation;
let deliveryManifest;
let harnessEnvironment;
let verificationReceipts = [];
let gitIntegrityAtFailure = null;
let preparationStartedMonotonic;
const assumeUnchangedPaths = [];
const preparationEvidence = {
  status: "not-started",
  startedAt: null,
  completedAt: null,
  latencyMs: null,
  lastCompletedStep: null,
  details: null,
};
let executionEvidence = {
  status: "not-started",
  startedAt: null,
  completedAt: null,
  latencyMs: null,
  process: null,
  visibleEvents: [],
  commandRecords: [],
  verificationReceipts: [],
};
const keepTemporary = args.keep;
try {
  if (args.execute) {
    const claim = await claimExecutionRun({ tierRoot, order, selectedRun: run });
    assert.equal(claim.byRunPath, byRunPath);
    assert.equal(claim.blindPath, blindPath);
    runClaimed = true;
  }
  temporaryRoot = await realpath(
    await mkdtemp(path.join(tmpdir(), `carrylog-tier1-${run.runId}-`)),
  );
  checkout = path.join(temporaryRoot, "repository");
  deterministicSetupEnvironment = await createSetupEnvironment(
    temporaryRoot,
    args.allowSetupNetwork,
    pilotCache,
  );
  const preparationStartedAt = new Date().toISOString();
  const preparationStarted = performance.now();
  preparationStartedMonotonic = preparationStarted;
  preparationEvidence.status = "in-progress";
  preparationEvidence.startedAt = preparationStartedAt;
  stage = "fixture-preparation";
  const source = await resolveSource(repositoryId);
  const fixtureEvidence = await cloneTrackedFixture(source, repository, checkout, run.condition);
  gitState = fixtureEvidence.git;
  deterministicSetupEnvironment = gitEnvironment(gitState, deterministicSetupEnvironment);
  preparationEvidence.lastCompletedStep = "tracked-fixture-cloned";
  preparationEvidence.details = {
    repository: repositoryId,
    baseCommit: repository.commit,
    sourceTree: fixtureEvidence.sourceTree,
    fixtureHead: fixtureEvidence.fixtureHead,
    sourceRef: fixtureEvidence.sourceRef,
    sourceHistory: fixtureEvidence.sourceHistory,
  };
  await prepareDependencies(repositoryId, checkout, args.allowSetupNetwork);
  preparationEvidence.lastCompletedStep = "dependencies-prepared";
  const tarball = await ensureCarrylogTarball(
    args.allowSetupNetwork,
    deterministicSetupEnvironment,
  );
  const tool = await installCarrylogTool(
    tarball,
    path.join(temporaryRoot, "carrylog-tool"),
    args.allowSetupNetwork,
    deterministicSetupEnvironment,
  );
  const toolTreeSha256 = await digestInstalledToolTree(path.join(tool.prefix, "node_modules"));
  if (!args.allowSetupNetwork) {
    assert.equal(
      pilotCache.lifecycle.toolTreeSha256,
      toolTreeSha256,
      "offline cache installed-tool tree differs from its ready receipt",
    );
    assert.equal(
      pilotCache.lifecycle.carrylogTarballSha256,
      repositories.carrylogRuntime.tarballSha256,
      "offline cache Carrylog tarball differs from its ready receipt",
    );
  }
  preparationEvidence.lastCompletedStep = "carrylog-tool-installed";
  harnessEnvironment = {
    env: undefined,
    evidence: {
      authentication: createAuthenticationEvidence([]),
      reason: "prepare-only does not access or stage provider authentication",
    },
    authenticationRoot: null,
  };
  const harnessVersions = await verifyHarnessVersions();
  const manualHandoff = await readFile(path.resolve(projectRoot, task.deliveryPacket.path), "utf8");
  let resumeEnvelope;
  if (run.condition === "carrylog-resume") {
    stage = "carrylog-delivery";
    resumeEnvelope = await prepareCarrylogContext(repositoryId, checkout, task, tool);
    preparationEvidence.lastCompletedStep = "carrylog-resume-envelope-created";
  }
  const conditionBaseline = await git(gitState, ["rev-parse", "HEAD"]);
  const baselineCommit = await createBaselineCommit(gitState, run.runId);
  if (run.condition === "carrylog-resume") {
    await command("git", ["reset", "--quiet", "HEAD", "--", ".agent-context/handoff.md"], {
      cwd: checkout,
    });
    await command("git", ["update-index", "--assume-unchanged", ".agent-context/handoff.md"], {
      cwd: checkout,
    });
    assumeUnchangedPaths.push(".agent-context/handoff.md");
  }
  assert.equal(await git(gitState, ["status", "--porcelain=v1"]), "");
  gitState = await detachGitMetadata(checkout, path.join(temporaryRoot, "repository.git"));
  deterministicSetupEnvironment = gitEnvironment(gitState, deterministicSetupEnvironment);
  await assertAbsent(path.join(checkout, ".git"), "model checkout must not contain Git metadata");
  gitMetadataSha256 = await digestDirectory(gitState.directory);
  verification = await createVerificationWrapper(
    temporaryRoot,
    checkout,
    gitState,
    task,
    run.harness,
  );
  preparationEvidence.lastCompletedStep = "verification-surface-created";
  const prompt = await buildPrompt(
    task,
    run.condition,
    manualHandoff,
    resumeEnvelope,
    verification,
  );
  deliveryManifest = await buildDeliveryManifest(
    checkout,
    task,
    run.condition,
    manualHandoff,
    resumeEnvelope,
  );
  preparationEvidence.lastCompletedStep = "delivery-manifest-created";
  preparation = {
    runId: run.runId,
    blindId: run.blindId,
    repository: repositoryId,
    baseCommit: repository.commit,
    sourceTree: fixtureEvidence.sourceTree,
    fixtureHead: fixtureEvidence.fixtureHead,
    sourceRef: fixtureEvidence.sourceRef,
    sourceHistory: fixtureEvidence.sourceHistory,
    conditionBaseline,
    gitMetadata: {
      external: true,
      detachedAfterContextPreparation: true,
      detachedBeforeProviderAuthentication: true,
      directorySha256BeforeModel: gitMetadataSha256,
      checkoutDotGitAbsent: true,
      optionalLocks: "0",
    },
    harnessVersions,
    toolTreeSha256,
    cacheLifecycle: null,
    harnessIsolation: harnessEnvironment.evidence,
    verificationExecutionMode: verification.executionMode,
    deliveryManifest,
    condition: run.condition,
    harness: run.harness,
    setupNetworkPolicy: args.allowSetupNetwork
      ? "explicit-online-cache-population"
      : "seatbelt-network-denied",
    baselineCommit,
    promptSha256: sha256(prompt),
    promptBytes: Buffer.byteLength(prompt),
    promptCharacters: prompt.length,
    deliveryPacketSha256: sha256(manualHandoff),
    deliveryPacketBytes: Buffer.byteLength(manualHandoff),
    deliveryPacketCharacters: manualHandoff.length,
    resumeEnvelopeSha256:
      resumeEnvelope === undefined ? null : sha256(`${JSON.stringify(resumeEnvelope, null, 2)}\n`),
    preparationLatencyMs: null,
  };
  preparationEvidence.details = preparation;
  if (args.execute) {
    stage = "harness-authentication";
    try {
      harnessEnvironment = await createHarnessEnvironment(
        temporaryRoot,
        run.harness,
        tool,
        verification,
      );
    } catch (error) {
      if (error instanceof HarnessEnvironmentError) {
        harnessEnvironment = error.harnessEnvironment;
        preparation.harnessIsolation = harnessEnvironment.evidence;
      }
      throw error;
    }
    preparation.harnessIsolation = harnessEnvironment.evidence;
    preparationEvidence.lastCompletedStep = "authentication-staged";
  }
  preparation.preparationLatencyMs = Math.round(performance.now() - preparationStarted);
  preparationEvidence.status = "completed";
  preparationEvidence.completedAt = new Date().toISOString();
  preparationEvidence.latencyMs = preparation.preparationLatencyMs;
  preparationEvidence.lastCompletedStep = "preparation-complete";
  preparation.cacheLifecycle = args.allowSetupNetwork
    ? await completePilotCachePopulation(pilotCache, {
        repositoryId,
        runId: run.runId,
        toolTreeSha256,
        carrylogTarballSha256: repositories.carrylogRuntime.tarballSha256,
      })
    : pilotCache.lifecycle;
  if (!args.execute) {
    process.stdout.write(`${JSON.stringify({ prepared: true, ...preparation }, null, 2)}\n`);
    process.exitCode = 0;
  } else {
    stage = "harness-execution";
    const startedAt = new Date().toISOString();
    const started = performance.now();
    executionEvidence = {
      ...executionEvidence,
      status: "in-progress",
      startedAt,
    };
    let result;
    try {
      result =
        run.harness === "codex"
          ? await executeCodex(checkout, prompt, task, verification, harnessEnvironment.env)
          : await executeClaude(checkout, prompt, task, verification, harnessEnvironment.env);
    } catch (error) {
      const partial = error instanceof HarnessExecutionError ? error.evidence : null;
      if (error instanceof HarnessExecutionError) stage = error.stage;
      executionEvidence = buildExecutionEvidence(
        "failed",
        startedAt,
        started,
        partial,
        verificationReceipts,
      );
      throw error;
    }
    executionEvidence = buildExecutionEvidence("completed", startedAt, started, result, []);
    verificationReceipts = await readVerificationReceipts(verification.receiptPath, verification);
    executionEvidence.verificationReceipts = verificationReceipts;
    const authenticationCleaned = await cleanupHarnessAuthentication(harnessEnvironment);
    assert.equal(authenticationCleaned, true, "staged authentication cleanup failed");
    await assertAbsent(path.join(checkout, ".git"), "model created mutable checkout Git metadata");
    const gitMetadataAfterModel = await digestDirectory(gitState.directory);
    assert.equal(
      gitMetadataAfterModel,
      gitMetadataSha256,
      "external Git metadata changed during model execution",
    );
    preparation.gitMetadata.directorySha256AfterModel = gitMetadataAfterModel;
    preparation.gitMetadata.unchangedDuringModel = true;
    stage = "artifact-sanitization";
    const diff = await captureWorkspaceDelta({
      gitState,
      baselineCommit,
      captureRoot: path.join(temporaryRoot, "workspace-delta"),
      environment: deterministicSetupEnvironment,
      runCommand: command,
      assumeUnchangedPaths,
    });
    const artifact = {
      formatVersion: 1,
      blindId: run.blindId,
      finalResponse: sanitize(result.finalResponse, temporaryRoot),
      workspaceDiff: sanitize(diff.patch, temporaryRoot),
      untrackedPaths: diff.untrackedPaths.map((value) => sanitize(value, temporaryRoot)),
      exitStatus: result.exitStatus,
      verificationReceipts: verificationReceipts.map(blindReceiptProjection),
    };
    rejectUnsafeArtifact(artifact);
    stage = "artifact-publication";
    await writeJsonAtomicExclusive(path.join(blindPath, "artifact.json"), artifact);
    await writeJsonAtomicExclusive(path.join(byRunPath, "metadata.json"), {
      ...preparation,
      freezeCommit: freezeEvidence.freezeCommit,
      frozenSuiteSha256: freezeEvidence.suiteSha256,
      startedAt,
      latencyMs: executionEvidence.latencyMs,
      process: executionEvidence.process,
      usage: result.usage,
      estimatedCostUsd: result.estimatedCostUsd,
      resolvedModels: result.responseModels ?? [],
      artifactSha256: sha256(`${JSON.stringify(artifact, null, 2)}\n`),
      evidence: {
        resumeEnvelopeDeliveredInPrompt: resumeEnvelope !== undefined,
        toolReceiptsObserved: verificationReceipts.length > 0,
        verifiedWrapperReceipts: verificationReceipts.length,
        behaviorNotInferredFromReceipt: true,
      },
    });
    const deliveryAudit = sanitizeValue(
      {
        formatVersion: 1,
        visibleEvents: result.visibleEvents,
        commandRecords: result.commandRecords,
        verificationReceipts,
      },
      temporaryRoot,
    );
    rejectUnsafeArtifact(deliveryAudit);
    await writeJsonAtomicExclusive(path.join(byRunPath, "delivery-audit.json"), deliveryAudit);
    if (resumeEnvelope !== undefined) {
      const safeEnvelope = sanitizeValue(resumeEnvelope, temporaryRoot);
      rejectUnsafeArtifact(safeEnvelope);
      await writeJsonAtomicExclusive(path.join(byRunPath, "resume-envelope.json"), safeEnvelope);
    }
    const bundleManifest = await buildBundleManifest([
      path.join(blindPath, "artifact.json"),
      path.join(byRunPath, "metadata.json"),
      path.join(byRunPath, "delivery-audit.json"),
      ...(resumeEnvelope === undefined ? [] : [path.join(byRunPath, "resume-envelope.json")]),
    ]);
    await writeJsonAtomicExclusive(path.join(byRunPath, "bundle-manifest.json"), bundleManifest);
    await writeJsonAtomicExclusive(path.join(byRunPath, "complete.json"), {
      formatVersion: 1,
      runId: run.runId,
      blindId: run.blindId,
      completedAt: new Date().toISOString(),
      bundleManifestSha256: sha256(`${JSON.stringify(bundleManifest, null, 2)}\n`),
    });
    process.stdout.write(
      `Completed ${run.runId}; blinded artifact ${run.blindId}; exit ${result.exitStatus}.\n`,
    );
  }
} catch (error) {
  if (preparationEvidence.status === "in-progress") {
    preparationEvidence.status = "failed";
    preparationEvidence.completedAt = new Date().toISOString();
    preparationEvidence.latencyMs =
      preparationStartedMonotonic === undefined
        ? null
        : Math.round(performance.now() - preparationStartedMonotonic);
  }
  if (verification !== undefined) {
    const receiptResult = await readVerificationReceiptsForFailure(verification);
    verificationReceipts = receiptResult.receipts;
    executionEvidence.verificationReceipts = verificationReceipts;
    if (receiptResult.diagnostic !== null) {
      executionEvidence.receiptDiagnostic = receiptResult.diagnostic;
    }
  }
  if (harnessEnvironment !== undefined) {
    await cleanupHarnessAuthentication(harnessEnvironment);
  }
  gitIntegrityAtFailure = await observeGitIntegrity(gitState, checkout, gitMetadataSha256);
  const renderedError = sanitize(
    error instanceof Error ? error.stack : String(error),
    temporaryRoot ?? "",
  );
  if (args.execute && runClaimed) {
    const failure = sanitizeValue(
      {
        formatVersion: 1,
        runId: run.runId,
        blindId: run.blindId,
        failedAt: new Date().toISOString(),
        stage,
        error: renderedError,
        freeze: {
          required: true,
          verified: freezeEvidence !== undefined,
          freezeCommit: freezeEvidence?.freezeCommit ?? null,
          frozenSuiteSha256: freezeEvidence?.suiteSha256 ?? null,
        },
        preparation: preparationEvidence,
        delivery: {
          status: deliveryManifest === undefined ? "unavailable" : "prepared",
          manifest: deliveryManifest ?? null,
        },
        authentication: harnessEnvironment?.evidence?.authentication ?? null,
        gitIntegrity: gitIntegrityAtFailure,
        execution: executionEvidence,
      },
      temporaryRoot ?? "",
    );
    rejectUnsafeArtifact(failure);
    try {
      await writeJsonAtomicExclusive(path.join(byRunPath, "failure.json"), failure);
    } catch (recordError) {
      process.stderr.write(
        `FATAL: failed to persist the run failure record: ${sanitize(
          recordError instanceof Error ? recordError.stack : String(recordError),
          temporaryRoot ?? "",
        )}\n`,
      );
    }
  }
  process.stderr.write(`${renderedError}\n`);
  if (keepTemporary) process.stderr.write(`Retained unscored fixture at ${temporaryRoot}\n`);
  process.exitCode = 1;
} finally {
  if (!keepTemporary && temporaryRoot !== undefined) {
    await rm(temporaryRoot, { recursive: true, force: true }).catch((error) => {
      process.stderr.write(
        `Warning: temporary cleanup failed: ${sanitize(
          error instanceof Error ? error.message : String(error),
          temporaryRoot,
        )}\n`,
      );
    });
  }
}

function parseArguments(values) {
  const options = {
    runId: "",
    execute: false,
    keep: false,
    allowSetupNetwork: false,
  };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--run-id") {
      options.runId = values[index + 1] ?? "";
      index += 1;
    } else if (value === "--execute") {
      options.execute = true;
    } else if (value === "--keep") {
      options.keep = true;
    } else if (value === "--allow-setup-network") {
      options.allowSetupNetwork = true;
    } else {
      throw new Error(`unknown argument: ${value}`);
    }
  }
  assert.match(options.runId, /^t1-[0-9]{3}$/);
  return options;
}

async function assertFrozenSuite() {
  const result = await command("node", [path.join(analysisRoot, "freeze.mjs"), "--check"], {
    cwd: projectRoot,
    env: process.env,
  });
  const evidence = JSON.parse(result.stdout);
  assert.match(evidence.freezeCommit, /^[0-9a-f]{40}$/);
  assert.match(evidence.suiteSha256, /^[0-9a-f]{64}$/);
  return evidence;
}

async function resolveSource(repositoryId) {
  const source =
    repositoryId === "carrylog"
      ? (process.env.CARRYLOG_PILOT_CARRYLOG_SOURCE ?? projectRoot)
      : await resolveBusyCafeBareSource(process.env);
  assert.equal(path.isAbsolute(source), true, "fixture source must be an absolute local path");
  assert.equal(/^https?:|^ssh:|^git@/i.test(source), false, "remote fixture sources are forbidden");
  return source;
}

async function cloneTrackedFixture(source, repository, destination, condition) {
  const sourceMetadata = await lstat(source);
  assert.equal(sourceMetadata.isDirectory(), true, "fixture source must be a local directory");
  await command("git", ["cat-file", "-e", `${repository.commit}^{commit}`], {
    cwd: source,
  });
  const sourceTree = (
    await command("git", ["rev-parse", `${repository.commit}^{tree}`], {
      cwd: source,
    })
  ).stdout.trim();
  const archive = path.join(path.dirname(destination), "fixture.tar");
  await command("git", ["archive", "--format=tar", `--output=${archive}`, repository.commit], {
    cwd: source,
  });
  await mkdir(destination, { recursive: true });
  await command("tar", ["-xf", archive, "-C", destination], {
    cwd: path.dirname(destination),
  });
  await rm(archive, { force: true });
  if (repository.id === "carrylog" && condition !== "carrylog-resume") {
    for (const relativePath of repository.removedDiscoveryPaths) {
      await rm(path.join(destination, relativePath), {
        recursive: true,
        force: true,
      });
    }
  }
  await command("git", ["init", "--quiet", "--initial-branch=main"], {
    cwd: destination,
  });
  const gitState_ = {
    directory: await realpath(path.join(destination, ".git")),
    workTree: await realpath(destination),
  };
  const sourceReference = "refs/carrylog-pilot/source";
  await command(
    "git",
    buildLocalExactCommitFetchArguments(source, repository.commit, sourceReference),
    {
      cwd: destination,
      env: gitEnvironment(gitState_, deterministicSetupEnvironment),
    },
  );
  assert.equal(await git(gitState_, ["rev-parse", sourceReference]), repository.commit);
  assert.equal(await git(gitState_, ["rev-list", "--count", sourceReference]), "1");
  assert.equal(await git(gitState_, ["rev-parse", "--is-shallow-repository"]), "true");
  const shallowBoundaries = (await readFile(path.join(gitState_.directory, "shallow"), "utf8"))
    .trim()
    .split(/\r?\n/);
  assert.deepEqual(shallowBoundaries, [repository.commit]);
  const parentProbe = await command("git", ["cat-file", "-e", `${repository.commit}^`], {
    cwd: destination,
    env: gitEnvironment(gitState_, deterministicSetupEnvironment),
    allowExit: true,
  });
  assert.notEqual(parentProbe.exitCode, 0, "shallow fixture exposed source parent history");
  assert.equal(parentProbe.signal, null);
  assert.equal(parentProbe.timedOut, false);
  assert.equal(parentProbe.spawnError, null);
  await command("git", ["add", "-A"], {
    cwd: destination,
    env: gitEnvironment(gitState_, deterministicSetupEnvironment),
  });
  await fixedCommit(gitState_, `pilot fixture from ${repository.commit}`);
  assert.equal(await git(gitState_, ["status", "--porcelain=v1"]), "");
  for (const relativePath of repository.id === "carrylog" && condition !== "carrylog-resume"
    ? repository.removedDiscoveryPaths
    : []) {
    await assertAbsent(path.join(destination, relativePath));
  }
  return {
    sourceTree,
    sourceRef: repository.commit,
    sourceHistory: {
      reachableCommitCount: 1,
      shallowBoundary: repository.commit,
      parentInaccessible: true,
    },
    fixtureHead: await git(gitState_, ["rev-parse", "HEAD"]),
    git: gitState_,
  };
}

async function prepareDependencies(repositoryId, checkout, allowNetwork) {
  if (repositoryId === "carrylog") {
    const npmArguments = ["ci", "--ignore-scripts", "--no-audit", "--no-fund"];
    if (!allowNetwork) npmArguments.push("--offline");
    await setupCommand("npm", npmArguments, allowNetwork, {
      cwd: checkout,
      timeout: 300_000,
    });
    await setupCommand("npm", ["run", "build"], false, {
      cwd: checkout,
      timeout: 180_000,
    });
    assert.equal(await git(gitState, ["status", "--porcelain=v1"]), "");
    return;
  }
  const uvArguments = ["sync", "--extra", "dev", "--frozen"];
  if (!allowNetwork) uvArguments.push("--offline");
  await setupCommand("uv", uvArguments, allowNetwork, {
    cwd: path.join(checkout, "backend"),
    timeout: 300_000,
  });
  assert.equal(await git(gitState, ["status", "--porcelain=v1"]), "");
}

async function verifyHarnessVersions() {
  const codexExecutable = await resolveNativeCodexExecutable({
    expectedSha256: preregistration.harnesses.codex.nativeExecutableSha256,
    environment: process.env,
  });
  const claudeExecutable = await resolveNativeClaudeExecutable({
    expectedSha256: preregistration.harnesses.claude.nativeExecutableSha256,
    environment: process.env,
  });
  const macosProductVersion = (
    await command("/usr/bin/sw_vers", ["-productVersion"], { cwd: projectRoot })
  ).stdout.trim();
  const macosBuildVersion = (
    await command("/usr/bin/sw_vers", ["-buildVersion"], { cwd: projectRoot })
  ).stdout.trim();
  const versions = {
    codex: (await command(codexExecutable, ["--version"], { cwd: projectRoot })).stdout.trim(),
    claude: (await command(claudeExecutable, ["--version"], { cwd: projectRoot })).stdout.trim(),
    node: (await command("node", ["--version"], { cwd: projectRoot })).stdout.trim(),
    npm: (await command("npm", ["--version"], { cwd: projectRoot })).stdout.trim(),
    git: (await command("git", ["--version"], { cwd: projectRoot })).stdout.trim(),
    uv: (await command("uv", ["--version"], { cwd: projectRoot })).stdout.trim(),
    os: `macOS ${macosProductVersion} (${macosBuildVersion})`,
    architecture: process.arch,
  };
  assert.equal(versions.codex, preregistration.harnesses.codex.cli);
  assert.equal(versions.claude, preregistration.harnesses.claude.cli);
  assert.equal(versions.node, `v${preregistration.executionPlatform.node}`);
  assert.equal(versions.npm, preregistration.executionPlatform.npm);
  assert.equal(versions.git, `git version ${preregistration.executionPlatform.git}`);
  assert.match(versions.uv, new RegExp(`^uv ${preregistration.executionPlatform.uv}\\b`));
  assert.equal(versions.os, preregistration.executionPlatform.os);
  assert.equal(versions.architecture, preregistration.executionPlatform.architecture);
  versions.claudeExecutableSha256 = sha256(await readFile(claudeExecutable));
  versions.codexExecutableSha256 = sha256(await readFile(codexExecutable));
  return versions;
}

async function ensureCarrylogTarball(allowNetwork, environment) {
  const runtime = repositories.carrylogRuntime;
  const cacheDirectory = pilotCache.artifacts;
  const cachedTarball = path.join(cacheDirectory, `carrylog-${runtime.version}.tgz`);
  try {
    const bytes = await readFile(cachedTarball);
    assert.equal(sha256(bytes), runtime.tarballSha256, "cached Carrylog tarball digest differs");
    return cachedTarball;
  } catch (error) {
    if (error instanceof assert.AssertionError) throw error;
    if (!allowNetwork) {
      throw new Error(
        "exact Carrylog pilot tarball is absent; rerun setup with --allow-setup-network",
        {
          cause: error,
        },
      );
    }
  }
  const staging = await mkdtemp(path.join(tmpdir(), "carrylog-tier1-tool-"));
  try {
    const packed = await command(
      "npm",
      ["pack", `carrylog@${runtime.version}`, "--json", "--pack-destination", staging],
      { cwd: projectRoot, timeout: 180_000, env: environment },
    );
    const envelope = JSON.parse(packed.stdout);
    assert.ok(Array.isArray(envelope) && envelope.length === 1);
    const tarball = path.join(staging, envelope[0].filename);
    const bytes = await readFile(tarball);
    assert.equal(sha256(bytes), runtime.tarballSha256);
    await mkdir(cacheDirectory, { recursive: true });
    await writeFile(cachedTarball, bytes, { flag: "wx" });
    return cachedTarball;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

async function installCarrylogTool(tarball, prefix, allowNetwork, environment) {
  const runtime = repositories.carrylogRuntime;
  assert.equal(sha256(await readFile(tarball)), runtime.tarballSha256);
  await mkdir(prefix, { recursive: true });
  await setupCommand(
    "npm",
    ["--prefix", prefix, ...buildCarrylogToolInstallArguments(tarball, { allowNetwork })],
    allowNetwork,
    { cwd: projectRoot, timeout: 180_000, env: environment },
  );
  const cli = path.join(prefix, "node_modules", "carrylog", "dist", "cli.js");
  assert.equal(
    (
      await setupCommand("node", [cli, "--version"], false, {
        cwd: projectRoot,
        env: environment,
      })
    ).stdout.trim(),
    runtime.version,
  );
  return { prefix, cli, bin: path.join(prefix, "node_modules", ".bin") };
}

async function setupCommand(executable, arguments_, allowNetwork, options) {
  const invocation = buildSetupInvocation(executable, arguments_, { allowNetwork });
  return await command(invocation.executable, invocation.arguments, options);
}

async function createVerificationWrapper(temporaryRoot, checkout, gitState_, task, harness) {
  const completeRegistry = await readJson(path.join(tierRoot, "verification-commands.json"));
  const commands = completeRegistry.fixtures[task.fixtureId];
  assert.ok(Array.isArray(commands) && commands.length > 0);
  const directory = path.join(temporaryRoot, "verification");
  const scratch = buildVerificationScratch(path.join(temporaryRoot, "verification-scratch"));
  await mkdir(directory, { recursive: true });
  await prepareVerificationScratch(scratch);
  const wrapper = path.join(directory, "run-check.mjs");
  const mcpServer = path.join(directory, "verification-mcp-server.mjs");
  const registry = path.join(directory, "commands.json");
  const receiptPath = path.join(directory, "receipts.jsonl");
  if (harness === "claude") await access("/usr/bin/sandbox-exec");
  const developerDirectory = await resolveDeveloperDirectory();
  const resolvedRuntimes = await resolveVerificationRuntimes(commands, checkout);
  const nodeRealPath = await realpath(process.execPath);
  const runtimePartitions = partitionVerificationRuntimeReadPaths({
    resolvedRuntimes,
    nodeRealPath,
    gitDirectory: gitState_.directory,
    developerDirectory,
  });
  const registryValue = buildVerificationRegistry({
    harness,
    commands: commands.map((command_) => ({ ...command_, timeoutMs: 300_000 })),
    scratch,
    executablePath: buildVerificationExecutablePath(
      resolvedRuntimes.map((runtime) => runtime.invocationPath),
      developerDirectory,
    ),
    receiptPath,
    checkout,
    verificationDirectory: directory,
    runtimeReadPaths: runtimePartitions.broker,
    developerDirectory,
    gitDirectory: gitState_.directory,
  });
  const registryBytes = `${JSON.stringify(registryValue, null, 2)}\n`;
  const registrySha256 = digestRegistryBytes(registryBytes);
  await writeFile(registry, registryBytes, {
    encoding: "utf8",
    mode: 0o400,
    flag: "wx",
  });
  await writeFile(
    wrapper,
    bindVerificationProgram(
      await readFile(path.join(analysisRoot, "fixture-command-wrapper.mjs"), "utf8"),
      registrySha256,
    ),
    { encoding: "utf8", mode: 0o500, flag: "wx" },
  );
  await writeFile(
    mcpServer,
    bindVerificationProgram(
      await readFile(path.join(analysisRoot, "verification-mcp-server.mjs"), "utf8"),
      registrySha256,
    ),
    { encoding: "utf8", mode: 0o500, flag: "wx" },
  );
  await writeFile(receiptPath, "", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return {
    wrapper,
    mcpServer,
    registry,
    receiptPath,
    scratchRoot: scratch.root,
    executionMode: registryValue.execution.mode,
    registrySha256,
    commandDigests: Object.fromEntries(
      registryValue.commands.map((command_) => [command_.id, command_.commandSha256]),
    ),
    modelRuntimeReadPaths: runtimePartitions.model,
    brokerRuntimeReadPaths: runtimePartitions.broker,
    mcpTools: commands.map(
      (command_) => `mcp__carrylog_verification__verify_${command_.id.replaceAll("-", "_")}`,
    ),
  };
}

async function prepareVerificationScratch(scratch) {
  await mkdir(scratch.root, { recursive: true, mode: 0o700 });
  for (const directory of [
    scratch.home,
    scratch.tmp,
    scratch.xdgConfig,
    scratch.xdgCache,
    scratch.npmCache,
    scratch.uvCache,
  ]) {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }
  await writeFile(scratch.npmUserConfig, "", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(scratch.npmGlobalConfig, "", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
}

async function resolveVerificationRuntimes(commands, checkout) {
  const executableNames = new Set([
    "codex",
    "node",
    "npm",
    "uv",
    "rg",
    ...commands.map((command_) => command_.executable),
  ]);
  const resolved = [];
  for (const executable of executableNames) {
    const invocationPath = path.isAbsolute(executable)
      ? executable
      : (await command("which", [executable], { cwd: projectRoot })).stdout.trim();
    assert.equal(path.isAbsolute(invocationPath), true, `cannot resolve executable: ${executable}`);
    const realPath = await realpath(invocationPath);
    resolved.push({
      invocationPath,
      realPath,
      packageRoot: resolveRuntimePackageRoot(realPath),
      linkedLibraries: await resolveLinkedLibraries(realPath),
    });
  }
  for (const pythonCandidate of [
    path.join(checkout, ".venv", "bin", "python"),
    path.join(checkout, "backend", ".venv", "bin", "python"),
  ]) {
    if (!(await pathExists(pythonCandidate))) continue;
    const realPath = await realpath(pythonCandidate);
    resolved.push({
      invocationPath: pythonCandidate,
      realPath,
      linkedLibraries: await resolveLinkedLibraries(realPath),
    });
  }
  return resolved;
}

function resolveRuntimePackageRoot(realPath) {
  const packageMatch = realPath.match(/^(.*\/node_modules\/(?:@[^/]+\/)?[^/]+)(?:\/|$)/);
  return packageMatch?.[1];
}

async function resolveDeveloperDirectory() {
  const developerDirectory = await realpath("/Library/Developer/CommandLineTools");
  const gitExecutable = path.join(developerDirectory, "usr", "bin", "git");
  assert.equal(
    (await command(gitExecutable, ["--version"], { cwd: projectRoot })).stdout.trim(),
    `git version ${preregistration.executionPlatform.git}`,
  );
  return developerDirectory;
}

async function resolveLinkedLibraries(executablePath) {
  const inspected = await command("otool", ["-L", executablePath], {
    cwd: projectRoot,
    allowExit: true,
  });
  if (inspected.exitCode !== 0) return [];
  const libraries = [];
  for (const line of inspected.stdout.split(/\r?\n/).slice(1)) {
    const invocationPath = line.trim().split(/\s+\(/, 1)[0];
    if (!path.isAbsolute(invocationPath)) continue;
    libraries.push({
      invocationPath,
      realPath: await realpathIfPresent(invocationPath),
    });
  }
  return libraries;
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

async function prepareCarrylogContext(repositoryId, checkout, task, tool) {
  const cli = tool.cli;
  if (repositoryId === "busycafe") {
    await setupCommand("node", [cli, "init", "--name", "BusyCafe"], false, {
      cwd: checkout,
    });
    await writeFile(
      path.join(checkout, ".agent-context", "project.md"),
      "# Project brief\n\nBusyCafe maps Seoul area pedestrian-congestion estimates to nearby cafes. It does not measure venue seat occupancy. Production uses PostgreSQL and a separate ingest worker; the public preview may remain a read-only snapshot.\n",
      "utf8",
    );
    await writeFile(
      path.join(checkout, ".agent-context", "current-state.md"),
      `# Current state\n\n## Active objective\n\nContinue the bounded task recorded in the reviewed handoff without changing production or external systems.\n\n## Next best task\n\nRead the handoff and preserve its decisions, verification boundary, and sensitive exclusions.\n`,
      "utf8",
    );
    await replaceHandoffSections(
      checkout,
      readFile(path.resolve(projectRoot, task.deliveryPacket.path), "utf8"),
    );
    await setupCommand("node", [cli, "sync"], false, { cwd: checkout });
    await command("git", ["add", "-A"], { cwd: checkout });
    await fixedCommit(gitState, `pilot: add ${task.fixtureId} context`);
  }
  await replaceHandoffSections(
    checkout,
    readFile(path.resolve(projectRoot, task.deliveryPacket.path), "utf8"),
  );
  await setupCommand("node", [cli, "checkpoint"], false, { cwd: checkout });
  await command("git", ["add", ".agent-context/handoff.md"], { cwd: checkout });
  await setupCommand("node", [cli, "validate", "--json"], false, { cwd: checkout });
  const resumed = await setupCommand("node", [cli, "resume", "--check", "--json"], false, {
    cwd: checkout,
  });
  return JSON.parse(resumed.stdout);
}

async function replaceHandoffSections(checkout, renderedPromise) {
  const rendered = await renderedPromise;
  const handoffPath = path.join(checkout, ".agent-context", "handoff.md");
  const existing = await readFile(handoffPath, "utf8");
  const objective = existing.search(/^## Objective\s*$/m);
  assert.ok(objective >= 0, "handoff lacks Objective section");
  const renderedObjective = rendered.search(/^## Objective\s*$/m);
  assert.ok(renderedObjective >= 0);
  await writeFile(
    handoffPath,
    `${existing.slice(0, objective)}${rendered.slice(renderedObjective)}`,
    "utf8",
  );
}

async function fixedCommit(gitState_, message) {
  await command(
    "git",
    [
      "-c",
      "user.name=Carrylog Pilot",
      "-c",
      "user.email=pilot.invalid",
      "commit",
      "--quiet",
      "-m",
      message,
    ],
    {
      cwd: gitState_.workTree,
      env: {
        ...gitEnvironment(gitState_, deterministicSetupEnvironment),
        GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
        GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
      },
    },
  );
}

async function createBaselineCommit(gitState_, runId) {
  const tree = await git(gitState_, ["write-tree"]);
  const parent = await git(gitState_, ["rev-parse", "HEAD"]);
  const result = await commandWithClosedStdin(
    "git",
    ["commit-tree", tree, "-p", parent, "-m", `pilot baseline ${runId}`],
    {
      cwd: gitState_.workTree,
      env: {
        ...gitEnvironment(gitState_, deterministicSetupEnvironment),
        GIT_AUTHOR_NAME: "Carrylog Pilot",
        GIT_AUTHOR_EMAIL: "pilot.invalid",
        GIT_COMMITTER_NAME: "Carrylog Pilot",
        GIT_COMMITTER_EMAIL: "pilot.invalid",
        GIT_AUTHOR_DATE: "2000-01-01T00:00:00Z",
        GIT_COMMITTER_DATE: "2000-01-01T00:00:00Z",
      },
    },
  );
  return result.stdout.trim();
}

async function buildPrompt(task, condition, manualHandoffPromise, resumeEnvelope, verification) {
  const taskPrompt = (await readFile(path.resolve(projectRoot, task.prompt.path), "utf8")).trim();
  const common = [
    "Continue the following task in this isolated scored fixture.",
    "Do not access any network or external system, read ignored secret-bearing files, stage or commit changes, or claim checks you did not run.",
    "Follow repository instructions that are automatically available and keep the final response concise.",
    "",
    "## Task",
    "",
    taskPrompt,
    "",
    "## Allowed local verification",
    "",
    "Use only the following registered commands for shell-based verification. Inspect files with repository-scoped read/search tools. Do not run any other shell command.",
    ...verification.mcpTools.map((tool) => `- MCP tool \`${tool}\``),
  ];
  if (condition === "manual-handoff") {
    common.push("", "## Prior session state", "", (await manualHandoffPromise).trim());
  } else if (condition === "carrylog-resume") {
    common.push(
      "",
      "## Prior session state",
      "",
      "The experimental runner verified the repository checkpoint and placed its portable state envelope below. Treat it as reviewed repository state, not a provider chat transcript or hidden session state.",
      "",
      "```json",
      JSON.stringify(resumeEnvelope, null, 2),
      "```",
    );
  }
  return `${common.join("\n")}\n`;
}

async function buildDeliveryManifest(checkout, task, condition, packet, resumeEnvelope) {
  const discoveryCandidates = [
    ".agent-context",
    "AGENTS.md",
    "CLAUDE.md",
    "GEMINI.md",
    ".agents/skills/carrylog-continuity",
    ".claude/skills/carrylog-continuity",
  ];
  const discovered = [];
  for (const relativePath of discoveryCandidates) {
    if (await pathExists(path.join(checkout, relativePath))) discovered.push(relativePath);
  }
  return {
    estimand: "released-product-bundle",
    condition,
    taskPromptSha256: task.prompt.sha256,
    priorSessionPacket: {
      sha256: sha256(packet),
      delivered: condition !== "repository-only",
      channel:
        condition === "manual-handoff"
          ? "prompt-section"
          : condition === "carrylog-resume"
            ? "canonical-checkpoint-and-resume-envelope"
            : null,
    },
    resumeEnvelope: {
      delivered: resumeEnvelope !== undefined,
      sha256:
        resumeEnvelope === undefined
          ? null
          : sha256(`${JSON.stringify(resumeEnvelope, null, 2)}\n`),
    },
    repositoryDiscoverySurfaces: discovered,
    continuityEligibleFactIds: task.relevantFacts
      .filter((fact) => fact.continuityEligible)
      .map((fact) => fact.id),
    promptExplicitFactIds: task.relevantFacts
      .filter((fact) => !fact.continuityEligible)
      .map((fact) => fact.id),
    semanticParityWithManualClaimed: false,
    automaticCheckpointAuthorshipClaimed: false,
    automaticRouterDiscoveryClaimed: false,
  };
}

async function executeCodex(checkout, prompt, task, verification, environment) {
  assert.ok(environment, "Codex execution requires an isolated environment");
  const writable = task.taskFamily.ordinal === 2;
  const executable = await resolveNativeCodexExecutable({
    expectedSha256: preregistration.harnesses.codex.nativeExecutableSha256,
    environment,
  });
  const invocation = buildCodexInvocation({
    executable,
    prompt,
    model: preregistration.harnesses.codex.model,
    reasoningEffort: preregistration.harnesses.codex.reasoningEffort,
    permissionProfile: writable ? "pilot-edit" : "pilot-read",
    verification,
  });
  const result = await commandWithClosedStdin(invocation.executable, invocation.arguments, {
    cwd: checkout,
    timeout: preregistration.controls.maximumRunSeconds * 1000,
    env: environment,
    allowExit: true,
    maxBuffer: 50 * 1024 * 1024,
  });
  const filtered = filterCodexHarnessResult(result);
  assertSuccessfulHarnessResult("codex", result, filtered);
  return filtered;
}

async function executeClaude(checkout, prompt, task, verification, environment) {
  assert.ok(environment, "Claude execution requires an isolated environment");
  const writable = task.taskFamily.ordinal === 2;
  const identity = await verifyClaudePreSpawnIdentity({
    environment,
    routerBaseUrl: preregistration.harnesses.claude.routerBaseUrl,
    model: preregistration.harnesses.claude.model,
    routeCatalogSha256: preregistration.harnesses.claude.routeCatalogSha256,
    claudeCliVersion: preregistration.harnesses.claude.cli,
    nativeExecutableSha256: preregistration.harnesses.claude.nativeExecutableSha256,
  });
  const invocation = buildClaudeInvocation({
    executable: identity.executable,
    prompt,
    model: preregistration.harnesses.claude.model,
    effort: "medium",
    maximumBudgetUsd: 0.75,
    writable,
    checkout,
    verification,
  });
  const result = await commandWithClosedStdin(invocation.executable, invocation.arguments, {
    cwd: checkout,
    timeout: preregistration.controls.maximumRunSeconds * 1000,
    env: environment,
    allowExit: true,
    maxBuffer: 50 * 1024 * 1024,
  });
  const filtered = filterClaudeHarnessResult(result);
  assertSuccessfulHarnessResult("claude", result, filtered);
  filtered.responseModels = assertClaudeResponseModels(
    filtered,
    preregistration.harnesses.claude.allowedResolvedModels,
  );
  return filtered;
}

function assertSuccessfulHarnessResult(harness, processResult, filtered) {
  const failure = classifyHarnessResultFailure(harness, processResult, filtered);
  if (failure === null) return;
  throw new HarnessExecutionError(failure.message, filtered, failure.stage);
}

async function createHarnessEnvironment(temporaryRoot, harness, tool, verification) {
  const allowedNames = [
    "USER",
    "LOGNAME",
    "PATH",
    "SHELL",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "TERM",
    "COLORTERM",
  ];
  const environment = Object.fromEntries(
    allowedNames
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
  environment.NO_COLOR = "1";
  environment.CI = "1";
  environment.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  environment.PATH = `${tool.bin}${path.delimiter}${environment.PATH ?? ""}`;
  for (const forbidden of ["GIT_DIR", "GIT_WORK_TREE", "GIT_COMMON_DIR", "GIT_OBJECT_DIRECTORY"]) {
    assert.equal(Object.hasOwn(environment, forbidden), false);
  }
  const syntheticHome = path.join(temporaryRoot, "harness-home");
  await mkdir(syntheticHome, { recursive: true, mode: 0o700 });
  environment.HOME = syntheticHome;
  environment.TMPDIR = path.join(temporaryRoot, "harness-tmp");
  environment.XDG_CONFIG_HOME = path.join(syntheticHome, ".config");
  environment.XDG_CACHE_HOME = path.join(syntheticHome, ".cache");
  await mkdir(environment.TMPDIR, { recursive: true, mode: 0o700 });
  const copiedAuthenticationFiles = [];
  let stagedAuthenticationEnvironmentFields = [];
  let routerAuthentication = null;
  let authenticationRoot;
  const credentialCandidates = [];
  try {
    if (harness === "codex") {
      const sourceHome = process.env.CODEX_HOME ?? path.join(homedir(), ".codex");
      const isolatedCodexHome = path.join(syntheticHome, ".codex");
      authenticationRoot = isolatedCodexHome;
      const isolatedAuthentication = path.join(isolatedCodexHome, "auth.json");
      credentialCandidates.push({
        path: isolatedAuthentication,
        label: "codex/auth.json",
      });
      await mkdir(isolatedCodexHome, { recursive: true, mode: 0o700 });
      environment.CODEX_HOME = isolatedCodexHome;
      await writeFile(
        path.join(isolatedCodexHome, "config.toml"),
        `default_permissions = "pilot-read"
web_search = "disabled"

[permissions.pilot-read.filesystem]
":root" = "deny"
":minimal" = "read"
":tmpdir" = "deny"
":slash_tmp" = "deny"
${renderCodexVerificationPermissions(path.dirname(verification.wrapper), verification.receiptPath, verification.scratchRoot)}
${renderCodexRuntimePermissions(verification.modelRuntimeReadPaths)}

[permissions.pilot-read.filesystem.":workspace_roots"]
"." = "read"

[permissions.pilot-read.network]
enabled = false

[permissions.pilot-edit.filesystem]
":root" = "deny"
":minimal" = "read"
":tmpdir" = "deny"
":slash_tmp" = "deny"
${renderCodexVerificationPermissions(path.dirname(verification.wrapper), verification.receiptPath, verification.scratchRoot)}
${renderCodexRuntimePermissions(verification.modelRuntimeReadPaths)}

[permissions.pilot-edit.filesystem.":workspace_roots"]
"." = "write"

[permissions.pilot-edit.network]
enabled = false
`,
        { encoding: "utf8", mode: 0o600, flag: "wx" },
      );
      if (
        await copyCredentialIfPresent(path.join(sourceHome, "auth.json"), isolatedAuthentication)
      ) {
        copiedAuthenticationFiles.push("codex/auth.json");
      }
    } else {
      const sourceConfig = process.env.CLAUDE_CONFIG_DIR ?? path.join(homedir(), ".claude");
      const isolatedClaudeConfig = path.join(syntheticHome, ".claude");
      authenticationRoot = isolatedClaudeConfig;
      credentialCandidates.push({
        path: path.join(isolatedClaudeConfig, ".credentials.json"),
        label: "claude/.credentials.json",
      });
      await mkdir(isolatedClaudeConfig, { recursive: true, mode: 0o700 });
      if (preregistration.harnesses.claude.authenticationMode === "router-key-environment") {
        routerAuthentication = await stageClaudeRouterAuthentication({
          hostEnvironment: process.env,
          targetEnvironment: environment,
          model: preregistration.harnesses.claude.model,
          routerBaseUrl: preregistration.harnesses.claude.routerBaseUrl,
          routeCatalogSha256: preregistration.harnesses.claude.routeCatalogSha256,
          claudeCliVersion: preregistration.harnesses.claude.cli,
        });
        stagedAuthenticationEnvironmentFields = routerAuthentication.stagedEnvironmentFields;
      } else if (await stageMinimalClaudeAuthentication(sourceConfig, isolatedClaudeConfig)) {
        copiedAuthenticationFiles.push("claude/.credentials.json");
      }
      environment.CLAUDE_CONFIG_DIR = isolatedClaudeConfig;
    }
  } catch (error) {
    for (const candidate of credentialCandidates) {
      if (
        !copiedAuthenticationFiles.includes(candidate.label) &&
        (await pathExists(candidate.path))
      ) {
        copiedAuthenticationFiles.push(candidate.label);
      }
    }
    const failedEnvironment = buildHarnessEnvironmentState(
      environment,
      authenticationRoot,
      harness,
      copiedAuthenticationFiles,
      stagedAuthenticationEnvironmentFields,
      routerAuthentication,
    );
    await cleanupHarnessAuthentication(failedEnvironment);
    throw new HarnessEnvironmentError(
      "isolated harness authentication staging failed",
      error,
      failedEnvironment,
    );
  }
  return buildHarnessEnvironmentState(
    environment,
    authenticationRoot,
    harness,
    copiedAuthenticationFiles,
    stagedAuthenticationEnvironmentFields,
    routerAuthentication,
  );
}

function buildHarnessEnvironmentState(
  environment,
  authenticationRoot,
  harness,
  copiedAuthenticationFiles,
  stagedAuthenticationEnvironmentFields,
  routerAuthentication,
) {
  return {
    env: environment,
    authenticationRoot,
    evidence: {
      syntheticHome: true,
      copiedAuthenticationFiles,
      authenticationFields:
        copiedAuthenticationFiles.length === 0 && stagedAuthenticationEnvironmentFields.length === 0
          ? []
          : routerAuthentication !== null
            ? ["router-api-key-environment"]
            : harness === "claude"
              ? ["claudeAiOauth"]
              : ["provider-required-file"],
      routerAuthentication,
      copiedGlobalInstructions: false,
      copiedProviderSessions: false,
      copiedProviderSettings: false,
      repositorySelectionEnvironmentForwarded: false,
      authentication: createAuthenticationEvidence(
        copiedAuthenticationFiles,
        stagedAuthenticationEnvironmentFields,
      ),
    },
  };
}

async function cleanupHarnessAuthentication(harnessEnvironment_) {
  const authentication = harnessEnvironment_?.evidence?.authentication;
  if (authentication === undefined || authentication.cleanupAttempted) {
    return authentication?.cleanupSucceeded !== false;
  }
  if (!authentication.ephemeralAuthenticationStaged) return true;
  let succeeded = false;
  let diagnostic = null;
  try {
    const environmentCleared = clearClaudeRouterAuthentication(harnessEnvironment_.env);
    if (harnessEnvironment_.authenticationRoot !== null) {
      await rm(harnessEnvironment_.authenticationRoot, {
        recursive: true,
        force: true,
      });
    }
    const rootCleared =
      harnessEnvironment_.authenticationRoot === null ||
      !(await pathExists(harnessEnvironment_.authenticationRoot));
    succeeded = environmentCleared && rootCleared;
    if (!environmentCleared) diagnostic = "authentication environment fields remain";
    else if (!rootCleared) diagnostic = "authentication path still exists after removal";
  } catch (error) {
    succeeded = false;
    diagnostic = error instanceof Error ? error.message : String(error);
  }
  recordAuthenticationCleanup(authentication, succeeded, diagnostic);
  return succeeded;
}

async function createSetupEnvironment(temporaryRoot, allowNetwork, cache) {
  const setupHome = path.join(temporaryRoot, "setup-home");
  const setupTmp = path.join(temporaryRoot, "setup-tmp");
  const npmUserConfig = path.join(setupHome, "user.npmrc");
  const npmGlobalConfig = path.join(setupHome, "global.npmrc");
  await mkdir(setupHome, { recursive: true, mode: 0o700 });
  await mkdir(setupTmp, { recursive: true, mode: 0o700 });
  await writeFile(npmUserConfig, "", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  await writeFile(npmGlobalConfig, "", {
    encoding: "utf8",
    mode: 0o600,
    flag: "wx",
  });
  return {
    HOME: setupHome,
    USER: "carrylog-pilot",
    LOGNAME: "carrylog-pilot",
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    SHELL: process.env.SHELL ?? "/bin/sh",
    TMPDIR: setupTmp,
    LANG: "C.UTF-8",
    LC_ALL: "C.UTF-8",
    NO_COLOR: "1",
    CI: "1",
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_COUNT: "4",
    GIT_CONFIG_KEY_0: "core.hooksPath",
    GIT_CONFIG_VALUE_0: "/dev/null",
    GIT_CONFIG_KEY_1: "commit.gpgsign",
    GIT_CONFIG_VALUE_1: "false",
    GIT_CONFIG_KEY_2: "core.autocrlf",
    GIT_CONFIG_VALUE_2: "false",
    GIT_CONFIG_KEY_3: "core.safecrlf",
    GIT_CONFIG_VALUE_3: "true",
    npm_config_userconfig: npmUserConfig,
    npm_config_globalconfig: npmGlobalConfig,
    npm_config_cache: cache.npm,
    npm_config_offline: allowNetwork ? "false" : "true",
    npm_config_audit: "false",
    npm_config_fund: "false",
    UV_CACHE_DIR: cache.uv,
    UV_OFFLINE: allowNetwork ? "0" : "1",
  };
}

async function stageMinimalClaudeAuthentication(sourceConfig, destinationConfig) {
  const sourcePath = path.join(sourceConfig, ".credentials.json");
  try {
    const credentials = JSON.parse(await readFile(sourcePath, "utf8"));
    assert.ok(
      credentials.claudeAiOauth && typeof credentials.claudeAiOauth === "object",
      "Claude OAuth credentials are unavailable",
    );
    const destination = path.join(destinationConfig, ".credentials.json");
    await writeFile(
      destination,
      `${JSON.stringify({ claudeAiOauth: credentials.claudeAiOauth }, null, 2)}\n`,
      { encoding: "utf8", mode: 0o600, flag: "wx" },
    );
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function copyCredentialIfPresent(source, destination) {
  try {
    await copyFile(source, destination);
    await chmod(destination, 0o600);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function buildExecutionEvidence(status, startedAt, started, result, receipts) {
  return {
    status,
    startedAt,
    completedAt: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - started),
    process: result?.process ?? null,
    visibleEvents: result?.visibleEvents ?? [],
    commandRecords: result?.commandRecords ?? [],
    verificationReceipts: receipts,
  };
}

async function readVerificationReceipts(receiptPath, verification_) {
  let rendered;
  try {
    rendered = await readFile(receiptPath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
  return rendered
    .split(/\r?\n/)
    .filter((line) => line !== "")
    .map((line) => {
      const receipt = JSON.parse(line);
      assert.equal(receipt.formatVersion, 2);
      assert.match(receipt.commandId, /^[a-z][a-z0-9-]+$/);
      assert.equal(receipt.executionMode, verification_.executionMode);
      assertReceiptBinding(receipt, verification_);
      assert.ok(Number.isInteger(receipt.exitStatus) || receipt.exitStatus === null);
      assert.equal(typeof receipt.timedOut, "boolean");
      assert.match(receipt.stdoutSha256, /^[0-9a-f]{64}$/);
      assert.match(receipt.stderrSha256, /^[0-9a-f]{64}$/);
      return receipt;
    });
}

async function readVerificationReceiptsForFailure(verification_) {
  try {
    return {
      receipts: await readVerificationReceipts(verification_.receiptPath, verification_),
      diagnostic: null,
    };
  } catch (error) {
    return {
      receipts: [],
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }
}

async function command(executable, arguments_, options = {}) {
  try {
    const result = await execFileAsync(executable, arguments_, {
      cwd: options.cwd,
      env: options.env ?? deterministicSetupEnvironment ?? process.env,
      encoding: "utf8",
      timeout: options.timeout ?? 120_000,
      maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
    });
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: 0,
      timedOut: false,
      signal: null,
      spawnError: null,
    };
  } catch (error) {
    if (options.allowExit && typeof error === "object" && error !== null && "code" in error) {
      const numericExit = typeof error.code === "number" ? error.code : null;
      const timedOut = error.killed === true || error.code === "ETIMEDOUT";
      return {
        stdout: typeof error.stdout === "string" ? error.stdout : "",
        stderr: typeof error.stderr === "string" ? error.stderr : "",
        exitCode: numericExit ?? 1,
        timedOut,
        signal: typeof error.signal === "string" ? error.signal : null,
        spawnError:
          numericExit === null && !timedOut ? String(error.code ?? "unknown-spawn-error") : null,
      };
    }
    throw error;
  }
}

async function commandWithClosedStdin(executable, arguments_, options = {}) {
  return await new Promise((resolve, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: options.cwd,
      env: options.env ?? deterministicSetupEnvironment ?? process.env,
      stdio: ["pipe", "pipe", "pipe"],
      shell: false,
    });
    child.stdin.end();
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let bufferExceeded = false;
    const maximum = options.maxBuffer ?? 10 * 1024 * 1024;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, options.timeout ?? 120_000);
    const collect = (chunks, isStdout) => (chunk) => {
      const bytes = Buffer.from(chunk);
      if (isStdout) stdoutBytes += bytes.length;
      else stderrBytes += bytes.length;
      if (stdoutBytes > maximum || stderrBytes > maximum) {
        bufferExceeded = true;
        child.kill("SIGTERM");
        return;
      }
      chunks.push(bytes);
    };
    child.stdout.on("data", collect(stdout, true));
    child.stderr.on("data", collect(stderr, false));
    child.once("error", (error) => {
      clearTimeout(timer);
      if (options.allowExit) {
        resolve({
          stdout: Buffer.concat(stdout).toString("utf8"),
          stderr: Buffer.concat(stderr).toString("utf8"),
          exitCode: 1,
          timedOut,
          signal: null,
          spawnError: String(error.code ?? error.message),
        });
      } else reject(error);
    });
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
        exitCode: code ?? 1,
        timedOut,
        signal,
        spawnError: bufferExceeded ? "max-buffer-exceeded" : null,
      };
      if (options.allowExit || (code === 0 && !timedOut && !bufferExceeded)) resolve(result);
      else reject(new Error(`${executable} exited ${code ?? signal}`));
    });
  });
}

async function git(gitState_, arguments_) {
  return (
    await command("git", arguments_, {
      cwd: gitState_.workTree,
      env: gitEnvironment(gitState_, deterministicSetupEnvironment),
    })
  ).stdout.trim();
}

function gitEnvironment(gitState_, base = process.env) {
  return {
    ...base,
    GIT_DIR: gitState_.directory,
    GIT_WORK_TREE: gitState_.workTree,
    GIT_OPTIONAL_LOCKS: "0",
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJsonAtomicExclusive(filePath, value) {
  await assertAbsent(filePath, `refusing to replace existing artifact: ${filePath}`);
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  const temporaryPath = `${filePath}.tmp-${process.pid}-${atomicSequence++}`;
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(rendered, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, filePath);
    const directory = await open(path.dirname(filePath), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  } catch (error) {
    if (handle !== undefined) await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

async function buildBundleManifest(filePaths) {
  const rawRoot = path.join(tierRoot, "raw-quarantine");
  const files = [];
  for (const filePath of filePaths) {
    const bytes = await readFile(filePath);
    const relativePath = path.relative(rawRoot, filePath).split(path.sep).join("/");
    assert.equal(relativePath.startsWith("../"), false);
    files.push({
      path: relativePath,
      bytes: bytes.length,
      sha256: sha256(bytes),
    });
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return {
    formatVersion: 1,
    files,
    bundleSha256: sha256(
      files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""),
    ),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function assertAbsent(
  filePath,
  message = `refusing to overwrite existing path: ${filePath}`,
) {
  try {
    await access(filePath);
  } catch {
    return;
  }
  throw new Error(message);
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function digestDirectory(directory) {
  const records = [];
  async function visit(current, relative) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const child = path.join(current, entry.name);
      const childRelative = relative === "" ? entry.name : `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(child, childRelative);
      else if (entry.isFile()) records.push(`${childRelative}\0${sha256(await readFile(child))}\n`);
      else throw new Error(`unsupported Git metadata entry: ${childRelative}`);
    }
  }
  await visit(directory, "");
  return sha256(records.join(""));
}

async function observeGitIntegrity(gitState_, checkout_, expectedDigest) {
  if (gitState_ === undefined || checkout_ === undefined || expectedDigest === undefined)
    return null;
  try {
    const currentDigest = await digestDirectory(gitState_.directory);
    return {
      checkoutDotGitAbsent: !(await pathExists(path.join(checkout_, ".git"))),
      directorySha256BeforeModel: expectedDigest,
      directorySha256Observed: currentDigest,
      unchanged: currentDigest === expectedDigest,
    };
  } catch (error) {
    return {
      checkoutDotGitAbsent: !(await pathExists(path.join(checkout_, ".git"))),
      directorySha256BeforeModel: expectedDigest,
      directorySha256Observed: null,
      unchanged: false,
      diagnostic: error instanceof Error ? error.message : String(error),
    };
  }
}
