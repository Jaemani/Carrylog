import { issueError } from "../core/errors.js";
import { detectTextEol, standaloneMarkerLines } from "../core/marker-lines.js";
import { PRODUCT_NAME } from "../product.js";

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
  if (
    standaloneMarkerLines(body, MANAGED_START).length > 0 ||
    standaloneMarkerLines(body, MANAGED_END).length > 0
  ) {
    throw issueError(
      "E_MANAGED_BODY_MARKER",
      "Generated adapter content must not contain standalone managed markers.",
    );
  }
  if (existing === undefined) {
    return `${wrapManagedBlock(body)}\n`;
  }
  const starts = standaloneMarkerLines(existing, MANAGED_START);
  const ends = standaloneMarkerLines(existing, MANAGED_END);
  if (starts.length !== ends.length || starts.length > 1) {
    throw issueError(
      "E_MANAGED_MARKERS",
      `Adapter file has missing or duplicate ${PRODUCT_NAME} managed markers.`,
      "Restore exactly one start marker and one end marker, then run sync again.",
    );
  }

  const eol = detectTextEol(existing);
  const block = wrapManagedBlock(body, eol);
  if (starts.length === 1 && ends.length === 1) {
    const start = starts[0];
    const end = ends[0];
    if (start === undefined || end === undefined) {
      throw new Error("Validated adapter marker positions are unavailable.");
    }
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
      `Adapter file already exists and is not managed by ${PRODUCT_NAME}.`,
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
  const starts = standaloneMarkerLines(content, MANAGED_START);
  const ends = standaloneMarkerLines(content, MANAGED_END);
  return (
    starts.length === 1 &&
    ends.length === 1 &&
    (starts[0] ?? Number.POSITIVE_INFINITY) < (ends[0] ?? Number.NEGATIVE_INFINITY)
  );
}

export function hasAnyManagedMarker(content: string): boolean {
  return (
    standaloneMarkerLines(content, MANAGED_START).length > 0 ||
    standaloneMarkerLines(content, MANAGED_END).length > 0
  );
}
