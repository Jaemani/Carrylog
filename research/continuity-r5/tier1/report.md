# Tier 1 continuity pilot attempt-5 frozen-candidate report

- Status: Frozen; execution in progress
- Permanent freeze commit: `ec27f44924749a84bb53a84d71f8408f9cb6de68`
- Review digest: `2e6c778d45f23c82602d9f49fe6f9d98f0ed00f2d0b96c74e17df1aedb181573`
- Independent GO attestations: 2 / 2
- Freeze manifest suite digest: `cfb7d9c174b721cd245f1a68726cdca20a32d836844541dfff1f3a87b7f8b4bd`
- Authenticated harness prerequisites: Codex passed; Claude passed through JM Router on `gpt-5.6-sol`
- Scored runs: 8 / 60
- Reviewed harness failures: 2
- Exclusions: 2

## Run reconciliation and attrition

Runs `t1-001` through `t1-010` are terminal and reviewed: eight are scored and two are retained harness
failures. `t1-004` failed before provider execution during authentication staging; `t1-005` produced a
final response and settled verification receipts but exited without a terminal success event. Neither
run is retried or replaced. The final report will reconcile all 60 planned runs.

## Evidence availability

Pending execution. Delivery receipts, acknowledgement, reconstruction, behavior, verification
receipts, latency, tokens, cost, evaluator confidence, and unavailable-evidence reasons will be
reported separately. Missing evidence will remain null rather than being scored as zero.
Both authenticated canaries pass for the exact frozen harness-critical bytes. Two matching GO reviews,
manifest creation, the permanent first-ADD freeze commit, and its post-commit check are complete.
Dedicated Carrylog and BusyCafe caches passed cold population, and all 60 cells passed sealed offline
preparation without provider authentication or execution. Retained prerequisite evidence contains only
safe summaries, versions, timestamps, and result digests—not raw canary output or credentials. Starting
the scored batch remains subject to explicit cost and time authorization.

## Descriptive results by harness

Pending execution. Each harness will be reported independently with its available and missing counts
and preregistered descriptive statistics. No cross-provider composite score will be calculated.

## Results by repository and task family

Pending execution. Every preregistered stratum will remain visible, including strata with no scored
runs, and task-level normalized metrics will not be replaced with pooled raw fact weights.

## Paired within-fixture contrasts

Pending execution. Carrylog minus repository-only and Carrylog minus manual-handoff contrasts will be
reported separately by harness with favorable orientation, direction counts, and the fixed-seed
fixture-bootstrap descriptive interval.

## Manual-handoff regression screen

Pending execution. Every preregistered item-level flag and unscreenable pair will be retained. This
exploratory screen is not a formal non-inferiority test.

## Safety, failure modes, and exclusions

Pending execution. Sensitive-exposure indicators, sanitizer failures, privacy exclusions, strict
resume failures, provider failures, and protocol deviations will be reported separately. Automatic
sanitizer output remains in ignored `raw-quarantine/` until explicit review promotes it to tracked
`raw-reviewed/`; failed runs retain their audit references and are not silently replaced.

## Interpretation and threats to validity

Pending execution. Tier 1 separates repository governance, packet delivery, reconstruction,
behavior, and perceived continuity. It does not test automatic router discovery, automatic checkpoint
authorship, repeated switching, journaling, or compaction. One run per cell cannot estimate model
stochastic variance or establish universality.

## Tier 2 decision

Pending execution. The preregistered rule applies STOP first, GO second, and REDESIGN otherwise. The
final decision will expose all rule inputs rather than relying on a narrative override: reviewed
terminal and invalid counts, screenable pairs, sensitive exposures, prohibited reversals, manual
regression flags and cross-harness replications, and favorable-oriented paired means by harness. Any
later non-inferiority margin, sample size, switch-depth study, transcript or journaling study, or
compaction comparison requires a new frozen protocol before outcomes are observed.
