import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  readFile,
  readdir,
  rename,
  stat,
  writeFile,
} from "node:fs/promises";
import { delimiter, join, relative, resolve, sep } from "node:path";
import { existsSync } from "node:fs";

export const CONTRACT_VERSION = "1.0";
export const PLATFORM_VERSION = "2026-07-15.2";

export const ZERO_HASH = "0".repeat(64);
export const FINAL_STATUSES = new Set(["completed", "failed", "cancelled"]);
export const CUSTOMER_EVENT_TYPES = new Set([
  "plan",
  "file_diff",
  "command_run",
  "test_result",
  "question",
  "usage",
  "done",
  "error",
]);

const DEFAULT_LIMITS = Object.freeze({
  timeoutMs: 15 * 60 * 1000,
  maxEvents: 10_000,
  maxOutputBytes: 32 * 1024 * 1024,
  maxCostUsd: 25,
});

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function nowIso() {
  return new Date().toISOString();
}

export function safeId(value, label = "identifier") {
  const text = String(value || "").trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(text)) {
    throw new Error(`Invalid ${label}.`);
  }
  return text;
}

export function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function cleanPath(value, maxLength = 1000) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  if (text.length > maxLength || text.includes("\0")) throw new Error("Workspace path is invalid.");
  return text;
}

export function normalizeLimits(input = {}) {
  return {
    timeoutMs: clampInteger(input.timeoutMs, DEFAULT_LIMITS.timeoutMs, 1_000, 2 * 60 * 60 * 1_000),
    maxEvents: clampInteger(input.maxEvents, DEFAULT_LIMITS.maxEvents, 1, 100_000),
    maxOutputBytes: clampInteger(input.maxOutputBytes, DEFAULT_LIMITS.maxOutputBytes, 1_024, 1024 * 1024 * 1024),
    maxCostUsd: clampNumber(input.maxCostUsd, DEFAULT_LIMITS.maxCostUsd, 0, 100_000),
  };
}

function normalizeWorkspace(input) {
  if (!input || typeof input !== "object") return null;
  return {
    sandboxId: input.sandboxId ? safeId(input.sandboxId, "workspace sandbox ID") : null,
    source: String(input.source || "sandbox").slice(0, 80),
    repository: input.repository ? String(input.repository).slice(0, 500) : null,
    baseBranch: String(input.baseBranch || "main").slice(0, 120),
    repositoryRoot: cleanPath(input.repositoryRoot),
    mountPath: cleanPath(input.mountPath),
    projectPath: String(input.projectPath || "").replace(/^[/\\]+|[/\\]+$/g, "").slice(0, 300),
    previewOutputPath: String(input.previewOutputPath || "index.html").replace(/^[/\\]+/, "").slice(0, 300),
    preparedAt: input.preparedAt || null,
  };
}

