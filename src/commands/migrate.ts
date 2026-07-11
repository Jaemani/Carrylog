import path from "node:path";
import { isMap, isSeq, parseDocument } from "yaml";
import { assertLoadedProjectSnapshot, parseConfigSource } from "../config/load.js";
import { validateCheckpointStructure } from "../continuity/checkpoint.js";
import { CarrylogError, EXIT_USAGE, issueError } from "../core/errors.js";
import { atomicWriteTexts, inspectAtomicPath, readTextIfExists } from "../core/files.js";
import { resolveProjectPath } from "../core/paths.js";
import type { LoadedProject } from "../domain/types.js";
import { extractHandoffSnapshotBody, upsertHandoffSnapshot } from "../handoff/snapshot-block.js";
import { createCheckpointTemplate, createLegacyHandoffTemplate } from "../templates/defaults.js";
import { validateContext } from "../validation/validate.js";
import type { PlannedChange } from "./sync.js";
import { planAdapterChanges, planContinuitySkillChanges, planPublicSchemaChange } from "./sync.js";

export interface MigrateOptions {
  to: 2;
  universal: boolean;
  adopt: boolean;
  check: boolean;
  dryRun: boolean;
}

export interface MigrateResult {
  from: 1 | 2;
  to: 2;
  changes: PlannedChange[];
  wrote: boolean;
  drift: boolean;
}

export async function migrateProject(
  project: LoadedProject,
  options: MigrateOptions,
): Promise<MigrateResult> {
  if (options.to !== 2) {
    throw new CarrylogError("E_MIGRATION_TARGET", "Migration target must be version 2.", {
      exitCode: EXIT_USAGE,
    });
  }
  for (const [name, value] of Object.entries({
    universal: options.universal,
    adopt: options.adopt,
    check: options.check,
    dryRun: options.dryRun,
  })) {
    if (typeof value !== "boolean") {
      throw new CarrylogError(
        "E_MIGRATION_OPTIONS",
        `Migration option '${name}' must be boolean.`,
        {
          exitCode: EXIT_USAGE,
        },
      );
    }
  }
  await assertLoadedProjectSnapshot(project);
  if (project.config.version === 2) {
    if (!options.universal) {
      return { from: 2, to: 2, changes: [], wrote: false, drift: false };
    }
    return await enableUniversalV2(project, options);
  }

  const handoff = project.config.documents.find((document) => document.id === "handoff");
  if (handoff === undefined || handoff.load !== "always") {
    throw issueError(
      "E_CHECKPOINT_REVIEW_REQUIRED",
      "v1 migration requires an always-loaded document with id 'handoff'.",
      "Add or review the checkpoint document before migrating configuration semantics.",
    );
  }
  const handoffPath = path.posix.join(".agent-context", handoff.path);
  const handoffAbsolutePath = resolveProjectPath(project.root, handoffPath);
  const existingHandoff = await readTextIfExists(handoffAbsolutePath, { maxBytes: 1024 * 1024 });
  if (existingHandoff === undefined) {
    throw issueError("E_HANDOFF_MISSING", `Handoff document does not exist: ${handoffPath}`);
  }
  const checkpointContent = planCheckpointContent(existingHandoff, handoffPath);
  const configSource = renderV2ConfigSource(project.configSource, options.universal);
  const prospectiveConfig = parseConfigSource(configSource);
  if (prospectiveConfig.version !== 2) {
    throw new Error("Migration did not produce configuration v2.");
  }
  const prospectiveProject: LoadedProject = Object.freeze({
    ...project,
    configSource,
    config: prospectiveConfig,
  });
  const overrides = new Map<string, string>([[handoffPath, checkpointContent]]);
  const diagnostics = await validateContext(prospectiveProject, overrides);
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    throw new CarrylogError("E_MIGRATION_INVALID", "Prospective v2 context is invalid.", {
      diagnostics,
    });
  }

  const checkpointChange: PlannedChange = {
    path: handoffPath,
    kind: checkpointContent === existingHandoff ? "unchanged" : "update",
    content: checkpointContent,
    expectedContent: existingHandoff,
  };
  const schemaChange = await planPublicSchemaChange(prospectiveProject);
  const adapterChanges = await planAdapterChanges(prospectiveProject, options.adopt);
  const skillChanges = await planContinuitySkillChanges(prospectiveProject);
  const configChange: PlannedChange = {
    path: ".agent-context/config.yaml",
    kind: "update",
    content: configSource,
    expectedContent: project.configSource,
  };
  const changes = [
    checkpointChange,
    schemaChange,
    ...adapterChanges,
    ...skillChanges,
    configChange,
  ];
  const drift = changes.some((change) => change.kind !== "unchanged");
  const shouldWrite = drift && !options.check && !options.dryRun;
  if (shouldWrite) await writeMigrationChanges(project, changes);
  return { from: 1, to: 2, changes, wrote: shouldWrite, drift };
}

