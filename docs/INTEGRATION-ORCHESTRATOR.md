# FDE-Toolkit Integration Orchestrator

## Product constitution

### Own the workflow. Rent the horsepower.

FDE-Toolkit builds the control plane: workflow, policy, provenance, knowledge, and tenancy. Everything that executes and everything it touches remains behind a driver interface.

### Neutrality is the product

An enterprise, SI, or consulting organization must be able to bring the coding platform, model, sandbox, source-control system, and deployment boundary already approved by each client. Provider neutrality is a procurement requirement, not an optional feature.

### Trust nothing the agent says. Observe everything it does.

Changed files, commands, exit codes, test outcomes, and output digests are captured by FDE execution instrumentation at the driver boundary. The normalized audit record is not based on an agent's self-reported summary.

### The execution plane is a deployable unit

Anything touching client code or data can run in the toolkit cloud, a client VPC, or an air-gapped environment. The control plane exchanges signed job metadata and normalized evidence with the execution plane; it does not require source code or long-lived credentials.

## Product boundary

FDE-Toolkit owns:

- normalized client requests and acceptance criteria
- workflow and approval state
- organization, client, engagement, and project tenancy
- provider selection and routing
- policy profiles and execution constraints
- normalized observed provenance
- reusable knowledge and delivery artifacts
- promotion packages and engineering handoff
- metrics from client ask to approved PR

Drivers and customer platforms own:

- model inference and coding-agent execution
- repository checkout and code editing
- compute and isolation boundaries
- raw commands and file operations
- source-control writes
- CI/CD and production release
- customer credentials, secrets, and data residency

## Runtime architecture

### Control plane

The Next.js application stores intent, policy, approvals, routing decisions, and normalized evidence. It sends a signed JSON job envelope to the execution plane.

### Execution plane

The execution-plane service provisions the selected sandbox driver, invokes the selected coding-agent driver, observes the file system and commands, runs validations, and returns a normalized evidence envelope.

### Signed channel

Every execution request includes:

- `x-fde-timestamp`
- `x-fde-request-id`
- `x-fde-signature`

The signature is HMAC-SHA256 over `timestamp.raw-json-body`. Production deployments should replace the demo shared secret with workload identity, mTLS, or a managed secret.

## Standard job lifecycle

1. `submit`: accept a governed job envelope.
2. `provision`: create or attach an approved workspace.
3. `execute`: invoke the selected coding-agent driver.
4. `observe`: capture file-system changes, exact commands, tests, and resource events.
5. `review`: collect business, product, architecture, security, and engineering approvals.
6. `promote`: create a branch, commit, pull or merge request, and checks.
7. `learn`: classify reusable artifacts and return them to the governed library.

The FDE job ID remains the correlation key across all systems.

## Driver interfaces

### Coding-agent driver

Input:

- FDE job ID
- client ask and acceptance criteria
- repository and base revision references
- selected sandbox reference
- tool, command, and model policies
- required evidence

Output:

- driver job ID and status
- events and unresolved questions
- completion state

The coding agent does not author the authoritative changed-file or command audit record. The execution instrumentation does.

Initial driver targets:

- FDE deterministic demo agent
- OpenAI Codex
- Claude Agent
- Cursor
- customer or SI coding-agent gateway

### Sandbox driver

Input:

- FDE job ID
- approved image or workload template
- repository reference
- resource, network, region, and retention policy
- secret references, never raw secrets in the control-plane job record

Output:

- workspace ID
- lifecycle status
- execution attachment information
- observed resource events
- cleanup confirmation

Initial driver targets:

- local ephemeral demo workspace
- Docker Engine gateway
- Kubernetes Job or Pod
- approved managed sandbox provider
- customer sandbox-service gateway

### Source-control driver

Input:

- approved workspace revision or patch reference
- target repository and base branch
- branch name, commit message, and PR body
- evidence manifest and approval identities

Output:

- branch, commit, and pull-request identifiers
- check and review status
- merge and release linkage

Initial driver targets:

- reviewable PR promotion package
- GitHub App
- GitLab integration
- Azure DevOps service connection
- customer SCM gateway

## Observed provenance format

The demo returns one normalized provenance envelope containing:

- execution boundary
- instrumentation identity
- trust model
- observed timestamp
- file-system diff with SHA-256 hashes
- exact fixed command arguments
- command exit code and duration
- output digest
- test pass or failure state

This common format is what permits uniform governance across different agents.

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
- business and engineering approvals
- promotion and release boundaries

FDE-Toolkit should fail closed when a driver cannot prove the requested policy was applied.

## Demo implementation

The demo uses:

- coding agent: `fde-demo-agent`
- sandbox: `local-ephemeral`
- promotion: `promotion-package`

Local Docker runs two services:

- `website`: the FDE control plane
- `execution-plane`: the isolated demo execution API

The execution plane creates a temporary workspace, writes a small workflow application, runs a fixed Node.js test command, captures observed provenance, returns a PR package, and removes the workspace.

The demo deliberately does not:

- clone the repository entered by the visitor
- use network access inside the workspace
- inject customer secrets
- execute agent-generated commands
- push a branch or pull request
- claim production-grade sandbox isolation

## Local Docker run

From the repository root:

```bash
git pull origin main
docker compose down --volumes --remove-orphans
docker compose up --build
```

Open:

- `http://localhost:3000`
- `http://localhost:3000/platform`
- `http://localhost:3000/api/orchestration/health`

The health endpoint must report `connected` before running the demo.

### Troubleshooting

Inspect both services:

```bash
docker compose ps
docker compose logs execution-plane
docker compose logs website
```

A healthy local topology shows both services running, with the execution-plane service marked healthy.

If port 3000 is occupied:

```bash
docker ps --filter "publish=3000"
```

Stop the conflicting container or map the website to another host port.

## Hosted demo

Render's single free web service starts the same execution-plane API as a separate local process inside the hosted container. The control plane still communicates through the signed HTTP contract. Production client deployments should run the execution plane as its own service in the required VPC, private cloud, or air-gapped boundary.

## First enterprise pilot

Choose one driver in each category:

- one coding agent, such as Codex or Claude Agent
- one sandbox boundary, such as customer Kubernetes
- one source-control target, such as GitHub Enterprise

Validate one representative client workflow and instrument:

- median client-ask-to-approved-PR time
- sandbox-to-PR conversion
- approval evidence captured
- reusable artifact creation and reuse
- active FDEs per licensed seat
- provider cost and execution failure rate

This proves the neutral orchestration contract before expanding the driver matrix.
