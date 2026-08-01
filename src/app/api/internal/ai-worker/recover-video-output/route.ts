import { NextRequest, NextResponse } from "next/server";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { StoreError } from "@/lib/server-store";
import { recoverVideoProviderOutput } from "@/lib/video-provider-result-recovery";
import type { WorkerOutputSlot } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasRecoverySecret(request: NextRequest) {
  const configured = process.env.AI_WORKER_SECRET?.trim();
  if (!configured || configured === "dev-worker-secret") return process.env.NODE_ENV !== "production";
  return request.headers.get("x-ai-worker-secret") === configured;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function outputSlotsFromResult(value: unknown): WorkerOutputSlot[] | undefined {
  const slots = recordValue(value).outputSlots;
  if (!Array.isArray(slots)) return undefined;
  return slots.filter((slot): slot is WorkerOutputSlot => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot));
}

function timingFromResult(value: unknown): Record<string, string> | undefined {
  const timing = recordValue(recordValue(value).timing);
  const entries = Object.entries(timing).filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1]));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

export async function POST(request: NextRequest) {
  if (!hasRecoverySecret(request)) {
    return NextResponse.json({ error: "invalid_video_recovery_secret" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    siteId?: string;
    jobId?: string;
    providerId?: string;
    providerTaskId?: string;
    taskId?: string;
    videoUrl?: string;
    resultUrl?: string;
  };
  try {
    const result = await recoverVideoProviderOutput({
      siteId: body.siteId ?? "",
      jobId: body.jobId ?? "",
      providerId: body.providerId,
      providerTaskId: body.providerTaskId ?? body.taskId,
      videoUrl: body.videoUrl ?? body.resultUrl
    });
    publishCustomerJobEventForJob("result", result.job, {
      eventKind: "final",
      stage: "video_result_received",
      outputSlots: outputSlotsFromResult(result.job.resultJson),
      timing: timingFromResult(result.job.resultJson),
      alreadyProcessed: result.alreadyProcessed
    });
    return NextResponse.json({
      ok: true,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger ?? null,
      provider: result.provider,
      providerTaskId: result.providerTaskId || null,
      storageKey: result.storageKey ?? null,
      mimeType: result.mimeType ?? null,
      downloadedBytes: result.downloadedBytes,
      skipped: result.skipped,
      note: result.alreadyProcessed
        ? "Existing result was already processed."
        : "Recovered an existing provider video output and settled the job."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "video_output_recovery_failed"
    }, { status });
  }
}
