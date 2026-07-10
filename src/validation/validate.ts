import path from "node:path";
import { MANAGED_END, MANAGED_START, upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { AckitError } from "../core/errors.js";
import { readTextIfExists } from "../core/files.js";
import { assertNoSymlink, portablePathKey, resolveProjectPath } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";

export async function validateContext(project: LoadedProject): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  let alwaysCharacters = 0;

  for (const document of project.config.documents) {
    const portablePath = path.posix.join(".agent-context", document.path);
    const absolutePath = resolveProjectPath(project.root, portablePath);
    try {
      await assertNoSymlink(project.root, absolutePath);
      const content = await readTextIfExists(absolutePath, { maxBytes: 1024 * 1024 });
      if (content === undefined) {
        diagnostics.push({
          level: "error",
          code: "E_DOCUMENT_MISSING",
          message: `Context document does not exist: ${portablePath}`,
          path: portablePath,
        });
        continue;
      }
      if (content.trim().length === 0) {
        diagnostics.push({
          level: "warning",
          code: "W_DOCUMENT_EMPTY",
          message: `Context document is empty: ${portablePath}`,
          path: portablePath,
        });
      }
      if (document.load === "always") {
        alwaysCharacters += content.length;
      }
    } catch (error) {
      diagnostics.push(asDiagnostic(error, portablePath));
    }
  }

  if (alwaysCharacters > project.config.policies.maxAlwaysCharacters) {
    diagnostics.push({
      level: "error",
      code: "E_ALWAYS_BUDGET_EXCEEDED",
      message: `Always-loaded context is ${alwaysCharacters} characters; the configured limit is ${project.config.policies.maxAlwaysCharacters}.`,
      path: ".agent-context/config.yaml",
      hint: "Move task-specific material to on-demand documents or raise the limit deliberately.",
    });
  }

  const sourcePaths = new Set([
    portablePathKey(".agent-context/config.yaml"),
    ...project.config.documents.map((document) =>
      portablePathKey(path.posix.join(".agent-context", document.path)),
    ),
  ]);
  for (const adapter of project.config.adapters) {
    if (sourcePaths.has(portablePathKey(adapter.output))) {
      diagnostics.push({
        level: "error",
        code: "E_OUTPUT_OVERLAPS_SOURCE",
        message: `Adapter output overlaps a canonical context source: ${adapter.output}`,
        path: adapter.output,
      });
    }
    const renderedLength = renderAdapter(project.config, adapter).length;
    if (renderedLength > project.config.policies.maxAdapterCharacters) {
      diagnostics.push({
        level: "error",
        code: "E_ADAPTER_BUDGET_EXCEEDED",
        message: `Generated adapter ${adapter.output} is ${renderedLength} characters; the configured limit is ${project.config.policies.maxAdapterCharacters}.`,
        path: ".agent-context/config.yaml",
        hint: "Reduce catalog descriptions/triggers or split task-specific context out of the router.",
      });
    }
  }

  return diagnostics;
}

export async function validateAdapters(project: LoadedProject): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [];
  for (const adapter of project.config.adapters) {
    const absolutePath = resolveProjectPath(project.root, adapter.output);
    try {
      await assertNoSymlink(project.root, absolutePath);
      const existing = await readTextIfExists(absolutePath);
      if (existing === undefined) {
        diagnostics.push({
          level: "error",
          code: "E_ADAPTER_MISSING",
          message: `Generated adapter is missing: ${adapter.output}`,
          path: adapter.output,
          hint: "Run 'ackit sync'.",
        });
        continue;
      }
      if (!existing.includes(MANAGED_START) && !existing.includes(MANAGED_END)) {
        diagnostics.push({
          level: "error",
          code: "E_ADAPTER_UNMANAGED",
          message: `Adapter does not contain a managed block: ${adapter.output}`,
          path: adapter.output,
          hint: "Run 'ackit sync --adopt' after reviewing the generated block.",
        });
        continue;
      }
      const expected = upsertManagedBlock(existing, renderAdapter(project.config, adapter), {
        adopt: false,
      });
      if (expected !== existing) {
        diagnostics.push({
          level: "error",
          code: "E_ADAPTER_DRIFT",
          message: `Generated adapter is out of date: ${adapter.output}`,
          path: adapter.output,
          hint: "Run 'ackit sync'.",
        });
      }
    } catch (error) {
      diagnostics.push(asDiagnostic(error, adapter.output));
    }
  }
  return diagnostics;
}

function asDiagnostic(error: unknown, diagnosticPath: string): Diagnostic {
  if (error instanceof AckitError && error.diagnostics[0] !== undefined) {
    return { ...error.diagnostics[0], path: diagnosticPath };
  }
  return {
    level: "error",
    code: "E_FILESYSTEM",
    message: error instanceof Error ? error.message : String(error),
    path: diagnosticPath,
  };
}
