import path from "node:path";
import { upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { decodeConfig } from "../config/decode.js";
import { CarrylogError, EXIT_USAGE, issueError } from "../core/errors.js";
import { atomicWriteTexts, inspectAtomicPath, readTextIfExists } from "../core/files.js";
import { assertNoSymlink, canonicalProjectRoot, resolveProjectPath } from "../core/paths.js";
import type { HarnessType } from "../domain/types.js";
import { createDefaultConfigV2, createTemplateFiles } from "../templates/defaults.js";
import type { PlannedChange } from "./sync.js";

export interface InitOptions {
  root: string;
  name?: string;
  adapters: HarnessType[];
  adopt: boolean;
  dryRun: boolean;
}

export interface InitResult {
  changes: PlannedChange[];
  wrote: boolean;
}

export async function initProject(options: InitOptions): Promise<InitResult> {
  if (
    options === null ||
    typeof options !== "object" ||
    typeof options.root !== "string" ||
    (options.name !== undefined && typeof options.name !== "string") ||
    !Array.isArray(options.adapters) ||
    options.adapters.length === 0 ||
    options.adapters.some(
      (adapter) =>
        adapter !== "codex" && adapter !== "claude" && adapter !== "cursor" && adapter !== "gemini",
    ) ||
    typeof options.adopt !== "boolean" ||
    typeof options.dryRun !== "boolean"
  ) {
    throw new CarrylogError("E_CONFIG_INVALID", "Initialization options are invalid.", {
      exitCode: EXIT_USAGE,
    });
  }
  const root = await canonicalProjectRoot(options.root);
  const proposedConfig = createDefaultConfigV2(
    options.name ?? path.basename(root),
    options.adapters,
  );
  const decoded = decodeConfig(proposedConfig);
  if (decoded.config === undefined) {
    throw new CarrylogError("E_CONFIG_INVALID", "Initialization options produce invalid context.", {
      diagnostics: decoded.diagnostics,
    });
  }
  const config = decoded.config;
  const changes: PlannedChange[] = [];

  for (const template of createTemplateFiles(config)) {
    const absolutePath = resolveProjectPath(root, template.path);
    await assertNoSymlink(root, absolutePath);
    if ((await readTextIfExists(absolutePath)) !== undefined) {
      throw issueError(
        "E_INIT_CONFLICT",
        `Initialization would overwrite an existing context file: ${template.path}`,
        "Move or reconcile the existing file before running init again.",
      );
    }
    changes.push({
      path: template.path,
      kind: "create",
      content: template.content,
      expectedContent: null,
    });
  }

  const adapterDiagnostics = [];
  for (const adapter of config.adapters) {
    const absolutePath = resolveProjectPath(root, adapter.output);
    await assertNoSymlink(root, absolutePath);
    const existing = await readTextIfExists(absolutePath);
    try {
      const content = upsertManagedBlock(existing, renderAdapter(config, adapter), {
        adopt: options.adopt,
      });
      changes.push({
        path: adapter.output,
        kind: existing === undefined ? "create" : existing === content ? "unchanged" : "update",
        content,
        expectedContent: existing ?? null,
      });
    } catch (error) {
      if (error instanceof CarrylogError) {
        adapterDiagnostics.push(
          ...error.diagnostics.map((diagnostic) => ({ ...diagnostic, path: adapter.output })),
        );
      } else {
        throw error;
      }
    }
  }
  if (adapterDiagnostics.length > 0) {
    throw new CarrylogError("E_INIT_ADAPTER_CONFLICT", "Existing adapter files require review.", {
      diagnostics: adapterDiagnostics,
    });
  }

  if (!options.dryRun) {
    const writes = await Promise.all(
      changes
        .filter((change) => change.kind !== "unchanged")
        .map(async (change) => {
          const filePath = resolveProjectPath(root, change.path);
          return {
            filePath,
            content: change.content,
            expectedContent: change.expectedContent,
            guard: await inspectAtomicPath(root, filePath),
          };
        }),
    );
    await atomicWriteTexts(writes);
  }
  return { changes, wrote: !options.dryRun };
}
