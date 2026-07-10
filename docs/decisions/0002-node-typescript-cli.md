# ADR-0002: Node.js and strict TypeScript for the CLI

- Status: Accepted
- Date: 2026-07-10

## Context

The CLI must be easy to try in AI coding environments, behave consistently on Windows/macOS/Linux,
parse structured config, and support a public package. Candidate foundations were shell, Python,
Rust, Go, and Node.js with TypeScript.

Shell has high portability variance and weak structured-data safety. Python is common but packaging
and interpreter/version isolation add friction. Rust and Go provide excellent single binaries but
increase initial contributor and release complexity. Node.js is already present in much of the target
ecosystem and supports `npx`; TypeScript adds compile-time contracts.

## Decision

Implement the alpha CLI in strict TypeScript targeting Node.js 22+. Use Node's standard library for
CLI parsing, testing, processes, and files. Use one runtime dependency, `yaml`, rather than maintaining
an incomplete parser.

Enforce strict compiler options, including unchecked-index and exact-optional-property checks. Use
Biome for formatting/lint and Node's built-in test runner. Commit the npm lockfile.

## Consequences

Positive:

- low installation friction for the target users;
- mature cross-platform filesystem and package tooling;
- small runtime dependency surface;
- tests require no separate test framework;
- library and CLI contracts can share types.

Negative:

- users without Node need a runtime installation until standalone packaging is evaluated;
- npm supply-chain risk remains;
- Node filesystem behavior still differs by platform;
- Node 22 eventually requires a compatibility transition.

## Rejected shortcuts

- A hand-written YAML subset was rejected as a parsing and security liability.
- A Bash-first MVP was rejected because cross-platform correctness is a product requirement, not a
  later optimization.
- A Rust rewrite is not ruled out, but it needs measured startup, distribution, security, or adoption
  evidence rather than preference.

## Revisit triggers

- Node installation materially limits adoption;
- performance or memory budgets cannot be met;
- secure standalone binaries become a release requirement;
- the runtime dependency or package ecosystem creates unacceptable risk.

