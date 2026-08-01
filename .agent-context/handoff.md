# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "af2c560 at 2026-08-02T04:19:59+09:00"
- Upstream: "origin/main; ahead 2, behind 0"
- Working tree: 2 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 2 file(s), +30/-12, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (2)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"docs/engineering-log.md"}

### Recent commits (5)

    {"commit":"af2c560","committedAt":"2026-08-02T04:19:59+09:00","subject":"fix: settle committed checkpoints portably"}
    {"commit":"1cbb235","committedAt":"2026-08-02T03:24:36+09:00","subject":"research: record public beta switch smoke"}
    {"commit":"d16af41","committedAt":"2026-08-02T03:00:29+09:00","subject":"docs: record Carrylog beta6 publication"}
    {"commit":"d447dfc","committedAt":"2026-08-02T02:43:39+09:00","subject":"release: prepare Carrylog beta6"}
    {"commit":"60e2833","committedAt":"2026-08-02T02:37:39+09:00","subject":"research: refresh continuity harness binding"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"af2c560651cd6a571574deffe20e59ba1f5aead1","detached":false,"branch":"main","indexCommitment":"92c6fc18073001b5db5630f21eddedf2fc12860d8767a9b65330c88d919b02e1"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Complete exact-commit CI and immutable beta.7 publication for the portable checkpoint-settlement
correction, then return to the second-repository comparative adoption design.

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
- Committed the reviewed correction at `af2c560` and confirmed that the repository's own clean
  checkpoint resumes with `checkpoint.stale=false` through the new settlement proof.

## Verification

- The focused continuity suite passes 31/31 cases, including SHA-256 Git, conflicts, clean partial
  mismatch, ignored files, dirty ignored submodules, detached state, object-format mismatch, and
  branch-backed push/fresh-clone reconstruction.
- Clean-commit `release:verify` at `af2c560` passes 248/248 tests with 94.43% line, 96.39% function,
  and 88.28% branch coverage, above every enforced floor.
- Beta.7 package inspection at `af2c560` passes with 153 files and 173,115 bytes.
- Packed-artifact smoke passes local, ephemeral, global, ESM, strict TypeScript, v1-to-v2 migration,
  initialization, validation, checkpoint, and resume paths.
- `carrylog validate --json`, generated-surface drift, production audit, and whitespace checks are
  clean; the release run ended with an explicit success marker and exit code zero.
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

- Beta.7 has not yet passed the exact release commit's Linux/macOS/Windows CI matrix; no publication
  claim exists.
- Large or sparse-index projects can exceed bounded tree enumeration and receive settlement
  unavailable while exact freshness remains supported.
- Git-ignored files are outside the evidence boundary by design; Carrylog proves Git-visible project
  state, not physical worktree cleanliness or semantic document truth.
- Formal Tier 1 prerequisites, native Claude identity, Cursor availability, wrapper-aware permissions,
  and reliable router input-token accounting remain unresolved.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Settle and commit this release-evidence update, rerun clean `release:verify` on that exact commit,
push it, and require the complete CI matrix before tagging or publishing.
