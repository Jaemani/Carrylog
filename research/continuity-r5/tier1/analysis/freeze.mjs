import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { validateAnalysisDependencies } from "./analysis-dependencies.mjs";

const tierRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectRoot = path.resolve(tierRoot, "../../..");
const execFileAsync = promisify(execFile);
const excludedTopLevel = new Set([
  "exclusions.csv",
  "freeze-manifest.json",
  "report.md",
  "scores.csv",
]);
const requiredPolicyPaths = [
  "analysis-dependencies.json",
  "evaluations/.gitkeep",
  "harness-prerequisites.json",
  "raw-quarantine/.gitignore",
  "raw-quarantine/.gitkeep",
  "raw-reviewed/.gitkeep",
  "review-attestations.json",
];
const reviewAttestationsName = "review-attestations.json";

export async function buildManifest(root = tierRoot) {
  const files = await buildFrozenFileList(root);
  return manifestForFiles(files);
}

export async function buildReviewDigest(root = tierRoot) {
  const files = (await buildFrozenFileList(root)).filter(
    (file) => file.path !== reviewAttestationsName,
  );
  return reviewForFiles(files);
}

function reviewForFiles(files) {
  return {
    formatVersion: 1,
    reviewDigest: digest(
      files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""),
    ),
    files,
  };
}

