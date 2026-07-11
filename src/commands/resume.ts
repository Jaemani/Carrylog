import path from "node:path";
import { assertLoadedProjectSnapshot } from "../config/load.js";
import {
  contentDigest,
  getCheckpointDocument,
  parseCheckpointSections,
} from "../continuity/checkpoint.js";
import { CarrylogError, issueError } from "../core/errors.js";
import { type GuardedTextRead, readGuardedText } from "../core/files.js";
import { resolveProjectPath } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { type GitSnapshot, inspectGitProject } from "../git/inspect.js";
import { renderHandoffSnapshot, upsertHandoffSnapshot } from "../handoff/snapshot-block.js";
import { validateContext } from "../validation/validate.js";
import { validateProject } from "./validate.js";

const MAX_CONTEXT_DOCUMENT_BYTES = 1024 * 1024;
const MAX_CANONICAL_CONTEXT_BYTES = 8 * 1024 * 1024;
const MAX_RESUME_ATTEMPTS = 3;

export interface ResumeDocument {
  id: string;
  path: string;
  description: string;
  sha256: string;
  content?: string;
  triggers?: readonly string[];
}

export interface ResumeGitCommit {
  sha: string;
  shortSha: string;
  subject: string;
}

export interface ResumeGitSnapshot extends Omit<GitSnapshot, "head" | "recentCommits"> {
  head?: ResumeGitCommit;
  recentCommits: ResumeGitCommit[];
}

export interface ResumeEnvelope {
  formatVersion: 1;
  project: {
    name: string;
    configVersion: 1 | 2;
    configPath: ".agent-context/config.yaml";
    configSha256: string;
  };
  checkpoint: {
    document: string;
    sha256: string;
    stale: boolean;
    sections: ReturnType<typeof parseCheckpointSections>;
  };
  git: ResumeGitSnapshot;
  alwaysContext: ResumeDocument[];
  onDemandCatalog: ResumeDocument[];
  diagnostics: Diagnostic[];
}

interface ContextObservation {
  config: GuardedTextRead;
  documents: Map<string, GuardedTextRead>;
}

export async function createResumeEnvelope(project: LoadedProject): Promise<ResumeEnvelope> {
  await assertLoadedProjectSnapshot(project);
  if (project.config.version !== 2) {
    throw issueError(
      "E_RESUME_REQUIRES_V2",
      "Portable resume requires configuration version 2.",
      "Review and run 'carrylog migrate --to 2' before resuming.",
    );
  }
  const validation = await validateProject(project);
  if (!validation.valid) {
    throw new CarrylogError("E_CONTEXT_INVALID", "Cannot resume from invalid project context.", {
      diagnostics: validation.diagnostics,
    });
  }

  const checkpointDocument = getCheckpointDocument(project.config);
  if (checkpointDocument === undefined) {
    throw issueError(
      "E_CHECKPOINT_DOCUMENT",
      "Configuration does not define a checkpoint document.",
    );
  }
  const checkpointPath = contextPath(checkpointDocument.path);

  for (let attempt = 0; attempt < MAX_RESUME_ATTEMPTS; attempt += 1) {
    const before = await observeContext(project);
    const git = await inspectGitProject(project.root, checkpointPath);
    const after = await observeContext(project);
    if (!sameObservation(before, after)) continue;

    const observedContextDiagnostics = await validateContext(
      project,
      contextOverrides(project, after),
    );
    if (observedContextDiagnostics.some((diagnostic) => diagnostic.level === "error")) {
      throw new CarrylogError(
        "E_CONTEXT_INVALID",
        "Cannot resume from invalid observed project context.",
        { diagnostics: observedContextDiagnostics },
      );
    }

    const checkpointRead = after.documents.get(checkpointDocument.id);
    if (checkpointRead === undefined) {
      throw issueError(
        "E_PROJECT_SNAPSHOT",
        `Observed checkpoint is missing: ${checkpointDocument.id}`,
      );
    }
    const renderedCurrent = upsertHandoffSnapshot(checkpointRead.text, renderHandoffSnapshot(git));
    const stale = renderedCurrent !== checkpointRead.text;
    const diagnostics: Diagnostic[] = uniqueDiagnostics([
      ...validation.diagnostics.filter((diagnostic) => diagnostic.level === "warning"),
      ...observedContextDiagnostics.filter((diagnostic) => diagnostic.level === "warning"),
      ...(stale
        ? [
            {
              level: "warning" as const,
              code: "W_CHECKPOINT_STALE",
              message: "Checkpoint Git evidence does not match the current repository state.",
              path: checkpointPath,
              hint: "Update the checkpoint narrative and run 'carrylog checkpoint'.",
            },
          ]
        : []),
    ]);
    const alwaysContext: ResumeDocument[] = [];
    const onDemandCatalog: ResumeDocument[] = [];
    for (const document of project.config.documents) {
      const read = after.documents.get(document.id);
      if (read === undefined) {
        throw issueError("E_PROJECT_SNAPSHOT", `Observed context is missing: ${document.id}`);
      }
      const item: ResumeDocument = {
        id: document.id,
        path: contextPath(document.path),
        description: document.description,
        sha256: contentDigest(read.bytes),
        ...(document.triggers === undefined ? {} : { triggers: document.triggers }),
        ...(document.load === "always" && document.id !== checkpointDocument.id
          ? { content: read.text }
          : {}),
      };
      if (document.load === "always" && document.id !== checkpointDocument.id) {
        alwaysContext.push(item);
      } else if (document.load === "on-demand") {
        onDemandCatalog.push(item);
      }
    }

    return {
      formatVersion: 1,
      project: {
        name: project.config.project.name,
        configVersion: project.config.version,
        configPath: ".agent-context/config.yaml",
        configSha256: contentDigest(after.config.bytes),
      },
      checkpoint: {
        document: checkpointPath,
        sha256: contentDigest(checkpointRead.bytes),
        stale,
        sections: parseCheckpointSections(checkpointRead.text, checkpointPath),
      },
      git: projectGitSnapshot(git),
      alwaysContext,
      onDemandCatalog,
      diagnostics,
    };
  }
  throw issueError(
    "E_CONCURRENT_MODIFICATION",
    `Project context changed during ${MAX_RESUME_ATTEMPTS} resume attempts.`,
    "Retry after concurrent context and repository updates finish.",
  );
}

