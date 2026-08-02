import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
  assertReviewAttestations,
  buildManifest,
  buildReviewDigest,
  checkFreezeManifest,
  prepareReviewCandidate,
  readFrozenRegularFile,
  runFreezePreflight,
  verifyCommittedFreeze,
  writeFreezeManifest,
} from "../freeze.mjs";
import {
  refreshHarnessPrerequisites,
  validateHarnessPrerequisites,
} from "../harness-prerequisites.mjs";

const tierRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const execFileAsync = promisify(execFile);

test("verification registry exactly matches normalized task commands", async () => {
  const { assertVerificationRegistry } = await import("../validate.mjs");
  const tasks = [task("fixture-a", ["git rev-parse HEAD", "cd backend && uv run pytest"])];
  const valid = {
    formatVersion: 1,
    fixtures: {
      "fixture-a": [
        command("head", ".", "git", ["rev-parse", "HEAD"]),
        command("tests", "backend", "uv", ["run", "pytest"]),
      ],
    },
  };
  assert.doesNotThrow(() => assertVerificationRegistry(tasks, valid));
  assert.throws(
    () =>
      assertVerificationRegistry(tasks, {
        ...valid,
        fixtures: {
          "fixture-a": [command("head", ".", "git", ["log", "-1", "--oneline"])],
        },
      }),
    /must exactly match requiredCommands/,
  );
  assert.throws(
    () =>
      assertVerificationRegistry(tasks, {
        ...valid,
        fixtures: { ...valid.fixtures, undeclared: [] },
      }),
    /fixture keys must exactly match task fixtures/,
  );
  assert.throws(
    () =>
      assertVerificationRegistry(tasks, {
        ...valid,
        fixtures: {
          "fixture-a": [
            command("head", ".", "git", ["rev-parse", "HEAD"]),
            command("tests", "../outside", "uv", ["run", "pytest"]),
          ],
        },
      }),
    /cwd must stay within the fixture checkout/,
  );
});

test("exclusions are codebook-bound retained failures without replacements", async () => {
  const { assertExclusions } = await import("../validate.mjs");
  const runs = [{ runId: "t1-001", blindId: "b-0123456789ab" }];
  const codebook = {
    stages: ["carrylog-delivery", "harness-execution"],
    reasonCodes: ["strict-resume-failure", "provider-timeout"],
    reasonStageCompatibility: {
      "strict-resume-failure": ["carrylog-delivery"],
      "provider-timeout": ["harness-execution"],
    },
    productFeasibilityRule:
      "A strict Carrylog resume failure remains a Carrylog delivery outcome and is retained.",
  };
  const valid = exclusion({});
  assert.doesNotThrow(() => assertExclusions([valid], runs, codebook));
  assert.throws(
    () => assertExclusions([exclusion({ stage: "harness-execution" })], runs, codebook),
    /incompatible with its stage/,
  );
  assert.throws(
    () =>
      assertExclusions(
        [exclusion({ retained_artifact_path: "raw-reviewed/by-run/other" })],
        runs,
        codebook,
      ),
    /retained path differs/,
  );
  assert.throws(
    () => assertExclusions([exclusion({ replacement_run_id: "t1-061" })], runs, codebook),
    /replacements are forbidden/,
  );
  assert.throws(
    () =>
      assertExclusions([valid], runs, {
        ...codebook,
        reasonStageCompatibility: {
          ...codebook.reasonStageCompatibility,
          "strict-resume-failure": ["harness-execution"],
        },
      }),
    /must remain a Carrylog delivery outcome/,
  );
});

