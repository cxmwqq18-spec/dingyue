import { NextResponse } from "next/server";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { StoreError } from "@/lib/server-store";
import { updateGenerationJobStatusRelational } from "@/lib/stores/job-store";
import { verifyWorkerCallbackSignature, type WorkerOutputSlot } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function recordTiming(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const timing: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry) timing[key] = entry;
  }
  return Object.keys(timing).length ? timing : undefined;
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as { siteId?: string; requestId?: string; status?: string; stage?: string; progress?: number; outputSlots?: WorkerOutputSlot[]; error?: string; timing?: unknown; signature?: string };
  if (!body.siteId || !body.requestId || !body.status) {
    return NextResponse.json({ error: "invalid_worker_status_payload" }, { status: 400 });
  }
  if (!verifyWorkerCallbackSignature(body as Record<string, unknown>)) {
    return NextResponse.json({ error: "invalid_worker_signature" }, { status: 401 });
  }
  if (body.status !== "queued" && body.status !== "running" && body.status !== "failed") {
    return NextResponse.json({ error: "invalid_worker_status" }, { status: 400 });
  }
  try {
    const progress = Number.isFinite(Number(body.progress))
      ? Math.max(0, Math.min(100, Number(body.progress)))
      : body.outputSlots?.find((slot) => Number.isFinite(Number(slot.progress)))?.progress;
    const outputSlots = Array.isArray(body.outputSlots) ? body.outputSlots : undefined;
    const result = await updateGenerationJobStatusRelational({
      jobId,
      siteId: body.siteId,
      requestId: body.requestId,
      status: body.status,
      stage: body.stage,
      progress,
      outputSlots,
      timing: recordTiming(body.timing)
    });
    publishCustomerJobEventForJob("status", result.job, {
      alreadyFinal: result.alreadyFinal,
      stage: body.stage,
      progress: progress ??
        (Number.isFinite(Number(result.job.resultJson?.lastWorkerProgress)) ? Number(result.job.resultJson?.lastWorkerProgress) : undefined),
      outputSlots,
      error: body.error,
      eventKind: body.status === "failed" || result.alreadyFinal ? "final" : "progress"
    });
    return NextResponse.json({
      accepted: true,
      job: result.job,
      alreadyFinal: result.alreadyFinal,
      note: "Persisted worker status without changing credits."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "worker_status_update_failed" }, { status });
  }
}