function contextOverrides(
  project: LoadedProject,
  observation: ContextObservation,
): Map<string, string> {
  const overrides = new Map<string, string>();
  for (const document of project.config.documents) {
    const read = observation.documents.get(document.id);
    if (read !== undefined) overrides.set(contextPath(document.path), read.text);
  }
  return overrides;
}

function uniqueDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>();
  return diagnostics.filter((diagnostic) => {
    const key = JSON.stringify(diagnostic);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function observeContext(project: LoadedProject): Promise<ContextObservation> {
  const config = await readGuardedText(project.root, project.configPath, {
    maxBytes: MAX_CONTEXT_DOCUMENT_BYTES,
    rejectHardLinks: true,
  });
  let totalBytes = config.bytes.byteLength;
  if (config.text !== project.configSource) {
    throw issueError(
      "E_CONCURRENT_MODIFICATION",
      "Configuration changed after the project was loaded.",
    );
  }
  const documents = new Map<string, GuardedTextRead>();
  for (const document of project.config.documents) {
    const filePath = resolveProjectPath(project.root, contextPath(document.path));
    const read = await readGuardedText(project.root, filePath, {
      maxBytes: MAX_CONTEXT_DOCUMENT_BYTES,
      rejectHardLinks: true,
    });
    totalBytes += read.bytes.byteLength;
    if (totalBytes > MAX_CANONICAL_CONTEXT_BYTES) {
      throw issueError(
        "E_CONTEXT_AGGREGATE_TOO_LARGE",
        `Portable resume context exceeds the ${MAX_CANONICAL_CONTEXT_BYTES}-byte aggregate read limit.`,
        "Reduce or split large context documents before resuming.",
      );
    }
    documents.set(document.id, read);
  }
  return { config, documents };
}

function sameObservation(left: ContextObservation, right: ContextObservation): boolean {
  if (!sameGuardedRead(left.config, right.config)) return false;
  if (left.documents.size !== right.documents.size) return false;
  for (const [id, read] of left.documents) {
    const other = right.documents.get(id);
    if (other === undefined || !sameGuardedRead(read, other)) return false;
  }
  return true;
}

function sameGuardedRead(left: GuardedTextRead, right: GuardedTextRead): boolean {
  return (
    left.bytes.equals(right.bytes) &&
    left.metadata.device === right.metadata.device &&
    left.metadata.inode === right.metadata.inode &&
    left.metadata.size === right.metadata.size &&
    left.metadata.mtimeNs === right.metadata.mtimeNs &&
    left.metadata.ctimeNs === right.metadata.ctimeNs &&
    left.metadata.linkCount === right.metadata.linkCount
  );
}

function projectGitSnapshot(snapshot: GitSnapshot): ResumeGitSnapshot {
  const projected: ResumeGitSnapshot = {
    detached: snapshot.detached,
    changes: snapshot.changes,
    omittedChanges: snapshot.omittedChanges,
    staged: snapshot.staged,
    unstaged: snapshot.unstaged,
    untracked: snapshot.untracked,
    conflicted: snapshot.conflicted,
    stagedDiff: snapshot.stagedDiff,
    unstagedDiff: snapshot.unstagedDiff,
    recentCommits: snapshot.recentCommits.map(projectCommit),
  };
  if (snapshot.branch !== undefined) projected.branch = snapshot.branch;
  if (snapshot.head !== undefined) projected.head = projectCommit(snapshot.head);
  if (snapshot.upstream !== undefined) projected.upstream = snapshot.upstream;
  if (snapshot.ahead !== undefined) projected.ahead = snapshot.ahead;
  if (snapshot.behind !== undefined) projected.behind = snapshot.behind;
  return projected;
}

function projectCommit(commit: GitSnapshot["recentCommits"][number]): ResumeGitCommit {
  return { sha: commit.sha, shortSha: commit.shortSha, subject: commit.subject };
}

function contextPath(documentPath: string): string {
  return path.posix.join(".agent-context", documentPath);
}
