# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "fd5bb67 at 2026-08-02T16:48:01+09:00"
- Upstream: "origin/main; ahead 11, behind 0"
- Working tree: 157 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 157 file(s), +32745/-55, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (157)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"docs/testing-strategy.md"}
    {"status":"M ","path":"package.json"}
    {"status":"M ","path":"research/README.md"}
    {"status":"A ","path":"research/continuity-r5/tier1-pilot-protocol.md"}
    {"status":"A ","path":"research/continuity-r5/tier1/README.md"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis-dependencies.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis/analysis-dependencies.mjs"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis/analyze.mjs"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis/artifact-sanitizer.mjs"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis/claude-router-auth.mjs"}
    {"status":"A ","path":"research/continuity-r5/tier1/analysis/codex-executable.mjs"}
    {"omitted":144}

### Recent commits (5)

    {"commit":"fd5bb67","committedAt":"2026-08-02T16:48:01+09:00","subject":"research: prove repository discovery boundary"}
    {"commit":"d6df1c2","committedAt":"2026-08-02T16:09:11+09:00","subject":"research: stop Tier 1 attempt 4 after repair screen"}
    {"commit":"34352aa","committedAt":"2026-08-02T16:08:32+09:00","subject":"test: isolate active research suite"}
    {"commit":"185432b","committedAt":"2026-08-02T16:08:26+09:00","subject":"fix: bound handoff path evidence by characters"}
    {"commit":"88f6427","committedAt":"2026-08-02T15:41:25+09:00","subject":"research: freeze Tier 1 execution attempt 4"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"fd5bb6734e724aca3d5e1e30eb0885b7e5294ed6","detached":false,"branch":"main","indexCommitment":"415c3ab3633a6e4880114abd759dd0a7f17179041bf2499d4480709f08888c4d"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Commit the independently reviewed, unscored attempt-5 offline draft, then run the exact authenticated
Codex and native-Claude-through-JM-Router prerequisites from a clean commit before considering a
freeze boundary.

## Completed

- Created a fresh attempt-5 namespace, deterministic run order, blind identities, pending
  prerequisites, and empty result surfaces without copying a predecessor manifest, attestation,
  result, or frozen identity. Attempts 1 through 4 and the shipped Carrylog runtime remain unchanged.
- Integrated `none`, direct `repository`, and `repository-discovery` policies across the command
  registry, wrapper, MCP broker, Seatbelt profiles, authenticated canaries, and prepare-only screens.
  Host `/etc/gitconfig` state and copied verification-support programs are digest-bound.
- Replaced unbounded verification execution with bounded combined output, process-group
  SIGTERM/SIGKILL escalation, a final completion bound, and protocol-fatal handling for forced
  completion or signal-delivery failure.
- Added receipt format 5: direct-screen or broker-owned invocation lifecycles, live-broker ownership,
  settled nesting, an append-only observed prefix, and a final record-count, byte-count, and SHA-256
  seal. Missing, truncated, rewritten, late, mixed-origin, or unsettled streams fail closed.
- Made verification checkouts read-only while keeping bound scratch writable. Redirected Python
  bytecode and pytest state to scratch or disabled it, and bound the canonical physical macOS timezone
  root used through `PYTHONTZPATH`.
- Resolved every independent review finding, including authenticated discovery coverage, silent MCP
  success, forced-containment abort, broker/invocation settlement, late detached-child writes, and
  broker/invocation nesting. Independent re-review returned GO over the corrected 150-file surface.

## Verification

- Independent review recomputed the 150-file aggregate SHA-256 as
  `1aebc353cd626f28e232e1182bd9dfee97a76e284dbcda82fe059a727ba0f922`, passed the focused contracts,
  the complete attempt-5 suite at 116/116, the active research suite at 125/125, structural validation,
  deterministic order, the non-authenticated isolation canary, and `git diff --check`.
- Offline screens pass Carrylog continuity at 16/16 and BusyCafe focused pytest at 22/22. BusyCafe
  compileall exits zero without output. The source repository was never modified.
- After the reviewed surface stopped changing, `npm run quality`, `npm run pack:check`, and
  `npm run test:package` all exited successfully. Harness-critical bindings remain current.
- Both authenticated prerequisites remain pending. No provider call, freeze operation, manifest,
  scored run, raw provider output capture, or credential persistence occurred.

## Decisions

- Keep attempt 5 draft, unscored, and unfrozen until a clean commit passes both exact authenticated
  prerequisites and later receives two freeze-digest attestations.
- Use native Claude Code with a minimal JM Router child environment and direct `gpt-5.6-sol` for the
  controlled Claude surface. Exclude Headroom and launch wrappers from this path.
- Treat any routed-Claude catalog, resolved-model, stream, authentication, or tool-use anomaly as a
  failed prerequisite. Preserve only the redacted fixed-shape diagnostic; do not continue to freeze.
- Keep delivery, reconstruction, behavior, perceived continuity, transcript replay, and compaction
  claims separate. Attempt 5 measures the released checkpoint/resume packet, not universal sessions.

## Risks

- An escaped process may survive its original process group. Seatbelt denies network and checkout
  writes while permitting only bound scratch writes; forced or unsettled receipt state cannot
  contribute scored evidence. Arbitrary-session termination is not claimed.
- Routed Claude is GPT-backed, not an independent model-family replication. Its intermittent route
  behavior is an explicit canary concern, and token accounting remains unavailable evidence.
- A draft commit and passed prerequisites still do not authorize scored runs. Frozen status, two
  exact-digest GO attestations, and a permanent first-ADD manifest commit remain mandatory.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction,
  journaling, compaction value, Cursor CLI behavior, and wider external adoption remain unproven.
- Sequential cross-file rename, final executable-check-to-spawn TOCTOU, Windows reparse/hard-link
  depth, sparse or large-index settlement limits, and stale abnormal-termination locks remain.

## Next action

Run final formatting, attempt-5 validation, and Carrylog validation; checkpoint and commit the reviewed
draft. From that clean commit, run the Codex authenticated canary first and the native-Claude-through-
JM-Router canary second. Stop and report any Claude-to-GPT anomaly before freeze work.
