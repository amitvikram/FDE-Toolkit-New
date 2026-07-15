import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import {
  getProductWorkspace,
  publicProductWorkspace,
  saveProductWorkspace,
} from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  repository: z.object({
    fullName: z.string().trim().max(240).optional(),
    url: z.string().trim().max(500).optional(),
    baseBranch: z.string().trim().min(1).max(120).optional(),
    projectPath: z.string().trim().max(300).optional(),
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

function validWorkspaceId(value: string) {
  return /^ws-[a-z0-9-]{8,40}$/.test(value);
}

function access(request: NextRequest) {
  return verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
}

export async function GET(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const session = access(request);
  if (!session) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!validWorkspaceId(workspaceId)) return NextResponse.json({ error: "Invalid workspace ID." }, { status: 400 });
  try {
    const result = await getProductWorkspace(session.leadId, workspaceId);
    return NextResponse.json({ workspace: publicProductWorkspace(result.workspace) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace could not be loaded." }, { status: 502 });
  }
}

export async function PUT(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const session = access(request);
  if (!session) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!validWorkspaceId(workspaceId)) return NextResponse.json({ error: "Invalid workspace ID." }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = updateSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Workspace settings are invalid.", details: parsed.error.flatten() }, { status: 400 });
  try {
    const current = await getProductWorkspace(session.leadId, workspaceId);
    const result = await saveProductWorkspace(session.leadId, {
      ...current.workspace,
      ...parsed.data,
      id: workspaceId,
      repository: { ...current.workspace.repository, ...parsed.data.repository },
      agent: { ...current.workspace.agent, ...parsed.data.agent },
      sandbox: { ...current.workspace.sandbox, ...parsed.data.sandbox },
      preview: { ...current.workspace.preview, ...parsed.data.preview },
      production: { ...current.workspace.production, ...parsed.data.production },
    });
    return NextResponse.json({ workspace: publicProductWorkspace(result.workspace) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Workspace could not be saved." }, { status: 502 });
  }
}
