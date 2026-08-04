# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "16476f3 at 2026-08-05T04:58:35+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 14 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 14 file(s), +254/-194, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (14)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":".agent-context/decisions.md"}
    {"status":"M ","path":".github/workflows/ci.yml"}
    {"status":"M ","path":".github/workflows/release.yml"}
    {"status":"M ","path":"CHANGELOG.md"}
    {"status":"A ","path":"docs/decisions/0016-product-and-research-quality-gates.md"}
    {"status":"M ","path":"docs/decisions/README.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"docs/releasing.md"}
    {"status":"M ","path":"docs/testing-strategy.md"}
    {"status":"M ","path":"package.json"}
    {"status":"D ","path":"scripts/run-active-research.mjs"}
    {"status":"M ","path":"tests/product-identity.test.mjs"}
    {"status":"D ","path":"tests/research-runner.test.mjs"}

### Recent commits (5)

    {"commit":"16476f3","committedAt":"2026-08-05T04:58:35+09:00","subject":"fix: restore cross-platform research gates"}
    {"commit":"f18780d","committedAt":"2026-08-05T04:42:49+09:00","subject":"feat: warn on uninitialized resume context"}
    {"commit":"b913ae9","committedAt":"2026-08-05T04:16:33+09:00","subject":"docs: advance checkpoint to adoption evidence"}
    {"commit":"d2d3a39","committedAt":"2026-08-05T04:15:43+09:00","subject":"docs: ship STOP analysis and adoption intake"}
    {"commit":"5adb811","committedAt":"2026-08-05T03:54:06+09:00","subject":"research: stop Attempt 5 at forty-run boundary"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"16476f339fe6fc3f4f1124d5c1c465d21e55dc62","detached":false,"branch":"main","indexCommitment":"85266b33cb87d485ec9e4eb7f105b067cffbe9bf075a65784ccd6e058e3ca242"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Separate supported cross-platform product quality from the macOS-owned research harness without changing
frozen Attempt-5 evidence, weakening release blocking, or expanding Carrylog's continuity claims.

## Completed

- Exact-commit run 30944540371 exposed unconditional Seatbelt execution on Linux and an unpinned child
  reporter on Node 24. The reporter is now explicit, while failed run 30945728644 disproved the first
  eight-test portable partition by exposing ten additional Windows failures from POSIX/macOS assumptions.
- Removed the temporary allowlist runner and its regression instead of accumulating post-hoc skips around
  frozen research evidence. Attempt-5 files, manifests, results, evaluations, and STOP outcome are
  unchanged.
- ADR-0016 assigns formatting, strict type checking, product tests, and coverage to `npm run quality` on
  Linux, macOS, and Windows. Complete active research runs separately on macOS through
  `test:research:active`; `quality:research` composes both for local review.
- Branch CI now has dedicated macOS Node 22/24 research jobs. Tagged release has an equivalent two-major
  macOS research matrix, and publication depends on it plus the three-OS product/package preflight.
- Added a parsed package/workflow regression and updated the testing, release, decision, changelog,
  current-state, and engineering records to the same ownership contract.
- Independent review caught that the first tagged design covered research only on Node 24. The release
  matrix and dependency regression now cover both supported Node majors.

## Verification

- `npm run format:check`, `npm run quality`, and the composed `npm run quality:research` pass on the
  current macOS worktree. Product quality includes all configured coverage floors; complete active
  research runs without a platform-selection wrapper.
- Package inspection reports one `carrylog-0.1.0-beta.7.tgz` with 156 files and 214,292 bytes. Local,
  ephemeral, global, ESM, strict-types, migration, init, validate, checkpoint, and resume smoke paths
  pass.
- Adapter sync check, Carrylog JSON validation, Git diff checks, and an explicit frozen
  `research/continuity-r5` diff check pass.
- Initial independent code and methodology reviews returned NO-GO for a Node 22 tagged-release bypass,
  stale handoff text, and unproven “required” branch-check wording. The implementation and documents were
  corrected; both final read-only re-reviews returned GO with no remaining finding.

## Decisions

- Product support and research execution environment are separate ownership boundaries. Linux and
  Windows do not emulate or partially select a frozen macOS/POSIX experiment.
- Research remains release-blocking through complete macOS Node 22 and 24 jobs rather than by remaining
  inside the cross-platform `quality` command.
- Keep R6 projection, transcript journaling, and compaction prohibited until external adoption evidence
  creates an actionable product decision.

## Risks

- Research contracts are not cross-platform replication. A future protocol must define portable
  contracts before freeze if that evidence is needed.
- Repository workflows prove job execution and publication dependencies, not external branch-protection
  configuration. No merge-blocking “required check” claim is made.
- Runs 30944540371 and 30945728644 remain failed evidence. A fresh exact-commit branch matrix is required
  before this gate split can be considered delivered or used for a beta.8 decision.
- External adoption, perceived continuity, Cursor behavior, conversation reconstruction, repeated
  switching, journaling, and compaction value remain unproven.

## Next action

Obtain final independent GO, settle and push the checkpoint, then require a green exact-commit matrix
before returning to sanitized non-maintainer adoption evidence.
