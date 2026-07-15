import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const execFileAsync = promisify(execFile);

const scenarios = {
  "enterprise-ai": {
    name: "Enterprise AI exception-review workflow",
    eyebrow: "Governed enterprise workflow",
    summary:
      "A reviewer workspace that keeps the exception reason, supporting evidence, confidence, recommended action, and human disposition together.",
    fields: ["Exception reason", "Policy evidence", "Confidence", "Recommended action"],
    approvals: ["Business workflow owner", "Security or risk owner", "Engineering reviewer"],
    reusableArtifact: "Exception-review workspace pattern",
  },
  "saas-design-partner": {
    name: "SaaS design-partner productization workflow",
    eyebrow: "Customer learning to core product",
    summary:
      "A product decision workspace that classifies a design-partner request as core capability, configuration, extension, delivery artifact, or contained exception.",
    fields: ["Customer request", "Tenant impact", "Reuse classification", "Product decision"],
    approvals: ["Product owner", "Architecture owner", "Engineering reviewer"],
    reusableArtifact: "Design-partner productization decision pattern",
  },
  "si-delivery": {
    name: "Systems-integrator delivery evidence workflow",
    eyebrow: "Repeatable multi-client delivery",
    summary:
      "An engagement workspace that connects the client ask, acceptance evidence, approval state, reusable delivery artifact, and promotion readiness.",
    fields: ["Client ask", "Acceptance evidence", "Reusable artifact", "Promotion state"],
    approvals: ["Client approver", "Engagement lead", "Engineering reviewer"],
    reusableArtifact: "SI engagement evidence and promotion pattern",
  },
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 42);
}

function buildPreviewHtml({ scenario, clientAsk, runId }) {
  const safeAsk = escapeHtml(clientAsk);
  const cards = scenario.fields
    .map(
      (field, index) => `
        <div class="card">
          <div class="label">${escapeHtml(field)}</div>
          <div class="value">${index === 0 ? safeAsk : ["3 linked sources", "92%", "Human review required"][Math.min(index - 1, 2)]}</div>
        </div>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(scenario.name)}</title>
  <style>
    :root { color-scheme: dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    body { margin: 0; background: #020617; color: #e2e8f0; }
    .shell { max-width: 980px; margin: 0 auto; padding: 32px; }
    .top { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:24px; }
    .eyebrow { color:#67e8f9; font-size:12px; letter-spacing:.16em; text-transform:uppercase; }
    h1 { color:white; font-size:30px; margin:8px 0 0; }
    .status { padding:8px 12px; border:1px solid rgba(110,231,183,.3); background:rgba(110,231,183,.08); border-radius:999px; color:#a7f3d0; font-size:12px; }
    .summary { color:#94a3b8; line-height:1.7; max-width:760px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:28px; }
    .card { border:1px solid rgba(255,255,255,.1); background:rgba(15,23,42,.85); border-radius:18px; padding:18px; min-height:86px; }
    .label { color:#64748b; font-size:11px; text-transform:uppercase; letter-spacing:.12em; }
    .value { color:#f8fafc; margin-top:10px; line-height:1.5; }
    .evidence { margin-top:18px; border:1px solid rgba(34,211,238,.2); background:rgba(34,211,238,.05); border-radius:18px; padding:18px; }
    .row { display:flex; justify-content:space-between; gap:16px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.07); }
    .row:last-child { border-bottom:0; }
    .muted { color:#64748b; }
    @media (max-width: 680px) { .grid { grid-template-columns:1fr; } .top { align-items:flex-start; flex-direction:column; } }
  </style>
</head>
<body>
  <main class="shell">
    <div class="top">
      <div>
        <div class="eyebrow">${escapeHtml(scenario.eyebrow)}</div>
        <h1>${escapeHtml(scenario.name)}</h1>
      </div>
      <div class="status">Validation ready</div>
    </div>
    <p class="summary">${escapeHtml(scenario.summary)}</p>
    <section class="grid">${cards}</section>
    <section class="evidence">
      <div class="row"><span class="muted">Run</span><strong>${escapeHtml(runId)}</strong></div>
      <div class="row"><span class="muted">Promotion</span><strong>Human approval required</strong></div>
      <div class="row"><span class="muted">Reusable artifact</span><strong>${escapeHtml(scenario.reusableArtifact)}</strong></div>
    </section>
  </main>
</body>
</html>`;
}

async function writeArtifact(path, content) {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, content, "utf8");
}

