# FDE-Toolkit for Agentforce

FDE-Toolkit now includes a governed implementation workspace for Salesforce Agentforce.

Open the product at:

```text
/platform/agentforce
```

The workspace converts an implementation brief into:

- Agentforce DX agent specification YAML
- Agent evaluation specification YAML
- Agentforce-ready scratch-org definition
- Source-driven Salesforce DX package structure
- Topic and action inventory
- Action risk and confirmation policies
- Salesforce CLI validation, preview, publication, evaluation, and deployment commands
- Environment promotion plan
- Business, architecture, security, and release approval gates
- Reviewable implementation preview
- Hashes and FDE evidence artifact

Three synthetic blueprints are included:

1. Service case resolution
2. Sales account planning
3. Employee IT support

A complete synthetic sample is available under:

```text
examples/agentforce-service-agent
```

See [docs/AGENTFORCE-IMPLEMENTATION.md](docs/AGENTFORCE-IMPLEMENTATION.md) for the architecture, lifecycle, security boundary, Salesforce CLI workflow, evidence model, approvals, and production path.
