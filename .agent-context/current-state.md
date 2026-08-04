# Current state

## Active objective

Stabilize and independently review the unfrozen attempt-5 continuity pilot, commit its offline draft,
then run the exact authenticated Codex and native-Claude-through-JM-Router prerequisites before any
freeze digest, manifest, or scored provider execution.

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
- Attempt 5 is an uncommitted, unscored draft in `research/continuity-r5`. It has a new namespace,
  run order, blind identities, pending prerequisites, and empty result surfaces. No manifest,
  attestation, earlier result, or frozen identity was copied.
- The draft integrates all three Git policies across registry, wrapper, MCP broker, Seatbelt profiles,
  authenticated canaries, and prepare-only screen commands. Host `/etc/gitconfig` state and every
  copied verification-support program are digest-bound.
- Verification uses bounded combined output, POSIX process-group SIGTERM/SIGKILL escalation, a final
  completion bound, and protocol-fatal handling for forced completion or signal-delivery failure.
- Receipt format 5 records explicit direct-screen or broker-owned invocation lifecycles. An MCP
  invocation can start and terminate only inside the same live broker; direct and broker records
  cannot mix. The stream then seals its prior record count, byte count, and SHA-256. The monitor
  retains the complete observed prefix;
  truncation, rewriting, missing streams, late records, and unsettled lifecycles fail before evidence
  capture.
- Verification checkouts are read-only while scratch remains writable. Python bytecode and pytest
  cache state go to scratch or are disabled, and the registry binds the canonical macOS timezone root
  used through `PYTHONTZPATH` rather than relying on a denied system symlink.
- Review findings to date produced fixes for authenticated discovery coverage, correct silent MCP
  success, forced-containment abort, broker and invocation settlement, sealed append-only history,
  failure-path protocol promotion, late detached-child workspace writes, and broker/invocation
  nesting. Independent re-review returned GO over the corrected 150-file Attempt-5 surface.
- The attempt-5 suite passes 116/116 and the active suite passes 125/125. The non-authenticated
  isolation canary passes. Offline screens pass Carrylog continuity 16/16, BusyCafe focused pytest
  22/22, and BusyCafe compileall with no output. Final `npm run quality`, `npm run pack:check`, and
  `npm run test:package` all exit successfully on the reviewed draft.

## Blockers and risks

- The reviewed draft must be checkpointed and committed before authenticated prerequisites run.
- Both harness prerequisites are pending. The Claude surface is the native Claude Code executable
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

Update the checkpoint and commit the reviewed attempt-5 draft. Only from that clean commit run the
authenticated Codex and native-Claude-through-JM-Router canaries, reporting any routed-Claude model,
catalog, stream, authentication, or tool-use anomaly before considering a freeze.
