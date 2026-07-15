import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { nowIso, safeId } from "./platform-runtime.mjs";

async function atomicWrite(path, value) {
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, value, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, path);
}

function string(value, fallback = "", max = 500) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function approvalWorkflow(input) {
  const source = Array.isArray(input) && input.length
    ? input
    : [
        { key: "client-approval", label: "Client approver", role: "client-approver", required: true },
        { key: "product-approval", label: "Product owner", role: "product-owner", required: true },
        { key: "engineering-approval", label: "Engineering reviewer", role: "engineering-reviewer", required: true },
      ];
  const seen = new Set();
  return source.slice(0, 12).map((entry, index) => {
    let key = string(entry?.key, `approval-${index + 1}`, 80)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-|-$/g, "");
    if (!key) key = `approval-${index + 1}`;
    while (seen.has(key)) key = `${key}-${index + 1}`;
    seen.add(key);
    return {
      key,
      label: string(entry?.label, `Approval ${index + 1}`, 120),
      role: string(entry?.role, "approver", 80),
      required: entry?.required !== false,
    };
  });
}

function normalizeWorkspace(input = {}, existing = null) {
  const tenantId = safeId(input.tenantId || existing?.tenantId || "public-demo", "tenant ID");
  const id = safeId(input.id || existing?.id || `ws-${randomUUID().slice(0, 12)}`, "workspace ID");
  const current = existing || {};
  const timestamp = nowIso();
  const repository = input.repository || {};
  const github = input.github || {};
  const sandbox = input.sandbox || {};
  const agent = input.agent || {};
  const preview = input.preview || {};

  return {
    id,
    tenantId,
    organizationId: safeId(input.organizationId || current.organizationId || tenantId, "organization ID"),
    name: string(input.name, current.name || "Client delivery workspace", 160),
    description: string(input.description, current.description || "Governed code-to-production workspace", 1000),
    status: input.status || current.status || "active",
    repository: {
      provider: "github",
      fullName: string(repository.fullName, current.repository?.fullName || "amitvikram/FDE-Toolkit-New", 240),
      url: string(repository.url, current.repository?.url || "https://github.com/amitvikram/FDE-Toolkit-New", 500),
      baseBranch: string(repository.baseBranch, current.repository?.baseBranch || "main", 120),
      projectPath: string(repository.projectPath, current.repository?.projectPath || "examples/client-review-portal", 300),
      connected: repository.connected ?? current.repository?.connected ?? false,
    },
    github: {
      installationId: string(github.installationId, current.github?.installationId || "", 80) || null,
      accountLogin: string(github.accountLogin, current.github?.accountLogin || "", 160) || null,
      connectedAt: github.connectedAt || current.github?.connectedAt || null,
      repositories: Array.isArray(github.repositories)
        ? github.repositories.slice(0, 200).map((value) => string(value, "", 240)).filter(Boolean)
        : current.github?.repositories || [],
    },
    agent: {
      driverId: string(agent.driverId, current.agent?.driverId || "fde-demo-agent", 120),
      model: string(agent.model, current.agent?.model || "", 120) || null,
      secretRef: string(agent.secretRef, current.agent?.secretRef || "env://CODEX_API_KEY", 300),
    },
    sandbox: {
      driverId: string(sandbox.driverId, current.sandbox?.driverId || "local-ephemeral", 120),
      image: string(sandbox.image, current.sandbox?.image || "node:22-alpine", 240),
      cpu: number(sandbox.cpu, current.sandbox?.cpu || 1, 0.1, 32),
      memoryMb: Math.trunc(number(sandbox.memoryMb, current.sandbox?.memoryMb || 1024, 128, 131072)),
      workspaceSizeMb: Math.trunc(number(sandbox.workspaceSizeMb, current.sandbox?.workspaceSizeMb || 2048, 64, 262144)),
      timeoutSeconds: Math.trunc(number(sandbox.timeoutSeconds, current.sandbox?.timeoutSeconds || 1800, 60, 86400)),
      networkPolicy: sandbox.networkPolicy || current.sandbox?.networkPolicy || "disabled",
      namespace: string(sandbox.namespace, current.sandbox?.namespace || "fde-execution", 120),
      activeSandboxId: sandbox.activeSandboxId ?? current.sandbox?.activeSandboxId ?? null,
    },
    prepared: input.prepared ?? current.prepared ?? null,
    preview: {
      buildCommand: string(preview.buildCommand, current.preview?.buildCommand || "", 500),
      startCommand: string(preview.startCommand, current.preview?.startCommand || "", 500),
      outputPath: string(preview.outputPath, current.preview?.outputPath || "index.html", 300),
      port: Math.trunc(number(preview.port, current.preview?.port || 3000, 1, 65535)),
      healthPath: string(preview.healthPath, current.preview?.healthPath || "/", 200),
    },
    approvals: approvalWorkflow(input.approvals || current.approvals),
    production: {
      createDraftPullRequest: input.production?.createDraftPullRequest ?? current.production?.createDraftPullRequest ?? true,
      requirePassingTests: input.production?.requirePassingTests ?? current.production?.requirePassingTests ?? true,
      requireSecurityEvidence: input.production?.requireSecurityEvidence ?? current.production?.requireSecurityEvidence ?? false,
      environments: Array.isArray(input.production?.environments)
        ? input.production.environments.slice(0, 12).map((value) => string(value, "", 80)).filter(Boolean)
        : current.production?.environments || ["preview", "staging", "production"],
    },
    createdAt: current.createdAt || timestamp,
    updatedAt: timestamp,
  };
}

