# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "1cbb235 at 2026-08-02T03:24:36+09:00"
- Upstream: "origin/main; ahead 1, behind 0"
- Working tree: 25 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 25 file(s), +1239/-49, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (25)

    {"status":"M ","path":".agent-context/architecture.md"}
    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":".agent-context/decisions.md"}
    {"status":"M ","path":".agents/skills/carrylog-continuity/SKILL.md"}
    {"status":"M ","path":"CHANGELOG.md"}
    {"status":"M ","path":"README.md"}
    {"status":"M ","path":"ROADMAP.md"}
    {"status":"M ","path":"docs/architecture.md"}
    {"status":"A ","path":"docs/decisions/0013-checkpoint-commit-settlement.md"}
    {"status":"M ","path":"docs/decisions/README.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"docs/releasing.md"}
    {"status":"M ","path":"docs/testing-strategy.md"}
    {"status":"M ","path":"docs/threat-model.md"}
    {"status":"M ","path":"package-lock.json"}
    {"status":"M ","path":"package.json"}
    {"status":"M ","path":"src/cli.ts"}
    {"status":"M ","path":"src/commands/handoff.ts"}
    {"status":"M ","path":"src/commands/resume.ts"}
    {"status":"M ","path":"src/continuity/skills.ts"}
    {"status":"A ","path":"src/git/checkpoint-settlement.ts"}
    {"status":"M ","path":"src/git/inspect.ts"}
    {"status":"M ","path":"src/handoff/snapshot-block.ts"}
    {"status":"M ","path":"tests/cli.test.mjs"}
    {"status":"M ","path":"tests/continuity.test.mjs"}

### Recent commits (5)

    {"commit":"1cbb235","committedAt":"2026-08-02T03:24:36+09:00","subject":"research: record public beta switch smoke"}
    {"commit":"d16af41","committedAt":"2026-08-02T03:00:29+09:00","subject":"docs: record Carrylog beta6 publication"}
    {"commit":"d447dfc","committedAt":"2026-08-02T02:43:39+09:00","subject":"release: prepare Carrylog beta6"}
    {"commit":"60e2833","committedAt":"2026-08-02T02:37:39+09:00","subject":"research: refresh continuity harness binding"}
    {"commit":"dc2e7cb","committedAt":"2026-08-02T02:32:32+09:00","subject":"fix: restore cross-platform continuity contracts"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"1cbb235d6f7d30fbe023e9ebcaaa2248d02b6c30","detached":false,"branch":"main","indexCommitment":"0d5ea4ce7bd2ac2d674477b91885b7fcc47e00e2bed1901267b07873f7006253"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Prepare the portable checkpoint-settlement correction as an immutable beta.7 release candidate, then
return to the second-repository comparative adoption design.

## Completed

- Committed the sanitized public beta.6 Codex-to-Claude/GPT-router-to-Codex switch observation without
  provider transcripts, credentials, settings, histories, hidden reasoning, or raw streams.
- Reproduced the post-commit `resume --check` stale result and identified the impossible exact
  self-reference between a checkpoint file and the commit containing it.
- Added ADR-0013 and a v2-only portable settlement proof over the full base parent, branch/detached
  identity, object format, clean Git-visible state, and project-scoped staged-index/committed-tree
  commitments. Configuration v1 output remains frozen.
- Removed rejected reflog and upstream-divergence dependencies, exposed settlement eligibility in
  human/JSON output, and updated the generated continuity Skill without granting commit authority.
- Closed two independent review cycles, including a P1 where `submodule.*.ignore=all` could hide a
  dirty submodule from freshness evidence.

## Verification

- The focused continuity suite passes 30/30 cases, including SHA-256 Git, conflicts, clean partial
  mismatch, ignored files, dirty ignored submodules, detached state, object-format mismatch, and
  branch-backed push/fresh-clone reconstruction.
- The complete local quality gate passes above every enforced coverage floor.
- Beta.7 package inspection passes with 153 files and 171,802 bytes.
- Packed-artifact smoke passes local, ephemeral, global, ESM, strict TypeScript, v1-to-v2 migration,
  initialization, validation, checkpoint, and resume paths.
- `carrylog validate --json`, generated-surface drift, and whitespace checks are clean.
- Independent post-fix reviewers report no unresolved P0/P1 issue; the original submodule-ignore P1
  is closed in source, tests, threat model, and ADR.

## Decisions

- Exact Git-snapshot freshness remains the default. Commit settlement is a second fail-closed state,
  not a heuristic that ignores `HEAD` or accepts arbitrary descendants.
- Settlement uses repository-owned Git object evidence and deliberately excludes reflog, provider
  session, upstream-tracking, and ignored-file state.
- A content-equivalent rewrite with the same sole parent and project tree remains fresh; altered-tree,
  merge, later, partial, dirty, malformed, or uncertain states remain stale.
- Git status and diff evidence always override submodule-ignore configuration.

## Risks

- Beta.7 has not yet passed clean-commit release verification or the committed Linux/macOS/Windows CI
  matrix; no publication claim exists.
- Large or sparse-index projects can exceed bounded tree enumeration and receive settlement
  unavailable while exact freshness remains supported.
- Git-ignored files are outside the evidence boundary by design; Carrylog proves Git-visible project
  state, not physical worktree cleanliness or semantic document truth.
- Formal Tier 1 prerequisites, native Claude identity, Cursor availability, wrapper-aware permissions,
  and reliable router input-token accounting remain unresolved.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Stage the reviewed beta.7 changes, generate and stage the settlement-aware checkpoint, commit once,
then require clean `release:verify` and the complete exact-commit CI matrix before tagging or
publishing.
