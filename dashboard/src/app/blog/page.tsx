import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PublicPage } from "@/components/marketing/PublicChrome";
import { insights } from "@/lib/insights";

export const metadata: Metadata = {
  title: "Insights",
  description:
    "Practical thinking on forward-deployed engineering, enterprise AI delivery, product reuse, and systems-integrator operating models.",
};

export default function BlogPage() {
  return (
    <PublicPage>
      <section className="border-b border-white/10 px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-cyan-300">
              FDE-Toolkit Insights
            </p>
            <h1 className="mt-6 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl">
              How customer-specific AI delivery becomes governed, reusable, and scalable.
            </h1>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-400 sm:text-xl">
              Ideas and operating patterns for enterprise AI leaders, SaaS product teams, forward-deployed engineers, and systems integrators.
            </p>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-2">
          {insights.map((insight, index) => (
            <Link
              key={insight.slug}
              href={`/blog/${insight.slug}`}
              className="group flex min-h-80 flex-col rounded-[2rem] border border-white/10 bg-slate-900/55 p-7 transition hover:-translate-y-1 hover:border-cyan-300/30 sm:p-9"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-cyan-300">
                  {insight.category}
                </span>
                <span className="text-xs text-slate-500">{insight.readingTime}</span>
              </div>
              <h2 className="mt-8 text-3xl font-semibold tracking-[-0.03em] group-hover:text-cyan-100">
                {insight.title}
              </h2>
              <p className="mt-5 text-base leading-7 text-slate-400">{insight.dek}</p>
              <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-6">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  Read article <ArrowRight className="size-4" />
                </span>
                <span className="font-mono text-xs text-slate-600">0{index + 1}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-white/10 bg-slate-900/40 px-5 py-20 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-8 rounded-[2rem] border border-cyan-300/20 bg-cyan-300 p-8 text-slate-950 lg:grid-cols-[1fr_auto] lg:items-end lg:p-12">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-700">
              From insight to operating model
            </p>
            <h2 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              Bring one delivery bottleneck. Map the path to a governed 48-hour PR cycle.
            </h2>
          </div>
          <a
            href="mailto:amitvik@gmail.com?subject=FDE-Toolkit%2048-hour%20PR%20workshop"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-6 py-3.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Book a workflow review <ArrowRight className="size-4" />
          </a>
        </div>
      </section>
    </PublicPage>
  );
}
