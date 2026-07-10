# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "307fe5b at 2026-07-10T16:35:21+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 17 unstaged, 2 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 17 file(s), +153/-35, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (19)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":".github/workflows/ci.yml"}
    {"status":" M","path":".github/workflows/release.yml"}
    {"status":" M","path":"CHANGELOG.md"}
    {"status":" M","path":"README.md"}
    {"status":" M","path":"ROADMAP.md"}
    {"status":" M","path":"docs/configuration.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"docs/product-scope.md"}
    {"status":" M","path":"docs/releasing.md"}
    {"status":" M","path":"docs/testing-strategy.md"}
    {"status":" M","path":"package-lock.json"}
    {"status":" M","path":"package.json"}
    {"status":" M","path":"scripts/build-release-artifact.mjs"}
    {"status":"??","path":"scripts/lib/npm-pack-json.mjs"}
    {"status":" M","path":"scripts/package-dry-run.mjs"}
    {"status":" M","path":"scripts/package-smoke.mjs"}
    {"status":" M","path":"tests/cli.test.mjs"}
    {"status":"??","path":"tests/npm-pack-json.test.mjs"}

### Recent commits (5)

    {"commit":"307fe5b","committedAt":"2026-07-10T16:35:21+09:00","subject":"docs: record licensed release verification"}
    {"commit":"19232ef","committedAt":"2026-07-10T16:31:35+09:00","subject":"docs: license beta under MIT"}
    {"commit":"f2b6bfc","committedAt":"2026-07-10T16:24:46+09:00","subject":"docs: record successful beta matrix"}
    {"commit":"a816117","committedAt":"2026-07-10T16:21:19+09:00","subject":"fix: invoke Windows global shim verbatim"}
    {"commit":"26668b6","committedAt":"2026-07-10T16:17:32+09:00","subject":"feat: prepare production-minded 0.1 beta"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Last verified

2026-07-10, Asia/Seoul. The npm 12 release correction passed local multi-client package tests and the
complete quality suite on both the development and exact release toolchains.

## Objective

Publish `0.1.0-beta.1` through the protected npm workflow without moving the immutable, unpublished
`beta.0` tag, then verify registry integrity, provenance, one-off execution, and global installation.

## Release interruption

- Release run `29080114878` passed tagged preflight on Linux, macOS, and Windows.
- After required environment approval, the publish job stopped in `npm run release:verify` because
  npm 12 returns package-keyed JSON from `npm pack --json`, while all previous clients returned an
  array.
- Token configuration, `npm publish`, and registry verification were skipped. The package remains
  unregistered, and no partial registry state was created.
- The pushed `v0.1.0-beta.0` tag remains unchanged as audit evidence. The fix advances the package to
  `0.1.0-beta.1`.

## Changes

- Added one strict npm pack result parser shared by dry-run inspection, release artifact construction,
  and non-release package smoke. It accepts only the npm 10/11 single-element array and npm 12
  single-package keyed object forms.
- Added rejected cases for invalid JSON, scalar/empty/ambiguous results, wrong package keys, malformed
  artifact identity, unsafe filenames, duplicate file paths, inconsistent counts and sizes, and
  invalid integrity metadata.
- Added an exact Node.js 24.15.0/npm 12.0.0 CI job and pinned npm 12 in all tagged preflight jobs so
  publish-client contracts are exercised before approval and publication.
- Replaced the CLI test's hard-coded prerelease version with exact package-manifest comparison.
- Updated package metadata, changelog, release policy, testing strategy, product scope, roadmap,
  engineering log, and project state for `beta.1` and the failed-tag audit policy.
- Defined future universal resume as explicit project/task checkpoint reconstruction, not restoration
  of hidden agent state or control of tool-specific internal compaction.

## Verification

- `npm run quality`: formatter/lint, strict typecheck, build, all 111 tests, and coverage thresholds
  passed on Node.js 22.23.0/npm 10.9.8.
- Development-toolchain coverage: 95.50% lines, 95.51% functions, and 90.91% branches.
- Exact Node.js 24.15.0/npm 12.0.0 `npm run quality` also passed all 111 tests with the same coverage.
- Real npm 10.9.8, npm 11.10.1, and npm 12.0.0 runs passed package dry-run and the complete local,
  ephemeral, global, ESM, TypeScript, init, and validate smoke path.
- Exact Node.js 24.15.0/npm 12.0.0 package dry-run and smoke passed with 117 files and an
  84,870-byte dry-run artifact.
- `git diff --check` passed. Dogfood sync/validate and clean-commit release verification remain final
  gates after review and commit.
- Independent release-failure review found no P0. Its P1 findings were the three consumers sharing the
  array assumption and the need to preserve `beta.0`; both are addressed in the current change.
- Independent final diff review returned GO with no unresolved P0, P1, or P2 finding after rechecking
  the latest parser, consumers, workflows, tests, tag/version policy, docs, and refreshed handoff.

## Unresolved

- The correction still needs expanded remote CI and clean-commit `npm run release:verify` before
  tagging.
- The protected short-lived `NPM_TOKEN` remains configured for first publication. After success,
  configure npm trusted publishing, delete the GitHub secret, and revoke the token immediately.
- Sequential cross-file commit, the final path-check-to-syscall interval, hard links, and additional
  Windows reparse points remain documented residual risks.

## Next action

Commit and push the reviewed correction, require all eleven CI jobs to pass, then run clean
exact-artifact release verification before creating `v0.1.0-beta.1`.
