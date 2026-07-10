# Agent Context Kit

One repo-native project memory layer for AI coding agents.

Agent Context Kit keeps durable project intent, current state, decisions, and handoff narrative in one
canonical directory. It compiles small instruction-file adapters for Codex and Claude Code and adds
bounded Git evidence without copying the full memory into every tool file.

> Status: `0.1.0-beta.1` release candidate. The package is configured as
> `@jaemani/agent-context-kit` with the npm `beta` dist-tag and MIT license. Registry publication is
> pending the protected first-publication workflow.

## Why this exists

AI coding tools use different instruction files and session memory. Maintaining complete project
explanations in each one creates drift, wastes context, and loses continuity when tools change.

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

The adapters are routers. Stable purpose, architecture, current state, decisions, and the handoff
remain reviewable Markdown sources in the repository.

## Installation

Node.js 22 or newer is required. Once the beta is published, choose one installation model.

One-off use without a persistent global command:

```bash
npx --yes @jaemani/agent-context-kit@beta init
npx --yes @jaemani/agent-context-kit@beta validate
```

Persistent global CLI:

```bash
npm install --global @jaemani/agent-context-kit@beta
ackit init
ackit validate
```

Team-pinned development dependency:

```bash
npm install --save-dev --save-exact @jaemani/agent-context-kit@0.1.0-beta.1
npx --no-install ackit init
npx --no-install ackit validate
```

Do not mix the one-off example with a later bare `ackit` command unless the package is also installed
globally or locally. The package is not currently on the registry; use the source workflow below
until the first protected release completes.

```bash
git clone https://github.com/Jaemani/Agent-Context-Kit.git
cd Agent-Context-Kit
npm ci
npm run build
node dist/cli.js init --root /path/to/your-project
```

## Commands

### `ackit init`

Creates the canonical context directory, copied v1 schema, starter documents, and managed Codex and
Claude adapter blocks.

```bash
ackit init --name "Example project"
ackit init --adapters codex
ackit init --dry-run
ackit init --adopt
```

If an adapter file already exists, initialization stops before writing. Review the proposed change
and use `--adopt` to append a managed block while preserving human content.

### `ackit sync`

Recompiles adapter blocks and repairs a missing or drifted copied schema.

```bash
ackit sync
ackit sync --check       # no writes; exit 1 if a generated artifact would change
ackit sync --dry-run     # show the plan without writing
ackit sync --adopt       # explicitly adopt reviewed unmarked adapter files
```

All changed outputs are preflighted and staged before rename. Parent directory and temporary-file
identity, physical containment, and expected content are rechecked during commit. Individual
replacements are atomic on supported local filesystems, and stale plans are rejected if a file or
loaded configuration changed after inspection. Sequential multi-file rename is not claimed to be an
OS-level transaction; portable path-based syscalls still have the residual race documented in the
threat model and ADR-0007.

### `ackit validate`

Checks configuration, schema/directive state, managed path ownership, document and adapter budgets,
portable/symlink-safe paths, handoff marker integrity, and generated drift.

```bash
ackit validate
ackit validate --json
```

`sync`, `validate`, and `handoff` discover the nearest `.agent-context/config.yaml` while walking
upward, so they work from a nested directory. `init` always uses its explicit/current root.

### `ackit handoff`

Preserves handoff narrative while refreshing one managed block of deterministic repository evidence.

```bash
ackit handoff
ackit handoff --check    # exit 1 when evidence would change
ackit handoff --dry-run
ackit handoff --json
```

Evidence includes branch/HEAD, upstream divergence, staged and unstaged line stats, aggregate status,
up to 200 project-relative changed paths, and five recent scoped commits. The command does not call a
model, contact a remote, stage, commit, or push.

Two complete evidence observations must match. Repository changes during collection trigger up to
three bounded attempts and then `E_GIT_CONCURRENT_MODIFICATION`, rather than a mixed-time snapshot.

The project must be inside a Git worktree and its config must contain exactly one document whose ID is
`handoff`; the path for that document is configurable.

## Canonical layout

