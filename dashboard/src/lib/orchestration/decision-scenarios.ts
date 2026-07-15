import type { OrchestrationScenario } from "@/lib/orchestration/types";

export type DecisionMetric = {
  label: string;
  baseline: string;
  target: string;
  note: string;
};

export type DecisionScenario = {
  id: OrchestrationScenario;
  shortLabel: string;
  organization: string;
  industry: string;
  sponsor: string;
  headline: string;
  trigger: string;
  clientAsk: string;
  repository: string;
  boardroomQuestion: string;
  riskToday: string;
  decisionReady: string;
  modeledOutcome: string;
  reusableAsset: string;
  approvedStack: [string, string, string];
  metrics: DecisionMetric[];
  approvalQuestions: string[];
};

export const decisionScenarios: Record<OrchestrationScenario, DecisionScenario> = {
  "enterprise-ai": {
    id: "enterprise-ai",
    shortLabel: "Bank risk workflow",
    organization: "Northstar Bank",
    industry: "Financial services",
    sponsor: "COO · Chief Risk Officer · Head of AI",
    headline: "A bank needs a governed exception-review workflow before its next audit.",
    trigger:
      "Reviewers are triaging payment exceptions across email, spreadsheets, policy PDFs, and a legacy case system. Evidence is detached from the final decision.",
    clientAsk:
      "Create one governed payment-exception review screen showing the exception reason, linked policy evidence, confidence, recommended action, and a human-owned final disposition. Every decision must retain an audit trail and promotion must stop until risk, workflow, and engineering owners approve it.",
    repository: "https://github.com/northstar-bank/operations-workbench",
    boardroomQuestion:
      "Can we shorten exception handling without allowing an AI agent to make or obscure a regulated decision?",
    riskToday: "Slow reviews, fragmented evidence, inconsistent escalation, and audit reconstruction work.",
    decisionReady:
      "A working reviewer experience, observed test evidence, explicit approval gates, and a reviewable PR package.",
    modeledOutcome:
      "Move from a multi-week prototype cycle toward an approved PR in under 48 hours while preserving human accountability.",
    reusableAsset: "Governed exception-review workflow pattern",
    approvedStack: ["Client-approved coding agent", "Bank VPC execution plane", "GitHub Enterprise"],
    metrics: [
      {
        label: "Ask → approved PR",
        baseline: "15 business days",
        target: "<48 hours",
        note: "North-star pilot target, not an achieved claim.",
      },
      {
        label: "Decision evidence",
        baseline: "Email + folders",
        target: "100% linked",
        note: "Ask, files, tests, commands, and approvals share one run ID.",
      },
      {
        label: "Approval handoffs",
        baseline: "Ad hoc",
        target: "3 named gates",
        note: "Workflow, risk, and engineering retain decision authority.",
      },
    ],
    approvalQuestions: [
      "Does the workflow preserve the regulated human decision?",
      "Is evidence sufficient for risk and audit review?",
      "Can engineering promote this change under existing branch policies?",
    ],
  },
  "saas-design-partner": {
    id: "saas-design-partner",
    shortLabel: "Strategic SaaS request",
    organization: "AtlasCloud",
    industry: "Enterprise SaaS",
    sponsor: "CPO · CTO · Chief Customer Officer",
    headline: "A strategic customer requests approval routing weeks before renewal.",
    trigger:
      "The customer needs region- and amount-based approvals. Sales wants a commitment, engineering fears a one-off fork, and product lacks a governed way to classify the request.",
    clientAsk:
      "Prototype configurable approval routing for a strategic enterprise customer. Classify each requirement as core product, tenant configuration, extension, delivery artifact, or contained exception. Preserve the customer ask, product decision, architecture evidence, tests, and required approvals in the promotion package.",
    repository: "https://github.com/atlascloud/core-platform",
    boardroomQuestion:
      "Can we protect the renewal and learn from the customer without creating permanent product entropy?",
    riskToday: "A rushed fork can win one renewal while increasing support cost and slowing the roadmap for every tenant.",
    decisionReady:
      "A working design-partner prototype plus an explicit core-versus-configuration product decision.",
    modeledOutcome:
      "Give product, architecture, and engineering a reviewable answer in days rather than allowing the request to drift for weeks.",
    reusableAsset: "Design-partner productization decision pattern",
    approvedStack: ["Approved coding platform", "Isolated tenant sandbox", "Product repository PR"],
    metrics: [
      {
        label: "Request → product decision",
        baseline: "2–4 weeks",
        target: "<48 hours",
        note: "Target for a bounded design-partner workflow.",
      },
      {
        label: "Reuse classification",
        baseline: "Implicit",
        target: "Every artifact",
        note: "Core, configuration, extension, delivery asset, or exception.",
      },
      {
        label: "Customer approval",
        baseline: "Meeting notes",
        target: "Captured in run",
        note: "The client-approved behavior travels with the engineering package.",
      },
    ],
    approvalQuestions: [
      "Which capability belongs in the core product?",
      "What remains tenant configuration or an extension?",
      "Does the prototype satisfy the design partner without creating a fork?",
    ],
  },
  "si-delivery": {
    id: "si-delivery",
    shortLabel: "SI delivery factory",
    organization: "Vertex Consulting",
    industry: "Systems integration",
    sponsor: "Global Practice Leader · Delivery COO · Account Partner",
    headline: "An SI must deliver the same onboarding capability across twelve clients.",
    trigger:
      "Each engagement begins from a blank project, repeats discovery, recreates evidence, and loses reusable knowledge when the team rolls off.",
    clientAsk:
      "Create a repeatable supplier-onboarding delivery workspace for a twelve-country rollout. Capture the client ask, acceptance criteria, seeded configuration, validation evidence, client approvals, reusable artifacts, and promotion readiness. Keep each client execution isolated while returning governed reusable patterns to the practice library.",
    repository: "https://github.com/vertex-consulting/delivery-accelerators",
    boardroomQuestion:
      "Can we improve delivery margin and consistency without forcing every client onto the same agent, cloud, or source-control platform?",
    riskToday: "Margin leaks through repeated discovery, rework, approval gaps, and knowledge that leaves with the engagement team.",
    decisionReady:
      "A client-specific working flow, a promotion package, and a reusable governed artifact for the next engagement.",
    modeledOutcome:
      "Turn the first delivery into a reusable starting point and increase the share of engagements that begin from proven practice IP.",
    reusableAsset: "Multi-client onboarding evidence and promotion blueprint",
    approvedStack: ["Client-approved agent", "Client or SI execution plane", "Client SCM gateway"],
    metrics: [
      {
        label: "First working PR",
        baseline: "3–4 weeks",
        target: "<48 hours",
        note: "Target for a constrained workflow slice.",
      },
      {
        label: "Knowledge reuse",
        baseline: "Near zero",
        target: ">70% starts",
        note: "Modeled target for engagements beginning with a governed artifact.",
      },
      {
        label: "Client approvals",
        baseline: "Scattered",
        target: "Captured per run",
        note: "Business and technical approvals remain linked to delivery evidence.",
      },
    ],
    approvalQuestions: [
      "Did the client approve the behavior and acceptance evidence?",
      "Which artifacts can be reused without carrying client data?",
      "Is the package ready for the client’s engineering and release controls?",
    ],
  },
};

export const demoPhases = [
  "Capture the client ask",
  "Apply policy and tenancy",
  "Route to the approved execution plane",
  "Generate and test the candidate change",
  "Observe provenance at the driver boundary",
  "Prepare approvals and the PR decision brief",
] as const;
