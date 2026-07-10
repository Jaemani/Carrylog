import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { resolveNpmInvocation } from "./lib/npm-cli.mjs";

const expectedVersion = process.argv[2];
assert.match(expectedVersion ?? "", /^\d+\.\d+\.\d+$/, "expected one exact npm version argument");

const invocation = await resolveNpmInvocation([]);
const npmCliPath = invocation.arguments[0];
assert.equal(path.basename(npmCliPath), "npm-cli.js", "resolved npm entrypoint is unexpected");

const npmRoot = path.resolve(path.dirname(npmCliPath), "..");
const manifest = JSON.parse(await readFile(path.join(npmRoot, "package.json"), "utf8"));
assert.equal(manifest.name, "npm", "resolved package is not npm");
assert.equal(
  manifest.version,
  expectedVersion,
  "resolved npm version differs from the release pin",
);

const provenanceModule = path.join(
  npmRoot,
  "node_modules",
  "libnpmpublish",
  "lib",
  "provenance.js",
);
await access(provenanceModule);
const provenanceRequire = createRequire(provenanceModule);
try {
  const sigstoreModule = provenanceRequire.resolve("sigstore");
  const relativeSigstorePath = path.relative(npmRoot, sigstoreModule);
  assert.equal(
    path.isAbsolute(relativeSigstorePath) ||
      relativeSigstorePath === ".." ||
      relativeSigstorePath.startsWith(`..${path.sep}`),
    false,
    "npm provenance resolved sigstore outside the pinned npm installation",
  );
  provenanceRequire(provenanceModule);
} catch (error) {
  throw new Error(`npm ${expectedVersion} cannot load its provenance implementation`, {
    cause: error,
  });
}

process.stdout.write(`Release npm client passed: ${expectedVersion}; provenance module loaded.\n`);
