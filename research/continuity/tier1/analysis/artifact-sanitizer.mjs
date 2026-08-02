import assert from "node:assert/strict";

export function sanitizeValue(value, temporaryRoot) {
  if (typeof value === "string") return sanitize(value, temporaryRoot);
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, temporaryRoot));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !/session[_-]?id|thread[_-]?id|thinking/i.test(key))
        .map(([key, item]) => [key, sanitizeValue(item, temporaryRoot)]),
    );
  }
  return value;
}

export function sanitize(value, temporaryRoot) {
  let rendered = String(value);
  if (temporaryRoot !== "") rendered = rendered.replaceAll(temporaryRoot, "<RUN_ROOT>");
  return rendered
    .replace(/\/Users\/[^\s'"`]+/g, "<ABSOLUTE_PATH>")
    .replace(/\/home\/[^\s'"`]+/g, "<ABSOLUTE_PATH>")
    .replace(/[A-Za-z]:\\Users\\[^\s'"`]+/g, "<ABSOLUTE_PATH>")
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, "$1<REDACTED>@")
    .replace(/\b(?:ghp_|github_pat_|npm_|jmr_|sk-)[A-Za-z0-9_-]{16,}\b/g, "<REDACTED_TOKEN>")
    .replace(
      /\b(?:ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|DATABASE_URL|GITHUB_TOKEN|NPM_TOKEN|OPENAI_API_KEY|SEOUL_API_KEY)\s*=\s*[^\s]+/g,
      "<REDACTED_ENV>",
    )
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*\b/gi, "Bearer <REDACTED_TOKEN>");
}

export function rejectUnsafeArtifact(value) {
  const rendered = JSON.stringify(value);
  const unsafe = [
    /\/Users\//,
    /\/home\//,
    /[A-Za-z]:\\Users\\/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\b(?:ghp_|github_pat_|npm_|jmr_|sk-)[A-Za-z0-9_-]{16,}\b/,
    /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/,
    /\b(?:ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|DATABASE_URL|GITHUB_TOKEN|NPM_TOKEN|OPENAI_API_KEY|SEOUL_API_KEY)\s*=\s*(?!<REDACTED_ENV>)/,
    /\bBearer\s+(?!<REDACTED_TOKEN>)[A-Za-z0-9._~+/-]{16,}=*\b/i,
    /"(?:accessToken|refreshToken|apiKey|cookie|authorization|mcpOAuth|claudeAiOauth)"\s*:/i,
  ];
  for (const pattern of unsafe)
    assert.equal(pattern.test(rendered), false, "sanitization failed closed");
}
