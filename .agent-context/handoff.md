# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "b913ae9 at 2026-08-05T04:16:33+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 13 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 13 file(s), +360/-52, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (13)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":".agents/skills/carrylog-continuity/SKILL.md"}
    {"status":"M ","path":"CHANGELOG.md"}
    {"status":"M ","path":"README.md"}
    {"status":"M ","path":"ROADMAP.md"}
    {"status":"M ","path":"docs/architecture.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-discovery-boundary/live-canary.mjs"}
    {"status":"M ","path":"src/cli.ts"}
    {"status":"M ","path":"src/commands/resume.ts"}
    {"status":"M ","path":"src/continuity/skills.ts"}
    {"status":"M ","path":"src/templates/defaults.ts"}
    {"status":"M ","path":"tests/continuity.test.mjs"}

### Recent commits (5)

    {"commit":"b913ae9","committedAt":"2026-08-05T04:16:33+09:00","subject":"docs: advance checkpoint to adoption evidence"}
    {"commit":"d2d3a39","committedAt":"2026-08-05T04:15:43+09:00","subject":"docs: ship STOP analysis and adoption intake"}
    {"commit":"5adb811","committedAt":"2026-08-05T03:54:06+09:00","subject":"research: stop Attempt 5 at forty-run boundary"}
    {"commit":"bd0f7b3","committedAt":"2026-08-05T03:19:07+09:00","subject":"research: checkpoint first thirty Attempt 5 runs"}
    {"commit":"69688d2","committedAt":"2026-08-05T02:49:36+09:00","subject":"research: checkpoint first twenty Attempt 5 runs"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"b913ae9d6f6687db062a9a43ac013e6956387d4d","detached":false,"branch":"main","indexCommitment":"478e6c4283e1e637e160aa432a68ebee0e616529d05c67e2b10360395fad5275"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Close the stock-placeholder ambiguity exposed by maintainer dogfood without expanding Carrylog's
continuity or semantic-freshness claims.

## Completed

- Maintainer dogfood report #7 used a sandbox clone and left the original repository unchanged. A
  Codex-authored checkpoint was structurally fresh, and a fresh Claude Code destination recovered the
  reviewed repository memory while explicitly distinguishing it from provider conversation history.
- The outcome remains partial: initialization originally contained only stock templates, and one
  narrative statement became semantically stale after its checkpoint commit. It is a directional
  workflow signal, not external adoption, independent model-family replication, or proof of semantic
  continuity.
- Added `W_CONTEXT_PLACEHOLDER` to JSON and human resume diagnostics. It compares only always-loaded
  project/current stock templates and the configured snapshot-free checkpoint, follows renamed IDs and
  moved paths, tolerates CRLF and formatting whitespace, and ignores matching on-demand references.
- Generated continuity Skills now prohibit continuity claims from stock initialization and permit
  bootstrapping only from reviewed repository evidence or user-provided facts. Human diagnostics are
  terminal-safe on stderr, while `--check` exit 1 remains reserved for stale Git evidence.
- Fixed the macOS repository-discovery canary so current focused tests and helpers are overlaid with the
  current build; the frozen Attempt-5 surface and stopped outcomes were not changed.

## Verification

- Focused continuity tests pass 33/33, including renamed IDs, moved paths, CRLF, trailing whitespace,
  repeated blank lines, checkpoint snapshots, partial editing, human diagnostics, and an on-demand stock
  reference that must not warn.
- `npm run quality` passes with all configured coverage floors and active research 131/131. Package
  inspection and local, ephemeral, global, ESM, strict-types, migration, init, validate, checkpoint, and
  resume smoke paths pass.
- Adapter sync check, Carrylog JSON validation, formatting, type checking, and Git diff checks pass.
- Independent methodology review returned GO. Independent code review found and then verified fixes for
  mutable-ID false negatives and on-demand false positives; its final static verdict is GO.

## Decisions

- Treat initialization validity, populated project memory, Git freshness, and semantic freshness as
  separate states. `W_CONTEXT_PLACEHOLDER` identifies only exact stock initialization wording.
- Preserve the JSON envelope and `--check` automation contract. Placeholder state is a warning that
  consumers inspect explicitly, not a new nonzero exit condition.
- Keep R6 projection, transcript journaling, and compaction prohibited until external adoption evidence
  creates an actionable product decision.

## Risks

- Exact-template detection cannot identify edited but stale, incomplete, or false memory.
- Report #7 is one maintainer-controlled, routed same-model-family case. External adoption, perceived
  continuity, Cursor behavior, conversation reconstruction, repeated switching, journaling, and
  compaction value remain unproven.
- A local full-gate attempt overlapped with independent reviewers cleaning the shared build directory;
  its missing-module failure is excluded and the gates were rerun after concurrent builders stopped.

## Next action

Collect a sanitized non-maintainer adoption outcome through the published beta path before implementing
a projection, transcript feature, compaction mechanism, or another provider batch.
