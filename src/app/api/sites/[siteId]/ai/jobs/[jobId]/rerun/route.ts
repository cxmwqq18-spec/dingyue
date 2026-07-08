import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { rerunGenerationJobRelational, settleGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const guard = await requireSiteMutation(request, siteId, { roles: ["owner", "admin"], key: `${siteId}:job-rerun` });
  if (!guard.ok) return guard.response;
  const body = (await request.json().catch(() => ({}))) as { actor?: string };
  const baseUrl = new URL(request.url).origin;

  try {
    const result = await rerunGenerationJobRelational({ siteId, jobId, actor: body.actor });
    const workerPayload = await buildWorkerPayload({ job: result.job, siteAiApp: result.siteAiApp, baseUrl });
    const workerDispatch = await dispatchWorkerPayload(workerPayload);
    if (workerDispatch.status !== "sent") {
      const settled = await settleGenerationJobRelational({
        jobId: result.job.id,
        siteId,
        requestId: workerPayload.requestId,
        status: "failed",
        error: workerDispatch.error ?? "worker_dispatch_failed"
      });
      return NextResponse.json({
        ok: false,
        error: workerDispatch.error ?? "worker_dispatch_failed",
        sourceJob: result.sourceJob,
        job: settled.job,
        customer: settled.customer,
        customerBalance: settled.customer.balance,
        workerDispatch,
        note: "Worker dispatch was not accepted. The rerun job was failed and reserved credits were released."
      }, { status: workerDispatch.status === "skipped" ? 503 : 502 });
    }
    return NextResponse.json({
      ok: true,
      sourceJob: result.sourceJob,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger,
      workerPayload,
      workerDispatch,
      note: "Persisted rerun job, reserved credits, and attempted worker dispatch."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_rerun_failed" }, { status });
  }
}
