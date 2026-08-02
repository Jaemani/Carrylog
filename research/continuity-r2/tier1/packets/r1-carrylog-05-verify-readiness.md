## Objective

Verify the portable-resume resource and stale-state contracts without changing project context.

## Completed

- Managed configuration and canonical document reads are bounded to 1 MiB per file.
- One portable resume observation is bounded to 8 MiB aggregate.
- Default always-loaded context is bounded to 16,000 JavaScript characters.

## Verification

- Run `npm run format:check`, the focused continuity test file, and a clean-diff check.

## Decisions

- Character budgets are not tokenizer counts or semantic-quality measures.
- Structural validation, checkpoint Git freshness, and behavioral continuity are distinct evidence.

## Risks

- `resume --check` must fail on stale Git evidence even when canonical files are structurally valid.
- Local contract tests do not prove cross-harness behavior.

## Next action

Report the three limits with correct units and scope, the stale strict-resume behavior, and only the
checks actually run.
