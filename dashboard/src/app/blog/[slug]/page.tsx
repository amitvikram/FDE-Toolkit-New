import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackToInsights, PublicPage } from "@/components/marketing/PublicChrome";
import { getInsight, insights } from "@/lib/insights";

export function generateStaticParams() {
  return insights.map((insight) => ({ slug: insight.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const insight = getInsight(slug);

  if (!insight) {
    return {};
  }

  return {
    title: insight.title,
    description: insight.dek,
    openGraph: {
      title: insight.title,
      description: insight.dek,
      type: "article",
      url: `/blog/${insight.slug}`,
    },
  };
}

export default async function InsightPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const insight = getInsight(slug);

  if (!insight) {
    notFound();
  }

  return (
    <PublicPage>
      <article>
        <header className="border-b border-white/10 px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-4xl">
            <BackToInsights />
            <div className="mt-12 flex flex-wrap items-center gap-3 text-xs">
              <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 font-mono uppercase tracking-[0.14em] text-cyan-300">
                {insight.category}
              </span>
              <span className="text-slate-500">{insight.readingTime}</span>
            </div>
            <h1 className="mt-7 text-5xl font-semibold tracking-[-0.045em] sm:text-6xl">
              {insight.title}
            </h1>
            <p className="mt-7 text-xl leading-9 text-slate-400">{insight.dek}</p>
          </div>
        </header>

        <div className="px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="max-w-3xl space-y-14">
              {insight.sections.map((section) => (
                <section key={section.heading}>
                  <h2 className="text-3xl font-semibold tracking-[-0.03em] text-white">
                    {section.heading}
                  </h2>
                  <div className="mt-5 space-y-5 text-base leading-8 text-slate-300">
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                  {section.bullets && (
                    <ul className="mt-6 space-y-3 rounded-3xl border border-white/10 bg-slate-900/55 p-6">
                      {section.bullets.map((bullet) => (
                        <li key={bullet} className="flex gap-3 text-sm leading-6 text-slate-300">
                          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-cyan-300" />
                          <span>{bullet}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ))}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start">
              <div className="rounded-3xl border border-orange-300/20 bg-orange-300/5 p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-orange-200">
                  LinkedIn opening
                </p>
                <p className="mt-4 text-sm leading-6 text-slate-200">
                  {insight.linkedinHook}
                </p>
              </div>
              <div className="mt-4 rounded-3xl border border-white/10 bg-slate-900/55 p-6">
                <p className="text-sm font-semibold text-white">Continue the discussion</p>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Use this article as the supporting link for a LinkedIn post, then invite readers to compare their current client-ask-to-PR cycle.
                </p>
                <a
                  href={`mailto:amitvik@gmail.com?subject=${encodeURIComponent(`Discussion: ${insight.title}`)}`}
                  className="mt-5 inline-flex text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Contact FDE-Toolkit →
                </a>
              </div>
            </aside>
          </div>
        </div>
      </article>
    </PublicPage>
  );
}
