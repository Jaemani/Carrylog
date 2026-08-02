import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCommandGitContext,
  buildRepositoryDiscoverySeatbeltProfile,
  buildVerificationEnvironment,
  deriveMacosRuntimeReadPaths,
  GIT_CONTEXT_POLICIES,
  MACOS_GIT_READ_PATHS,
  validateRepositoryDiscoveryLayout,
} from "../boundary.mjs";

test("registered Git context distinguishes direct Git, discovery children, and isolated children", () => {
  assert.doesNotThrow(() =>
    assertCommandGitContext({ executable: "git", gitContext: GIT_CONTEXT_POLICIES.repository }),
  );
  assert.doesNotThrow(() =>
    assertCommandGitContext({ executable: "node", gitContext: GIT_CONTEXT_POLICIES.discovery }),
  );
  assert.doesNotThrow(() =>
    assertCommandGitContext({ executable: "node", gitContext: GIT_CONTEXT_POLICIES.none }),
  );
  assert.throws(
    () => assertCommandGitContext({ executable: "node", gitContext: "repository" }),
    /only a direct Git command/,
  );
  assert.throws(
    () => assertCommandGitContext({ executable: "git", gitContext: "repository-discovery" }),
    /only a direct Git command/,
  );
  assert.throws(
    () => assertCommandGitContext({ executable: "node", gitContext: "inherit" }),
    /unknown Git context policy/,
  );
});

