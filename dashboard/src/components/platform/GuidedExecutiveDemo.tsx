"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Cloud,
  Code2,
  Eye,
  FileCheck2,
  GitPullRequest,
  Landmark,
  Loader2,
  LockKeyhole,
  Network,
  Pause,
  Play,
  RotateCcw,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { decisionScenarios } from "@/lib/orchestration/decision-scenarios";
import type { OrchestrationResult, OrchestrationScenario } from "@/lib/orchestration/types";

const scenarioOrder: OrchestrationScenario[] = ["enterprise-ai", "saas-design-partner", "si-delivery"];

const scenarioIcons: Record<OrchestrationScenario, LucideIcon> = {
  "enterprise-ai": Landmark,
  "saas-design-partner": Cloud,
  "si-delivery": Briefcase,
};

const phaseIcons: LucideIcon[] = [Target, ShieldCheck, Network, Code2, Eye, GitPullRequest];

const phaseLabels = [
  "Capture the client intent",
  "Apply policy and tenancy",
  "Route approved execution",
  "Generate and test the candidate",
  "Observe provenance",
  "Prepare the decision package",
] as const;

type RunState = "idle" | "executing" | "walkthrough" | "ready" | "error";

type PhaseStory = {
  headline: string;
  explanation: string;
  whyItMatters: string;
  evidence: Array<{ label: string; value: string }>;
};

function phaseStory(index: number, result: OrchestrationResult, reusableAsset: string): PhaseStory {
  const command = result.provenance.commands[0];
  const passedTests = result.provenance.tests.filter((test) => test.passed).length;

  const stories: PhaseStory[] = [
    {
      headline: "The request is now a governed job—not a loose prompt.",
      explanation:
        "FDE-Toolkit preserved the original client ask, assigned a stable run ID, and attached the selected scenario and promotion intent.",
      whyItMatters:
        "Executives, product leaders, and engineers are now discussing the same request. The scope cannot silently mutate as it moves between people and tools.",
      evidence: [
        { label: "Run ID", value: result.runId },
        { label: "Client ask", value: `${result.clientAsk.length} characters preserved` },
        { label: "Approval mode", value: "Human required" },
      ],
    },
    {
      headline: "The control plane set the rules before any tool acted.",
      explanation:
        "The run was constrained by a policy profile that blocks autonomous promotion, arbitrary commands, network access, and secret injection in the public demo.",
      whyItMatters:
        "Governance is applied outside the coding agent. Changing from Codex to Claude Agent or a customer-built agent does not change the control model.",
      evidence: [
        { label: "Human approval", value: result.policyProfile.humanApprovalRequired ? "Mandatory" : "Not required" },
        { label: "Network", value: result.policyProfile.networkAccess },
        { label: "Secrets", value: result.policyProfile.secretsInjected ? "Injected" : "Not injected" },
      ],
    },
    {
      headline: "Only signed metadata crossed into the execution plane.",
      explanation:
        "The control plane routed the governed job to the configured execution boundary. Client source code and long-lived credentials were not stored in the control plane.",
      whyItMatters:
        "The same workflow can run in the toolkit cloud, a client VPC, or an air-gapped environment without rewriting the product experience.",
      evidence: [
        { label: "Execution boundary", value: result.executionBoundary },
        { label: "Agent driver", value: result.providers.codingAgent },
        { label: "Sandbox driver", value: result.providers.sandbox },
      ],
    },
    {
      headline: "A working candidate was produced and tested.",
      explanation:
        "The execution plane created a workflow prototype, acceptance evidence, test code, and a promotion package inside an ephemeral workspace.",
      whyItMatters:
        "The client can react to working behavior instead of debating a requirements document. Engineering receives a bounded, testable change rather than an open-ended request.",
      evidence: [
        { label: "Observed artifacts", value: String(result.promotionPackage.changedFiles.length) },
        { label: "Test result", value: result.promotionPackage.testSummary },
        { label: "Workspace", value: result.policyProfile.workspaceRetention },
      ],
    },
    {
      headline: "The toolkit verified what happened instead of trusting the agent.",
      explanation:
        "FDE-Toolkit instrumentation recorded file hashes, the exact test command, its exit code, output digest, and test outcomes at the execution boundary.",
      whyItMatters:
        "Every coding platform produces the same audit format. Procurement can allow different agents while security and engineering retain one governance language.",
      evidence: [
        { label: "Files hashed", value: String(result.provenance.filesystemDiff.length) },
        { label: "Command exit", value: command ? String(command.exitCode) : "Not recorded" },
        { label: "Tests passed", value: `${passedTests}/${result.provenance.tests.length}` },
      ],
    },
    {
      headline: "The run ended with a decision package—not an autonomous deployment.",
      explanation:
        "The control plane assembled a proposed branch, commit, pull-request body, observed evidence, reusable knowledge classification, and named approval gates.",
      whyItMatters:
        "Business, risk, product, and engineering can make an informed decision together. Promotion remains blocked until the accountable humans approve it.",
      evidence: [
        { label: "Approvals", value: String(result.promotionPackage.approvalsRequired.length) },
        { label: "Proposed branch", value: result.promotionPackage.branchName },
        { label: "Reusable asset", value: reusableAsset },
      ],
    },
  ];

  return stories[index] ?? stories[0];
}

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

  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group rounded-3xl border p-6 text-left transition hover:-translate-y-1 ${
        active ? "border-cyan-300/50 bg-cyan-300/10" : "border-white/10 bg-slate-900/55 hover:border-white/25"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
          <Icon className="size-5" />
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-600">{scenario.industry}</span>
      </div>
      <p className="mt-5 text-sm font-semibold text-white">{scenario.organization}</p>
      <h3 className="mt-2 text-xl font-semibold leading-7 text-slate-100">{scenario.headline}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.trigger}</p>
      <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-500">
        <span>{scenario.shortLabel}</span>
        <ArrowRight className="size-4 transition group-hover:translate-x-1" />
      </div>
    </button>
  );
}

