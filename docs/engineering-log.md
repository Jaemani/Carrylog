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

## 2026-07-10 — The first protected release stopped on an npm 12 envelope change

The `v0.1.0-beta.0` workflow run `29080114878` passed all three tagged operating-system preflights and
waited for the required `npm` environment approval. The protected publish job then failed during
`npm run release:verify`, before token configuration and before `npm publish`. Registry checks
confirmed that no package version or dist-tag was created.

The release job intentionally pins npm 12.0.0, while the previously passing local and matrix checks
used npm 10 or 11. npm 10/11 represents one package as a one-element JSON array from `npm pack
--json`; npm 12.0.0 represents it as an object keyed by package name. Package inspection asserted the
older envelope directly. Independent review also found the same assumption in release artifact
construction and non-release package smoke, so repairing only the first failure would have exposed a
second failure later in the same workflow.

One strict parser now normalizes only those two single-package envelopes for all three consumers. It
rejects empty or multi-package output, wrong package keys, identity/version mismatch, unsafe artifact
filenames, duplicate or malformed file entries, inconsistent counts, invalid sizes, and malformed
integrity metadata. Regression fixtures cover both accepted envelopes and the rejected matrix. Real
npm 10.9.8, npm 11.10.1, and npm 12.0.0 pack and installation paths passed locally. CI now contains an
exact Node.js 24.15.0/npm 12.0.0 release-toolchain contract, and tagged preflight pins npm 12 on every
supported OS.

The pushed `beta.0` tag is not moved: doing so would weaken Git and provenance auditability. The
unpublished correction advances package and lockfile metadata to `0.1.0-beta.1` and receives a new
reviewed tag.

The first complete correction gate exposed a separate test-maintenance error: the CLI version test
hard-coded `beta.0`, so the valid `beta.1` output failed. The test now compares CLI output with the
checked-in package manifest exactly. This preserves the version contract without requiring a manual
test rewrite for every prerelease increment.

Independent final review returned GO with no unresolved P0, P1, or P2 finding. It rechecked both npm
envelopes, strict artifact metadata validation, all three consumers, exact-toolchain CI and tagged
workflow semantics, immutable tag/version policy, documentation consistency, and the future resume
boundary. The managed handoff snapshot was refreshed after the review's only evidence-freshness note.

Commit `06f9b9c` then passed all eleven jobs in CI run `29081191523`. The new exact Node.js
24.15.0/npm 12.0.0 job passed alongside Node 22/24 quality on Linux, macOS, and Windows; package smoke
on all supported operating systems; and the exact minimum Node.js 22.0.0 path. A clean exact-toolchain
`npm run release:verify` passed on the same commit and produced a 117-file artifact with SHA-256
`667c6833f73ef7075cff662ce958beb1f2c038e5bea8feee3fdb663cfcf01c08`. The final tagged commit will
rebuild and record its own artifact after this verification record is committed.

## 2026-07-10 — Universal resume was bounded to explicit project state

The future cross-agent resume goal is a one-command user experience, not a claim that every coding
agent can share hidden session state. An initialization command may create the canonical context
directory and supported tool adapters; a future checkpoint/resume contract may reconstruct verified
project objective, decisions, Git evidence, risks, and next work for Codex, Claude Code, Cursor, and
other researched adapters.

Internal conversation state and compaction remain owned by each agent. Agent Context Kit can provide
an external, reviewable checkpoint that survives those policies, but it must not claim lossless
transcript or reasoning restoration. Optional model-assisted transcript summarization would be a
separate, opt-in, non-deterministic layer with explicit privacy, cost, and quality policy.

## 2026-07-10 — npm 12.0.0 shipped an incomplete provenance bundle

The `v0.1.0-beta.1` workflow run `29081480644` passed npm 12.0.0 package preflight on Linux, macOS,
and Windows. After protected-environment approval, exact artifact construction and smoke testing also
passed. `npm publish --provenance` then stopped before a registry request with
`Cannot find module 'sigstore'` from npm's bundled `libnpmpublish`.

A fresh isolated install reproduced the package defect: npm 12.0.0 bundles `libnpmpublish` 12.0.0,
whose manifest requires `sigstore` 5, but npm's published bundle does not include that transitive
dependency. Installing `sigstore` beside npm or patching the runner filesystem would hide the broken
release client and create an unsupported module-resolution dependency, so neither workaround was
accepted. Registry checks remained E404; `beta.1` was not partially published and its tag is preserved.

npm 11.18.0 supports the pinned Node.js 24.15.0 runtime, includes `sigstore`, and loads its provenance
implementation successfully. Tagged preflight and protected publication now pin that exact client.
A dedicated script verifies npm identity/version and loads `libnpmpublish`'s provenance module before
package gates. CI still installs npm 12.0.0 afterward to retain package-keyed JSON compatibility
coverage without treating its broken provenance path as release-capable. The correction advances to
the new immutable `0.1.0-beta.2` version and tag.

Follow-up review identified two release-boundary hardening opportunities. The client check now proves
that `sigstore` resolves inside the pinned npm installation, so an ambient global module cannot hide
another incomplete bundle. Workflow-level OIDC permission was also removed: only the protected
publish job receives `id-token: write`, while all preflight jobs retain read-only repository access.

Local beta.2 verification passed 111 tests, the npm 11.18.0 provenance/root contract, and complete
package smoke on the exact Node.js 24.15.0 release runtime. npm 12.0.0 separately passed package
inspection and every install mode. Independent review found no remaining P0, P1, or P2 code or
workflow issue; its final requested correction was refreshing handoff evidence and recording the
latest observed coverage rather than retaining a prior run's higher function/branch values.

## 2026-07-10 — A bare tarball argument was parsed as GitHub shorthand

The `v0.1.0-beta.2` workflow run `29082832556` passed tagged preflight on Linux, macOS, and Windows.
The protected job then passed the pinned npm provenance-client check, all 111 tests, dogfood
sync/validation, exact artifact construction, artifact smoke, and runtime audit. Its 117-file,
86,453-byte tarball had SHA-256
`120698432c03121c143628a93eb1ca61b7eb093b5a0a81a1e2cde330085db66a`.

The subsequent command used `npm publish release/*.tgz`. Bash expanded the glob, but the resulting
`release/jaemani-agent-context-kit-0.1.0-beta.2.tgz` still lacked an explicit or absolute local-path
prefix. npm's package-spec parser treated the slash-containing value as GitHub shorthand and ran
`git ls-remote` against `ssh://git@github.com/release/jaemani-agent-context-kit-0.1.0-beta.2.tgz.git`.
That lookup failed with exit 128 before a registry request. The scoped package remained E404.

Adding only `./` would repair this instance but retain shell glob expansion and bypass the reviewed
artifact record. The correction instead reads `release/artifact.json`, requires exactly its one
regular tarball, checks package, version, workflow commit, filename, size, SHA-256, registry SHA-1,
and SHA-512 integrity, and invokes npm without a shell using one absolute package-spec path. A real
`npm publish --dry-run` for that absolute path now runs in package smoke, including a directory name
with spaces and the exact npm 11 release client. npm 10 returns a direct artifact object from this
command while npm 11 returns a package-keyed object; both observed envelopes are accepted before
identity and digest comparison. npm 12 still cannot load its publish command, even with provenance
disabled, because of its already documented missing `sigstore`; it remains a pack/install
compatibility client. Unit cases reject malformed, ambiguous, redirected, mismatched, or tampered
artifact state before npm invocation.

The pushed `beta.2` tag remains immutable audit evidence. The unpublished correction advances to
`0.1.0-beta.3`; rerunning the old tagged workflow would only execute the old release code and is not
an accepted recovery path.

Two independent reviews examined the frozen beta.3 tree. The code/security review checked the
shell-free npm boundary, artifact selection and digest contract, error behavior, Windows and
space-containing paths, and residual path-reopen risks. The release review independently checked
version and annotated-tag immutability, workflow permissions and npm-client separation, real dry-run
coverage, documentation, and handoff consistency. Both returned GO with no unresolved P0, P1, or P2
finding.

Commit `65230d8` passed all eleven jobs in CI run `29093006551`, including Node 22/24 quality on
Linux, macOS, and Windows; package publish-dry-run smoke on every supported operating system and the
exact minimum Node.js 22.0.0; and the exact npm 11 release/npm 12 package contract. Clean isolated
Node.js 24.15.0/npm 11.18.0 release verification then passed all 115 tests, dogfood checks, package
inspection, exact-artifact publish dry-run and consumer smoke, and runtime audit. Its 117-file,
87,957-byte local artifact had SHA-256
`6b531fedc49f621dc7e58561f14fbd2126f698ef26ffa44708452451549d2fee`; the final tagged commit and
protected workflow will each rebuild and identify their own exact artifact.

## 2026-07-10 — The first public beta required explicit post-publication hardening

Commit `d99f92f` passed all eleven jobs in CI run `29093271158` and was tagged once as
`v0.1.0-beta.3`. Release run `29093394523` passed all three exact npm 11.18.0 preflights. Its first
protected publish attempt then received `EOTP` because the bootstrap granular token did not bypass
the account's publication 2FA policy. Repeated registry checks found no npm version or dist-tag, but
the failed attempt had already written signed provenance to the transparency log at index
`2138015276`. The failure therefore had no registry publication but did have an irreversible external
provenance side effect. The token was replaced with a short-lived credential that combined the
required package scope with unattended write-2FA capability; no source, workflow, dependency,
artifact, tag, or version changed. Attempt 2 of the same immutable workflow was accepted as an
authentication-only rerun rather than disguising a release defect behind a moved tag.

Attempt 2 published `@jaemani/agent-context-kit@0.1.0-beta.3` with provenance. Registry visibility
converged after roughly four minutes and the workflow's bounded retry then passed. Independent checks
matched the 117-file, 88,163-byte registry artifact to SHA-256
`558578c96a8716a758755eb06b34e106a720175dbff626b1c10fbde28799c095`, SHA-1
`fbe73b9fd0cf8140acc63fc3e08e8be786aec140`, and SHA-512 integrity
`sha512-m1NmD8cKih+dqLns96ynuEl4Tu6SkvusLtQzBIlyXX1WLTyOE6XeSaqnBxneJ1lhpD6B6MynYHJNAny6e8hF1Q==`.
The SLSA statement identifies `Jaemani/Agent-Context-Kit`, `.github/workflows/release.yml`, tag
`v0.1.0-beta.3`, commit `d99f92f2b506010def0347c4bae7e6eeeb74a4d5`, and release run
`29093394523`; its successful transparency-log entry is `2138101952`. Registry-backed one-off
execution, global installation, initialization, and validation also passed.

First publication created both `beta` and `latest` dist-tags even though the release command selected
`beta`. This invalidated the assumption that the command alone could preserve a stable channel with
no target. Release policy now requires querying post-publication registry state and removing an
unintended `latest` tag. Trusted-publisher enrollment, dist-tag cleanup, GitHub secret deletion, and
bootstrap-token revocation are tracked as one security cleanup sequence rather than optional release
administration.

## 2026-07-10 — Product naming required category research, not only registry availability

The first beta's scoped npm name was safe to publish, but the desired unscoped
`agent-context-kit` name was already owned by another context CLI. A proposed Threadmark rename
initially appeared available because npm returned E404. Broader research then found
`thinkwright/threadmark`, an existing same-category product that already shipped the `threadmark` and
`threadmarkd` commands for Claude Code and Codex handoff. The partial local rename was reverted before
commit or publication. This established that an empty package registry slot is not sufficient product
or executable clearance.

Carrylog was selected after npm and GitHub category searches found no overlapping AI coding context or
handoff product. The proposed `cl` shortcut was rejected because Microsoft's `cl.exe` compiler owns
that command on supported Windows systems. The canonical package and executable are both `carrylog`.
This practical ecosystem check is recorded in ADR-0008 and is not represented as legal trademark
clearance.

The rename also exposed a compatibility boundary that a global text replacement would have broken.
The `.agent-context/` root, configuration v1 schema identity and bytes, adapter markers, handoff
markers, and reserved prefix are persisted wire identities from beta.3. Carrylog changes active
product prose and commands while keeping those values intact; a dedicated upgrade test rejects a
second context root or duplicate managed blocks.

## 2026-07-10 — Independent migration review found a dead command in canonical context

The first Carrylog upgrade scenario initialized its repository with the current beta.4 templates and
then replaced only adapter bodies with beta.3 fixtures. That setup proved marker compatibility but
could not expose differences in beta.3 canonical documents. Independent review compared the test with
the published source and found that the always-loaded beta.3 `instructions.md` still directed agents
to run `ackit validate`. Sync only regenerated schema and adapters, while migration instructions
removed the package that supplied `ackit`; following the documented path therefore left a dead command
in durable project context.

Blind replacement was rejected because canonical Markdown belongs to the repository. A dedicated v1
migration now recognizes only the complete published beta.3 instructions template, with exact LF or
CRLF bytes, and changes it inside the existing guarded atomic batch. Customized instructions remain
unchanged and produce `E_LEGACY_CLI_INSTRUCTION` until their owner reviews the command. The upgrade test
now starts from a repository fixture independent of the current initializer, covers stock and
customized paths, and pins the published schema bytes to SHA-256
`f30d6c906dba10059032ce13c74257b6ab41ebdd30308ca56b65408f039369ab`.

Follow-up review found three assumptions in the first correction. Configuration v1 allows document IDs
to change, so matching only `id: instructions` could still leave the dead command; migration now checks
every configured document path for the complete frozen template, while blocking diagnostics inspect
every always-loaded document. The first target was rendered from the mutable current template, which
could have rewritten unrelated prose after a future template edit; the target now derives from the
frozen beta.3 source by replacing exactly one command. Finally, a bare-token detector both missed
quoted, path, subshell, separator, Windows-shim, and mixed-case invocations and rejected harmless
historical prose. The replacement recognizes bounded command-shaped forms and has explicit accepted
and rejected cases without claiming to parse arbitrary shell language.

The first command scanner also sliced the full prefix and suffix around every `ackit` occurrence. A
near-limit document containing repeated prose therefore produced quadratic copying and multi-second
runtime. Two non-global regular expressions now scan linearly; a near-one-MiB adversarial regression
shares the existing two-second cross-platform performance budget. Migration candidate reads are capped
at the frozen CRLF template byte length, because any larger document cannot be an exact match; larger
customized files proceed to the normal one-MiB validation boundary instead of multiplying pre-validation
I/O across the 256-document catalog.

The same review corrected three policy gaps: local-dependency migration now uses explicit npm and
`npx --no-install` commands; first-package token guidance acknowledges that npm cannot necessarily
scope a token to an unregistered package; and post-bootstrap administration locks package publishing
against granular tokens after trusted publishing is configured. Active runtime code now uses
`CarrylogError`; `AckitError` remains only the deprecated public compatibility alias.

