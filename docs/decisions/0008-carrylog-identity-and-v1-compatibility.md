# ADR-0008: Adopt Carrylog while preserving configuration v1 wire identities

- Status: Accepted
- Date: 2026-07-10
- Owners: Repository maintainer
- Supersedes: ADR-0004 for product, repository, package, and executable naming

## Context

The first public beta used the product name Agent Context Kit, scoped npm package
`@jaemani/agent-context-kit`, and executable `ackit`. After publication, registry and ecosystem
research found that the unscoped `agent-context-kit` package was already owned by another context CLI.
The proposed replacement name Threadmark was also already used by a directly overlapping product
that ships `threadmark` and `threadmarkd` for local Claude Code and Codex handoff. npm availability
alone was therefore not sufficient name clearance.

Carrylog was checked against npm and GitHub project search. The unscoped npm name was unregistered,
and no same-category AI coding context or handoff product was found under that name. An unrelated,
inactive GitHub project uses different `CarryLog` capitalization; this practical ecosystem search is
not a legal trademark opinion.

The suggested short executable `cl` conflicts with Microsoft's established `cl.exe` C/C++ compiler.
Because Windows is a supported platform, publishing a global `cl` command could shadow the compiler
or be shadowed by it depending on `PATH` order.

The beta.3 package also established persisted repository identifiers. They are data-format identities,
not display branding. Blind replacement would make existing configuration undiscoverable, classify
managed adapters as unmanaged, or insert a second handoff snapshot.

## Decision

- Product and repository name: Carrylog.
- Canonical npm package and executable: `carrylog`.
- Next release: `0.1.0-beta.4` from a new immutable `v0.1.0-beta.4` tag.
- The new package exposes only the `carrylog` executable. It does not install `ackit` or `cl` aliases.
- Existing global users must uninstall `@jaemani/agent-context-kit` before globally installing
  `carrylog`, preventing a stale but still callable `ackit` command from masking incomplete migration.
  The old and new packages use different shim names and do not directly overwrite each other.
- The new TypeScript API keeps the beta.3 export surface. `CarrylogError` and deprecated
  `AckitError` are the same constructor so `instanceof` behavior remains stable.
- `CARRYLOG_DEBUG` is canonical. `ACKIT_DEBUG` remains a compatibility fallback; an explicitly set
  canonical variable takes precedence.

The following configuration v1 wire identities remain unchanged:

- canonical root and exported path: `.agent-context/` and `.agent-context/config.yaml`;
- the exact v1 schema bytes, including its original `$id` and title;
- adapter markers `agent-context-kit:managed:start` and `agent-context-kit:managed:end`;
- handoff markers `agent-context-kit:handoff-snapshot:start` and
  `agent-context-kit:handoff-snapshot:end`;
- reserved-marker validation for `agent-context-kit:managed:`.

Changing any of those persisted identities requires an explicit later schema/migration design. Active
adapter prose, commands, package metadata, and product documentation use Carrylog.

The exact untouched beta.3 instructions template is a narrow migration exception to the general rule
that canonical documents are human-owned. Sync recognizes the complete published LF or CRLF template
at any configured document path and changes only its executable name. Customized always-loaded
context with a command-shaped `ackit` invocation produces `E_LEGACY_CLI_INSTRUCTION`; historical
prose is allowed and Carrylog does not guess how to rewrite other content.

After the new package is independently verified, the old beta.3 package is deprecated with an exact
migration message rather than unpublished or republished as a floating facade. Historical tags,
changelog entries, engineering evidence, registry digests, and provenance identities remain intact.

## Rejected alternatives

- **Use unscoped `agent-context-kit`:** already owned by another publisher.
- **Use Threadmark because npm was empty:** rejected because an existing same-category project already
  distributes the exact product and executable name.
- **Publish `cl`:** rejected because it conflicts with the Microsoft compiler on a supported platform.
- **Rename `.agent-context`, schema identity, or markers immediately:** rejected because it breaks the
  published v1 repository contract without a migration.
- **Expose both `carrylog` and `ackit` binaries:** rejected because side-by-side global packages create
  command-shim ownership and uninstall ambiguity. Migration is explicit during beta.
- **Publish an old-package compatibility facade now:** rejected because it introduces two release
  artifacts and dependency identities before external migration demand exists.

## Consequences

Positive:

- the public brand, package, repository, and command become consistent;
- the canonical command is portable across supported operating systems;
- beta.3 repositories upgrade without moving or duplicating persisted state;
- TypeScript and debug compatibility remain available without preserving a conflicting global binary.

Negative:

- package and global CLI migration require an explicit uninstall/install step;
- customized beta.3 instructions require a one-time reviewed command update;
- persisted schema and marker strings retain the former project name until a reviewed migration exists;
- npm name availability remains a race until the protected first publication succeeds;
- the old package requires separate authenticated deprecation and dist-tag administration.

## Validation

- Literal tests freeze the v1 root, schema identity/title, adapter markers, handoff markers, and reserved
  marker behavior; the complete published schema bytes are pinned by SHA-256.
- A repository fixture independent of the current initializer covers untouched LF/CRLF instruction
  migration, mutable document IDs, and refusal of customized legacy invocations without changing
  adapters or canonical prose.
- The original raw GitHub schema URL returned HTTP 200 after the repository rename, preserving the
  published `$id` resolution path.
- A beta.3 repository upgrade test runs Carrylog validate, sync, and handoff behavior without creating
  a new context root or duplicate managed blocks.
- Package smoke covers unscoped installation paths, ESM and TypeScript imports, npm exec, npx, global
  command shims, initialization, and validation on Linux, macOS, and Windows.
- Release verification rechecks package identity, artifact digests, provenance, registry tags, and the
  renamed GitHub repository before old-package deprecation.

## Revisit triggers

- a legal or ecosystem name conflict is reported with concrete evidence;
- external beta migration shows that a temporary binary or package compatibility bridge is necessary;
- configuration v2 introduces a reviewed migration for persisted branding identifiers.
