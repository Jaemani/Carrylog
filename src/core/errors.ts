import type { Diagnostic } from "../domain/types.js";

export const EXIT_SUCCESS = 0;
export const EXIT_ISSUES = 1;
export const EXIT_USAGE = 2;
export const EXIT_INTERNAL = 3;

export class CarrylogError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly diagnostics: Diagnostic[];

  constructor(
    code: string,
    message: string,
    options: { exitCode?: number; diagnostics?: Diagnostic[]; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "CarrylogError";
    this.code = code;
    this.exitCode = options.exitCode ?? EXIT_ISSUES;
    this.diagnostics = options.diagnostics ?? [
      {
        level: "error",
        code,
        message,
      },
    ];
  }
}

/** @deprecated Use CarrylogError. Retained for beta.3 source compatibility. */
export { CarrylogError as AckitError };

export function issueError(code: string, message: string, hint?: string): CarrylogError {
  const diagnostic: Diagnostic = { level: "error", code, message };
  if (hint !== undefined) {
    diagnostic.hint = hint;
  }
  return new CarrylogError(code, message, { diagnostics: [diagnostic] });
}
