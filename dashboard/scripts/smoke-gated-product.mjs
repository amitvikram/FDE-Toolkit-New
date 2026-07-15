import assert from "node:assert/strict";

const origin = process.env.FDE_SMOKE_ORIGIN || "http://127.0.0.1:3000";

const gateResponse = await fetch(`${origin}/platform`, { redirect: "manual" });
assert.equal(gateResponse.status, 200);
const gateHtml = await gateResponse.text();
assert.ok(gateHtml.includes("Access the product"), "Anonymous visitor did not receive the product access gate.");

const unauthorizedJob = await fetch(`${origin}/api/product/jobs`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    scenario: "enterprise-ai",
    intent: "Create a governed workflow without first providing lead details.",
    repository: "https://github.com/customer/example-product",
    baseBranch: "main",
  }),
});
assert.equal(unauthorizedJob.status, 401);

const accessResponse = await fetch(`${origin}/api/product-access`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    name: "CI Product Visitor",
    email: "product-ci@example.com",
    company: "Example Enterprise",
    role: "VP Engineering",
    useCase: "Enterprise governed AI delivery",
    message: "Validate the gated FDE product workspace.",
    website: "",
    source: "/platform",
  }),
});
const accessPayload = await accessResponse.json();
assert.ok(accessResponse.ok, `${accessResponse.status}: ${JSON.stringify(accessPayload)}`);
assert.match(accessPayload.leadId, /^lead-/);
const setCookie = accessResponse.headers.get("set-cookie");
assert.ok(setCookie, "Product access did not set a cookie.");
const cookie = setCookie.split(";", 1)[0];

const productResponse = await fetch(`${origin}/platform`, {
  headers: { cookie },
});
assert.equal(productResponse.status, 200);
const productHtml = await productResponse.text();
assert.ok(productHtml.includes("Product workspace"), "Signed visitor did not receive the product workspace.");

const createResponse = await fetch(`${origin}/api/product/jobs`, {
  method: "POST",
  headers: { "content-type": "application/json", cookie },
  body: JSON.stringify({
    scenario: "enterprise-ai",
    intent: "Create a governed exception review workflow with observed evidence and mandatory human approval before promotion.",
    repository: "https://github.com/customer/example-product",
    baseBranch: "main",
  }),
});
const createPayload = await createResponse.json();
assert.ok(createResponse.ok, `${createResponse.status}: ${JSON.stringify(createPayload)}`);
const jobId = createPayload.job.id;
assert.match(jobId, /^fdejob-/);

let job = createPayload.job;
for (let attempt = 0; attempt < 100; attempt += 1) {
  const response = await fetch(`${origin}/api/product/jobs/${jobId}`, {
    headers: { cookie },
  });
  const payload = await response.json();
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(payload)}`);
  job = payload.job;
  if (["completed", "failed", "cancelled"].includes(job.status)) break;
  await new Promise((resolve) => setTimeout(resolve, 75));
}
assert.equal(job.status, "completed", job.error);
assert.ok(job.result?.previewHtml.includes("Validation ready"));
assert.ok(job.request.requiredApprovals.length > 0);

const auditResponse = await fetch(`${origin}/api/product/jobs/${jobId}/audit`, {
  headers: { cookie },
});
const audit = await auditResponse.json();
assert.ok(auditResponse.ok, `${auditResponse.status}: ${JSON.stringify(audit)}`);
assert.equal(audit.verified, true);
assert.ok(audit.records.some((record) => record.type === "filesystem.diff"));

for (const approvalKey of job.request.requiredApprovals) {
  const response = await fetch(`${origin}/api/product/jobs/${jobId}/approvals`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ approvalKey, decision: "approve", comment: "CI approval" }),
  });
  const payload = await response.json();
  assert.ok(response.ok, `${response.status}: ${JSON.stringify(payload)}`);
  job = payload.job;
}
assert.equal(job.approvalStatus, "approved");
assert.equal(job.approvals.length, job.request.requiredApprovals.length);

console.log(`Gated product workspace passed for ${jobId}.`);
