# ADR-0004: `ackit` executable and `.agent-context/` root

- Status: Accepted
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

## Revisit triggers

- package registry or trademark research identifies a conflict;
- user testing shows the executable is hard to discover or remember;
- a broader standard defines a canonical directory name.

