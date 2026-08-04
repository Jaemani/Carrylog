# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "bd0f7b3 at 2026-08-05T03:19:07+09:00"
- Upstream: "origin/main; ahead 25, behind 0"
- Working tree: 72 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 72 file(s), +6940/-77, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (72)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-22a53df6b09b.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-2a7233cfd9eb.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-314db2269508.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-7d2c48a6822c.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-9e947d937387.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-b40142d22da4.json"}
    {"status":"A ","path":"research/continuity-r5/tier1/evaluations/b-e4f13bd5460e.json"}
    {"status":"M ","path":"research/continuity-r5/tier1/exclusions.csv"}
    {"status":"A ","path":"research/continuity-r5/tier1/raw-reviewed/blind/b-22a53df6b09b/artifact.json"}
    {"omitted":61}

### Recent commits (5)

    {"commit":"bd0f7b3","committedAt":"2026-08-05T03:19:07+09:00","subject":"research: checkpoint first thirty Attempt 5 runs"}
    {"commit":"69688d2","committedAt":"2026-08-05T02:49:36+09:00","subject":"research: checkpoint first twenty Attempt 5 runs"}
    {"commit":"c68d38a","committedAt":"2026-08-05T02:22:58+09:00","subject":"research: checkpoint first ten Attempt 5 runs"}
    {"commit":"ec8ab1e","committedAt":"2026-08-04T20:08:33+09:00","subject":"docs: record context budget dogfood finding"}
    {"commit":"abdfc04","committedAt":"2026-08-04T20:08:03+09:00","subject":"docs: record attempt 5 preparation readiness"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"bd0f7b378dee318395afb99305b312af6469f7c0","detached":false,"branch":"main","indexCommitment":"cac58d8903dd07d234b37e9ccf3b8e9ee088caef4e2ec77f4a78e7aeb1e0171d"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Close Attempt 5 at its preregistered STOP boundary while retaining every terminal outcome and keeping
the frozen inputs and reviewed evidence immutable.

## Completed

- Attempt 5 remains isolated and frozen at permanent boundary `ec27f44` with suite digest
  `cfb7d9c1…b4bd`. Prior attempts and external repositories were not modified.
- Dedicated owner-only temporary caches and the temporary bare BusyCafe source remain valid. All 60
  frozen cells previously passed sealed offline preparation without provider authentication.
- Runs `t1-001` through `t1-040` are terminal and privacy-reviewed: 33 scored, six retained harness
  failures, and one protocol-invalid run. Every scored artifact has a finalized blinded evaluation;
  no terminal result was retried or replaced.
- Claude runs `t1-031` and `t1-033` exited 1 after visible tool activity without success or final-
  response events. Run `t1-032` failed before provider access when its invocation omitted the required
  key-file bridge field. Later commands bound that field explicitly and completed without persisting
  a local path or value.
- The completed Claude BusyCafe protected-decision triplet produced 100%, 90%, and 80% fact recall for
  manual, Carrylog, and repository-only, with 10/10 completion for all three. The completed Codex
  Carrylog-objective triplet produced full recall and 10/10 for manual and Carrylog versus 0% and 4/10
  for repository-only. These are fixture-level observations, not product-effect claims.
- The analyzer reports `STOP` because Carrylog missed BusyCafe protected-decision item `f5` relative to
  manual handoff under both Codex and Claude. Frozen STOP-first precedence ends Attempt 5 at this
  boundary; runs `t1-041` through `t1-060` remain unstarted.

## Verification

- Attempt-5 tests pass 122/122, active research passes 131/131, structural validation accepts all 33
  finalized evaluations, and all 60 blind bundles validate.
- Derived analysis reconciles 33 scored, six harness-failure, one protocol-invalid, and 20 unstarted
  runs with no protocol diagnostic. Nineteen of 40 contrast vectors are screenable; the replicated
  manual-regression item produces the mechanical `STOP` classification. The freeze check accepts
  `cfb7d9c1…b4bd` at `ec27f44`.
- Product quality and coverage floors pass. Package inspection reports 155 files and 205,928 bytes;
  local, ephemeral, global, ESM, strict-types, migration, init, validate, checkpoint, and resume smoke
  paths pass. Isolation, current-byte prerequisites, adapter drift, and Carrylog validation also pass.
- Privacy promotion passed for every terminal result through `t1-040`; evaluation validation passed
  for every scored artifact.
- Always-loaded context is 13,506 of 16,000 allowed characters after duplicated historical detail was
  moved out of current state. Two independent re-reviews returned GO on the repaired STOP boundary.

## Decisions

- Treat a graceful signal as broker settlement only after all queued invocations settle; forced or
  incomplete termination cannot produce clean evidence.
- Preserve two no-persistence Claude profiles under one asserted USD 0.75 aggregate ceiling and require
  `gpt-5.6-sol` on every assistant event.
- Bind the required Claude key-file bridge explicitly on every local invocation; do not rely on shell
  persistence and never persist the path or value in repository evidence.
- Make no transcript, compaction, or behavioral-continuity claim from canary evidence.
- Apply the frozen STOP result without narrative override; no remaining Attempt-5 run may start.

## Risks

- The first 40 runs provide partial evidence only; 20 runs remain unstarted by the frozen STOP rule.
- Six harness failures and one protocol-invalid run reduce complete-case contrasts. Four Claude
  execution failures share a missing-success-event symptom, but successful intervening runs prevent
  treating it as a permanent outage or localizing it to one component.
- The replicated `f5` miss is a valid stop signal, not proof that Carrylog is generally worse than
  manual handoff. Root cause and generality remain unknown and require a new protocol to test.
- Routed Claude is GPT-backed, not independent model-family replication.
- Process escape, TOCTOU, Windows depth, conversation reconstruction, repeated switching, journaling,
  compaction value, Cursor behavior, and adoption remain explicit gaps.

## Next action

Commit the reviewed 40-run STOP boundary. Do not execute `t1-041`; diagnose the replicated `f5` miss
from frozen evidence, then review any proposed next experiment before freezing new inputs.