function MetricCard({ label, baseline, target, note }: { label: string; baseline: string; target: string; note: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-slate-950/65 p-5">
      <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{label}</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="text-sm font-semibold text-slate-500">{baseline}</span>
        <ArrowRight className="size-4 text-cyan-300" />
        <span className="text-lg font-semibold text-emerald-200">{target}</span>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-600">{note}</p>
    </article>
  );
}

function RunTheatre({
  state,
  activePhase,
  result,
  autoPlay,
  reusableAsset,
  onNext,
  onToggleAutoPlay,
  onSkip,
  onOpenBrief,
  onReset,
}: {
  state: RunState;
  activePhase: number;
  result: OrchestrationResult | null;
  autoPlay: boolean;
  reusableAsset: string;
  onNext: () => void;
  onToggleAutoPlay: () => void;
  onSkip: () => void;
  onOpenBrief: () => void;
  onReset: () => void;
}) {
  const story = result ? phaseStory(activePhase, result, reusableAsset) : null;
  const progress = state === "idle" ? 0 : state === "executing" ? 8 : ((activePhase + 1) / phaseLabels.length) * 100;
  const ActiveIcon = phaseIcons[activePhase] ?? Target;

  return (
    <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/55">
      <div className="border-b border-white/10 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Guided run walkthrough</p>
            <h3 className="mt-2 text-xl font-semibold">
              {state === "idle" && "The journey will pause at every meaningful milestone."}
              {state === "executing" && "The execution plane is processing the signed job."}
              {state === "walkthrough" && "The actual run finished. Now inspect what it produced."}
              {state === "ready" && "You have seen the complete governed delivery loop."}
              {state === "error" && "The run did not complete."}
            </h3>
          </div>
          {result && (
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Actual execution: {result.cycleTimeMs} ms
            </span>
          )}
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {state === "idle" && (
        <div className="p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              [Target, "Understand the ask", "See how business intent becomes a governed engineering job."],
              [Eye, "Inspect the proof", "Review independently observed files, commands, and tests."],
              [Users, "Make the decision", "See exactly which humans must approve promotion."],
            ].map(([Icon, title, body]) => {
              const CardIcon = Icon as LucideIcon;
              return (
                <div key={String(title)} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                  <CardIcon className="size-5 text-cyan-300" />
                  <p className="mt-4 text-sm font-semibold">{String(title)}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{String(body)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {state === "executing" && (
        <div className="flex min-h-80 flex-col items-center justify-center p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-3xl border border-cyan-300/20 bg-cyan-300/10">
            <Loader2 className="size-7 animate-spin text-cyan-300" />
          </div>
          <h4 className="mt-6 text-2xl font-semibold">Sending the governed job to the execution plane</h4>
          <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
            The control plane is exchanging signed metadata, applying the selected policy, and waiting for observed evidence from the execution boundary.
          </p>
        </div>
      )}

      {(state === "walkthrough" || state === "ready") && result && story && (
        <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
          <div className="border-b border-white/10 p-5 lg:border-b-0 lg:border-r lg:p-6">
            <div className="space-y-2">
              {phaseLabels.map((label, index) => {
                const completed = state === "ready" || index < activePhase;
                const active = index === activePhase && state === "walkthrough";
                const Icon = phaseIcons[index];
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => undefined}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left ${
                      active
                        ? "border-cyan-300/40 bg-cyan-300/10"
                        : completed
                          ? "border-emerald-300/15 bg-emerald-300/5"
                          : "border-transparent bg-transparent"
                    }`}
                  >
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${active ? "bg-cyan-300/15 text-cyan-300" : completed ? "bg-emerald-300/10 text-emerald-300" : "bg-white/5 text-slate-700"}`}>
                      {completed ? <Check className="size-4" /> : <Icon className="size-4" />}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${active ? "text-cyan-100" : completed ? "text-slate-300" : "text-slate-600"}`}>
                        Step {index + 1}
                      </p>
                      <p className={`mt-0.5 text-xs ${active ? "text-slate-300" : "text-slate-600"}`}>{label}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/10 text-cyan-300">
                <ActiveIcon className="size-5" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                  Step {activePhase + 1} of {phaseLabels.length} · {phaseLabels[activePhase]}
                </p>
                <h4 className="mt-3 text-2xl font-semibold leading-tight">{story.headline}</h4>
              </div>
            </div>

            <p className="mt-6 text-sm leading-7 text-slate-300">{story.explanation}</p>

            <div className="mt-6 rounded-2xl border border-orange-300/15 bg-orange-300/5 p-5">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-orange-200">Why this matters to the buyer</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">{story.whyItMatters}</p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {story.evidence.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
                  <p className="text-[10px] uppercase tracking-[0.13em] text-slate-600">{item.label}</p>
                  <p className="mt-2 break-words text-sm font-semibold text-slate-200">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {state === "walkthrough" && (
                <>
                  <button type="button" onClick={onNext} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-cyan-200">
                    {activePhase === phaseLabels.length - 1 ? "Complete walkthrough" : `Next: ${phaseLabels[activePhase + 1]}`}
                    <ChevronRight className="size-4" />
                  </button>
                  <button type="button" onClick={onToggleAutoPlay} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">
                    {autoPlay ? <Pause className="size-4" /> : <Play className="size-4" />}
                    {autoPlay ? "Pause auto-play" : "Auto-play steps"}
                  </button>
                  <button type="button" onClick={onSkip} className="px-3 py-3 text-xs font-semibold text-slate-600 hover:text-slate-300">
                    Skip to summary
                  </button>
                </>
              )}

              {state === "ready" && (
                <>
                  <button type="button" onClick={onOpenBrief} className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200">
                    Open executive decision brief <ArrowRight className="size-4" />
                  </button>
                  <button type="button" onClick={onReset} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300 hover:bg-white/5">
                    <RotateCcw className="size-4" /> Replay from step 1
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function GuidedExecutiveDemo() {
  const [scenarioId, setScenarioId] = useState<OrchestrationScenario>("enterprise-ai");
  const [clientAsk, setClientAsk] = useState(decisionScenarios["enterprise-ai"].clientAsk);
  const [repository, setRepository] = useState(decisionScenarios["enterprise-ai"].repository);
  const [runState, setRunState] = useState<RunState>("idle");
  const [activePhase, setActivePhase] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState("");
  const [showBrief, setShowBrief] = useState(false);

  const scenario = useMemo(() => decisionScenarios[scenarioId], [scenarioId]);

  useEffect(() => {
    if (runState !== "walkthrough" || !autoPlay) return;
    const timer = window.setTimeout(() => {
      if (activePhase >= phaseLabels.length - 1) {
        setRunState("ready");
        setAutoPlay(false);
      } else {
        setActivePhase((phase) => phase + 1);
      }
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [activePhase, autoPlay, runState]);

  function selectScenario(next: OrchestrationScenario) {
    const selected = decisionScenarios[next];
    setScenarioId(next);
    setClientAsk(selected.clientAsk);
    setRepository(selected.repository);
    setRunState("idle");
    setActivePhase(0);
    setAutoPlay(false);
    setResult(null);
    setError("");
    setShowBrief(false);
    window.requestAnimationFrame(() => document.getElementById("guided-demo")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function nextPhase() {
    if (activePhase >= phaseLabels.length - 1) {
      setRunState("ready");
      setAutoPlay(false);
      return;
    }
    setActivePhase((phase) => phase + 1);
  }

  function skipWalkthrough() {
    setActivePhase(phaseLabels.length - 1);
    setAutoPlay(false);
    setRunState("ready");
  }

  function replayWalkthrough() {
    setShowBrief(false);
    setActivePhase(0);
    setAutoPlay(false);
    setRunState("walkthrough");
  }

  function openBrief() {
    setShowBrief(true);
    window.requestAnimationFrame(() => document.getElementById("decision-brief")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function runDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRunState("executing");
    setActivePhase(0);
    setAutoPlay(false);
    setResult(null);
    setError("");
    setShowBrief(false);

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
      if (!response.ok || !payload.result) throw new Error(payload.error || "The demo could not complete.");
      setResult(payload.result);
      setRunState("walkthrough");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The demo could not complete.");
      setRunState("error");
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
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
              <Sparkles className="size-3.5" /> Guided executive demo
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Don’t just see the answer.
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-300 to-violet-300 bg-clip-text text-transparent">See how the decision was earned.</span>
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              Run a realistic client request, then walk through every governed milestone at your own pace: intent, policy, execution, product proof, provenance, and human approval.
            </p>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {scenarioOrder.map((id) => (
              <ScenarioCard key={id} id={id} active={scenarioId === id} onSelect={selectScenario} />
            ))}
          </div>
        </div>
      </section>

      <section id="guided-demo" className="scroll-mt-24 border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-7 xl:grid-cols-[0.82fr_1.18fr]">
            <div className="space-y-5">
              <article className="rounded-[2rem] border border-white/10 bg-slate-900/60 p-7">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="rounded-full border border-cyan-300/25 bg-cyan-300/5 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-200">
                    {scenario.organization} · synthetic demo
                  </span>
                  <span className="text-xs text-slate-600">{scenario.sponsor}</span>
                </div>
                <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-300">The decision to make</p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em]">{scenario.boardroomQuestion}</h2>
                <div className="mt-7 rounded-2xl border border-red-300/15 bg-red-300/5 p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold text-red-200">
                    <AlertTriangle className="size-4" /> Current business risk
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-400">{scenario.riskToday}</p>
                </div>
              </article>

              <div className="grid gap-3">
                {scenario.metrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <form onSubmit={runDemo} className="rounded-[2rem] border border-cyan-300/20 bg-slate-900/70 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Client request</p>
                    <h2 className="mt-3 text-2xl font-semibold">Send this ask through the governed delivery loop.</h2>
                  </div>
                  <Network className="size-5 text-cyan-300" />
                </div>
                <textarea
                  value={clientAsk}
                  onChange={(event) => setClientAsk(event.target.value)}
                  minLength={20}
                  maxLength={1500}
                  rows={7}
                  required
                  className="mt-6 w-full resize-y rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none focus:border-cyan-300/60"
                />
                <details className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <summary className="cursor-pointer text-xs font-semibold text-slate-400">Execution boundary and provider details</summary>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    {[
                      [Code2, scenario.approvedStack[0]],
                      [ServerCog, scenario.approvedStack[1]],
                      [GitPullRequest, scenario.approvedStack[2]],
                    ].map(([Icon, label]) => {
                      const ItemIcon = Icon as LucideIcon;
                      return (
                        <div key={String(label)} className="rounded-xl bg-white/[0.025] p-3">
                          <ItemIcon className="size-4 text-cyan-300" />
                          <p className="mt-2 text-xs text-slate-400">{String(label)}</p>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] leading-5 text-slate-600">Repository reference: {repository}</p>
                </details>

                {runState === "error" && (
                  <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/5 p-4 text-sm text-red-200">
                    <p className="font-semibold">The execution could not complete.</p>
                    <p className="mt-1 text-xs leading-5 text-red-200/75">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={runState === "executing" || runState === "walkthrough"}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-300 px-6 py-4 text-sm font-semibold text-slate-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {runState === "executing" ? (
                    <><Loader2 className="size-4 animate-spin" /> Executing governed run</>
                  ) : runState === "walkthrough" ? (
                    <><Eye className="size-4" /> Complete the walkthrough below</>
                  ) : (
                    <><Play className="size-4" /> Start guided {scenario.shortLabel} demo</>
                  )}
                </button>
              </form>

              <RunTheatre
                state={runState}
                activePhase={activePhase}
                result={result}
                autoPlay={autoPlay}
                reusableAsset={scenario.reusableAsset}
                onNext={nextPhase}
                onToggleAutoPlay={() => setAutoPlay((value) => !value)}
                onSkip={skipWalkthrough}
                onOpenBrief={openBrief}
                onReset={replayWalkthrough}
              />
            </div>
          </div>
        </div>
      </section>

      {showBrief && result && (
        <section id="decision-brief" className="scroll-mt-24 border-b border-white/10 bg-slate-900/30 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-[2rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-300/10 via-slate-900/75 to-cyan-300/5 p-7 sm:p-10">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                <CheckCircle2 className="size-4" /> Decision brief opened by the visitor
              </div>
              <h2 className="mt-6 max-w-5xl text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                Approve a bounded pilot—with the product proof, evidence, and human gates already visible.
              </h2>
              <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-300">{scenario.modeledOutcome}</p>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-3">
              {[
                [Target, "Business decision", "Pilot this bounded workflow slice", scenario.decisionReady],
                [ShieldCheck, "Governance decision", "Keep execution inside the approved boundary", `${result.executionBoundary}; promotion remains human controlled.`],
                [Boxes, "Knowledge decision", "Retain the reusable pattern", scenario.reusableAsset],
              ].map(([Icon, eyebrow, title, body]) => {
                const CardIcon = Icon as LucideIcon;
                return (
                  <article key={String(title)} className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                    <CardIcon className="size-5 text-cyan-300" />
                    <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.15em] text-slate-500">{String(eyebrow)}</p>
                    <h3 className="mt-2 text-xl font-semibold">{String(title)}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{String(body)}</p>
                  </article>
                );
              })}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
              <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/70">
                <div className="border-b border-white/10 px-6 py-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-cyan-300">Working product proof</p>
                  <h3 className="mt-2 text-lg font-semibold">The client can react to behavior instead of interpreting a specification.</h3>
                </div>
                <iframe title="Generated workflow preview" srcDoc={result.previewHtml} sandbox="" className="h-[36rem] w-full bg-slate-950" />
              </section>

              <div className="space-y-6">
                <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6">
                  <div className="flex items-center gap-2">
                    <Users className="size-5 text-cyan-300" />
                    <h3 className="text-lg font-semibold">Approval questions</h3>
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
                    <LockKeyhole className="size-5 text-emerald-300" />
                    <h3 className="text-lg font-semibold">Named human gates</h3>
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
              <div className="grid gap-5 md:grid-cols-3">
                <div>
                  <FileCheck2 className="size-5 text-cyan-300" />
                  <p className="mt-4 text-2xl font-semibold">{result.provenance.filesystemDiff.length}</p>
                  <p className="mt-1 text-xs text-slate-500">File hashes observed</p>
                </div>
                <div>
                  <Code2 className="size-5 text-orange-200" />
                  <p className="mt-4 text-2xl font-semibold">{result.provenance.commands[0]?.exitCode ?? "—"}</p>
                  <p className="mt-1 text-xs text-slate-500">Observed command exit code</p>
                </div>
                <div>
                  <ShieldCheck className="size-5 text-emerald-300" />
                  <p className="mt-4 text-2xl font-semibold">{result.provenance.tests.filter((test) => test.passed).length}/{result.provenance.tests.length}</p>
                  <p className="mt-1 text-xs text-slate-500">Test suites passed</p>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}

      <section className="px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-cyan-300/20 bg-cyan-300 p-8 text-slate-950 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-700">From demonstration to pilot</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Use one real client ask and make every delivery decision visible.</h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Connect the client-approved agent, execution boundary, and source-control system. Then measure ask-to-approved-PR time, approval capture, reuse, adoption, and expansion.
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
