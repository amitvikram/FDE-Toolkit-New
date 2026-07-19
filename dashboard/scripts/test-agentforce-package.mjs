import assert from "node:assert/strict";
import {
  buildAgentforcePackage,
  getAgentforceBlueprints,
} from "../src/lib/agentforce/package-builder.mjs";

const blueprints = getAgentforceBlueprints();
assert.equal(blueprints.length, 3);
assert.deepEqual(
  blueprints.map((item) => item.id).sort(),
  [
    "employee-it-support",
    "sales-account-planning",
    "service-case-resolution",
  ],
);

for (const blueprint of blueprints) {
  const result = buildAgentforcePackage({
    blueprintId: blueprint.id,
    implementationName: `${blueprint.label} CI implementation`,
    companyName: "CI Northstar",
    companyDescription:
      "CI Northstar uses Salesforce CRM, Knowledge, Data 360, and governed automation for enterprise workflows.",
    agentApiName: `CI_${blueprint.id.replaceAll("-", "_")}`,
    developmentOrgAlias: "ci-agentforce-dev",
    uatOrgAlias: "ci-agentforce-uat",
    productionOrgAlias: "ci-agentforce-prod",
  });

  assert.match(result.runId, /^af-/);
  assert.ok(result.readiness >= 90);
  assert.equal(result.implementation.blueprintId, blueprint.id);
  assert.ok(result.implementation.topics.length >= 3);
  assert.ok(result.implementation.actions.length >= 4);
  assert.ok(result.implementation.tests.length >= 3);
  assert.ok(result.files.length >= 10);
  assert.ok(result.files.some((item) => item.path === "sfdx-project.json"));
  assert.ok(result.files.some((item) => item.path.endsWith(".agent-spec.yaml")));
  assert.ok(result.files.some((item) => item.path.endsWith(".test-spec.yaml")));
  assert.ok(result.files.some((item) => item.path === "agentforce/action-catalog.json"));
  assert.ok(result.files.some((item) => item.path === "manifest/package.xml"));
  assert.ok(result.commands.some((item) => item.command.includes("agent validate authoring-bundle")));
  assert.ok(result.commands.some((item) => item.command.includes("agent publish authoring-bundle")));
  assert.ok(result.commands.some((item) => item.command.includes("agent test run-eval")));
  assert.ok(result.environmentPlan.some((item) => item.stage === "Production"));
  assert.ok(result.previewHtml.includes("Agentforce implementation"));
  assert.ok(result.checks.some((item) => item.id === "production" && item.status === "blocked-by-design"));

  for (const artifact of result.files) {
    assert.equal(artifact.bytes, Buffer.byteLength(artifact.content));
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
  }
}

console.log("Agentforce implementation package tests passed.");
