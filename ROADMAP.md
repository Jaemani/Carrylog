# Roadmap

Roadmap order is risk-driven. Dates are intentionally omitted until the alpha is exercised on real
repositories.

## 0.1 alpha — safe deterministic foundation

Implemented:

- versioned canonical configuration;
- progressive always/on-demand document catalog;
- Codex and Claude managed router adapters;
- non-destructive init/adopt/sync behavior;
- drift, budget, path, symlink, and source-overlap validation;
- human and JSON CLI diagnostics;
- cross-platform-oriented test matrix and coverage gates;
- dogfooded project context, architecture, decisions, and handoff.

Remaining before tagging the alpha:

- choose an open-source license;
- add public JSON Schema and schema documentation;
- add Linux/macOS/Windows CI results;
- install and smoke-test the packed tarball in a clean directory;
- establish release signing/provenance and changelog workflow;
- run adoption tests on at least three materially different real repositories.

## 0.2 alpha — verifiable handoff evidence

- `ackit handoff --refresh` managed Git snapshot;
- branch, status, changed paths, bounded diff stat, and recent commit evidence;
- preserve semantic handoff narrative outside the snapshot block;
- handle detached HEAD, no commits, worktrees, submodules, unusual filenames, and missing Git;
- no automatic commit, staging, or model call.

## 0.3 alpha — adapter framework

- formal adapter interface and golden conformance fixtures;
- research-backed Cursor, GitHub Copilot, and Gemini CLI support;
- nested instruction outputs where the target tool defines precedence;
- compatibility metadata and adapter-specific validation.

## 0.4 alpha — freshness and compaction

- document freshness metadata tied to evidence rather than wall-clock age alone;
- deterministic size reporting by load tier;
- archive workflow with reversible moves and link integrity;
- optional tokenizer plugins without making a model tokenizer a core dependency;
- no destructive one-shot summarization.

## Beta gate

- configuration version migration contract;
- documented backward compatibility window;
- complete supported-platform CI and packaged binary smoke tests;
- parser fuzzing and filesystem fault injection;
- performance and memory budgets;
- security review of path, Git, package, and future plugin boundaries;
- real-project feedback showing that handoff reduces reconstruction work;
- code review with no unresolved high-severity findings.

## Post-beta exploration

- agent skills that teach the maintenance protocol without duplicating project memory;
- read-first MCP server for context queries and decision search;
- optional issue-tracker connectors with explicit provenance;
- team policies and dashboards that do not require uploading source context;
- extensible adapter/plugin SDK after a safe trust model exists.

