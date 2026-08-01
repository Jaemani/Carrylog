# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "c727177 at 2026-08-02T04:29:14+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 13 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 13 file(s), +217/-23, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (13)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":".agent-context/decisions.md"}
    {"status":"M ","path":"CHANGELOG.md"}
    {"status":"A ","path":"docs/decisions/0014-generated-artifact-eol-equivalence.md"}
    {"status":"M ","path":"docs/decisions/README.md"}
    {"status":"M ","path":"docs/engineering-log.md"}
    {"status":"M ","path":"docs/testing-strategy.md"}
    {"status":"M ","path":"docs/threat-model.md"}
    {"status":"M ","path":"src/commands/sync.ts"}
    {"status":"M ","path":"src/core/marker-lines.ts"}
    {"status":"M ","path":"src/validation/validate.ts"}
    {"status":"M ","path":"tests/continuity.test.mjs"}
    {"status":"M ","path":"tests/schema.test.mjs"}

### Recent commits (5)

    {"commit":"c727177","committedAt":"2026-08-02T04:29:14+09:00","subject":"docs: record beta7 release verification"}
    {"commit":"af2c560","committedAt":"2026-08-02T04:19:59+09:00","subject":"fix: settle committed checkpoints portably"}
    {"commit":"1cbb235","committedAt":"2026-08-02T03:24:36+09:00","subject":"research: record public beta switch smoke"}
    {"commit":"d16af41","committedAt":"2026-08-02T03:00:29+09:00","subject":"docs: record Carrylog beta6 publication"}
    {"commit":"d447dfc","committedAt":"2026-08-02T02:43:39+09:00","subject":"release: prepare Carrylog beta6"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"c727177bb43eccdafb5e62c4db4b3826aa9b93aa","detached":false,"branch":"main","indexCommitment":"ee57509882270fe3ee171a5cfffaa03843f030f3e1ef72643a075aefe590109d"} -->
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
- Pushed release candidate `c727177`; CI run `30714928860` passed every non-Windows quality job and
  every package/toolchain job but failed both Windows quality jobs on generated-file CRLF drift.
- Added ADR-0014 and a narrow EOL-equivalence correction for complete generated schema and Skill
  files without changing ownership, non-EOL drift, raw resume digests, or Git settlement commitments.

## Verification

- Focused continuity and schema tests pass 44/44, including a forced-autocrlf clone whose schema and
  two Skills contain CRLF, remain no-drift, and resume the settled checkpoint as fresh.
- The complete local quality gate passes 249/249 tests with 94.65% line, 96.40% function, and 88.39%
  branch coverage, above every enforced floor.
- Package inspection passes with 154 files and 176,297 bytes; publish-dry-run smoke passes local,
  ephemeral, global, ESM, strict TypeScript, v1-to-v2 migration, initialization, validation,
  checkpoint, and resume consumers.
- Non-EOL changes to the generated schema and an owned Skill remain rejected; the CRLF schema remains
  unchanged after check-mode synchronization.
- Two independent post-fix reviewers report GO with no P0/P1 issue. They require new exact-commit
  Windows Node 22/24 evidence before release.

## Decisions

- Exact Git-snapshot freshness remains the default. Commit settlement is a second fail-closed state,
  not a heuristic that ignores `HEAD` or accepts arbitrary descendants.
- Settlement uses repository-owned Git object evidence and deliberately excludes reflog, provider
  session, upstream-tracking, and ignored-file state.
- A content-equivalent rewrite with the same sole parent and project tree remains fresh; altered-tree,
  merge, later, partial, dirty, malformed, or uncertain states remain stale.
- Git status and diff evidence always override submodule-ignore configuration.
- Generated standalone schema and Skill drift normalizes only paired CRLF/LF representation. Carrylog
  does not take ownership of the repository's root `.gitattributes`.

## Risks

- The CRLF correction has not yet passed clean-commit release verification or the Linux/macOS/Windows
  CI matrix; no publication claim exists.
- Large or sparse-index projects can exceed bounded tree enumeration and receive settlement
  unavailable while exact freshness remains supported.
- Git-ignored files are outside the evidence boundary by design; Carrylog proves Git-visible project
  state, not physical worktree cleanliness or semantic document truth.
- Formal Tier 1 prerequisites, native Claude identity, Cursor availability, wrapper-aware permissions,
  and reliable router input-token accounting remain unresolved.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Settle and commit the reviewed CRLF correction, rerun clean `release:verify` on that exact commit,
push it, and require the complete CI matrix before tagging or publishing.
