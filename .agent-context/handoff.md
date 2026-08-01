# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "d16af41 at 2026-08-02T03:00:29+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 4 unstaged, 1 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 4 file(s), +40/-10, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (5)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":"ROADMAP.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"research/continuity/README.md"}
    {"status":"??","path":"research/continuity/public-beta-switch-smoke-2026-08-02.md"}

### Recent commits (5)

    {"commit":"d16af41","committedAt":"2026-08-02T03:00:29+09:00","subject":"docs: record Carrylog beta6 publication"}
    {"commit":"d447dfc","committedAt":"2026-08-02T02:43:39+09:00","subject":"release: prepare Carrylog beta6"}
    {"commit":"60e2833","committedAt":"2026-08-02T02:37:39+09:00","subject":"research: refresh continuity harness binding"}
    {"commit":"dc2e7cb","committedAt":"2026-08-02T02:32:32+09:00","subject":"fix: restore cross-platform continuity contracts"}
    {"commit":"191db00","committedAt":"2026-08-02T01:39:51+09:00","subject":"fix: resolve pinned Carrylog without agent file discovery"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Record the completed public beta.6 switch smoke and hand off to a bounded second-repository
comparative adoption design.

## Completed

- Released immutable `v0.1.0-beta.6` from commit `d447dfc` after clean local release verification,
  eleven green exact-commit CI jobs, and a dedicated release review.
- Release run `30711101598` passed tagged Linux, macOS, and Windows preflight and the protected npm
  OIDC publish job.
- Independently verified the registry artifact, dist-tags, signature, SLSA provenance, isolated
  `npx`, isolated-prefix global installation, and a fresh-repository public-package lifecycle.
- Recorded the original cross-harness Skill discovery defect, failed diagnostic CI runs, root-cause
  corrections, and complete publication evidence in `docs/engineering-log.md`.
- Ran a fresh Codex-to-Claude/GPT-router-to-Codex sequence in an isolated Personal Context fixture.
  Every stage resumed a current checkpoint, retained the protected decisions, preserved prior stage
  bytes, ran its assigned check, and stayed inside the allowed three-file change boundary.
- Added a sanitized research report without provider transcripts, credentials, settings, histories,
  hidden reasoning, or raw streams.

## Verification

- The publish job and independent download share SHA-256
  `c434fc14e61a3395f79b63a6d7395015d7ae55ac2673ebc59d366d8fd822871e`; the registry reports
  148 files, 159,196 packed bytes, and 601,312 unpacked bytes.
- `beta` resolves to `0.1.0-beta.6`; the policy-bound `latest` remains `0.1.0-beta.4`.
- `npm audit signatures` verified the installed graph and attestation. SLSA binds the package to
  `Jaemani/Carrylog`, `release.yml`, tag beta.6, commit `d447dfc`, and run `30711101598` attempt 1.
- A public beta.6 installation initialized all four harness surfaces in a fresh Git repository,
  validated cleanly, refreshed its checkpoint, and resumed with `checkpoint.stale=false`.
- Pre-release quality passed 235/235 tests; exact measurements and workflow identifiers are recorded
  once in the engineering log.
- The repeated-switch fixture passed Stage A typecheck, Stage B's 63 tests, Stage C build, and final
  Carrylog validation with `checkpoint.stale=false`.

## Decisions

- Ignored project-local executables use exact filesystem probing and fail closed on unusable or
  uncertain candidates; only true absence permits global fallback.
- Local prepare and protected publish hosts are separate pack operations. Registry bytes are bound
  to the one job artifact that was verified and published; cross-host reproducible tarballs are not
  claimed.
- Beta.6 evidence covers repository-memory delivery, reconstruction, and deterministic lifecycle.
  The new smoke adds one bounded two-switch behavior sequence, not arbitrary switch invariance,
  transcript portability, or compaction value.

## Risks

- Formal Tier 1 Codex and Claude prerequisites remain pending for the current critical harness bytes;
  the installed Claude/GPT router does not match the frozen native-Claude protocol identity.
- Cursor CLI is unavailable locally, and Gemini/Cursor behavioral evidence remains future work.
- A normal Claude invocation still needs explicit router settings and model selection.
- Wrapper-aware command permissions and reliable router input-token accounting are unresolved; the
  first narrow Claude attempt denied `rtk npx ...` even though unwrapped `npx ...` was allowed.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Commit the sanitized switch-smoke evidence, then design a second-repository comparison across
repository-only, manual-handoff, and Carrylog conditions before executing it or changing claims.
