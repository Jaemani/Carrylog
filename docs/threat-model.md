# Threat model

## Assets

- Human-authored project instructions and context.
- Repository integrity and content outside generated blocks.
- Files outside the repository.
- Confidential information present in project documents.
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
| Generated/source path alias | One conservative compatibility/case-normalized ownership graph including copied schema |
| Concurrent human edit or stale loaded config | Exact bounded config re-read at command entry plus expected-content checks before each remaining rename |
| Git repository redirection | Remove inherited repository-selection `GIT_*` variables |
| Git fsmonitor code execution | Force `core.fsmonitor=false` on every Git subcommand |
| Git process/resource abuse | No shell, no prompts, deadline with KILL escalation, combined 1 MiB output |
| Malicious Git filenames | NUL-delimited Buffer parsing, reversible invalid-UTF-8 hex, and escaped invisible Unicode evidence |
| Mixed-time Git evidence | Two exact observations per attempt, three bounded retries, then fail closed |
| Handoff context inflation | 200-path rendering cap plus prospective file/context-budget validation |

## Residual risks

- Multi-file writes stage all temporary content before rename, but sequential commit is not atomic
  across process termination, filesystem faults, or races during rename.
- A repository owner can intentionally place harmful instructions in canonical Markdown; this tool
  validates structure, not truth or intent.
- A hard link is not rejected. Replacement-by-rename does not mutate the linked inode, but reads can
  still observe linked content and inode/link-count policy remains a future hardening option.
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

## Security principles for future features

- Git inspection must retain direct argument arrays, sanitized environment, disabled executable
  config, combined output limits, timeouts, and no shell.
- Handoff generation must never stage or commit files automatically.
- Compaction must keep recoverable history and must not overwrite source material without explicit
  review.
- MCP mutation tools must be opt-in, narrowly scoped, and distinguish reads from writes.
- Remote services and telemetry require a separate threat model and explicit consent.
- Plugin and skill installation must not execute unreviewed scripts implicitly.

## Security test backlog

- Hard-link behavior on supported local filesystems.
- Deterministic injection at the exact rename/permission syscalls beyond behavioral fault fixtures.
- Very deep paths, long filenames, large YAML, and large Markdown limits.
- Additional Windows reparse-point variants beyond the directory-junction regression.
- Submodule helper execution and additional executable Git configuration beyond fsmonitor.
