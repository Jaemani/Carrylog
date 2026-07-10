# Engineering log

This log records consequential discoveries, errors, and corrections that should influence future
work. Routine edits and harmless test iteration are intentionally omitted.

## 2026-07-10 — Initial foundation

### Empty remote was confirmed before architecture work

The local workspace contained only `.tokensave` runtime data, and the linked GitHub repository had
no refs or default branch. The project therefore started from a blank baseline instead of assuming
an existing implementation. `.tokensave/` was excluded from version control.

### The proposed `ack` executable conflicted with an established tool

`ack` is already the name of a widely used source-code search CLI. Reusing it would create ambiguous
shell behavior and packaging friction. The executable was named `ackit`; the product name remains
Agent Context Kit. This is recorded in ADR-0004.

### Dependency range and formatter schema drift appeared immediately

The initial manifest requested Biome `^2.2.4`, which correctly resolved to 2.5.3, while the config
still pointed to the 2.2.4 schema. Biome reported the mismatch and a deprecated rule shape. The
configuration was migrated to 2.5.3 and the npm lockfile was committed as the reproducible source.

Lesson: version ranges are useful for compatibility testing, but tool-owned schemas must match the
resolved lockfile. CI must use `npm ci`, not infer behavior from the requested minimum.

### Strict TypeScript and a style recommendation disagreed

`noPropertyAccessFromIndexSignature` correctly required bracket access for dynamically parsed CLI
values. Biome's `useLiteralKeys` suggested changing those accesses back to dot syntax. Type safety was
kept and the conflicting informational lint rule was disabled explicitly; compiler safety was not
weakened to satisfy a style preference.

### Cross-platform path validation needed more than traversal checks

The first path policy covered absolute paths, `..`, separators, and symlinks. Review identified case
folding, Unicode normalization, Windows reserved devices/characters, and adapter/source aliases as
additional portability risks. These became validation rules and regression tests before the first
commit.

### Multi-output safety required preflight, not just atomic writes

Atomic rename protects one file, but it does not prevent `AGENTS.md` from changing before a malformed
`CLAUDE.md` is discovered. Sync was structured to plan every adapter before writing any adapter. A
regression test verifies the first output remains untouched when a later output is unmanaged.

### Claims were kept narrower than implementation

Per-file replacement is atomic on supported local filesystems, but the system does not claim a
cross-file transaction, semantic freshness validation, exact token counting, or production-ready
adapter conformance. These limits are explicit in the README, architecture, threat model, and roadmap.

### Package smoke testing exposed an unsafe global-cache assumption

The first clean-package smoke run failed because the machine's global npm cache contained root-owned
files left by older npm behavior. Changing ownership with `sudo` would have repaired one workstation
but hidden the test's environmental coupling. The smoke harness was changed to use a fresh temporary
npm cache and remove it afterward. This makes the test reproducible in CI and avoids mutating user
configuration. The isolated retry also confirmed that a clean install needs registry access; the
sandbox blocked DNS as expected. External subprocesses now have a two-minute timeout so registry or
process failures cannot hang the harness indefinitely.

The later release-candidate pass found that the public `pack:check` command still used the global
cache even though the clean-install harness did not. It was replaced with an isolated dry-run script
that also asserts the package contains compiled output and excludes source, tests, and internal scripts.

## 2026-07-10 — First large-change review

The review was performed after the first complete implementation rather than treating passing tests
as completion. It found the following material issues before the initial commit:

1. `initProject` trusted its TypeScript input at runtime. JavaScript consumers could pass an empty
   adapter list or invalid name and receive a context layer that failed its own loader. Initialization
   now decodes its proposed v1 config before planning any write.
2. File reads were unbounded and decoded invalid UTF-8 with replacement characters. Config is now
   limited to 1 MiB, context documents to 1 MiB during validation, other managed text to 5 MiB, and
   invalid UTF-8 or non-regular files fail with explicit diagnostics.
3. A project entered through a symlink did not canonicalize the root itself. Root paths now resolve to
   their physical directory before discovery and managed-path checks.
4. `sync` computed empty-document warnings but discarded them. Warnings are now returned through the
   library result and printed by the CLI.
