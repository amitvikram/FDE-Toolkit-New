import type { Metadata } from "next";
import { PublicPage } from "@/components/marketing/PublicChrome";
import { GuidedExecutiveDemo } from "@/components/platform/GuidedExecutiveDemo";
import { ControlPlanePrinciples } from "@/components/platform/ControlPlanePrinciples";
import { ExecutionPlaneStatus } from "@/components/platform/ExecutionPlaneStatus";

export const metadata: Metadata = {
  title: "Guided Executive Demo",
  description:
    "Run a realistic enterprise, SaaS, or systems-integrator request, then inspect each governed milestone before opening the executive decision brief.",
  openGraph: {
    title: "FDE-Toolkit Guided Executive Demo",
    description:
      "See how a client ask becomes a governed engineering decision through a user-paced walkthrough of policy, execution, product proof, provenance, and approvals.",
    url: "/platform",
  },
};

export default function PlatformPage() {
  return (
    <PublicPage>
      <ExecutionPlaneStatus />
      <GuidedExecutiveDemo />
      <ControlPlanePrinciples />
    </PublicPage>
  );
}
