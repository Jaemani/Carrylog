# Current state

## Active objective

Turn the reviewed repository-discovery prototype into an attempt-5 draft without changing frozen
attempts 1 through 4. Require a new experiment identity, complete registry/wrapper integration, and
fresh review gates before any provider execution.

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
- A separate non-scored repository-discovery prototype defines `none`, direct `repository`, and
  `repository-discovery` execution policies without changing the shipped runtime or frozen studies.
- Its macOS live canary simultaneously proves outer gitfile discovery, nested Git independence,
  read-only external metadata, immutable outer gitfile identity, external-symlink write denial, and
  localhost denial. The exact five Git-backed continuity cases that failed in attempt 4 pass.

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
- The successor boundary's pure and live tests pass 9/9 and independent review returned GO with no
  blocking finding. Repository-wide quality and active research gates pass after the final guards.

## Blockers and risks

- The boundary is not yet integrated into a successor registry, validator, wrapper, fixture setup,
  authenticated canary, or frozen verification-command surface. The prototype alone does not
  authorize attempt-5 provider calls.
- A scored successor must bind `/etc/gitconfig` state or release an explicit product-level Git
  configuration policy. Its process helper must add timeout state, grace-period `SIGKILL`, and output
  bounds rather than copying the prototype helper unchanged.
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

Commit the reviewed non-scored boundary independently. Then create an unfrozen attempt-5 draft with a
new namespace and identities, integrate `repository-discovery` across every digest-bound execution
surface, and rerun only offline structural, isolation, and preparation gates before seeking two new
exact-digest reviews.
