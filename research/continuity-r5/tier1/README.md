# Tier 1 continuity pilot

This is the frozen, unscored execution-attempt-5 review candidate. Its exact authenticated canaries
have passed. Review attestations are permitted only for the current digest; manifest creation requires
two matching GO reviews. Scored provider calls remain prohibited until the permanent first-ADD
manifest commit passes its post-commit check. Do not reuse results, attestations, blinded bundles, or
artifacts from an earlier attempt. Attempt 1 is preserved immutably at
`research/continuity/tier1` and freeze commit `382cda0e2a5efb3eca5e487e482c7316d6394617`; it aborted before
claim or provider access. Attempt 2 is preserved immutably at `research/continuity-r2/tier1` and
freeze commit `3ff47a617c59f35ed7c41ac411b80517c8fa6907`; it created the first run claim but could not persist a
terminal record. Neither predecessor contributes a scored result, attestation, manifest, or run
order to this suite. Attempt 3 is preserved immutably at `research/continuity-r3/tier1` and freeze
commit `b72127e700b85ad2fb14744355a72e65ee508f79`; it stopped after 11 scored runs and one delivery
failure with a mechanical REDESIGN result. Its outcomes are reported separately and are not pooled
with this suite.

Attempt 4 is preserved immutably at `research/continuity-r4/tier1`; its freeze identity, attempted
runs, reviews, and results are historical evidence only and are not copied into this candidate.

This directory is the executable, maintainer-run pilot successor required by ADR-0012. It measures the current
checkpoint/resume product; it does not test or authorize transcript replay, automatic journaling, or
semantic compaction.

## Candidate design

- Two repositories: Carrylog and BusyCafe at exact commits.
- Five task families per repository.
- Three conditions: repository-only, manual handoff, and Carrylog checkpoint/resume.
- Two authenticated harness surfaces: Codex CLI and Claude Code through the preregistered route.
- Sixty scored runs in a committed deterministic order.
- Fresh isolated tracked trees, fresh provider sessions, provider control-plane traffic only, and no
  model-tool or verification-subprocess network or production access.
- Run-order-masked item-level scoring; condition blindness is not claimed.
- Released beta synchronization is committed before task handoff installation for every
  Carrylog-resume fixture. Registered commands carry a digest-bound `gitContext`: direct Git commands
  receive detached repository selection, isolated children receive no detached metadata, and the two
  continuity suites use an immutable canonical gitfile to discover read-only outer metadata without
  inheriting broker selection state. Those suites can still create independent nested repositories.
- Registered verification commands receive a read-only checkout and a separate writable scratch.
  Python bytecode and pytest cache output are redirected or disabled, and the canonical physical
  macOS timezone directory is registry-bound for deterministic `zoneinfo` access under Seatbelt.

The initially reviewed offline surface was committed at `844a456`; subsequent failed prerequisites
exposed and preserved the Codex, native-Claude, budget, and broker-lifecycle repairs described in the
engineering log. Both exact authenticated prerequisites now pass from reviewed clean commit
`65bb802`. The unique first commit that adds `freeze-manifest.json` with the complete twice-reviewed
inputs remains the permanent freeze boundary. No scored run may start before that commit and its
post-commit check. Amendments require a new experiment identifier and never overwrite earlier raw
results.

The executable research harness is macOS-only. Product support remains cross-platform; the research
runner depends on macOS Seatbelt and the exact preregistered host toolchain and fails before setup on
another operating system.

## Files

- `preregistration.json`: hypotheses, harness identities, controls, and interpretation rules.
- `repositories.json`: immutable repository and released Carrylog identities.
- `tasks/*.json`: prompts, weighted facts, protected decisions, verification, and rubrics.
- `run-order.json`: deterministic full factorial order.
- `harness-prerequisites.json`: authenticated-canary attestations bound to the exact runner,
  broker, registry, canary, helper, and declared harness configuration bytes.
- `analysis-dependencies.json`: frozen Ajv lockfile closure and installed package-tree digests used
  by validation, evaluation scaffolding, and analysis.
- `analysis/`: validation, execution, sanitization, and descriptive analysis code.
- `raw-quarantine/`: ignored automatic sanitizer output awaiting explicit privacy review.
- `raw-reviewed/`: promoted visible output, verification receipts, diffs, metadata, and privacy
  attestations; only this tracked surface is analyzed.
- `evaluation-bundles/`: frozen, blind-ID keyed rubrics bound to exact task and scoring-codebook
  bytes. They contain no run ID, order, condition, harness, or fixture ID.
