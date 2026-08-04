import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  attestClaudeRouteCatalog,
  clearClaudeRouterAuthentication,
  nativeClaudeLauncherPath,
  ROUTER_KEY_FILE_ENV,
  resolveNativeClaudeExecutable,
  stageClaudeRouterAuthentication,
  verifyClaudePreSpawnIdentity,
} from "../claude-router-auth.mjs";

const modelRecord = {
  context_window: 272000,
  created: 0,
  display_name: "GPT-5.6 Sol",
  id: "gpt-5.6-sol",
  max_input_tokens: 258400,
  object: "model",
  owned_by: "Codex ChatGPT",
  protocol: "responses",
};
const routeCatalogSha256 = createHash("sha256").update(canonicalJson(modelRecord)).digest("hex");
const catalogFetch = async (_url, options) => {
  assert.equal(options.headers["x-api-key"], "jmr_0123456789abcdef");
  assert.equal(Object.hasOwn(options.headers, "user-agent"), false);
  return new Response(JSON.stringify({ data: [modelRecord] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

test("native Claude resolution binds the exact executable bytes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-native-claude-"));
  try {
    const executable = nativeClaudeLauncherPath(root);
    const wrapperDirectory = path.join(root, "path-wrapper");
    const wrapper = path.join(wrapperDirectory, "claude");
    await mkdir(path.dirname(executable), { recursive: true });
    await mkdir(wrapperDirectory);
    const bytes = "#!/bin/sh\nprintf 'test claude\\n'\n";
    await writeFile(executable, bytes, { mode: 0o700 });
    await writeFile(wrapper, "#!/bin/sh\nprintf 'router wrapper\\n'\n", { mode: 0o700 });
    const expectedSha256 = createHash("sha256").update(bytes).digest("hex");
    assert.equal(
      await resolveNativeClaudeExecutable({
        expectedSha256,
        executablePath: executable,
      }),
      await realpath(executable),
    );
    assert.notEqual(await realpath(executable), await realpath(wrapper));
    await assert.rejects(
      resolveNativeClaudeExecutable({
        expectedSha256: "0".repeat(64),
        executablePath: executable,
      }),
      /digest differs/,
    );
    await assert.rejects(
      resolveNativeClaudeExecutable({
        expectedSha256,
        executablePath: "relative/claude",
      }),
      /must be absolute/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("router authentication stages only bounded child environment fields and clears them", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-router-auth-"));
  try {
    const keyPath = path.join(root, "router.key");
    await writeFile(keyPath, "jmr_0123456789abcdef\n", { mode: 0o600 });
    const environment = { PATH: "/usr/bin" };
    const evidence = await stageClaudeRouterAuthentication({
      hostEnvironment: { [ROUTER_KEY_FILE_ENV]: keyPath },
      targetEnvironment: environment,
      model: "gpt-5.6-sol",
      routerBaseUrl: "https://llm.example.invalid",
      routeCatalogSha256,
      claudeCliVersion: "2.1.220 (Claude Code)",
      fetchImplementation: catalogFetch,
    });
    assert.equal(environment.ANTHROPIC_API_KEY, "jmr_0123456789abcdef");
    assert.equal(environment.ANTHROPIC_BASE_URL, "https://llm.example.invalid");
    assert.equal(environment.ANTHROPIC_MODEL, "gpt-5.6-sol");
    assert.equal(environment.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY, "0");
    assert.deepEqual(evidence, {
      mode: "router-key-environment",
      providerEndpoint: "https://llm.example.invalid",
      keyPersistedByRunner: false,
      keyPathPersistedByRunner: false,
      keyDigestPersistedByRunner: false,
      routeCatalog: {
        requestedModel: "gpt-5.6-sol",
        catalogRecordSha256: routeCatalogSha256,
        routeTarget: null,
        protocol: "responses",
        providerIdentityObservable: false,
      },
      stagedEnvironmentFields: [
        "ANTHROPIC_API_KEY",
        "ANTHROPIC_BASE_URL",
        "ANTHROPIC_TARGET_API_URL",
        "ANTHROPIC_MODEL",
        "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
      ],
    });
    assert.equal(clearClaudeRouterAuthentication(environment), true);
    assert.deepEqual(environment, { PATH: "/usr/bin" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("pre-spawn identity re-attests the route after authentication staging and binds executable bytes", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-router-pre-spawn-"));
  try {
    const keyPath = path.join(root, "router.key");
    const executable = path.join(root, "claude");
    const executableBytes = "#!/bin/sh\nprintf 'test claude\\n'\n";
    await writeFile(keyPath, "jmr_0123456789abcdef\n", { mode: 0o600 });
    await writeFile(executable, executableBytes, { mode: 0o700 });
    let catalogCalls = 0;
    const countedFetch = async (...arguments_) => {
      catalogCalls += 1;
      return await catalogFetch(...arguments_);
    };
    const environment = { PATH: root };
    await stageClaudeRouterAuthentication({
      hostEnvironment: { [ROUTER_KEY_FILE_ENV]: keyPath },
      targetEnvironment: environment,
      model: "gpt-5.6-sol",
      routerBaseUrl: "https://llm.example.invalid",
      routeCatalogSha256,
      claudeCliVersion: "2.1.220 (Claude Code)",
      fetchImplementation: countedFetch,
    });
    const identity = await verifyClaudePreSpawnIdentity({
      environment,
      routerBaseUrl: "https://llm.example.invalid",
      model: "gpt-5.6-sol",
      routeCatalogSha256,
      claudeCliVersion: "2.1.220 (Claude Code)",
      nativeExecutableSha256: createHash("sha256").update(executableBytes).digest("hex"),
      nativeExecutablePath: executable,
      fetchImplementation: countedFetch,
    });
    assert.equal(catalogCalls, 2);
    assert.equal(identity.executable, await realpath(executable));
    assert.equal(identity.routeCatalog.catalogRecordSha256, routeCatalogSha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("router authentication rejects missing, relative, linked, broad-mode, malformed, and unsafe endpoint inputs", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-router-auth-reject-"));
  try {
    const valid = path.join(root, "valid.key");
    const linked = path.join(root, "linked.key");
    const malformed = path.join(root, "malformed.key");
    await writeFile(valid, "jmr_0123456789abcdef", { mode: 0o600 });
    await symlink(valid, linked);
    await writeFile(malformed, "not-a-router-key\n", { mode: 0o600 });
    const attempt = (keyPath, routerBaseUrl = "https://llm.example.invalid") =>
      stageClaudeRouterAuthentication({
        hostEnvironment: keyPath === undefined ? {} : { [ROUTER_KEY_FILE_ENV]: keyPath },
        targetEnvironment: {},
        model: "gpt-5.6-sol",
        routerBaseUrl,
        routeCatalogSha256,
        claudeCliVersion: "2.1.220 (Claude Code)",
        fetchImplementation: catalogFetch,
      });
    await assert.rejects(attempt(undefined), /must name/);
    await assert.rejects(attempt("relative.key"), /must be absolute/);
    await assert.rejects(attempt(linked), /regular file|symbolic link/);
    await chmod(valid, 0o644);
    await assert.rejects(attempt(valid), /mode must be 0400 or 0600/);
    await assert.rejects(attempt(malformed), /format is invalid/);
    await assert.rejects(attempt(malformed, "http://llm.example.invalid"), /must use HTTPS/);
    await assert.rejects(attempt(malformed, "https://user@example.invalid"), /credentials/);
    await assert.rejects(
      attempt(malformed, "https://llm.example.invalid/v1"),
      /must not contain a path/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("router authentication rejects directories and oversized files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "carrylog-router-auth-bounds-"));
  try {
    const directory = path.join(root, "directory.key");
    const oversized = path.join(root, "oversized.key");
    await mkdir(directory);
    await writeFile(oversized, `jmr_${"a".repeat(4096)}`, { mode: 0o600 });
    const attempt = (keyPath) =>
      stageClaudeRouterAuthentication({
        hostEnvironment: { [ROUTER_KEY_FILE_ENV]: keyPath },
        targetEnvironment: {},
        model: "gpt-5.6-sol",
        routerBaseUrl: "https://llm.example.invalid",
        routeCatalogSha256,
        claudeCliVersion: "2.1.220 (Claude Code)",
        fetchImplementation: catalogFetch,
      });
    await assert.rejects(attempt(directory), /regular file|size/);
    await assert.rejects(attempt(oversized), /size is outside bounds/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("router catalog attestation rejects model-record drift, missing identity, and oversized responses", async () => {
  const attempt = (fetchImplementation, expectedSha256 = routeCatalogSha256) =>
    attestClaudeRouteCatalog({
      endpoint: "https://llm.example.invalid",
      key: "jmr_0123456789abcdef",
      model: "gpt-5.6-sol",
      expectedSha256,
      claudeCliVersion: "2.1.220 (Claude Code)",
      fetchImplementation,
    });
  assert.deepEqual(await attempt(catalogFetch), {
    requestedModel: "gpt-5.6-sol",
    catalogRecordSha256: routeCatalogSha256,
    routeTarget: null,
    protocol: "responses",
    providerIdentityObservable: false,
  });
  await assert.rejects(attempt(catalogFetch, "0".repeat(64)), /catalog identity differs/);
  await assert.rejects(
    attempt(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })),
    /not uniquely present/,
  );
  await assert.rejects(
    attempt(
      async () =>
        new Response("x", {
          status: 200,
          headers: { "content-length": String(1024 * 1024 + 1) },
        }),
    ),
    /too large/,
  );
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
