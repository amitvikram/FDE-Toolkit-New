# Northstar Agentforce Service Agent

This directory is a synthetic, source-driven Agentforce implementation baseline for FDE-Toolkit demonstrations and implementation pilots.

It shows the artifacts that FDE-Toolkit governs before an authorized Salesforce team generates, validates, previews, publishes, evaluates, and promotes an Agentforce authoring bundle.

## Included

- Salesforce DX project definition
- Agentforce-ready scratch-org definition
- Agent specification YAML
- Agent evaluation specification YAML
- Governed action catalog
- Environment and approval plan

## Lifecycle

```text
Business outcome and scope
  -> agent specification
  -> org-generated Agent Script authoring bundle
  -> simulated preview
  -> live-action preview
  -> routing/action/outcome evaluations
  -> UAT and security approval
  -> source-control promotion
  -> production dry run
  -> human deployment and activation
```

## Important boundary

The `.agent` Agent Script file must be generated or edited against an authorized non-production Salesforce org and compiled with the Salesforce CLI. FDE-Toolkit does not fabricate a production Agent Script or give coding agents access to a production org.

## Representative commands

```bash
sf agent generate authoring-bundle \
  --spec specs/Northstar_Service_Agent.agent-spec.yaml \
  --name "Northstar Governed Service Agent" \
  --api-name Northstar_Service_Agent_Bundle \
  --target-org agentforce-dev

sf agent validate authoring-bundle \
  --api-name Northstar_Service_Agent_Bundle \
  --target-org agentforce-dev \
  --json

sf agent preview start \
  --authoring-bundle Northstar_Service_Agent_Bundle \
  --simulate-actions \
  --target-org agentforce-dev \
  --json

sf agent test run-eval \
  --spec specs/Northstar_Service_Agent.test-spec.yaml \
  --target-org agentforce-dev \
  --result-format junit \
  --json
```

All org authentication, secrets, deployment, activation, and rollback operations remain owned by the Salesforce platform and release teams.
