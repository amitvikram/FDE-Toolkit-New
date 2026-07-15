import { createSign } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

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

export function parseGitHubRepository(value) {
  const text = String(value || "").trim().replace(/\.git$/, "");
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text)) {
    const [owner, repo] = text.split("/");
    return { owner, repo, fullName: `${owner}/${repo}` };
  }
  const url = new URL(text);
  if (url.hostname !== "github.com") throw new Error("GitHub integration currently supports github.com repositories.");
  const [owner, repo] = url.pathname.replace(/^\//, "").split("/");
  if (!owner || !repo) throw new Error("A valid GitHub repository is required.");
  return { owner, repo, fullName: `${owner}/${repo}` };
}

async function githubRequest(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "x-github-api-version": "2022-11-28",
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

function credentials(input = {}) {
  const appId = input.appId || process.env.GITHUB_APP_ID;
  const privateKey = String(input.privateKey || process.env.GITHUB_APP_PRIVATE_KEY || "").replaceAll("\\n", "\n");
  if (!appId || !privateKey) throw new Error("GitHub App ID and private key are not configured.");
  return { appId, privateKey };
}

export async function createInstallationToken({ installationId, repository, permissions, appId, privateKey }) {
  const configured = credentials({ appId, privateKey });
  const { repo } = parseGitHubRepository(repository);
  const jwt = appJwt(configured.appId, configured.privateKey);
  const payload = await githubRequest(`/app/installations/${installationId}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({
      repositories: [repo],
      permissions: permissions || { contents: "write", pull_requests: "write" },
    }),
  });
  return { token: payload.token, expiresAt: payload.expires_at, repositories: payload.repositories || [] };
}

export async function getGitHubInstallation(installationId, input = {}) {
  const configured = credentials(input);
  return githubRequest(`/app/installations/${installationId}`, appJwt(configured.appId, configured.privateKey));
}

export async function listInstallationRepositories(installationId, input = {}) {
  const configured = credentials(input);
  const jwt = appJwt(configured.appId, configured.privateKey);
  const access = await githubRequest(`/app/installations/${installationId}/access_tokens`, jwt, {
    method: "POST",
    body: JSON.stringify({ permissions: { contents: "read", metadata: "read" } }),
  });
  const result = await githubRequest("/installation/repositories?per_page=100", access.token);
  return result.repositories || [];
}

function sanitizeBranch(value, jobId) {
  const branch = String(value || `fde/${jobId}`)
    .trim()
    .replace(/[^A-Za-z0-9._/-]+/g, "-")
    .replace(/^[-/.]+|[-/.]+$/g, "")
    .slice(0, 180);
  return branch || `fde/${jobId}`;
}

function safeWorkspaceFile(workspace, relativePath) {
  const root = resolve(process.env.FDE_WORKSPACE_ROOT || "/workspaces");
  const mountPath = resolve(workspace?.mountPath || "");
  if (!mountPath || (mountPath !== root && !mountPath.startsWith(`${root}${sep}`))) {
    throw new Error("Promotion workspace is outside FDE_WORKSPACE_ROOT.");
  }
  const file = resolve(mountPath, String(relativePath || ""));
  if (file !== mountPath && !file.startsWith(`${mountPath}${sep}`)) throw new Error("Unsafe promotion file path.");
  return file;
}

function repositoryPath(job, relativePath) {
  const projectPath = String(job.request.workspace?.projectPath || "").replace(/^\/+|\/+$/g, "");
  const clean = String(relativePath || "").replace(/^\/+/, "");
  return [projectPath, clean].filter(Boolean).join("/");
}

export function githubAppConfigured() {
  return Boolean(process.env.GITHUB_APP_ID && process.env.GITHUB_APP_PRIVATE_KEY);
}

async function existingFile(owner, repo, path, ref, token) {
  try {
    return await githubRequest(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`, token);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function promoteWorkspaceFiles(job, owner, repo, branch, baseBranch, token) {
  const workspace = job.request.workspace;
  if (!workspace?.mountPath) return [];
  const changes = (job.result?.observedDiff || job.result?.provenance?.filesystemDiff || []).slice(0, 60);
  const commits = [];

  for (const change of changes) {
    const path = repositoryPath(job, change.path);
    if (!path || path.startsWith(".git/")) continue;
    const remote = await existingFile(owner, repo, path, branch, token) || await existingFile(owner, repo, path, baseBranch, token);
    if (change.operation === "deleted") {
      if (!remote?.sha) continue;
      const deleted = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, token, {
        method: "DELETE",
        body: JSON.stringify({ message: `feat(fde): delete ${path}`, sha: remote.sha, branch }),
      });
      commits.push({ path, operation: "deleted", commitSha: deleted.commit.sha });
      continue;
    }

    const filePath = safeWorkspaceFile(workspace, change.path);
    const info = await stat(filePath);
    if (!info.isFile()) continue;
    if (info.size > 2 * 1024 * 1024) throw new Error(`Promotion file ${path} exceeds the 2 MB MVP limit.`);
    const content = await readFile(filePath);
    const written = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, token, {
      method: "PUT",
      body: JSON.stringify({
        message: `feat(fde): ${change.operation || "update"} ${path}`,
        content: content.toString("base64"),
        branch,
        ...(remote?.sha ? { sha: remote.sha } : {}),
      }),
    });
    commits.push({ path, operation: change.operation || (remote ? "modified" : "added"), commitSha: written.commit.sha });
  }
  return commits;
}