After these corrections, three independent reviews separately covered code/security, release and
credential workflow, and documentation/identity consistency. Each returned GO with no unresolved P0,
P1, or P2. The frozen tree passed 129 tests with 95.71% lines, 95.71% functions, and 91.24% branches;
the migration module reached 100% in all three measures. The near-one-MiB repeated-prose scanner case
completed in 4.7 ms locally.

The reviewed package contained 126 files. npm 10 and exact Node.js 24.15.0/npm 11.18.0 passed real
publish dry-run and local, ephemeral, global, ESM, TypeScript, init, and validate consumers; the exact
npm 11 client also loaded its provenance dependency. npm 12.0.0 passed its keyed pack envelope and all
supported non-publish consumers. Exact byte size remains release evidence outside packaged docs so
recording it cannot change the artifact being measured. Dogfood sync and validation, diff checks, and
full npm audit passed. An initial network-restricted package-smoke attempt timed out with SIGTERM
during isolated dependency installation; rerunning the unchanged gate with registry access passed,
confirming an environmental boundary already documented by the harness rather than a package defect.

## 2026-07-11 — Carrylog beta.4 passed remote and clean release gates

Commits `d7a83e4` and `0b77aac` were pushed without a release tag. CI run `29108810508` tested exact
head `0b77aac5ff394be69610be5e00b332d44a7c9c37` and passed all eleven jobs: Node.js 22 and 24 quality
on Linux, macOS, and Windows; packed-artifact smoke on those operating systems plus exact minimum
Node.js 22.0.0; and the exact Node.js 24.15.0/npm 11.18.0 release-client and npm 12.0.0 package
contracts.

A clean exact Node.js 24.15.0/npm 11.18.0 `npm run release:verify` then passed on the same commit. It
repeated all 129 tests and coverage thresholds, dogfood sync/validation, 126-file pack inspection,
release-artifact construction, real publish dry run, every consumer mode, and production audit. The
100,633-byte artifact had SHA-256
`f3ba0076dd41337dcc0a74b47a00b2f35562fb802395213e59d0ee4b61bbb4f8` and SHA-1
`9b9713bc0fa1214122539b72e67f80db7d044205`.

Those digests describe the clean pre-record commit, not the future tagged artifact: this engineering
record is itself included in the npm package. After this record passes CI, release verification must
rebuild and identify the final clean artifact before tagging rather than reusing or relabeling the
earlier digest.

## 2026-07-11 — Carrylog beta.4 publication stopped at registry authorization

Commit `c09d7f3` and annotated tag `v0.1.0-beta.4` passed the final eleven-job CI matrix and all three
tagged operating-system preflights in release run `29109394637`. The protected publish job built and
reverified the reviewed 126-file `carrylog@0.1.0-beta.4` artifact, then created provenance entry
`2138573876`. npm rejected the package-creation request with `E403`: the bootstrap credential could
not create the new unscoped package. The registry continued to return `E404`, so no package version
or dist-tag was created and the immutable tag must not be moved or reused.

The failure is an authorization boundary, not a source, artifact, or provenance-integrity failure.
Recovery therefore requires replacing the protected environment secret with a shortest-lived
granular token that can create a package, rechecking that the registry still has no `carrylog`
package, and rerunning only the failed publish job. The token must be removed and revoked after the
first successful publication and trusted-publisher configuration. Both attempts' commit, package,
version, file count, size, and registry digests must be compared before the release is accepted.

## 2026-07-11 — Universal continuity development moved to configuration v2

The post-tag development line raised the package to `0.1.0-beta.5` and introduced configuration v2
without changing the frozen v1 contract. New initialization targets Codex, Claude Code, Cursor, and
Gemini CLI. Codex and Cursor map to one `agents`/`AGENTS.md` surface, preventing duplicate ownership;
Claude and Gemini retain separate root outputs. `carrylog migrate --to 2` is explicit, preserves YAML
comments and newline style, converts only the published stock handoff or an already compliant
checkpoint, and writes canonical config after planned outputs. `--universal` fills every supported
surface and enables repository Skills for both v1 and partial-v2 inputs.

Portable continuity was deliberately bounded below provider sessions. The exact checkpoint sections
are Objective, Completed, Verification, Decisions, Risks, and Next action. `resume --json` exports
those reviewed sections, always context, an on-demand catalog, raw-byte digests, and projected Git
evidence. It excludes transcript bodies, hidden reasoning, provider JSONL/SQLite stores, absolute
roots, session identifiers, commit timestamps, and any claim to control native compaction. ADR-0009
and ADR-0010 record the configuration and continuity boundaries.

Implementation review caught several defects before dogfood. Two type names had been left outside an
export block and broke TypeScript parsing. The first `--universal` migration only added Gemini, so a
single-adapter v1 repository could remain non-universal; it now ensures all three surfaces and can
complete partial v2. Skill ownership initially used substring matching, which could overwrite a human
file that merely quoted the marker; ownership now requires exactly one standalone marker. Resume
initially validated before its stable read envelope, leaving a validation-to-observation gap; the
exact accepted observation is now revalidated. The first Markdown parser also allowed a shorter fence
to close a longer one and missed indented blockquotes; fence length and block structure are now
covered explicitly.

Carrylog's customized v1 handoff was reviewed manually into the canonical checkpoint sections, then
the repository successfully dogfooded `migrate --to 2 --universal`. Repeated migration, sync, and
validation were clean; `checkpoint --check` and `resume` correctly reported stale Git evidence for the
active worktree. Codex prompt-input inspection discovered the generated AGENTS router and generic
Skill without a model call. Gemini CLI discovered and enabled the same `.agents/skills` entry. The
Skill validator first failed because ambient Python lacked PyYAML; rerunning it in an isolated `uv`
environment installed only that validation dependency and passed both generic and Claude Skill
folders. Cursor CLI was not installed, so no authenticated Cursor launch is claimed.

The first fresh Codex run also exposed executable-resolution behavior that synthetic Skill tests had
missed. `carrylog` was not global, and an unconditional `npx --no-install` could select an unrelated
cached package when no project-local bin existed; that cached CLI then failed its executable mode.
The Skill now uses `npx --no-install` only after confirming `node_modules/.bin/carrylog`, has an
explicit built-source fallback only for Carrylog's own repository, and never downloads or upgrades a
package. README installation guidance now states that one-off initialization alone cannot support
later verified automation.

The same Codex sandbox produced a second false failure: every Git observation was marked different
although direct runs were stable. The fingerprint had compared stderr even though snapshot parsing
consumes only allowed exit codes and stdout; sandbox wrappers can emit per-process stderr diagnostics.
ADR-0011 now limits stability equality to the exact consumed channels, keeps unexpected exits and
process failures blocking, and reports command/channel mismatch names. A regression varies stderr on
every fake Git invocation while keeping stdout stable; real stdout changes still retry and fail.
Further Codex live confirmation was blocked when its local OAuth token was revoked. Claude Code's
authenticated fresh session successfully reconstructed configuration v2, the objective, next action,
stale state, and risks. Gemini Skill discovery passed, but its headless model launch required manual
authentication. These authentication failures are recorded as conformance gaps, not product passes.

## 2026-07-11 — beta.5 independent review found and closed concurrency and consumer gaps

An independent code/security review reproduced a same-size concurrent overwrite that restored mtime
while a guarded read was in progress. Device, inode, size, mtime, and link count were unchanged, so an
accepted buffer could contain bytes from two file states. Guarded reads now compare ctime in both
handle observations and the final path observation. A deterministic post-read fault-injection test
rewrites equal-length content, restores the exact mtime, requires an observable ctime change, and
verifies fail-closed `E_CONCURRENT_MODIFICATION` behavior.

The same review found two output/parser boundaries. Raw `JSON.stringify` output left bidirectional and
other invisible Unicode formatting characters literal in Git-controlled paths and commit subjects.
Resume JSON now escapes `Cc`, `Cf`, `Zl`, and `Zp` characters at the serialized-text boundary while a
JSON round trip preserves their original values; regression coverage includes C0 controls, line and
paragraph separators, bidi formatting, and a non-BMP format character. The checkpoint parser also
treated a backtick fence whose info string contained a backtick as valid, contrary to CommonMark, so
a duplicate required H2 could be hidden. Backtick and tilde fence cases now have separate boundary
tests.

Release and documentation reviews found that the installed-package smoke did not exercise the
flagship migration CLI and compiled declarations with `skipLibCheck`. The packed tarball now runs a
v1-to-v2 universal lifecycle through drift check, dry-run, real write, validation, and two clean
idempotence checks without network fallback. Its TypeScript consumer disables `skipLibCheck` and
instantiates the public migration option/result types. CLI help, nested-directory discovery,
confidentiality warnings, historical scoped-package references, and unreleased RC-preparation wording
were reconciled without claiming that the unscoped npm package exists.

After the fixes, the integrated quality gate passed 157/157 tests with 94.62% lines, 95.85% functions,
and 89.49% branches. Pack inspection passed with 146 files. Both ordinary and real
publish-dry-run package smokes passed local, ephemeral, global, ESM, strict TypeScript, migration,
initialization, validation, checkpoint, and resume consumers; the production dependency audit found
zero vulnerabilities. These are local macOS results. The exact uncommitted tree still needs the
Linux/macOS/Windows CI matrix after commit.

Fresh post-fix reviewer agents could not refresh their local OAuth credentials. A separate read-only
Claude Code review authenticated and began inspecting the diff but produced no result within the
bounded two-minute window and was terminated. Therefore this record does not claim a post-fix
independent-review GO. The original independent findings are resolved with regressions and the main
review is clean, but a successful independent post-fix review remains an explicit RC gate rather than
being inferred from tool silence.

## 2026-07-12 — External document review redirected work toward delivery evidence

An external senior review read the complete document set, independently confirmed package version
`0.1.0-beta.5`, clean JSON validation, and the 157-test local suite, then challenged the allocation of
effort rather than the recorded implementation facts. It found the ADR, failure-recording, immutable
tag, evidence-traceability, and dogfood practices unusually strong, but identified the primary product
risk as missing users and missing behavioral evidence that agents follow routers and continue work.

The review recommended immediate publication recovery, a value-first README, a small maintainer-run
pilot before a comprehensive audit, earlier external-repository adoption, explicit evidence ownership
and document freshness, and an ADR preventing journaling or compaction claims before evidence. It also
identified repeated test counts, coverage, package measurements, and release facts across current
state, handoff, README, changelog, testing strategy, and this log as contrary to Carrylog's own
single-source rationale.

The recommendations were not accepted wholesale. Existing high-severity integrity fixes remain
justified and are not reverted because the product lacks users. A fixed number of days cannot override
unresolved data-loss or release-integrity findings. Claims that AGENTS.md standardization has already
eliminated the niche require market and adoption evidence rather than assumption. The accepted
positioning is narrower: repository-owned, Git-reviewable, deterministic project-memory governance,
with conversation continuity and compaction remaining research questions.

ADR-0012 now establishes artifact, delivery, reconstruction, behavioral, and perceived-continuity
evidence levels and requires a minimum Tier 1 pilot before continuity expansion. The pilot protocol is
stored outside the npm package under `research/continuity/`. A documentation policy assigns volatile
current evidence to handoff, historical exact evidence to this log, and per-document freshness
contracts. The audit brief moved from packaged product documentation to a non-normative research
record. README and roadmap work now prioritize the source-based five-minute path, first npm
publication, pilot evidence, and external adoption over additional defensive breadth.

Registry state was rechecked on 2026-07-12 and still returned `E404` for `carrylog`; release run
`29109394637` remains the immutable beta.4 authorization-only failure. Publication recovery still
requires the repository owner to replace the protected bootstrap credential. No token was requested,
printed, stored locally, or inferred from the review.

The first audit-response worktree passed the complete 157-test quality gate, ordinary and real
publish-dry-run package consumers, and production audit. Pack inspection contained 148 entries,
included ADR-0012 and the documentation policy, and excluded `research/`. A local Markdown scan
resolved every relative link across 31 files.

Two independent follow-up reviews then checked documentation consistency and the package/release
boundary. The release review reproduced the README source path in a fresh temporary repository through
init, validation, checkpoint, and fresh resume; verified local and remote beta.4 tag identity; and
confirmed that all tagged OS preflights passed before the credential-only publish failure. The reviews
found no falsified release evidence but correctly rejected the handoff as stale after documentation
edits. They also found ambiguous ADR wording that gated only a default rather than any supported
runtime feature, described future fresh/branch choices as if implemented, and assigned volatile exact
evidence to both handoff and the engineering log. Those statements were reconciled; final checkpoint
and gate verification follow completion of the review.

## 2026-07-12 — Carrylog beta.4 first publication succeeded; registry hardening remains

After the protected `NPM_TOKEN` was replaced, the registry was rechecked and continued to return
`E404` for both `carrylog@0.1.0-beta.4` and its dist-tags. Local and remote annotated tag identity
remained unchanged. Release run `29109394637` was therefore rerun with `--failed`; attempt 2 reused
the immutable tagged commit `c09d7f3440f3b838118aa0e80a028ffa657462b9` and required a fresh
approval of the protected `npm` environment.

The publish job rebuilt and verified the same 126-file package, published it successfully, and passed
its bounded registry installation check. An independent registry download matched the workflow
artifact at SHA-256 `ab341b9326e7c63c5c7d1f79972bb0021d061f30f804a8a3cfa66edb8a4f961e`,
SHA-1 `320ae64e88dea1d5a0fdd856bc130299930d1b0c`, and SHA-512 integrity
`VfFTVcaknlYoYvFF14VkkZtnJPuUBG0b04xc0rYf40SARHEx+MfkLf9eenXBZOS408Lfr85wKilRLgGreDeNuA==`.
The SLSA provenance resolves to repository `Jaemani/Carrylog`, workflow `release.yml`, tag
`v0.1.0-beta.4`, the same commit, and run attempt 2; transparency-log index `2145991602` is public.
Independent `npx`, global installation, version, fresh Git-repository initialization, and JSON
validation checks all passed against the public `beta` tag.

As anticipated in the release procedure, npm assigned both `beta` and unintended `latest` to the
first prerelease. The release is installable but post-publication administration is not complete.
The owner-authenticated sequence must remove `latest`, configure the trusted publisher, finish the
old scoped-package migration administration, disallow token publication, delete the GitHub
`NPM_TOKEN`, and revoke the bootstrap token. Local npm was not authenticated when this state was
recorded, so no registry administration beyond publication was claimed.

## 2026-07-12 — Post-fix code/security review exposed continuity and resource boundaries

The first successful independent post-fix code/security review initially returned NO-GO. Adding the
publication record pushed Carrylog's own always context to 16,362 characters against its 16,000
policy, so `validate`, `resume`, and pre-validation in `checkpoint` refused the dogfood repository.
The first prose reduction restored a passing state but left only 328 characters of margin. A second
review correctly rejected that as an operationally certain future wedge. Duplicated implementation
detail was moved out of current state and handoff rather than raising the policy; the final reviewed
state uses 13,091 characters and retains 2,909 characters of headroom.

