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
  if (!access) return <ProductAccessGate />;

  return (
    <div className="relative">
      <a
        href="/platform/agentforce"
        className="fixed bottom-6 right-6 z-50 rounded-full border border-blue-200 bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-blue-950/20 transition hover:bg-blue-700"
      >
        Open Agentforce workspace
      </a>
      <FDEProductWorkspaceV2 />
    </div>
  );
}
