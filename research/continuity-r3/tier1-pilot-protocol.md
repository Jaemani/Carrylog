# Tier 1 continuity pilot protocol

- Status: Amended draft review candidate, not a committed experiment; execute only after authenticated
  harness prerequisites, independent reviews, and the manifest are frozen at its unique first-ADD
  commit
- Governing decision: `docs/decisions/0012-evidence-gates-before-continuity-expansion.md`
- Purpose: Determine whether the current Carrylog checkpoint shows enough behavioral signal to
  justify larger cross-harness, journaling, or compaction research

## Execution-bootstrap amendments

The first frozen attempt at `research/continuity/tier1` aborted before claim creation, provider
authentication, or model execution. Its scored path verified the committed freeze before declaring
the setup-environment binding used by the shared process helper, causing a JavaScript temporal-dead-
zone `ReferenceError`. The immutable attempt remains at freeze commit
`382cda0e2a5efb3eca5e487e482c7316d6394617`; it has no scored artifact and is not silently replaced.

The second frozen attempt at `research/continuity-r2/tier1` moved that binding before freeze
verification and explicitly passed the host environment to `freeze --check`. Its first execution
created the `t1-001` claim, but the first terminal writer accessed `atomicSequence` before the
module's top-level execution had initialized that later lexical binding. The runner then encountered
the same defect while attempting to persist `failure.json`. No terminal artifact exists, and the
sanitized terminal output cannot establish whether provider execution completed before the writer
failed. Attempt 2 remains immutable at freeze commit
`3ff47a617c59f35ed7c41ac411b80517c8fa6907` and is not treated as a scored exclusion.

This new experiment preserves the same repositories, tasks, packets, harnesses, measures, and
decision rules. Relative to attempt 2, the only runner amendment initializes the atomic writer
sequence before any top-level execution await and adds a regression boundary for that ordering. It
also uses a new deterministic run-order seed and new blind IDs so the claimed attempt-2 cell is not
silently retried under an already exposed order. All candidate bytes require new authenticated
canaries, a new exact digest, two new reviews, and a new permanent first-ADD freeze. Results from this
experiment must be identified by the `research/continuity-r3/tier1` suite path and must never be
pooled with either aborted predecessor as if they executed.

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

The 2026-08-02 amendment uses Claude Code through a GPT-backed Anthropic-compatible route because
native Claude access is unavailable. This preserves a distinct harness surface but not an independent
model-family replication. The controlled runner invokes the native Claude executable directly; it
must not use a convenience launcher that weakens the frozen permission boundary. The macOS-only
runner binds the live direct-model catalog record and every response's resolved model ID, but the client
surface does not expose the router's internal provider ID; no provider-identity claim is made. The
resolved model is pinned to the single preregistered ID `gpt-5.6-sol`. Any other resolved model aborts
the run instead of being pooled across conditions.

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
- Treat dependency and exact-package cache population as a separate setup-network boundary. Use one
  explicit cache root below the system temporary directory per repository; host npm, uv, and artifact
  caches are forbidden. Online population requires a dedicated empty owner-only root claimed
  exclusively and seals a ready receipt only after successful preparation. Offline preparation must bind
  that receipt, repository scope, released tarball, and installed-tool tree before scoring.
- Require the BusyCafe source environment explicitly and accept only a bare repository below the
  system temporary directory. Never fall back to a live neighboring worktree.
- Canary attestations retain only harness/model version, tested time, a fixed safe summary, and a
  digest of the successful process result. Never persist raw canary output, credentials, provider
  sessions, or private configuration.
- Use synthetic provider homes with only minimum authentication. Prevent model tools from reading
  those homes; never copy provider settings, histories, MCP OAuth, or session stores.
- Resolve the Codex npm launcher only to locate its platform-native binary; never spawn the mutable
  PATH entry or JavaScript launcher. Bind both native harness executables to preregistered SHA-256
  digests and recheck the selected absolute executable immediately before every spawn. Record the
  remaining final check-to-syscall TOCTOU window as a residual risk.
- Serialize run-order inspection and write-once claim creation under one global exclusive lock.
  Never auto-delete an unexplained stale lock.
- Clear any setup-only `assume-unchanged` marker before evidence capture, reconstruct an isolated
  temporary index from the delivery baseline commit, and compare that index with actual worktree
  bytes. Never derive scored delta evidence from the reset source index.
- Record model and harness versions, context settings, repository commit, Carrylog commit, start time,
  exit status, and unavailable tools.
- Treat every direct shell execution event as a retained protocol deviation before blinded artifact
  publication, regardless of its exit status. Only preregistered wrapper receipts may receive
  verification credit. Detect Codex started, updated, and completed command lifecycles so timeout or
  abnormal termination cannot erase an observed attempt. When Claude emits a Bash use, project its
  connected tool results to digests. Retain only bounded digests and process metadata for rejected
  commands, results, malformed stream output, stderr, and provider-error diagnostics.
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
research/continuity-r3/tier1/
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