The same review reproduced substantive defects that earlier synthetic coverage missed. A public
beta.4 global executable shadowed beta.5's source fallback and lacked `resume`; generated Skills now
check source, project-pinned, and global candidates in order, require `resume --help` capability, and
never fall past an explicitly selected incompatible version. Default human resume and other CLI
surfaces allowed terminal controls, bidirectional formatting, or multiline field spoofing from
repository-controlled Markdown, paths, and Git evidence. Human fields and diagnostics now escape
unsafe characters, and every JSON-bearing CLI path uses one terminal-safe serializer while preserving
parsed values.

Checkpoint parsing now excludes CommonMark HTML blocks as well as fences, blockquotes, indented code,
and Carrylog's managed snapshot. Legacy-command validation scans human narrative but not generated Git
subjects, preventing historical `ackit validate` text from disabling the repository. A stock v1
handoff with generated evidence now migrates in LF and CRLF while preserving that evidence; direct v1
resume returns migration guidance rather than `E_INTERNAL`. Resume also enforces an 8 MiB aggregate
canonical-context observation limit so a maximum on-demand catalog cannot multiply 1 MiB per-file
limits into gigabyte retention. Exported initialization validates JavaScript runtime option types, and
package gates explicitly require v2/ADR-0012 artifacts while rejecting `research/`.

After regressions were added, an isolated independent run passed 165/165 tests and every threshold;
the 148-file package passed pack inspection and all installed consumer/lifecycle modes. One earlier
independent run lost compiled modules because the primary agent concurrently ran a clean build in the
shared worktree; it was discarded as invalid evidence and rerun in isolation. After the final
documentation and Skill wording changes, the primary local run passed the same 165 tests with 94.74%
lines, 95.58% functions, and 89.38% branches, ordinary and real publish-dry-run package consumers, and
production audit with zero vulnerabilities. Dogfood sync, validation, checkpoint/resume, and diff
checks passed. The final independent verdict is GO for code/security, package boundaries, context
semantics, and budget headroom. Exact-commit cross-platform CI remains a separate release-candidate
gate.

Implementation and documentation commit `243e1d56fdfdc39253fb2901bb77716e788c2351` was pushed without a
release tag. CI run `29165144784` passed all eleven jobs: Node.js 22 and 24 quality plus dogfood
context checks on Linux, macOS, and Windows; packed-artifact consumers on all three operating systems
and exact minimum Node.js 22.0.0; and the Node.js 24.15.0/npm 11.18.0 release client plus npm 12
package contract. This establishes cross-platform evidence for the reviewed beta.5 implementation
candidate. A later changelog promotion or release-evidence commit changes packaged bytes and still
requires its own exact-commit gates before tagging.

## 2026-07-12 — Registry administration corrected the `latest` removal assumption

Owner-authenticated administration exposed a false release-policy assumption. npm 10.9.8 rejected
`npm dist-tag rm carrylog latest` with `EOTP`; after WebAuthn authentication npm 11.18.0 reached the
registry but returned HTTP 400 for the same DELETE. pnpm 11.11.0 made the hidden invariant explicit as
`ERR_PNPM_DIST_TAG_RM_LATEST`: npmjs.org does not permit removal of `latest`. No dist-tag changed.
Release policy now keeps the first-publication beta.4 `latest` fixed until a stable version replaces
it and requires explicit `carrylog@beta` opt-in for later prereleases. The legacy package likewise
keeps its unavoidable `latest` pointer rather than pretending it can be unset.

The initial recovery-code guidance was also wrong: npm recovery codes restore web access and are not
CLI `--otp` values. The failed recovery-code DELETE returned HTTP 400 without changing registry state.
npm 11.18.0 correctly converted the configured WebAuthn security key into a browser challenge for
owner operations. Using that flow, exact version `@jaemani/agent-context-kit@0.1.0-beta.3` was
deprecated with the reviewed Carrylog migration message, and a public registry query returned that
exact message. GitHub environment `npm` listed `NPM_TOKEN` before deletion and no secrets afterward.
The token value was never retrieved or printed. Revocation of the underlying npm credential remains
an owner-side verification item; beta.5 removes the workflow token fallback so its publication must
succeed through trusted OIDC or fail closed.

An independent release review then returned NO-GO because the protected verification read only
`dist-tags.beta`, the static OIDC test did not require an actual publish or registry-verification
step, and the historical bootstrap instructions still described a token path that the current
workflow no longer supported. The release verifier now reads the complete tag object and requires
both the new beta version and beta.4's fixed `latest`; accepted and rejected policy fixtures cover
stale, moved, missing, and malformed states. The workflow contract now requires preflight ordering,
the exact npm 11.18.0 client pin, publish command, post-publication verifier, protected environment,
OIDC permission, and absence of secret/token references. Bootstrap instructions are explicitly
historical. Trusted-publisher identity, both package token policies, and underlying bootstrap-token
revocation remain owner-side pre-tag checks; token-free beta.5 publication is the executable proof.

After those review findings were resolved, the independent follow-up verdict was GO with no new
release blocker. The final-content full gate then passed 169/169 tests with 94.74% lines, 96.02%
functions, and 89.39% branches. Dogfood sync and JSON validation were clean; the 148-file package
passed pack inspection, real publish dry-run, local, ephemeral, global, ESM, strict
declaration, v1-to-v2 migration, initialization, validation, checkpoint, and resume consumers.
Production audit reported zero vulnerabilities. Exact-commit CI and the tagged OIDC publication
remain separate release gates and are not claimed by this local evidence.

## 2026-07-12 — Carrylog beta.5 proved token-free OIDC publication

Release commit `343b4e381f5994c71a55a39dbcd34cf6862df16f` passed all eleven exact-commit CI
jobs in run `29180977788`. Annotated immutable tag `v0.1.0-beta.5` points through tag object
`4f5fd628d27addaccbff14214eedbefe828aca43` to that exact commit locally and on `origin`.
Release run `29181258500` passed Linux, macOS, and Windows preflight before the protected `npm`
environment was approved. The publish job then used the pinned npm 11.18.0 client, no registry token
or workflow secret, and GitHub OIDC trusted publishing; all four jobs completed successfully.

The workflow built and published one 148-file tarball. An independent registry download matched the
workflow artifact at SHA-256 `5f706672adfed5e2e4bc6e347fcdedb23359448d9c7fbca0ed2128c0f44bb1ce`,
SHA-1 `c248e61ccf4ed41c14ab7ad33ef33895dbe98670`, and SHA-512 integrity
`hBbNpTP0NEEpIAJBzKqAlnUGbUXGyLxnJ82h1+NQgIjvPGNEQrjjwodseRXU8XEoTF0F81vTE0ErpTNEUXF32Q==`.
The registry reports 148 files, 146,636 packed bytes, and 565,208 unpacked bytes. `beta` resolves to
`0.1.0-beta.5`; the intentionally fixed `latest` remains `0.1.0-beta.4`.

The public package exposes an npm signature and two attestations. Its SLSA provenance names
`Jaemani/Carrylog`, `.github/workflows/release.yml`, `refs/tags/v0.1.0-beta.5`, the exact release
commit, and run `29181258500` attempt 1. npm published the statement at transparency-log index
`2148288214`. Both the protected workflow and a separate clean temporary directory executed the
exact public package as `0.1.0-beta.5`.

One initial independent `npx` command was run from Carrylog's own source directory while a global
beta.4 executable remained on `PATH`; npm selected that ambient executable and printed beta.4 despite
the exact package argument. That result was rejected rather than treated as a registry defect. The
source build printed beta.5, and isolated `npm exec`/`npx` runs outside the self-package directory
printed beta.5 from the public registry. The protected verifier already creates a fresh temporary
root and private npm cache for this reason. This distinction is retained as a release-diagnostics
lesson: package-self working directories and ambient executables are not independent consumer
evidence.

## 2026-07-12 — Tier 1 pilot reviews rejected execution before the evidence contract was complete

Two independent reviews returned NO-GO before any scored pilot run. The runner mixed router and
explicit-envelope effects without naming the full-product estimand, copied broader Claude state than
required, inherited ambient Git/npm/uv configuration, trusted prompt-only network restrictions,
could publish partial artifact bundles, and silently ignored failure-record write errors. The
analysis read only aggregate CSV rows and could not reconcile all 60 planned runs, recompute
item-level scores, audit exclusions, form within-fixture pairs, or report missing operational
evidence. Prompt-explicit facts were also counted as continuity reconstruction, and the original
condition order placed manual handoff disproportionately in the middle position.

The preregistration now names the treatment as the complete released Carrylog bundle rather than an
isolated envelope effect. Facts freeze origin, continuity eligibility, and severity. Canonical
evaluations store fact, contradiction, completion-criterion, reversal, repeated-work,
clarification, sensitive-exposure, confidence, and unavailable-evidence items bound to artifact and
codebook digests. Aggregate CSV is analyzer-derived. The reconciler covers every planned run,
reviewed failure, exclusion, partial claim, completed-unscored artifact, and scored artifact; it
reports fixed strata, paired directions, descriptive dispersion, fixed-seed fixture bootstrap
intervals, operational availability, and item-level manual-regression flags without a composite or
formal non-inferiority claim. The regenerated block order gives every condition six or seven
appearances in each position.

Runner isolation is now explicit. Setup uses synthetic HOME/TMPDIR, disabled system/global Git
configuration, no hooks or signing, distinct empty npm user/global configuration, fixed locale, and
offline package caches. The first attempt incorrectly pointed both npm configuration levels at
`/dev/null`; npm 10 rejected the duplicate load, and five prepare-only fixtures failed before the
root cause was corrected with two separate empty files. Both repositories then passed
repository-only, manual, and Carrylog prepare paths from exact tracked trees; prepare-only never
staged provider authentication. The verification wrapper uses macOS Seatbelt to deny localhost,
DNS, and other network access while retaining registered local commands. A no-argument local MCP
server exposes only those frozen commands to Claude.

Authenticated harness canaries found two material invocation defects. `codex exec` waited for
additional stdin because the original `execFile` path never closed its input; the runner now uses a
provider-specific spawn path that closes stdin and distinguishes timeout, signal, spawn, buffer,
nonzero, malformed, and missing-result failures. OpenAI's documented permission profiles are used to
deny root reads, allow only minimal runtime/Homebrew and workspace paths, and disable model-tool
networking. One authenticated Codex canary passed workspace read, external-sentinel denial, and
network denial after the Homebrew runtime path was added. Later retries hit the account usage limit,
which remains an execution prerequisite rather than being treated as a passing result.

Claude's `--allowedTools` did not restrict a broadly exposed Bash tool: an authenticated canary ran
an intentionally unregistered command. Bash was therefore removed entirely. Read-only work uses
path-scoped built-in readers; writable work uses Claude's workspace edit permission mode; frozen
verification uses the local MCP server. A later authenticated canary passed workspace read/write,
external read/write denial, registered MCP execution, and unregistered Bash denial with only minimal
`claudeAiOauth` staged in an ephemeral synthetic home. MCP OAuth, user settings, histories, hooks,
memories, and provider sessions are never copied.

Automatic sanitizer output now lands in ignored quarantine. A separate explicit privacy-review
command performs schema/path/size and credential-pattern checks, requires a reviewer attestation,
and promotes only reviewed artifacts to the tracked analysis surface. The freeze manifest excludes
mutable results but includes a frozen report template and every protocol, codebook, fixture, runner,
reviewer, and analysis input. Execution additionally requires those bytes and the manifest to be
tracked, clean, and identical to the first commit containing the manifest. Contract coverage proves
balanced order, deterministic freeze inputs, accepted and rejected evaluation shapes, exact MCP
tool exposure, scored/failure/unstarted reconciliation, clean privacy promotion, sensitive-content
rejection, and the verification network canary. Scored execution remains prohibited until the
complete suite receives an independent follow-up GO and Codex access is available again.

The integrated local quality gate passed 175/175 tests with 94.74% lines, 96.02% functions, and
89.39% branches. A concurrently started package check initially lost `dist/cli.js` while the quality
build cleaned the shared `dist/` directory; that result was rejected as invalid shared-worktree
evidence rather than treated as a packaging defect. Rerun in isolation, the package dry run passed
with the expected 148 files, excluded all `research/` inputs, and reported 149,377 packed bytes. The
structural validator, deterministic order check, empty 60-run reconciliation, verification network
canary, and draft-status freeze refusal all behaved as specified.

## 2026-07-13 — Tier 1 hardening closed runner and decision-rule gaps but exposed a Claude access blocker

Two post-hardening re-reviews remained NO-GO. The security review found that untracked
`git diff --no-index` output could be accepted without checking timeout, signal, spawn, buffer, or
exit semantics, and that receipt validation trusted a stored pre-command-state digest without
recomputing it. It also showed that a model-writable receipt path could not establish an execution
boundary. The methodology review found a circular review/freeze order, a prose-only Tier 2 decision
rule, incomplete monotonic run-order enforcement, direct harness metadata in blind artifacts, and no
independent comparison between scored metadata and the permanent first-ADD freeze commit.

The runner now rejects every untracked-diff result outside the exact empty-file or changed-file Git
contract. Codex and Claude verification use a frozen no-argument MCP broker; the Codex model profile
can read but cannot write the verification directory, while the broker runs the registered command
under Seatbelt and binds the exact registry, command, canonical pre-command Git state, process result,
and output digests. Blind receipt projections omit execution mode, registry and command identities,
and raw state. Execution order requires every predecessor to be terminal in both quarantine and
reviewed surfaces, and requires the selected and every successor run to be absent from all run and
blind surfaces.

The review workflow now sets the candidate status before calculating the digest, requires two GO
attestations over those exact bytes, and creates the manifest only afterward. The analyzer defines
exactly 40 vectors from two harnesses, ten fixtures, and two comparators, requires all six primary
metrics for screenability, applies STOP then GO then REDESIGN mechanically, exposes every rule input,
and compares scored metadata with the repository's actual permanent freeze boundary. Contract tests
cover complete GO, sensitive-exposure STOP, incomplete REDESIGN, and a common forged freeze commit.

Authenticated Codex testing exposed a separate integration failure: a plain side-effecting MCP tool
was cancelled in non-interactive mode. Setting the global approval policy to `never` did not change
that result and was rejected. The final configuration approves only the exact frozen broker tool IDs;
another authenticated run then passed registered MCP execution, workspace access, external-file and
unregistered-shell denial, and model-tool network denial with zero listener connections. The network
canary reports connect denial separately from probe-spawn denial rather than treating either as an
unqualified success.

The matching Claude run ended before MCP or Seatbelt initialization because the organization disables
Claude Code subscription access. Its bounded redacted result contained no tool result or permission
denial, and the environment has no `ANTHROPIC_API_KEY`. The canary now classifies this as an external
authentication prerequisite. Local Claude-mode broker and Seatbelt contracts pass, but an admin
enablement or safely staged API key is still required before an authenticated GO can be claimed.

