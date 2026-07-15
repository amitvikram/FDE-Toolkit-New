export type ProviderKind = "coding-agent" | "sandbox" | "source-control";
export type ProviderStatus = "demo-ready" | "adapter-ready" | "configured";

export type ProviderCatalogEntry = {
  id: string;
  kind: ProviderKind;
  name: string;
  vendor: string;
  status: ProviderStatus;
  description: string;
  deploymentModes: string[];
  capabilities: string[];
  requirements: string[];
  enterpriseBoundary: string;
};

export type OrchestrationScenario =
  | "enterprise-ai"
  | "saas-design-partner"
  | "si-delivery";

export type OrchestrationRequest = {
  scenario: OrchestrationScenario;
  clientAsk: string;
  repository?: string;
  baseBranch?: string;
  codingAgentId: string;
  sandboxId: string;
  sourceControlId: string;
  approvalMode: "human-required";
};

export type OrchestrationStep = {
  id: string;
  label: string;
  status: "completed" | "ready" | "blocked";
  detail: string;
  durationMs: number;
};

export type ChangedFile = {
  path: string;
  bytes: number;
  purpose: string;
};

export type PromotionPackage = {
  title: string;
  branchName: string;
  commitMessage: string;
  body: string;
  changedFiles: ChangedFile[];
  approvalsRequired: string[];
  evidence: string[];
  testSummary: string;
};

export type OrchestrationResult = {
  runId: string;
  scenario: OrchestrationScenario;
  clientAsk: string;
  providers: {
    codingAgent: string;
    sandbox: string;
    sourceControl: string;
  };
  policyProfile: {
    humanApprovalRequired: true;
    networkAccess: "disabled";
    arbitraryCommands: "disabled";
    secretsInjected: false;
    workspaceRetention: "ephemeral";
  };
  steps: OrchestrationStep[];
  cycleTimeMs: number;
  previewHtml: string;
  testOutput: string;
  promotionPackage: PromotionPackage;
  disclaimer: string;
};

export type ProviderCatalog = {
  codingAgents: ProviderCatalogEntry[];
  sandboxes: ProviderCatalogEntry[];
  sourceControl: ProviderCatalogEntry[];
};
