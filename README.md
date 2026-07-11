# Carrylog

One Git-reviewable project checkpoint for Codex, Claude Code, Cursor, and Gemini CLI.

Carrylog lets the repository—not one model session—own the current objective, decisions, risks,
verification, and next action. Initialize once, work with any supported agent, checkpoint the result,
and give the next agent one verified project-state envelope instead of another independently
maintained memory file.

```text
Before: switch agent -> find and rewrite project state in another tool-specific file
After:  switch agent -> carrylog resume -> inspect one objective, evidence set, risk list, and next action
```

Carrylog resumes project state, not a provider's private chat or hidden model state.

> **Status:** `carrylog@0.1.0-beta.4` is published on npm's `beta` channel. This repository is
> preparing the unreleased `0.1.0-beta.5` candidate, which adds the universal adapters,
> checkpoint/resume, migration, and continuity Skills documented below. The current implementation
> and known limits are tracked in [Current state](.agent-context/current-state.md) and
> [ADR-0010](docs/decisions/0010-portable-checkpoint-and-resume-boundary.md).

## See the handoff

```console
$ carrylog resume
Project: Example project
Objective: Replace the mock profile endpoint without changing the reviewed schema.
Next action: Implement the endpoint and run the package contract tests.
Checkpoint: ready
```

The machine-readable form also includes checkpoint sections, content digests, a progressive context
catalog, and bounded Git evidence:

```bash
carrylog resume --check --json
```

Abbreviated output from the current contract:

```json
{
  "formatVersion": 1,
  "project": {
    "name": "Example project",
    "configVersion": 2,
    "configPath": ".agent-context/config.yaml",
    "configSha256": "..."
  },
  "checkpoint": {
    "document": ".agent-context/handoff.md",
    "sha256": "...",
    "stale": false,
    "sections": {
      "Objective": "Replace the mock profile endpoint.",
      "Next action": "Implement the endpoint and run contract tests."
    }
  },
  "git": {
    "branch": "main",
    "staged": 0,
    "unstaged": 0,
    "untracked": 0
  },
  "alwaysContext": [
    {
      "id": "project",
      "path": ".agent-context/project.md",
      "description": "Stable project brief",
      "sha256": "...",
      "content": "# Project brief\n..."
    }
  ],
  "onDemandCatalog": [
    {
      "id": "architecture",
      "path": ".agent-context/architecture.md",
      "description": "System boundaries",
      "sha256": "...",
      "triggers": ["architecture changes"]
    }
  ],
  "diagnostics": []
}
```

The real envelope includes all six required checkpoint sections and the configured context catalog;
digests are omitted above only to keep the example readable.

## How it works

```text
.agent-context/ (canonical, human-reviewable memory)
                         |
                         v
              deterministic compiler
                         |
              +----------+----------+----------+
              |          |          |          |
           AGENTS.md  CLAUDE.md  GEMINI.md   Skills
              |          |          |          |
        Codex/Cursor  Claude Code  Gemini CLI  continuity
```

The adapters are small routers. Stable purpose, architecture, current state, decisions, and handoff
remain reviewable Markdown sources in `.agent-context/`. Generated blocks preserve surrounding human
instructions and fail closed on ownership conflicts.

## Install the published beta

Node.js 22 or newer and a Git worktree are required.

For one-off evaluation of the published beta.4 context layer:

```bash
npx --yes carrylog@0.1.0-beta.4 init
npx --yes carrylog@0.1.0-beta.4 validate
```

For a persistent global CLI:

```bash
npm install --global carrylog@beta
carrylog init
carrylog validate
```

For a team-pinned development dependency:

```bash
npm install --save-dev --save-exact carrylog@0.1.0-beta.4
npx --no-install carrylog init
npx --no-install carrylog validate
```

Beta.4 provides the reviewed context compiler and Codex/Claude adapter path. The universal
Codex/Claude/Cursor/Gemini surfaces and portable `checkpoint`/`resume` workflow are beta.5 candidate
features and must be evaluated from source until that version passes its own review and release
gates.

## Try the beta.5 candidate from source

Node.js 22 or newer and a Git worktree are required.

```bash
git clone https://github.com/Jaemani/Carrylog.git
cd Carrylog
npm ci
npm run build

# Run against another repository without a global installation.
node /path/to/Carrylog/dist/cli.js init --root /path/to/your-project
node /path/to/Carrylog/dist/cli.js validate --root /path/to/your-project
```

After an agent finishes meaningful work:

```bash
node /path/to/Carrylog/dist/cli.js checkpoint --root /path/to/your-project
```

