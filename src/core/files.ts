import { randomUUID } from "node:crypto";
import type { BigIntStats } from "node:fs";
import { constants as fsConstants } from "node:fs";
import type { FileHandle } from "node:fs/promises";
import { chmod, lstat, mkdir, open, realpath, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { issueError } from "./errors.js";
import { assertNoSymlink } from "./paths.js";

export const DEFAULT_MAX_TEXT_BYTES = 5 * 1024 * 1024;

export interface AtomicWriteOptions {
  expectedContent?: string | null;
}

export interface AtomicTextWrite extends AtomicWriteOptions {
  filePath: string;
  content: string;
  guard: AtomicPathGuard;
}

export interface AtomicWritePrecondition {
  filePath: string;
  expectedContent: string | null;
  guard: AtomicPathGuard;
}

export interface AtomicWriteBatchOptions {
  preconditions?: AtomicWritePrecondition[];
}

interface DirectoryIdentity {
  readonly path: string;
  readonly device: bigint;
  readonly inode: bigint;
}

interface RegularFileIdentity extends DirectoryIdentity, GuardedFileMetadata {}

export interface AtomicPathGuard {
  readonly root: string;
  readonly filePath: string;
  readonly existingDirectories: readonly DirectoryIdentity[];
  readonly missingDirectories: readonly string[];
}

export interface GuardedTextRead {
  readonly bytes: Buffer;
  readonly text: string;
  readonly metadata: GuardedFileMetadata;
}

export interface GuardedFileMetadata {
  readonly device: bigint;
  readonly inode: bigint;
  readonly size: bigint;
  readonly mtimeNs: bigint;
  readonly ctimeNs: bigint;
  readonly linkCount: bigint;
}

export interface GuardedTextReadOptions {
  maxBytes?: number;
  rejectHardLinks?: boolean;
  /** @internal Deterministic fault-injection seam for concurrent-read regression tests. */
  afterBytesRead?: (metadata: GuardedFileMetadata) => void | Promise<void>;
}

export async function readGuardedText(
  rootInput: string,
  filePathInput: string,
  options: GuardedTextReadOptions = {},
): Promise<GuardedTextRead> {
  const root = path.resolve(rootInput);
  const filePath = path.resolve(filePathInput);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }
  const guard = await inspectAtomicPath(root, filePath);
  await verifyAtomicPathGuard(guard, filePath);
  const noFollow = process.platform === "win32" ? 0 : fsConstants.O_NOFOLLOW;
  const handle = await open(filePath, fsConstants.O_RDONLY | noFollow);
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) {
      throw issueError("E_NOT_REGULAR_FILE", "Expected a regular managed file.");
    }
    if (options.rejectHardLinks === true && before.nlink > 1n) {
      throw issueError("E_HARD_LINK_PATH", "Refusing to export a hard-linked managed file.");
    }
    if (before.size > BigInt(maxBytes)) {
      throw issueError("E_FILE_TOO_LARGE", `Text file exceeds the ${maxBytes}-byte safety limit.`);
    }
    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes - total + 1;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) break;
      total += bytesRead;
      if (total > maxBytes) {
        throw issueError(
          "E_FILE_TOO_LARGE",
          `Text file exceeds the ${maxBytes}-byte safety limit.`,
        );
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }
    await options.afterBytesRead?.(fileMetadata(before));
    const after = await handle.stat({ bigint: true });
    if (options.rejectHardLinks === true && after.nlink > 1n) {
      throw issueError("E_HARD_LINK_PATH", "Refusing to export a hard-linked managed file.");
    }
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      before.nlink !== after.nlink
    ) {
      throw concurrentModification(filePath);
    }
    await verifyAtomicPathGuard(guard, filePath);
    const pathIdentity = await readRegularFileIdentity(filePath);
    const metadata = fileMetadata(after);
    if (!sameFileMetadata(pathIdentity, metadata)) {
      throw concurrentModification(filePath);
    }
    const bytes = Buffer.concat(chunks, total);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw issueError("E_FILE_ENCODING", "Managed text file is not valid UTF-8.");
    }
    return { bytes, text, metadata };
  } finally {
    await handle.close();
  }
}

