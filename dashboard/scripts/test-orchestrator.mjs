import assert from "node:assert/strict";
import test from "node:test";
import { runDemoJob } from "../src/lib/orchestration/demo-runner.mjs";

const scenarios = ["enterprise-ai", "saas-design-partner", "si-delivery"];

for (const scenario of scenarios) {
  test(`orchestration demo completes for ${scenario}`, async () => {
    const result = await runDemoJob({
      scenario,
      clientAsk:
        "Create a governed working experience that preserves the client ask, validation evidence, human approvals, and a reviewable promotion package.",
      repository: "https://github.com/customer/example-product",
      baseBranch: "main",
      codingAgentId: "fde-demo-agent",
      sandboxId: "local-ephemeral",
      sourceControlId: "promotion-package",
      approvalMode: "human-required",
    });

    assert.match(result.runId, /^fde-/);
    assert.equal(result.providers.codingAgent, "fde-demo-agent");
    assert.equal(result.providers.sandbox, "local-ephemeral");
    assert.equal(result.policyProfile.humanApprovalRequired, true);
    assert.equal(result.policyProfile.networkAccess, "disabled");
    assert.ok(result.previewHtml.includes("Validation ready"));
    assert.ok(result.testOutput.length > 0);
    assert.equal(result.promotionPackage.changedFiles.length, 5);
    assert.ok(result.promotionPackage.approvalsRequired.length >= 3);
    assert.ok(result.steps.some((step) => step.id === "promotion-package"));

    console.log(
      JSON.stringify({
        scenario,
        runId: result.runId,
        cycleTimeMs: result.cycleTimeMs,
        changedFiles: result.promotionPackage.changedFiles.length,
      }),
    );
  });
}
