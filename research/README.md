# Research

Research files are non-normative protocols, audit inputs, and sanitized results. They are committed
for preregistration and review but excluded from the npm package by `package.json`.

Research does not change product behavior or authorize a claim. A supported feature requires product
scope, an accepted ADR where consequential, implementation and regression coverage, user-facing
documentation, and the normal release gates.

`continuity-discovery-boundary/` is a non-scored successor-design prototype. It is deliberately
separate from immutable Tier 1 attempts and does not authorize another provider run or continuity
claim.

`continuity-r5/` is the unscored attempt-5 draft that integrates the reviewed discovery boundary into
a new experiment identity. Its runner, canaries, verification registry, Git policy, bounded process
supervisor, and sealed broker/invocation ledger are reviewed and tested as one candidate surface.
Authenticated prerequisites, freeze reviews, a manifest, and scored provider runs remain separate
gates; a draft directory is not behavioral evidence.

Never store credentials, hidden reasoning, private provider session databases, or unsanitized
conversation transcripts here.
