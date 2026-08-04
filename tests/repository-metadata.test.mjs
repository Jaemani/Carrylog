import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseDocument } from "yaml";

const issueTemplateRoot = new URL("../.github/ISSUE_TEMPLATE/", import.meta.url);
const allowedBodyTypes = new Set(["checkboxes", "dropdown", "input", "markdown", "textarea"]);
const allowedFormKeys = new Set(["assignees", "body", "description", "labels", "name", "title"]);
const idPattern = /^[a-z][a-z0-9_]*$/;
const optionalFields = new Set(["bug-report.yml:validation"]);
const expectedFields = {
  "bug-report.yml": [
    "version",
    "environment",
    "installation",
    "command",
    "expected",
    "actual",
    "reproduction",
    "validation",
    "privacy",
  ],
  "adoption-report.yml": [
    "version",
    "repository_profile",
    "installation",
    "harnesses",
    "workflow",
    "task_outcome",
    "evidence_basis",
    "explanation_quantity",
    "baseline",
    "outcome",
    "repeated_work",
    "friction",
    "evidence_quality",
  ],
};

async function loadYaml(name) {
  const source = await readFile(new URL(name, issueTemplateRoot), "utf8");
  const document = parseDocument(source, { uniqueKeys: true });
  assert.deepEqual(document.errors, [], `${name} must be valid YAML without duplicate keys`);
  return document.toJS();
}

for (const name of ["bug-report.yml", "adoption-report.yml"]) {
  test(`${name} is a bounded GitHub issue form with unique machine fields`, async () => {
    const form = await loadYaml(name);
    assert.ok(Object.keys(form).every((key) => allowedFormKeys.has(key)));
    assert.equal(typeof form.name, "string");
    assert.equal(typeof form.description, "string");
    assert.match(form.title, /^\[[A-Za-z]+\]: $/);
    assert.ok(Array.isArray(form.body));
    assert.ok(form.body.length >= 2 && form.body.length <= 20);

    const ids = new Set();
    for (const item of form.body) {
      assert.ok(allowedBodyTypes.has(item.type), `unsupported issue-form type: ${item.type}`);
      if (item.type === "markdown") {
        assert.equal(typeof item.attributes?.value, "string");
        continue;
      }
      assert.match(item.id, idPattern);
      assert.equal(ids.has(item.id), false, `duplicate issue-form id: ${item.id}`);
      ids.add(item.id);
      assert.equal(typeof item.attributes?.label, "string");
      if (item.type === "dropdown") {
        assert.ok(Array.isArray(item.attributes.options));
        assert.ok(item.attributes.options.length > 0);
        assert.ok(item.attributes.options.every((option) => typeof option === "string"));
      }
      if (item.type === "checkboxes") {
        assert.ok(Array.isArray(item.attributes.options));
        assert.ok(item.attributes.options.length > 0);
        assert.ok(
          item.attributes.options.every(
            (option) =>
              typeof option?.label === "string" &&
              (option.required === undefined || typeof option.required === "boolean"),
          ),
        );
      }
      if (!optionalFields.has(`${name}:${item.id}`) && item.type !== "checkboxes") {
        assert.equal(item.validations?.required, true, `${name}:${item.id} must be required`);
      }
      if (item.type === "checkboxes") {
        assert.ok(
          item.validations?.required === true ||
            item.attributes.options.some((option) => option.required === true),
          `${name}:${item.id} must require a selection or explicit acknowledgement`,
        );
      }
    }
    assert.ok(ids.has("version"));
    assert.equal(ids.size, expectedFields[name].length);
    assert.ok(expectedFields[name].every((id) => ids.has(id)));

    const publicWarning = form.body
      .filter((item) => item.type === "markdown")
      .map((item) => item.attributes.value)
      .join("\n");
    assert.match(publicWarning, /public GitHub issue/i);

    const privacyField = form.body.find((item) =>
      ["privacy", "evidence_quality"].includes(item.id),
    );
    assert.ok(privacyField, `${name} must include a privacy acknowledgement`);
    assert.ok(
      privacyField.attributes.options.some(
        (option) => option.required === true && /public GitHub issue/i.test(option.label),
      ),
      `${name} must require acknowledgement that submission is public`,
    );
  });
}

test("adoption report keeps structured outcome and evidence options", async () => {
  const form = await loadYaml("adoption-report.yml");
  const fields = new Map(form.body.filter((item) => item.id).map((item) => [item.id, item]));
  assert.deepEqual(fields.get("task_outcome").attributes.options, [
    "Completed",
    "Partially completed",
    "Failed",
  ]);
  assert.deepEqual(fields.get("evidence_basis").attributes.options, [
    "Both measured",
    "Mixed measured and estimated",
    "Both estimated",
    "Unknown or not measured",
  ]);
  assert.match(fields.get("explanation_quantity").attributes.description, /time|character/i);
  assert.equal(fields.get("explanation_quantity").validations.required, true);
});

test("issue template configuration routes security reports privately", async () => {
  const config = await loadYaml("config.yml");
  assert.equal(config.blank_issues_enabled, false);
  assert.ok(Array.isArray(config.contact_links));
  assert.ok(config.contact_links.every((link) => link.url.startsWith("https://")));
  assert.ok(
    config.contact_links.some(
      (link) =>
        link.name === "Private security report" &&
        link.url === "https://github.com/Jaemani/Carrylog/security/advisories/new",
    ),
  );
});

test("README links the public adoption intake", async () => {
  const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
  assert.match(
    readme,
    /https:\/\/github\.com\/Jaemani\/Carrylog\/issues\/new\?template=adoption-report\.yml/,
  );
});
