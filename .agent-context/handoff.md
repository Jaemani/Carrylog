# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "60e2833 at 2026-08-02T02:37:39+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 0 staged, 5 unstaged, 0 untracked, 0 conflicted
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 5 file(s), +42/-19, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (5)

    {"status":" M","path":".agent-context/current-state.md"}
    {"status":" M","path":"CHANGELOG.md"}
    {"status":" M","path":"docs/engineering-log.md"}
    {"status":" M","path":"package-lock.json"}
    {"status":" M","path":"package.json"}

### Recent commits (5)

    {"commit":"60e2833","committedAt":"2026-08-02T02:37:39+09:00","subject":"research: refresh continuity harness binding"}
    {"commit":"dc2e7cb","committedAt":"2026-08-02T02:32:32+09:00","subject":"fix: restore cross-platform continuity contracts"}
    {"commit":"191db00","committedAt":"2026-08-02T01:39:51+09:00","subject":"fix: resolve pinned Carrylog without agent file discovery"}
    {"commit":"f64f5df","committedAt":"2026-07-13T03:10:55+09:00","subject":"research: harden Tier 1 continuity candidate"}
    {"commit":"c9e8c2d","committedAt":"2026-07-12T14:39:51+09:00","subject":"docs: record Carrylog beta5 publication"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Finalize beta.6 from the reviewed RC through a clean release commit, release verification, fresh CI,
immutable tag, OIDC publication, and independent registry verification.

## Completed

- Verified a Personal Context Codex-to-Claude repository-memory handoff, Claude-native no-tool resume,
  and Carrylog v2 Skill resume from a project-pinned candidate in an isolated clone.
- Reproduced a generated-Skill defect where agent file discovery hid ignored
  `node_modules/.bin/carrylog` and incorrectly selected the global candidate.
- Replaced the ambiguous discovery step with a silent cross-platform probe that distinguishes an
  absent local executable from an unusable or uncertain local candidate. Only true absence permits
  global fallback.
- A read-only second review first returned NO-GO because a dangling ancestor could surface as leaf
  `ENOENT`. The probe now validates both ancestor directories before classifying leaf absence, and a
  repeat review returned GO without findings.
- Added process-level regressions for absent, invalid, dangling-ancestor, dangling-leaf, and usable
  platform-specific candidates and regenerated the canonical continuity Skill.
- Inspected failed workflow run `30710079223`. Both Linux jobs exposed unguarded macOS Seatbelt
  integration prerequisites; both Windows jobs additionally exposed host-dependent PATH construction
  and a directory-junction executable target that the probe accepted.
- Changed the macOS verification PATH compiler to explicit POSIX target semantics and restricted only
  actual `sandbox-exec` integration to Darwin while retaining pure harness contracts on every CI OS.
- Strengthened the project-local executable probe to dereference file candidates and require a
  regular-file target before executable access. Added accepted regular-file/symlink cases and rejected
  directory-target/dangling-junction cases.
- Workflow `30710553011` passed all package and npm-client jobs but failed every quality job because
  the changed harness contract's tracked critical digest was stale. Refreshed that binding without
  reusing either pending authenticated prerequisite.
- Retracted an earlier local-quality claim made without checking the token-filtered subprocess exit
  code. Re-ran the gate after refresh and verified the explicit zero exit status.
- Workflow `30710740555` passed every job: Node 22/24 quality and dogfood checks on Linux, macOS, and
  Windows; minimum-Node and three-OS package smoke; and npm 11/npm 12 release-package contracts.
- Advanced package and lockfile metadata to `0.1.0-beta.6` while retaining `[Unreleased]` for RC
  preparation as required by the release process.
- Completed exact-version RC quality, package, publish-dry-run smoke, dependency audit, and registry
  absence gates. Release review returned GO with no unresolved finding.
- Promoted `[Unreleased]` to `[0.1.0-beta.6] - 2026-08-02` only after RC review and gates passed.

## Verification

- The isolated candidate validates cleanly and resumes with `checkpoint.stale=false` on
  `codex/runtime-v1-stabilization` at `6c046ce`; its no-tool Claude resume retained the branch,
  checkpoint state, and next action.
- The focused continuity and research harness contracts pass on the local macOS host, including both
  real Seatbelt integrations and the valid symlink-to-regular-file probe case.
- `npm run quality` passes 235/235 tests with 94.77% line, 96.02% function, and 89.39% branch coverage.
- `npm run pack:check` passes with 148 files and 157,928 packed bytes.
- `npm run test:package` passes local, ephemeral, global, ESM, strict-type, migration, initialization,
  validation, checkpoint, and resume consumers.
- Beta.6 package inspection passes with 148 files and 158,581 bytes; publish-dry-run smoke and the
  production dependency audit pass, and the exact registry version is absent with `E404`.
- The committed portability matrix is green; Windows exercised the junction regression and macOS ran
  both real Seatbelt integrations.

## Decisions

- An ignored local executable is detected by an exact filesystem probe, not agent file-discovery
  tools. Exit 0 selects it, exit 1 means true absence, and any other result stops without fallback.
- Selection requires both link identity and a dereferenced regular-file target. Directory junctions
  and dangling links are uncertain and stop rather than falling through globally.
- A compiler for a declared target uses target path semantics, not the host running its pure test.
  macOS Seatbelt execution is capability-specific; the surrounding pure contracts stay portable.
- The smoke test is delivery, reconstruction, and native-Claude-resume evidence only. It is not
  Codex transcript import, behavioral continuity, permission isolation, or compaction evidence.
- Existing Tier 1 prerequisite records remain pending. Ad hoc router access does not amend frozen
  CLI/model identities or satisfy formal canary requirements.
- Immutable beta.5 remains unchanged; this fix belongs to a new prerelease candidate if released.

## Risks

- The formal Tier 1 preregistration pins older Codex and Claude CLI versions and a native Claude model;
  current Codex and Claude-router identities require an explicit protocol amendment and fresh review.
- A normal Claude invocation still selects an unavailable model unless the router settings and model
  are passed explicitly.
- Narrow Claude Bash command patterns rejected compound Skill commands; the successful product smoke
  used broad Bash permission only inside an isolated clone and does not prove a safe default policy.
- Cross-harness behavior, repeated-switch retention, transcript portability, and compaction value
  remain unproven.
- Workflow `30710079223` and stale-binding run `30710553011` remain failed diagnostic evidence; only
  the later green matrix is used for the portability claim.
- Beta.6 is reviewed but not yet a clean release commit, immutable tag, or published artifact.

## Next action

Commit the settled beta.6 bytes, run clean-commit `release:verify`, push and require fresh CI, then
create the immutable tag and verify OIDC publication, artifact digests, dist-tags, and provenance.
