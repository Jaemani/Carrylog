# Product scope

## Product statement

Carrylog is a local-first project-context governance and handoff layer for teams and individual
developers who switch among AI coding agents. It gives a repository one canonical, reviewable,
versioned context source and compiles small adapters for each supported tool. It preserves durable
project truth rather than capturing or reconstructing private session transcripts.

## Primary users

1. Developers who use Codex, Claude Code, Cursor, Gemini CLI, or similar tools on the same codebase.
2. Teams that need agent changes to follow shared architecture, quality, and handoff constraints.
3. Maintainers who want context changes reviewed through normal Git workflows.

## Jobs to be done

- Continue work in a new agent without manually retelling the project state.
- Know whether project context is missing, stale, oversized, or inconsistent with generated files.
- Add a new agent adapter without creating another independently maintained project memory.
- Leave a verifiable handoff that distinguishes facts, checks, assumptions, and unresolved risk.
- Keep context loading proportional to the task instead of injecting every document every time.

## Product invariants

- Canonical human-authored state is separate from generated adapters.
- Default commands do not delete or silently replace pre-existing human content.
- Read and write paths remain inside the project and do not traverse symlinks.
- Core behavior is deterministic, offline-capable, and inspectable.
- A failed preflight does not partially update another adapter.
- Context freshness is never claimed without evidence.

## Explicit non-goals

- Replacing project management, source control, ADR systems, or documentation platforms.
- Prescribing PRD-to-implementation workflows like a complete agent methodology.
- Automatically deciding architecture or product priorities.
- Hiding an LLM call behind validation or deterministic commands.
- Treating token count alone as context quality.
- Reproducing a coding agent's hidden session state, full conversation, or internal compaction
  behavior; continuity is based on explicit, reviewable project and task checkpoints.
- Replacing hook- or daemon-based automatic session journals; those can consume exported repository
  context later without becoming part of the deterministic core.
- Supporting every agent through guessed formats; each adapter needs a researched and tested
  conformance contract.

## Success measures

The technical beta is successful when it is safe and predictable across dogfood and representative
adoption fixtures. External beta learning and the stable gate add measurable product outcomes:

- reduced manual onboarding text when switching agents;
- zero unmanaged-content loss in adoption and synchronization tests;
- deterministic adapter output across supported operating systems;
- bounded always-loaded context with transparent measurement;
- handoffs that another agent can continue from without asking for basic state reconstruction;
- migration guarantees for every published configuration version.

Exact telemetry is intentionally not collected by the local CLI in the current scope. Any future
analytics must be opt-in and must not upload repository content.
