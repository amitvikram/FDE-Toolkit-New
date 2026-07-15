import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ProductAccessGate } from "@/components/platform/ProductAccessGate";
import { FDEProductWorkspace } from "@/components/platform/FDEProductWorkspace";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Product Workspace",
  description:
    "Private FDE-Toolkit workspace for creating governed delivery jobs, inspecting generated products and evidence, recording approvals, and reviewing promotion readiness.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function PlatformPage() {
  const cookieStore = await cookies();
  const access = verifyProductAccessToken(
    cookieStore.get(PRODUCT_ACCESS_COOKIE)?.value,
  );

  return access ? <FDEProductWorkspace /> : <ProductAccessGate />;
}