5. Only loaded document bodies had a context budget. A huge catalog could still produce a huge startup
   router. Version 1 now has `maxAdapterCharacters`, plus document, adapter, and trigger count ceilings.
6. Public functions were exported without their named TypeScript option/result types. The public index
   now exports those contracts for downstream integrations.
7. A regression test showed that validation classified a file with only one remaining managed marker
   as unmanaged. That diagnosis could incorrectly suggest `--adopt`. Only files with neither marker
   are now unmanaged; partial markers flow through integrity validation and report damage.

Each finding received regression coverage. Remaining filesystem race, cross-file transaction, hard-link,
and exact-token limitations stay explicit rather than being mislabeled as solved.

## 2026-07-10 — First remote CI matrix

The initial GitHub Actions run passed package smoke plus both Node versions on Linux and macOS, but
both Windows jobs failed before typecheck because Git checked text files out with CRLF while Biome's
canonical formatter expected LF. Local tests could not reveal checkout conversion behavior.

The repository now defines `* text=auto eol=lf` in `.gitattributes`. This makes the source artifact
identical across checkout platforms while runtime CRLF behavior remains covered explicitly in managed
adapter tests. The fix addresses the repository contract instead of weakening formatter checks on
Windows.

The successful rerun still emitted infrastructure warnings: Actions v4 used deprecated Node 20
internals, and `macos-latest` was scheduled to move to macOS 26. Dependabot confirmed current majors
`checkout@v7` and `setup-node@v6`; main adopted them and pinned the matrix to `macos-15` for a stable
alpha baseline.

A separate Dependabot proposal jumped TypeScript 5.9 to 7.0 and `@types/node` 22 to 26. Its Linux
typecheck showed that TypeScript 7 no longer implicitly loaded the Node types in this setup. The
project now declares `types: ["node"]` explicitly, but the major compiler/runtime-type upgrade remains
a separately reviewed change rather than being folded into CI maintenance. Dependabot now ignores
major updates for TypeScript and `@types/node`; the latter intentionally stays aligned with the
minimum supported Node 22 API surface.

The current Actions major tags were resolved to their upstream commits and pinned by SHA with version
comments. Dependabot can still propose reviewed SHA updates, while an upstream tag move cannot alter
CI execution silently.

## 2026-07-10 — Beta compatibility and handoff hardening

### Strict schema compilation exposed incomplete local contracts

The first schema used constraints such as `maxLength` inside conditional branches without repeating
the local string type. Strict Ajv correctly rejected the ambiguous shape. The schema was rewritten
with complete direct contracts, then runtime/schema corpus tests were added instead of weakening
strict compilation.

Review then found two opposite compatibility errors: the schema rejected 1,025-character paths while
runtime accepted them, and runtime silently trimmed strings that the schema evaluated raw. Runtime
now enforces the documented 1,024-Unicode-character path ceiling and rejects surrounding whitespace.
Unicode length checks use code points so astral characters behave like JSON Schema length.

### The copied schema introduced a new path owner

Initial integration treated `config.schema.json` as just another sync output. An adapter or document
could claim the same exact/case-normalized path, causing sequential writes to corrupt one owner. A
single normalized ownership graph now covers config, copied schema, documents, and adapters before
any plan is committed.

### Porcelain paths contradicted normal Git status behavior

A monorepo test showed `status.relativePaths=true` did not produce project-relative paths. Git
porcelain v1 intentionally ignores that user-facing setting and reports repository-root paths. The
implementation now reads Git's worktree prefix and strips it losslessly; rename sources outside the
project are explicitly marked repository-relative.

### Disabling fsmonitor on only `git status` was insufficient

The first security pass set `core.fsmonitor=false` on status. An executable fixture still ran because
the parallel cached diff also consulted the index. The override now prefixes every Git subcommand.
The test remains as a regression against partial command-by-command hardening.

### Process limits needed combined accounting and forced escalation

The initial runner capped stdout and stderr separately and relied on one SIGTERM timeout. It now
enforces one combined byte ceiling, records the first termination cause, sends TERM followed by KILL,
and distinguishes unavailable, timeout, output, signal, format, and encoding failures. Invalid UTF-8
path bytes remain reversible instead of collapsing to replacement characters.

