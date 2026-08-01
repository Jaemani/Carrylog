# Public beta repeated-switch smoke — 2026-08-02

- Status: completed single-fixture product smoke
- Carrylog package: `0.1.0-beta.6`
- Evidence level: delivery, reconstruction, and one bounded behavior sequence
- Not evidence for: universal conversation resume, provider-session portability, semantic
  compaction, user perception, or Tier 1 comparative outcomes

## Question

Can fresh Codex, Claude Code through the configured GPT router, and another fresh Codex session
continue one bounded task sequence from repository-owned Carrylog state without transferring a
provider transcript, session, history, or hidden compact?

## Fixture and environment

The operator cloned tracked Personal Context branch `codex/runtime-v1-stabilization` into a temporary
root. Product baseline `6c046ce` contained the provenance-dataflow evaluation correction. A local-only
fixture commit `36d3515` added Carrylog context, Codex and Claude adapters, and generated Skills; it did
not change product code. The live Personal Context working tree was not modified.

The smoke used:

- public project-local `carrylog@0.1.0-beta.6`;
- Codex CLI `0.146.0`, model `gpt-5.6-sol`, medium reasoning, fresh ephemeral sessions;
- Claude Code `2.1.220` through model alias `claude-route-codex`, with session persistence disabled;
- one isolated temporary Git clone with no production access requirement.

This was not the frozen Tier 1 harness. Codex loaded the operator's configured provider and hooks.
Claude required the operator's explicit local router settings and an authentication helper. No
credential value, helper command, user setting, provider session, raw model stream, or hidden
reasoning was copied into the fixture or this report.

## Predeclared task boundary

Only these paths could change after the fixture commit:

- `docs/SWITCH-SMOKE.md`;
- `.agent-context/current-state.md`;
- `.agent-context/handoff.md`.

Product code, tests, package metadata, lockfiles, and existing product documentation were prohibited.
The agents had to retain six facts or constraints:

1. branch `codex/runtime-v1-stabilization`;
2. product baseline `6c046ce` versus Carrylog fixture HEAD `36d3515`;
3. MCP remains read-only;
4. runtime behavior remains independent of Obsidian APIs and plugin state;
5. literal text overlap is not proof of evaluation leakage;
6. excluded source paths into model input, enforced through provenance dataflow, are the relevant
   isolation boundary.

Stage A belonged to Codex and required `npm run check`. Stage B belonged to a fresh Claude session,
had to preserve Stage A, and required `npm test`. Stage C belonged to a fresh Codex session, had to
preserve Stages A and B, and required `npm run build`. Every stage had to leave a valid, current
Carrylog checkpoint.

## Results

### Stage A — Codex

The generated Skill selected the project-local beta.6 executable. `resume --check` reported a current
checkpoint. Codex distinguished the product baseline from the fixture commit, retained all protected
boundaries and the rejected literal-overlap approach, created Stage A, and ran `npm run check`
successfully. Checkpoint, validation, and final resume checks passed. Only the three allowed paths
changed.

Codex reported 69,301 tokens for this stage. Much of the work was redundant repository and diff
reinspection beyond the small continuation task. This is evidence that correct delivery does not by
itself guarantee efficient continuation.

### Stage B — Claude Code through the GPT router

An ordinary Claude invocation with the configured alias returned HTTP 404. Supplying the explicit
local settings file made the same no-tool canary succeed. The first bounded Stage B attempt then
failed closed before editing: the environment caused Claude to prefix the required command with
`rtk`, while the narrow permission list allowed only the unwrapped `npx` command. The attempt made no
file change and ran no test. It completed in 32.965 seconds, emitted 920 output tokens, and reported
USD 0.023 cost.

A fresh retry added only equivalent `rtk`-prefixed command permissions. Claude selected the
project-local executable, resumed the Stage A checkpoint, preserved Stage A byte-for-byte, retained
all six facts and constraints, appended Stage B, and ran 18 test files and 63 tests successfully. It
left checkpoint, validation, and resume checks ready for Stage C. The successful attempt completed in
177.696 seconds over 18 turns, emitted 6,339 output tokens, and reported USD 0.158475 cost. Router
telemetry reported zero input tokens, so it cannot support an input-cost comparison.

### Stage C — fresh Codex

The new Codex session resumed the Claude-authored checkpoint without any Claude session identifier or
transcript. It retained all six facts and constraints, preserved the 1,783-byte Stage A/B prefix at
SHA-256 `0e8c8e8b3d0544ee5b2b5986666272a6faf421679eadf955cc06b53ee1a73a82`, appended Stage C,
and ran `npm run build` successfully. Final checkpoint, validation, and `resume --check` passed. Codex
reported 46,717 tokens.

The Stage C artifact described continuation without user configuration. Interpreted literally for
harness execution, that wording is too broad: Codex used its configured provider and hooks, and
Claude used the explicit router settings. The supported observation is narrower—no user or provider
configuration was transferred through Carrylog or used as project-continuity state.

An independent operator check confirmed clean Carrylog validation, `checkpoint.stale=false`, and no
changed path outside the allowed three-file surface. Stage C relied on the checkpointed Stage A and B
verification results rather than rerunning them; it independently ran only the required build.

## Findings

1. Public beta.6 produced a successful Codex-to-Claude-to-Codex repository-memory continuation in one
   real external codebase fixture.
2. The agents used prior decisions and verification state, preserved earlier work, and avoided the
   prohibited product changes. This is bounded behavior evidence, not merely an acknowledgement.
3. The Claude router is not configuration-free. Explicit settings were necessary, and router input
   token telemetry was unusable for comparison.
4. Exact command permissions compose poorly with environmental wrappers such as `rtk`. The Skill
   failed closed, but a future launch or capability profile must normalize executable identity rather
   than assume literal shell strings.
5. Continuity did not demonstrate token efficiency. Both Codex stages used tens of thousands of
   tokens for a small task, so any compact or efficiency claim still requires comparative evidence.

## Claim boundary and next experiment

This smoke supports the statement that Carrylog beta.6 can carry reviewable project and task state
through one Codex-to-Claude/GPT-router-to-Codex sequence. It does not support claims about native
Claude models, Cursor or Gemini, arbitrary repeated switching, conversation replay, hidden compact
portability, or superior compaction.

The next experiment should retain this smoke as an adoption observation and separately amend or
replace the unexecuted Tier 1 candidate for current harness capability profiles. It must compare
repository-only, manual handoff, and Carrylog conditions across a second repository before changing
product claims. Router settings, wrapper-prefixed permission matching, usable token accounting, and
bounded agent reinspection should become explicit measurements rather than silent setup assumptions.
