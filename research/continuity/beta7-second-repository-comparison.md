# Beta.7 second-repository comparison

- Status: attempt 3 frozen; initial six-cell comparison reviewed; 54 runs not started
- Date: 2026-08-02
- Governing decision: `docs/decisions/0012-evidence-gates-before-continuity-expansion.md`
- Product under test: `carrylog@0.1.0-beta.7`

## Purpose

Before resuming the full Tier 1 candidate, run a bounded comparison on the existing BusyCafe fixture
to prove that the current package and available harness routes can prepare and execute the same task
under repository-only, manual-handoff, and Carrylog-resume conditions. This is a setup-feasibility
and directional screen, not a variance pilot. It cannot satisfy the two-repository, five-task Tier 1
gate or expand product claims.

## Fixed comparison

The first comparison uses `r2-busycafe-01-objective` at the exact repository commit already recorded
in `tier1/repositories.json`. Both Codex CLI and Claude Code receive the existing frozen task prompt,
facts, prohibited reversals, completion criteria, and verification registry. Each harness runs once
under each of the three conditions, for six cells total.

These two fixture-harness blocks are the first six entries in the deterministic Tier 1 run order.
Only block order is prioritized; each block retains its preregistered balanced condition permutation.
This permits a valid partial execution through the existing freeze, quarantine, privacy-review, and
evaluation contracts instead of introducing a local bypass mode.

The comparison reports the existing item-level measures separately: relevant-fact recall,
contradictions, prohibited reversals, repeated work, unnecessary clarification, completion,
verification availability, visible latency, visible token or cost data, and unavailable evidence.
It does not calculate a composite score or claim statistical superiority.

## Isolation and source integrity

- BusyCafe's original working directory is read-only evidence and is not a fixture source.
- The runner accepts BusyCafe only through an explicit environment path to a bare repository under
  the system temporary directory. There is no live-worktree fallback.
- Every condition receives a fresh tracked fixture under `/tmp`; ignored files, provider histories,
  private transcripts, production data, and the source repository's mutable Git state are excluded.
- The original repository's recorded HEAD, tracked status, and tracked tree are compared before and
  after the experiment. Existing untracked files are recorded only as a count and path digest; their
  contents are never copied.
- Provider authentication is staged only for the harness process and is never written to the
  fixture, result artifact, or repository.
- One explicit cache root under the system temporary directory owns the npm, uv, and package-tarball
  caches. Host HOME caches are never fallback inputs. Online preparation requires a dedicated empty
  owner-only root claimed exclusively and seals a ready receipt only after success.
  All six offline cells must bind that receipt, repository scope, released tarball, and installed-tool
  tree.
- A global write-once scheduler lock encloses predecessor inspection and run claim. Concurrent later
  runs cannot observe an unchecked gap; an abandoned lock requires explicit operator recovery.

## Harness amendment

The unexecuted Tier 1 candidate names older CLI versions, beta.5, and native Claude Haiku. Those bytes
must not be presented as current beta.7/router evidence. The controlled Claude surface now requests
the gateway's direct `gpt-5.6-sol` model with discovery disabled instead of the load-balancing
`claude-route-codex` alias. It is a distinct harness surface, not an independent model-family
replication.

The installed convenience launcher is unsuitable for controlled evidence because it appends
`--dangerously-skip-permissions`. Controlled runs therefore invoke the native Claude executable
directly. The runner reads an operator-supplied router key file through a bounded, no-follow,
regular-file check, places the secret only in the child environment, keeps Bash and network tools
disabled, and deletes the in-memory environment fields after the child exits. The key path, value,
digest, launcher settings, and provider session are not retained. Before authentication is staged,
the runner binds the complete live gateway catalog record for the requested direct model to its
reviewed digest. Every Claude response must expose the single accepted model `gpt-5.6-sol`; any other
model fails the run instead of introducing an unbalanced condition-level model mixture. The gateway
does not expose `provider_id` on this client surface, so this experiment makes no provider identity
claim. The canary must prove workspace access, external-path denial, registered verification,
unregistered Bash denial, and model-tool network denial before any comparison run.