- `evaluations/`: canonical item-level blind scoring records bound to artifact and codebook digests.
- `scores.csv`: analyzer-derived aggregate rows; never a hand-edited scoring source.
- `exclusions.csv`: codebook-bound retained failures and protocol exclusions.
- `report.md`: results template; it must report unknown and unavailable evidence explicitly.

Raw provider session stores, hidden reasoning, credentials, ignored source-repository files, `.env`
contents, production payloads, and private transcripts are never copied here.

## Evidence boundary

A router, command receipt, or acknowledgement is delivery evidence. Correct facts are reconstruction
evidence. Preserving decisions, avoiding repeated work, and completing the task are behavioral
evidence. These levels are reported separately and are not collapsed into one utility score.

The pilot is exploratory. A favorable result can justify a larger independently designed Tier 2; it
cannot support a universal conversation-resume or compaction-superiority claim.

The packet is a controlled oracle input frozen before execution. This pilot measures delivery and use
of the complete released Carrylog bundle versus repository-only and manual delivery, not whether
Carrylog can author a semantically correct checkpoint automatically. Carrylog includes canonical
context, router/Skill surfaces, and the verified resume envelope; this is not an isolated
envelope-format comparison. The runner explicitly supplies the envelope, so results also do not prove
that every harness discovers or invokes the generated Skill without a wrapper.

## Execution gates

Run these before freezing:

```bash
node analysis/validate.mjs
node analysis/generate-order.mjs --check
node analysis/isolation-canary.mjs
node analysis/harness-prerequisites.mjs --check
node --test --test-concurrency=1 analysis/tests/*.test.mjs
npm run quality
```

These commands fail closed when the Ajv root requirement, selected lockfile records, dependency
closure, or installed package bytes differ from `analysis-dependencies.json`. Run them from the
frozen checkout after `npm ci`; do not regenerate the dependency snapshot after review.
The repository quality script runs product coverage and this explicitly named active research suite;
immutable predecessor suites retain their frozen evidence but are not mutable release-gate inputs.

If a harness-critical file or declared harness configuration changes, refresh the binding. This
resets stale passed attestations to pending. Then run each authenticated canary through the recorder;
it stores only a fixed result summary, version/model identity, timestamp, and result digest.

```bash
node analysis/harness-prerequisites.mjs --refresh
node analysis/harness-prerequisites.mjs --run --harness codex
node analysis/harness-prerequisites.mjs --run --harness claude
node analysis/harness-prerequisites.mjs --require-passed
```

The authenticated canaries require provider access valid in the isolated synthetic home. Account
quota, disabled organization subscription, or a missing API credential leaves the prerequisite
pending. Raw output, credentials, provider sessions, and private configuration are never written to
the prerequisite file. Both `--review-digest` and `--write` reject a pending or stale attestation.
The Claude canary divides its nine exact probes between two no-persistence processes matching the
scored permission profiles: a USD 0.55 read-only process and a USD 0.20 writable process. Their
integer-cent caps must sum to the USD 0.75 aggregate prerequisite ceiling before provider access. A
process-per-probe design would multiply this ceiling and is not allowed. Each profile must preserve its
registered call order and exact inputs, bind every expected denial and successful result, contain no
additional tool use, and expose an allowed model ID on every assistant event. A lower USD 0.05 cap
became invalid once the router began reporting nonzero estimated input usage.
The two-profile canary does not start its second Claude process until the first process's MCP broker has
written a valid terminal record and every invocation is settled. This bounded barrier uses the same
strict receipt parser as final evidence; timeout, malformed history, an unexpected broker count, or a
sealed stream fails before the next process can start. The ledger contract itself is not relaxed.
The broker writes that terminal after stdin EOF or a graceful `SIGTERM`, `SIGHUP`, or `SIGINT`, but
only after its serialized request queue settles. A forced kill cannot write a terminal and remains an
unsettled failure. This distinction accommodates client-managed MCP shutdown without converting an
active or forcibly terminated command into clean evidence.

Prepare-only runner calls never touch provider authentication or make model calls:

```bash
export CARRYLOG_PILOT_CACHE_ROOT=/tmp/carrylog-tier1-cache
export CARRYLOG_PILOT_BUSYCAFE_SOURCE=/tmp/carrylog-tier1-sources/busycafe.git
node analysis/run.mjs --run-id t1-001 --allow-setup-network
node analysis/run.mjs --run-id t1-001
node analysis/run.mjs --run-id t1-001 --screen-command continuity-tests
```

