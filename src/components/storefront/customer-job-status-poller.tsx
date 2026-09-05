"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock3, Loader2 } from "lucide-react";
import type { ThemeRuntimeData } from "@/lib/types";

type RuntimeJob = ThemeRuntimeData["jobs"][number];

type Props = {
  initialJob: RuntimeJob;
  initialAssetsCount: number;
  siteId: string;
};

type RuntimeResponse = {
  ok?: boolean;
  runtime?: ThemeRuntimeData;
};

function resultRecord(job: RuntimeJob): Record<string, unknown> {
  const result = job.resultJson;
  return result && typeof result === "object" && !Array.isArray(result) ? result : {};
}

function stageLabel(stage: unknown, status: RuntimeJob["status"]): string {
  if (status === "failed") return "Generation failed";
  if (status === "succeeded") return "Images delivered";
  if (stage === "local_worker_started") return "Preparing your request";
  if (stage === "source_images_ready") return "Preparing selected photos";
  if (stage === "provider_request_started") return "Creating your images";
  if (stage === "provider_response_received") return "Saving your images";
  if (status === "queued") return "Waiting in queue";
  if (status === "running") return "Creating images";
  return "Request updated";
}

function statusBody(job: RuntimeJob, assetsCount: number): string {
  const result = resultRecord(job);
  if (job.status === "failed") {
    return "We could not finish this request. Held credits were returned automatically, so you can try again after adjusting the photos or package.";
  }
  if (job.status === "succeeded") {
    return assetsCount > 0
      ? `${assetsCount} delivered image${assetsCount === 1 ? "" : "s"} are ready in this request.`
      : "The request completed, and delivered images are being attached.";
  }
  if (result.lastWorkerStage === "provider_request_started") {
    return "Your selected photos and description are being processed. This is usually the longest step.";
  }
  if (result.lastWorkerStage === "source_images_ready") {
    return "Your selected private photos are being prepared.";
  }
  if (job.status === "queued") {
    return "Credits are held while your request waits to start.";
  }
  return "Keep this page open or come back later. The status updates as your request moves forward.";
}

function failureDetail(job: RuntimeJob): string | undefined {
  const error = resultRecord(job).error;
  if (typeof error !== "string" || !error.trim()) return undefined;
  if (error.includes("no_image_ai_provider_configured")) return "Image creation is temporarily unavailable. Try again later.";
  if (error.includes("UND_ERR_CONNECT_TIMEOUT") || error.includes("timeout")) return "Image creation took too long to respond. Try again after a short wait.";
  if (error.includes("ai_provider_api_key_missing")) return "Image creation is temporarily unavailable. Try again later.";
  if (error.includes("ai_provider_not_image_model")) return "This image request could not be completed. Try again later.";
  if (error.includes("ai_provider_source_image_failed")) return "One selected photo could not be read. Re-upload it and try again.";
  return "We could not finish this request. Please try again after a short wait.";
}

function percentFor(job: RuntimeJob, assetsCount: number): number {
  const stage = resultRecord(job).lastWorkerStage;
  if (job.status === "failed") return 100;
  if (job.status === "succeeded") return 100;
  if (assetsCount > 0) return 95;
  if (stage === "provider_response_received") return 88;
  if (stage === "provider_request_started") return 62;
  if (stage === "source_images_ready") return 42;
  if (stage === "local_worker_started") return 25;
  if (job.status === "running") return 18;
  return 8;
}

export function CustomerJobStatusPoller({ initialAssetsCount, initialJob, siteId }: Props) {
  const [job, setJob] = useState(initialJob);
  const [assetsCount, setAssetsCount] = useState(initialAssetsCount);
  const [refreshError, setRefreshError] = useState("");
  const isFinal = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
  const detail = failureDetail(job);
  const percent = percentFor(job, assetsCount);
  const label = stageLabel(resultRecord(job).lastWorkerStage, job.status);
  const updated = useMemo(() => new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(job.updatedAt)), [job.updatedAt]);

  useEffect(() => {
    if (isFinal) return;
    let cancelled = false;
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;
    const refreshJob = async () => {
      try {
        const response = await fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=${Date.now()}`, {
          cache: "no-store"
        });
        const payload = (await response.json().catch(() => ({}))) as RuntimeResponse;
        if (!response.ok || !payload.runtime) throw new Error("status_refresh_failed");
        const nextJob = payload.runtime.jobs.find((item) => item.id === initialJob.id);
        if (!cancelled && nextJob) {
          setJob(nextJob);
          setAssetsCount(payload.runtime.assets.filter((asset) => asset.jobId === initialJob.id).length);
          setRefreshError("");
        }
      } catch {
        if (!cancelled) setRefreshError("Status refresh paused. Reload the page to check again.");
      }
    };
    const events = new EventSource(`/api/sites/${siteId}/customer/job-events`);
    const handleJobEvent = (event: MessageEvent<string>) => {
      const payload = (() => {
        try {
          return JSON.parse(event.data) as { jobId?: unknown };
        } catch {
          return {};
        }
      })();
      if (payload.jobId !== initialJob.id) return;
      void refreshJob();
    };
    events.addEventListener("job", handleJobEvent);
    return () => {
      cancelled = true;
      events.removeEventListener("job", handleJobEvent);
      events.close();
    };
  }, [initialJob.id, isFinal, siteId]);

  const Icon = job.status === "failed" ? AlertTriangle : job.status === "succeeded" ? CheckCircle2 : job.status === "queued" ? Clock3 : Loader2;
  return (
    <div className={`mt-5 rounded-[1rem] border p-4 ${
      job.status === "failed"
        ? "border-rose-200 bg-rose-50 text-rose-950"
        : job.status === "succeeded"
        ? "border-emerald-200 bg-emerald-50 text-emerald-950"
        : "border-amber-200 bg-amber-50 text-amber-950"
    }`} role={job.status === "failed" ? "alert" : "status"}>
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${!isFinal ? "animate-spin" : ""}`} strokeWidth={1.9} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{label}</p>
            <span className="font-mono text-xs opacity-70">Updated {updated}</span>
          </div>
          <p className="mt-2 text-sm leading-6 opacity-80">{statusBody(job, assetsCount)}</p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
            <div className="h-full rounded-full bg-current transition-all" style={{ width: `${percent}%` }} />
          </div>
          {detail ? <p className="mt-3 text-sm font-medium">{detail}</p> : null}
          {refreshError ? <p className="mt-3 text-xs opacity-70">{refreshError}</p> : null}
        </div>
      </div>
    </div>
  );
}
