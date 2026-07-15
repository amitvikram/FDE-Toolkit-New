"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

type Status =
  | { state: "checking" }
  | { state: "connected"; boundary: string; trustModel: string }
  | { state: "disconnected"; error: string };

export function ExecutionPlaneStatus() {
  const [status, setStatus] = useState<Status>({ state: "checking" });

  useEffect(() => {
    let active = true;

    async function check() {
      try {
        const response = await fetch("/api/orchestration/health", { cache: "no-store" });
        const payload = (await response.json()) as {
          error?: string;
          executionPlane?: { executionBoundary?: string; trustModel?: string };
        };
        if (!active) return;
        if (!response.ok || !payload.executionPlane) {
          setStatus({ state: "disconnected", error: payload.error || "Execution plane unavailable." });
          return;
        }
        setStatus({
          state: "connected",
          boundary: payload.executionPlane.executionBoundary || "configured boundary",
          trustModel: payload.executionPlane.trustModel || "observed provenance",
        });
      } catch (error) {
        if (!active) return;
        setStatus({
          state: "disconnected",
          error: error instanceof Error ? error.message : "Execution plane unavailable.",
        });
      }
    }

    check();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="border-b border-white/10 bg-slate-950 px-5 py-5 text-white sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/65 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {status.state === "checking" && <Loader2 className="size-5 animate-spin text-cyan-300" />}
          {status.state === "connected" && <CheckCircle2 className="size-5 text-emerald-300" />}
          {status.state === "disconnected" && <TriangleAlert className="size-5 text-orange-200" />}
          <div>
            <p className="text-sm font-semibold">
              {status.state === "checking" && "Checking execution plane"}
              {status.state === "connected" && "Execution plane connected"}
              {status.state === "disconnected" && "Execution plane disconnected"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {status.state === "checking" && "Verifying the signed control-plane-to-execution-plane channel."}
              {status.state === "connected" && `${status.boundary} · ${status.trustModel}`}
              {status.state === "disconnected" && status.error}
            </p>
          </div>
        </div>
        <p className="text-xs text-slate-600">The demo button should be used only when this status is connected.</p>
      </div>
    </div>
  );
}
