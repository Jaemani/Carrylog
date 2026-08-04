import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const PROGRAM_FILES = Object.freeze({
  hostGitPolicy: "host-git-policy.mjs",
  processSupervisor: "process-supervisor.mjs",
  verificationReceiptProtocol: "verification-receipt-protocol.mjs",
});

export async function loadVerificationSupport({ analysisRoot, tierRoot }) {
  assert.equal(path.isAbsolute(analysisRoot), true);
  assert.equal(path.isAbsolute(tierRoot), true);
  const hostGitPolicySource = await readFile(path.join(analysisRoot, PROGRAM_FILES.hostGitPolicy));
  const processSupervisorSource = await readFile(
    path.join(analysisRoot, PROGRAM_FILES.processSupervisor),
  );
  const verificationReceiptProtocolSource = await readFile(
    path.join(analysisRoot, PROGRAM_FILES.verificationReceiptProtocol),
  );
  const hostGitPolicy = JSON.parse(
    await readFile(path.join(tierRoot, "host-git-policy.json"), "utf8"),
  );
  return {
    files: { ...PROGRAM_FILES },
    sources: {
      hostGitPolicySource,
      processSupervisorSource,
      verificationReceiptProtocolSource,
    },
    programDigests: {
      hostGitPolicySha256: sha256(hostGitPolicySource),
      processSupervisorSha256: sha256(processSupervisorSource),
      verificationReceiptProtocolSha256: sha256(verificationReceiptProtocolSource),
    },
    hostGitPolicy,
  };
}

export async function writeVerificationSupportFiles(directory, support) {
  assert.equal(path.isAbsolute(directory), true);
  for (const [id, fileName] of Object.entries(support.files)) {
    const sourceName = `${id}Source`;
    const digestName = `${id}Sha256`;
    const source = support.sources[sourceName];
    assert.ok(Buffer.isBuffer(source), `${sourceName} must be a Buffer`);
    assert.equal(sha256(source), support.programDigests[digestName]);
    const destination = path.join(directory, fileName);
    await writeFile(destination, source, { mode: 0o400, flag: "wx" });
    assert.equal(sha256(await readFile(destination)), support.programDigests[digestName]);
  }
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
