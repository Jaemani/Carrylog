# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "d99f92f at 2026-07-10T21:39:18+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 49 unstaged, 16 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 49 file(s), +620/-240, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (65)

    {"status":" M","path":".agent-context/architecture.md"}
    {"status":" M","path":".agent-context/config.yaml"}
    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":".agent-context/decisions.md"}
    {"status":" M","path":".agent-context/instructions.md"}
    {"status":" M","path":".agent-context/project.md"}
    {"status":" M","path":"AGENTS.md"}
    {"status":" M","path":"CHANGELOG.md"}
    {"status":" M","path":"CLAUDE.md"}
    {"status":" M","path":"CONTRIBUTING.md"}
    {"status":" M","path":"README.md"}
    {"status":" M","path":"ROADMAP.md"}
    {"status":" M","path":"docs/architecture.md"}
    {"status":" M","path":"docs/configuration.md"}
    {"status":" M","path":"docs/decisions/0004-cli-and-context-names.md"}
    {"status":" M","path":"docs/decisions/0006-deterministic-git-handoff-evidence.md"}
    {"status":"??","path":"docs/decisions/0008-carrylog-identity-and-v1-compatibility.md"}
    {"status":" M","path":"docs/decisions/README.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"docs/product-scope.md"}
    {"status":" M","path":"docs/releasing.md"}
    {"status":" M","path":"docs/testing-strategy.md"}
    {"status":" M","path":"docs/threat-model.md"}
    {"status":" M","path":"package-lock.json"}
    {"status":" M","path":"package.json"}
    {"status":" M","path":"scripts/package-dry-run.mjs"}
    {"status":" M","path":"scripts/package-smoke.mjs"}
    {"status":" M","path":"scripts/verify-published.mjs"}
    {"status":" M","path":"src/adapters/managed-block.ts"}
    {"status":" M","path":"src/adapters/render.ts"}
    {"status":" M","path":"src/cli.ts"}
    {"status":" M","path":"src/commands/handoff.ts"}
    {"status":" M","path":"src/commands/init.ts"}
    {"status":" M","path":"src/commands/sync.ts"}
    {"status":" M","path":"src/config/load.ts"}
    {"status":" M","path":"src/core/errors.ts"}
    {"status":" M","path":"src/git/inspect.ts"}
    {"status":" M","path":"src/index.ts"}
    {"status":"??","path":"src/migrations/context-v1.ts"}
    {"status":"??","path":"src/product.ts"}
    {"status":" M","path":"src/templates/defaults.ts"}
    {"status":" M","path":"src/validation/validate.ts"}
    {"status":" M","path":"tests/cli.test.mjs"}
    {"status":"??","path":"tests/context-migration.test.mjs"}
    {"status":" M","path":"tests/fixtures/adapters/claude.md"}
    {"status":" M","path":"tests/fixtures/adapters/codex.md"}
    {"status":"??","path":"tests/fixtures/beta3/adapters/claude.md"}
    {"status":"??","path":"tests/fixtures/beta3/adapters/codex.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/architecture.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/config.yaml"}
    {"status":"??","path":"tests/fixtures/beta3/context/conventions.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/current-state.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/decisions.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/handoff.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/instructions.md"}
    {"status":"??","path":"tests/fixtures/beta3/context/project.md"}
    {"status":" M","path":"tests/handoff.test.mjs"}
    {"status":" M","path":"tests/helpers.mjs"}
    {"status":" M","path":"tests/lifecycle.test.mjs"}
    {"status":" M","path":"tests/npm-pack-json.test.mjs"}
    {"status":" M","path":"tests/performance.test.mjs"}
    {"status":"??","path":"tests/product-identity.test.mjs"}
    {"status":" M","path":"tests/property.test.mjs"}
    {"status":" M","path":"tests/release-artifact.test.mjs"}
    {"status":"??","path":"tests/rename-compatibility.test.mjs"}

### Recent commits (5)

    {"commit":"d99f92f","committedAt":"2026-07-10T21:39:18+09:00","subject":"docs: record beta3 release verification"}
    {"commit":"65230d8","committedAt":"2026-07-10T21:34:23+09:00","subject":"fix: publish exact local release artifact"}
    {"commit":"774dc2d","committedAt":"2026-07-10T18:19:31+09:00","subject":"fix: validate npm provenance client"}
    {"commit":"8561b78","committedAt":"2026-07-10T17:55:56+09:00","subject":"docs: record beta1 release verification"}
    {"commit":"06f9b9c","committedAt":"2026-07-10T17:52:50+09:00","subject":"fix: support npm 12 pack metadata"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Last verified

2026-07-10, Asia/Seoul. `@jaemani/agent-context-kit@0.1.0-beta.3` is public with verified digests,
provenance, one-off execution, and global installation. The repository has been renamed to
`Jaemani/Carrylog`; the next reviewed package is `carrylog@0.1.0-beta.4`.

## Objective

Complete a compatibility-preserving Carrylog identity migration, pass local and remote release gates,
publish beta.4 from a new immutable tag, and retire the old package and bootstrap credential safely.

## Published beta.3 evidence

- Commit `d99f92f`, tag `v0.1.0-beta.3`, CI `29093271158`, and release `29093394523` are immutable.
  Registry digests, SLSA provenance, npx/global/init/validate, the initial `EOTP`, both transparency
  entries, and four-minute visibility delay are recorded in `docs/engineering-log.md`.
- Published SHA-256 is `558578c96a8716a758755eb06b34e106a720175dbff626b1c10fbde28799c095`.

## Carrylog migration

- ADR-0008 fixes active identity as `Carrylog`, `Jaemani/Carrylog`, package/binary `carrylog`; `cl` is
  rejected for Windows. Published `.agent-context/`, v1 schema, and marker identities remain frozen.
- The new package exports only `carrylog`; the legacy error constructor and debug fallback remain API
  compatible. Package smoke covers every supported consumer and publish-dry-run path.
- An independent beta.3 fixture verifies marker/config/schema preservation, no duplicate context root,
  full idempotence, and exact LF/CRLF instruction migration at mutable document paths. Customized
  command-shaped legacy invocations fail without partial writes; historical prose remains valid.
- Published schema SHA-256 is
  `f30d6c906dba10059032ce13c74257b6ab41ebdd30308ca56b65408f039369ab`.

## Verification

- Quality: 129/129; lines/functions/branches 95.71%/95.71%/91.24%; migration 100% in all measures and
  near-one-MiB scan 4.7 ms. Sync, validate, diff, and full npm audit pass.
- Package: 126 files, 100,633 bytes. npm 10 and exact Node 24.15.0/npm 11.18.0 pass publish dry run and
  every consumer; npm 11 provenance loads; npm 12.0.0 passes keyed pack and non-publish consumers.
- Independent code/security, release/workflow, and documentation reviews returned GO with no P0/P1/P2.
- Sandboxed package smoke timed out during isolated registry install; the unchanged registry-enabled
  gate passed under npm 10/11, confirming an environment boundary rather than package failure.

## Remaining

- Commit and push beta.4, require every remote CI job, then run final clean release verification from
  that exact clean commit.
- Recheck npm name availability, create `v0.1.0-beta.4`, approve the protected environment, and
  monitor the first Carrylog publication without blindly retrying ambiguous registry state.
- Verify digests, provenance, npx, global install, init, and validate; remove Carrylog `latest` if
  created; configure trusted publishing; remove old-package `latest`; deprecate beta.3; delete and
  revoke the bootstrap credential.

## Next action

Commit the reviewed Carrylog beta.4 tree, push it, and require the complete remote CI matrix.
