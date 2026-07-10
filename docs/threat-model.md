# Threat model

## Assets

- Human-authored project instructions and context.
- Repository integrity and content outside generated blocks.
- Files outside the repository.
- Confidential information present in project documents.
- CI reliability and machine-readable diagnostics.

## Trust boundaries

The user intentionally runs `ackit` in a repository. The repository, configuration, Markdown,
existing adapter files, path names, and symlinks are inputs and may be malformed or malicious.
Node.js, the local operating system, and the installed package are trusted within the normal CLI
execution model.

The current runtime does not make network calls or invoke a model. Package installation still has
the normal npm supply-chain boundary.

## Addressed threats

| Threat | Current control |
| --- | --- |
| `../` or absolute-path writes | Portable relative-path validation plus root containment check |
| Symlink read/write escape | Reject every existing symbolic-link component on managed paths |
| Windows-specific path aliasing | Reserved-name/character validation and normalized separators |
| Case or Unicode path collision | NFC normalization plus case-folded duplicate comparison |
| YAML duplicate keys or alias expansion | Strict parsing, unique keys, bounded alias expansion |
| Existing instruction loss | Refuse unmarked files unless `--adopt`; replace only marked content |
| Partial update after another adapter is invalid | Plan and validate all adapters before writing |
| Torn individual file | Sibling temporary file and rename |
| Prompt-router marker injection through metadata | Single-line bounded metadata and reserved-marker rejection |
| Oversized startup context | Configured hard budget over actual always-loaded characters |
| Oversized/binary config or context | Bounded reads, catalog limits, router budget, strict UTF-8 |

## Residual risks

- Multi-file synchronization is not atomic across process termination, disk-full events, network
  filesystems, or operating-system faults after preflight.
- A repository owner can intentionally place harmful instructions in canonical Markdown; this tool
  validates structure, not truth or intent.
- A hard link is not currently detected as an escape. Normal repository tools rarely create managed
  files as hard links, but inode/link-count checks should be evaluated before beta.
- Files can change between validation and rename (TOCTOU). Preventing this fully requires stronger
  platform-specific filesystem primitives and remains an open design issue.
- Character count is not a tokenizer and cannot predict every model's context cost.
- npm lifecycle and dependency compromise are outside runtime path controls. The project currently
  uses one runtime dependency and a committed lockfile to reduce exposure.
- JSON diagnostics may contain local paths and parser excerpts; CI log handling remains the caller's
  responsibility.

## Security principles for future features

- Git inspection must use direct process argument arrays, bounded output, timeouts, and no shell.
- Handoff generation must never stage or commit files automatically.
- Compaction must keep recoverable history and must not overwrite source material without explicit
  review.
- MCP mutation tools must be opt-in, narrowly scoped, and distinguish reads from writes.
- Remote services and telemetry require a separate threat model and explicit consent.
- Plugin and skill installation must not execute unreviewed scripts implicitly.

## Security test backlog

- Property/fuzz testing for config and managed-marker parsers.
- Hard-link behavior on supported local filesystems.
- Race and failure injection around temporary write, permission copy, and rename.
- Very deep paths, long filenames, large YAML, and large Markdown limits.
- Windows junctions and reparse points in the CI security matrix.
- Malicious Git filenames when handoff snapshots are introduced.