export async function readTextIfExists(
  filePath: string,
  options: { maxBytes?: number } = {},
): Promise<string | undefined> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_TEXT_BYTES;
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer.");
  }

  let handle: FileHandle;
  try {
    handle = await open(filePath, "r");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }

  try {
    const metadata = await handle.stat();
    if (!metadata.isFile()) {
      throw issueError("E_NOT_REGULAR_FILE", `Expected a regular file: ${filePath}`);
    }
    if (metadata.size > maxBytes) {
      throw issueError(
        "E_FILE_TOO_LARGE",
        `Text file exceeds the ${maxBytes}-byte safety limit: ${filePath}`,
      );
    }

    const chunks: Buffer[] = [];
    let total = 0;
    while (true) {
      const remaining = maxBytes - total + 1;
      const buffer = Buffer.allocUnsafe(Math.min(64 * 1024, remaining));
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
      if (bytesRead === 0) {
        break;
      }
      total += bytesRead;
      if (total > maxBytes) {
        throw issueError(
          "E_FILE_TOO_LARGE",
          `Text file exceeds the ${maxBytes}-byte safety limit: ${filePath}`,
        );
      }
      chunks.push(buffer.subarray(0, bytesRead));
    }

    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    } catch (error) {
      throw issueError(
        "E_FILE_ENCODING",
        `Text file is not valid UTF-8: ${filePath}`,
        error instanceof Error ? error.message : undefined,
      );
    }
  } finally {
    await handle.close();
  }
}

export async function atomicWriteText(
  filePath: string,
  content: string,
  options: AtomicWriteOptions = {},
): Promise<void> {
  const resolvedFilePath = path.resolve(filePath);
  const guard = await inspectAtomicPath(path.dirname(resolvedFilePath), resolvedFilePath);
  const write: AtomicTextWrite = { filePath: resolvedFilePath, content, guard };
  if (Object.hasOwn(options, "expectedContent")) {
    write.expectedContent = options.expectedContent ?? null;
  }
  await atomicWriteTexts([write]);
}

export async function inspectAtomicPath(
  rootInput: string,
  filePathInput: string,
): Promise<AtomicPathGuard> {
  const root = path.resolve(rootInput);
  const filePath = path.resolve(filePathInput);
  assertDescendantPath(root, filePath);
  const parent = path.dirname(filePath);
  const relativeParent = path.relative(root, parent);
  const directoryPaths = [
    root,
    ...(relativeParent === ""
      ? []
      : relativeParent
          .split(path.sep)
          .map((_, index, segments) => path.join(root, ...segments.slice(0, index + 1)))),
  ];
  const existingDirectories: DirectoryIdentity[] = [];
  const missingDirectories: string[] = [];
  let foundMissing = false;
  for (const directoryPath of directoryPaths) {
    if (foundMissing) {
      missingDirectories.push(directoryPath);
      continue;
    }
    try {
      existingDirectories.push(await readDirectoryIdentity(directoryPath));
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT" && directoryPath !== root) {
        foundMissing = true;
        missingDirectories.push(directoryPath);
        continue;
      }
      throw error;
    }
  }
  await assertNoSymlink(root, filePath);
  await assertPhysicalContainment(root, existingDirectories.at(-1)?.path ?? root);
  return Object.freeze({
    root,
    filePath,
    existingDirectories: Object.freeze(existingDirectories),
    missingDirectories: Object.freeze(missingDirectories),
  });
}

export async function atomicWriteTexts(
  writes: AtomicTextWrite[],
  options: AtomicWriteBatchOptions = {},
): Promise<void> {
  const targets = new Set<string>();
  for (const write of writes) {
    const target = path.resolve(write.filePath);
    if (targets.has(target)) {
      throw new TypeError(`Atomic write batch contains a duplicate target: ${write.filePath}`);
    }
    targets.add(target);
  }
  await Promise.all([
    ...writes.map((write) => verifyAtomicPathGuard(write.guard, write.filePath)),
    ...(options.preconditions ?? []).map((precondition) =>
      verifyAtomicPathGuard(precondition.guard, precondition.filePath),
    ),
  ]);

  const staged: Array<{
    write: AtomicTextWrite;
    temporaryPath: string;
    parentIdentity: DirectoryIdentity;
    temporaryIdentity: DirectoryIdentity;
    committed: boolean;
  }> = [];
  try {
    for (const write of writes) {
      const directory = path.dirname(write.filePath);
      await mkdir(directory, { recursive: true });
      await assertNoSymlink(write.guard.root, write.filePath);
      await assertPhysicalContainment(write.guard.root, directory);
      const parentIdentity = await readDirectoryIdentity(directory);
      const existingMode = await getModeIfExists(write.filePath);
      const temporaryPath = path.join(
        directory,
        `.${path.basename(write.filePath)}.${randomUUID()}.tmp`,
      );
      let temporaryIdentity: DirectoryIdentity;
      try {
        await verifyParentIdentity(write.guard, write.filePath, parentIdentity);
        await writeFile(temporaryPath, write.content, {
          encoding: "utf8",
          flag: "wx",
          mode: existingMode ?? 0o644,
        });
        if (existingMode !== undefined) {
          await chmod(temporaryPath, existingMode);
        }
        temporaryIdentity = await readRegularFileIdentity(temporaryPath);
      } catch (error) {
        await removeTemporaryIfSafe(write.guard.root, temporaryPath, parentIdentity);
        throw error;
      }
      const stage = {
        write,
        temporaryPath,
        parentIdentity,
        temporaryIdentity,
        committed: false,
      };
      staged.push(stage);
      await verifyStagedWrite(stage);
    }

    const externalPreconditions: GuardedPrecondition[] = (options.preconditions ?? []).map(
      (precondition) => ({
        ...precondition,
        verifyOriginalGuard: true,
      }),
    );
    await verifyPreconditions(pendingPreconditions(staged, externalPreconditions));

    for (const stage of staged) {
      await verifyPreconditions(pendingPreconditions(staged, externalPreconditions));
      await verifyStagedWrite(stage);
      await rename(stage.temporaryPath, stage.write.filePath);
      stage.committed = true;
      const committedIdentity = await readRegularFileIdentity(stage.write.filePath);
      if (!sameIdentity(committedIdentity, stage.temporaryIdentity)) {
        throw concurrentModification(stage.write.filePath);
      }
    }
  } finally {
    await Promise.all(
      staged.map(async (stage) => {
        if (stage.committed) return;
        try {
          await verifyStagedWrite(stage);
          await rm(stage.temporaryPath, { force: true });
        } catch {
          // A moved parent cannot be cleaned safely through its old path.
        }
      }),
    );
  }
}

