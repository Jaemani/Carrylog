# ADR-0001: Local-first canonical context compiler

- Status: Accepted
- Date: 2026-07-10

## Context

AI coding tools discover different repository instruction files. Maintaining complete project memory
in each file creates drift, redundant context, and tool lock-in. A template collection would reduce
initial effort but would not define ownership, updates, validation, or handoff continuity.

The system must work for private repositories without uploading content and must remain usable when a
specific agent, model, or integration is unavailable.

## Considered options

1. Maintain each tool file independently.
2. Generate complete tool files from one large Markdown file.
3. Store project memory in a remote service and expose it through MCP.
4. Keep layered canonical memory in the repository and compile concise tool adapters.

## Decision

Use option 4.

`.agent-context/` is the canonical human-reviewable source. A versioned config catalogs documents as
always loaded or on demand. Tool files are generated routers that point to those sources and carry
only the common operating contract.

Core init, sync, and validation run locally, deterministically, and without an LLM. Skills, MCP,
search indexes, and external integrations may extend the system later but cannot become prerequisites
for reading or recovering project memory.

## Consequences

Positive:

- context changes use normal review and history;
- tool adapters can change without migrating project memory;
- startup context can be bounded and task-specific;
- private code does not need a remote memory service;
- deterministic behavior is testable in CI.

Negative:

- Markdown freshness still requires a maintenance protocol;
- adapter routers depend on agents following referenced files;
- semantic document/code consistency cannot be proven by a deterministic compiler alone;
- repositories carry additional structured documentation.

## Revisit triggers

- evidence that supported tools do not reliably follow router references;
- context scale makes repository-native search inadequate;
- a standardized cross-agent project-memory protocol gains broad adoption;
- remote team features can be added without weakening the local source of truth.