An initial Prettier pass changed canonical task bytes and the structural validator correctly rejected
all stale blind-bundle bindings. The subsequent product gate also rejected Prettier's output because
Biome is this repository's canonical formatter. Biome then normalized the complete research tree and
the 60 bundles were regenerated from the final task bytes; validation restored exact digest binding.

The resulting candidate passed 41/41 focused research tests, structural validation for 10 tasks and
60 runs, deterministic order, all 60 blind bundles, and the local verification isolation canary. A
second complete prepare-only matrix over the Biome-normalized runner passed 60/60 in 191 seconds, and
the corresponding authenticated Codex canary again passed with zero network-listener connections.
The integrated quality gate passed 210/210 tests with 94.74% lines, 95.58% functions, and 89.38%
branches. The package dry run passed with 148 files and 150,937 packed bytes; `research/` remains
excluded. No raw, reviewed, evaluated, or scored result was created. Final independent review and the
Claude authenticated prerequisite remain open; no freeze manifest or GO attestation is claimed here.

The first final-review digest, `e03b3cacf5613b75ee902fdbcf66e1a8fb6627fe0e9aa626e66f033dabbee1e5`,
was then rejected by two fresh reviewers and permanently abandoned. One reviewer demonstrated that a
registered verification child could write `FORGED_RECEIPT_CHILD` directly into the receipt file
because its Seatbelt profile inherited receipt write access. The same review found that privacy
approval scanned and digested captured bytes but copied the live quarantine path again, leaving a
scan-to-copy race. The other reviewer showed that a Carrylog privacy rejection labeled
`manual-privacy-exclusion` bypassed the sensitive-exposure STOP branch, and that two other frozen STOP
branches lacked direct boundary tests.

The registered child can no longer read, append, or truncate the receipt file; the wrapper checks that
receipt history is byte-identical around the child and appends exactly one bound record itself. The
privacy reviewer no longer recopies live paths: it scans, digests, materializes, and reads back the
same captured Buffers. Regression tests reproduce the receipt attacks and mutate quarantine after
capture without changing promoted bytes. Any Carrylog-resume privacy rejection now triggers STOP
regardless of reviewer reason. Full-grid tests directly cover shared adverse macro means, replicated
and isolated manual regressions, malformed or missing evidence, privacy rejection, and simultaneous
STOP precedence.

The replacement candidate digest is
`e87adc35b467b74f1226eb95ff600c7118c062219a9dddcf04091913b0ad08af` over 125
review inputs. It passed 42/42 focused research tests, the 60/60 prepare-only matrix in 187 seconds,
and a fresh authenticated Codex isolation canary. The integrated gate passed 211/211 tests with
94.74% lines, 96.02% functions, and 89.39% branches. The package dry run passed with 148 files and
151,105 packed bytes. Two new independent reviews are evaluating that exact digest. Claude access,
formal attestations, the manifest, and scored runs remain absent and are not claimed.

The second final-review digest was also rejected and abandoned. Security reproduction showed that an
exact local fetch without `--depth=1` left 22 reachable source commits in the external Git database.
Even a one-commit shallow source still contains the current source tree, including discovery context
removed from repository-only and manual worktrees, so model access to that Git database would continue
to contaminate controls. A separate review found that rejection publication preceded the exclusion
CSV update, allowing an interrupted safety rejection to become protocol-invalid and lose its STOP
classification. The reviewers also observed that authenticated canaries were a documented manual
gate but not a machine precondition for review-digest generation.

The runner now fetches the exact SHA through a local `file://` shallow boundary with no tags or fetch
head, requires one reachable source commit, verifies the exact shallow marker, and proves the parent
object is inaccessible. Model environments and Codex permissions no longer receive repository
selection variables, Git runtimes, or external Git database access; only the registered broker
partition can read it. The authenticated canary checks direct Git-object and credential-adjacent home
denial while registered `git-head` and `git-status` remain usable.

Privacy rejection and approved failure publication now write an exact codebook-compatible exclusion
first, recover only identical partial destinations, and reject drift. Analyzer safety input remains
independent of structural validity, so an interrupted Carrylog privacy rejection still forces STOP.
The pre-quarantine artifact gate rejects JWTs and credential-bearing object keys before any ignored
raw artifact is written. Focused tests cover interruption, retry, partial publication, approved
failure classification, sanitizer rejection, shallow history, model Git separation, and
credential-adjacent denial.

Authenticated evidence is now a frozen machine gate. `harness-prerequisites.json` binds the harness
configuration and critical file digests; its runner records only bounded result hashes and summary
fields, never raw provider output. Critical-byte changes reset attestations to pending. The current
bytes record Codex as passed and Claude as pending. Consequently both `--require-passed` and
`freeze --review-digest` fail closed until authorized Claude access succeeds.

The latest offline candidate passed 52/52 focused research tests and the full 60/60 prepare-only
matrix in 186 seconds. The integrated quality gate passed 221/221 tests with 94.74% lines, 96.02%
functions, and 89.31% branches. Package inspection passed with 148 files and 151,886 packed bytes;
research remains excluded. Its non-formal code-review hash is
`3c881693fec1a44c9effbd09cf38986cd5ff6b210467915426c8313412e539ce` over 131
inputs. This hash is not eligible for review attestations because the formal prerequisite gate blocks
digest generation. No manifest, raw result, score, or behavioral continuity claim exists.

## 2026-07-13 — Final-review attempts closed evidence-oracle and freeze races

The `3c881693...39ce` candidate became stale before final review and was never eligible for an
attestation. Fresh security and methodology reviews then rejected the replacement bytes. The Codex
authenticated canary preserved command output but discarded the actual command, so a model could
echo the prompt-visible denial markers without running the intended probes. Claude counted permission
denials without binding them to the requested tool, path, or tool-use identifier. The freeze writer
accepted attestations over one review digest and independently collected a later manifest surface,
allowing an input changed immediately after the review gate to enter an unreviewed manifest. Ajv and
its installed transitive packages were also outside the frozen analysis surface.

Codex now executes one immutable, hash-checked workspace probe and accepts only the CLI's exact
`-c` or `-lc` wrapper around that probe. All classifications are emitted as one trusted final record;
the listener independently proves that no network connection arrived. This design followed an
authenticated integration failure where sandbox diagnostics caused earlier output lines to be
truncated, and another where the CLI selected `-c` instead of `-lc`. Marker-only commands, additional
commands, wrong commands, forbidden states, and changed probe bytes are rejected. Claude now retains
tool-use IDs, names, and full inputs and requires exact result or permission-denial binding for the
workspace read and each external read/write probe.

The freeze writer re-collects the review surface after the review gate, derives the manifest and
review digest from matching file records, checks again during capture, and removes the new manifest
if the surface changes while writing. `--check` repeats preflight, current attestation, review-digest,
manifest, and permanent first-ADD validation. Ajv reproducibility is frozen in
`analysis-dependencies.json`: the root requirement, selected package-lock records, complete current
transitive closure, integrity metadata, and each installed package tree digest must match before
validation, analysis, evaluation scaffolding, preflight, or manifest construction can load Ajv.

The next independent reviews found four more blockers. Claude exposed `verify_git_head` and
`verify_git_status` but registered only the first MCP command, making its authenticated canary
impossible to pass. Concurrent exclusion writers used independent read/replace cycles; a stress
reproduction lost one privacy outcome while both processes returned success. Diagnostic redaction
missed JWTs and credential-bearing environment assignments, and the manifest writer did not re-read
the just-written manifest itself. The Claude registry now contains all three exact commands.
Exclusion updates use a cross-process exclusive lock and a 12-process regression retains every
distinct row; an uncertain or stale lock blocks rather than risking lost safety data. Shared
diagnostics redact sentinels, private paths, JWTs, bearer values, known token prefixes, credential
environment assignments, and structured auth fields. Manifest creation verifies the exact regular
file bytes after writing and removes a corrupted replacement before returning failure.

After these corrections, the focused research suite passed 64/64 tests, including deterministic
post-review, capture-time, post-write, dependency-drift, marker-spoof, exact-tool, redaction, and
concurrent-writer rejection cases. The local isolation canary passed, and a fresh authenticated Codex
canary recorded a passed prerequisite for the current critical bytes. The integrated quality gate
passed 233/233 tests with 94.74% lines, 96.02% functions, and 89.39% branches. The earlier complete
prepare-only matrix passed 60/60 before the last review-only safety fixes, and the exact documented
candidate rerun passed 60/60 in 192 seconds. A final security review then found that quoted
credential assignments and credential-bearing database URLs escaped diagnostic redaction. The
shared redactor now covers quoted and unquoted assignments plus common database URL variables while
preserving non-credential `PUBLIC_URL` values; its independent post-fix security verdict is GO. That
redaction-only critical change reset the Codex prerequisite, and the authenticated rerun was blocked
by the provider usage limit rather than reused. The exact final bytes passed another 60/60 matrix in
182 seconds. Final package inspection and post-documentation quality
then passed: the quality gate remained 233/233 with 94.74% lines, 96.02% functions, and 89.39%
branches, and package inspection retained 148 files while excluding `research/`. Claude remains
pending because authorized access is unavailable; Codex is also pending until the current critical
bytes can be re-authenticated after the usage limit resets. No formal review digest, manifest, raw
result, score, or behavioral continuity claim exists.

## 2026-08-02 — A real cross-harness smoke test found a generated-Skill discovery defect

Claude Code 2.1.220 became reachable through an explicitly loaded GPT router. The ordinary user
configuration still selected an unavailable model, so the smoke test recorded the required explicit
settings and model override rather than treating default setup as successful. No router credential,
provider session store, native transcript, or raw model stream was copied into the repository.

The first read-only baseline started Claude in the Personal Context repository and required it to
read the Codex-authored `AGENTS.md` and tracked development handoff. It reconstructed the exact
working branch, product boundary, first milestone step, and one protected prohibition. Resuming that
same Claude session with every file and shell tool disabled reproduced the branch, next step, and
prohibition from the resumed conversation alone. This establishes repository-artifact delivery and
fact reconstruction plus Claude-native session persistence. It does not establish that Claude can
open a Codex-native transcript, that Carrylog transfers provider sessions, or that the resumed model
will preserve those facts during a substantive implementation task.

A second smoke test created an isolated local clone of Personal Context, initialized Carrylog
configuration v2 for Codex and Claude, imported reviewed continuation facts into canonical context,
and generated a current checkpoint. Validation returned no diagnostics and the resume envelope
reported a current checkpoint on `codex/runtime-v1-stabilization` at `6c046ce`. The released beta.5
artifact was first installed as the project-pinned baseline. After the Skill source changed, its
validator correctly rejected the new generated Skill as drift; the final retest therefore used a
clearly identified unpublished working-tree package candidate and made no claim about immutable
beta.5 bytes.

The generic continuation attempt did not run the resume envelope. Claude reported the global
candidate after failing to observe the project-local executable. An explicit Skill attempt confirmed
the defect: ignored `node_modules/.bin` content was invisible to the agent's normal file-discovery
tools even though the operator shell and `npx --no-install` resolved the local beta.5 executable.
Always trying `npx --no-install` was rejected because a repository without a local install resolved
the incompatible global beta.4, proving that `--no-install` alone does not establish project
ownership in this environment.

The generated Skill now uses one silent, cross-platform Node filesystem probe for
`node_modules/.bin/carrylog` or `carrylog.cmd`, explicitly forbids Glob, Read, and directory listings
for that decision, and runs `npx --no-install` only after the probe succeeds. A regression executes
the probe with an absent candidate and a platform-specific local executable, allowing the supported
OS CI matrix to exercise the same contract. The corrected explicit-Skill run selected the pinned
candidate, returned the Carrylog envelope, reconstructed the objective, boundary, risks, branch,
HEAD, dirty-tree state, and next action, and reported `checkpoint.stale` as false. Resuming that
Claude session with no tools retained the branch, current checkpoint state, and next action.

Narrow command-pattern approval initially denied Claude's compound Bash invocation even after the
local probe succeeded. The successful product smoke therefore allowed Bash inside the isolated clone
while denying write/edit tools, then verified repository state afterward. That result is not an
approval-policy or sandbox-isolation claim. The formal Tier 1 candidate remains unexecuted: its
preregistered Codex and Claude CLI/model identities do not match the current clients or GPT router,
and neither authenticated prerequisite was updated from this smoke test.

The first broad read-only review attempt did not return within the bounded operator wait and was
terminated without a verdict. A narrower retry returned NO-GO: leaf `lstat` can report `ENOENT` for a
dangling ancestor, so the first probe could still classify uncertain path state as true absence and
fall through to the global executable. The corrected probe now checks `node_modules` and `.bin`
separately, accepts only real directories for those ancestors, and distinguishes their true absence
from symlinks, non-directories, permission failures, and other uncertainty. The leaf candidate is
then checked as a file or symbolic link and must pass executable access.

New process regressions cover an absent module directory, a non-directory ancestor, a directory in
place of the executable, a dangling ancestor, a dangling executable, and a usable platform-specific
candidate. The same read-only reviewer then returned GO with no finding. Its residual caveats were
that review was static, Windows junction behavior still depends on Windows CI, and the probe checks
filesystem selection rather than CLI compatibility; the existing mandatory `resume --help` step
continues to provide the compatibility gate. The final unpublished candidate was repackaged and the
isolated Claude Skill and no-tool native-resume checks both passed again on those corrected bytes.

## 2026-08-02 — Fresh CI exposed host semantics and a Windows junction gap

The first committed Skill correction passed local macOS quality and package gates, but full workflow
run `30710079223` failed both Linux jobs and both Windows jobs. Linux exposed two research tests that
unconditionally required `otool`, `/Library/Developer/CommandLineTools`, and `sandbox-exec`. Windows
exposed the same capability mismatch, a macOS verification PATH built with Windows separators, and a
directory junction at the executable path that passed `lstat` plus Windows `X_OK` access. The packed
artifact matrix and both macOS quality jobs passed, so the failure was not treated as package or
macOS evidence for the supported cross-platform source gate.

The correction separates portable contracts from capability-specific execution. Pure verification
registry, permission, parser, and PATH contracts continue to run on every CI operating system, while
the two tests that execute the frozen macOS Seatbelt boundary explicitly require Darwin. The PATH
compiler now uses `path.posix` and `:` because its target is macOS even when its pure output is checked
on Windows. The Carrylog project-local probe now follows an accepted file or symbolic-link candidate
with `stat`, requires the resolved target to be a regular file, and then checks executable access.
Regressions cover an existing directory target and the same junction after its target is removed, in
addition to the prior absent, invalid, dangling-ancestor, and usable cases. A fresh full matrix is
required before these corrections can support a prerelease claim.

