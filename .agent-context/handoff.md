# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "095ffbd at 2026-08-04T18:33:22+09:00"
- Upstream: "origin/main; ahead 13, behind 0"
- Working tree: 8 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 8 file(s), +192/-91, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (8)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/README.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-contract.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-isolation-canary.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-contract.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-isolation-canary-boundary.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/harness-prerequisites.json"}

### Recent commits (5)

    {"commit":"095ffbd","committedAt":"2026-08-04T18:33:22+09:00","subject":"fix: fail closed on harness prerequisite drift"}
    {"commit":"844a456","committedAt":"2026-08-04T18:18:05+09:00","subject":"research: prepare Tier 1 execution attempt 5"}
    {"commit":"fd5bb67","committedAt":"2026-08-02T16:48:01+09:00","subject":"research: prove repository discovery boundary"}
    {"commit":"d6df1c2","committedAt":"2026-08-02T16:09:11+09:00","subject":"research: stop Tier 1 attempt 4 after repair screen"}
    {"commit":"34352aa","committedAt":"2026-08-02T16:08:32+09:00","subject":"test: isolate active research suite"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"095ffbd7777d969a1b812bbd5e5d0d167cea9344","detached":false,"branch":"main","indexCommitment":"133a3e58d22f6e957c79723f327a38a49e2282a1beb609c39f22495f37c2c1bc"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Run both authenticated prerequisites from the reviewed two-profile Claude canary repair commit before
any freeze work.

## Completed

- The reviewed attempt-5 draft remains isolated from attempts 1 through 4 and external repositories.
  Native Claude resolution now bypasses the interactive JM Router wrapper and verifies the registered
  target digest. Codex requires its exact verification MCP and emits bounded redacted failure details.
- The repaired Codex prerequisite passed from commit `095ffbd`; later critical-byte changes correctly
  reset it to pending.
- Routed Claude used only `gpt-5.6-sol` but stopped at `error_max_budget_usd`. Review rejected both a
  USD 6.75 process-per-probe correction and a single-session design that lost read-only coverage. The
  final design divides nine probes between USD 0.55 read-only and USD 0.20 writable processes, asserts
  the USD 0.75 total in integer cents, and rejects model-less or unregistered assistant responses.
  Both prerequisites remain pending; no freeze, manifest, scored run, or raw output persistence occurred.

## Verification

- `npm run quality` passes, including product coverage and active research at 125/125. Attempt 5 passes
  116/116; structural validation, deterministic order, the offline isolation canary, prerequisite
  validation, formatting, `resume --check`, and diff checks pass.
- Direct offline resolution selects the signed native Claude Code 2.1.220 target despite the earlier
  JM Router wrapper on host `PATH`.
- The post-GO Codex canary passed. The routed-Claude catalog and every observed assistant response
  identified `gpt-5.6-sol`; only the stale budget cap failed.
- Independent review returned GO for the final repair after focused tests at 22/22, attempt 5 at
  116/116, structural and order checks, prerequisite validation, fresh resume, and staged diff checks.

## Decisions

- Resolve the controlled Claude client from host `~/.local/bin/claude`, not `PATH`; route wrappers are
  interactive surfaces, not preregistered client binaries.
- Require the exact Codex verification MCP. Broker initialization failure must terminate the client,
  while failure diagnostics remain bounded and redacted.
- Cover both scored Claude permission profiles with two no-persistence processes: USD 0.55 read-only
  and USD 0.20 writable. Assert their integer-cent sum is USD 0.75 before provider access; exact ordered
  tool evidence, expected denials, and per-assistant model identity remain fail-closed.
- Do not retry either provider from an uncommitted or unreviewed repair. Keep both attestations pending
  until exact canaries pass from a clean commit.
- Keep attempt 5 draft, unscored, and unfrozen. Canary success alone still does not authorize freeze or
  continuity, transcript, or compaction claims.

## Risks

- Both prerequisites must be rerun because the budget change altered a shared critical canary file.
- The routed Claude path has not completed the full tool sequence after the budget correction. Any
  catalog, resolved-model, authentication, stream, or tool-use anomaly must stop the freeze sequence.
- The USD 0.20 writable sub-cap may be insufficient under current Router accounting. That produces a
  pending prerequisite and requires another reviewed allocation; it must not be bypassed or increased
  without preserving the USD 0.75 aggregate ceiling.
- Routed Claude is GPT-backed, not an independent model-family replication; token accounting remains
  unavailable evidence.
- Process escape, TOCTOU, Windows filesystem depth, large-index settlement, conversation reconstruction,
  repeated switching, journaling, compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

From the new clean commit, run Codex first and native Claude through JM Router second. Stop on any
model, stream, authentication, budget, or tool anomaly; do not freeze until both prerequisites pass.
