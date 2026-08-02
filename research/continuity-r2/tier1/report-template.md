# Tier 1 continuity pilot report template

This structure is frozen before scored execution. `report.md` is the populated result and may add
clarifying appendices, but it may not omit or rename these required sections.

## Run reconciliation and attrition

Report all 60 planned runs by terminal state, harness, condition, repository, and task family. Include
every claim, failure, exclusion, privacy review, and protocol-invalid artifact. Never silently replace
a run.

## Evidence availability

Separate delivery receipts, acknowledgement, reconstruction, behavior, verification receipts,
latency, tokens, cost, evaluator confidence, and unavailable-evidence reasons. Null is not zero.
Identify both frozen authenticated-harness prerequisite attestations and their critical-byte binding
without reproducing raw canary output or provider-private state.

## Descriptive results by harness

Report each harness independently with n, missing n, mean, median, sample standard deviation, IQR,
minimum, and maximum. Do not calculate a cross-provider composite.

## Results by repository and task family

Report all preregistered strata, including unfavorable and underpowered strata. Use normalized task
macro-averages rather than pooled raw fact weights.

## Paired within-fixture contrasts

For each harness, report Carrylog minus repository-only and Carrylog minus manual handoff. Orient
signs so positive means a favorable Carrylog direction. Include positive/tie/negative counts and the
fixed-seed fixture-bootstrap descriptive interval.

## Manual-handoff regression screen

List every item-level preregistered flag. An explanation may contextualize a flag but never delete it.
Do not describe this exploratory screen as a formal non-inferiority test.

## Safety, failure modes, and exclusions

Report sensitive-exposure indicators, sanitization or privacy exclusions, strict-resume failures,
provider failures, and protocol deviations separately.

## Interpretation and threats to validity

Distinguish repository governance, packet delivery, reconstruction, behavior, perceived continuity,
automatic router discovery, automatic checkpoint authorship, repeated switching, journaling, and
compaction. State that one run per cell cannot estimate model stochastic variance or universality.

## Tier 2 decision

Apply the preregistered precedence mechanically: STOP first, then GO, otherwise REDESIGN. Report each
input to the rule: reviewed terminal and protocol-invalid counts, all 40 explicitly defined contrast
vectors and their screenability across the six primary metrics, Carrylog privacy rejections,
sensitive exposures and prohibited reversals, item-level manual-regression flags, replicated same-item
flags, and favorable-oriented macro paired means for all six behavioral metrics by harness.
Narrative explanations may not remove a flag or override the resulting class. Any future
non-inferiority margins, sample size, switch-depth study, transcript/journaling study, or compaction
comparison must be frozen in a new protocol before its outcomes are observed.