test("freeze includes policy markers, excludes results, and is write-once", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-freeze-contract-"));
  const root = path.join(parent, "tier1");
  try {
    await mkdir(path.join(root, "evaluations"), { recursive: true });
    await mkdir(path.join(root, "raw-quarantine", "by-run", "t1-001"), {
      recursive: true,
    });
    await mkdir(path.join(root, "raw-reviewed"), { recursive: true });
    await writeFile(path.join(parent, "tier1-pilot-protocol.md"), "# Governing protocol\n");
    await cp(
      path.join(tierRoot, "analysis-dependencies.json"),
      path.join(root, "analysis-dependencies.json"),
    );
    await writeFile(path.join(root, "preregistration.json"), '{"status":"frozen"}\n');
    await writeFile(path.join(root, "report-template.md"), "# Frozen report template\n");
    await writeFile(path.join(root, "report.md"), "# Observed report\n");
    await writeFile(path.join(root, "harness-prerequisites.json"), "{}\n");
    await writeFile(path.join(root, "scores.csv"), "header\n");
    await writeFile(path.join(root, "exclusions.csv"), "header\n");
    await writeFile(path.join(root, "evaluations", ".gitkeep"), "");
    await writeFile(path.join(root, "evaluations", "observed.json"), "{}\n");
    await writeFile(path.join(root, "raw-quarantine", ".gitignore"), "*\n!.gitignore\n!.gitkeep\n");
    await writeFile(path.join(root, "raw-quarantine", ".gitkeep"), "");
    await writeFile(path.join(root, "raw-quarantine", "by-run", "t1-001", "claim.json"), "{}\n");
    await writeFile(path.join(root, "raw-reviewed", ".gitkeep"), "");
    await writeFile(
      path.join(root, "review-attestations.json"),
      '{"formatVersion":1,"reviewDigest":null,"reviews":[]}\n',
    );

    const manifest = await buildManifest(root);
    const paths = manifest.files.map((file) => file.path);
    assert.ok(paths.includes("../tier1-pilot-protocol.md"));
    assert.ok(paths.includes("analysis-dependencies.json"));
    assert.ok(paths.includes("evaluations/.gitkeep"));
    assert.ok(paths.includes("harness-prerequisites.json"));
    assert.ok(paths.includes("raw-quarantine/.gitignore"));
    assert.ok(paths.includes("raw-quarantine/.gitkeep"));
    assert.ok(paths.includes("raw-reviewed/.gitkeep"));
    assert.ok(paths.includes("review-attestations.json"));
    assert.equal(paths.includes("evaluations/observed.json"), false);
    assert.equal(
      paths.some((entry) => entry.startsWith("raw-quarantine/by-run/")),
      false,
    );
    assert.equal(paths.includes("report.md"), false);
    assert.equal(paths.includes("scores.csv"), false);
    assert.equal(paths.includes("exclusions.csv"), false);

    await rm(path.join(root, "raw-reviewed", ".gitkeep"));
    await assert.rejects(buildManifest(root), /required frozen policy surface is missing/);
    await writeFile(path.join(root, "raw-reviewed", ".gitkeep"), "");

    await assert.rejects(writeFreezeManifest(root), /observed result prevents freeze/);
    await rm(path.join(root, "evaluations", "observed.json"));
    await rm(path.join(root, "raw-quarantine", "by-run"), { recursive: true });
    const review = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(review.reviewDigest), null, 2)}\n`,
    );
    const written = await writeFreezeManifest(root, {
      preflight: async () => {},
    });
    assert.equal(written.suiteSha256, (await buildManifest(root)).suiteSha256);
    await assert.rejects(
      writeFreezeManifest(root, { preflight: async () => {} }),
      /freeze manifest already exists; use a new experiment for amendments/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("review digest excludes its attestations while the frozen suite includes them", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-review-digest-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    const before = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(before.reviewDigest), null, 2)}\n`,
    );
    const after = await buildReviewDigest(root);
    assert.deepEqual(after, before);
    assert.ok(
      (await buildManifest(root)).files.some((file) => file.path === "review-attestations.json"),
    );
    await assertReviewAttestations(root, before.reviewDigest);
    const invalid = attestations(before.reviewDigest);
    invalid.reviews[1].reviewDigest = "0".repeat(64);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(invalid, null, 2)}\n`,
    );
    await assert.rejects(assertReviewAttestations(root, before.reviewDigest), /digest differs/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("freeze write rejects reviewed-surface mutation after the review gate", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-freeze-gate-race-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    const review = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(review.reviewDigest), null, 2)}\n`,
    );
    await assert.rejects(
      writeFreezeManifest(root, {
        preflight: async () => {},
        reviewGate: async (candidateRoot, expectedDigest) => {
          await assertReviewAttestations(candidateRoot, expectedDigest);
          await writeFile(path.join(candidateRoot, "report-template.md"), "# Mutated after GO\n");
        },
      }),
      /changed after the review gate/,
    );
    await assert.rejects(readFile(path.join(root, "freeze-manifest.json")), /ENOENT/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("freeze write rejects mutation during manifest capture without leaving a manifest", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-freeze-capture-race-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    const review = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(review.reviewDigest), null, 2)}\n`,
    );
    await assert.rejects(
      writeFreezeManifest(root, {
        preflight: async () => {},
        captureManifest: async (candidateRoot) => {
          const manifest = await buildManifest(candidateRoot);
          await writeFile(path.join(candidateRoot, "report-template.md"), "# Mutated in capture\n");
          return manifest;
        },
      }),
      /changed while capturing the manifest/,
    );
    await assert.rejects(readFile(path.join(root, "freeze-manifest.json")), /ENOENT/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("freeze write rejects post-write manifest replacement and removes the corrupt file", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-freeze-manifest-race-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    const review = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(review.reviewDigest), null, 2)}\n`,
    );
    await assert.rejects(
      writeFreezeManifest(root, {
        preflight: async () => {},
        afterWrite: async (manifestPath) => {
          await writeFile(manifestPath, '{"corrupt":true}\n');
        },
      }),
      /written freeze manifest differs/,
    );
    await assert.rejects(readFile(path.join(root, "freeze-manifest.json")), /ENOENT/);
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("freeze check revalidates current review attestations", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-freeze-check-review-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    const review = await buildReviewDigest(root);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(attestations(review.reviewDigest), null, 2)}\n`,
    );
    const manifest = await buildManifest(root);
    await writeFile(
      path.join(root, "freeze-manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const checked = await checkFreezeManifest(root, {
      preflight: async () => {},
      verifyCommit: async () => "a".repeat(40),
    });
    assert.equal(checked.freezeCommit, "a".repeat(40));

    const stale = attestations(review.reviewDigest);
    stale.reviewDigest = "f".repeat(64);
    await writeFile(
      path.join(root, "review-attestations.json"),
      `${JSON.stringify(stale, null, 2)}\n`,
    );
    await assert.rejects(
      checkFreezeManifest(root, {
        preflight: async () => {},
        verifyCommit: async () => "a".repeat(40),
      }),
      /review digest differs/,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("review digest requires a frozen candidate before either GO attestation", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-review-candidate-"));
  const root = path.join(parent, "tier1");
  try {
    await materializeFreezeInputs(parent, root);
    await writeFile(
      path.join(root, "preregistration.json"),
      '{"status":"draft-until-committed"}\n',
    );
    await assert.rejects(
      prepareReviewCandidate(root, { preflight: async () => {} }),
      /status=frozen before producing the review digest/,
    );
    await writeFile(path.join(root, "preregistration.json"), '{"status":"frozen"}\n');
    const review = await prepareReviewCandidate(root, {
      preflight: async () => {},
    });
    assert.match(review.reviewDigest, /^[0-9a-f]{64}$/);
    assert.equal(
      review.files.some((file) => file.path === "review-attestations.json"),
      false,
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("harness prerequisites bind passed attestations to current critical bytes", async () => {
  const parent = await mkdtemp(path.join(tmpdir(), "carrylog-harness-prerequisite-"));
  const root = path.join(parent, "tier1");
  try {
    await cp(tierRoot, root, { recursive: true });
    await rm(path.join(root, "harness-prerequisites.json"));
    const pending = await refreshHarnessPrerequisites(root);
    await validateHarnessPrerequisites(root);
    assert.equal(pending.harnesses.codex.status, "pending");
    assert.equal(pending.harnesses.claude.status, "pending");
    assert.equal(
      pending.criticalFiles.some((file) => file.path === "harness-prerequisites.json"),
      false,
      "the prerequisite file must not hash itself",
    );
    await assert.rejects(
      validateHarnessPrerequisites(root, { requirePassed: true }),
      /codex authenticated harness prerequisite is pending/,
    );

    const preregistration = JSON.parse(
      await readFile(path.join(root, "preregistration.json"), "utf8"),
    );
    const passed = structuredClone(pending);
    for (const harness of ["codex", "claude"]) {
      passed.harnesses[harness] = {
        status: "passed",
        testedAt: "2026-07-13T00:00:00Z",
        cliVersion: preregistration.harnesses[harness].cli,
        model: preregistration.harnesses[harness].model,
        resultSummary:
          "Authenticated canary passed workspace access, external-filesystem denial, registered verification, and model-tool network-denial assertions.",
        resultSha256: "a".repeat(64),
      };
    }
    await writeFile(
      path.join(root, "harness-prerequisites.json"),
      `${JSON.stringify(passed, null, 2)}\n`,
    );
    await validateHarnessPrerequisites(root, { requirePassed: true });

    passed.harnesses.codex.cliVersion = "invented-version";
    await writeFile(
      path.join(root, "harness-prerequisites.json"),
      `${JSON.stringify(passed, null, 2)}\n`,
    );
    await assert.rejects(
      validateHarnessPrerequisites(root, { requirePassed: true }),
      /invented-version/,
    );

    passed.harnesses.codex.cliVersion = preregistration.harnesses.codex.cli;
    await writeFile(
      path.join(root, "harness-prerequisites.json"),
      `${JSON.stringify(passed, null, 2)}\n`,
    );
    const criticalPath = path.join(root, "analysis", "run-contract.mjs");
    await writeFile(criticalPath, `${await readFile(criticalPath, "utf8")}\n`);
    await assert.rejects(
      validateHarnessPrerequisites(root),
      /harness-critical digest differs: analysis\/run-contract\.mjs/,
    );
    const refreshed = await refreshHarnessPrerequisites(root);
    assert.equal(refreshed.harnesses.codex.status, "pending");
    assert.equal(refreshed.harnesses.claude.status, "pending");
    await validateHarnessPrerequisites(root);

    refreshed.harnesses.codex.rawOutput = "forbidden retained transcript";
    await writeFile(
      path.join(root, "harness-prerequisites.json"),
      `${JSON.stringify(refreshed, null, 2)}\n`,
    );
    await assert.rejects(validateHarnessPrerequisites(root));
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test("freeze preflight invokes dependency, structural, order, and blind-bundle checks", async () => {
  const invocations = [];
  let dependencyRoot;
  await runFreezePreflight(
    "/synthetic/tier1",
    async (executable, arguments_, options) => {
      invocations.push({ executable, arguments_, options });
      return { stdout: "", stderr: "" };
    },
    async (root) => {
      dependencyRoot = root;
    },
  );
  assert.equal(dependencyRoot, "/synthetic/tier1");
  assert.equal(invocations.length, 4);
  assert.deepEqual(
    invocations.map(({ arguments_ }) => arguments_.slice(1)),
    [
      ["--root", "/synthetic/tier1"],
      ["--check", "--root", "/synthetic/tier1"],
      ["--check", "--root", "/synthetic/tier1"],
      ["--require-passed", "--root", "/synthetic/tier1"],
    ],
  );
  assert.match(invocations[0].arguments_[0], /validate\.mjs$/);
  assert.match(invocations[1].arguments_[0], /generate-order\.mjs$/);
  assert.match(invocations[2].arguments_[0], /evaluation-bundles\.mjs$/);
  assert.match(invocations[3].arguments_[0], /harness-prerequisites\.mjs$/);
  await assert.rejects(
    runFreezePreflight(
      "/synthetic/tier1",
      async (_executable, arguments_) => {
        if (arguments_[0].endsWith("generate-order.mjs")) throw new Error("order drift");
        return { stdout: "", stderr: "" };
      },
      async () => {},
    ),
    /order drift/,
  );
});

test("condition positions are balanced within harness and harness-repository strata", async () => {
  const order = JSON.parse(await readFile(path.join(tierRoot, "run-order.json"), "utf8"));
  const tasks = new Map();
  for (const run of order.runs) {
    if (tasks.has(run.fixtureId)) continue;
    const task = JSON.parse(
      await readFile(path.join(tierRoot, "tasks", `${run.fixtureId}.json`), "utf8"),
    );
    tasks.set(run.fixtureId, task.repository.id.replace(/^r\d+-/, ""));
  }
  const groups = new Map();
  for (let index = 0; index < order.runs.length; index += 3) {
    const block = order.runs.slice(index, index + 3);
    const { fixtureId, harness } = block[0];
    for (const group of [harness, `${harness}|${tasks.get(fixtureId)}`]) {
      if (!groups.has(group)) groups.set(group, new Map());
      block.forEach((run, position) => {
        if (!groups.get(group).has(run.condition)) groups.get(group).set(run.condition, [0, 0, 0]);
        groups.get(group).get(run.condition)[position] += 1;
      });
    }
  }
  for (const [group, conditions] of groups) {
    for (const [condition, counts] of conditions) {
      assert.ok(
        Math.max(...counts) - Math.min(...counts) <= 1,
        `${group}|${condition} is imbalanced: ${counts.join("/")}`,
      );
    }
  }
});

test("objective verification uses the frozen source ref and task bytes bind blind bundles", async () => {
  const order = JSON.parse(await readFile(path.join(tierRoot, "run-order.json"), "utf8"));
  const registry = JSON.parse(
    await readFile(path.join(tierRoot, "verification-commands.json"), "utf8"),
  );
  for (const fixtureId of ["r1-carrylog-01-objective", "r2-busycafe-01-objective"]) {
    const taskBytes = await readFile(path.join(tierRoot, "tasks", `${fixtureId}.json`));
    const task = JSON.parse(taskBytes);
    assert.ok(
      task.expectedVerification.requiredCommands.includes(
        "git rev-parse refs/carrylog-pilot/source",
      ),
    );
    assert.equal(task.expectedVerification.requiredCommands.includes("git rev-parse HEAD"), false);
    assert.deepEqual(registry.fixtures[fixtureId][0].arguments, [
      "rev-parse",
      "refs/carrylog-pilot/source",
    ]);
    const promptBytes = await readFile(path.resolve(tierRoot, "../../..", task.prompt.path));
    const packetBytes = await readFile(
      path.resolve(tierRoot, "../../..", task.deliveryPacket.path),
    );
    assert.equal(task.prompt.sha256, sha256(promptBytes));
    assert.equal(task.deliveryPacket.sha256, sha256(packetBytes));
    for (const run of order.runs.filter((candidate) => candidate.fixtureId === fixtureId)) {
      const bundle = JSON.parse(
        await readFile(path.join(tierRoot, "evaluation-bundles", `${run.blindId}.json`), "utf8"),
      );
      assert.equal(bundle.taskFixtureSha256, sha256(taskBytes));
    }
  }
  const bounded = JSON.parse(
    await readFile(
      path.join(tierRoot, "tasks", "r1-carrylog-02-bounded-continuation.json"),
      "utf8",
    ),
  );
  const fact = bounded.relevantFacts.find((candidate) => candidate.id === "f1");
  assert.equal(fact.origin, "prompt");
  assert.equal(fact.continuityEligible, false);
});

test("committed freeze uses one permanent first-ADD boundary", async (context) => {
  await context.test("accepts an untouched first ADD commit", async () => {
    const repository = await createCommittedFreezeRepository();
    try {
      assert.match(
        await verifyCommittedFreeze(repository.manifest, repository.locations),
        /^[0-9a-f]{40}$/,
      );
    } finally {
      await rm(repository.root, { recursive: true, force: true });
    }
  });

  for (const mutation of ["manifest-mutation", "input-mutation", "delete-readd"]) {
    await context.test(`rejects ${mutation}`, async () => {
      const repository = await createCommittedFreezeRepository(mutation);
      try {
        await assert.rejects(
          verifyCommittedFreeze(repository.manifest, repository.locations),
          /permanent ADD boundary|changed after the permanent ADD boundary/,
        );
      } finally {
        await rm(repository.root, { recursive: true, force: true });
      }
    });
  }
});

test("governing protocol must be a regular non-symlink file", async () => {
  const bytes = Buffer.from("# Governing protocol\n");
  const regularFileSystem = {
    lstat: async () => ({ isSymbolicLink: () => false, isFile: () => true }),
    readFile: async () => bytes,
  };
  assert.equal(
    await readFrozenRegularFile("ignored", "../tier1-pilot-protocol.md", regularFileSystem),
    bytes,
  );
  await assert.rejects(
    readFrozenRegularFile("ignored", "../tier1-pilot-protocol.md", {
      ...regularFileSystem,
      lstat: async () => ({ isSymbolicLink: () => true, isFile: () => true }),
    }),
    /freeze input cannot be a symlink: \.\.\/tier1-pilot-protocol\.md/,
  );
  await assert.rejects(
    readFrozenRegularFile("ignored", "../tier1-pilot-protocol.md", {
      ...regularFileSystem,
      lstat: async () => ({ isSymbolicLink: () => false, isFile: () => false }),
    }),
    /freeze input must be a regular file: \.\.\/tier1-pilot-protocol\.md/,
  );
});

test("report preserves every frozen template section and current artifact terminology", async () => {
  const template = await readFile(path.join(tierRoot, "report-template.md"), "utf8");
  const report = await readFile(path.join(tierRoot, "report.md"), "utf8");
  const requiredSections = [...template.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  const reportSections = [...report.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  assert.deepEqual(reportSections, requiredSections);
  assert.match(report, /raw-quarantine\//);
  assert.match(report, /raw-reviewed\//);
  assert.doesNotMatch(report, /raw-sanitized\//);
});

function task(fixtureId, requiredCommands) {
  return { fixtureId, expectedVerification: { requiredCommands } };
}

function command(id, cwd, executable, arguments_) {
  return { id, cwd, executable, arguments: arguments_ };
}

function exclusion(overrides) {
  return {
    run_id: "t1-001",
    blind_id: "b-0123456789ab",
    stage: "carrylog-delivery",
    reason_code: "strict-resume-failure",
    retained_artifact_path: "raw-reviewed/by-run/t1-001",
    replacement_run_id: "",
    ...overrides,
  };
}

function attestations(reviewDigest) {
  return {
    formatVersion: 1,
    reviewDigest,
    reviews: ["reviewer-alpha", "reviewer-beta"].map((reviewerId) => ({
      reviewerId,
      independenceStatement: "I reviewed these exact bytes independently of the implementation.",
      verdict: "GO",
      reviewedAt: "2026-07-12T00:00:00Z",
      reviewDigest,
      findings: [],
    })),
  };
}

async function materializeFreezeInputs(parent, root) {
  await mkdir(path.join(root, "evaluations"), { recursive: true });
  await mkdir(path.join(root, "raw-quarantine"), { recursive: true });
  await mkdir(path.join(root, "raw-reviewed"), { recursive: true });
  await writeFile(path.join(parent, "tier1-pilot-protocol.md"), "# Governing protocol\n");
  await cp(
    path.join(tierRoot, "analysis-dependencies.json"),
    path.join(root, "analysis-dependencies.json"),
  );
  await writeFile(path.join(root, "preregistration.json"), '{"status":"frozen"}\n');
  await writeFile(path.join(root, "evaluations", ".gitkeep"), "");
  await writeFile(path.join(root, "raw-quarantine", ".gitignore"), "*\n!.gitignore\n!.gitkeep\n");
  await writeFile(path.join(root, "raw-quarantine", ".gitkeep"), "");
  await writeFile(path.join(root, "raw-reviewed", ".gitkeep"), "");
  await writeFile(path.join(root, "harness-prerequisites.json"), "{}\n");
  await writeFile(path.join(root, "scores.csv"), "header\n");
  await writeFile(path.join(root, "exclusions.csv"), "header\n");
  await writeFile(
    path.join(root, "review-attestations.json"),
    '{"formatVersion":1,"reviewDigest":null,"reviews":[]}\n',
  );
}

async function createCommittedFreezeRepository(mutation) {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-committed-freeze-"));
  const tierDirectory = path.join(root, "research", "continuity", "tier1");
  await mkdir(tierDirectory, { recursive: true });
  const inputPath = path.join(tierDirectory, "input.txt");
  const manifestPath = path.join(tierDirectory, "freeze-manifest.json");
  await writeFile(inputPath, "frozen input\n");
  const inputBytes = await readFile(inputPath);
  const manifest = {
    formatVersion: 1,
    protocolVersion: 1,
    suiteSha256: sha256(inputBytes),
    files: [
      {
        path: "input.txt",
        bytes: inputBytes.length,
        sha256: sha256(inputBytes),
      },
    ],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await git(root, ["init", "-q"]);
  await git(root, ["config", "user.name", "Carrylog Test"]);
  await git(root, ["config", "user.email", "carrylog-test@example.invalid"]);
  await git(root, ["add", "."]);
  await git(root, ["commit", "-q", "-m", "freeze"]);

  if (mutation === "manifest-mutation") {
    const mutated = { ...manifest, suiteSha256: "f".repeat(64) };
    await writeFile(manifestPath, `${JSON.stringify(mutated, null, 2)}\n`);
    await git(root, ["add", "research/continuity/tier1/freeze-manifest.json"]);
    await git(root, ["commit", "-q", "-m", "mutate manifest"]);
    Object.assign(manifest, mutated);
  } else if (mutation === "input-mutation") {
    await writeFile(inputPath, "mutated input\n");
    await git(root, ["add", "research/continuity/tier1/input.txt"]);
    await git(root, ["commit", "-q", "-m", "mutate input"]);
  } else if (mutation === "delete-readd") {
    await rm(manifestPath);
    await git(root, ["add", "-A"]);
    await git(root, ["commit", "-q", "-m", "delete manifest"]);
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    await git(root, ["add", "research/continuity/tier1/freeze-manifest.json"]);
    await git(root, ["commit", "-q", "-m", "readd manifest"]);
  }
  return {
    root,
    manifest,
    locations: { tierDirectory, repositoryDirectory: root },
  };
}

async function git(cwd, arguments_) {
  return execFileAsync("git", arguments_, { cwd, encoding: "utf8" });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
