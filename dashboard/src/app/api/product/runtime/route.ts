import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import { getProductRuntime } from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.json({ error: "Product access is required." }, { status: 401 });
  try {
    return NextResponse.json(await getProductRuntime());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Runtime capabilities could not be loaded." }, { status: 502 });
  }
}
