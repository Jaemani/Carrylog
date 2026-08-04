# Tier 1 continuity pilot attempt-5 frozen-candidate report

- Status: Frozen; execution in progress
- Permanent freeze commit: `ec27f44924749a84bb53a84d71f8408f9cb6de68`
- Review digest: `2e6c778d45f23c82602d9f49fe6f9d98f0ed00f2d0b96c74e17df1aedb181573`
- Independent GO attestations: 2 / 2
- Freeze manifest suite digest: `cfb7d9c174b721cd245f1a68726cdca20a32d836844541dfff1f3a87b7f8b4bd`
- Authenticated harness prerequisites: Codex passed; Claude passed through JM Router on `gpt-5.6-sol`
- Terminal runs: 30 / 60
- Scored runs: 26 / 60
- Reviewed harness failures: 3
- Protocol-invalid runs: 1
- Exclusions: 4

## Run reconciliation and attrition

Runs `t1-001` through `t1-030` are terminal and reviewed: 26 are scored, three are retained harness
failures, and one is protocol-invalid. `t1-004` failed before provider execution during authentication
staging. `t1-005` and `t1-025` exited nonzero without the required terminal success event. `t1-018`
used one direct shell command outside the registered verification wrappers and therefore contributes
no behavioral score. None is retried or replaced. Thirty planned runs remain unstarted.

## Evidence availability

Partial evidence is available for 26 scored runs. Delivery, reconstruction, behavior, verification,
latency, token, cost, evaluator-confidence, and unavailable-evidence fields remain separate. Missing
evidence remains null rather than being scored as zero.
Both authenticated canaries pass for the exact frozen harness-critical bytes. Two matching GO reviews,
manifest creation, the permanent first-ADD freeze commit, and its post-commit check are complete.
Dedicated Carrylog and BusyCafe caches passed cold population, and all 60 cells passed sealed offline
preparation without provider authentication or execution. Retained prerequisite evidence contains only
safe summaries, versions, timestamps, and result digests—not raw canary output or credentials. The
complete cost and time envelope is authorized.

## Descriptive results by harness

Partial descriptive groups are analyzer-derived for each harness and condition. Incomplete cells and
four retained exclusions prevent a final comparison; no cross-provider composite score is calculated.

## Results by repository and task family

The analyzer retains every preregistered stratum, including the 30 unstarted cells. Current task-level
observations are exploratory and do not replace normalized metrics with pooled raw fact weights. On
the completed BusyCafe failed-approach fixture for Codex, manual handoff and Carrylog resume each
reconstructed all frozen facts and earned 10/10 completion; repository-only reconstructed 10% of fact
weight and earned 4/10. This is one fixture-level contrast, not a product-effect estimate.

## Paired within-fixture contrasts

Most frozen contrast vectors remain incomplete. Final Carrylog-minus-repository-only and
Carrylog-minus-manual contrasts will be reported separately by harness only after all terminal cells
have been reviewed.

## Manual-handoff regression screen

The partial screen retains all current item-level flags and unscreenable pairs. It is not a formal
non-inferiority test, and its interim flags are not a release or product decision.

## Safety, failure modes, and exclusions

No reviewed artifact through `t1-030` exposed a scored sensitive item. Three harness failures and the
`t1-018` direct-shell protocol deviation remain separate exclusions. Automatic
sanitizer output remains in ignored `raw-quarantine/` until explicit review promotes it to tracked
`raw-reviewed/`; failed runs retain their audit references and are not silently replaced.

## Interpretation and threats to validity

The incomplete pilot continues to separate repository governance, packet delivery, reconstruction,
behavior, and perceived continuity. It does not test automatic router discovery, automatic checkpoint
authorship, repeated switching, journaling, or compaction. One run per cell cannot estimate model
stochastic variance or establish universality.

## Tier 2 decision

The analyzer currently returns `REDESIGN` because the batch is incomplete and one protocol-invalid
run makes the GO predicate false. This is an interim mechanical result, not the final Tier 2 decision.
The preregistered rule applies STOP first, GO second, and REDESIGN otherwise. The final decision will
expose all rule inputs rather than relying on a narrative override: reviewed
terminal and invalid counts, screenable pairs, sensitive exposures, prohibited reversals, manual
regression flags and cross-harness replications, and favorable-oriented paired means by harness. Any
later non-inferiority margin, sample size, switch-depth study, transcript or journaling study, or
compaction comparison requires a new frozen protocol before outcomes are observed.
