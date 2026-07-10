import path from "node:path";
import { CarrylogError } from "../core/errors.js";
import { readTextIfExists } from "../core/files.js";
import { assertNoSymlink, resolveProjectPath } from "../core/paths.js";
import type { LoadedProject } from "../domain/types.js";

export interface ContextMigrationChange {
  path: string;
  kind: "update";
  content: string;
  expectedContent: string;
}

// Immutable published beta.3 template. Do not derive this value from the current template: exact
// recognition is what makes automatic migration safe for a human-owned canonical document.
const BETA3_INSTRUCTIONS_LF = `# Context operating rules

## At the start of work

1. Read every document marked \`load: always\` in \`config.yaml\`.
2. Load on-demand documents only when their descriptions or triggers match the task.
3. Compare the requested work, the repository state, and this context before editing.
4. Report consequential mismatches before relying on stale context.

## While working

- Treat source code and executable tests as evidence, not as substitutes for product intent.
- Keep changes inside the requested scope and record decisions that constrain future work.
- Do not silently rewrite human-authored content outside generated adapter blocks.

## Before handing off

- Update \`current-state.md\` when implementation status or priorities changed.
- Update \`handoff.md\` with verified changes, checks run, unresolved risks, and the next best task.
- Add or link a decision record when a consequential design choice was made.
- Run \`ackit validate\` and the project's relevant quality checks.
`;

const BETA3_INSTRUCTIONS_CARRYLOG_LF = BETA3_INSTRUCTIONS_LF.replace(
  "`ackit validate`",
  "`carrylog validate`",
);
const MAX_BETA3_INSTRUCTIONS_BYTES = Buffer.byteLength(
  BETA3_INSTRUCTIONS_LF.replaceAll("\n", "\r\n"),
  "utf8",
);
const LEGACY_COMMAND_WITH_ARGUMENT =
  /(^|[^A-Za-z0-9_-])ackit(?:\.cmd|\.ps1)?["']?\s+(?:init|sync|validate|handoff|help|-h|-v|--help|--version)(?=$|[^A-Za-z0-9_-])/im;
const LEGACY_BARE_SHELL_COMMAND =
  /(?:^(?:[ \t]*\$\s+)?|[\r\n][ \t]*(?:\$\s+)?|\$\([ \t]*|(?:&&|\|\||[;|&])[ \t]*)["']?ackit(?:\.cmd|\.ps1)?["']?[ \t]*(?=;|&&|\|\||[|&)]|[\r\n]|$)/im;

export async function planContextV1Migrations(
  project: LoadedProject,
): Promise<ContextMigrationChange[]> {
  const changes: ContextMigrationChange[] = [];

  for (const document of project.config.documents) {
    const portablePath = path.posix.join(".agent-context", document.path);
    const absolutePath = resolveProjectPath(project.root, portablePath);
    await assertNoSymlink(project.root, absolutePath);
    const existing = await readMigrationCandidate(absolutePath);
    if (existing === undefined) {
      continue;
    }

    const lineEnding = exactBeta3LineEnding(existing);
    if (lineEnding === undefined) {
      continue;
    }

    changes.push({
      path: portablePath,
      kind: "update",
      content: BETA3_INSTRUCTIONS_CARRYLOG_LF.replaceAll("\n", lineEnding),
      expectedContent: existing,
    });
  }

  return changes;
}

async function readMigrationCandidate(absolutePath: string): Promise<string | undefined> {
  try {
    return await readTextIfExists(absolutePath, { maxBytes: MAX_BETA3_INSTRUCTIONS_BYTES });
  } catch (error) {
    if (error instanceof CarrylogError && error.code === "E_FILE_TOO_LARGE") {
      return undefined;
    }
    throw error;
  }
}

export function hasLegacyCliInvocation(content: string): boolean {
  return LEGACY_COMMAND_WITH_ARGUMENT.test(content) || LEGACY_BARE_SHELL_COMMAND.test(content);
}

function exactBeta3LineEnding(content: string): "\n" | "\r\n" | undefined {
  if (content === BETA3_INSTRUCTIONS_LF) {
    return "\n";
  }
  return content === BETA3_INSTRUCTIONS_LF.replaceAll("\n", "\r\n") ? "\r\n" : undefined;
}
