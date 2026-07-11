# Continuity and compaction evidence audit brief

- Status: Archived external-audit input; non-normative research record
- Prepared: 2026-07-12
- Scope: Cross-harness conversational continuity, session-record retention, and compaction value
- Product baseline: Unreleased Carrylog `0.1.0-beta.5` worktree

## Purpose

This brief asks an external reviewer to challenge whether Carrylog has demonstrated useful continuity
across Codex, Claude Code, Cursor, Gemini CLI, or future harnesses. It also asks whether retaining
observable conversation records or offering Carrylog-controlled compaction would create measurable
value rather than cost, privacy exposure, false confidence, or a second compaction failure mode.

The document is intentionally skeptical. It does not treat file discovery, prompt injection, an
agent's acknowledgement, or one successful reconstruction as proof that another harness received and
used the same effective context. It does not assume that retaining all records is desirable, that a
portable compacted representation is possible, or that a Carrylog compactor would outperform a
harness-native compactor.

No raw provider transcript, hidden reasoning, credential, or private session-store content is
included. The conversation record below contains selected user-visible statements and a reviewable
summary of proposals made during the design discussion.

## Existing project claims and boundaries

The audit must read these sources before evaluating new continuity or compaction claims:

| Source | Relevant existing position |
| --- | --- |
| `README.md` | Carrylog shares reviewed project state, not provider-native session replay. |
| `docs/product-scope.md` | The current product preserves durable project truth and explicitly excludes full conversation and internal compaction reconstruction. |
| `docs/decisions/0001-local-first-context-compiler.md` | Repository Markdown is canonical; adapters are concise routers; agents following references remains a known dependency. |
| `docs/decisions/0009-configuration-v2-and-universal-surfaces.md` | Codex and Cursor share `AGENTS.md`; Claude and Gemini use distinct surfaces; v2 migration is explicit. |
| `docs/decisions/0010-portable-checkpoint-and-resume-boundary.md` | Continuity currently means a reviewed checkpoint plus fresh Git observation, not conversation replay or control of native compaction. |
| `docs/adapter-compatibility.md` | Discovery guarantees and live-conformance gaps differ by harness. |
| `docs/architecture.md` | The runtime is deterministic and offline; semantic freshness and authenticated launch are known gaps. |
| `docs/testing-strategy.md` | Tests cover structural and package contracts, while external outcome studies and complete authenticated harness coverage remain open. |
| `docs/threat-model.md` | Future compaction must retain recoverable history; remote, telemetry, plugin, and secret boundaries require separate review. |
| `ROADMAP.md` | Measured continuity is planned for 0.2; reversible compaction is planned for 0.3 and is not implemented. |
| `docs/engineering-log.md` | Records actual dogfood, review findings, package checks, and incomplete harness authentication. |
| `.agent-context/handoff.md` | Records the current beta.5 implementation evidence and unresolved review/CI risks. |

If a statement in this brief conflicts with an accepted ADR or executable behavior, the conflict must
be reported rather than silently resolving it in favor of this draft.

## Current evidence, without extrapolation

The current worktree provides evidence for these narrow statements:

- Carrylog can generate and validate repository instruction surfaces for Codex/Cursor, Claude Code,
  and Gemini CLI from one canonical configuration.
- `resume --json` deterministically projects reviewed checkpoint sections, always-context, an
  on-demand catalog, digests, and bounded Git evidence.
- Local Codex inspection found the generated router and generic Skill without a model call.
- Local Gemini inspection found the generic Skill, but an authenticated headless model response was
  not obtained.
- One authenticated Claude Code fresh session reconstructed the project, objective, next action,
  stale status, and risks.
- Cursor CLI was not installed, so no authenticated Cursor session was reconstructed.
- The complete local test suite and package consumers verify implementation contracts, not user-level
  continuity outcomes.

The current worktree does **not** provide evidence for these broader statements:

- that exact context bytes were delivered to every supported model invocation;
- that a model used delivered context rather than merely acknowledging or repeating it;
- that task quality is preserved after one or many same-harness or cross-harness switches;
- that users perceive a resumed session as a continued conversation;
- that retaining all observable conversation records improves outcomes;
- that raw history injection is preferable to a native compact, checkpoint, or selected retrieval;
- that a native compact produced for one harness remains valid for another harness;
- that a Carrylog compact is more faithful, efficient, controllable, or useful than native compact;
- that a universal session journal can be captured completely and safely across supported harnesses;
- that users always want continuity rather than a new task branch or a project-only fresh session.

The audit must treat the second list as unproven hypotheses, not implied product behavior.

## Conversation-derived requirements and objections

### Initial desired outcome

