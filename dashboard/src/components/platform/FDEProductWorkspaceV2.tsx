"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  Code2,
  Copy,
  ExternalLink,
  FileCheck2,
  FileCode2,
  GitBranch,
  Github,
  GitPullRequest,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  Network,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Save,
  Send,
  ServerCog,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  TestTube2,
  Trash2,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import { decisionScenarios } from "@/lib/orchestration/decision-scenarios";
import type { OrchestrationScenario } from "@/lib/orchestration/types";

type View = "request" | "launch" | "preview" | "evidence" | "approvals" | "promotion" | "sandboxes" | "settings";
type Status = "idle" | "busy" | "success" | "error";
type LaunchStage = { id: string; label: string; detail: string; status: "pending" | "active" | "complete" | "error" };

type Driver = { id: string; name: string; vendor?: string; status: string; deploymentModes: string[]; capabilities?: string[]; operations?: string[] };
type Runtime = { githubAppConfigured: boolean; executionBoundary: string; trustModel: string; agents: Driver[]; sandboxes: Driver[] };
type ApprovalSetting = { key: string; label: string; role: string; required: boolean };
type Workspace = {
  id: string;
  name: string;
  description: string;
  repository: { provider: "github"; fullName: string; url: string; baseBranch: string; projectPath: string; connected: boolean };
  github: { installationId: string | null; accountLogin: string | null; connectedAt: string | null; repositories: string[] };
  agent: { driverId: string; model: string | null; secretRef: string };
  sandbox: { driverId: string; image: string; cpu: number; memoryMb: number; workspaceSizeMb: number; timeoutSeconds: number; networkPolicy: string; namespace: string; activeSandboxId: string | null };
  prepared: null | { source: string; repository: string; baseBranch: string; projectPath: string; sandboxId: string; preparedAt: string };
  preview: { buildCommand: string; startCommand: string; outputPath: string; port: number; healthPath: string };
  approvals: ApprovalSetting[];
  production: { createDraftPullRequest: boolean; requirePassingTests: boolean; requireSecurityEvidence: boolean; environments: string[] };
  createdAt: string;
  updatedAt: string;
};
type Sandbox = { id: string; driverId: string; workspaceId: string | null; image: string; networkPolicy: string; cpu: number; memoryMb: number; workspaceSizeMb: number; status: string; createdAt: string; expiresAt: string; destroyedAt?: string; providerMetadata?: Record<string, unknown> };
type Approval = { id: string; approvalKey: string; decision: "approved" | "rejected"; actor: { id: string; role: string }; comment: string; decidedAt: string };
type Result = {
  runId: string;
  previewHtml?: string | null;
  previewPath?: string | null;
  cycleTimeMs: number;
  testOutput: string;
  steps: Array<{ id: string; label: string; status: string; detail: string; durationMs: number }>;
  provenance: {
    capturedBy: string;
    trustModel: string;
    observedAt: string;
    filesystemDiff: Array<{ path: string; operation: string; bytes: number; sha256: string; previousSha256?: string }>;
    commands: Array<{ argv: string[]; exitCode: number; durationMs: number; stdoutSha256: string }>;
    tests: Array<{ name: string; passed: boolean; outputSha256: string }>;
  };
  promotionPackage: {
    title: string;
    branchName: string;
    commitMessage: string;
    body: string;
    changedFiles: Array<{ path: string; bytes: number; purpose: string }>;
    approvalsRequired: string[];
    evidence: string[];
    testSummary: string;
  };
};
type Job = {
  id: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  approvalStatus: "not-configured" | "pending" | "approved" | "rejected";
  approvals: Approval[];
  evidence: Array<{ id: string; kind: string; source: string; status: string; summary: string; observedAt: string }>;
  usage: { costUsd: number; eventCount: number };
  request: { intent: string; repository: string | null; baseBranch: string; driverId: string; sandboxId: string; sourceControlId: string; requiredApprovals: string[]; policy: { humanApprovalRequired: boolean; networkAccess: string; secretAccess: string; allowedTools: string[] }; metadata?: Record<string, unknown> };
  result: Result | null;
  error: string | null;
  promotion: null | { branch?: string; pullRequestNumber?: number; pullRequestUrl?: string; promotedFiles?: Array<{ path: string; operation: string; commitSha: string }> };
  acceptedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
  promotedAt: string | null;
};
type Audit = { verified: boolean; headHash: string; records: Array<{ sequence: number; type: string; observedAt: string; source: string; hash: string }> };
type Release = { id: string; reviewUrl: string; approvalKey: string; reviewerName: string; reviewerEmail: string | null; delivered: boolean; expiresAt: string };

const scenarioIds: OrchestrationScenario[] = ["enterprise-ai", "saas-design-partner", "si-delivery"];
const defaultStages: LaunchStage[] = [
  { id: "sandbox", label: "Provision approved sandbox", detail: "Create or reuse the workspace execution boundary.", status: "pending" },
  { id: "repository", label: "Prepare repository", detail: "Seed the sample app or clone the GitHub App-approved repository.", status: "pending" },
  { id: "agent", label: "Run coding agent", detail: "Apply the client request inside the prepared repository.", status: "pending" },
  { id: "evidence", label: "Capture independent evidence", detail: "Observe file changes, commands, tests, hashes, cost and policy.", status: "pending" },
  { id: "preview", label: "Release working preview", detail: "Open the candidate for FDE and client review.", status: "pending" },
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function statusClass(value?: string) {
  if (["complete", "completed", "ready", "approved", "success"].includes(value || "")) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["failed", "error", "rejected", "destroyed"].includes(value || "")) return "bg-red-50 text-red-700 ring-red-200";
  if (["active", "running", "busy", "configured"].includes(value || "")) return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Activity }) {
  return <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-2 text-xl font-semibold text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div><div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon className="size-4" /></div></div></article>;
}

function Empty({ icon: Icon, title, body, action, onAction }: { icon: typeof Boxes; title: string; body: string; action: string; onAction: () => void }) {
  return <div className="flex min-h-[30rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center"><div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon className="size-5" /></div><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p><button onClick={onAction} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">{action}<ArrowRight className="size-4" /></button></div>;
}

