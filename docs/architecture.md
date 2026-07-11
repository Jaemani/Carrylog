# Architecture

## Context

The system converts a human-maintained repository memory into small instruction-file routers for AI
coding tools. It runs as a local CLI and currently has no service, database, network runtime, or
model dependency.

## Component model

```text
CLI parsing and reporting
          |
          v
application commands: init / sync / validate / migrate / checkpoint / resume
          |
          +--------------------+
          v                    v
config + domain model    validation policies
          |                    |
          +----------+---------+
                     v
             adapter rendering
                     |
                     v
        safe path + atomic file boundary
```

### CLI boundary

`src/cli.ts` owns command syntax, human/JSON output, and stable exit-code mapping. It should not own
filesystem policy or rendering rules.

`src/product.ts` is a dependency-free identity leaf for active Carrylog display, command, and debug
names. Persisted configuration v1 paths, schema metadata, and marker namespaces intentionally do not
derive from it; ADR-0008 keeps those wire identities stable across the product rename.

`src/migrations/` contains explicit compatibility transitions for published repository state. A
migration may rewrite a human-owned canonical document only when its complete bytes match a frozen
published template, allowing LF and CRLF variants when both are semantically identical. Customized
content receives a diagnostic and must be reconciled by its owner. Migration writes join the same
guarded batch and stale-content preconditions as schema and adapter updates.
Candidate reads are capped at the frozen template's CRLF byte length; larger documents cannot be an
exact match and continue to the normal one-MiB-per-document validation boundary without a full
migration-planner read.

Exit codes are part of the automation contract:

- `0`: command completed and no blocking issue exists;
- `1`: drift, invalid project state, or another recoverable project issue;
- `2`: invocation or unsupported option;
- `3`: unexpected internal failure.

### Application commands

- `init` constructs a complete write plan, detects canonical and adapter conflicts, and writes only
  after preflight succeeds.
- `sync` plans exact published-template migrations, validates their prospective context, plans every
  adapter, and then applies changed context, adapter, and copied-schema files through one guarded
  batch.
- `validate` combines canonical context, schema, ownership, handoff-marker, and adapter inspection and
  never writes.
- `handoff` gathers bounded Git evidence, replaces only its evidence block, and prospectively
  validates the result before writing.
- `migrate` performs explicit version transitions, validates the prospective version, and commits the
  canonical config after generated outputs.
- `checkpoint` aliases the compatible handoff refresh through the configured v2 checkpoint document.
- `resume` validates and projects one portable deterministic context/Git envelope without writing.

These commands accept resolved domain objects where practical so tests can exercise behavior without
shell parsing.

### Configuration and domain

`.agent-context/config.yaml` is explicitly versioned. The decoder is strict: unknown keys fail so a
typo cannot silently disable a policy. YAML parsing rejects duplicate keys and limits aliases.

Version 1 has four concepts:

- project identity;
- documents with `always` or `on-demand` load policy;
- adapter type and output;
- separate always-loaded document and generated-adapter character budgets.

The public v1 JSON Schema covers structural constraints. Runtime decoding and validation add
filesystem and cross-entry semantics. Their compatibility relationship and future migration policy
are frozen in [ADR-0005](decisions/0005-configuration-v1-compatibility.md); silent reinterpretation is
not acceptable.

Version 2 retains those concepts and adds shared instruction surfaces plus continuity policy. The
`agents` surface owns one `AGENTS.md` for Codex and Cursor; `claude` and `gemini` remain distinct.
`continuity` selects an always-loaded checkpoint and whether deterministic repository Skills are
generated. Version-specific public schemas and explicit migration are defined by
[ADR-0009](decisions/0009-configuration-v2-and-universal-surfaces.md).

### Adapter compiler

Adapters render a concise router from the document catalog; they do not copy the complete documents.
Codex/Cursor, Claude Code, and Gemini CLI currently share semantic router content but have distinct
surface registry identities and reviewed golden fixtures, allowing future tool-specific behavior
without changing the source model. The exact supported discovery surface is documented in
[adapter compatibility](adapter-compatibility.md).

Generated content lives between one start and one end marker. Synchronization replaces only that
region. A pre-existing unmarked file requires `--adopt`; malformed or duplicate markers fail closed.

### Filesystem safety boundary

All configured paths:

