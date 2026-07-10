# Project brief

## Purpose

Carrylog gives a repository one durable project-context and handoff layer shared by multiple AI coding
agents. Canonical Markdown stays human-reviewable; deterministic adapters route Codex, Claude Code,
and future tools to the right context without copied sources drifting. Durable truth belongs to the
repository rather than a model session or machine-local journal.

## Users

- Developers who switch among AI coding agents or machines on the same repository.
- Teams that need reviewable architecture, quality, decision, and handoff constraints in Git.
- Maintainers who want context changes reviewed and versioned with code.

## In scope

- Local-first context structure and versioned schema.
- Progressive always/on-demand loading.
- Non-destructive instruction-file adapters.
- Verifiable handoff evidence and drift/freshness checks.
- Cross-platform CLI, CI automation, and later opt-in skills/MCP access.

## Non-goals

- A complete software-development methodology or agent orchestrator.
- Replacing Git, issue trackers, ADRs, product documentation, or automatic session journals.
- Hidden LLM calls in deterministic validation.
- Uploading repository context or telemetry by default.
- Claiming semantic freshness when only file structure was validated.

Detailed scope and success criteria live in `docs/product-scope.md`.
