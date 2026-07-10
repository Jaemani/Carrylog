import { issueError } from "../core/errors.js";

export const MANAGED_START = "<!-- agent-context-kit:managed:start -->";
export const MANAGED_END = "<!-- agent-context-kit:managed:end -->";

export function wrapManagedBlock(body: string, eol = "\n"): string {
  const normalizedBody = body.trim().replaceAll("\r\n", "\n").replaceAll("\n", eol);
  return `${MANAGED_START}${eol}${normalizedBody}${eol}${MANAGED_END}`;
}

export function upsertManagedBlock(
  existing: string | undefined,
  body: string,
  options: { adopt: boolean },
): string {
  if (existing === undefined) {
    return `${wrapManagedBlock(body)}\n`;
  }

  const startCount = countOccurrences(existing, MANAGED_START);
  const endCount = countOccurrences(existing, MANAGED_END);
  if (startCount !== endCount || startCount > 1) {
    throw issueError(
      "E_MANAGED_MARKERS",
      "Adapter file has missing or duplicate Agent Context Kit managed markers.",
      "Restore exactly one start marker and one end marker, then run sync again.",
    );
  }

  const eol = existing.includes("\r\n") ? "\r\n" : "\n";
  const block = wrapManagedBlock(body, eol);
  if (startCount === 1) {
    const start = existing.indexOf(MANAGED_START);
    const end = existing.indexOf(MANAGED_END, start);
    if (end < start) {
      throw issueError(
        "E_MANAGED_MARKERS",
        "Managed block end marker appears before its start marker.",
      );
    }
    return `${existing.slice(0, start)}${block}${existing.slice(end + MANAGED_END.length)}`;
  }

  if (!options.adopt) {
    throw issueError(
      "E_UNMANAGED_ADAPTER",
      "Adapter file already exists and is not managed by Agent Context Kit.",
      "Review the generated block, then rerun with --adopt to append it without replacing existing content.",
    );
  }

  const separator =
    existing.length === 0
      ? ""
      : existing.endsWith(`${eol}${eol}`)
        ? ""
        : existing.endsWith(eol)
          ? eol
          : `${eol}${eol}`;
  return `${existing}${separator}${block}${eol}`;
}

export function hasManagedBlock(content: string): boolean {
  return content.includes(MANAGED_START) && content.includes(MANAGED_END);
}

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let index = 0;
  while (index !== -1) {
    index = value.indexOf(needle, index);
    if (index === -1) {
      break;
    }
    count += 1;
    index += needle.length;
  }
  return count;
}
