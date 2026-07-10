import { upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { assertLoadedProjectSnapshot } from "../config/load.js";
import { CarrylogError } from "../core/errors.js";
import { atomicWriteTexts, inspectAtomicPath, readTextIfExists } from "../core/files.js";
import { assertNoSymlink, resolveProjectPath } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { planContextV1Migrations } from "../migrations/context-v1.js";
import { PUBLIC_SCHEMA_PATH, readPublicSchema } from "../schema/public-schema.js";
import { validateContext } from "../validation/validate.js";

export type ChangeKind = "create" | "update" | "unchanged";

export interface PlannedChange {
  path: string;
  kind: ChangeKind;
  content: string;
  expectedContent: string | null;
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
  await assertLoadedProjectSnapshot(project);
  const migrationChanges = await planContextV1Migrations(project);
  const migrationOverrides = new Map(
    migrationChanges.map((change) => [change.path, change.content] as const),
  );
  const diagnostics = await validateContext(project, migrationOverrides);
  const errors = diagnostics.filter((diagnostic) => diagnostic.level === "error");
  if (errors.length > 0) {
    throw new CarrylogError("E_CONTEXT_INVALID", "Canonical context is invalid.", {
      diagnostics,
    });
  }

  const changes = [
    ...migrationChanges,
    await planPublicSchemaChange(project),
    ...(await planAdapterChanges(project, options.adopt)),
  ];
  const drift = changes.some((change) => change.kind !== "unchanged");
  const shouldWrite = drift && !options.check && !options.dryRun;

  if (shouldWrite) {
    const writes = await Promise.all(
      changes
        .filter((change) => change.kind !== "unchanged")
        .map(async (change) => {
          const absolutePath = resolveProjectPath(project.root, change.path);
          return {
            filePath: absolutePath,
            content: change.content,
            expectedContent: change.expectedContent,
            guard: await inspectAtomicPath(project.root, absolutePath),
          };
        }),
    );
    await atomicWriteTexts(writes, {
      preconditions: [
        {
          filePath: project.configPath,
          expectedContent: project.configSource,
          guard: await inspectAtomicPath(project.root, project.configPath),
        },
      ],
    });
  }

  return { changes, diagnostics, wrote: shouldWrite, drift };
}

export async function planPublicSchemaChange(project: LoadedProject): Promise<PlannedChange> {
  const absolutePath = resolveProjectPath(project.root, PUBLIC_SCHEMA_PATH);
  await assertNoSymlink(project.root, absolutePath);
  const existing = await readTextIfExists(absolutePath, { maxBytes: 1024 * 1024 });
  const content = readPublicSchema();
  return {
    path: PUBLIC_SCHEMA_PATH,
    kind: existing === undefined ? "create" : existing === content ? "unchanged" : "update",
    content,
    expectedContent: existing ?? null,
  };
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
        expectedContent: existing ?? null,
      });
    } catch (error) {
      if (error instanceof CarrylogError) {
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
    throw new CarrylogError("E_ADAPTER_PLAN", "Adapter changes could not be planned safely.", {
      diagnostics,
    });
  }
  return changes;
}
