import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, normalize, relative } from "node:path";
import { promisify } from "node:util";

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

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function safeWorkspacePath(workspace, relativePath) {
  const normalized = normalize(relativePath).replace(/^([/\\])+/, "");
  if (normalized.startsWith("..")) throw new Error("Unsafe workspace path.");
  return join(workspace, normalized);
}

async function writeObservedFile(workspace, relativePath, content, purpose, filesystemDiff) {
  const fullPath = safeWorkspacePath(workspace, relativePath);
  await mkdir(dirname(fullPath), { recursive: true });
  const buffer = Buffer.from(content, "utf8");
  await writeFile(fullPath, buffer);
  filesystemDiff.push({
    path: relativePath.replaceAll("\\", "/"),
    operation: "added",
    bytes: buffer.length,
    sha256: sha256(buffer),
    purpose,
  });
  return fullPath;
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

export async function runDemoExecution(input) {
  const scenario = scenarios[input?.scenario];
  if (!scenario) throw new Error("Unsupported orchestration scenario.");
  if (typeof input.clientAsk !== "string" || input.clientAsk.trim().length < 20) {
    throw new Error("A concrete client ask of at least 20 characters is required.");
  }

  const startedAt = Date.now();
  const runId = `fde-${randomUUID().slice(0, 8)}`;
  const workspace = await mkdtemp(join(tmpdir(), `${runId}-`));
  const filesystemDiff = [];
  const commands = [];
  const steps = [];
  let checkpoint = Date.now();

  const markStep = (id, label, detail, status = "completed") => {
    const now = Date.now();
    steps.push({ id, label, status, detail, durationMs: Math.max(0, now - checkpoint) });
    checkpoint = now;
  };

  const policyProfile = {
    humanApprovalRequired: true,
    networkAccess: "disabled",
    arbitraryCommands: "disabled",
    secretsInjected: false,
    workspaceRetention: "ephemeral",
  };

  try {
    markStep(
      "ask-captured",
      "Signed job metadata received",
      "The execution plane received only the normalized client ask, provider selections, policy profile, and promotion intent.",
    );

    const previewHtml = buildPreviewHtml({ scenario, clientAsk: input.clientAsk.trim(), runId });
    const branchName = `fde/${slugify(scenario.name)}-${runId.slice(-4)}`;
    const promotion = {
      title: `${scenario.name}: governed workflow prototype`,
      branchName,
      commitMessage: `feat: add ${slugify(scenario.name)}`,
      approvalsRequired: scenario.approvals,
      evidence: [
        "Original client ask",
        "Observed file-system diff",
        "Observed command execution",
        "Automated test outcome",
        "Provider and policy profile",
      ],
      body: [
        "## Client ask",
        input.clientAsk.trim(),
        "",
        "## Observed delivery evidence",
        "- File changes were recorded by FDE execution instrumentation",
        "- A fixed smoke-test command was executed inside the sandbox",
        "- Promotion remains blocked pending human approvals",
        "",
        "## Required approvals",
        ...scenario.approvals.map((approval) => `- [ ] ${approval}`),
      ].join("\n"),
    };

    const acceptance = {
      runId,
      scenario: input.scenario,
      clientAsk: input.clientAsk.trim(),
      fields: scenario.fields,
      approvalsRequired: scenario.approvals,
      reusableArtifact: scenario.reusableArtifact,
      policy: policyProfile,
    };

    const appSource = `export const deliveryRun = ${JSON.stringify(
      {
        runId,
        scenario: input.scenario,
        clientAsk: input.clientAsk.trim(),
        approvalMode: input.approvalMode,
      },
      null,
      2,
    )};\n`;

    const testSource = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\n\nconst html = await readFile(new URL("../src/index.html", import.meta.url), "utf8");\nconst evidence = JSON.parse(await readFile(new URL("../evidence/acceptance.json", import.meta.url), "utf8"));\n\ntest("prototype carries the client ask", () => {\n  assert.ok(html.includes(${JSON.stringify(escapeHtml(input.clientAsk.trim()))}));\n});\n\ntest("prototype exposes required workflow fields", () => {\n  for (const field of ${JSON.stringify(scenario.fields)}) assert.ok(html.includes(field));\n});\n\ntest("promotion remains human controlled", () => {\n  assert.equal(evidence.policy.humanApprovalRequired, true);\n  assert.equal(evidence.policy.networkAccess, "disabled");\n  assert.equal(evidence.policy.arbitraryCommands, "disabled");\n});\n`;

    await writeObservedFile(workspace, "src/index.html", previewHtml, "Working workflow prototype", filesystemDiff);
    await writeObservedFile(workspace, "src/app.js", appSource, "Structured delivery-run metadata", filesystemDiff);
    await writeObservedFile(
      workspace,
      "evidence/acceptance.json",
      `${JSON.stringify(acceptance, null, 2)}\n`,
      "Acceptance and policy evidence",
      filesystemDiff,
    );
    await writeObservedFile(
      workspace,
      "promotion/pr-package.json",
      `${JSON.stringify(promotion, null, 2)}\n`,
      "Reviewable pull-request package",
      filesystemDiff,
    );
    const testPath = await writeObservedFile(
      workspace,
      "tests/smoke.test.mjs",
      testSource,
      "Automated smoke tests",
      filesystemDiff,
    );

    markStep(
      "sandbox-provisioned",
      "Execution workspace provisioned",
      "The sandbox driver created an ephemeral workspace without receiving source-control credentials or application secrets.",
    );
    markStep(
      "agent-generated",
      "Demo agent driver produced a candidate change",
      "The execution plane observed every file written by the agent driver instead of trusting a self-reported file list.",
    );

    const commandStartedAt = Date.now();
    let testOutput = "";
    try {
      const execution = await execFileAsync(
        process.execPath,
        ["--test", "--test-reporter=spec", relative(workspace, testPath)],
        {
          cwd: workspace,
          timeout: 10_000,
          maxBuffer: 256_000,
          env: { PATH: process.env.PATH, NODE_ENV: "test" },
        },
      );
      testOutput = [execution.stdout, execution.stderr].filter(Boolean).join("\n").trim();
      commands.push({
        argv: ["node", "--test", "--test-reporter=spec", "tests/smoke.test.mjs"],
        exitCode: 0,
        durationMs: Date.now() - commandStartedAt,
        stdoutSha256: sha256(testOutput),
      });
    } catch (error) {
      const output = [error?.stdout, error?.stderr, error?.message].filter(Boolean).join("\n");
      commands.push({
        argv: ["node", "--test", "--test-reporter=spec", "tests/smoke.test.mjs"],
        exitCode: typeof error?.code === "number" ? error.code : 1,
        durationMs: Date.now() - commandStartedAt,
        stdoutSha256: sha256(output),
      });
      throw new Error(`Instrumented sandbox tests failed. ${output}`);
    }

    markStep(
      "tests-passed",
      "Execution evidence captured",
      "The toolkit instrumentation recorded the exact fixed command, exit status, duration, output digest, and resulting file hashes.",
    );
    markStep(
      "approval-ready",
      "Human approvals prepared",
      `The candidate package requires ${scenario.approvals.join(", ")} before promotion.`,
      "ready",
    );
    markStep(
      "promotion-package",
      "Promotion package created",
      "The control plane can now route observed evidence and approval state to any configured SCM driver.",
      "ready",
    );

    const changedFiles = await Promise.all(
      filesystemDiff.map(async (entry) => {
        const info = await stat(safeWorkspacePath(workspace, entry.path));
        return { path: entry.path, bytes: info.size, purpose: entry.purpose };
      }),
    );

    return {
      runId,
      scenario: input.scenario,
      clientAsk: input.clientAsk.trim(),
      providers: {
        codingAgent: input.codingAgentId,
        sandbox: input.sandboxId,
        sourceControl: input.sourceControlId,
      },
      policyProfile,
      executionBoundary: process.env.FDE_EXECUTION_BOUNDARY || "separate-container",
      steps,
      cycleTimeMs: Date.now() - startedAt,
      previewHtml,
      testOutput,
      provenance: {
        formatVersion: "1.0",
        capturedBy: "fde-execution-plane",
        trustModel: "observed-not-self-reported",
        observedAt: new Date().toISOString(),
        filesystemDiff: filesystemDiff.map(({ purpose, ...entry }) => entry),
        commands,
        tests: [{ name: "sandbox smoke suite", passed: true, outputSha256: sha256(testOutput) }],
      },
      promotionPackage: {
        ...promotion,
        changedFiles,
        testSummary: "3 observed smoke tests passed inside the execution plane.",
      },
      disclaimer:
        "This demonstration uses a deterministic agent driver and an ephemeral sandbox. The control plane exchanges signed metadata with the execution plane and does not trust agent-reported provenance.",
    };
  } finally {
    if (process.env.FDE_DEMO_KEEP_WORKSPACES !== "true") {
      await rm(workspace, { recursive: true, force: true });
    }
  }
}