export function normalizeRequest(input = {}) {
  const clientAsk = typeof input.clientAsk === "string" ? input.clientAsk.trim() : "";
  const intent = typeof input.intent === "string" ? input.intent.trim() : clientAsk;
  if (intent.length < 20 || intent.length > 20_000) {
    throw new Error("A change intent between 20 and 20,000 characters is required.");
  }

  const tenantId = safeId(input.tenantId || "public-demo", "tenant ID");
  const driverId = safeId(input.driverId || input.codingAgentId || "fde-demo-agent", "driver ID");
  const callbackUrl = input.callbackUrl ? new URL(String(input.callbackUrl)).toString() : null;
  if (callbackUrl) {
    const url = new URL(callbackUrl);
    const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !local) throw new Error("Callback URLs must use HTTPS.");
  }

  return {
    contractVersion: CONTRACT_VERSION,
    tenantId,
    organizationId: input.organizationId ? safeId(input.organizationId, "organization ID") : tenantId,
    engagementId: input.engagementId ? safeId(input.engagementId, "engagement ID") : null,
    actor: {
      id: safeId(input.actor?.id || "control-plane", "actor ID"),
      role: safeId(input.actor?.role || "system", "actor role"),
    },
    scenario: input.scenario || null,
    intent,
    clientAsk: intent,
    repository: input.repository || null,
    baseBranch: input.baseBranch || "main",
    driverId,
    codingAgentId: driverId,
    sandboxId: safeId(input.sandboxId || "local-ephemeral", "sandbox ID"),
    sourceControlId: safeId(input.sourceControlId || "promotion-package", "source-control ID"),
    approvalMode: "human-required",
    requiredApprovals: Array.isArray(input.requiredApprovals)
      ? input.requiredApprovals.map((value) => String(value).trim()).filter(Boolean).slice(0, 25)
      : [],
    policy: {
      humanApprovalRequired: true,
      networkAccess: input.policy?.networkAccess || "disabled",
      secretAccess: input.policy?.secretAccess || "none",
      allowedTools: Array.isArray(input.policy?.allowedTools)
        ? input.policy.allowedTools.map(String).slice(0, 100)
        : ["Read", "Edit", "Bash"],
      allowedCommands: Array.isArray(input.policy?.allowedCommands)
        ? input.policy.allowedCommands.map(String).slice(0, 100)
        : [],
    },
    limits: normalizeLimits(input.limits),
    workspace: normalizeWorkspace(input.workspace),
    secretRefs: input.secretRefs && typeof input.secretRefs === "object"
      ? Object.fromEntries(Object.entries(input.secretRefs).slice(0, 50).map(([name, reference]) => {
          if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(name)) throw new Error(`Invalid secret environment key ${name}.`);
          const value = String(reference);
          if (!/^(env|vault|aws-sm|azure-kv):\/\//.test(value)) throw new Error(`Unsupported secret reference for ${name}.`);
          return [name, value];
        }))
      : {},
    callbackUrl,
    metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
  };
}

export function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

export async function atomicWrite(path, value) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

export function publicJob(job) {
  if (!job) return null;
  const { request, ...rest } = job;
  return {
    ...rest,
    request: {
      contractVersion: request.contractVersion,
      tenantId: request.tenantId,
      organizationId: request.organizationId,
      engagementId: request.engagementId,
      scenario: request.scenario,
      intent: request.intent,
      repository: request.repository,
      baseBranch: request.baseBranch,
      driverId: request.driverId,
      sandboxId: request.sandboxId,
      sourceControlId: request.sourceControlId,
      requiredApprovals: request.requiredApprovals,
      policy: request.policy,
      limits: request.limits,
      secretRefs: Object.fromEntries(Object.entries(request.secretRefs || {}).map(([name, reference]) => [name, `${String(reference).split("://")[0]}://configured`])),
      workspace: request.workspace ? {
        sandboxId: request.workspace.sandboxId,
        source: request.workspace.source,
        repository: request.workspace.repository,
        baseBranch: request.workspace.baseBranch,
        projectPath: request.workspace.projectPath,
        previewOutputPath: request.workspace.previewOutputPath,
        preparedAt: request.workspace.preparedAt,
      } : null,
      callbackUrl: request.callbackUrl,
      metadata: request.metadata,
    },
  };
}

function findExecutable(command, env = process.env) {
  if (!command) return false;
  if (command.includes("/") || command.includes("\\")) return existsSync(command);
  const pathEntries = String(env.PATH || "").split(delimiter).filter(Boolean);
  const extensions = process.platform === "win32"
    ? String(env.PATHEXT || ".EXE;.CMD;.BAT;.COM").split(";")
    : [""];
  return pathEntries.some((entry) => extensions.some((extension) => {
    try {
      const candidate = join(entry, `${command}${extension}`);
      return existsSync(candidate);
    } catch {
      return false;
    }
  }));
}

function commandFromEnv(name, fallback) {
  const configured = process.env[name];
  return configured && configured.trim() ? configured.trim() : fallback;
}

function parseArgsEnv(name, fallback) {
  const configured = process.env[name];
  if (!configured) return fallback;
  try {
    const parsed = JSON.parse(configured);
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      throw new Error("must be a JSON array of strings");
    }
    return parsed;
  } catch (error) {
    throw new Error(`${name} ${error instanceof Error ? error.message : "is invalid"}.`);
  }
}

