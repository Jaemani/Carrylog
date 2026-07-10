import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export async function createTemporaryDirectory(prefix = "ackit-test-") {
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
