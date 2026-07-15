import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import {
  PRODUCT_GITHUB_STATE_COOKIE,
  verifyGitHubState,
} from "@/lib/product-github-state";
import {
  connectProductGitHubWorkspace,
  publicProductWorkspace,
} from "@/lib/orchestration/platform-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  const state = verifyGitHubState(request.cookies.get(PRODUCT_GITHUB_STATE_COOKIE)?.value);
  const installationId = request.nextUrl.searchParams.get("installation_id") || "";
  const fallback = new URL("/platform?view=settings&github=connection-failed", request.url);

  if (!access || !state || state.leadId !== access.leadId || !/^\d{1,30}$/.test(installationId)) {
    const response = NextResponse.redirect(fallback);
    response.cookies.delete(PRODUCT_GITHUB_STATE_COOKIE);
    return response;
  }

  try {
    const result = await connectProductGitHubWorkspace(access.leadId, state.workspaceId, { installationId });
    const url = new URL("/platform", request.url);
    url.searchParams.set("view", "settings");
    url.searchParams.set("workspace", state.workspaceId);
    url.searchParams.set("github", "connected");
    url.searchParams.set("repositories", String(result.repositories.length));
    const response = NextResponse.redirect(url);
    response.cookies.delete(PRODUCT_GITHUB_STATE_COOKIE);
    return response;
  } catch (error) {
    console.error("GitHub workspace connection failed:", error);
    const url = new URL("/platform", request.url);
    url.searchParams.set("view", "settings");
    url.searchParams.set("workspace", state.workspaceId);
    url.searchParams.set("github", "connection-failed");
    const response = NextResponse.redirect(url);
    response.cookies.delete(PRODUCT_GITHUB_STATE_COOKIE);
    return response;
  }
}