export async function createGitHubPromotion(job, input = {}) {
  if (job.status !== "completed") throw new Error("Only completed jobs can be promoted.");
  if (job.request.policy.humanApprovalRequired && job.approvalStatus !== "approved") {
    throw new Error("All required human approvals must be recorded before promotion.");
  }

  const installationId = input.installationId || job.request.metadata?.githubInstallationId || process.env.GITHUB_APP_INSTALLATION_ID;
  if (!installationId) throw new Error("A GitHub App installation is not connected to this workspace.");

  const repository = input.repository || job.request.repository;
  const { owner, repo } = parseGitHubRepository(repository);
  const baseBranch = input.baseBranch || job.request.baseBranch || "main";
  const access = await createInstallationToken({
    installationId,
    repository,
    permissions: { contents: "write", pull_requests: "write" },
    appId: input.appId,
    privateKey: input.privateKey,
  });
  const token = access.token;
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

  const codeCommits = await promoteWorkspaceFiles(job, owner, repo, branch, baseBranch, token);
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
    auditHeadHash: job.auditHeadHash || null,
    usage: job.usage,
    promotedFiles: codeCommits,
    executionResult: job.result,
    timestamps: {
      acceptedAt: job.acceptedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      approvedAt: job.approvedAt,
    },
  };
  const evidencePath = `.fde/runs/${job.id}.json`;
  const priorEvidence = await existingFile(owner, repo, evidencePath, branch, token);
  const file = await githubRequest(`/repos/${owner}/${repo}/contents/${evidencePath}`, token, {
    method: "PUT",
    body: JSON.stringify({
      message: `chore(fde): attach governed evidence for ${job.id}`,
      content: Buffer.from(`${JSON.stringify(evidencePackage, null, 2)}\n`, "utf8").toString("base64"),
      branch,
      ...(priorEvidence?.sha ? { sha: priorEvidence.sha } : {}),
    }),
  });

  const title = input.title || job.result?.promotionPackage?.title || `FDE governed change: ${job.id}`;
  const body = input.body || job.result?.promotionPackage?.body || [
    "## Governed delivery job",
    `- Job: \`${job.id}\``,
    `- Tenant: \`${job.tenantId}\``,
    `- Approval status: **${job.approvalStatus}**`,
    `- Promoted files: **${codeCommits.length}**`,
    `- Evidence package: \`${evidencePath}\``,
    `- Audit head: \`${job.auditHeadHash || "not-recorded"}\``,
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
    auditHeadHash: job.auditHeadHash || null,
    promotedFiles: codeCommits,
    commitSha: file.commit.sha,
    pullRequestNumber: pullRequest.number,
    pullRequestUrl: pullRequest.html_url,
    state: pullRequest.state,
    draft: pullRequest.draft,
    promotedAt: new Date().toISOString(),
  };
}
