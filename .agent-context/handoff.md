# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "ec27f44 at 2026-08-04T19:51:11+09:00"
- Upstream: "origin/main; ahead 19, behind 0"
- Working tree: 3 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 3 file(s), +17/-8, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (3)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"research/continuity-r5/tier1/report.md"}

### Recent commits (5)

    {"commit":"ec27f44","committedAt":"2026-08-04T19:51:11+09:00","subject":"research: freeze Tier 1 execution attempt 5"}
    {"commit":"0ee9bec","committedAt":"2026-08-04T19:36:42+09:00","subject":"research: record attempt 5 harness prerequisites"}
    {"commit":"65bb802","committedAt":"2026-08-04T19:33:56+09:00","subject":"fix: settle signalled Claude verification brokers"}
    {"commit":"611a043","committedAt":"2026-08-04T19:20:28+09:00","subject":"fix: settle Claude verification brokers between profiles"}
    {"commit":"7f3f068","committedAt":"2026-08-04T19:06:29+09:00","subject":"fix: serialize Claude verification tools"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"ec27f44924749a84bb53a84d71f8408f9cb6de68","detached":false,"branch":"main","indexCommitment":"f2d8ef777b3470e589468ff11840a5fe9f991de14d04287a99d4bc5958be1e61"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Prepare all frozen Attempt-5 comparison cells without provider execution, then confirm the USD/time
envelope before starting the scored batch.

## Completed

- Attempt 5 remains isolated, frozen, unscored, and without observed results. Prior attempts and
  external repositories were not modified.
- The broker, key-bridge, budget, and failed-hypothesis chronology is preserved in the engineering log.
  Graceful broker signals settle only after queued invocations; forced termination remains unsettled.
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
  been used for a scored run.
- Manifest first-ADD commit `ec27f44` passed post-commit verification. The frozen order has 30 Claude
  runs at a USD 0.75 per-run cap (USD 22.50 maximum) plus 30 Codex subscription runs and a 15-hour
  serial timeout ceiling. Required setup cache and temporary bare BusyCafe source remain unconfigured.

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

Create owned temporary setup/cache roots and the exact bare BusyCafe source, prepare every comparison
cell online then offline without `--execute`, and rerun `freeze --check` before scored authorization.
