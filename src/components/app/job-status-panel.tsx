"use client";

import { AlertCircle, CheckCircle2, Clock3, Coins, Loader2, XCircle } from "lucide-react";
import type { GenerationJob } from "@/lib/types";

function statusTone(status: GenerationJob["status"]) {
  if (status === "succeeded") return "text-emerald-600 bg-emerald-50 border-emerald-200";
  if (status === "failed" || status === "refunded") return "text-rose-600 bg-rose-50 border-rose-200";
  if (status === "running") return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-700 bg-slate-50 border-slate-200";
}

function statusLabel(status: GenerationJob["status"]) {
  if (status === "queued") return "Waiting";
  if (status === "running") return "Creating";
  if (status === "succeeded") return "Delivered";
  if (status === "failed") return "Needs review";
  return "Credits returned";
}

function StatusIcon({ status }: { status: GenerationJob["status"] }) {
  if (status === "succeeded") return <CheckCircle2 className="h-5 w-5" strokeWidth={1.8} />;
  if (status === "failed" || status === "refunded") return <XCircle className="h-5 w-5" strokeWidth={1.8} />;
  if (status === "running") return <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />;
  return <Clock3 className="h-5 w-5" strokeWidth={1.8} />;
}

function helperCopy(job: GenerationJob) {
  if (job.status === "queued") return "Your album request is in line. Credits are held while we prepare it.";
  if (job.status === "running") return "Your AI photo album is being created.";
  if (job.status === "succeeded") return "Your album is ready in the private gallery.";
  if (job.status === "failed") return "This request needs review. Held credits will be returned if it cannot be completed.";
  return "Credits were returned for this request.";
}

function updateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

export function JobStatusPanel({ job }: { job: GenerationJob }) {
  return (
    <div className="grid gap-4">
      <div className={`rounded-2xl border px-4 py-4 ${statusTone(job.status)}`}>
        <div className="flex items-start gap-3">
          <StatusIcon status={job.status} />
          <div className="min-w-0">
            <div className="text-sm font-semibold">{statusLabel(job.status)}</div>
            <p className="mt-1 text-sm leading-6">{helperCopy(job)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Coins className="h-4 w-4" strokeWidth={1.8} />
            Credits held
          </div>
          <div className="mt-2 text-2xl font-semibold text-zinc-950">{job.creditsReserved}</div>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white px-4 py-4">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <AlertCircle className="h-4 w-4" strokeWidth={1.8} />
            Last update
          </div>
          <div className="mt-2 text-sm font-medium text-zinc-950">{updateLabel(job.updatedAt)}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-black/10 bg-[#fafaf9] px-4 py-4 text-sm leading-6 text-zinc-600">
        This private request page shows status, held credits, and delivered images for your account.
      </div>
    </div>
  );
}