export function getDriverCatalog() {
  const codexCommand = commandFromEnv("FDE_CODEX_COMMAND", "codex");
  const claudeCommand = commandFromEnv("FDE_CLAUDE_COMMAND", "claude");
  const cursorCommand = commandFromEnv("FDE_CURSOR_COMMAND", "");
  return [
    {
      id: "fde-demo-agent",
      version: "1.0.0",
      name: "FDE deterministic demo driver",
      vendor: "FDE-Toolkit",
      protocol: "in-process",
      status: "available",
      capabilities: ["plan", "file-diffs", "command-events", "test-events", "structured-output", "preview-output"],
      deploymentModes: ["toolkit-cloud", "client-vpc", "air-gapped", "local"],
    },
    {
      id: "openai-codex",
      version: "1.0.0",
      name: "OpenAI Codex CLI",
      vendor: "OpenAI",
      protocol: "process-jsonl",
      status: findExecutable(codexCommand) ? "configured" : "requires-runtime",
      command: codexCommand,
      capabilities: ["plan", "streaming-events", "file-diffs", "command-events", "usage", "session-resume", "mcp", "preview-output"],
      deploymentModes: ["client-vpc", "air-gapped", "local"],
    },
    {
      id: "claude-agent",
      version: "1.0.0",
      name: "Claude Agent CLI",
      vendor: "Anthropic",
      protocol: "process-jsonl",
      status: findExecutable(claudeCommand) ? "configured" : "requires-runtime",
      command: claudeCommand,
      capabilities: ["plan", "streaming-events", "file-diffs", "command-events", "clarifying-questions", "usage", "session-resume", "mcp", "preview-output"],
      deploymentModes: ["client-vpc", "local"],
    },
    {
      id: "cursor-agent",
      version: "1.0.0",
      name: "Cursor Agent CLI adapter",
      vendor: "Cursor",
      protocol: "process-jsonl",
      status: cursorCommand ? "configured" : "requires-command-contract",
      command: cursorCommand || null,
      capabilities: ["streaming-events", "file-diffs", "command-events", "preview-output"],
      deploymentModes: ["client-vpc", "local"],
    },
    {
      id: "customer-agent-gateway",
      version: "1.0.0",
      name: "Signed customer-agent gateway",
      vendor: "Customer managed",
      protocol: "signed-webhook",
      status: "available",
      capabilities: ["streaming-events", "file-diffs", "command-events", "test-events", "clarifying-questions", "cost-reporting", "customer-hosted"],
      deploymentModes: ["client-vpc", "air-gapped"],
    },
  ];
}

async function snapshotWorkspace(root, maxEntries = 20_000) {
  const snapshot = new Map();
  const ignored = new Set([".git", "node_modules", ".next", "dist", "build"]);
  let entries = 0;

  async function walk(directory) {
    const dirents = await readdir(directory, { withFileTypes: true });
    for (const dirent of dirents) {
      if (ignored.has(dirent.name) || dirent.isSymbolicLink()) continue;
      entries += 1;
      if (entries > maxEntries) throw new Error("Workspace exceeds the instrumentation file limit.");
      const fullPath = join(directory, dirent.name);
      if (dirent.isDirectory()) {
        await walk(fullPath);
      } else if (dirent.isFile()) {
        const content = await readFile(fullPath);
        snapshot.set(relative(root, fullPath).replaceAll("\\", "/"), {
          bytes: content.length,
          sha256: sha256(content),
        });
      }
    }
  }

  await walk(root);
  return snapshot;
}

function diffWorkspace(before, after) {
  const paths = new Set([...before.keys(), ...after.keys()]);
  return [...paths].sort().flatMap((path) => {
    const previous = before.get(path);
    const current = after.get(path);
    if (!previous && current) return [{ path, operation: "added", ...current }];
    if (previous && !current) return [{ path, operation: "deleted", bytes: 0, sha256: ZERO_HASH, previousSha256: previous.sha256 }];
    if (previous.sha256 !== current.sha256) return [{ path, operation: "modified", ...current, previousSha256: previous.sha256 }];
    return [];
  });
}

function parseJsonLines(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { type: "raw", text: line };
      }
    });
}

