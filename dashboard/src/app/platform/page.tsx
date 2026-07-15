import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProductAccessGate } from "@/components/platform/ProductAccessGate";
import { FDEProductWorkspaceV2 } from "@/components/platform/FDEProductWorkspaceV2";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "FDE Product Workspace",
  description:
    "Private code-to-production workspace for configuring repositories and sandboxes, running coding agents, releasing client previews, collecting approvals, and opening governed pull requests.",
  robots: { index: false, follow: false },
};

export default async function PlatformPage() {
  const cookieStore = await cookies();
  const access = verifyProductAccessToken(cookieStore.get(PRODUCT_ACCESS_COOKIE)?.value);
  return access ? <FDEProductWorkspaceV2 /> : <ProductAccessGate />;
}
