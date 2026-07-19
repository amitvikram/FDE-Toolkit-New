# FDE-Toolkit for Agentforce implementations

Version: 2026-07-19.1

FDE-Toolkit extends its control-plane and execution-plane model to Salesforce Agentforce. The product does not replace Agentforce Builder, Agentforce DX, Salesforce CLI, Salesforce sandboxes, scratch orgs, DevOps Center, or the customer's release process. It connects them into one governed implementation lifecycle.

## Product entry point

```text
/platform
  -> Open Agentforce workspace
  -> /platform/agentforce
```

The Agentforce workspace is protected by the same gated product-access session as the main FDE product.

## What the workspace captures

### Implementation brief

- Company and implementation context
- Measurable business outcome
- Customer-facing or internal agent type
- In-scope channels
- Explicit agent role and excluded responsibilities

### Agent design

- Agent API name
- Grounding strategy: CRM and Knowledge, Data 360, or hybrid
- Topics and topic descriptions
- Human escalation conditions
- Source-controlled agent specification

### Actions and guardrails

Each action records:

- API name and label
- Implementation type: Apex, Flow, prompt template, or MCP
- Risk: read, write, or external
- Confirmation policy: none, conditional, or required
- Deployment gate
- Runtime policy

Write actions require immediate confirmation. External, security-sensitive, legal, identity, policy, and high-value commercial actions require an explicit escalation or approval policy.

### Testing and evaluation

The workspace creates an Agentforce DX YAML test specification that covers:

- Topic or subagent routing
- Expected action invocation
- Expected business outcome
- Grounding
- Write confirmation
- Refusal boundaries
- Human escalation
- Prompt-injection resistance

### Environment and release plan

- Development sandbox or Agentforce-ready scratch org
- UAT sandbox
- Production org
- Simulated preview before live-action preview
- Agent Script validation
- Action deployment and unit testing
- Agent publication and evaluation
- UAT, security, and release approvals
- Production deployment dry run
- Human deployment and activation

## Recommended Salesforce development environments

Use a Salesforce sandbox for implementations that depend on Data 360, Agentforce Data Libraries, representative CRM configuration, integration endpoints, or realistic permission models.

Use an Agentforce-ready scratch org for source-driven work that does not require Data 360 or production-like data. The generated scratch-org definition enables:

```json
{
  "features": ["Einstein1AIPlatform"],
  "settings": {
    "agentPlatformSettings": { "enableAgentPlatform": true },
    "einsteinGptSettings": { "enableEinsteinGptPlatform": true }
  }
}
```

Coding agents and FDE automation must not receive production-org credentials.

## Source artifacts

A generated implementation package includes:

```text
sfdx-project.json
config/project-scratch-def.json
specs/<Agent>.agent-spec.yaml
specs/<Agent>.test-spec.yaml
force-app/main/default/aiAuthoringBundles/<Bundle>/<Bundle>.agent
force-app/main/default/aiAuthoringBundles/<Bundle>/<Bundle>.bundle-meta.xml
agentforce/action-catalog.json
docs/implementation-plan.md
manifest/package.xml
.fde/agentforce/<runId>.json
```

The initial `.agent` file is intentionally a placeholder. Agent Script should be generated or edited against an authorized non-production org and compiled with `sf agent validate authoring-bundle`. FDE does not invent uncompiled Agent Script and present it as deployment-ready.

## Agentforce DX command path

### Generate the authoring bundle

```bash
sf agent generate authoring-bundle \
  --spec specs/<Agent>.agent-spec.yaml \
  --name "<Implementation name>" \
  --api-name <Bundle> \
  --target-org <development-org>
```

### Validate Agent Script

```bash
sf agent validate authoring-bundle \
  --api-name <Bundle> \
  --target-org <development-org> \
  --json
```

### Deploy Apex and Flow actions

```bash
sf project deploy start \
  --source-dir force-app/main/default \
  --target-org <development-org> \
  --json
```

### Preview with simulated actions

```bash
sf agent preview start \
  --authoring-bundle <Bundle> \
  --simulate-actions \
  --target-org <development-org> \
  --json
```

### Preview with live actions

```bash
sf agent preview start \
  --authoring-bundle <Bundle> \
  --use-live-actions \
  --target-org <development-org> \
  --json
```

### Publish the authoring bundle

```bash
sf agent publish authoring-bundle \
  --api-name <Bundle> \
  --target-org <development-org> \
  --json
```

### Run rich evaluations

```bash
sf agent test run-eval \
  --spec specs/<Agent>.test-spec.yaml \
  --target-org <development-org> \
  --result-format junit \
  --json
```

The `agent test run-eval` command is currently a Salesforce Beta capability. A customer can instead use the generally available Agentforce DX test workflow or the Testing API when required by its release policy.

## FDE evidence model

FDE retains:

- Original business outcome and agent boundary
- Topics, actions, risk classes, and confirmation policies
- Source file hashes
- Agent Script validation output
- Preview session and trace references
- Apex, Flow, and metadata deployment results
- Evaluation specifications and results
- Permission and agent-user review evidence
- Data and grounding review evidence
- Business, architecture, security, and release decisions
- Pull request, deployment validation, activation, and rollback records

The agent's narrative is supplemental evidence. Salesforce CLI, Metadata API, Connect API, test framework, source-control, and deployment results are authoritative.

## Approval model

Recommended required approvals:

1. **Business process owner** — outcome, scope, escalation, and acceptance criteria.
2. **Salesforce solution architect** — metadata, actions, integrations, limits, and environment design.
3. **Security and data owner** — dedicated agent user, least privilege, sensitive data, grounding, Trust Layer, and audit controls.
4. **Release owner** — test results, deployment validation, rollback, activation, monitoring, and operational readiness.

## Path to production

```text
Implementation brief
  -> source package
  -> development sandbox or scratch org
  -> Agent Script validation
  -> simulated preview
  -> live-action preview
  -> automated evaluations
  -> pull request
  -> Salesforce code and metadata review
  -> UAT deployment
  -> business and security approval
  -> production validation deployment
  -> human production deployment
  -> human activation
  -> monitoring and rollback readiness
```

## Current implementation boundary

Implemented in this repository:

- Gated Agentforce implementation workspace
- Three implementation blueprints
- Editable business, topic, action, test, environment, and approval definition
- Deterministic source-package generation
- Salesforce DX project and scratch-org definitions
- Agent and evaluation specifications
- Action catalog and guardrails
- Salesforce CLI command plan
- Reviewable implementation preview
- File hashes and FDE evidence artifact
- CI tests for all three blueprints
- Synthetic sample Agentforce service-agent project

Requires customer Salesforce configuration and credentials:

- Salesforce org authentication
- Real Agent Script generation and compilation
- Agent user and permission-set configuration
- Apex, Flow, prompt template, Data 360, Knowledge, and MCP implementation
- Live preview sessions and traces
- Testing Center, Agentforce DX, or Testing API execution
- DevOps Center or customer CI/CD integration
- Production deployment, activation, monitoring, and rollback

## Official Salesforce references

- Agentforce DX developer guide
- Salesforce CLI `agent` command reference
- Agentforce metadata type reference
- Agentforce Testing API and Agentforce DX testing guides
- Agentforce-ready scratch-org guide

Salesforce CLI and Agentforce DX are updated frequently. Pin and validate CLI/plugin versions in the customer execution environment rather than assuming the public demo runtime is the source of truth.
