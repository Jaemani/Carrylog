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

### CLI contract tests

- help and version without project state;
- stable exit codes for success, project issues, and usage errors;
- end-to-end init, validate, drift check, repair, and revalidation;
- parseable JSON on both success and failure.

### Package and platform tests

CI should run Node.js 22 and 24 on Linux, macOS, and Windows. Package dry-run verifies the public
artifact list. Before beta, CI must also install the produced tarball into a clean temporary project
and exercise the `ackit` binary without relying on repository-local files.

## Scenario dimensions

Every feature review should consider combinations from these dimensions:

| Dimension | Representative cases |
| --- | --- |
| Existing state | empty repo, valid managed file, unmanaged file, partially damaged file, drift |
| Path | spaces, Unicode NFC/NFD, case collision, traversal, reserved Windows name, symlink |
| Newlines and permissions | LF, CRLF, missing final newline, executable/read-only mode |
| Execution | write, dry-run, check-only, repeated run, interruption/failure |
| Location | project root, nested directory, missing config, nested context root |
| Output | human text, JSON, CI exit status |
| Scale | catalog limits, large always context, router budget, large existing adapters |

## Current gates

`npm run quality` runs:

1. Biome formatting and lint checks;
2. strict TypeScript checking;
3. compilation;
4. the complete Node test suite;
5. coverage thresholds of 90% lines, 90% functions, and 85% branches.

`npm run pack:check` separately inspects the npm artifact.

## Required regression policy

- A defect fix includes a test that fails for the original defect.
- A safety or compatibility change includes both allowed and rejected cases.
- Adapter changes include exact-output fixtures and preservation tests.
- A schema change includes old-version behavior, migration behavior, and round-trip tests.
- A large beta change requires review of architecture, threat model, test matrix, docs, and handoff.

## Beta gaps

- Property-based config/path tests and parser fuzz corpus.
- Fault injection for write, chmod, rename, and concurrent mutation failures.
- Windows junction/reparse-point coverage.
- Performance budgets for repositories with thousands of context references.
- Published-package installation smoke test.
- Tool-specific adapter conformance tests against documented discovery behavior.
