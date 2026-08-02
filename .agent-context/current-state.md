# Current state

## Active objective

Close Tier 1 attempt 4 after its repair screen found a remaining verification-repository isolation
defect. Preserve all six scored results, stop the other 54 runs, and design a successor only after a
canary proves both outer-repository access and nested Git independence.

## Implemented and verified

- The strict TypeScript CLI provides deterministic initialization, adapter synchronization,
  validation, Git handoff, v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen. Version 2 routes Codex/Cursor, Claude, and Gemini to one canonical
  context layer and installs offline continuity Skills with fail-closed ownership.
- Resume uses stable bounded file and Git observations and exports no provider transcript or session
  state. Structural validity, Git freshness, and behavioral continuity remain separate evidence.
- ADR-0009 through ADR-0015 define universal surfaces, continuity boundaries, Git stability, evidence
  gates, checkpoint settlement, generated-artifact EOL equivalence, and bounded handoff path evidence.
- Immutable beta.7 passed the full Node 22/24 and three-OS matrices, protected OIDC publication,
  registry digest and provenance verification, isolated consumers, signature audit, and a fresh
  checkpoint lifecycle. Exact measurements remain in the engineering log.
- Handoff path examples now obey both a 200-entry cap and a 1,024-character rendered-evidence cap
  while preserving complete aggregate counts and explicit omission.

## In progress

- Attempts 1 and 2 remain immutable aborted bootstrap evidence. Attempt 3 is frozen at `b72127e`; it
  stopped after 11 scored runs and one reviewed delivery failure because Carrylog surfaces were not
  synchronized and non-Git verification inherited detached Git selection.
- Attempt 4 is frozen at `88f6427` with suite digest
  `02e226886d1a7d99833f243ed686f809d20a23e6b3d2efdb78a7a57a5cb58ef5`. Both authenticated
  prerequisites and two exact-digest reviews passed before the permanent first-ADD manifest boundary.
- Its preregistered first six verification-readiness runs completed across Codex and routed Claude,
  all three conditions, privacy review, and blind evaluation. Analysis reconciles six scored and 54
  not-started runs with no protocol diagnostic, exclusion, sensitive exposure, prohibited reversal,
  repeated work, or unnecessary clarification.
- Codex Carrylog and manual handoff each reconstructed all facts and scored 10/10; repository-only
  contradicted all three resource limits and scored 4/10. Routed Claude repository-only scored 10/10;
  Carrylog and manual each omitted two explicit evidence-limit qualifications and scored 8/10.
- Every one of the six runs reported the same focused-test result: 11 of 16 passed and five Git-backed
  cases failed with `E_NOT_GIT_REPOSITORY` or consequent mismatches. The binary `gitContext` repair
  removed inherited `GIT_DIR`/`GIT_WORK_TREE`, but it also made the outer detached fixture
  undiscoverable to Node tests. Remaining runs are stopped rather than measuring this harness ceiling.
- The Personal Context dogfood remains one external reconstruction example, not a controlled proof of
  universal continuity, transcript replay, repeated switching, or compaction value.

## Blockers and risks

- A successor needs a third verified execution boundary: runtime children must discover the outer
  read-only fixture repository without inheriting repository-selection variables, while nested
  `git init` and nested-repository operations remain independent. Both properties need one canary and
  the exact focused suite before any new freeze.
- Attempt 4's favorable Codex contrast and unfavorable routed-Claude contrast are one item each and
  are not product claims. Claude used a GPT-backed Anthropic-compatible route, not an independent
  model-family replication, and its reported zero input/cache tokens are unavailable evidence.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction,
  journaling, and compaction value remain unproven and outside the supported runtime.
- Cursor CLI and wider external adoption evidence remain unavailable. Automated resume still requires
  a compatible source build, project-pinned install, or global install; Skills never download or
  upgrade Carrylog implicitly.
- Sequential cross-file rename, final executable-check-to-spawn TOCTOU, Windows reparse/hard-link
  depth, sparse/large-index settlement limits, and stale abnormal-termination locks remain explicit
  residual risks.
- npmjs.org does not allow removing `latest`; beta.4 remains the bare-install bootstrap until stable,
  while explicit `@beta` resolves to beta.7.

## Next best task

Commit the reviewed attempt-4 results and bounded-handoff product change separately. Then prototype a
non-scored repository-discovery boundary and require the exact five previously failing Git-backed
tests plus nested-Git and metadata-isolation canaries to pass before drafting attempt 5.
