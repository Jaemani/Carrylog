import { assertLoadedProjectSnapshot } from "../config/load.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import {
  validateAdapters,
  validateConfigSchemaDirective,
  validateContext,
  validateContinuitySkills,
  validatePublicSchema,
} from "../validation/validate.js";

export interface ValidateResult {
  diagnostics: Diagnostic[];
  valid: boolean;
}

export async function validateProject(project: LoadedProject): Promise<ValidateResult> {
  await assertLoadedProjectSnapshot(project);
  const diagnostics = [
    ...(await validateContext(project)),
    ...(await validateConfigSchemaDirective(project)),
    ...(await validatePublicSchema(project)),
    ...(await validateAdapters(project)),
    ...(await validateContinuitySkills(project)),
  ];
  return {
    diagnostics,
    valid: !diagnostics.some((diagnostic) => diagnostic.level === "error"),
  };
}
