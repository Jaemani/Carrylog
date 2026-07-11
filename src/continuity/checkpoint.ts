import { createHash } from "node:crypto";
import type { ContextDocument, Diagnostic, ProjectConfig } from "../domain/types.js";
import { HANDOFF_SNAPSHOT_END, HANDOFF_SNAPSHOT_START } from "../handoff/snapshot-block.js";

export const CHECKPOINT_SECTION_NAMES = [
  "Objective",
  "Completed",
  "Verification",
  "Decisions",
  "Risks",
  "Next action",
] as const;

export type CheckpointSectionName = (typeof CHECKPOINT_SECTION_NAMES)[number];
export type CheckpointSections = Readonly<Record<CheckpointSectionName, string>>;

export function getCheckpointDocument(config: ProjectConfig): ContextDocument | undefined {
  const id = config.version === 2 ? config.continuity.checkpointDocument : "handoff";
  return config.documents.find((document) => document.id === id);
}

export function validateCheckpointStructure(content: string, path: string): Diagnostic[] {
  const { diagnostics } = collectCheckpointSections(content, path);
  return diagnostics;
}

export function parseCheckpointSections(content: string, path: string): CheckpointSections {
  const result = collectCheckpointSections(content, path);
  if (result.diagnostics.length > 0) {
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join(" "));
  }
  return result.sections as CheckpointSections;
}

