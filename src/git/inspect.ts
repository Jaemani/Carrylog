import { spawn } from "node:child_process";
import { CarrylogError, issueError } from "../core/errors.js";

const MAX_GIT_OUTPUT_BYTES = 1024 * 1024;
const MAX_CHANGED_PATHS = 200;
const MAX_GIT_SNAPSHOT_ATTEMPTS = 3;
const GIT_TIMEOUT_MS = 10_000;
const GIT_TERMINATION_GRACE_MS = 250;

export interface GitCommitEvidence {
  sha: string;
  shortSha: string;
  committedAt: string;
  subject: string;
}

export interface GitChangeEvidence {
  status: string;
  path: string;
  pathEncoding?: "hex";
  originalPath?: string;
  originalPathEncoding?: "hex";
  originalPathScope?: "repository";
}

export interface GitDiffEvidence {
  files: number;
  insertions: number;
  deletions: number;
  binaryFiles: number;
}

export interface GitSnapshot {
  branch?: string;
  detached: boolean;
  head?: GitCommitEvidence;
  upstream?: string;
  ahead?: number;
  behind?: number;
  changes: GitChangeEvidence[];
  omittedChanges: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
  stagedDiff: GitDiffEvidence;
  unstagedDiff: GitDiffEvidence;
  recentCommits: GitCommitEvidence[];
}

export interface GitCommandResult {
  code: number;
  stdout: Buffer;
  stderr: Buffer;
}

export type GitCommandRunner = (
  cwd: string,
  arguments_: string[],
  allowedExitCodes?: number[],
) => Promise<GitCommandResult>;

interface GitObservation {
  branch: GitCommandResult;
  prefix: GitCommandResult;
  head: GitCommandResult;
  upstream: GitCommandResult;
  divergence: GitCommandResult;
  status: GitCommandResult;
  stagedDiff: GitCommandResult;
  unstagedDiff: GitCommandResult;
  recent: GitCommandResult;
}

interface GitProcessOptions {
  allowedExitCodes?: number[];
  command?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  terminationGraceMs?: number;
}

export async function inspectGitProject(
  projectRoot: string,
  handoffPath: string,
): Promise<GitSnapshot> {
  return await inspectGitProjectWithRunner(projectRoot, handoffPath, runGit);
}

export async function inspectGitProjectWithRunner(
  projectRoot: string,
  handoffPath: string,
  executeGit: GitCommandRunner,
): Promise<GitSnapshot> {
  const repositoryCheck = await executeGit(
    projectRoot,
    ["rev-parse", "--is-inside-work-tree"],
    [0, 128],
  );
  if (repositoryCheck.code !== 0 || decode(repositoryCheck.stdout).trim() !== "true") {
    throw issueError("E_NOT_GIT_REPOSITORY", "Project is not inside a Git working tree.");
  }

  const excludeHandoff = `:(exclude,literal)${handoffPath}`;
  for (let attempt = 0; attempt < MAX_GIT_SNAPSHOT_ATTEMPTS; attempt += 1) {
    const before = await observeGitProject(projectRoot, excludeHandoff, executeGit);
    const after = await observeGitProject(projectRoot, excludeHandoff, executeGit);
    if (gitObservationFingerprintsMatch(before, after)) {
      return buildGitSnapshot(after);
    }
  }
  throw issueError(
    "E_GIT_CONCURRENT_MODIFICATION",
    `Git repository changed during ${MAX_GIT_SNAPSHOT_ATTEMPTS} snapshot attempts.`,
    "Retry after concurrent Git and working-tree updates finish.",
  );
}

async function observeGitProject(
  projectRoot: string,
  excludeHandoff: string,
  executeGit: GitCommandRunner,
): Promise<GitObservation> {
  const [branch, prefix, head, upstream, divergence, status, stagedDiff, unstagedDiff, recent] =
    await Promise.all([
      executeGit(projectRoot, ["symbolic-ref", "--quiet", "--short", "HEAD"], [0, 1]),
      executeGit(projectRoot, ["rev-parse", "--show-prefix"]),
      executeGit(projectRoot, ["show", "-s", "--format=%H%x09%h%x09%cI%x09%s", "HEAD"], [0, 128]),
      executeGit(
        projectRoot,
        ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"],
        [0, 128],
      ),
      executeGit(
        projectRoot,
        ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"],
        [0, 128],
      ),
      executeGit(projectRoot, [
        "-c",
        "core.quotepath=false",
        "-c",
        "status.relativePaths=true",
        "-c",
        "status.renames=true",
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--",
        ".",
        excludeHandoff,
      ]),
      executeGit(
        projectRoot,
        [
          "diff",
          "--cached",
          "--no-ext-diff",
          "--no-textconv",
          "--numstat",
          "-z",
          "--",
          ".",
          excludeHandoff,
        ],
        [0, 128],
      ),
      executeGit(projectRoot, [
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--numstat",
        "-z",
        "--",
        ".",
        excludeHandoff,
      ]),
      executeGit(
        projectRoot,
        ["log", "-n", "5", "--format=%H%x09%h%x09%cI%x09%s", "--", ".", excludeHandoff],
        [0, 128],
      ),
    ]);
  return { branch, prefix, head, upstream, divergence, status, stagedDiff, unstagedDiff, recent };
}

