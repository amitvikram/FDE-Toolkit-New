import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import { promoteProductJob } from "@/lib/orchestration/platform-client";
import { publicProductJob } from "@/lib/public-product-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ workspaceId: z.string().regex(/^ws-[a-z0-9-]{8,40}$/) });

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { jobId } = await context.params;
  if (!/^fdejob-[a-z0-9-]{8,40}$/.test(jobId)) return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "A valid workspace is required." }, { status: 400 });
  try {
    const result = await promoteProductJob(access.leadId, jobId, parsed.data.workspaceId);
    return NextResponse.json({ ...result, job: publicProductJob(result.job) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The pull request could not be created." }, { status: 502 });
  }
}