Both paths are mandatory for BusyCafe preparation. The source must be a bare Git repository under the
system temporary directory; a live worktree, an unset source, a symlink, or a path outside that
boundary is rejected. The online command requires a dedicated empty owner-only cache root that
Carrylog claims exclusively, plus owner-only real directories for artifact, npm, and uv state, and
writes a ready receipt only after successful preparation. Offline reuse requires the same receipt,
repository scope, released tarball digest, and installed-tool tree digest. A failed or interrupted
population is not reusable. Use a separately sealed cache for each repository. Repeat the offline
preparation for all six comparison cells before review. Scored `--execute` rejects
`--allow-setup-network`.

`--screen-command` is an optional prepare-only repair screen for one command registered to the
selected run. It invokes the same bound wrapper and returns only wrapper state, received and retained
byte counts and digests, a bounded TAP aggregate when available, and a blind receipt projection. It
does not retain raw command output, authenticate a harness, create a run claim, or contribute a
score. The R1 continuity repair uses `continuity-tests`; other command IDs must already exist in the
selected run's frozen registry.

Setup dependency traffic is distinct from provider control-plane traffic. During a scored run the
harness may contact only the preregistered provider endpoint; model tools and verification
subprocesses remain network-denied.

After every candidate input is stable, set `preregistration.json` to `status=frozen` before producing
the review digest. `--review-digest` rejects draft candidates and observed results. Give its exact
digest to two independent reviewers, record both GO attestations, then generate the manifest and
commit every frozen input plus the manifest. Any byte change after review invalidates the
attestations. Manifest creation re-reads the reviewed surface before and after writing and verifies
the exact bytes written before returning success. `--check` repeats dependency, prerequisite,
attestation, review-surface, manifest, and permanent-boundary checks. `--execute` refuses frozen
inputs or a manifest that differ from their committed boundary; unrelated worktree paths are outside
that check.

```bash
node analysis/freeze.mjs --review-digest
# Populate review-attestations.json with two GO reviews over that exact digest.
node analysis/freeze.mjs --write
git add research/continuity-r5/tier1 research/continuity-r5/tier1-pilot-protocol.md
git commit -m "research: freeze Tier 1 execution attempt 5"
node analysis/freeze.mjs --check
```

Each completed or failed run first lands in ignored quarantine. A human reviewer must inspect and
promote or reject it before analysis. Approval copies only the exact reviewed bytes and binds the
attestation to their digest. Rejection leaves every quarantined byte in quarantine and writes only a
safe rejection record plus the required exclusion row; the reviewer does not manually delete
`complete.json` or `failure.json`. Exclusion updates use one cross-process lock so concurrent privacy
reviews cannot silently overwrite another safety outcome. An abnormal process termination can leave
that lock behind; treat it as a fail-closed recovery event and confirm that no review writer remains
before removing it.

Run claims use a separate global scheduler lock around predecessor inspection and write-once claim
creation. A concurrent process waits for the active transaction and then rechecks order. A lock left
by abnormal termination is never auto-removed; verify no runner remains before explicit recovery.

Carrylog delivery may temporarily mark the prepared checkpoint `assume-unchanged` so the model and
registered verification commands see a clean source HEAD. Before evidence capture the runner clears
that flag, constructs a new temporary Git index directly from the synthetic delivery baseline, and
compares actual worktree bytes against that independent index. The reset source index is never used
as the scored delta baseline; an unchanged delivery produces no phantom delta and later checkpoint
edits remain observable.

Both harnesses execute absolute native binaries whose SHA-256 digests are preregistered and checked
again immediately before spawn. Codex launcher discovery is used only to locate the platform package;
the PATH entry and JavaScript launcher are never executed by the controlled runner. Claude resolves
the host's native `~/.local/bin/claude` launcher directly and verifies its target bytes, so an
interactive JM Router or other wrapper earlier on `PATH` cannot replace the controlled client.
Claude execution additionally verifies two gateway identities: the live gateway
catalog record digest for the requested direct model, and the resolved model ID exposed by every
assistant response. Gateway discovery is disabled and only the preregistered `gpt-5.6-sol` ID is
accepted; drift aborts instead of being mixed across conditions. The client
surface does not expose the router's internal `provider_id`, so no provider-identity claim is made,
and each final executable-check-to-spawn syscall interval remains a documented TOCTOU residual.
The Codex verification MCP is configured as required, so broker initialization failure terminates the
turn instead of silently presenting a tool-free session.

```bash
node analysis/review-artifact.mjs --run-id t1-001 --reviewer reviewer-1 --approve
node analysis/review-artifact.mjs --run-id t1-001 --reviewer reviewer-1 \
  --reject --reason sensitive-exposure
node analysis/analyze.mjs
node analysis/analyze.mjs --write-derived
```

