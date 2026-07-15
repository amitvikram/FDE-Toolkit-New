import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import {
  listProductWorkspaces,
  publicProductWorkspace,
  saveProductWorkspace,
} from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const workspaceSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().default(""),
  repository: z.object({
    fullName: z.string().trim().max(240).optional().default("amitvikram/FDE-Toolkit-New"),
    url: z.string().trim().max(500).optional().default("https://github.com/amitvikram/FDE-Toolkit-New"),
    baseBranch: z.string().trim().min(1).max(120).optional().default("main"),
    projectPath: z.string().trim().max(300).optional().default("examples/client-review-portal"),
    connected: z.boolean().optional().default(false),
  }).optional(),
  agent: z.object({
    driverId: z.enum(["fde-demo-agent", "openai-codex", "claude-agent", "cursor-agent", "customer-agent-gateway"]).optional(),
    model: z.string().trim().max(120).nullable().optional(),
    secretRef: z.string().trim().max(300).optional(),
  }).optional(),
  sandbox: z.object({
    driverId: z.enum(["local-ephemeral", "docker-local", "kubernetes-job"]).optional(),
    image: z.string().trim().max(240).optional(),
    cpu: z.number().min(0.1).max(32).optional(),
    memoryMb: z.number().int().min(128).max(131072).optional(),
    workspaceSizeMb: z.number().int().min(64).max(262144).optional(),
    timeoutSeconds: z.number().int().min(60).max(86400).optional(),
    networkPolicy: z.enum(["disabled", "allowlisted", "enabled"]).optional(),
    namespace: z.string().trim().max(120).optional(),
  }).optional(),
  preview: z.object({
    buildCommand: z.string().trim().max(500).optional(),
    startCommand: z.string().trim().max(500).optional(),
    outputPath: z.string().trim().min(1).max(300).optional(),
    port: z.number().int().min(1).max(65535).optional(),
    healthPath: z.string().trim().max(200).optional(),
  }).optional(),
  approvals: z.array(z.object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    role: z.string().trim().min(1).max(80),
    required: z.boolean(),
  })).min(1).max(12).optional(),
  production: z.object({
    createDraftPullRequest: z.boolean().optional(),
    requirePassingTests: z.boolean().optional(),
    requireSecurityEvidence: z.boolean().optional(),
    environments: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  }).optional(),
});

type WorkspaceCreateInput = Parameters<typeof saveProductWorkspace>[1];

function access(request: NextRequest) {
  return verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
}

export async function GET(request: NextRequest) {
  const session = access(request);
  if (!session) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  try {
    const result = await listProductWorkspaces(session.leadId);
    return NextResponse.json({ workspaces: result.workspaces.map(publicProductWorkspace) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspaces could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  const session = access(request);
  if (!session) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = workspaceSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Workspace settings are invalid.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const result = await saveProductWorkspace(
      session.leadId,
      parsed.data as unknown as WorkspaceCreateInput,
    );
    return NextResponse.json({ workspace: publicProductWorkspace(result.workspace) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace could not be created." }, { status: 502 });
  }
}