Then inspect the same verified state before continuing with another harness:

```bash
node /path/to/Carrylog/dist/cli.js resume --check --json --root /path/to/your-project
```

`init` creates the canonical context, Codex/Cursor `AGENTS.md`, Claude `CLAUDE.md`, Gemini
`GEMINI.md`, and continuity Skills. Carrylog does not contact a model, upload context, stage, commit,
or push.

Do not mix one-off initialization with a later bare `carrylog` command. Bare commands require a
global installation or a package script that exposes local `.bin`; use `npx --no-install carrylog`
for a project dependency. One-off initialization does not leave an executable for later automated
resume. Generated Skills never download or upgrade Carrylog implicitly.

### Migrating from `@jaemani/agent-context-kit@0.1.0-beta.3`

Carrylog preserves the configuration v1 root, schema, and managed markers published by
`@jaemani/agent-context-kit@0.1.0-beta.3`. Existing
repositories do not move or duplicate `.agent-context/`; only generated adapter prose and commands
change after synchronization. `carrylog sync` also recognizes that package's complete untouched
instructions template at any configured document path and changes only its executable name, including
its CRLF form. If customized always-loaded context still contains a command-shaped `ackit` invocation,
Carrylog reports `E_LEGACY_CLI_INSTRUCTION` and requires review instead of rewriting it speculatively.
Historical prose that only names the old command is not treated as an invocation.

For a global installation:

```bash
npm uninstall --global @jaemani/agent-context-kit
npm install --global carrylog@beta
carrylog sync
carrylog validate
```

For a project dependency:

```bash
npm uninstall @jaemani/agent-context-kit
npm install --save-dev --save-exact carrylog@0.1.0-beta.5
npx --no-install carrylog sync
npx --no-install carrylog validate
```

Also update package scripts, CI commands, and JavaScript/TypeScript import specifiers that name the old
package or executable. Carrylog intentionally does not install the old `ackit` binary or the
Windows-conflicting `cl` alias.

## Commands

### `carrylog init`

Creates configuration v2, canonical context documents, the matching copied schema, managed
Codex/Cursor, Claude Code, and Gemini CLI routers, and continuity Skills by default.

```bash
carrylog init --name "Example project"
carrylog init --adapters codex,claude,cursor,gemini
carrylog init --dry-run
carrylog init --adopt
```

If an adapter file already exists, initialization stops before writing. Review the proposed change
and use `--adopt` to append a managed block while preserving human content.

### `carrylog sync`

Applies recognized exact-template context migrations, recompiles adapter blocks, and repairs a missing
or drifted copied schema.

```bash
carrylog sync
carrylog sync --check       # no writes; exit 1 if a generated artifact would change
carrylog sync --dry-run     # show the plan without writing
carrylog sync --adopt       # explicitly adopt reviewed unmarked adapter files
```

All changed outputs are preflighted and staged before rename. Parent directory and temporary-file
identity, physical containment, and expected content are rechecked during commit. Individual
replacements are atomic on supported local filesystems, and stale plans are rejected if a file or
loaded configuration changed after inspection. Sequential multi-file rename is not claimed to be an
OS-level transaction; portable path-based syscalls still have the residual race documented in the
threat model and ADR-0007.

### `carrylog migrate`

Configuration v1 stays valid and is never rewritten implicitly. Review and opt into v2 explicitly:

```bash
carrylog migrate --to 2 --universal --dry-run
carrylog migrate --to 2 --universal
carrylog validate
```

`--universal` ensures the shared Codex/Cursor surface, Claude Code, Gemini CLI, and generated
continuity Skills. Customized v1 handoff prose must already contain the required checkpoint sections;
Carrylog does not guess their meaning. Unowned Skill files are never adopted or merged.

### `carrylog validate`

Checks configuration, schema/directive state, managed path ownership, document and adapter budgets,
portable/symlink-safe paths, handoff marker integrity, and generated drift.

```bash
carrylog validate
carrylog validate --json
```

`sync`, `validate`, `handoff`, `checkpoint`, `migrate`, and `resume` discover the nearest
`.agent-context/config.yaml` while walking upward, so they work from a nested directory. `init`
always uses its explicit/current root.

### `carrylog checkpoint` and `carrylog handoff`

Preserves handoff narrative while refreshing one managed block of deterministic repository evidence.

```bash
carrylog handoff
carrylog handoff --check    # exit 1 when evidence would change
carrylog handoff --dry-run
carrylog handoff --json
carrylog checkpoint --check
```

