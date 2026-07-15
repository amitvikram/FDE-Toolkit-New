import { NextRequest, NextResponse } from "next/server";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";
import { getProductJob } from "@/lib/orchestration/platform-client";
import { publicProductJob } from "@/lib/public-product-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validJobId(value: string) {
  return /^fdejob-[a-z0-9-]{8,40}$/.test(value);
}

export async function GET(
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

  try {
    const result = await getProductJob(access.leadId, jobId);
    return NextResponse.json({ job: publicProductJob(result.job) });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "The job could not be loaded.",
      },
      { status: 502 },
    );
  }
}
