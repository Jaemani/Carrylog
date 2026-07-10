# Testing strategy

The quality target is predictable behavior across states and platforms, not a large test count.
Coverage thresholds are a floor that catches unexercised code; they do not replace the scenario
matrix.

## Test layers

### Pure contract tests

- strict configuration decoding and aggregated diagnostics;
- deterministic adapter rendering;
- managed-block creation, update, adoption, and malformed-marker rejection;
- portable path validation and collision keys.
- strict public-schema compilation and runtime/schema compatibility corpus;
- bounded Git status/numstat parsers and handoff marker ownership;
- deterministic randomized corpora for config, paths, Git bytes, and handoff narratives.

### Filesystem integration tests

- dry-run and real initialization;
- no partial writes during preflight failures;
- idempotent synchronization;
- drift detection without mutation;
- missing, empty, and oversized context;
- bounded reads for oversized, binary, and non-regular files;
- symlink rejection and file-mode preservation;
- existing human content and CRLF preservation;
- nested working-directory discovery.
- staged batch writes, stale-plan/config rejection, guarded parent substitution, temporary cleanup,
  and non-regular targets;
- schema lifecycle, managed-path ownership, prospective handoff budgets, and Git worktrees.

### CLI contract tests

- help and version without project state;
- stable exit codes for success, project issues, and usage errors;
- end-to-end init, validate, drift check, repair, and revalidation;
- parseable JSON on both success and failure.
- handoff refresh, check, dry-run, idempotence, and JSON output.

### Package and platform tests

CI runs Node.js 22 and 24 on Linux, macOS, and Windows. Package dry-run proves `dist` exactly matches
compiled `src`. The packed smoke test installs the tarball locally, ephemerally, and globally; checks
ESM and TypeScript consumers; then initializes and validates a clean project without repository-local
runtime files. A separate job runs the exact Node.js 24.15.0/npm 11.18.0 release toolchain, loads the
client's provenance implementation, proves `sigstore` resolves inside that pinned npm installation,
and exercises its package paths. The same job then installs npm 12.0.0 and checks its package paths
without treating its broken provenance bundle as publish-capable. Pack metadata contract tests cover
the npm 10/11 array envelope, the npm 12 package-keyed envelope, and malformed or ambiguous results.
Package smoke under publish-capable clients also runs a real shell-free `npm publish --dry-run`
against the absolute tarball path under a directory containing spaces. This gate runs on the
cross-platform package matrix and exact npm 11 release client. npm 12 remains limited to pack and
install coverage because its incomplete provenance bundle fails while loading the publish command
even when provenance is disabled. Release-artifact tests reject ambiguous selection, record or commit
mismatch, unsafe filenames, non-regular artifacts, and digest drift before npm can run.

## Scenario dimensions

Every feature review should consider combinations from these dimensions:

| Dimension | Representative cases |
| --- | --- |
| Existing state | empty repo, valid managed file, unmanaged file, partially damaged file, drift |
| Path | spaces, normalization/case aliases, malformed Unicode, traversal, reserved Windows name, symlink |
| Newlines and permissions | LF, CRLF, missing final newline, executable/read-only mode |
| Execution | write, dry-run, check-only, repeated run, interruption/failure |
| Location | project root, nested directory, missing config, nested context root |
| Output | human text, JSON, CI exit status |
| Scale | catalog limits, large always context, router budget, large existing adapters |
| Git | unborn/detached, rename/conflict, upstream divergence, mixed observations, worktree, nested project, hostile environment |

## Current gates

`npm run quality` runs:

1. Biome formatting and lint checks;
2. strict TypeScript checking;
3. compilation;
4. the complete Node test suite;
5. coverage thresholds of 90% lines, 90% functions, and 85% branches.

`npm run pack:check` separately inspects the npm artifact. `npm run release:verify` adds dogfood
sync/validation, one clean release tarball, smoke testing of that exact SHA-256 artifact, runtime
audit, clean-tree/version/license policy, and package-content checks.

Tagged preflight pins the exact npm version used by the publish job and verifies that its provenance
module and transitive dependencies load. This prevents protected publication from being the first
environment to exercise the release client. The publish boundary selects one artifact from its
verified record and invokes npm without a shell or glob.

## Required regression policy

- A defect fix includes a test that fails for the original defect.
- A safety or compatibility change includes both allowed and rejected cases.
- Adapter changes include exact-output fixtures and preservation tests.
- A schema change includes old-version behavior, migration behavior, and round-trip tests.
- A large beta change requires review of architecture, threat model, test matrix, docs, and handoff.

## Remaining gaps

- Additional Windows reparse-point and hard-link-specific coverage beyond the directory-junction test.
- Deterministic syscall injection at each chmod/rename failure point; current tests use observable
  filesystem failures and stale expectations.
- Authenticated Codex/Claude discovery launch tests; current conformance uses official behavior docs
  and golden output.
- Registry installation and provenance verification, which can run only after the first publish.
- Outcome studies on external real repositories; current adoption suite covers three representative
  repository states plus this repository's dogfood context.
