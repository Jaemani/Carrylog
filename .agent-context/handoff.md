# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "0ee9bec at 2026-08-04T19:36:42+09:00"
- Upstream: "origin/main; ahead 18, behind 0"
- Working tree: 8 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 8 file(s), +842/-33, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (8)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1-pilot-protocol.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/README.md"}
    {"status":"A ","path":"research/continuity-r5/tier1/freeze-manifest.json"}
    {"status":"M ","path":"research/continuity-r5/tier1/preregistration.json"}
    {"status":"M ","path":"research/continuity-r5/tier1/report.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/review-attestations.json"}

### Recent commits (5)

    {"commit":"0ee9bec","committedAt":"2026-08-04T19:36:42+09:00","subject":"research: record attempt 5 harness prerequisites"}
    {"commit":"65bb802","committedAt":"2026-08-04T19:33:56+09:00","subject":"fix: settle signalled Claude verification brokers"}
    {"commit":"611a043","committedAt":"2026-08-04T19:20:28+09:00","subject":"fix: settle Claude verification brokers between profiles"}
    {"commit":"7f3f068","committedAt":"2026-08-04T19:06:29+09:00","subject":"fix: serialize Claude verification tools"}
    {"commit":"f5f7ff4","committedAt":"2026-08-04T18:56:23+09:00","subject":"research: bound Claude prerequisite across profiles"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"0ee9bec540d26bbca54ba37d8ffa9b597d8d0abf","detached":false,"branch":"main","indexCommitment":"e4ed9aabb076239525cd91a7c70abc201e82854602943a00e8857f625947f761"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Commit the reviewed attempt-5 manifest as its permanent first ADD and pass the post-commit freeze check
before any scored execution.

## Completed

- Attempt 5 remains isolated, frozen, unscored, and without observed results. Prior attempts and
  external repositories were not modified.
- Commit `611a043` integrated the reviewed barrier. Codex passed at
  `2026-08-04T10:20:58.609Z`. Routed Claude exposed only `gpt-5.6-sol` and completed the read-only exact
  tool sequence, then timed out with one broker start, no broker terminal, and no unsettled invocation.
- A first Claude command omitted the key-file bridge and stopped before provider access. The corrected
  command derived and validated the launcher-declared file without printing or persisting its path or
  value.
- The repair writes one broker terminal after stdin EOF or graceful `SIGTERM`, `SIGHUP`, or `SIGINT`,
  and only after the serialized request queue settles. `SIGKILL` remains unsettled. Critical digest
  refresh reset both prerequisites before the reviewed rerun.
- From clean commit `65bb802`, Codex CLI 0.146.0 passed at `2026-08-04T10:34:24.241Z`; native Claude
  Code 2.1.220 through JM Router passed at `2026-08-04T10:35:26.600Z`. Both used only `gpt-5.6-sol`.
  Claude completed both permission profiles and inter-profile settlement. No freeze, manifest, scored
  run, raw output, key value, or key path was retained.
- Digest `df0a0cce…dac4c` received two independent NO-GO reviews because frozen README, protocol,
  report, and context status contradicted the machine state. No attestation or manifest was written.
  The corrected language permits exact-digest review but still prohibits scoring before the permanent
  first-ADD manifest commit and post-commit check.
- Corrected digest `2e6c778d…b181573` received a safety GO. Methodology review returned NO-GO only
  because digest-excluded `report.md` still said review awaited already-passed canaries. The report now
  names the true remaining gates; the digest remained unchanged.
- Methodology recheck returned GO. Both independent reviews attest exact digest `2e6c778d…b181573`
  with empty findings. The write-once manifest exists with suite digest `cfb7d9c1…b4bd`; it has not yet
  been committed or used for a scored run.

## Verification

- The focused macOS MCP integration passes 7/7, attempt 5 passes 122/122, and full quality passes with
  active research at 131/131. Structural, order, offline isolation, and critical-digest gates pass;
  independent review returned NO-GO because active-signal settlement lacked direct coverage. The new
  focused case proves no premature terminal, exact terminal ordering and count, and clean exit. Full
  gates passed again and independent re-review returned GO with no blocking findings.
- The authenticated failure proved exact read-only tool/model evidence before the settlement timeout;
  the clean rerun then proved both profiles and repaired shutdown behavior. `--require-passed` accepts
  both current-byte attestations.

## Decisions

- Treat a graceful signal as broker settlement only after all queued invocations settle; forced or
  incomplete termination cannot produce clean evidence.
- Preserve two no-persistence Claude profiles under one asserted USD 0.75 aggregate ceiling and require
  `gpt-5.6-sol` on every assistant event.
- Make no transcript, compaction, or behavioral-continuity claim from canary evidence.

## Risks

- The prerequisites prove harness readiness only; the candidate remains unscored and unmanifested.
- Routed Claude is GPT-backed, not independent model-family replication; token accounting is unavailable.
- Process escape, TOCTOU, Windows depth, conversation reconstruction, repeated switching, journaling,
  compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

Stage the reviewed inputs, attestations, report, and manifest; refresh the checkpoint; commit once; then
run the post-commit freeze check. Do not score before it passes.
