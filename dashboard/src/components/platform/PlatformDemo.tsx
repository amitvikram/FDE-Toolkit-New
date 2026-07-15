"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Boxes,
  Check,
  CheckCircle2,
  Clock3,
  Code2,
  FileCheck2,
  GitPullRequest,
  Loader2,
  LockKeyhole,
  Network,
  Play,
  ServerCog,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { providerCatalog } from "@/lib/orchestration/catalog";
import type {
  OrchestrationResult,
  OrchestrationScenario,
  ProviderCatalogEntry,
} from "@/lib/orchestration/types";

const scenarioCopy: Record<
  OrchestrationScenario,
  { label: string; ask: string; audience: string }
> = {
  "enterprise-ai": {
    label: "Enterprise AI workflow",
    audience: "Enterprise AI and transformation teams",
    ask: "Give claims reviewers one governed screen showing the exception reason, policy evidence, confidence, recommended action, and a human-owned final disposition.",
  },
  "saas-design-partner": {
    label: "SaaS design-partner request",
    audience: "SaaS and AI product companies",
    ask: "Turn a strategic customer's approval-routing request into a working design-partner prototype while classifying what belongs in the core product versus tenant configuration.",
  },
  "si-delivery": {
    label: "SI client delivery workflow",
    audience: "Systems integrators and consulting firms",
    ask: "Create a repeatable client-delivery workspace that captures the ask, validation evidence, client approvals, reusable engagement artifacts, and promotion readiness.",
  },
};

const selectClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";
const inputClass =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";

function ProviderOption({ provider }: { provider: ProviderCatalogEntry }) {
  const isDemo = provider.status === "demo-ready";
  return (
    <option value={provider.id} disabled={!isDemo}>
      {provider.name} {isDemo ? "— demo ready" : "— connector required"}
    </option>
  );
}

