import type { Metadata } from "next";
import { PublicPage } from "@/components/marketing/PublicChrome";
import { ExecutiveDemo } from "@/components/platform/ExecutiveDemo";
import { ControlPlanePrinciples } from "@/components/platform/ControlPlanePrinciples";
import { ExecutionPlaneStatus } from "@/components/platform/ExecutionPlaneStatus";

export const metadata: Metadata = {
  title: "Executive Demo",
  description:
    "Watch a realistic enterprise, SaaS, or systems-integrator client request become a governed product proof, evidence package, approval decision, and reviewable PR package.",
  openGraph: {
    title: "FDE-Toolkit Executive Demo",
    description:
      "From a real client ask to a governed engineering decision—with business outcomes, human approvals, working product proof, and observed provenance.",
    url: "/platform",
  },
};

export default function PlatformPage() {
  return (
    <PublicPage>
      <ExecutionPlaneStatus />
      <ExecutiveDemo />
      <ControlPlanePrinciples />
    </PublicPage>
  );
}
