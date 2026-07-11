import path from "node:path";
import { AGENT_SKILL_PATH, CLAUDE_SKILL_PATH } from "../continuity/skills.js";
import { portablePathKey } from "../core/paths.js";
import type { Diagnostic, LoadedProject } from "../domain/types.js";
import { CONFIG_PATH } from "../domain/types.js";
import { PUBLIC_SCHEMA_PATH } from "../schema/public-schema.js";

interface ManagedPathOwner {
  path: string;
  kind: "config" | "document" | "schema" | "adapter" | "skill";
  label: string;
}

export function validateManagedPathOwnership(project: LoadedProject): Diagnostic[] {
  const owners: ManagedPathOwner[] = [
    { path: CONFIG_PATH, kind: "config", label: "configuration" },
    { path: PUBLIC_SCHEMA_PATH, kind: "schema", label: "generated public schema" },
    ...project.config.documents.map(
      (document): ManagedPathOwner => ({
        path: path.posix.join(".agent-context", document.path),
        kind: "document",
        label: `document '${document.id}'`,
      }),
    ),
    ...project.config.adapters.map(
      (adapter): ManagedPathOwner => ({
        path: adapter.output,
        kind: "adapter",
        label: `${adapter.type} adapter`,
      }),
    ),
    ...(project.config.version === 2 && project.config.continuity.generateSkills
      ? [
          { path: AGENT_SKILL_PATH, kind: "skill" as const, label: "shared continuity skill" },
          {
            path: CLAUDE_SKILL_PATH,
            kind: "skill" as const,
            label: "Claude continuity skill adapter",
          },
        ]
      : []),
  ];

  const byPath = new Map<string, ManagedPathOwner[]>();
  for (const owner of owners) {
    const key = portablePathKey(owner.path);
    const existing = byPath.get(key);
    if (existing === undefined) {
      byPath.set(key, [owner]);
    } else {
      existing.push(owner);
    }
  }

  const diagnostics: Diagnostic[] = [];
  for (const collisions of byPath.values()) {
    if (collisions.length < 2) continue;
    const adapter = collisions.find((owner) => owner.kind === "adapter");
    const primary = adapter ?? collisions[0];
    if (primary === undefined) continue;
    const conflict = collisions.map((owner) => `${owner.label} (${owner.path})`).join(", ");
    diagnostics.push({
      level: "error",
      code: adapter === undefined ? "E_MANAGED_PATH_CONFLICT" : "E_OUTPUT_OVERLAPS_SOURCE",
      message: `Managed paths have conflicting ownership: ${conflict}.`,
      path: primary.path,
      hint: "Give every configuration, schema, document, and adapter output a distinct portable path.",
    });
  }
  return diagnostics;
}
