import assert from "node:assert/strict";
import test from "node:test";
import {
  hasManagedBlock,
  MANAGED_END,
  MANAGED_START,
  upsertManagedBlock,
  wrapManagedBlock,
} from "../dist/index.js";

test("creates a deterministic managed file", () => {
  const result = upsertManagedBlock(undefined, "# Generated\n\nBody", { adopt: false });
  assert.equal(result, `${MANAGED_START}\n# Generated\n\nBody\n${MANAGED_END}\n`);
  assert.equal(hasManagedBlock(result), true);
});

test("updates only the managed region", () => {
  const existing = `Human preface\n\n${wrapManagedBlock("old")}\n\nHuman suffix\n`;
  const result = upsertManagedBlock(existing, "new", { adopt: false });
  assert.equal(result, `Human preface\n\n${wrapManagedBlock("new")}\n\nHuman suffix\n`);
});

test("is idempotent", () => {
  const once = upsertManagedBlock(undefined, "same", { adopt: false });
  const twice = upsertManagedBlock(once, "same", { adopt: false });
  assert.equal(twice, once);
});

test("adopts an existing file without replacing human content", () => {
  const result = upsertManagedBlock("# Human rules\n", "generated", { adopt: true });
  assert.equal(result, `# Human rules\n\n${wrapManagedBlock("generated")}\n`);
});

test("refuses an unmanaged existing file by default", () => {
  assert.throws(
    () => upsertManagedBlock("# Human rules\n", "generated", { adopt: false }),
    (error) => error.code === "E_UNMANAGED_ADAPTER",
  );
});

test("preserves CRLF in an adopted or updated file", () => {
  const adopted = upsertManagedBlock("# Human\r\n", "one\ntwo", { adopt: true });
  assert.equal(adopted.includes(`${MANAGED_START}\r\none\r\ntwo\r\n${MANAGED_END}`), true);
  const updated = upsertManagedBlock(adopted, "three\nfour", { adopt: false });
  assert.equal(updated.includes(`${MANAGED_START}\r\nthree\r\nfour\r\n${MANAGED_END}`), true);
});

for (const [name, content] of [
  ["missing end marker", `${MANAGED_START}\nbody\n`],
  ["duplicate blocks", `${wrapManagedBlock("a")}\n${wrapManagedBlock("b")}`],
  ["end before start", `${MANAGED_END}\n${MANAGED_START}`],
]) {
  test(`rejects ${name}`, () => {
    assert.throws(
      () => upsertManagedBlock(content, "generated", { adopt: false }),
      (error) => error.code === "E_MANAGED_MARKERS",
    );
  });
}
