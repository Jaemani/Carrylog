# Changelog

All notable changes are documented here using Keep a Changelog categories. Package versions follow
Semantic Versioning; configuration versions follow the separate contract in ADR-0005.

## [Unreleased]

This section is preparing the `0.1.0-beta.5` release candidate. Independent review, settled
checkpoint evidence, and final release gates are still pending; the target version in package
metadata does not by itself mean the candidate is approved or released.

### Added

- Configuration v2 with shared `agents`, `claude`, and `gemini` instruction surfaces, an explicit
  always-loaded checkpoint selection, and optional deterministic continuity Skills.
- `carrylog migrate --to 2` with check, dry-run, universal-surface, and reviewed-adoption modes.
- `carrylog checkpoint` as the continuity-oriented handoff alias and `carrylog resume` with human and
  deterministic JSON projections.
- Versioned public v2 JSON Schema while retaining the exact published v1 schema contract.
- ADR-0012, a minimum Tier 1 continuity pilot protocol, and documentation evidence/freshness policy.

### Changed

- New initialization defaults to configuration v2 and Codex, Claude Code, Cursor, and Gemini CLI.
- Set the release-candidate preparation target to `0.1.0-beta.5`; immutable beta.4 evidence is not
  reused.
- Reframed README and roadmap around source-first onboarding, first publication, measured adoption,
  and repository-owned project-memory governance. Journaling and semantic compaction remain research
  work behind evidence gates.
- Continuity Skills resolve and capability-check the source build, project-pinned CLI, then global
  CLI; an incompatible pinned version never silently falls through to another executable.
- Stock v1 handoffs that contain Carrylog-generated Git evidence migrate to v2 in LF or CRLF without
  losing that evidence; direct v1 resume now returns explicit migration guidance.

### Security

- Resume export uses guarded regular-file handles, hard-link and symlink rejection, before/after
  size, modification-time, change-time, link-count, and path identity checks, bounded UTF-8 reads,
  and matching config/document observations around Git.
- Generated Skill ownership requires exactly one standalone marker and never adopts or merges an
  unowned Skill file.
- Portable output excludes raw transcripts, hidden reasoning, provider stores, absolute roots,
  session identifiers, and commit timestamps.
- Git stability compares only consumed exit-code/stdout channels, avoiding false concurrency failures
  from per-process sandbox stderr while retaining exact repository-value comparison.
- Resume JSON escapes invisible control and formatting characters in raw terminal output while
  preserving the original Git path and commit-subject values after JSON parsing.
- Human resume, diagnostics, change paths, internal errors, and handoff JSON escape terminal controls,
  bidirectional formatting, and multiline field spoofing from repository-controlled input.
- Portable resume caps one aggregate configuration/document observation at 8 MiB in addition to the
  existing per-file limits.

### Testing

- Added explicit v1/v2 migration conflicts and idempotence, 500-case v2 schema/runtime parity,
  CommonMark checkpoint parser boundaries, guarded concurrent-read cases,
  deterministic/stale/detached/hostile-Unicode resume envelopes, reviewed agents/Gemini fixtures,
  local Codex/Gemini discovery checks, and installed-tarball strict declarations, v1-to-v2 migration,
  schema, checkpoint, and resume consumers.
- Added regressions for beta.4 global shadowing, incompatible pinned executables, HTML-hidden headings,
  terminal/field spoofing, generated legacy-command evidence, stock v1 snapshots, aggregate context
  exhaustion, v1 resume errors, runtime init options, and `research/` package exclusion.

## [0.1.0-beta.4] - 2026-07-12

Tag `v0.1.0-beta.4` passed cross-platform preflight and exact artifact verification. npm initially
rejected creation of the unscoped package with authorization-only `E403`; after the protected
bootstrap credential was replaced and registry absence was rechecked, failed-job-only attempt 2
published the unchanged tagged source and verified artifact. The `beta` channel now resolves to this
version. npm also assigned an unintended `latest` tag during first publication; its removal and
credential hardening remain release-administration work recorded in the engineering log.

### Changed

