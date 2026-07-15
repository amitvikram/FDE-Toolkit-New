# Workspace orchestration and code-to-production flow

Version: 2026-07-15.2

FDE-Toolkit now treats a **workspace** as the persistent operating boundary for one client application or delivery engagement. A workspace binds the repository, coding-agent driver, sandbox policy, preview output, approval workflow, and source-control promotion rules.

## Where a user connects GitHub

Inside the gated product:

```text
/platform
→ Workspace settings
→ GitHub repository
→ Connect GitHub App
```

The button redirects the user to the GitHub App installation page. GitHub lets the account or organization owner select the repositories the App may access. GitHub redirects back to the configured setup URL with an installation ID. FDE-Toolkit validates that installation server-side and loads the repositories approved for that installation.

The browser never receives the GitHub App private key or installation access token. Repository cloning and pull-request promotion occur in the execution plane with short-lived installation tokens.

Required deployment settings:

```text
GITHUB_APP_SLUG
GITHUB_APP_ID
GITHUB_APP_PRIVATE_KEY
```

Configure the GitHub App setup URL as:

```text
https://fde-toolkit.com/api/product/github/setup
```

Recommended GitHub App repository permissions for the current MVP:

```text
Contents: Read and write
Pull requests: Read and write
Metadata: Read-only
```

The App should be installed only on repositories approved for FDE delivery.

## Workspace settings

The Workspace settings page captures:

- Workspace name and description.
- GitHub repository, base branch, and application path within a monorepo.
- Coding-agent driver: FDE deterministic driver, Codex, Claude Agent, Cursor, or customer gateway.
- Secret reference used by the execution-plane credential broker.
- Sandbox driver, image, CPU, memory, workspace size, timeout, network policy, and Kubernetes namespace.
- Static preview output path.
- Named approval gates and approver roles.
- Draft-pull-request policy and production environments.

Settings are durable in the execution-plane workspace registry. Browser responses contain a redacted secret reference and omit host mount paths.

## Where sandboxes are created and managed

Sandboxes are created by the **execution plane**, not by the public Next.js process.

The product screen is:

```text
/platform
→ Sandboxes
```

Implemented drivers:

| Driver | Execution location | Current behavior |
|---|---|---|
| `local-ephemeral` | Execution-plane managed workspace volume | Creates an isolated workspace directory for local and hosted demonstrations |
| `docker-local` | Docker host or dedicated Docker gateway | Creates a resource-limited container with no-new-privileges and networking disabled by default |
| `kubernetes-job` | Customer or SI Kubernetes cluster | Generates or applies a constrained Kubernetes Job with deadline, non-root execution, dropped capabilities, no service-account token, and resource limits |

The Sandboxes page shows the selected driver, resources, network policy, status, creation and expiry time, and provides provision, repository preparation, and destruction controls.

The standard Docker deployment deliberately does not mount the host Docker socket into the web application. A production Docker driver should run as a separately authorized gateway.

## Repository preparation

After a sandbox is ready, FDE prepares a repository inside it.

With GitHub connected:

1. The execution plane creates a short-lived installation token for the selected repository.
2. It clones the configured base branch without placing the token in the clone URL.
3. It validates the configured application path.
4. The coding agent receives that application path as its working directory.

Without GitHub connected:

1. FDE copies the bundled Northstar client-review application into a real Git repository inside the sandbox.
2. It creates an initial commit.
3. The same coding, evidence, preview, approval, and promotion workflow runs against the sample repository.

The repository also contains the sample application under:

```text
examples/client-review-portal
```

This makes the demonstration target inspectable and versioned rather than generating an unrelated one-off HTML mock.

## Coding-agent execution

The selected agent edits the prepared repository in place.

### Codex

The execution images include the Codex CLI. A live Codex run requires:

```text
CODEX_API_KEY
```

The adapter runs non-interactively with a writable workspace sandbox and JSON event output. FDE instructs Codex to create a reviewable preview, run relevant tests, avoid deployment or pull-request creation, and leave the repository ready for independent inspection.

### Claude Agent and Cursor

The same workspace, policy, and result contracts apply. Their runtimes and credentials must be installed in the approved execution environment.

### Deterministic demonstration driver

When no external provider credential is available, the deterministic driver performs a real bounded repository change and test inside the prepared workspace. It is the default for public and CI demonstrations.

## Independent evidence

FDE snapshots the application workspace before and after agent execution and records:

- Added, modified, and deleted files.
- File sizes and SHA-256 hashes.
- Exact process arguments, exit codes, durations, and output digests.
- Test outcomes.
- Agent events as supplemental evidence.
- Usage and reported cost.
- A hash-chained audit event stream.

The agent does not determine the authoritative evidence record.

## Improved request-to-run transition

Starting a request no longer jumps immediately to a result page. The product displays a five-stage execution sequence:

1. Provision approved sandbox.
2. Prepare repository.
3. Run coding agent.
4. Capture independent evidence.
5. Release working preview.

Each stage displays active, completed, or failed status and a concrete explanation of what happened.

## Iterative product changes

The FDE operator can inspect the generated application preview and request another iteration. The next request updates the same prepared repository and sandbox, preserving accumulated application state for the engagement.

The current static-preview contract expects a reviewable HTML entry point such as:

```text
index.html
```

The workspace settings page allows a different output path. Full preview-process management for framework development servers remains a later increment.

## Client preview and approval

A completed job can be released through a signed client-review link.

The link:

- Expires after seven days.
- Shows the working application candidate in a sandboxed iframe.
- Shows the original client request and execution context.
- Allows the client reviewer to approve or request changes.
- Writes the decision to the durable job and audit trail.
- Does not deploy, merge, or create a pull request automatically.

Resend sends the review email when an email address and `RESEND_API_KEY` are available. The operator can also copy the signed link.

## Pull-request promotion

After all required approvals and audit verification:

1. The execution plane creates a short-lived GitHub installation token scoped to the selected repository.
2. It creates a branch from the workspace base branch.
3. It reads the exact observed files from the retained sandbox workspace.
4. It commits additions, modifications, and deletions under the configured application path.
5. It commits `.fde/runs/{jobId}.json` with the governed evidence package.
6. It opens a draft pull request.
7. Existing repository CI, required reviewers, branch protections, staging deployment, and production controls continue the path to production.

The MVP currently supports up to 60 changed files and 2 MB per file through the GitHub Contents API. A later Git Data API implementation should group larger changes into one tree and commit.

## Current boundaries

Implemented now:

- Durable workspace settings.
- GitHub App installation connection.
- Approved-repository binding.
- Local, Docker, and Kubernetes sandbox drivers.
- Repository preparation and retained iteration state.
- Real Codex CLI packaging and adapter.
- Generated static application previews.
- Client review releases and decisions.
- Internal approval workflow.
- Promotion of actual observed files into a draft GitHub pull request.

Still required for full production rollout:

- Enterprise SSO, SCIM, and permanent user accounts.
- GitHub webhook ingestion for CI checks, reviews, merges, and deployment status.
- Framework preview server lifecycle, ingress, and per-preview URLs.
- Distributed Postgres/object storage and queue workers.
- A dedicated Docker gateway and Kubernetes operator.
- Approval-link recipient identity verification and revocation.
- GitLab, Bitbucket, and Azure DevOps drivers.
- Production-environment deployment integrations and rollback orchestration.
