import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { resolveNpmInvocation } from "./lib/npm-cli.mjs";

const execFileAsync = promisify(execFile);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJson(content, description) {
  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`${description} is not valid JSON`, { cause: error });
  }
}

export async function inspectReleaseArtifact(repositoryRoot, options = {}) {
  const root = path.resolve(repositoryRoot);
  const releaseDirectory = path.join(root, "release");
  const manifest = parseJson(
    await readFile(path.join(root, "package.json"), "utf8"),
    "package manifest",
  );
  const artifact = parseJson(
    await readFile(path.join(releaseDirectory, "artifact.json"), "utf8"),
    "release artifact record",
  );

  assert.equal(isRecord(manifest), true, "package manifest must be an object");
  assert.equal(isRecord(artifact), true, "release artifact record must be an object");
  assert.equal(artifact.package, manifest.name, "release artifact package differs from manifest");
  assert.equal(
    artifact.version,
    manifest.version,
    "release artifact version differs from manifest",
  );
  assert.deepEqual(
    manifest.publishConfig,
    { access: "public", tag: "beta", provenance: true },
    "package publish policy differs from the reviewed beta policy",
  );
  if (options.expectedCommit !== undefined) {
    assert.equal(
      artifact.commit,
      options.expectedCommit,
      "release artifact commit differs from the workflow commit",
    );
  }
  assert.match(
    artifact.filename,
    /^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/,
    "release artifact filename must be a safe tgz basename",
  );
  assert.match(artifact.sha256, /^[0-9a-f]{64}$/, "release artifact SHA-256 is invalid");
  assert.match(artifact.shasum, /^[0-9a-f]{40}$/, "release artifact SHA-1 is invalid");
  const integrityMatch = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(artifact.integrity);
  assert.notEqual(integrityMatch, null, "release artifact integrity is invalid");
  assert.equal(
    Buffer.from(integrityMatch[1], "base64").length,
    64,
    "release artifact integrity must contain a SHA-512 digest",
  );
  assert.equal(
    Buffer.from(integrityMatch[1], "base64").toString("base64"),
    integrityMatch[1],
    "release artifact integrity must use canonical base64",
  );
  assert.equal(
    Number.isSafeInteger(artifact.size) && artifact.size > 0,
    true,
    "release artifact size is invalid",
  );

  const entries = await readdir(releaseDirectory, { withFileTypes: true });
  const tarballs = entries
    .filter((entry) => entry.name.endsWith(".tgz"))
    .map((entry) => entry.name)
    .sort();
  assert.deepEqual(
    tarballs,
    [artifact.filename],
    "release directory must contain exactly the recorded tarball",
  );

  const artifactPath = path.join(releaseDirectory, artifact.filename);
  assert.equal(
    path.dirname(artifactPath),
    releaseDirectory,
    "release artifact escaped its directory",
  );
  const artifactStat = await lstat(artifactPath);
  assert.equal(artifactStat.isFile(), true, "release artifact must be a regular file");
  assert.equal(artifactStat.isSymbolicLink(), false, "release artifact cannot be a symbolic link");
  assert.equal(artifactStat.size, artifact.size, "release artifact size differs from its record");

  const content = await readFile(artifactPath);
  assert.equal(
    createHash("sha256").update(content).digest("hex"),
    artifact.sha256,
    "release artifact SHA-256 differs from its record",
  );
  assert.equal(
    createHash("sha1").update(content).digest("hex"),
    artifact.shasum,
    "release artifact SHA-1 differs from its record",
  );
  assert.equal(
    `sha512-${createHash("sha512").update(content).digest("base64")}`,
    artifact.integrity,
    "release artifact integrity differs from its record",
  );

  return { artifact, artifactPath, manifest, repositoryRoot: root };
}

export async function publishReleaseArtifact(repositoryRoot, options = {}) {
  const inspected = await inspectReleaseArtifact(repositoryRoot, {
    expectedCommit: options.expectedCommit,
  });
  const resolveNpm = options.resolveNpm ?? resolveNpmInvocation;
  const execute = options.execute ?? execFileAsync;
  const npm = await resolveNpm([
    "publish",
    inspected.artifactPath,
    "--access",
    "public",
    "--tag",
    "beta",
    "--provenance",
  ]);
  try {
    const result = await execute(npm.command, npm.arguments, {
      cwd: inspected.repositoryRoot,
      encoding: "utf8",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (typeof result?.stdout === "string") process.stdout.write(result.stdout);
    if (typeof result?.stderr === "string") process.stderr.write(result.stderr);
  } catch (error) {
    if (typeof error?.stdout === "string") process.stdout.write(error.stdout);
    if (typeof error?.stderr === "string") process.stderr.write(error.stderr);
    throw error;
  }
  process.stdout.write(
    `Published ${inspected.manifest.name}@${inspected.manifest.version} from ${inspected.artifact.filename}.\n`,
  );
}

const entrypoint = process.argv[1];
if (entrypoint !== undefined && import.meta.url === pathToFileURL(path.resolve(entrypoint)).href) {
  await publishReleaseArtifact(path.resolve(import.meta.dirname, ".."), {
    expectedCommit: process.env.GITHUB_SHA,
  });
}