The user wants installation to reduce tool-specific setup and allow switching among Codex, Claude,
Cursor, and other harnesses while retaining useful context. The user also wants visible confirmation
that prior state was loaded, because invisible instruction discovery may not feel like a continued
conversation and may not demonstrate that the model used the state.

Selected user statement:

> 대화가 남지않는다면 사용자는 이어서 대화하는 느낌을 못 받을 수도 있어.

The discussion separated four events that must not be conflated:

1. a context artifact exists;
2. a harness includes the artifact in model input;
3. the model reconstructs and uses the relevant state;
4. the user experiences the interaction as a continuation.

A proposed visible `continuity receipt` would report checkpoint identity, loaded sources, omissions,
and freshness. This is only a proposal. A receipt can prove what a wrapper attempted to deliver and
what the model repeated; by itself it cannot prove attention, correct use, or task continuity.

### Record retention and destructive compaction concern

Selected user statement:

> carrylog설치했을 때 .gitignore에서 확인한 후 제외시키도록 하고, 여전히 걱정되는건
> compact를 진행하면 파괴가 되는거 아닌가?

The discussion proposed a local ignored session journal, derived compaction artifacts, context packs,
and delivery receipts. It also proposed that compaction never overwrite its sources and that deletion
be a separate explicit operation. None of these components exists in the current product, and their
value, privacy model, retention defaults, completeness, storage cost, and failure behavior have not
been validated.

The user questioned whether the product's purpose is indefinite retention. That question remains
open. Durable reviewed project state, raw observable conversation, generated compactions, and cached
delivery packs have different value and risk and must not inherit one retention policy by accident.

### Evidence challenge

Selected user statements:

> 우선 이렇게 모든 기록을 남기는 것과 자체 compact가 주는 가치를 수치적으로 또는
> 수학적으로 증명해야한다.

> 우리가 이어서 context를 얼마든지 스위치해도 그게 이어서 전달된다는 것도 증명이 되어야
> 한다.

> compact가 자체 하네스가 진행했다면 그것을 계속 사용해야하지 않겠나? 그럼 compact하고
> 하네스를 바꾸면 그게 맥락이 이어지는게 맞나?

> 사용자가 새로운 대화를 시작하고 싶을 수도 있다.

> 문제를 광범위하게 다루기전에 이어서 대화조차 충분히 증명된지 의문이다.

These objections supersede any assumption that session journaling or Carrylog compaction should move
directly into implementation. The next activity is evidence design and independent audit, not feature
construction.

## Definitions the audit must enforce

### Artifact continuity

The expected files or envelope exist, are current, and have stable content identity.

### Delivery continuity

The exact intended context or a documented transformation of it is included in the model-visible
input. Instruction-file discovery alone is weaker evidence unless the harness exposes the resolved
prompt or another trustworthy delivery trace.

### Reconstruction continuity

The model can correctly recover a preregistered set of relevant facts, constraints, decisions, and
open work without receiving the answers in the evaluation question.

### Behavioral continuity

The model applies the recovered state to the next task without prohibited reversals, repeated work,
contradictions, or unnecessary clarification.

### Perceived continuity

The user understands what was and was not resumed and rates the experience as an appropriate
continuation. This includes the ability to reject continuity and start project-only or fully fresh
work.

No single layer proves the layers below it. In particular, a receipt is not behavioral evidence, and
a successful task is not proof that every retained record was useful.

## Formal measurement model

Mathematical notation can make claims falsifiable, but it cannot prove universal product value from a
finite, changing set of proprietary models. The audit should require empirical estimates with
confidence intervals, preregistered hypotheses, and explicit limits rather than an unsupported single
utility score.

For task `t`, define a preregistered relevant fact set:

```text
F_t = {(f_1, w_1), ..., (f_n, w_n)}
```

where `w_i` is an importance weight fixed before observing model output. Facts may include current
objective, protected decisions, completed verification, prohibited alternatives, known risks, and
the next required action.

For a harness transition `a -> b`, measure:

```text
delivery_coverage = sum(w_i * delivered_i) / sum(w_i)
reconstruction_recall = sum(w_i * correctly_reconstructed_i) / sum(w_i)
contradiction_rate = sum(w_i * contradicted_i) / sum(w_i)
unsupported_claim_rate = unsupported_material_claims / material_claims
```

`delivered_i`, `correctly_reconstructed_i`, and `contradicted_i` are evaluator-scored indicators with
a written rubric. Delivery coverage is valid only when the wrapper or harness exposes sufficient
input evidence; otherwise it must be reported as unknown.

Behavioral task score should be measured separately from token input, latency, monetary cost,
clarification count, repeated-work count, and sensitive-data exposure. A composite score with
arbitrary weights would hide tradeoffs. The audit should report a Pareto comparison or preregistered
primary and secondary outcomes.

For `k` consecutive harness switches, define:

