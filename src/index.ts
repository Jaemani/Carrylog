export {
  hasAnyManagedMarker,
  hasManagedBlock,
  MANAGED_END,
  MANAGED_START,
  upsertManagedBlock,
  wrapManagedBlock,
} from "./adapters/managed-block.js";
export type { AdapterDefinition } from "./adapters/registry.js";
export {
  getAdapterDefinition,
  isAdapterType,
  listAdapterDefinitions,
} from "./adapters/registry.js";
export { markdownCodeSpan, renderAdapter } from "./adapters/render.js";
export type { HandoffOptions, HandoffResult } from "./commands/handoff.js";
export { refreshHandoff } from "./commands/handoff.js";
export type { InitOptions, InitResult } from "./commands/init.js";
export { initProject } from "./commands/init.js";
export type { MigrateOptions, MigrateResult } from "./commands/migrate.js";
export { migrateProject } from "./commands/migrate.js";
export type {
  ResumeDocument,
  ResumeEnvelope,
  ResumeGitCommit,
  ResumeGitSnapshot,
} from "./commands/resume.js";
export { createResumeEnvelope } from "./commands/resume.js";
export type {
  ChangeKind,
  PlannedChange,
  SyncOptions,
  SyncResult,
} from "./commands/sync.js";
export {
  planAdapterChanges,
  planContinuitySkillChanges,
  planPublicSchemaChange,
  syncProject,
} from "./commands/sync.js";
export type { ValidateResult } from "./commands/validate.js";
export { validateProject } from "./commands/validate.js";
export type { DecodeResult } from "./config/decode.js";
export { decodeConfig } from "./config/decode.js";
export { loadProject } from "./config/load.js";
export {
  AckitError,
  CarrylogError,
  EXIT_INTERNAL,
  EXIT_ISSUES,
  EXIT_SUCCESS,
  EXIT_USAGE,
} from "./core/errors.js";
export type {
  AdapterConfig,
  AdapterConfigV1,
  AdapterConfigV2,
  AdapterSurfaceType,
  AdapterType,
  ContextDocument,
  Diagnostic,
  DiagnosticLevel,
  HarnessType,
  LegacyAdapterType,
  LoadedProject,
  LoadPolicy,
  ProjectConfig,
  ProjectConfigV1,
  ProjectConfigV2,
} from "./domain/types.js";
export {
  CONFIG_PATH,
  CONFIG_VERSION,
  CONFIG_VERSION_2,
  LATEST_CONFIG_VERSION,
} from "./domain/types.js";
export type {
  GitChangeEvidence,
  GitCommitEvidence,
  GitDiffEvidence,
  GitSnapshot,
} from "./git/inspect.js";
export { inspectGitProject } from "./git/inspect.js";
export {
  extractHandoffSnapshotBody,
  HANDOFF_SNAPSHOT_END,
  HANDOFF_SNAPSHOT_START,
  renderHandoffSnapshot,
  upsertHandoffSnapshot,
  validateHandoffSnapshotMarkers,
} from "./handoff/snapshot-block.js";
export { CLI_NAME, DEBUG_ENV_NAME, LEGACY_DEBUG_ENV_NAME, PRODUCT_NAME } from "./product.js";
export {
  PUBLIC_SCHEMA_PATH,
  PUBLIC_SCHEMA_YAML_DIRECTIVE,
  readPublicSchema,
} from "./schema/public-schema.js";
