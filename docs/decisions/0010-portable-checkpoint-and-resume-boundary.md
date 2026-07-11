# ADR-0010: Define continuity as a portable checkpoint and verified resume envelope

- Status: Accepted
- Date: 2026-07-11
- Owners: Repository maintainer

## Context

Codex, Claude Code, Cursor, and Gemini CLI have different private session stores, native resume
commands, transcript formats, and compaction behavior. Parsing those stores would couple Carrylog to
undocumented machine-local state, risk exporting secrets or hidden reasoning, and still would not
reconstruct another provider's internal model state.

The portable need is narrower: a fresh agent must recover the reviewed objective, completed work,
verification, decisions, risks, next action, stable project context, and current repository evidence.

## Decision

Carrylog's continuity boundary is repository-owned, reviewable state plus a fresh bounded Git
observation. It does not promise conversation replay or control over provider compaction.

A v2 checkpoint contains these H2 sections exactly once and in order: `Objective`, `Completed`,
`Verification`, `Decisions`, `Risks`, and `Next action`. Bodies must be non-empty. Headings inside
managed Git evidence, fenced code, blockquotes, or indented code are not section declarations.
`carrylog checkpoint` is the continuity-oriented alias for the existing narrative-preserving handoff
evidence refresh; `handoff` remains compatible.

`carrylog resume --json` emits format version 1 with:

- project name, configuration version, portable config path, and raw-byte SHA-256;
- parsed checkpoint sections, digest, and Git-evidence staleness;
- a projected Git snapshot without commit timestamps;
- full always-loaded context except the separately represented checkpoint;
- metadata-only on-demand catalog entries with triggers and digests;
- deterministic diagnostics, including `W_CHECKPOINT_STALE`.

The envelope omits absolute roots, session identifiers, raw transcripts, hidden reasoning, provider
databases, and wall-clock freshness claims. `--check` exits 1 when checkpoint Git evidence is stale.

Before export, Carrylog validates the project, reads config and every canonical document through
regular-file handles, rejects symlinks and hard links, verifies handle/path inode identity and
size/mtime before and after each bounded UTF-8 read, observes Git, then repeats the config/document
observation. It accepts only two matching observations and retries the complete envelope at most
three times. The exact observed document bytes are revalidated before serialization.

Generated Skills contain only this maintenance protocol, never project content. Codex, Cursor, and
Gemini CLI share `.agents/skills/carrylog-continuity/SKILL.md`; Claude Code receives a minimal
`.claude/skills` adapter that points to the canonical Skill. Skill ownership requires exactly one
standalone marker. The Skill uses a global executable, a verified local `node_modules/.bin` package,
or the built CLI only inside Carrylog's own source repository; it never installs or upgrades a package
implicitly. An MCP server may later expose the same read model, but Markdown and CLI output remain the
baseline.

## Rejected alternatives

- **One universal raw transcript file:** rejected because providers do not share a stable transcript
  or hidden-state contract and transcripts can contain credentials and irrelevant tool output.
- **Parse provider JSONL, SQLite, or native resume stores:** rejected as private, machine-local, and
  version-fragile.
- **Let a model summarize automatically during resume:** rejected because deterministic validation
  cannot verify a new semantic summary and core runtime must remain offline.
- **Copy all on-demand documents into every envelope:** rejected because it defeats progressive
  disclosure and inflates startup context.
- **Claim control over native compaction:** rejected because Carrylog operates outside provider
  context-window implementations.

## Consequences

- Native same-provider resume and Carrylog resume are complementary: native resume may recover a
  conversation; Carrylog recovers durable cross-provider project state.
- One-off `npx` initialization does not provide a future executable. Automated resume requires a
  project-pinned or global Carrylog install; manual Markdown reading remains available without it.
- Agents and maintainers remain responsible for accurate narrative updates before checkpointing.
- A stale checkpoint can still be inspected, but automation can enforce freshness with `--check`.
- Repositories that intentionally hard-link canonical context must copy it to independent regular
  files before portable export.
- Semantic code-to-document freshness remains outside the current validator.

## Validation

- Missing, duplicate, empty, unknown, and out-of-order sections; CommonMark fence-length,
  blockquote, indented-code, and managed-evidence boundaries.
- Byte-identical repeated JSON, stale exit status, raw-byte digests, metadata exclusion, detached Git,
  warning deduplication, and progressive always/on-demand projection.
- Hard-link, symlink, containment, encoding, size, damaged Skill, and invalid-context rejection.
- Codex prompt-input discovery, Gemini Skill discovery, and fresh-session harness checks where the
  local authenticated tool is available.
