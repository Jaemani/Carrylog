import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { validateAdapters, validateContext } from "../validation/validate.js";

export interface ValidateResult {
  diagnostics: Diagnostic[];
  valid: boolean;
}

export async function validateProject(project: LoadedProject): Promise<ValidateResult> {
  const diagnostics = [...(await validateContext(project)), ...(await validateAdapters(project))];
  return {
    diagnostics,
    valid: !diagnostics.some((diagnostic) => diagnostic.level === "error"),
  };
}
