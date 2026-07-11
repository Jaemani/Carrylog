# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "c09d7f3 at 2026-07-11T01:56:57+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 50 unstaged, 22 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 50 file(s), +2301/-386, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (72)

    {"status":" M","path":".agent-context/architecture.md"}
    {"status":" M","path":".agent-context/config.schema.json"}
    {"status":" M","path":".agent-context/config.yaml"}
    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":".agent-context/decisions.md"}
    {"status":"??","path":".agents/skills/carrylog-continuity/SKILL.md"}
    {"status":"??","path":".claude/skills/carrylog-continuity/SKILL.md"}
    {"status":" M","path":"AGENTS.md"}
    {"status":" M","path":"CHANGELOG.md"}
    {"status":" M","path":"CONTRIBUTING.md"}
    {"status":"??","path":"GEMINI.md"}
    {"status":" M","path":"README.md"}
    {"status":" M","path":"ROADMAP.md"}
    {"status":" M","path":"docs/adapter-compatibility.md"}
    {"status":" M","path":"docs/architecture.md"}
    {"status":" M","path":"docs/configuration.md"}
    {"status":" M","path":"docs/decisions/0004-cli-and-context-names.md"}
    {"status":" M","path":"docs/decisions/0006-deterministic-git-handoff-evidence.md"}
    {"status":" M","path":"docs/decisions/0008-carrylog-identity-and-v1-compatibility.md"}
    {"status":"??","path":"docs/decisions/0009-configuration-v2-and-universal-surfaces.md"}
    {"status":"??","path":"docs/decisions/0010-portable-checkpoint-and-resume-boundary.md"}
    {"status":"??","path":"docs/decisions/0011-git-stability-consumed-channels.md"}
    {"status":"??","path":"docs/decisions/0012-evidence-gates-before-continuity-expansion.md"}
    {"status":" M","path":"docs/decisions/README.md"}
    {"status":"??","path":"docs/documentation-policy.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"docs/product-scope.md"}
    {"status":" M","path":"docs/releasing.md"}
    {"status":" M","path":"docs/testing-strategy.md"}
    {"status":" M","path":"docs/threat-model.md"}
    {"status":" M","path":"package-lock.json"}
    {"status":" M","path":"package.json"}
    {"status":"??","path":"research/README.md"}
    {"status":"??","path":"research/continuity/README.md"}
    {"status":"??","path":"research/continuity/external-audit-brief-2026-07-12.md"}
    {"status":"??","path":"research/continuity/external-review-2026-07-12.md"}
    {"status":"??","path":"research/continuity/tier1-pilot-protocol.md"}
    {"status":"??","path":"schemas/config-v2.schema.json"}
    {"status":" M","path":"scripts/package-dry-run.mjs"}
    {"status":" M","path":"scripts/package-smoke.mjs"}
    {"status":" M","path":"src/adapters/registry.ts"}
    {"status":" M","path":"src/cli.ts"}
    {"status":" M","path":"src/commands/handoff.ts"}
    {"status":" M","path":"src/commands/init.ts"}
    {"status":"??","path":"src/commands/migrate.ts"}
    {"status":"??","path":"src/commands/resume.ts"}
    {"status":" M","path":"src/commands/sync.ts"}
    {"status":" M","path":"src/commands/validate.ts"}
    {"status":" M","path":"src/config/decode.ts"}
    {"status":"??","path":"src/continuity/checkpoint.ts"}
    {"status":"??","path":"src/continuity/skills.ts"}
    {"status":" M","path":"src/core/files.ts"}
    {"status":" M","path":"src/core/text.ts"}
    {"status":" M","path":"src/domain/types.ts"}
    {"status":" M","path":"src/git/inspect.ts"}
    {"status":" M","path":"src/handoff/snapshot-block.ts"}
    {"status":" M","path":"src/index.ts"}
    {"status":" M","path":"src/schema/public-schema.ts"}
    {"status":" M","path":"src/templates/defaults.ts"}
    {"status":" M","path":"src/validation/path-ownership.ts"}
    {"status":" M","path":"src/validation/validate.ts"}
    {"status":" M","path":"tests/adapters.test.mjs"}
    {"status":" M","path":"tests/adoption.test.mjs"}
    {"status":" M","path":"tests/cli.test.mjs"}
    {"status":"??","path":"tests/config-v2-migration.test.mjs"}
    {"status":" M","path":"tests/config.test.mjs"}
    {"status":"??","path":"tests/continuity.test.mjs"}
    {"status":"??","path":"tests/fixtures/adapters/agents.md"}
    {"status":"??","path":"tests/fixtures/adapters/gemini.md"}
    {"status":" M","path":"tests/handoff.test.mjs"}
    {"status":" M","path":"tests/lifecycle.test.mjs"}
    {"status":" M","path":"tests/schema.test.mjs"}

### Recent commits (5)

    {"commit":"f7d0826","committedAt":"2026-07-11T01:56:31+09:00","subject":"docs: record Carrylog beta4 verification"}
    {"commit":"d7a83e4","committedAt":"2026-07-11T01:49:11+09:00","subject":"feat: migrate project identity to Carrylog"}
    {"commit":"d99f92f","committedAt":"2026-07-10T21:39:18+09:00","subject":"docs: record beta3 release verification"}
    {"commit":"65230d8","committedAt":"2026-07-10T21:34:23+09:00","subject":"fix: publish exact local release artifact"}
    {"commit":"774dc2d","committedAt":"2026-07-10T18:19:31+09:00","subject":"fix: validate npm provenance client"}
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
- Final results are local macOS evidence; the exact reviewed commit still needs Linux/macOS/Windows CI.
- Cursor is unavailable; final authenticated Codex/Gemini conformance needs credential recovery.
- Cross-file replacement is staged and config-last but is not an OS-level transaction; ADR-0007's
  sequential rename and final path-to-syscall race remain.
- beta.4 still needs owner-authenticated registry cleanup, trusted publishing, and token retirement.

## Next action

Finish beta.4 post-publication registry and credential hardening. Then commit the reviewed beta.5
candidate, require exact-commit CI, and run the committed Tier 1 pilot.