Local focused contracts passed after the correction. The first complete local quality invocation did
not: changing `analysis/harness-contract.mjs` invalidated its tracked critical-file digest, as the
research gate is designed to detect. The token-filtered command produced no immediate output, and the
operator failed to inspect the subprocess exit code before recording a pass. That local quality claim
is retracted; an empty filtered stream is not evidence of success.

The same omission made workflow run `30710553011` fail every quality job at the stale digest before
the portability cases could become matrix evidence. All packed-artifact jobs and the npm 11/npm 12
contract job passed. The prerequisite binding was then deliberately refreshed, changing only the
critical digest and retaining both authenticated harnesses as pending; no stale canary result was
reused. With the refreshed binding, local quality returned exit code zero with 235/235 tests and
94.77% line, 96.02% function, and 89.39% branch coverage. Package inspection from the unchanged
product bytes retained 148 files at 157,928 bytes, and packed-artifact smoke had already passed local,
ephemeral, global, ESM, strict TypeScript, v1-to-v2 migration, initialization, validation, checkpoint,
and resume consumers. A new committed matrix is still required.

Workflow run `30710740555` then passed all eleven jobs on commit `60e2833`: Node 22 and 24 quality
plus dogfood checks on Linux, macOS, and Windows; packed-artifact smoke on minimum Node 22 and Node 24
across the three operating systems; and the pinned npm 11 release/npm 12 compatibility contracts.
The Windows jobs exercised the directory-junction target and dangling-target regression, while the
macOS jobs continued to execute both real Seatbelt integrations. This closes the portability gate for
the committed correction; it does not alter the pending authenticated Tier 1 prerequisites or expand
the product claim beyond repository-memory delivery and reconstruction.

## 2026-08-02 — Beta.6 release-candidate review

Package and lockfile metadata advanced to `0.1.0-beta.6` only after the committed portability matrix
passed. The changelog remained under `[Unreleased]` while the candidate gates ran. Local quality
returned exit code zero with 235/235 tests and coverage above every enforced floor. Package inspection
passed with 148 files and 158,581 bytes; publish-dry-run smoke passed local, ephemeral, global, ESM,
strict TypeScript, v1-to-v2 migration, initialization, validation, checkpoint, and resume consumers.
The production dependency audit reported zero vulnerabilities, and the registry returned `E404` for
the exact beta.6 version before release preparation.

The release review rechecked the original agent-discovery failure, fail-closed ancestor and target
classification, accepted Unix package-bin symlinks, rejected Windows directory junction and dangling
targets, target-versus-host PATH semantics, capability-scoped Seatbelt tests, generated Skill drift,
tracked research bindings, package contents, and claim boundaries. The review is GO with no unresolved
finding. It does not convert pending authenticated Tier 1 canaries into passes. The changelog was then
promoted to the dated beta.6 heading; clean-commit `release:verify`, fresh CI, immutable tagging, OIDC
publication, and independent registry/provenance checks remain required.

## 2026-08-02 — Carrylog beta.6 published through protected OIDC

Release commit `d447dfc1a95491712342a1f0079c369408f469b2` passed the complete local
`release:verify` gate and all eleven exact-commit CI jobs in run `30710993638`. Annotated immutable
tag `v0.1.0-beta.6` resolves locally and on `origin` to that commit. Tagged release run
`30711101598` passed Linux, macOS, and Windows preflight before the required `npm` environment review
was approved. The protected publish job then completed through npm trusted publishing with GitHub
OIDC and no registry token path.

The publish job built and verified one 148-file tarball, recorded SHA-256
`c434fc14e61a3395f79b63a6d7395015d7ae55ac2673ebc59d366d8fd822871e`, and published those
same bytes. An independent registry download matched that SHA-256, SHA-1
`d54e5d6e58f0e841288dfff2ca01535acc0af60e`, and SHA-512 integrity
`QiRPpB3KjUD567iNJHGKyWcHhnu8ffsWCe/cudyqhtUE5aU9jvR7xCNWuoFpDnVHj9rKhUdoK0rPrXYhOkcD8A==`.
The registry reports 148 files, 159,196 packed bytes, and 601,312 unpacked bytes. The `beta` tag
resolves to beta.6 while the policy-bound `latest` tag remains fixed at beta.4.

The public package exposes one npm registry signature and two attestations. `npm audit signatures`
verified the installed dependency graph and its attestation. The SLSA statement names
`Jaemani/Carrylog`, `.github/workflows/release.yml`, `refs/tags/v0.1.0-beta.6`, the exact release
commit, and run `30711101598` attempt 1; its transparency-log index is `2313524884`. An isolated
`npx` invocation and an isolated-prefix global installation both printed `0.1.0-beta.6`.

The local macOS prepare manifest recorded a different 158,946-byte tarball at SHA-256
`e5ddd129234e46bca78c97e56084ca186e41488668fbad9cb831c3ffdb5e10da`. That manifest was not
misrepresented as the published artifact: the tagged Linux job repacked the same release commit,
then verified and published one unchanged job-local tarball. Cross-host byte-for-byte packing is not
a current product or release invariant. The release procedure now distinguishes local prepare
evidence from the authoritative publish-job digest and requires the registry download to match the
latter.

Finally, a public-package lifecycle test used an isolated-prefix global beta.6 installation in a
fresh Git repository. It initialized configuration v2 with Codex, Claude, Cursor, and Gemini
surfaces, created all 14 planned files, committed them, validated without diagnostics, refreshed the
checkpoint, and returned a `resume --check` envelope with `checkpoint.stale=false`. This confirms the
published package's deterministic repository lifecycle. It does not add transcript portability,
repeated-switch behavior, semantic compaction, or formal Tier 1 outcome evidence.

## 2026-08-02 — Public beta.6 completed one Codex-to-Claude-to-Codex switch sequence

An isolated Personal Context fixture exercised public project-local beta.6 through fresh Codex,
Claude Code using the configured GPT router, and another fresh Codex session. Each stage resumed the
repository checkpoint, preserved earlier stage bytes, retained the protected product decisions and
failed-approach rationale, ran its assigned check, and left a current checkpoint. The final diff
contained only the smoke artifact and two Carrylog-owned context documents; live source and provider
state were not copied or changed.

The smoke also exposed three operational gaps: Claude required an explicit settings file, narrow Bash
permissions initially rejected an `rtk`-wrapped Carrylog command, and both Codex stages consumed tens
of thousands of tokens for a small continuation. The permission mismatch failed closed and the retry
used only equivalent wrapper-prefixed permissions. Detailed sanitized procedure, measurements,
limits, and claim boundaries live in
`research/continuity/public-beta-switch-smoke-2026-08-02.md`. This is one bounded behavior sequence,
not formal Tier 1, transcript portability, universal switch invariance, or compaction evidence.

## 2026-08-02 — Committed checkpoints required a portable settlement proof

Immediately after committing the sanitized public-beta switch-smoke evidence, `resume --check`
reported the checkpoint stale. The checkpoint block had correctly recorded the parent `HEAD` and
dirty staged/unstaged state before the commit, but the resulting clean commit necessarily had a new
identity and no working-tree changes. A tracked file cannot contain the hash of the commit that will
contain that same file, so repeatedly refreshing and committing the snapshot cannot produce a clean,
exactly self-referential checkpoint.

The correction preserves exact snapshot freshness and adds one narrower v2-only settlement state.
When every Git-visible, non-ignored project change is staged, `checkpoint` records the full base
parent, detached/branch identity, Git object format, and a domain-separated SHA-256 commitment over
the project-scoped index entries excluding the checkpoint. A later resume accepts only a clean state
whose `HEAD` has that full base as its sole parent and whose committed project tree has the same
commitment. The index, committed tree, checkpoint status, and ordinary snapshot are reobserved; any
mismatch, unsupported format, resource failure, legacy metadata, or malformed metadata remains stale.
Carrylog still never stages or commits.

Three tempting shortcuts were rejected. Ignoring `HEAD` would admit unrelated clean descendants.
Requiring a local reflog action would make the proof fail after push or clone. Binding upstream
divergence would make mutable remote-tracking state invalidate unchanged project bytes. The portable
contract instead accepts a content-equivalent rewrite with the same sole parent and project tree,
because no repository-owned evidence distinguishes it and the reviewed context is unchanged. ADR-0013
records this boundary and the explicit stage-checkpoint-stage-commit workflow.

The first independent review found a release-blocking counterexample: repository configuration can
set `submodule.<name>.ignore=all`, hiding a dirty submodule while the superproject index and gitlink
remain unchanged. Git status and both diff observations now force `--ignore-submodules=none`, as does
the settlement checkpoint-status check. A real local-submodule regression proves dirty capture is
ineligible and dirty state after settlement is stale even under `ignore=all`. The follow-up review
closed that P1 and found no remaining P0/P1 issue. A second portability review also required the
contract to say Git-visible rather than physical worktree cleanliness: ignored build output and
dependency directories intentionally remain outside the evidence boundary.

The focused continuity suite passes all 31 cases, including frozen v1 output, SHA-1 and SHA-256
repositories, conflicts, staged and checkpoint-only commits, partial and altered clean commits,
equivalent and altered amendments, merge/later history, nested roots, dirty index/worktree/checkpoint,
ignored files, ignored dirty submodules, detached identity, branch transition, malformed and
object-format-mismatched metadata, and branch-backed push/fresh-clone reconstruction. The complete
local quality gate passes above every coverage floor. From beta.7 candidate bytes, package inspection
passes with 153 files and 173,115 bytes, and installed-artifact smoke passes local, ephemeral, global,
ESM, strict TypeScript, v1-to-v2 migration, initialization, validation, checkpoint, and resume paths.
Large or sparse-index projects can exceed the bounded one-MiB/ten-second tree enumeration and then
receive explicit settlement-unavailable output with unchanged exact freshness; no broader scalability
claim is made.

The first release-candidate dogfood checkpoint made no write because the always-loaded context had
reached 16,016 characters against its configured 16,000-character limit. The limit was not raised to
hide the failure. Repeated Tier 1 status prose in `current-state.md` was consolidated while preserving
the pending prerequisites and evidence links, then validation and checkpointing were rerun.

The first post-commit release-verification observation was invalid. Token-filtered output was empty,
but `release/artifact.json` still named beta.6, so the apparent success was immediately retracted.
A marker-bearing retry later failed 12 tests: subprocess spawning reported `ENOENT` for the exact
Homebrew Node 22 executable while concurrently missing compiled `dist` modules reduced measured
coverage. It emitted no success marker. Investigation found no remaining Carrylog test or release
process, and the same Node 22 executable and symlink were present again. The available evidence does
not distinguish a transient Homebrew path mutation from interference by an earlier overlapping build,
so no root cause is claimed and no code exception was added.

The candidate was rebuilt with no parallel quality, coverage, package, or release process. The focused
continuity suite then passed 31/31. An isolated `release:verify` on clean commit `af2c560` completed
with explicit `RELEASE_VERIFY_OK` and exit code zero: 248/248 tests passed with 94.43% line, 96.39%
function, and 88.28% branch coverage; validation and generated surfaces were clean; the 153-file,
173,115-byte package passed every installed-artifact consumer; and the production audit found zero
vulnerabilities. Filtered silence remains non-evidence. A release claim requires the process exit,
explicit success marker, and artifact identity to agree, and the documentation settlement still needs
its own exact-commit rerun and cross-platform CI before tagging.

Exact-commit CI run `30714928860` passed release-client/npm 12 contracts, all three packed-artifact
jobs, and both Linux and both macOS quality jobs. Both Windows quality jobs failed the same fresh-clone
settlement regression. Git had materialized the copied schema and generated Skills with CRLF under
`core.autocrlf=true`; exact LF comparison then produced `E_SCHEMA_DRIFT` and `E_SKILL_DRIFT` before
resume could evaluate the otherwise clean portable settlement. The tag was not created.

ADR-0014 rejects disabling checkout conversion in the test and rejects taking control of the user's
root `.gitattributes`. Validation and sync planning now compare only Carrylog-owned complete schema
and Skill artifacts modulo paired CRLF/LF line endings. They preserve equivalent checked-out bytes,
while lone carriage returns and every non-EOL content change remain drift. The fresh-clone regression
forces and retains `core.autocrlf=true` on every host, proves all three generated files contain CRLF,
requires no-drift sync, and then requires the settled checkpoint to remain fresh. Focused continuity
and schema tests pass 44/44; complete quality, review, and a new cross-platform run remain required.

The complete corrected local quality gate passes 249/249 tests with 94.65% line, 96.40% function,
and 88.39% branch coverage. Package inspection passes with 154 files and 176,297 bytes. The same
candidate passes publish-dry-run and local, ephemeral, global, ESM, strict TypeScript, v1-to-v2
migration, initialization, validation, checkpoint, and resume consumers. Two independent read-only
reviews found no P0/P1 issue and retained a release NO-GO until both Windows Node 22 and 24 jobs pass
on the corrected commit.

## 2026-08-02 — Carrylog beta.7 published with portable checkpoint settlement

Corrected commit `515b1709cdc4522c190543b984d926775883e57a` passed an isolated local
`release:verify` with 249/249 tests, 94.65% line, 96.40% function, and 88.39% branch coverage. The
local prepare artifact contained 154 files and 176,417 bytes at SHA-256
`f7c4111e16524476587df73b41a488cb8ec28ad92cb01f2390dc0ae121d3d625`; it is local prepare
evidence, not the published Linux artifact. The repository's committed checkpoint resumed cleanly
with `checkpoint.stale=false` before push.

Exact-commit CI run `30715559240` passed all eleven jobs: Node 22 and 24 quality on Linux, macOS, and
Windows; packed-artifact smoke on Linux, macOS, and Windows; the minimum Node 22.0.0 consumer; and the
release npm 11/npm 12 package contracts. Both Windows quality jobs exercised the forced
`core.autocrlf=true` regression that had failed the preceding candidate. Only after that complete
matrix passed was immutable annotated tag `v0.1.0-beta.7` created and pushed.

Tagged release run `30715697081` passed Linux, macOS, and Windows preflight. Its protected `npm`
environment then waited for required review. The first API approval request encoded the environment
identifier with `gh api -f`, producing HTTP 422 because GitHub received a string rather than an
integer; no deployment or package mutation occurred. Retrying with the typed `-F` field approved the
same pending environment and exact tagged SHA. The protected job published through npm trusted
publishing with GitHub OIDC and no registry token path.

The publish job built, verified, and published one 154-file, 176,272-byte tarball at SHA-256
`47e3ae98efb3984124ec31d5090db5e1e7b592692942905d996d73a00e657e4e`. An independent
registry stream matched that SHA-256, SHA-1 `ce87dd099b86430e70f86134ca4bc130bc146b41`, and
SHA-512 integrity
`7vt+b2SFVvjlM9NOB3XZnHCdPBqckbnGleoDqlyNZ3MdcpZTbmXDi+fP5ug3QdZs0KGmHJLFxGa/+5YX18ShmA==`.
Registry metadata reports 154 files and 665,104 unpacked bytes. The explicit `beta` dist-tag resolves
to beta.7 while the registry-required `latest` tag remains fixed at the beta.4 bootstrap.

