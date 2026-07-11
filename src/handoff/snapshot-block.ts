import { issueError } from "../core/errors.js";
import { detectTextEol, standaloneMarkerLines } from "../core/marker-lines.js";
import { stringifyTerminalSafeJson } from "../core/text.js";
import type { GitSnapshot } from "../git/inspect.js";

export const HANDOFF_SNAPSHOT_START = "<!-- agent-context-kit:handoff-snapshot:start -->";
export const HANDOFF_SNAPSHOT_END = "<!-- agent-context-kit:handoff-snapshot:end -->";

export function renderHandoffSnapshot(snapshot: GitSnapshot): string {
  const branch = snapshot.branch ?? (snapshot.detached ? "(detached HEAD)" : "(unborn branch)");
  const head = snapshot.head
    ? `${snapshot.head.shortSha} at ${snapshot.head.committedAt}`
    : "No commit yet";
  const divergence =
    snapshot.upstream === undefined
      ? "No upstream configured"
      : `${snapshot.upstream}; ahead ${snapshot.ahead ?? "?"}, behind ${snapshot.behind ?? "?"}`;
  const summary =
    snapshot.changes.length === 0 && snapshot.omittedChanges === 0
      ? "Clean (snapshot file excluded)"
      : `${snapshot.staged} staged, ${snapshot.unstaged} unstaged, ${snapshot.untracked} untracked, ${snapshot.conflicted} conflicted`;
  const stagedDiff = formatDiff(snapshot.stagedDiff);
  const unstagedDiff = formatDiff(snapshot.unstagedDiff);
  const lines = [
    "## Repository evidence",
    "",
    `- Branch: ${stringifyEvidence(branch)}`,
    `- HEAD: ${stringifyEvidence(head)}`,
    `- Upstream: ${stringifyEvidence(divergence)}`,
    `- Working tree: ${summary}`,
    `- Staged diff: ${stagedDiff}`,
    `- Unstaged diff: ${unstagedDiff}`,
    "- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded",
  ];

  lines.push("", `### Changed paths (${snapshot.changes.length + snapshot.omittedChanges})`, "");
  if (snapshot.changes.length === 0) {
    lines.push("None.");
  } else {
    for (const change of snapshot.changes) {
      lines.push(`    ${stringifyEvidence(change)}`);
    }
    if (snapshot.omittedChanges > 0) {
      lines.push(`    ${stringifyEvidence({ omitted: snapshot.omittedChanges })}`);
    }
  }

  lines.push("", `### Recent commits (${snapshot.recentCommits.length})`, "");
  if (snapshot.recentCommits.length === 0) {
    lines.push("None.");
  } else {
    for (const commit of snapshot.recentCommits) {
      lines.push(
        `    ${stringifyEvidence({ commit: commit.shortSha, committedAt: commit.committedAt, subject: commit.subject })}`,
      );
    }
  }
  return lines.join("\n");
}

function stringifyEvidence(value: unknown): string {
  return stringifyTerminalSafeJson(value);
}

function formatDiff(diff: GitSnapshot["stagedDiff"]): string {
  return `${diff.files} file(s), +${diff.insertions}/-${diff.deletions}, ${diff.binaryFiles} binary`;
}

export function upsertHandoffSnapshot(existing: string, body: string): string {
  validateHandoffSnapshotMarkers(existing);
  if (
    standaloneMarkerLines(body, HANDOFF_SNAPSHOT_START).length > 0 ||
    standaloneMarkerLines(body, HANDOFF_SNAPSHOT_END).length > 0
  ) {
    throw issueError(
      "E_HANDOFF_BODY_MARKER",
      "Generated handoff content must not contain standalone repository-evidence markers.",
    );
  }
  const starts = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_START);
  const ends = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_END);

  const eol = detectTextEol(existing);
  const block = wrap(body, eol);
  if (starts.length === 1 && ends.length === 1) {
    const start = starts[0];
    const end = ends[0];
    if (start === undefined || end === undefined) {
      throw new Error("Validated handoff marker positions are unavailable.");
    }
    return `${existing.slice(0, start)}${block}${existing.slice(end + HANDOFF_SNAPSHOT_END.length)}`;
  }

  const firstLineEnd = existing.indexOf("\n");
  if (firstLineEnd === -1) return `${existing}${eol}${eol}${block}${eol}`;
  const insertion = firstLineEnd + 1;
  return `${existing.slice(0, insertion)}${eol}${block}${eol}${existing.slice(insertion)}`;
}

export function validateHandoffSnapshotMarkers(existing: string): void {
  const starts = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_START);
  const ends = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_END);
  if (starts.length !== ends.length || starts.length > 1) {
    throw issueError(
      "E_HANDOFF_MARKERS",
      "Handoff has missing or duplicate repository-evidence markers.",
      "Restore exactly one snapshot start marker and one snapshot end marker.",
    );
  }
  if (
    starts.length === 1 &&
    (ends[0] ?? Number.POSITIVE_INFINITY) < (starts[0] ?? Number.NEGATIVE_INFINITY)
  ) {
    throw issueError("E_HANDOFF_MARKERS", "Handoff snapshot end marker precedes its start marker.");
  }
}

export function withoutHandoffSnapshot(existing: string): string {
  validateHandoffSnapshotMarkers(existing);
  const start = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_START)[0];
  const end = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_END)[0];
  if (start === undefined || end === undefined) return existing;
  return `${existing.slice(0, start)}${existing.slice(end + HANDOFF_SNAPSHOT_END.length)}`;
}

export function extractHandoffSnapshotBody(existing: string): string | undefined {
  validateHandoffSnapshotMarkers(existing);
  const start = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_START)[0];
  const end = standaloneMarkerLines(existing, HANDOFF_SNAPSHOT_END)[0];
  if (start === undefined || end === undefined) return undefined;
  const eol = detectTextEol(existing);
  const raw = existing.slice(start + HANDOFF_SNAPSHOT_START.length, end);
  if (!raw.startsWith(eol) || !raw.endsWith(eol)) return undefined;
  return raw.slice(eol.length, -eol.length);
}

function wrap(body: string, eol: string): string {
  const normalized = body.trim().replaceAll("\r\n", "\n").replaceAll("\n", eol);
  return `${HANDOFF_SNAPSHOT_START}${eol}${normalized}${eol}${HANDOFF_SNAPSHOT_END}`;
}
