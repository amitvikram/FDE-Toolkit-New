import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";
import { createProductJob } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const jobSchema = z.object({
  scenario: z.enum(["enterprise-ai", "saas-design-partner", "si-delivery"]),
  intent: z.string().trim().min(20).max(5000),
  repository: z.string().trim().max(500).optional().default(""),
  baseBranch: z.string().trim().min(1).max(120).optional().default("main"),
});

export async function POST(request: NextRequest) {
  const access = verifyProductAccessToken(
    request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value,
  );
  if (!access) {
    return NextResponse.json(
      { error: "Product access is required." },
      { status: 401 },
    );
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
  }

  const parsed = jobSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please provide a specific delivery request." },
      { status: 400 },
    );
  }

  try {
    const result = await createProductJob(access.leadId, parsed.data);
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    console.error("Product job creation failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The execution plane could not accept the job.",
      },
      { status: 502 },
    );
  }
}
