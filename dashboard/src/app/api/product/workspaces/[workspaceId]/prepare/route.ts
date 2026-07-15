import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import { prepareProductWorkspace, publicProductWorkspace } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ sandboxId: z.string().trim().max(120).optional() });

export async function POST(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!/^ws-[a-z0-9-]{8,40}$/.test(workspaceId)) return NextResponse.json({ error: "Invalid workspace ID." }, { status: 400 });
  let payload: unknown = {};
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Invalid sandbox selection." }, { status: 400 });
  try {
    const result = await prepareProductWorkspace(access.leadId, workspaceId, parsed.data.sandboxId);
    const workspace = publicProductWorkspace(result.workspace);
    return NextResponse.json({ workspace, sandbox: result.sandbox, prepared: workspace.prepared });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Repository could not be prepared." }, { status: 502 });
  }
}
