# Current state

## Active objective

Prepare and publish the compatibility-preserving Carrylog `0.1.0-beta.4` identity migration, then
complete trusted publishing, dist-tag cleanup, old-package deprecation, and credential retirement.

## Implemented and verified

- Node.js/TypeScript `carrylog` CLI with `init`, `sync`, `validate`, and `handoff`.
- Frozen configuration v1 contract, strict public JSON Schema, copied artifact, and upgrade warning.
- Progressive always/on-demand context catalog and deterministic context/router budgets.
- Registry-backed Codex and Claude adapters with official discovery docs and golden fixtures.
- One normalized ownership graph for config, schema, documents, and adapter outputs.
- Non-destructive adoption, exact standalone markers, staged atomic replacement, exact config/output
  checks, root/parent/temporary identity guards, mode preservation, and guarded temporary cleanup.
- Bounded Git evidence with sanitized environment, disabled fsmonitor, no shell/prompts, deadline,
  combined output cap, KILL escalation, project-relative paths, and invalid-UTF-8 hex fallback.
- Handoff branch/HEAD, divergence, status, staged/unstaged numstat, changed paths, and commits while
  preserving narrative, excluding its own file, and requiring two matching Git observations.
- Broad deterministic tests: property corpora, faults, concurrency, worktrees, monorepos, upstream,
  performance, adoption, CLI, schema lifecycle, package installs, ESM, and TypeScript declarations.
- Clean-build npm beta metadata, local/ephemeral/global package smoke, and exact-SHA
  artifact/provenance workflow.
- Owner-selected canonical MIT license with an enforced SPDX/content-hash policy.
- Strict npm pack metadata normalization for npm 10/11 array and npm 12 keyed output, shared by dry
  run, release artifact, and package smoke paths.
- Exact Node.js 24.15.0/npm 11.18.0 release-client coverage with a provenance dependency load check,
  plus npm 12.0.0 package-envelope compatibility coverage.
- Shell-free release-artifact selection that rechecks identity, commit, regular-file ownership,
  exact artifact count, size, and three registry digests before passing one absolute path to npm.
- Real cross-platform `npm publish --dry-run` coverage for an absolute tarball path containing spaces.
- Public `@jaemani/agent-context-kit@0.1.0-beta.3` beta with verified registry digests, SLSA
  provenance, one-off execution, global installation, initialization, and validation.
- Carrylog product, repository, package, executable, debug, and error identity with ADR-0008 and a
  tested beta.3 repository upgrade that preserves every configuration v1 wire identifier.
- Exact frozen-template migration of untouched LF/CRLF beta.3 instructions at any configured path,
  with command-shaped legacy diagnostics for customized always context, linear bounded scanning,
  immutable schema SHA-256, and guarded batch integration.

## In progress

- Package and lock metadata now target `carrylog@0.1.0-beta.4` and repository `Jaemani/Carrylog`.
  Active runtime, package smoke, fixtures, CLI help, API aliases, and migration regression coverage
  are renamed without changing the frozen schema, context root, or persisted markers.
- The frozen local tree passes all 129 tests with 95.71% lines, 95.71% functions, and 91.24% branches.
  Three independent code/security, release, and documentation reviews report no P0, P1, or P2.
- The 126-file, 100,633-byte package passes npm 10 and exact npm 11.18.0 real publish-dry-run plus all
  consumer modes. Exact npm 12.0.0 passes the keyed pack envelope and every non-publish consumer mode.
- Dogfood sync/validation, formatting, strict typecheck, build, diff checks, and full npm audit pass.

## Blockers and risks

- The protected GitHub environment still contains the old bootstrap secret. It may not be authorized
  to create the unscoped Carrylog package and must be replaced only with a shortest-lived suitable
  credential, then removed and revoked after Carrylog trusted publishing is configured.
- npm assigned both `beta` and `latest` during first publication despite the explicit beta tag. The
  old package's unintended `latest` tag remains and Carrylog first publication may repeat this
  behavior; both registry states require authenticated cleanup and re-query.
- The immutable `beta.0`, `beta.1`, `beta.2`, and published `beta.3` tags remain audit evidence; none
  may be moved or reused. Carrylog requires the new `beta.4` version and tag.
- The unscoped `carrylog` npm name was available when checked but cannot be reserved without
  publication; availability must be rechecked immediately before tagging.
- Sequential cross-file rename and the final path-check-to-syscall TOCTOU window remain; ADR-0007
  explains why portable Node.js checks cannot fully remove it.
- Additional Windows reparse-point/hard-link policy and authenticated tool-launch conformance remain
  stable work.
- External real-repository outcome evidence is not yet available; current coverage is synthetic
  adoption scenarios plus this repository's dogfood context.

## Next best task

Commit and push the reviewed beta.4 tree, require all remote CI jobs, then run clean-commit release
verification before creating `v0.1.0-beta.4`.
