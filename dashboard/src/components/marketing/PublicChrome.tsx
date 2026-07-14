import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

function LogoMark() {
  return (
    <div className="flex size-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 font-mono text-[11px] font-semibold text-cyan-200">
      FDE
    </div>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/90 text-white backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" aria-label="FDE-Toolkit home">
          <LogoMark />
          <div className="leading-tight">
            <span className="block text-sm font-semibold">FDE-Toolkit</span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500 sm:block">
              insights
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/blog" className="hidden text-sm text-slate-400 hover:text-white sm:inline">
            All insights
          </Link>
          <a
            href="mailto:amitvik@gmail.com?subject=FDE-Toolkit%20enterprise%20workflow%20review"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 sm:text-sm"
          >
            Discuss a pilot <ArrowRight className="size-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-slate-950 px-5 py-10 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold">FDE-Toolkit</p>
          <p className="mt-1 text-xs text-slate-500">Governed customer-to-production delivery</p>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          <Link href="/" className="hover:text-white">Home</Link>
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
  );
}

export function PublicPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 text-white selection:bg-cyan-300 selection:text-slate-950">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function BackToInsights() {
  return (
    <Link
      href="/blog"
      className="inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
    >
      <ArrowLeft className="size-4" /> Back to all insights
    </Link>
  );
}
