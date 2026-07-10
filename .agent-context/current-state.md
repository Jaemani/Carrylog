# Current state

## Active objective

Publish the reviewed `0.1.0-beta.0` candidate through the protected npm workflow and verify registry
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

## In progress

- Add a short-lived package-scoped npm credential to the protected GitHub environment for first
  publication, then replace it with trusted publishing.

## Blockers and risks

- The first npm publication may need one protected short-lived granular token before trusted
  publishing can be configured; subsequent releases must use OIDC.
- Sequential cross-file rename and the final path-check-to-syscall TOCTOU window remain; ADR-0007
  explains why portable Node.js checks cannot fully remove it.
- Additional Windows reparse-point/hard-link policy and authenticated tool-launch conformance remain
  stable work.
- External real-repository outcome evidence is not yet available; current coverage is synthetic
  adoption scenarios plus this repository's dogfood context.

## Next best task

Create a short-lived granular npm token for `@jaemani/agent-context-kit`, store it as the protected
environment secret `NPM_TOKEN` without exposing it in chat, then tag and verify the exact beta artifact.