export function createWorkspaceRegistry(options = {}) {
  const root = resolve(options.root || `${process.env.FDE_DATA_DIR || "/tmp/fde-execution-data"}/workspaces`);
  const locks = new Map();

  async function init() {
    await mkdir(root, { recursive: true, mode: 0o700 });
  }

  function tenantRoot(tenantId) {
    return join(root, safeId(tenantId, "tenant ID"));
  }

  function pathFor(tenantId, workspaceId) {
    return join(tenantRoot(tenantId), `${safeId(workspaceId, "workspace ID")}.json`);
  }

  async function withLock(key, operation) {
    const previous = locks.get(key) || Promise.resolve();
    const next = previous.then(operation, operation);
    const guarded = next.catch(() => {});
    locks.set(key, guarded);
    try { return await next; }
    finally { if (locks.get(key) === guarded) locks.delete(key); }
  }

  async function get(tenantId, workspaceId) {
    try { return JSON.parse(await readFile(pathFor(tenantId, workspaceId), "utf8")); }
    catch (error) { if (error?.code === "ENOENT") return null; throw error; }
  }

  async function list(tenantId) {
    const directory = tenantRoot(tenantId);
    const files = await readdir(directory).catch(() => []);
    const workspaces = await Promise.all(files.filter((file) => file.endsWith(".json")).map(async (file) => JSON.parse(await readFile(join(directory, file), "utf8"))));
    return workspaces.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async function save(input) {
    const tenantId = safeId(input.tenantId || "public-demo", "tenant ID");
    const workspaceId = input.id ? safeId(input.id, "workspace ID") : null;
    return withLock(`workspace:${tenantId}:${workspaceId || "new"}`, async () => {
      const existing = workspaceId ? await get(tenantId, workspaceId) : null;
      const workspace = normalizeWorkspace({ ...input, tenantId }, existing);
      const directory = tenantRoot(tenantId);
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await atomicWrite(pathFor(tenantId, workspace.id), `${JSON.stringify(workspace, null, 2)}\n`);
      return workspace;
    });
  }

  async function attachSandbox(tenantId, workspaceId, sandboxId) {
    const current = await get(tenantId, workspaceId);
    if (!current) throw new Error("Workspace not found.");
    return save({ ...current, tenantId, id: workspaceId, sandbox: { ...current.sandbox, activeSandboxId: sandboxId || null }, prepared: null });
  }

  async function markPrepared(tenantId, workspaceId, prepared) {
    const current = await get(tenantId, workspaceId);
    if (!current) throw new Error("Workspace not found.");
    return save({ ...current, tenantId, id: workspaceId, prepared });
  }

  async function connectGitHub(tenantId, workspaceId, github) {
    const current = await get(tenantId, workspaceId);
    if (!current) throw new Error("Workspace not found.");
    return save({
      ...current,
      tenantId,
      id: workspaceId,
      repository: { ...current.repository, connected: true },
      github: { ...current.github, ...github, connectedAt: nowIso() },
      prepared: null,
    });
  }

  return { init, get, list, save, attachSandbox, markPrepared, connectGitHub, root };
}
