# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "844a456 at 2026-08-04T18:18:05+09:00"
- Upstream: "origin/main; ahead 12, behind 0"
- Working tree: 12 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 12 file(s), +104/-62, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (12)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/README.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/claude-router-auth.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-contract.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-isolation-canary.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/harness-prerequisites.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/run.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/claude-router-auth.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-contract.test.mjs"}
    {"status":"M ","path":"research/continuity-r5/tier1/analysis/tests/harness-isolation-canary-boundary.test.mjs"}
    {"omitted":1}

### Recent commits (5)

    {"commit":"844a456","committedAt":"2026-08-04T18:18:05+09:00","subject":"research: prepare Tier 1 execution attempt 5"}
    {"commit":"fd5bb67","committedAt":"2026-08-02T16:48:01+09:00","subject":"research: prove repository discovery boundary"}
    {"commit":"d6df1c2","committedAt":"2026-08-02T16:09:11+09:00","subject":"research: stop Tier 1 attempt 4 after repair screen"}
    {"commit":"34352aa","committedAt":"2026-08-02T16:08:32+09:00","subject":"test: isolate active research suite"}
    {"commit":"185432b","committedAt":"2026-08-02T16:08:26+09:00","subject":"fix: bound handoff path evidence by characters"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"844a45642d8b527f0bca713e989a637227d494ff","detached":false,"branch":"main","indexCommitment":"174c002c32c005e9f28b124e98a6085b8fc0f733e8b60f1da22058bcf484d29c"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Repair the two failures exposed by the first authenticated attempt-5 prerequisites, obtain fresh
offline review, and rerun both canaries from a clean committed checkpoint before any freeze work.

## Completed

- Committed the independently reviewed offline draft at `844a456` and confirmed its checkpoint was
  ready before provider access. Attempts 1 through 4 and external source repositories remain unchanged.
- Ran the Codex prerequisite once. It reached the model but exposed zero configured verification MCP
  tools, so all required actions were absent and the prerequisite remained pending.
- Attempted the Claude prerequisite, which stopped before route attestation or provider access because
  host `PATH` selected the JM Router launcher rather than the preregistered native Claude binary.
- Replaced PATH-based Claude discovery with direct host `~/.local/bin/claude` resolution plus target
  digest verification. A regression includes a competing wrapper and rejects relative or mismatched
  executable candidates.
- Added bounded redacted Codex stderr to exact-probe failures. Independent review then found the MCP
  server was not marked required; the shared canary and scored invocation now set
  `mcp_servers.carrylog_verification.required=true` so startup cannot degrade to a tool-free turn.
- Refreshed harness-critical bindings. Both prerequisites remain pending; no freeze, manifest, or
  scored run was created.

## Verification

- Focused Claude authentication, harness contract, and canary boundary tests pass 28/28 after both
  repairs. The complete attempt-5 suite passes 116/116.
- Structural validation, deterministic order, the non-authenticated isolation canary, prerequisite
  binding validation, formatting, and `git diff --check` pass.
- Final `npm run quality` passes, including product coverage and the active research suite at 125/125.
- Direct offline resolution selects the signed native Claude Code 2.1.220 target despite the earlier
  JM Router wrapper on host `PATH`.
- Fresh independent review accepted the Claude locator but returned NO-GO until the Codex broker was
  marked required. Re-review of that repair paused because always-context exceeded its 16,000-character
  budget before this smaller checkpoint snapshot was generated.

## Decisions

- Resolve the controlled Claude client from host `~/.local/bin/claude`, not `PATH`; route wrappers are
  interactive surfaces, not preregistered client binaries.
- Require the exact Codex verification MCP. Broker initialization failure must terminate the client,
  while failure diagnostics remain bounded and redacted.
- Do not retry either provider from an uncommitted or unreviewed repair. Keep both attestations pending
  until exact canaries pass from a clean commit.
- Keep attempt 5 draft, unscored, and unfrozen. Canary success alone still does not authorize freeze or
  continuity, transcript, or compaction claims.

## Risks

- The underlying Codex MCP startup failure is not yet known. `required=true` makes it observable and
  fail-closed but may reveal another defect on the next clean-commit canary.
- The routed Claude provider path has not run after native-client repair. Any catalog, resolved-model,
  authentication, stream, or tool-use anomaly must stop the prerequisite and freeze sequence.
- Routed Claude is GPT-backed, not an independent model-family replication; token accounting remains
  unavailable evidence.
- Process escape, TOCTOU, Windows filesystem depth, large-index settlement, conversation reconstruction,
  repeated switching, journaling, compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

Generate this smaller checkpoint snapshot, confirm resume is back under budget, and complete fresh
offline review of the required-broker repair. Commit only after GO. Then run Codex first; if it passes,
run native Claude through JM Router and stop on any routed-model anomaly. Do not freeze yet.
