# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "f64f5df at 2026-07-13T03:10:55+09:00"
- Upstream: "origin/main; ahead 1, behind 0"
- Working tree: Clean (snapshot file excluded)
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (0)

None.

### Recent commits (5)

    {"commit":"f64f5df","committedAt":"2026-07-13T03:10:55+09:00","subject":"research: harden Tier 1 continuity candidate"}
    {"commit":"c9e8c2d","committedAt":"2026-07-12T14:39:51+09:00","subject":"docs: record Carrylog beta5 publication"}
    {"commit":"343b4e3","committedAt":"2026-07-12T14:17:33+09:00","subject":"release: prepare Carrylog beta5"}
    {"commit":"660b0ce","committedAt":"2026-07-12T04:24:45+09:00","subject":"docs: record beta5 candidate CI"}
    {"commit":"243e1d5","committedAt":"2026-07-12T04:22:33+09:00","subject":"feat: add universal Carrylog continuity"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Finish the Tier 1 continuity candidate's authenticated harness and formal review gates without
implementing journaling or compaction.

## Completed

- Built the 10-fixture, 60-run Tier 1 candidate with balanced deterministic order, blind evaluation,
  privacy quarantine/review, immutable source selection, broker receipts, and mechanical Tier 2
  decision rules. No scored or raw result exists.
- Closed authenticated-canary marker spoofing by binding Codex to one immutable exact-command probe
  and Claude results and denials to exact tool-use identifiers, names, and inputs.
- Bound Ajv's lock closure and installed package trees to the frozen analysis surface before any
  validator, analyzer, evaluator, preflight, or manifest path loads it.
- Closed review-gate, capture-time, and post-write manifest races; `--check` repeats the full current
  review, prerequisite, manifest, and permanent first-ADD validation.
- Serialized exclusion writes across processes so concurrent privacy reviews cannot erase another
  safety outcome. Expanded diagnostics to redact paths, JWTs, structured auth, quoted and unquoted
  credentials, and credential-bearing database URLs.
- Completed independent post-fix methodology and security reviews. Both code scopes are GO; these are
  not formal experiment attestations and do not replace authenticated prerequisites.

## Verification

- Current bytes pass the complete 60/60 prepare-only matrix in 182 seconds, the 64/64 research suite,
  deterministic order, 60 blind bundles, structural validation, and local isolation canary.
- The integrated quality gate passes 233/233 tests with 94.74% lines, 96.02% functions, and 89.39%
  branches. Package inspection passes with 148 files and excludes `research/`.
- The final independent security review is GO with 48/48 focused checks. The independent methodology
  review is GO with the manifest, dependency, and exclusion concurrency gates verified.
- The Codex authenticated canary passed before the final redaction-only critical change. Refresh
  correctly reset it; its current-byte rerun reached the provider usage limit and remains pending.
- Claude remains pending because organization policy disables subscription OAuth and no API key is
  available. `--require-passed` and `freeze --review-digest` both fail closed on that state.

## Decisions

- Formal review and manifest creation remain unavailable until both authenticated prerequisites pass
  for the same unchanged critical bytes. No stale provider pass is reused.
- Research dependencies and safety registries are treated as frozen evidence inputs, not ambient
  workstation state. Drift and concurrent uncertainty fail closed.
- Crash-stale exclusion locks are not automatically stolen. Operator-confirmed recovery is preferred
  over silent privacy-result loss.
- Journaling, transcript replay, and semantic compaction remain outside the supported product and
  experiment until ADR-0012's staged behavioral evidence gates are satisfied.

## Risks

- Codex usage capacity and authorized Claude access block current-byte authenticated prerequisites.
- Abnormal termination while holding `exclusions.csv.lock` leaves a fail-closed manual recovery item.
- The final path-to-syscall race cannot be eliminated across a multi-file suite; repeated readback,
  `--check`, and the permanent committed boundary are the layered defenses.
- Cross-harness behavioral continuity, repeated-switch retention, all-record value, conversation
  reconstruction, and compaction superiority remain unproven.

## Next action

After Codex usage resets and Claude access is authorized, refresh once, run both authenticated
canaries, generate a new formal review digest, obtain two independent GO attestations over those exact
unchanged bytes, write and commit the first-ADD manifest, run `--check`, and only then begin scored
execution.