function mapAgentEvent(driverId, rawEvent) {
  if (driverId === "openai-codex") {
    if (rawEvent.type === "item.completed" && rawEvent.item?.type === "command_execution") {
      return { type: "command_run", payload: rawEvent.item };
    }
    if (rawEvent.type === "item.completed" && ["file_change", "file_diff"].includes(rawEvent.item?.type)) {
      return { type: "file_diff", payload: rawEvent.item };
    }
    if (rawEvent.type === "turn.completed") return { type: "usage", payload: rawEvent.usage || {} };
    if (rawEvent.type === "error" || rawEvent.type === "turn.failed") return { type: "error", payload: rawEvent };
    return { type: "plan", payload: rawEvent };
  }

  if (driverId === "claude-agent") {
    if (rawEvent.type === "result") {
      return {
        type: "usage",
        payload: {
          sessionId: rawEvent.session_id,
          totalCostUsd: rawEvent.total_cost_usd,
          usage: rawEvent.usage,
          result: rawEvent.result,
        },
      };
    }
    if (rawEvent.type === "tool_use" || rawEvent.type === "tool_result") {
      return { type: "command_run", payload: rawEvent };
    }
    if (rawEvent.type === "assistant") return { type: "plan", payload: rawEvent };
    return { type: "plan", payload: rawEvent };
  }

  return { type: rawEvent.type && CUSTOMER_EVENT_TYPES.has(rawEvent.type) ? rawEvent.type : "plan", payload: rawEvent };
}

function allowedChildEnv(driverId, runtimeSecrets = {}) {
  const names = new Set(["PATH", "HOME", "TMPDIR", "TEMP", "TMP", "LANG", "LC_ALL", "NODE_ENV"]);
  if (driverId === "openai-codex") names.add("CODEX_API_KEY");
  if (driverId === "claude-agent") {
    names.add("ANTHROPIC_API_KEY");
    names.add("CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS");
  }
  if (driverId === "cursor-agent") names.add("CURSOR_API_KEY");
  const inherited = Object.fromEntries([...names].filter((name) => process.env[name] !== undefined).map((name) => [name, process.env[name]]));
  return { ...inherited, ...runtimeSecrets };
}

function resolveWorkspacePath(request) {
  const requested = request.workspace?.mountPath;
  if (!requested) throw new Error("A sandbox-provided workspace.mountPath is required for an external agent driver.");
  const root = resolve(process.env.FDE_WORKSPACE_ROOT || "/workspaces");
  const workspace = resolve(requested);
  if (workspace !== root && !workspace.startsWith(`${root}${sep}`)) {
    throw new Error("The workspace path is outside FDE_WORKSPACE_ROOT.");
  }
  return workspace;
}

function agentPrompt(request) {
  const previewPath = request.workspace?.previewOutputPath || "index.html";
  return [
    request.intent,
    "",
    "FDE execution requirements:",
    `- Work only inside the current repository workspace.`,
    `- Produce a client-reviewable application preview at ${previewPath}.`,
    "- Run the repository's relevant tests or add a focused test when none exists.",
    "- Do not deploy, merge, push, or create a pull request.",
    "- Do not print credentials or secret values.",
    "- Leave the workspace in a reviewable state; FDE will independently observe files, commands, and evidence.",
  ].join("\n");
}

function commandSpec(request) {
  const prompt = agentPrompt(request);
  if (request.driverId === "openai-codex") {
    return {
      command: commandFromEnv("FDE_CODEX_COMMAND", "codex"),
      args: [
        "exec",
        "--ephemeral",
        "--sandbox",
        "workspace-write",
        "--json",
        "--ignore-user-config",
        prompt,
      ],
    };
  }
  if (request.driverId === "claude-agent") {
    const allowedTools = request.policy.allowedTools.join(",");
    return {
      command: commandFromEnv("FDE_CLAUDE_COMMAND", "claude"),
      args: [
        "--bare",
        "-p",
        prompt,
        "--output-format",
        "stream-json",
        "--verbose",
        "--allowedTools",
        allowedTools,
        "--permission-mode",
        "acceptEdits",
      ],
    };
  }
  if (request.driverId === "cursor-agent") {
    const command = commandFromEnv("FDE_CURSOR_COMMAND", "");
    if (!command) throw new Error("FDE_CURSOR_COMMAND must be configured for the Cursor adapter.");
    const args = parseArgsEnv("FDE_CURSOR_ARGS_JSON", [prompt]).map((arg) => arg.replaceAll("{{intent}}", prompt));
    return { command, args };
  }
  throw new Error(`Unsupported command driver ${request.driverId}.`);
}

