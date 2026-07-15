import type { Metadata } from "next";
import { PublicPage } from "@/components/marketing/PublicChrome";
import { PlatformDemo } from "@/components/platform/PlatformDemo";
import { ControlPlanePrinciples } from "@/components/platform/ControlPlanePrinciples";
import { ExecutionPlaneStatus } from "@/components/platform/ExecutionPlaneStatus";

export const metadata: Metadata = {
  title: "Integration Orchestrator",
  description:
    "See how FDE-Toolkit connects customer-approved coding agents, sandbox environments, source control, evidence, approvals, and production promotion.",
  openGraph: {
    title: "FDE-Toolkit Integration Orchestrator",
    description:
      "One governed delivery layer across coding agents, sandbox platforms, source control, approvals, and reusable delivery knowledge.",
    url: "/platform",
  },
};

export default function PlatformPage() {
  return (
    <PublicPage>
      <ExecutionPlaneStatus />
      <PlatformDemo />
      <ControlPlanePrinciples />
    </PublicPage>
  );
}
