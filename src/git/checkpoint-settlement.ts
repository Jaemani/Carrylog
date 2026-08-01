import { createHash } from "node:crypto";
import { issueError } from "../core/errors.js";
import {
  type GitCommandResult,
  type GitSnapshot,
  inspectGitProject,
  runGitProcess,
} from "./inspect.js";

const SETTLEMENT_FORMAT_VERSION = 1;
const SHA256_HEX = /^[0-9a-f]{64}$/;
const VALID_ENTRY_MODES = new Set(["100644", "100755", "120000", "160000"]);

export interface CheckpointSettlementMetadata {
  formatVersion: 1;
  objectFormat: "sha1" | "sha256";
  baseHead: string;
  detached: boolean;
  branch: string | null;
  indexCommitment: string;
}

interface CurrentSettlementEvidence {
  objectFormat: "sha1" | "sha256";
  indexCommitment: string;
  committedCommitment: string;
  checkpointClean: boolean;
  parent: string | undefined;
  singleParent: boolean;
}

/**
 * Captures the narrow evidence that can later prove a checkpoint was committed
 * together with the project changes that were staged when it was written.
 * Undefined is intentional: an unstaged, untracked, conflicted, unborn, or unsupported state
 * must retain ordinary snapshot semantics rather than opt into settlement.
 */
export async function createCheckpointSettlementMetadata(
  projectRoot: string,
  checkpointPath: string,
  snapshot: GitSnapshot,
): Promise<CheckpointSettlementMetadata | undefined> {
  if (
    snapshot.head === undefined ||
    snapshot.unstaged !== 0 ||
    snapshot.untracked !== 0 ||
    snapshot.conflicted !== 0
  ) {
    return undefined;
  }
  try {
    const firstSnapshot = await inspectGitProject(projectRoot, checkpointPath);
    if (!sameSnapshot(snapshot, firstSnapshot)) return undefined;
    const firstEvidence = await inspectCurrentSettlementEvidence(
      projectRoot,
      checkpointPath,
      snapshot.head.sha,
    );
    const secondSnapshot = await inspectGitProject(projectRoot, checkpointPath);
    const secondEvidence = await inspectCurrentSettlementEvidence(
      projectRoot,
      checkpointPath,
      snapshot.head.sha,
    );
    if (
      !sameSnapshot(snapshot, secondSnapshot) ||
      !sameSettlementEvidence(firstEvidence, secondEvidence)
    ) {
      return undefined;
    }
    return {
      formatVersion: SETTLEMENT_FORMAT_VERSION,
      objectFormat: firstEvidence.objectFormat,
      baseHead: snapshot.head.sha,
      detached: snapshot.detached,
      branch: snapshot.branch ?? null,
      indexCommitment: firstEvidence.indexCommitment,
    };
  } catch {
    return undefined;
  }
}

/**
 * Returns true only for the one direct child commit that settles the staged
 * project tree recorded with a v1 checkpoint. It deliberately does not infer
 * freshness from malformed, legacy, unavailable, or partially matching data.
 */
export async function isCheckpointSettlementFresh(
  projectRoot: string,
  checkpointPath: string,
  snapshot: GitSnapshot,
  metadata: CheckpointSettlementMetadata,
): Promise<boolean> {
  try {
    if (!isCheckpointSettlementMetadata(metadata) || snapshot.head === undefined) return false;
    if (
      snapshot.detached !== metadata.detached ||
      (snapshot.branch ?? null) !== metadata.branch ||
      snapshot.staged !== 0 ||
      snapshot.unstaged !== 0 ||
      snapshot.untracked !== 0 ||
      snapshot.conflicted !== 0
    ) {
      return false;
    }
    const firstSnapshot = await inspectGitProject(projectRoot, checkpointPath);
    if (!sameSnapshot(snapshot, firstSnapshot)) return false;
    const firstEvidence = await inspectCurrentSettlementEvidence(
      projectRoot,
      checkpointPath,
      snapshot.head.sha,
    );
    const secondSnapshot = await inspectGitProject(projectRoot, checkpointPath);
    const secondEvidence = await inspectCurrentSettlementEvidence(
      projectRoot,
      checkpointPath,
      snapshot.head.sha,
    );
    return (
      sameSnapshot(snapshot, secondSnapshot) &&
      sameSettlementEvidence(firstEvidence, secondEvidence) &&
      firstEvidence.objectFormat === metadata.objectFormat &&
      firstEvidence.checkpointClean &&
      firstEvidence.singleParent &&
      firstEvidence.parent === metadata.baseHead &&
      firstEvidence.indexCommitment === firstEvidence.committedCommitment &&
      firstEvidence.committedCommitment === metadata.indexCommitment
    );
  } catch {
    return false;
  }
}

