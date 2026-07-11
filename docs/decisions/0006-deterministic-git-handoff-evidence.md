# ADR-0006: Keep handoff evidence deterministic, bounded, and separate from narrative

- Status: Accepted
- Date: 2026-07-10
- Owners: Repository maintainer

## Context

A handoff written only as prose can be stale or omit repository facts. Generating the entire handoff
with a model would introduce network credentials, nondeterminism, cost, and a risk of overwriting
human judgment. Git provides useful evidence, but repositories, filenames, configuration, hooks, and
process behavior are untrusted inputs.

## Decision

The command originally named `ackit handoff`, now `carrylog handoff` under ADR-0008, updates one
marker-owned repository-evidence block inside the configured `handoff` document. Content outside that
block remains human or agent authored. No model, network call, stage,
commit, push, or issue-tracker mutation occurs.

The snapshot records branch/HEAD, upstream divergence, staged and unstaged numstat, aggregate status
counts, at most 200 sorted project-relative changed paths, and at most five scoped recent commits.
The handoff file itself is excluded so repeated refreshes are stable. Invalid UTF-8 path bytes are
represented reversibly as hex instead of replacement characters.

Each snapshot attempt collects two complete observations. ADR-0011 supersedes the original stderr
comparison: stability now compares exact allowed exit codes and stdout because those are the channels
consumed by snapshot construction, while sandbox stderr can vary without repository change. A
mismatch retries the complete observation up to three times;
continued change fails with `E_GIT_CONCURRENT_MODIFICATION` instead of persisting evidence assembled
from different repository states. Unicode control, format, and line-separator characters in rendered
JSON evidence are escaped without losing their reversible value.

Git runs without a shell, with repository-selection `GIT_*` environment variables removed,
`core.fsmonitor=false` on every subcommand, terminal prompts disabled, a per-subprocess ten-second
deadline, a per-subprocess combined one-MiB output ceiling, and TERM-to-KILL escalation. The resulting handoff is prospectively
validated against file and always-context budgets before an atomic replacement.

## Rejected alternatives

- **Model-written handoff by default:** rejected because evidence collection must remain offline and
  deterministic.
- **Include diffs or file bodies:** rejected because secrets and prompt size would grow sharply.
- **Trust inherited Git environment and repository hooks:** rejected because they can redirect the
  inspected repository or execute code.
- **Rewrite the full handoff:** rejected because it would erase reasoning and unresolved risks that
  Git cannot infer.

## Consequences

- Git remains an optional runtime prerequisite only for `handoff`; init/sync/validate do not need it.
- Repository Git object/config data is still trusted as repository input, but executable fsmonitor
  behavior is disabled and no remotes are contacted.
- Semantic claims and next actions still require a person or agent to update narrative sections.
- Very large status sets retain exact aggregate counts while truncating rendered paths.
- A repository under continuous mutation can make handoff fail after the bounded retries; callers
  should retry after the IDE, Git operation, or concurrent writer becomes quiet.

## Validation

- Unborn/detached HEAD, rename, conflicts, Unicode, invalid UTF-8, newline names, worktrees,
  monorepos, upstream divergence, and truncation tests.
- Fake-process timeout, combined-output, missing executable, environment override, and fsmonitor
  execution tests.
- CLI check/dry-run/JSON lifecycle and prospective-budget tests.
- Deterministic mixed-observation retry/failure and invisible-Unicode rendering tests.
