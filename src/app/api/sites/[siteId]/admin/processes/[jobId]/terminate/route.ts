import { NextResponse } from "next/server";
import { requireSiteMutation } from "@/lib/api-auth";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import {
  abortLocalWorkerProcesses,
  hasLocalWorkerProcess
} from "@/lib/local-worker-abort-registry";
import { StoreError } from "@/lib/server-store";
import { terminateGenerationJobRelational } from "@/lib/stores/job-store";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const guard = await requireSiteMutation(request, siteId, {
    roles: ["owner", "admin"],
    key: `${siteId}:process-terminate`
  });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as { reason?: string };
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 240) : "";
  const localWorkerWasRegistered = hasLocalWorkerProcess({ siteId, jobId });

  try {
    const result = await terminateGenerationJobRelational({
      jobId,
      siteId,
      actorId: guard.current.siteAdmin.id,
      reason,
      localWorkerAbort: localWorkerWasRegistered
    });
    const abortResult = abortLocalWorkerProcesses({
      siteId,
      jobId,
      reason: "local_worker_aborted"
    });
    publishCustomerJobEventForJob("result", result.job, {
      eventKind: "final",
      stage: "admin_terminated",
      error: "generation_job_terminated_by_admin"
    });
    return NextResponse.json({
      ok: true,
      job: result.job,
      customer: result.customer,
      customerBalance: result.customer.balance,
      ledgerAction: result.ledger ?? null,
      localWorkerAbort: {
        attempted: localWorkerWasRegistered,
        aborted: abortResult.aborted,
        count: abortResult.count,
        requestIds: abortResult.requestIds
      },
      note: "Generation job was terminated and reserved credits were released."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "process_terminate_failed"
    }, { status });
  }
}
