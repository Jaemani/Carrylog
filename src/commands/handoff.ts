import path from "node:path";
import { assertLoadedProjectSnapshot } from "../config/load.js";
import { CarrylogError, issueError } from "../core/errors.js";
import { atomicWriteTexts, inspectAtomicPath, readTextIfExists } from "../core/files.js";
import { assertNoSymlink, resolveProjectPath } from "../core/paths.js";
import type { LoadedProject } from "../domain/types.js";
import { type GitSnapshot, inspectGitProject } from "../git/inspect.js";
import { renderHandoffSnapshot, upsertHandoffSnapshot } from "../handoff/snapshot-block.js";
import { validateContext } from "../validation/validate.js";
import type { ChangeKind } from "./sync.js";

export interface HandoffOptions {
  check: boolean;
  dryRun: boolean;
}

export interface HandoffResult {
  path: string;
  kind: ChangeKind;
  wrote: boolean;
  drift: boolean;
  snapshot: GitSnapshot;
}

export async function refreshHandoff(
  project: LoadedProject,
  options: HandoffOptions,
): Promise<HandoffResult> {
  await assertLoadedProjectSnapshot(project);
  const diagnostics = await validateContext(project);
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    throw new CarrylogError("E_CONTEXT_INVALID", "Canonical context is invalid.", { diagnostics });
  }

  const handoffDocument = project.config.documents.find((document) => document.id === "handoff");
  if (handoffDocument === undefined) {
    throw issueError(
      "E_HANDOFF_DOCUMENT",
      "Configuration does not define a document with id 'handoff'.",
    );
  }
  const portablePath = path.posix.join(".agent-context", handoffDocument.path);
  const absolutePath = resolveProjectPath(project.root, portablePath);
  await assertNoSymlink(project.root, absolutePath);
  const existing = await readTextIfExists(absolutePath);
  if (existing === undefined) {
    throw issueError("E_HANDOFF_MISSING", `Handoff document does not exist: ${portablePath}`);
  }

  const snapshot = await inspectGitProject(project.root, portablePath);
  const content = upsertHandoffSnapshot(existing, renderHandoffSnapshot(snapshot));
  const prospectiveDiagnostics = await validateContext(project, new Map([[portablePath, content]]));
  if (prospectiveDiagnostics.some((diagnostic) => diagnostic.level === "error")) {
    throw new CarrylogError(
      "E_HANDOFF_CONTEXT_INVALID",
      "Refreshed handoff would make canonical context invalid.",
      { diagnostics: prospectiveDiagnostics },
    );
  }
  const drift = content !== existing;
  const shouldWrite = drift && !options.check && !options.dryRun;
  if (shouldWrite) {
    await atomicWriteTexts(
      [
        {
          filePath: absolutePath,
          content,
          expectedContent: existing,
          guard: await inspectAtomicPath(project.root, absolutePath),
        },
      ],
      {
        preconditions: [
          {
            filePath: project.configPath,
            expectedContent: project.configSource,
            guard: await inspectAtomicPath(project.root, project.configPath),
          },
        ],
      },
    );
  }
  return {
    path: portablePath,
    kind: drift ? "update" : "unchanged",
    wrote: shouldWrite,
    drift,
    snapshot,
  };
}
