# Continuity presentation follow-up

- Status: Draft; design and provider execution prohibited
- Predecessor: Attempt 5 stopped at 40 terminal runs under its frozen STOP rule
- Current roadmap priority: external adoption and user outcomes, not another provider batch

## Product gate

Attempt 5 found one repeated protected-detail omission with 10/10 task completion and no harmful
reversal. That blocks a non-regression claim but does not establish an urgent user-facing defect.
Carrylog remains a repository-memory governance product; its stable `resume --json` contract does not
change from this result.

Do not implement or freeze this follow-up until both conditions hold:

1. external adoption or a bounded user study shows that users retype, lose, or fail to act on protected
   checkpoint details often enough to justify another continuity feature; and
2. the product decision is explicit: a passing study would add an opt-in deterministic prompt
   projection, while a failed or inconclusive study would leave the runtime unchanged.

The follow-up must not be used to delay the current narrow beta, external adoption, or repository-
governance positioning.

## Candidate question

If the product gate opens, compare exact delivery bundles rather than claiming to identify one causal
mechanism from confounded prompts:

- Does a deterministic checkpoint-focused projection reduce response-level protected-detail omission
  relative to the current full envelope?
- Does it preserve task completion and safety?
- Which byte-defined payload and representation factors merit a later mechanism study?

This work would not test conversation replay, journaling, semantic compaction, user perception,
cross-model-family generality, or Carrylog superiority.

## Required design corrections

The first draft was independently rejected before implementation. A future candidate must resolve all
of these findings:

- **Factor isolation:** define byte-exact payloads. If causal attribution is retained, use a factorial
  design that varies representation and embedded context independently. Do not compare bundles that
  simultaneously change JSON versus Markdown, duplicated always-context, Git/catalog fields, and
  freshness text while claiming one cause.
- **Development versus confirmation:** known Attempt-5 fixtures may be diagnostic development cases
  only. Product advancement requires newly authored and frozen held-out fixtures and protected items
  unavailable during renderer design.
- **Experimental unit:** treat one fresh provider session and its response as the primary unit. Do not
  model correlated fact items within one response as independent binomial trials.
- **Randomization:** commit the exact order and allocation. Any ordinal-position balance claim must be
  arithmetically achievable; partial blocks must be specified and their residual imbalance reported.
- **Statistics:** freeze the primary contrast, meaningful effect size, completion non-inferiority
  margin, safety rule, multiplicity policy, attrition treatment, seed, sample size, and operating-
  characteristic simulation before provider access.
- **Confirmation:** diagnostic and held-out stages remain unpooled. A second harness surface using the
  same underlying model family is a deployment-surface check, not independent model-family evidence.

## Research-only candidate bundles

The exact set remains undecided. A valid causal design could use generated repository surfaces in every
cell and cross these two factors:

1. payload: checkpoint/freshness fields only versus the full portable envelope;
2. representation: stable JSON versus stable Markdown.

This 2-by-2 design would separate payload and representation main effects better than the rejected
four-condition draft. Prompt length remains a mediator of payload, not an independently identified
cause. A concise manual handoff may be retained as a descriptive oracle baseline but cannot share the
product-effect estimand when generated surfaces differ.

The projection must be a pure renderer over an already verified envelope. It may not select facts by
task, use an LLM, search for rubric terms, or treat known protected items specially.

## Minimum execution contract if the gate opens

- fresh experiment identities; no Attempt-5 outcomes pooled into estimates;
- new frozen source, task, packet, rubric, order, and evaluation-bundle bytes;
- exact repository commits and fresh provider sessions;
- deterministic fixture construction and write-once claims;
- quarantine, privacy promotion, blinded evaluation, exclusion, and no-replacement contracts at least
  as strict as Attempt 5;
- explicit cost and time ceilings;
- current-byte authenticated prerequisites for each execution stage;
- two independent GO reviews over the exact frozen candidate digest.

No provider run is authorized while this document is Draft or while the product gate, held-out set,
statistical contract, operating-characteristic simulation, and executable harness remain incomplete.
