import { NextResponse } from "next/server";
import { providerCatalog } from "@/lib/orchestration/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    contractVersion: "2026-07-01",
    catalog: providerCatalog,
  });
}
