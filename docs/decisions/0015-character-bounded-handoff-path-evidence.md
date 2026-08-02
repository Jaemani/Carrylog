# ADR-0015: Bound rendered handoff path evidence by characters

- Status: Accepted
- Date: 2026-08-02
- Owners: Repository maintainer
- Supplements: ADR-0006's deterministic and bounded Git handoff evidence

## Context

Git status collection retained at most 200 changed-path records. That bounded entry count and process
output, but not rendered context size: each portable path may be long and terminal-safe JSON escaping
can expand it further. Carrylog's own 89-file Tier 1 draft produced a 9,119-character snapshot and
made the prospective always-loaded context 23,056 characters against its configured 16,000-character
limit. `checkpoint` correctly failed without writing, but a routine generated-file set could not be
checkpointed without raising the context limit, hiding paths, or committing before review.

## Decision

Git inspection still parses the complete bounded status response and preserves aggregate staged,
unstaged, untracked, conflicted, and total-change counts. It sorts changed records deterministically,
then retains the longest prefix satisfying both limits under conservative CRLF rendering:

- at most 200 records; and
- at most 1,024 rendered characters for terminal-safe JSON records, including indentation and a
  worst-case two-character line separator. LF documents may therefore retain a slightly shorter
  prefix than their physical rendering alone would permit.

Every remaining record contributes to `omittedChanges`. If even the first sorted record exceeds the
character budget, the snapshot retains no path record and explicitly renders the complete omitted
count. Prospective document and aggregate context validation remain the final fail-closed gates.
Resume uses the same inspection and rendering path, so freshness comparison stays deterministic.

## Considered alternatives

### Raise the project context budget

Rejected. That treats one repository symptom and weakens the configured loading constraint without
bounding long paths in other projects.

### Choose a dynamic path budget from the remaining document budget

Rejected. Small human narrative edits would change which repository paths are evidence and could
make resume freshness depend on unrelated prose length. A fixed projection is easier to review and
reproduce.

### Group paths by directory or retain only hashes

Rejected. Directory grouping can hide individual statuses, while hash-only output removes the most
useful human diagnostic. A deterministic prefix plus aggregate omission preserves bounded examples
and complete counts.

### Commit generated files before checkpointing

Rejected. Carrylog never stages or commits, and review/freeze workflows may require the dirty candidate
to remain uncommitted until an exact boundary is approved.

## Consequences

Positive:

- Large or long-path worktrees retain bounded always-context evidence while preserving exact aggregate
  counts and deterministic examples.
- Checkpointing no longer requires a repository-specific context-limit increase for the observed
  89-file candidate.
- Omission remains explicit rather than silently dropping paths.

Negative:

- Fewer than 200 paths may be displayed, and a single oversized first path can cause all path records
  to be omitted.
- Existing checkpoints with more displayed paths become stale after upgrade and need an explicit
  checkpoint refresh.
- Detailed path inspection remains a Git or issue-tracker task, not a guarantee of the always-loaded
  handoff.

## Validation and revisit triggers

- Test more than 200 ordinary paths and require total count preservation plus an omission record.
- Test an oversized first record and require zero displayed paths with a nonzero omission record.
- Test exact-fit and one-character-over records, LF and CRLF rendering, escaped Unicode/control
  characters, rename records, and invalid UTF-8 hex records against the same fixed budget.
- Keep the near-1 MiB status corpus under the existing performance budget.
- Dogfood `checkpoint --dry-run` on the 89-file Tier 1 draft and require the prospective always context
  to remain below 16,000 characters without changing project policy.
- Revisit if the context schema gains a separate configured snapshot budget or consumers need a
  machine-readable paginated path-evidence channel.
