import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createWorkspaceRegistry } from "./workspace-registry.mjs";
import { createSandboxGateway } from "./sandbox-gateway.mjs";
import { createWorkspacePreparer } from "./workspace-preparer.mjs";
import { createPlatformCore } from "./platform-core.mjs";

async function waitForJob(core, tenantId, jobId, acceptedStatuses, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const job = await core.getJob(tenantId, jobId);
    if (job && acceptedStatuses.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Job ${jobId} did not reach ${acceptedStatuses.join(", ")}.`);
}

test("workspace settings provision a sandbox prepare a repository and run a governed change", async () => {
  const root = await mkdtemp(join(tmpdir(), "fde-workspace-orchestration-"));
  const priorWorkspaceRoot = process.env.FDE_WORKSPACE_ROOT;
  process.env.FDE_WORKSPACE_ROOT = join(root, "sandbox-workspaces");
  try {
    const tenantId = "acme-workspace";
    const registry = createWorkspaceRegistry({ root: join(root, "registry") });
    const sandboxes = createSandboxGateway({
      workspaceRoot: process.env.FDE_WORKSPACE_ROOT,
      metadataRoot: join(root, "sandbox-metadata"),
      dockerCommand: "docker-not-used",
      kubectlCommand: "kubectl-not-used",
    });
    const preparer = createWorkspacePreparer();
    await Promise.all([registry.init(), sandboxes.init()]);

    let workspace = await registry.save({
      tenantId,
      name: "Northstar review portal",
      repository: {
        fullName: "amitvikram/FDE-Toolkit-New",
        url: "https://github.com/amitvikram/FDE-Toolkit-New",
        baseBranch: "main",
        projectPath: "examples/client-review-portal",
        connected: false,
      },
      agent: { driverId: "fde-demo-agent" },
      sandbox: { driverId: "local-ephemeral", timeoutSeconds: 600 },
      approvals: [
        { key: "client-approval", label: "Client approver", role: "client-approver", required: true },
        { key: "engineering-approval", label: "Engineering reviewer", role: "engineering-reviewer", required: true },
      ],
    });
    assert.match(workspace.id, /^ws-/);

    const sandbox = await sandboxes.provision({ tenantId, workspaceId: workspace.id, driverId: "local-ephemeral", timeoutSeconds: 600 });
    workspace = await registry.attachSandbox(tenantId, workspace.id, sandbox.id);
    assert.equal(workspace.sandbox.activeSandboxId, sandbox.id);

    const prepared = await preparer.prepare({ workspace, sandbox });
    workspace = await registry.markPrepared(tenantId, workspace.id, prepared);
    assert.equal(workspace.prepared.source, "sample-repository");
    assert.match(await readFile(join(prepared.mountPath, "index.html"), "utf8"), /Exception Review Portal/);
    assert.equal((await sandboxes.list({ tenantId, workspaceId: workspace.id })).length, 1);

    const core = createPlatformCore({ dataDir: join(root, "platform-data"), maxConcurrent: 1 });
    await core.init();
    const created = await core.createJob({
      tenantId,
      organizationId: tenantId,
      engagementId: workspace.id,
      actor: { id: "fde-engineer", role: "engineer" },
      scenario: "enterprise-ai",
      intent: "Add a client-facing review candidate that makes acceptance evidence and the approval boundary immediately visible.",
      repository: workspace.repository.fullName,
      baseBranch: workspace.repository.baseBranch,
      driverId: workspace.agent.driverId,
      sandboxId: sandbox.id,
      sourceControlId: "promotion-package",
      requiredApprovals: workspace.approvals.filter((item) => item.required).map((item) => item.key),
      workspace: {
        sandboxId: sandbox.id,
        source: prepared.source,
        repository: prepared.repository,
        baseBranch: prepared.baseBranch,
        repositoryRoot: prepared.repositoryRoot,
        mountPath: prepared.mountPath,
        projectPath: prepared.projectPath,
        previewOutputPath: workspace.preview.outputPath,
        preparedAt: prepared.preparedAt,
      },
      policy: { humanApprovalRequired: true, networkAccess: "disabled", secretAccess: "none" },
      metadata: { workspaceId: workspace.id },
      limits: { timeoutMs: 60_000, maxCostUsd: 1 },
    });

    let job = await waitForJob(core, tenantId, created.id, ["completed", "failed"]);
    assert.equal(job.status, "completed", job.error);
    assert.match(job.result.previewHtml, /client-facing review candidate/i);
    assert.ok(job.result.provenance.filesystemDiff.some((file) => file.path === "index.html"));
    assert.ok(job.result.promotionPackage.changedFiles.some((file) => file.path === "index.html"));
    assert.equal(job.request.workspace.projectPath, "examples/client-review-portal");
    assert.equal(JSON.stringify(job.request).includes(prepared.mountPath), false, "public job must not expose the host mount path");

    for (const approvalKey of job.request.requiredApprovals) {
      job = await core.recordApproval(tenantId, job.id, {
        approvalKey,
        decision: "approve",
        actor: { id: `approver-${approvalKey}`, role: "approver" },
      });
    }
    assert.equal(job.approvalStatus, "approved");
    const audit = await core.getAudit(tenantId, job.id);
    assert.equal(audit.verified, true);
    assert.ok(audit.records.some((record) => record.type === "filesystem.diff"));
  } finally {
    if (priorWorkspaceRoot === undefined) delete process.env.FDE_WORKSPACE_ROOT;
    else process.env.FDE_WORKSPACE_ROOT = priorWorkspaceRoot;
    await rm(root, { recursive: true, force: true });
  }
});