Evidence includes branch/HEAD, upstream divergence, staged and unstaged line stats, aggregate status,
up to 200 project-relative changed paths, and five recent scoped commits. The command does not call a
model, contact a remote, stage, commit, or push.

Two complete evidence observations must match. Repository changes during collection trigger up to
three bounded attempts and then `E_GIT_CONCURRENT_MODIFICATION`, rather than a mixed-time snapshot.

The project must be inside a Git worktree. Configuration v2 selects an always-loaded checkpoint
document; v1 retains the `handoff` ID convention. `checkpoint` is the continuity-oriented alias and
`handoff` remains compatible.

### `carrylog resume`

```bash
carrylog resume
carrylog resume --json
carrylog resume --check --json
```

`resume --json` emits a deterministic portable envelope containing reviewed checkpoint sections,
always-loaded context, an on-demand catalog, raw-byte SHA-256 digests, and fresh bounded Git evidence.
It excludes raw transcripts, hidden reasoning, absolute roots, provider session identifiers, and
commit timestamps. `--check` exits 1 when checkpoint Git evidence is stale.

Resume output is not a declassification boundary. It contains the checkpoint narrative and full
always-loaded context, retains the repository's confidentiality classification, and does not redact
secrets already present in those documents. Do not log, paste, or share human or JSON resume output
without applying the same review and access controls as the repository itself.

## Canonical layout

```text
.agent-context/
  config.yaml               # canonical v2 catalog, surfaces, continuity, and budgets
  config.schema.json        # generated copy of the packaged public schema
  instructions.md           # memory operating and update protocol
  project.md                # stable purpose, users, scope, and non-goals
  current-state.md          # verified implementation state and next task
  handoff.md                # narrative plus managed Git evidence
  architecture.md           # on-demand system map
  decisions.md              # on-demand decision index
  conventions.md            # on-demand engineering workflow
AGENTS.md                    # human content plus Codex/Cursor managed router
CLAUDE.md                    # human content plus Claude managed router
GEMINI.md                    # human content plus Gemini CLI managed router
.agents/skills/carrylog-continuity/SKILL.md
.claude/skills/carrylog-continuity/SKILL.md
```

See the [configuration reference](docs/configuration.md) for the v1/v2 contracts and
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
- **Portable, not private-session replay:** checkpoint/resume reconstructs reviewed project state;
  provider-native transcripts and compaction remain outside Carrylog's boundary.

The beta intentionally does not claim semantic code-to-document freshness, exact tokenizer counts,
cross-filesystem transactions, or support for agents whose discovery behavior has not been researched.
See the [threat model](docs/threat-model.md) for residual risks.

## Supported adapters

| Adapter | Default output | Beta scope |
| --- | --- | --- |
| Codex | `AGENTS.md` (`agents` surface) | Root router and generic workspace Skill |
| Cursor | `AGENTS.md` (`agents` surface) | Shared root router; CLI launch not yet locally verified |
| Claude Code | `CLAUDE.md` | Root router and `.claude/skills` adapter |
| Gemini CLI | `GEMINI.md` | Root router; discovers the generic `.agents/skills` Skill |

Copilot, nested generation, and MCP are later work. New surfaces require documented discovery and
precedence evidence; custom output paths remain user-owned conformance choices.

## Programmatic package

The package exports ESM JavaScript and TypeScript declarations. Public functions include config
decoding/loading, init/sync/validate/handoff/migrate/resume commands, adapter rendering/registry
access, Git evidence,
managed-block helpers, and `readPublicSchema()`.

During beta, documented CLI exit categories, configuration v1, and non-destructive ownership rules are
compatibility commitments. The broader TypeScript API may still change between prereleases and will
follow package SemVer after stable. Expected command/library failures are `CarrylogError` instances
with `code`, `exitCode`, and `diagnostics`; deprecated `AckitError` is the same constructor for
`@jaemani/agent-context-kit@0.1.0-beta.3` source compatibility. Exit/config constants are exported
from the package root.

```ts
import { decodeConfig, readPublicSchema } from "carrylog";

const schema = readPublicSchema();
const schemaV2 = readPublicSchema(2);
const result = decodeConfig(candidate);
```

The no-argument schema reader remains v1 for API compatibility; pass `2` explicitly for the v2
schema.

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
- [Documentation policy](docs/documentation-policy.md)
- [Roadmap](ROADMAP.md)
- [Decision records](docs/decisions/README.md)
- [Engineering log](docs/engineering-log.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

Carrylog is available under the [MIT License](LICENSE).
