import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActiveResearchInvocations,
  MACOS_NETWORK_TEST,
  PORTABLE_PILOT_TESTS,
  validatePortablePilotOutput,
} from "../scripts/run-active-research.mjs";

test("active research runner skips only the macOS Seatbelt execution on other platforms", () => {
  const pilotFile = "research/frozen/pilot-boundaries.test.mjs";
  const files = ["z.test.mjs", pilotFile, "a.test.mjs"];
  const macos = buildActiveResearchInvocations("darwin", files);
  assert.deepEqual(macos, [["--test", "--test-concurrency=1", ...files]]);

  for (const platform of ["linux", "win32"]) {
    const [portableSuite, frozenPilotSuite] = buildActiveResearchInvocations(platform, files);
    assert.deepEqual(portableSuite, ["--test", "--test-concurrency=1", "z.test.mjs", "a.test.mjs"]);
    assert.ok(frozenPilotSuite);
    assert.equal(frozenPilotSuite.at(-1), pilotFile);
    assert.equal(frozenPilotSuite.includes("--test-reporter=tap"), true);
    const pattern = frozenPilotSuite.find((argument) =>
      argument.startsWith("--test-name-pattern="),
    );
    assert.ok(pattern);
    const expression = new RegExp(pattern.slice(pattern.indexOf("=") + 1));
    for (const testName of PORTABLE_PILOT_TESTS) assert.equal(expression.test(testName), true);
    assert.equal(expression.test(MACOS_NETWORK_TEST), false);
  }

  assert.throws(
    () => buildActiveResearchInvocations("linux", ["other.test.mjs"]),
    /expected one frozen pilot-boundaries test file/,
  );
});

test("portable pilot TAP validation rejects silent allowlist loss", () => {
  const summary = (tests, pass, fail = 0, skipped = 0) =>
    [`# tests ${tests}`, `# pass ${pass}`, `# fail ${fail}`, `# skipped ${skipped}`].join("\n");
  assert.doesNotThrow(() => validatePortablePilotOutput(summary(8, 8)));
  assert.throws(() => validatePortablePilotOutput(summary(7, 7)), /exactly eight tests/);
  assert.throws(() => validatePortablePilotOutput(summary(8, 7, 1)), /exactly eight tests/);
  assert.throws(() => validatePortablePilotOutput("# tests 8\n# pass 8"), /missing TAP metric/);
});
