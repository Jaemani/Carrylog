# Current state

## Active objective

Prioritize external adoption and measurable user outcomes after closing Attempt 5 at its
preregistered STOP boundary. Keep any prompt-projection follow-up draft-only.

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
  checkpoint lifecycle. Exact release measurements remain in the engineering log.
- The separately committed repository-discovery prototype defines `none`, direct `repository`, and
  `repository-discovery`. Its macOS canary proves outer gitfile discovery, nested Git independence,
  read-only external metadata, immutable gitfile identity, external-symlink write denial, localhost
  denial, and all five Git-backed cases that failed in attempt 4.

## In progress

- Attempts 1–4 remain immutable historical evidence. Their boundaries and failure analyses live in the
  research directories and engineering log; none contributes outcomes to Attempt 5.
- Attempt 5 is frozen at manifest commit `ec27f44` and suite digest `cfb7d9c1…b4bd`. Its current-byte
  Codex and routed-Claude prerequisites, offline preparation, isolation canary, and freeze check pass.
- The candidate passes Attempt-5 tests 122/122, active research 131/131, product quality and coverage,
  package inspection and smoke, Carrylog continuity, and the bounded BusyCafe checks.
- Runs `t1-001` through `t1-040` are terminal and privacy-reviewed: 33 are scored; six are retained
  harness failures; and `t1-018` is protocol-invalid because Codex used one direct shell command
  outside the registered verification wrappers. None is retried or replaced, and every scored
  artifact has a finalized blinded evaluation.
- The analyzer returns `STOP`: Carrylog missed item `f5` in the BusyCafe protected-decision fixture
  relative to manual handoff under both Codex and Claude. This replicated same-item regression satisfies
  the frozen STOP-first rule. Attempt 5 ends at 40 terminal runs; `t1-041` through `t1-060` remain
  unstarted and may not be executed under this protocol.
- Detailed fixture contrasts, Claude failures, cache identities, and review chronology remain in the
  report and engineering log rather than always-loaded context.
- A reviewed STOP analysis separates delivered-state recall from safe task behavior. Two independent
  reviewers rejected immediate follow-up execution because the first draft confounded delivery factors,
  reused outcome-selected fixtures, and lacked an actionable adoption signal and statistical contract.
- The follow-up is now explicitly gated on external adoption need and held-out design. Independently
  reviewed GitHub adoption and bug forms collect public, sanitized, structured outcomes without
  requesting raw conversations or private context; their repository contracts and full product and
  package gates pass.
- The STOP analysis, corrected roadmap, and adoption intake are on `origin/main`. The public repository
  now exposes an npm homepage, discovery topics, and enabled Discussions for the issue-form support
  route.

## Blockers and risks

- Six harness failures and one protocol-invalid run cannot be retried or replaced; they remain attrition
  in the stopped analysis. Four Claude execution failures share a missing-success-event symptom whose
  client/router/stream boundary is not localized.
- Routed Claude is GPT-backed, not independent model-family replication. Passing prerequisites prove
  harness readiness, not behavioral continuity or conversation reconstruction.
- An escaped process may survive its original process group. Seatbelt denies network and checkout
  writes while permitting only bound scratch writes; unsettled or forced receipt state prevents the
  process from contributing scored evidence. Complete arbitrary-session termination is not claimed.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction,
  journaling, compaction value, Cursor CLI behavior, and wider external adoption remain unproven.
- No external adoption report yet establishes how often users retype or lose protected checkpoint
  details. The mechanism follow-up cannot be justified or frozen until that user-facing need exists.
- TOCTOU, Windows depth, process escape, and abnormal-termination locks remain explicit residual risks.

## Next best task

Obtain a sanitized real-repository adoption outcome through the published beta path before adding
continuity features or provider experiments.
