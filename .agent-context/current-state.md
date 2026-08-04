# Current state

## Active objective

Record the two passed authenticated prerequisites from reviewed commit `65bb802`, then prepare the
exact attempt-5 freeze review surface before any manifest or scored provider execution.

## Implemented and verified

- The strict TypeScript CLI provides deterministic initialization, adapter synchronization,
  validation, Git handoff, v1-to-v2 migration, checkpoint, and portable resume.
- Configuration v1 remains frozen. Version 2 routes Codex/Cursor, Claude, and Gemini to one canonical
  context layer and installs offline continuity Skills with fail-closed ownership.
- Resume uses stable bounded file and Git observations and exports no provider transcript or session
  state. Structural validity, Git freshness, and behavioral continuity remain separate evidence.
- ADR-0009 through ADR-0015 define universal surfaces, continuity boundaries, Git stability, evidence
  gates, checkpoint settlement, generated-artifact EOL equivalence, and bounded handoff path evidence.
- Immutable beta.7 passed the full Node 22/24 and three-OS matrices, protected OIDC publication,
  registry digest and provenance verification, isolated consumers, signature audit, and a fresh
  checkpoint lifecycle. Exact release measurements remain in the engineering log.
- The separately committed repository-discovery prototype defines `none`, direct `repository`, and
  `repository-discovery`. Its macOS canary proves outer gitfile discovery, nested Git independence,
  read-only external metadata, immutable gitfile identity, external-symlink write denial, localhost
  denial, and all five Git-backed cases that failed in attempt 4.

## In progress

- Attempts 1 and 2 remain immutable aborted bootstrap evidence. Attempt 3 is frozen at `b72127e`; it
  stopped after 11 scored runs and one reviewed delivery failure. Attempt 4 is frozen at `88f6427`;
  it stopped after six scored repair-screen runs exposed a condition-independent Git-discovery ceiling.
- Attempt 5 is an unfrozen and unscored draft in `research/continuity-r5`. It has fresh identities,
  two passed current-byte prerequisites, and empty result surfaces; no predecessor evidence was copied.
- Its three Git policies are integrated across the registry, wrapper, MCP broker, Seatbelt profiles,
  canaries, and screens. Verification has bounded process/output handling, read-only checkouts,
  writable scratch, digest-bound support programs and host Git state, and a sealed broker/invocation
  receipt ledger. Detailed invariants and review history live in the attempt README and engineering log.
- The current draft passes the attempt-5 suite at 122/122, active research at 131/131, the isolation
  canary, Carrylog continuity at 16/16, BusyCafe pytest at 22/22, BusyCafe compileall, product quality,
  package inspection, and package smoke.
- The reviewed offline draft was checkpointed and committed at `844a456`. The first authenticated
  Codex canary reached the model but exposed zero verification tools and remained pending. Claude
  stopped before provider access because host `PATH` selected the JM Router launcher instead of the
  preregistered native binary.
- The current repair resolves native Claude from host `~/.local/bin/claude` independently of `PATH`,
  verifies its target digest, and retains bounded redacted Codex stderr. Independent review found the
  Codex broker was enabled but not required; the shared invocation now sets `required=true` so startup
  failure terminates both canary and scored clients. Re-review returned GO and the repaired Codex
  canary passed. Routed Claude then resolved only `gpt-5.6-sol` and completed one Read before its stale
  USD 0.05 cap triggered. A rejected first correction would have applied USD 0.75 independently to nine
  processes. A second single-session design bounded spend but failed to cover the scored read-only
  permission profile. The revised canary uses a USD 0.55 read-only process and a USD 0.20 writable
  process, fixes the aggregate ceiling at USD 0.75, and rejects every model-less or unregistered
  assistant response. This critical-byte change reset both prerequisites to pending. Independent
  review returned GO for the offline repair and commit gate. From commit `f5f7ff4`, Codex passed again,
  while routed Claude failed closed because two MCP broker lifetimes overlapped in the sealed receipt
  stream. A reviewed tool-concurrency repair did not change that failure and was disproved.
  Commit `611a043` added the reviewed inter-profile settlement barrier. Codex passed; routed Claude
  exposed only `gpt-5.6-sol` and completed the read-only exact tool sequence, but its MCP broker did not
  write a terminal before the barrier timed out. The repair now settles a graceful broker signal only
  after its request queue completes; forced termination remains unsettled. Critical digests were
  refreshed. Active-signal coverage closed the first review's NO-GO finding; independent re-review
  returned GO. From clean commit `65bb802`, Codex CLI 0.146.0 and native Claude Code 2.1.220 through
  JM Router both passed their exact authenticated prerequisites on `gpt-5.6-sol`. Claude completed
  both permission profiles and the inter-profile broker settled. Freeze work is now eligible.

## Blockers and risks

- Both prerequisites pass for the current critical bytes. This proves harness readiness, not behavioral
  continuity, conversation reconstruction, or independent model-family replication.
- The Claude surface is the native Claude Code executable
  with a minimal JM Router child environment and direct `gpt-5.6-sol`; Headroom is excluded because
  it would add model-discovery, context-limit, timeout, and compaction policy to the controlled path.
- The candidate remains `status: draft`. A commit, two passed authenticated canaries, frozen status,
  two exact-digest GO attestations, and a permanent first-ADD manifest commit are all still required
  before a scored provider run.
- An escaped process may survive its original process group. Seatbelt denies network and checkout
  writes while permitting only bound scratch writes; unsettled or forced receipt state prevents the
  process from contributing scored evidence. Complete arbitrary-session termination is not claimed.
- Attempt 4's observed contrasts are one item per harness and are not product claims. Routed Claude is
  GPT-backed, not independent model-family replication, and its token accounting remains unavailable.
- Cross-harness behavioral continuity, repeated-switch retention, conversation reconstruction,
  journaling, compaction value, Cursor CLI behavior, and wider external adoption remain unproven.
- Sequential cross-file rename, final executable-check-to-spawn TOCTOU, Windows reparse/hard-link
  depth, sparse/large-index settlement limits, and stale abnormal-termination locks remain explicit
  product or research residual risks.

## Next best task

Commit the passed prerequisite evidence, rerun final offline gates, then set the still-empty candidate
to frozen and produce its exact review digest. Do not write a manifest or score until two GO reviews.
