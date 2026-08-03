import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { submitRerunGenerationJob } from "@/lib/generation-submit";
import { StoreError } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { publicUrlForRequest } from "@/lib/session";
import { resolveWorkerBaseUrls } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; jobId: string }> }
) {
  const { siteId, jobId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    idempotencyKey?: string;
  };
  if (!body.customerId) {
    return NextResponse.json({ error: "missing_customer" }, { status: 400 });
  }

  const guard = await requireCustomerMutation(request, siteId, body.customerId, {
    rateLimit: RATE_LIMITS.generation,
    key: `${siteId}:${body.customerId}:job-retry`
  });
  if (!guard.ok) return guard.response;

  const workerBaseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || body.idempotencyKey?.trim() || undefined;
  const skipWorkerDispatch = process.env.NODE_ENV !== "production" && request.headers.get("x-smoke-skip-worker-dispatch") === "1";

  try {
    const result = await submitRerunGenerationJob({
      siteId,
      jobId,
      customerId: body.customerId,
      actor: guard.current.customer.id,
      idempotencyKey,
      baseUrls: workerBaseUrls,
      skipWorkerDispatch
    });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.workerDispatch.error ?? "worker_dispatch_failed",
        sourceJob: result.sourceJob,
        job: result.job,
        customerBalance: result.customerBalance,
        ledgerAction: result.ledgerAction ?? null,
        workerDispatch: result.workerDispatch,
        reused: result.reused === true,
        note: result.note
      }, { status: result.workerDispatch.status === "skipped" ? 503 : 502 });
    }
    return NextResponse.json({
      ok: true,
      sourceJob: result.sourceJob,
      job: result.job,
      customerBalance: result.customerBalance,
      ledgerAction: result.ledgerAction ?? null,
      workerDispatch: result.workerDispatch,
      reused: result.reused === true,
      note: result.note
    }, { status: result.reused ? 200 : 202 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_retry_failed" }, { status });
  }
}
