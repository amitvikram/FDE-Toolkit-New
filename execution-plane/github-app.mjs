import { createSign } from "node:crypto";

function base64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function appJwt(appId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iat: now - 30, exp: now + 9 * 60, iss: String(appId) }));
  const unsigned = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKey, "base64").replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
  return `${unsigned}.${signature}`;
}

function parseRepository(value) {
  const text = String(value || "").trim().replace(/\.git$/, "");
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) {
    const [owner, repo] = text.split("/");
    return { owner, repo };
  }
  const url = new URL(text);
  if (url.hostname !== "github.com") throw new Error("GitHub promotion currently supports github.com repositories.");
  const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
  if (!owner || !repo) throw new Error("A valid GitHub repository is required.");
  return { owner, repo };
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2026-03-10",
      "user-agent": "FDE-Toolkit-GitHub-App",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(payload?.message || `GitHub API returned ${response.status}.`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function installationToken({ appId, privateKey, installationId, repo }) {
  const jwt = appJwt(appId, privateKey);
  const payload = await githubRequest(`/app/installations/${installationId}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({
      repositories: [repo],
      permissions: { contents: "write", pull_requests: "write", statuses: "read", checks: "read" },
    }),
  });
  return payload.token;
}

function sanitizeBranch(value, jobId) {
  const branch = String(value || `fde/${jobId}`)
    .trim()
    .replace(/[^A-Za-z0-9._/-]+/g, "-")
    .replace(/^[-/.]+|[-/.]+$/g, "")
    .slice(0, 180);
  return branch || `fde/${jobId}`;
}

export function githubAppConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY && process.env.GITHUB_APP_INSTALLATION_ID);
}

export async function createGitHubPromotion(job, input = {}) {
  if (job.status !== "completed") throw new Error("Only completed jobs can be promoted.");
  if (job.request.policy.humanApprovalRequired && job.approvalStatus !== "approved") {
    throw new Error("All required human approvals must be recorded before promotion.");
  }

  const appId = input.appId || process.env.GITHUB_APP_ID;
  const privateKey = String(input.privateKey || process.env.GITHUB_APP_PRIVATE_KEY || "").replaceAll("\\n", "\n");
  const installationId = input.installationId || job.request.metadata?.githubInstallationId || process.env.GITHUB_APP_INSTALLATION_ID;
  if (!appId || !privateKey || !installationId) throw new Error("GitHub App credentials are not configured.");

  const { owner, repo } = parseRepository(input.repository || job.request.repository);
  const baseBranch = input.baseBranch || job.request.baseBranch || "main";
  const token = await installationToken({ appId, privateKey, installationId, repo });
  const baseRef = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(baseBranch)}`, token);
  let branch = sanitizeBranch(input.branch || job.result?.promotionPackage?.branchName, job.id);

  try {
    await githubRequest(`/repos/${owner}/${repo}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    });
  } catch (error) {
    if (error.status !== 422) throw error;
    branch = `${branch}-${Date.now().toString(36)}`;
    await githubRequest(`/repos/${owner}/${repo}/git/refs`, token, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseRef.object.sha }),
    });
  }

  const evidencePackage = {
    contractVersion: "1.0",
    generatedBy: "FDE-Toolkit",
    jobId: job.id,
    tenantId: job.tenantId,
    organizationId: job.organizationId,
    engagementId: job.engagementId,
    intent: job.request.intent,
    policy: job.request.policy,
    approvals: job.approvals,
    evidence: job.evidence,
    usage: job.usage,
    executionResult: job.result,
    timestamps: {
      acceptedAt: job.acceptedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      approvedAt: job.approvedAt,
    },
  };
  const evidencePath = `.fde/runs/${job.id}.json`;
  const file = await githubRequest(`/repos/${owner}/${repo}/contents/${evidencePath}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore(fde): attach governed evidence for ${job.id}`,
      content: Buffer.from(`${JSON.stringify(evidencePackage, null, 2)}\n`, "utf8").toString("base64"),
      branch,
    }),
  });

  const title = input.title || job.result?.promotionPackage?.title || `FDE governed change: ${job.id}`;
  const body = input.body || job.result?.promotionPackage?.body || [
    "## Governed delivery job",
    `- Job: \`${job.id}\``,
    `- Tenant: \`${job.tenantId}\``,
    `- Approval status: **${job.approvalStatus}**`,
    `- Evidence package: \`${evidencePath}\``,
    "",
    "This pull request was created by the FDE-Toolkit GitHub App after required approvals were recorded.",
  ].join("\n");
  const pullRequest = await githubRequest(`/repos/${owner}/${repo}/pulls`, token, {
    method: "POST",
    body: JSON.stringify({ title, head: branch, base: baseBranch, body, draft: input.draft !== false }),
  });

  return {
    provider: "github-app",
    owner,
    repository: repo,
    installationId: String(installationId),
    branch,
    baseBranch,
    evidencePath,
    commitSha: file.commit.sha,
    pullRequestNumber: pullRequest.number,
    pullRequestUrl: pullRequest.html_url,
    state: pullRequest.state,
    draft: pullRequest.draft,
    promotedAt: new Date().toISOString(),
  };
}
