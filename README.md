# Agent Context Kit

One repo-native project memory layer for AI coding agents.

Agent Context Kit keeps durable project intent, current state, and handoff information in one
canonical directory, then compiles small tool-specific routers for Codex, Claude Code, and future
adapters. Switching agents should not require rewriting the same project explanation.

> Status: `0.1.0-alpha.0`. The safety-oriented `init`, `sync`, and `validate` foundation works, but
> the configuration schema and adapter set are not yet stable enough for a production beta.

## Why this exists

AI coding tools have separate instruction files and memory behavior. Copying project context into
each file creates three recurring failures:

- the copies drift;
- long always-loaded files waste context and can reduce task quality;
- session state disappears or becomes an unverified narrative.

Agent Context Kit treats those tool files as adapters, not sources of truth:

```text
.agent-context/ (canonical, human-reviewable memory)
                         |
                         v
              deterministic compiler
                         |
              +----------+----------+
              |                     |
           AGENTS.md             CLAUDE.md
              |                     |
            Codex              Claude Code
```

## Design commitments

- **Local-first:** normal operation reads and writes only inside the repository.
- **Progressive disclosure:** a small set of documents loads at startup; task-specific references
  remain on demand.
- **Non-destructive adoption:** existing agent files are never overwritten silently.
- **Deterministic output:** the same config produces the same managed adapter block.
- **Reviewable state:** Markdown remains the durable format; generated content is visibly marked.
- **Fail closed:** malformed config, path escape, symlink traversal, drift, and context budget
  violations produce actionable failures.
- **No hidden model dependency:** the core compiler does not need an API key or LLM.

The project deliberately does not try to become a full software-development methodology, an agent
orchestrator, or a replacement for issue trackers and architecture records.

## What works now

| Capability | Alpha status |
| --- | --- |
| Canonical `.agent-context/` structure | Implemented |
| Codex `AGENTS.md` adapter | Implemented |
| Claude Code `CLAUDE.md` adapter | Implemented |
| Safe adoption of existing adapter files | Implemented with explicit `--adopt` |
| Config and path validation | Implemented |
| Always-loaded context budget | Implemented as a deterministic character budget |
| Adapter drift detection for CI | Implemented with `sync --check` and `validate` |
| Cursor, Copilot, Gemini CLI adapters | Planned after adapter conformance research |
| Git-aware handoff snapshot | Planned |
| Compaction, skills, and MCP | Planned after the file and schema contracts stabilize |

## Try it from source

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/Jaemani/Agent-Context-Kit.git
cd Agent-Context-Kit
npm ci
npm run build
node dist/cli.js init --root /path/to/your-project
```

After the first npm release, the intended interface is:

```bash
npx @jaemani/agent-context-kit init
ackit validate
```

The package is not published yet; the `npx` example documents the intended distribution contract,
not current availability.

## Commands

### `ackit init`

Creates the canonical directory, starter documents, and managed Codex/Claude adapter blocks.

```bash
ackit init --name "Example project"
ackit init --adapters codex
ackit init --dry-run
```

If `AGENTS.md` or `CLAUDE.md` already exists, initialization stops before writing anything. Review
the proposed behavior and rerun with `--adopt` to append a managed block while retaining the human
content.

### `ackit sync`

Recompiles managed blocks after the config changes.

```bash
ackit sync
ackit sync --check       # no writes; exit 1 if output would change
ackit sync --dry-run     # show the plan without writing
ackit sync --adopt       # explicitly adopt existing unmanaged adapter files
```

All adapters are preflighted before any adapter is written. Individual file replacement is atomic.
Cross-file replacement is not claimed to be transactional if the operating system fails during the
write phase.

### `ackit validate`

Checks configuration shape, document presence, path portability, symlink traversal, context budget,
managed marker integrity, and adapter drift.

```bash
ackit validate
ackit validate --json
```

Commands discover `.agent-context/config.yaml` by walking upward, so validation and sync can run
from a nested directory.

## Canonical layout

```text
.agent-context/
  config.yaml       # schema version, document catalog, adapters, budgets
  instructions.md   # memory operating and update protocol
  project.md        # stable purpose, users, scope, and non-goals
  current-state.md  # verified implementation state and next task
  handoff.md        # latest session continuation contract
  architecture.md   # on-demand system map
  decisions.md      # on-demand decision index
  conventions.md    # on-demand engineering workflow
AGENTS.md            # human content plus a managed router block
CLAUDE.md            # human content plus a managed router block
```

`config.yaml` controls load behavior:

```yaml
version: 1
project:
  name: Example
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

Paths use forward slashes and must remain portable across Windows, macOS, and Linux. Outputs may
not overlap canonical sources.

## Safety behavior

Agent Context Kit assumes repository files may be malformed or adversarial. It therefore:

- rejects absolute, traversing, non-normalized, and platform-reserved paths;
- treats case-folded and Unicode-normalized path collisions as duplicates;
- rejects symbolic links along managed read/write paths;
- limits YAML alias expansion and fails on duplicate keys;
- bounds config, text-file, catalog, and generated-router sizes and requires valid UTF-8;
- performs complete adapter preflight before mutation;
- preserves content outside exactly one managed marker pair;
- keeps CI and automation output machine-readable with `--json`.

See [the threat model](docs/threat-model.md) for boundaries and residual risk.

## Development

```bash
npm ci
npm run format:check
npm run check
npm test
npm run test:coverage
npm run quality
npm run pack:check
```

The coverage gate is 90% lines, 90% functions, and 85% branches. More importantly, the suite spans
safe adoption, drift, preflight failure, path portability, symlinks, CRLF, Unicode, nested project
discovery, CLI status codes, and file-mode preservation. See
[the testing strategy](docs/testing-strategy.md).

## Project documents

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Threat model](docs/threat-model.md)
- [Testing strategy](docs/testing-strategy.md)
- [Roadmap](ROADMAP.md)
- [Decision records](docs/decisions/README.md)
- [Engineering log](docs/engineering-log.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

No open-source license has been selected yet. Until the owner makes that explicit legal decision,
the repository is source-available for evaluation but does not grant reuse rights.
