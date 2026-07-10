import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { resolveNpmInvocation } from "./lib/npm-cli.mjs";
import { parseSingleNpmPackArtifact } from "./lib/npm-pack-json.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const releaseDirectory = path.join(repositoryRoot, "release");
const npmCache = path.join(releaseDirectory, "npm-cache");
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));

assert.match(manifest.version, /^0\.1\.0-beta\.\d+$/, "release version must be a 0.1 beta");
assert.deepEqual(manifest.publishConfig, {
  access: "public",
  tag: "beta",
  provenance: true,
});
const licensePath = path.join(repositoryRoot, "LICENSE");
const licensePolicyPath = path.join(repositoryRoot, "docs", "license-policy.json");
assert.equal(typeof manifest.license, "string", "package.json must declare the selected license");
assert.notEqual(manifest.license, "UNLICENSED", "public releases cannot use UNLICENSED");
await access(licensePath);
await access(licensePolicyPath);
const licensePolicy = JSON.parse(await readFile(licensePolicyPath, "utf8"));
assert.equal(manifest.license, licensePolicy.spdx, "manifest and license policy SPDX differ");
assert.match(licensePolicy.spdx, /^[A-Za-z0-9-.+]+$/, "license policy must use a simple SPDX ID");
const licenseContent = await readFile(licensePath);
assert.equal(licenseContent.length > 100, true, "LICENSE must contain canonical license text");
assert.equal(
  createHash("sha256").update(licenseContent).digest("hex"),
  licensePolicy.sha256,
  "LICENSE content does not match the reviewed license policy hash",
);

const status = await execFileAsync("git", ["status", "--porcelain"], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
assert.equal(status.stdout, "", "release artifacts must be built from a clean Git checkout");
const commit = (
  await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" })
).stdout.trim();
if (process.env.GITHUB_REF_NAME !== undefined) {
  assert.equal(
    process.env.GITHUB_REF_NAME,
    `v${manifest.version}`,
    "tag and package version differ",
  );
  await execFileAsync("git", ["merge-base", "--is-ancestor", "HEAD", "origin/main"], {
    cwd: repositoryRoot,
  });
}

await rm(releaseDirectory, { recursive: true, force: true });
await mkdir(releaseDirectory, { recursive: true });
try {
  const npm = await resolveNpmInvocation([
    "pack",
    "--json",
    "--ignore-scripts",
    "--pack-destination",
    releaseDirectory,
  ]);
  const { stdout } = await execFileAsync(npm.command, npm.arguments, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", npm_config_cache: npmCache },
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const artifact = parseSingleNpmPackArtifact(stdout, manifest);
  const files = new Set(artifact.files.map((file) => file.path));
  for (const required of [
    "LICENSE",
    "README.md",
    "dist/cli.js",
    "dist/index.js",
    "dist/index.d.ts",
    "schemas/config-v1.schema.json",
  ]) {
    assert.equal(files.has(required), true, `release artifact is missing ${required}`);
  }
  const tarball = path.join(releaseDirectory, artifact.filename);
  await stat(tarball);
  assert.equal(typeof artifact.integrity, "string", "npm pack must report SHA-512 integrity");
  assert.equal(typeof artifact.shasum, "string", "npm pack must report a registry shasum");
  const sha256 = createHash("sha256")
    .update(await readFile(tarball))
    .digest("hex");
  await writeFile(
    path.join(releaseDirectory, "artifact.json"),
    `${JSON.stringify(
      {
        package: manifest.name,
        version: manifest.version,
        commit,
        filename: artifact.filename,
        sha256,
        integrity: artifact.integrity,
        shasum: artifact.shasum,
        size: artifact.size,
        unpackedSize: artifact.unpackedSize,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  process.stdout.write(`Release artifact: ${artifact.filename} sha256=${sha256}\n`);
} finally {
  await rm(npmCache, { recursive: true, force: true });
}
