# Configuration reference

`.agent-context/config.yaml` is canonical, reviewed project data. The copied
`.agent-context/config.schema.json` is generated editor support and is repaired by `carrylog sync`.

## Version contract

Configuration versions `1` and `2` are supported. Configuration version and npm package version are
separate; unknown versions and cross-version adapter names fail before any write.

Version 1 is the frozen published compatibility contract. Version 2 adds universal agent surfaces and
continuity policy. New initialization creates v2, while existing v1 repositories remain valid and are
never rewritten implicitly. See [ADR-0005](decisions/0005-configuration-v1-compatibility.md) and
[ADR-0009](decisions/0009-configuration-v2-and-universal-surfaces.md).

Every runtime-decoder-accepted configuration also passes its versioned public JSON Schema. JSON
Schema validation alone is insufficient: runtime checks additionally enforce normalized ownership,
checkpoint references, portable paths, symlink rejection, actual content budgets, and filesystem
state.

The recommended first line enables YAML editor validation:

```yaml
# yaml-language-server: $schema=./config.schema.json
```

An older v1 file without this comment remains valid at runtime. `validate` emits
`W_CONFIG_SCHEMA_HEADER`; add the comment manually after review. `sync` does not rewrite canonical
YAML.

## Fields

### `version`

Required integer. Must be `1` or `2`.

### `project.name`

Required single-line string, 1–120 Unicode characters. Leading/trailing whitespace and reserved
managed-marker text are rejected.

### `documents`

Required array with 1–256 entries and at least one `load: always` entry.

| Field | Contract |
| --- | --- |
| `id` | Unique lowercase identifier matching `[a-z][a-z0-9-]*`, at most 64 characters |
| `path` | Unique path relative to `.agent-context/`, at most 1024 Unicode characters |
| `load` | `always` or `on-demand` |
| `description` | Single-line router description, at most 240 characters |
| `triggers` | Optional non-empty list of at most 32 single-line strings, each at most 120 characters |

Document path uniqueness uses conservative Unicode compatibility and multi-step case normalization
for cross-platform safety. This can intentionally reject names that coexist on one filesystem when
another supported filesystem may alias them.

Version 1 uses document ID `handoff` for `carrylog handoff`. Version 2 uses
`continuity.checkpointDocument`, whose target must exist and use `load: always`.

The complete instructions template published in `@jaemani/agent-context-kit@0.1.0-beta.3` defines
the old-package-to-Carrylog migration boundary independently of a mutable document ID or path.
Carrylog can replace that exact template while
preserving LF or CRLF line endings. Customized always-loaded context with a command-shaped invocation
of the removed `ackit` executable is invalid until a maintainer reviews and changes the command;
historical prose and other human content are not inferred from a template.

### `adapters`

Required array with 1–32 entries.

| Field | Contract |
| --- | --- |
| `type` | v1: `codex` or `claude`; v2: `agents`, `claude`, or `gemini` |
| `output` | Unique project-relative instruction-file path |

The v2 `agents` surface is shared by Codex and Cursor and defaults to `AGENTS.md`; this avoids two
logical harnesses competing for one output. `claude` defaults to `CLAUDE.md`, and `gemini` defaults to
`GEMINI.md`.

### `continuity` (v2 only)

| Field | Contract |
| --- | --- |
| `checkpointDocument` | ID of one configured `load: always` document |
| `generateSkills` | Generate and validate the shared `.agents` Skill and Claude adapter Skill |

When Skill generation is disabled, existing Carrylog-marked Skills are not deleted automatically;
`validate` warns so their removal remains an explicit reviewed action.

The generated continuity Skill resolves executables offline in a fixed order: a compatible Carrylog
source build, the nearest compatible project-pinned package, then a compatible global installation.
Each selected candidate must support `resume`; an incompatible pinned candidate stops with explicit
guidance instead of falling through or downloading another version.

Every config, document, copied schema, and adapter output has exclusive path ownership. Exact,
case-folded, or Unicode-normalized collisions fail before planning writes.

### `policies`

- `maxAlwaysCharacters`: total JavaScript character units allowed across `always` documents;
- `maxAdapterCharacters`: maximum generated managed block per adapter.

Both are required integers from 1,000 through 100,000. These deterministic budgets are not claims
about a particular model tokenizer. Independently of those configurable rendering budgets, portable
resume observes at most 8 MiB across the configuration and all canonical documents in one pass. This
fixed aggregate read limit prevents a large on-demand catalog from multiplying per-file limits into
unbounded retained memory.

## Portable path rules

Paths use `/`, remain relative and normalized, and cannot contain `.`/`..` segments, empty segments,
NUL/control characters, Windows-reserved names/characters, trailing dots/spaces, or reserved marker
text. Existing symlink components are rejected. A valid-looking schema path can still fail runtime
ownership or filesystem checks.

## Explicit v1 migration

```bash
carrylog migrate --to 2 --universal --dry-run
carrylog migrate --to 2 --universal
carrylog validate
```

Without `--universal`, migration preserves the selected v1 surfaces and leaves Skill generation
disabled. With it, Carrylog ensures `agents`, `claude`, and `gemini` surfaces and enables Skills. A
stock v1 handoff can be converted automatically; customized prose must already satisfy the checkpoint
section contract or migration stops with `E_CHECKPOINT_REVIEW_REQUIRED`.

Migration preserves YAML comments and LF/CRLF style, preflights all outputs, and writes config last.
`--check` exits 1 when migration work remains; `--dry-run` prints the plan without writing.

`sync`, `validate`, `handoff`, `checkpoint`, `migrate`, and `resume` discover the nearest
`.agent-context/config.yaml` while walking upward from the explicit or current root. They can
therefore run from a nested project directory. `init` treats its explicit or current root as the new
project root and does not perform upward discovery.

## Version 2 example

```yaml
# yaml-language-server: $schema=./config.schema.json
version: 2
project:
  name: Example service
documents:
  - id: handoff
    path: handoff.md
    load: always
    description: Verified portable checkpoint and next action
  - id: architecture
    path: architecture.md
    load: on-demand
    description: System boundaries and module responsibilities
    triggers:
      - architecture changes
adapters:
  - type: agents
    output: AGENTS.md
  - type: claude
    output: CLAUDE.md
  - type: gemini
    output: GEMINI.md
continuity:
  checkpointDocument: handoff
  generateSkills: true
policies:
  maxAlwaysCharacters: 16000
  maxAdapterCharacters: 12000
```
