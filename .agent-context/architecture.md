# Architecture

The system is a Node.js 22+ TypeScript CLI with one runtime dependency (`yaml`). Normal runtime has no
service, database, model, telemetry, or network dependency; only npm installation/release crosses a
network boundary.

## Modules

- `src/cli.ts`: syntax, reporting, help, and exit-code contract.
- `src/product.ts`: active Carrylog display, command, debug, and compatibility identity constants.
- `src/commands/`: init, sync, validate, and handoff application workflows.
- `src/config/` and `src/domain/`: strict versioned configuration and loaded source contract.
- `src/schema/`: packaged public schema location and copied-artifact identity.
- `src/migrations/`: exact published-template migrations and customized-state diagnostics.
- `src/adapters/`: registry, deterministic router rendering, and managed-block ownership.
- `src/validation/`: document budgets, normalized ownership, schema/directive, filesystem, marker,
  and adapter drift checks.
- `src/git/` and `src/handoff/`: bounded Git process/parsers and narrative-preserving evidence block.
- `src/core/`: path containment, symlink defense, diagnostics, bounded reads, staged atomic writes,
  and stale-plan preconditions.

## Invariants

- Canonical sources, copied schema, and generated outputs have exclusive normalized ownership.
- Existing unmarked adapters require explicit adoption; content outside exact markers is preserved.
- Every changed output is staged before the first rename; parent/temporary identities and expected
  inputs are rechecked before commit.
- Managed paths remain portable, inside the project, and free of symbolic-link traversal.
- Git evidence is offline, deterministic, bounded, project-scoped, stable across two observations,
  and never stages or commits.
- A generated handoff must pass prospective file/context validation before replacement.
- Core behavior remains deterministic and offline-capable.
- Configuration v1 paths, schema identity, and marker namespaces remain stable across product naming.
- Human-owned context is auto-migrated only from an exact frozen published template; customized legacy
  instructions fail closed for manual review.

Detailed boundaries and residual gaps live in `docs/architecture.md`; security assumptions live in
`docs/threat-model.md`; schema, Git, and Carrylog identity choices are ADR-0005, ADR-0006, and
ADR-0008.
