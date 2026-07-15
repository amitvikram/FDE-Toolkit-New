import { createServer } from "node:http";
import { createHmac, timingSafeEqual } from "node:crypto";
import { runDemoExecution } from "./demo-runner.mjs";
import { createPlatformCore } from "./platform-core.mjs";
import { CONTRACT_VERSION, PLATFORM_VERSION } from "./platform-runtime.mjs";
import {
  createGitHubPromotion,
  getGitHubInstallation,
  githubAppConfigured,
  listInstallationRepositories,
  parseGitHubRepository,
} from "./github-app.mjs";
import { createSandboxGateway } from "./sandbox-gateway.mjs";
import { createCredentialBroker } from "./credential-broker.mjs";
import { createWorkspaceRegistry } from "./workspace-registry.mjs";
import { createWorkspacePreparer } from "./workspace-preparer.mjs";

const port = Number(process.env.PORT || 8787);
const signingSecret = process.env.FDE_EXECUTION_SIGNING_SECRET || "local-demo-signing-secret";
const maxClockSkewMs = 5 * 60 * 1000;
const maxBodyBytes = 1024 * 1024;
const credentialBroker = createCredentialBroker();
const core = createPlatformCore({ credentialBroker });
const sandboxes = createSandboxGateway({ metadataRoot: `${core.dataDir}/sandboxes` });
const workspaces = createWorkspaceRegistry({ root: `${core.dataDir}/workspaces` });
const workspacePreparer = createWorkspacePreparer();
await Promise.all([core.init(), sandboxes.init(), workspaces.init()]);

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
  });
  response.end(body);
}

function expectedSignature(timestamp, body) {
  const digest = createHmac("sha256", signingSecret).update(`${timestamp}.${body}`).digest("hex");
  return `sha256=${digest}`;
}

