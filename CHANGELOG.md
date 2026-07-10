# Changelog

All notable changes will be documented here. The format follows Keep a Changelog principles, and the
project intends to use semantic versioning once the public schema contract is established.

## [Unreleased]

### Added

- Local-first TypeScript CLI with `init`, `sync`, and `validate` commands.
- Version 1 canonical context configuration and progressive document loading.
- Managed Codex and Claude Code adapters with explicit adoption.
- Cross-platform path, symlink, context-budget, marker, and drift validation.
- Bounded UTF-8 file reads, catalog ceilings, and a generated-router budget.
- Human and JSON diagnostics with stable exit-code categories.
- Unit, filesystem integration, CLI lifecycle, and coverage-gated tests.
- Architecture, product scope, threat model, testing strategy, roadmap, ADRs, and dogfooded handoff.

### Security

- Adapter writes preflight all outputs and atomically replace individual files.
- Paths reject traversal, symbolic links, platform-reserved names, and normalized collisions.
