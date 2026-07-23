import { NextRequest, NextResponse } from "next/server";
import { publicUrlForRequest } from "@/lib/session";
import { listRecoverableQueuedGenerationJobsRelational, settleGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload, resolveWorkerBaseUrls } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasRecoverySecret(request: NextRequest) {
  const configured = process.env.AI_WORKER_SECRET?.trim();
  if (!configured || configured === "dev-worker-secret") return process.env.NODE_ENV !== "production";
  return request.headers.get("x-ai-worker-secret") === configured;
}

export async function POST(request: NextRequest) {
  if (!hasRecoverySecret(request)) {
    return NextResponse.json({ error: "invalid_worker_recovery_secret" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    siteId?: string;
    olderThanMs?: number;
    limit?: number;
  };
  const olderThanMs = Math.max(60_000, Number(body.olderThanMs ?? process.env.AI_DISPATCH_RECOVERY_OLDER_THAN_MS ?? "120000") || 120_000);
  const limit = Math.max(1, Math.min(Math.trunc(Number(body.limit ?? "10") || 10), 50));
  const baseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);

  try {
    const candidates = await listRecoverableQueuedGenerationJobsRelational({
      siteId: body.siteId,
      olderThanMs,
      limit
    });
    const recovered = [];
    for (const candidate of candidates) {
      const workerPayload = await buildWorkerPayload({ job: candidate.job, siteAiApp: candidate.siteAiApp, baseUrls });
      const workerDispatch = await dispatchWorkerPayload(workerPayload);
      if (workerDispatch.status !== "sent") {
        await settleGenerationJobRelational({
          jobId: candidate.job.id,
          siteId: candidate.job.siteId,
          requestId: workerPayload.requestId,
          status: "failed",
          error: workerDispatch.error ?? "generation_dispatch_recovery_failed"
        });
      }
      recovered.push({
        jobId: candidate.job.id,
        siteId: candidate.job.siteId,
        workerDispatch
      });
    }
    return NextResponse.json({ ok: true, recovered });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "generation_dispatch_recovery_failed" }, { status: 500 });
  }
}