export function contentDigest(content: string | Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function collectCheckpointSections(
  content: string,
  path: string,
): { sections: Partial<Record<CheckpointSectionName, string>>; diagnostics: Diagnostic[] } {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const positions = new Map<CheckpointSectionName, number[]>();
  for (const name of CHECKPOINT_SECTION_NAMES) positions.set(name, []);

  let fence: { marker: "`" | "~"; length: number } | undefined;
  let htmlBlockEnd: RegExp | "blank" | undefined;
  let managedSnapshot = false;
  const orderedMatches: Array<{ name: CheckpointSectionName; index: number }> = [];
  const h2Positions: number[] = [];
  for (const [index, line] of lines.entries()) {
    if (managedSnapshot) {
      if (line === HANDOFF_SNAPSHOT_END) managedSnapshot = false;
      continue;
    }

    if (fence !== undefined) {
      const closingFence = /^(?: {0,3})(`{3,}|~{3,})[ \t]*$/.exec(line)?.[1];
      if (
        closingFence !== undefined &&
        closingFence[0] === fence.marker &&
        closingFence.length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }

    if (htmlBlockEnd !== undefined) {
      const closes = htmlBlockEnd === "blank" ? line.trim() === "" : htmlBlockEnd.test(line);
      if (closes) htmlBlockEnd = undefined;
      continue;
    }

    if (/^ {0,3}>/.test(line) || /^(?: {4}|\t)/.test(line)) continue;
    const openingMatch = /^(?: {0,3})(`{3,}|~{3,})(.*)$/.exec(line);
    const openingFence = openingMatch?.[1];
    const infoString = openingMatch?.[2];
    if (
      openingFence !== undefined &&
      infoString !== undefined &&
      !(openingFence[0] === "`" && infoString.includes("`"))
    ) {
      fence = {
        marker: openingFence[0] as "`" | "~",
        length: openingFence.length,
      };
      continue;
    }
    if (line === HANDOFF_SNAPSHOT_START) {
      managedSnapshot = true;
      continue;
    }
    const htmlOpening = htmlBlockOpening(line);
    if (htmlOpening !== undefined) {
      if (
        htmlOpening.end === "blank" ||
        !htmlOpening.end.test(line.slice(htmlOpening.openingLength))
      ) {
        htmlBlockEnd = htmlOpening.end;
      }
      continue;
    }
    if (line.startsWith("## ")) h2Positions.push(index);
    for (const name of CHECKPOINT_SECTION_NAMES) {
      if (line === `## ${name}`) {
        const matches = positions.get(name);
        if (matches === undefined) throw new Error(`Missing checkpoint parser slot: ${name}`);
        matches.push(index);
        orderedMatches.push({ name, index });
      }
    }
  }

  const diagnostics: Diagnostic[] = [];
  const sections: Partial<Record<CheckpointSectionName, string>> = {};
  for (const index of h2Positions) {
    const line = lines[index];
    if (line === undefined) continue;
    const heading = line.slice(3);
    if (!CHECKPOINT_SECTION_NAMES.includes(heading as CheckpointSectionName)) {
      diagnostics.push({
        level: "error",
        code: "E_CHECKPOINT_SECTION_UNKNOWN",
        message: `Checkpoint contains unsupported H2 section: ${heading}.`,
        path,
      });
    }
  }
  for (const name of CHECKPOINT_SECTION_NAMES) {
    const matches = positions.get(name) ?? [];
    if (matches.length !== 1) {
      diagnostics.push({
        level: "error",
        code:
          matches.length === 0 ? "E_CHECKPOINT_SECTION_MISSING" : "E_CHECKPOINT_SECTION_DUPLICATE",
        message:
          matches.length === 0
            ? `Checkpoint is missing required section: ${name}.`
            : `Checkpoint contains more than one '${name}' section.`,
        path,
      });
      continue;
    }
    const match = matches[0];
    if (match === undefined) continue;
    const start = match + 1;
    let end = lines.length;
    end = h2Positions.find((index) => index >= start) ?? lines.length;
    const body = lines.slice(start, end).join("\n").trim();
    if (body.length === 0) {
      diagnostics.push({
        level: "error",
        code: "E_CHECKPOINT_SECTION_EMPTY",
        message: `Checkpoint section must not be empty: ${name}.`,
        path,
      });
    } else {
      sections[name] = body;
    }
  }
  if (
    orderedMatches.length === CHECKPOINT_SECTION_NAMES.length &&
    orderedMatches.some((match, index) => match.name !== CHECKPOINT_SECTION_NAMES[index])
  ) {
    diagnostics.push({
      level: "error",
      code: "E_CHECKPOINT_SECTION_ORDER",
      message: `Checkpoint sections must appear in this order: ${CHECKPOINT_SECTION_NAMES.join(", ")}.`,
      path,
    });
  }
  return { sections, diagnostics };
}

const COMMONMARK_BLOCK_TAG =
  /^(?: {0,3})<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:[ \t\n/>]|$)/i;
const COMPLETE_HTML_TAG =
  /^(?: {0,3})<\/?[A-Za-z][A-Za-z0-9-]*(?:[ \t]+[A-Za-z_:][A-Za-z0-9_.:-]*(?:[ \t]*=[ \t]*(?:[^ "'=<>`]+|'[^']*'|"[^"]*"))?)*[ \t]*\/?>[ \t]*$/;

function htmlBlockOpening(
  line: string,
): { end: RegExp | "blank"; openingLength: number } | undefined {
  const prefix = /^(?: {0,3})/.exec(line)?.[0] ?? "";
  const candidate = line.slice(prefix.length);
  const rawTag = /^<(script|pre|style|textarea)(?:[ \t>]|$)/i.exec(candidate)?.[1];
  if (rawTag !== undefined) {
    return { end: new RegExp(`</${rawTag}[ \\t]*>`, "i"), openingLength: prefix.length };
  }
  if (candidate.startsWith("<!--")) return { end: /-->/, openingLength: prefix.length + 4 };
  if (candidate.startsWith("<?")) return { end: /\?>/, openingLength: prefix.length + 2 };
  if (/^<![A-Z]/.test(candidate)) return { end: />/, openingLength: prefix.length + 2 };
  if (candidate.startsWith("<![CDATA[")) {
    return { end: /\]\]>/, openingLength: prefix.length + 9 };
  }
  if (COMMONMARK_BLOCK_TAG.test(line) || COMPLETE_HTML_TAG.test(line)) {
    return { end: "blank", openingLength: line.length };
  }
  return undefined;
}
