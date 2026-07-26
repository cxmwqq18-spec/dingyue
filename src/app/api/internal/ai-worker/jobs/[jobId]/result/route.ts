import { NextResponse } from "next/server";
import { publishCustomerJobEventForJob } from "@/lib/customer-job-events";
import { StoreError } from "@/lib/server-store";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import { verifyWorkerCallbackSignature, type WorkerResultPayload } from "@/lib/worker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
      error: body.error
    });
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
