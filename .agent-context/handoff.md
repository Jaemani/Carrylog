# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "515b170 at 2026-08-02T04:45:18+09:00"
- Upstream: "origin/main; ahead 0, behind 0"
- Working tree: 3 staged, 0 unstaged, 0 untracked, 0 conflicted
- Staged diff: 3 file(s), +62/-25, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (3)

    {"status":"M ","path":".agent-context/current-state.md"}
    {"status":"M ","path":"README.md"}
    {"status":"M ","path":"docs/engineering-log.md"}

### Recent commits (5)

    {"commit":"515b170","committedAt":"2026-08-02T04:45:18+09:00","subject":"fix: tolerate generated CRLF checkouts"}
    {"commit":"c727177","committedAt":"2026-08-02T04:29:14+09:00","subject":"docs: record beta7 release verification"}
    {"commit":"af2c560","committedAt":"2026-08-02T04:19:59+09:00","subject":"fix: settle committed checkpoints portably"}
    {"commit":"1cbb235","committedAt":"2026-08-02T03:24:36+09:00","subject":"research: record public beta switch smoke"}
    {"commit":"d16af41","committedAt":"2026-08-02T03:00:29+09:00","subject":"docs: record Carrylog beta6 publication"}

<!-- carrylog:checkpoint-settlement:v1 {"formatVersion":1,"objectFormat":"sha1","baseHead":"515b1709cdc4522c190543b984d926775883e57a","detached":false,"branch":"main","indexCommitment":"fe5123069583aae85e268f983e18ddedace91c48f9c405a0f482421586a053d2"} -->
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Design and execute a bounded second-repository comparison across repository-only, manual-handoff,
and Carrylog conditions without broadening claims before evidence and review exist.

## Completed

- Corrected generated schema and Skill comparison for paired CRLF/LF checkout representation while
  retaining ownership, non-EOL drift, raw resume digest, and Git settlement boundaries.
- Committed the correction at `515b170`, pushed it, and required exact-commit CI before creating the
  immutable annotated `v0.1.0-beta.7` tag.
- Approved the required protected `npm` environment after tagged Linux, macOS, and Windows preflight
  passed; the protected job published through npm trusted publishing with GitHub OIDC.
- Independently verified registry bytes, metadata, dist-tags, signature and attestations, SLSA
  provenance, isolated npx/global consumers, and a fresh-repository checkpoint lifecycle.
- Updated user-facing exact-version examples and current project memory to beta.7. Detailed release
  measurements and the typed environment-approval API correction live in the engineering log.

## Verification

- Exact-commit CI run `30715559240` passed all eleven Linux, macOS, Windows, minimum-Node, packed
  artifact, and npm-client contract jobs, including Windows Node 22 and 24 forced-autocrlf tests.
- Tagged release run `30715697081` passed three-OS preflight, protected OIDC publication, and its
  registry installation and beta-tag check.
- The independent registry download matched the publish-job SHA-256, SHA-1, and SHA-512 integrity;
  `beta` resolves to beta.7 and `latest` remains fixed at beta.4.
- SLSA provenance binds the exact package to `Jaemani/Carrylog`, `release.yml`, the beta.7 tag,
  commit `515b170`, and release run attempt 1; the installed graph passed signature audit.
- Isolated npx and global consumers printed beta.7. A fresh repository initialized 14 files,
  validated cleanly, reported settlement eligibility, and resumed the committed checkpoint with
  `checkpoint.stale=false`.

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
- Release integrity binds the independently downloaded registry bytes to the publish-job artifact;
  the different local macOS prepare artifact remains separate evidence.

## Risks

- Large or sparse-index projects can exceed bounded tree enumeration and receive settlement
  unavailable while exact freshness remains supported.
- Git-ignored files are outside the evidence boundary by design; Carrylog proves Git-visible project
  state, not physical worktree cleanliness or semantic document truth.
- Formal Tier 1 prerequisites, native Claude identity, Cursor availability, wrapper-aware permissions,
  and reliable router input-token accounting remain unresolved.
- Sequential cross-file rename, final path-to-syscall TOCTOU, and stale exclusion-lock recovery remain
  documented residual risks.

## Next action

Precommit the second-repository comparison design and acceptance rubric, then run bounded
repository-only, manual-handoff, and Carrylog conditions without changing product claims first.