export function isCheckpointSettlementMetadata(
  value: unknown,
): value is CheckpointSettlementMetadata {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "formatVersion",
    "objectFormat",
    "baseHead",
    "detached",
    "branch",
    "indexCommitment",
  ];
  if (
    Object.keys(record).length !== expectedKeys.length ||
    !expectedKeys.every((key) => key in record)
  ) {
    return false;
  }
  if (record["formatVersion"] !== SETTLEMENT_FORMAT_VERSION) return false;
  if (record["objectFormat"] !== "sha1" && record["objectFormat"] !== "sha256") return false;
  const objectIdLength = record["objectFormat"] === "sha1" ? 40 : 64;
  if (typeof record["baseHead"] !== "string" || !objectId(record["baseHead"], objectIdLength)) {
    return false;
  }
  if (typeof record["detached"] !== "boolean") return false;
  if (!nullableString(record["branch"])) return false;
  if (
    typeof record["indexCommitment"] !== "string" ||
    !SHA256_HEX.test(record["indexCommitment"])
  ) {
    return false;
  }
  return true;
}

async function inspectCurrentSettlementEvidence(
  projectRoot: string,
  checkpointPath: string,
  head: string,
): Promise<CurrentSettlementEvidence> {
  const prefixResult = await runSettlementGit(projectRoot, ["rev-parse", "--show-prefix"]);
  const prefix = decodeText(prefixResult.stdout).trimEnd();
  if (prefix.length > 0 && !prefix.endsWith("/")) {
    throw issueError("E_GIT_PREFIX_FORMAT", "Git returned an unsupported repository prefix.");
  }
  const projectPath = prefix.length === 0 ? ":(top)" : `:(top,literal)${prefix.slice(0, -1)}`;
  const checkpointProjectPath = `${prefix}${checkpointPath}`;
  const checkpointOnly = `:(top,literal)${checkpointProjectPath}`;
  const [objectFormatResult, indexResult, committedResult, checkpointStatus, parentResult] =
    await Promise.all([
      runSettlementGit(projectRoot, ["rev-parse", "--show-object-format"]),
      runSettlementGit(projectRoot, [
        "ls-files",
        "--stage",
        "-z",
        "--full-name",
        "--",
        projectPath,
      ]),
      runSettlementGit(projectRoot, [
        "ls-tree",
        "-r",
        "-z",
        "--full-tree",
        head,
        "--",
        projectPath,
      ]),
      runSettlementGit(projectRoot, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
        "--",
        checkpointOnly,
      ]),
      runSettlementGit(projectRoot, ["rev-list", "--parents", "-n", "1", head]),
    ]);
  const objectFormat = parseObjectFormat(objectFormatResult.stdout);
  const checkpointPathBytes = Buffer.from(checkpointProjectPath, "utf8");
  const indexEntries = parseIndexEntries(indexResult.stdout, objectFormat, checkpointPathBytes);
  const committedEntries = parseCommittedEntries(
    committedResult.stdout,
    objectFormat,
    checkpointPathBytes,
  );
  const parents = decodeText(parentResult.stdout).trim().split(/\s+/).filter(Boolean);
  if (parents[0] !== head) {
    throw issueError("E_GIT_PARENT_FORMAT", "Git returned an unsupported commit parent record.");
  }
  return {
    objectFormat,
    indexCommitment: commitment(indexEntries, objectFormat),
    committedCommitment: commitment(committedEntries, objectFormat),
    checkpointClean: checkpointStatus.stdout.length === 0,
    parent: parents.length === 2 ? parents[1] : undefined,
    singleParent: parents.length === 2,
  };
}

function parseObjectFormat(value: Buffer): "sha1" | "sha256" {
  const format = decodeText(value).trim();
  if (format === "sha1" || format === "sha256") return format;
  throw issueError("E_GIT_OBJECT_FORMAT", "Git returned an unsupported object format.");
}