interface GuardedPrecondition extends AtomicWritePrecondition {
  readonly verifyOriginalGuard: boolean;
}

function pendingPreconditions(
  staged: ReadonlyArray<{
    write: AtomicTextWrite;
    committed: boolean;
  }>,
  external: readonly GuardedPrecondition[],
): GuardedPrecondition[] {
  return [
    ...external,
    ...staged
      .filter(({ write, committed }) => !committed && Object.hasOwn(write, "expectedContent"))
      .map(({ write }) => ({
        filePath: write.filePath,
        expectedContent: write.expectedContent ?? null,
        guard: write.guard,
        verifyOriginalGuard: false,
      })),
  ];
}

async function verifyPreconditions(preconditions: readonly GuardedPrecondition[]): Promise<void> {
  for (const precondition of preconditions) {
    try {
      if (precondition.verifyOriginalGuard) {
        await verifyAtomicPathGuard(precondition.guard, precondition.filePath);
      } else {
        await verifyCurrentPath(precondition.guard, precondition.filePath);
      }
      const current = await readTextIfExists(precondition.filePath);
      const expected =
        precondition.expectedContent === null ? undefined : precondition.expectedContent;
      if (current !== expected) throw concurrentModification(precondition.filePath);
    } catch (error) {
      if (isConcurrentModification(error)) throw error;
      throw concurrentModification(precondition.filePath);
    }
  }
}

async function removeTemporaryIfSafe(
  root: string,
  temporaryPath: string,
  parentIdentity: DirectoryIdentity,
): Promise<void> {
  try {
    await assertNoSymlink(root, temporaryPath);
    const currentParent = await readDirectoryIdentity(path.dirname(temporaryPath));
    if (!sameIdentity(currentParent, parentIdentity)) return;
    await rm(temporaryPath, { force: true });
  } catch {
    // Cleanup must never follow a parent path whose identity changed.
  }
}

export async function verifyAtomicPathGuard(
  guard: AtomicPathGuard,
  filePathInput: string,
): Promise<void> {
  const filePath = path.resolve(filePathInput);
  if (filePath !== guard.filePath) throw concurrentModification(filePath);
  assertDescendantPath(guard.root, filePath);
  await verifyExistingDirectoryIdentities(guard, filePath);
  for (const missingPath of guard.missingDirectories) {
    try {
      await lstat(missingPath);
      throw concurrentModification(filePath);
    } catch (error) {
      if (isConcurrentModification(error)) throw error;
      if (!isNodeError(error) || error.code !== "ENOENT") throw concurrentModification(filePath);
    }
  }
  await assertNoSymlink(guard.root, filePath).catch(() => {
    throw concurrentModification(filePath);
  });
  await assertPhysicalContainment(
    guard.root,
    guard.existingDirectories.at(-1)?.path ?? guard.root,
  ).catch(() => {
    throw concurrentModification(filePath);
  });
}

async function verifyExistingDirectoryIdentities(
  guard: AtomicPathGuard,
  filePath: string,
): Promise<void> {
  for (const identity of guard.existingDirectories) {
    const current = await readDirectoryIdentity(identity.path).catch(() => undefined);
    if (current === undefined || !sameIdentity(current, identity)) {
      throw concurrentModification(filePath);
    }
  }
}

