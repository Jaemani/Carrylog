import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectReleaseArtifact,
  publishReleaseArtifact,
} from "../scripts/publish-release-artifact.mjs";

async function createFixture(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-release-artifact-"));
  const releaseDirectory = path.join(root, "release");
  await mkdir(releaseDirectory);
  const content = Buffer.from("reviewed release artifact");
  const manifest = {
    name: "carrylog",
    version: "0.1.0-beta.4",
    publishConfig: { access: "public", tag: "beta", provenance: true },
    ...overrides.manifest,
  };
  const artifact = {
    package: manifest.name,
    version: manifest.version,
    commit: "0123456789abcdef",
    filename: "carrylog-0.1.0-beta.4.tgz",
    sha256: createHash("sha256").update(content).digest("hex"),
    integrity: `sha512-${createHash("sha512").update(content).digest("base64")}`,
    shasum: createHash("sha1").update(content).digest("hex"),
    size: content.length,
    unpackedSize: 100,
    ...overrides.artifact,
  };
  await writeFile(path.join(root, "package.json"), `${JSON.stringify(manifest)}\n`);
  await writeFile(
    path.join(releaseDirectory, "artifact.json"),
    overrides.artifactJson ?? `${JSON.stringify(artifact)}\n`,
  );
  if (!overrides.skipTarball) {
    await writeFile(path.join(releaseDirectory, artifact.filename), overrides.content ?? content);
  }
  return { artifact, content, releaseDirectory, root };
}

test("publishes the one verified tarball through an absolute shell-free npm argument", async (t) => {
  const fixture = await createFixture();
  t.after(async () => await rm(fixture.root, { recursive: true, force: true }));
  let invocation;
  await publishReleaseArtifact(fixture.root, {
    expectedCommit: fixture.artifact.commit,
    resolveNpm: async (arguments_) => ({
      command: "node",
      arguments: ["npm-cli.js", ...arguments_],
    }),
    execute: async (command, arguments_, options) => {
      invocation = { arguments: arguments_, command, options };
    },
  });

  assert.equal(invocation.command, "node");
  assert.deepEqual(invocation.arguments, [
    "npm-cli.js",
    "publish",
    path.join(fixture.releaseDirectory, fixture.artifact.filename),
    "--access",
    "public",
    "--tag",
    "beta",
    "--provenance",
  ]);
  assert.equal(path.isAbsolute(invocation.arguments[2]), true);
  assert.equal(invocation.options.cwd, fixture.root);
});

test("rejects package, version, policy, commit, and filename record mismatches", async (t) => {
  const cases = [
    [{ artifact: { package: "@other/package" } }, /package differs/, undefined],
    [{ artifact: { version: "0.1.0-beta.3" } }, /version differs/, undefined],
    [
      { manifest: { publishConfig: { access: "restricted" } } },
      /publish policy differs/,
      undefined,
    ],
    [{}, /commit differs/, "different"],
    [
      { artifact: { filename: "../outside.tgz" }, skipTarball: true },
      /safe tgz basename/,
      undefined,
    ],
  ];

  for (const [overrides, message, expectedCommit] of cases) {
    const fixture = await createFixture(overrides);
    t.after(async () => await rm(fixture.root, { recursive: true, force: true }));
    await assert.rejects(inspectReleaseArtifact(fixture.root, { expectedCommit }), message);
  }
});

test("rejects missing, additional, symlinked, and tampered tarballs", async (t) => {
  const missing = await createFixture({ skipTarball: true });
  const additional = await createFixture();
  const symlinked = await createFixture({ skipTarball: true });
  const tampered = await createFixture({ content: Buffer.from("reviewed release artifacU") });
  for (const fixture of [missing, additional, symlinked, tampered]) {
    t.after(async () => await rm(fixture.root, { recursive: true, force: true }));
  }
  await writeFile(path.join(additional.releaseDirectory, "other.tgz"), "other");
  await writeFile(path.join(symlinked.root, "outside.tgz"), symlinked.content);
  await symlink(
    path.join(symlinked.root, "outside.tgz"),
    path.join(symlinked.releaseDirectory, symlinked.artifact.filename),
  );

  await assert.rejects(inspectReleaseArtifact(missing.root), /exactly the recorded tarball/);
  await assert.rejects(inspectReleaseArtifact(additional.root), /exactly the recorded tarball/);
  await assert.rejects(inspectReleaseArtifact(symlinked.root), /regular file|symbolic link/);
  await assert.rejects(inspectReleaseArtifact(tampered.root), /SHA-256 differs/);
});

test("rejects malformed metadata and digest records before npm invocation", async (t) => {
  const malformed = await createFixture({ artifactJson: "not-json" });
  const invalidDigest = await createFixture({ artifact: { sha256: "invalid" } });
  const wrongSha1 = await createFixture({ artifact: { shasum: "0".repeat(40) } });
  const wrongIntegrity = await createFixture({
    artifact: { integrity: `sha512-${Buffer.alloc(64).toString("base64")}` },
  });
  const emptySize = await createFixture({ artifact: { size: 0 } });
  for (const fixture of [malformed, invalidDigest, wrongSha1, wrongIntegrity, emptySize]) {
    t.after(async () => await rm(fixture.root, { recursive: true, force: true }));
  }

  await assert.rejects(inspectReleaseArtifact(malformed.root), /not valid JSON/);
  await assert.rejects(inspectReleaseArtifact(invalidDigest.root), /SHA-256 is invalid/);
  await assert.rejects(inspectReleaseArtifact(wrongSha1.root), /SHA-1 differs/);
  await assert.rejects(inspectReleaseArtifact(wrongIntegrity.root), /integrity differs/);
  await assert.rejects(inspectReleaseArtifact(emptySize.root), /size is invalid/);
});
