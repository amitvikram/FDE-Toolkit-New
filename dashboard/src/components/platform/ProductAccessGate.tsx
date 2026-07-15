"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  FileCheck2,
  GitPullRequest,
  Loader2,
  LockKeyhole,
  Network,
  ShieldCheck,
} from "lucide-react";

type Status = "idle" | "submitting" | "error";

const inputClassName =
  "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10";

export function ProductAccessGate() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError("");
    const data = new FormData(event.currentTarget);
    const payload = {
      name: String(data.get("name") || ""),
      email: String(data.get("email") || ""),
      company: String(data.get("company") || ""),
      role: String(data.get("role") || ""),
      useCase: String(data.get("useCase") || ""),
      message: String(data.get("message") || ""),
      website: String(data.get("website") || ""),
      source: window.location.pathname,
    };

    try {
      const response = await fetch("/api/product-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Access could not be created.");
      window.location.replace("/platform");
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Access could not be created.",
      );
      setStatus("error");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto grid min-h-screen max-w-[1500px] lg:grid-cols-[1.05fr_0.95fr]">
        <section className="relative hidden overflow-hidden border-r border-white/10 p-12 lg:flex lg:flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(34,211,238,0.13),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(99,102,241,0.13),transparent_38%)]" />
          <div className="relative">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
              <ArrowLeft className="size-4" /> Back to FDE-Toolkit
            </Link>
            <div className="mt-20 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/5 px-3 py-1 text-xs font-semibold text-cyan-200">
                <LockKeyhole className="size-3.5" /> Private product workspace
              </div>
              <h1 className="mt-6 text-5xl font-semibold tracking-[-0.045em]">
                Enter the working product—not another marketing page.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-400">
                The workspace creates a durable delivery job, routes it to the execution plane, shows the generated product, exposes independently observed evidence, records approval decisions, and prepares the promotion package.
              </p>
            </div>
          </div>

          <div className="relative mt-auto grid gap-3 pb-4 pt-16 sm:grid-cols-2">
            {[
              [Network, "Create a governed job", "Client intent, repository, policy, drivers and limits."],
              [FileCheck2, "Inspect actual evidence", "Files, hashes, commands, tests and audit-chain events."],
              [ShieldCheck, "Record approvals", "Named human gates remain outside the coding agent."],
              [GitPullRequest, "Review promotion", "Branch, commit, changed files and PR package."],
            ].map(([Icon, title, description]) => {
              const CardIcon = Icon as typeof Network;
              return (
                <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 backdrop-blur">
                  <CardIcon className="size-5 text-cyan-300" />
                  <p className="mt-4 text-sm font-semibold text-white">{String(title)}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{String(description)}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex items-center justify-center bg-slate-50 px-5 py-10 text-slate-950 sm:px-10 lg:px-16">
          <div className="w-full max-w-xl">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 lg:hidden">
              <ArrowLeft className="size-4" /> Back to FDE-Toolkit
            </Link>
            <div className="mt-8 lg:mt-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-700">Access the product</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Tell us who is entering the workspace.</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Access is immediate after submission. Your details are sent to the FDE-Toolkit team so the product experience is limited to identifiable prospective users.
              </p>
            </div>

            <form onSubmit={submit} className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">
                  Name
                  <input name="name" required minLength={2} maxLength={100} autoComplete="name" className={inputClassName} placeholder="Your name" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Work email
                  <input name="email" type="email" required maxLength={200} autoComplete="email" className={inputClassName} placeholder="you@company.com" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Company
                  <input name="company" required minLength={2} maxLength={150} autoComplete="organization" className={inputClassName} placeholder="Company" />
                </label>
                <label className="text-sm font-medium text-slate-700">
                  Role
                  <input name="role" required minLength={2} maxLength={150} autoComplete="organization-title" className={inputClassName} placeholder="CIO, product leader, architect…" />
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  Primary use case
                  <select name="useCase" required defaultValue="" className={inputClassName}>
                    <option value="" disabled>Select a use case</option>
                    <option value="Enterprise governed AI delivery">Enterprise governed AI delivery</option>
                    <option value="SaaS design-partner productization">SaaS design-partner productization</option>
                    <option value="SI or consulting delivery factory">SI or consulting delivery factory</option>
                    <option value="Forward-deployed engineering operating model">Forward-deployed engineering operating model</option>
                    <option value="Other">Other</option>
                  </select>
                </label>
                <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                  What would you like to evaluate? <span className="font-normal text-slate-400">Optional</span>
                  <textarea name="message" rows={4} maxLength={2000} className={`${inputClassName} resize-y`} placeholder="A workflow, client delivery challenge, approved coding platform, or pilot requirement." />
                </label>
              </div>

              <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
                <label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label>
              </div>

              {status === "error" && (
                <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              )}

              <button type="submit" disabled={status === "submitting"} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {status === "submitting" ? <><Loader2 className="size-4 animate-spin" /> Creating private access</> : <><CheckCircle2 className="size-4" /> Enter product workspace</>}
              </button>
              <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                Access lasts 30 days on this browser. No password is created at this stage.
              </p>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
