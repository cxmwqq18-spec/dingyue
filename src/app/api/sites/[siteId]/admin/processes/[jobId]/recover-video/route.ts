import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { StoreError } from "@/lib/server-store";
import { recoverVideoProviderOutput } from "@/lib/video-provider-result-recovery";
import type { WorkerOutputSlot } from "@/lib/worker";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    key: `${siteId}:process-video-recovery`
  });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as {
    providerId?: string;
    providerTaskId?: string;
    taskId?: string;
    videoUrl?: string;
    resultUrl?: string;
  };

  try {
    const result = await recoverVideoProviderOutput({
      siteId,
      jobId,
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
      error: error instanceof Error ? error.message : "process_video_recovery_failed"
    }, { status });
  }
}