1. must be normalized, relative, and use `/` separators;
2. reject Windows-reserved names and characters even on Unix;
3. are compared with conservative Unicode compatibility and multi-step case normalization;
4. resolve lexically inside the project root;
5. reject any existing symbolic-link component.

Project roots are canonicalized through the operating system before discovery or initialization.
All config, document, copied-schema, and adapter paths enter one normalized ownership graph. Config,
document, and existing adapter reads are bounded and require valid UTF-8. Catalog counts and
rendered adapter size are also bounded so progressive disclosure cannot be bypassed by an oversized
router.

Writes carry an inspected guard for the canonical root, existing directory device/inode identities,
and missing parent paths. The batch rechecks every guard before staging, verifies physical containment
and parent identity immediately before temporary creation and every rename, and verifies the temporary
file identity before commit. Expected output and exact configuration source content are rechecked
before each remaining rename. Cleanup follows a temporary path only while its parent identity is still
trusted. These controls prevent common parent-substitution, stale-plan, and torn-file failures.

Sequential renames are not an operating-system transaction; a race or OS failure during commit can
still leave a cross-file batch partially applied. Portable Node.js also lacks directory-descriptor
`openat`/`renameat`, so a final check-to-syscall window remains. ADR-0007 defines this boundary.

Resume export uses a stricter read boundary because canonical context may contain confidential data.
It opens regular files without following final symlinks where supported, rejects hard links, bounds
and validates UTF-8 bytes, compares device, inode, size, modification time, change time, and link
count before/after the read, then compares that complete metadata to the resolved path. Change time
closes the same-size overwrite case where a writer restores modification time. Resume sandwiches
bounded Git inspection between two complete config/document observations and revalidates the exact
observed bytes before serialization. Its JSON serializer escapes invisible control/format characters
in raw output without changing the values obtained by a conforming JSON parser.

## Dependency direction

```text
cli -> commands -> config/domain, adapters, validation, core
cli, adapters, config, templates, validation -> product
sync, validation -> migrations
migrations -> core, domain, templates
validation -> adapters, handoff, schema, core, domain
adapters -> registry, domain, core errors
config -> domain, core paths/errors
handoff/git -> core, domain
product -> no dependencies
core -> Node.js standard library only
```

The domain layer must not import CLI or filesystem implementation. Adapter implementations must not
write directly; commands own mutation.

## Extension points

### Additional agent adapters

An adapter should be added only after documenting:

- the tool's official instruction discovery and precedence behavior;
- supported file format and location;
- whether imports or nested rules exist;
- generated-block compatibility;
- fixture tests for exact output and coexistence with user content.

### Handoff snapshot

The implemented handoff command collects deterministic Git evidence—branch, status, project-relative
changed paths, staged/unstaged diff stat, upstream divergence, and recent commits—inside a separate
managed block. Two observations must match in every consumed channel—allowed exit code and exact
stdout—or collection retries three times and then fails closed. Sandbox stderr is not repository
state under ADR-0011. Semantic narrative remains human/agent-authored. Process and trust boundaries
are defined in [ADR-0006](decisions/0006-deterministic-git-handoff-evidence.md).

### Skills and MCP

The v2 continuity Skill teaches compatible agents how to resume and checkpoint without embedding
project-specific content. Codex, Cursor, and Gemini use the generic `.agents/skills` copy; Claude Code
uses a small adapter Skill. An MCP server can later offer query-oriented access to the same resume
model. Neither becomes the only way to access project state; Markdown and CLI behavior remain the
portable baseline. ADR-0010 defines the boundary from provider-native transcripts and compaction.
ADR-0012 requires staged behavioral evidence before a journal, launcher, or semantic compactor enters
the supported runtime or broadens continuity claims. Research protocols and results live outside the
npm package.

## Known architectural gaps

- Authenticated tool launch is not a required CI gate; Cursor CLI is not installed in the current
  local conformance environment.
- Sequential rename commit still cannot provide a portable cross-file transaction, and standard
  Node.js cannot eliminate the final directory check-to-path-syscall interval.
- Character budgets are deterministic but only approximate model tokens.
- Semantic code-to-document freshness cannot be proven by the current validator.
- Cross-harness behavioral and perceived continuity have not been demonstrated beyond one Claude
  reconstruction; artifact discovery and receipts are weaker evidence.
- Repository-root discovery does not yet account for multiple nested context roots beyond choosing
  the nearest ancestor.
