import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyClientPreviewToken } from "@/lib/client-preview-token";
import { getProductJob, recordProductApproval } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().max(2000).optional(),
});

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const release = verifyClientPreviewToken(token);
  if (!release) return NextResponse.json({ error: "This client review link is invalid or expired." }, { status: 401 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Choose approve or reject." }, { status: 400 });
  try {
    const { job } = await getProductJob(release.leadId, release.jobId);
    if (job.status !== "completed") throw new Error("This candidate is no longer available for approval.");
    if (!job.request.requiredApprovals.includes(release.approvalKey)) throw new Error("The client approval gate is no longer active.");
    const result = await recordProductApproval(release.leadId, release.jobId, {
      approvalKey: release.approvalKey,
      decision: parsed.data.decision,
      comment: `[Client review ${release.reviewId}] ${parsed.data.comment || "Decision recorded from the released preview."}`,
    });
    return NextResponse.json({ decision: parsed.data.decision, approvalStatus: result.job.approvalStatus });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The client decision could not be recorded." }, { status: 502 });
  }
}
