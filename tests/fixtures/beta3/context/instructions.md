# Context operating rules

## At the start of work

1. Read every document marked `load: always` in `config.yaml`.
2. Load on-demand documents only when their descriptions or triggers match the task.
3. Compare the requested work, the repository state, and this context before editing.
4. Report consequential mismatches before relying on stale context.

## While working

- Treat source code and executable tests as evidence, not as substitutes for product intent.
- Keep changes inside the requested scope and record decisions that constrain future work.
- Do not silently rewrite human-authored content outside generated adapter blocks.

## Before handing off

- Update `current-state.md` when implementation status or priorities changed.
- Update `handoff.md` with verified changes, checks run, unresolved risks, and the next best task.
- Add or link a decision record when a consequential design choice was made.
- Run `ackit validate` and the project's relevant quality checks.