Generate and validate the frozen blinded rubrics before freeze:

```bash
node analysis/evaluation-bundles.mjs --write
node analysis/evaluation-bundles.mjs --check
```

The evaluator receives one `evaluation-bundles/<blind-id>.json` and the corresponding
`raw-reviewed/blind/<blind-id>/artifact.json`; they do not need `run-order.json`. Create a draft
outside `evaluations/`, replace only judgments supported by explicit retained evidence, validate it,
then finalize it atomically:

```bash
node analysis/scaffold-evaluation.mjs --scaffold --blind-id b-0123456789ab \
  --evaluator reviewer-1 --output /tmp/b-0123456789ab.evaluation.json
node analysis/scaffold-evaluation.mjs --validate \
  --input /tmp/b-0123456789ab.evaluation.json
node analysis/scaffold-evaluation.mjs --finalize \
  --input /tmp/b-0123456789ab.evaluation.json
```

Every available fact, criterion, zero/nonzero count, and negative/positive exposure judgment needs
at least one evidence reference. A determination that clarification evidence is available also needs
an explicit reference. Unavailable items remain null with confidence zero and no affirmative
evidence; the analyzer never shrinks a metric denominator around them.

The analyzer recomputes each approved privacy digest from the promoted allowed bytes. It derives the
permanent first-ADD commit of `freeze-manifest.json` from Git, verifies the committed frozen bytes,
and requires every scored run to name that exact commit and the manifest suite digest. Post-review
mutation, an invented or mixed freeze identity, or an evaluation without that identity is a
protocol-invalid result rather than a score. Quarantined terminal bundles are reported as awaiting
review, and claimed but nonterminal bundles are reported as incomplete instead of not started.

The Tier 2 decision is analyzer-derived. Its 40 contrast vectors are the fixed product of two
harnesses, ten fixtures, and two comparators. A vector is screenable only when all six primary metrics
are finite on both sides. The analyzer emits every STOP, GO, and REDESIGN input and applies the frozen
precedence without a narrative override. Any reviewed Carrylog-resume privacy rejection is a STOP
input regardless of the reviewer's reason code, so a manual classification cannot downgrade a safety
outcome to missingness.

Claude receives no Bash tool. Frozen verification is exposed through a local no-argument MCP tool per
registered command, which invokes the OS-network-denied wrapper. Codex uses a workspace-only
permission profile with model-tool networking disabled; only wrapper receipts count as completed
verification. Any observed direct shell execution, whether successful or failed, terminates the run
as a retained `protocol-deviation` before a blinded scoring artifact is published. Audit evidence
detects Codex started, updated, and completed command lifecycles and gives that deviation precedence
over timeout, nonzero exit, or missing terminal output. Claude Bash uses and their connected results
receive the same treatment. The retained record keeps only bounded byte counts, digests, status, and
exit code rather than raw command, output, malformed JSONL, stderr, or provider-error content. The
Codex profile follows the current official permission-profile filesystem and network model:
<https://learn.chatgpt.com/docs/permissions>.

Verification subprocesses run in an owned POSIX process group with bounded combined output and a
SIGTERM-to-SIGKILL termination path. If an escaped descendant keeps inherited pipes open, the
supervisor settles after a second fixed grace and records `completionForced`. The runner monitors
receipts while the harness is live; forced completion or signal-delivery failure aborts that harness,
publishes no blinded artifact or workspace diff, records only a quarantined protocol failure, and
deletes the temporary fixture even under `--keep`. This fail-closed path does not claim that an
arbitrary process which deliberately creates a new session was killed; it prevents such a process
from contributing scored evidence.

Receipt format 5 is an append-only broker and invocation ledger. Each MCP process records
`broker-start`; each tool call records a digest-bound invocation `start` with origin `mcp-broker` and
the live broker ID before spawning the detached wrapper; matching `terminal` and `broker-terminal`
records settle those nested lifecycles. A prepare-only screen uses explicit origin `direct-screen`, a
null broker ID, and a stream with no broker lifecycle. After the harness and broker finish, the runner
appends one final seal binding every prior record by count, byte length,
and SHA-256. The monitor retains the exact observed prefix, so truncation or rewriting is fatal even
if a later suffix parses. Missing streams, partial JSON, duplicate or mismatched identities, records
after the seal, missing or overlapping brokers, terminal-before-invocation ordering, mixed direct and
broker origins, unsettled lifecycles, and a missing or invalid final seal fail before workspace-diff
capture or artifact publication. A parent failure may therefore leave either a late invocation
terminal or a permanently unsettled start, but it can never resemble clean no-command history.
