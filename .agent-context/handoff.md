# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "34352aa at 2026-08-02T16:08:32+09:00"
- Upstream: "origin/main; ahead 9, behind 0"
- Working tree: 53 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 53 file(s), +5335/-88, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (53)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-16e28660d6fe.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-242cc7b9b955.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-7dffbd3b2e6e.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-a0e045a8669d.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-c19c7714f4af.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/evaluations/b-f0b2ada28624.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/raw-reviewed/blind/b-16e28660d6fe/artifact.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/raw-reviewed/blind/b-242cc7b9b955/artifact.json"}
    {"status":"A ","path":"research/continuity-r4/tier1/raw-reviewed/blind/b-7dffbd3b2e6e/artifact.json"}
    {"omitted":42}

### Recent commits (5)

    {"commit":"34352aa","committedAt":"2026-08-02T16:08:32+09:00","subject":"test: isolate active research suite"}
    {"commit":"185432b","committedAt":"2026-08-02T16:08:26+09:00","subject":"fix: bound handoff path evidence by characters"}
    {"commit":"88f6427","committedAt":"2026-08-02T15:41:25+09:00","subject":"research: freeze Tier 1 execution attempt 4"}
    {"commit":"b6fa1ba","committedAt":"2026-08-02T15:04:05+09:00","subject":"research: stop Tier 1 attempt 3 for redesign"}
    {"commit":"5fdc593","committedAt":"2026-08-02T14:44:57+09:00","subject":"research: record initial Tier 1 comparison"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"34352aae6abc57176933ece346532b6f8bcde727","detached":false,"branch":"main","indexCommitment":"804222151cc41b61897cf958cf15a53c0dd5ac167d224f201883b38f2a9a7c8c"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Close Tier 1 attempt 4 without spending the remaining 54 runs on a known verification-harness
ceiling, then prototype the missing repository-discovery boundary outside frozen evidence.

## Completed

- Frozen attempt 4 at commit `88f6427` and rechecked its permanent manifest boundary.
- Executed the six preregistered verification-readiness cells across Codex, routed Claude, and all
  three conditions. Each artifact passed explicit privacy review and blind item-level evaluation.
- Preserved six scored results and left 54 runs unstarted. Frozen inputs and predecessor attempts were
  not modified.
- Identified a condition-independent harness defect: all six focused suites passed 11/16 and failed
  the same five outer-repository Git cases after `gitContext:none` removed detached Git selection.
- Kept credential values and paths, raw provider output, private sessions, and hidden reasoning out of
  evidence. Claude resolved only the preregistered direct `gpt-5.6-sol` model.

## Verification

- Attempt-4 freeze check returned suite digest
  `02e226886d1a7d99833f243ed686f809d20a23e6b3d2efdb78a7a57a5cb58ef5` and freeze commit
  `88f6427eb911958e2ac36ebb003f5aee6f31d28b` after results existed.
- Structural validation reported 10 tasks, 60 runs, and six evaluations. Analysis reports six scored,
  54 not started, no protocol diagnostics, and mechanical `REDESIGN` while the matrix is incomplete.
- All six privacy reviews found no sensitive exposure; all six evaluations found zero prohibited
  reversals, repeated work, and unnecessary clarification.
- Before execution, product quality, 93 active research tests, package smoke, offline preparation,
  both authenticated canaries, and two exact-digest reviews passed. Exact prior measurements remain
  in the engineering log.

## Decisions

- Stop attempt 4 after the planned six-cell repair screen. More provider runs cannot validate task
  completion while the registered verifier hides the fixture repository from the tested process.
- Do not change frozen attempt-4 inputs or reinterpret its six results as universal continuity proof.
- Attempt 5 is not authorized by a code-only fix. One non-scored canary must prove outer-repository
  discovery, nested Git independence, read-only metadata, and network denial together.
- Keep bounded-handoff product work and mutable research outcomes in separate commits.

## Risks

- The binary `repository`/`none` policy solved inherited selection but cannot represent a non-Git
  process that legitimately invokes Git against both the outer fixture and independent nested repos.
- The six-cell contrasts are single observations. Codex showed Carrylog equal to manual and above
  repository-only; routed Claude showed repository-only above both supplied-context conditions.
- Routed Claude is a distinct harness surface over the same GPT model family, not an independent
  model replication. Its zero input/cache token fields remain unavailable for efficiency claims.
- Carrylog's own current context exceeded the configured 16,000-character always budget before this
  handoff/current-state compaction; validation must confirm the repair before checkpointing.

## Next action

Review and commit the bounded handoff evidence change, commit attempt-4 reviewed outputs and this
decision separately, then build a throwaway canary for repository discovery without inherited
`GIT_DIR` or `GIT_WORK_TREE`. Do not create attempt 5 until the exact previously failing tests pass.
