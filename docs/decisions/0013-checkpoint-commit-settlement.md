# ADR-0013: Recognize one verified checkpoint-settlement commit

- Status: Accepted
- Date: 2026-08-02
- Owners: Repository maintainer

## Context

The existing checkpoint freshness rule is intentionally exact: a resumed checkpoint is fresh when
its recorded Git snapshot still matches the repository. That rule correctly makes a checkpoint stale
when work changes after it was captured.

Normal Git practice creates one narrow exception-shaped workflow. A maintainer may stage the intended
project changes, run `carrylog checkpoint` so the evidence describes that staged work, stage the
checkpoint document itself, and commit the complete reviewed change. Without a settlement rule, the
act of committing that already-described work changes `HEAD` and makes the newly committed checkpoint
appear stale immediately. Treating every later state as fresh, however, would hide altered trees,
merges, partial staging, unrelated commits, or branch changes.

## Decision

Carrylog retains exact snapshot comparison as the default freshness rule. In addition, it may regard
one checkpoint as fresh after one qualifying checkpoint-settlement transition only when all of the
following verified conditions hold:

1. At capture, every Git-visible, non-ignored project change other than the checkpoint document was
   staged; unstaged, untracked, or conflicted Git-visible changes make the checkpoint ineligible.
2. The checkpoint and Git-visible project state are clean at resume time: no staged, unstaged,
   non-ignored untracked, or conflicted project changes remain.
3. The resumed `HEAD` has the full recorded base commit as its sole parent. Its captured detached or
   branch identity also matches the settlement evidence.
4. The repository uses the same Git object format observed at capture.
5. The exact project-scoped staged-index/committed-tree commitment matches after excluding the
   checkpoint document's permitted evidence update.

Any uncertainty is stale. Settlement evidence can be unavailable—for example, when capture has
unstaged, untracked, or conflicted changes, or bounded Git evidence cannot be collected. In that case
Carrylog uses exact-snapshot semantics only. Legacy checkpoints without settlement evidence, malformed
evidence, partial staging, a dirty tree, a merge, a later descendant, an object-format mismatch, or
any failed comparison likewise do not use this exception.

Index and tree enumeration retains the existing one-MiB Git subprocess output and ten-second
deadline. A large or sparse-index project can therefore be ineligible even when fully staged; the CLI
reports settlement unavailable and exact freshness remains available. Repository submodule-ignore
configuration is overridden so a dirty submodule cannot make the project appear clean.

A content-equivalent amend or rewrite whose sole parent is the same recorded base and whose exact
project-scoped tree commitment is identical is intentionally accepted. No durable, portable evidence
distinguishes that history rewrite from the original settlement while the project context is unchanged.
An amend or rewrite that changes the project tree is stale.

Carrylog is an observer and document writer only. It never stages, commits, amends, rebases, merges,
or pushes on the user's behalf.

The intended human-controlled workflow is:

```text
stage intended project changes
        -> carrylog checkpoint
        -> stage the checkpoint document
        -> git commit
        -> carrylog resume --check
```

The settlement comparison uses Git index and tree object identifiers scoped to the project. Git
content filters do not change eligibility or weaken the commitment. Carrylog does not expose a
user-selected status path filter, and it overrides submodule-ignore configuration. Files excluded by
Git ignore rules remain outside the evidence boundary by design so build output and dependencies do
not make normal repositories permanently ineligible. The evidence deliberately avoids reflog or
other machine-local history: a qualifying branch-backed settlement must remain verifiable after push
and in a fresh clone.

## Considered alternatives

### Keep only exact snapshot freshness

Rejected. It makes the documented stage/checkpoint/commit workflow report stale immediately even
when the commit contains precisely the reviewed work described by the checkpoint.

### Require an ordinary commit identity or reflog record

Rejected. Commit identities can change during a content-equivalent amend or rewrite, and reflogs are
local implementation history that do not survive push and fresh clone. The full recorded base parent
and exact project-tree commitment express the portable fact Carrylog needs.

### Compare only changed-file paths or user-selected filters

Rejected. Paths cannot establish index completeness or tree identity and can hide unstaged or
untracked work. Project-scoped Git object commitments give a deterministic comparison instead.

### Stage and commit automatically

Rejected. Staging and committing are user-owned review and authorization boundaries. Automation
would create surprising commits and broaden Carrylog's mutation and credential surface.

## Consequences

Positive:

- A common reviewed Git workflow can preserve a fresh checkpoint across its expected settlement.
- The exception remains bounded by the full base parent, detached/branch identity, object format,
  cleanliness, and project-scoped tree commitments rather than a heuristic based on filenames.
- A branch-backed settlement verifies after push and from a fresh clone; detached evidence requires
  an explicitly detached checkout of the settlement commit.
- `resume --check` gives an immediate, deterministic confirmation after the human commits.

Negative:

- Users must stage intended work before capture and stage the generated checkpoint update separately.
- Rebase, merge, follow-up commits, altered-tree amendments, and dirty working trees require a new
  checkpoint; only the deliberately equivalent rewrite shape is accepted.
- The additional evidence is not backward-compatible with legacy checkpoints; those stay on the
  exact-snapshot rule and therefore fail closed when the snapshot differs.

## Validation and revisit triggers

- Test accepted settlement with staged project changes, including a content-equivalent rewrite with
  the same recorded sole parent and project tree, plus branch-backed push/fresh-clone portability.
- Test rejection for unstaged/untracked/conflicted capture, partial staging, dirty resume,
  altered-tree amend, merge, multiple descendants, parent/base or detached/branch mismatch,
  object-format mismatch, malformed or unavailable settlement evidence, and project-tree mismatch.
- Preserve existing exact-snapshot freshness tests; settlement must not broaden them.
- Revisit only if Git exposes a portable, stronger commitment primitive that preserves the same
  fail-closed boundary, or user evidence shows the required staging workflow is not usable.
