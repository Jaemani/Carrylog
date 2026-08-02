# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "d6df1c2 at 2026-08-02T16:09:11+09:00"
- Upstream: "origin/main; ahead 10, behind 0"
- Working tree: 10 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 10 file(s), +1108/-11, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (10)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"docs/testing-strategy.md"}
    {"status":"M ","path":"package.json"}
    {"status":"M ","path":"research/README.md"}
    {"status":"A ","path":"research/continuity-discovery-boundary/README.md"}
    {"status":"A ","path":"research/continuity-discovery-boundary/boundary.mjs"}
    {"status":"A ","path":"research/continuity-discovery-boundary/live-canary.mjs"}
    {"status":"A ","path":"research/continuity-discovery-boundary/tests/boundary.test.mjs"}
    {"status":"A ","path":"research/continuity-discovery-boundary/tests/live-canary.test.mjs"}

### Recent commits (5)

    {"commit":"d6df1c2","committedAt":"2026-08-02T16:09:11+09:00","subject":"research: stop Tier 1 attempt 4 after repair screen"}
    {"commit":"34352aa","committedAt":"2026-08-02T16:08:32+09:00","subject":"test: isolate active research suite"}
    {"commit":"185432b","committedAt":"2026-08-02T16:08:26+09:00","subject":"fix: bound handoff path evidence by characters"}
    {"commit":"88f6427","committedAt":"2026-08-02T15:41:25+09:00","subject":"research: freeze Tier 1 execution attempt 4"}
    {"commit":"b6fa1ba","committedAt":"2026-08-02T15:04:05+09:00","subject":"research: stop Tier 1 attempt 3 for redesign"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"d6df1c2eab4bb86d469d4f6f890bc436ac7e2cee","detached":false,"branch":"main","indexCommitment":"b7f5481ee9d59654ea5b07f3800f40420bc965e9f259b2af86a6c822973347e4"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Prove and review a third repository-discovery execution boundary outside frozen evidence, then leave
an auditable checkpoint before designing attempt 5.

## Completed

- Read the JM Router client, compatibility, native-launcher, context-limit, and incident documents;
  no router or launcher change was needed because the blocker was local Seatbelt/Git isolation.
- Built a throwaway external-git-dir clone and diagnosed four successive macOS sandbox gaps:
  canonical `/private/tmp` traversal, Homebrew OpenSSL configuration, `/etc/gitconfig`, and
  `UTF-8-MAC` conversion data. The old 16-case focused suite reached 16/16 without restoring inherited
  repository selection.
- Added a separate non-scored three-policy boundary, pure contract tests, and a reproducible macOS
  live canary. Attempts 1 through 4 and the shipped Carrylog runtime remain unchanged.
- Hardened the boundary against inherited `GIT_*`, runtime-path physical aliases, external metadata
  writes, direct and atomic `.git` replacement, external-symlink writes, and localhost access.
- Received independent GO with no blocking finding after resolving all three review concerns.

## Verification

- `npm run test:research:discovery` passes 9/9, including the macOS live Seatbelt canary and the exact
  five Git-backed cases that failed in attempt 4.
- Final `npm run quality` passes. Product coverage is 94.67% lines, 96.41% functions, and 88.37%
  branches; the combined active research gate passes 102/102.
- Final `npm run pack:check` passes with 155 files and 193,579 bytes. `npm run test:package` passes
  local, ephemeral, global, ESM, strict types, migration, init, validation, checkpoint, and resume.
- Frozen-attempt path diff inspection found no staged, unstaged, or untracked change under attempts 1
  through 4. No provider call, raw output capture, or credential access occurred.

## Decisions

- Keep the prototype non-scored and outside the stable runtime; it is execution-boundary evidence,
  not behavioral continuity or compaction evidence.
- A successor may use `repository-discovery` only after integrating it across every digest-bound
  registry, validator, wrapper, fixture, permission, and canary surface under a new experiment.
- Bind host system Git configuration or adopt a reviewed released product policy before freezing a
  successor. Do not leave `/etc/gitconfig` as an invisible input.
- Commit the reviewed prototype separately before creating an attempt-5 draft.

## Risks

- The prototype command helpers use `SIGTERM` timeouts without the successor runner's grace-period
  `SIGKILL`, explicit timeout state, and combined output cap. Do not copy them unchanged.
- The five-case live result validates the local verifier boundary only. It does not make attempt 4
  valid, pool with prior scores, or prove cross-harness continuity.
- Attempt 5 still needs new identities, review attestations, authenticated prerequisites, manifest,
  and permanent freeze boundary. No provider execution is currently authorized.
- The routed Claude surface remains GPT-backed and is not an independent model-family replication.

## Next action

Validate and checkpoint this reviewed prototype, then commit it independently. Create only an
unfrozen attempt-5 draft next and integrate the third policy with bounded process handling and bound
system-Git state before any review digest or provider call.
