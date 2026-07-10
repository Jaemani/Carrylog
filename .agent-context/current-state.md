# Current state

## Active objective

Publish the corrected `0.1.0-beta.3` candidate through the protected npm workflow and verify registry
integrity, provenance, one-off execution, and global installation.

## Implemented and locally verified

- Node.js/TypeScript `ackit` CLI with `init`, `sync`, `validate`, and `handoff`.
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

## In progress

- The frozen publish-path correction passed broad local verification and two independent final reviews
  with no unresolved P0, P1, or P2 finding. Commit and push it, then publish `beta.3` without moving
  the failed `beta.0`, `beta.1`, or `beta.2` tags.

## Blockers and risks

- The short-lived first-publication token remains in the protected GitHub environment and must be
  removed and revoked immediately after trusted publishing is configured.
- The immutable `beta.0`, `beta.1`, and `beta.2` tags failed safely before publication; the current
  correction must use the new `beta.3` version and tag.
- Sequential cross-file rename and the final path-check-to-syscall TOCTOU window remain; ADR-0007
  explains why portable Node.js checks cannot fully remove it.
- Additional Windows reparse-point/hard-link policy and authenticated tool-launch conformance remain
  stable work.
- External real-repository outcome evidence is not yet available; current coverage is synthetic
  adoption scenarios plus this repository's dogfood context.

## Next best task

Commit and push the reviewed beta.3 correction, pass remote gates, then run clean-commit release
verification before creating the `v0.1.0-beta.3` tag.
