# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "243e1d5 at 2026-07-12T04:22:33+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 2 unstaged, 0 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 2 file(s), +12/-4, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (2)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":"docs/engineering-log.md"}

### Recent commits (5)

    {"commit":"243e1d5","committedAt":"2026-07-12T04:22:33+09:00","subject":"feat: add universal Carrylog continuity"}
    {"commit":"f7d0826","committedAt":"2026-07-11T01:56:31+09:00","subject":"docs: record Carrylog beta4 verification"}
    {"commit":"d7a83e4","committedAt":"2026-07-11T01:49:11+09:00","subject":"feat: migrate project identity to Carrylog"}
    {"commit":"d99f92f","committedAt":"2026-07-10T21:39:18+09:00","subject":"docs: record beta3 release verification"}
    {"commit":"65230d8","committedAt":"2026-07-10T21:34:23+09:00","subject":"fix: publish exact local release artifact"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Turn the completed external review into a delivery-focused beta.5 candidate, an enforceable evidence
boundary, and an executable Tier 1 pilot without implementing journaling or compaction.

## Completed

- Built the beta.5 configuration-v2 migration, universal surfaces, continuity Skills, guarded
  checkpoint/resume, and evidence gates without changing frozen v1 wire identities.
- Resolved independent review findings in parsing, terminal output, executable resolution, legacy
  evidence scanning, v1 migration, resource bounds, public API validation, and package boundaries.
- Published immutable beta.4 through failed-job-only recovery and independently verified its public
  artifact, provenance, installation, initialization, and validation.
- Reworked user and maintainer docs around installability, measured adoption, evidence ownership, and
  a minimum Tier 1 pilot; journaling and compaction remain research-only.

## Verification

- Full local quality and package gates pass, including the new hostile-input, global-shadow,
  stock-v1-snapshot migration, aggregate-memory, and package-boundary regressions.
- Independent post-fix code/security review reports all findings resolved; dogfood sync, validation,
  checkpoint freshness, and resume pass. Exact evidence belongs to the engineering log.
- The reviewed beta.5 implementation commit passed all eleven Linux/macOS/Windows CI jobs, including
  minimum Node, packed consumers, the release client, and npm 12 contracts.
- Harness discovery has local Codex/Gemini and one authenticated Claude reconstruction result; Cursor
  remains unavailable, so cross-harness behavioral continuity is not claimed.
- Beta.4 is publicly installable and cryptographically verified, but unintended registry tags and
  credential retirement remain incomplete administration.

## Decisions

- Configuration v1 stays frozen; v2 is explicit and fail-closed. Codex/Cursor share `AGENTS.md` and
  the generic Skill; Claude uses a minimal Skill adapter; Gemini has its own root adapter.
- Portable continuity is reviewed repository state plus fresh Git observation, never transcripts,
  hidden reasoning, provider stores, credentials, or native-compaction state.
- ADR-0012 permits the narrow checkpoint beta with documented gaps but gates behavioral continuity,
  journaling, and semantic-compaction claims on staged evidence.

## Risks

- Cross-harness behavioral continuity, repeated-switch retention, all-record value, and compaction
  superiority remain unproven.
- The future tagged release commit changes packaged documentation and still needs exact-commit gates.
- Cursor is unavailable; final authenticated Codex/Gemini conformance needs credential recovery.
- Cross-file replacement is staged and config-last but is not an OS-level transaction; ADR-0007's
  sequential rename and final path-to-syscall race remain.
- beta.4 still needs owner-authenticated registry cleanup, trusted publishing, and token retirement.

## Next action

Finish beta.4 post-publication registry and credential hardening. Then prepare the exact beta.5
release commit and gates, and run the committed Tier 1 pilot.
