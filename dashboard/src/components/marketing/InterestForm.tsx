"use client";

import { FormEvent, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

type FormStatus = "idle" | "submitting" | "success" | "error";

const inputClassName =
  "mt-2 w-full rounded-xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-300/60 focus:ring-2 focus:ring-cyan-300/10";

export function InterestForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<FormStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);

    const payload = {
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      company: String(data.get("company") ?? ""),
      useCase: String(data.get("useCase") ?? ""),
      message: String(data.get("message") ?? ""),
      website: String(data.get("website") ?? ""),
      source: window.location.pathname,
    };

    try {
      const response = await fetch("/api/interest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || "We could not send your request.");
      }

      formRef.current?.reset();
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not send your request. Please try again.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="flex min-h-[32rem] flex-col items-center justify-center rounded-[2rem] border border-emerald-300/20 bg-emerald-300/5 p-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-300">
          <CheckCircle2 className="size-7" />
        </div>
        <h3 className="mt-6 text-2xl font-semibold text-white">Thank you. Your request was sent.</h3>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          We will review your workflow and respond using the work email you provided.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-7 text-sm font-semibold text-cyan-300 hover:text-cyan-200"
        >
          Submit another request
        </button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-black/20 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-200">
          Name
          <input
            name="name"
            type="text"
            required
            minLength={2}
            maxLength={100}
            autoComplete="name"
            className={inputClassName}
            placeholder="Your name"
          />
        </label>

        <label className="text-sm font-medium text-slate-200">
          Work email
          <input
            name="email"
            type="email"
            required
            maxLength={200}
            autoComplete="email"
            className={inputClassName}
            placeholder="you@company.com"
          />
        </label>

        <label className="text-sm font-medium text-slate-200 sm:col-span-2">
          Company
          <input
            name="company"
            type="text"
            required
            minLength={2}
            maxLength={150}
            autoComplete="organization"
            className={inputClassName}
            placeholder="Company or organization"
          />
        </label>

        <label className="text-sm font-medium text-slate-200 sm:col-span-2">
          What would you use FDE-Toolkit for?
          <select name="useCase" required defaultValue="" className={inputClassName}>
            <option value="" disabled>
              Select the closest use case
            </option>
            <option value="Enterprise AI workflow pilot">Enterprise AI workflow pilot</option>
            <option value="SaaS design-partner productization">
              SaaS design-partner productization
            </option>
            <option value="Systems integrator delivery platform">
              Systems integrator delivery platform
            </option>
            <option value="Forward-deployed engineering operating model">
              Forward-deployed engineering operating model
            </option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="text-sm font-medium text-slate-200 sm:col-span-2">
          Optional message
          <textarea
            name="message"
            rows={5}
            maxLength={2000}
            className={`${inputClassName} resize-y`}
            placeholder="Describe the workflow, delivery challenge, or pilot you have in mind."
          />
        </label>
      </div>

      <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {status === "error" && (
        <p role="alert" className="mt-5 rounded-xl border border-red-300/20 bg-red-300/5 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-5 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Sending request
          </>
        ) : (
          <>
            <Send className="size-4" /> Discuss this workflow
          </>
        )}
      </button>

      <p className="mt-4 text-center text-xs leading-5 text-slate-500">
        Your information is used only to respond to this request.
      </p>
    </form>
  );
}
