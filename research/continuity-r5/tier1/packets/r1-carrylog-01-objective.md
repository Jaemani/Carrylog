## Objective

At fixture commit `c9e8c2d`, prepare the minimum controlled Tier 1 continuity pilot without adding
session journaling or semantic compaction.

## Completed

- Carrylog beta.5 is already published on the explicit npm `beta` channel and its OIDC artifact was
  independently verified.
- The narrow supported product is repository-owned checkpoint/resume governance, not chat replay.

## Verification

- Treat release facts as completed historical evidence; do not repeat registry administration.
- Inspect the exact fixture commit and working-tree state before reporting.

## Decisions

- ADR-0012 gates journaling, arbitrary switch, behavioral-continuity, and compaction claims on staged
  evidence.

## Risks

- At this fixture revision, the two repository fixtures, task rubrics, randomized order, and two
  authenticated harnesses are not yet frozen in a committed preregistration.

## Next action

Freeze those experimental inputs at immutable revisions, then run the randomized pilot without
changing the product during scored runs.
