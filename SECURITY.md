# Security policy

## Supported versions

No production-supported release exists yet. Security fixes currently target the latest alpha branch.

## Reporting

Do not open a public issue for a vulnerability that could overwrite files, escape the repository,
expose private context, or compromise package consumers. Use GitHub's private vulnerability reporting
for this repository when available. If it is unavailable, contact the repository owner privately
before disclosure.

Include the affected version or commit, operating system, minimal reproduction, impact, and any known
workaround. Do not include real secrets or proprietary repository content.

## Scope

High-priority reports include:

- path traversal, symlink, junction, or hard-link escape;
- unintended replacement of content outside managed blocks;
- command or argument injection;
- malicious YAML or Markdown causing code execution or unbounded resource use;
- package provenance or dependency compromise;
- MCP or plugin authority escalation when those features are introduced.

The design assumptions and known residual risks are documented in
[the threat model](docs/threat-model.md).

