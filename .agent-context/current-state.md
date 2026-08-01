# Current state

## Active objective

Correct the committed-checkpoint freshness lifecycle exposed after the beta.6 switch smoke, then
return to bounded external outcome evidence. The correction must preserve frozen v1 behavior and
portable fail-closed semantics before a comparative second-repository pilot. Journaling and
compaction remain out of scope.

## Implemented and verified

- Strict TypeScript CLI implements deterministic context initialization, synchronization, validation,
  Git handoff, explicit v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen; v2 adds Codex/Cursor, Claude, and Gemini surfaces plus offline
  continuity Skills with fail-closed ownership and migration.
- Resume binds guarded context reads to stable Git evidence, enforces per-file and aggregate resource
  limits, and emits terminal-safe human and JSON projections without provider-session data.
- ADR-0009 through ADR-0013 define universal surfaces, continuity boundaries, Git stability, evidence
  gates, and portable checkpoint commit settlement; research protocols remain outside the product
  package.
- Dogfood lifecycle, package consumers, complete dist-tag policy, and independent post-fix
  code/security and release reviews pass locally. Exact measurements belong to the engineering log.
- Immutable beta.6 is publicly installable through the explicit npm `beta` channel. Its tagged
  cross-platform preflight, token-free OIDC publication, registry artifact, executable, dist-tags,
  signature, SLSA provenance, and fresh-repository lifecycle were independently verified.
- The continuity-Skill correction passes the complete Node 22/24 quality matrix on Linux, macOS, and
  Windows, the minimum-Node and three-OS packed-artifact matrix, and npm 11/npm 12 package contracts.
  Windows exercised the directory-junction regression; macOS retained the actual Seatbelt integration.

## In progress

- A beta.7 candidate recognizes one qualifying fully staged checkpoint commit through a full base
  parent, detached/branch identity, Git object format, clean state, and matching project-scoped
  index/tree commitments. It avoids reflog and upstream-state dependencies, survives push/fresh clone,
  and keeps legacy or uncertain states on exact freshness.
- Review found and corrected repository submodule-ignore configuration that could hide dirty nested
  work. Status and diff evidence now force submodule inspection, with a real `ignore=all` regression.
- The beta.7 correction passes the complete local quality gate, package inspection, installed-artifact
  smoke, and focused settlement suite. Two independent read-only reviews closed the submodule blocker
  and found no remaining P0/P1 issue. Release verification and committed cross-platform CI are still
  required before publication.

- The unexecuted Tier 1 candidate retains 10 fixtures, 60 balanced runs, blind evaluation, privacy
  review, permanent first-ADD, and mechanical Tier 2 gates. It has no manifest, formal attestations,
  scored data, or current authenticated prerequisite pass; details remain in `research/continuity/`.
- The broker, canaries, dependency binding, review publication, and concurrent exclusion writes fail
  closed on identity, byte, or transaction drift. Codex and Claude prerequisites remain pending.
- A real Personal Context smoke test reconstructed Codex-authored repository handoff facts through
  Claude Code using a GPT router, resumed the resulting Claude session without file tools, and then
  exercised a Carrylog v2 checkpoint through the generated Claude Skill. The test exposed and fixed
  project-local executable discovery through ignored `node_modules`; this is delivery and
  reconstruction evidence, not a scored Tier 1 result.
- The Personal Context smoke is one external-repository adoption example. It found the executable
  discovery defect fixed in beta.6 and now includes one successful two-switch behavior sequence.
  No repository-only/manual comparison or scored Tier 1 result has been run.

## Blockers and risks

- Claude Code is now reachable through an explicitly loaded local GPT router, but that route does not
  match the frozen Tier 1 Claude CLI/model configuration. The formal authenticated prerequisite must
  remain pending until the protocol is deliberately amended and its synthetic-authentication and
  isolation contract is reviewed for the router.
- The Codex authenticated canary passed immediately before the final redaction-only critical change,
  but its rerun then hit the provider usage limit. The stale pass was correctly discarded and no
  current-byte pass is claimed.
- Cursor CLI is unavailable locally; broader Cursor/Gemini outcome evidence remains future work.
- Automated resume needs a compatible source build, project-pinned install, or global install; Skills
  never download, build, or upgrade it implicitly.
- The user-level Claude default model and router settings currently require explicit `--settings`
  and `--model` flags; a normal unqualified Claude invocation still selects an unavailable model.
- Narrow Claude Bash permissions initially rejected the environment's `rtk`-wrapped Carrylog command.
  The product failed closed, but launch and permission-profile portability remain unresolved.
- Sequential cross-file rename and the final path-to-syscall TOCTOU window remain under ADR-0007.
- External outcome evidence and additional Windows reparse/hard-link coverage remain stable-release
  work.
- npmjs.org does not allow removing `latest`; beta.4 remains the documented bare-install bootstrap
  until stable while `@beta` advances.
- Local prepare and tagged publish hosts can produce different tarball bytes from the same commit.
  Release integrity binds the registry download to the one artifact built, verified, and published
  inside the protected job; cross-host bit-for-bit packing is not claimed.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction, and
  compaction value remain unproven and outside the supported runtime.
- A process killed while holding the exclusion registry lock can leave a stale lock that requires
  operator review before removal; the system prefers an explicit blocked retry over lost safety data.
- Commit settlement enumerates the project-scoped index and committed tree under the bounded Git
  process limits. Large or sparse-index repositories may report it unavailable and retain exact
  checkpoint freshness.

## Next best task

Close the checkpoint-settlement review, run the complete local and cross-platform release gates, and
publish the correction as a new immutable beta if they pass. Then design the second-repository
comparison across repository-only, manual-handoff, and Carrylog conditions before changing claims.
