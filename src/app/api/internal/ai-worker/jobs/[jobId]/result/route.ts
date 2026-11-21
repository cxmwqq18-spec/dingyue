import { NextResponse, after } from "next/server";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { StoreError } from "@/lib/server-store";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import { verifyWorkerCallbackSignature, resolveWorkerBaseUrls, type WorkerResultPayload } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/**
 * When a workspace shot job settles successfully, the direct task can move to
 * final stitching without any browser in the loop. Guarded to Aidreamcapes
 * workspace jobs only; the continuation itself re-checks task state and is
 * idempotent. Failed jobs stay terminal — the customer retries explicitly.
 */
function scheduleWorkspaceDirectContinuation(siteId: string, status: string, alreadyProcessed: boolean, job: { customerId?: string; requestJson?: unknown }) {
  if (alreadyProcessed || status !== "succeeded") return;
  if (siteId !== "site_aidreamcapes") return;
  const workspace = recordValue((recordValue(job.requestJson) as Record<string, unknown>).workspace);
  const taskId = typeof workspace.taskId === "string" ? workspace.taskId : undefined;
  if (!taskId || !job.customerId) return;
  const customerId = job.customerId;
  after(async () => {
    try {
      const [{ getTask }, { refreshTask, continueDirectTask, directTaskNeedsServerContinuation }] = await Promise.all([
        import("@/lib/aidreamcapes-workspace/store"),
        import("@/lib/aidreamcapes-workspace/runner")
      ]);
      const task = await refreshTask(await getTask(siteId, customerId, taskId));
      if (directTaskNeedsServerContinuation(task)) await continueDirectTask(task, resolveWorkerBaseUrls(""));
    } catch (error) { console.error("[aivideosugc-workspace] post-settlement continuation", error); }
  });
}

function recordTiming(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value === "object" || Array.isArray(value)) return undefined;
  const timing: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry) timing[key] = entry;
  }
  return Object.keys(timing).length ? timing : undefined;
}

/**
 * Completion-time media prewarm (AIVIDEOSUGC_PREWARM_MEDIA=1): every finished
 * video asset gets its 720p copy, 480p card copy and poster built now, so the
 * customer's first play streams a ready file instead of waiting on ffmpeg.
 * Idempotent (sidecars are cached by source mtime) and failure-tolerant —
 * playback falls back to the lazy transcode path when anything is missing.
 */
function scheduleWorkspaceMediaPrewarm(siteId: string, status: string, alreadyProcessed: boolean, outputs: WorkerResultPayload["outputs"]) {
  if (alreadyProcessed || status !== "succeeded") return;
  if (siteId !== "site_aidreamcapes") return;
  const videoKeys = (outputs ?? [])
    .map((output) => output.storageKey)
    .filter((storageKey) => /\.(mp4|webm|mov)$/i.test(storageKey));
  if (!videoKeys.length) return;
  after(async () => {
    try {
      const [{ customerAssetFileExists, customerAssetFilePath }, { prewarmWorkspaceVideoArtifacts }] = await Promise.all([
        import("@/lib/customer-asset-storage"),
        import("@/lib/media-web-transcode")
      ]);
      for (const storageKey of videoKeys) {
        const filePath = customerAssetFilePath(storageKey);
        if (!customerAssetFileExists(storageKey)) continue;
        await prewarmWorkspaceVideoArtifacts(filePath);
      }
    } catch (error) { console.error("[aivideosugc-workspace] media prewarm", error); }
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as WorkerResultPayload;
  if (!body.siteId || !body.requestId || !body.status || body.jobId !== jobId) {
    return NextResponse.json({ error: "invalid_worker_result_payload" }, { status: 400 });
  }
  if (!verifyWorkerCallbackSignature(body as unknown as Record<string, unknown>)) {
    return NextResponse.json({ error: "invalid_worker_signature" }, { status: 401 });
  }
  if (body.status !== "succeeded" && body.status !== "failed") {
    return NextResponse.json({ error: "invalid_worker_result_status" }, { status: 400 });
  }
  try {
    const result = await settleGenerationJobRelational({
      jobId,
      siteId: body.siteId,
      requestId: body.requestId,
      status: body.status,
      outputs: body.outputs,
      providerTrace: body.providerTrace,
      costTrace: body.costTrace,
      providerFailure: body.providerFailure,
      error: body.error,
      timing: body.timing
    });
    publishCustomerJobEventForJob("result", result.job, {
      alreadyProcessed: result.alreadyProcessed,
      eventKind: "final",
      error: body.error,
      timing: recordTiming(result.job.resultJson?.timing) ?? body.timing
    });
    scheduleWorkspaceDirectContinuation(body.siteId, body.status, result.alreadyProcessed, result.job);
    scheduleWorkspaceMediaPrewarm(body.siteId, body.status, result.alreadyProcessed, body.outputs);
    return NextResponse.json({
      accepted: true,
      idempotencyKey: `${body.siteId}:${jobId}:${body.requestId}:result`,
      alreadyProcessed: result.alreadyProcessed,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger ?? null,
      note: result.alreadyProcessed ? "Duplicate result ignored." : "Persisted result and settled reserved credits."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "worker_result_update_failed" }, { status });
  }
}
