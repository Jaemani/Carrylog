import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { lstat, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

export const ROUTER_KEY_FILE_ENV = "CARRYLOG_PILOT_CLAUDE_ROUTER_KEY_FILE";

const secretEnvironmentNames = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_TARGET_API_URL",
  "ANTHROPIC_MODEL",
  "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY",
];
const execFileAsync = promisify(execFile);

export async function resolveNativeClaudeExecutable({ expectedSha256, environment }) {
  assert.match(expectedSha256, /^[0-9a-f]{64}$/);
  assert.ok(environment && typeof environment === "object");
  const located = (
    await execFileAsync("/usr/bin/which", ["claude"], {
      env: environment,
      encoding: "utf8",
      timeout: 30_000,
    })
  ).stdout.trim();
  assert.equal(path.isAbsolute(located), true, "Claude executable path must be absolute");
  const executable = await realpath(located);
  const metadata = await lstat(executable);
  assert.equal(metadata.isFile(), true, "Claude executable must be a regular file");
  assert.equal(
    createHash("sha256")
      .update(await readFile(executable))
      .digest("hex"),
    expectedSha256,
    "Claude executable digest differs",
  );
  return executable;
}

export async function stageClaudeRouterAuthentication({
  hostEnvironment,
  targetEnvironment,
  model,
  routerBaseUrl,
  routeCatalogSha256,
  claudeCliVersion,
  fetchImplementation = globalThis.fetch,
  requestTimeoutMs = 30_000,
}) {
  assert.ok(hostEnvironment && typeof hostEnvironment === "object");
  assert.ok(targetEnvironment && typeof targetEnvironment === "object");
  assert.match(model, /^(?:claude-route-[a-z0-9-]+|gpt-5\.6-(?:sol|terra|luna))$/);
  const endpoint = validateRouterBaseUrl(routerBaseUrl);
  const configuredPath = hostEnvironment[ROUTER_KEY_FILE_ENV];
  assert.equal(
    typeof configuredPath,
    "string",
    `${ROUTER_KEY_FILE_ENV} must name the router key file`,
  );
  assert.equal(path.isAbsolute(configuredPath), true, `${ROUTER_KEY_FILE_ENV} must be absolute`);

  const before = await lstat(configuredPath);
  assert.equal(before.isFile(), true, "router key must be a regular file");
  assert.equal(before.isSymbolicLink(), false, "router key must not be a symbolic link");
  assert.equal(before.size > 4 && before.size <= 4096, true, "router key size is outside bounds");
  assert.ok([0o400, 0o600].includes(before.mode & 0o777), "router key mode must be 0400 or 0600");

  const handle = await open(configuredPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  let raw;
  try {
    const opened = await handle.stat();
    assertSameIdentity(before, opened, "router key changed before read");
    raw = await handle.readFile({ encoding: "utf8" });
    const after = await handle.stat();
    assertSameIdentity(opened, after, "router key changed during read");
  } finally {
    await handle.close();
  }
  assert.equal(Buffer.byteLength(raw), before.size, "router key byte count changed");
  assert.match(raw, /^jmr_[A-Za-z0-9_-]{16,}\n?$/, "router key format is invalid");
  const key = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  const routeCatalog = await attestClaudeRouteCatalog({
    endpoint,
    key,
    model,
    expectedSha256: routeCatalogSha256,
    claudeCliVersion,
    fetchImplementation,
    requestTimeoutMs,
  });

  targetEnvironment.ANTHROPIC_API_KEY = key;
  targetEnvironment.ANTHROPIC_BASE_URL = endpoint;
  targetEnvironment.ANTHROPIC_TARGET_API_URL = endpoint;
  targetEnvironment.ANTHROPIC_MODEL = model;
  targetEnvironment.CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY = "0";
  return {
    mode: "router-key-environment",
    providerEndpoint: endpoint,
    keyPersistedByRunner: false,
    keyPathPersistedByRunner: false,
    keyDigestPersistedByRunner: false,
    routeCatalog,
    stagedEnvironmentFields: [...secretEnvironmentNames],
  };
}

export async function attestClaudeRouteCatalog({
  endpoint,
  key,
  model,
  expectedSha256,
  claudeCliVersion,
  fetchImplementation = globalThis.fetch,
  requestTimeoutMs = 30_000,
}) {
  const baseUrl = validateRouterBaseUrl(endpoint);
  assert.match(key, /^jmr_[A-Za-z0-9_-]{16,}$/);
  assert.match(model, /^(?:claude-route-[a-z0-9-]+|gpt-5\.6-(?:sol|terra|luna))$/);
  assert.match(expectedSha256, /^[0-9a-f]{64}$/);
  assert.match(claudeCliVersion, /^[0-9]+\.[0-9]+\.[0-9]+ \(Claude Code\)$/);
  assert.equal(typeof fetchImplementation, "function");
  assert.equal(Number.isInteger(requestTimeoutMs) && requestTimeoutMs > 0, true);
  const response = await fetchImplementation(`${baseUrl}/v1/models?limit=1000`, {
    method: "GET",
    redirect: "error",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
  assert.equal(response.ok, true, `router model catalog returned HTTP ${response.status}`);
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    assert.equal(Number(contentLength) <= 1024 * 1024, true, "router model catalog is too large");
  }
  const rendered = await response.text();
  assert.equal(
    Buffer.byteLength(rendered) <= 1024 * 1024,
    true,
    "router model catalog is too large",
  );
  const catalog = JSON.parse(rendered);
  assert.ok(Array.isArray(catalog.data), "router model catalog lacks data array");
  const matches = catalog.data.filter((candidate) => candidate?.id === model);
  assert.equal(matches.length, 1, "requested gateway model is not uniquely present in catalog");
  const record = matches[0];
  assert.equal(record.object, "model");
  if (model.startsWith("claude-route-")) {
    assert.equal(record.owned_by, "jm-router");
    assert.equal(typeof record.route_target, "string");
    assert.notEqual(record.route_target, "");
  } else {
    assert.equal(record.owned_by, "Codex ChatGPT");
    assert.equal(record.protocol, "responses");
  }
  const observedSha256 = createHash("sha256").update(canonicalJson(record)).digest("hex");
  assert.equal(observedSha256, expectedSha256, "router route catalog identity differs");
  return {
    requestedModel: model,
    catalogRecordSha256: observedSha256,
    routeTarget: record.route_target ?? null,
    protocol: record.protocol ?? null,
    providerIdentityObservable: false,
  };
}

export async function verifyClaudePreSpawnIdentity({
  environment,
  routerBaseUrl,
  model,
  routeCatalogSha256,
  claudeCliVersion,
  nativeExecutableSha256,
  fetchImplementation = globalThis.fetch,
}) {
  assert.ok(environment && typeof environment === "object");
  const routeCatalog = await attestClaudeRouteCatalog({
    endpoint: routerBaseUrl,
    key: environment.ANTHROPIC_API_KEY,
    model,
    expectedSha256: routeCatalogSha256,
    claudeCliVersion,
    fetchImplementation,
  });
  const executable = await resolveNativeClaudeExecutable({
    expectedSha256: nativeExecutableSha256,
    environment,
  });
  return { executable, routeCatalog };
}

export function clearClaudeRouterAuthentication(environment) {
  assert.ok(environment && typeof environment === "object");
  let removed = true;
  for (const name of secretEnvironmentNames) {
    if (Object.hasOwn(environment, name)) environment[name] = "";
    delete environment[name];
    removed &&= !Object.hasOwn(environment, name);
  }
  return removed;
}

function validateRouterBaseUrl(value) {
  assert.equal(typeof value, "string", "routerBaseUrl must be a string");
  const endpoint = new URL(value);
  assert.equal(endpoint.protocol, "https:", "routerBaseUrl must use HTTPS");
  assert.equal(endpoint.username, "", "routerBaseUrl must not contain credentials");
  assert.equal(endpoint.password, "", "routerBaseUrl must not contain credentials");
  assert.equal(endpoint.search, "", "routerBaseUrl must not contain a query");
  assert.equal(endpoint.hash, "", "routerBaseUrl must not contain a fragment");
  assert.equal(endpoint.pathname, "/", "routerBaseUrl must not contain a path");
  return endpoint.origin;
}

function assertSameIdentity(left, right, message) {
  assert.equal(right.isFile(), true, `${message}: not a regular file`);
  assert.deepEqual(
    [right.dev, right.ino, right.mode, right.size, right.mtimeMs, right.ctimeMs],
    [left.dev, left.ino, left.mode, left.size, left.mtimeMs, left.ctimeMs],
    message,
  );
}

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
