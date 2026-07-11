# ADR-0011: Compare only consumed Git result channels for snapshot stability

- Status: Accepted
- Date: 2026-07-11
- Owners: Repository maintainer
- Supersedes: ADR-0006 only where it required stderr equality between allowed Git results

## Context

ADR-0006 required two Git observations to match in exit code, stdout, and stderr. A fresh Codex
sandbox session exposed a false concurrency failure: all nine Git commands returned the same logical
repository values, but the sandbox or command wrapper emitted per-process stderr diagnostics. Three
attempts took roughly 24 seconds and failed with `E_GIT_CONCURRENT_MODIFICATION` even though a direct
resume was immediately stable.

Snapshot construction consumes allowed exit codes and stdout. Stderr is used by the process boundary
only when an unexpected exit code must become an error diagnostic; it is not repository evidence.

## Decision

Stable Git observations compare the exit code and exact stdout bytes for every command. They do not
compare stderr for commands whose exit code was explicitly allowed.

`runGitProcess` continues to reject unexpected codes, signals, timeouts, and output-limit failures
before observation comparison. The concurrency error reports the exact command/channel keys that
last differed, such as `status.stdout` or `head.code`, without printing repository content.

## Rejected alternatives

- **Keep exact stderr equality:** rejected because sandbox diagnostics are not repository state and
  made supported agent execution fail consistently.
- **Strip a list of known warnings:** rejected because wrapper and operating-system messages change
  across versions and locales.
- **Ignore exit codes:** rejected because a command transitioning between success and an allowed
  absence code changes the snapshot meaning.
- **Parse snapshots first and compare objects:** rejected because exact stdout catches changes that a
  current parser might omit and retains the stronger byte-level boundary.

## Consequences

- A changing warning on stderr cannot cause a false repository-concurrency failure.
- A command with the same allowed code and stdout but different warnings is treated as the same
  observation; those warnings were never represented in the snapshot.
- Actual branch, HEAD, upstream, divergence, status, diff, and recent-commit changes still alter code
  or stdout and trigger bounded retry.

## Validation

- A fake runner with identical codes/stdout and unique stderr on every invocation succeeds.
- Versioned fake observations with changed stdout still retry and then fail closed.
- Concurrency diagnostics assert command/channel names without including output bytes.