function buildGitSnapshot(observation: GitObservation): GitSnapshot {
  const branch = nonEmpty(decode(observation.branch.stdout).trim());
  const head =
    observation.head.code === 0
      ? parseCommitLine(decode(observation.head.stdout).trim())
      : undefined;
  const upstream =
    observation.upstream.code === 0
      ? nonEmpty(decode(observation.upstream.stdout).trim())
      : undefined;
  const repositoryPrefix = decode(observation.prefix.stdout).trimEnd();
  const { changes, omittedChanges, staged, unstaged, untracked, conflicted } = parseGitStatus(
    observation.status.stdout,
    repositoryPrefix,
  );
  const recentCommits =
    observation.recent.code === 0
      ? decode(observation.recent.stdout)
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map(parseCommitLine)
      : [];

  const snapshot: GitSnapshot = {
    detached: branch === undefined && head !== undefined,
    changes,
    omittedChanges,
    staged,
    unstaged,
    untracked,
    conflicted,
    stagedDiff: parseGitNumstat(
      observation.stagedDiff.code === 0 ? observation.stagedDiff.stdout : Buffer.alloc(0),
    ),
    unstagedDiff: parseGitNumstat(observation.unstagedDiff.stdout),
    recentCommits,
  };
  if (branch !== undefined) snapshot.branch = branch;
  if (head !== undefined) snapshot.head = head;
  if (upstream !== undefined) snapshot.upstream = upstream;
  if (upstream !== undefined && observation.divergence.code === 0) {
    const [ahead, behind] = decode(observation.divergence.stdout).trim().split(/\s+/).map(Number);
    if (ahead !== undefined && Number.isSafeInteger(ahead)) snapshot.ahead = ahead;
    if (behind !== undefined && Number.isSafeInteger(behind)) snapshot.behind = behind;
  }
  return snapshot;
}

function gitObservationFingerprintsMatch(left: GitObservation, right: GitObservation): boolean {
  for (const key of Object.keys(left) as (keyof GitObservation)[]) {
    const leftResult = left[key];
    const rightResult = right[key];
    if (
      leftResult.code !== rightResult.code ||
      !leftResult.stdout.equals(rightResult.stdout) ||
      !leftResult.stderr.equals(rightResult.stderr)
    ) {
      return false;
    }
  }
  return true;
}

export function parseGitNumstat(output: Buffer): GitDiffEvidence {
  let files = 0;
  let insertions = 0;
  let deletions = 0;
  let binaryFiles = 0;
  for (const record of splitNullRecords(output)) {
    const firstTab = record.indexOf(0x09);
    const secondTab = firstTab < 0 ? -1 : record.indexOf(0x09, firstTab + 1);
    if (firstTab < 1 || secondTab < firstTab + 2) continue;
    const added = record.subarray(0, firstTab).toString("ascii");
    const removed = record.subarray(firstTab + 1, secondTab).toString("ascii");
    files += 1;
    if (added === "-" && removed === "-") {
      binaryFiles += 1;
      continue;
    }
    if (!/^\d+$/.test(added) || !/^\d+$/.test(removed)) {
      throw issueError("E_GIT_DIFF_FORMAT", "Git returned an unsupported numstat record.");
    }
    const addedCount = Number(added);
    const removedCount = Number(removed);
    if (!Number.isSafeInteger(addedCount) || !Number.isSafeInteger(removedCount)) {
      throw issueError("E_GIT_DIFF_FORMAT", "Git numstat exceeded safe integer bounds.");
    }
    insertions += addedCount;
    deletions += removedCount;
    if (!Number.isSafeInteger(insertions) || !Number.isSafeInteger(deletions)) {
      throw issueError("E_GIT_DIFF_FORMAT", "Git numstat totals exceeded safe integer bounds.");
    }
  }
  return { files, insertions, deletions, binaryFiles };
}

