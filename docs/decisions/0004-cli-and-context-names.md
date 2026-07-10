# ADR-0004: `ackit` executable and `.agent-context/` root

- Status: Superseded by ADR-0008 for product, package, repository, and executable naming
- Date: 2026-07-10

## Context

The working command name `ack` is concise and matches Agent Context Kit initials, but `ack` is an
established source-code search tool. Reusing it would create command ambiguity and installation
conflicts. The canonical directory must be recognizable, repository-local, and unlikely to collide
with product documentation.

## Decision

- Product and repository name: Agent Context Kit.
- npm package working name: `@jaemani/agent-context-kit`.
- executable: `ackit`.
- canonical memory root: `.agent-context/`.

The npm name is a working release contract and still requires ownership verification before publish.
The hidden directory keeps infrastructure separate from ordinary product docs while remaining easy to
commit and inspect.

## Consequences

Positive:

- avoids the known `ack` collision;
- command remains short and product-related;
- canonical files have a predictable location;
- product docs can link into the context layer without mixing responsibilities.

Negative:

- `ackit` is less immediately obvious than `agent-context`;
- hidden directories are less visible in basic file listings;
- scoped npm ownership and final naming are not yet proven.

## Pre-publication validation note — 2026-07-10

The authenticated npm account now matches scope `@jaemani`, the scoped package remains unregistered,
and account write 2FA is enabled. The original naming rationale remains unchanged; license selection
and first-publication bootstrap are tracked by the release process.

## Revisit triggers

- package registry or trademark research identifies a conflict;
- user testing shows the executable is hard to discover or remember;
- a broader standard defines a canonical directory name.

## Supersession note — 2026-07-10

ADR-0008 adopts Carrylog after registry and direct-competitor research invalidated the earlier product
and package assumptions. This record remains the history of the original decision. Its
`.agent-context/` decision remains part of the published configuration v1 compatibility contract.
The scoped `0.1.0-beta.3` package was subsequently published and remains immutable migration evidence.
