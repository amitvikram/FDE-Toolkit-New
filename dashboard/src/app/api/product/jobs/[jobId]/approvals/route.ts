import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";
import { recordProductApproval } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approvalSchema = z.object({
  approvalKey: z.string().trim().min(1).max(250),
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().max(2000).optional().default(""),
});

function validJobId(value: string) {
  return /^fdejob-[a-z0-9-]{8,40}$/.test(value);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> },
) {
  const access = verifyProductAccessToken(
    request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value,
  );
  if (!access) {
    return NextResponse.json(
      { error: "Product access is required." },
      { status: 401 },
    );
  }

  const { jobId } = await context.params;
  if (!validJobId(jobId)) {
    return NextResponse.json({ error: "Invalid job ID." }, { status: 400 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = approvalSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A valid approval decision is required." },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await recordProductApproval(access.leadId, jobId, parsed.data),
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The approval could not be recorded.",
      },
      { status: 502 },
    );
  }
}
