# Architecture

The current system is a Node.js 22+ TypeScript CLI with one runtime dependency (`yaml`). It has no
runtime service, database, model, or network dependency.

## Modules

- `src/cli.ts`: syntax, reporting, and exit-code contract.
- `src/commands/`: application-level init, sync, and validate workflows.
- `src/config/` and `src/domain/`: strict versioned configuration model.
- `src/adapters/`: deterministic tool-router rendering and managed-block ownership.
- `src/validation/`: document budget, source overlap, filesystem, and drift checks.
- `src/core/`: path containment, symlink defense, diagnostics, and atomic file replacement.

## Invariants

- Canonical sources and generated outputs never overlap.
- Existing unmarked adapters require explicit adoption.
- Every adapter is preflighted before any adapter mutation.
- Managed paths remain portable, inside the repository, and free of symlink traversal.
- Core behavior remains deterministic and offline-capable.

Detailed component boundaries, dependency direction, extension points, and gaps live in
`docs/architecture.md`. Security assumptions live in `docs/threat-model.md`.