function signaturesMatch(actual, expected) {
  const actualBuffer = Buffer.from(actual || "", "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function verifyRequest(request, body) {
  const timestamp = request.headers["x-fde-timestamp"];
  const signature = request.headers["x-fde-signature"];
  if (typeof timestamp !== "string" || typeof signature !== "string") return "Missing signed execution metadata.";
  const parsedTimestamp = Number(timestamp);
  if (!Number.isFinite(parsedTimestamp) || Math.abs(Date.now() - parsedTimestamp) > maxClockSkewMs) {
    return "Execution request timestamp is outside the allowed window.";
  }
  if (!signaturesMatch(signature, expectedSignature(timestamp, body))) return "Invalid execution request signature.";
  return null;
}

async function readBody(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > maxBodyBytes) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function actorFrom(request, payload = {}) {
  return payload.actor || {
    id: String(request.headers["x-fde-actor-id"] || "control-plane"),
    role: String(request.headers["x-fde-actor-role"] || "system"),
  };
}

function tenantFrom(url, payload = {}) {
  return payload.tenantId || url.searchParams.get("tenantId") || "public-demo";
}

function matchJobPath(pathname, suffix = "") {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pathname.match(new RegExp(`^/v1/jobs/([^/]+)${escaped}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

function matchWorkspacePath(pathname, suffix = "") {
  const escaped = suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = pathname.match(new RegExp(`^/v1/workspaces/([^/]+)${escaped}$`));
  return match ? decodeURIComponent(match[1]) : null;
}

async function requireSignedJson(request, response) {
  const rawBody = await readBody(request);
  const verificationError = verifyRequest(request, rawBody);
  if (verificationError) {
    sendJson(response, 401, { error: verificationError });
    return null;
  }
  try {
    return { rawBody, payload: rawBody ? JSON.parse(rawBody) : {} };
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON." });
    return null;
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  try {
    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, {
        status: "ok",
        service: "fde-execution-plane",
        contractVersion: CONTRACT_VERSION,
        platformVersion: PLATFORM_VERSION,
        executionBoundary: process.env.FDE_EXECUTION_BOUNDARY || "separate-container",
        trustModel: "observed-not-self-reported",
        storage: { type: "file", dataDir: core.dataDir, durableVolumeRecommended: true },
        queue: core.queueStats(),
        githubAppConfigured: githubAppConfigured(),
        sandboxDrivers: sandboxes.catalog(),
        secretProviders: credentialBroker.catalog(),
        workspaceRegistry: { type: "file", root: workspaces.root },
      });
    }

    if (request.method === "GET" && url.pathname === "/v1/drivers") {
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, drivers: core.getDriverCatalog() });
    }

    if (request.method === "GET" && url.pathname === "/v1/sandboxes/drivers") {
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, drivers: sandboxes.catalog() });
    }

    if (request.method === "GET" && url.pathname === "/v1/secrets/providers") {
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, providers: credentialBroker.catalog() });
    }

    if (request.method === "GET" && url.pathname === "/v1/workspaces") {
      const tenantId = tenantFrom(url);
      return sendJson(response, 200, { tenantId, workspaces: await workspaces.list(tenantId) });
    }

    const workspaceMatch = url.pathname.match(/^\/v1\/workspaces\/([^/]+)$/);
    if (request.method === "GET" && workspaceMatch) {
      const tenantId = tenantFrom(url);
      const workspace = await workspaces.get(tenantId, decodeURIComponent(workspaceMatch[1]));
      return workspace ? sendJson(response, 200, { workspace }) : sendJson(response, 404, { error: "Workspace not found." });
    }

    if (request.method === "GET" && url.pathname === "/v1/sandboxes") {
      const tenantId = tenantFrom(url);
      const workspaceId = url.searchParams.get("workspaceId") || null;
      return sendJson(response, 200, { tenantId, workspaceId, sandboxes: await sandboxes.list({ tenantId, workspaceId }) });
    }

    const sandboxMatch = url.pathname.match(/^\/v1\/sandboxes\/([^/]+)$/);
    if (request.method === "GET" && sandboxMatch) {
      const sandbox = await sandboxes.get(decodeURIComponent(sandboxMatch[1]));
      return sandbox ? sendJson(response, 200, { sandbox }) : sendJson(response, 404, { error: "Sandbox not found." });
    }

    if (request.method === "GET" && url.pathname === "/v1/artifacts") {
      const tenantId = tenantFrom(url);
      return sendJson(response, 200, { tenantId, artifacts: await core.listArtifacts(tenantId) });
    }

    if (request.method === "GET" && url.pathname === "/v1/analytics/ask-to-pr") {
      const tenantId = tenantFrom(url);
      const actor = { id: String(request.headers["x-fde-actor-id"] || "auditor"), role: String(request.headers["x-fde-actor-role"] || "auditor") };
      return sendJson(response, 200, await core.analytics(tenantId, actor));
    }

    const auditJobId = matchJobPath(url.pathname, "/audit");
    if (request.method === "GET" && auditJobId) {
      const tenantId = tenantFrom(url);
      const audit = await core.getAudit(tenantId, auditJobId);
      return sendJson(response, 200, { tenantId, jobId: auditJobId, ...audit });
    }

    const jobId = matchJobPath(url.pathname);
    if (request.method === "GET" && jobId) {
      const tenantId = tenantFrom(url);
      const job = await core.getJob(tenantId, jobId);
      return job ? sendJson(response, 200, { job }) : sendJson(response, 404, { error: "Job not found." });
    }

    if (request.method !== "POST") return sendJson(response, 404, { error: "Not found." });
    const signed = await requireSignedJson(request, response);
    if (!signed) return;
    const { payload } = signed;
    const actor = actorFrom(request, payload);

    if (url.pathname === "/v1/runs") {
      const result = await runDemoExecution(payload);
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, result });
    }

    if (url.pathname === "/v1/jobs") {
      const job = await core.createJob({ ...payload, actor });
      return sendJson(response, 202, { contractVersion: CONTRACT_VERSION, job });
    }

    if (url.pathname === "/v1/workspaces") {
      core.authorize(actor, "job:create");
      const workspace = await workspaces.save({ ...payload, actor });
      return sendJson(response, 201, { contractVersion: CONTRACT_VERSION, workspace });
    }

    const updateWorkspaceId = matchWorkspacePath(url.pathname);
    if (updateWorkspaceId) {
      core.authorize(actor, "job:create");
      const tenantId = tenantFrom(url, payload);
      const workspace = await workspaces.save({ ...payload, id: updateWorkspaceId, tenantId });
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, workspace });
    }

    const githubWorkspaceId = matchWorkspacePath(url.pathname, "/github");
    if (githubWorkspaceId) {
      core.authorize(actor, "job:create");
      if (!githubAppConfigured()) throw new Error("GitHub App credentials are not configured in the execution plane.");
      const tenantId = tenantFrom(url, payload);
      const installationId = String(payload.installationId || "").trim();
      if (!installationId) throw new Error("installationId is required.");
      const installation = await getGitHubInstallation(installationId);
      const repositories = await listInstallationRepositories(installationId);
      const repositoryNames = repositories.map((repository) => repository.full_name).filter(Boolean);
      let workspace = await workspaces.connectGitHub(tenantId, githubWorkspaceId, {
        installationId,
        accountLogin: installation.account?.login || null,
        repositories: repositoryNames,
      });
      const requestedRepository = payload.repository || workspace.repository.fullName;
      if (requestedRepository) {
        const parsed = parseGitHubRepository(requestedRepository);
        if (!repositoryNames.includes(parsed.fullName)) throw new Error("The selected repository is not available to this GitHub App installation.");
        workspace = await workspaces.save({
          ...workspace,
          tenantId,
          id: githubWorkspaceId,
          repository: {
            ...workspace.repository,
            fullName: parsed.fullName,
            url: `https://github.com/${parsed.fullName}`,
            baseBranch: payload.baseBranch || workspace.repository.baseBranch,
            projectPath: payload.projectPath ?? workspace.repository.projectPath,
            connected: true,
          },
        });
      }
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, workspace, repositories: repositoryNames });
    }

    const workspaceSandboxId = matchWorkspacePath(url.pathname, "/sandboxes");
    if (workspaceSandboxId) {
      core.authorize(actor, "job:create");
      const tenantId = tenantFrom(url, payload);
      const workspace = await workspaces.get(tenantId, workspaceSandboxId);
      if (!workspace) throw new Error("Workspace not found.");
      const sandbox = await sandboxes.provision({
        tenantId,
        workspaceId: workspace.id,
        driverId: payload.driverId || workspace.sandbox.driverId,
        image: payload.image || workspace.sandbox.image,
        cpu: payload.cpu ?? workspace.sandbox.cpu,
        memoryMb: payload.memoryMb ?? workspace.sandbox.memoryMb,
        workspaceSizeMb: payload.workspaceSizeMb ?? workspace.sandbox.workspaceSizeMb,
        timeoutSeconds: payload.timeoutSeconds ?? workspace.sandbox.timeoutSeconds,
        networkPolicy: payload.networkPolicy || workspace.sandbox.networkPolicy,
        namespace: payload.namespace || workspace.sandbox.namespace,
        apply: payload.apply === true,
      });
      const updatedWorkspace = await workspaces.attachSandbox(tenantId, workspace.id, sandbox.id);
      return sendJson(response, 201, { contractVersion: CONTRACT_VERSION, workspace: updatedWorkspace, sandbox });
    }

    const prepareWorkspaceId = matchWorkspacePath(url.pathname, "/prepare");
    if (prepareWorkspaceId) {
      core.authorize(actor, "job:create");
      const tenantId = tenantFrom(url, payload);
      const workspace = await workspaces.get(tenantId, prepareWorkspaceId);
      if (!workspace) throw new Error("Workspace not found.");
      const sandboxId = payload.sandboxId || workspace.sandbox.activeSandboxId;
      if (!sandboxId) throw new Error("Provision a sandbox before preparing the repository.");
      const sandbox = await sandboxes.get(sandboxId);
      if (!sandbox || sandbox.tenantId !== tenantId || sandbox.workspaceId !== workspace.id) throw new Error("Workspace sandbox not found.");
      const prepared = await workspacePreparer.prepare({ workspace, sandbox });
      const updatedWorkspace = await workspaces.markPrepared(tenantId, workspace.id, prepared);
      return sendJson(response, 200, { contractVersion: CONTRACT_VERSION, workspace: updatedWorkspace, sandbox, prepared });
    }

    if (url.pathname === "/v1/customer-agents/events") {
      const job = await core.ingestCustomerEvent(payload);
      return sendJson(response, 202, { contractVersion: CONTRACT_VERSION, job });
    }

    if (url.pathname === "/v1/artifacts") {
      const artifact = await core.createArtifact(payload, actor);
      return sendJson(response, 201, { contractVersion: CONTRACT_VERSION, artifact });
    }

    if (url.pathname === "/v1/sandboxes") {
      core.authorize(actor, "job:create");
      const sandbox = await sandboxes.provision(payload);
      return sendJson(response, 201, { contractVersion: CONTRACT_VERSION, sandbox });
    }

    const destroySandbox = url.pathname.match(/^\/v1\/sandboxes\/([^/]+)\/destroy$/);
    if (destroySandbox) {
      core.authorize(actor, "job:cancel");
      const sandboxId = decodeURIComponent(destroySandbox[1]);
      const sandbox = await sandboxes.destroy(sandboxId);
      let workspace = null;
      if (sandbox.workspaceId) {
        workspace = await workspaces.attachSandbox(sandbox.tenantId, sandbox.workspaceId, null).catch(() => null);
      }
      return sendJson(response, 200, { sandbox, workspace });
    }

    const cancelId = matchJobPath(url.pathname, "/cancel");
    if (cancelId) {
      const tenantId = tenantFrom(url, payload);
      const job = await core.cancelJob(tenantId, cancelId, actor);
      return sendJson(response, 200, { job });
    }

    const evidenceId = matchJobPath(url.pathname, "/evidence");
    if (evidenceId) {
      const tenantId = tenantFrom(url, payload);
      return sendJson(response, 201, await core.addEvidence(tenantId, evidenceId, payload, actor));
    }

    const approvalId = matchJobPath(url.pathname, "/approvals");
    if (approvalId) {
      const tenantId = tenantFrom(url, payload);
      const job = await core.recordApproval(tenantId, approvalId, { ...payload, actor });
      return sendJson(response, 201, { job });
    }

    const promoteId = matchJobPath(url.pathname, "/promote/github");
    if (promoteId) {
      const tenantId = tenantFrom(url, payload);
      core.authorize(actor, "promotion:create");
      const rawJob = await core.getRawJob(promoteId, tenantId);
      if (!rawJob) return sendJson(response, 404, { error: "Job not found." });
      await core.getAudit(tenantId, promoteId).then((audit) => {
        if (!audit.verified) throw new Error("Audit chain verification failed; promotion is blocked.");
        rawJob.auditHeadHash = audit.headHash;
      });
      const promotion = await createGitHubPromotion(rawJob, payload);
      const job = await core.markPromoted(tenantId, promoteId, promotion, actor);
      return sendJson(response, 201, { job, promotion });
    }

    const mergedId = matchJobPath(url.pathname, "/merged");
    if (mergedId) {
      const tenantId = tenantFrom(url, payload);
      const job = await core.markMerged(tenantId, mergedId, payload);
      return sendJson(response, 200, { job });
    }

    return sendJson(response, 404, { error: "Not found." });
  } catch (error) {
    console.error("Execution plane request failed:", error);
    const message = error instanceof Error ? error.message : "Execution plane request failed.";
    const status = /not found/i.test(message) ? 404 : /cannot perform|approval|signature|policy|installation/i.test(message) ? 403 : 400;
    return sendJson(response, status, { error: message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`FDE execution plane listening on :${port}`);
});