function safePreviewPath(workspace, relativePath) {
  const candidate = resolve(workspace, String(relativePath || "index.html"));
  if (candidate !== workspace && !candidate.startsWith(`${workspace}${sep}`)) throw new Error("Unsafe preview output path.");
  return candidate;
}

async function loadPreviewHtml(workspace, request) {
  const candidates = [
    request.workspace?.previewOutputPath,
    "index.html",
    "src/index.html",
    "dist/index.html",
    "build/index.html",
  ].filter(Boolean);
  for (const candidate of [...new Set(candidates)]) {
    const path = safePreviewPath(workspace, candidate);
    const info = await stat(path).catch(() => null);
    if (!info?.isFile() || info.size > 2 * 1024 * 1024) continue;
    return { html: await readFile(path, "utf8"), path: String(candidate).replaceAll("\\", "/") };
  }
  return { html: null, path: null };
}

function promotionPackage(request, observedDiff, previewPath) {
  const approvals = request.requiredApprovals.length ? request.requiredApprovals : ["Client approver", "Product owner", "Engineering reviewer"];
  const title = `FDE governed change: ${request.intent.slice(0, 90)}`;
  return {
    title,
    branchName: `fde/${request.metadata?.workspaceId || "workspace"}-${randomUUID().slice(0, 6)}`,
    commitMessage: `feat: ${request.intent.slice(0, 72)}`,
    body: [
      "## Client request",
      request.intent,
      "",
      "## Observed execution",
      `- Driver: ${request.driverId}`,
      `- Files changed: ${observedDiff.length}`,
      `- Preview output: ${previewPath || "not detected"}`,
      "- Promotion remains blocked pending human approval",
      "",
      "## Required approvals",
      ...approvals.map((approval) => `- [ ] ${approval}`),
    ].join("\n"),
    changedFiles: observedDiff.map((change) => ({ path: change.path, bytes: change.bytes, purpose: "Observed agent workspace change" })),
    approvalsRequired: approvals,
    evidence: ["Original client request", "Observed filesystem diff", "Observed agent process", "Agent event stream"],
    testSummary: "Review observed command and agent events before approval.",
  };
}