Both harnesses spawn preregistered native executable bytes by absolute path. Codex launcher discovery
is used only to locate the installed platform binary; the PATH entry and JavaScript launcher are not
spawned. Each native executable is digest-checked during setup and immediately before every harness
spawn. Replacement between that last check and the operating-system spawn remains a narrow TOCTOU
residual risk and must be reported rather than described as eliminated.

Codex continues to use a synthetic `CODEX_HOME`, ephemeral execution, workspace-only permissions,
registered verification tools, and model-tool network denial. Both harness identities and current
critical-file digests must be recorded before execution.

## Gates and interpretation

The first frozen execution attempt is preserved at `research/continuity/tier1` and produced no scored
artifact. Its first execute path failed before claim or provider access because freeze verification
read a later lexical setup-environment binding. Attempt 2 is preserved at
`research/continuity-r2/tier1`; its first claim was written, but a second temporal-dead-zone defect
prevented both artifact and failure-record publication. Neither attempt was repaired or rerun in
place. Attempt 3 lives at `research/continuity-r3/tier1`; every result must identify that suite and its
permanent freeze commit.

1. Update the candidate identities and reset every stale authenticated prerequisite.
2. Pass contract tests, structural validation, cold-online then same-cache offline preparation for
   all six cells, and both authenticated isolation canaries on macOS.
3. Freeze and independently review the complete 60-cell Tier 1 suite, write its manifest, and commit
   that exact manifest and every frozen input before the first of the six provider runs.
4. Execute the six cells without product changes between them.
5. Keep automatic sanitizer output in ignored quarantine until explicit privacy review.
6. Score from reviewed artifacts using the existing item-level codebook.
7. Record setup failures and unavailable measurements instead of replacing or imputing them.

A successful six-cell comparison only permits continuing the full Tier 1 design. A privacy failure,
permission-boundary failure, source mutation, or inconsistent condition construction is a stop and
redesign signal. Conversation replay, native compact portability, semantic compaction, and repeated
switch invariance remain outside this comparison.

Setup-network authorization applies only to dependency and exact-package cache population before a
scored run. Scored execution always disables setup network. Provider API control-plane traffic is a
separate harness requirement; model tools and verification subprocesses remain network-denied.

## Pre-freeze preparation status

An earlier 2026-08-02 preparation passed six offline cells but was superseded as freeze evidence. An
independent review found that the cache root was bounded while pre-existing `artifacts`, `npm`, or
`uv` child links could still escape it, and that the claimed cold-cache lifecycle was not captured in
a machine-checkable receipt. No scored run had started.

The same review found that accepting three possible resolved models could confound a six-cell screen.
Pinning the load-balancing alias first failed once on Terra and once on Sol, proving that an allowlist
could not control allocation. The amendment now requests the gateway's direct `gpt-5.6-sol` model,
disables discovery, and requires every response to retain that ID. Any later drift is a failed
prerequisite or run, not an additional model stratum. No replacement run is permitted.

The corrected pre-freeze preparation used new cache ID
`6695eeeaa6cb152fdb8eb8cd0a9eb25e`. Its exclusive online population produced ready-receipt SHA-256
`98fb0dcdba70c25a8b32e6f99a54ad50e087c8cd60a1ece79f91f808459d3aa2`. All six offline cells
then bound that same receipt, released tarball
`47e3ae98efb3984124ec31d5090db5e1e7b592692942905d996d73a00e657e4e`, source tree
`826f6da85498720f3c6d37963f1765e4c7243613`, and installed-tool tree
`1550d9bf6627ba2f87facd63baf5c5bf42ff71a71a62a1a854c1c8bcc4c0d69c` under Seatbelt network
denial. Subsequent review corrections retained the same sealed inputs and repeated all six offline
preparations. Latest quality measurements and correction history are single-sourced in
`docs/engineering-log.md`; exact canary timestamps, result digests, and critical-file bindings remain
single-sourced in `tier1/harness-prerequisites.json`. Codex currently passes that binding. Claude is
pending because the required operator-supplied router key-file path is absent, so freeze review is
mechanically blocked.

