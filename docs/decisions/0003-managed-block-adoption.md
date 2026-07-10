# ADR-0003: Managed blocks and fail-closed adoption

- Status: Accepted
- Date: 2026-07-10

## Context

Real repositories commonly have hand-written `AGENTS.md` or `CLAUDE.md` files. Replacing them would
destroy intent; refusing every existing file would make adoption cumbersome. Generating a separate
file is not sufficient when a tool recognizes only a conventional path.

## Considered options

1. Own and overwrite the complete adapter file.
2. Generate sidecar files and ask users to import them manually.
3. Merge Markdown semantically on every sync.
4. Own one visibly marked block while preserving everything else byte-for-byte.

## Decision

Use option 4.

New files contain exactly one managed block. Existing unmarked files cause preflight failure unless
the user supplies `--adopt`, which appends the block. Sync replaces only content between the exact
markers. Missing, reversed, or duplicate markers fail closed. Existing newline style and file mode
are preserved where applicable.

All configured adapters are planned before any adapter write. Each changed file is written to a
unique sibling temporary file and renamed into place.

## Consequences

Positive:

- user-authored content survives adoption and synchronization;
- ownership is visible in reviews;
- deterministic replacement is simpler and safer than semantic Markdown merging;
- adapter drift is straightforward to detect.

Negative:

- users must resolve damaged markers manually;
- duplicate or intentionally quoted marker text is reserved;
- multiple file updates are not one filesystem transaction;
- some tools may impose file formats where HTML comment markers need adapter-specific handling.

## Revisit triggers

- a supported adapter format cannot safely contain the markers;
- operating-system failure testing shows rename semantics need a platform abstraction;
- structured document formats make a different ownership mechanism safer.

