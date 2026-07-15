import { Boxes, Eye, Network, ShieldCheck } from "lucide-react";

const principles = [
  {
    icon: Boxes,
    title: "Own the workflow. Rent the horsepower.",
    body:
      "FDE-Toolkit builds the control plane: workflow, policy, provenance, knowledge, and tenancy. Coding agents, models, sandboxes, speech services, SCMs, secret stores, and client systems remain replaceable drivers.",
  },
  {
    icon: Network,
    title: "Neutrality is the product.",
    body:
      "Bring the coding platform and runtime the client has already approved. The same governed delivery contract can route to OpenAI, Anthropic, Cursor, self-hosted models, SI accelerators, or customer-built agents.",
  },
  {
    icon: Eye,
    title: "Trust nothing the agent says.",
    body:
      "The execution plane records file-system changes, exact commands, exit codes, output digests, and test outcomes. Provenance is written by toolkit instrumentation at the driver boundary, not self-reported by the coding agent.",
  },
  {
    icon: ShieldCheck,
    title: "The execution plane is deployable.",
    body:
      "Anything touching client code or data can run in the toolkit cloud, a client VPC, or an air-gapped environment. The control plane sends signed metadata and receives normalized evidence—not source code or long-lived credentials.",
  },
];

export function ControlPlanePrinciples() {
  return (
    <section className="border-b border-white/10 bg-slate-900/35 px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-4xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan-300">Product constitution</p>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
            A neutral control plane around client-approved execution.
          </h2>
          <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-400">
            These principles determine the product boundary, procurement story, security model, and adapter architecture.
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {principles.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-slate-950/70 p-7">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-300">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">{body}</p>
            </article>
          ))}
        </div>

        <div className="mt-8 grid overflow-hidden rounded-3xl border border-white/10 bg-slate-950 text-sm md:grid-cols-[1fr_auto_1fr_auto_1fr]">
          <div className="p-6">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">Control plane</p>
            <p className="mt-3 font-semibold">Workflow · policy · tenancy · knowledge</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Stores intent, approvals, routing rules, and normalized evidence.</p>
          </div>
          <div className="hidden items-center border-x border-white/10 px-5 text-slate-600 md:flex">signed metadata →</div>
          <div className="border-t border-white/10 p-6 md:border-t-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-200">Execution plane</p>
            <p className="mt-3 font-semibold">Agent drivers · sandbox drivers · instrumentation</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Touches code, runs commands, and produces observed provenance.</p>
          </div>
          <div className="hidden items-center border-x border-white/10 px-5 text-slate-600 md:flex">drivers →</div>
          <div className="border-t border-white/10 p-6 md:border-t-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300">Client systems</p>
            <p className="mt-3 font-semibold">SCM · CI/CD · secrets · approved platforms</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Remain customer-controlled and replaceable.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