export function parseGitStatus(
  output: Buffer,
  repositoryPrefix = "",
): {
  changes: GitChangeEvidence[];
  omittedChanges: number;
  staged: number;
  unstaged: number;
  untracked: number;
  conflicted: number;
} {
  const entries = splitNullRecords(output);
  const changes: GitChangeEvidence[] = [];
  let total = 0;
  let staged = 0;
  let unstaged = 0;
  let untracked = 0;
  let conflicted = 0;
  const conflictCodes = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry === undefined || entry.length === 0) continue;
    if (entry.length < 4 || entry[2] !== 0x20) {
      throw issueError(
        "E_GIT_STATUS_FORMAT",
        "Git returned an unsupported porcelain status record.",
      );
    }
    const status = entry.subarray(0, 2).toString("ascii");
    const decodedPath = decodeGitPath(stripRepositoryPrefix(entry.subarray(3), repositoryPrefix));
    const change: GitChangeEvidence = { status, path: decodedPath.value };
    if (decodedPath.encoding !== undefined) change.pathEncoding = decodedPath.encoding;
    if (status.includes("R") || status.includes("C")) {
      const originalPathRecord = entries[index + 1];
      if (originalPathRecord === undefined || originalPathRecord.length === 0) {
        throw issueError("E_GIT_STATUS_FORMAT", "Git rename status is missing its original path.");
      }
      const originalIsProjectRelative = hasRepositoryPrefix(originalPathRecord, repositoryPrefix);
      const originalPath = decodeGitPath(
        originalIsProjectRelative
          ? stripRepositoryPrefix(originalPathRecord, repositoryPrefix)
          : originalPathRecord,
      );
      change.originalPath = originalPath.value;
      if (originalPath.encoding !== undefined) {
        change.originalPathEncoding = originalPath.encoding;
      }
      if (!originalIsProjectRelative) change.originalPathScope = "repository";
      index += 1;
    }
    total += 1;
    if (status === "??") {
      untracked += 1;
    } else {
      if (conflictCodes.has(status)) conflicted += 1;
      if (status[0] !== " ") staged += 1;
      if (status[1] !== " ") unstaged += 1;
    }
    changes.push(change);
  }
  changes.sort(compareChanges);
  const renderedChanges = changes.slice(0, MAX_CHANGED_PATHS);
  return {
    changes: renderedChanges,
    omittedChanges: total - renderedChanges.length,
    staged,
    unstaged,
    untracked,
    conflicted,
  };
}

function parseCommitLine(line: string): GitCommitEvidence {
  const [sha, shortSha, committedAt, ...subjectParts] = line.split("\t");
  if (!sha || !shortSha || !committedAt) {
    throw issueError("E_GIT_LOG_FORMAT", "Git returned an unsupported commit record.");
  }
  return { sha, shortSha, committedAt, subject: subjectParts.join("\t") };
}

function compareChanges(left: GitChangeEvidence, right: GitChangeEvidence): number {
  return left.path < right.path ? -1 : left.path > right.path ? 1 : 0;
}

async function runGit(
  cwd: string,
  arguments_: string[],
  allowedExitCodes: number[] = [0],
): Promise<GitCommandResult> {
  return await runGitProcess(cwd, ["-c", "core.fsmonitor=false", ...arguments_], {
    allowedExitCodes,
  });
}

