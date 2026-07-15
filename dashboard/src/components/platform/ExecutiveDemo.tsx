"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Cloud,
  Code2,
  Eye,
  FileCheck2,
  GitPullRequest,
  Landmark,
  Loader2,
  LockKeyhole,
  Network,
  Play,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { demoPhases, decisionScenarios } from "@/lib/orchestration/decision-scenarios";
import { providerCatalog } from "@/lib/orchestration/catalog";
import type { OrchestrationResult, OrchestrationScenario } from "@/lib/orchestration/types";

const scenarioOrder: OrchestrationScenario[] = [
  "enterprise-ai",
  "saas-design-partner",
  "si-delivery",
];

const scenarioIcons = {
  "enterprise-ai": Landmark,
  "saas-design-partner": Cloud,
  "si-delivery": Briefcase,
} satisfies Record<OrchestrationScenario, typeof Landmark>;

const scenarioAccent = {
  "enterprise-ai": {
    ring: "border-cyan-300/45 bg-cyan-300/10",
    text: "text-cyan-200",
    icon: "bg-cyan-300/10 text-cyan-300",
  },
  "saas-design-partner": {
    ring: "border-violet-300/45 bg-violet-300/10",
    text: "text-violet-200",
    icon: "bg-violet-300/10 text-violet-300",
  },
  "si-delivery": {
    ring: "border-orange-300/45 bg-orange-300/10",
    text: "text-orange-200",
    icon: "bg-orange-300/10 text-orange-300",
  },
} satisfies Record<OrchestrationScenario, { ring: string; text: string; icon: string }>;

function ScenarioCard({
  id,
  active,
  onSelect,
}: {
  id: OrchestrationScenario;
  active: boolean;
  onSelect: (id: OrchestrationScenario) => void;
}) {
  const scenario = decisionScenarios[id];
  const Icon = scenarioIcons[id];
  const accent = scenarioAccent[id];

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group h-full rounded-3xl border p-6 text-left transition hover:-translate-y-1 hover:border-white/25 hover:bg-slate-900/80 ${
        active ? accent.ring : "border-white/10 bg-slate-900/55"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className={`flex size-11 items-center justify-center rounded-2xl ${accent.icon}`}>
          <Icon className="size-5" />
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-[0.16em] ${active ? accent.text : "text-slate-600"}`}>
          {scenario.industry}
        </span>
      </div>
      <p className="mt-6 text-sm font-semibold text-white">{scenario.organization}</p>
      <h3 className="mt-2 text-xl font-semibold leading-7 text-slate-100">{scenario.headline}</h3>
      <p className="mt-4 text-sm leading-6 text-slate-400">{scenario.trigger}</p>
      <div className="mt-6 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
        <span className="text-xs text-slate-500">{scenario.sponsor}</span>
        <ArrowRight className={`size-4 transition group-hover:translate-x-1 ${active ? accent.text : "text-slate-600"}`} />
      </div>
    </button>
  );
}

function PhaseTracker({ activePhase, status }: { activePhase: number; status: string }) {
  return (
    <div className="space-y-3">
      {demoPhases.map((phase, index) => {
        const completed = status === "success" || index < activePhase;
        const active = status === "running" && index === activePhase;
        return (
          <div
            key={phase}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
              active
                ? "border-cyan-300/40 bg-cyan-300/10"
                : completed
                  ? "border-emerald-300/20 bg-emerald-300/5"
                  : "border-white/10 bg-slate-950/55"
            }`}
          >
            {active ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-cyan-300" />
            ) : completed ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-300" />
            ) : (
              <Circle className="size-4 shrink-0 text-slate-700" />
            )}
            <span className={`text-xs ${active ? "font-semibold text-cyan-100" : completed ? "text-slate-300" : "text-slate-600"}`}>
              {phase}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function OutcomeMetric({ label, baseline, target, note }: { label: string; baseline: string; target: string; note: string }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-600">Current</p>
          <p className="mt-1 text-sm font-semibold text-slate-400">{baseline}</p>
        </div>
        <ArrowRight className="size-4 text-cyan-300" />
        <div>
          <p className="text-[10px] uppercase tracking-[0.12em] text-emerald-400/70">Pilot target</p>
          <p className="mt-1 text-lg font-semibold text-emerald-200">{target}</p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-5 text-slate-600">{note}</p>
    </article>
  );
}

