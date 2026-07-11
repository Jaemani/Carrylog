import { readFileSync } from "node:fs";
import type { ProjectConfig } from "../domain/types.js";

export const PUBLIC_SCHEMA_PATH = ".agent-context/config.schema.json";
export const PUBLIC_SCHEMA_YAML_DIRECTIVE = "# yaml-language-server: $schema=./config.schema.json";

const schemaUrls = {
  1: new URL("../../schemas/config-v1.schema.json", import.meta.url),
  2: new URL("../../schemas/config-v2.schema.json", import.meta.url),
} as const;

export function readPublicSchema(version: ProjectConfig["version"] = 1): string {
  if (version !== 1 && version !== 2) {
    throw new RangeError(`Unsupported public schema version: ${String(version)}`);
  }
  const content = readFileSync(schemaUrls[version], "utf8");
  return content.endsWith("\n") ? content : `${content}\n`;
}
