# Repository-discovery verification boundary

## Status

This directory is a non-scored design prototype. It does not modify the immutable Tier 1 attempts,
authorize attempt 5, or change the shipped Carrylog runtime.

Attempt 4 removed inherited `GIT_DIR` and `GIT_WORK_TREE` from non-Git verification children. That
made nested repositories independent, but the same children could no longer run Git-aware tests
against the detached outer fixture. A binary `repository`/`none` policy could not express both
requirements.

## Candidate policy

The prototype adds a third `repository-discovery` policy:

| Policy | Child Git selection variables | External fixture metadata | Intended command |
| --- | --- | --- | --- |
| `none` | absent | unreadable | Non-Git command that must not inspect the outer repository |
| `repository` | explicit `GIT_DIR`, `GIT_WORK_TREE`, `GIT_OPTIONAL_LOCKS=0` | read-only | Direct registered `git` command |
| `repository-discovery` | absent | read-only through the checkout's canonical `.git` gitfile | Non-Git command whose own children may inspect the outer repository or create independent nested repositories |

All three profiles deny network access. Writable checkout and scratch roots remain explicit, with an
exact write denial for the outer checkout's `.git` gitfile; external Git metadata is never a write
root. Runtime read roots may not contain the metadata directory, which prevents a broad parent
allowance from silently defeating the read-only boundary.

The discovery and direct-Git profiles also allow two macOS Git runtime reads:

- `/etc/gitconfig`, because Carrylog deliberately reconstructs a bounded Git environment and Git
  otherwise receives `EPERM` while probing the system configuration;
- `/usr/share/i18n`, because macOS Git loads `UTF-8-MAC` conversion data for hostile-Unicode path
  handling.

These are read-only runtime dependencies, not repository or credential sources.

## Evidence

The pure tests cover command-policy matching, environment projection, canonical gitfile ownership,
overlap rejection, profile read/write separation, and Homebrew runtime derivation. On macOS, the live
canary creates a fresh `--separate-git-dir` clone and requires all of the following in one Seatbelt
process:

- no `GIT_DIR`, `GIT_WORK_TREE`, or `GIT_OPTIONAL_LOCKS` in the registered child;
- discovery of the exact outer checkout, external metadata directory, and HEAD;
- all five Git-backed continuity cases that failed in attempt 4 pass;
- a nested `git init` selects its own `.git` directory;
- checkout writes remain available;
- direct writes and atomic replacement of the outer `.git` gitfile are denied;
- writes to external metadata and through an in-checkout external symlink are denied;
- the external metadata, gitfile, and read-only sentinel digest remain unchanged;
- a connection to a listening localhost server is denied before the server observes it.

Run the deterministic contract and platform test through the normal active-research gate:

```bash
npm run test:research:discovery
```

The direct live command is available for macOS diagnosis:

```bash
npm run test:research:discovery:live
```

## Limits and next gate

This proves a local execution boundary, not agent behavior, cross-harness continuity, transcript
replay, or compaction value. It also does not prove the policy has been integrated correctly into a
successor runner. Before attempt 5 can be drafted, an independent review must approve this boundary
and any successor must add the new policy to its registry schema, wrapper, validator, canaries, and
frozen verification-command definitions without changing attempts 1 through 4.

The current product reconstructs child Git environments and therefore probes `/etc/gitconfig` even
when the verification wrapper supplied `/dev/null` configuration paths. The live canary proves that
the read is confined, but a scored successor must also bind the system-config state in its host
prerequisite or adopt and release an explicit product-level configuration policy. An unbound host
configuration must not become an invisible experimental input.