function ProvenanceSummary({ result }: { result: OrchestrationResult }) {
  const passedTests = result.provenance.tests.filter((test) => test.passed).length;
  const command = result.provenance.commands[0];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <FileCheck2 className="size-5 text-cyan-300" />
        <p className="mt-4 text-2xl font-semibold">{result.provenance.filesystemDiff.length}</p>
        <p className="mt-1 text-xs text-slate-500">Files independently hashed</p>
      </article>
      <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <Code2 className="size-5 text-orange-200" />
        <p className="mt-4 text-sm font-semibold text-white">Exit code {command?.exitCode ?? "—"}</p>
        <p className="mt-1 break-words font-mono text-[10px] leading-5 text-slate-500">
          {command?.argv.join(" ") ?? "No command recorded"}
        </p>
      </article>
      <article className="rounded-2xl border border-white/10 bg-slate-950/70 p-5">
        <ShieldCheck className="size-5 text-emerald-300" />
        <p className="mt-4 text-2xl font-semibold">{passedTests}/{result.provenance.tests.length}</p>
        <p className="mt-1 text-xs text-slate-500">Observed test suites passed</p>
      </article>
    </div>
  );
}

export function ExecutiveDemo() {
  const [scenarioId, setScenarioId] = useState<OrchestrationScenario>("enterprise-ai");
  const [clientAsk, setClientAsk] = useState(decisionScenarios["enterprise-ai"].clientAsk);
  const [repository, setRepository] = useState(decisionScenarios["enterprise-ai"].repository);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [activePhase, setActivePhase] = useState(0);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OrchestrationResult | null>(null);

  const scenario = useMemo(() => decisionScenarios[scenarioId], [scenarioId]);

  useEffect(() => {
    if (status !== "running") return;
    setActivePhase(0);
    const timer = window.setInterval(() => {
      setActivePhase((phase) => Math.min(phase + 1, demoPhases.length - 2));
    }, 700);
    return () => window.clearInterval(timer);
  }, [status]);

  function selectScenario(next: OrchestrationScenario) {
    const selected = decisionScenarios[next];
    setScenarioId(next);
    setClientAsk(selected.clientAsk);
    setRepository(selected.repository);
    setResult(null);
    setError("");
    setStatus("idle");
    window.requestAnimationFrame(() => {
      document.getElementById("executive-demo")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function runDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("running");
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/orchestration/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenarioId,
          clientAsk,
          repository,
          baseBranch: "main",
          codingAgentId: "fde-demo-agent",
          sandboxId: "local-ephemeral",
          sourceControlId: "promotion-package",
          approvalMode: "human-required",
        }),
      });
      const payload = (await response.json()) as { error?: string; result?: OrchestrationResult };
      if (!response.ok || !payload.result) throw new Error(payload.error || "The executive demo could not complete.");
      setActivePhase(demoPhases.length - 1);
      setResult(payload.result);
      setStatus("success");
      window.requestAnimationFrame(() => {
        document.getElementById("decision-brief")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The executive demo could not complete.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-5 pb-20 pt-16 sm:px-8 lg:px-12 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 size-[38rem] rounded-full bg-cyan-400/10 blur-[135px]" />
          <div className="absolute right-0 top-20 size-[30rem] rounded-full bg-violet-400/10 blur-[125px]" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
                <Sparkles className="size-3.5" /> Executive product demo
              </div>
              <h1 className="mt-7 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
                Watch a client ask become
                <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">
                  a governed engineering decision.
                </span>
              </h1>
              <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
                Pick a real delivery situation. FDE-Toolkit turns the request into a working product proof, observed execution evidence, named approvals, and a reviewable PR package—without dictating the client’s coding agent or runtime.
              </p>
            </div>
            <div className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-6 backdrop-blur">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">What a decision maker gets</p>
              <div className="mt-5 space-y-4">
                {[
                  [Target, "A decision brief", "What changed, why it matters, and what must be approved."],
                  [Eye, "Proof, not agent claims", "Observed file hashes, commands, exit codes, and tests."],
                  [TrendingUp, "A measurable pilot", "Ask-to-approved-PR, reuse, approvals, and adoption targets."],
                ].map(([Icon, title, body]) => {
                  const ItemIcon = Icon as typeof Target;
                  return (
                    <div key={String(title)} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <ItemIcon className="mt-0.5 size-5 shrink-0 text-cyan-300" />
                      <div>
                        <p className="text-sm font-semibold">{String(title)}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{String(body)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {scenarioOrder.map((id) => (
              <ScenarioCard key={id} id={id} active={scenarioId === id} onSelect={selectScenario} />
            ))}
          </div>
        </div>
      </section>

      <section id="executive-demo" className="scroll-mt-24 border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-6">
              <article className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${scenarioAccent[scenarioId].ring} ${scenarioAccent[scenarioId].text}`}>
                    {scenario.organization} · synthetic demo
                  </span>
                  <span className="text-xs text-slate-600">{scenario.sponsor}</span>
                </div>
                <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">The boardroom question</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em]">{scenario.boardroomQuestion}</h2>
                <div className="mt-7 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-red-300/15 bg-red-300/5 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                      <AlertTriangle className="size-4" /> Risk today
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.riskToday}</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-200">
                      <CheckCircle2 className="size-4" /> Decision-ready output
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.decisionReady}</p>
                  </div>
                </div>
              </article>

              <div className="grid gap-4">
                {scenario.metrics.map((metric) => (
                  <OutcomeMetric key={metric.label} {...metric} />
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <form onSubmit={runDemo} className="rounded-[2rem] border border-cyan-300/20 bg-slate-900/70 p-6 shadow-2xl shadow-cyan-950/20 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-300">Live governed delivery</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Run the client ask through the control plane.</h2>
                  </div>
                  <div className="hidden size-12 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300 sm:flex">
                    <Network className="size-5" />
                  </div>
                </div>

                <label className="mt-7 block text-sm font-medium text-slate-200">
                  Client request
                  <textarea
                    value={clientAsk}
                    onChange={(event) => setClientAsk(event.target.value)}
                    minLength={20}
                    maxLength={1500}
                    rows={7}
                    required
                    className="mt-2 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10"
                  />
                </label>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {scenario.approvedStack.map((item, index) => {
                    const icons = [Code2, ServerCog, GitPullRequest];
                    const Icon = icons[index];
                    return (
                      <div key={item} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                        <Icon className="size-4 text-cyan-300" />
                        <p className="mt-3 text-xs font-semibold text-slate-200">{item}</p>
                      </div>
                    );
                  })}
                </div>

                <details className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400">Demo execution details</summary>
                  <div className="mt-4 space-y-2 text-xs leading-5 text-slate-600">
                    <p>Repository reference: {repository}</p>
                    <p>Public demo agent: deterministic FDE driver</p>
                    <p>Execution: isolated execution-plane service with no repository credentials</p>
                    <p>Promotion: package only; no branch is pushed</p>
                  </div>
                </details>

                {status === "error" && (
                  <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200">
                    <p className="font-semibold">The execution could not complete.</p>
                    <p className="mt-1 text-xs leading-5 text-red-200/75">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={status === "running"}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 py-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status === "running" ? (
                    <><Loader2 className="size-4 animate-spin" /> Building the decision brief</>
                  ) : (
                    <><Play className="size-4" /> Run {scenario.shortLabel} demo</>
                  )}
                </button>
              </form>

              <section className="rounded-[2rem] border border-white/10 bg-slate-900/45 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">What FDE-Toolkit is doing</p>
                    <p className="mt-2 text-sm text-slate-300">The buyer sees the delivery and governance journey—not a spinner.</p>
                  </div>
                  <Clock3 className="size-5 text-cyan-300" />
                </div>
                <div className="mt-5">
                  <PhaseTracker activePhase={activePhase} status={status} />
                </div>
              </section>
            </div>
          </div>
        </div>
      </section>

      {result && (
        <section id="decision-brief" className="scroll-mt-24 border-b border-white/10 bg-slate-900/30 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2.25rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-300/10 via-slate-900/70 to-cyan-300/5 p-7 sm:p-10">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    <CheckCircle2 className="size-4" /> Executive decision brief ready
                  </div>
                  <h2 className="mt-6 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                    Approve a bounded pilot—with evidence and guardrails already attached.
                  </h2>
                  <p className="mt-5 text-lg leading-8 text-slate-300">{scenario.modeledOutcome}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:min-w-[28rem]">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <Clock3 className="size-4 text-cyan-300" />
                    <p className="mt-3 text-xl font-semibold">{result.cycleTimeMs} ms</p>
                    <p className="mt-1 text-[11px] text-slate-500">Demo execution</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
                    <FileCheck2 className="size-4 text-cyan-300" />
                    <p className="mt-3 text-xl font-semibold">{result.promotionPackage.changedFiles.length}</p>
                    <p className="mt-1 text-[11px] text-slate-500">Observed artifacts</p>
                  </div>
                  <div className="col-span-2 rounded-2xl border border-white/10 bg-slate-950/70 p-4 sm:col-span-1">
                    <LockKeyhole className="size-4 text-cyan-300" />
                    <p className="mt-3 text-xl font-semibold">Human</p>
                    <p className="mt-1 text-[11px] text-slate-500">Final authority</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <Target className="size-5 text-cyan-300" />
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Business decision</p>
                <h3 className="mt-2 text-xl font-semibold">Pilot this workflow slice</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.decisionReady}</p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <ShieldCheck className="size-5 text-emerald-300" />
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Governance decision</p>
                <h3 className="mt-2 text-xl font-semibold">Keep execution inside the approved boundary</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  {result.executionBoundary} · {result.provenance.trustModel.replaceAll("-", " ")}
                </p>
              </article>
              <article className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <Boxes className="size-5 text-orange-200" />
                <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Knowledge decision</p>
                <h3 className="mt-2 text-xl font-semibold">Retain the reusable pattern</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.reusableAsset}</p>
              </article>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Working product proof</p>
                    <h3 className="mt-1 text-lg font-semibold">The client can react to behavior, not a requirements document.</h3>
                  </div>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] text-slate-500">sandboxed preview</span>
                </div>
                <iframe title="Generated workflow preview" srcDoc={result.previewHtml} sandbox="" className="h-[36rem] w-full bg-slate-950" />
              </section>

              <div className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-cyan-300" />
                    <h3 className="text-lg font-semibold">Questions the approvers answer now</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {scenario.approvalQuestions.map((question, index) => (
                      <div key={question} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 font-mono text-[10px] text-cyan-300">{index + 1}</span>
                        <p className="text-sm leading-6 text-slate-300">{question}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
                  <div className="flex items-center gap-2">
                    <Check className="size-5 text-emerald-300" />
                    <h3 className="text-lg font-semibold">Named approval gates</h3>
                  </div>
                  <div className="mt-5 space-y-3">
                    {result.promotionPackage.approvalsRequired.map((approval) => (
                      <div key={approval} className="flex items-center gap-3 text-sm text-slate-300">
                        <span className="size-4 rounded border border-white/25" /> {approval}
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <section className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/60 p-6 sm:p-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-200">Proof, not promise</p>
                  <h3 className="mt-2 text-2xl font-semibold">The toolkit observed the execution itself.</h3>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                    The audit record has one format across Codex, Claude Agent, Cursor, or a client-built agent because FDE-Toolkit instrumentation—not the agent—writes the provenance.
                  </p>
                </div>
                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
                  {result.provenance.capturedBy}
                </span>
              </div>
              <div className="mt-6">
                <ProvenanceSummary result={result} />
              </div>
            </section>

            <details className="mt-8 rounded-[2rem] border border-white/10 bg-slate-950/60 p-6">
              <summary className="cursor-pointer text-sm font-semibold text-slate-300">Open engineering handoff and PR package</summary>
              <div className="mt-6 grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">PR title</p>
                  <p className="mt-2 text-lg font-semibold">{result.promotionPackage.title}</p>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Branch</p>
                  <p className="mt-2 break-all font-mono text-xs text-cyan-200">{result.promotionPackage.branchName}</p>
                  <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Commit</p>
                  <p className="mt-2 text-sm text-slate-300">{result.promotionPackage.commitMessage}</p>
                </div>
                <div className="space-y-2">
                  {result.promotionPackage.changedFiles.map((file) => (
                    <div key={file.path} className="flex items-start justify-between gap-4 border-b border-white/10 py-3 text-xs last:border-0">
                      <div>
                        <p className="font-mono text-slate-200">{file.path}</p>
                        <p className="mt-1 text-slate-600">{file.purpose}</p>
                      </div>
                      <span className="shrink-0 text-slate-600">{file.bytes} B</span>
                    </div>
                  ))}
                </div>
              </div>
            </details>
          </div>
        </section>
      )}

      <section className="border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <details className="rounded-[2rem] border border-white/10 bg-slate-900/45 p-6 sm:p-8">
            <summary className="cursor-pointer text-lg font-semibold text-slate-200">Under the hood: interchangeable providers</summary>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
              The executive flow stays the same while the client changes its approved coding agent, sandbox, and promotion system.
            </p>
            <div className="mt-8 grid gap-6 lg:grid-cols-3">
              {[
                [Code2, "Coding agents", providerCatalog.codingAgents],
                [ServerCog, "Execution environments", providerCatalog.sandboxes],
                [GitPullRequest, "Promotion systems", providerCatalog.sourceControl],
              ].map(([Icon, title, providers]) => {
                const GroupIcon = Icon as typeof Code2;
                const entries = providers as typeof providerCatalog.codingAgents;
                return (
                  <div key={String(title)} className="rounded-3xl border border-white/10 bg-slate-950/65 p-5">
                    <GroupIcon className="size-5 text-cyan-300" />
                    <h3 className="mt-4 font-semibold">{String(title)}</h3>
                    <div className="mt-4 space-y-2">
                      {entries.map((provider) => (
                        <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.025] px-3 py-2 text-xs">
                          <span className="text-slate-400">{provider.name}</span>
                          <span className={provider.status === "demo-ready" ? "text-emerald-300" : "text-slate-700"}>
                            {provider.status === "demo-ready" ? "Demo" : "Driver"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-cyan-300/20 bg-cyan-300 p-8 text-slate-950 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-700">Pilot design</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Use one real client ask and prove the full decision loop.</h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Select the client-approved agent, execution boundary, and SCM. Measure time to approved PR, evidence capture, reuse, active FDE adoption, and expansion potential.
            </p>
          </div>
          <Link href="/#interest" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white">
            Design a 30-day pilot <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
