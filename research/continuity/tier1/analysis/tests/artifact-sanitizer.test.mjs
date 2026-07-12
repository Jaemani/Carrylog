import assert from "node:assert/strict";
import test from "node:test";
import { rejectUnsafeArtifact, sanitize, sanitizeValue } from "../artifact-sanitizer.mjs";

test("sanitizer preserves safe bounded artifacts and redacts supported scalar secrets", () => {
  const root = "/private/tmp/carrylog-run";
  const sanitized = sanitizeValue(
    {
      message: `${root}/workspace Bearer abcdefghijklmnop ghp_abcdefghijklmnop`,
      nested: ["authorization was denied", "cookie policy"],
      sessionId: "provider-state",
    },
    root,
  );
  assert.equal(Object.hasOwn(sanitized, "sessionId"), false);
  assert.match(sanitized.message, /<RUN_ROOT>/);
  assert.match(sanitized.message, /Bearer <REDACTED_TOKEN>/);
  assert.match(sanitized.message, /<REDACTED_TOKEN>/);
  assert.doesNotThrow(() => rejectUnsafeArtifact(sanitized));
  assert.equal(sanitize("ordinary output", ""), "ordinary output");
});

test("artifact gate rejects JWTs and credential-bearing object keys", () => {
  const jwt = `${`eyJ${"a".repeat(16)}`}.${`eyJ${"b".repeat(16)}`}.${"c".repeat(16)}`;
  assert.throws(() => rejectUnsafeArtifact({ finalResponse: jwt }), /sanitization failed closed/);
  for (const key of [
    "accessToken",
    "refreshToken",
    "apiKey",
    "cookie",
    "authorization",
    "mcpOAuth",
    "claudeAiOauth",
  ]) {
    assert.throws(
      () => rejectUnsafeArtifact({ [key]: "synthetic-opaque-value" }),
      /sanitization failed closed/,
      key,
    );
  }
});

test("credential key detection is case-insensitive but does not reject prose", () => {
  assert.throws(
    () => rejectUnsafeArtifact({ ACCESSTOKEN: "synthetic-opaque-value" }),
    /sanitization failed closed/,
  );
  assert.doesNotThrow(() =>
    rejectUnsafeArtifact({ finalResponse: "authorization and cookie access were denied" }),
  );
});
