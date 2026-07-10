export const CONFIG_PATH = ".agent-context/config.yaml";
export const CONFIG_VERSION = 1 as const;

export type AdapterType = "codex" | "claude";
export type LoadPolicy = "always" | "on-demand";

export interface ProjectConfig {
  version: typeof CONFIG_VERSION;
  project: {
    name: string;
  };
  documents: ContextDocument[];
  adapters: AdapterConfig[];
  policies: {
    maxAlwaysCharacters: number;
    maxAdapterCharacters: number;
  };
}

export interface ContextDocument {
  id: string;
  path: string;
  load: LoadPolicy;
  description: string;
  triggers?: string[];
}

export interface AdapterConfig {
  type: AdapterType;
  output: string;
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
  root: string;
  configPath: string;
  config: ProjectConfig;
}
