import type { Diagnostic } from "../domain/types.js";

export const EXIT_SUCCESS = 0;
export const EXIT_ISSUES = 1;
export const EXIT_USAGE = 2;
export const EXIT_INTERNAL = 3;

export class AckitError extends Error {
  readonly code: string;
  readonly exitCode: number;
  readonly diagnostics: Diagnostic[];

  constructor(
    code: string,
    message: string,
    options: { exitCode?: number; diagnostics?: Diagnostic[]; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AckitError";
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

export function issueError(code: string, message: string, hint?: string): AckitError {
  const diagnostic: Diagnostic = { level: "error", code, message };
  if (hint !== undefined) {
    diagnostic.hint = hint;
  }
  return new AckitError(code, message, { diagnostics: [diagnostic] });
}
