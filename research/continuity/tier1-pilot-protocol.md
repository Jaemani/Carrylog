# Tier 1 continuity pilot protocol

- Status: Frozen review candidate, not a committed experiment; execute only after authenticated
  harness prerequisites, independent reviews, and the manifest are frozen at its unique first-ADD
  commit
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
conditions: repository-only, manual-handoff, carrylog-resume
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

### Repository only

Start the harness in the tracked repository fixture without the frozen prior-session packet or
Carrylog surfaces. Ordinary product documentation remains available, so this is repository discovery,
not an information-free control.

### Manual handoff

Provide a concise maintainer-written handoff that fits the same factual rubric. Freeze its exact bytes
before execution.

### Carrylog resume

Use the current released canonical context, router/Skill surfaces, and validated checkpoint/resume
envelope without adding an experimental journal or semantic summary. This condition estimates the
complete Carrylog bundle; it does not isolate envelope formatting or automatic Skill discovery.

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
- Provider API control-plane traffic is necessary. Deny model-tool and verification-subprocess
  network access, including localhost and DNS. Before formal review, record a passed authenticated
  isolation canary for each harness in `harness-prerequisites.json`, bound to the exact runner,
  broker, registry, canary, helper, and declared harness configuration bytes. Pending or stale
  attestations block both the review digest and manifest creation.
- Canary attestations retain only harness/model version, tested time, a fixed safe summary, and a
  digest of the successful process result. Never persist raw canary output, credentials, provider
  sessions, or private configuration.
- Use synthetic provider homes with only minimum authentication. Prevent model tools from reading
  those homes; never copy provider settings, histories, MCP OAuth, or session stores.
- Record model and harness versions, context settings, repository commit, Carrylog commit, start time,
  exit status, and unavailable tools.
- Preserve sanitized raw visible output. Never collect hidden reasoning, credentials, or private
  provider stores.
- Store item-level scoring bound to the artifact and scoring-codebook digests. Mask run order; do not
  claim condition blindness when output can reveal the condition.
- Freeze the Ajv dependency closure from the package lock plus each installed package-tree digest.
  Validation, manifest construction, evaluation scaffolding, and analysis must reject lock or
  installed-artifact drift before loading Ajv.
- Freeze one deterministic rubric bundle per blind ID, bound to the exact task-fixture and
  scoring-codebook bytes. A bundle must not expose run ID, order, condition, harness, or fixture ID;
  evaluators score from that bundle and the matching reviewed artifact without reading run order.
- Require explicit retained evidence for every available judgment, including zero counts, negative
  exposure findings, and clarification availability. Never reduce a metric denominator because an
  item is unavailable.
- Keep automatic sanitizer output in quarantine until a human approves its exact digest. A privacy
  rejection promotes only a safe attestation and terminal exclusion record; it never copies the
  rejected bytes or requires deletion of the original terminal marker.
- Serialize exclusion-registry updates across processes. A concurrent or interrupted reviewer must
  never erase another retained failure or privacy STOP input; lock uncertainty blocks the retry
  rather than accepting a partial registry.
- Recompute approved digests during analysis and require every scored metadata record to identify one
  common freeze commit and the suite digest in the frozen manifest. Treat post-review mutation and
  mixed-suite results as protocol-invalid.
- Re-read the exact manifest bytes after creation, repeat current review and prerequisite checks in
  check mode, and remove a newly written manifest if any post-review, capture-time, or post-write
  mismatch is observed.
- Do not replace failed runs silently. Keep exclusions and reasons.

## Pilot interpretation

Tier 1 estimates variance and exposes failure modes. It does not authorize a claim of universal
conversation resume, arbitrary switch invariance, journaling value, or compaction superiority.

Proceed to a larger independent Tier 2 design only when Carrylog resume shows a consistent beneficial
direction over repository-only and the preregistered item-level manual regression screen is acceptable.
Tier 1 is not a formal non-inferiority test. Exact margins and sample sizes must be chosen from pilot
variance before Tier 2, not after inspecting confirmatory results.

If the pilot shows no useful signal, stop continuity expansion and investigate whether the product's
value is governance, reviewability, or deterministic checkpoint safety rather than behavioral resume.

## Required outputs

```text
research/continuity/tier1/
  preregistration.json
  repositories.json
  analysis-dependencies.json
  tasks/
  prompts/
  raw-quarantine/
  raw-reviewed/
  evaluations/
  scores.csv
  exclusions.csv
  analysis/
  report.md
```

Research output is not included in the npm package and must not contain repository secrets or raw
provider-private session data.
