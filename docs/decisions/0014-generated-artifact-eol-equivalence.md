# ADR-0014: Compare generated standalone artifacts modulo CRLF checkout conversion

- Status: Accepted
- Date: 2026-08-02
- Owners: Repository maintainer
- Supersedes: ADR-0005's exact initialized-schema byte comparison only for paired CRLF/LF checkout
  representation; configuration v1 schema content and every non-EOL byte remain frozen

## Context

Carrylog owns the copied public configuration schema and the two generated continuity Skill files.
Validation and no-drift synchronization previously compared each complete file byte-for-byte with its
LF renderer. A fresh Git checkout on Windows can legitimately materialize those tracked text files
with CRLF when `core.autocrlf=true`, while the index and committed blobs remain LF. The files are
semantically unchanged and Git reports the worktree clean, but Carrylog rejected resume with
`E_SCHEMA_DRIFT` and `E_SKILL_DRIFT`.

The failure appeared in both Windows quality jobs for CI run `30714928860`. Linux and macOS passed,
and the Windows packed-artifact consumer passed because it did not clone a committed Carrylog project.
Disabling checkout conversion only in the test would hide a supported consumer state. Generating a
repository-root `.gitattributes` file would instead impose line-ending policy on a human-owned file
and would need dynamic entries for configured surfaces.

## Decision

For complete Carrylog-owned standalone artifacts only, drift comparison treats each CRLF pair as LF.
This applies to the copied public schema and generated continuity Skills in validation and sync
planning. An equivalent local file is reported unchanged and is not rewritten.

The equivalence is deliberately narrow:

- only paired `\r\n` and `\n` line endings compare equal;
- a lone carriage return, changed text, changed whitespace other than the CRLF pair, missing content,
  extra content, invalid UTF-8, links, oversized files, and non-regular files remain errors or drift;
- Skill ownership is still established by exactly one standalone managed marker before content
  equivalence can make the file current;
- managed instruction adapters keep their existing whole-file newline preservation and managed-block
  comparison rather than using this standalone-file rule;
- canonical project documents and resume-envelope digests remain raw checked-out bytes. Carrylog does
  not claim cross-checkout digest identity when Git content filters materialize different bytes.

Checkpoint settlement remains bound to Git index and committed-tree object identifiers. A clone with
CRLF materialization must still be Git-clean, match the recorded parent, branch, object format, and
project-scoped commitment, and pass every ordinary context and filesystem guard.

## Considered alternatives

### Disable `core.autocrlf` in the fresh-clone test

Rejected. It would make CI green by removing the Windows state that users encounter and would leave
portable resume broken after a normal clean clone.

### Generate or edit a repository-root `.gitattributes`

Rejected. Carrylog would take ownership of a repository-wide policy file, conflict with existing
human rules, and need to update entries when configured adapter or Skill paths change. Projects may
still choose their own LF attributes, but correctness cannot depend on that optional policy.

### Rewrite equivalent CRLF files to LF on every sync

Rejected. Rewriting a semantically current clean checkout creates needless worktree churn and may be
reversed by the next Git checkout. No-drift mode should recognize the checkout representation rather
than mutate it.

### Normalize all whitespace or all carriage returns

Rejected. That would hide meaningful generated-content drift. Only Git's ordinary CRLF pair
materialization has a defined equivalence.

## Consequences

Positive:

- A clean Windows clone can validate, synchronize in check mode, and resume a settled checkpoint
  without repository-specific configuration.
- Carrylog does not modify `.gitattributes` or rewrite semantically current generated files.
- Ownership, UTF-8, path, resource, link, and non-EOL content checks remain fail closed.

Negative:

- Validation no longer distinguishes LF from CRLF bytes for the three standalone generated files.
- Resume-envelope digests can differ across clean checkouts whose Git filters materialize different
  canonical-document bytes; those digests remain local byte evidence, not cross-machine content IDs.
- Future generated binary or byte-significant formats must not reuse this text equivalence implicitly.

## Validation and revisit triggers

- Force `core.autocrlf=true` during and after a fresh clone on every CI operating system, assert that
  the schema and both Skills contain CRLF, then require no-drift sync and a fresh settled resume.
- Test accepted CRLF public-schema validation without rewriting the file.
- Test rejection of non-EOL schema and owned-Skill changes.
- Require the complete Node 22/24 Linux, macOS, and Windows quality matrix before beta publication.
- Revisit if Git introduces a portable checkout-content identity useful to the runtime, Carrylog
  begins signing generated bytes, or a generated format makes CRLF byte-significant.