The public package exposes one registry signature and two attestations: npm publish provenance and
SLSA provenance v1. The SLSA statement binds `pkg:npm/carrylog@0.1.0-beta.7` to repository
`Jaemani/Carrylog`, `.github/workflows/release.yml`, `refs/tags/v0.1.0-beta.7`, exact commit
`515b1709cdc4522c190543b984d926775883e57a`, and run `30715697081` attempt 1. Its transparency-log
index is `2314202813`; the npm publish attestation uses index `2314203390`. An isolated installed
graph passed `npm audit signatures`, reporting verified signatures for both installed packages and a
verified attestation for the attested package, with zero audit vulnerabilities.

An empty-directory `npx` invocation using a private cache and an isolated-prefix global installation
both printed `0.1.0-beta.7`. A fresh Git repository then used only that isolated global package to
initialize all 14 configuration-v2 files and Codex, Claude, Cursor, and Gemini surfaces. Validation
returned no diagnostics. A clean checkpoint reported `settlementEligible=true`; after committing the
checkpoint, `resume --check --json` returned `checkpoint.stale=false`. This verifies artifact
delivery and deterministic repository checkpoint reconstruction. It does not establish transcript
portability, semantic compaction value, repeated-switch invariance, or formal comparative outcome
evidence.

## 2026-08-02 — Current-router comparison preparation exposed hidden harness assumptions

The beta.7 second-repository comparison deliberately did not reuse the live BusyCafe working tree.
Before the experiment, its Git-visible identity was recorded as HEAD
`81d9f1d47ddec2671d8633cb1a5edb3e3bf88755`, an empty tracked diff digest, and status-path digest
`cfca9384d814fef6c51bdd6bbd33723d047d928b6983057325384ea8b50fa06d`. No untracked contents were
read. The exact preregistered fixture commit
`0f2b9c354d6dcaa8faf52c1a67f87aa47d272af6` was fetched from GitHub into a bare repository under
`/tmp`; it exposes one shallow commit, no parent, and tree
`826f6da85498720f3c6d37963f1765e4c7243613`.

The unexecuted Tier 1 candidate was stale against the available environment: it still named beta.5,
Codex CLI 0.144.1, Claude Code 2.1.207 with native Haiku, and macOS 26.4. The amended draft binds
beta.7, Codex CLI 0.146.0, Claude Code 2.1.220, macOS 26.5.2, and the GPT-backed
`claude-route-codex` route. This remains a comparison between two harness surfaces, not an
independent model-family replication. The installed JM Router convenience launcher was rejected for
controlled execution because it appends `--dangerously-skip-permissions`.

A new router-authentication boundary invokes the exact native Claude executable by SHA-256, reads an
operator-supplied key file only after no-follow regular-file, size, mode, identity, and format checks,
and stages the key only in the child environment. It retains no key path, value, or digest and clears
the staged environment after execution. Missing, relative, symbolic-link, broad-mode, malformed,
oversized, wrong-executable, and unsafe-endpoint cases have regression coverage.

The first clean-cache BusyCafe preparation failed with npm `ENOTCACHED`: the runner accepted
`--allow-setup-network` for the package download but still forced the tarball dependency install to
`--offline`. Earlier prepare matrices had silently depended on a warm user npm cache containing
`yaml`. The fix passes the explicit setup-network decision and synthetic npm environment through
both package fetch and installation. Network-enabled preparation now warms the isolated `/tmp`
cache; the five remaining condition/harness preparations then pass offline. All six constructions use
the exact shallow fixture. Repository-only delivers neither packet nor resume envelope, manual
handoff delivers only the packet, and Carrylog delivers the packet, generated discovery surfaces,
and resume envelope.

Claude isolation initially failed for three distinct reasons, none of which was promoted to a pass.
One attempt reached workspace and MCP checks before the external router returned Cloudflare Tunnel
530/1033. A multi-action prompt allowed the routed model to omit an outside-Edit probe, so canary
actions were split into fresh one-action invocations. The writable invocation then revealed a real
contract defect: `Edit` and `Write` were exposed in `--tools` but absent from `--allowedTools`.
Workspace-scoped allow entries now exist only for writable runs. Claude Code also adds the explicit
default `replace_all:false` to Edit calls, so the expected input now includes that field instead of
loosening deep-equality. Finally, edits and writes to existing files require a prior read before path
permissions are evaluated; the outside-write canary now targets an absent file and independently
requires that it remain absent.

The final Claude router canary passed exact workspace Read/Edit, external Read/Write and external Git
metadata denial, all three registered MCP commands, native-executable binding, and ephemeral auth
cleanup. The matching Codex canary passed the current critical bytes, and the machine gate reports
both authenticated prerequisites passed. No scored provider run, reviewed artifact, evaluation, or
comparison outcome exists yet.

After the harness and ordering corrections, the focused research contract passes 66/66 tests. The
complete product quality gate passes 254/254 tests with 94.65% line, 96.40% function, and 88.39%
branch coverage. Package dry-run passes with 154 files and 179,212 packed bytes; the research tree
remains outside the npm artifact. Structural validation, deterministic order, all 60 blinded bundles,
and both authenticated prerequisite bindings pass for the same working bytes.

The deterministic run order now places the two BusyCafe objective fixture-harness blocks first while
retaining their previously assigned balanced condition permutations and blind IDs. This creates a
six-run partial comparison through the existing formal freeze, quarantine, review, and evaluation
path rather than adding a local execution bypass. The candidate remains draft until complete tests,
independent review, review attestations, and the first immutable manifest commit exist.

## 2026-08-02 — Independent review reversed hidden-source, cache, route, and scheduler assumptions

Two independent reviews returned NO-GO for scored execution. The runner still fell back to the live
neighboring BusyCafe worktree, inherited host npm and uv caches, bound only the requested router
alias, and checked execution order before a separately written claim. The review also identified
macOS-only implementation assumptions, ambiguous “variance pilot” wording, and a native-executable
check-to-spawn residual risk. No freeze manifest or scored result existed, so the candidate could be
corrected without rewriting evidence.

The BusyCafe source is now mandatory, absolute, canonical, below an accepted temporary root, and a
bare Git repository. There is no live-worktree fallback. One explicit temporary cache root owns the
artifact, npm, and uv caches; host HOME caches are not consulted. A cold online preparation populated
that root, and all six BusyCafe comparison cells then prepared offline from the same bytes. Every cell
reported source tree `826f6da85498720f3c6d37963f1765e4c7243613` and installed-tool tree digest
`9fbfa1e1bb3de48cfdd879121fc4182f2ffb6f29c1cc107217c9c009f6d91529`.

The first cold-cache retry found a meaningful implementation error rather than an environment
failure: the new installed-tree evidence reused the Git-metadata digester, which correctly rejects
all non-file/directory entries and therefore rejected npm's internal `.bin/carrylog` symlink. The Git
metadata invariant was not weakened. A separate installed-tool digester now binds files, directories,
and only relative symlinks that remain inside the installation tree; absolute and escaping links fail.

Scored order inspection and write-once claim creation now run under one global cross-process lock.
The active holder releases the lock after either success or an ordinary rejected transaction. A killed
process leaves the lock for explicit operator review; the runner never auto-deletes an unexplained
stale lock. A real two-process regression races `t1-001` and `t1-002` and proves that the later run
cannot be admitted before its predecessor has both terminal quarantine and reviewed state.

Claude identity now has three layers. The exact native executable is rechecked immediately before
every spawn. The complete live `/v1/models` record for `claude-route-codex`, including route target
`codex-default`, must match reviewed digest
`76978a1d811d405d8b9c45a6bed0e3cf465badb9a16f9949e583ec228d3603e4`. Every assistant event must
also expose one of the preregistered resolved GPT model IDs. The client surface does not expose the
router's internal provider ID, so the protocol explicitly makes no provider-identity claim. The final
native check-to-spawn syscall interval remains a documented TOCTOU residual.

Current authenticated Codex and routed-Claude canaries passed these exact critical bytes. The full
local quality gate passes 262/262 tests with 94.65% line, 96.40% function, and 88.39% branch coverage.
Package inspection passes with 154 files and 179,341 bytes. Generated surfaces and product validation
are clean; the research validator accepts 10 tasks and 60 runs, deterministic order is current, and
both current harness prerequisites are passed.

The final original-repository check retained BusyCafe HEAD
`81d9f1d47ddec2671d8633cb1a5edb3e3bf88755` and the empty tracked diff digest. Its untracked-path
digest changed from the earlier observation while still containing one path. Carrylog never used or
modified that worktree, and no untracked contents or paths were read, but physical-repository
invariance is therefore not claimed. The isolated bare source identity remained the experiment input.

## 2026-08-02 — Offline preparation received an operating-system network boundary

The post-review runner still relied on npm and uv offline flags during preparation. Those flags are
useful dependency-manager controls, but they do not prove that a subprocess cannot open a socket.
Offline setup now runs every package preparation, installation, build, and Carrylog initialization
command inside a macOS Seatbelt profile that denies all network access. Online cache population
remains a separate, explicit setup action. A localhost listener regression verifies an actual denied
connection rather than inferring isolation from command arguments.

The first focused retry exposed two test defects before any scored work. The router-catalog timeout
was referenced inside the attestation function without being declared there; the staged-auth path now
forwards its bounded timeout and the direct attestation API has the same default. A cache-symlink test
also assumed that the symbolic-link-specific diagnostic would win, even though the earlier canonical
temporary-root check correctly failed closed first. The test now accepts either safe rejection without
weakening the containment rule.

A new cold cache under the system temporary directory was populated once with setup network enabled.
The same cache then prepared `t1-001` through `t1-006` offline under the Seatbelt boundary. All six
cells used the preregistered bare BusyCafe source, reported source tree
`826f6da85498720f3c6d37963f1765e4c7243613`, and agreed on one installed-tool tree. The original
BusyCafe worktree was not a runner input and was not modified.

Refreshing the harness binding reset both authenticated prerequisites to pending. Fresh Codex and
routed-Claude canaries then passed the current critical bytes; the Claude run re-attested the live
route catalog and native executable before spawn. The complete local quality gate passes 264/264
tests with 94.65% line, 96.40% function, and 88.39% branch coverage. Package inspection, generated
surface checks, product validation, Tier 1 structural validation, deterministic ordering, the
synthetic isolation canary, and both current prerequisite gates pass. Exact package and installed-tree
artifact measurements belong to the excluded research record because this engineering log is itself
part of the npm package; embedding a digest of an artifact containing that digest would be
self-referential.

No freeze manifest, GO attestation, scored provider run, privacy-reviewed artifact, evaluation, or
comparison result exists. The corrected candidate still requires independent review over its final
bytes before the preregistration can move from draft to frozen.

## 2026-08-02 — Independent review found a cache escape and model-allocation confound

The next independent protocol review kept scored execution at NO-GO and found a P0 boundary defect.
The configured cache root was canonical and temporary, but its existing `artifacts`, `npm`, or `uv`
children were created recursively without independent link checks. A same-user or pre-provisioned
child symlink could therefore redirect package-manager or artifact writes outside the accepted root.
The earlier preparation evidence was superseded before any scored run, manifest, or reviewed result
existed.

Cache population now requires a dedicated empty owner-only root claimed exclusively. The runner
writes an exclusive population claim, creates each child as an owner-only real directory, revalidates canonical layout,
and writes a ready receipt only after successful preparation. Offline use requires that receipt,
repository scope, released tarball digest, and installed `node_modules` tree digest. An interrupted
population remains unsealed and cannot be reused. Regression coverage rejects each of the three child
symlink escapes before external use. The installed-tree digest deliberately excludes prefix-level npm
metadata whose absolute tarball path varies with the temporary cache location.

The review also rejected the original three-model allowlist. The `claude-route-codex` alias is an
automatic Sol-to-Terra-to-Luna route, so recording the selected model did not prevent condition-level
allocation confounding. A first single-model canary pinned Sol and failed on Terra; changing the pin
to Terra then failed on Sol. Neither failure was promoted. The controlled Claude harness now bypasses
the load-balancing alias, disables gateway discovery, binds the direct `gpt-5.6-sol` catalog record,
requests that exact model, and rejects every other response ID. Fresh direct-model and Codex canaries
pass the current critical bytes.

A new sealed BusyCafe cache completed one explicit online population and all six offline preparation
cells under macOS Seatbelt network denial. Every offline cell reported the same cache ID, ready-receipt
digest, source tree, released tarball, and installed-tool tree. This remains prerequisite evidence,
not behavioral comparison evidence. The candidate remains draft until final tests and both independent
reviews pass over the same bytes.

## 2026-08-02 — The first formal freeze review exposed a lifecycle-sensitive test

The first exact-digest review returned NO-GO before manifest creation. The candidate had moved from
`draft-until-committed` to `frozen`, but one real-root preflight test still expected the authenticated
prerequisite failure from an earlier draft state. The implementation correctly allowed review-digest
generation; the test failed because it coupled its expected result to the repository's mutable freeze
lifecycle. No scored run, attestation, manifest, or result existed.

An asynchronous quality invocation initially returned only a running process identifier. Treating
that yield as completion temporarily hid the failing exit status; explicit polling later recovered
the complete 264/265 result and exit code 1. Future long-running gates must be polled through terminal
completion before any pass is recorded.

A second assigned reviewer then violated its read-only contract by changing the failing test and the
candidate-status wording during review. That review and its child reviews were interrupted and are
not eligible attestations. Their changed digest was discarded. The candidate returned to draft, and
the fix was reviewed locally before any new formal digest: the preflight test now verifies real
preflight only, while the existing synthetic fixture continues to test both draft rejection and
frozen acceptance deterministically. This removes ambient lifecycle dependence instead of encoding
the current status as a one-off expectation.

The focused freeze-contract suite passes 20/20 in draft state. The complete local quality gate then
passes 265/265 tests with 94.65% line, 96.40% function, and 88.39% branch coverage. Formatting,
whitespace, current critical-file bindings, and both authenticated prerequisite gates also pass. A
new frozen digest and two genuinely read-only independent reviews remain required.

## 2026-08-02 — Formal review rejected distorted delta and unclassified shell evidence

The next exact-digest review returned NO-GO with two P1 findings before any manifest or scored run.
The Carrylog condition reset the prepared handoff's index entry to the source HEAD and marked it
`assume-unchanged` so verification saw a clean repository, but ordinary final Git diff reused that
index. A later model edit to the handoff could therefore be hidden or compared through the wrong
index state. The runner now clears the setup-only flag and builds a new temporary index directly from
the synthetic delivery baseline. Scored delta compares that isolated index with actual worktree
bytes. A real Git regression proves both sides: an untouched prepared handoff produces no phantom
delta, while a later handoff edit appears exactly in the patch.

