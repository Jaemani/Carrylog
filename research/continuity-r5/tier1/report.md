# Tier 1 continuity pilot attempt-5 frozen-candidate report

- Status: Frozen; stopped at the preregistered Tier 2 decision boundary
- Permanent freeze commit: `ec27f44924749a84bb53a84d71f8408f9cb6de68`
- Review digest: `2e6c778d45f23c82602d9f49fe6f9d98f0ed00f2d0b96c74e17df1aedb181573`
- Independent GO attestations: 2 / 2
- Freeze manifest suite digest: `cfb7d9c174b721cd245f1a68726cdca20a32d836844541dfff1f3a87b7f8b4bd`
- Authenticated harness prerequisites: Codex passed; Claude passed through JM Router on `gpt-5.6-sol`
- Terminal runs: 40 / 60
- Scored runs: 33 / 60
- Reviewed harness failures: 6
- Protocol-invalid runs: 1
- Exclusions: 7

## Run reconciliation and attrition

Runs `t1-001` through `t1-040` are terminal and reviewed: 33 are scored, six are retained harness
failures, and one is protocol-invalid. `t1-004` and `t1-032` failed before provider execution during
authentication staging. `t1-005`, `t1-025`, `t1-031`, and `t1-033` exited nonzero without the required
terminal success event; the latter two also lacked a final response. `t1-018` used one direct shell
command outside the registered verification wrappers and therefore contributes no behavioral score.
None is retried or replaced. Twenty planned runs remain unstarted because the preregistered STOP rule
became satisfied at this reviewed boundary.

## Evidence availability

Partial evidence is available for 33 scored runs. Delivery, reconstruction, behavior, verification,
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
seven retained exclusions prevent a complete factorial comparison; no cross-provider composite score
is calculated.

## Results by repository and task family

The analyzer retains every preregistered stratum, including the 20 unstarted cells. Current task-level
observations are exploratory and do not replace normalized metrics with pooled raw fact weights. On
the completed BusyCafe failed-approach fixture for Codex, manual handoff and Carrylog resume each
reconstructed all frozen facts and earned 10/10 completion; repository-only reconstructed 10% of fact
weight and earned 4/10. On the completed BusyCafe protected-decision fixture for Claude, manual,
Carrylog, and repository-only recalled 100%, 90%, and 80% of fact weight respectively, while all three
earned 10/10 completion. These are fixture-level contrasts, not product-effect estimates.

## Paired within-fixture contrasts

Nineteen of the 40 frozen contrast vectors are screenable. The analyzer reports
Carrylog-minus-repository-only and Carrylog-minus-manual contrasts separately by harness; the retained
missing vectors are not imputed after the STOP boundary.

## Manual-handoff regression screen

The partial screen retains all current item-level flags and unscreenable pairs. The same manual-versus-
Carrylog fact miss is flagged for item `f5` in fixture `r2-busycafe-03-protected-decision` under both
Codex and Claude. This replicated same-item flag satisfies the frozen STOP rule. The screen remains
exploratory rather than a formal non-inferiority test.

## Safety, failure modes, and exclusions

No reviewed artifact through `t1-040` exposed a scored sensitive item. Six harness failures and the
`t1-018` direct-shell protocol deviation remain separate exclusions. Automatic
sanitizer output remains in ignored `raw-quarantine/` until explicit review promotes it to tracked
`raw-reviewed/`; failed runs retain their audit references and are not silently replaced.

## Interpretation and threats to validity

The stopped pilot continues to separate repository governance, packet delivery, reconstruction,
behavior, and perceived continuity. It does not test automatic router discovery, automatic checkpoint
authorship, repeated switching, journaling, or compaction. One run per cell cannot estimate model
stochastic variance or establish universality.

## Tier 2 decision

The analyzer returns `STOP` because the same manual-regression item, `f5` in the BusyCafe protected-
decision fixture, is flagged in both harnesses. The preregistered rule applies STOP first, GO second,
and REDESIGN otherwise, without narrative override. Incompleteness and the protocol-invalid run also
make GO false, but they do not downgrade the replicated regression to REDESIGN. Attempt 5 therefore
ends at 40 terminal runs. Any diagnosis, amended packet, larger continuity study, non-inferiority
margin, switch-depth study, transcript or journaling study, or compaction comparison requires a new
reviewed and frozen protocol before new outcomes are observed.
