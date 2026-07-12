## Objective

Make the smallest documentation-only correction to the stale first-publication gap in
`docs/testing-strategy.md`.

## Completed

- beta.4 and beta.5 publication evidence exists; beta.5 used token-free OIDC.
- `beta` points to beta.5 while npm's non-removable `latest` remains intentionally fixed at beta.4.

## Verification

- Run `git diff --check` and `npm run format:check`.
- Do not claim checks that were not executed.

## Decisions

- Exact run IDs, hashes, sizes, and transparency-log evidence belong only in
  `docs/engineering-log.md`.

## Risks

- The other listed gaps—Windows link coverage, syscall fault injection, authenticated harness checks,
  and external outcomes—remain open and must not be deleted.

## Next action

Remove or precisely replace only the obsolete first-publication bullet; do not touch runtime,
schemas, package metadata, workflows, tags, registry state, or unrelated documents.
