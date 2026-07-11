# Documentation ownership and freshness policy

Carrylog documentation serves users, contributors, maintainers, and auditors. Those audiences should
not receive the same density or freshness contract, and volatile evidence should not be copied across
every document.

## Evidence ownership

| Information | Canonical location | Other documents |
| --- | --- | --- |
| Current session objective, risks, next action, and latest gate summary | `.agent-context/handoff.md` | Link or summarize without copying volatile measurements. |
| Historical run IDs, artifact digests, exact measurements, failures, and corrections | `docs/engineering-log.md` | Link to the dated entry. Do not maintain a second historical ledger. |
| Current implementation status and priorities | `.agent-context/current-state.md` | Avoid exact test counts, byte sizes, and run IDs. |
| User-visible released changes | `CHANGELOG.md` | Link to engineering evidence when needed. |
| Product purpose, users, jobs, invariants, and non-goals | `docs/product-scope.md` | README presents a concise user-facing subset. |
| Accepted constraints and tradeoffs | `docs/decisions/` | Later ADRs supersede; accepted records are not rewritten as a rolling status page. |
| Test policy and scenario matrix | `docs/testing-strategy.md` | Exact latest results belong to handoff or engineering log. |
| Harness discovery and conformance | `docs/adapter-compatibility.md` | Include a dated recheck and explicit live-test gaps. |
| Release procedure | `docs/releasing.md` | Evidence from a release belongs to the engineering log. |
| Planned work | `ROADMAP.md` | A roadmap item is not implementation or outcome evidence. |
| Research protocol and raw/sanitized results | `research/` | Never imply accepted product behavior without an ADR and product-document update. |

The current handoff may repeat a concise result that another agent needs immediately. Once that result
is recorded as historical release or review evidence, the engineering log owns the exact run IDs,
digests, counts, and measurements; later handoffs should link rather than perpetuate them.

## Freshness contracts

| Document class | Freshness contract |
| --- | --- |
| README and changelog | Review for every release candidate and user-facing workflow change. |
| Current state and handoff | Update when objective, verified state, risks, or next action changes. |
| Engineering log | Append verified consequential events; historical entries do not require refresh. |
| ADR | Immutable after acceptance except clarification; supersede with another ADR. |
| Product scope and architecture | Review for changes to product jobs, boundaries, components, or invariants. |
| Configuration and testing references | Review when the corresponding contract or gate changes. |
| Adapter compatibility | Recheck official discovery behavior before releases that change a surface and record the date. |
| Threat model and security policy | Review for new trust boundaries, persistent data, network access, plugins, or mutation paths. |
| Roadmap | Planning aid; review at milestone decisions, not after every implementation edit. |
| Draft and research documents | Date and label as non-normative; archive or delete when superseded. |

## Audience layering

- README leads with the job, a short workflow, and real output. It links to limitations instead of
  repeating the entire threat model.
- Contributor references explain contracts and commands.
- ADRs preserve rationale and rejected alternatives.
- Engineering logs preserve exact evidence and failures.
- Audit and research documents may be dense, but must not become the default onboarding path.

Honest limitations remain required. User-facing prose should place them where they change a decision,
with one consolidated status and limits section rather than defensive qualifiers in every paragraph.

## Change rules

- A new feature must link to a product job or update product scope deliberately.
- A defect fix retains its regression test and evidence entry where consequential.
- Do not update several documents solely to copy a new test count, digest, byte size, or run ID.
- Do not claim that a document is current merely because formatting, schema, or path validation passes.
- Time-box research to a written question and deliverable. An unresolved non-critical hypothesis
  becomes a known limitation; it does not silently expand or indefinitely block the narrow product.
