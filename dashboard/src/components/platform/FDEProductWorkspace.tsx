"use client";

import { FormEvent, useMemo, useState } from "react";
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
  FileCheck2,
  FileCode2,
  GitBranch,
  GitPullRequest,
  KeyRound,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Network,
  Play,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  TerminalSquare,
  TestTube2,
  X,
  XCircle,
} from "lucide-react";
import { decisionScenarios } from "@/lib/orchestration/decision-scenarios";
import type {
  OrchestrationResult,
  OrchestrationScenario,
} from "@/lib/orchestration/types";

type WorkspaceView =
  | "request"
  | "run"
  | "preview"
  | "evidence"
  | "approvals"
  | "promotion";

type ProductApproval = {
  id: string;
  approvalKey: string;
  decision: "approved" | "rejected";
  actor: { id: string; role: string };
  comment: string;
  decidedAt: string;
};

type ProductJob = {
  id: string;
  tenantId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  approvalStatus: "not-configured" | "pending" | "approved" | "rejected";
  approvals: ProductApproval[];
  evidence: Array<{
    id: string;
    kind: string;
    source: string;
    status: string;
    summary: string;
    observedAt: string;
  }>;
  usage: { costUsd: number; eventCount: number };
  request: {
    intent: string;
    repository: string | null;
    baseBranch: string;
    driverId: string;
    sandboxId: string;
    sourceControlId: string;
    requiredApprovals: string[];
    policy: {
      humanApprovalRequired: boolean;
      networkAccess: string;
      secretAccess: string;
      allowedTools: string[];
    };
    limits: {
      timeoutMs: number;
      maxEvents: number;
      maxOutputBytes: number;
      maxCostUsd: number;
    };
  };
  result: OrchestrationResult | null;
  error: string | null;
  acceptedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  approvedAt: string | null;
};

type ProductAudit = {
  verified: boolean;
  headHash: string;
  records: Array<{
    sequence: number;
    type: string;
    observedAt: string;
    source: string;
    hash: string;
  }>;
};

type RunStatus = "idle" | "submitting" | "polling" | "complete" | "error";

const scenarioIds: OrchestrationScenario[] = [
  "enterprise-ai",
  "saas-design-partner",
  "si-delivery",
];

const navItems: Array<{
  id: WorkspaceView;
  label: string;
  icon: typeof LayoutDashboard;
  requiresJob?: boolean;
  requiresResult?: boolean;
}> = [
  { id: "request", label: "New request", icon: Plus },
  { id: "run", label: "Run workspace", icon: LayoutDashboard, requiresJob: true },
  { id: "preview", label: "Product preview", icon: Boxes, requiresResult: true },
  { id: "evidence", label: "Evidence", icon: FileCheck2, requiresResult: true },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, requiresResult: true },
  { id: "promotion", label: "Promotion", icon: GitPullRequest, requiresResult: true },
];

