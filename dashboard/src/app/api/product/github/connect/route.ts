import { NextRequest, NextResponse } from "next/server";
import { PRODUCT_ACCESS_COOKIE, verifyProductAccessToken } from "@/lib/product-access";
import {
  PRODUCT_GITHUB_STATE_COOKIE,
  PRODUCT_GITHUB_STATE_TTL_SECONDS,
  issueGitHubState,
} from "@/lib/product-github-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = verifyProductAccessToken(request.cookies.get(PRODUCT_ACCESS_COOKIE)?.value);
  if (!access) return NextResponse.redirect(new URL("/platform", request.url));
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") || "";
  if (!/^ws-[a-z0-9-]{8,40}$/.test(workspaceId)) {
    return NextResponse.redirect(new URL("/platform?view=settings&github=invalid-workspace", request.url));
  }
  const slug = String(process.env.GITHUB_APP_SLUG || "").trim();
  if (!/^[A-Za-z0-9-]{1,100}$/.test(slug)) {
    return NextResponse.redirect(new URL(`/platform?view=settings&workspace=${encodeURIComponent(workspaceId)}&github=not-configured`, request.url));
  }
  const response = NextResponse.redirect(`https://github.com/apps/${slug}/installations/new`);
  response.cookies.set({
    name: PRODUCT_GITHUB_STATE_COOKIE,
    value: issueGitHubState(access.leadId, workspaceId),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PRODUCT_GITHUB_STATE_TTL_SECONDS,
  });
  return response;
}
