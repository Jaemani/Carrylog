# Tier 1 attempt 1 abort record

## Identity

- Suite: `research/continuity/tier1`
- Freeze commit: `382cda0e2a5efb3eca5e487e482c7316d6394617`
- Suite SHA-256: `3809b850da94f259ff9f2749918cfa45dbe5657bf9b4dc095a69cde4f2d59fc8`
- Review SHA-256: `dbe7157f4eb562103b5fea0ec96e03858307c7e0ee504d877848cb30decc222d`

## Outcome

Attempt 1 is frozen, reviewed, and executable-input immutable, but it produced no scored run. The
first `t1-001 --execute` invocation failed while verifying the committed freeze. `run.mjs` called its
shared process helper before the helper's `deterministicSetupEnvironment` lexical binding had been
initialized, producing `ReferenceError: Cannot access 'deterministicSetupEnvironment' before
initialization`.

Inspection immediately after failure found only the tracked `.gitignore` and `.gitkeep` in
`raw-quarantine`: no claim, terminal artifact, provider authentication, or model call occurred. The
committed freeze still passes `freeze.mjs --check`; its files were not amended.

## Disposition

The failure is not a scored exclusion and is not silently replaced inside attempt 1. A separate suite
at `research/continuity-r2/tier1` carries one preregistered bootstrap amendment, new authenticated
canaries, a new review digest, two new read-only reviews, and a new permanent freeze boundary before
execution.
