# Handoff

<!-- agent-context-kit:handoff-snapshot:start -->
## Repository evidence

- Branch: "main"
- HEAD: "191db00 at 2026-08-02T01:39:51+09:00"
- Upstream: "origin/main; ahead 3, behind 0"
- Working tree: Clean (snapshot file excluded)
- Staged diff: 0 file(s), +0/-0, 0 binary
- Unstaged diff: 0 file(s), +0/-0, 0 binary
- Scope: project directory; changed paths are project-relative; this handoff snapshot file is excluded

### Changed paths (0)

None.

### Recent commits (5)

    {"commit":"191db00","committedAt":"2026-08-02T01:39:51+09:00","subject":"fix: resolve pinned Carrylog without agent file discovery"}
    {"commit":"f64f5df","committedAt":"2026-07-13T03:10:55+09:00","subject":"research: harden Tier 1 continuity candidate"}
    {"commit":"c9e8c2d","committedAt":"2026-07-12T14:39:51+09:00","subject":"docs: record Carrylog beta5 publication"}
    {"commit":"343b4e3","committedAt":"2026-07-12T14:17:33+09:00","subject":"release: prepare Carrylog beta5"}
    {"commit":"660b0ce","committedAt":"2026-07-12T04:24:45+09:00","subject":"docs: record beta5 candidate CI"}
<!-- agent-context-kit:handoff-snapshot:end -->

## Objective

Restore the supported Linux, macOS, and Windows matrix for the generated continuity-Skill correction,
then prepare beta.6 only from fresh committed evidence.

## Completed

- Ran a read-only Personal Context baseline in which Claude Code through a GPT router reconstructed
  Codex-authored repository handoff facts and retained them after a Claude-native resume with no file
  or shell tools.
- Built an isolated Personal Context clone with Carrylog v2 context, Codex and Claude surfaces, a
  project-pinned candidate package, and a current checkpoint. The final Claude Skill run selected the
  pinned executable, returned the resume envelope, and reconstructed its verified continuation state.
- Reproduced a generated-Skill defect where agent file discovery hid ignored
  `node_modules/.bin/carrylog` and incorrectly selected the global candidate.
- Replaced the ambiguous discovery step with a silent cross-platform probe that distinguishes an
  absent local executable from an unusable or uncertain local candidate. Only true absence permits
  global fallback.
- A read-only second review first returned NO-GO because a dangling ancestor could surface as leaf
  `ENOENT`. The probe now validates both ancestor directories before classifying leaf absence, and a
  repeat review returned GO without findings.
- Added process-level regressions for absent, invalid, dangling-ancestor, dangling-leaf, and usable
  platform-specific candidates and regenerated the canonical continuity Skill.
- Inspected failed workflow run `30710079223`. Both Linux jobs exposed unguarded macOS Seatbelt
  integration prerequisites; both Windows jobs additionally exposed host-dependent PATH construction
  and a directory-junction executable target that the probe accepted.
- Changed the macOS verification PATH compiler to explicit POSIX target semantics and restricted only
  actual `sandbox-exec` integration to Darwin while retaining pure harness contracts on every CI OS.
- Strengthened the project-local executable probe to dereference file candidates and require a
  regular-file target before executable access. Added accepted regular-file/symlink cases and rejected
  directory-target/dangling-junction cases.

## Verification

- The final isolated candidate validates without diagnostics and resumes with
  `checkpoint.stale=false` on `codex/runtime-v1-stabilization` at `6c046ce`; Claude returned the full
  expected branch, HEAD, next action, local-candidate selection, and resume command.
- Resuming that final Claude session with all tools disabled retained the branch, current checkpoint
  state, and next action from the resumed conversation alone.
- The focused continuity and research harness contracts pass on the local macOS host, including both
  real Seatbelt integrations and the valid symlink-to-regular-file probe case.
- `npm run quality` passes the complete format, strict TypeScript, test, and coverage gates.
- `npm run pack:check` passes with 148 files and 157,928 packed bytes.
- `npm run test:package` passes local, ephemeral, global, ESM, strict-type, migration, initialization,
  validation, checkpoint, and resume consumers.
- Fresh Linux and Windows verification remains pending; no supported-matrix GO is claimed from local
  results.

## Decisions

- An ignored local executable is detected by an exact filesystem probe, not agent file-discovery
  tools. Exit 0 selects it, exit 1 means true absence, and any other result stops without fallback.
- Selection requires both link identity and a dereferenced regular-file target. Directory junctions
  and dangling links are uncertain and stop rather than falling through globally.
- A compiler for a declared target uses target path semantics, not the host running its pure test.
  macOS Seatbelt execution is capability-specific; the surrounding pure contracts stay portable.
- The smoke test is delivery, reconstruction, and native-Claude-resume evidence only. It is not
  Codex transcript import, behavioral continuity, permission isolation, or compaction evidence.
- Existing Tier 1 prerequisite records remain pending. Ad hoc router access does not amend frozen
  CLI/model identities or satisfy formal canary requirements.
- Immutable beta.5 remains unchanged; this fix belongs to a new prerelease candidate if released.

## Risks

- The formal Tier 1 preregistration pins older Codex and Claude CLI versions and a native Claude model;
  current Codex and Claude-router identities require an explicit protocol amendment and fresh review.
- A normal Claude invocation still selects an unavailable model unless the router settings and model
  are passed explicitly.
- Narrow Claude Bash command patterns rejected compound Skill commands; the successful product smoke
  used broad Bash permission only inside an isolated clone and does not prove a safe default policy.
- Cross-harness behavior, repeated-switch retention, transcript portability, and compaction value
  remain unproven.
- The portability correction has no fresh committed Linux or Windows result yet. Workflow
  `30710079223` remains a failed diagnostic run, not reusable evidence.

## Next action

Commit and push the reviewed portability correction, require a new full CI matrix, and inspect every
supported job. Prepare beta.6 only after that matrix is green; Tier 1 router repinning remains a
separate evidence decision.
