import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const scenarios = {
  "enterprise-ai": {
    name: "Enterprise AI exception-review workflow",
    eyebrow: "Governed enterprise workflow",
    approvals: ["Client approver", "Product owner", "Engineering reviewer"],
    reusableArtifact: "Exception-review workspace pattern",
  },
  "saas-design-partner": {
    name: "SaaS design-partner productization workflow",
    eyebrow: "Customer learning to core product",
    approvals: ["Design partner", "Product owner", "Engineering reviewer"],
    reusableArtifact: "Design-partner productization pattern",
  },
  "si-delivery": {
    name: "Systems-integrator delivery evidence workflow",
    eyebrow: "Repeatable multi-client delivery",
    approvals: ["Client approver", "Engagement lead", "Engineering reviewer"],
    reusableArtifact: "SI engagement evidence pattern",
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

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeWorkspace(input) {
  const root = resolve(process.env.FDE_WORKSPACE_ROOT || "/workspaces");
  const workspace = resolve(input?.workspace?.mountPath || "");
  if (!workspace || (workspace !== root && !workspace.startsWith(`${root}${sep}`))) {
    throw new Error("A prepared workspace inside FDE_WORKSPACE_ROOT is required.");
  }
  return workspace;
}

function safeFile(workspace, relativePath) {
  const file = resolve(workspace, relativePath);
  if (file !== workspace && !file.startsWith(`${workspace}${sep}`)) throw new Error("Unsafe workspace file path.");
  return file;
}

function page({ scenario, intent, runId }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(scenario.name)}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="topbar">
    <div><p class="eyebrow">${escapeHtml(scenario.eyebrow)}</p><h1>Client Review Portal</h1></div>
    <span class="status">Preview ready · approval required</span>
  </header>
  <main class="shell">
    <section class="hero">
      <div>
        <p class="eyebrow">Change ${escapeHtml(runId)}</p>
        <h2>${escapeHtml(intent)}</h2>
        <p class="summary">This release candidate was produced inside the configured FDE workspace and remains isolated from production until the approval workflow completes.</p>
      </div>
      <button id="reviewButton">Review candidate</button>
    </section>
    <section class="grid">
      <article><span>Client intent</span><strong>${escapeHtml(intent)}</strong></article>
      <article><span>Repository</span><strong>Bound to workspace configuration</strong></article>
      <article><span>Evidence</span><strong>Files, commands and tests observed</strong></article>
      <article><span>Promotion</span><strong>Draft pull request after approval</strong></article>
    </section>
    <section id="reviewPanel" class="panel" hidden>
      <h3>Client acceptance</h3>
      <p>Review this working candidate, then return to FDE-Toolkit to approve, reject, or request another iteration.</p>
      <div class="actions"><button class="secondary">Request changes</button><button>Accept preview</button></div>
    </section>
  </main>
  <script src="./app.js"></script>
</body>
</html>`;
}

const styles = `:root{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:#0f172a;background:#f8fafc}*{box-sizing:border-box}body{margin:0;min-height:100vh}.topbar{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:24px 6vw;border-bottom:1px solid #e2e8f0;background:#fff}.topbar h1{margin:4px 0 0;font-size:22px}.eyebrow{margin:0;color:#0891b2;font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}.status{border:1px solid #67e8f9;background:#ecfeff;color:#155e75;border-radius:999px;padding:8px 12px;font-size:12px;font-weight:700}.shell{max-width:1080px;margin:0 auto;padding:48px 24px}.hero{display:grid;grid-template-columns:1fr auto;align-items:end;gap:32px;padding:32px;border-radius:24px;color:#fff;background:linear-gradient(135deg,#0f172a,#155e75)}.hero h2{margin:10px 0;font-size:32px;max-width:760px;line-height:1.2}.summary{margin:0;max-width:700px;color:#cbd5e1;line-height:1.7}button{border:0;border-radius:12px;background:#22d3ee;color:#083344;padding:12px 18px;font-weight:800;cursor:pointer}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:24px}.grid article{min-height:130px;border:1px solid #e2e8f0;border-radius:18px;background:#fff;padding:22px;box-shadow:0 10px 30px rgba(15,23,42,.04)}.grid span{display:block;color:#64748b;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.grid strong{display:block;margin-top:14px;font-size:17px;line-height:1.45}.panel{margin-top:24px;border:1px solid #bae6fd;border-radius:18px;background:#ecfeff;padding:24px}.actions{display:flex;justify-content:flex-end;gap:10px}.secondary{border:1px solid #cbd5e1;background:#fff;color:#334155}@media(max-width:720px){.hero{grid-template-columns:1fr;align-items:start}.grid{grid-template-columns:1fr}.topbar{align-items:flex-start;flex-direction:column}}`;

const appSource = `const button=document.querySelector('#reviewButton');const panel=document.querySelector('#reviewPanel');button?.addEventListener('click',()=>{if(!panel)return;panel.hidden=!panel.hidden;button.textContent=panel.hidden?'Review candidate':'Close review';});\n`;

async function observedWrite(workspace, relativePath, content, purpose, changes) {
  const path = safeFile(workspace, relativePath);
  const previous = await readFile(path).catch(() => null);
  await mkdir(dirname(path), { recursive: true });
  const buffer = Buffer.from(content, "utf8");
  await writeFile(path, buffer);
  changes.push({
    path: relativePath.replaceAll("\\", "/"),
    operation: previous ? "modified" : "added",
    bytes: buffer.length,
    sha256: sha256(buffer),
    ...(previous ? { previousSha256: sha256(previous) } : {}),
    purpose,
  });
}

export async function runWorkspaceDemoExecution(input) {
  const scenario = scenarios[input?.scenario];
  if (!scenario) throw new Error("Unsupported orchestration scenario.");
  const intent = String(input.intent || input.clientAsk || "").trim();
  if (intent.length < 20) throw new Error("A concrete change request of at least 20 characters is required.");
  const workspace = safeWorkspace(input);
  const startedAt = Date.now();
  const runId = `fde-${randomUUID().slice(0, 8)}`;
  const changes = [];
  const commands = [];
  const steps = [];
  const mark = (id, label, detail, status = "completed") => steps.push({ id, label, detail, status, durationMs: 0 });
  const requiredApprovals = Array.isArray(input.requiredApprovals) && input.requiredApprovals.length
    ? input.requiredApprovals
    : scenario.approvals;
  const previewHtml = page({ scenario, intent, runId });

  mark("workspace-bound", "Workspace and repository bound", "The request was attached to the configured repository, sandbox and approval workflow.");
  await observedWrite(workspace, "index.html", previewHtml, "Client-facing preview candidate", changes);
  await observedWrite(workspace, "styles.css", styles, "Responsive product styling", changes);
  await observedWrite(workspace, "app.js", appSource, "Preview interaction", changes);
  await observedWrite(workspace, "fde-run.json", `${JSON.stringify({ runId, intent, scenario: input.scenario, requiredApprovals }, null, 2)}\n`, "Governed run metadata", changes);
  const testSource = `import test from "node:test";\nimport assert from "node:assert/strict";\nimport { readFile } from "node:fs/promises";\nconst html=await readFile(new URL("../index.html",import.meta.url),"utf8");\nconst metadata=JSON.parse(await readFile(new URL("../fde-run.json",import.meta.url),"utf8"));\ntest("candidate contains client intent",()=>assert.ok(html.includes(${JSON.stringify(escapeHtml(intent))})));\ntest("promotion remains approval gated",()=>assert.ok(metadata.requiredApprovals.length>0));\ntest("candidate exposes client review",()=>assert.match(html,/Client acceptance/));\n`;
  await observedWrite(workspace, "tests/fde-preview.test.mjs", testSource, "Preview acceptance tests", changes);
  mark("candidate-generated", "Candidate change generated", "The configured agent driver wrote a working change into the prepared repository workspace.");

  const commandStartedAt = Date.now();
  const execution = await execFileAsync(process.execPath, ["--test", "--test-reporter=spec", "tests/fde-preview.test.mjs"], {
    cwd: workspace,
    timeout: 15_000,
    maxBuffer: 512_000,
    env: { PATH: process.env.PATH, NODE_ENV: "test" },
  });
  const testOutput = [execution.stdout, execution.stderr].filter(Boolean).join("\n").trim();
  commands.push({
    argv: ["node", "--test", "--test-reporter=spec", "tests/fde-preview.test.mjs"],
    exitCode: 0,
    durationMs: Date.now() - commandStartedAt,
    stdoutSha256: sha256(testOutput),
  });
  mark("tests-passed", "Preview tests passed", "FDE instrumentation captured the command, exit code, output digest and resulting file hashes.");
  mark("client-review", "Preview released for client review", "The candidate can now be reviewed and iterated before any source-control promotion.", "ready");
  mark("promotion-ready", "Promotion package prepared", "After all approvals, FDE can commit the observed files and open a draft pull request.", "ready");

  const branchName = `fde/${String(scenario.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42)}-${runId.slice(-4)}`;
  return {
    runId,
    scenario: input.scenario,
    clientAsk: intent,
    providers: { codingAgent: input.driverId || input.codingAgentId, sandbox: input.sandboxId, sourceControl: input.sourceControlId },
    policyProfile: {
      humanApprovalRequired: true,
      networkAccess: input.policy?.networkAccess || "disabled",
      arbitraryCommands: "disabled",
      secretsInjected: Boolean(Object.keys(input.secretRefs || {}).length),
      workspaceRetention: "until-promotion-or-expiry",
    },
    executionBoundary: process.env.FDE_EXECUTION_BOUNDARY || "separate-container",
    steps,
    cycleTimeMs: Date.now() - startedAt,
    previewHtml,
    testOutput,
    observedDiff: changes.map(({ purpose, ...change }) => change),
    provenance: {
      formatVersion: "1.0",
      capturedBy: "fde-execution-plane",
      trustModel: "observed-not-self-reported",
      observedAt: new Date().toISOString(),
      filesystemDiff: changes.map(({ purpose, ...change }) => change),
      commands,
      tests: [{ name: "FDE preview acceptance suite", passed: true, outputSha256: sha256(testOutput) }],
    },
    promotionPackage: {
      title: `${scenario.name}: ${intent.slice(0, 80)}`,
      branchName,
      commitMessage: `feat: deliver ${intent.slice(0, 72)}`,
      body: ["## Client request", intent, "", "## Observed evidence", `- ${changes.length} files observed`, "- Preview acceptance tests passed", "- Human approvals remain required", "", "## Required approvals", ...requiredApprovals.map((approval) => `- [ ] ${approval}`)].join("\n"),
      changedFiles: changes.map((change) => ({ path: change.path, bytes: change.bytes, purpose: change.purpose })),
      approvalsRequired: requiredApprovals,
      evidence: ["Original client request", "Observed filesystem diff", "Observed test command", "Preview acceptance result"],
      testSummary: "3 preview acceptance tests passed inside the prepared workspace.",
    },
    workspace: { mountPath: workspace },
    disclaimer: "The public fallback uses the deterministic FDE driver. When Codex is configured, the same prepared repository and evidence pipeline invokes codex exec with workspace-write permissions.",
  };
}
