import path from "node:path";
import { upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { decodeConfig } from "../config/decode.js";
import { AckitError, issueError } from "../core/errors.js";
import { atomicWriteText, readTextIfExists } from "../core/files.js";
import { assertNoSymlink, canonicalProjectRoot, resolveProjectPath } from "../core/paths.js";
import type { AdapterType } from "../domain/types.js";
import { createDefaultConfig, createTemplateFiles } from "../templates/defaults.js";
import type { PlannedChange } from "./sync.js";

export interface InitOptions {
  root: string;
  name?: string;
  adapters: AdapterType[];
  adopt: boolean;
  dryRun: boolean;
}

export interface InitResult {
  changes: PlannedChange[];
  wrote: boolean;
}

export async function initProject(options: InitOptions): Promise<InitResult> {
  const root = await canonicalProjectRoot(options.root);
  const proposedConfig = createDefaultConfig(options.name ?? path.basename(root), options.adapters);
  const decoded = decodeConfig(proposedConfig);
  if (decoded.config === undefined) {
    throw new AckitError("E_CONFIG_INVALID", "Initialization options produce invalid context.", {
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
    changes.push({ path: template.path, kind: "create", content: template.content });
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
      });
    } catch (error) {
      if (error instanceof AckitError) {
        adapterDiagnostics.push(
          ...error.diagnostics.map((diagnostic) => ({ ...diagnostic, path: adapter.output })),
        );
      } else {
        throw error;
      }
    }
  }
  if (adapterDiagnostics.length > 0) {
    throw new AckitError("E_INIT_ADAPTER_CONFLICT", "Existing adapter files require review.", {
      diagnostics: adapterDiagnostics,
    });
  }

  if (!options.dryRun) {
    for (const change of changes) {
      if (change.kind !== "unchanged") {
        await atomicWriteText(resolveProjectPath(root, change.path), change.content);
      }
    }
  }
  return { changes, wrote: !options.dryRun };
}
