export const PRODUCT_NAME = "Carrylog";
export const CLI_NAME = "carrylog";
export const DEBUG_ENV_NAME = "CARRYLOG_DEBUG";
export const LEGACY_DEBUG_ENV_NAME = "ACKIT_DEBUG";

export function isDebugEnabled(environment: Readonly<Record<string, string | undefined>>): boolean {
  return (environment[DEBUG_ENV_NAME] ?? environment[LEGACY_DEBUG_ENV_NAME]) === "1";
}
