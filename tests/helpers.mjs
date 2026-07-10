import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify } from "yaml";

export async function createTemporaryDirectory(prefix = "carrylog-test-") {
  return await realpath(await mkdtemp(path.join(tmpdir(), prefix)));
}

export async function createNestedTemporaryProject() {
  const root = await createTemporaryDirectory();
  const nested = path.join(root, "packages", "feature");
  await mkdir(nested, { recursive: true });
  return { root, nested };
}

export async function removeTemporaryDirectory(root) {
  await rm(root, { recursive: true, force: true });
}

export function diagnosticCodes(result) {
  return result.diagnostics.map((diagnostic) => diagnostic.code);
}

export async function writeProjectConfig(root, config) {
  const source = stringify(config, { lineWidth: 100 });
  await writeFile(
    path.join(root, ".agent-context", "config.yaml"),
    `# yaml-language-server: $schema=./config.schema.json\n${source}`,
    "utf8",
  );
}
