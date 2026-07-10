import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { resolveNpmInvocation, resolveNpxInvocation } from "./lib/npm-cli.mjs";

const execFileAsync = promisify(execFile);
const repositoryRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));
const release = JSON.parse(
  await readFile(path.join(repositoryRoot, "release", "artifact.json"), "utf8"),
);
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "carrylog-registry-verify-"));
const cache = path.join(temporaryRoot, "npm-cache");
const binaryName = "carrylog";

assert.equal(manifest.name, "carrylog", "registry verification package identity differs");
assert.deepEqual(manifest.bin, { [binaryName]: "dist/cli.js" });

try {
  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      const beta = await npm(["view", manifest.name, "dist-tags.beta", "--json"]);
      assert.equal(JSON.parse(beta), manifest.version);
      const dist = JSON.parse(
        await npm(["view", `${manifest.name}@${manifest.version}`, "dist", "--json"]),
      );
      assert.equal(dist.integrity, release.integrity, "registry tarball integrity differs");
      assert.equal(dist.shasum, release.shasum, "registry tarball shasum differs");
      assert.equal(typeof dist.attestations?.url, "string", "registry provenance URL is missing");
      assert.match(
        dist.attestations?.provenance?.predicateType ?? "",
        /^https:\/\/slsa\.dev\/provenance\//,
        "registry SLSA provenance is missing",
      );
      const version = await npm([
        "exec",
        "--yes",
        "--package",
        `${manifest.name}@${manifest.version}`,
        "--",
        binaryName,
        "--version",
      ]);
      assert.equal(version.trim(), manifest.version);
      const npx = await resolveNpxInvocation([
        "--yes",
        `${manifest.name}@${manifest.version}`,
        "--version",
      ]);
      const { stdout: npxVersion } = await execFileAsync(npx.command, npx.arguments, {
        cwd: temporaryRoot,
        encoding: "utf8",
        env: { ...process.env, NO_COLOR: "1", npm_config_cache: cache },
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      assert.equal(npxVersion.trim(), manifest.version);
      process.stdout.write(
        `Registry verification passed for ${manifest.name}@${manifest.version}.\n`,
      );
      lastError = undefined;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 10) {
        const delay = Math.min(5_000 * 2 ** (attempt - 1), 30_000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  if (lastError !== undefined) {
    throw new Error(
      "Registry verification did not converge. Publication may already be immutable; inspect the exact version and attestations, and do not rerun publish for the same version.",
      { cause: lastError },
    );
  }
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function npm(arguments_) {
  const invocation = await resolveNpmInvocation(arguments_);
  const { stdout } = await execFileAsync(invocation.command, invocation.arguments, {
    cwd: temporaryRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", npm_config_cache: cache },
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return stdout;
}
