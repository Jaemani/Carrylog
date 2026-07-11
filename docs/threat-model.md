# Threat model

## Assets

- Human-authored project instructions and context.
- Repository integrity and content outside generated blocks.
- Files outside the repository.
- Confidential information present in project documents.
- Portable resume-envelope confidentiality and integrity.
- CI reliability and machine-readable diagnostics.

## Trust boundaries

The user intentionally runs `carrylog` in a repository. The repository, configuration, Markdown,
existing adapter files, path names, and symlinks are inputs and may be malformed or malicious.
Node.js, the local operating system, and the installed package are trusted within the normal CLI
execution model.

The current runtime does not make network calls or invoke a model. Package installation still has
the normal npm supply-chain boundary.

## Addressed threats

| Threat | Current control |
| --- | --- |
| `../` or absolute-path writes | Portable relative-path validation plus root containment check |
| Symlink or parent-substitution write escape | Reject links; guard existing directory device/inode identity; recheck physical containment and parent identity before staging and rename |
| Windows-specific path aliasing | Reserved-name/character validation and normalized separators |
| Case or Unicode path collision | Conservative NFKC plus multi-step case-normalized comparison |
| YAML duplicate keys or alias expansion | Strict parsing, unique keys, bounded alias expansion |
| Existing instruction loss | Refuse unmarked files unless `--adopt`; replace only marked content |
| Partial update after another adapter is invalid | Plan and validate all adapters before writing |
| Torn individual file | Sibling temporary file and rename |
| Prompt-router marker injection through metadata | Single-line bounded metadata and reserved-marker rejection |
| Oversized startup context | Configured hard budget over actual always-loaded characters |
| Oversized/binary config or context | Bounded reads, catalog limits, router budget, strict UTF-8 |
| Aggregate on-demand context exhaustion during resume | 8 MiB total configuration/document observation budget before a second observation is retained |
| Generated/source path alias | One conservative compatibility/case-normalized ownership graph including copied schema |
| Concurrent human edit or stale loaded config | Exact bounded config re-read at command entry plus expected-content checks before each remaining rename |
| Git repository redirection | Remove inherited repository-selection `GIT_*` variables |
| Git fsmonitor code execution | Force `core.fsmonitor=false` on every Git subcommand |
| Git process/resource abuse | No shell, no prompts, deadline with KILL escalation, combined 1 MiB output |
| Malicious Git filenames, subjects, or repository Markdown | NUL-delimited Buffer parsing, reversible invalid-UTF-8 hex, HTML-aware checkpoint structure, and terminal-safe human/JSON output while preserving parsed JSON values |
| Mixed-time Git evidence | Two observations matching allowed exit codes and exact stdout per attempt, three bounded retries, then fail closed |
| Handoff context inflation | 200-path rendering cap plus prospective file/context-budget validation |
| Resume path substitution, linked export, or same-size overwrite with restored mtime | Guarded handle/path checks over device, inode, size, mtime, ctime, and link count plus symlink and hard-link rejection |
| Mixed-time resume envelope | Config/documents → stable Git → config/documents observation with three bounded retries and exact-byte revalidation |
| Private-session leakage | Resume excludes transcripts, hidden reasoning, provider stores, absolute roots, session IDs, and commit timestamps |
| Generated Skill overwrite | Exactly one standalone ownership marker; no adoption or merge of unowned Skill files |

## Residual risks

- Multi-file writes stage all temporary content before rename, but sequential commit is not atomic
  across process termination, filesystem faults, or races during rename.
- A repository owner can intentionally place harmful instructions in canonical Markdown; this tool
  validates structure, not truth or intent.
- Normal validation and replacement do not reject every hard-linked source. Replacement-by-rename
  does not mutate the linked inode, but non-export reads can still observe linked content. The
  confidentiality-sensitive `resume` export rejects any canonical config or document with link count
  greater than one.
- Parent/content/temporary identity checks narrow but do not eliminate the TOCTOU interval between a
  final check and path-based `mkdir`, temporary creation, or rename. Portable Node APIs do not expose
  directory-descriptor `openat`/`renameat` or atomic compare-and-swap replacement. A detected swap
  prevents managed content commit, but a raced path-based `mkdir` can have an external directory side
  effect before its postcondition fails.
- Character count is not a tokenizer and cannot predict every model's context cost.
- npm lifecycle and dependency compromise are outside runtime path controls. The project currently
  uses one runtime dependency and a committed lockfile to reduce exposure.
- JSON diagnostics may contain local paths and parser excerpts; CI log handling remains the caller's
  responsibility.
- Agents can still place inaccurate or sensitive prose into reviewed checkpoint sections. Carrylog
  validates structure and file identity, not semantic truth or secret classification.

## Security principles for future features

- Git inspection must retain direct argument arrays, sanitized environment, disabled executable
  config, combined output limits, timeouts, and no shell.
- Handoff generation must never stage or commit files automatically.
- Compaction must keep recoverable history and must not overwrite source material without explicit
  review.
- Session journaling, persistent conversation capture, and semantic compaction require a separate data
  retention and privacy threat model before entering the supported runtime.
- MCP mutation tools must be opt-in, narrowly scoped, and distinguish reads from writes.
- Remote services and telemetry require a separate threat model and explicit consent.
- Plugin and skill installation must not execute unreviewed scripts implicitly.

## Security test backlog

- Additional hard-link and reparse-point behavior on supported Windows filesystems.
- Deterministic injection at the exact rename/permission syscalls beyond behavioral fault fixtures.
- Very deep paths, long filenames, large YAML, and large Markdown limits.
- Additional Windows reparse-point variants beyond the directory-junction regression.
- Submodule helper execution and additional executable Git configuration beyond fsmonitor.
