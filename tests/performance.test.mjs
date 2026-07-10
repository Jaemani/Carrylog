import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";
import { parseGitStatus } from "../dist/git/inspect.js";
import { decodeConfig, renderAdapter } from "../dist/index.js";
import { hasLegacyCliInvocation } from "../dist/migrations/context-v1.js";
import { createDefaultConfig } from "../dist/templates/defaults.js";

test("maximum v1 catalog decodes and renders within the deterministic budget", () => {
  const config = createDefaultConfig("Performance fixture", ["codex"]);
  config.documents = Array.from({ length: 256 }, (_, index) => ({
    id: `document-${index}`,
    path: `documents/${String(index).padStart(3, "0")}.md`,
    load: index < 4 ? "always" : "on-demand",
    description: `Bounded catalog entry ${index}`,
    ...(index < 4 ? {} : { triggers: [`task-${index}`] }),
  }));
  config.policies.maxAdapterCharacters = 100_000;

  const started = performance.now();
  for (let iteration = 0; iteration < 100; iteration += 1) {
    const decoded = decodeConfig(config);
    assert.notEqual(decoded.config, undefined);
    assert.equal(renderAdapter(decoded.config, decoded.config.adapters[0]).length > 0, true);
  }
  const elapsed = performance.now() - started;
  assert.equal(elapsed < 2_000, true, `maximum catalog loop took ${elapsed.toFixed(1)} ms`);
});

test("near-limit Git status evidence remains bounded in time and retained entries", () => {
  const records = [];
  for (let index = 0; index < 20_000; index += 1) {
    records.push(`?? generated/${String(index).padStart(5, "0")}-${"x".repeat(20)}.txt\0`);
  }
  const input = Buffer.from(records.join(""), "utf8");
  assert.equal(input.length < 1024 * 1024, true);

  const started = performance.now();
  const parsed = parseGitStatus(input);
  const elapsed = performance.now() - started;
  assert.equal(parsed.changes.length, 200);
  assert.equal(parsed.omittedChanges, 19_800);
  assert.equal(parsed.untracked, 20_000);
  assert.equal(elapsed < 2_000, true, `Git status parsing took ${elapsed.toFixed(1)} ms`);
});

test("near-limit legacy-command detection remains linear over repeated historical prose", () => {
  const history = "The old command was ackit. ".repeat(35_000);
  assert.equal(Buffer.byteLength(history, "utf8") < 1024 * 1024, true);

  const started = performance.now();
  assert.equal(hasLegacyCliInvocation(history), false);
  assert.equal(hasLegacyCliInvocation(`${history}\nackit validate\n`), true);
  const elapsed = performance.now() - started;
  assert.equal(elapsed < 2_000, true, `legacy command scanning took ${elapsed.toFixed(1)} ms`);
});
