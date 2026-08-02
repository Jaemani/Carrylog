# Engineering conventions

## Supported environments

- Node.js 22 and 24.
- Linux, macOS, and Windows are the supported beta matrix.
- TypeScript uses strict unchecked-index and exact-optional-property checks.

## Commands

```bash
npm ci
npm run build
npm run format:check
npm run check
npm test
npm run test:coverage
npm run test:research:active
npm run quality
npm run pack:check
npm run test:package
node dist/cli.js sync --check
node dist/cli.js validate --json
```

When shell commands are run in this repository's current Codex environment, prefix every command
segment with `rtk` as required by the root AGENTS instructions.

## Change quality

- Fix root causes rather than adding repository-specific exceptions.
- Keep mutation in commands and safe filesystem utilities; renderers stay pure.
- Add regression coverage for defects and both accepted/rejected cases for safety changes.
- Record schema, compatibility, dependency, or architectural choices as ADRs.
- Update product docs, current state, engineering log, and handoff when materially affected.
- Do not claim checks that were not run.

Large beta changes require a dedicated review pass with findings recorded and resolved or accepted.
Tagged releases additionally require `npm run release:verify`, a clean licensed commit, and the
protected workflow in `docs/releasing.md`.
