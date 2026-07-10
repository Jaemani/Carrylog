# Architecture decision records

Decision records capture choices that constrain future work. They are immutable once accepted except
for clarification; a later decision supersedes an old one rather than rewriting history.

| ID | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-local-first-context-compiler.md) | Local-first canonical context compiler | Accepted | 2026-07-10 |
| [0002](0002-node-typescript-cli.md) | Node.js and strict TypeScript for the CLI | Accepted | 2026-07-10 |
| [0003](0003-managed-block-adoption.md) | Managed blocks and fail-closed adoption | Accepted | 2026-07-10 |
| [0004](0004-cli-and-context-names.md) | `ackit` executable and `.agent-context/` root | Superseded | 2026-07-10 |
| [0005](0005-configuration-v1-compatibility.md) | Configuration v1 compatibility and validation contract | Accepted | 2026-07-10 |
| [0006](0006-deterministic-git-handoff-evidence.md) | Deterministic and bounded Git handoff evidence | Accepted | 2026-07-10 |
| [0007](0007-guarded-filesystem-replacement.md) | Guarded filesystem replacement with path identity | Accepted | 2026-07-10 |
| [0008](0008-carrylog-identity-and-v1-compatibility.md) | Carrylog identity with configuration v1 wire compatibility | Accepted | 2026-07-10 |

## Record template

Each new record should contain:

- status and date;
- decision owners when a team exists;
- context and forces;
- considered options;
- decision and rationale;
- positive and negative consequences;
- validation or revisit triggers;
- superseded decision links where applicable.
