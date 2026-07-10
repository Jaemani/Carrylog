import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { resolveNpmInvocation } from "./lib/npm-cli.mjs";
import { parseSingleNpmPackArtifact } from "./lib/npm-pack-json.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "..");
const temporaryRoot = await mkdtemp(path.join(tmpdir(), "ackit-pack-check-"));
const manifest = JSON.parse(await readFile(path.join(repositoryRoot, "package.json"), "utf8"));

try {
  const result = await runNpmPack(temporaryRoot);
  const artifact = parseSingleNpmPackArtifact(result, manifest);
  const files = new Set(artifact.files.map((file) => file.path));
  assert.equal(files.has("package.json"), true);
  assert.equal(files.has("LICENSE"), true);
  assert.equal(files.has("README.md"), true);
  assert.equal(files.has("docs/configuration.md"), true);
  assert.equal(files.has("docs/adapter-compatibility.md"), true);
  assert.equal(files.has("docs/license-policy.json"), true);
  assert.equal(files.has("CHANGELOG.md"), true);
  assert.equal(files.has("dist/cli.js"), true);
  assert.equal(files.has("dist/index.js"), true);
  assert.equal(files.has("dist/index.d.ts"), true);
  assert.equal(files.has("schemas/config-v1.schema.json"), true);
  assert.equal(
    [...files].some((file) => file.startsWith("src/")),
    false,
  );
  const sourceFiles = (
    await readdir(path.join(repositoryRoot, "src"), {
      recursive: true,
      withFileTypes: true,
    })
  )
    .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
    .map((entry) =>
      path.relative(path.join(repositoryRoot, "src"), path.join(entry.parentPath, entry.name)),
    )
    .flatMap((file) => {
      const base = `dist/${file.slice(0, -3)}`.replaceAll(path.sep, "/");
      return [`${base}.js`, `${base}.js.map`, `${base}.d.ts`, `${base}.d.ts.map`];
    });
  const actualDist = [...files].filter((file) => file.startsWith("dist/")).sort();
  assert.deepEqual(actualDist, sourceFiles.sort(), "packed dist must exactly match compiled src");
  assert.equal(
    [...files].some((file) => file.startsWith("tests/")),
    false,
  );
  assert.equal(
    [...files].some((file) => file.startsWith("scripts/")),
    false,
  );
  process.stdout.write(
    `Package dry-run passed: ${artifact.filename}; ${artifact.entryCount} files, ${artifact.size} bytes.\n`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function runNpmPack(cacheDirectory) {
  const invocation = await resolveNpmInvocation([
    "pack",
    "--dry-run",
    "--json",
    "--ignore-scripts",
  ]);
  return await new Promise((resolve, reject) => {
    const child = spawn(invocation.command, invocation.arguments, {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        NO_COLOR: "1",
        npm_config_cache: cacheDirectory,
      },
      shell: false,
      timeout: 120_000,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(
          new Error(
            `npm pack dry-run failed with exit ${code} signal ${signal ?? "none"}\n${stdout}\n${stderr}`,
          ),
        );
      }
    });
  });
}
