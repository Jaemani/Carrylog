import { stringify } from "yaml";
import type { AdapterConfig, AdapterType, ProjectConfig } from "../domain/types.js";

const ADAPTER_OUTPUTS: Record<AdapterType, string> = {
  codex: "AGENTS.md",
  claude: "CLAUDE.md",
};

export interface TemplateFile {
  path: string;
  content: string;
}

export function createDefaultConfig(name: string, adapterTypes: AdapterType[]): ProjectConfig {
  return {
    version: 1,
    project: { name },
    documents: [
      {
        id: "instructions",
        path: "instructions.md",
        load: "always",
        description: "Operating rules for reading, updating, and handing off project memory",
      },
      {
        id: "project",
        path: "project.md",
        load: "always",
        description: "Stable product purpose, users, scope, and non-goals",
      },
      {
        id: "current-state",
        path: "current-state.md",
        load: "always",
        description: "Current implementation state, active objective, blockers, and next work",
      },
      {
        id: "handoff",
        path: "handoff.md",
        load: "always",
        description: "Most recent verified handoff for continuing work",
      },
      {
        id: "architecture",
        path: "architecture.md",
        load: "on-demand",
        description: "System boundaries, module responsibilities, and data flows",
        triggers: ["architecture changes", "cross-module work", "new integrations"],
      },
      {
        id: "decisions",
        path: "decisions.md",
        load: "on-demand",
        description: "Decision index and constraints that should not be reversed casually",
        triggers: ["design choices", "dependency changes", "revisiting prior decisions"],
      },
      {
        id: "conventions",
        path: "conventions.md",
        load: "on-demand",
        description: "Commands, code style, testing expectations, and contribution workflow",
        triggers: ["editing code", "running checks", "preparing a pull request"],
      },
    ],
    adapters: adapterTypes.map((type): AdapterConfig => ({ type, output: ADAPTER_OUTPUTS[type] })),
    policies: {
      maxAlwaysCharacters: 16_000,
      maxAdapterCharacters: 12_000,
    },
  };
}

export function createTemplateFiles(config: ProjectConfig): TemplateFile[] {
  const serializedConfig = stringify(config, { lineWidth: 100 });
  return [
    {
      path: ".agent-context/config.yaml",
      content: serializedConfig.endsWith("\n") ? serializedConfig : `${serializedConfig}\n`,
    },
    {
      path: ".agent-context/instructions.md",
      content: `# Context operating rules

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
`,
    },
    {
      path: ".agent-context/project.md",
      content: `# Project brief

## Purpose

Describe the problem this project solves and the outcome it creates.

## Users

Describe the primary users and their constraints.

## In scope

- Add the committed product scope here.

## Non-goals

- Add explicit boundaries here to prevent accidental scope expansion.
`,
    },
    {
      path: ".agent-context/current-state.md",
      content: `# Current state

## Active objective

Replace this text with the current, verifiable objective.

## Implemented

- Record capabilities that exist and have been verified.

## In progress

- Record incomplete work without presenting it as finished.

## Blockers and risks

- Record known blockers, uncertainty, and operational risk.

## Next best task

State one concrete next task and why it is the best next step.
`,
    },
    {
      path: ".agent-context/handoff.md",
      content: `# Handoff

## Last verified

Not yet verified.

## Objective

State the objective of the latest work session.

## Changes

- List meaningful changes and the reason for each.

## Verification

- List exact checks and their results. Do not claim checks that were not run.

## Unresolved

- List known defects, decisions still needed, and assumptions that require validation.

## Next action

State the safest high-value continuation step.
`,
    },
    {
      path: ".agent-context/architecture.md",
      content: `# Architecture

## System context

Describe external actors, dependencies, trust boundaries, and deployment shape.

## Modules

Document module responsibilities and allowed dependency directions.

## Data and control flow

Document important flows and failure paths.

## Invariants

- Record properties the implementation must preserve.
`,
    },
    {
      path: ".agent-context/decisions.md",
      content: `# Decision index

Link durable decision records from this file. Each decision should include context, options,
consequences, status, and a date.

| Decision | Status | Summary |
| --- | --- | --- |
| None yet | — | Add records under \`docs/decisions/\` and link them here. |
`,
    },
    {
      path: ".agent-context/conventions.md",
      content: `# Engineering conventions

## Supported environments

Document runtime, operating system, and toolchain support.

## Commands

Document exact install, build, test, lint, and release commands.

## Change quality

- Prefer root-cause fixes over local workarounds.
- Add regression coverage for repaired defects.
- Review generated files and user-visible behavior before handoff.

## Contribution workflow

Document branch, commit, review, and release expectations.
`,
    },
  ];
}
