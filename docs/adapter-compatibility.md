# Adapter compatibility

Adapter support is based on documented instruction discovery, not filename guesses. Sources were
rechecked on 2026-07-11. Carrylog models instruction *surfaces*, not one output per harness: Codex and
Cursor share `AGENTS.md` ownership.

| Adapter | Default output | Supported beta contract | Official behavior source |
| --- | --- | --- | --- |
| Codex | `AGENTS.md` | Root managed block that routes to canonical context | [Custom instructions with AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md.md) |
| Claude Code | `CLAUDE.md` | Root managed block that routes to canonical context | [How Claude remembers your project](https://code.claude.com/docs/en/memory) |
| Cursor | `AGENTS.md` | Shared `agents` surface with Codex | [Cursor rules](https://cursor.com/docs/rules) |
| Gemini CLI | `GEMINI.md` | Root router and generic workspace Skill discovery | [GEMINI.md](https://geminicli.com/docs/cli/gemini-md/) and [Agent Skills](https://geminicli.com/docs/cli/skills/) |

## Codex

Codex builds guidance once per run/session. It reads global guidance, then walks from the project
root to the working directory. At each level it prefers `AGENTS.override.md`, then `AGENTS.md`, then
configured fallbacks; nearer files appear later and override broader guidance. The default combined
project-document limit is 32 KiB.

The beta adapter owns a block in the configured output, defaulting to the repository-root
`AGENTS.md`. It does not automatically generate a nested hierarchy, overrides, fallback
configuration, or global guidance. A custom nested output is written when configured, but discovery
and conformance for that path are user-owned. Existing human content is preserved through explicit
adoption.

Codex project prompt inspection on 2026-07-11 discovered both the generated root `AGENTS.md` and the
generic `.agents/skills/carrylog-continuity/SKILL.md` without invoking a model.

## Claude Code

Claude Code loads `CLAUDE.md`/`CLAUDE.local.md` files above the working directory at launch and loads
subdirectory instructions when it works there. A project file can live at `./CLAUDE.md` or
`./.claude/CLAUDE.md`; concise files under roughly 200 lines are recommended.

The beta adapter defaults to `./CLAUDE.md`. It does not automatically generate `.claude/rules/`,
local personal instructions, imports, exclusions, or organization policy. A custom nested output is
written when configured, but discovery and conformance for that path are user-owned.

When Skills are enabled, Carrylog writes a minimal `.claude/skills/carrylog-continuity/SKILL.md`
adapter that directs Claude Code to the canonical generic Skill. Both Skill folders pass the
frontmatter validator from the Codex Skill creator. Claude Code 2.1.207 is installed locally; a fresh
authenticated read-only session reconstructed the v2 project, objective, next action, stale status,
and risks from Carrylog resume output.

## Cursor

Cursor supports `AGENTS.md` as a project-rules surface. Configuration v2 therefore maps both `codex`
and `cursor` harness selection to one `agents` adapter and one default `AGENTS.md`, preventing
duplicate ownership. Carrylog does not generate Cursor legacy `.cursorrules` or project `.mdc` rules.

Cursor CLI is not installed in the current validation environment. File discovery is covered by the
official contract and exact shared-surface fixture; authenticated fresh-session launch remains an
explicit gap rather than a claimed result.

## Gemini CLI

Gemini CLI loads hierarchical `GEMINI.md` context and supports workspace Skills from
`.gemini/skills` or the generic `.agents/skills` alias. Carrylog generates the root `GEMINI.md` router
and reuses the generic Skill instead of duplicating it under `.gemini`.

Local Gemini CLI discovery on 2026-07-11 reported `carrylog-continuity` enabled from the generated
`.agents/skills` path. Carrylog does not generate custom context filenames, nested GEMINI files, or
extensions. A headless model launch could not authenticate without an interactive login or API key,
so discovery—not authenticated response quality—is the verified Gemini boundary in this environment.

## Guarantees and limits

- The registry is the single runtime source for adapter labels and default outputs.
- Golden fixtures freeze exact managed-block output for v1 Codex/Claude and v2 agents/Gemini
  surfaces.
- Default routers contain references and load policy, not full canonical document bodies.
- A custom output path is accepted when portable, but the user is responsible for choosing a path
  the target tool discovers.
- CI does not require authenticated model launches; conformance covers documented discovery, exact
  output, adoption, drift, cross-platform file behavior, and offline local discovery where available.

Copilot, overrides, and nested generation remain unsupported until each has a documented discovery,
precedence, ownership, and fixture contract.
