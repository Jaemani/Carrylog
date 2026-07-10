# Configuration reference

`.agent-context/config.yaml` is canonical, reviewed project data. The copied
`.agent-context/config.schema.json` is generated editor support and is repaired by `ackit sync`.

## Version contract

The only supported configuration version in the `0.1.0` beta line is `1`. Configuration version and npm
package version are separate. Unknown versions fail before any write.

Every runtime-decoder-accepted v1 input also passes the public JSON Schema. JSON Schema validation
alone is insufficient: runtime checks additionally enforce normalized ownership, portable paths,
symlink rejection, actual content budgets, and filesystem state. See
[ADR-0005](decisions/0005-configuration-v1-compatibility.md) for compatibility and future migration
rules.

The recommended first line enables YAML editor validation:

```yaml
# yaml-language-server: $schema=./config.schema.json
```

An older v1 file without this comment remains valid at runtime. `validate` emits
`W_CONFIG_SCHEMA_HEADER`; add the comment manually after review. `sync` does not rewrite canonical
YAML.

## Fields

### `version`

Required integer. Must be `1`.

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

The ID `handoff` is optional for init/sync/validate but required by `ackit handoff`. When present, its
document owns the narrative and managed repository-evidence block.

### `adapters`

Required array with 1–32 entries.

| Field | Contract |
| --- | --- |
| `type` | Currently `codex` or `claude` |
| `output` | Unique project-relative instruction-file path |

Every config, document, copied schema, and adapter output has exclusive path ownership. Exact,
case-folded, or Unicode-normalized collisions fail before planning writes.

### `policies`

- `maxAlwaysCharacters`: total JavaScript character units allowed across `always` documents;
- `maxAdapterCharacters`: maximum generated managed block per adapter.

Both are required integers from 1,000 through 100,000. These deterministic budgets are not claims
about a particular model tokenizer.

## Portable path rules

Paths use `/`, remain relative and normalized, and cannot contain `.`/`..` segments, empty segments,
NUL/control characters, Windows-reserved names/characters, trailing dots/spaces, or reserved marker
text. Existing symlink components are rejected. A valid-looking schema path can still fail runtime
ownership or filesystem checks.

## Example

```yaml
# yaml-language-server: $schema=./config.schema.json
version: 1
project:
  name: Example service
documents:
  - id: current-state
    path: current-state.md
    load: always
    description: Current implementation state and next work
  - id: architecture
    path: architecture.md
    load: on-demand
    description: System boundaries and module responsibilities
    triggers:
      - architecture changes
adapters:
  - type: codex
    output: AGENTS.md
  - type: claude
    output: CLAUDE.md
policies:
  maxAlwaysCharacters: 16000
  maxAdapterCharacters: 12000
```
