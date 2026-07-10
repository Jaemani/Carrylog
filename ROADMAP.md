# Roadmap

Roadmap order is risk-driven. Stable-release dates remain intentionally unset until the beta is
exercised on external repositories.

## 0.1 beta — deterministic project memory and handoff

Implemented in the `0.1.0` beta line:

- versioned canonical configuration with a public v1 JSON Schema and compatibility contract;
- progressive always/on-demand context catalog with explicit budgets;
- registry-backed Codex and Claude adapters with golden fixtures and non-destructive adoption;
- normalized ownership, traversal, symlink, bounded-read, marker, and drift validation;
- staged atomic file replacement with stale-plan detection and temporary cleanup;
- deterministic Git handoff evidence: branch/HEAD, divergence, status, numstat, paths, commits;
- hostile Git environment, process deadline/output, invalid filename, and fsmonitor controls;
- human CLI contracts for every command and JSON contracts for `validate` and `handoff`;
- deterministic fuzz/property, performance, adoption, package, and three-platform CI design;
- exact clean-build npm artifact and local/ephemeral/global/ESM/TypeScript smoke paths.

Release blockers outside implementation:

- publish the corrected `beta.1` after the `beta.0` tag stopped safely before publication;
- configure protected trusted publishing immediately after the bootstrap publication;
- run registry integrity, provenance, one-off, and global-install verification.

## 0.2 beta — adapter breadth and measured continuity

- research-backed Cursor, GitHub Copilot, and Gemini CLI adapters;
- nested instruction outputs only where official precedence behavior is documented;
- a tool-neutral checkpoint/resume contract that reconstructs verified project and task state without
  claiming to reproduce conversation transcripts or hidden model state;
- opt-in measurement protocol for reconstruction time and handoff usefulness;
- external adoption reports from at least three materially different repositories;
- hard-link and Windows junction/reparse-point policy and tests.

## 0.3 beta — freshness and reversible compaction

- evidence-based document freshness metadata rather than wall-clock claims;
- deterministic size reporting by load tier;
- archive workflow with reversible moves and link validation;
- optional tokenizer plugins without a core model dependency;
- no destructive one-shot summarization.
- no claim to control or reproduce each agent's internal compaction; reversible external project
  memory remains the continuity boundary.

## Stable gate

- beta feedback shows reduced context reconstruction without instruction bloat;
- configuration migration implementation exists before a v2 schema is introduced;
- supported-platform package and registry paths remain green over multiple releases;
- security review has no unresolved high-severity path, Git, package, or plugin findings;
- release provenance and rollback/deprecation procedures have been exercised;
- public API and CLI compatibility commitments are explicit.

## Post-beta exploration

- agent skills that teach maintenance protocol without duplicating project memory;
- read-first MCP server for context queries and decision search;
- optional issue-tracker connectors with explicit provenance;
- team policies and dashboards that do not require uploading source context;
- extensible adapter/plugin SDK after a safe trust model exists.
