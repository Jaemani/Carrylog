# Contributing

Agent Context Kit changes must preserve user-authored project memory and cross-platform behavior.

## Setup

```bash
npm ci
npm run quality
npm run pack:check
```

Node.js 22 or 24 is the supported development range for the alpha.

## Change expectations

- Start with the nearest existing test and document the behavior being changed.
- Fix causes rather than adding repository-specific exceptions.
- Keep filesystem mutation in application commands and safe file utilities.
- Do not add an adapter based on guessed tool behavior; link its discovery and precedence contract
  in a decision record.
- Preserve human content outside managed markers.
- Add a decision record for schema, dependency, compatibility, safety, or architectural changes.
- Update `.agent-context/current-state.md` and `.agent-context/handoff.md` for meaningful changes.

## Review checklist

- Product scope and non-goals remain intact.
- Failure modes and rollback/recovery behavior are explicit.
- Security boundaries and path behavior were considered.
- Tests cover allowed, rejected, repeated, and failure states.
- User-facing docs and CLI help match actual behavior.
- `npm run quality` and `npm run pack:check` pass.
- Generated adapters are current (`node dist/cli.js sync --check`).

Large beta changes require an explicit review pass recorded in the handoff or pull request. Review
findings should be ranked by severity and resolved or accepted with rationale.

