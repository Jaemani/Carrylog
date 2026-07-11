# ADR-0009: Add explicit configuration v2 for universal agent surfaces

- Status: Accepted
- Date: 2026-07-11
- Owners: Repository maintainer

## Context

Configuration v1 is a published compatibility contract. It names Codex and Claude Code adapters
directly and has no continuity policy. Adding Cursor, Gemini CLI, generated Skills, or checkpoint
selection by silently changing v1 would make the same reviewed YAML mean something different after a
package upgrade.

Codex and Cursor use the same repository instruction surface, while Claude Code and Gemini CLI use
distinct root files. Treating every harness as a separate adapter would duplicate `AGENTS.md`
ownership and create invalid output collisions.

## Decision

Carrylog supports configuration versions 1 and 2 concurrently. New `init` operations create v2;
existing v1 repositories remain valid and are never migrated by `sync`.

Version 2 adds:

- adapter surfaces `agents`, `claude`, and `gemini` rather than one entry per harness;
- `agents` as the shared `AGENTS.md` surface for Codex and Cursor;
- `continuity.checkpointDocument`, which must identify an always-loaded document;
- `continuity.generateSkills`, which controls deterministic repository Skill generation.

Each version has a separate packaged JSON Schema and copied `.agent-context/config.schema.json`.
Runtime decoding rejects cross-version adapter names. Configuration v1 schema bytes, `$id`, marker
namespaces, and semantics remain frozen under ADR-0005 and ADR-0008.

`carrylog migrate --to 2` is the only v1-to-v2 transition. It preserves YAML comments and LF/CRLF
style, maps `codex` to `agents`, and adds continuity policy. `--universal` ensures all three surfaces
and enables Skills; it can also complete a partial v2 configuration. A stock published v1 handoff is
converted automatically, and an already compliant checkpoint is preserved. Customized handoff prose
without the required checkpoint sections fails with `E_CHECKPOINT_REVIEW_REQUIRED` rather than being
semantically reclassified.

Migration plans schema, adapter, Skill, checkpoint, and config changes before mutation. Unowned
adapter files still require `--adopt`; Skills are never adopted or merged. The config rename is last
in the guarded batch so a process failure cannot leave v2 claiming outputs that were not attempted.
This ordering narrows failure impact but does not claim an OS-level cross-file transaction.

## Rejected alternatives

- **Extend v1 in place:** rejected because it violates the published meaning of v1.
- **One adapter per harness:** rejected because Codex and Cursor would compete for `AGENTS.md`.
- **Implicit migration during `sync`:** rejected because customized handoff semantics require review.
- **Infer customized checkpoint sections with a model:** rejected because migration must remain
  deterministic, offline, and auditable.
- **Drop v1 after introducing v2:** rejected by the compatibility period in ADR-0005.

## Consequences

- Code paths and tests must keep version-specific adapter and schema contracts distinct.
- A user who wants all supported harnesses runs `migrate --to 2 --universal`; a narrower migration
  preserves the surfaces they selected.
- New harnesses should map to an existing discovery surface when ownership is truly shared, otherwise
  a future configuration version may be required.
- Generated Skill paths participate in normalized managed-path ownership only while Skills are
  enabled; disabling generation leaves existing managed Skills for explicit human removal and warns.

## Validation

- Strict schema/runtime tests for both versions and 500 generated valid v2 configurations.
- Partial v1 and v2 universal migrations, non-universal migration, idempotence, comment and CRLF
  preservation, output collisions, customized checkpoints, and unowned Skill conflicts.
- No-partial-write assertions for every planning conflict and config-last ordering review.
- Carrylog's own repository migration from v1 to universal v2 followed by clean sync and validation.
