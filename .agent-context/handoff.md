# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "7f3f068 at 2026-08-04T19:06:29+09:00"
- Upstream: "origin/main; ahead 15, behind 0"
- Working tree: 12 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 12 file(s), +311/-74, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (12)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/README.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-contract.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-isolation-canary.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/run.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-contract.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-isolation-canary-boundary.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/run-bootstrap-boundary.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/run-contract.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/verification-receipt-protocol.mjs"}
    {"omitted":1}

### Recent commits (5)

    {"commit":"7f3f068","committedAt":"2026-08-04T19:06:29+09:00","subject":"fix: serialize Claude verification tools"}
    {"commit":"f5f7ff4","committedAt":"2026-08-04T18:56:23+09:00","subject":"research: bound Claude prerequisite across profiles"}
    {"commit":"095ffbd","committedAt":"2026-08-04T18:33:22+09:00","subject":"fix: fail closed on harness prerequisite drift"}
    {"commit":"844a456","committedAt":"2026-08-04T18:18:05+09:00","subject":"research: prepare Tier 1 execution attempt 5"}
    {"commit":"fd5bb67","committedAt":"2026-08-02T16:48:01+09:00","subject":"research: prove repository discovery boundary"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"7f3f068f8066d8e812255efe94cf14c43b956f88","detached":false,"branch":"main","indexCommitment":"b3234705530db44cf3801c22b1ac0d9e5e727faac4703c33660702a9c490d284"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Commit the reviewed Claude broker-settlement barrier, then rerun both authenticated prerequisites
before any freeze work.

## Completed

- Attempt 5 remains isolated from prior attempts and external repositories. Native Claude resolution
  bypasses the JM Router wrapper and verifies the registered target; Codex requires its exact MCP.
- Codex passed from `095ffbd`; later critical-byte changes reset it to pending.
- Routed Claude used only `gpt-5.6-sol` but stopped at `error_max_budget_usd`. Review rejected both a
  USD 6.75 process-per-probe correction and a single-session design that lost read-only coverage. The
  final design divides nine probes between USD 0.55 read-only and USD 0.20 writable processes, asserts
  the USD 0.75 total in integer cents, and rejects model-less or unregistered assistant responses.
  Both prerequisites remain pending; no freeze, scored run, or raw output persistence occurred.
- Commit `f5f7ff4` passed the Codex prerequisite. Routed Claude then failed closed because concurrent
  MCP broker lifetimes overlapped in the receipt stream. A reviewed native tool-concurrency
  control produced the same failure from commit `7f3f068`, disproving that hypothesis. The replacement
  barrier requires one process's exact broker terminal and zero unsettled state before the next process
  starts; both prerequisites are reset pending another reviewed clean commit.

## Verification

- `npm run quality` passes, including product coverage and active research at 131/131. Attempt 5 passes
  122/122; structural validation, deterministic order, the offline isolation canary, prerequisite
  validation, formatting, `resume --check`, and diff checks pass.
- Offline resolution selects signed native Claude Code 2.1.220 independently of the host `PATH` wrapper.
- The prior Codex canary passed. Routed Claude exposed only `gpt-5.6-sol`; its stale cap failed closed.
- Independent review returned GO for the settlement barrier after attempt 5 at 122/122, active research
  at 131/131, focused boundary, structural, order, CLI, checkpoint, and staged diff checks passed.

## Decisions

- Resolve controlled Claude from host `~/.local/bin/claude`, not `PATH` wrappers.
- Require the exact Codex verification MCP. Broker initialization failure must terminate the client,
  while failure diagnostics remain bounded and redacted.
- Cover both scored Claude permission profiles with two no-persistence processes: USD 0.55 read-only
  and USD 0.20 writable. Assert their integer-cent sum is USD 0.75 before provider access; exact ordered
  tool evidence, expected denials, and per-assistant model identity remain fail-closed.
- Retry neither provider from an uncommitted or unreviewed repair. Keep attestations pending until exact
  canaries pass from a clean commit.
- Keep attempt 5 draft, unscored, and unfrozen. Canary success alone still does not authorize freeze or
  continuity, transcript, or compaction claims.

## Risks

- Both prerequisites must be rerun because the budget change altered a shared critical canary file.
- The routed Claude path has not completed the full tool sequence after the budget correction. Any
  catalog, resolved-model, authentication, stream, or tool-use anomaly must stop the freeze sequence.
- The USD 0.20 writable sub-cap may be insufficient under current Router accounting. That produces a
  pending prerequisite and requires another reviewed allocation; it must not be bypassed or increased
  without preserving the USD 0.75 aggregate ceiling.
- The five-second settlement bound has not completed the routed canary. Timeout or further overlap is
  an unresolved harness lifecycle anomaly, not evidence to relax the ledger.
- Routed Claude is GPT-backed, not an independent model-family replication; token accounting remains
  unavailable evidence.
- Process escape, TOCTOU, Windows filesystem depth, large-index settlement, conversation reconstruction,
  repeated switching, journaling, compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

Commit the reviewed settlement barrier, then run Codex first and native Claude through JM Router
second. Stop on any anomaly; do not freeze until both prerequisites pass.
