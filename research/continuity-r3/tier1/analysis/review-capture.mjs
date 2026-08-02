import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function captureReviewFiles(roots) {
  assert.ok(Array.isArray(roots) && roots.length > 0);
  const files = [];
  for (const [directory, relative] of roots) {
    assert.equal(typeof directory, "string");
    assertSafeRelativePath(relative);
    await visit(directory, relative, files);
  }
  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

export async function materializeCapturedReviewFiles(root, files) {
  assert.equal(path.isAbsolute(root), true);
  const canonicalRoot = path.resolve(root);
  const seen = new Set();
  for (const file of files) {
    assertSafeRelativePath(file.path);
    assert.equal(Buffer.isBuffer(file.bytes), true);
    assert.equal(seen.has(file.path), false, `duplicate captured review path: ${file.path}`);
    seen.add(file.path);
    const destination = path.resolve(canonicalRoot, ...file.path.split("/"));
    assert.ok(destination.startsWith(`${canonicalRoot}${path.sep}`));
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, file.bytes, { mode: 0o600, flag: "wx" });
    assert.equal(
      (await readFile(destination)).equals(file.bytes),
      true,
      `materialized review bytes differ: ${file.path}`,
    );
  }
}

export function digestReviewManifest(files) {
  return createHash("sha256")
    .update(
      files
        .map(
          (file) =>
            `${file.path}\0${file.bytes.length}\0${createHash("sha256").update(file.bytes).digest("hex")}\n`,
        )
        .join(""),
    )
    .digest("hex");
}

async function visit(directory, relative, files) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const child = path.posix.join(relative, entry.name);
    const metadata = await lstat(absolute);
    assert.equal(metadata.isSymbolicLink(), false, `review input cannot be a symlink: ${child}`);
    if (metadata.isDirectory()) await visit(absolute, child, files);
    else if (metadata.isFile()) {
      assert.ok(metadata.size <= 50 * 1024 * 1024, `review artifact too large: ${child}`);
      files.push({ path: child, bytes: await readFile(absolute) });
    } else throw new Error(`unsupported review artifact: ${child}`);
  }
}

function assertSafeRelativePath(relative) {
  assert.equal(typeof relative, "string");
  assert.ok(relative.length > 0);
  assert.equal(path.posix.isAbsolute(relative), false);
  assert.equal(relative.includes("\\"), false);
  assert.equal(path.posix.normalize(relative), relative);
  assert.equal(relative === ".." || relative.startsWith("../"), false);
}