The same review found that Codex `command_execution` events were recorded but did not invalidate an
otherwise successful run. Claude exposes no Bash tool, so this created a harness-asymmetric path for
unregistered verification to reach scoring. Both successful and failed direct command events now
become terminal `protocol-deviation` failures before any blinded artifact is published. The retained
audit record contains only byte counts, SHA-256 digests, normalized status, and exit code; raw command
and output text are not persisted. No-command and registered-wrapper cases remain accepted, and the
blind evaluation rubric states the wrapper-only credit rule.

The fixes also removed the last real-root lifecycle dependency from the preflight unit test. The
complete quality gate passes 267/267 tests with 94.65% line, 96.40% function, and 88.39% branch
coverage. Package dry-run passes with 154 files and 182,857 bytes; isolated package smoke covers local,
ephemeral, global, ESM, strict types, migration, initialization, validation, checkpoint, and resume.
All six BusyCafe cells prepare offline from the sealed cache under macOS Seatbelt network denial and
the isolated bare source. The original BusyCafe worktree remains unused.

The authenticated Codex canary passed the corrected critical bytes at
`2026-08-02T00:10:14.429Z`. The Claude canary failed closed before authentication because the current
shell did not provide `CARRYLOG_PILOT_CLAUDE_ROUTER_KEY_FILE`; it remains pending. No credential was
searched, copied, or persisted, and no new freeze digest may be produced until that operator-supplied
path is available and the Claude canary passes.

## 2026-08-02 — Stream-lifecycle review closed timeout and raw-diagnostic gaps

Two follow-up read-only reviews kept the candidate at NO-GO. Codex detection covered only completed
`command_execution` events, so a command that emitted `item.started` and then timed out or crashed
could be misclassified as a provider failure. Claude Bash inputs were projected to digests, but the
connected `tool_result.content` could remain raw in delivery evidence. Neither defect had reached a
manifest or scored run.

Harness filtering now recognizes Codex started, updated, and completed command lifecycles, merges
events by transient item identity only in memory, and never retains that identity. A started-only
attempt is sufficient to terminate the run as a protocol deviation. Protocol classification occurs
before timeout, spawn, nonzero-exit, missing-success-event, and missing-response classification, so
provider failure cannot hide an observed direct command. Claude filtering first identifies Bash tool
uses and then replaces connected and otherwise ambiguous tool results with byte-count and SHA-256
projections whenever a Bash deviation exists. Raw command, output, tool-use identity, and Bash result
content are not persisted.

Local review found one additional privacy edge before re-freeze: malformed JSONL, stderr, and
provider-error diagnostics were still stored as raw visible events. A command event truncated inside
its JSON line could therefore expose arbitrary text that pattern-based secret sanitization could not
recognize. These opaque channels now retain only typed byte counts and SHA-256 digests. This preserves
failure correlation without pretending that a redaction pattern can classify every secret.

Regression coverage now includes successful no-command and registered-MCP turns, successful and
failed direct commands, started-only commands followed by timeout, nonzero exit, and truncated
output, lifecycle identity deduplication, Claude string and structured Bash results, absence of raw
secret markers from retained evidence, and protocol-stage precedence over provider failures. The
complete quality gate passes 274 tests with 94.65% line, 96.40% function, and 88.39% branch coverage.
Package dry-run and isolated package smoke also pass; the research harness remains outside the npm
artifact.

All six BusyCafe objective cells again prepare offline through the sealed cache and isolated bare
source under macOS Seatbelt network denial. The original BusyCafe worktree is not read or modified.
The current-byte Codex authenticated prerequisite passed at `2026-08-02T00:36:31.262Z`. Claude remains
pending because `CARRYLOG_PILOT_CLAUDE_ROUTER_KEY_FILE` is absent. Existing user configuration exposes
an `apiKeyHelper`, but invoking it to manufacture an undeclared temporary credential input was
rejected as a local workaround; the reviewed contract still requires an explicit owner-only key file.

The documentation update initially raised always-loaded project context to 16,165 characters against
the configured 16,000-character budget, and `carrylog sync --check` correctly failed. The limit was
not raised. Repeated implementation detail was condensed in `current-state.md` while the full account
remained here; the final generated-surface and validation checks then passed without adapter drift.

## 2026-08-02 — Checkpoint dogfood replaced an entry-count bound with a context bound

The first checkpoint attempt after the research amendment failed closed before writing. Although the
current always-loaded context was valid, replacing its old three-path snapshot with the 89-file draft
would have raised the total to 23,056 characters. Git inspection limited examples to 200 entries, but
that count did not bound rendered size because portable paths and terminal-safe JSON escaping have
variable length. Raising the repository's 16,000-character policy or committing the draft before its
review boundary would have hidden the defect rather than fixed it.

ADR-0015 adds a second deterministic bound. Git inspection still parses the complete bounded status
response and preserves every aggregate count, but the sorted displayed prefix must fit both 200
entries and 1,024 rendered characters including indentation and line separation. Remaining records
become an explicit `omittedChanges` count. If the first record alone is too large, the snapshot shows
only the omission count instead of incorrectly saying that no paths changed. Resume uses the same
projection, so an older expanded checkpoint becomes visibly stale and requires refresh.

Focused handoff and performance tests pass 25/25, including a 205-path fixture, a near-1 MiB 20,000-
record corpus, and an oversized first path. On the live draft, dry-run retained 12 example paths,
reported 81 omitted paths, reduced the rendered snapshot from 9,119 to 2,010 characters, and kept the
prospective always context at 15,947 of 16,000 characters. The complete quality gate passes 275 tests
with 94.67% line, 96.41% function, and 88.45% branch coverage.

## 2026-08-02 — Exact-digest review rejected PATH-resolved Codex identity

The Claude authenticated prerequisite passed through the documented owner-only JM Router key file,
so both harness prerequisites initially passed and the candidate produced review digest
`7f3df7250b563e04e9a194aceee12d0adcefd3c0a38cf2086d6d2ae5eee43338`. The independent methods review
returned GO, but the independent security review returned NO-GO before any attestation, manifest,
commit, or scored run. Codex execution still spawned the mutable PATH name `codex` and checked only
its reported version, while Claude resolved and digest-bound an absolute native executable. A
PATH-shadowed program could report the expected version and change the experiment boundary.

The candidate immediately returned to `draft-until-committed`; the prior GO is ineligible because its
digest is superseded. The fix does not whitelist this workstation's launcher path. It resolves the
installed `@openai/codex` launcher only to find the platform package, selects the actual native binary,
verifies its preregistered SHA-256 digest, and passes that absolute path to every canary and scored
spawn. Direct native installations remain supported by the same byte check. The invocation builder
now rejects missing or relative Codex executable paths, which removes the ambient PATH fallback from
the executable contract. Version setup and every pre-spawn boundary repeat native resolution and
digest verification. The final verified-path-to-spawn syscall interval remains an explicit TOCTOU
risk shared with Claude.

Regression tests cover npm-launcher bypass, direct native installation, digest drift, unsupported
platforms, relative paths, and the absolute invocation contract. The first targeted run exposed a
macOS `/var` to `/private/var` canonical-path expectation in the test; the expectation was corrected
to compare real paths rather than weakening production canonicalization. The corrected targeted suite
passes 20/20. Critical-file bindings and both authenticated prerequisites must now be refreshed, and
two new read-only reviews over one new frozen digest remain mandatory.

After the binding refresh, the corrected research suite passes 91/91. Current-byte Codex and Claude
authenticated canaries pass at `2026-08-02T04:36:06.362Z` and `2026-08-02T04:37:32.684Z`. The complete
quality gate passes 277/277 with 94.67% line, 96.02% function, and 88.44% branch coverage; package
dry-run reports 155 files and 187,651 bytes, and the full package consumer smoke passes. All six
BusyCafe comparison cells prepare offline from the same sealed cache and isolated bare source under
Seatbelt network denial, recording both native executable digests. The candidate remains draft until
two new exact-digest GO reviews succeed.

## 2026-08-02 — Frozen attempt 1 aborted before claim and became a new experiment

The first scored invocation exposed a bootstrap defect that the unit and prepare-only matrices did
not exercise. `run.mjs` called `freeze --check` through its shared command helper before the lexical
declaration of `deterministicSetupEnvironment`, so JavaScript raised a temporal-dead-zone
`ReferenceError`. The failure occurred before claim creation, provider authentication, or model
execution. Inspection found no quarantine record beyond tracked policy files, and the immutable suite
still passes `freeze --check` at commit `382cda0e2a5efb3eca5e487e482c7316d6394617` and suite digest
`3809b850da94f259ff9f2749918cfa45dbe5657bf9b4dc095a69cde4f2d59fc8`.

Changing that runner in place would violate the permanent first-ADD boundary. Attempt 1 therefore
remains an auditable aborted experiment. `research/continuity-r2/tier1` is a separate experiment with
one behavioral amendment: declare setup environment before freeze verification and give the offline
freeze subprocess an explicit host environment. The new suite rebinds its task/schema paths and blind
bundle task digests to its own namespace, resets attestations and prerequisites, contains no copied
manifest or result, and adds a regression contract for declaration order and explicit freeze
environment. It does not reuse attempt-1 reviews.

Attempt 2 passes 92/92 suite tests, both new authenticated canaries, and all six offline BusyCafe
preparations. The full repository gate passes 369/369 with 94.67% line, 96.41% function, and 88.45%
branch coverage; package dry-run passes with 155 files and 187,818 bytes. A read-only diff review found
zero unresolved findings and confirmed that the old freeze is untouched, the new runtime difference
is limited to namespace/bootstrap binding, and no result or provider call was reused. Two fresh
exact-digest reviews and a new manifest boundary remain required before execution.

## 2026-08-02 — Attempt 3 produced the first reviewed behavioral comparison

Attempt 2 wrote the first scheduler claim but then encountered a second temporal-dead-zone defect in
terminal publication. Because the retained bytes cannot prove whether provider execution occurred,
the event remains unavailable and contributes no score. The suite was not repaired in place.

Attempt 3 received new blind identities, execution order, canaries, exact-digest reviews, and a
permanent manifest boundary. It froze at `b72127e`; its suite and manifest digest is
`2427a17f2e0c02415bf7f6604edf026e619f4ff260ac0910336d98986ee2eb9b`. Pre-result suite tests passed
93/93. The full repository gate passed 462/462 with 94.67% line, 96.41% function, and 88.45% branch
coverage, and package dry-run reported 155 files and 188,502 bytes.

The first six frozen runs completed across both harnesses and all three conditions. Every artifact
passed explicit privacy review and blind item-level evaluation. Freeze verification and analysis
reconcile six scored runs and 54 not-started runs with no protocol diagnostic, exclusion, sensitive
exposure, contradiction, prohibited reversal, repeated work, or unnecessary clarification. The
canonical interim table and interpretation are recorded in
`research/continuity/beta7-second-repository-comparison.md` rather than duplicated here.

Independent result review found one non-blocking measurement defect: Claude metadata reports zero
input tokens for non-empty prompts with nonzero output and cost. Those raw fields remain immutable but
are unavailable for efficiency inference. The behavioral metrics do not depend on them, and the
preregistered STOP rule is false, so the review authorized continuing the remaining 54 runs.

Running the frozen suite tests after result publication passes 92/93. The failing synthetic analyzer
contract copies mutable quarantine results and therefore observes two more terminal cells than its
pre-result expected count. Freeze verification, analyzer reconciliation, exact artifact/evaluation
hashes, and privacy bindings pass. Editing that test would mutate the frozen suite, so attempt 3
retains the known defect and a future experiment must make its synthetic fixture independent of
ambient result surfaces.

The first post-result formatting gate also rejected generated quarantine and reviewed JSON because
Biome preferred different array wrapping. Reformatting those files would invalidate their artifact,
bundle, privacy-review, and evaluation digests. The repository formatter now excludes only
`raw-quarantine` and `raw-reviewed` trees under `research`; their dedicated schema, sanitizer, digest,
privacy, and analyzer gates remain authoritative. Source, frozen inputs, evaluations, and derived
tables remain in the normal formatting gate.

## 2026-08-02 — Attempt 3 stopped at a deterministic REDESIGN boundary

The second scored block completed five additional runs and retained one delivery failure. BusyCafe
failed-approach cells completed under all three Codex conditions. The Carrylog verification-readiness
repository-only and manual cells also completed; the Carrylog-resume cell failed before authentication
or model execution because beta.7 validation detected an old generated continuity Skill.

Code inspection showed an experiment construction error rather than random provider failure.
`prepareCarrylogContext` ran `init` and `sync` for BusyCafe, but for the Carrylog repository it replaced
the handoff and proceeded directly to checkpoint and validation. The preregistration defines the
Carrylog condition as the released product bundle, including generated router and Skill surfaces.
Keeping old generated bytes violates that control and deterministically makes the remaining
Carrylog-repository resume cells unavailable. The failure remains a reviewed `carrylog-delivery`
exclusion with no replacement.

The same block identified a second harness defect. Registered commands inherited the broker's
detached `GIT_DIR` and `GIT_WORK_TREE`. The focused test suite's nested `git init` calls therefore
attempted to lock the protected external metadata directory and produced 9 passes and 7 failures.
The exact retained fixture passed the same focused suite outside the scored sandbox with zero
failures. That diagnostic does not replace scored receipts. The successor must keep repository Git
environment for broker pre-state capture and explicit Git commands while deleting it from non-Git
verification child environments.

After privacy review and blind scoring, analysis reconciles 11 scored runs, one delivery failure, 48
not-started runs, and zero protocol diagnostics. Its mechanical classification is REDESIGN. Because
the shared Carrylog-repository construction would prevent ten resume cells and twenty contrast
vectors from becoming screenable, executing the other 48 runs cannot satisfy the frozen GO rule.
Attempt 3 stops without changing its frozen files. Any successor needs a new experiment identifier,
reviews, manifest, and freeze boundary.

## 2026-08-02 — Attempt 4 repaired delivery construction and verification Git isolation

Attempt 4 was created from the clean attempt-3 freeze tree rather than by editing the frozen suite.
It removed the copied manifest, reset both authenticated prerequisites and review attestations,
generated a new seed, execution order, blind identities, and rubric bundles, and moved the initial
screen to the two Carrylog verification-readiness harness blocks. Attempt-3 results remain immutable
and are not pooled into this successor.

Carrylog-resume preparation now checks the preexisting generated surface, runs the digest-bound
beta.7 CLI `sync` offline for both repositories, requires `sync --check` and `validate` to pass, and
commits those generated bytes before installing the task handoff. The original Carrylog fixture is
required to exhibit pre-sync drift, so a future source change that removes the repair case fails the
candidate rather than silently weakening it. A fresh online cache population and same-cache offline
reuse both prepared the first Carrylog resume cell successfully. All six initial Carrylog cells then
prepared offline; no provider authentication or model call occurred during these checks.

