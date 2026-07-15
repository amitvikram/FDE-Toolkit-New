import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlatformCore } from "./platform-core.mjs";
import { createSandboxGateway } from "./sandbox-gateway.mjs";

async function waitForJob(core, tenantId, jobId, acceptedStatuses, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await core.getJob(tenantId, jobId);
    if (job && acceptedStatuses.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Job ${jobId} did not reach ${acceptedStatuses.join(", ")}.`);
}

test("persistent platform core governs asynchronous jobs and evidence", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "fde-platform-core-"));
  try {
    const core = createPlatformCore({ dataDir, maxConcurrent: 1 });
    await core.init();

    const created = await core.createJob({
      tenantId: "acme",
      organizationId: "acme",
      actor: { id: "engineer-1", role: "engineer" },
      scenario: "enterprise-ai",
      intent: "Build a governed exception review workflow with linked evidence and mandatory human approval.",
      driverId: "fde-demo-agent",
    });
    assert.equal(created.status, "queued");

    let job = await waitForJob(core, "acme", created.id, ["completed", "failed"]);
    assert.equal(job.status, "completed", job.error);
    assert.ok(job.request.requiredApprovals.length >= 2);
    assert.ok(job.result.provenance.filesystemDiff.length > 0);

    let audit = await core.getAudit("acme", created.id);
    assert.equal(audit.verified, true);
    assert.ok(audit.records.some((event) => event.type === "filesystem.diff"));
    assert.ok(audit.records.some((event) => event.type === "command.executed"));
    assert.ok(audit.records.some((event) => event.type === "test.completed"));

    await core.addEvidence(
      "acme",
      created.id,
      { kind: "security-scan", source: "ci", status: "passed", summary: "SAST and dependency policy passed." },
      { id: "ci", role: "system" },
    );

    for (const approvalKey of job.request.requiredApprovals) {
      job = await core.recordApproval("acme", created.id, {
        approvalKey,
        decision: "approve",
        actor: { id: `approver-${approvalKey.length}`, role: "approver" },
      });
    }
    assert.equal(job.approvalStatus, "approved");

    const artifact = await core.createArtifact(
      { tenantId: "acme", name: "Governed exception review pattern", sourceJobId: created.id, tags: ["risk", "workflow"] },
      { id: "engineer-1", role: "engineer" },
    );
    assert.match(artifact.id, /^artifact-/);
    assert.equal((await core.listArtifacts("acme")).length, 1);

    const metrics = await core.analytics("acme", { id: "audit-1", role: "auditor" });
    assert.equal(metrics.completed, 1);
    assert.equal(metrics.approved, 1);
    assert.ok(metrics.medianAskToCompletedMs >= 0);

    const customerJob = await core.createJob({
      tenantId: "acme",
      actor: { id: "engineer-1", role: "engineer" },
      intent: "Use the customer-managed coding agent to implement a governed change and stream observed evidence.",
      driverId: "customer-agent-gateway",
      requiredApprovals: ["client-approval"],
      limits: { maxCostUsd: 1 },
    });
    await waitForJob(core, "acme", customerJob.id, ["running"]);

    await core.ingestCustomerEvent({
      tenantId: "acme",
      jobId: customerJob.id,
      sequence: 1,
      event: { type: "plan", payload: { summary: "Implement the bounded change." } },
    });
    await core.ingestCustomerEvent({
      tenantId: "acme",
      jobId: customerJob.id,
      sequence: 2,
      event: { type: "usage", payload: { costUsd: 0.12 } },
    });
    job = await core.ingestCustomerEvent({
      tenantId: "acme",
      jobId: customerJob.id,
      sequence: 3,
      event: { type: "done", payload: { summary: "Candidate change completed." } },
    });
    assert.equal(job.status, "completed");
    assert.equal(job.usage.costUsd, 0.12);

    audit = await core.getAudit("acme", customerJob.id);
    assert.equal(audit.verified, true);
    assert.ok(audit.records.some((event) => event.source === "customer-gateway"));
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("role policy blocks unauthorized approvals", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "fde-rbac-"));
  try {
    const core = createPlatformCore({ dataDir });
    await core.init();
    assert.throws(() => core.authorize({ role: "auditor" }, "promotion:create"), /cannot perform/);
    assert.doesNotThrow(() => core.authorize({ role: "approver" }, "approval:record"));
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("sandbox gateway provisions local workspaces and produces constrained Kubernetes Jobs", async () => {
  const root = await mkdtemp(join(tmpdir(), "fde-sandbox-gateway-"));
  try {
    const gateway = createSandboxGateway({
      workspaceRoot: join(root, "workspaces"),
      metadataRoot: join(root, "metadata"),
      dockerCommand: "docker-command-not-installed-for-test",
      kubectlCommand: "kubectl-command-not-installed-for-test",
    });
    await gateway.init();

    const local = await gateway.provision({ tenantId: "acme", driverId: "local-ephemeral", timeoutSeconds: 30 });
    assert.equal(local.status, "ready");
    assert.match(local.id, /^sbx-/);
    assert.equal((await gateway.get(local.id)).workspaceMount, local.workspaceMount);
    assert.equal((await gateway.destroy(local.id)).status, "destroyed");

    const kubernetes = await gateway.provision({
      tenantId: "acme",
      driverId: "kubernetes-job",
      namespace: "fde-execution",
      image: "node:22-alpine",
      cpu: 1,
      memoryMb: 512,
      timeoutSeconds: 120,
      apply: false,
    });
    assert.equal(kubernetes.status, "manifest-ready");
    assert.equal(kubernetes.manifest.kind, "Job");
    assert.equal(kubernetes.manifest.spec.activeDeadlineSeconds, 120);
    assert.equal(kubernetes.manifest.spec.template.spec.automountServiceAccountToken, false);
    assert.equal(kubernetes.manifest.spec.template.spec.containers[0].securityContext.allowPrivilegeEscalation, false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
