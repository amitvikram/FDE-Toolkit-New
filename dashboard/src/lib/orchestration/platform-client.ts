import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type {
  OrchestrationResult,
  OrchestrationScenario,
} from "@/lib/orchestration/types";

const defaultExecutionPlaneUrl = "http://127.0.0.1:8787";

function configuration() {
  return {
    baseUrl: (process.env.FDE_EXECUTION_PLANE_URL || defaultExecutionPlaneUrl).replace(/\/$/, ""),
    signingSecret: process.env.FDE_EXECUTION_SIGNING_SECRET || "local-demo-signing-secret",
  };
}

function signedHeaders(body: string) {
  const { signingSecret } = configuration();
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", signingSecret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return {
    "content-type": "application/json",
    "x-fde-timestamp": timestamp,
    "x-fde-signature": `sha256=${signature}`,
    "x-fde-request-id": randomUUID(),
  };
}

async function signedPost<T>(path: string, input: unknown) {
  const { baseUrl } = configuration();
  const body = JSON.stringify(input);
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: signedHeaders(body),
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(180_000),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Execution plane rejected the request (${response.status}).`);
  return payload;
}

async function getJson<T>(path: string) {
  const { baseUrl } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Execution plane rejected the request (${response.status}).`);
  return payload;
}

export type ProductApproval = {
  id: string;
  approvalKey: string;
  decision: "approved" | "rejected";
  actor: { id: string; role: string };
  comment: string;
  decidedAt: string;
};

export type ProductEvidence = {
  id: string;
  kind: string;
  source: string;
  status: string;
  summary: string;
  payload: Record<string, unknown>;
  observedAt: string;
};

export type WorkspaceApproval = {
  key: string;
  label: string;
  role: string;
  required: boolean;
};

