import { createHmac, randomUUID } from "node:crypto";
import type { OrchestrationRequest, OrchestrationResult } from "@/lib/orchestration/types";

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

export async function executionPlaneHealth() {
  const { baseUrl } = configuration();
  const response = await fetch(`${baseUrl}/health`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(4_000),
  });

  if (!response.ok) throw new Error(`Execution plane health check failed (${response.status}).`);
  return (await response.json()) as {
    status: "ok";
    service: string;
    executionBoundary: string;
    trustModel: string;
    contractVersion: string;
  };
}

export async function dispatchExecutionJob(input: OrchestrationRequest) {
  const { baseUrl } = configuration();
  const body = JSON.stringify(input);
  const response = await fetch(`${baseUrl}/v1/runs`, {
    method: "POST",
    headers: signedHeaders(body),
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });

  const payload = (await response.json()) as {
    error?: string;
    result?: OrchestrationResult;
    contractVersion?: string;
  };

  if (!response.ok || !payload.result) {
    throw new Error(payload.error || `Execution plane rejected the run (${response.status}).`);
  }

  return payload.result;
}
