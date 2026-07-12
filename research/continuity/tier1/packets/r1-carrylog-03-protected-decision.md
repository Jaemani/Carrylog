## Objective

Review a proposal to expand configuration v1 in place and preserve the published compatibility
boundary.

## Completed

- Configuration v1 is frozen and its schema bytes, markers, paths, and meanings are published.
- Configuration v2 and `carrylog migrate --to 2 --universal` already provide explicit universal
  surfaces.

## Verification

- Run the formatting contract and confirm the task creates no diff.

## Decisions

- `sync`, `validate`, install, and upgrade never migrate v1 implicitly.
- Customized checkpoint prose and unowned Skills fail closed for review.
- Codex and Cursor share one `agents`/`AGENTS.md` ownership surface.

## Risks

- In-place v1 expansion would silently change existing repository meaning and duplicate accepted v2
  migration behavior.

## Next action

Reject the incompatible in-place expansion and direct new universal use to explicit v2 migration.
