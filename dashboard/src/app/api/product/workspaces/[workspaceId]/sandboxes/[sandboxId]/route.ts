import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import { destroyProductSandbox, publicProductWorkspace } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: NextRequest, context: { params: Promise<{ workspaceId: string; sandboxId: string }> }) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { workspaceId, sandboxId } = await context.params;
  if (!/^ws-[a-z0-9-]{8,40}$/.test(workspaceId) || !/^sbx-[a-z0-9-]{8,40}$/.test(sandboxId)) {
    return NextResponse.json({ error: "Invalid workspace or sandbox ID." }, { status: 400 });
  }
  try {
    const result = await destroyProductSandbox(access.leadId, sandboxId);
    return NextResponse.json({ ...result, workspace: result.workspace ? publicProductWorkspace(result.workspace) : null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sandbox could not be destroyed." }, { status: 502 });
  }
}
