import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { StoreError } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createGenerationJobRelational, settleGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload } from "@/lib/worker";
import type { NextRequest } from "next/server";

export async function HEAD() {
  return new Response(null, { status: 200 });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { Allow: "HEAD,POST,OPTIONS" }
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    aiAppSlug?: string;
    params?: Record<string, unknown> & { assetIds?: unknown };
  };
  if (!body.customerId || !body.aiAppSlug) {
    return NextResponse.json({ error: "missing_customer_or_ai_app" }, { status: 400 });
  }
  const guard = await requireCustomerMutation(request, siteId, body.customerId, { rateLimit: RATE_LIMITS.generation, key: `${siteId}:${body.customerId}:jobs` });
  if (!guard.ok) return guard.response;
  const baseUrl = new URL(request.url).origin;
  try {
    const adminAccess = await getCustomerAdminAccessForSite({ siteId, customer: guard.current.customer });
    const { job, siteAiApp, ledger, customer } = await createGenerationJobRelational({
      siteId,
      customerId: body.customerId,
      aiAppSlug: body.aiAppSlug,
      subscriptionBypass: adminAccess.canBypassBilling
        ? { enabled: true, reason: "site_admin", siteAdminId: adminAccess.siteAdminId }
        : undefined,
      requestJson: {
        ...(body.params ?? {}),
        assetIds: Array.isArray(body.params?.assetIds) ? body.params.assetIds.filter((item): item is string => typeof item === "string") : [],
        creativePackId: typeof body.params?.creativePackId === "string" ? body.params.creativePackId : undefined,
        customerModelId: typeof body.params?.customerModelId === "string" ? body.params.customerModelId : undefined
      }
    });
    const workerPayload = await buildWorkerPayload({ job, siteAiApp, baseUrl });
    const shouldSkipWorkerDispatch = process.env.NODE_ENV !== "production" && request.headers.get("x-smoke-skip-worker-dispatch") === "1";
    const workerDispatch = shouldSkipWorkerDispatch
      ? { status: "skipped" as const }
      : await dispatchWorkerPayload(workerPayload);
    if (!shouldSkipWorkerDispatch && workerDispatch.status !== "sent") {
      const settled = await settleGenerationJobRelational({
        jobId: job.id,
        siteId,
        requestId: workerPayload.requestId,
        status: "failed",
        error: workerDispatch.error ?? "worker_dispatch_failed"
      });
      return NextResponse.json({
        ok: false,
        error: workerDispatch.error ?? "worker_dispatch_failed",
        job: settled.job,
        customer: settled.customer,
        customerBalance: settled.customer.balance,
        workerDispatch,
        note: "Worker dispatch was not accepted. The job was failed and reserved credits were released."
      }, { status: workerDispatch.status === "skipped" ? 503 : 502 });
    }
    return NextResponse.json({
      ok: true,
      job,
      customer,
      customerBalance: customer.balance,
      adminAccess,
      ledgerAction: ledger ?? null,
      workerPayload,
      workerDispatch,
      note: workerDispatch.status === "skipped"
        ? adminAccess.canBypassBilling
          ? "Persisted admin job and reserved credits. Worker dispatch is not configured."
          : "Persisted job and reserved credits. Worker dispatch is not configured."
        : adminAccess.canBypassBilling
          ? "Persisted admin job, reserved credits, and attempted worker dispatch."
          : "Persisted job, reserved credits, and attempted worker dispatch."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "job_create_failed" }, { status });
  }
}
