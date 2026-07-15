import type { ProviderCatalog } from "@/lib/orchestration/types";

export const providerCatalog: ProviderCatalog = {
  codingAgents: [
    {
      id: "fde-demo-agent",
      kind: "coding-agent",
      name: "FDE deterministic demo agent",
      vendor: "FDE-Toolkit",
      status: "demo-ready",
      description:
        "Generates a small workflow application, tests, evidence, and a promotion package without external credentials.",
      deploymentModes: ["In-process Node.js", "Docker"],
      capabilities: ["Structured code generation", "Acceptance evidence", "PR package generation"],
      requirements: ["No API key"],
      enterpriseBoundary:
        "Demonstration only. It does not clone customer repositories or execute model-generated shell commands.",
    },
    {
      id: "openai-codex",
      kind: "coding-agent",
      name: "OpenAI Codex",
      vendor: "OpenAI",
      status: "adapter-ready",
      description:
        "Connect Codex through an approved CLI, API, or customer-hosted execution gateway.",
      deploymentModes: ["Customer VPC", "Managed agent service", "Developer workstation"],
      capabilities: ["Repository reasoning", "Code changes", "Tests and review artifacts"],
      requirements: ["Customer-approved authentication", "Agent gateway or runner"],
      enterpriseBoundary:
        "Credentials and repository access remain inside the customer-approved execution boundary.",
    },
    {
      id: "anthropic-claude-agent",
      kind: "coding-agent",
      name: "Claude Agent",
      vendor: "Anthropic",
      status: "adapter-ready",
      description:
        "Connect an Anthropic-powered coding agent through the Claude Agent SDK and a controlled customer-hosted runner.",
      deploymentModes: ["Customer VPC", "Developer workstation", "Managed runner"],
      capabilities: ["Repository analysis", "Code editing", "Test execution"],
      requirements: ["Customer-approved authentication", "Allowlisted tool policy"],
      enterpriseBoundary:
        "FDE-Toolkit sends a governed job envelope; the coding session stays in the approved runner.",
    },
    {
      id: "cursor",
      kind: "coding-agent",
      name: "Cursor",
      vendor: "Cursor",
      status: "adapter-ready",
      description:
        "Connect Cursor background or customer-operated agents through the standard job contract.",
      deploymentModes: ["Customer organization", "Managed background agent", "Developer workstation"],
      capabilities: ["Code changes", "Repository context", "Review-ready output"],
      requirements: ["Customer organization access", "Connector-supported execution mode"],
      enterpriseBoundary:
        "The customer controls repository permissions and the execution environment used by Cursor.",
    },
    {
      id: "customer-agent-webhook",
      kind: "coding-agent",
      name: "Customer coding agent",
      vendor: "Customer managed",
      status: "adapter-ready",
      description:
        "A vendor-neutral webhook contract for an internal coding agent, SI accelerator, or approved third-party tool.",
      deploymentModes: ["Customer VPC", "Private cloud", "On-premises"],
      capabilities: ["Custom tools", "Internal models", "Organization-specific controls"],
      requirements: ["HTTPS job endpoint", "Signed requests", "Status callback or polling endpoint"],
      enterpriseBoundary:
        "Code, credentials, data, and execution can remain fully inside the customer environment.",
    },
  ],
  sandboxes: [
    {
      id: "local-ephemeral",
      kind: "sandbox",
      name: "Local ephemeral workspace",
      vendor: "FDE-Toolkit",
      status: "demo-ready",
      description:
        "Creates a temporary filesystem workspace inside the application container and runs fixed Node.js tests.",
      deploymentModes: ["Docker", "Local Node.js"],
      capabilities: ["Ephemeral files", "Fixed test execution", "Evidence collection"],
      requirements: ["Writable temporary directory", "Node.js runtime"],
      enterpriseBoundary:
        "Demonstration only. This is process-level separation, not a production security sandbox.",
    },
    {
      id: "docker-engine",
      kind: "sandbox",
      name: "Docker Engine",
      vendor: "Customer managed",
      status: "adapter-ready",
      description:
        "Provision one isolated container per engagement using a customer-approved image and policy profile.",
      deploymentModes: ["Developer laptop", "Customer VM", "Private cloud"],
      capabilities: ["Image pinning", "Resource limits", "Network controls", "Disposable workspaces"],
      requirements: ["Docker API gateway", "Approved base images", "Runtime policy"],
      enterpriseBoundary:
        "The customer owns the host, images, network policy, and credential injection model.",
    },
    {
      id: "kubernetes",
      kind: "sandbox",
      name: "Kubernetes jobs or pods",
      vendor: "Customer managed",
      status: "adapter-ready",
      description:
        "Provision bounded namespaces, jobs, or pods inside the customer's approved Kubernetes platform.",
      deploymentModes: ["EKS", "AKS", "GKE", "OpenShift", "On-premises Kubernetes"],
      capabilities: ["Namespace isolation", "Pod security", "Quotas", "Private networking"],
      requirements: ["Kubernetes service account", "Approved workload template", "Policy enforcement"],
      enterpriseBoundary:
        "Data residency, networking, secrets, and workload policy remain under customer control.",
    },
    {
      id: "managed-sandbox",
      kind: "sandbox",
      name: "Managed sandbox provider",
      vendor: "E2B, Modal, Cloudflare, or equivalent",
      status: "adapter-ready",
      description:
        "Use an approved managed execution provider behind the same FDE-Toolkit sandbox contract.",
      deploymentModes: ["Managed cloud"],
      capabilities: ["Fast provisioning", "Disposable environments", "API-driven execution"],
      requirements: ["Provider account", "API key", "Data-processing approval"],
      enterpriseBoundary:
        "Use only when the provider, region, data handling, and network controls are approved by the customer.",
    },
    {
      id: "customer-sandbox-webhook",
      kind: "sandbox",
      name: "Customer sandbox service",
      vendor: "Customer managed",
      status: "adapter-ready",
      description:
        "A generic provisioning contract for internal platforms, secure build farms, VDI, or bespoke execution systems.",
      deploymentModes: ["Customer VPC", "Private cloud", "On-premises"],
      capabilities: ["Custom isolation", "Internal images", "Enterprise policy integration"],
      requirements: ["Provision endpoint", "Workspace status endpoint", "Signed callbacks"],
      enterpriseBoundary:
        "FDE-Toolkit orchestrates metadata while the customer platform owns the actual runtime boundary.",
    },
  ],
  sourceControl: [
    {
      id: "promotion-package",
      kind: "source-control",
      name: "Reviewable PR promotion package",
      vendor: "FDE-Toolkit",
      status: "demo-ready",
      description:
        "Produces a branch name, commit message, PR body, changed-file manifest, tests, and approval evidence.",
      deploymentModes: ["Any source-control platform"],
      capabilities: ["PR metadata", "Evidence attachment", "Human approval checkpoint"],
      requirements: ["No source-control token for the demo"],
      enterpriseBoundary:
        "The demo stops before pushing code. A configured source-control connector performs promotion later.",
    },
    {
      id: "github",
      kind: "source-control",
      name: "GitHub",
      vendor: "GitHub",
      status: "adapter-ready",
      description: "Create branches, commits, pull requests, checks, and review evidence through a GitHub App.",
      deploymentModes: ["GitHub.com", "GitHub Enterprise Server"],
      capabilities: ["Pull requests", "Checks", "Review policies", "Audit trail"],
      requirements: ["GitHub App installation", "Repository allowlist"],
      enterpriseBoundary: "Use least-privilege repository permissions and customer-controlled installation scope.",
    },
    {
      id: "gitlab",
      kind: "source-control",
      name: "GitLab",
      vendor: "GitLab",
      status: "adapter-ready",
      description: "Promote approved work into branches and merge requests with pipeline evidence.",
      deploymentModes: ["GitLab.com", "Self-managed GitLab"],
      capabilities: ["Merge requests", "Pipelines", "Approval rules"],
      requirements: ["Project token or OAuth application", "Project allowlist"],
      enterpriseBoundary: "The customer controls project scope, tokens, runners, and merge policy.",
    },
    {
      id: "azure-devops",
      kind: "source-control",
      name: "Azure DevOps Repos",
      vendor: "Microsoft",
      status: "adapter-ready",
      description: "Create branches and pull requests with Azure Pipelines and enterprise approval policies.",
      deploymentModes: ["Azure DevOps Services", "Azure DevOps Server"],
      capabilities: ["Pull requests", "Branch policies", "Pipelines"],
      requirements: ["Service connection or OAuth", "Repository allowlist"],
      enterpriseBoundary: "Promotion follows customer branch policies and service-connection controls.",
    },
    {
      id: "customer-scm-webhook",
      kind: "source-control",
      name: "Customer SCM gateway",
      vendor: "Customer managed",
      status: "adapter-ready",
      description: "A generic promotion endpoint for internal source-control and release-management platforms.",
      deploymentModes: ["Customer VPC", "On-premises"],
      capabilities: ["Custom approvals", "Internal ticket linkage", "Release controls"],
      requirements: ["Signed promotion endpoint", "Status callback"],
      enterpriseBoundary: "All repository writes remain behind the customer's own SCM gateway.",
    },
  ],
};
