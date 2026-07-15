import "server-only";

import { createHmac, randomUUID } from "node:crypto";
import type {
  OrchestrationResult,
  OrchestrationScenario,
} from "@/lib/orchestration/types";

const defaultExecutionPlaneUrl = "http://127.0.0.1:8787";

function configuration() {
  return {
    baseUrl: (process.env.FDE_EXECUTION_PLANE_URL || defaultExecutionPlaneUrl).replace(
      /\/$/,
      "",
    ),
    signingSecret:
      process.env.FDE_EXECUTION_SIGNING_SECRET ||
      "local-demo-signing-secret",
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
    signal: AbortSignal.timeout(30_000),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Execution plane rejected the request (${response.status}).`);
  }
  return payload;
}

async function getJson<T>(path: string) {
  const { baseUrl } = configuration();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Execution plane rejected the request (${response.status}).`);
  }
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
    limits: {
      timeoutMs: number;
      maxEvents: number;
      maxOutputBytes: number;
      maxCostUsd: number;
    };
  };
  result: OrchestrationResult | null;
  error: string | null;
  promotion: Record<string, unknown> | null;
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

export async function createProductJob(
  leadId: string,
  input: {
    scenario: OrchestrationScenario;
    intent: string;
    repository?: string;
    baseBranch?: string;
  },
) {
  return signedPost<{ job: ProductJob }>("/v1/jobs", {
    tenantId: leadId,
    organizationId: leadId,
    engagementId: input.scenario,
    actor: { id: leadId, role: "engineer" },
    scenario: input.scenario,
    intent: input.intent,
    repository: input.repository || null,
    baseBranch: input.baseBranch || "main",
    driverId: "fde-demo-agent",
    sandboxId: "local-ephemeral",
    sourceControlId: "promotion-package",
    policy: {
      humanApprovalRequired: true,
      networkAccess: "disabled",
      secretAccess: "none",
      allowedTools: ["Read", "Edit", "Bash"],
      allowedCommands: [],
    },
    limits: {
      timeoutMs: 60_000,
      maxEvents: 1_000,
      maxOutputBytes: 8 * 1024 * 1024,
      maxCostUsd: 1,
    },
  });
}

export async function getProductJob(leadId: string, jobId: string) {
  return getJson<{ job: ProductJob }>(
    `/v1/jobs/${encodeURIComponent(jobId)}?tenantId=${encodeURIComponent(leadId)}`,
  );
}

export async function getProductAudit(leadId: string, jobId: string) {
  return getJson<ProductAudit>(
    `/v1/jobs/${encodeURIComponent(jobId)}/audit?tenantId=${encodeURIComponent(leadId)}`,
  );
}

export async function recordProductApproval(
  leadId: string,
  jobId: string,
  input: {
    approvalKey: string;
    decision: "approve" | "reject";
    comment?: string;
  },
) {
  return signedPost<{ job: ProductJob }>(
    `/v1/jobs/${encodeURIComponent(jobId)}/approvals`,
    {
      tenantId: leadId,
      actor: { id: `${leadId}-approver`, role: "approver" },
      approvalKey: input.approvalKey,
      decision: input.decision,
      comment: input.comment || "Recorded in the gated product workspace.",
    },
  );
}
