import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AgentforceImplementationWorkspace } from "@/components/agentforce/AgentforceImplementationWorkspace";
import { ProductAccessGate } from "@/components/platform/ProductAccessGate";
import {
  PRODUCT_ACCESS_COOKIE,
  verifyProductAccessToken,
} from "@/lib/product-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Agentforce Implementation Workspace",
  description:
    "A governed FDE workspace for designing, testing, reviewing, and promoting source-driven Agentforce implementations on Salesforce.",
  robots: { index: false, follow: false },
};

export default async function AgentforcePlatformPage() {
  const cookieStore = await cookies();
  const access = verifyProductAccessToken(
    cookieStore.get(PRODUCT_ACCESS_COOKIE)?.value,
  );

  return access ? <AgentforceImplementationWorkspace /> : <ProductAccessGate />;
}