### Prospective validation prevented handoff from invalidating its own project

Two hundred long Git paths could expand an always-loaded handoff beyond its configured budget. The
command now validates an in-memory override before writing. Standalone marker parsing also lets human
prose mention marker text without accidentally transferring ownership.

### Atomic rename did not prevent stale-plan loss

Per-file atomic replacement could still overwrite a human edit made after preflight. Writes now stage
the entire batch, verify expected output and config source content, and only then begin rename. Tests
cover stale config/output, non-regular later targets, cleanup, and unchanged earlier files. The final
read-to-rename race and sequential cross-file commit limitation remain explicit.

### Package tests were widened from a local binary smoke

The original tarball test installed locally and invoked a known compiled path. It now starts from a
clean build, proves packed `dist` exactly corresponds to `src`, and exercises local npm binary,
ephemeral npm exec, global install shim, ESM API, TypeScript declarations, init, and validation. The
release path records one tarball SHA-256 and publishes that same artifact.

### Official documentation lookup had a verifiable tooling failure

The Codex manual helper rejected its response because the expected `x-content-sha256` header was
missing. The official developer manual endpoint was then queried directly, and the official docs MCP
was added for future sessions. Adapter behavior was recorded only from official Codex and Claude Code
sources; unsupported nested/override behavior remains out of scope.

### npm distribution prerequisites were verified without publishing

The scoped package name is unregistered, the authenticated npm account matches the scope, email is
verified, and account 2FA is in `auth-and-writes` mode. The beta dist-tag/public/provenance policy and
trusted-publishing workflow are prepared. Publication remains deliberately blocked because no license
grant has been selected.

## 2026-07-10 — Beta large-change review returned NO-GO

An independent read-only review was run after the schema, handoff, packaging, and release changes had
been integrated. It found no P0 issue, but it returned NO-GO with two P1 and two P2 findings. Passing
tests were not treated as sufficient evidence to release.

### A frozen object was not necessarily a current object

`LoadedProject` was deeply frozen and checked against its original source, but command entry did not
re-read the configuration file. A caller that loaded once, changed `config.yaml`, and then called
validate, sync check/dry-run, or handoff check/dry-run could receive a result based on stale policy.
Write mode caught the change only when drift led to the final write precondition.

The snapshot assertion is now asynchronous and re-reads the exact configuration with the same
symlink, regular-file, UTF-8, and one-MiB boundaries used by loading. In-memory forgery remains
`E_PROJECT_SNAPSHOT`; a changed or inaccessible on-disk source is
`E_CONCURRENT_MODIFICATION`. Regression tests cover no-drift, check, dry-run, normal, missing,
oversized, and symlinked configuration states.

### File content did not identify its parent path

Expected-content comparison protected a target from a normal concurrent edit, but the parent
directory could be renamed and replaced with a symlink after preflight. The later sibling temporary
write was still path-based and could be redirected outside the repository.

The write boundary now carries root and directory device/inode guards, records initially missing
parents, checks physical containment, and verifies parent and temporary-file identity immediately
before staging and rename. Preconditions are rechecked before each remaining commit. Cleanup refuses
to follow a temporary path after its parent becomes untrusted. A deterministic parent-substitution
test verifies that no managed content reaches the external directory. ADR-0007 records the remaining
Node.js `openat`/`renameat` limitation rather than claiming the final syscall window is eliminated.

The first implementation of these guards exposed two useful integration failures. Guards for several
new files all expected `.agent-context/` to be absent, so later stages initially mistook the batch's
own directory creation for an external change. Then every target precondition was rechecked after the
first target had committed, so the batch mistook its own new file for a stale plan. The fixed protocol
validates all original guards before staging and rechecks only uncommitted target expectations during
the commit loop.

### Parallel Git commands could describe different repository moments

Branch, HEAD, status, numstat, and log were previously gathered concurrently once. An index update,
worktree write, or commit during that window could create internally inconsistent evidence. Each
attempt now gathers two complete observations and compares every exit code, stdout, and stderr.
Mismatch retries up to three times; continuous change fails with
`E_GIT_CONCURRENT_MODIFICATION`. Deterministic injected-runner tests prove both stable retry and
bounded failure.

