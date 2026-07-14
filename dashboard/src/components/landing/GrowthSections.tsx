"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Library,
  TrendingUp,
  Users,
} from "lucide-react";
import { insights } from "@/lib/insights";

const supportingMetrics = [
  {
    icon: BarChart3,
    name: "Sandbox-to-PR conversion",
    definition:
      "The share of engagement sandboxes that produce a reviewable pull request instead of ending as abandoned prototypes.",
    signal: "Delivery quality",
  },
  {
    icon: CheckCircle2,
    name: "Client approvals captured",
    definition:
      "The number of explicit workflow, UX, policy, and promotion approvals retained as evidence during each engagement.",
    signal: "Governance quality",
  },
  {
    icon: Library,
    name: "Knowledge reuse rate",
    definition:
      "The percentage of new engagements that begin from a governed library artifact, reference solution, or proven pattern.",
    signal: "Compounding IP",
  },
  {
    icon: Users,
    name: "Weekly active FDEs per seat",
    definition:
      "The proportion of licensed forward-deployed engineers actively using the platform in a typical week.",
    signal: "Adoption depth",
  },
  {
    icon: TrendingUp,
    name: "Expansion-driven NRR",
    definition:
      "Net revenue retention attributable to seat expansion across practices, regions, and client programs inside SI accounts.",
    signal: "Business value",
  },
];

export function GrowthSections() {
  return (
    <>
      <style jsx global>{`
        main > div > footer {
          display: none;
        }
      `}</style>

      <section
        id="metrics"
        className="border-t border-white/10 bg-slate-900/40 px-5 py-24 text-white sm:px-8 lg:px-12 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">
                <Clock3 className="size-3.5" /> Pilot success scorecard
              </div>
              <h2 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Measure the full path from client ask to governed production change.
              </h2>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
                FDE-Toolkit is designed to compress delivery time without bypassing review, approval, or engineering controls. These are targets and operating measures, not claims of achieved performance.
              </p>
            </div>

            <div className="overflow-hidden rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-300 to-sky-300 p-8 text-slate-950 shadow-2xl shadow-cyan-950/30 sm:p-10">
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-700">
                  North Star
                </span>
                <span className="rounded-full bg-slate-950/10 px-3 py-1 text-xs font-semibold">
                  Median cycle time
                </span>
              </div>
              <p className="mt-8 text-5xl font-semibold tracking-[-0.05em] sm:text-6xl">
                Under 48 hours
              </p>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-800">
                From a concrete client request to an approved, merged pull request, compared with a two-to-four-week baseline.
              </p>
              <div className="mt-8 grid gap-3 border-t border-slate-950/15 pt-6 sm:grid-cols-3">
                {[
                  ["Start", "Client ask captured"],
                  ["Evidence", "Validation + approvals"],
                  ["Finish", "Approved PR merged"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-slate-700">
                      {label}
                    </p>
                    <p className="mt-1 text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-14 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {supportingMetrics.map(({ icon: Icon, name, definition, signal }) => (
              <article
                key={name}
                className="rounded-3xl border border-white/10 bg-slate-950/70 p-6"
              >
                <div className="flex size-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-cyan-300">
                  <Icon className="size-5" />
                </div>
                <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
                  {signal}
                </p>
                <h3 className="mt-2 text-lg font-semibold">{name}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-400">{definition}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="insights"
        className="border-t border-white/10 bg-slate-950 px-5 py-24 text-white sm:px-8 lg:px-12 lg:py-32"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-300/20 bg-orange-300/5 px-3 py-1 font-mono text-xs uppercase tracking-[0.22em] text-orange-200">
                FDE-Toolkit Insights
              </div>
              <h2 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                Practical ideas for scaling customer-specific AI delivery.
              </h2>
              <p className="mt-6 text-lg leading-8 text-slate-400">
                Long-form thinking for enterprise AI leaders, SaaS product teams, forward-deployed engineers, and systems integrators.
              </p>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200"
            >
              View all insights <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="mt-14 grid gap-5 lg:grid-cols-2">
            {insights.slice(0, 4).map((insight, index) => (
              <Link
                key={insight.slug}
                href={`/blog/${insight.slug}`}
                className="group rounded-3xl border border-white/10 bg-slate-900/55 p-7 transition hover:-translate-y-1 hover:border-cyan-300/30"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                    {insight.category}
                  </span>
                  <span className="text-xs text-slate-500">{insight.readingTime}</span>
                </div>
                <h3 className="mt-7 text-2xl font-semibold tracking-[-0.025em] group-hover:text-cyan-100">
                  {insight.title}
                </h3>
                <p className="mt-4 text-sm leading-6 text-slate-400">{insight.dek}</p>
                <div className="mt-8 flex items-center justify-between border-t border-white/10 pt-5">
                  <span className="text-sm font-semibold text-white">Read article</span>
                  <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 bg-slate-950 px-5 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">FDE-Toolkit</p>
            <p className="mt-1 text-xs text-slate-500">
              Governed customer-to-production delivery
            </p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
            <a href="#buyers" className="hover:text-white">Customers</a>
            <a href="#metrics" className="hover:text-white">Success metrics</a>
            <Link href="/blog" className="hover:text-white">Insights</Link>
            <a
              href="https://github.com/amitvikram/FDE-Toolkit-New"
              target="_blank"
              rel="noreferrer"
              className="hover:text-white"
            >
              GitHub
            </a>
            <a href="mailto:amitvik@gmail.com" className="hover:text-white">Contact</a>
          </div>
        </div>
      </footer>
    </>
  );
}
