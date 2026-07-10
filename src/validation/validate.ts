import path from "node:path";
import { hasAnyManagedMarker, upsertManagedBlock } from "../adapters/managed-block.js";
import { renderAdapter } from "../adapters/render.js";
import { CarrylogError } from "../core/errors.js";
import { readTextIfExists } from "../core/files.js";
import { assertNoSymlink, resolveProjectPath } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { validateHandoffSnapshotMarkers } from "../handoff/snapshot-block.js";
import { hasLegacyCliInvocation } from "../migrations/context-v1.js";
import { CLI_NAME } from "../product.js";
import {
  PUBLIC_SCHEMA_PATH,
  PUBLIC_SCHEMA_YAML_DIRECTIVE,
  readPublicSchema,
} from "../schema/public-schema.js";
import { validateManagedPathOwnership } from "./path-ownership.js";

const MAX_CONTEXT_DOCUMENT_BYTES = 1024 * 1024;

export async function validateContext(
  project: LoadedProject,
  contentOverrides: ReadonlyMap<string, string> = new Map(),
): Promise<Diagnostic[]> {
  const diagnostics: Diagnostic[] = [...validateManagedPathOwnership(project)];
  let alwaysCharacters = 0;

  for (const document of project.config.documents) {
    const portablePath = path.posix.join(".agent-context", document.path);
    const absolutePath = resolveProjectPath(project.root, portablePath);
    try {
      await assertNoSymlink(project.root, absolutePath);
      const overriddenContent = contentOverrides.get(portablePath);
      if (
        overriddenContent !== undefined &&
        Buffer.byteLength(overriddenContent, "utf8") > MAX_CONTEXT_DOCUMENT_BYTES
      ) {
        throw new CarrylogError(
          "E_FILE_TOO_LARGE",
          `Text file exceeds the ${MAX_CONTEXT_DOCUMENT_BYTES}-byte safety limit: ${portablePath}`,
        );
      }
      const content =
        overriddenContent ??
        (await readTextIfExists(absolutePath, { maxBytes: MAX_CONTEXT_DOCUMENT_BYTES }));
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
      if (document.id === "handoff") {
        validateHandoffSnapshotMarkers(content);
      }
      if (document.load === "always" && hasLegacyCliInvocation(content)) {
        diagnostics.push({
          level: "error",
          code: "E_LEGACY_CLI_INSTRUCTION",
          message: `Always-loaded context still invokes the removed 'ackit' executable: ${portablePath}`,
          path: portablePath,
          hint: `Review the command, replace the legacy executable with '${CLI_NAME}', then rerun validation. Exact beta.3 defaults are migrated automatically by '${CLI_NAME} sync'.`,
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

  for (const adapter of project.config.adapters) {
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
          hint: `Run '${CLI_NAME} sync'.`,
        });
        continue;
      }
      if (!hasAnyManagedMarker(existing)) {
        diagnostics.push({
          level: "error",
          code: "E_ADAPTER_UNMANAGED",
          message: `Adapter does not contain a managed block: ${adapter.output}`,
          path: adapter.output,
          hint: `Run '${CLI_NAME} sync --adopt' after reviewing the generated block.`,
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
          hint: `Run '${CLI_NAME} sync'.`,
        });
      }
    } catch (error) {
      diagnostics.push(asDiagnostic(error, adapter.output));
    }
  }
  return diagnostics;
}

export async function validatePublicSchema(project: LoadedProject): Promise<Diagnostic[]> {
  const absolutePath = resolveProjectPath(project.root, PUBLIC_SCHEMA_PATH);
  try {
    await assertNoSymlink(project.root, absolutePath);
    const existing = await readTextIfExists(absolutePath, { maxBytes: 1024 * 1024 });
    if (existing === undefined) {
      return [
        {
          level: "error",
          code: "E_SCHEMA_MISSING",
          message: `Generated configuration schema is missing: ${PUBLIC_SCHEMA_PATH}`,
          path: PUBLIC_SCHEMA_PATH,
          hint: `Run '${CLI_NAME} sync'.`,
        },
      ];
    }
    if (existing !== readPublicSchema()) {
      return [
        {
          level: "error",
          code: "E_SCHEMA_DRIFT",
          message: `Generated configuration schema is out of date: ${PUBLIC_SCHEMA_PATH}`,
          path: PUBLIC_SCHEMA_PATH,
          hint: `Run '${CLI_NAME} sync'.`,
        },
      ];
    }
    return [];
  } catch (error) {
    return [asDiagnostic(error, PUBLIC_SCHEMA_PATH)];
  }
}

export async function validateConfigSchemaDirective(project: LoadedProject): Promise<Diagnostic[]> {
  try {
    const source = await readTextIfExists(project.configPath, { maxBytes: 1024 * 1024 });
    if (source === undefined || source.split(/\r?\n/, 1)[0] !== PUBLIC_SCHEMA_YAML_DIRECTIVE) {
      return [
        {
          level: "warning",
          code: "W_CONFIG_SCHEMA_HEADER",
          message: "Configuration is not linked to the bundled JSON Schema for editor validation.",
          path: ".agent-context/config.yaml",
          hint: `Add '${PUBLIC_SCHEMA_YAML_DIRECTIVE}' as the first line without changing the YAML data.`,
        },
      ];
    }
    return [];
  } catch (error) {
    return [asDiagnostic(error, ".agent-context/config.yaml")];
  }
}

function asDiagnostic(error: unknown, diagnosticPath: string): Diagnostic {
  if (error instanceof CarrylogError && error.diagnostics[0] !== undefined) {
    return { ...error.diagnostics[0], path: diagnosticPath };
  }
  return {
    level: "error",
    code: "E_FILESYSTEM",
    message: error instanceof Error ? error.message : String(error),
    path: diagnosticPath,
  };
}
