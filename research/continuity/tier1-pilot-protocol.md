# Tier 1 continuity pilot protocol

- Status: Draft preregistration; execute only after repository/task fixtures and harness access are
  frozen in a committed revision
- Governing decision: `docs/decisions/0012-evidence-gates-before-continuity-expansion.md`
- Purpose: Determine whether the current Carrylog checkpoint shows enough behavioral signal to
  justify larger cross-harness, journaling, or compaction research

## Scope

This is a minimum viable maintainer-run pilot, not proof of universal continuity. It uses the current
checkpoint/resume product only. It does not require a session journal, delivery wrapper, transcript
parser, or Carrylog compactor.

## Experimental matrix

```text
repositories: 2
tasks per repository: 5
conditions: no-context, manual-handoff, carrylog-resume
harnesses: 2 authenticated harnesses from different supported surfaces
planned runs: 2 * 5 * 3 * 2 = 60
```

Repository R1 may be Carrylog. R2 must differ materially in stack, size, ownership history, and task
shape. The exact commits or immutable fixture digests must be recorded before execution.

The two harnesses should initially be Codex and Claude Code because they use distinct instruction and
Skill surfaces. If either is unavailable, substitution requires a committed protocol amendment before
results are generated.

## Task families

Each repository contributes one task from each family:

1. reconstruct the current objective and safest next action;
2. continue a bounded implementation without repeating completed work;
3. preserve a protected architecture or compatibility decision;
4. avoid a previously failed approach and explain the relevant risk;
5. diagnose or verify state using the repository's required commands and limits.

Every task fixture must define before execution:

- relevant facts with fixed importance weights;
- prohibited reversals and repeated-work indicators;
- allowed clarification questions;
- expected verification behavior;
- a task-specific scoring rubric;
- sensitive facts that must not appear in output.

## Conditions

### No context

Start the harness in the repository without a manual handoff or Carrylog resume envelope. Record any
project instructions the harness discovers automatically; this condition is not necessarily absence
of repository policy.

### Manual handoff

Provide a concise maintainer-written handoff that fits the same factual rubric. Freeze its exact bytes
before execution.

### Carrylog resume

Use the current validated checkpoint/resume workflow without adding an experimental journal or
semantic summary. Record artifact digests, discovery evidence, and any delivery evidence the harness
actually exposes.

## Measures

Report separately:

- weighted relevant-fact reconstruction recall;
- weighted contradiction rate;
- prohibited reversal count;
- repeated-work count;
- unnecessary clarification count;
- task completion score under the preregistered rubric;
- input context size where observable;
- latency and estimated cost;
- evaluator confidence and unavailable evidence.

Do not create a post-hoc composite utility score. Receipts and acknowledgements are delivery or
self-report evidence, not behavioral success.

## Execution controls

- Commit this protocol, task fixtures, rubrics, prompts, order-generation seed, and analysis script
  before the first scored run.
- Randomize or counterbalance condition and harness order within each task.
- Use fresh sessions and disable accidental conversation reuse.
- Record model and harness versions, context settings, repository commit, Carrylog commit, start time,
  exit status, and unavailable tools.
- Preserve sanitized raw visible output. Never collect hidden reasoning, credentials, or private
  provider stores.
- Score blind to condition where practical; record when blinding is impossible.
- Do not replace failed runs silently. Keep exclusions and reasons.

## Pilot interpretation

Tier 1 estimates variance and exposes failure modes. It does not authorize a claim of universal
conversation resume, arbitrary switch invariance, journaling value, or compaction superiority.

Proceed to a larger independent Tier 2 design only when Carrylog resume shows a consistent beneficial
direction over no-context and no material unexplained regression against manual handoff. Exact
non-inferiority margins and sample sizes must be chosen from pilot variance before Tier 2, not after
inspecting confirmatory results.

If the pilot shows no useful signal, stop continuity expansion and investigate whether the product's
value is governance, reviewability, or deterministic checkpoint safety rather than behavioral resume.

## Required outputs

```text
research/continuity/tier1/
  preregistration.json
  repositories.json
  tasks/
  prompts/
  raw-sanitized/
  scores.csv
  exclusions.csv
  analysis/
  report.md
```

Research output is not included in the npm package and must not contain repository secrets or raw
provider-private session data.
