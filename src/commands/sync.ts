import { upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { AckitError } from "../core/errors.js";
import { atomicWriteText, readTextIfExists } from "../core/files.js";
import { assertNoSymlink, resolveProjectPath } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { validateContext } from "../validation/validate.js";

export type ChangeKind = "create" | "update" | "unchanged";

export interface PlannedChange {
  path: string;
  kind: ChangeKind;
  content: string;
}

export interface SyncOptions {
  adopt: boolean;
  check: boolean;
  dryRun: boolean;
}

export interface SyncResult {
  changes: PlannedChange[];
  diagnostics: Diagnostic[];
  wrote: boolean;
  drift: boolean;
}

export async function syncProject(
  project: LoadedProject,
  options: SyncOptions,
): Promise<SyncResult> {
  const diagnostics = await validateContext(project);
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");
  if (errors.length > 0) {
    throw new AckitError("E_CONTEXT_INVALID", "Canonical context is invalid.", {
      diagnostics,
    });
  }

  const changes = await planAdapterChanges(project, options.adopt);
  const drift = changes.some((change) => change.kind !== "unchanged");
  const shouldWrite = drift && !options.check && !options.dryRun;

  if (shouldWrite) {
    for (const change of changes) {
      if (change.kind !== "unchanged") {
        const absolutePath = resolveProjectPath(project.root, change.path);
        await atomicWriteText(absolutePath, change.content);
      }
    }
  }

  return { changes, diagnostics, wrote: shouldWrite, drift };
}

export async function planAdapterChanges(
  project: LoadedProject,
  adopt: boolean,
): Promise<PlannedChange[]> {
  const changes: PlannedChange[] = [];
  const diagnostics: Diagnostic[] = [];

  for (const adapter of project.config.adapters) {
    const absolutePath = resolveProjectPath(project.root, adapter.output);
    try {
      await assertNoSymlink(project.root, absolutePath);
      const existing = await readTextIfExists(absolutePath);
      const content = upsertManagedBlock(existing, renderAdapter(project.config, adapter), {
        adopt,
      });
      changes.push({
        path: adapter.output,
        kind: existing === undefined ? "create" : existing === content ? "unchanged" : "update",
        content,
      });
    } catch (error) {
      if (error instanceof AckitError) {
        diagnostics.push(
          ...error.diagnostics.map((diagnostic) => ({ ...diagnostic, path: adapter.output })),
        );
      } else {
        diagnostics.push({
          level: "error",
          code: "E_ADAPTER_PLAN",
          message: error instanceof Error ? error.message : String(error),
          path: adapter.output,
        });
      }
    }
  }

  if (diagnostics.length > 0) {
    throw new AckitError("E_ADAPTER_PLAN", "Adapter changes could not be planned safely.", {
      diagnostics,
    });
  }
  return changes;
}