### Untrusted Unicode needed safe evidence rendering

Valid Git filenames and commit metadata may contain Unicode line separators, bidirectional controls,
or other invisible format characters. Raw `JSON.stringify` can leave some of them literal, which can
visually spoof evidence or interact with standalone marker detection. Rendered evidence now escapes
control, format, line, and paragraph separator code points using JSON Unicode escapes. Parsing the
line still recovers the original value exactly.

### Package execution semantics differed across npm versions

The expanded smoke test initially invoked `npx --yes <tarball> --version`. The installed npm client
treated the tarball path as the executable and failed with exit 126. The stable form explicitly uses
`--package <tarball> -- ackit --version`, which both identifies the exact artifact and names the binary.
The smoke also verifies shell-free npm/npx discovery, local and global binaries, the Windows command
shim, ESM runtime exports, TypeScript declarations, init, and validate.

The fourth review finding was the stale handoff narrative itself: it still described 46 tests and
listed schema and handoff as future work. The human-authored section is replaced only after final
verification so it records the actual reviewed tree and exact gates rather than another intermediate
claim.

The follow-up review found no remaining P0, P1, or P2 code defect and confirmed that the original
stale-snapshot, parent-substitution, mixed-Git-observation, and Unicode findings were resolved. It
withheld GO for one evidence-freshness issue: the handoff snapshot and the word “final” predated two
late hardening edits. The tree was frozen, the complete quality, package, dogfood, and audit gates were
rerun, and handoff evidence was refreshed last. This ordering is now part of the release handoff rather
than an informal convention.

### Windows global shim required verbatim command-line ownership

The first beta remote matrix passed all quality jobs and every Linux/macOS package job, but the
Windows package smoke failed while invoking the globally installed `ackit.cmd`. The harness had built
the correct `cmd.exe /d /s /c` quoting shape, then Node's default Windows argument encoder quoted that
already-complete command line again. `cmd.exe` received leading literal escaped quotes and reported the
shim as an unknown command.

The harness still uses `shell: false`. Its dedicated Windows boundary now rejects command-shell
metacharacters and opts into `windowsVerbatimArguments` only for the fully constructed, restricted
`cmd.exe` invocation. This assigns quoting ownership to one layer instead of weakening the smoke test
or bypassing the installed shim.

The complete rerun (`29076427983`) passed all ten jobs. That includes Node 22/24 quality on Linux,
macOS, and Windows; package smoke on all three operating systems; and a separate Ubuntu package run on
the exact minimum supported Node.js 22.0.0. The Windows job invoked the installed global `.cmd` shim,
so the rerun verified the failed boundary rather than only retesting a compiled JavaScript path.

## 2026-07-10 — MIT release authorization and protected environment

The repository owner explicitly selected the MIT license for the first public beta. The canonical
license names `Jaemani` as the 2026 copyright holder. Package metadata declares SPDX `MIT`, and
`docs/license-policy.json` records SHA-256
`a6549ea6479008f9f2e10fe44c7e068aa0442d012687893f1c3b4cc2d73a4f86`; release verification rejects
metadata or license-text drift.

GitHub environment `npm` was created with `Jaemani` as a required reviewer and self-review permitted
for the solo-maintainer workflow. The environment did not contain `NPM_TOKEN`. Because the scoped
package is not yet registered, first publication may require a short-lived package-scoped granular
token. The token must be stored only as the protected environment secret, then removed and revoked as
soon as npm trusted publishing is configured for subsequent OIDC-only releases.

Licensed commit `19232ef` passed all ten jobs in CI run `29076951474`. A clean local
`npm run release:verify` also passed: license hash/policy, quality and coverage, dogfood sync/validate,
package contents, exact-artifact install modes, and runtime audit. The locally verified tarball had
SHA-256 `e3179b7853b9083acf3297b50b5e47102e023a094f7e84ad3d8534fd15f06ca5`; the release workflow will
record and publish its own exact artifact from the final tagged commit rather than relying on this
local build.