test("only direct Git receives repository-selection variables", () => {
  const input = {
    baseEnvironment: { HOME: "/scratch/home", PATH: "/usr/bin" },
    checkout: "/fixture/checkout",
    gitDirectory: "/fixture/metadata.git",
  };
  const repository = buildVerificationEnvironment({
    ...input,
    policy: GIT_CONTEXT_POLICIES.repository,
  });
  assert.deepEqual(repository, {
    ...input.baseEnvironment,
    GIT_DIR: input.gitDirectory,
    GIT_WORK_TREE: input.checkout,
    GIT_OPTIONAL_LOCKS: "0",
  });
  for (const policy of [GIT_CONTEXT_POLICIES.none, GIT_CONTEXT_POLICIES.discovery]) {
    const environment = buildVerificationEnvironment({ ...input, policy });
    assert.deepEqual(environment, input.baseEnvironment);
    assert.notEqual(environment, input.baseEnvironment);
    for (const name of ["GIT_DIR", "GIT_WORK_TREE", "GIT_OPTIONAL_LOCKS"]) {
      assert.equal(Object.hasOwn(environment, name), false);
    }
  }
  assert.throws(
    () =>
      buildVerificationEnvironment({
        ...input,
        policy: GIT_CONTEXT_POLICIES.discovery,
        baseEnvironment: { ...input.baseEnvironment, GIT_DIR: "/unexpected" },
      }),
    /base environment contains forbidden GIT_DIR/,
  );
  assert.throws(
    () =>
      buildVerificationEnvironment({
        ...input,
        policy: GIT_CONTEXT_POLICIES.discovery,
        baseEnvironment: { ...input.baseEnvironment, GIT_COMMON_DIR: "/unexpected" },
      }),
    /base environment contains forbidden GIT_COMMON_DIR/,
  );
  assert.doesNotThrow(() =>
    buildVerificationEnvironment({
      ...input,
      policy: GIT_CONTEXT_POLICIES.discovery,
      baseEnvironment: {
        ...input.baseEnvironment,
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_SYSTEM: "/dev/null",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
    }),
  );
});

test("canonical external gitfile layout is accepted", async () => {
  const fixture = await createLayout();
  try {
    assert.doesNotThrow(() => validateRepositoryDiscoveryLayout(fixture));
  } finally {
    await fixture.remove();
  }
});

test("layout rejects noncanonical, overlapping, and non-regular identities", async () => {
  const fixture = await createLayout();
  try {
    assert.throws(
      () =>
        validateRepositoryDiscoveryLayout({
          ...fixture,
          checkout: `${fixture.checkout}${path.sep}.`,
        }),
      /checkout must be canonical/,
    );
    await writeFile(path.join(fixture.checkout, ".git"), `gitdir: ${fixture.gitDirectory}\r\n`);
    assert.throws(() => validateRepositoryDiscoveryLayout(fixture), /exact canonical external/);
    await rm(path.join(fixture.checkout, ".git"));
    await symlink(fixture.gitDirectory, path.join(fixture.checkout, ".git"));
    assert.throws(() => validateRepositoryDiscoveryLayout(fixture), /regular gitfile/);
  } finally {
    await fixture.remove();
  }

  const overlap = await createLayout({ scratchInsideMetadata: true });
  try {
    assert.throws(() => validateRepositoryDiscoveryLayout(overlap), /metadata overlaps scratch/);
  } finally {
    await overlap.remove();
  }
});

test("discovery profile reads external metadata and macOS Git data without making them writable", async () => {
  const fixture = await createLayout();
  try {
    const runtime = ["/opt/runtime/bin/node"];
    const profile = buildRepositoryDiscoverySeatbeltProfile({
      ...fixture,
      policy: GIT_CONTEXT_POLICIES.discovery,
      runtimeReadPaths: runtime,
    });
    assert.match(profile, /^\(version 1\)\n\(deny default\)/);
    assert.match(profile, /\(deny network\*\)/);
    assert.doesNotMatch(profile, /\(allow default\)/);
    assert.equal(profile.includes(`(subpath ${JSON.stringify(fixture.gitDirectory)})`), true);
    for (const systemPath of MACOS_GIT_READ_PATHS) {
      assert.equal(profile.includes(`(literal ${JSON.stringify(systemPath)})`), true);
    }
    const writeSection = profile.slice(profile.indexOf("(allow file-write*"));
    assert.equal(writeSection.includes(JSON.stringify(fixture.checkout)), true);
    assert.equal(writeSection.includes(JSON.stringify(fixture.scratchRoot)), true);
    assert.equal(writeSection.includes(JSON.stringify(fixture.gitDirectory)), false);
    assert.equal(
      writeSection.includes(
        `(deny file-write*\n  (literal ${JSON.stringify(path.join(fixture.checkout, ".git"))}))`,
      ),
      true,
    );
    for (const systemPath of MACOS_GIT_READ_PATHS) {
      assert.equal(writeSection.includes(JSON.stringify(systemPath)), false);
    }
  } finally {
    await fixture.remove();
  }
});

test("none profile cannot follow the checkout gitfile to external metadata", async () => {
  const fixture = await createLayout();
  try {
    const profile = buildRepositoryDiscoverySeatbeltProfile({
      ...fixture,
      policy: GIT_CONTEXT_POLICIES.none,
      runtimeReadPaths: ["/opt/runtime/bin/node"],
      writableCheckout: false,
    });
    assert.equal(profile.includes(JSON.stringify(fixture.gitDirectory)), false);
    for (const systemPath of MACOS_GIT_READ_PATHS) {
      assert.equal(profile.includes(JSON.stringify(systemPath)), false);
    }
    const writeSection = profile.slice(profile.indexOf("(allow file-write*"));
    assert.equal(writeSection.includes(JSON.stringify(fixture.checkout)), false);
    assert.equal(writeSection.includes(JSON.stringify(fixture.scratchRoot)), true);
    assert.equal(writeSection.includes(JSON.stringify(path.join(fixture.checkout, ".git"))), true);
  } finally {
    await fixture.remove();
  }
});

test("runtime allowlists cannot accidentally grant a parent of protected metadata", async () => {
  const fixture = await createLayout();
  try {
    assert.throws(
      () =>
        buildRepositoryDiscoverySeatbeltProfile({
          ...fixture,
          policy: GIT_CONTEXT_POLICIES.discovery,
          runtimeReadPaths: [path.dirname(fixture.gitDirectory)],
        }),
      /runtime read path overlaps protected Git metadata/,
    );
    const alias = path.join(path.dirname(fixture.gitDirectory), "metadata-alias");
    await symlink(fixture.gitDirectory, alias);
    assert.throws(
      () =>
        buildRepositoryDiscoverySeatbeltProfile({
          ...fixture,
          policy: GIT_CONTEXT_POLICIES.discovery,
          runtimeReadPaths: [alias],
        }),
      /runtime read path overlaps protected Git metadata/,
    );
  } finally {
    await fixture.remove();
  }
});

test("runtime derivation includes package, dylib, Homebrew keg, and OpenSSL configuration roots", () => {
  const paths = deriveMacosRuntimeReadPaths([
    {
      invocationPath: "/opt/homebrew/bin/node",
      realPath: "/opt/homebrew/Cellar/node/22.23.0/bin/node",
      packageRoot: "/opt/homebrew/lib/node_modules/example",
      linkedLibraries: [
        {
          invocationPath: "/opt/homebrew/opt/openssl@3/lib/libcrypto.3.dylib",
          realPath: "/opt/homebrew/Cellar/openssl@3/3.6.0/lib/libcrypto.3.dylib",
        },
      ],
    },
  ]);
  for (const expected of [
    "/opt/homebrew/bin/node",
    "/opt/homebrew/Cellar/node/22.23.0",
    "/opt/homebrew/lib/node_modules/example",
    "/opt/homebrew/opt/openssl@3",
    "/opt/homebrew/etc/openssl@3",
    "/opt/homebrew/Cellar/openssl@3/3.6.0",
  ]) {
    assert.equal(paths.includes(expected), true, expected);
  }
});

async function createLayout(options = {}) {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "carrylog-discovery-contract-")));
  const checkout = path.join(root, "checkout");
  const gitDirectory = path.join(root, "metadata.git");
  await mkdir(checkout);
  await mkdir(gitDirectory);
  const scratchRoot = options.scratchInsideMetadata
    ? path.join(gitDirectory, "scratch")
    : path.join(root, "scratch");
  await mkdir(scratchRoot);
  await writeFile(path.join(checkout, ".git"), `gitdir: ${gitDirectory}\n`);
  return {
    checkout,
    gitDirectory,
    scratchRoot,
    remove: async () => rm(root, { recursive: true, force: true }),
  };
}