```text
.agent-context/
  config.yaml               # canonical v1 catalog, adapters, and budgets
  config.schema.json        # generated copy of the packaged public schema
  instructions.md           # memory operating and update protocol
  project.md                # stable purpose, users, scope, and non-goals
  current-state.md          # verified implementation state and next task
  handoff.md                # narrative plus managed Git evidence
  architecture.md           # on-demand system map
  decisions.md              # on-demand decision index
  conventions.md            # on-demand engineering workflow
AGENTS.md                    # human content plus Codex managed router
CLAUDE.md                    # human content plus Claude managed router
```

See the [configuration reference](docs/configuration.md) for the full v1 contract and
[adapter compatibility](docs/adapter-compatibility.md) for exact supported discovery behavior.

## Design and safety commitments

- **Local-first:** normal runtime makes no network or model calls.
- **Progressive disclosure:** routers instruct agents to read selected documents first and defer
  task-specific references until needed.
- **Non-destructive adoption:** existing unmarked instruction files require explicit review/adoption.
- **Deterministic output:** rendered bodies are deterministic for the same validated config and
  inspected Git state; managed-file newlines and surrounding human content are preserved inputs.
- **Exclusive ownership:** config, schema, documents, and adapters cannot share normalized paths.
- **Fail closed:** malformed config/markers, path escape, symlinks, drift, and budget violations fail.
- **Bounded Git:** sanitized environment, disabled fsmonitor, no shell, deadline, output ceiling,
  stable repeated observations, and lossless safely escaped unusual-filename representation.
- **No telemetry:** repository context is not uploaded by the core CLI.

The beta intentionally does not claim semantic code-to-document freshness, exact tokenizer counts,
cross-filesystem transactions, or support for agents whose discovery behavior has not been researched.
See the [threat model](docs/threat-model.md) for residual risks.

## Supported adapters

| Adapter | Default output | Beta scope |
| --- | --- | --- |
| Codex | `AGENTS.md` | Default root router; no automatic override/nested hierarchy |
| Claude Code | `CLAUDE.md` | Default root router; no automatic rules/import/local hierarchy |

Cursor, Copilot, Gemini CLI, nested instructions, skills, and MCP are later work. New adapters require
official discovery/precedence evidence and reviewed golden fixtures.

## Programmatic package

The package exports ESM JavaScript and TypeScript declarations. Public functions include config
decoding/loading, init/sync/validate/handoff commands, adapter rendering/registry access, Git evidence,
managed-block helpers, and `readPublicSchema()`.

During beta, documented CLI exit categories, configuration v1, and non-destructive ownership rules are
compatibility commitments. The broader TypeScript API may still change between prereleases and will
follow package SemVer after stable. Expected command/library failures are `AckitError` instances with
`code`, `exitCode`, and `diagnostics`; exit/config constants are exported from the package root.

```ts
import { decodeConfig, readPublicSchema } from "@jaemani/agent-context-kit";

const schema = readPublicSchema();
const result = decodeConfig(candidate);
```

## Development and release checks

```bash
npm ci
npm run quality
npm run pack:check
npm run test:package
node dist/cli.js sync --check
node dist/cli.js validate --json
```

The suite covers allowed/rejected/repeated/failure states, three adoption shapes, randomized parser
corpora, maximum catalogs, near-limit Git status, worktrees, monorepos, upstream divergence,
concurrency, package installation modes, ESM, and declarations. CI targets Node 22/24 on Linux,
macOS, and Windows.

`npm run release:verify` additionally requires a clean licensed release commit, creates one tarball,
records its SHA-256, and smoke-tests that exact artifact before publication.

## Project documents

- [Product scope](docs/product-scope.md)
- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Adapter compatibility](docs/adapter-compatibility.md)
- [Threat model](docs/threat-model.md)
- [Testing strategy](docs/testing-strategy.md)
- [Roadmap](ROADMAP.md)
- [Decision records](docs/decisions/README.md)
- [Engineering log](docs/engineering-log.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

Agent Context Kit is available under the [MIT License](LICENSE).