```text
retention_k = weighted facts correctly used after switch k / total relevant fact weight
degradation_k = baseline_same_harness_score - switched_score_k
```

The product may claim cross-harness non-inferiority only if a preregistered confidence interval for
the score difference stays above a justified negative margin. The margin, sample size, model
versions, task families, and stopping rule must be fixed through a pilot and power analysis before
the confirmatory evaluation.

For compaction candidate `c` over source events `E`, measure at least:

```text
source_coverage_c
fact_recall_c
contradiction_rate_c
task_score_c
input_tokens_c
working_context_remaining_c
latency_c
cost_c
sensitive_exposure_c
```

No compact should be called better merely because it is shorter. It must be compared against relevant
baselines on task outcome, factual retention, contradiction, available working context, user control,
and risk.

## Required experimental conditions

The external reviewer should refine and preregister a factorial or blocked design that includes, at
minimum, these continuity modes:

1. no supplied continuity;
2. human-written manual handoff;
3. current Carrylog checkpoint/resume envelope;
4. recent raw observable conversation within budget;
5. harness-native resume without an additional Carrylog representation;
6. harness-native compact, when its actual output is exposed and reusable;
7. a future Carrylog compact generated from the same eligible source events;
8. a hybrid checkpoint plus native compact;
9. a hybrid checkpoint plus selected raw retrieval;
10. a deliberately fresh project-only or no-continuity session.

Conditions 4, 6, and 7 must not be simulated as equivalent if a provider does not expose the same
artifacts. An inaccessible native compact is part of the provider's hidden state and cannot be
silently relabeled as a portable summary.

The design must vary:

- same-harness resume and each supported cross-harness direction;
- zero, one, and repeated switch chains;
- short histories that fit raw, histories near the input budget, and histories that require
  selection or compaction;
- tasks dominated by facts, constraints, chronology, code state, prior errors, or user preference;
- helpful, irrelevant, contradictory, sensitive, and stale historical events;
- a native compaction before switching, where the harness exposes a detectable boundary;
- model version, context limit, harness version, and tool-discovery surface.

Tasks and transitions should be randomized or counterbalanced. Evaluators should be blind to the
continuity condition where feasible. Ground-truth facts and scoring rubrics must be created before
responses are inspected. Model and harness updates require a new evidence date rather than inheriting
old results indefinitely.

## Specific questions for native compaction

The audit must answer these questions separately for each harness:

1. Is native compaction detectable?
2. Is its compacted artifact visible or exportable?
3. Can that artifact be injected into the same harness in a fresh session?
4. Can it be injected into another harness without format conversion or hidden dependencies?
5. Does reuse outperform reconstruction from the reviewed checkpoint, selected raw events, or a new
   compact generated from shared sources?
6. Does repeated native-compaction reuse accumulate error?
7. Which user controls are actually available, stable, and documented?

If a native compact is accessible, Carrylog should initially treat it as one candidate source with
provenance, not as canonical truth and not as an artifact that must always be reused. If it is not
accessible, Carrylog cannot claim to preserve it across harnesses. If raw history exceeds the target
budget, passing it unfiltered is not a valid baseline for routine operation; it is a stress condition
that must report truncation and remaining working capacity.

## Session mode and user-intent requirements

Any future launcher or wrapper must make continuity intent explicit. At least these modes require
separate evaluation:

```text
resume        project state + active checkpoint + eligible prior session context
branch        selected checkpoint/session as a source, but a new objective and history branch
project-only  stable project instructions without prior task conversation
fresh         no Carrylog session continuity; harness behavior is explicit
```

The audit should determine whether a default is safe or whether an existing session requires a
choice. A user must be able to see the selected mode, change it, and verify that excluded session
history was not injected. “Fresh” must not be advertised if repository instruction files are still
automatically discovered; the UI must distinguish fresh conversation from absence of project policy.

## Record-retention questions

The value of storing all observable records is unproven and must be tested against:

- task success and recovery after incorrect compact or stale checkpoint;
- retrieval quality and latency;
- disk growth and operational maintenance;
- accidental secret, personal-data, source-code, and tool-output retention;
- user comprehension and willingness to enable capture;
- incomplete capture that creates a misleading audit trail;
- cross-machine and team-sharing requirements;
- explicit deletion, legal retention, and repository backup behavior.

The audit should not assume “forever” as a default. It should compare checkpoint-only, bounded local
journal, explicit archive, and longer retention. Raw records, derived compactions, delivery packs, and
reviewed project memory require separate retention classes.

If a local journal is prototyped for measurement, `.carrylog/` must be excluded without destructively
rewriting human ignore rules. The prototype must detect already tracked paths, nested repositories,
negated ignore patterns, global ignore behavior, links, permissions, and pre-existing unowned content.
It must fail closed instead of assuming that a `.gitignore` line prevents disclosure. No raw record
should enter Git or an audit bundle implicitly.

