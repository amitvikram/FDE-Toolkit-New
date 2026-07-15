import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dispatchExecutionJob } from "@/lib/orchestration/execution-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  scenario: z.enum(["enterprise-ai", "saas-design-partner", "si-delivery"]),
  clientAsk: z.string().trim().min(20).max(1500),
  repository: z.string().trim().max(300).optional().default(""),
  baseBranch: z.string().trim().max(100).optional().default("main"),
  codingAgentId: z.string().trim(),
  sandboxId: z.string().trim(),
  sourceControlId: z.string().trim(),
  approvalMode: z.literal("human-required"),
});

export async function POST(request: NextRequest) {
  if (process.env.FDE_DEMO_ENABLED === "false") {
    return NextResponse.json(
      { error: "The public orchestration demo is disabled for this deployment." },
      { status: 503 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Please provide a specific client ask of at least 20 characters.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  if (
    input.codingAgentId !== "fde-demo-agent" ||
    input.sandboxId !== "local-ephemeral" ||
    input.sourceControlId !== "promotion-package"
  ) {
    return NextResponse.json(
      {
        error:
          "That driver is published but not configured in this demo. Select the FDE demo agent, local ephemeral sandbox, and PR promotion package.",
      },
      { status: 409 },
    );
  }

  try {
    const result = await dispatchExecutionJob(input);
    return NextResponse.json({ contractVersion: "2026-07-15", result });
  } catch (error) {
    console.error("Control plane could not dispatch execution:", error);
    const message = error instanceof Error ? error.message : "The execution plane could not complete the run.";
    return NextResponse.json(
      {
        error: `Execution plane unavailable or rejected the job. ${message}`,
      },
      { status: 502 },
    );
  }
}