function ProviderMatrix({ title, providers, icon: Icon }: {
  title: string;
  providers: ProviderCatalogEntry[];
  icon: typeof Bot;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/55 p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
          <Icon className="size-5" />
        </div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
      </div>
      <div className="mt-5 space-y-3">
        {providers.map((provider) => (
          <div key={provider.id} className="rounded-2xl border border-white/10 bg-slate-950/65 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-100">{provider.name}</p>
                <p className="mt-1 text-xs text-slate-500">{provider.vendor}</p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                  provider.status === "demo-ready"
                    ? "bg-emerald-300/10 text-emerald-200"
                    : "bg-white/5 text-slate-500"
                }`}
              >
                {provider.status === "demo-ready" ? "Demo ready" : "Adapter ready"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-slate-400">{provider.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function StepTimeline({ result }: { result: OrchestrationResult }) {
  return (
    <div className="space-y-3">
      {result.steps.map((step, index) => (
        <div key={step.id} className="flex gap-4 rounded-2xl border border-white/10 bg-slate-950/65 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-300/10 font-mono text-xs text-cyan-300">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{step.label}</p>
              <span className="text-[11px] text-slate-600">{step.durationMs} ms</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">{step.detail}</p>
          </div>
          <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-300" />
        </div>
      ))}
    </div>
  );
}

export function PlatformDemo() {
  const [scenario, setScenario] = useState<OrchestrationScenario>("enterprise-ai");
  const [clientAsk, setClientAsk] = useState(scenarioCopy["enterprise-ai"].ask);
  const [repository, setRepository] = useState("https://github.com/customer/example-product");
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<OrchestrationResult | null>(null);

  const activeScenario = useMemo(() => scenarioCopy[scenario], [scenario]);

  function changeScenario(next: OrchestrationScenario) {
    setScenario(next);
    setClientAsk(scenarioCopy[next].ask);
    setResult(null);
    setStatus("idle");
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
          scenario,
          clientAsk,
          repository,
          baseBranch: "main",
          codingAgentId: "fde-demo-agent",
          sandboxId: "local-ephemeral",
          sourceControlId: "promotion-package",
          approvalMode: "human-required",
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        result?: OrchestrationResult;
      };
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || "The demo could not complete.");
      }
      setResult(payload.result);
      setStatus("success");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "The demo could not complete.");
      setStatus("error");
    }
  }

  return (
    <div className="bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/3 top-0 size-[34rem] rounded-full bg-cyan-400/10 blur-[130px]" />
          <div className="absolute right-0 top-20 size-96 rounded-full bg-orange-300/10 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">
              <Network className="size-3.5" /> Integration-first product MVP
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              One governed delivery layer.
              <span className="block text-slate-500">Many agents, sandboxes, and engineering systems.</span>
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300 sm:text-xl">
              FDE-Toolkit owns the job envelope, policy, engagement memory, evidence, approvals, and promotion workflow. Customers keep their preferred coding agent, sandbox platform, source control, and release gates.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[
              [Bot, "Agent neutral", "Codex, Claude Code, Cursor, SI accelerators, or customer coding agents."],
              [Boxes, "Runtime neutral", "Docker, Kubernetes, managed sandboxes, or customer-hosted execution."],
              [GitPullRequest, "Promotion native", "GitHub, GitLab, Azure DevOps, or internal SCM and release gateways."],
            ].map(([Icon, title, description]) => {
              const CardIcon = Icon as typeof Bot;
              return (
                <div key={String(title)} className="rounded-3xl border border-white/10 bg-slate-900/55 p-6">
                  <CardIcon className="size-5 text-cyan-300" />
                  <h2 className="mt-5 text-lg font-semibold">{String(title)}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{String(description)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 xl:grid-cols-3">
            <ProviderMatrix title="Coding agents" providers={providerCatalog.codingAgents} icon={Code2} />
            <ProviderMatrix title="Sandbox environments" providers={providerCatalog.sandboxes} icon={ServerCog} />
            <ProviderMatrix title="Promotion systems" providers={providerCatalog.sourceControl} icon={GitPullRequest} />
          </div>
        </div>
      </section>

      <section id="run-demo" className="scroll-mt-24 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 xl:grid-cols-[0.85fr_1.15fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-orange-200">
              <Play className="size-3.5" /> Docker-ready demo
            </div>
            <h2 className="mt-6 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Run the governed client-ask-to-PR loop.
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-400">
              The demo creates a real temporary workspace inside the application container, generates a small workflow application, runs fixed tests, captures evidence, and produces a reviewable PR package.
            </p>
            <div className="mt-8 space-y-4">
              {[
                "No customer repository is cloned",
                "No network access or secret injection",
                "No model-generated shell commands",
                "Human approval remains mandatory",
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm text-slate-300">
                  <ShieldCheck className="size-5 shrink-0 text-emerald-300" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={runDemo} className="rounded-[2rem] border border-white/10 bg-slate-900/65 p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                Delivery scenario
                <select
                  value={scenario}
                  onChange={(event) => changeScenario(event.target.value as OrchestrationScenario)}
                  className={selectClass}
                >
                  {Object.entries(scenarioCopy).map(([value, copy]) => (
                    <option key={value} value={value}>
                      {copy.label} — {copy.audience}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                Concrete client ask
                <textarea
                  value={clientAsk}
                  onChange={(event) => setClientAsk(event.target.value)}
                  rows={6}
                  minLength={20}
                  maxLength={1500}
                  required
                  className={`${inputClass} resize-y`}
                />
              </label>

              <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                Repository baseline
                <input
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  className={inputClass}
                  placeholder="https://github.com/customer/product"
                />
                <span className="mt-2 block text-xs leading-5 text-slate-600">
                  Demonstration metadata only. The public demo does not clone or access this repository.
                </span>
              </label>

              <label className="text-sm font-medium text-slate-200">
                Coding agent
                <select defaultValue="fde-demo-agent" className={selectClass}>
                  {providerCatalog.codingAgents.map((provider) => (
                    <ProviderOption key={provider.id} provider={provider} />
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-200">
                Sandbox
                <select defaultValue="local-ephemeral" className={selectClass}>
                  {providerCatalog.sandboxes.map((provider) => (
                    <ProviderOption key={provider.id} provider={provider} />
                  ))}
                </select>
              </label>

              <label className="text-sm font-medium text-slate-200 sm:col-span-2">
                Promotion target
                <select defaultValue="promotion-package" className={selectClass}>
                  {providerCatalog.sourceControl.map((provider) => (
                    <ProviderOption key={provider.id} provider={provider} />
                  ))}
                </select>
              </label>
            </div>

            {status === "error" && (
              <p className="mt-5 rounded-xl border border-red-300/20 bg-red-300/5 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={status === "running"}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "running" ? (
                <><Loader2 className="size-4 animate-spin" /> Running governed delivery loop</>
              ) : (
                <><Play className="size-4" /> Run integration demo</>
              )}
            </button>
          </form>
        </div>
      </section>

      {result && (
        <section className="border-t border-white/10 bg-slate-900/35 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                  <CheckCircle2 className="size-4" /> Demo completed
                </div>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.035em]">Run {result.runId}</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{result.disclaimer}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <Clock3 className="size-4 text-cyan-300" />
                  <p className="mt-3 text-xl font-semibold">{result.cycleTimeMs} ms</p>
                  <p className="mt-1 text-[11px] text-slate-500">Demo cycle time</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <FileCheck2 className="size-4 text-cyan-300" />
                  <p className="mt-3 text-xl font-semibold">{result.promotionPackage.changedFiles.length}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Changed artifacts</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-slate-950 p-4">
                  <LockKeyhole className="size-4 text-cyan-300" />
                  <p className="mt-3 text-xl font-semibold">Human</p>
                  <p className="mt-1 text-[11px] text-slate-500">Approval mode</p>
                </div>
              </div>
            </div>

            <div className="mt-12 grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-white">
                  <Workflow className="size-4 text-cyan-300" /> Orchestration timeline
                </div>
                <StepTimeline result={result} />
              </section>

              <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950/70">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Boxes className="size-4 text-cyan-300" /> Generated workflow preview
                  </div>
                  <span className="text-[11px] text-slate-600">sandboxed iframe</span>
                </div>
                <iframe
                  title="Generated workflow preview"
                  srcDoc={result.previewHtml}
                  sandbox=""
                  className="h-[34rem] w-full bg-slate-950"
                />
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <GitPullRequest className="size-4 text-orange-200" /> PR promotion package
                </div>
                <h3 className="mt-5 text-2xl font-semibold">{result.promotionPackage.title}</h3>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Branch</p>
                    <p className="mt-2 break-all font-mono text-xs text-cyan-200">{result.promotionPackage.branchName}</p>
                  </div>
                  <div className="rounded-xl bg-white/5 p-4">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Commit</p>
                    <p className="mt-2 text-xs text-slate-200">{result.promotionPackage.commitMessage}</p>
                  </div>
                </div>
                <div className="mt-5 space-y-2">
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
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Check className="size-4 text-emerald-300" /> Tests and approvals
                </div>
                <pre className="mt-5 max-h-64 overflow-auto rounded-2xl bg-black/35 p-4 text-xs leading-5 text-slate-300">
                  {result.testOutput}
                </pre>
                <div className="mt-5 space-y-3">
                  {result.promotionPackage.approvalsRequired.map((approval) => (
                    <div key={approval} className="flex items-center gap-3 text-sm text-slate-300">
                      <span className="size-4 rounded border border-white/20" /> {approval}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </section>
      )}

      <section className="border-t border-white/10 px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 rounded-[2rem] border border-cyan-300/20 bg-cyan-300 p-8 text-slate-950 sm:p-10 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">The next step is a customer-approved adapter, not a platform rewrite.</h2>
            <p className="mt-4 text-base leading-7 text-slate-700">
              Select one coding agent, one sandbox boundary, and one source-control system for the first pilot. FDE-Toolkit keeps the workflow and evidence contract stable as providers change.
            </p>
          </div>
          <Link href="/#interest" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white">
            Discuss an integration pilot <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
