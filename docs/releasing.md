# Release process

Releases publish one already-reviewed tarball; the publish step does not rebuild source.

## Prerequisites

- The repository owner has selected a license; package metadata, canonical `LICENSE`, and the
  SHA-256 recorded in `docs/license-policy.json` agree.
- npm account `jaemani` retains `auth-and-writes` two-factor authentication.
- GitHub environment `npm` has required-review protection.
- After the package exists, npm trusted publishing authorizes repository
  `Jaemani/Agent-Context-Kit`, workflow `release.yml`, and environment `npm`.
- The release commit is clean and the package version has not been published.

## First-publication bootstrap

npm trusted-publisher configuration may require an existing package. If the npm package settings do
not permit preconfiguration, create a short-lived granular npm token limited to
`@jaemani/agent-context-kit`, allow publication under the account's 2FA policy, and store it only as
the protected GitHub environment secret `NPM_TOKEN`. Push the reviewed beta tag so GitHub Actions
publishes with provenance. Immediately after success:

1. configure the npm trusted publisher for `release.yml` and environment `npm`;
2. delete `NPM_TOKEN` from GitHub and revoke the granular token;
3. verify a later beta publishes through OIDC without a registry token.

Do not paste tokens into issues, commits, terminal transcripts, or chat. Do not locally rebuild and
publish a different tarball as a shortcut.

## Prepare

1. Update version, changelog, current state, handoff, and compatibility docs.
2. Complete the required large-change review and resolve every high-severity finding.
3. Run the full quality/package/audit suite.
4. Commit and push; require a clean successful CI matrix.
5. Tag the exact reviewed commit as `v<package-version>`.

Never move or overwrite a pushed release tag. If a tagged workflow fails before publication, preserve
the tag as audit evidence, increment the prerelease version, document the failure, and create a new
reviewed tag.

`npm run release:verify` enforces clean Git state, beta version/publish policy, license presence,
dogfood context consistency, quality/coverage, package contents, runtime audit, and exact-artifact
smoke tests. It writes the tarball and `artifact.json` under ignored `release/`; the manifest records
commit, size, and SHA-256.

## Publish and verify

Pushing a matching `v*-beta.*` tag starts `.github/workflows/release.yml`. Tagged preflight pins npm
11.18.0 across Linux, macOS, and Windows and loads its provenance implementation before running
package gates. The protected publish job pins Node 24.15.0 and the same npm 11.18.0 client,
rebuilds/verifies the release artifact, publishes that same `release/*.tgz` with public access, `beta`
dist-tag, and provenance, then retries registry `npm exec` verification. npm 12.0.0 remains a package
metadata compatibility target but is not a release client because its published bundle omits the
`sigstore` dependency required by provenance generation. The client check also rejects a `sigstore`
module resolved outside the pinned npm installation. GitHub OIDC write permission exists only on the
protected publish job; preflight retains read-only repository permission.

After the workflow succeeds, independently verify:

```bash
npm view @jaemani/agent-context-kit dist-tags --json
npx --yes @jaemani/agent-context-kit@beta --version
npm install --global @jaemani/agent-context-kit@beta
ackit --version
```

Keep `latest` unset until a stable release. A defective immutable release is followed by a fixed beta
and an npm deprecation message; do not rely on unpublish as rollback.
