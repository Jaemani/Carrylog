# Beta.7 second-repository comparison

- Status: design amendment; no comparison result has been generated
- Date: 2026-08-02
- Governing decision: `docs/decisions/0012-evidence-gates-before-continuity-expansion.md`
- Product under test: `carrylog@0.1.0-beta.7`

## Purpose

Before resuming the full Tier 1 candidate, run a bounded comparison on the existing BusyCafe fixture
to prove that the current package and available harness routes can prepare and execute the same task
under repository-only, manual-handoff, and Carrylog-resume conditions. This is a setup and variance
pilot. It cannot satisfy the two-repository, five-task Tier 1 gate or expand product claims.

## Fixed comparison

The first comparison uses `r2-busycafe-01-objective` at the exact repository commit already recorded
in `tier1/repositories.json`. Both Codex CLI and Claude Code receive the existing frozen task prompt,
facts, prohibited reversals, completion criteria, and verification registry. Each harness runs once
under each of the three conditions, for six cells total.

The comparison reports the existing item-level measures separately: relevant-fact recall,
contradictions, prohibited reversals, repeated work, unnecessary clarification, completion,
verification availability, visible latency, visible token or cost data, and unavailable evidence.
It does not calculate a composite score or claim statistical superiority.

## Isolation and source integrity

- BusyCafe's original working directory is read-only evidence and is not a fixture source.
- The exact BusyCafe commit is fetched into a temporary source clone under `/tmp`.
- Every condition receives a fresh tracked fixture under `/tmp`; ignored files, provider histories,
  private transcripts, production data, and the source repository's mutable Git state are excluded.
- The original repository's recorded HEAD, tracked status, and tracked tree are compared before and
  after the experiment. Existing untracked files are recorded only as a count and path digest; their
  contents are never copied.
- Provider authentication is staged only for the harness process and is never written to the
  fixture, result artifact, or repository.

## Harness amendment

The unexecuted Tier 1 candidate names older CLI versions, beta.5, and native Claude Haiku. Those bytes
must not be presented as current beta.7/router evidence. The current local Claude route uses an
Anthropic-compatible gateway backed by GPT. It is a distinct harness surface, not an independent
model-family replication.

The installed convenience launcher is unsuitable for controlled evidence because it appends
`--dangerously-skip-permissions`. Controlled runs therefore invoke the native Claude executable
directly. The runner reads an operator-supplied router key file through a bounded, no-follow,
regular-file check, places the secret only in the child environment, keeps Bash and network tools
disabled, and deletes the in-memory environment fields after the child exits. The key path, value,
digest, launcher settings, and provider session are not retained. The canary must prove workspace
access, external-path denial, registered verification, unregistered Bash denial, and model-tool
network denial before any comparison run.

Codex continues to use a synthetic `CODEX_HOME`, ephemeral execution, workspace-only permissions,
registered verification tools, and model-tool network denial. Both harness identities and current
critical-file digests must be recorded before execution.

## Gates and interpretation

1. Update the candidate identities and reset every stale authenticated prerequisite.
2. Pass contract tests, structural validation, deterministic preparation for all six cells, and both
   authenticated isolation canaries.
3. Commit the exact comparison inputs before the first provider run.
4. Execute the six cells without product changes between them.
5. Keep automatic sanitizer output in ignored quarantine until explicit privacy review.
6. Score from reviewed artifacts using the existing item-level codebook.
7. Record setup failures and unavailable measurements instead of replacing or imputing them.

A successful six-cell comparison only permits continuing the full Tier 1 design. A privacy failure,
permission-boundary failure, source mutation, or inconsistent condition construction is a stop and
redesign signal. Conversation replay, native compact portability, semantic compaction, and repeated
switch invariance remain outside this comparison.
