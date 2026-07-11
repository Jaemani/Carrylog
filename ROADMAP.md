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
- exact clean-build npm artifact and local/ephemeral/global/ESM/TypeScript smoke paths;
- the historical `@jaemani/agent-context-kit@0.1.0-beta.3` public beta with registry digests,
  provenance, one-off execution, global installation, initialization, and validation evidence;
- Carrylog product/package/CLI identity with a tested beta.3 repository compatibility path that
  preserves configuration v1 wire identifiers.

Post-publication operations before the beta channel is fully hardened:

- publish and verify `carrylog@0.1.0-beta.4` from the renamed repository;
- configure protected trusted publishing and retire the short-lived bootstrap token;
- remove the unintended `latest` dist-tag wherever it points to a prerelease;
- deprecate the old scoped beta with an exact Carrylog migration message;
- prove a later Carrylog beta publishes through OIDC with no registry token.

Delivery and outcome work now takes priority over additional defensive breadth:

- complete the first verified unscoped npm publication and a five-minute source/registry path;
- run the committed Tier 1 checkpoint-continuity pilot before building session journaling;
- dogfood on two additional materially different repositories and publish sanitized adoption notes;
- measure whether users reduce project re-explanation and repeated work;
- revisit positioning and adapter assumptions from evidence rather than registry or standards trends
  alone.

Implemented on the unreleased `0.1.0-beta.5` release-candidate preparation line:

- explicit configuration v2 migration without changing frozen v1 semantics;
- shared Codex/Cursor `agents` surface plus Claude Code and Gemini CLI root routers;
- repository continuity Skills with fail-closed ownership;
- deterministic checkpoint/resume envelope with guarded consistent reads and no transcript parsing.

## 0.2 beta — measured adoption and selective adapter breadth

- authenticated Cursor fresh-session conformance and GitHub Copilot research only where adoption
  demand justifies another surface;
- nested instruction outputs only where official precedence behavior and a user job are documented;
- CI policy mode and a compact, deterministic project-card export for session-journal consumers;
- measure the implemented tool-neutral checkpoint/resume contract without claiming transcript or
  hidden-state reproduction;
- promote the Tier 1 protocol to independent Tier 2 only if the pilot shows useful signal;
- opt-in measurement of reconstruction time, repeated work, handoff usefulness, and user perception;
- external adoption reports from at least three materially different repositories, beginning before
  0.2 feature expansion;
- additional Windows hard-link and junction/reparse-point policy and tests.

## 0.3 beta — conditional freshness and reversible compaction research

- evidence-based document freshness metadata rather than wall-clock claims;
- deterministic size reporting by load tier;
- archive workflow with reversible moves and link validation;
- optional tokenizer plugins without a core model dependency, only if measurement requires them;
- no destructive one-shot summarization;
- no claim to control or reproduce each agent's internal compaction; reversible external project
  memory remains the continuity boundary.

Session journaling, semantic compaction, or compact superiority claims do not enter the supported
runtime until ADR-0012's staged evidence and privacy gates pass. Native resume and native compaction
remain comparison baselines.

## Stable gate

- beta feedback shows reduced context reconstruction without instruction bloat;
- configuration migration implementation exists before a v2 schema is introduced;
- supported-platform package and registry paths remain green over multiple releases;
- security review has no unresolved high-severity path, Git, package, or plugin findings;
- release provenance and rollback/deprecation procedures have been exercised;
- public API and CLI compatibility commitments are explicit.

## Post-beta exploration

- read-first MCP server for context queries and decision search;
- optional issue-tracker connectors with explicit provenance;
- team policies and dashboards that do not require uploading source context;
- extensible adapter/plugin SDK after a safe trust model exists.
