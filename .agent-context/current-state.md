# Current state

## Active objective

Design and execute the second-repository comparison across repository-only, manual-handoff, and
Carrylog conditions without broadening continuity claims. The published beta.7 preserves frozen v1
behavior and portable fail-closed semantics. Journaling and compaction remain out of scope.

## Implemented and verified

- Strict TypeScript CLI implements deterministic context initialization, synchronization, validation,
  Git handoff, explicit v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen; v2 adds Codex/Cursor, Claude, and Gemini surfaces plus offline
  continuity Skills with fail-closed ownership and migration.
- Resume binds guarded context reads to stable Git evidence, enforces per-file and aggregate resource
  limits, and emits terminal-safe human and JSON projections without provider-session data.
- ADR-0009 through ADR-0015 define universal surfaces, continuity boundaries, Git stability, evidence
  gates, portable checkpoint commit settlement, and generated-artifact EOL equivalence; research
  protocols remain outside the product package.
- Dogfood lifecycle, package consumers, complete dist-tag policy, and independent post-fix
  code/security and release reviews pass locally. Exact measurements belong to the engineering log.
- Immutable beta.7 corrects committed-checkpoint settlement and generated-artifact CRLF portability.
  Its exact commit passed all eleven CI jobs; the tagged release passed three-OS preflight, protected
  OIDC publication, registry digest/provenance verification, isolated consumers, signature audit, and
  a fresh-repository checkpoint lifecycle. Detailed measurements live in the engineering log.
- The continuity-Skill correction passes the complete Node 22/24 quality matrix on Linux, macOS, and
  Windows, the minimum-Node and three-OS packed-artifact matrix, and npm 11/npm 12 package contracts.
  Windows exercised the directory-junction regression; macOS retained the actual Seatbelt integration.

## In progress

- Tier 1 attempt 3 is frozen at commit `b72127e` with 10 fixtures, 60 balanced runs, blind evaluation,
  privacy review, a permanent first-ADD manifest, and mechanical Tier 2 gates. Attempts 1 and 2 remain
  immutable aborted evidence and contribute no score.
- The broker, canaries, dependency binding, review publication, and concurrent exclusion writes fail
  closed on identity, byte, or transaction drift. BusyCafe now requires an explicit temporary bare
  source, setup uses one explicit repository-scoped temporary cache root, and execution-order
  inspection plus claim is one locked transaction. Cache population requires a dedicated empty
  owner-only root claimed exclusively, safe child directories, and a sealed success receipt. Offline
  preparation commands additionally run under an operating-system network-denial profile. Both
  authenticated prerequisites pass for the current critical bytes.
- Cold online setup and same-cache offline preparation pass under macOS Seatbelt network denial.
  Claude binds the direct `gpt-5.6-sol` catalog record and every response model ID.
- Formal review found and closed hidden checkpoint edits, unclassified direct-shell evidence, raw
  opaque diagnostics, and PATH-resolved Codex execution. Both harnesses spawn preregistered native
  bytes by absolute path after an immediate digest recheck. Two exact-digest reviews approved attempt
  3 before its manifest and freeze commit.
- Runs `t1-001` through `t1-006` completed, passed privacy review, and received blind evaluations.
  Carrylog recall exceeded repository-only in both harnesses, matched manual handoff in Codex, and
  trailed manual handoff on one fact and one completion item in Claude. This is one-fixture directional
  evidence; 54 runs remain and no Tier 1 or universal-continuity conclusion exists.
- The Personal Context dogfood reconstructed a Codex handoff through Claude Code, resumed that Claude
  session, and exercised the generated Skill. It found the project-local executable discovery defect;
  this remains one external adoption example, not a controlled comparison.

## Blockers and risks

- Claude Code uses a GPT-backed Anthropic-compatible gateway, so the two harnesses are not independent
  model-family replications. The amended protocol and report must preserve that limitation.
- The router client surface does not expose internal provider identity. The pilot binds model-catalog
  and resolved-model identity and makes no provider-identity claim. The load-balancing route alias is
  excluded because repeated canaries resolved to different models.
- The router convenience launcher weakens permissions and is excluded from controlled runs. Claude
  authentication depends on the documented owner-only JM Router key file; its value and path are not
  persisted in evidence.
- Cursor CLI is unavailable locally; broader Cursor/Gemini outcome evidence remains future work.
- Automated resume needs a compatible source build, project-pinned install, or global install; Skills
  never download, build, or upgrade it implicitly.
- The user-level Claude default model and router settings currently require explicit `--settings`
  and `--model` flags; a normal unqualified Claude invocation still selects an unavailable model.
- Narrow Claude Bash permissions initially rejected the environment's `rtk`-wrapped Carrylog command.
  The product failed closed, but launch and permission-profile portability remain unresolved.
- Sequential cross-file rename and each final verified-executable-path-to-spawn TOCTOU window remain.
- External outcome evidence and additional Windows reparse/hard-link coverage remain stable-release
  work.
- npmjs.org does not allow removing `latest`; beta.4 remains the documented bare-install bootstrap
  until stable while `@beta` advances.
- Local prepare and tagged publish hosts can produce different tarball bytes from the same commit.
  Release integrity binds the registry download to the one artifact built, verified, and published
  inside the protected job; cross-host bit-for-bit packing is not claimed.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction, and
  compaction value remain unproven and outside the supported runtime.
- Claude reports zero input tokens for non-empty requests through the router. Preserve the raw value
  but treat input and cache usage as unavailable; make no token- or cost-efficiency claim.
- The frozen attempt-3 suite passes 92/93 after results exist because one synthetic analyzer test
  copies mutable quarantine state. Freeze, analysis, privacy, and score bindings pass; modifying the
  frozen test would invalidate the experiment, so a future experiment must correct it.
- A process killed while holding the exclusion registry lock can leave a stale lock that requires
  operator review before removal; the system prefers an explicit blocked retry over lost safety data.
- The execution scheduler lock has the same explicit stale-lock recovery policy. Native Claude is
  rechecked immediately before spawn, but the final check-to-syscall interval remains a TOCTOU risk.
- BusyCafe retained its HEAD and empty tracked diff, but its one-path untracked status digest changed
  after the initial observation. The experiment never reads or uses that worktree and relies only on
  the isolated bare source; physical worktree invariance is not claimed.
- Commit settlement enumerates the project-scoped index and committed tree under the bounded Git
  process limits. Large or sparse-index repositories may report it unavailable and retain exact
  checkpoint freshness.

## Next best task

Commit the reviewed initial six-cell evidence and continue from `t1-007` in frozen order, retaining
the execute, privacy-review, blind-evaluation, and analyzer gates for every run.
