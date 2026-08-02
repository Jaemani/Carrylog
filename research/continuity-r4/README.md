# Tier 1 execution attempt 4

This directory is a new experiment, not a mutation of either frozen predecessor. Attempt 1 at
`research/continuity/tier1` failed before claim creation. Attempt 2 at
`research/continuity-r2/tier1` created the first run claim, then could not persist either a terminal
artifact or its failure record because the atomic writer state was still in a top-level temporal
dead zone. Attempt 3 at `research/continuity-r3/tier1` completed 11 scored runs, then stopped with a
mechanical REDESIGN decision after one delivery failure exposed stale generated Skill bytes and
registered non-Git verification inherited detached Git selection state. Attempt 4 preserves all
three predecessors and repairs only those experiment-delivery boundaries under a new seed.

The suite must complete its own dependency validation, authenticated harness prerequisites,
exact-digest reviews, manifest creation, permanent first-ADD commit, and `freeze --check` before any
scored execution. Earlier attestations and manifests are not valid for this directory.
