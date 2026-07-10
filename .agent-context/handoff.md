# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "8561b78 at 2026-07-10T17:55:56+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 12 unstaged, 1 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 12 file(s), +113/-28, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (13)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":".github/workflows/ci.yml"}
    {"status":" M","path":".github/workflows/release.yml"}
    {"status":" M","path":"CHANGELOG.md"}
    {"status":" M","path":"README.md"}
    {"status":" M","path":"ROADMAP.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"docs/releasing.md"}
    {"status":" M","path":"docs/testing-strategy.md"}
    {"status":" M","path":"package-lock.json"}
    {"status":" M","path":"package.json"}
    {"status":"??","path":"scripts/check-release-client.mjs"}
    {"status":" M","path":"tests/npm-pack-json.test.mjs"}

### Recent commits (5)

    {"commit":"8561b78","committedAt":"2026-07-10T17:55:56+09:00","subject":"docs: record beta1 release verification"}
    {"commit":"06f9b9c","committedAt":"2026-07-10T17:52:50+09:00","subject":"fix: support npm 12 pack metadata"}
    {"commit":"307fe5b","committedAt":"2026-07-10T16:35:21+09:00","subject":"docs: record licensed release verification"}
    {"commit":"19232ef","committedAt":"2026-07-10T16:31:35+09:00","subject":"docs: license beta under MIT"}
    {"commit":"f2b6bfc","committedAt":"2026-07-10T16:24:46+09:00","subject":"docs: record successful beta matrix"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Last verified

2026-07-10, Asia/Seoul. The second protected release stopped before a registry request; the broken npm
12.0.0 provenance bundle was reproduced locally, and npm 11.18.0 loaded the same module successfully.

## Objective

Publish `0.1.0-beta.2` through the protected npm workflow without moving the immutable, unpublished
`beta.0` or `beta.1` tags, then verify registry integrity, provenance, one-off execution, and global
installation.

## Release interruption

- Release run `29080114878` passed tagged preflight on Linux, macOS, and Windows.
- After required environment approval, the publish job stopped in `npm run release:verify` because
  npm 12 returns package-keyed JSON from `npm pack --json`, while all previous clients returned an
  array.
- Token configuration, `npm publish`, and registry verification were skipped. The package remains
  unregistered, and no partial registry state was created.
- The pushed `v0.1.0-beta.0` tag remains unchanged as audit evidence. The fix advances the package to
  `0.1.0-beta.1`.
- Release run `29081480644` then passed npm 12.0.0 preflight on Linux, macOS, and Windows. Protected
  artifact construction and smoke also passed, but `npm publish --provenance` could not load
  `sigstore` from npm's bundled `libnpmpublish`.
- A fresh isolated npm 12.0.0 install reproduced the missing transitive dependency. The error occurred
  before a registry request, and the package remains unregistered.
- The pushed `v0.1.0-beta.1` tag also remains unchanged. The release-client correction advances to
  `0.1.0-beta.2`.

## Changes

- Added one strict npm pack result parser shared by dry-run inspection, release artifact construction,
  and non-release package smoke. It accepts only the npm 10/11 single-element array and npm 12
  single-package keyed object forms.
- Added rejected cases for invalid JSON, scalar/empty/ambiguous results, wrong package keys, malformed
  artifact identity, unsafe filenames, duplicate file paths, inconsistent counts and sizes, and
  invalid integrity metadata.
- Pinned tagged preflight and protected publication to npm 11.18.0, which includes `sigstore` and
  loads its provenance implementation on Node.js 24.15.0.
- Added a release-client contract that checks exact npm identity/version and loads the bundled
  provenance implementation before package gates, while rejecting `sigstore` resolved outside the
  pinned npm root.
- Kept npm 12.0.0 package-envelope and install compatibility in the exact-toolchain CI job without
  treating its broken provenance bundle as publish-capable.
- Restricted OIDC `id-token: write` permission to the protected publish job; preflight retains only
  repository read permission.
- Replaced the CLI test's hard-coded prerelease version with exact package-manifest comparison.
- Updated package metadata, changelog, release policy, testing strategy, product scope, roadmap,
  engineering log, and project state through `beta.2` and both failed-tag audit records.
- Defined future universal resume as explicit project/task checkpoint reconstruction, not restoration
  of hidden agent state or control of tool-specific internal compaction.

## Verification

- `npm run quality`: formatter/lint, strict typecheck, build, all 111 tests, and coverage thresholds
  passed on Node.js 22.23.0/npm 10.9.8.
- Latest independent beta.2 quality coverage: 95.50% lines, 94.87% functions, and 90.76% branches;
  all remained above enforced thresholds.
- Exact Node.js 24.15.0/npm 12.0.0 `npm run quality` also passed all 111 tests with the same coverage.
- Real npm 10.9.8, npm 11.10.1, and npm 12.0.0 runs passed package dry-run and the complete local,
  ephemeral, global, ESM, TypeScript, init, and validate smoke path.
- Exact Node.js 24.15.0/npm 12.0.0 package dry-run and smoke passed with 117 files and an
  85,075-byte dry-run artifact.
- `git diff --check` passed. Dogfood sync/validate and clean-commit release verification remain final
  gates after review and commit.
- Independent release-failure review found no P0. Its P1 findings were the three consumers sharing the
  array assumption and the need to preserve `beta.0`; both are addressed in the current change.
- Independent final diff review returned GO with no unresolved P0, P1, or P2 finding after rechecking
  the latest parser, consumers, workflows, tests, tag/version policy, docs, and refreshed handoff.
- Remote CI run `29081191523` passed all eleven jobs on commit `06f9b9c`, including Node 22/24 quality
  on Linux, macOS, and Windows; package smoke on all supported operating systems and exact minimum
  Node.js 22.0.0; and the new exact Node.js 24.15.0/npm 12.0.0 release-toolchain contract.
- Clean exact-toolchain `npm run release:verify` passed on `06f9b9c`: all 111 tests, dogfood
  sync/validate, 117-file package inspection, exact-artifact smoke, and runtime audit. The artifact
  SHA-256 was `667c6833f73ef7075cff662ce958beb1f2c038e5bea8feee3fdb663cfcf01c08`.
- Final verification-record commit `8561b78` passed all eleven CI jobs in run `29081359668` and a
  clean exact npm 12 release verification. Its local artifact SHA-256 was
  `399ef200029f0aec2952070761951611663571964585ce1c47c07cd9b9c523fe`.
- Tagged `beta.1` preflight passed npm 12 package gates on all three supported operating systems.
  Protected exact-artifact verification and token configuration passed before npm 12.0.0 failed to
  load `sigstore` in the publish step.
- Isolated client inspection confirmed npm 12.0.0 lacks the required module, while npm 11.18.0's
  provenance implementation loads successfully.
- Beta.2 local gates passed all 111 tests. Exact Node.js 24.15.0/npm 11.18.0 verified the pinned-root
  provenance module and complete package smoke with a 117-file, 86,321-byte dry-run artifact.
- npm 12.0.0 compatibility then passed package inspection and all install modes independently; its
  dry-run artifact contained the same 117 files.
- Independent beta.2 release-client review returned GO with no unresolved P0, P1, or P2 finding after
  checking provenance resolution, least-privilege OIDC, version/tag policy, tests, docs, and handoff.

## Unresolved

- The npm 11.18.0 release-client correction needs remote gates and a new clean `beta.2` tag.
- The protected short-lived `NPM_TOKEN` remains configured for first publication. After success,
  configure npm trusted publishing, delete the GitHub secret, and revoke the token immediately.
- Sequential cross-file commit, the final path-check-to-syscall interval, hard links, and additional
  Windows reparse points remain documented residual risks.

## Next action

Preserve both failed tags, commit the reviewed correction, pass remote CI, run clean exact-artifact
verification, and create `v0.1.0-beta.2`.
