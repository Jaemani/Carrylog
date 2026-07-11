# Current state

## Active objective

Convert the completed external document review into a delivery-focused beta.5 candidate while
preserving the immutable beta.4 publication-recovery path. Prepare the minimum Tier 1 continuity
pilot without implementing journaling or compaction.

## Implemented and verified

- Strict TypeScript CLI implements deterministic context initialization, synchronization, validation,
  Git handoff, explicit v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen; v2 adds Codex/Cursor, Claude, and Gemini surfaces plus offline
  continuity Skills with fail-closed ownership and migration.
- Resume binds guarded context reads to stable Git evidence, enforces per-file and aggregate resource
  limits, and emits terminal-safe human and JSON projections without provider-session data.
- ADR-0009 through ADR-0012 define universal surfaces, continuity boundaries, Git stability, and
  evidence gates; research protocols remain outside the product package.
- Dogfood lifecycle, package consumers, and independent post-fix code/security review pass locally.
  Exact measurements and defect history belong to the engineering log.

## In progress

- The reviewed beta.5 implementation commit passed the eleven-job Linux/macOS/Windows CI matrix. A
  future changelog promotion and release-evidence commit still needs exact-commit release gates.
- Immutable beta.4 is publicly installable from the npm `beta` tag and its artifact and provenance
  were independently verified. Post-publication registry and credential hardening remains in
  progress; exact evidence is recorded in the engineering log.

## Blockers and risks

- Cursor CLI is unavailable locally; final authenticated Codex/Gemini conformance still needs restored
  credentials.
- Automated resume needs a compatible source build, project-pinned install, or global install; Skills
  never download, build, or upgrade it implicitly.
- Sequential cross-file rename and the final path-to-syscall TOCTOU window remain under ADR-0007.
- External outcome evidence and additional Windows reparse/hard-link coverage remain stable-release
  work.
- npm post-publication administration remains: remove unintended `latest`, configure trusted
  publishing, finish old-package migration, disallow tokens, and revoke the bootstrap credential.

## Next best task

Finish beta.4 post-publication registry and credential hardening, then prepare the exact beta.5
release commit and gates. Run Tier 1 after its fixtures are committed.
