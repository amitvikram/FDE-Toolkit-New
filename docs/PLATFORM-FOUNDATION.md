# FDE-Toolkit Platform Foundation

Version: 2026-07-15.1

This implementation follows one boundary: **FDE-Toolkit owns workflow, policy, provenance, knowledge, tenancy, approvals, and promotion state. Agent runtimes, sandboxes, secrets providers, and source-control systems remain replaceable drivers.**

## What is executable in this release

### Agent Driver Interface

Published contract:

- `contracts/agent-driver.schema.json`
- Job input: tenant, organization, engagement, intent, workspace mount, scoped tools, policy, limits, and secret references.
- Typed output events: `plan`, `file_diff`, `command_run`, `test_result`, `question`, `usage`, `done`, and `error`.
- Capability and deployment-mode declarations.

Implemented execution drivers:

| Driver | Execution surface | Runtime requirement |
|---|---|---|
| `fde-demo-agent` | In-process deterministic driver | Built in |
| `openai-codex` | `codex exec --ephemeral --sandbox workspace-write --json` | Codex CLI and an approved API credential inside the execution plane |
| `claude-agent` | `claude --bare -p ... --output-format stream-json` | Claude CLI and an approved API credential inside the execution plane |
| `cursor-agent` | Configurable process/JSONL contract | `FDE_CURSOR_COMMAND` and optional `FDE_CURSOR_ARGS_JSON` |
| `customer-agent-gateway` | Signed event webhook | Customer runner implementing the published event contract |

External agent processes run without a shell. The execution plane snapshots the workspace before and after the process, hashes changed files, records the exact command, exit code, duration, stdout/stderr digests, and enforces time, event, output, and cost limits.

The Cursor command line is intentionally configurable because the product contract must not depend on an undocumented invocation. A customer-approved Cursor runner can be bound without changing the workflow or evidence model.

### Signed customer-agent gateway

A customer-managed or SI-managed agent can receive a job through its own infrastructure and stream events to:

```text
POST /v1/customer-agents/events
```

Requirements:

- HMAC-SHA256 request signature.
- Timestamp within the configured replay window.
- Contiguous event sequence per job.
- Supported typed events only.
- Job-level event and cost limits.
- Final `done` or `error` event.

This is the air-gapped and bespoke-agent escape hatch. The customer owns the agent implementation; FDE-Toolkit retains one workflow and provenance format.

### Sandbox Driver Interface and gateway

Published contract:

- `contracts/sandbox-driver.schema.json`
- Lifecycle: `provision`, `seed`, `expose_url`, `snapshot`, `destroy`, and `status`.

Implemented gateway drivers:

| Driver | Current behavior |
|---|---|
| `local-ephemeral` | Creates and destroys a restricted workspace under `FDE_WORKSPACE_ROOT` |
| `docker-local` | Uses a configured Docker CLI to create a resource-limited, no-new-privileges container with networking disabled by default |
| `kubernetes-job` | Produces a constrained Kubernetes Job; optionally applies it through a configured `kubectl` command |

The Kubernetes Job uses an active deadline, no service-account token, non-root execution, dropped capabilities, resource limits, an ephemeral workspace, and automatic cleanup metadata.

The execution-plane container does not receive the Docker socket by default. A production Docker gateway should be a separately authorized service rather than exposing the host socket to the web application.

### Persistent jobs and evidence

The execution plane now stores:

- Job request and lifecycle state.
- Organization, tenant, engagement, and actor context.
- Policy and resource limits.
- Observed evidence and CI/security results.
- Required approvals and decisions.
- Promotion and merge state.
- Usage and cost.
- Reusable artifact metadata.

The default implementation is an atomic file store under `FDE_DATA_DIR`. Docker Compose mounts a named volume at `/var/lib/fde`, so local jobs survive container recreation.

This file store is suitable for local development and a single execution-plane instance. A production multi-replica deployment should implement the same repository contract over Postgres plus object storage.

### Durable audit trail

Published format:

- `contracts/provenance-event.schema.json`

Each audit event contains:

- Tenant and job IDs.
- Monotonic sequence.
- Event type, source, timestamp, and payload.
- Previous-event hash.
- Current SHA-256 hash over the canonical event.

Before GitHub promotion, the entire chain is verified. A broken chain blocks promotion.

### Asynchronous jobs and callbacks

```text
POST /v1/jobs
GET  /v1/jobs/{jobId}?tenantId=...
POST /v1/jobs/{jobId}/cancel
```

The queue supports:

- Global concurrency.
- Per-tenant concurrency.
- Maximum queue depth.
- Recovery of queued jobs after restart.
- Failure marking for jobs interrupted by restart.
- Signed completion, failure, approval, promotion, and merge callbacks.

Callback URLs must use HTTPS except for local development.

### Cost, timeout, and quota controls

Each job carries:

- `timeoutMs`
- `maxEvents`
- `maxOutputBytes`
- `maxCostUsd`

The external command runner kills timed-out processes, stops oversized output, rejects excessive events, and blocks jobs that exceed reported cost.

### Evidence and CI/security ingestion

```text
POST /v1/jobs/{jobId}/evidence
```

The endpoint accepts normalized evidence from CI, SAST, dependency scanning, container scanning, policy checks, test systems, and client validation. Evidence becomes part of both the persistent job record and the hash-chained audit trail.

### Approval workflow and RBAC foundation

Built-in roles:

- `owner`
- `admin`
- `engineer`
- `approver`
- `auditor`
- `system`

The current policy engine enforces actions for job creation, cancellation, evidence ingestion, approval, promotion, artifact creation, and analytics. Approval keys are bound to the job; an arbitrary approval label cannot satisfy a gate. A rejected gate blocks completion of the approval set.

