# External documentation and project review — 2026-07-12

- Status: Advisory research record
- Input: External review supplied by the repository owner
- Scope: Complete document set, project direction, quality process, release readiness, and continuity
  evidence strategy
- Not equivalent to: Independent post-fix code/security GO, statistical continuity evidence, or npm
  publication approval

## Independently checked baseline

The reviewer reported reading the complete document set and independently checking:

- package identity `carrylog@0.1.0-beta.5`;
- clean `validate --json` output;
- actual completion of the 157-test suite.

The review found no material mismatch in the sampled documentation claims. This establishes document
credibility for the review but does not replace the remaining exact-commit CI or post-fix code review.

## Strengths identified

- strict separation between claims and executed evidence;
- unusually complete failure and correction history in `docs/engineering-log.md`;
- high-quality ADRs with rejected alternatives, consequences, validation, and supersession;
- immutable failed release tags and exact-artifact provenance policy;
- epistemically careful continuity audit definitions and threats to validity;
- productive dogfood that found executable-resolution and sandbox-stderr defects.

These strengths are retained. They are not treated as evidence of user demand.

## Material findings

### Product and delivery risk outranks further defensive breadth

The project has strong integrity controls but no unscoped npm publication, no external adoption story,
and only one authenticated Claude reconstruction. Future work should prioritize installability, a
short successful workflow, and external outcome evidence.

### The original audit protocol was too large as a first step

The draft requested a comprehensive factorial program without a funded reviewer or established user
base. A small preregistered maintainer pilot should precede an independent larger evaluation.

### Research constraints needed an accepted decision

The prohibition on conversation-resume, arbitrary-switch, retention-value, and compact-superiority
claims should not depend on a disposable draft.

### README optimized for auditors rather than new users

The initial value, before/after workflow, real output, and usable current installation path were not
prominent. Registry commands preceded the fact that the package does not exist.

### Volatile evidence was copied across documents

Exact test counts, coverage, package size, run IDs, and publication failure details appeared in
multiple manually maintained files, recreating the drift problem Carrylog is intended to reduce.

### Documentation freshness was implicit

Historical logs, rolling status, user docs, policies, and compatibility references lacked one
documented ownership and refresh model.

### User outcomes were not part of executed quality evidence

Technical gates were comprehensive, but product-scope outcomes such as reduced re-explanation or
repeated work had not been measured.

## Disposition

| Recommendation | Disposition | Rationale or action |
| --- | --- | --- |
| Recover first npm publication | Accepted, externally blocked | Registry still returns `E404`; the protected `NPM_TOKEN` exists but failed package creation and must be replaced by the owner without sharing it in chat or local files. |
| Rewrite README value-first | Accepted | Source workflow, value statement, before/after, human output, and abbreviated JSON shape now precede detailed contracts. |
| Run a minimum Tier 1 pilot | Accepted | ADR-0012 and `tier1-pilot-protocol.md` define two repositories, five tasks, three conditions, and two harnesses. |
| Promote interim constraints to ADR | Accepted | ADR-0012 is accepted and indexed. |
| Pull external adoption forward | Accepted | Roadmap now places adoption and outcome measurement before 0.2 expansion. |
| Single-source volatile evidence | Accepted | `docs/documentation-policy.md` assigns current and historical evidence ownership. |
| Add freshness contracts | Accepted | The documentation policy defines review cadence by document class. |
| Centralize performance budgets | Accepted | `docs/testing-strategy.md` now lists implementation budgets in one table. |
| Position as repository memory governance | Accepted | Current claims remain checkpoint/project-memory governance, not universal conversation resume. |
| Add issue templates immediately | Deferred | Useful after publication and contributor traffic; not the current blocker. |
| Add an asciinema demo immediately | Deferred | A real recording is valuable only after the executable installation path exists; textual output is added now. |
| Revert or de-prioritize existing ctime/security fixes | Rejected retrospectively | The high-severity issue was independently reproduced and cheaply fixed with regression coverage. Future prioritization changes, but validated integrity is not removed. |
| Release automatically after a fixed number of days | Qualified | Research gaps may become documented limitations, but integrity, data-loss, package, and release-authenticity blockers do not expire on a calendar. |
| Assume AGENTS.md standardization removes the niche | Not accepted without evidence | This is an ADR-0001 revisit signal to investigate through adoption, not a proven market conclusion. |

## Resulting order of work

1. Complete documentation reconciliation and beta.5 local gates.
2. Obtain the required post-fix review and exact-commit CI.
3. Have the owner replace the protected shortest-lived npm bootstrap credential and recover immutable
   beta.4 publication through the documented workflow.
4. Verify a short install/init/checkpoint/resume path against the actual registry package.
5. Commit and execute the Tier 1 pilot protocol without journaling or compaction.
6. Dogfood on two additional repositories and publish sanitized findings.
7. Decide whether any journal, wrapper, or compactor is justified by observed failures and outcomes.

## Evidence limits

This review is one advisory assessment. Praise, prioritization, and market positioning are not treated
as facts merely because the implementation claims passed a spot check. All resulting changes remain
subject to normal diff review, quality gates, package verification, and Carrylog checkpointing.
