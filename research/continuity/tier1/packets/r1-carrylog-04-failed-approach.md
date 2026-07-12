## Objective

Review a proposal to simplify continuation executable selection by using ambient `PATH` first.

## Completed

- A global beta.4 executable previously shadowed the compatible beta.5 source and produced a false
  result.
- Generated Skills now resolve compatible built source, then project-pinned, then compatible global.

## Verification

- Run the focused continuity tests and leave the implementation unchanged.

## Decisions

- A selected candidate must pass `resume --help`; an incompatible source or pinned candidate stops
  with guidance instead of falling through.
- Skills never download, build, install, or upgrade Carrylog automatically.

## Risks

- PATH-first selection reintroduces stale-global shadowing and encourages repository-specific
  workarounds.

## Next action

Decline the proposal and explain the reproduced failure and fixed offline resolution order.
