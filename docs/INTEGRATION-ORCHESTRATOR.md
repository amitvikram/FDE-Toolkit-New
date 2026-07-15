# FDE-Toolkit Integration Orchestrator

## Product boundary

FDE-Toolkit is the governed delivery control plane between a client ask and a production engineering change. It should not force a customer to replace an approved coding agent, sandbox platform, source-control system, CI/CD tool, or release process.

FDE-Toolkit owns:

- the normalized client request and acceptance criteria
- engagement and product memory
- provider selection and routing
- policy profiles and execution constraints
- evidence, test results, and approval records
- reusable artifact classification
- promotion packages and engineering handoff
- operating metrics from ask to approved PR

Connected providers own:

- model inference and coding-agent execution
- repository checkout and code editing
- the compute and isolation boundary
- source-control writes
- CI/CD and production release
- customer credentials, secrets, and data residency

## Standard job contract

Every coding-agent and sandbox integration should support the same lifecycle.

1. `submit`: accept a governed job envelope.
2. `provision`: create or attach an approved workspace.
3. `execute`: run the selected coding agent under the policy profile.
4. `observe`: stream status, logs, changed files, tests, and evidence.
5. `review`: collect business, product, architecture, security, and engineering approvals.
6. `promote`: create a branch, commit, pull or merge request, and checks.
7. `learn`: classify reusable artifacts and return them to the governed library.

A provider adapter can be synchronous for a small demo or asynchronous for an enterprise coding session. The FDE job ID remains the stable correlation key across every system.

## Provider interfaces

### Coding agent

Input:

- FDE job ID
- client ask and acceptance criteria
- repository and base revision
- selected sandbox reference
- tool and command policy
- model or agent policy
- required evidence

Output:

- agent job ID and status
- plan and decisions
- changed-file manifest or patch
- tests and validation results
- unresolved questions and risks
- provenance and model metadata

Initial adapters:

- FDE deterministic demo agent
- OpenAI Codex
- Anthropic Claude Code
- Cursor
- customer or SI coding-agent webhook

### Sandbox

Input:

- FDE job ID
- approved image or workload template
- repository reference
- resource, network, region, and retention policy
- secret references, never raw secrets in the FDE job record

Output:

- workspace ID
- lifecycle status
- execution endpoint or agent attachment information
- logs and resource metadata
- cleanup confirmation

Initial adapters:

- local ephemeral demo workspace
- Docker Engine
- Kubernetes job or pod
- managed sandbox provider such as E2B, Modal, or Cloudflare
- customer sandbox-service webhook

### Source control and promotion

Input:

- approved patch or workspace revision
- target repository and base branch
- branch name, commit message, and PR body
- evidence manifest and required checks
- approval identities

Output:

- branch, commit, and pull-request identifiers
- check and review status
- merge status
- release linkage

Initial adapters:

- reviewable PR promotion package
- GitHub App
- GitLab OAuth or project token
- Azure DevOps service connection
- customer SCM gateway

## Enterprise policy profile

A production policy profile should define:

- approved coding agents and model endpoints
- approved sandbox providers, regions, and images
- repository and branch allowlists
- read and write permissions
- tool and command allowlists
- network egress policy
- secret references and injection rules
- maximum CPU, memory, duration, and cost
- data retention and cleanup requirements
- required tests, scans, and evidence
- required business and engineering approvals
- promotion and release boundaries

FDE-Toolkit should fail closed when a provider cannot prove that the requested policy was applied.

## Demo implementation

The public demo uses:

- coding agent: `fde-demo-agent`
- sandbox: `local-ephemeral`
- promotion: `promotion-package`

The API creates a temporary filesystem workspace inside the FDE-Toolkit container. It generates a small HTML workflow application, structured evidence, fixed Node.js smoke tests, and a reviewable PR package. It then runs only the fixed test command and removes the workspace.

The demo deliberately does not:

- clone or access the repository entered by the visitor
- use network access
- inject secrets
- execute model-generated shell commands
- push a branch or pull request
- claim production-grade isolation

## Local Docker run

From the repository root:

```bash
docker compose down
docker compose up --build
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/platform`

The Docker configuration enables the demo and deletes temporary workspaces after each run.

## First enterprise pilot

Choose exactly one integration in each category:

- one coding agent, such as Codex or Claude Code
- one sandbox boundary, such as customer Kubernetes
- one source-control target, such as GitHub Enterprise

Then validate one representative client workflow and instrument:

- median client-ask-to-approved-PR time
- sandbox-to-PR conversion
- approval evidence captured
- reusable artifact creation and reuse
- active FDEs per licensed seat
- provider cost and execution failure rate

This proves the orchestration contract before expanding the provider matrix.