At this historical point the candidate remained `draft-until-committed`; later evidence is recorded
below.

## Attempt 3 freeze and initial six-cell result

Attempt 2 froze at commit `3ff47a617c59f35ed7c41ac411b80517c8fa6907`. Its first execution
wrote the `t1-001` scheduler claim, then reached another lexical temporal-dead-zone defect: artifact
and failure publication referenced the atomic sequence before its declaration. The retained evidence
does not establish whether a provider request occurred, so provider execution is classified as
unavailable rather than inferred. No scored result, privacy review, or evaluation from attempt 2 is
used. The attempt remains immutable.

Attempt 3 was created under `research/continuity-r3/tier1` with a new experiment identifier, blind
IDs, deterministic order, canaries, reviews, and manifest. It froze at commit
`b72127e700b85ad2fb14744355a72e65ee508f79`. The suite digest is
`2427a17f2e0c02415bf7f6604edf026e619f4ff260ac0910336d98986ee2eb9b`; two independent exact-digest
reviews returned GO with no findings. Attempt 3 passed 93/93 suite tests before results existed, and
the repository quality gate passed 462/462 tests with 94.67% line, 96.41% function, and 88.45% branch
coverage. Both authenticated harness prerequisites and all six offline BusyCafe preparations passed
against the frozen bytes.

Runs `t1-001` through `t1-006` completed, passed explicit privacy review, and received blind
item-level evaluations. Frozen verification and analysis reconcile six scored runs, 54 not-started
runs, zero protocol diagnostics, zero exclusions, and no sensitive exposure, contradiction,
prohibited reversal, repeated work, or unnecessary clarification in the reviewed cells.

| Harness | Condition | Relevant-fact recall | Completion |
| --- | --- | ---: | ---: |
| Codex | Carrylog resume | 1.0 | 10 |
| Codex | Repository only | 0.0 | 4 |
| Codex | Manual handoff | 1.0 | 10 |
| Claude Code | Carrylog resume | 0.8 | 7 |
| Claude Code | Repository only | 0.5 | 7 |
| Claude Code | Manual handoff | 1.0 | 10 |

On this one BusyCafe objective fixture, Carrylog recall exceeded repository-only in both harnesses,
matched manual handoff in Codex, and trailed manual handoff in Claude Code. The Claude difference is
supported by one missed state fact (`f4`) and one missed completion criterion (`c2`); the same items
did not regress in Codex. The preregistered STOP rule is therefore not triggered. The analyzer's
interim `REDESIGN` classification is expected while 54 runs are unstarted and is not an early-stop
rule. An independent result audit returned GO to continue the remaining sequence.

Claude metadata reports `input_tokens=0` despite non-empty prompts, nonzero outputs, and positive
cost estimates. This is a router/client observation defect, not evidence of zero input consumption.
The frozen analyzer preserves and displays the raw value, but Claude input and cache-token fields are
treated as unavailable for interpretation. No token- or cost-efficiency claim may use these cells.

Post-result execution of the frozen suite tests passes 92/93. The failing contract copies the entire
suite into a synthetic analyzer fixture but removes reviewed outputs without removing mutable
quarantine outputs, so its expected not-started count changes after real results exist. The failure
does not affect freeze verification, artifact hashes, privacy bindings, scoring, or the analyzer,
all of which pass. The frozen test cannot be patched without invalidating the experiment boundary;
the defect is retained and must be corrected in a future experiment implementation.

These six cells are directional evidence only. They do not establish a complete Tier 1 outcome,
universal continuity, superiority to manual handoff, automatic Skill discovery, checkpoint
authorship, repeated switching, conversation replay, journaling, or compaction value.
