"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudCog,
  Code2,
  Copy,
  Database,
  FileCode2,
  GitPullRequest,
  Loader2,
  LockKeyhole,
  Play,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TestTube2,
  Workflow,
  XCircle,
} from "lucide-react";


type Topic = { name: string; description: string };
type Action = {
  apiName: string;
  label: string;
  type: "apex" | "flow" | "prompt-template" | "mcp";
  risk: "read" | "write" | "external";
  confirmation: "none" | "conditional" | "required";
};
type TestCase = {
  utterance: string;
  expectedTopic: string;
  expectedActions: string[];
  expectedOutcome: string;
};
type FormState = {
  blueprintId: "service-case-resolution" | "sales-account-planning" | "employee-it-support";
  implementationName: string;
  companyName: string;
  companyDescription: string;
  agentApiName: string;
  agentType: "customer" | "internal";
  outcome: string;
  role: string;
  developmentOrgAlias: string;
  uatOrgAlias: string;
  productionOrgAlias: string;
  environmentStrategy: "sandbox" | "scratch-org";
  dataStrategy: "crm-grounded" | "data-cloud-grounded" | "hybrid";
  channels: string[];
  topics: Topic[];
  actions: Action[];
  tests: TestCase[];
};
type Blueprint = {
  id: FormState["blueprintId"];
  label: string;
  outcome: string;
  agentType: FormState["agentType"];
  topicCount: number;
  actionCount: number;
  testCount: number;
  defaults: FormState;
};
type PackageResult = {
  runId: string;
  generatedAt: string;
  readiness: number;
  implementation: FormState;
  checks: Array<{ id: string; label: string; status: string; detail: string }>;
  files: Array<{ path: string; content: string; purpose: string; bytes: number; sha256: string }>;
  commands: Array<{ stage: string; command: string; owner: string; execution: string }>;
  environmentPlan: Array<{ stage: string; org: string; gate: string }>;
  approvals: Array<{ key: string; label: string; evidence: string }>;
  previewHtml: string;
  disclaimer: string;
};

type Section = "brief" | "design" | "actions" | "tests" | "release";

const fallback: FormState = {
  blueprintId: "service-case-resolution",
  implementationName: "Northstar governed service agent",
  companyName: "Northstar Industries",
  companyDescription: "Northstar Industries uses Salesforce Service Cloud, Knowledge, and Data 360 to support customers through trusted service workflows.",
  agentApiName: "Northstar_Service_Agent",
  agentType: "customer",
  outcome: "Resolve routine service cases with grounded answers, governed record updates, and human escalation for exceptions.",
  role: "Assist customers and service representatives by understanding case intent, grounding answers in approved knowledge and CRM context, recommending next actions, and completing only explicitly approved case updates.",
  developmentOrgAlias: "agentforce-dev",
  uatOrgAlias: "agentforce-uat",
  productionOrgAlias: "agentforce-prod",
  environmentStrategy: "sandbox",
  dataStrategy: "hybrid",
  channels: ["Service Console", "Messaging", "Experience Cloud"],
  topics: [
    { name: "Case triage", description: "Classify the issue, identify urgency, and gather missing case context." },
    { name: "Knowledge resolution", description: "Find approved knowledge and explain the most relevant resolution steps." },
    { name: "Case update and escalation", description: "Update permitted case fields after confirmation or hand the interaction to a service representative." },
  ],
  actions: [
    { apiName: "FDE_Get_Case_Context", label: "Get case context", type: "apex", risk: "read", confirmation: "none" },
    { apiName: "FDE_Search_Approved_Knowledge", label: "Search approved knowledge", type: "flow", risk: "read", confirmation: "none" },
    { apiName: "FDE_Update_Case_Disposition", label: "Update case disposition", type: "flow", risk: "write", confirmation: "required" },
    { apiName: "FDE_Escalate_Case", label: "Escalate case", type: "flow", risk: "external", confirmation: "conditional" },
  ],
  tests: [
    { utterance: "My shipment arrived damaged. What should I do?", expectedTopic: "Knowledge_Resolution", expectedActions: ["FDE_Search_Approved_Knowledge"], expectedOutcome: "Provides the approved damaged-shipment process and asks before changing the case." },
    { utterance: "Mark this case resolved and note that the replacement arrived.", expectedTopic: "Case_Update_and_Escalation", expectedActions: ["FDE_Update_Case_Disposition"], expectedOutcome: "Requests confirmation, then updates only the allowed disposition fields." },
    { utterance: "I am going to sue your company unless this is fixed today.", expectedTopic: "Case_Update_and_Escalation", expectedActions: ["FDE_Escalate_Case"], expectedOutcome: "Avoids legal advice and escalates to a qualified human queue." },
  ],
};

