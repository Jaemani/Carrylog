# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "65bb802 at 2026-08-04T19:33:56+09:00"
- Upstream: "origin/main; ahead 17, behind 0"
- Working tree: 3 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 3 file(s), +35/-22, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (3)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/harness-prerequisites.json"}

### Recent commits (5)

    {"commit":"65bb802","committedAt":"2026-08-04T19:33:56+09:00","subject":"fix: settle signalled Claude verification brokers"}
    {"commit":"611a043","committedAt":"2026-08-04T19:20:28+09:00","subject":"fix: settle Claude verification brokers between profiles"}
    {"commit":"7f3f068","committedAt":"2026-08-04T19:06:29+09:00","subject":"fix: serialize Claude verification tools"}
    {"commit":"f5f7ff4","committedAt":"2026-08-04T18:56:23+09:00","subject":"research: bound Claude prerequisite across profiles"}
    {"commit":"095ffbd","committedAt":"2026-08-04T18:33:22+09:00","subject":"fix: fail closed on harness prerequisite drift"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"65bb802f55b5469cb3c5c15bd2e57b3bc402108d","detached":false,"branch":"main","indexCommitment":"e2b6efca44d1eed0df296205d45f2c049090d7994d0e685f81ccad1664205ac5"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Commit the two passed authenticated prerequisites, then prepare the exact attempt-5 freeze review
surface before any manifest or scored execution.

## Completed

- Attempt 5 remains isolated, draft, unfrozen, and unscored. Prior attempts and external repositories
  were not modified.
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
- Retry neither provider from an uncommitted or unreviewed repair. Keep attempt 5 draft and make no
  transcript, compaction, or behavioral-continuity claim from canary evidence.

## Risks

- The prerequisites prove harness readiness only; the candidate remains draft, unfrozen, and unscored.
- Routed Claude is GPT-backed, not independent model-family replication; token accounting is unavailable.
- Process escape, TOCTOU, Windows depth, conversation reconstruction, repeated switching, journaling,
  compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

Commit the passed attestations, rerun final offline gates, then set the empty candidate to frozen and
produce its review digest. Require two exact-digest GO reviews before manifest creation.
