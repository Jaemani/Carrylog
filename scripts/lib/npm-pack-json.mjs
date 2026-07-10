function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(message) {
  throw new Error(`Invalid npm pack JSON: ${message}`);
}

export function parseSingleNpmPackArtifact(output, expected) {
  if (typeof output !== "string") {
    throw new TypeError("npm pack output must be a string");
  }
  if (!isRecord(expected) || typeof expected.name !== "string" || expected.name.length === 0) {
    throw new TypeError("expected package name must be a non-empty string");
  }
  if (typeof expected.version !== "string" || expected.version.length === 0) {
    throw new TypeError("expected package version must be a non-empty string");
  }

  let payload;
  try {
    payload = JSON.parse(output);
  } catch (error) {
    throw new Error("Invalid npm pack JSON: output is not valid JSON", { cause: error });
  }

  let artifact;
  if (Array.isArray(payload)) {
    if (payload.length !== 1) {
      fail(`expected one artifact in array output, received ${payload.length}`);
    }
    [artifact] = payload;
  } else if (isRecord(payload)) {
    const entries = Object.entries(payload);
    if (entries.length !== 1) {
      fail(`expected one artifact in keyed output, received ${entries.length}`);
    }
    const [packageName, candidate] = entries[0];
    if (packageName !== expected.name) {
      fail(
        `key ${JSON.stringify(packageName)} does not match package ${JSON.stringify(expected.name)}`,
      );
    }
    artifact = candidate;
  } else {
    fail("top-level value must be an array or keyed object");
  }

  if (!isRecord(artifact)) {
    fail("artifact must be an object");
  }
  if (artifact.name !== expected.name) {
    fail(`artifact name does not match ${JSON.stringify(expected.name)}`);
  }
  if (artifact.version !== expected.version) {
    fail(`artifact version does not match ${JSON.stringify(expected.version)}`);
  }
  if (artifact.id !== `${expected.name}@${expected.version}`) {
    fail("artifact id does not match the expected package identity");
  }
  if (
    typeof artifact.filename !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*\.tgz$/.test(artifact.filename)
  ) {
    fail("artifact filename must be a safe tgz basename");
  }
  if (!Array.isArray(artifact.files) || artifact.files.length === 0) {
    fail("artifact files must be a non-empty array");
  }
  const paths = new Set();
  for (const [index, file] of artifact.files.entries()) {
    if (!isRecord(file) || typeof file.path !== "string" || file.path.length === 0) {
      fail(`artifact file ${index} must contain a non-empty path`);
    }
    if (paths.has(file.path)) {
      fail(`artifact file path ${JSON.stringify(file.path)} is duplicated`);
    }
    paths.add(file.path);
  }
  if (!Number.isSafeInteger(artifact.entryCount) || artifact.entryCount !== artifact.files.length) {
    fail("artifact entryCount must equal the files length");
  }
  for (const field of ["size", "unpackedSize"]) {
    if (!Number.isSafeInteger(artifact[field]) || artifact[field] < 0) {
      fail(`artifact ${field} must be a non-negative safe integer`);
    }
  }
  const integrityMatch =
    typeof artifact.integrity === "string"
      ? /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(artifact.integrity)
      : null;
  if (
    integrityMatch === null ||
    Buffer.from(integrityMatch[1], "base64").length !== 64 ||
    Buffer.from(integrityMatch[1], "base64").toString("base64") !== integrityMatch[1]
  ) {
    fail("artifact integrity must be a SHA-512 Subresource Integrity value");
  }
  if (typeof artifact.shasum !== "string" || !/^[0-9a-f]{40}$/.test(artifact.shasum)) {
    fail("artifact shasum must be a lowercase SHA-1 digest");
  }

  return artifact;
}