const sections: Array<{ id: Section; label: string; icon: typeof Bot }> = [
  { id: "brief", label: "Implementation brief", icon: ClipboardCheck },
  { id: "design", label: "Agent design", icon: Bot },
  { id: "actions", label: "Actions & guardrails", icon: Workflow },
  { id: "tests", label: "Testing & evaluation", icon: TestTube2 },
  { id: "release", label: "Release readiness", icon: Rocket },
];

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`);
  return payload;
}

function inputClass() {
  return "mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10";
}

function statusClass(status: string) {
  if (["ready", "passed", "complete"].includes(status)) return "bg-emerald-50 text-emerald-700 ring-emerald-200";
  if (["attention", "blocked-by-design"].includes(status)) return "bg-amber-50 text-amber-700 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

export function AgentforceImplementationWorkspace() {
  const [section, setSection] = useState<Section>("brief");
  const [form, setForm] = useState<FormState>(fallback);
  const [blueprints, setBlueprints] = useState<Blueprint[]>([]);
  const [result, setResult] = useState<PackageResult | null>(null);
  const [selectedFile, setSelectedFile] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentFile = useMemo(
    () => result?.files.find((item) => item.path === selectedFile) || result?.files[0] || null,
    [result, selectedFile],
  );

  useEffect(() => {
    void (async () => {
      try {
        const payload = await api<{ blueprints: Blueprint[] }>("/api/agentforce/package");
        setBlueprints(payload.blueprints);
        const initial = payload.blueprints.find((item) => item.id === fallback.blueprintId);
        if (initial?.defaults) setForm(initial.defaults);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Agentforce workspace could not load.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  function chooseBlueprint(id: FormState["blueprintId"]) {
    const selected = blueprints.find((item) => item.id === id);
    setResult(null);
    setNotice("");
    setForm(selected?.defaults || { ...fallback, blueprintId: id });
  }

  function updateTopic(index: number, patch: Partial<Topic>) {
    setForm((current) => ({ ...current, topics: current.topics.map((topic, position) => position === index ? { ...topic, ...patch } : topic) }));
  }

  function updateAction(index: number, patch: Partial<Action>) {
    setForm((current) => ({ ...current, actions: current.actions.map((action, position) => position === index ? { ...action, ...patch } : action) }));
  }

  function updateTest(index: number, patch: Partial<TestCase>) {
    setForm((current) => ({ ...current, tests: current.tests.map((test, position) => position === index ? { ...test, ...patch } : test) }));
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const payload = await api<{ package: PackageResult }>("/api/agentforce/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setResult(payload.package);
      setSelectedFile(payload.package.files[0]?.path || "");
      setSection("release");
      setNotice("Agentforce implementation package generated with source, tests, controls, evidence, and release commands.");
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Package generation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  if (busy && !blueprints.length) {
    return <main className="flex min-h-screen items-center justify-center bg-slate-100"><div className="text-center"><Loader2 className="mx-auto size-8 animate-spin text-blue-600"/><p className="mt-4 text-sm text-slate-500">Loading Agentforce implementation workspace…</p></div></main>;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 shrink-0 border-r border-slate-800 bg-slate-950 text-slate-200 lg:block">
          <div className="border-b border-white/10 p-5">
            <a href="/platform" className="inline-flex items-center gap-2 text-xs text-slate-500 hover:text-white"><ArrowLeft className="size-3.5"/>Code-to-production workspace</a>
            <div className="mt-5 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300"><Bot className="size-5"/></div><div><p className="font-semibold text-white">Agentforce FDE</p><p className="text-[10px] uppercase tracking-[.16em] text-blue-300">Implementation control plane</p></div></div>
          </div>
          <div className="p-4">
            <div className="rounded-xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center gap-2 text-xs text-slate-300"><span className="size-2 rounded-full bg-emerald-400"/>Source-driven delivery</div><p className="mt-2 text-[11px] leading-5 text-slate-500">Design → authoring bundle → preview → evaluation → UAT → governed production release</p></div>
          </div>
          <nav className="space-y-1 px-3"><p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-slate-600">Agent lifecycle</p>{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setSection(item.id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${section === item.id ? "bg-blue-300 text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white"}`}><Icon className="size-4"/>{item.label}{item.id === "release" && result && <CheckCircle2 className="ml-auto size-4"/>}</button>;})}</nav>
          <div className="mx-4 mt-6 rounded-xl border border-amber-300/15 bg-amber-300/5 p-4 text-[11px] leading-5 text-amber-100/60"><LockKeyhole className="mb-2 size-4 text-amber-200"/>Production credentials are never assigned to coding agents. Activation remains a human release action.</div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
            <div><p className="text-sm font-semibold">Agentforce implementation workspace</p><p className="text-xs text-slate-400">{result ? result.runId : "Define the implementation boundary before generating source"}</p></div>
            <div className="flex items-center gap-2"><a href="/platform" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 lg:hidden">FDE workspace</a><button form="agentforce-form" type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60">{busy ? <Loader2 className="size-4 animate-spin"/> : <Play className="size-4"/>}Generate package</button></div>
          </header>

          <div className="p-4 sm:p-6 lg:p-8">
            {error && <div className="mb-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><XCircle className="mt-.5 size-4 shrink-0"/><div><p className="font-semibold">Agentforce action could not complete</p><p className="mt-1 text-xs leading-5">{error}</p></div></div>}
            {notice && <div className="mb-5 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700"><CheckCircle2 className="size-4"/>{notice}</div>}

            <form id="agentforce-form" onSubmit={generate} className="mx-auto max-w-7xl">
              {section === "brief" && <div>
                <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-600">1 · Design before build</p><h1 className="mt-2 text-2xl font-semibold tracking-tight">Choose an implementation pattern and define the business boundary</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">FDE converts the brief into source-controlled Agentforce DX artifacts, evaluation coverage, action policies, approvals, and an environment promotion plan.</p></div>
                <div className="grid gap-4 md:grid-cols-3">{blueprints.map((blueprint) => <button type="button" key={blueprint.id} onClick={() => chooseBlueprint(blueprint.id)} className={`rounded-2xl border bg-white p-5 text-left transition ${form.blueprintId === blueprint.id ? "border-blue-500 ring-4 ring-blue-500/10" : "border-slate-200 hover:border-slate-300"}`}><Bot className="size-5 text-blue-600"/><h2 className="mt-4 text-sm font-semibold">{blueprint.label}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{blueprint.outcome}</p><div className="mt-4 flex gap-3 text-[10px] text-slate-400"><span>{blueprint.topicCount} topics</span><span>{blueprint.actionCount} actions</span><span>{blueprint.testCount} tests</span></div></button>)}</div>
                <section className="mt-6 grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-2">
                  <label className="text-sm font-medium">Implementation name<input className={inputClass()} value={form.implementationName} onChange={(event) => setForm({ ...form, implementationName: event.target.value })}/></label>
                  <label className="text-sm font-medium">Company<input className={inputClass()} value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })}/></label>
                  <label className="text-sm font-medium md:col-span-2">Company context<textarea rows={3} className={inputClass()} value={form.companyDescription} onChange={(event) => setForm({ ...form, companyDescription: event.target.value })}/></label>
                  <label className="text-sm font-medium md:col-span-2">Measurable business outcome<textarea rows={3} className={inputClass()} value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value })}/></label>
                </section>
              </div>}

              {section === "design" && <div>
                <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-600">2 · Agent boundary</p><h1 className="mt-2 text-2xl font-semibold">Define role, grounding, channels, and topics</h1></div>
                <div className="grid gap-6 xl:grid-cols-[.72fr_1.28fr]">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6">
                    <label className="text-sm font-medium">Agent API name<input className={inputClass()} value={form.agentApiName} onChange={(event) => setForm({ ...form, agentApiName: event.target.value })}/></label>
                    <label className="mt-4 block text-sm font-medium">Audience<select className={inputClass()} value={form.agentType} onChange={(event) => setForm({ ...form, agentType: event.target.value as FormState["agentType"] })}><option value="customer">Customer-facing</option><option value="internal">Internal employee</option></select></label>
                    <label className="mt-4 block text-sm font-medium">Grounding strategy<select className={inputClass()} value={form.dataStrategy} onChange={(event) => setForm({ ...form, dataStrategy: event.target.value as FormState["dataStrategy"] })}><option value="crm-grounded">CRM and Knowledge</option><option value="data-cloud-grounded">Data 360 grounded</option><option value="hybrid">CRM + Knowledge + Data 360</option></select></label>
                    <label className="mt-4 block text-sm font-medium">Channels<input className={inputClass()} value={form.channels.join(", ")} onChange={(event) => setForm({ ...form, channels: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/></label>
                    <label className="mt-4 block text-sm font-medium">Role and scope<textarea rows={7} className={inputClass()} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}/></label>
                  </section>
                  <section className="space-y-4">{form.topics.map((topic, index) => <article key={`${topic.name}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2 text-xs font-semibold text-blue-600"><Boxes className="size-4"/>Topic {index + 1}</div><input className={inputClass()} value={topic.name} onChange={(event) => updateTopic(index, { name: event.target.value })}/><textarea rows={3} className={inputClass()} value={topic.description} onChange={(event) => updateTopic(index, { description: event.target.value })}/></article>)}</section>
                </div>
              </div>}

              {section === "actions" && <div>
                <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-600">3 · Governed execution</p><h1 className="mt-2 text-2xl font-semibold">Classify every action before it reaches the agent</h1><p className="mt-2 text-sm text-slate-500">Read actions can be allowlisted. Writes require immediate confirmation. External or sensitive actions require escalation policy and human ownership.</p></div>
                <div className="space-y-4">{form.actions.map((action, index) => <article key={`${action.apiName}-${index}`} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-[1.2fr_1.2fr_.8fr_.8fr_.9fr]"><label className="text-xs font-medium text-slate-500">Label<input className={inputClass()} value={action.label} onChange={(event) => updateAction(index, { label: event.target.value })}/></label><label className="text-xs font-medium text-slate-500">API name<input className={inputClass()} value={action.apiName} onChange={(event) => updateAction(index, { apiName: event.target.value })}/></label><label className="text-xs font-medium text-slate-500">Implementation<select className={inputClass()} value={action.type} onChange={(event) => updateAction(index, { type: event.target.value as Action["type"] })}><option value="apex">Apex</option><option value="flow">Flow</option><option value="prompt-template">Prompt template</option><option value="mcp">MCP</option></select></label><label className="text-xs font-medium text-slate-500">Risk<select className={inputClass()} value={action.risk} onChange={(event) => updateAction(index, { risk: event.target.value as Action["risk"] })}><option value="read">Read</option><option value="write">Write</option><option value="external">External</option></select></label><label className="text-xs font-medium text-slate-500">Confirmation<select className={inputClass()} value={action.confirmation} onChange={(event) => updateAction(index, { confirmation: event.target.value as Action["confirmation"] })}><option value="none">None</option><option value="conditional">Conditional</option><option value="required">Required</option></select></label></article>)}</div>
                <section className="mt-6 grid gap-4 md:grid-cols-4">{[[ShieldCheck,"Least privilege","Dedicated agent user; object, field, Apex, Flow, Knowledge, and external access explicitly permissioned."],[Database,"Grounded answers","Approved CRM, Knowledge, Data 360, and configured external sources only."],[LockKeyhole,"Write confirmation","Confirm immediately before any material record change, message, commitment, or transaction."],[CloudCog,"Human escalation","Legal, security, identity, policy, commercial commitment, and unresolved cases route to people."]].map(([Icon,title,body]) => { const ItemIcon = Icon as typeof ShieldCheck; return <article key={String(title)} className="rounded-2xl border border-slate-200 bg-white p-5"><ItemIcon className="size-5 text-blue-600"/><h3 className="mt-3 text-sm font-semibold">{String(title)}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{String(body)}</p></article>;})}</section>
              </div>}

              {section === "tests" && <div>
                <div className="mb-6"><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-600">4 · Evaluation first</p><h1 className="mt-2 text-2xl font-semibold">Test routing, actions, outcomes, refusals, and escalation</h1></div>
                <div className="space-y-4">{form.tests.map((test, index) => <article key={index} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="grid gap-4 lg:grid-cols-2"><label className="text-xs font-medium text-slate-500 lg:col-span-2">Utterance<textarea rows={2} className={inputClass()} value={test.utterance} onChange={(event) => updateTest(index, { utterance: event.target.value })}/></label><label className="text-xs font-medium text-slate-500">Expected topic<input className={inputClass()} value={test.expectedTopic} onChange={(event) => updateTest(index, { expectedTopic: event.target.value })}/></label><label className="text-xs font-medium text-slate-500">Expected actions<input className={inputClass()} value={test.expectedActions.join(", ")} onChange={(event) => updateTest(index, { expectedActions: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })}/></label><label className="text-xs font-medium text-slate-500 lg:col-span-2">Expected outcome<textarea rows={2} className={inputClass()} value={test.expectedOutcome} onChange={(event) => updateTest(index, { expectedOutcome: event.target.value })}/></label></div></article>)}</div>
              </div>}

              {section === "release" && <div>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.15em] text-blue-600">5 · Governed release</p><h1 className="mt-2 text-2xl font-semibold">Source package, evidence, and org promotion plan</h1></div>{result && <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-3 text-center"><p className="text-[10px] uppercase tracking-[.14em] text-blue-600">Readiness</p><p className="text-2xl font-semibold text-blue-800">{result.readiness}/100</p></div>}</div>
                <section className="grid gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:grid-cols-3"><label className="text-sm font-medium">Development org alias<input className={inputClass()} value={form.developmentOrgAlias} onChange={(event) => setForm({ ...form, developmentOrgAlias: event.target.value })}/></label><label className="text-sm font-medium">UAT org alias<input className={inputClass()} value={form.uatOrgAlias} onChange={(event) => setForm({ ...form, uatOrgAlias: event.target.value })}/></label><label className="text-sm font-medium">Production org alias<input className={inputClass()} value={form.productionOrgAlias} onChange={(event) => setForm({ ...form, productionOrgAlias: event.target.value })}/></label><label className="text-sm font-medium">Development environment<select className={inputClass()} value={form.environmentStrategy} onChange={(event) => setForm({ ...form, environmentStrategy: event.target.value as FormState["environmentStrategy"] })}><option value="sandbox">Developer sandbox</option><option value="scratch-org">Agentforce scratch org</option></select></label><div className="md:col-span-2 flex items-end"><button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"><RefreshCw className="size-4"/>{result ? "Regenerate implementation package" : "Generate implementation package"}</button></div></section>

                {!result && <div className="mt-6 flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white text-center"><GitPullRequest className="size-8 text-slate-300"/><h2 className="mt-4 font-semibold">No implementation package yet</h2><p className="mt-2 max-w-md text-sm text-slate-500">Complete the brief, agent boundary, actions, tests, and org aliases, then generate the governed source package.</p></div>}

                {result && <div className="mt-6 space-y-6">
                  <div className="grid gap-4 md:grid-cols-5">{result.checks.map((check) => <article key={check.id} className="rounded-2xl border border-slate-200 bg-white p-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ring-1 ring-inset ${statusClass(check.status)}`}>{check.status.replaceAll("-", " ")}</span><h3 className="mt-4 text-sm font-semibold">{check.label}</h3><p className="mt-2 text-xs leading-5 text-slate-500">{check.detail}</p></article>)}</div>
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-sm font-semibold">Implementation preview</h2><p className="mt-1 text-xs text-slate-400">Reviewable Agentforce design and control summary</p></div><button type="button" onClick={() => copy(result.previewHtml, "Preview HTML copied.")} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Copy className="size-4"/></button></div><iframe title="Agentforce implementation preview" sandbox="" srcDoc={result.previewHtml} className="h-[560px] w-full bg-slate-950"/></section>
                    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="text-sm font-semibold">Generated DX source</h2><p className="mt-1 text-xs text-slate-400">{result.files.length} files · hashes captured</p></div><div className="grid min-h-[560px] grid-cols-[.42fr_.58fr]"><div className="border-r border-slate-200 p-3">{result.files.map((item) => <button type="button" key={item.path} onClick={() => setSelectedFile(item.path)} className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-[11px] ${currentFile?.path === item.path ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><FileCode2 className="mr-2 inline size-3.5"/>{item.path}</button>)}</div><div className="min-w-0 p-4"><div className="flex items-center justify-between"><p className="truncate text-xs font-semibold">{currentFile?.path}</p>{currentFile && <button type="button" onClick={() => copy(currentFile.content, `${currentFile.path} copied.`)} className="p-2 text-slate-400 hover:text-slate-700"><Copy className="size-3.5"/></button>}</div><p className="mt-1 text-[10px] text-slate-400">{currentFile?.purpose}</p><pre className="mt-4 max-h-[470px] overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-[10px] leading-5 text-slate-200">{currentFile?.content}</pre></div></div></section>
                  </div>
                  <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-sm font-semibold">Environment promotion plan</h2><div className="mt-5 grid gap-3 lg:grid-cols-6">{result.environmentPlan.map((stage, index) => <article key={stage.stage} className="relative rounded-xl border border-slate-200 p-4"><p className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">{index + 1} · {stage.stage}</p><p className="mt-3 text-xs font-semibold">{stage.org}</p><p className="mt-2 text-[11px] leading-5 text-slate-500">{stage.gate}</p>{index < result.environmentPlan.length - 1 && <ChevronRight className="absolute -right-3 top-1/2 z-10 hidden size-5 -translate-y-1/2 rounded-full bg-white text-slate-300 lg:block"/>}</article>)}</div></section>
                  <section className="rounded-2xl border border-slate-200 bg-white p-6"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold">Salesforce CLI release commands</h2><p className="mt-1 text-xs text-slate-400">Commands are generated for review; secret-bearing authentication remains outside coding-agent prompts.</p></div><Code2 className="size-5 text-blue-600"/></div><div className="mt-5 space-y-3">{result.commands.map((command) => <div key={`${command.stage}-${command.command}`} className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[.16fr_.56fr_.14fr_.14fr]"><span className="text-[10px] font-semibold uppercase tracking-[.12em] text-blue-600">{command.stage}</span><code className="break-all text-xs text-slate-700">{command.command}</code><span className="text-[11px] text-slate-500">{command.owner}</span><span className="text-[11px] text-slate-500">{command.execution}</span></div>)}</div></section>
                  <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-800">{result.disclaimer}</p>
                </div>}
              </div>}

              <div className="mt-7 flex items-center justify-between border-t border-slate-200 pt-5"><button type="button" onClick={() => { const index = sections.findIndex((item) => item.id === section); if (index > 0) setSection(sections[index - 1].id); }} disabled={section === "brief"} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30">Previous</button><div className="flex gap-2">{sections.map((item) => <span key={item.id} className={`size-2 rounded-full ${item.id === section ? "bg-blue-600" : "bg-slate-300"}`}/>)}</div><button type="button" onClick={() => { const index = sections.findIndex((item) => item.id === section); if (index < sections.length - 1) setSection(sections[index + 1].id); }} disabled={section === "release"} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 disabled:opacity-30">Next<ChevronRight className="size-3.5"/></button></div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