async function verifyCurrentPath(guard: AtomicPathGuard, filePath: string): Promise<void> {
  if (path.resolve(filePath) !== guard.filePath) throw concurrentModification(filePath);
  assertDescendantPath(guard.root, filePath);
  await verifyExistingDirectoryIdentities(guard, filePath);
  await assertNoSymlink(guard.root, filePath);
  await assertPhysicalContainment(guard.root, path.dirname(filePath));
}

async function verifyParentIdentity(
  guard: AtomicPathGuard,
  filePath: string,
  expected: DirectoryIdentity,
): Promise<void> {
  await verifyCurrentPath(guard, filePath).catch(() => {
    throw concurrentModification(filePath);
  });
  const current = await readDirectoryIdentity(path.dirname(filePath)).catch(() => undefined);
  if (current === undefined || !sameIdentity(current, expected)) {
    throw concurrentModification(filePath);
  }
}

async function verifyStagedWrite(stage: {
  write: AtomicTextWrite;
  temporaryPath: string;
  parentIdentity: DirectoryIdentity;
  temporaryIdentity: DirectoryIdentity;
}): Promise<void> {
  await verifyParentIdentity(stage.write.guard, stage.write.filePath, stage.parentIdentity);
  const temporaryIdentity = await readRegularFileIdentity(stage.temporaryPath).catch(
    () => undefined,
  );
  if (
    temporaryIdentity === undefined ||
    !sameIdentity(temporaryIdentity, stage.temporaryIdentity)
  ) {
    throw concurrentModification(stage.write.filePath);
  }
}

async function readDirectoryIdentity(directoryPath: string): Promise<DirectoryIdentity> {
  const metadata = await lstat(directoryPath, { bigint: true });
  if (metadata.isSymbolicLink()) {
    throw issueError("E_SYMLINK_PATH", `Refusing to access a symbolic link: ${directoryPath}`);
  }
  if (!metadata.isDirectory()) {
    throw issueError("E_NOT_DIRECTORY", `Expected a directory: ${directoryPath}`);
  }
  return { path: directoryPath, device: metadata.dev, inode: metadata.ino };
}

async function readRegularFileIdentity(filePath: string): Promise<RegularFileIdentity> {
  const metadata = await lstat(filePath, { bigint: true });
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw issueError("E_NOT_REGULAR_FILE", `Expected a regular file: ${filePath}`);
  }
  return { path: filePath, ...fileMetadata(metadata) };
}

function sameIdentity(left: DirectoryIdentity, right: DirectoryIdentity): boolean {
  return left.device === right.device && left.inode === right.inode;
}

function fileMetadata(metadata: BigIntStats): GuardedFileMetadata {
  return Object.freeze({
    device: metadata.dev,
    inode: metadata.ino,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
    linkCount: metadata.nlink,
  });
}

function sameFileMetadata(left: GuardedFileMetadata, right: GuardedFileMetadata): boolean {
  return (
    left.device === right.device &&
    left.inode === right.inode &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs &&
    left.linkCount === right.linkCount
  );
}

async function assertPhysicalContainment(root: string, existingPath: string): Promise<void> {
  const [physicalRoot, physicalPath] = await Promise.all([realpath(root), realpath(existingPath)]);
  if (!sameResolvedPath(root, physicalRoot)) throw concurrentModification(root);
  const relative = path.relative(physicalRoot, physicalPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw issueError(
      "E_PATH_ESCAPE",
      `Managed path resolves outside the project root: ${existingPath}`,
    );
  }
}

function assertDescendantPath(root: string, filePath: string): void {
  const relative = path.relative(root, filePath);
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw issueError("E_PATH_ESCAPE", `Atomic write target escapes its root: ${filePath}`);
  }
}

function sameResolvedPath(left: string, right: string): boolean {
  return path.relative(left, right) === "" && path.relative(right, left) === "";
}

function concurrentModification(filePath: string) {
  return issueError(
    "E_CONCURRENT_MODIFICATION",
    `Managed path changed after it was inspected: ${filePath}`,
    "Review the concurrent change and rerun the command.",
  );
}

function isConcurrentModification(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "E_CONCURRENT_MODIFICATION"
  );
}

async function getModeIfExists(filePath: string): Promise<number | undefined> {
  try {
    const metadata = await lstat(filePath);
    if (!metadata.isFile()) {
      throw issueError("E_NOT_REGULAR_FILE", `Expected a regular file: ${filePath}`);
    }
    return metadata.mode;
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
