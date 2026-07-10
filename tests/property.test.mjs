import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { AckitError } from "../dist/core/errors.js";
import { assertPortableRelativePath, resolveProjectPath } from "../dist/core/paths.js";
import { parseGitStatus } from "../dist/git/inspect.js";
import { upsertHandoffSnapshot } from "../dist/handoff/snapshot-block.js";
import { decodeConfig } from "../dist/index.js";

function generator(seed = 0xa11ce) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state;
  };
}

const random = generator();

function randomString(maxLength = 48) {
  const alphabet = [..."abcXYZ019 ./\\:-_?*\r\n\0", "é", "e\u0301", "한", "🚀", "\ud800"];
  const length = random() % (maxLength + 1);
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += alphabet[random() % alphabet.length];
  }
  return value;
}

function randomValue(depth = 0) {
  if (depth >= 3) {
    return [null, randomString(), random() % 100_000, random() % 2 === 0][random() % 4];
  }
  switch (random() % 7) {
    case 0:
      return null;
    case 1:
      return randomString();
    case 2:
      return random() % 200_000;
    case 3:
      return random() % 2 === 0;
    case 4:
      return Array.from({ length: random() % 6 }, () => randomValue(depth + 1));
    default: {
      const value = {};
      for (let index = 0; index < random() % 6; index += 1) {
        value[randomString(12)] = randomValue(depth + 1);
      }
      return value;
    }
  }
}

test("configuration decoder is total over a deterministic malformed corpus", () => {
  for (let index = 0; index < 5_000; index += 1) {
    const result = decodeConfig(randomValue());
    assert.equal(Array.isArray(result.diagnostics), true);
    if (result.config !== undefined) assert.equal(result.diagnostics.length, 0);
  }
});

test("portable path validation never escapes the root over a randomized corpus", () => {
  const root = path.resolve("/carrylog-property-root");
  for (let index = 0; index < 5_000; index += 1) {
    const candidate = randomString(1100);
    try {
      assertPortableRelativePath(candidate);
      const resolved = resolveProjectPath(root, candidate);
      assert.equal(path.relative(root, resolved).startsWith(".."), false);
    } catch (error) {
      assert.equal(error instanceof AckitError, true, String(error));
    }
  }
});

test("Git porcelain parser is bounded and total over arbitrary byte records", () => {
  for (let index = 0; index < 5_000; index += 1) {
    const bytes = Buffer.alloc(random() % 128);
    for (let offset = 0; offset < bytes.length; offset += 1) bytes[offset] = random() & 0xff;
    try {
      const result = parseGitStatus(bytes);
      assert.equal(result.changes.length <= 200, true);
      assert.equal(result.omittedChanges >= 0, true);
    } catch (error) {
      assert.equal(error instanceof AckitError, true, String(error));
    }
  }
});

test("handoff managed snapshot updates are idempotent over randomized narratives", () => {
  for (let index = 0; index < 2_000; index += 1) {
    const narrative = `# Handoff\n\n${randomString(120).replaceAll("\0", "")}\n`;
    try {
      const once = upsertHandoffSnapshot(narrative, "## Repository evidence\n\nClean.");
      const twice = upsertHandoffSnapshot(once, "## Repository evidence\n\nClean.");
      assert.equal(twice, once);
    } catch (error) {
      assert.equal(error instanceof AckitError, true, String(error));
    }
  }
});