export type ProductWorkspace = {
  id: string;
  tenantId: string;
  organizationId: string;
  name: string;
  description: string;
  status: string;
  repository: {
    provider: "github";
    fullName: string;
    url: string;
    baseBranch: string;
    projectPath: string;
    connected: boolean;
  };
  github: {
    installationId: string | null;
    accountLogin: string | null;
    connectedAt: string | null;
    repositories: string[];
  };
  agent: {
    driverId: string;
    model: string | null;
    secretRef: string;
  };
  sandbox: {
    driverId: string;
    image: string;
    cpu: number;
    memoryMb: number;
    workspaceSizeMb: number;
    timeoutSeconds: number;
    networkPolicy: string;
    namespace: string;
    activeSandboxId: string | null;
  };
  prepared: {
    source: string;
    repository: string;
    baseBranch: string;
    repositoryRoot: string;
    mountPath: string;
    projectPath: string;
    sandboxId: string;
    preparedAt: string;
  } | null;
  preview: {
    buildCommand: string;
    startCommand: string;
    outputPath: string;
    port: number;
    healthPath: string;
  };
  approvals: WorkspaceApproval[];
  production: {
    createDraftPullRequest: boolean;
    requirePassingTests: boolean;
    requireSecurityEvidence: boolean;
    environments: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export type PublicProductWorkspace = Omit<ProductWorkspace, "prepared"> & {
  prepared: null | {
    source: string;
    repository: string;
    baseBranch: string;
    projectPath: string;
    sandboxId: string;
    preparedAt: string;
  };
};

export function publicProductWorkspace(workspace: ProductWorkspace): PublicProductWorkspace {
  return {
    ...workspace,
    agent: { ...workspace.agent, secretRef: workspace.agent.secretRef ? `${workspace.agent.secretRef.split("://")[0]}://configured` : "" },
    prepared: workspace.prepared ? {
      source: workspace.prepared.source,
      repository: workspace.prepared.repository,
      baseBranch: workspace.prepared.baseBranch,
      projectPath: workspace.prepared.projectPath,
      sandboxId: workspace.prepared.sandboxId,
      preparedAt: workspace.prepared.preparedAt,
    } : null,
  };
}

export type ProductSandbox = {
  id: string;
  driverId: string;
  tenantId: string;
  workspaceId: string | null;
  jobId: string | null;
  image: string;
  networkPolicy: string;
  cpu: number;
  memoryMb: number;
  workspaceSizeMb: number;
  status: string;
  createdAt: string;
  expiresAt: string;
  destroyedAt?: string;
  providerMetadata?: Record<string, unknown>;
};

export type RuntimeDriver = {
  id: string;
  name: string;
  vendor?: string;
  status: string;
  deploymentModes: string[];
  capabilities?: string[];
  operations?: string[];
};

export type ProductRuntime = {
  githubAppConfigured: boolean;
  executionBoundary: string;
  trustModel: string;
  agents: RuntimeDriver[];
  sandboxes: RuntimeDriver[];
};

export type ProductJob = {
  id: string;
  tenantId: string;
  organizationId: string;
  engagementId: string | null;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  approvalStatus: "not-configured" | "pending" | "approved" | "rejected";
  approvals: ProductApproval[];
  evidence: ProductEvidence[];
  usage: { costUsd: number; eventCount: number };
  request: {
    tenantId: string;
    organizationId: string;
    engagementId: string | null;
    scenario: OrchestrationScenario | null;
    intent: string;
    repository: string | null;
    baseBranch: string;
    driverId: string;
    sandboxId: string;
    sourceControlId: string;
    requiredApprovals: string[];
    policy: {
      humanApprovalRequired: boolean;
      networkAccess: string;
      secretAccess: string;
      allowedTools: string[];
      allowedCommands: string[];
    };
    limits: { timeoutMs: number; maxEvents: number; maxOutputBytes: number; maxCostUsd: number };
    workspace?: {
      sandboxId: string | null;
      source: string;
      repository: string | null;
      baseBranch: string;
      projectPath: string;
      previewOutputPath: string;
      preparedAt: string | null;
    } | null;
    metadata?: Record<string, unknown>;
  };
  result: OrchestrationResult | null;
  error: string | null;
  promotion: {
    provider?: string;
    branch?: string;
    pullRequestNumber?: number;
    pullRequestUrl?: string;
    promotedFiles?: Array<{ path: string; operation: string; commitSha: string }>;
  } | null;
  merge: Record<string, unknown> | null;
  acceptedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  promotedAt: string | null;
  mergedAt: string | null;
  updatedAt: string;
};

export type ProductAudit = {
  tenantId: string;
  jobId: string;
  verified: boolean;
  headHash: string;
  records: Array<{
    sequence: number;
    type: string;
    observedAt: string;
    source: string;
    payload: Record<string, unknown>;
    previousHash: string;
    hash: string;
  }>;
};

export async function getProductRuntime(): Promise<ProductRuntime> {
  const [health, agents, sandboxes] = await Promise.all([
    getJson<{ githubAppConfigured: boolean; executionBoundary: string; trustModel: string }>("/health"),
    getJson<{ drivers: RuntimeDriver[] }>("/v1/drivers"),
    getJson<{ drivers: RuntimeDriver[] }>("/v1/sandboxes/drivers"),
  ]);
  return {
    githubAppConfigured: health.githubAppConfigured,
    executionBoundary: health.executionBoundary,
    trustModel: health.trustModel,
    agents: agents.drivers,
    sandboxes: sandboxes.drivers,
  };
}

export async function listProductWorkspaces(leadId: string) {
  return getJson<{ workspaces: ProductWorkspace[] }>(`/v1/workspaces?tenantId=${encodeURIComponent(leadId)}`);
}

export async function getProductWorkspace(leadId: string, workspaceId: string) {
  return getJson<{ workspace: ProductWorkspace }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}?tenantId=${encodeURIComponent(leadId)}`);
}

export async function saveProductWorkspace(leadId: string, input: Partial<ProductWorkspace> & { id?: string }) {
  const path = input.id ? `/v1/workspaces/${encodeURIComponent(input.id)}` : "/v1/workspaces";
  return signedPost<{ workspace: ProductWorkspace }>(path, {
    ...input,
    tenantId: leadId,
    organizationId: leadId,
    actor: { id: leadId, role: "engineer" },
  });
}

export async function connectProductGitHubWorkspace(leadId: string, workspaceId: string, input: { installationId: string; repository?: string; baseBranch?: string; projectPath?: string }) {
  return signedPost<{ workspace: ProductWorkspace; repositories: string[] }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/github`, {
    tenantId: leadId,
    actor: { id: leadId, role: "engineer" },
    ...input,
  });
}

export async function listProductSandboxes(leadId: string, workspaceId: string) {
  return getJson<{ sandboxes: ProductSandbox[] }>(`/v1/sandboxes?tenantId=${encodeURIComponent(leadId)}&workspaceId=${encodeURIComponent(workspaceId)}`);
}

