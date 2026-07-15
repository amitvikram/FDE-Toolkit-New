import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { verifyClientPreviewToken } from "@/lib/client-preview-token";
import { getProductJob, getProductWorkspace } from "@/lib/orchestration/platform-client";
import { ClientPreviewDecision } from "@/components/platform/ClientPreviewDecision";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Client Preview Review",
  description: "Review and approve a governed FDE-Toolkit change preview.",
  robots: { index: false, follow: false },
};

export default async function ClientPreviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const release = verifyClientPreviewToken(token);
  if (!release) notFound();

  let job;
  let workspace;
  try {
    [{ job }, { workspace }] = await Promise.all([
      getProductJob(release.leadId, release.jobId),
      getProductWorkspace(release.leadId, release.workspaceId),
    ]);
  } catch {
    notFound();
  }
  if (!job.result?.previewHtml || job.status !== "completed") notFound();
  const existing = job.approvals.find((approval) => approval.approvalKey === release.approvalKey);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div>
            <p className="text-sm font-semibold">{workspace.name}</p>
            <p className="mt-0.5 text-xs text-slate-500">Client change review · {job.id}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-800">
            <ShieldCheck className="size-3.5" /> Governed preview
          </span>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[1fr_360px]">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-5 py-4">
            <div>
              <h1 className="font-semibold">Working application candidate</h1>
              <p className="mt-1 text-xs text-slate-500">Inspect the behavior below before recording a decision.</p>
            </div>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">Not production</span>
          </div>
          <iframe title="Client application preview" srcDoc={job.result.previewHtml} sandbox="allow-scripts" className="h-[72vh] min-h-[620px] w-full bg-white" />
        </section>
        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Requested change</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{job.request.intent}</p>
            <dl className="mt-5 space-y-3 border-t border-slate-100 pt-5 text-xs">
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Repository</dt><dd className="max-w-[190px] truncate font-semibold">{job.request.repository || "Workspace repository"}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Agent</dt><dd className="font-semibold">{job.request.driverId}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Evidence</dt><dd className="font-semibold">{job.usage.eventCount} events</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-slate-500">Promotion</dt><dd className="font-semibold">Blocked until approvals</dd></div>
            </dl>
          </section>
          {existing ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="font-semibold text-emerald-950">Decision already recorded</h2>
              <p className="mt-2 text-sm leading-6 text-emerald-800">This approval gate is currently marked <strong>{existing.decision}</strong>.</p>
            </div>
          ) : <ClientPreviewDecision token={token} />}
        </aside>
      </div>
    </main>
  );
}