function statusStyle(status: ProductJob["status"] | undefined) {
  if (status === "completed") return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (status === "failed" || status === "cancelled") return "bg-red-50 text-red-700 ring-red-200";
  if (status === "running") return "bg-cyan-50 text-cyan-700 ring-cyan-200";
  return "bg-amber-50 text-amber-700 ring-amber-200";
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function EmptyState({
  icon: Icon,
  title,
  body,
  onStart,
}: {
  icon: typeof Boxes;
  title: string;
  body: string;
  onStart: () => void;
}) {
  return (
    <div className="flex min-h-[32rem] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-5 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">{body}</p>
      <button onClick={onStart} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">
        Create a governed request <ArrowRight className="size-4" />
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon: Icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Activity;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{detail}</p>
        </div>
        <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
          <Icon className="size-4" />
        </div>
      </div>
    </article>
  );
}

export function FDEProductWorkspace() {
  const [view, setView] = useState<WorkspaceView>("request");
  const [scenarioId, setScenarioId] = useState<OrchestrationScenario>("enterprise-ai");
  const [intent, setIntent] = useState(decisionScenarios["enterprise-ai"].clientAsk);
  const [repository, setRepository] = useState(decisionScenarios["enterprise-ai"].repository);
  const [baseBranch, setBaseBranch] = useState("main");
  const [job, setJob] = useState<ProductJob | null>(null);
  const [audit, setAudit] = useState<ProductAudit | null>(null);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [error, setError] = useState("");
  const [approvalBusy, setApprovalBusy] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const scenario = decisionScenarios[scenarioId];
  const result = job?.result ?? null;
  const completedApprovals = job?.approvals.filter((item) => item.decision === "approved").length ?? 0;
  const approvalCount = job?.request.requiredApprovals.length ?? 0;

  const viewTitle = useMemo(() => {
    const selected = navItems.find((item) => item.id === view);
    return selected?.label || "Workspace";
  }, [view]);

  function selectScenario(next: OrchestrationScenario) {
    setScenarioId(next);
    setIntent(decisionScenarios[next].clientAsk);
    setRepository(decisionScenarios[next].repository);
  }

  async function loadAudit(jobId: string) {
    try {
      const response = await fetch(`/api/product/jobs/${jobId}/audit`, {
        cache: "no-store",
      });
      if (response.ok) setAudit((await response.json()) as ProductAudit);
    } catch {
      // The run remains usable even when the audit view cannot load.
    }
  }

  async function pollJob(jobId: string) {
    setRunStatus("polling");
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const response = await fetch(`/api/product/jobs/${jobId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as { job?: ProductJob; error?: string };
      if (!response.ok || !payload.job) {
        throw new Error(payload.error || "The job could not be loaded.");
      }
      setJob(payload.job);
      if (["completed", "failed", "cancelled"].includes(payload.job.status)) {
        if (payload.job.status === "completed") {
          await loadAudit(jobId);
          setRunStatus("complete");
          setView("run");
        } else {
          setRunStatus("error");
          setError(payload.job.error || "The job did not complete.");
        }
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350));
    }
    throw new Error("The job is still running. Refresh the run workspace to continue.");
  }

  async function createRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunStatus("submitting");
    setError("");
    setJob(null);
    setAudit(null);

    try {
      const response = await fetch("/api/product/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenarioId,
          intent,
          repository,
          baseBranch,
        }),
      });
      const payload = (await response.json()) as { job?: ProductJob; error?: string };
      if (!response.ok || !payload.job) {
        throw new Error(payload.error || "The job could not be created.");
      }
      setJob(payload.job);
      setView("run");
      await pollJob(payload.job.id);
    } catch (submissionError) {
      setRunStatus("error");
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The job could not be created.",
      );
    }
  }

  async function refreshJob() {
    if (!job) return;
    setError("");
    try {
      await pollJob(job.id);
    } catch (refreshError) {
      setRunStatus("error");
      setError(refreshError instanceof Error ? refreshError.message : "The job could not be refreshed.");
    }
  }

  async function decideApproval(approvalKey: string, decision: "approve" | "reject") {
    if (!job) return;
    setApprovalBusy(approvalKey);
    setError("");
    try {
      const response = await fetch(`/api/product/jobs/${job.id}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approvalKey, decision }),
      });
      const payload = (await response.json()) as { job?: ProductJob; error?: string };
      if (!response.ok || !payload.job) throw new Error(payload.error || "The approval could not be recorded.");
      setJob(payload.job);
      await loadAudit(job.id);
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "The approval could not be recorded.");
    } finally {
      setApprovalBusy(null);
    }
  }

  async function exitWorkspace() {
    await fetch("/api/product-access", { method: "DELETE" });
    window.location.replace("/platform");
  }

  function resetWorkspace() {
    setJob(null);
    setAudit(null);
    setRunStatus("idle");
    setError("");
    setView("request");
  }

  function navigate(next: WorkspaceView) {
    const item = navItems.find((entry) => entry.id === next);
    if (item?.requiresJob && !job) return;
    if (item?.requiresResult && !result) return;
    setView(next);
    setMobileNavOpen(false);
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-slate-950 text-slate-200 transition-transform lg:static lg:translate-x-0 ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
            <div>
              <p className="text-sm font-semibold text-white">FDE-Toolkit</p>
              <p className="text-[10px] uppercase tracking-[0.15em] text-cyan-300">Product workspace</p>
            </div>
            <button onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden" aria-label="Close navigation">
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-5">
            <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-emerald-400" />
                <span className="text-xs font-medium text-slate-300">Execution plane connected</span>
              </div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">Prospect tenant · ephemeral sandbox · human approval</p>
            </div>
          </div>

          <nav className="space-y-1 px-3">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">Delivery workspace</p>
            {navItems.map((item) => {
              const Icon = item.icon;
              const disabled = (item.requiresJob && !job) || (item.requiresResult && !result);
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => navigate(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                    view === item.id
                      ? "bg-cyan-300 text-slate-950"
                      : disabled
                        ? "cursor-not-allowed text-slate-700"
                        : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="size-4" />
                  <span>{item.label}</span>
                  {item.id === "approvals" && approvalCount > 0 && (
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${view === item.id ? "bg-slate-950/10" : "bg-white/5"}`}>
                      {completedApprovals}/{approvalCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="absolute inset-x-0 bottom-0 border-t border-white/10 p-4">
            <button onClick={exitWorkspace} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 hover:bg-white/5 hover:text-white">
              <LogOut className="size-4" /> End preview session
            </button>
          </div>
        </aside>

        {mobileNavOpen && <button className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileNavOpen(true)} className="rounded-lg border border-slate-200 p-2 text-slate-600 lg:hidden" aria-label="Open navigation">
                <ChevronDown className="size-4 rotate-90" />
              </button>
              <div>
                <h1 className="text-sm font-semibold text-slate-950">{viewTitle}</h1>
                <p className="text-xs text-slate-400">{job ? job.id : "No active run"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {job && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyle(job.status)}`}>
                  {job.status}
                </span>
              )}
              <button onClick={resetWorkspace} className="hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 sm:inline-flex">
                <Plus className="size-3.5" /> New request
              </button>
            </div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8">
            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <XCircle className="mt-0.5 size-4 shrink-0" />
                <div><p className="font-semibold">Action could not complete</p><p className="mt-1 text-xs leading-5">{error}</p></div>
              </div>
            )}

            {view === "request" && (
              <form onSubmit={createRun} className="mx-auto max-w-7xl">
                <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-2xl font-semibold tracking-[-0.025em]">Create a delivery job</h2>
                    <p className="mt-2 text-sm text-slate-500">Define the client intent, approved boundary, repository and promotion controls.</p>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                    <LockKeyhole className="size-3.5" /> Promotion requires human approval
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <div className="grid gap-3 md:grid-cols-3">
                      {scenarioIds.map((id) => {
                        const item = decisionScenarios[id];
                        const active = scenarioId === id;
                        return (
                          <button key={id} type="button" onClick={() => selectScenario(id)} className={`rounded-xl border p-4 text-left transition ${active ? "border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/10" : "border-slate-200 hover:border-slate-300"}`}>
                            <p className="text-xs font-semibold text-slate-950">{item.shortLabel}</p>
                            <p className="mt-2 text-[11px] leading-5 text-slate-500">{item.industry}</p>
                          </button>
                        );
                      })}
                    </div>

                    <label className="mt-6 block text-sm font-medium text-slate-700">
                      Client request
                      <textarea value={intent} onChange={(event) => setIntent(event.target.value)} required minLength={20} maxLength={5000} rows={9} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
                    </label>

                    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_0.32fr]">
                      <label className="text-sm font-medium text-slate-700">
                        Repository reference
                        <input value={repository} onChange={(event) => setRepository(event.target.value)} maxLength={500} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="https://github.com/company/product" />
                      </label>
                      <label className="text-sm font-medium text-slate-700">
                        Base branch
                        <input value={baseBranch} onChange={(event) => setBaseBranch(event.target.value)} required maxLength={120} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" />
                      </label>
                    </div>

                    <button type="submit" disabled={runStatus === "submitting" || runStatus === "polling"} className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                      {runStatus === "submitting" || runStatus === "polling" ? <><Loader2 className="size-4 animate-spin" /> Running governed delivery</> : <><Play className="size-4" /> Start governed run</>}
                    </button>
                  </section>

                  <aside className="space-y-5">
                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-sm font-semibold">Execution configuration</h3>
                      <div className="mt-5 space-y-4">
                        {[
                          [Code2, "Coding agent", "FDE deterministic demo driver", "Codex, Claude and Cursor adapters available when configured"],
                          [ServerCog, "Sandbox", "Local ephemeral workspace", "Customer Docker or Kubernetes gateway"],
                          [GitPullRequest, "Promotion", "Reviewable PR package", "GitHub App required for branch and PR creation"],
                        ].map(([Icon, label, value, detail]) => {
                          const ItemIcon = Icon as typeof Code2;
                          return (
                            <div key={String(label)} className="flex gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><ItemIcon className="size-4" /></div>
                              <div><p className="text-xs text-slate-400">{String(label)}</p><p className="mt-1 text-sm font-semibold">{String(value)}</p><p className="mt-1 text-[11px] leading-5 text-slate-400">{String(detail)}</p></div>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-sm font-semibold">Bound policy</h3>
                      <div className="mt-4 space-y-3 text-xs">
                        {[
                          ["Human approval", "Required"],
                          ["Network access", "Disabled"],
                          ["Secret access", "None"],
                          ["Workspace retention", "Ephemeral"],
                          ["Maximum run cost", "$1.00"],
                        ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-semibold text-slate-800">{value}</span></div>)}
                      </div>
                    </section>
                  </aside>
                </div>
              </form>
            )}

            {view === "run" && (
              job ? (
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div><h2 className="text-2xl font-semibold tracking-[-0.025em]">Run workspace</h2><p className="mt-2 text-sm text-slate-500">Current lifecycle, routing, policy and generated output.</p></div>
                    <button onClick={refreshJob} disabled={runStatus === "polling"} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"><RefreshCw className={`size-3.5 ${runStatus === "polling" ? "animate-spin" : ""}`} /> Refresh</button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <SummaryCard label="Job status" value={job.status} detail={`Accepted ${formatDate(job.acceptedAt)}`} icon={Activity} />
                    <SummaryCard label="Execution" value={result ? `${result.cycleTimeMs} ms` : "In progress"} detail="Execution-plane cycle time" icon={Clock3} />
                    <SummaryCard label="Observed events" value={String(job.usage.eventCount)} detail={audit?.verified ? "Audit chain verified" : "Loading audit verification"} icon={FileCheck2} />
                    <SummaryCard label="Approvals" value={`${completedApprovals}/${approvalCount || "—"}`} detail={job.approvalStatus.replaceAll("-", " ")} icon={ShieldCheck} />
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <section className="rounded-2xl border border-slate-200 bg-white p-6">
                      <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">Delivery lifecycle</h3><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusStyle(job.status)}`}>{job.status}</span></div>
                      <div className="mt-6 space-y-1">
                        {(result?.steps || [
                          { id: "accepted", label: "Job accepted", status: "completed", detail: "Client intent and policy bound to a durable job.", durationMs: 0 },
                          { id: "execution", label: "Execution plane", status: job.status === "running" ? "ready" : "blocked", detail: "Waiting for execution-plane evidence.", durationMs: 0 },
                        ]).map((step, index) => (
                          <div key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
                            {index < (result?.steps.length || 2) - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-1rem)] w-px bg-slate-200" />}
                            <div className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${step.status === "completed" ? "bg-emerald-100 text-emerald-700" : step.status === "blocked" ? "bg-red-100 text-red-700" : "bg-cyan-100 text-cyan-700"}`}>
                              {step.status === "completed" ? <Check className="size-4" /> : step.status === "blocked" ? <X className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
                            </div>
                            <div className="pt-1"><p className="text-sm font-semibold">{step.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{step.detail}</p>{step.durationMs > 0 && <p className="mt-1 text-[10px] text-slate-400">{step.durationMs} ms</p>}</div>
                          </div>
                        ))}
                      </div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-6">
                      <h3 className="text-sm font-semibold">Request and routing</h3>
                      <dl className="mt-5 space-y-4 text-sm">
                        <div><dt className="text-xs text-slate-400">Client intent</dt><dd className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap leading-6 text-slate-700">{job.request.intent}</dd></div>
                        <div className="grid grid-cols-2 gap-4"><div><dt className="text-xs text-slate-400">Repository</dt><dd className="mt-1 break-all text-xs font-medium">{job.request.repository || "Not connected in demo"}</dd></div><div><dt className="text-xs text-slate-400">Base branch</dt><dd className="mt-1 font-mono text-xs">{job.request.baseBranch}</dd></div></div>
                        <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">{[["Agent", job.request.driverId], ["Sandbox", job.request.sandboxId], ["SCM", job.request.sourceControlId]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">{label}</dt><dd className="mt-1 break-all text-xs font-semibold">{value}</dd></div>)}</div>
                      </dl>
                      {result && <div className="mt-6 grid grid-cols-2 gap-3"><button onClick={() => setView("preview")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white"><Boxes className="size-3.5" /> Open preview</button><button onClick={() => setView("evidence")} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700"><FileCheck2 className="size-3.5" /> Inspect evidence</button></div>}
                    </section>
                  </div>
                </div>
              ) : <EmptyState icon={LayoutDashboard} title="No active delivery job" body="Create a client request to open the run workspace." onStart={() => setView("request")} />
            )}

            {view === "preview" && (
              result ? (
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6"><h2 className="text-2xl font-semibold tracking-[-0.025em]">Generated product preview</h2><p className="mt-2 text-sm text-slate-500">Working behavior generated inside the execution plane. This preview is sandboxed and cannot access the parent application.</p></div>
                  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3"><div className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-red-300"/><span className="size-2.5 rounded-full bg-amber-300"/><span className="size-2.5 rounded-full bg-emerald-300"/></div><span className="font-mono text-[10px] text-slate-400">sandbox://{job?.id}/preview</span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Validation ready</span></div>
                    <iframe title="Generated FDE workflow" srcDoc={result.previewHtml} sandbox="" className="h-[46rem] w-full bg-white" />
                  </section>
                </div>
              ) : <EmptyState icon={Boxes} title="No generated product yet" body="Complete a governed run to see the working product produced by the execution plane." onStart={() => setView("request")} />
            )}

            {view === "evidence" && (
              result ? (
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-semibold tracking-[-0.025em]">Observed evidence</h2><p className="mt-2 text-sm text-slate-500">Captured by FDE-Toolkit instrumentation at the execution boundary—not reported by the agent.</p></div><div className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${audit?.verified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{audit?.verified ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-4 animate-spin" />}{audit?.verified ? "Audit chain verified" : "Audit verification pending"}</div></div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <SummaryCard label="Filesystem changes" value={String(result.provenance.filesystemDiff.length)} detail="SHA-256 hashed" icon={FileCode2} />
                    <SummaryCard label="Commands" value={String(result.provenance.commands.length)} detail="Exact argv and exit codes" icon={TerminalSquare} />
                    <SummaryCard label="Tests" value={`${result.provenance.tests.filter((test) => test.passed).length}/${result.provenance.tests.length}`} detail="Observed test outcomes" icon={TestTube2} />
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-semibold">Filesystem diff</h3></div>
                      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-5 py-3 font-medium">Path</th><th className="px-5 py-3 font-medium">Operation</th><th className="px-5 py-3 font-medium">Bytes</th><th className="px-5 py-3 font-medium">SHA-256</th></tr></thead><tbody>{result.provenance.filesystemDiff.map((file) => <tr key={file.path} className="border-t border-slate-100"><td className="px-5 py-3 font-mono text-slate-700">{file.path}</td><td className="px-5 py-3"><span className="rounded bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">{file.operation}</span></td><td className="px-5 py-3 text-slate-500">{file.bytes}</td><td className="max-w-52 truncate px-5 py-3 font-mono text-slate-400" title={file.sha256}>{file.sha256}</td></tr>)}</tbody></table></div>
                    </section>

                    <section className="rounded-2xl border border-slate-200 bg-white p-5">
                      <h3 className="text-sm font-semibold">Audit event chain</h3>
                      <p className="mt-2 break-all font-mono text-[10px] text-slate-400">Head: {audit?.headHash || "Loading…"}</p>
                      <div className="mt-5 max-h-[29rem] space-y-1 overflow-auto pr-1">
                        {(audit?.records || []).map((record) => <div key={record.sequence} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 font-mono text-[10px] text-slate-500">{record.sequence}</span><div className="min-w-0"><p className="truncate text-xs font-semibold">{record.type}</p><p className="mt-1 text-[10px] text-slate-400">{record.source} · {formatDate(record.observedAt)}</p></div></div>)}
                      </div>
                    </section>
                  </div>

                  <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                    <h3 className="text-sm font-semibold">Commands and tests</h3>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      <div className="space-y-3">{result.provenance.commands.map((command, index) => <div key={`${command.stdoutSha256}-${index}`} className="rounded-xl bg-slate-950 p-4 text-slate-200"><p className="font-mono text-xs">$ {command.argv.join(" ")}</p><div className="mt-3 flex gap-4 text-[10px] text-slate-500"><span>exit {command.exitCode}</span><span>{command.durationMs} ms</span><span className="truncate">stdout {command.stdoutSha256}</span></div></div>)}</div>
                      <div className="space-y-3">{result.provenance.tests.map((test) => <div key={test.name} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4">{test.passed ? <CheckCircle2 className="size-5 text-emerald-600" /> : <XCircle className="size-5 text-red-600" />}<div><p className="text-sm font-semibold">{test.name}</p><p className="mt-1 font-mono text-[10px] text-slate-400">{test.outputSha256}</p></div></div>)}</div>
                    </div>
                  </section>
                </div>
              ) : <EmptyState icon={FileCheck2} title="No execution evidence yet" body="Complete a governed run to inspect file hashes, commands, tests and the audit chain." onStart={() => setView("request")} />
            )}

            {view === "approvals" && (
              result && job ? (
                <div className="mx-auto max-w-5xl">
                  <div className="mb-6"><h2 className="text-2xl font-semibold tracking-[-0.025em]">Human approval gates</h2><p className="mt-2 text-sm text-slate-500">These decisions are recorded outside the coding agent and remain attached to the durable job.</p></div>
                  <div className={`mb-6 rounded-2xl border p-5 ${job.approvalStatus === "approved" ? "border-emerald-200 bg-emerald-50" : job.approvalStatus === "rejected" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-center gap-3">{job.approvalStatus === "approved" ? <CheckCircle2 className="size-5 text-emerald-700" /> : job.approvalStatus === "rejected" ? <XCircle className="size-5 text-red-700" /> : <Clock3 className="size-5 text-amber-700" />}<div><p className="text-sm font-semibold capitalize">Approval status: {job.approvalStatus.replaceAll("-", " ")}</p><p className="mt-1 text-xs text-slate-600">{completedApprovals} of {approvalCount} required decisions approved.</p></div></div>
                  </div>
                  <div className="space-y-4">
                    {job.request.requiredApprovals.map((approvalKey, index) => {
                      const decision = job.approvals.find((item) => item.approvalKey === approvalKey);
                      return (
                        <article key={approvalKey} className="rounded-2xl border border-slate-200 bg-white p-6">
                          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-4"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-600">{index + 1}</span><div><h3 className="text-sm font-semibold">{approvalKey}</h3><p className="mt-2 text-xs leading-5 text-slate-500">Confirm the generated behavior, attached evidence and promotion boundary for this gate.</p>{decision && <p className="mt-3 text-[11px] text-slate-400">Recorded {formatDate(decision.decidedAt)} · {decision.actor.role}</p>}</div></div>
                            {decision ? <span className={`inline-flex items-center gap-2 self-start rounded-lg px-3 py-2 text-xs font-semibold ${decision.decision === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{decision.decision === "approved" ? <CheckCircle2 className="size-4" /> : <XCircle className="size-4" />}{decision.decision}</span> : <div className="flex gap-2"><button disabled={approvalBusy === approvalKey} onClick={() => decideApproval(approvalKey, "reject")} className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"><X className="size-3.5" /> Reject</button><button disabled={approvalBusy === approvalKey} onClick={() => decideApproval(approvalKey, "approve")} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{approvalBusy === approvalKey ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Approve</button></div>}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <p className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs leading-5 text-slate-500"><KeyRound className="mr-2 inline size-3.5" />This gated preview uses a prospect approver identity. Enterprise deployments bind each decision to SSO, organization membership and policy roles.</p>
                </div>
              ) : <EmptyState icon={ShieldCheck} title="No approval workflow yet" body="Complete a governed run to generate the required human gates." onStart={() => setView("request")} />
            )}

            {view === "promotion" && (
              result && job ? (
                <div className="mx-auto max-w-7xl">
                  <div className="mb-6"><h2 className="text-2xl font-semibold tracking-[-0.025em]">Promotion package</h2><p className="mt-2 text-sm text-slate-500">Review the proposed engineering handoff. No branch or pull request is created until the SCM driver is configured and approvals are complete.</p></div>

                  <div className={`mb-6 flex flex-col gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center sm:justify-between ${job.approvalStatus === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
                    <div className="flex items-center gap-3">{job.approvalStatus === "approved" ? <CheckCircle2 className="size-5 text-emerald-700" /> : <LockKeyhole className="size-5 text-amber-700" />}<div><p className="text-sm font-semibold">{job.approvalStatus === "approved" ? "Ready for SCM promotion" : "Promotion blocked by approval policy"}</p><p className="mt-1 text-xs text-slate-600">{job.approvalStatus === "approved" ? "All required gates are approved. Connect a GitHub App to create the branch and draft PR." : `${completedApprovals} of ${approvalCount} gates approved.`}</p></div></div>
                    {job.approvalStatus !== "approved" && <button onClick={() => setView("approvals")} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-semibold text-white">Open approvals <ArrowRight className="size-3.5" /></button>}
                  </div>

                  <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
                    <section className="space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs text-slate-400">Pull-request title</p><p className="mt-2 text-base font-semibold">{result.promotionPackage.title}</p></div>
                      <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-xs text-slate-400"><GitBranch className="size-3.5" /> Proposed branch</div><p className="mt-2 break-all font-mono text-sm">{result.promotionPackage.branchName}</p><div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><Code2 className="size-3.5" /> Commit message</div><p className="mt-2 text-sm">{result.promotionPackage.commitMessage}</p></div>
                      <button disabled className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-slate-300 px-5 py-3 text-sm font-semibold text-slate-500"><GitPullRequest className="size-4" /> GitHub App not configured</button>
                    </section>

                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                      <div className="border-b border-slate-200 px-5 py-4"><h3 className="text-sm font-semibold">Changed files</h3><p className="mt-1 text-xs text-slate-400">{result.promotionPackage.changedFiles.length} artifacts in the proposed package</p></div>
                      <div>{result.promotionPackage.changedFiles.map((file) => <div key={file.path} className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 last:border-0"><div className="min-w-0"><p className="truncate font-mono text-xs text-slate-800">{file.path}</p><p className="mt-1 text-xs leading-5 text-slate-400">{file.purpose}</p></div><span className="shrink-0 text-[10px] text-slate-400">{file.bytes} B</span></div>)}</div>
                    </section>
                  </div>

                  <details className="mt-6 rounded-2xl border border-slate-200 bg-white p-5"><summary className="cursor-pointer text-sm font-semibold">Open generated PR body</summary><pre className="mt-5 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-5 text-xs leading-6 text-slate-300">{result.promotionPackage.body}</pre></details>
                </div>
              ) : <EmptyState icon={GitPullRequest} title="No promotion package yet" body="Complete a governed run to generate the proposed branch, commit, changed files and approval policy." onStart={() => setView("request")} />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
