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
