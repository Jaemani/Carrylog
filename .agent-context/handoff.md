# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "774dc2d at 2026-07-10T18:19:31+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 12 unstaged, 2 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 12 file(s), +143/-28, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (14)

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
    {"status":" M","path":"scripts/package-smoke.mjs"}
    {"status":"??","path":"scripts/publish-release-artifact.mjs"}
    {"status":"??","path":"tests/release-artifact.test.mjs"}

### Recent commits (5)

    {"commit":"774dc2d","committedAt":"2026-07-10T18:19:31+09:00","subject":"fix: validate npm provenance client"}
    {"commit":"8561b78","committedAt":"2026-07-10T17:55:56+09:00","subject":"docs: record beta1 release verification"}
    {"commit":"06f9b9c","committedAt":"2026-07-10T17:52:50+09:00","subject":"fix: support npm 12 pack metadata"}
    {"commit":"307fe5b","committedAt":"2026-07-10T16:35:21+09:00","subject":"docs: record licensed release verification"}
    {"commit":"19232ef","committedAt":"2026-07-10T16:31:35+09:00","subject":"docs: license beta under MIT"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Last verified

2026-07-10, Asia/Seoul. The `beta.2` protected release stopped before a registry request because npm
interpreted a bare slash-containing tarball argument as GitHub shorthand. The scoped package remains
E404.

## Objective

Publish `0.1.0-beta.3` without moving the immutable, unpublished `beta.0`, `beta.1`, or `beta.2` tags,
then verify registry integrity, provenance, one-off execution, and global installation.

## Release evidence

- Run `29082832556` passed npm 11.18.0 preflight on Linux, macOS, and Windows. The protected job passed
  its provenance-client contract, all 111 tests, dogfood checks, artifact construction, exact-artifact
  smoke, and runtime audit.
- Its 117-file, 86,453-byte tarball had SHA-256
  `120698432c03121c143628a93eb1ca61b7eb093b5a0a81a1e2cde330085db66a`.
- `npm publish release/*.tgz` expanded to `release/<name>.tgz`; npm parsed that value as GitHub shorthand
  and attempted SSH `git ls-remote`. Exit 128 occurred before a registry request, and npm remained
  E404. `v0.1.0-beta.2` stays immutable.
- `beta.0` and `beta.1` also failed before publication for separately documented npm 12 pack-envelope
  and missing-`sigstore` defects. Their full evidence remains in `docs/engineering-log.md`.

## Current correction

- Publication now reads `release/artifact.json` and rechecks package, version, workflow commit, safe
  filename, exact regular tarball count, size, SHA-256, SHA-1, and SHA-512 integrity.
- npm receives one absolute tarball path through a shell-free subprocess; no shell glob reaches the
  package-spec parser.
- Package smoke can run a real `npm publish --dry-run` against an absolute path containing spaces.
  npm 10 direct and npm 11 package-keyed dry-run envelopes are verified. npm 12 remains pack/install
  only because its published bundle cannot load the publish command even with provenance disabled.
- Package and lockfile versions are `0.1.0-beta.3`. Workflow, changelog, README, roadmap, release and
  testing policy, engineering log, current state, and regression tests are updated.

## Verification

- npm 10 quality passed 115 tests with 95.50% lines, 95.51% functions, and 90.91% branches.
- npm 10 passed package inspection, publish dry-run, local/ephemeral/global install, ESM, TypeScript,
  init, validate, formatting, strict typecheck, and diff checks.
- Isolated exact npm 11.18.0 loaded its provenance implementation and passed package inspection,
  publish dry-run, and every package smoke mode.
- Isolated exact npm 12.0.0 passed package-keyed inspection and all non-publish smoke modes.
- Independent root-cause audits found no P0 and recommended the implemented artifact-record-driven,
  absolute, shell-free boundary over a minimal `./` glob fix.
- Two independent frozen-tree final reviews returned GO with no unresolved P0, P1, or P2 finding.
  They separately checked code/security and workflow/test/document consistency, including tag
  immutability, annotated-tag `GITHUB_SHA`, Windows and space paths, npm client separation, and the
  documented residual path-reopen boundary.

## Remaining

- Commit and push the reviewed tree, pass remote CI, and run clean exact npm 11 release verification.
- Create the new `v0.1.0-beta.3` tag, approve the protected environment, and monitor publication.
- After success, verify registry digests, provenance, `npx`, and global install; configure trusted
  publishing, remove the GitHub bootstrap secret, and revoke the npm token.

## Next action

Refresh this evidence block, then commit the reviewed beta.3 correction.
