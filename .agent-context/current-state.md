# Current state

## Active objective

Finalize reviewed `0.1.0-beta.6` through a clean release commit, content-sensitive verification,
fresh CI, immutable tag, OIDC publication, and registry/provenance verification. Journaling and
compaction remain out of scope.

## Implemented and verified

- Strict TypeScript CLI implements deterministic context initialization, synchronization, validation,
  Git handoff, explicit v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen; v2 adds Codex/Cursor, Claude, and Gemini surfaces plus offline
  continuity Skills with fail-closed ownership and migration.
- Resume binds guarded context reads to stable Git evidence, enforces per-file and aggregate resource
  limits, and emits terminal-safe human and JSON projections without provider-session data.
- ADR-0009 through ADR-0012 define universal surfaces, continuity boundaries, Git stability, and
  evidence gates; research protocols remain outside the product package.
- Dogfood lifecycle, package consumers, complete dist-tag policy, and independent post-fix
  code/security and release reviews pass locally. Exact measurements belong to the engineering log.
- Immutable beta.5 is publicly installable through the explicit npm `beta` channel. Its tagged
  cross-platform preflight, token-free OIDC publication, registry artifact, executable, dist-tags,
  signature, and SLSA provenance were independently verified.
- The continuity-Skill correction passes the complete Node 22/24 quality matrix on Linux, macOS, and
  Windows, the minimum-Node and three-OS packed-artifact matrix, and npm 11/npm 12 package contracts.
  Windows exercised the directory-junction regression; macOS retained the actual Seatbelt integration.

## In progress

- The Tier 1 candidate contains 10 fixtures, 60 balanced runs, blind evaluation bundles, deterministic
  execution and privacy-review gates, a mechanical Tier 2 decision rule, and a permanent first-ADD
  freeze boundary. No scored or raw artifacts exist.
- The complete prepare-only matrix passes for the current bytes. The candidate has no manifest or
  formal review attestations and therefore is not a committed freeze.
- The runner exposes only one shallow source commit to the broker, denies models direct Git-metadata
  access, recovers exact privacy-review transactions, and gates formal review on digest-bound
  authenticated harness prerequisites. A final diagnostic-redaction change reset the critical-byte
  binding; current prerequisite status is Codex pending and Claude pending.
- Authenticated canaries bind Codex results to one immutable exact-command probe and bind Claude
  permission denials to exact tool IDs, names, and inputs. Analysis dependencies, review
  attestations, manifest bytes, and concurrent exclusion writes now fail closed on drift or races.
- A real Personal Context smoke test reconstructed Codex-authored repository handoff facts through
  Claude Code using a GPT router, resumed the resulting Claude session without file tools, and then
  exercised a Carrylog v2 checkpoint through the generated Claude Skill. The test exposed and fixed
  project-local executable discovery through ignored `node_modules`; this is delivery and
  reconstruction evidence, not a scored Tier 1 result.
- Beta.6 metadata, exact-version quality/package/audit gates, registry-absence check, and release
  review pass. The changelog is promoted to the dated beta.6 heading; clean-commit verification and
  fresh CI remain before tagging.

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
- Sequential cross-file rename and the final path-to-syscall TOCTOU window remain under ADR-0007.
- External outcome evidence and additional Windows reparse/hard-link coverage remain stable-release
  work.
- npmjs.org does not allow removing `latest`; beta.4 remains the documented bare-install bootstrap
  until stable while `@beta` advances.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction, and
  compaction value remain unproven and outside the supported runtime.
- A process killed while holding the exclusion registry lock can leave a stale lock that requires
  operator review before removal; the system prefers an explicit blocked retry over lost safety data.

## Next best task

Commit the settled beta.6 release bytes, run `npm run release:verify` on the clean commit, push and
require fresh CI, then tag only that exact green commit and verify OIDC publication and registry
provenance independently.
