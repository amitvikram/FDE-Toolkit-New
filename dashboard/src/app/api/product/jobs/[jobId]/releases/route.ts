import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import { issueClientPreviewToken } from "@/lib/client-preview-token";
import { getProductJob, getProductWorkspace } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  workspaceId: z.string().regex(/^ws-[a-z0-9-]{8,40}$/),
  reviewerName: z.string().trim().min(2).max(120),
  reviewerEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  approvalKey: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

export async function POST(request: NextRequest, context: { params: Promise<{ jobId: string }> }) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  const { jobId } = await context.params;
  if (!/^fdejob-[a-z0-9-]{8,40}$/.test(jobId)) return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  let payload: unknown;
  try { payload = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 }); }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) return NextResponse.json({ error: "Provide the client reviewer details." }, { status: 400 });

  try {
    const [{ job }, { workspace }] = await Promise.all([
      getProductJob(access.leadId, jobId),
      getProductWorkspace(access.leadId, parsed.data.workspaceId),
    ]);
    if (job.status !== "completed") throw new Error("The candidate must complete before it can be released for review.");
    if (!job.result?.previewHtml) throw new Error("This job does not have a client-reviewable preview.");
    const clientApproval = workspace.approvals.find((approval) => approval.required && (approval.role.includes("client") || approval.label.toLowerCase().includes("client"))) || workspace.approvals.find((approval) => approval.required);
    const approvalKey = parsed.data.approvalKey || clientApproval?.key;
    if (!approvalKey || !job.request.requiredApprovals.includes(approvalKey)) throw new Error("A client approval gate is not configured for this workspace.");

    const release = issueClientPreviewToken({ leadId: access.leadId, workspaceId: workspace.id, jobId, approvalKey });
    const reviewUrl = new URL(`/review/${encodeURIComponent(release.token)}`, request.url).toString();
    const email = parsed.data.reviewerEmail || "";
    let delivered = false;
    if (email && process.env.RESEND_API_KEY) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": release.payload.reviewId },
        body: JSON.stringify({
          from: process.env.INTEREST_FROM_EMAIL || "FDE-Toolkit <onboarding@resend.dev>",
          to: [email],
          reply_to: process.env.INTEREST_NOTIFICATION_EMAIL || "amitvik@gmail.com",
          subject: `Review requested: ${workspace.name}`,
          text: `${parsed.data.reviewerName},\n\nA working change is ready for your review.\n\n${parsed.data.message || "Please inspect the preview and record your decision."}\n\n${reviewUrl}\n\nThis link expires in 7 days.`,
          html: `<div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#0f172a"><h1 style="font-size:24px">A working change is ready for review</h1><p>Hello ${escapeHtml(parsed.data.reviewerName)},</p><p>${escapeHtml(parsed.data.message || "Please inspect the preview and record your decision.")}</p><p><a href="${escapeHtml(reviewUrl)}" style="display:inline-block;background:#0f172a;color:white;text-decoration:none;padding:12px 18px;border-radius:8px">Open client preview</a></p><p style="color:#64748b;font-size:12px">This signed link expires in 7 days.</p></div>`,
        }),
      });
      delivered = response.ok;
      if (!response.ok) console.error("Client preview email failed:", response.status, await response.text());
    }

    return NextResponse.json({
      release: {
        id: release.payload.reviewId,
        reviewUrl,
        approvalKey,
        reviewerName: parsed.data.reviewerName,
        reviewerEmail: email || null,
        delivered,
        expiresAt: new Date(release.payload.expiresAt * 1000).toISOString(),
      },
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The client preview could not be released." }, { status: 502 });
  }
}
