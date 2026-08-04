# Current state

## Active objective

Run the exact authenticated Codex and native-Claude-through-JM-Router prerequisites from the reviewed
attempt-5 repair commit before any freeze digest, manifest, or scored provider execution.

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
- Attempt 5 is a committed but unfrozen and unscored draft in `research/continuity-r5`. It has fresh
  identities, pending prerequisites, and empty result surfaces; no predecessor evidence was copied.
- Its three Git policies are integrated across the registry, wrapper, MCP broker, Seatbelt profiles,
  canaries, and screens. Verification has bounded process/output handling, read-only checkouts,
  writable scratch, digest-bound support programs and host Git state, and a sealed broker/invocation
  receipt ledger. Detailed invariants and review history live in the attempt README and engineering log.
- The reviewed draft passed the attempt-5 suite at 116/116, active research at 125/125, the isolation
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
  review returned GO for the offline repair and commit gate.

## Blockers and risks

- Both harness prerequisites are pending after the Claude canary budget correction. The last Codex
  execution passed; the last Claude execution verified the intended catalog and response model but did
  not complete the remaining tools because Claude Code enforced the old cap.
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

From the new clean commit, run Codex first and native Claude through JM Router second. Report any
routed-model, stream, authentication, budget, or tool anomaly and prohibit freeze work until both exact
prerequisites pass.