export async function provisionProductSandbox(leadId: string, workspaceId: string, input: Record<string, unknown> = {}) {
  return signedPost<{ workspace: ProductWorkspace; sandbox: ProductSandbox }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/sandboxes`, {
    tenantId: leadId,
    actor: { id: leadId, role: "engineer" },
    ...input,
  });
}

export async function prepareProductWorkspace(leadId: string, workspaceId: string, sandboxId?: string) {
  return signedPost<{ workspace: ProductWorkspace; sandbox: ProductSandbox; prepared: ProductWorkspace["prepared"] }>(`/v1/workspaces/${encodeURIComponent(workspaceId)}/prepare`, {
    tenantId: leadId,
    actor: { id: leadId, role: "engineer" },
    sandboxId,
  });
}

export async function destroyProductSandbox(leadId: string, sandboxId: string) {
  return signedPost<{ workspace: ProductWorkspace | null; sandbox: ProductSandbox }>(`/v1/sandboxes/${encodeURIComponent(sandboxId)}/destroy`, {
    tenantId: leadId,
    actor: { id: leadId, role: "admin" },
  });
}

export async function createProductJob(leadId: string, input: { workspaceId: string; scenario: OrchestrationScenario; intent: string }) {
  const { workspace } = await getProductWorkspace(leadId, input.workspaceId);
  if (!workspace.sandbox.activeSandboxId || !workspace.prepared) throw new Error("Provision and prepare the workspace sandbox before starting the run.");
  const agent = workspace.agent.driverId;
  const secretRefs = agent === "openai-codex"
    ? { CODEX_API_KEY: workspace.agent.secretRef || "env://CODEX_API_KEY" }
    : agent === "claude-agent"
      ? { ANTHROPIC_API_KEY: workspace.agent.secretRef || "env://ANTHROPIC_API_KEY" }
      : {};
  return signedPost<{ job: ProductJob }>("/v1/jobs", {
    tenantId: leadId,
    organizationId: leadId,
    engagementId: workspace.id,
    actor: { id: leadId, role: "engineer" },
    scenario: input.scenario,
    intent: input.intent,
    repository: workspace.repository.fullName || workspace.repository.url,
    baseBranch: workspace.repository.baseBranch,
    driverId: agent,
    sandboxId: workspace.sandbox.activeSandboxId,
    sourceControlId: workspace.repository.connected ? "github-app" : "promotion-package",
    requiredApprovals: workspace.approvals.filter((approval) => approval.required).map((approval) => approval.key),
    policy: {
      humanApprovalRequired: true,
      networkAccess: workspace.sandbox.networkPolicy,
      secretAccess: Object.keys(secretRefs).length ? "brokered-short-lived" : "none",
      allowedTools: ["Read", "Edit", "Bash"],
      allowedCommands: [],
    },
    limits: {
      timeoutMs: workspace.sandbox.timeoutSeconds * 1000,
      maxEvents: 10_000,
      maxOutputBytes: 32 * 1024 * 1024,
      maxCostUsd: 10,
    },
    secretRefs,
    workspace: {
      sandboxId: workspace.sandbox.activeSandboxId,
      source: workspace.prepared.source,
      repository: workspace.prepared.repository,
      baseBranch: workspace.prepared.baseBranch,
      repositoryRoot: workspace.prepared.repositoryRoot,
      mountPath: workspace.prepared.mountPath,
      projectPath: workspace.prepared.projectPath,
      previewOutputPath: workspace.preview.outputPath,
      preparedAt: workspace.prepared.preparedAt,
    },
    metadata: {
      workspaceId: workspace.id,
      githubInstallationId: workspace.github.installationId,
      approvalLabels: Object.fromEntries(workspace.approvals.map((approval) => [approval.key, approval.label])),
    },
  });
}

export async function getProductJob(leadId: string, jobId: string) {
  return getJson<{ job: ProductJob }>(`/v1/jobs/${encodeURIComponent(jobId)}?tenantId=${encodeURIComponent(leadId)}`);
}

export async function getProductAudit(leadId: string, jobId: string) {
  return getJson<ProductAudit>(`/v1/jobs/${encodeURIComponent(jobId)}/audit?tenantId=${encodeURIComponent(leadId)}`);
}

export async function recordProductApproval(leadId: string, jobId: string, input: { approvalKey: string; decision: "approve" | "reject"; comment?: string }) {
  return signedPost<{ job: ProductJob }>(`/v1/jobs/${encodeURIComponent(jobId)}/approvals`, {
    tenantId: leadId,
    actor: { id: `${leadId}-approver`, role: "approver" },
    approvalKey: input.approvalKey,
    decision: input.decision,
    comment: input.comment || "Recorded in the gated product workspace.",
  });
}

export async function promoteProductJob(leadId: string, jobId: string, workspaceId: string) {
  const { workspace } = await getProductWorkspace(leadId, workspaceId);
  if (!workspace.github.installationId || !workspace.repository.connected) throw new Error("Connect GitHub and select a repository before promotion.");
  return signedPost<{ job: ProductJob; promotion: ProductJob["promotion"] }>(`/v1/jobs/${encodeURIComponent(jobId)}/promote/github`, {
    tenantId: leadId,
    actor: { id: `${leadId}-promoter`, role: "admin" },
    installationId: workspace.github.installationId,
    repository: workspace.repository.fullName,
    baseBranch: workspace.repository.baseBranch,
    draft: workspace.production.createDraftPullRequest,
  });
}
