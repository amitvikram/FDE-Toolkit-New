# FDE-Toolkit Open Driver Contracts

These contracts are the interoperability boundary between the FDE-Toolkit control plane and replaceable execution providers. They are intended to be published independently from the commercial control plane.

## Contracts

| Contract | Purpose |
|---|---|
| `agent-driver.schema.json` | Change intent, workspace, scoped tools, policy, limits, capability negotiation, and typed agent events |
| `sandbox-driver.schema.json` | Provision, seed, expose, snapshot, status, and destroy lifecycle |
| `secret-driver.schema.json` | Secret references and short-lived lease metadata without durable raw values |
| `provenance-event.schema.json` | Canonical hash-chained evidence written at the driver boundary |

## Compatibility rules

1. `contractVersion` uses semantic major versions. A driver must reject unsupported major versions.
2. Unknown optional fields must not alter execution policy.
3. A driver declares capabilities before accepting a job. The control plane must not request an undeclared capability.
4. Agent output is advisory. File changes, commands, tests, resource use, and network activity are authoritative only when observed by execution-plane instrumentation.
5. Raw credentials, repository tokens, source files, and client data must never appear in provenance events or control-plane callbacks.
6. Event sequence numbers are monotonic and unique within a job.
7. A `done` event does not authorize promotion. Promotion remains a control-plane decision subject to policy, evidence, and human approval.
8. Sandbox destruction must be idempotent.
9. All customer-gateway requests are signed and replay protected.
10. Implementations must pass the conformance fixtures before being advertised as certified.

## Minimum Agent Driver conformance

A conforming driver must demonstrate:

- Manifest and capability negotiation.
- One valid job accepted with a workspace mount and policy.
- Monotonic typed event stream.
- Successful completion and structured error completion.
- No raw secret material in events.
- Enforcement or clear rejection of timeout, output, event, and cost limits.
- Deterministic handling of unsupported tools and capabilities.

A certified driver additionally demonstrates:

- Workspace changes independently observed by FDE instrumentation.
- Exact command, exit-code, duration, and output digests.
- Test evidence linked to the job.
- Session cancellation and cleanup.
- Client-VPC deployment instructions.
- Versioned security and data-handling statement.

## Minimum Sandbox Driver conformance

A conforming sandbox driver must demonstrate:

- Provision and destroy.
- Resource limits.
- Expiration or active deadline.
- Networking disabled or allowlisted according to policy.
- Non-root or equivalent restricted execution.
- Workspace isolation between tenants.
- Idempotent cleanup after success, failure, cancellation, and execution-plane restart.

## Provenance hashing

Each event hash is:

```text
SHA-256(canonical-json(event-without-hash))
```

`previousHash` is the prior event's hash. The first event uses sixty-four zeroes. The execution plane verifies the complete chain before promotion.

## Reference adapters in this repository

- FDE deterministic demo driver.
- OpenAI Codex CLI process adapter.
- Claude Agent CLI process adapter.
- Configurable Cursor process adapter.
- Signed customer-agent gateway.
- Local workspace sandbox.
- Docker Engine gateway.
- Kubernetes Job manifest/apply gateway.
- GitHub App promotion driver.
- Environment, Vault, AWS Secrets Manager, and Azure Key Vault secret references.

The presence of a reference adapter does not imply that its external runtime or credentials are bundled with FDE-Toolkit. Deployment owners install and approve those dependencies inside their execution boundary.
