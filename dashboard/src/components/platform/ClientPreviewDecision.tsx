"use client";

import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, ThumbsDown, ThumbsUp } from "lucide-react";

type State = "idle" | "submitting" | "approved" | "rejected" | "error";

export function ClientPreviewDecision({ token }: { token: string }) {
  const [state, setState] = useState<State>("idle");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");

  async function decide(event: FormEvent, decision: "approve" | "reject") {
    event.preventDefault();
    setState("submitting");
    setError("");
    try {
      const response = await fetch(`/api/client-review/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Your decision could not be recorded.");
      setState(decision === "approve" ? "approved" : "rejected");
    } catch (submissionError) {
      setState("error");
      setError(submissionError instanceof Error ? submissionError.message : "Your decision could not be recorded.");
    }
  }

  if (state === "approved" || state === "rejected") {
    return (
      <div className={`rounded-2xl border p-6 ${state === "approved" ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex items-start gap-3">
          <CheckCircle2 className={`mt-0.5 size-5 ${state === "approved" ? "text-emerald-600" : "text-amber-600"}`} />
          <div>
            <h2 className="font-semibold text-slate-950">Decision recorded</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              You {state === "approved" ? "approved" : "rejected"} this preview. The FDE workspace and audit trail have been updated.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">Record your decision</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Your decision becomes part of the governed approval workflow. It does not deploy or merge the change automatically.</p>
      <label className="mt-5 block text-sm font-medium text-slate-700">
        Review comment
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} maxLength={2000} className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10" placeholder="What did you validate? What should change?" />
      </label>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button type="button" disabled={state === "submitting"} onClick={(event) => decide(event, "reject")} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
          {state === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <ThumbsDown className="size-4" />} Request changes
        </button>
        <button type="button" disabled={state === "submitting"} onClick={(event) => decide(event, "approve")} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
          {state === "submitting" ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />} Approve preview
        </button>
      </div>
    </form>
  );
}