export async function runGitProcess(
  cwd: string,
  arguments_: string[],
  options: GitProcessOptions = {},
): Promise<GitCommandResult> {
  const allowedExitCodes = options.allowedExitCodes ?? [0];
  const timeoutMs = options.timeoutMs ?? GIT_TIMEOUT_MS;
  const maxOutputBytes = options.maxOutputBytes ?? MAX_GIT_OUTPUT_BYTES;
  const terminationGraceMs = options.terminationGraceMs ?? GIT_TERMINATION_GRACE_MS;
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    !Number.isSafeInteger(maxOutputBytes) ||
    maxOutputBytes < 1 ||
    !Number.isSafeInteger(terminationGraceMs) ||
    terminationGraceMs < 1
  ) {
    throw new TypeError("Git process limits must be positive safe integers.");
  }
  return await new Promise((resolve, reject) => {
    const child = spawn(options.command ?? "git", arguments_, {
      cwd,
      env: createGitEnvironment(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let outputBytes = 0;
    let terminationReason: "timeout" | "output" | undefined;
    let settled = false;
    let killTimer: NodeJS.Timeout | undefined;

    const deadline = setTimeout(() => {
      if (terminationReason === undefined) {
        terminationReason = "timeout";
        terminate();
      }
    }, timeoutMs);
    deadline.unref();

    function terminate(): void {
      child.kill("SIGTERM");
      if (killTimer === undefined) {
        killTimer = setTimeout(() => child.kill("SIGKILL"), terminationGraceMs);
        killTimer.unref();
      }
    }

    function collect(chunk: Buffer, target: Buffer[]): void {
      outputBytes += chunk.length;
      if (outputBytes > maxOutputBytes && terminationReason === undefined) {
        terminationReason = "output";
        terminate();
      } else if (terminationReason === undefined) {
        target.push(chunk);
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      collect(chunk, stdout);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBytes += chunk.length;
      collect(chunk, stderr);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (killTimer !== undefined) clearTimeout(killTimer);
      if (isNodeError(error) && error.code === "ENOENT") {
        reject(issueError("E_GIT_UNAVAILABLE", "Git executable was not found on PATH."));
      } else {
        reject(
          new CarrylogError("E_GIT_PROCESS", "Git process could not be started.", { cause: error }),
        );
      }
    });
    child.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      if (killTimer !== undefined) clearTimeout(killTimer);
      if (terminationReason === "output") {
        reject(
          issueError(
            "E_GIT_OUTPUT_LIMIT",
            `Git output exceeded the ${maxOutputBytes}-byte combined safety limit.`,
          ),
        );
        return;
      }
      if (terminationReason === "timeout") {
        reject(issueError("E_GIT_TIMEOUT", `Git process exceeded the ${timeoutMs} ms deadline.`));
        return;
      }
      if (signal !== null) {
        reject(issueError("E_GIT_SIGNAL", `Git process ended unexpectedly by signal ${signal}.`));
        return;
      }
      const exitCode = code ?? -1;
      const result = {
        code: exitCode,
        stdout: Buffer.concat(stdout, stdoutBytes),
        stderr: Buffer.concat(stderr, stderrBytes),
      };
      if (!allowedExitCodes.includes(exitCode)) {
        const detail = new TextDecoder("utf-8").decode(result.stderr).trim();
        reject(
          issueError(
            "E_GIT_COMMAND",
            `Git command failed with exit ${exitCode}.${detail ? ` ${detail}` : ""}`,
          ),
        );
        return;
      }
      resolve(result);
    });
  });
}

function decode(value: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(value);
  } catch {
    throw issueError("E_GIT_ENCODING", "Git returned invalid UTF-8 for textual metadata.");
  }
}

function decodeGitPath(value: Buffer): { value: string; encoding?: "hex" } {
  try {
    return { value: new TextDecoder("utf-8", { fatal: true }).decode(value) };
  } catch {
    return { value: value.toString("hex"), encoding: "hex" };
  }
}

function splitNullRecords(value: Buffer): Buffer[] {
  const records: Buffer[] = [];
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === 0) {
      records.push(value.subarray(start, index));
      start = index + 1;
    }
  }
  if (start < value.length) records.push(value.subarray(start));
  return records;
}

function stripRepositoryPrefix(value: Buffer, repositoryPrefix: string): Buffer {
  if (repositoryPrefix.length === 0) return value;
  const prefix = Buffer.from(repositoryPrefix, "utf8");
  if (!value.subarray(0, prefix.length).equals(prefix)) {
    throw issueError(
      "E_GIT_STATUS_SCOPE",
      "Git returned a changed path outside the requested project scope.",
    );
  }
  return value.subarray(prefix.length);
}

function hasRepositoryPrefix(value: Buffer, repositoryPrefix: string): boolean {
  if (repositoryPrefix.length === 0) return true;
  const prefix = Buffer.from(repositoryPrefix, "utf8");
  return value.subarray(0, prefix.length).equals(prefix);
}

function createGitEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.toUpperCase().startsWith("GIT_")) environment[key] = value;
  }
  environment["GIT_OPTIONAL_LOCKS"] = "0";
  environment["GIT_TERMINAL_PROMPT"] = "0";
  environment["GIT_PAGER"] = "cat";
  environment["LC_ALL"] = "C";
  return environment;
}

function nonEmpty(value: string): string | undefined {
  return value.length === 0 ? undefined : value;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
