export function standaloneMarkerLines(value: string, marker: string): number[] {
  const escaped = marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [...value.matchAll(new RegExp(`^${escaped}\\r?$`, "gm"))].map((match) => match.index);
}

export function detectTextEol(value: string): "\n" | "\r\n" {
  const firstLf = value.indexOf("\n");
  return firstLf > 0 && value[firstLf - 1] === "\r" ? "\r\n" : "\n";
}

export function hasEquivalentCrLf(left: string, right: string): boolean {
  return left.replaceAll("\r\n", "\n") === right.replaceAll("\r\n", "\n");
}
