# Current state

## Active objective

Execute and review the authorized Attempt-5 scored batch in frozen order while preserving every
terminal outcome and stopping on model, stream, authentication, budget, tool, or receipt anomalies.

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
- Attempt 5 is frozen at permanent manifest boundary `ec27f44` in `research/continuity-r5`. It has
  fresh identities, two passed current-byte prerequisites, and no copied predecessor outcomes.
- Its three Git policies are integrated across the registry, wrapper, MCP broker, Seatbelt profiles,
  canaries, and screens. Verification has bounded process/output handling, read-only checkouts,
  writable scratch, digest-bound support programs and host Git state, and a sealed broker/invocation
  receipt ledger. Detailed invariants and review history live in the attempt README and engineering log.
- The current candidate passes the attempt-5 suite at 122/122, active research at 131/131, the isolation
  canary, Carrylog continuity at 16/16, BusyCafe pytest at 22/22, BusyCafe compileall, product quality,
  package inspection, and package smoke.
- Dedicated owner-only temporary caches were populated once for Carrylog and BusyCafe. All 60 frozen
  cells then passed sealed offline preparation without provider authentication or execution. Carrylog
  and BusyCafe source trees resolved to `69b978b3…93f8d4d4` and `826f6da8…7243613`;
  installed-tool trees resolved to `bc6a4263…aa48f38` and `648fe9f8…aa48f38`. The existing BusyCafe
  worktree was not accessed or modified.
- Canary failures, rejected budget/concurrency hypotheses, and broker-settlement repairs are preserved
  chronologically in the engineering log rather than duplicated in always-loaded context.
- From clean commit `65bb802`, Codex CLI 0.146.0 and native Claude Code 2.1.220 through JM Router passed
  their exact authenticated prerequisites on `gpt-5.6-sol`. Claude completed both permission profiles
  and the inter-profile broker settled.
- Runs `t1-001` through `t1-030` are terminal and privacy-reviewed: 26 are scored; `t1-004`, `t1-005`,
  and `t1-025` are retained harness failures; and `t1-018` is protocol-invalid because Codex used one
  direct shell command outside the registered verification wrappers. None is retried or replaced.
- Blinded evaluations are finalized for every scored artifact. On the completed BusyCafe failed-
  approach fixture for Codex, manual handoff and Carrylog resume each recovered all frozen facts and
  earned 10/10 completion; repository-only recovered 10% of fact weight and earned 4/10. The earlier
  BusyCafe objective comparison likewise separated full manual and Carrylog results from a 15%, 4/10
  repository-only result. These are single-fixture observations, not product-effect claims.

## Blockers and risks

- Both prerequisites pass for the current critical bytes. This proves harness readiness, not behavioral
  continuity, conversation reconstruction, or independent model-family replication.
- The Claude surface is the native Claude Code executable
  with a minimal JM Router child environment and direct `gpt-5.6-sol`; Headroom is excluded because
  it would add model-discovery, context-limit, timeout, and compaction policy to the controlled path.
- Corrected review digest `2e6c778d…b181573` received two independent GO reviews. Suite digest
  `cfb7d9c1…b4bd` is frozen at permanent first-ADD commit `ec27f44`; 30/60 runs are terminal.
- The full cost and time envelope is authorized. Three harness failures and one protocol-invalid run
  cannot be retried or replaced; they remain attrition in the final analysis.
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

Commit the reviewed 30-run boundary, then execute frozen run `t1-031`. Complete quarantine review,
privacy disposition, and blinded evaluation before advancing to each later run.
