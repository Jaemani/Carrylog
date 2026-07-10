# Release process

Releases publish one already-reviewed tarball; the publish step does not rebuild source.

## Prerequisites

- The repository owner has selected a license; package metadata, canonical `LICENSE`, and the
  SHA-256 recorded in `docs/license-policy.json` agree.
- npm account `jaemani` retains `auth-and-writes` two-factor authentication.
- GitHub environment `npm` has required-review protection.
- After the package exists, npm trusted publishing authorizes repository
  `Jaemani/Carrylog`, workflow `release.yml`, and environment `npm`.
- The release commit is clean and the package version has not been published.

## First-publication bootstrap

npm trusted-publisher configuration may require an existing package. If the npm package settings do
not permit preconfiguration, the token UI may also be unable to select the still-unregistered
`carrylog` package. Create a granular token with the narrowest package-write scope the UI actually
permits and the shortest available expiry; first creation may unavoidably require temporary write
access broader than one package. Record that breadth before use. The compensating controls are one
protected environment, required review, one reviewed tag, no local use, immediate post-publication
administration, and prompt revocation. The token must support unattended publication under the
account's write-2FA policy; a token that still requires an interactive OTP will fail the protected
job. Store it only as the protected GitHub environment secret `NPM_TOKEN`, and push the reviewed beta
tag so GitHub Actions publishes with provenance.

Immediately after success, require these postconditions in order:

1. verify the exact registry version, three artifact digests, provenance subject, and `beta` tag;
2. inspect all dist-tags, remove `latest` if npm assigned it to the prerelease, then re-query and
   require `beta=0.1.0-beta.4` with `latest` absent;
3. configure and list the trusted publisher, requiring repository `Jaemani/Carrylog`, workflow
   `release.yml`, environment `npm`, and publish permission;
4. remove the old package's unintended `latest` tag and deprecate its exact beta.3 version; retain
   its `beta` tag only for the separately bounded migration window described below;
5. set Carrylog Publishing access to `Require 2FA and disallow tokens`, preserving the trusted
   publisher while rejecting future granular-token publication;
6. set the old package to the same token-disallowing policy after its token-based administration is
   complete;
7. delete the GitHub environment `NPM_TOKEN`, confirm its absence, and revoke the granular npm token;
8. record a required follow-up that verifies a later beta publishes through OIDC without a registry
   token.

The registry may create `latest` for a package's first publication even when npm is invoked with a
prerelease tag. Do not infer dist-tag state from the publish command. Query the registry after every
release and remove any unintended stable-channel tag before declaring the prerelease complete.

Do not paste tokens into issues, commits, terminal transcripts, or chat. Do not locally rebuild and
publish a different tarball as a shortcut.

## Prepare

1. Update version, changelog, current state, handoff, and compatibility docs.
2. Complete the required large-change review and resolve every high-severity finding.
3. Run the full quality/package/audit suite.
4. Commit and push; require a clean successful CI matrix.
5. Tag the exact reviewed commit as `v<package-version>`.

Never move or overwrite a pushed release tag. If a tagged workflow exposes a source, workflow,
dependency, or artifact defect before publication, preserve the tag as audit evidence, increment the
prerelease version, document the failure, and create a new reviewed tag.

An unchanged tagged workflow may be rerun only when evidence proves that the failure was limited to
authentication or protected-environment configuration and no source, workflow, dependency, or
artifact correction is required. A single immediate E404 is insufficient because first-publication
visibility can lag by minutes. Repeated exact-version, dist-tag, and attestation checks must remain
absent through at least the workflow's bounded registry-verification horizon. Timeout, ambiguous
transport output, or partial transparency-log evidence is non-rerunnable until registry state
converges. When both attempts built an artifact, their package, version, commit, size, and digests must
match. Any code, workflow, dependency, or artifact defect requires a new version and tag.

`npm run release:verify` enforces clean Git state, beta version/publish policy, license presence,
dogfood context consistency, quality/coverage, package contents, runtime audit, and exact-artifact
smoke tests. It writes the tarball and `artifact.json` under ignored `release/`; the manifest records
commit, size, and SHA-256.

## Publish and verify

Pushing a matching `v*-beta.*` tag starts `.github/workflows/release.yml`. Tagged preflight pins npm
11.18.0 across Linux, macOS, and Windows and loads its provenance implementation before running
package gates. The protected publish job pins Node 24.15.0 and the same npm 11.18.0 client,
rebuilds/verifies the release artifact, publishes that same recorded tarball with public access,
`beta` dist-tag, and provenance, then retries registry `npm exec` verification. Publication does not
pass a shell glob to npm: a shell-free script reads `release/artifact.json`, requires exactly one
regular tarball, rechecks package/version/commit, size, SHA-256, SHA-1, and SHA-512 integrity, and
passes its absolute path as the only npm package spec. npm 12.0.0 remains a package
metadata compatibility target but is not a release client because its published bundle omits the
`sigstore` dependency required by provenance generation. The client check also rejects a `sigstore`
module resolved outside the pinned npm installation. GitHub OIDC write permission exists only on the
protected publish job; preflight retains read-only repository permission.

After the workflow succeeds, independently verify:

```bash
npm view carrylog dist-tags --json
npx --yes carrylog@beta --version
npm install --global carrylog@beta
carrylog --version
```

Keep `latest` unset until a stable release, and verify this invariant from registry state rather than
assuming `--tag beta` enforced it. A defective immutable release is followed by a fixed beta and an
npm deprecation message; do not rely on unpublish as rollback.

## Rename migration administration

`@jaemani/agent-context-kit@0.1.0-beta.3` is immutable historical evidence, not a second active
release line. After `carrylog@0.1.0-beta.4` passes every registry and consumer check:

1. remove the old package's unintended `latest` dist-tag and verify only its temporary `beta` tag
   remains;
2. deprecate the exact old version with a message that names `carrylog@beta`, the `carrylog` command,
   and `https://github.com/Jaemani/Carrylog`;
3. keep the old `beta` tag only for a documented migration window so existing installs receive the
   deprecation message; do not unpublish or rewrite its provenance;
4. remove that old `beta` tag only after the migration window and external usage check.

After the immediate dist-tag and deprecation operations, set the old package Publishing access to
`Require 2FA and disallow tokens`. Later web-authenticated owner administration can close the migration
window without restoring a publish token.

OIDC trusted publishing authorizes publication, not arbitrary dist-tag or deprecation administration.
Finish those authenticated registry operations before revoking the bootstrap credential when its
scope permits them; otherwise use a separately authenticated owner session without broadening the
workflow token.