## Threats to validity

The reviewer must address at least these threats:

- receipts and model self-reports can be correct parroting without behavioral use;
- provider system prompts, compaction, caching, and context assembly are partly hidden;
- model nondeterminism and upgrades can dominate small measured differences;
- giving evaluators the expected facts can leak answers into the task;
- benchmark tasks can overrepresent checkpoint-friendly work;
- the same model family on both sides may not represent a genuine cross-provider switch;
- transcript capture may be incomplete or alter user and agent behavior;
- longer raw context can reduce performance even when it contains every relevant fact;
- semantic summaries may introduce unsupported claims that structural checks cannot detect;
- repeated summary-of-summary evaluation can hide cumulative loss;
- user ratings can reward familiar UI without measuring task correctness;
- privacy failures may outweigh average task improvement;
- unavailable Cursor, Gemini, or Codex authentication can create unsupported generalization.

## Audit work packages

### A. Reproduce the current narrow baseline

- Verify exact package/worktree identity and current checks.
- Reproduce adapter discovery evidence per harness.
- Reproduce the current checkpoint/resume envelope.
- Repeat fresh-session reconstruction across available harnesses and report unavailable cases.
- Separate structural success from behavioral and perceived continuity.

### B. Design a continuity benchmark before building journaling

- Define representative repositories, tasks, fact sets, forbidden reversals, and scoring rubrics.
- Establish no-context, manual-handoff, native-resume, and current Carrylog baselines.
- Measure one and repeated transitions with confidence intervals.
- Include explicit fresh/project-only user intent.

### C. Evaluate record retention as an intervention

- Prototype capture only to the extent required for measurement.
- Label complete, partial, and unavailable capture honestly.
- Compare checkpoint-only with bounded raw-history and retrieval conditions.
- Perform privacy, ignore, retention, deletion, and disk-growth review.

### D. Evaluate compaction candidates

- Characterize each harness-native compaction boundary and artifact accessibility.
- Compare native compact, Carrylog candidate, raw selection, retrieval, checkpoint, and hybrids.
- Measure cumulative degradation after repeated switches and repeated compaction.
- Require source-linked error analysis for every lost, contradicted, or invented material fact.

### E. Review product claims and stop conditions

- Identify claims supported now, claims requiring qualification, and claims that must be prohibited.
- Define evidence expiration when harness or model versions change.
- Recommend whether session journaling, wrapper delivery, or compaction should proceed, remain
  experimental, or be rejected.

## Proposed evidence gates, subject to auditor revision

These are gate categories, not preset numerical pass thresholds:

1. **Delivery gate:** exact input evidence or an explicitly weaker discovery classification.
2. **Reconstruction gate:** preregistered relevant-fact recall and contradiction bounds.
3. **Behavior gate:** task non-inferiority against manual and native baselines.
4. **Switch-depth gate:** bounded degradation across repeated transitions.
5. **Compaction gate:** no material regression hidden by token reduction; adequate working context.
6. **Privacy gate:** capture, ignore, export, and deletion behavior withstand adversarial review.
7. **Intent gate:** resume, branch, project-only, and fresh behavior are distinguishable and tested.
8. **Perception gate:** users understand what continued and what did not.

Thresholds must be preregistered after pilot variance is known. They must not be selected after seeing
which approach wins.

## Requested external-audit output

The reviewer should return:

1. findings ranked by severity with direct evidence;
2. corrections to definitions, metrics, baselines, and experimental design;
3. a reproducible protocol and required harness access;
4. a claim-by-claim matrix of proven, partially supported, unproven, and unfalsifiable statements;
5. privacy and retention findings independent of continuity performance;
6. a recommendation for current checkpoint/resume claims;
7. a separate recommendation for session journaling;
8. a separate recommendation for Carrylog compaction;
9. explicit NO-GO conditions and evidence-expiration rules.

The audit must not return one undifferentiated product GO. Structural checkpoint safety, cross-harness
delivery, behavioral continuity, journaling value, and compaction value are separate decisions.

## Interim product constraint

Until this audit protocol is reviewed and a baseline experiment is completed:

- do not claim that Carrylog resumes conversations;
- do not claim that arbitrary or repeated harness switching preserves effective context;
- do not claim that all-record retention is beneficial;
- do not claim that a Carrylog compact is superior to native compact;
- do not implement automatic semantic compaction as a default;
- do not treat a continuity receipt as proof of behavioral use;
- keep the accepted 0.1 boundary limited to reviewed project checkpoint and resume-envelope recovery.

Research prototypes must remain clearly labeled, local-first, reversible, and outside the stable
runtime contract until the relevant evidence gate passes.