async function enableUniversalV2(
  project: LoadedProject,
  options: MigrateOptions,
): Promise<MigrateResult> {
  if (project.config.version !== 2) throw new TypeError("Expected configuration v2.");
  const configSource = renderUniversalV2ConfigSource(project.configSource);
  const prospectiveConfig = parseConfigSource(configSource);
  if (prospectiveConfig.version !== 2) {
    throw new Error("Universal migration did not produce configuration v2.");
  }
  const prospectiveProject: LoadedProject = Object.freeze({
    ...project,
    configSource,
    config: prospectiveConfig,
  });
  const diagnostics = await validateContext(prospectiveProject);
  if (diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    throw new CarrylogError("E_MIGRATION_INVALID", "Prospective v2 context is invalid.", {
      diagnostics,
    });
  }
  const schemaChange = await planPublicSchemaChange(prospectiveProject);
  const adapterChanges = await planAdapterChanges(prospectiveProject, options.adopt);
  const skillChanges = await planContinuitySkillChanges(prospectiveProject);
  const configChange: PlannedChange = {
    path: ".agent-context/config.yaml",
    kind: configSource === project.configSource ? "unchanged" : "update",
    content: configSource,
    expectedContent: project.configSource,
  };
  const changes = [schemaChange, ...adapterChanges, ...skillChanges, configChange];
  const drift = changes.some((change) => change.kind !== "unchanged");
  const shouldWrite = drift && !options.check && !options.dryRun;
  if (shouldWrite) await writeMigrationChanges(project, changes);
  return { from: 2, to: 2, changes, wrote: shouldWrite, drift };
}

function planCheckpointContent(existing: string, checkpointPath: string): string {
  if (validateCheckpointStructure(existing, checkpointPath).length === 0) return existing;
  const legacy = createLegacyHandoffTemplate();
  const legacyCrLf = legacy.replace(/\n/g, "\r\n");
  const checkpoint = createCheckpointTemplate();
  const candidates = [
    { legacy, checkpoint },
    { legacy: legacyCrLf, checkpoint: checkpoint.replace(/\n/g, "\r\n") },
  ];
  const snapshotBody = extractHandoffSnapshotBody(existing);
  for (const candidate of candidates) {
    if (existing === candidate.legacy) return candidate.checkpoint;
    if (
      snapshotBody !== undefined &&
      upsertHandoffSnapshot(candidate.legacy, snapshotBody) === existing
    ) {
      return upsertHandoffSnapshot(candidate.checkpoint, snapshotBody);
    }
  }
  throw issueError(
    "E_CHECKPOINT_REVIEW_REQUIRED",
    `Customized handoff cannot be assigned checkpoint semantics automatically: ${checkpointPath}`,
    "Create the required Objective, Completed, Verification, Decisions, Risks, and Next action sections, then rerun migration.",
  );
}

function renderV2ConfigSource(source: string, universal: boolean): string {
  const document = parseDocument(source, { prettyErrors: true, strict: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new CarrylogError("E_CONFIG_YAML", "Configuration contains invalid YAML.");
  }
  document.set("version", 2);
  const adapters = document.get("adapters", true);
  if (!isSeq(adapters)) {
    throw issueError("E_ADAPTERS_TYPE", "adapters must be a sequence before migration.");
  }
  const surfaces = new Set<string>();
  for (const item of adapters.items) {
    if (!isMap(item)) continue;
    const type = item.get("type");
    if (type === "codex") {
      item.set("type", "agents");
      surfaces.add("agents");
    } else if (typeof type === "string") {
      surfaces.add(type);
    }
  }
  if (universal) {
    addMissingUniversalAdapters(adapters, surfaces);
  }
  document.set("continuity", {
    checkpointDocument: "handoff",
    generateSkills: universal,
  });
  let rendered = document.toString({ lineWidth: 100 });
  const usesCrLf = source.includes("\r\n") && !source.replace(/\r\n/g, "").includes("\n");
  if (usesCrLf) rendered = rendered.replace(/\n/g, "\r\n");
  return rendered;
}

function renderUniversalV2ConfigSource(source: string): string {
  const document = parseDocument(source, { prettyErrors: true, strict: true, uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new CarrylogError("E_CONFIG_YAML", "Configuration contains invalid YAML.");
  }
  const adapters = document.get("adapters", true);
  const continuity = document.get("continuity", true);
  if (!isSeq(adapters) || !isMap(continuity)) {
    throw issueError("E_MIGRATION_INVALID", "Configuration v2 has invalid migration structures.");
  }
  const surfaces = new Set<string>();
  for (const item of adapters.items) {
    if (!isMap(item)) continue;
    const type = item.get("type");
    if (typeof type === "string") surfaces.add(type);
  }
  addMissingUniversalAdapters(adapters, surfaces);
  continuity.set("generateSkills", true);
  let rendered = document.toString({ lineWidth: 100 });
  const usesCrLf = source.includes("\r\n") && !source.replace(/\r\n/g, "").includes("\n");
  if (usesCrLf) rendered = rendered.replace(/\n/g, "\r\n");
  return rendered;
}

function addMissingUniversalAdapters(
  adapters: { add(value: unknown): unknown },
  surfaces: Set<string>,
): void {
  const defaults = [
    ["agents", "AGENTS.md"],
    ["claude", "CLAUDE.md"],
    ["gemini", "GEMINI.md"],
  ] as const;
  for (const [type, output] of defaults) {
    if (!surfaces.has(type)) adapters.add({ type, output });
  }
}

async function writeMigrationChanges(
  project: LoadedProject,
  changes: PlannedChange[],
): Promise<void> {
  const writes = await Promise.all(
    changes
      .filter((change) => change.kind !== "unchanged")
      .map(async (change) => {
        const filePath = resolveProjectPath(project.root, change.path);
        return {
          filePath,
          content: change.content,
          expectedContent: change.expectedContent,
          guard: await inspectAtomicPath(project.root, filePath),
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