Registered verification commands now declare `gitContext` as either `repository` or `none`. Missing,
unknown, or executable-incompatible declarations fail closed, and the declaration is included in the
per-command digest. Wrapper pre-state capture always uses the detached repository environment.
Only explicit `git` commands receive that environment and a Seatbelt profile that can read detached
metadata. Node, npm, uv, and other children receive neither repository-selection variables nor
metadata read access. Regression tests prove that an isolated Node child can create its own nested
Git repository while detached metadata remains unreadable, and that explicit Git commands still
observe the frozen external repository. Scratch, offline package settings, receipt integrity,
external-file denial, localhost denial, DNS denial, and read-only detached metadata constraints
remain intact.

The first repository-wide quality run reported 553 passes and two failures. Both were frozen
attempt-3 synthetic analyzer tests copying live mutable result surfaces after that experiment had
published outcomes; product coverage remained above every threshold. Attempt 3 cannot be repaired in
place. Attempt 4 removes quarantine state before constructing synthetic analysis fixtures, and the
root test scripts now separate product tests from the explicitly named active research suite. The
quality gate still runs both surfaces, while immutable historical experiments retain their recorded
freeze and execution evidence instead of becoming mutable release dependencies.

## 2026-08-02 — Attempt 4 stopped after the six-cell repair screen

Attempt 4 passed both authenticated prerequisites, two independent reviews over one exact digest, and
its permanent first-ADD freeze at commit `88f6427`. The preregistered repair screen then executed the
Carrylog verification-readiness fixture across Codex and routed Claude under Carrylog-resume,
repository-only, and manual-handoff conditions. All six terminal bundles passed explicit privacy
review and blind item-level evaluation. Freeze verification still binds the committed suite digest;
analysis reconciles six scored runs, 54 not-started runs, and no protocol diagnostic or exclusion.

The screen produced one useful behavioral contrast and one measurement failure. Codex reconstructed
all six facts under Carrylog and manual handoff, while repository-only contradicted all three resource
limits. Routed Claude reconstructed the complete rubric from repository-only source, while both
supplied-context conditions omitted the same two explicit evidence-limit qualifications. These are
single-item exploratory observations and support neither a universal benefit nor a regression claim.

More importantly, every condition and both harnesses returned the same registered focused-test result:
11 of 16 passed and five Git-backed cases failed with `E_NOT_GIT_REPOSITORY` or resulting exit-code
mismatches. Attempt 4 correctly removed inherited `GIT_DIR` and `GIT_WORK_TREE` from Node, npm, and uv
children, so nested `git init` no longer targets protected detached metadata. The binary policy also
removed the only way for those processes to discover the outer fixture because scored checkouts have
no local `.git`. The isolation canary proved nested Git independence but did not require simultaneous
outer-repository discovery. It therefore certified only half of the needed contract.

The remaining 54 runs are deliberately not executed. Verification success is a preregistered task
outcome, and a condition-independent harness ceiling would spend provider calls while preventing the
registered command from satisfying its contract. Attempt 4 remains immutable and mechanically reports
`REDESIGN` with an incomplete matrix. A successor requires a new experiment identity and, before any
review or freeze, one canary that simultaneously proves read-only outer-repository discovery, nested
Git independence without inherited repository-selection variables, detached-metadata confinement, and
network denial. The exact five previously failing cases must pass in that boundary.

## 2026-08-02 — Repository-discovery boundary passed before attempt 5 design

A throwaway `--separate-git-dir` clone first proved that an ordinary Git gitfile can expose an outer
repository without inheriting `GIT_DIR` or `GIT_WORK_TREE`. The first Seatbelt run failed at process
startup with `uv_cwd` because `/tmp` had canonicalized to `/private/tmp` without matching ancestor
traversal rules. Reusing the existing realpath and ancestor policy removed that failure.

Three further failures exposed runtime dependencies rather than reasons to restore inherited
repository selection. Homebrew Node needed its OpenSSL configuration root. Carrylog's reconstructed
Git environment then attempted to probe `/etc/gitconfig`, and macOS Git needed
`/usr/share/i18n/esdb/UTF/UTF-8-MAC.esdb` for the hostile-Unicode path case. Exact read-only roots
raised the focused result from 11/16 to 15/16 and finally 16/16. External metadata remained outside
every write root and network remained denied.

The successful experiment was not copied into frozen attempt 4. A separate non-scored
`research/continuity-discovery-boundary` prototype now defines three explicit policies: `none`,
`repository` for direct Git, and `repository-discovery` for a non-Git command that must both discover
the outer fixture and create independent nested repositories. Unknown or executable-incompatible
policies fail closed. Discovery children receive no repository-selection variables; their checkout
contains a canonical gitfile pointing to read-only external metadata.

The policy additionally rejects broad or physical-alias runtime roots that contain protected
metadata. It permits checkout writes while explicitly denying direct and atomic-replacement writes
to the outer `.git` gitfile. The live canary proves those denials, external metadata immutability,
write denial through an in-checkout external symlink, nested Git independence, outer HEAD discovery,
and localhost denial in one Seatbelt process. It also replays the exact five Git-backed continuity
cases that failed in attempt 4; all five pass. Pure and live prototype tests pass 9/9.

Independent review returned GO with no blocking finding after the gitfile, inherited-environment,
and physical-alias guards were added. The reviewer retained one non-blocking P2: prototype process
timeouts send `SIGTERM` but do not yet enforce a grace-period `SIGKILL`, explicit timed-out state, or
combined output cap. A scored successor must use the mature runner process contract rather than
copying that helper unchanged. It must also bind `/etc/gitconfig` state or adopt a released explicit
product policy so host configuration cannot become an invisible experimental input.

After the final hardening, the complete quality gate passes with 94.67% line, 96.41% function, and
88.37% branch coverage. The active research gate reports 102/102, including the nine discovery
tests. Final package dry-run reports 155 files and 193,579 bytes, and the full local, ephemeral,
global, ESM, strict-types, migration, init, validation, checkpoint, and resume smoke passes. No
provider call was made, attempts 1 through 4 were not modified, and this evidence does not authorize
a continuity claim or a scored attempt by itself.

## 2026-08-02 — Attempt 5 integrated discovery and closed verifier settlement races

Attempt 5 was created under `research/continuity-r5` with new run order, blind identities, pending
prerequisites, empty result surfaces, and no copied manifest or review attestation. Attempts 1 through
4 remain unchanged. The draft integrates `none`, direct `repository`, and
`repository-discovery` across the registry, wrapper, MCP broker, Seatbelt profiles, canaries, and
screen command. It also binds observed `/etc/gitconfig` state, removes inherited repository-selection
variables from discovery children, preserves nested Git independence, and retains read-only access to
the canonical outer gitfile and metadata only where the command contract requires it.

The first independent review returned NO-GO for three process-boundary defects: termination reached
only the direct child group, authenticated canaries did not traverse repository discovery, and the
MCP rendered a successful silent command as exit 1. The supervisor now owns a POSIX process group,
escalates from SIGTERM to SIGKILL, applies a final completion bound when descendants retain inherited
pipes, and records received versus retained output digests. Both authenticated canaries include the
discovery command, and silent success renders exit 0. Regression coverage includes ordinary
descendants, escaped inherited pipes, discovery invariants, and the actual MCP silent-command path.

A second review found that a verifier escaping into a new session could outlive forced supervisor
completion. `completionForced` and signal-delivery failure therefore became protocol-fatal: the live
monitor aborts the provider harness, forbids workspace-diff and blinded-artifact publication, forces
fixture removal even under `--keep`, and retains only bounded failure evidence. This does not claim
that Seatbelt kills an arbitrary new session; it prevents uncertain process activity from entering a
score.

A third review found that terminal-only receipts could not distinguish no command from a detached
wrapper still in flight after an MCP or provider parent failure. Later review reproduced three more
settlement races: the monitor did not remember an earlier prefix, a normally exiting verifier could
leave a detached descendant that wrote to the checkout after evidence capture, and an MCP process
could begin after monitor shutdown. Receipt format 5 now records broker and invocation lifecycles and
appends a final seal over the prior record count, byte count, and SHA-256. The monitor retains the
complete observed prefix, and successful evidence requires a readable sealed stream with every
lifecycle settled. Missing, truncated, rewritten, partial, duplicate, mismatched, late, or unsettled
history is protocol-fatal. Verification checkouts are read-only while a separate scratch remains
writable; a live macOS regression proves that this restriction is inherited by a detached descendant.

The first BusyCafe offline screen exposed another real boundary defect. Pytest passed outside
Seatbelt but failed inside it because Python followed `/usr/share/zoneinfo` through a macOS system
symlink that the sandbox denied. Granting the logical path did not help, while the canonical physical
versioned directory was readable. The registry now binds that physical directory and supplies it as
`PYTHONTZPATH`. Python bytecode is redirected to scratch and pytest's cache provider is disabled.
After the fix, the same sealed offline cache passes 22 focused tests and compileall exits zero without
output; the Carrylog continuity screen remains 16/16 with receipt format 5.

The first quiescent review returned one further NO-GO: the parser counted broker and invocation
lifecycle settlement independently, so a syntactically sealed
`broker-start → start → broker-terminal → terminal → seal` stream could pass. Invocation records now
carry an explicit `origin` and `brokerId`. MCP invocation starts and terminals require the same live
broker, a broker cannot terminate while one of its invocations is unsettled, brokers cannot overlap,
and direct screens use a null broker ID in a broker-free stream. Malformed-order, missing-broker,
mixed-origin, and invalid-ownership regressions cover the rejected paths without pretending that a
prepare-only direct screen is an MCP broker.

The attempt-5 suite now passes 116/116 and the active suite passes 125/125. Five repeated MCP
parent-failure regressions complete without a flaky authorization path, the non-authenticated
isolation canary passes, and harness-critical digests are current. Both authenticated prerequisites
remain pending. No provider call, freeze operation, manifest creation, or scored run occurred during
this work. Product quality, package dry-run, and package smoke are intentionally rerun only after the
final code and documentation review surface stops changing.

## 2026-08-04 — Attempt 5 offline draft received independent GO

The corrected receipt ownership contract received independent GO over 150 Attempt-5 files. The
reviewer recomputed aggregate SHA-256
`1aebc353cd626f28e232e1182bd9dfee97a76e284dbcda82fe059a727ba0f922`, reran the focused receipt
contracts, the complete 116-test Attempt-5 suite, the 125-test active research suite, structural
validation, deterministic order, the non-authenticated isolation canary, and `git diff --check`.
No provider or authenticated canary ran during review.

After the review surface stopped changing, `npm run quality`, `npm run pack:check`, and
`npm run test:package` all exited successfully. Harness-critical bindings remain current and both
authenticated prerequisites remain pending. The next boundary is an ordinary draft commit followed
by canaries from that clean commit; this GO is not a freeze attestation, behavioral result, or scored
provider evidence.

## 2026-08-04 — First attempt-5 prerequisites failed closed before freeze

The reviewed offline draft was checkpointed and committed as `844a456`. Its first authenticated
Codex prerequisite reached `gpt-5.6-sol`, but the isolated client exposed none of the four configured
verification MCP tools. The model therefore performed zero tool calls and zero shell probes instead
of the required five actions. Exact evidence validation rejected the run and left the prerequisite
pending. The canary's evidence-failure branch retained bounded JSON events but omitted the Codex
client's already captured stderr, preventing a precise MCP startup diagnosis.

The Claude prerequisite was attempted next but made no provider request. Its initial executable
check used host `PATH`, where an interactive JM Router launcher preceded the native Claude Code
launcher. The wrapper digest correctly differed from the preregistered native digest, so execution
stopped before route-catalog attestation, authentication staging, or model access. The design had
documented a native `~/.local/bin/claude` path but the implementation still used `which`; this was a
real control-plane mismatch rather than a Claude-to-GPT model anomaly.

The repair resolves host `~/.local/bin/claude` directly, follows that launcher's target, and verifies
the preregistered bytes independently of `PATH`. Tests include a competing wrapper and reject relative
or digest-mismatched candidates. Codex exact-probe failures now include at most 2,000 characters of
the existing redacted stderr diagnostic. Independent review then identified the Codex control defect:
the verification MCP was enabled and its tools had exact approvals, but the server was not marked
required. Codex therefore could continue a turn after broker initialization failed and present zero
verification tools. The shared canary and scored-run invocation now sets the broker's `required=true`;
startup failure must terminate the client instead of degrading to a tool-free session. Harness-critical
bindings were refreshed and both prerequisites remain pending. No freeze, manifest, scored run, raw
provider-output persistence, or credential persistence occurred.

The repaired Codex prerequisite subsequently passed. The first routed-Claude attempt with an
available key resolved every assistant response to `gpt-5.6-sol` and completed one allowed Read, then
Claude Code terminated with `error_max_budget_usd` before the remaining MCP and denial checks. The
prerequisite stayed pending and no freeze work began. This was not a model-routing mismatch: the
registered catalog and response identity agreed. It exposed a stale canary assumption instead. The
USD 0.05 cap had passed attempt 4 while the gateway adapter reported zero input usage; after the
adapter began supplying a nonzero conservative estimate, Claude Code could enforce its budget after
the first turn. The canary now uses the same bounded USD 0.75 cap as a scored Claude run. Changing the
critical canary bytes invalidates the recorded Codex pass, so both prerequisites must be rerun from a
new clean commit.

Independent review rejected that direct cap replacement before commit. The canary launched nine
separate Claude processes, so USD 0.75 was a per-probe cap and permitted up to USD 6.75 in aggregate,
not the documented scored-run ceiling; it also exceeded the previous USD 0.45 aggregate bound. The
repair replaces the process-per-probe loop with one no-persistence Claude session containing the same
nine numbered calls. One `--max-budget-usd 0.75` now bounds the complete prerequisite. The result must
contain exactly the registered tool names and inputs in order, every expected permission denial must
remain bound to its tool-use ID, and execution must continue after those denials. The earlier wording is
retained above as the failed intermediate decision rather than rewritten as if it had been correct.

The first offline-gate pass refreshed the harness-critical digest before applying the repository
formatter. Biome then changed one critical line, and structural validation correctly rejected the
stale digest. The workflow was restarted in the safe order—format first, refresh second, validate
third—and both prerequisites remained pending. No authenticated canary ran from the mismatched state.

The next independent review also rejected the one-process design. Running every probe with
`acceptEdits` no longer exercised the `dontAsk` read-only surface used by most scored Claude tasks.
The parser also discarded assistant events that omitted `message.model`, so one valid model-bearing
event could mask a later model-less response. Finally, the draft claimed temporal continuation after
denials even though the stream parser proved only exact tool-use order and final denial bindings. The
repair uses two no-persistence processes whose integer-cent caps are asserted to total USD 0.75: USD
0.55 for the read-only profile and USD 0.20 for the writable profile. It validates each profile's exact
tool sequence independently, retains every assistant event as a string model or explicit null, and
rejects null or unregistered identities. The unsupported temporal claim was removed. Both
prerequisites remain pending and no provider call occurred during this repair.