export async function runCommandDriver(request, emit, runtimeSecrets = {}) {
  const runId = `fde-${randomUUID().slice(0, 8)}`;
  const startedAt = Date.now();
  const workspace = resolveWorkspacePath(request);
  const workspaceInfo = await stat(workspace).catch(() => null);
  if (!workspaceInfo?.isDirectory()) throw new Error("The sandbox workspace does not exist.");
  const { command, args } = commandSpec(request);
  if (!findExecutable(command)) throw new Error(`Agent command ${command} is not available in the execution runtime.`);

  const beforeSnapshot = await snapshotWorkspace(workspace);
  const commandStartedAt = Date.now();
  const child = spawn(command, args, {
    cwd: workspace,
    env: allowedChildEnv(request.driverId, runtimeSecrets),
    shell: false,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";
  let totalBytes = 0;
  const timeout = setTimeout(() => child.kill("SIGKILL"), request.limits.timeoutMs);

  const consume = (chunk, target) => {
    totalBytes += chunk.length;
    if (totalBytes > request.limits.maxOutputBytes) {
      child.kill("SIGKILL");
      return target;
    }
    return target + chunk.toString("utf8");
  };

  child.stdout.on("data", (chunk) => { stdout = consume(chunk, stdout); });
  child.stderr.on("data", (chunk) => { stderr = consume(chunk, stderr); });

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("close", (code) => resolveExit(code ?? 1));
  }).finally(() => clearTimeout(timeout));

  const afterSnapshot = await snapshotWorkspace(workspace);
  const observedDiff = diffWorkspace(beforeSnapshot, afterSnapshot);
  for (const file of observedDiff) await emit({ type: "file_diff", payload: file });
  const observedCommand = {
    argv: [command, ...args],
    exitCode,
    durationMs: Date.now() - commandStartedAt,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    capturedBy: "fde-execution-plane",
  };
  await emit({ type: "command_run", payload: observedCommand });

  if (totalBytes > request.limits.maxOutputBytes) throw new Error("Agent output exceeded maxOutputBytes.");
  const rawEvents = parseJsonLines(stdout);
  if (rawEvents.length + observedDiff.length + 1 > request.limits.maxEvents) throw new Error("Agent output exceeded maxEvents.");
  const mappedEvents = rawEvents.map((rawEvent) => mapAgentEvent(request.driverId, rawEvent));
  for (const event of mappedEvents) await emit(event);
  if (exitCode !== 0) throw new Error(`Agent driver exited with code ${exitCode}. ${stderr.slice(-4000)}`);

  const usage = mappedEvents.filter((event) => event.type === "usage").map((event) => event.payload).at(-1) || {};
  const costUsd = Number(usage.totalCostUsd ?? usage.total_cost_usd ?? 0) || 0;
  if (costUsd > request.limits.maxCostUsd) throw new Error("Agent-reported cost exceeded maxCostUsd.");
  const preview = await loadPreviewHtml(workspace, request);
  const tests = mappedEvents
    .filter((event) => event.type === "test_result")
    .map((event, index) => ({ name: event.payload?.name || `Agent test ${index + 1}`, passed: event.payload?.passed !== false, outputSha256: sha256(stableJson(event.payload || {})) }));

  return {
    runId,
    scenario: request.scenario,
    clientAsk: request.intent,
    providers: { codingAgent: request.driverId, sandbox: request.sandboxId, sourceControl: request.sourceControlId },
    policyProfile: {
      humanApprovalRequired: true,
      networkAccess: request.policy.networkAccess,
      arbitraryCommands: request.policy.allowedCommands.length ? "allowlisted" : "agent-sandboxed",
      secretsInjected: Object.keys(runtimeSecrets).length > 0,
      workspaceRetention: "until-promotion-or-expiry",
    },
    executionBoundary: process.env.FDE_EXECUTION_BOUNDARY || "separate-container",
    steps: [
      { id: "workspace-bound", label: "Workspace and repository bound", status: "completed", detail: "The configured sandbox workspace became the agent working directory.", durationMs: 0 },
      { id: "agent-finished", label: `${request.driverId} completed`, status: "completed", detail: "FDE captured the agent process and independently observed repository changes.", durationMs: observedCommand.durationMs },
      { id: "preview-ready", label: "Preview output collected", status: preview.html ? "completed" : "ready", detail: preview.html ? `Preview collected from ${preview.path}.` : "No static preview output was detected; review the file evidence.", durationMs: 0 },
      { id: "approval-ready", label: "Human approval required", status: "ready", detail: "The observed change cannot be promoted until the configured approval workflow completes.", durationMs: 0 },
    ],
    cycleTimeMs: Date.now() - startedAt,
    previewHtml: preview.html,
    previewPath: preview.path,
    testOutput: tests.length ? `${tests.length} structured test events reported.` : "Inspect observed command events and repository tests before approval.",
    observedDiff,
    provenance: {
      formatVersion: "1.0",
      capturedBy: "fde-execution-plane",
      trustModel: "observed-not-self-reported",
      observedAt: nowIso(),
      filesystemDiff: observedDiff,
      commands: [observedCommand],
      tests,
    },
    promotionPackage: promotionPackage(request, observedDiff, preview.path),
    workspace: { source: request.workspace?.source, repository: request.workspace?.repository, projectPath: request.workspace?.projectPath },
    driverId: request.driverId,
    exitCode,
    stdoutSha256: sha256(stdout),
    stderrSha256: sha256(stderr),
    eventCount: rawEvents.length,
    usage,
    costUsd,
    disclaimer: "FDE-Toolkit independently observed repository changes and process execution. Agent event streams are supplemental evidence, not the source of truth.",
  };
}
