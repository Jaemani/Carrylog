# Attempt 5 STOP analysis

- Status: reviewed evidence analysis; not a new experiment
- Evidence boundary: Attempt-5 frozen inputs and reviewed outcomes through `t1-040`
- Mechanical decision: `STOP` (`replicated-manual-regression`)

## Why execution stopped

The frozen analyzer found the same Carrylog-versus-manual fact miss in both harness surfaces for
BusyCafe protected-decision item `f5`. The item requires an answer to retain SQLAlchemy 2 and Alembic
as the production schema path while prohibiting SQLite-specific production behavior. Both Carrylog
answers rejected the unsafe database and scheduler reversals and earned 10/10 task completion, but
neither explicitly named both schema tools. Both manual-handoff answers did.

The preregistered rule classifies a same-fixture, same-item manual regression in both harnesses as
STOP before evaluating GO or REDESIGN. Attempt 5 therefore ends after 40 terminal runs. The remaining
20 planned cells are intentionally unstarted.

## Direct evidence

| Observation | Manual handoff | Carrylog resume |
| --- | ---: | ---: |
| Prior-session packet characters | 708 | 708 |
| Total prompt characters | 1,531 | 6,814 |
| Codex `f5` credited | yes | no |
| Claude `f5` credited | yes | no |
| Task completion | 10/10 in both runs | 10/10 in both runs |
| Prohibited reversal | 0 in both runs | 0 in both runs |

The Carrylog resume envelope contains the exact `f5` statement in its checkpoint `Decisions`
section. Delivery is therefore established. The observed failure is reconstruction of one explicit
detail, not packet absence, a harmful reversal, or task failure.

Operational measurements do not identify a cause. On Codex, manual and Carrylog input-token counts
were 92,215 and 143,877; on Claude they were 57,732 and 58,042. Carrylog outputs were longer on both
surfaces. Token fields are harness-specific observations and are not treated as equivalent measures
across clients.

## What the result does and does not establish

Within Attempt 5, it establishes:

- both observed full-envelope responses omitted a delivered protected detail;
- both observed manual-handoff responses received credit for the same item;
- Attempt 5 does not support an item-level non-regression claim against concise manual handoff;
- STOP-first execution and independent review prevented post-outcome continuation.

It does not establish:

- that Carrylog generally produces worse task behavior than manual handoff;
- that prompt length or JSON representation caused the miss;
- that two independent model families reproduced the result;
- a stable miss probability, because there is one stochastic run per cell;
- that a compact projection, transcript journal, semantic compactor, or native harness compact would
  improve the result.

Both harness surfaces used the same underlying model family. Treating their matching miss as an
independent model-family replication would overstate the evidence. For the observed 2-by-2 item table,
a two-sided Fisher exact test is not significant at conventional thresholds; the frozen STOP rule is
a conservative screening rule, not a population-effect test.

## Competing explanations

1. **Presentation dilution.** The full envelope is 4.45 times the manual prompt size and repeats
   project context already available through repository adapters. The protected detail may receive
   less relative attention.
2. **Representation effect.** The manual packet is concise Markdown while the portable envelope is a
   nested JSON object containing checkpoint, Git, catalog, and canonical context.
3. **Repository-search substitution.** Carrylog instructions encouraged agents to validate repository
   evidence and synthesize a more detailed operational answer. Both answers preserved the decision but
   may have substituted repository-derived language for the exact packet wording.
4. **Stochastic omission.** One sample per cell cannot distinguish a stable mechanism from ordinary
   response variance.
5. **Scoring sensitivity.** The rubric correctly required explicit SQLAlchemy 2 and Alembic wording,
   while the requested decision could still be completed safely without naming both. This explains the
   difference between 90% recall and 10/10 completion but does not invalidate the preregistered flag.

Current evidence cannot rank the first four explanations causally. A product patch selected from this
list would be outcome-driven overfitting.

## Decision

Do not change the stable `resume --json` contract, add semantic compaction, resume Attempt 5, or run a
follow-up provider experiment now. External adoption must first establish a user-facing protected-detail
problem and an explicit product decision. Only then may a separately frozen mechanism probe vary
delivery presentation while preserving exact checkpoint meaning and repository surfaces. Prototype
projections remain research-only unless that probe shows a repeatable improvement without safety or
task-completion regressions.

The lowest-complexity candidate retained for conditional future testing is a deterministic prompt projection
containing the six checkpoint sections plus a freshness receipt, while canonical always-context
remains repository-owned and adapter-discoverable rather than duplicated inside the prompt. This
candidate traces to the existing jobs of reducing manual retelling and keeping loaded context
proportional to the task. It is not yet a product commitment.
