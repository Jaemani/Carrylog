import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const analysisRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Codex canary stages only auth.json and probes credential-adjacent model denial", async () => {
  const source = await readFile(path.join(analysisRoot, "harness-isolation-canary.mjs"), "utf8");
  assert.equal(source.match(/\bcopyFile\(/g)?.length, 1, "canary copied an unexpected host file");
  assert.match(
    source,
    /path\.join\(process\.env\.CODEX_HOME \?\? path\.join\(homedir\(\), "\.codex"\), "auth\.json"\),\s*path\.join\(syntheticHome, "auth\.json"\)/,
  );
  assert.match(source, /credential-adjacent-canary\.json/);
  assert.match(source, /CODEX_HOME_SENTINEL_DENIED/);
  assert.match(source, /CODEX_HOME_SENTINEL_READABLE/);
  assert.match(source, /result\.stdout\.includes\(credentialAdjacentSentinelValue\)/);
  assert.match(source, /parseCodexJsonEvents\(result\.stdout\)/);
  assert.match(source, /assertCodexProbeEvidence\(diagnostic/);
  assert.match(source, /stderr=\$\{redactCanaryDiagnostic\(result\.stderr\)\.slice\(0, 2000\)\}/);
  assert.match(source, /expectedCommand: expectedProbeCommands/);
  assert.match(source, /return redactHarnessDiagnostic\(/);
  assert.match(source, /createHash\("sha256"\)\s*\.update\(await readFile\(probePath\)\)/);
  assert.match(source, /Do not run any other shell command/);

  const rootDeny = source.indexOf('":root" = "deny"');
  const workspaceRead = source.indexOf('[permissions.canary.filesystem.":workspace_roots"]');
  assert.ok(
    rootDeny >= 0 && workspaceRead > rootDeny,
    "Codex canary permission profile lost root-deny ordering",
  );

  for (const unchangedBoundary of [
    "OUTSIDE_DENIED",
    "BROAD_PREFIX_DENIED",
    "NETWORK_PROBE_SPAWN_DENIED",
    "GIT_METADATA_DENIED",
    "SOURCE_CONTEXT_DENIED",
    "MODEL_GIT_ENV_ABSENT",
  ]) {
    assert.match(source, new RegExp(unchangedBoundary));
  }
});

test("Claude canary bounds two permission profiles and binds exact tool evidence", async () => {
  const source = await readFile(path.join(analysisRoot, "harness-isolation-canary.mjs"), "utf8");
  assert.match(source, /const totalBudgetCents = 75/);
  assert.match(source, /id: "read-only",\s*writable: false,\s*budgetCents: 55/);
  assert.match(source, /id: "writable",\s*writable: true,\s*budgetCents: 20/);
  assert.match(source, /sum \+ session\.budgetCents/);
  assert.match(source, /maximumBudgetUsd: session\.budgetCents \/ 100/);
  assert.doesNotMatch(source, /maximumBudgetUsd: 0\.05/);
  assert.equal(source.match(/buildClaudeInvocation\(/g)?.length, 1);
  assert.match(source, /for \(const session of probeSessions\)/);
  assert.match(source, /Claude canary must cover both permission profiles/);
  assert.match(source, /diagnostic\.toolUses\.map\(\(\{ name, input \}\)/);
  assert.match(source, /session\.probes\.map\(\(\{ tool, input \}\)/);
  assert.equal(source.match(/id: "repository-discovery"/g)?.length, 2);
  assert.equal(source.match(/mcp__carrylog_verification__verify_repository_discovery/g)?.length, 2);
  assert.equal(source.match(/id: "git-head"/g)?.length, 2);
  assert.equal(source.match(/id: "git-status"/g)?.length, 2);
  assert.match(source, /assertClaudeSuccessfulToolUse\(\s*diagnostic/);
  assert.equal(source.match(/assertClaudeDeniedToolUse\(diagnostic/g)?.length, 1);
  assert.match(source, /probe\.expected === "denied"/);
  assert.match(source, /name: probe\.tool, input: probe\.input/);
  assert.equal(source.match(/expected: "denied"/g)?.length, 3);
  assert.doesNotMatch(source, /permissionDenials\.length\s*>=/);
});

test("both authenticated canaries traverse the repository-discovery policy", async () => {
  const source = await readFile(path.join(analysisRoot, "harness-isolation-canary.mjs"), "utf8");
  assert.match(source, /buildRepositoryDiscoveryCanaryScript/);
  assert.match(source, /REPOSITORY_DISCOVERY_OK NESTED_GIT_OK METADATA_IMMUTABLE/);
  assert.match(source, /gitfile replacement/);
  assert.match(source, /metadata write/);
  assert.equal(
    source.match(/\["repository-discovery", "seatbelt-(?:broker|workspace)-isolated", 0\]/g)
      ?.length,
    2,
  );
  assert.equal(source.match(/includes\("REPOSITORY_DISCOVERY_OK"\)/g)?.length, 2);
  assert.equal(source.match(/includes\("METADATA_IMMUTABLE"\)/g)?.length, 2);
});
