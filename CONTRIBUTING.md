# Contributing

Carrylog changes must preserve user-authored project memory and cross-platform behavior.

## Setup

```bash
npm ci
npm run quality
npm run pack:check
npm run test:package
```

Node.js 22 or 24 is the supported development range for the beta.

## Change expectations

- Start with the nearest existing test and document the behavior being changed.
- Trace a new feature to a job in `docs/product-scope.md`; update product scope explicitly when no
  current job applies.
- Fix causes rather than adding repository-specific exceptions.
- Keep filesystem mutation in application commands and safe file utilities.
- Do not add an adapter based on guessed tool behavior; link its discovery and precedence contract
  in a decision record.
- Preserve human content outside managed markers.
- Add a decision record for schema, dependency, compatibility, safety, or architectural changes.
- Update `.agent-context/current-state.md` and `.agent-context/handoff.md` for meaningful changes.
- Follow `docs/documentation-policy.md`; do not copy volatile measurements across status, user, and
  historical documents.
- Keep journaling, semantic compaction, and broader continuity claims behind ADR-0012's staged
  evidence gates.

## Review checklist

- Product scope and non-goals remain intact.
- Failure modes and rollback/recovery behavior are explicit.
- Security boundaries and path behavior were considered.
- Tests cover allowed, rejected, repeated, and failure states.
- User-facing docs and CLI help match actual behavior.
- `npm run quality` and `npm run pack:check` pass.
- Package install modes, ESM, and TypeScript declarations pass through `npm run test:package`.
- Generated adapters are current (`node dist/cli.js sync --check`).

Large beta changes require an explicit review pass recorded in the handoff or pull request. Review
findings should be ranked by severity and resolved or accepted with rationale.

Maintainers follow [the release process](docs/releasing.md). Contributors must not publish local
working-tree artifacts or add registry tokens to repository configuration.
