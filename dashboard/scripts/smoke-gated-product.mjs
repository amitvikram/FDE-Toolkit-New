import assert from "node:assert/strict";

const origin = process.env.FDE_SMOKE_ORIGIN || "http://127.0.0.1:3000";

async function json(response) {
  const payload = await response.json();
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(payload)}`);
  return payload;
}

const gateResponse = await fetch(`${origin}/platform`, { redirect: "manual" });
assert.equal(gateResponse.status, 200);
assert.ok((await gateResponse.text()).includes("Access the product"));

const unauthorizedWorkspace = await fetch(`${origin}/api/product/workspaces`);
assert.equal(unauthorizedWorkspace.status, 401);

const accessPayload = await json(await fetch(`${origin}/api/product-access`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "CI Product Visitor",
    email: "product-ci@example.com",
    company: "Example Enterprise",
    role: "VP Engineering",
    useCase: "Enterprise governed AI delivery",
    message: "Validate the workspace-driven FDE product.",
    website: "",
    source: "/platform",
  }),
}));
assert.match(accessPayload.leadId, /^lead-/);
const setCookie = accessPayload && accessPayload.leadId ? (await fetch(`${origin}/api/product-access`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "CI Product Visitor",
    email: "product-ci@example.com",
    company: "Example Enterprise",
    role: "VP Engineering",
    useCase: "Enterprise governed AI delivery",
    message: "Validate the workspace-driven FDE product.",
    website: "",
    source: "/platform",
  }),
})).headers.get("set-cookie") : null;
assert.ok(setCookie, "Product access did not set a cookie.");
const cookie = setCookie.split(";", 1)[0];

const productResponse = await fetch(`${origin}/platform`, { headers: { cookie } });
assert.equal(productResponse.status, 200);
assert.ok((await productResponse.text()).includes("Loading the FDE workspace"));

const runtime = await json(await fetch(`${origin}/api/product/runtime`, { headers: { cookie } }));
assert.ok(runtime.agents.some((driver) => driver.id === "openai-codex"));
assert.ok(runtime.sandboxes.some((driver) => driver.id === "local-ephemeral"));

const workspacePayload = await json(await fetch(`${origin}/api/product/workspaces`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    name: "CI Northstar workspace",
    description: "A durable workspace for code-to-production validation.",
    repository: {
      fullName: "amitvikram/FDE-Toolkit-New",
      url: "https://github.com/amitvikram/FDE-Toolkit-New",
      baseBranch: "main",
      projectPath: "examples/client-review-portal",
      connected: false,
    },
    agent: { driverId: "fde-demo-agent", secretRef: "env://CODEX_API_KEY" },
    sandbox: {
      driverId: "local-ephemeral",
      image: "node:22-alpine",
      cpu: 1,
      memoryMb: 1024,
      workspaceSizeMb: 2048,
      timeoutSeconds: 600,
      networkPolicy: "disabled",
      namespace: "fde-execution",
    },
    preview: { outputPath: "index.html", port: 3000, healthPath: "/" },
    approvals: [
      { key: "client-approval", label: "Client approver", role: "client-approver", required: true },
      { key: "product-approval", label: "Product owner", role: "product-owner", required: true },
      { key: "engineering-approval", label: "Engineering reviewer", role: "engineering-reviewer", required: true },
    ],
  }),
}));
const workspaceId = workspacePayload.workspace.id;
assert.match(workspaceId, /^ws-/);
assert.equal(workspacePayload.workspace.prepared, null);

const renamed = await json(await fetch(`${origin}/api/product/workspaces/${workspaceId}`, {
  method: "PUT",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ name: "CI Northstar delivery workspace", agent: { secretRef: "env://configured" } }),
}));
assert.equal(renamed.workspace.name, "CI Northstar delivery workspace");
assert.equal(renamed.workspace.agent.secretRef, "env://configured");

const provisioned = await json(await fetch(`${origin}/api/product/workspaces/${workspaceId}/sandboxes`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({}),
}));
const sandboxId = provisioned.sandbox.id;
assert.match(sandboxId, /^sbx-/);
assert.equal(provisioned.sandbox.status, "ready");

const prepared = await json(await fetch(`${origin}/api/product/workspaces/${workspaceId}/prepare`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({ sandboxId }),
}));
assert.equal(prepared.workspace.prepared.source, "sample-repository");
assert.equal(prepared.workspace.prepared.sandboxId, sandboxId);
assert.equal(JSON.stringify(prepared).includes("/workspaces/"), false, "Host workspace paths leaked to the browser API.");

const createPayload = await json(await fetch(`${origin}/api/product/jobs`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    workspaceId,
    scenario: "enterprise-ai",
    intent: "Make the client acceptance state prominent and show independently observed delivery evidence in the application preview.",
  }),
}));
const jobId = createPayload.job.id;
assert.match(jobId, /^fdejob-/);

let job = createPayload.job;
for (let attempt = 0; attempt < 160; attempt += 1) {
  const payload = await json(await fetch(`${origin}/api/product/jobs/${jobId}`, { headers: { cookie } }));
  job = payload.job;
  if (["completed", "failed", "cancelled"].includes(job.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 75));
}
assert.equal(job.status, "completed", job.error);
assert.ok(job.result?.previewHtml.includes("client acceptance state"));
assert.ok(job.result?.provenance.filesystemDiff.some((file) => file.path === "index.html"));
assert.equal(JSON.stringify(job).includes("/workspaces/"), false, "Job API exposed the execution mount path.");

const audit = await json(await fetch(`${origin}/api/product/jobs/${jobId}/audit`, { headers: { cookie } }));
assert.equal(audit.verified, true);
assert.ok(audit.records.some((record) => record.type === "filesystem.diff"));
assert.ok(audit.records.some((record) => record.type === "test.completed"));

const release = await json(await fetch(`${origin}/api/product/jobs/${jobId}/releases`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    workspaceId,
    reviewerName: "Client Reviewer",
    reviewerEmail: "",
    message: "Validate the new acceptance and evidence experience.",
  }),
}));
assert.match(release.release.reviewUrl, /\/review\//);
assert.equal(release.release.approvalKey, "client-approval");
const reviewUrl = new URL(release.release.reviewUrl);
const reviewToken = decodeURIComponent(reviewUrl.pathname.split("/").at(-1));

const reviewPage = await fetch(release.release.reviewUrl);
assert.equal(reviewPage.status, 200);
assert.ok((await reviewPage.text()).includes("Working application candidate"));

const clientDecision = await json(await fetch(`${origin}/api/client-review/${encodeURIComponent(reviewToken)}`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ decision: "approve", comment: "Client validated the working preview." }),
}));
assert.equal(clientDecision.decision, "approve");

for (const approvalKey of job.request.requiredApprovals.filter((key) => key !== "client-approval")) {
  const payload = await json(await fetch(`${origin}/api/product/jobs/${jobId}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ approvalKey, decision: "approve", comment: "CI approval" }),
  }));
  job = payload.job;
}
const finalJob = await json(await fetch(`${origin}/api/product/jobs/${jobId}`, { headers: { cookie } }));
assert.equal(finalJob.job.approvalStatus, "approved");
assert.equal(finalJob.job.approvals.length, finalJob.job.request.requiredApprovals.length);

const sandboxList = await json(await fetch(`${origin}/api/product/workspaces/${workspaceId}/sandboxes`, { headers: { cookie } }));
assert.ok(sandboxList.sandboxes.some((sandbox) => sandbox.id === sandboxId));
const destroyed = await json(await fetch(`${origin}/api/product/workspaces/${workspaceId}/sandboxes/${sandboxId}`, {
  method: "DELETE",
  headers: { cookie },
}));
assert.equal(destroyed.sandbox.status, "destroyed");

console.log(`Workspace product flow passed for ${workspaceId} and ${jobId}.`);