function parseIndexEntries(
  value: Buffer,
  objectFormat: "sha1" | "sha256",
  checkpointPath: Buffer,
): Buffer[] {
  return nullRecords(value).flatMap((record) => {
    const tab = record.indexOf(0x09);
    if (tab < 1)
      throw issueError("E_GIT_INDEX_FORMAT", "Git returned an unsupported index record.");
    const header = record.subarray(0, tab).toString("ascii").split(" ");
    if (header.length !== 3 || header[2] !== "0") {
      throw issueError("E_GIT_INDEX_FORMAT", "Git index contains an unsupported staged entry.");
    }
    const filePath = record.subarray(tab + 1);
    return filePath.equals(checkpointPath)
      ? []
      : [canonicalEntry(header[0], header[1], filePath, objectFormat)];
  });
}

function parseCommittedEntries(
  value: Buffer,
  objectFormat: "sha1" | "sha256",
  checkpointPath: Buffer,
): Buffer[] {
  return nullRecords(value).flatMap((record) => {
    const tab = record.indexOf(0x09);
    if (tab < 1) throw issueError("E_GIT_TREE_FORMAT", "Git returned an unsupported tree record.");
    const header = record.subarray(0, tab).toString("ascii").split(" ");
    if (header.length !== 3 || (header[1] !== "blob" && header[1] !== "commit")) {
      throw issueError("E_GIT_TREE_FORMAT", "Git returned an unsupported project tree entry.");
    }
    const filePath = record.subarray(tab + 1);
    return filePath.equals(checkpointPath)
      ? []
      : [canonicalEntry(header[0], header[2], filePath, objectFormat)];
  });
}

function canonicalEntry(
  mode: string | undefined,
  oid: string | undefined,
  path: Buffer,
  objectFormat: "sha1" | "sha256",
): Buffer {
  const objectIdLength = objectFormat === "sha1" ? 40 : 64;
  if (
    mode === undefined ||
    !VALID_ENTRY_MODES.has(mode) ||
    oid === undefined ||
    !objectId(oid, objectIdLength) ||
    path.length === 0
  ) {
    throw issueError("E_GIT_TREE_FORMAT", "Git returned an invalid project tree entry.");
  }
  return Buffer.concat([
    Buffer.from(mode, "ascii"),
    Buffer.from([0]),
    Buffer.from(oid, "ascii"),
    Buffer.from([0]),
    path,
    Buffer.from([0]),
  ]);
}

function commitment(entries: Buffer[], objectFormat: "sha1" | "sha256"): string {
  entries.sort(Buffer.compare);
  const hash = createHash("sha256");
  hash.update("carrylog-checkpoint-settlement/v1\0", "utf8");
  hash.update(objectFormat, "ascii");
  hash.update(Buffer.from([0]));
  for (const entry of entries) hash.update(entry);
  return hash.digest("hex");
}

function nullRecords(value: Buffer): Buffer[] {
  if (value.length === 0) return [];
  if (value[value.length - 1] !== 0) {
    throw issueError("E_GIT_TREE_FORMAT", "Git returned an unterminated NUL record stream.");
  }
  const records: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === 0) {
      if (index === start)
        throw issueError("E_GIT_TREE_FORMAT", "Git returned an empty tree record.");
      records.push(value.subarray(start, index));
      start = index + 1;
    }
  }
  return records;
}

function decodeText(value: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw issueError("E_GIT_ENCODING", "Git returned invalid UTF-8 for textual metadata.");
  }
}

function objectId(value: string, length: number): boolean {
  return value.length === length && /^[0-9a-f]+$/.test(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length > 0);
}

function sameSnapshot(left: GitSnapshot, right: GitSnapshot): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sameSettlementEvidence(
  left: CurrentSettlementEvidence,
  right: CurrentSettlementEvidence,
): boolean {
  return (
    left.objectFormat === right.objectFormat &&
    left.indexCommitment === right.indexCommitment &&
    left.committedCommitment === right.committedCommitment &&
    left.checkpointClean === right.checkpointClean &&
    left.parent === right.parent &&
    left.singleParent === right.singleParent
  );
}

async function runSettlementGit(
  cwd: string,
  arguments_: string[],
  allowedExitCodes?: number[],
): Promise<GitCommandResult> {
  return await runGitProcess(cwd, ["-c", "core.fsmonitor=false", ...arguments_], {
    ...(allowedExitCodes === undefined ? {} : { allowedExitCodes }),
  });
}
