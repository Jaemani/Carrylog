# ADR-0012: Require evidence gates before expanding continuity claims

- Status: Accepted
- Date: 2026-07-12
- Owners: Repository maintainer

## Context

ADR-0010 deliberately limits Carrylog continuity to reviewed repository state plus fresh Git
evidence. Later discussion considered visible delivery receipts, observable session journals,
cross-harness launch wrappers, and reversible compaction. Those ideas could improve the experience,
but the project has not demonstrated that arbitrary harness switching preserves effective context,
that retaining all observable conversation improves outcomes, or that Carrylog compaction would
outperform harness-native resume or compaction.

The initial audit brief proposed a comprehensive factorial evaluation. External review agreed with
its evidence discipline but found the first execution plan too large for a solo beta. Waiting for a
full research program would leave the project in a permanent pre-release state; implementing the
features first would turn unproven assumptions into product contracts.

## Decision

Carrylog retains the accepted ADR-0010 boundary. It is a repository-owned project-memory governance
and checkpoint tool, not a conversation-replay product.

Continuity evidence is classified in increasing strength:

1. **artifact:** the expected repository state exists and is current;
2. **delivery:** the intended state is demonstrably included in model-visible input;
3. **reconstruction:** the model recovers preregistered relevant facts and constraints;
4. **behavior:** the next task preserves decisions, avoids repeated work, and uses prior state;
5. **perception:** the user correctly understands what continued and experiences useful continuity.

Evidence at one level does not prove the next. A generated file, discovery trace, receipt, or model
acknowledgement is not behavioral continuity.

Before session journaling or semantic compaction becomes a supported runtime feature or enabled
default, the project must run a minimum viable Tier 1 pilot:

- two materially different repositories;
- five continuation tasks per repository;
- no-context, manual-handoff, and current Carrylog checkpoint conditions;
- two authenticated harnesses;
- prompts, facts, prohibited reversals, rubrics, and analysis rules committed before execution;
- sanitized raw results and all exclusions retained for review.

Tier 1 is an exploratory maintainer-run pilot, not external proof. It estimates variance, exposes
harness problems, and decides whether larger work is justified. An independent Tier 2 evaluation is
required before broad behavioral or compaction superiority claims.

Research may prototype the minimum capture or delivery mechanism required to measure a hypothesis,
but prototypes stay outside the stable runtime contract. Carrylog must not default to automatic
semantic compaction, indefinite conversation retention, or raw transcript export before the
applicable evidence and privacy gates pass.

Native resume and native compact are baselines, not obstacles to replace. If a harness exposes a
native compact artifact, an experiment may reuse it with provenance. An inaccessible native compact
cannot be described as portable or reconstructed. Carrylog compact, selected raw history, retrieval,
and hybrid approaches must be compared on factual retention, contradictions, task outcome, working
context, cost, latency, and exposure—not token reduction alone.

Future session UX must distinguish at least `resume`, `branch`, `project-only`, and `fresh` intent.
Repository instruction discovery may still occur during a fresh conversation, so the product must
not equate fresh conversation with absence of project policy.

The narrow checkpoint/resume beta is not blocked on proving every future continuity hypothesis. A
known research gap is documented and the beta may ship when its current claims, package, security,
review, and release gates pass. High-severity integrity or data-loss findings remain release blockers;
evidence work is not a reason to ignore them.

Every new continuity feature must trace to a job in `docs/product-scope.md`. “More sophisticated” or
“more defensive” is not independently a product job.

## Considered alternatives

### Implement journaling and compaction before measurement

Rejected. It would create retention, privacy, and compatibility contracts before demonstrating user
value.

### Require the complete factorial audit before beta publication

Rejected. The cost is disproportionate to the current narrow product claim and would prevent the
project from obtaining the users needed for meaningful evidence.

### Treat a continuity receipt as proof

Rejected. A receipt can attest attempted delivery and model acknowledgement but not correct use.

### Reuse every harness-native compact automatically

Rejected. Availability, format, hidden dependencies, and cross-harness value differ and require
per-harness evidence.

### Market Carrylog as universal conversation resume

Rejected until behavioral and perceived-continuity evidence supports that claim. The defensible
current position is Git-reviewable, tool-neutral project memory and checkpoint governance.

## Consequences

Positive:

- the current beta can ship without pretending a research roadmap is already proven;
- small public experiments replace indefinite audit planning;
- receipts, journals, and compaction receive claim-specific gates;
- native harness behavior remains a measured baseline;
- future session designs must preserve explicit fresh and branch choices.

Negative:

- Carrylog cannot yet promise conversation continuity or arbitrary switch invariance;
- authenticated harness access and experimental execution are required before expansion;
- research artifacts need privacy review and may reveal that proposed features are not worthwhile;
- model and harness updates can expire earlier results.

## Validation and evidence expiration

- Execute the committed Tier 1 protocol under `research/continuity/` before promoting research
  journaling or compaction into the supported runtime.
- Report unavailable delivery evidence as unknown, not successful.
- Preserve model, harness, context-limit, prompt, repository, and commit identities with results.
- Re-run affected evidence when an instruction-discovery surface, model generation, native compact
  policy, or wrapper delivery path materially changes.
- Revisit this ADR if Tier 1 shows no useful signal, external users identify a different primary job,
  or a broadly adopted standard provides stronger portable continuity primitives.
