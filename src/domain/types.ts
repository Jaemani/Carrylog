export const CONFIG_PATH = ".agent-context/config.yaml";
export const CONFIG_VERSION = 1 as const;
export const CONFIG_VERSION_2 = 2 as const;
export const LATEST_CONFIG_VERSION = CONFIG_VERSION_2;

export type LegacyAdapterType = "codex" | "claude";
export type AdapterSurfaceType = "agents" | "claude" | "gemini";
export type AdapterType = LegacyAdapterType | AdapterSurfaceType;
export type HarnessType = "codex" | "claude" | "cursor" | "gemini";
export type LoadPolicy = "always" | "on-demand";

interface ProjectConfigBase {
  readonly project: {
    readonly name: string;
  };
  readonly documents: readonly ContextDocument[];
  readonly adapters: readonly AdapterConfig[];
  readonly policies: {
    readonly maxAlwaysCharacters: number;
    readonly maxAdapterCharacters: number;
  };
}

export interface ProjectConfigV1 extends ProjectConfigBase {
  readonly version: typeof CONFIG_VERSION;
  readonly adapters: readonly AdapterConfigV1[];
}

export interface ProjectConfigV2 extends ProjectConfigBase {
  readonly version: typeof CONFIG_VERSION_2;
  readonly adapters: readonly AdapterConfigV2[];
  readonly continuity: {
    readonly checkpointDocument: string;
    readonly generateSkills: boolean;
  };
}

export type ProjectConfig = ProjectConfigV1 | ProjectConfigV2;

export interface ContextDocument {
  readonly id: string;
  readonly path: string;
  readonly load: LoadPolicy;
  readonly description: string;
  readonly triggers?: readonly string[];
}

export interface AdapterConfig {
  readonly type: AdapterType;
  readonly output: string;
}

export interface AdapterConfigV1 extends AdapterConfig {
  readonly type: LegacyAdapterType;
}

export interface AdapterConfigV2 extends AdapterConfig {
  readonly type: AdapterSurfaceType;
}

export type DiagnosticLevel = "error" | "warning";

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  path?: string;
  hint?: string;
}

export interface LoadedProject {
  readonly root: string;
  readonly configPath: string;
  readonly configSource: string;
  readonly config: ProjectConfig;
}
