export const CONTINUITY_SKILL_MARKER = "<!-- agent-context-kit:continuity-skill:managed -->";
export const AGENT_SKILL_PATH = ".agents/skills/carrylog-continuity/SKILL.md";
export const CLAUDE_SKILL_PATH = ".claude/skills/carrylog-continuity/SKILL.md";

export function hasContinuitySkillMarker(content: string): boolean {
  const normalized = content.replace(/\r\n?/g, "\n");
  return normalized.split("\n").filter((line) => line === CONTINUITY_SKILL_MARKER).length === 1;
}

export function renderAgentContinuitySkill(): string {
  return `---
name: carrylog-continuity
description: Resume work from Carrylog or leave a verified checkpoint when continuing across Codex, Claude Code, Cursor, or Gemini CLI.
---

${CONTINUITY_SKILL_MARKER}

# Carrylog continuity

Use this workflow only when the user asks to resume, continue, checkpoint, hand off, or end a
substantial project session.

## Resume

1. Resolve one offline executable before running resume, in this order:
   a. In the Carrylog source repository itself, when its built \`dist/cli.js\` exists, first require
      \`node dist/cli.js resume --help\` to succeed, then use \`node dist/cli.js resume --json\` from
      that repository root. If it fails, report a stale or incompatible build and stop.
   b. Otherwise, when the nearest project has \`node_modules/.bin/carrylog\`, first require
      \`npx --no-install carrylog resume --help\` to succeed, then run
      \`npx --no-install carrylog resume --json\` from that project root. If it fails, report the
      incompatible pinned version and stop; do not fall through to a different global version.
   c. Otherwise, use a global \`carrylog\` only after \`carrylog resume --help\` succeeds; then run
      \`carrylog resume --json\`.
   Never select a global executable before checking the source and project-pinned candidates. If a
   selected version lacks \`resume\`, report the incompatible version and require an explicit build,
   project install, or upgrade. Never download, build, or upgrade Carrylog automatically.
2. Read the always-context and checkpoint in the envelope.
3. Load only on-demand documents whose triggers match the task.
4. Compare the checkpoint, repository, and requested work. Report material mismatches before editing.
5. Summarize the objective, verified state, next action, and risks, then continue the requested work.

## Checkpoint

1. Update the configured current-state and checkpoint documents using verified facts only.
2. Record consequential architecture or dependency decisions in the project's decision records.
3. Keep these checkpoint sections exactly once and in order: Objective, Completed, Verification,
   Decisions, Risks, Next action.
4. Run \`carrylog checkpoint\`, then \`carrylog validate\` and the relevant project checks, using the
   same offline executable resolution as resume.
5. Never persist raw transcripts, hidden reasoning, credentials, or unreviewed tool output.
`;
}

export function renderClaudeContinuitySkill(): string {
  return `---
name: carrylog-continuity
description: Resume work from Carrylog or leave a verified checkpoint when continuing across coding agents.
---

${CONTINUITY_SKILL_MARKER}

Read the project-root \`${AGENT_SKILL_PATH}\` completely, then follow that canonical workflow. Do not
duplicate or rewrite the canonical skill in this adapter.
`;
}

export function continuitySkillFiles(): ReadonlyArray<{ path: string; content: string }> {
  return [
    { path: AGENT_SKILL_PATH, content: renderAgentContinuitySkill() },
    { path: CLAUDE_SKILL_PATH, content: renderClaudeContinuitySkill() },
  ];
}