async function buildFrozenFileList(root) {
  await validateAnalysisDependencies(root);
  const files = [];
  await visit(root, "", files);
  for (const requiredPath of requiredPolicyPaths) {
    assert.ok(
      files.some((file) => file.path === requiredPath),
      `required frozen policy surface is missing: ${requiredPath}`,
    );
  }
  const protocolBytes = await readFrozenRegularFile(
    path.resolve(root, "../tier1-pilot-protocol.md"),
    "../tier1-pilot-protocol.md",
  );
  files.push({
    path: "../tier1-pilot-protocol.md",
    bytes: protocolBytes.length,
    sha256: digest(protocolBytes),
  });
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

function manifestForFiles(files) {
  const suiteSha256 = digest(
    files.map((file) => `${file.path}\0${file.bytes}\0${file.sha256}\n`).join(""),
  );
  return { formatVersion: 1, protocolVersion: 1, suiteSha256, files };
}

export async function readFrozenRegularFile(
  filePath,
  manifestPath,
  fileSystem = { lstat, readFile },
) {
  const metadata = await fileSystem.lstat(filePath);
  assert.equal(
    metadata.isSymbolicLink(),
    false,
    `freeze input cannot be a symlink: ${manifestPath}`,
  );
  assert.equal(metadata.isFile(), true, `freeze input must be a regular file: ${manifestPath}`);
  return fileSystem.readFile(filePath);
}

export async function verifyCommittedFreeze(
  manifest,
  { tierDirectory = tierRoot, repositoryDirectory = projectRoot } = {},
) {
  const manifestPath = path.join(tierDirectory, "freeze-manifest.json");
  const relativeManifest = repositoryRelativePath(manifestPath, repositoryDirectory);
  const frozenPaths = [
    relativeManifest,
    ...manifest.files.map((file) =>
      repositoryRelativePath(path.resolve(tierDirectory, file.path), repositoryDirectory),
    ),
  ];
  await git(["ls-files", "--error-unmatch", "--", ...frozenPaths], repositoryDirectory);
  const dirty = await gitAllowExit(
    ["diff", "--quiet", "HEAD", "--", ...frozenPaths],
    repositoryDirectory,
  );
  assert.equal(dirty.exitCode, 0, "frozen inputs or manifest differ from HEAD");
  const addCommits = (
    await git(
      ["log", "--diff-filter=A", "--format=%H", "--reverse", "--", relativeManifest],
      repositoryDirectory,
    )
  )
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  assert.equal(
    addCommits.length,
    1,
    "freeze manifest must have exactly one permanent ADD boundary",
  );
  const [freezeCommit] = addCommits;
  assert.match(freezeCommit, /^[0-9a-f]{40}$/, "freeze manifest has no committed ADD boundary");
  const isAncestor = await gitAllowExit(
    ["merge-base", "--is-ancestor", freezeCommit, "HEAD"],
    repositoryDirectory,
  );
  assert.equal(isAncestor.exitCode, 0, "freeze boundary is not an ancestor of HEAD");
  const postBoundaryMutations = (
    await git(["rev-list", `${freezeCommit}..HEAD`, "--", ...frozenPaths], repositoryDirectory)
  ).trim();
  assert.equal(
    postBoundaryMutations,
    "",
    "freeze manifest or frozen input changed after the permanent ADD boundary",
  );
  const committedManifest = await git(
    ["show", `${freezeCommit}:${relativeManifest}`],
    repositoryDirectory,
  );
  assert.equal(
    committedManifest,
    await readFile(manifestPath, "utf8"),
    "freeze manifest changed after its boundary commit",
  );
  for (const file of manifest.files) {
    const frozenPath = repositoryRelativePath(
      path.resolve(tierDirectory, file.path),
      repositoryDirectory,
    );
    const committed = await gitBuffer(
      ["show", `${freezeCommit}:${frozenPath}`],
      repositoryDirectory,
    );
    assert.equal(committed.length, file.bytes, `frozen byte count differs at ${frozenPath}`);
    assert.equal(digest(committed), file.sha256, `frozen digest differs at ${frozenPath}`);
  }
  return freezeCommit;
}

function repositoryRelativePath(absolutePath, repositoryDirectory) {
  const relativePath = path.relative(repositoryDirectory, absolutePath).split(path.sep).join("/");
  assert.ok(
    relativePath !== "" && relativePath !== ".." && !relativePath.startsWith("../"),
    `frozen path escapes repository: ${absolutePath}`,
  );
  return relativePath;
}

async function visit(directory, relativeDirectory, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (relativeDirectory === "" && excludedTopLevel.has(entry.name)) continue;
    if (
      ["evaluations", "raw-quarantine", "raw-reviewed"].includes(relativeDirectory) &&
      !entry.name.startsWith(".git")
    ) {
      continue;
    }
    const absolutePath = path.join(directory, entry.name);
    const metadata = await lstat(absolutePath);
    assert.equal(
      metadata.isSymbolicLink(),
      false,
      `freeze input cannot be a symlink: ${relativePath}`,
    );
    if (metadata.isDirectory()) await visit(absolutePath, relativePath, files);
    else if (metadata.isFile()) {
      const bytes = await readFile(absolutePath);
      files.push({
        path: relativePath,
        bytes: bytes.length,
        sha256: digest(bytes),
      });
    } else {
      throw new Error(`unsupported freeze input: ${relativePath}`);
    }
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const mode = process.argv[2];
  if (mode === "--write") {
    const manifest = await writeFreezeManifest();
    process.stdout.write(`Wrote freeze manifest ${manifest.suiteSha256}.\n`);
  } else if (mode === "--check") {
    const { manifest, freezeCommit } = await checkFreezeManifest(tierRoot);
    process.stdout.write(
      `${JSON.stringify({ suiteSha256: manifest.suiteSha256, freezeCommit })}\n`,
    );
  } else if (mode === "--review-digest") {
    process.stdout.write(`${JSON.stringify(await prepareReviewCandidate(tierRoot), null, 2)}\n`);
  } else {
    throw new Error("Usage: node analysis/freeze.mjs --review-digest|--write|--check");
  }
}

export async function checkFreezeManifest(
  root = tierRoot,
  {
    preflight = runFreezePreflight,
    verifyCommit = (manifest) =>
      verifyCommittedFreeze(manifest, {
        tierDirectory: root,
        repositoryDirectory: path.resolve(root, "../../.."),
      }),
  } = {},
) {
  await preflight(root);
  const review = await buildReviewDigest(root);
  await assertReviewAttestations(root, review.reviewDigest);
  const manifest = await buildManifest(root);
  assertManifestMatchesReview(manifest, review);
  const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
  const frozen = JSON.parse(await readFile(path.join(root, "freeze-manifest.json"), "utf8"));
  assert.equal(`${JSON.stringify(frozen, null, 2)}\n`, rendered, "freeze manifest mismatch");
  const freezeCommit = await verifyCommit(frozen);
  return { manifest, freezeCommit };
}

export async function prepareReviewCandidate(
  root = tierRoot,
  { preflight = runFreezePreflight } = {},
) {
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  assert.equal(
    preregistration.status,
    "frozen",
    "set candidate status=frozen before producing the review digest",
  );
  await assertNoObservedResults(root);
  await preflight(root);
  return buildReviewDigest(root);
}

export async function writeFreezeManifest(
  root = tierRoot,
  {
    preflight = runFreezePreflight,
    reviewGate = assertReviewAttestations,
    captureManifest = buildManifest,
    afterWrite = async () => {},
  } = {},
) {
  const preregistration = JSON.parse(
    await readFile(path.join(root, "preregistration.json"), "utf8"),
  );
  assert.equal(
    preregistration.status,
    "frozen",
    "set candidate status=frozen before review digest and attestations are produced",
  );
  await assertNoObservedResults(root);
  const manifestPath = path.join(root, "freeze-manifest.json");
  await assertAbsent(
    manifestPath,
    "freeze manifest already exists; use a new experiment for amendments",
  );
  await preflight(root);
  const review = await buildReviewDigest(root);
  await reviewGate(root, review.reviewDigest);
  await assertReviewAttestations(root, review.reviewDigest);
  const afterGate = await buildReviewDigest(root);
  assert.deepEqual(afterGate, review, "frozen review surface changed after the review gate");
  const manifest = await captureManifest(root);
  assertManifestMatchesReview(manifest, review);
  const beforeWrite = await buildReviewDigest(root);
  assert.deepEqual(
    beforeWrite,
    review,
    "frozen review surface changed while capturing the manifest",
  );
  await assertReviewAttestations(root, review.reviewDigest);
  const rendered = `${JSON.stringify(manifest, null, 2)}\n`;
  await writeFile(manifestPath, rendered, { encoding: "utf8", flag: "wx" });
  try {
    await afterWrite(manifestPath);
    const writtenManifest = await readFrozenRegularFile(manifestPath, "freeze-manifest.json");
    assert.equal(
      writtenManifest.toString("utf8"),
      rendered,
      "written freeze manifest differs from the reviewed manifest",
    );
    const afterWriteManifest = await buildManifest(root);
    assert.deepEqual(
      afterWriteManifest,
      manifest,
      "frozen surface changed while writing the manifest",
    );
    assertManifestMatchesReview(afterWriteManifest, review);
    await assertReviewAttestations(root, review.reviewDigest);
    return manifest;
  } catch (error) {
    await rm(manifestPath, { force: true });
    throw error;
  }
}

function assertManifestMatchesReview(manifest, review) {
  assert.ok(manifest && typeof manifest === "object");
  assert.ok(Array.isArray(manifest.files));
  const manifestReview = reviewForFiles(
    manifest.files.filter((file) => file.path !== reviewAttestationsName),
  );
  assert.deepEqual(
    manifestReview,
    review,
    "manifest files do not match the independently reviewed surface",
  );
}

export async function runFreezePreflight(
  root = tierRoot,
  execute = execFileAsync,
  dependencyValidator = validateAnalysisDependencies,
) {
  await dependencyValidator(root);
  const analysisDirectory = path.join(root, "analysis");
  const options = { cwd: path.resolve(root, "../../.."), encoding: "utf8" };
  await execute(
    process.execPath,
    [path.join(analysisDirectory, "validate.mjs"), "--root", root],
    options,
  );
  await execute(
    process.execPath,
    [path.join(analysisDirectory, "generate-order.mjs"), "--check", "--root", root],
    options,
  );
  await execute(
    process.execPath,
    [path.join(analysisDirectory, "evaluation-bundles.mjs"), "--check", "--root", root],
    options,
  );
  await execute(
    process.execPath,
    [path.join(analysisDirectory, "harness-prerequisites.mjs"), "--require-passed", "--root", root],
    options,
  );
}

export async function assertReviewAttestations(root, expectedReviewDigest) {
  const attestations = JSON.parse(await readFile(path.join(root, reviewAttestationsName), "utf8"));
  assert.deepEqual(Object.keys(attestations).sort(), ["formatVersion", "reviewDigest", "reviews"]);
  assert.equal(attestations.formatVersion, 1);
  assert.match(expectedReviewDigest, /^[0-9a-f]{64}$/);
  assert.equal(attestations.reviewDigest, expectedReviewDigest, "review digest differs");
  assert.ok(Array.isArray(attestations.reviews), "reviews must be an array");
  assert.equal(attestations.reviews.length, 2, "exactly two independent reviews are required");
  const reviewerIds = new Set();
  for (const review of attestations.reviews) {
    assert.deepEqual(Object.keys(review).sort(), [
      "findings",
      "independenceStatement",
      "reviewDigest",
      "reviewedAt",
      "reviewerId",
      "verdict",
    ]);
    assert.match(review.reviewerId, /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/);
    assert.equal(reviewerIds.has(review.reviewerId), false, "reviewers must be distinct");
    reviewerIds.add(review.reviewerId);
    assert.equal(review.verdict, "GO", `${review.reviewerId} review is not GO`);
    assert.equal(review.reviewDigest, expectedReviewDigest, `${review.reviewerId} digest differs`);
    assert.ok(review.independenceStatement.length >= 20, "independence statement is too short");
    assert.match(review.reviewedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/);
    assert.ok(Array.isArray(review.findings));
    assert.equal(review.findings.length, 0, `${review.reviewerId} has unresolved findings`);
  }
}

export async function assertNoObservedResults(root = tierRoot) {
  for (const relativeDirectory of ["evaluations", "raw-quarantine", "raw-reviewed"]) {
    const directory = path.join(root, relativeDirectory);
    for (const entry of await readdir(directory)) {
      assert.ok(
        entry.startsWith(".git"),
        `observed result prevents freeze: ${relativeDirectory}/${entry}`,
      );
    }
  }
  for (const file of ["scores.csv", "exclusions.csv"]) {
    const lines = (await readFile(path.join(root, file), "utf8"))
      .split(/\r?\n/)
      .filter((line) => line !== "");
    assert.equal(lines.length, 1, `observed result prevents freeze: ${file}`);
  }
}

async function assertAbsent(filePath, message) {
  try {
    await access(filePath);
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(message);
}

async function git(arguments_, cwd = projectRoot) {
  return (await execFileAsync("git", arguments_, { cwd, encoding: "utf8" })).stdout;
}

async function gitBuffer(arguments_, cwd = projectRoot) {
  return (await execFileAsync("git", arguments_, { cwd, encoding: "buffer" })).stdout;
}

async function gitAllowExit(arguments_, cwd = projectRoot) {
  try {
    await git(arguments_, cwd);
    return { exitCode: 0 };
  } catch (error) {
    return { exitCode: typeof error.code === "number" ? error.code : 1 };
  }
}
