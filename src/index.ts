export {
  hasManagedBlock,
  MANAGED_END,
  MANAGED_START,
  upsertManagedBlock,
  wrapManagedBlock,
} from "./adapters/managed-block.js";
export { renderAdapter } from "./adapters/render.js";
export type { InitOptions, InitResult } from "./commands/init.js";
export { initProject } from "./commands/init.js";
export type {
  ChangeKind,
  PlannedChange,
  SyncOptions,
  SyncResult,
} from "./commands/sync.js";
export { planAdapterChanges, syncProject } from "./commands/sync.js";
export type { ValidateResult } from "./commands/validate.js";
export { validateProject } from "./commands/validate.js";
export type { DecodeResult } from "./config/decode.js";
export { decodeConfig } from "./config/decode.js";
export { loadProject } from "./config/load.js";
export type {
  AdapterConfig,
  AdapterType,
  ContextDocument,
  Diagnostic,
  LoadedProject,
  ProjectConfig,
} from "./domain/types.js";