export function FDEProductWorkspaceV2() {
  const [view, setView] = useState<View>("request");
  const [runtime, setRuntime] = useState<Runtime | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState("");
  const [draft, setDraft] = useState<Workspace | null>(null);
  const [sandboxes, setSandboxes] = useState<Sandbox[]>([]);
  const [scenario, setScenario] = useState<OrchestrationScenario>("enterprise-ai");
  const [intent, setIntent] = useState(decisionScenarios["enterprise-ai"].clientAsk);
  const [job, setJob] = useState<Job | null>(null);
  const [audit, setAudit] = useState<Audit | null>(null);
  const [launchStages, setLaunchStages] = useState<LaunchStage[]>(defaultStages);
  const [status, setStatus] = useState<Status>("busy");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [approvalBusy, setApprovalBusy] = useState("");
  const [approvalComments, setApprovalComments] = useState<Record<string, string>>({});
  const [iteration, setIteration] = useState("");
  const [releaseName, setReleaseName] = useState("");
  const [releaseEmail, setReleaseEmail] = useState("");
  const [releaseMessage, setReleaseMessage] = useState("");
  const [release, setRelease] = useState<Release | null>(null);
  const [promotionBusy, setPromotionBusy] = useState(false);

  const activeWorkspace = useMemo(() => workspaces.find((item) => item.id === activeWorkspaceId) || null, [workspaces, activeWorkspaceId]);
  const result = job?.result || null;
  const completedApprovals = job?.approvals.filter((approval) => approval.decision === "approved").length || 0;
  const requiredApprovals = job?.request.requiredApprovals.length || 0;

  function replaceWorkspace(workspace: Workspace) {
    setWorkspaces((current) => current.some((item) => item.id === workspace.id) ? current.map((item) => item.id === workspace.id ? workspace : item) : [workspace, ...current]);
    setActiveWorkspaceId(workspace.id);
    setDraft(workspace);
  }

  async function loadSandboxes(workspaceId: string) {
    const payload = await api<{ sandboxes: Sandbox[] }>(`/api/product/workspaces/${workspaceId}/sandboxes`);
    setSandboxes(payload.sandboxes);
    return payload.sandboxes;
  }

  async function bootstrap() {
    setStatus("busy");
    setError("");
    try {
      const [runtimePayload, workspacePayload] = await Promise.all([
        api<Runtime>("/api/product/runtime"),
        api<{ workspaces: Workspace[] }>("/api/product/workspaces"),
      ]);
      setRuntime(runtimePayload);
      let items = workspacePayload.workspaces;
      if (!items.length) {
        const created = await api<{ workspace: Workspace }>("/api/product/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Northstar client delivery",
            description: "Working application changes from client request to approved pull request.",
            repository: { fullName: "amitvikram/FDE-Toolkit-New", url: "https://github.com/amitvikram/FDE-Toolkit-New", baseBranch: "main", projectPath: "examples/client-review-portal", connected: false },
            agent: { driverId: "fde-demo-agent", secretRef: "env://CODEX_API_KEY" },
            sandbox: { driverId: "local-ephemeral", image: "node:22-alpine", cpu: 1, memoryMb: 1024, workspaceSizeMb: 2048, timeoutSeconds: 1800, networkPolicy: "disabled", namespace: "fde-execution" },
            preview: { outputPath: "index.html", port: 3000, healthPath: "/" },
            approvals: [
              { key: "client-approval", label: "Client approver", role: "client-approver", required: true },
              { key: "product-approval", label: "Product owner", role: "product-owner", required: true },
              { key: "engineering-approval", label: "Engineering reviewer", role: "engineering-reviewer", required: true },
            ],
          }),
        });
        items = [created.workspace];
      }
      setWorkspaces(items);
      const query = new URLSearchParams(window.location.search);
      const requestedWorkspace = query.get("workspace");
      const selected = items.find((item) => item.id === requestedWorkspace) || items[0];
      setActiveWorkspaceId(selected.id);
      setDraft(selected);
      await loadSandboxes(selected.id);
      const requestedView = query.get("view") as View | null;
      if (requestedView && ["request", "preview", "evidence", "approvals", "promotion", "sandboxes", "settings"].includes(requestedView)) setView(requestedView);
      const githubState = query.get("github");
      if (githubState === "connected") setNotice("GitHub App connected and approved repositories loaded.");
      if (githubState === "not-configured") setError("GitHub App is not configured for this deployment yet.");
      if (githubState === "connection-failed") setError("GitHub could not be connected. Confirm the App credentials and repository installation.");
      setStatus("idle");
    } catch (bootstrapError) {
      setStatus("error");
      setError(bootstrapError instanceof Error ? bootstrapError.message : "The product workspace could not load.");
    }
  }

  useEffect(() => { void bootstrap(); }, []);

  function setStage(id: string, next: LaunchStage["status"], detail?: string) {
    setLaunchStages((current) => current.map((stage) => stage.id === id ? { ...stage, status: next, detail: detail || stage.detail } : stage));
  }

  async function refreshAudit(jobId: string) {
    const payload = await api<Audit>(`/api/product/jobs/${jobId}/audit`);
    setAudit(payload);
    return payload;
  }

  async function pollJob(jobId: string) {
    for (let attempt = 0; attempt < 180; attempt += 1) {
      const payload = await api<{ job: Job }>(`/api/product/jobs/${jobId}`);
      setJob(payload.job);
      if (["completed", "failed", "cancelled"].includes(payload.job.status)) return payload.job;
      await new Promise((resolve) => window.setTimeout(resolve, 500));
    }
    throw new Error("The job is still running. Open the run workspace to continue monitoring it.");
  }

  async function launch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeWorkspace) return;
    setStatus("busy");
    setError("");
    setNotice("");
    setRelease(null);
    setLaunchStages(defaultStages);
    setView("launch");
    try {
      let workspace = activeWorkspace;
      let currentSandboxes = sandboxes;
      let sandbox = currentSandboxes.find((item) => item.id === workspace.sandbox.activeSandboxId && item.status === "ready");
      setStage("sandbox", "active");
      if (!sandbox) {
        const provisioned = await api<{ workspace: Workspace; sandbox: Sandbox }>(`/api/product/workspaces/${workspace.id}/sandboxes`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}),
        });
        workspace = provisioned.workspace;
        sandbox = provisioned.sandbox;
        replaceWorkspace(workspace);
        currentSandboxes = await loadSandboxes(workspace.id);
      }
      setStage("sandbox", "complete", `${sandbox.driverId} sandbox ${sandbox.id} is ready.`);

      setStage("repository", "active");
      if (!workspace.prepared || workspace.prepared.sandboxId !== sandbox.id) {
        const prepared = await api<{ workspace: Workspace }>(`/api/product/workspaces/${workspace.id}/prepare`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sandboxId: sandbox.id }),
        });
        workspace = prepared.workspace;
        replaceWorkspace(workspace);
      }
      setStage("repository", "complete", workspace.prepared?.source === "github-app" ? `Cloned ${workspace.repository.fullName} through the GitHub App.` : "Seeded the bundled client review application as a real Git repository.");

      setStage("agent", "active", `${workspace.agent.driverId} is applying the requested change.`);
      const created = await api<{ job: Job }>("/api/product/jobs", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: workspace.id, scenario, intent }),
      });
      setJob(created.job);
      const completed = await pollJob(created.job.id);
      if (completed.status !== "completed") throw new Error(completed.error || "The coding run did not complete.");
      setStage("agent", "complete", `${completed.request.driverId} completed the bounded change.`);
      setStage("evidence", "active");
      const verified = await refreshAudit(completed.id);
      setStage("evidence", "complete", verified.verified ? `Verified ${verified.records.length} hash-chained audit events.` : "Audit verification failed.");
      if (!verified.verified) throw new Error("The audit chain could not be verified.");
      setStage("preview", "complete", completed.result?.previewHtml ? "Working application preview is ready for review." : "Run completed; inspect the file evidence.");
      setStatus("success");
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setView(completed.result?.previewHtml ? "preview" : "evidence");
    } catch (launchError) {
      setLaunchStages((current) => current.map((stage) => stage.status === "active" ? { ...stage, status: "error" } : stage));
      setStatus("error");
      setError(launchError instanceof Error ? launchError.message : "The governed run could not complete.");
    }
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setStatus("busy"); setError(""); setNotice("");
    try {
      const payload = await api<{ workspace: Workspace }>(`/api/product/workspaces/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          repository: draft.repository,
          agent: draft.agent,
          sandbox: draft.sandbox,
          preview: draft.preview,
          approvals: draft.approvals,
          production: draft.production,
        }),
      });
      replaceWorkspace(payload.workspace);
      setNotice("Workspace settings saved. Repository or sandbox changes will apply to the next prepared run.");
      setStatus("success");
    } catch (saveError) {
      setStatus("error"); setError(saveError instanceof Error ? saveError.message : "Workspace settings could not be saved.");
    }
  }

  async function provisionSandbox() {
    if (!activeWorkspace) return;
    setStatus("busy"); setError("");
    try {
      const payload = await api<{ workspace: Workspace; sandbox: Sandbox }>(`/api/product/workspaces/${activeWorkspace.id}/sandboxes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      replaceWorkspace(payload.workspace); await loadSandboxes(activeWorkspace.id); setNotice(`Sandbox ${payload.sandbox.id} is ready.`); setStatus("success");
    } catch (sandboxError) { setStatus("error"); setError(sandboxError instanceof Error ? sandboxError.message : "Sandbox could not be created."); }
  }

  async function prepareRepository() {
    if (!activeWorkspace?.sandbox.activeSandboxId) return;
    setStatus("busy"); setError("");
    try {
      const payload = await api<{ workspace: Workspace }>(`/api/product/workspaces/${activeWorkspace.id}/prepare`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sandboxId: activeWorkspace.sandbox.activeSandboxId }) });
      replaceWorkspace(payload.workspace); setNotice("Repository prepared inside the managed sandbox."); setStatus("success");
    } catch (prepareError) { setStatus("error"); setError(prepareError instanceof Error ? prepareError.message : "Repository could not be prepared."); }
  }

  async function destroySandbox(sandboxId: string) {
    if (!activeWorkspace) return;
    setStatus("busy"); setError("");
    try {
      const payload = await api<{ workspace: Workspace | null }>(`/api/product/workspaces/${activeWorkspace.id}/sandboxes/${sandboxId}`, { method: "DELETE" });
      if (payload.workspace) replaceWorkspace(payload.workspace);
      await loadSandboxes(activeWorkspace.id); setNotice(`Sandbox ${sandboxId} destroyed.`); setStatus("success");
    } catch (destroyError) { setStatus("error"); setError(destroyError instanceof Error ? destroyError.message : "Sandbox could not be destroyed."); }
  }

  async function decideApproval(key: string, decision: "approve" | "reject") {
    if (!job) return;
    setApprovalBusy(key); setError("");
    try {
      const payload = await api<{ job: Job }>(`/api/product/jobs/${job.id}/approvals`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvalKey: key, decision, comment: approvalComments[key] || "Recorded by the FDE workspace operator." }) });
      setJob(payload.job); await refreshAudit(job.id); setNotice(`${key} ${decision === "approve" ? "approved" : "rejected"}.`);
    } catch (approvalError) { setError(approvalError instanceof Error ? approvalError.message : "Approval could not be recorded."); }
    finally { setApprovalBusy(""); }
  }

  async function releasePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!job || !activeWorkspace) return;
    setStatus("busy"); setError("");
    try {
      const payload = await api<{ release: Release }>(`/api/product/jobs/${job.id}/releases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: activeWorkspace.id, reviewerName: releaseName, reviewerEmail: releaseEmail, message: releaseMessage }) });
      setRelease(payload.release); setStatus("success"); setNotice(payload.release.delivered ? "Client preview email sent." : "Client preview link created. Copy and share it securely.");
    } catch (releaseError) { setStatus("error"); setError(releaseError instanceof Error ? releaseError.message : "Preview could not be released."); }
  }

  async function promote() {
    if (!job || !activeWorkspace) return;
    setPromotionBusy(true); setError("");
    try {
      const payload = await api<{ job: Job }>(`/api/product/jobs/${job.id}/promote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId: activeWorkspace.id }) });
      setJob(payload.job); await refreshAudit(job.id); setNotice("Draft pull request created from the observed workspace files.");
    } catch (promotionError) { setError(promotionError instanceof Error ? promotionError.message : "Pull request could not be created."); }
    finally { setPromotionBusy(false); }
  }

  function chooseWorkspace(id: string) {
    const workspace = workspaces.find((item) => item.id === id);
    if (!workspace) return;
    setActiveWorkspaceId(id); setDraft(workspace); setJob(null); setAudit(null); setRelease(null); setView("request"); setError(""); setNotice(""); void loadSandboxes(id);
  }

  function startIteration() {
    if (!iteration.trim()) return;
    setIntent(`${job?.request.intent || intent}\n\nRequested iteration:\n${iteration.trim()}`);
    setIteration(""); setView("request"); setNotice("The next run will update the same prepared application workspace.");
  }

  async function exit() { await fetch("/api/product-access", { method: "DELETE" }); window.location.replace("/platform"); }

  const nav = [
    ["request", "New request", Sparkles],
    ["preview", "Product preview", Boxes],
    ["evidence", "Evidence", FileCheck2],
    ["approvals", "Approvals", UserCheck],
    ["promotion", "Path to production", Rocket],
    ["sandboxes", "Sandboxes", ServerCog],
    ["settings", "Workspace settings", Settings],
  ] as const;

  if (status === "busy" && !runtime && !workspaces.length) return <main className="flex min-h-screen items-center justify-center bg-slate-100"><div className="text-center"><Loader2 className="mx-auto size-7 animate-spin text-cyan-600"/><p className="mt-4 text-sm text-slate-500">Loading the FDE workspace…</p></div></main>;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform lg:static lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5"><div><p className="text-sm font-semibold text-white">FDE-Toolkit</p><p className="text-[10px] uppercase tracking-[.15em] text-cyan-300">Code-to-production workspace</p></div><button onClick={() => setMobileOpen(false)} className="p-2 text-slate-400 lg:hidden"><X className="size-4"/></button></div>
          <div className="p-4">
            <label className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-600">Active workspace</label>
            <select value={activeWorkspaceId} onChange={(event) => chooseWorkspace(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none">
              {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id} className="bg-slate-950">{workspace.name}</option>)}
            </select>
            <div className="mt-3 rounded-xl border border-white/10 bg-white/[.035] p-3 text-[11px] leading-5 text-slate-500"><div className="flex items-center gap-2 text-slate-300"><span className="size-2 rounded-full bg-emerald-400"/>Execution plane connected</div><p className="mt-1">{activeWorkspace?.repository.connected ? activeWorkspace.repository.fullName : "Bundled sample repository"}</p><p>{activeWorkspace?.sandbox.activeSandboxId ? "Sandbox ready" : "No active sandbox"}</p></div>
          </div>
          <nav className="space-y-1 px-3"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600">Delivery flow</p>{nav.map(([id,label,Icon]) => { const disabled = (["preview","evidence","approvals","promotion"] as View[]).includes(id) && !job?.result; return <button key={id} disabled={disabled} onClick={() => {setView(id);setMobileOpen(false)}} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${view===id?"bg-cyan-300 text-slate-950":disabled?"cursor-not-allowed text-slate-700":"text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="size-4"/><span>{label}</span>{id==="approvals"&&requiredApprovals>0&&<span className="ml-auto rounded-full bg-white/10 px-2 py-.5 text-[10px]">{completedApprovals}/{requiredApprovals}</span>}</button>})}</nav>
          <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4"><button onClick={exit} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white/5 hover:text-white"><LogOut className="size-4"/>End preview session</button></div>
        </aside>
        {mobileOpen&&<button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={()=>setMobileOpen(false)} aria-label="Close navigation"/>}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8"><div className="flex items-center gap-3"><button onClick={()=>setMobileOpen(true)} className="rounded-lg border border-slate-200 p-2 lg:hidden"><Menu className="size-4"/></button><div><h1 className="text-sm font-semibold">{nav.find(([id])=>id===view)?.[1] || "Launch run"}</h1><p className="text-xs text-slate-400">{job?.id || activeWorkspace?.id || "No workspace"}</p></div></div><div className="flex items-center gap-3">{job&&<span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusClass(job.status)}`}>{job.status}</span>}<button onClick={()=>setView("settings")} className="hidden items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 sm:inline-flex"><Settings className="size-3.5"/>Settings</button></div></header>
          <div className="p-4 sm:p-6 lg:p-8">
            {error&&<div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><XCircle className="mt-.5 size-4 shrink-0"/><div><p className="font-semibold">Action could not complete</p><p className="mt-1 text-xs leading-5">{error}</p></div></div>}
            {notice&&<div className="mb-6 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><CheckCircle2 className="mt-.5 size-4 shrink-0"/><p>{notice}</p></div>}

            {view==="request"&&activeWorkspace&&<form onSubmit={launch} className="mx-auto max-w-7xl"><div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-700">Step 1 of 4 · Define the change</p><h2 className="mt-2 text-2xl font-semibold tracking-[-.025em]">Update a real application workspace</h2><p className="mt-2 text-sm text-slate-500">The selected agent edits the prepared repository, FDE releases a working preview, and promotion waits for the configured approvals.</p></div><button type="button" onClick={()=>setView("settings")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"><Settings className="size-3.5"/>Review configuration</button></div>
              <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="grid gap-3 md:grid-cols-3">{scenarioIds.map((id)=>{const item=decisionScenarios[id];const active=scenario===id;return <button key={id} type="button" onClick={()=>{setScenario(id);setIntent(item.clientAsk)}} className={`rounded-xl border p-4 text-left ${active?"border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/10":"border-slate-200 hover:border-slate-300"}`}><p className="text-xs font-semibold">{item.shortLabel}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{item.industry}</p></button>})}</div><label className="mt-6 block text-sm font-medium text-slate-700">Describe the screen, workflow, or behavior to change<textarea value={intent} onChange={(event)=>setIntent(event.target.value)} required minLength={20} maxLength={5000} rows={11} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"/></label><div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold">Ready to launch</p><p className="mt-1 text-[11px] text-slate-500">You will see sandbox, repository, agent, evidence, and preview stages—not an abrupt page jump.</p></div><button type="submit" disabled={status==="busy"} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{status==="busy"?<Loader2 className="size-4 animate-spin"/>:<Play className="size-4"/>}Launch governed change</button></div></section>
                <aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold">Bound workspace</h3><div className="mt-5 space-y-4">{[[Github,"Repository",activeWorkspace.repository.connected?activeWorkspace.repository.fullName:"Bundled sample repository",`${activeWorkspace.repository.baseBranch} · ${activeWorkspace.repository.projectPath}`],[Code2,"Coding agent",runtime?.agents.find((item)=>item.id===activeWorkspace.agent.driverId)?.name||activeWorkspace.agent.driverId,runtime?.agents.find((item)=>item.id===activeWorkspace.agent.driverId)?.status||"unknown"],[ServerCog,"Sandbox",activeWorkspace.sandbox.driverId,activeWorkspace.sandbox.activeSandboxId||"Provisioned at launch"],[Users,"Approvals",`${activeWorkspace.approvals.filter((item)=>item.required).length} required`,activeWorkspace.approvals.filter((item)=>item.required).map((item)=>item.label).join(" · ")]].map(([Icon,label,value,detail])=>{const I=Icon as typeof Github;return <div key={String(label)} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100"><I className="size-4"/></div><div className="min-w-0"><p className="text-xs text-slate-400">{String(label)}</p><p className="mt-1 truncate text-sm font-semibold">{String(value)}</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{String(detail)}</p></div></div>})}</div></section><section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5"><div className="flex gap-3"><ShieldCheck className="mt-.5 size-5 text-cyan-700"/><div><p className="text-sm font-semibold text-cyan-950">No automatic production change</p><p className="mt-2 text-xs leading-5 text-cyan-800">The run produces a preview and evidence package. Client, product, and engineering approvals must complete before the GitHub App can open a draft PR.</p></div></div></section></aside>
              </div></form>}

            {view==="launch"&&<div className="mx-auto max-w-4xl"><div className="text-center"><p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-700">Step 2 of 4 · Controlled execution</p><h2 className="mt-3 text-3xl font-semibold">Turning the request into a working candidate</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-500">Stay on this screen while FDE prepares the approved environment, runs the agent, and collects evidence.</p></div><section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"><div className="space-y-0">{launchStages.map((stage,index)=>{const Icon=stage.status==="complete"?Check:stage.status==="active"?Loader2:stage.status==="error"?X:Circle;return <div key={stage.id} className="relative flex gap-4 pb-7 last:pb-0">{index<launchStages.length-1&&<span className={`absolute left-[17px] top-9 h-[calc(100%-1rem)] w-px ${stage.status==="complete"?"bg-emerald-300":"bg-slate-200"}`}/>}<div className={`relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${stage.status==="complete"?"bg-emerald-500 text-white":stage.status==="active"?"bg-cyan-500 text-white":stage.status==="error"?"bg-red-500 text-white":"bg-slate-100 text-slate-400"}`}><Icon className={`size-4 ${stage.status==="active"?"animate-spin":""}`}/></div><div className="pt-1"><p className="text-sm font-semibold">{stage.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{stage.detail}</p></div></div>})}</div></section></div>}

            {view==="preview"&&(job&&result?<div className="mx-auto max-w-7xl"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-700">Step 3 of 4 · Working software review</p><h2 className="mt-2 text-2xl font-semibold">Application preview</h2><p className="mt-2 text-sm text-slate-500">Review the actual candidate, request another iteration, or release a signed client review link.</p></div><span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Preview only · not production</span></div><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-3"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-400"/><span className="size-2.5 rounded-full bg-amber-400"/><span className="size-2.5 rounded-full bg-emerald-400"/></div><p className="text-[11px] text-slate-400">{result.previewPath||activeWorkspace?.preview.outputPath}</p></div>{result.previewHtml?<iframe title="Generated product preview" srcDoc={result.previewHtml} sandbox="allow-scripts" className="h-[70vh] min-h-[600px] w-full bg-white"/>:<div className="flex min-h-[600px] items-center justify-center p-10 text-center text-sm text-slate-500">No static preview output was detected. Review the observed file changes.</div>}</section><aside className="space-y-5"><section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold">Request another iteration</h3><p className="mt-2 text-xs leading-5 text-slate-500">The next run updates this same prepared repository rather than starting from a detached mock.</p><textarea value={iteration} onChange={(event)=>setIteration(event.target.value)} rows={4} className="mt-4 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" placeholder="Make the approval state more prominent and add a side-by-side evidence panel…"/><button onClick={startIteration} disabled={!iteration.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"><Sparkles className="size-4"/>Create next iteration</button></section><form onSubmit={releasePreview} className="rounded-2xl border border-cyan-200 bg-cyan-50 p-5"><div className="flex items-center gap-2"><Send className="size-4 text-cyan-700"/><h3 className="text-sm font-semibold text-cyan-950">Release to client reviewer</h3></div><p className="mt-2 text-xs leading-5 text-cyan-800">Creates a signed seven-day link. The reviewer sees the working preview and can approve or request changes.</p><input required value={releaseName} onChange={(event)=>setReleaseName(event.target.value)} className="mt-4 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="Reviewer name"/><input value={releaseEmail} onChange={(event)=>setReleaseEmail(event.target.value)} type="email" className="mt-3 w-full rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="Reviewer email (optional)"/><textarea value={releaseMessage} onChange={(event)=>setReleaseMessage(event.target.value)} rows={3} className="mt-3 w-full resize-y rounded-xl border border-cyan-200 bg-white px-3 py-2.5 text-sm outline-none" placeholder="What should the client validate?"/><button type="submit" className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white"><Send className="size-4"/>Release client preview</button>{release&&<div className="mt-4 rounded-xl border border-cyan-200 bg-white p-3"><p className="text-xs font-semibold">Review link ready</p><p className="mt-1 truncate text-[11px] text-slate-500">{release.reviewUrl}</p><button type="button" onClick={()=>navigator.clipboard.writeText(release.reviewUrl)} className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-cyan-700"><Copy className="size-3.5"/>Copy link</button></div>}</form></aside></div></div>:<Empty icon={Boxes} title="No product preview yet" body="Launch a governed change to create a working application candidate." action="Create request" onAction={()=>setView("request")}/>) }

            {view==="evidence"&&(job&&result?<div className="mx-auto max-w-7xl"><div className="mb-6 flex items-end justify-between"><div><h2 className="text-2xl font-semibold">Observed evidence</h2><p className="mt-2 text-sm text-slate-500">Captured by FDE at the sandbox boundary—not accepted from agent self-report.</p></div><span className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${audit?.verified?statusClass("success"):statusClass("pending")}`}>{audit?.verified?"Audit chain verified":"Verification pending"}</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SummaryCard label="Files changed" value={String(result.provenance.filesystemDiff.length)} detail="Independent workspace diff" icon={FileCode2}/><SummaryCard label="Commands" value={String(result.provenance.commands.length)} detail="Argv, exit code and digests" icon={TerminalSquare}/><SummaryCard label="Tests" value={`${result.provenance.tests.filter((item)=>item.passed).length}/${result.provenance.tests.length}`} detail={result.promotionPackage.testSummary} icon={TestTube2}/><SummaryCard label="Audit events" value={String(audit?.records.length||0)} detail={audit?.headHash?audit.headHash.slice(0,12):"Loading"} icon={FileCheck2}/></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_.95fr]"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Filesystem evidence</h3><div className="mt-4 divide-y divide-slate-100">{result.provenance.filesystemDiff.map((file)=><div key={file.path} className="py-4"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="truncate font-mono text-xs font-semibold">{file.path}</p><p className="mt-1 font-mono text-[10px] text-slate-400">sha256:{file.sha256.slice(0,24)}…</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusClass(file.operation==="deleted"?"error":"success")}`}>{file.operation}</span></div></div>)}</div></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Commands and tests</h3><div className="mt-4 space-y-4">{result.provenance.commands.map((command,index)=><div key={index} className="rounded-xl bg-slate-950 p-4 font-mono text-[11px] text-slate-300"><p className="break-all text-cyan-300">$ {command.argv.join(" ")}</p><div className="mt-3 flex justify-between text-slate-500"><span>exit {command.exitCode}</span><span>{command.durationMs} ms</span></div></div>)}{result.provenance.tests.map((test)=><div key={test.name} className="flex items-center justify-between rounded-xl border border-slate-200 p-4"><div className="flex items-center gap-3"><CheckCircle2 className={`size-4 ${test.passed?"text-emerald-500":"text-red-500"}`}/><span className="text-sm font-semibold">{test.name}</span></div><span className="text-xs text-slate-400">{test.passed?"passed":"failed"}</span></div>)}</div></section></div></div>:<Empty icon={FileCheck2} title="No evidence package yet" body="Run the coding workflow to create independently observed evidence." action="Create request" onAction={()=>setView("request")}/>) }

            {view==="approvals"&&(job&&result?<div className="mx-auto max-w-5xl"><div className="mb-6"><h2 className="text-2xl font-semibold">Approval workflow</h2><p className="mt-2 text-sm text-slate-500">Client, product, and engineering decisions are persisted on the durable job before promotion.</p></div><div className="space-y-4">{job.request.requiredApprovals.map((key)=>{const setting=activeWorkspace?.approvals.find((item)=>item.key===key);const existing=job.approvals.find((item)=>item.approvalKey===key);return <section key={key} className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs uppercase tracking-[.12em] text-slate-400">{setting?.role||"approver"}</p><h3 className="mt-2 text-lg font-semibold">{setting?.label||key}</h3><p className="mt-2 text-sm text-slate-500">{existing?`${existing.decision} ${formatDate(existing.decidedAt)}`:"Decision required before PR creation."}</p></div><span className={`self-start rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ring-inset ${statusClass(existing?.decision||"pending")}`}>{existing?.decision||"pending"}</span></div><textarea value={approvalComments[key]||""} onChange={(event)=>setApprovalComments((current)=>({...current,[key]:event.target.value}))} rows={3} className="mt-5 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" placeholder="Decision rationale or validation notes"/><div className="mt-4 flex flex-wrap justify-end gap-3"><button disabled={approvalBusy===key} onClick={()=>decideApproval(key,"reject")} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Request changes</button><button disabled={approvalBusy===key} onClick={()=>decideApproval(key,"approve")} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">{approvalBusy===key?<Loader2 className="size-4 animate-spin"/>:<Check className="size-4"/>}Approve</button></div></section>})}</div></div>:<Empty icon={UserCheck} title="No approval workflow active" body="Complete a run to bind the workspace approval workflow to a candidate." action="Create request" onAction={()=>setView("request")}/>) }

            {view==="promotion"&&(job&&result&&activeWorkspace?<div className="mx-auto max-w-6xl"><div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.14em] text-cyan-700">Step 4 of 4 · Path to production</p><h2 className="mt-2 text-2xl font-semibold">Promotion control</h2><p className="mt-2 text-sm text-slate-500">Create a draft PR from the exact observed workspace files after all required approvals.</p></div><div className="grid gap-6 xl:grid-cols-[1fr_380px]"><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between gap-4"><div><p className="text-xs text-slate-400">Proposed pull request</p><h3 className="mt-2 text-lg font-semibold">{result.promotionPackage.title}</h3></div><GitPullRequest className="size-6 text-slate-400"/></div><dl className="mt-6 grid gap-4 border-y border-slate-100 py-5 text-sm sm:grid-cols-2"><div><dt className="text-xs text-slate-400">Repository</dt><dd className="mt-1 font-semibold">{activeWorkspace.repository.fullName}</dd></div><div><dt className="text-xs text-slate-400">Base branch</dt><dd className="mt-1 font-semibold">{activeWorkspace.repository.baseBranch}</dd></div><div><dt className="text-xs text-slate-400">Proposed branch</dt><dd className="mt-1 font-mono text-xs font-semibold">{result.promotionPackage.branchName}</dd></div><div><dt className="text-xs text-slate-400">Files</dt><dd className="mt-1 font-semibold">{result.promotionPackage.changedFiles.length} observed changes</dd></div></dl><pre className="mt-5 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-[11px] leading-5 text-slate-300">{result.promotionPackage.body}</pre></section><aside className="space-y-5"><section className={`rounded-2xl border p-5 ${job.approvalStatus==="approved"?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}><div className="flex items-start gap-3"><ShieldCheck className={`mt-.5 size-5 ${job.approvalStatus==="approved"?"text-emerald-600":"text-amber-600"}`}/><div><p className="text-sm font-semibold">{job.approvalStatus==="approved"?"Approval gate satisfied":"Promotion remains blocked"}</p><p className="mt-2 text-xs leading-5">{completedApprovals}/{requiredApprovals} approvals complete · audit {audit?.verified?"verified":"pending"} · GitHub {activeWorkspace.repository.connected?"connected":"not connected"}</p></div></div></section>{job.promotion?.pullRequestUrl?<section className="rounded-2xl border border-emerald-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-emerald-700">Draft PR created</p><p className="mt-3 text-sm font-semibold">Branch {job.promotion.branch}</p><p className="mt-1 text-xs text-slate-500">{job.promotion.promotedFiles?.length||0} application files promoted with governed evidence.</p><a href={job.promotion.pullRequestUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Open pull request<ExternalLink className="size-4"/></a></section>:<section className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="text-sm font-semibold">Create GitHub pull request</h3><p className="mt-2 text-xs leading-5 text-slate-500">FDE will create a branch, commit the observed application files and evidence package, then open a draft PR. Existing CI and branch protections continue the production path.</p><button onClick={promote} disabled={promotionBusy||job.approvalStatus!=="approved"||!audit?.verified||!activeWorkspace.repository.connected} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{promotionBusy?<Loader2 className="size-4 animate-spin"/>:<GitPullRequest className="size-4"/>}Create draft PR</button>{!activeWorkspace.repository.connected&&<button onClick={()=>setView("settings")} className="mt-3 w-full text-xs font-semibold text-cyan-700">Connect GitHub in settings</button>}</section>}</aside></div></div>:<Empty icon={Rocket} title="No candidate ready for promotion" body="Run, review, and approve a change before entering the path to production." action="Create request" onAction={()=>setView("request")}/>) }

            {view==="sandboxes"&&activeWorkspace&&<div className="mx-auto max-w-6xl"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold">Managed sandboxes</h2><p className="mt-2 text-sm text-slate-500">Created and managed in the execution plane—not in the public web process.</p></div><div className="flex gap-3"><button onClick={provisionSandbox} disabled={status==="busy"} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="size-4"/>Provision sandbox</button>{activeWorkspace.sandbox.activeSandboxId&&<button onClick={prepareRepository} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"><PackageCheck className="size-4"/>Prepare repository</button>}</div></div><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="grid gap-4 md:grid-cols-3"><SummaryCard label="Configured driver" value={activeWorkspace.sandbox.driverId} detail={runtime?.sandboxes.find((item)=>item.id===activeWorkspace.sandbox.driverId)?.status||"unknown"} icon={ServerCog}/><SummaryCard label="Execution resources" value={`${activeWorkspace.sandbox.cpu} CPU · ${activeWorkspace.sandbox.memoryMb} MB`} detail={`${activeWorkspace.sandbox.workspaceSizeMb} MB workspace`} icon={Activity}/><SummaryCard label="Network policy" value={activeWorkspace.sandbox.networkPolicy} detail={`Expires after ${Math.round(activeWorkspace.sandbox.timeoutSeconds/60)} minutes`} icon={Network}/></div><div className="mt-6 divide-y divide-slate-100">{sandboxes.length?sandboxes.map((sandbox)=><div key={sandbox.id} className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-4"><div className="flex size-10 items-center justify-center rounded-xl bg-slate-100"><ServerCog className="size-4"/></div><div><div className="flex items-center gap-2"><p className="font-mono text-xs font-semibold">{sandbox.id}</p><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusClass(sandbox.status)}`}>{sandbox.status}</span></div><p className="mt-2 text-xs text-slate-500">{sandbox.driverId} · {sandbox.image} · created {formatDate(sandbox.createdAt)}</p><p className="mt-1 text-[11px] text-slate-400">{sandbox.driverId==="local-ephemeral"?"Execution-plane managed volume":sandbox.driverId==="docker-local"?"Resource-limited Docker container":"Constrained Kubernetes Job"}</p></div></div>{sandbox.status!=="destroyed"&&<button onClick={()=>destroySandbox(sandbox.id)} className="inline-flex items-center gap-2 self-start rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700"><Trash2 className="size-3.5"/>Destroy</button>}</div>):<div className="py-12 text-center text-sm text-slate-500">No sandboxes have been created for this workspace.</div>}</div></section></div>}

            {view==="settings"&&draft&&<form onSubmit={saveSettings} className="mx-auto max-w-7xl"><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold">Workspace settings</h2><p className="mt-2 text-sm text-slate-500">Configure the repository, coding platform, sandbox, preview output, approval workflow, and path to production.</p></div><button type="submit" disabled={status==="busy"} className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white"><Save className="size-4"/>Save workspace</button></div><div className="grid gap-6 xl:grid-cols-[1fr_420px]"><div className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Workspace identity</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Workspace name<input value={draft.name} onChange={(event)=>setDraft({...draft,name:event.target.value})} required className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500"/></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Description<textarea value={draft.description} onChange={(event)=>setDraft({...draft,description:event.target.value})} rows={3} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-cyan-500"/></label></div></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">GitHub repository</h3><p className="mt-1 text-xs text-slate-500">The GitHub App receives repository-scoped installation access, not a personal token.</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusClass(draft.repository.connected?"success":"pending")}`}>{draft.repository.connected?"connected":"not connected"}</span></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium text-slate-700">Repository<input value={draft.repository.fullName} onChange={(event)=>setDraft({...draft,repository:{...draft.repository,fullName:event.target.value,url:`https://github.com/${event.target.value}`}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="owner/repository"/></label><label className="text-sm font-medium text-slate-700">Base branch<input value={draft.repository.baseBranch} onChange={(event)=>setDraft({...draft,repository:{...draft.repository,baseBranch:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label><label className="text-sm font-medium text-slate-700 sm:col-span-2">Application path inside repository<input value={draft.repository.projectPath} onChange={(event)=>setDraft({...draft,repository:{...draft.repository,projectPath:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="apps/client-portal"/></label></div><a href={`/api/product/github/connect?workspaceId=${encodeURIComponent(draft.id)}`} className={`mt-5 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${runtime?.githubAppConfigured?"bg-slate-950 text-white":"pointer-events-none bg-slate-100 text-slate-400"}`}><Github className="size-4"/>{draft.repository.connected?"Reconnect or change repositories":"Connect GitHub App"}</a>{!runtime?.githubAppConfigured&&<p className="mt-2 text-xs text-amber-700">Configure GITHUB_APP_SLUG, GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY in the deployment first.</p>}{draft.github.repositories.length>0&&<p className="mt-3 text-xs text-slate-500">Installation account: {draft.github.accountLogin} · {draft.github.repositories.length} approved repositories</p>}</section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Approval workflow</h3><p className="mt-1 text-xs text-slate-500">These named gates are copied onto every new job.</p><div className="mt-5 space-y-3">{draft.approvals.map((approval,index)=><div key={`${approval.key}-${index}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-[1fr_1fr_auto]"><input value={approval.label} onChange={(event)=>setDraft({...draft,approvals:draft.approvals.map((item,i)=>i===index?{...item,label:event.target.value}:item)})} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Approval label"/><input value={approval.role} onChange={(event)=>setDraft({...draft,approvals:draft.approvals.map((item,i)=>i===index?{...item,role:event.target.value}:item)})} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Role"/><button type="button" disabled={draft.approvals.length<=1} onClick={()=>setDraft({...draft,approvals:draft.approvals.filter((_,i)=>i!==index)})} className="rounded-lg border border-red-200 p-2 text-red-600 disabled:opacity-30"><Trash2 className="size-4"/></button></div>)}</div><button type="button" onClick={()=>setDraft({...draft,approvals:[...draft.approvals,{key:`approval-${draft.approvals.length+1}`,label:"New approval",role:"approver",required:true}]})} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-cyan-700"><Plus className="size-3.5"/>Add approval gate</button></section></div><aside className="space-y-6"><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Coding platform</h3><label className="mt-5 block text-sm font-medium text-slate-700">Agent driver<select value={draft.agent.driverId} onChange={(event)=>setDraft({...draft,agent:{...draft.agent,driverId:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{runtime?.agents.map((driver)=><option key={driver.id} value={driver.id} disabled={!['available','configured'].includes(driver.status)}>{driver.name} · {driver.status}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">Secret reference<input value={draft.agent.secretRef} onChange={(event)=>setDraft({...draft,agent:{...draft.agent,secretRef:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-xs" placeholder="env://CODEX_API_KEY"/></label><p className="mt-3 text-xs leading-5 text-slate-500">Secrets resolve inside the execution plane as short-lived job leases and are not returned to this browser.</p></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Sandbox configuration</h3><label className="mt-5 block text-sm font-medium text-slate-700">Sandbox driver<select value={draft.sandbox.driverId} onChange={(event)=>setDraft({...draft,sandbox:{...draft.sandbox,driverId:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">{runtime?.sandboxes.map((driver)=><option key={driver.id} value={driver.id}>{driver.name} · {driver.status}</option>)}</select></label><label className="mt-4 block text-sm font-medium text-slate-700">Runtime image<input value={draft.sandbox.image} onChange={(event)=>setDraft({...draft,sandbox:{...draft.sandbox,image:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"/></label><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs text-slate-500">CPU<input type="number" step=".1" value={draft.sandbox.cpu} onChange={(event)=>setDraft({...draft,sandbox:{...draft.sandbox,cpu:Number(event.target.value)}})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label><label className="text-xs text-slate-500">Memory MB<input type="number" value={draft.sandbox.memoryMb} onChange={(event)=>setDraft({...draft,sandbox:{...draft.sandbox,memoryMb:Number(event.target.value)}})} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"/></label></div><label className="mt-4 block text-sm font-medium text-slate-700">Network policy<select value={draft.sandbox.networkPolicy} onChange={(event)=>setDraft({...draft,sandbox:{...draft.sandbox,networkPolicy:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="disabled">Disabled</option><option value="allowlisted">Allowlisted</option><option value="enabled">Enabled</option></select></label></section><section className="rounded-2xl border border-slate-200 bg-white p-6"><h3 className="text-sm font-semibold">Preview and production</h3><label className="mt-5 block text-sm font-medium text-slate-700">Static preview output<input value={draft.preview.outputPath} onChange={(event)=>setDraft({...draft,preview:{...draft.preview,outputPath:event.target.value}})} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" placeholder="index.html"/></label><label className="mt-4 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={draft.production.createDraftPullRequest} onChange={(event)=>setDraft({...draft,production:{...draft.production,createDraftPullRequest:event.target.checked}})} className="size-4"/>Create pull requests as drafts</label><label className="mt-3 flex items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={draft.production.requirePassingTests} onChange={(event)=>setDraft({...draft,production:{...draft.production,requirePassingTests:event.target.checked}})} className="size-4"/>Require passing tests</label></section></aside></div></form>}
          </div>
        </section>
      </div>
    </main>
  );
}