This is an authorization foundation, not complete enterprise identity. Production work still needs OIDC/SAML login, SCIM provisioning, organization membership management, service identities, and policy administration UI.

### Secret-management integration

Published contract:

- `contracts/secret-driver.schema.json`

Implemented reference schemes:

| Scheme | Resolution boundary |
|---|---|
| `env://NAME` | Execution-plane environment; useful for local development and platform-managed deployments |
| `vault://path#field` | HashiCorp Vault HTTP API inside the execution boundary |
| `aws-sm://secret-id#field` | AWS Secrets Manager through an execution-plane AWS CLI/workload identity |
| `azure-kv://vault-name/secret-name` | Azure Key Vault through an execution-plane Azure CLI/workload identity |

A job carries references rather than values. When `policy.secretAccess` is `brokered-short-lived`, the execution plane resolves references into a per-job in-memory lease, passes only the resolved environment keys to the selected child process, records metadata-only lease events, then blanks and revokes the lease when execution ends.

Raw secret values are not written to job records, audit records, callbacks, analytics, or the SaaS control plane. Production deployments should replace static Vault tokens and CLI sessions with workload identity and provider-native short-lived credentials.

### GitHub App promotion

```text
POST /v1/jobs/{jobId}/promote/github
```

The GitHub App driver:

1. Requires a completed job.
2. Requires all configured human approvals.
3. Verifies the audit chain.
4. Creates a short-lived installation token scoped to the selected repository.
5. Creates a branch from the configured base branch.
6. Writes `.fde/runs/{jobId}.json` containing the governed evidence package and audit-head hash.
7. Opens a draft pull request.
8. Stores the PR, commit, and branch identifiers on the job.

Required environment variables:

```text
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_INSTALLATION_ID
```

The private key supports escaped newlines when supplied through an environment-variable manager.

### Reusable artifact library

```text
POST /v1/artifacts
GET  /v1/artifacts?tenantId=...
```

Artifacts have tenant and organization scope, a reuse classification, source job, tags, content reference, and metadata. The control plane should only promote sanitized patterns; client code and raw data remain in the execution boundary.

### Ask-to-merged-PR analytics

```text
GET /v1/analytics/ask-to-pr?tenantId=...
```

Metrics include:

- Jobs, completed, failed, approved, promoted, and merged.
- Median ask-to-completed time.
- Median ask-to-approved time.
- Median ask-to-promoted time.
- Median ask-to-merged time.
- Total recorded agent cost.

## API authentication boundary

All mutation endpoints use signed metadata:

```text
x-fde-timestamp: <unix milliseconds>
x-fde-signature: sha256=<HMAC(timestamp + "." + raw body)>
```

The signed body or headers carry actor, role, tenant, organization, and engagement context. The public web application does not receive customer agent credentials, GitHub App private keys, or client secrets.

The execution-plane HTTP service is intended to be private-network reachable. The current public-read endpoints are operational APIs, not a substitute for enterprise identity. Production topology must add service identity, TLS/mTLS, tenant-scoped authorization, and network policy.

## Deployment topologies

### Full SaaS

Control and execution planes are hosted together for self-service trials, SaaS teams, and small consultancies.

### Hybrid — flagship

The control plane remains SaaS. The execution plane, agents, sandboxes, repository access, data seeders, and secret broker run inside the client or SI VPC. Only signed job metadata, hash-chained provenance, approvals, and sanitized artifact metadata cross the boundary.

### Self-hosted or air-gapped

The same execution and driver contracts run entirely in the customer environment. Customer agents use the signed gateway, and self-hosted models use the same Agent Driver Interface.

## HTTP surface

```text
GET  /health
GET  /v1/drivers
GET  /v1/sandboxes/drivers
GET  /v1/secrets/providers
POST /v1/sandboxes
GET  /v1/sandboxes/{id}
POST /v1/sandboxes/{id}/destroy
POST /v1/runs                         # synchronous public demo compatibility
POST /v1/jobs                         # durable asynchronous job
GET  /v1/jobs/{id}
POST /v1/jobs/{id}/cancel
GET  /v1/jobs/{id}/audit
POST /v1/jobs/{id}/evidence
POST /v1/jobs/{id}/approvals
POST /v1/jobs/{id}/promote/github
POST /v1/jobs/{id}/merged
POST /v1/customer-agents/events
POST /v1/artifacts
GET  /v1/artifacts
GET  /v1/analytics/ask-to-pr
```

## Remaining production work

The following are deliberately not represented as finished:

1. OIDC/SAML, SCIM, MFA, service identities, and organization administration.
2. A full policy-as-code engine and policy-management UI.
3. Workload-identity-based production credential providers, lease renewal, and provider revocation verification.
4. A production Postgres/object-store implementation of the persistence contract.
5. Distributed queue leasing, retries, dead-letter queues, and callback retry schedules.
6. A separately deployed Docker gateway and a Helm-packaged Kubernetes execution operator.
7. GitHub webhook ingestion for check runs, branch protection, review state, and authoritative merge events.
8. GitLab, Bitbucket, and Azure DevOps promotion drivers.
9. A complete client approval portal with expiring links, comments, identity proof, and white-label controls.
10. Artifact sanitization, lineage, versioning, search, and cross-engagement promotion policy.
11. Billing-grade usage accounting and marketplace metering.
12. Adapter conformance CLI, fixtures, certification badges, and public registry.
13. Full control-plane UI for durable jobs, approval queues, policies, artifacts, and analytics.

The critical architectural point is preserved: these additions attach to stable driver, job, event, evidence, approval, and promotion contracts rather than changing the workflow for each vendor.