- Renamed the active product, repository, unscoped npm package, and executable to Carrylog,
  `Jaemani/Carrylog`, `carrylog`, and `carrylog` after registry and direct-competitor name research.
- Preserved `.agent-context/`, configuration v1 schema bytes and identity, managed-block markers,
  handoff markers, and reserved marker validation so repositories created by
  `@jaemani/agent-context-kit@0.1.0-beta.3` upgrade in place.
- Added an exact-template v1 migration for untouched LF/CRLF instructions from that historical
  package at any configured document path and a blocking diagnostic for command-shaped legacy
  invocations in always context.
- Added `CarrylogError` while retaining deprecated `AckitError` as the same constructor, and made
  `CARRYLOG_DEBUG` canonical with `ACKIT_DEBUG` as a compatibility fallback.
- Removed the old `ackit` binary from the new package. Existing global users must uninstall the
  scoped `@jaemani/agent-context-kit@0.1.0-beta.3` package before installing Carrylog.

### Testing

- Added literal identity contracts for package metadata, binary names, debug precedence, error alias
  identity, configuration root, schema metadata, and persisted markers.
- Added an `@jaemani/agent-context-kit@0.1.0-beta.3` repository-upgrade scenario that verifies drift
  recognition, human-content preservation, in-place adapter synchronization, handoff refresh,
  idempotence, unchanged schema and config bytes, stock-instruction migration,
  customized-instruction refusal, and absence of a second context root. The fixture is independent of
  the current initializer and the published schema bytes are pinned by SHA-256.
- Generalized package smoke for an unscoped install and exercised Carrylog through local, ephemeral,
  global, ESM, TypeScript, initialization, validation, and publish-dry-run paths.

## [0.1.0-beta.3] - 2026-07-10

This version was published as `@jaemani/agent-context-kit@0.1.0-beta.3` before the Carrylog rename.

### Fixed

- Replaced the shell-expanded bare tarball argument with a shell-free publisher that reads the exact
  reviewed artifact record and passes one absolute local path to npm.
- Revalidated package identity, version, workflow commit, filename, regular-file ownership, artifact
  count, size, SHA-256, SHA-1, and SHA-512 integrity immediately before publication.

### Testing

- Added rejected cases for malformed records, policy or identity mismatch, path escape, missing or
  extra tarballs, symbolic links, commit mismatch, and tampered artifact content.
- Added real `npm publish --dry-run` coverage for an absolute tarball path containing spaces to the
  cross-platform package smoke and exact npm 11 release-client gates; npm 12 stays pack/install-only
  because its incomplete bundle cannot load the publish command.

## [0.1.0-beta.2] - 2026-07-10

The `beta.2` tag passed all three operating-system preflights and exact artifact verification, but
the publish command passed a shell-expanded bare `release/<name>.tgz` argument. npm interpreted that
slash-containing package spec as GitHub shorthand and attempted an SSH Git lookup instead of reading
the local tarball. Publication stopped before a registry request, so this version was never
registered. The immutable tag remains as release-audit evidence, and the correction is released as
`beta.3`.

### Fixed

- Replaced the broken npm 12.0.0 provenance client with npm 11.18.0, whose bundled publish stack
  includes and loads `sigstore` on the pinned Node.js 24.15.0 release runtime.
- Added a preflight contract that verifies the exact npm version and loads its provenance
  implementation before tagged package gates or protected publication.

### Changed

- Kept npm 12.0.0 package-envelope tests in CI while separating that compatibility client from the
  verified npm 11.18.0 release client.

### Security

- Restricted GitHub OIDC token permission to the protected publish job and verified that `sigstore`
  resolves from inside the pinned npm installation rather than an ambient module path.

## [0.1.0-beta.1] - 2026-07-10

The `beta.1` tag passed npm 12 preflight on every supported operating system, but npm 12.0.0's
published CLI bundle omitted the `sigstore` dependency required by its bundled `libnpmpublish`.
Publication stopped before a registry request, so this version was never registered. The immutable
tag remains as release-audit evidence, and the correction is released as `beta.2`.

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
