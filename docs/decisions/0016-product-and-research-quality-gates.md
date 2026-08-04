# ADR-0016: Separate cross-platform product quality from macOS research evidence

- Status: Accepted
- Date: 2026-08-05
- Owners: Repository maintainer

## Context

Carrylog supports Node.js 22 and 24 on Linux, macOS, and Windows. Its active continuity research
harness is different: it was frozen for a macOS Seatbelt experiment and contains POSIX permissions,
signals, paths, Git diagnostics, and Seatbelt-profile assertions. The root `quality` script had grown
to run both the supported product suite and this platform-owned research suite on every CI operating
system.

Exact-commit run 30944540371 exposed an unconditional `sandbox-exec` call on Linux. A first correction
partitioned that one test, but run 30945728644 then exposed ten additional Windows failures from the
same category of frozen POSIX and macOS assumptions. Adding platform skips or rewriting the frozen
tests would alter Attempt-5 evidence. Treating those failures as product defects would also conflate a
supported CLI contract with a historical research harness that never claimed Windows execution.

## Decision

The gates have separate owners and commands:

- `npm run quality` is the cross-platform product gate: formatting, strict type checking, product tests,
  and configured coverage floors.
- `npm run test:research:active` builds current product bytes and runs the complete active research suite
  on macOS only.
- `npm run quality:research` composes the product and research gates for local macOS review.

Branch CI keeps the product gate on Node.js 22 and 24 across Linux, macOS, and Windows. It adds dedicated
macOS Node.js 22 and 24 research jobs rather than conditionally weakening one matrix job. Tagged release
preflight runs the product and package gates on all three operating systems and adds a separate complete
research matrix on macOS Node.js 22 and 24. Publication depends on both preflight job families. The Ubuntu protected
publish job may run the deterministic product and artifact checks without pretending to execute Seatbelt.

Attempt-5 frozen files, manifests, results, evaluations, and outcomes remain byte-unchanged. The separate
repository-discovery live canary pins TAP output before parsing metrics so Node default-reporter changes
do not alter its result projection.

## Considered alternatives

### Add more Windows and Linux skip patterns to the frozen research suite

Rejected. The first single-test partition immediately expanded into ten Windows exceptions. A growing
skip list would be hard to audit, could silently lose frozen contracts, and would still not create the
macOS kernel boundary those tests measure.

### Rewrite frozen tests to become cross-platform

Rejected. That changes the reviewed Attempt-5 manifest after the experiment stopped and risks converting
historical evidence into a moving target. A future research protocol may design portable contracts before
freezing them.

### Remove active research from CI and releases

Rejected. Research code can still drift when product APIs or Node output change. Dedicated macOS jobs keep
that evidence executable and release-blocking without misrepresenting its platform scope.

### Make all product quality macOS-only

Rejected. Carrylog's CLI and npm package explicitly support Linux and Windows. Product behavior and
packaged consumers must retain the full operating-system matrix.

## Consequences

Positive:

- A red Linux or Windows product job again means a supported product contract failed.
- The complete research suite remains tested on both supported Node majors where its security boundary
  exists.
- Release publication cannot bypass research drift on either supported Node major because both tagged
  macOS research jobs are dependencies of the publish job.
- Frozen evidence remains immutable.

Negative:

- `npm run quality` no longer means “product plus active research”; macOS maintainers use
  `npm run quality:research` when both are required.
- Branch CI adds two macOS jobs and their runtime cost.
- Portable research contracts are not independently replicated on Linux or Windows under the frozen
  protocol.

## Validation and revisit triggers

- Parse workflow and package scripts in a product regression so product and research jobs cannot be
  silently recombined or dropped from release preflight.
- Require product quality and package smoke on the existing cross-platform matrices.
- Require the complete active research suite on macOS Node.js 22 and 24.
- Preserve failed runs 30944540371 and 30945728644 as the evidence that motivated the separation.
- Revisit when a new preregistered research protocol defines platform-neutral contracts before freeze,
  or when GitHub no longer provides the required macOS Seatbelt environment.