async function describeFile(workspace, filePath, purpose) {
  const info = await stat(filePath);
  return { path: relative(workspace, filePath).replaceAll("\\", "/"), bytes: info.size, purpose };
}

export async function runDemoJob(input) {
  const startedAt = Date.now();
  const runId = `fde-${randomUUID().slice(0, 8)}`;
  const scenario = scenarios[input.scenario] ?? scenarios["enterprise-ai"];
  const workspace = await mkdtemp(join(tmpdir(), `${runId}-`));
  const steps = [];
  let checkpoint = Date.now();

  const markStep = (id, label, detail, status = "completed") => {
    const now = Date.now();
    steps.push({ id, label, status, detail, durationMs: Math.max(0, now - checkpoint) });
    checkpoint = now;
  };

  markStep(
    "ask-captured",
    "Client ask captured",
    "The original request, scenario, provider choices, and approval policy were normalized into one governed job envelope.",
  );

  const previewHtml = buildPreviewHtml({ scenario, clientAsk: input.clientAsk, runId });
  const branchName = `fde/${slugify(scenario.name)}-${runId.slice(-4)}`;
  const prTitle = `${scenario.name}: governed workflow prototype`;
  const acceptance = {
    runId,
    clientAsk: input.clientAsk,
    scenario: input.scenario,
    fields: scenario.fields,
    approvalsRequired: scenario.approvals,
    reusableArtifact: scenario.reusableArtifact,
    policy: {
      humanApprovalRequired: true,
      networkAccess: "disabled",
      arbitraryCommands: "disabled",
      secretsInjected: false,
      workspaceRetention: "ephemeral",
    },
  };

  const prBody = [
    "## Client ask",
    input.clientAsk,
    "",
    "## What this demo produced",
    `- A working ${scenario.name.toLowerCase()} prototype`,
    "- Acceptance evidence linked to the original request",
    "- Fixed smoke tests executed inside an ephemeral workspace",
    `- Reusable artifact classification: ${scenario.reusableArtifact}`,
    "",
    "## Required approvals",
    ...scenario.approvals.map((approval) => `- [ ] ${approval}`),
    "",
    "## Guardrails",
    "- No customer repository was cloned",
    "- Network access was not used",
    "- No model-generated shell command was executed",
    "- Promotion stops at a reviewable package until a human approves it",
  ].join("\n");

  const promotion = {
    title: prTitle,
    branchName,
    commitMessage: `feat: add ${slugify(scenario.name)}`,
    body: prBody,
    approvalsRequired: scenario.approvals,
    evidence: [
      "Original client ask",
      "Generated workflow preview",
      "Acceptance criteria manifest",
      "Automated smoke-test output",
      "Provider and policy profile",
    ],
  };

  const previewPath = join(workspace, "src", "index.html");
  const appPath = join(workspace, "src", "app.js");
  const acceptancePath = join(workspace, "evidence", "acceptance.json");
  const promotionPath = join(workspace, "promotion", "pr-package.json");
  const testPath = join(workspace, "tests", "smoke.test.mjs");

  await writeArtifact(previewPath, previewHtml);
  await writeArtifact(
    appPath,
    `export const deliveryRun = ${JSON.stringify(
      {
        runId,
        scenario: input.scenario,
        clientAsk: input.clientAsk,
        approvalMode: input.approvalMode,
      },
      null,
      2,
    )};\n`,
  );
  await writeArtifact(acceptancePath, `${JSON.stringify(acceptance, null, 2)}\n`);
  await writeArtifact(promotionPath, `${JSON.stringify(promotion, null, 2)}\n`);
  await writeArtifact(
    testPath,
    `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\nconst evidence = JSON.parse(await readFile(new URL("../evidence/acceptance.json", import.meta.url), "utf8"));\n\ntest("prototype carries the client ask", () => {\n  assert.ok(html.includes(${JSON.stringify(escapeHtml(input.clientAsk))}));\n});\n\ntest("prototype exposes required workflow fields", () => {\n  for (const field of ${JSON.stringify(scenario.fields)}) assert.ok(html.includes(field));\n});\n\ntest("promotion remains human controlled", () => {\n  assert.equal(evidence.policy.humanApprovalRequired, true);\n  assert.equal(evidence.policy.networkAccess, "disabled");\n  assert.equal(evidence.policy.arbitraryCommands, "disabled");\n});\n`,
  );

  markStep(
    "sandbox-provisioned",
    "Ephemeral sandbox provisioned",
    "A temporary workspace was created inside the Docker container with no network calls and no injected secrets.",
  );
  markStep(
    "agent-generated",
    "Demo coding agent generated change",
    "The selected scenario produced application code, evidence, tests, and a source-control promotion package.",
  );

  let testOutput = "";
  try {
    const result = await execFileAsync(process.execPath, ["--test", testPath], {
      cwd: workspace,
      timeout: 10_000,
      maxBuffer: 256_000,
      env: { ...process.env, NODE_ENV: "test" },
    });
    testOutput = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  } catch (error) {
    const details = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join("\n");
    if (process.env.FDE_DEMO_KEEP_WORKSPACES !== "true") {
      await rm(workspace, { recursive: true, force: true });
    }
    throw new Error(`Demo sandbox tests failed. ${details}`);
  }

  markStep(
    "tests-passed",
    "Automated evidence collected",
    "Fixed smoke tests verified that the prototype carries the client ask, required fields, and human-control policy.",
  );
  markStep(
    "approval-ready",
    "Human approvals prepared",
    `The package requires ${scenario.approvals.join(", ")} before promotion.`,
    "ready",
  );

  const changedFiles = await Promise.all([
    describeFile(workspace, previewPath, "Working workflow prototype"),
    describeFile(workspace, appPath, "Structured delivery-run metadata"),
    describeFile(workspace, acceptancePath, "Acceptance and policy evidence"),
    describeFile(workspace, testPath, "Automated smoke tests"),
    describeFile(workspace, promotionPath, "Reviewable pull-request package"),
  ]);

  markStep(
    "promotion-package",
    "PR promotion package created",
    "FDE-Toolkit produced a branch name, commit message, PR body, changed-file manifest, tests, and approval checklist.",
    "ready",
  );

  const result = {
    runId,
    scenario: input.scenario,
    clientAsk: input.clientAsk,
    providers: {
      codingAgent: input.codingAgentId,
      sandbox: input.sandboxId,
      sourceControl: input.sourceControlId,
    },
    policyProfile: acceptance.policy,
    steps,
    cycleTimeMs: Date.now() - startedAt,
    previewHtml,
    testOutput: testOutput || "All demo smoke tests passed.",
    promotionPackage: {
      ...promotion,
      changedFiles,
      testSummary: "All fixed smoke tests passed in the ephemeral local workspace.",
    },
    disclaimer:
      "This demo validates the orchestration contract and promotion workflow. The local workspace is not a production security sandbox and the deterministic agent is not a substitute for Codex, Claude Code, Cursor, or a customer coding agent.",
  };

  if (process.env.FDE_DEMO_KEEP_WORKSPACES !== "true") {
    await rm(workspace, { recursive: true, force: true });
  } else {
    result.workspace = workspace;
    result.previewSource = await readFile(previewPath, "utf8");
  }

  return result;
}
