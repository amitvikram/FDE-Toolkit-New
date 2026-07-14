export type InsightSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export type Insight = {
  slug: string;
  title: string;
  dek: string;
  category: string;
  readingTime: string;
  linkedinHook: string;
  sections: InsightSection[];
};

export const insights: Insight[] = [
  {
    slug: "the-48-hour-pr",
    title: "The 48-Hour PR: A Better North Star for Forward-Deployed Engineering",
    dek: "Measure the complete path from a client request to an approved, merged pull request, not the speed of an isolated AI demo.",
    category: "Operating model",
    readingTime: "7 min read",
    linkedinHook:
      "AI can generate code in minutes. Enterprise delivery still takes weeks. The missing metric is the time from client ask to approved, merged PR.",
    sections: [
      {
        heading: "Fast code is not the same as fast delivery",
        paragraphs: [
          "Most AI development demonstrations measure the time required to produce code. That is useful, but it ignores the work that dominates enterprise delivery: understanding the request, preserving constraints, validating the workflow, capturing approval, and moving a safe change through engineering review.",
          "A team can produce a prototype in an afternoon and still spend three weeks translating it into tickets, reconstructing decisions, resolving security questions, and persuading engineering that the change is supportable. The bottleneck is not typing. It is the chain of trust between the client request and the production change.",
        ],
      },
      {
        heading: "The North Star",
        paragraphs: [
          "A more meaningful operating metric is median time from client ask to merged, approved pull request. The clock begins when a client or business user makes a concrete workflow request. It stops only when the resulting change has been reviewed, approved, and merged into the governed engineering process.",
          "For a forward-deployed delivery platform, an ambitious target is under 48 hours compared with a typical two-to-four-week baseline. The target is not achieved by bypassing controls. It is achieved by carrying context, evidence, approvals, and reusable artifacts through one continuous workflow.",
        ],
      },
      {
        heading: "What has to change operationally",
        paragraphs: [
          "Reaching a 48-hour cycle requires more than a coding agent. The delivery system must preserve the original client language, connect it to the working experiment, capture every material decision, and produce an engineering artifact that reviewers can trust.",
        ],
        bullets: [
          "Start from a governed product or solution baseline rather than a blank workspace.",
          "Give each engagement an isolated sandbox with explicit data, tool, and execution boundaries.",
          "Let users validate a working experience instead of approving abstract requirements.",
          "Attach intent, constraints, evidence, test results, and approvals to the pull request.",
          "Separate reusable product learning from account-specific exceptions before merge.",
        ],
      },
      {
        heading: "The supporting scorecard",
        paragraphs: [
          "The North Star should be accompanied by measures that explain why the cycle is improving: sandbox-to-PR conversion, approvals captured per engagement, knowledge reuse, weekly active forward-deployed engineers per licensed seat, and net revenue retention created by seat expansion inside systems-integrator accounts.",
          "Together, these measures prevent a false version of speed. A team is not truly faster if it creates more abandoned sandboxes, less reuse, weaker governance, or greater product entropy. Sustainable speed compounds because each engagement leaves the next one with better starting assets and clearer evidence.",
        ],
      },
    ],
  },
  {
    slug: "customer-proximity-without-product-entropy",
    title: "Customer Proximity Without Product Entropy",
    dek: "Forward-deployed teams create exceptional learning. Without a governed promotion model, that learning turns into permanent forks and support burden.",
    category: "Product strategy",
    readingTime: "8 min read",
    linkedinHook:
      "The closer engineers get to customers, the more valuable the learning becomes—and the greater the risk of turning every strategic account into a permanent product fork.",
    sections: [
      {
        heading: "The paradox of forward deployment",
        paragraphs: [
          "Forward-deployed engineers, solution architects, and implementation teams see what traditional product processes often miss. They observe the real workflow, the unofficial workarounds, the missing data, the exceptions, and the political constraints that never appear in a requirements document.",
          "That proximity is a competitive advantage. It is also a source of product entropy. Under pressure to satisfy a strategic client, teams make account-specific changes, duplicate components, introduce special integrations, and create branches that never fully return to the core product.",
        ],
      },
      {
        heading: "The wrong choice: standardization or responsiveness",
        paragraphs: [
          "Many organizations frame the problem as a trade-off. Either the product team protects the roadmap and moves too slowly, or the field team responds quickly and creates customization debt. That framing is incomplete.",
          "The better question is how to create a governed learning loop in which customer-specific experiments can be validated rapidly, while the decision to promote, generalize, configure, extend, or reject them remains explicit.",
        ],
      },
      {
        heading: "Treat every engagement as a product-learning system",
        paragraphs: [
          "A customer request should enter an isolated environment connected to a known product baseline. The team should be able to create a working experiment, retain the decisions behind it, and classify the resulting learning before it reaches the core repository.",
        ],
        bullets: [
          "Reusable product capability: broadly valuable and appropriate for the core roadmap.",
          "Configuration pattern: supported through metadata, rules, or tenant-level controls.",
          "Extension pattern: maintained through a stable interface without forking the core.",
          "Delivery artifact: useful across similar engagements but not part of the product itself.",
          "One-off request: intentionally rejected or contained with a clear support boundary.",
        ],
      },
      {
        heading: "Governance should accelerate the decision",
        paragraphs: [
          "Governance is often implemented as a gate at the end. By then, the team has already invested in a solution and the client expects it to ship. A stronger model brings architecture, security, product, and engineering boundaries into the experiment itself.",
          "The goal is not to prevent customer-specific work. It is to ensure that every exception is visible, every approval is attributable, and every reusable pattern becomes part of organizational memory. Customer proximity then compounds product advantage instead of compounding maintenance cost.",
        ],
      },
    ],
  },
  {
    slug: "the-artifact-flywheel",
    title: "The Artifact Flywheel: Turning Every Engagement Into a Better Starting Point",
    dek: "The most valuable output of a client engagement is not only the delivered solution. It is the reusable knowledge that reduces the cost and risk of the next one.",
    category: "Knowledge reuse",
    readingTime: "7 min read",
    linkedinHook:
      "Most services firms measure utilization. The stronger long-term metric is how often a new engagement starts from a proven artifact instead of a blank page.",
    sections: [
      {
        heading: "Services knowledge usually disappears in plain sight",
        paragraphs: [
          "A successful engagement generates far more than code. It produces workflow maps, prompts, data contracts, security decisions, integration patterns, test cases, acceptance criteria, demonstrations, and lessons about what the client will actually approve.",
          "Yet much of this value remains trapped in meeting notes, individual laptops, old repositories, and the memory of the delivery team. The next account begins with a new discovery cycle and repeats decisions that the firm has already paid to learn.",
        ],
      },
      {
        heading: "Define a library artifact broadly",
        paragraphs: [
          "A reusable artifact is not limited to a code template. It can be any governed object that gives a future engagement a better starting point and includes enough context to be safely reused.",
        ],
        bullets: [
          "Reference applications and workflow accelerators.",
          "Approved architecture and integration patterns.",
          "Industry-specific data models and evaluation sets.",
          "Security controls, test suites, and evidence packages.",
          "Decision records explaining where a pattern does and does not apply.",
          "Reusable discovery questions and client-approval checklists.",
        ],
      },
      {
        heading: "Measure the knowledge reuse rate",
        paragraphs: [
          "A practical metric is the percentage of new engagements that begin from at least one governed library artifact. This is stronger than counting assets in a repository because it measures actual reuse in delivery.",
          "The metric should be paired with evidence of impact: time saved in discovery, reduction in rework, faster approval, fewer defects, and a higher sandbox-to-PR conversion rate. An artifact is valuable only when it improves an outcome.",
        ],
      },
      {
        heading: "The flywheel",
        paragraphs: [
          "Each engagement starts from proven assets, adapts them to a real client workflow, captures new decisions, and promotes the reusable learning back into the library. The next engagement starts with a richer baseline.",
          "For systems integrators, this is how delivery margin and differentiation can improve at the same time. The organization stops selling only hours and begins compounding governed implementation intelligence across accounts.",
        ],
      },
    ],
  },
  {
    slug: "why-systems-integrators-need-a-delivery-control-plane",
    title: "Why Systems Integrators Need a Delivery Control Plane for AI",
    dek: "AI increases the volume of experiments. Systems integrators need a consistent layer for isolation, evidence, approvals, reuse, and engineering promotion.",
    category: "Systems integrators",
    readingTime: "8 min read",
    linkedinHook:
      "AI may reduce the cost of producing a prototype. It does not automatically reduce the cost of governing, reusing, supporting, and scaling it across client accounts.",
    sections: [
      {
        heading: "The prototype bottleneck is moving",
        paragraphs: [
          "Generative AI makes it easier for consulting and delivery teams to create demonstrations, workflow applications, agents, and integrations. That is good news, but it shifts the bottleneck downstream.",
          "As the number of experiments grows, firms need to know which baseline was used, what data entered the environment, which tools the model could access, what changed, who approved it, and whether the resulting pattern belongs in a reusable accelerator or a client-specific implementation.",
        ],
      },
      {
        heading: "What a delivery control plane does",
        paragraphs: [
          "A delivery control plane sits between client discovery and the production engineering systems used by the firm and its customers. It does not replace GitHub, cloud platforms, security tools, or project systems. It coordinates the customer-to-production workflow across them.",
        ],
        bullets: [
          "Creates isolated engagement sandboxes from approved baselines.",
          "Retains the original client ask and all material decisions.",
          "Supports rapid working validation with business users.",
          "Captures approvals as structured engagement evidence.",
          "Promotes approved work into branches and pull requests.",
          "Returns reusable assets and lessons to a governed library.",
        ],
      },
      {
        heading: "Why this matters commercially",
        paragraphs: [
          "A repeatable delivery layer can improve more than project execution. It creates a product-like operating model for services: clearer packaging, faster onboarding of delivery teams, more consistent quality, and a measurable path from initial seats to broader account adoption.",
          "For a platform sold into systems integrators, net revenue retention should be connected to seat expansion across practices, geographies, and client programs. Weekly active FDEs per licensed seat becomes an early signal of whether the platform is embedded in the delivery motion rather than purchased as shelfware.",
        ],
      },
      {
        heading: "The strategic outcome",
        paragraphs: [
          "The winning systems integrators will not simply use more AI tools. They will build institutional memory around how AI-enabled solutions are discovered, validated, governed, and promoted. That memory becomes reusable delivery IP and a reason clients choose the firm for the next program.",
        ],
      },
    ],
  },
];

export function getInsight(slug: string) {
  return insights.find((insight) => insight.slug === slug);
}
