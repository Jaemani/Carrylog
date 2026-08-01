# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "d447dfc at 2026-08-02T02:43:39+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 3 unstaged, 0 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 3 file(s), +59/-11, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (3)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"docs/releasing.md"}

### Recent commits (5)

    {"commit":"d447dfc","committedAt":"2026-08-02T02:43:39+09:00","subject":"release: prepare Carrylog beta6"}
    {"commit":"60e2833","committedAt":"2026-08-02T02:37:39+09:00","subject":"research: refresh continuity harness binding"}
    {"commit":"dc2e7cb","committedAt":"2026-08-02T02:32:32+09:00","subject":"fix: restore cross-platform continuity contracts"}
    {"commit":"191db00","committedAt":"2026-08-02T01:39:51+09:00","subject":"fix: resolve pinned Carrylog without agent file discovery"}
    {"commit":"f64f5df","committedAt":"2026-07-13T03:10:55+09:00","subject":"research: harden Tier 1 continuity candidate"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Close beta.6 publication with independently verified registry evidence and hand off to bounded
external adoption and repeated-switch outcome testing.

## Completed

- Released immutable `v0.1.0-beta.6` from commit `d447dfc` after clean local release verification,
  eleven green exact-commit CI jobs, and a dedicated release review.
- Release run `30711101598` passed tagged Linux, macOS, and Windows preflight and the protected npm
  OIDC publish job.
- Independently verified the registry artifact, dist-tags, signature, SLSA provenance, isolated
  `npx`, isolated-prefix global installation, and a fresh-repository public-package lifecycle.
- Recorded the original cross-harness Skill discovery defect, failed diagnostic CI runs, root-cause
  corrections, and complete publication evidence in `docs/engineering-log.md`.

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

## Decisions

- Ignored project-local executables use exact filesystem probing and fail closed on unusable or
  uncertain candidates; only true absence permits global fallback.
- Local prepare and protected publish hosts are separate pack operations. Registry bytes are bound
  to the one job artifact that was verified and published; cross-host reproducible tarballs are not
  claimed.
- Beta.6 evidence covers repository-memory delivery, reconstruction, and deterministic lifecycle.
  It does not establish transcript portability, repeated-switch behavior, or compaction value.

## Risks

- Formal Tier 1 Codex and Claude prerequisites remain pending for the current critical harness bytes;
  the installed Claude/GPT router does not match the frozen native-Claude protocol identity.
- Cursor CLI is unavailable locally, and Gemini/Cursor behavioral evidence remains future work.
- A normal Claude invocation still needs explicit router settings and model selection.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Commit this publication checkpoint, then preregister a small public-beta adoption and repeated-switch
pilot for the installed Codex and Claude/GPT-router surfaces before executing it or changing claims.
