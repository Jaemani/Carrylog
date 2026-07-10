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
application commands: init / sync / validate
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

Exit codes are part of the automation contract:

- `0`: command completed and no blocking issue exists;
- `1`: drift, invalid project state, or another recoverable project issue;
- `2`: invocation or unsupported option;
- `3`: unexpected internal failure.

### Application commands

- `init` constructs a complete write plan, detects canonical and adapter conflicts, and writes only
  after preflight succeeds.
- `sync` validates canonical inputs, plans every adapter, and then atomically replaces changed files
  one by one.
- `validate` combines canonical context checks with generated adapter inspection and never writes.

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

Published schema changes will require an explicit migration command before beta. Silent reinterpretation
of old config is not acceptable.

### Adapter compiler

Adapters render a concise router from the document catalog; they do not copy the complete documents.
Codex and Claude currently share semantic content but have separate adapter identities, allowing
future tool-specific behavior without changing the source model.

Generated content lives between one start and one end marker. Synchronization replaces only that
region. A pre-existing unmarked file requires `--adopt`; malformed or duplicate markers fail closed.

### Filesystem safety boundary

All configured paths:

1. must be normalized, relative, and use `/` separators;
2. reject Windows-reserved names and characters even on Unix;
3. are compared after Unicode NFC normalization and case folding;
4. resolve lexically inside the project root;
5. reject any existing symbolic-link component.

Project roots are canonicalized through the operating system before discovery or initialization.
Config, document, and existing adapter reads are bounded and require valid UTF-8. Catalog counts and
rendered adapter size are also bounded so progressive disclosure cannot be bypassed by an oversized
router.

Writes use a uniquely named sibling temporary file and rename it into place, preserving existing
permissions. This makes each file replacement atomic on supported local filesystems. The system
preflights all adapter writes, but it does not claim a distributed transaction across files or
network filesystems.

## Dependency direction

```text
cli -> commands -> config/domain, adapters, validation, core
validation -> adapters, core, domain
adapters -> domain, core errors
config -> domain, core paths/errors
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

A planned command will collect deterministic Git evidence—branch, status, changed paths, diff stat,
and recent commits—into a separate managed snapshot inside `handoff.md`. Semantic narrative remains
human/agent-authored and reviewable. Git commands will use argument arrays rather than a shell.

### Skills and MCP

Skills can teach compatible agents how to maintain the context protocol. An MCP server can later
offer query-oriented access to context, decisions, and Git evidence. Neither should become the only
way to access project state; Markdown and CLI behavior remain the portable baseline.

## Known architectural gaps

- No public JSON Schema or configuration migration mechanism yet.
- No adapter conformance fixtures based on tool-version behavior yet.
- No failure-injection abstraction for mid-write operating-system errors.
- Character budgets are deterministic but only approximate model tokens.
- Semantic code-to-document freshness cannot be proven by the current validator.
- Repository-root discovery does not yet account for multiple nested context roots beyond choosing
  the nearest ancestor.
