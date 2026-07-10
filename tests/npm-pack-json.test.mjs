import assert from "node:assert/strict";
import test from "node:test";
import { parseSingleNpmPackArtifact } from "../scripts/lib/npm-pack-json.mjs";

const expected = {
  name: "carrylog",
  version: "1.2.3-beta.4",
};

function artifact(overrides = {}) {
  return {
    id: `${expected.name}@${expected.version}`,
    name: expected.name,
    version: expected.version,
    filename: "carrylog-1.2.3-beta.4.tgz",
    files: [{ path: "package.json" }, { path: "dist/cli.js" }],
    entryCount: 2,
    size: 100,
    unpackedSize: 200,
    integrity: `sha512-${Buffer.alloc(64).toString("base64")}`,
    shasum: "0123456789abcdef0123456789abcdef01234567",
    ...overrides,
  };
}

test("normalizes legacy npm array output and npm 12 keyed output", () => {
  const candidate = artifact();
  assert.deepEqual(parseSingleNpmPackArtifact(JSON.stringify([candidate]), expected), candidate);
  assert.deepEqual(
    parseSingleNpmPackArtifact(JSON.stringify({ [expected.name]: candidate }), expected),
    candidate,
  );
});

test("rejects invalid JSON and unsupported top-level values", () => {
  assert.throws(() => parseSingleNpmPackArtifact("not-json", expected), /not valid JSON/);
  for (const value of [null, true, "artifact", 1]) {
    assert.throws(
      () => parseSingleNpmPackArtifact(JSON.stringify(value), expected),
      /top-level value must be an array or keyed object/,
    );
  }
});

test("rejects empty and ambiguous npm pack results", () => {
  for (const value of [[], [artifact(), artifact()], {}, { one: artifact(), two: artifact() }]) {
    assert.throws(
      () => parseSingleNpmPackArtifact(JSON.stringify(value), expected),
      /expected one artifact/,
    );
  }
});

test("rejects non-object artifacts in either supported envelope", () => {
  for (const value of [[null], ["artifact"], { [expected.name]: [] }, { [expected.name]: 1 }]) {
    assert.throws(
      () => parseSingleNpmPackArtifact(JSON.stringify(value), expected),
      /artifact must be an object/,
    );
  }
});

test("rejects a keyed npm result for a different package", () => {
  assert.throws(
    () =>
      parseSingleNpmPackArtifact(
        JSON.stringify({ "@other/package": artifact({ name: "@other/package" }) }),
        expected,
      ),
    /does not match package/,
  );
});

test("rejects artifact identity and filename mismatches", () => {
  for (const [candidate, message] of [
    [artifact({ name: "@other/package" }), /artifact name/],
    [artifact({ version: "0.1.0-beta.0" }), /artifact version/],
    [artifact({ id: `${expected.name}@0.1.0-beta.0` }), /artifact id/],
    [artifact({ filename: "../outside.tgz" }), /filename/],
    [artifact({ filename: "nested\\outside.tgz" }), /filename/],
  ]) {
    assert.throws(() => parseSingleNpmPackArtifact(JSON.stringify([candidate]), expected), message);
  }
});

test("rejects malformed file inventories and numeric metadata", () => {
  for (const candidate of [
    artifact({ files: undefined }),
    artifact({ files: [], entryCount: 0 }),
    artifact({ files: [null], entryCount: 1 }),
    artifact({ files: [{ path: "" }], entryCount: 1 }),
    artifact({ files: [{ path: "same" }, { path: "same" }] }),
    artifact({ entryCount: 1 }),
    artifact({ size: -1 }),
    artifact({ unpackedSize: Number.MAX_SAFE_INTEGER + 1 }),
    artifact({ integrity: "sha256-not-sha512" }),
    artifact({ integrity: "sha512-YWdlbnQtY29udGV4dC1raXQ=" }),
    artifact({ integrity: undefined }),
    artifact({ shasum: "not-a-sha1" }),
    artifact({ shasum: undefined }),
  ]) {
    assert.throws(() => parseSingleNpmPackArtifact(JSON.stringify([candidate]), expected));
  }
});
