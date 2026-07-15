import { NextResponse } from "next/server";
import { executionPlaneHealth } from "@/lib/orchestration/execution-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const executionPlane = await executionPlaneHealth();
    return NextResponse.json({
      status: "connected",
      controlPlane: "fde-toolkit",
      executionPlane,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "disconnected",
        error: error instanceof Error ? error.message : "Execution plane is unavailable.",
      },
      { status: 503 },
    );
  }
}
