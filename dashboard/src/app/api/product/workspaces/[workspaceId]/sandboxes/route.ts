import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import {
  listProductSandboxes,
  provisionProductSandbox,
  publicProductWorkspace,
} from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const provisionSchema = z.object({
  driverId: z.enum(["local-ephemeral", "docker-local", "kubernetes-job"]).optional(),
  image: z.string().trim().max(240).optional(),
  cpu: z.number().min(0.1).max(32).optional(),
  memoryMb: z.number().int().min(128).max(131072).optional(),
  workspaceSizeMb: z.number().int().min(64).max(262144).optional(),
  timeoutSeconds: z.number().int().min(60).max(86400).optional(),
  networkPolicy: z.enum(["disabled", "allowlisted", "enabled"]).optional(),
  namespace: z.string().trim().max(120).optional(),
  apply: z.boolean().optional(),
});

function session(request: NextRequest) {
  return verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
}

function valid(value: string) {
  return /^ws-[a-z0-9-]{8,40}$/.test(value);
}

export async function GET(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const access = session(request);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!valid(workspaceId)) return NextResponse.json({ error: "Invalid workspace ID." }, { status: 400 });
  try {
    return NextResponse.json(await listProductSandboxes(access.leadId, workspaceId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sandboxes could not be loaded." }, { status: 502 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const access = session(request);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!valid(workspaceId)) return NextResponse.json({ error: "Invalid workspace ID." }, { status: 400 });
  let payload: unknown = {};
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = provisionSchema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Sandbox settings are invalid." }, { status: 400 });
  try {
    const result = await provisionProductSandbox(access.leadId, workspaceId, parsed.data);
    return NextResponse.json({ ...result, workspace: publicProductWorkspace(result.workspace) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sandbox could not be provisioned." }, { status: 502 });
  }
}
