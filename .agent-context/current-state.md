# Current state

## Active objective

Establish a production-minded alpha foundation for cross-agent project memory before adding Git
handoff automation, more adapters, skills, or MCP.

## Implemented and locally verified

- Node.js/TypeScript `ackit` CLI with `init`, `sync`, and `validate`.
- Strict version 1 YAML decoding with aggregated diagnostics.
- Progressive always/on-demand context catalog and character budget.
- Codex and Claude managed-block adapters with explicit non-destructive adoption.
- Path traversal, platform portability, normalized collision, symlink, source overlap, and drift checks.
- Bounded strict UTF-8 reads plus document, adapter, trigger, always-context, and router budgets.
- Complete adapter preflight plus atomic per-file writes and mode preservation.
- Human/JSON diagnostics and stable exit-code categories.
- Unit, integration, CLI lifecycle, and coverage-gated tests.
- Product scope, architecture, threat model, test strategy, roadmap, ADRs, and engineering log.

## In progress

- Initial commit/push and remote CI matrix execution.
- License and npm scope ownership decisions before any public release.

## Blockers and risks

- No license has been selected, so reusable open-source distribution is not authorized yet.
- npm scope ownership and final package naming need confirmation before publish.
- Tool-specific adapter discovery/precedence conformance has not yet been researched and fixture-tested.
- Multi-file writes are preflighted but not transactionally atomic across OS failure.
- No public schema migration contract, fault injection, or parser fuzzing yet.

## Next best task

Create and push the reviewed initial commit, observe all Linux/macOS/Windows and Node 22/24 CI jobs,
and repair any platform-specific failures before tagging the first alpha. Do not expand into handoff
automation until that foundation is green.
