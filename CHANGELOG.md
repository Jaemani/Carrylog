# Changelog

All notable changes are documented here using Keep a Changelog categories. Package versions follow
Semantic Versioning; configuration versions follow the separate contract in ADR-0005.

## [Unreleased]

## [0.1.0-beta.1] - 2026-07-10

### Fixed

- Normalized both the npm 10/11 one-element array and npm 12 package-keyed object forms of
  `npm pack --json` across package inspection, release artifact construction, and package smoke
  testing.
- Rejected ambiguous, wrong-package, malformed, path-unsafe, or internally inconsistent npm pack
  metadata before using an artifact.
- Compared CLI version output with package metadata instead of coupling the test suite to one
  prerelease identifier.

### Changed

- Added an exact Node.js 24.15.0/npm 12.0.0 CI contract and pinned npm 12 in tagged cross-platform
  preflight so release-toolchain drift is found before publication.

## [0.1.0-beta.0] - 2026-07-10

The `beta.0` tag reached all cross-platform preflight gates but stopped in the protected publish job
before `npm publish`; this version was never registered. The immutable tag remains as release-audit
evidence, and the correction is released as `beta.1`.

### Added

- Local-first TypeScript CLI with `init`, `sync`, `validate`, and deterministic `handoff` commands.
- Public stable-identity v1 JSON Schema copied into initialized repositories.
- Configuration compatibility/migration policy and full field reference.
- Progressive document loading and separate always-context/adapter character budgets.
- Registry-backed Codex and Claude Code adapters with official-behavior documentation and golden
  fixtures.
- Git handoff evidence for branch/HEAD, upstream divergence, staged/unstaged numstat, aggregate
  status, bounded project-relative paths, and recent commits.
- Human/JSON diagnostics and stable exit-code categories.
- Deterministic randomized config/path/Git/marker corpora, performance budgets, three adoption
  shapes, CLI lifecycle, filesystem faults, and package-consumer tests.
- Scoped npm beta metadata, exact-artifact release verification, and protected trusted-publishing
  workflow.

### Changed

- Every build now removes `dist` before TypeScript compilation to prevent stale packaged modules.
- Strings reject surrounding whitespace instead of silently normalizing reviewed configuration.
- Multi-file writes stage all outputs before rename and compare output/config source expectations
  before every remaining commit; loaded commands also reject a changed on-disk configuration.
- Package smoke covers local, ephemeral, and global CLI use plus ESM and TypeScript declarations.

### Security

- Managed path ownership now includes config, copied schema, documents, and adapters under one
  conservative Unicode compatibility/case-normalized collision graph.
- Git execution removes repository-selection environment variables, disables fsmonitor/external diff
  behavior, avoids a shell and prompts, and enforces combined output/deadline/KILL bounds.
- Git porcelain parsing preserves invalid UTF-8 filenames as reversible hex and caps rendered paths
  while retaining aggregate counts.
- Handoff snapshots use exact standalone markers and are prospectively checked against content
  budgets before atomic replacement.
- Filesystem replacement carries root/parent/temporary identity guards and rejects a parent redirected
  after inspection.
- Git snapshots require two exact observations, retry boundedly on concurrent change, and escape
  invisible Unicode evidence without losing its value.

### Known limitations

- First npm publication may require a short-lived protected bootstrap token before trusted publishing
  can be configured for later OIDC-only releases.
- Sequential rename is not a portable cross-file transaction; the final read-to-rename TOCTOU window
  cannot be eliminated with current portable Node APIs.
- Adapter conformance does not launch authenticated Codex/Claude sessions in CI.
- Windows junctions, hard links, and external-repository outcome studies remain stable-release work.
