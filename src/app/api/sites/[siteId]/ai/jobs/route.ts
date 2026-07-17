import { NextResponse } from "next/server";
import { requireCustomerMutation } from "@/lib/api-auth";
import { getCustomerAdminAccessForSite } from "@/lib/customer-admin-access";
import { StoreError } from "@/lib/server-store";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { publicUrlForRequest } from "@/lib/session";
import { createGenerationJobRelational, settleGenerationJobRelational } from "@/lib/stores/job-store";
import { buildWorkerPayload, dispatchWorkerPayload, isLoopbackBaseUrl, resolveWorkerBaseUrls } from "@/lib/worker";
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

function isVideoJobRequest(body: { aiAppSlug?: string; params?: Record<string, unknown> }) {
  const params = body.params ?? {};
  const fields = params.fields && typeof params.fields === "object" && !Array.isArray(params.fields)
    ? params.fields as Record<string, unknown>
    : {};
  return body.aiAppSlug === "video_generator" ||
    params.mode === "video" ||
    params.outputType === "video" ||
    typeof params.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function requestAssetIds(body: { aiAppSlug?: string; params?: Record<string, unknown> & { assetIds?: unknown } }): string[] {
  const params = body.params ?? {};
  const fields = recordValue(params.fields);
  return Array.from(new Set([
    ...stringArray(params.assetIds),
    ...(isVideoJobRequest(body) ? stringArray(fields.frameAssetIds) : [])
  ]));
}

function shouldRequireProviderReachableVideoFrames() {
  if (process.env.ALLOW_LOOPBACK_VIDEO_FRAME_URLS === "1") return false;
  if (process.env.REQUIRE_PUBLIC_VIDEO_FRAME_URLS === "1") return true;
  return process.env.NODE_ENV === "production";
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
  const workerBaseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
  const assetIds = requestAssetIds(body);
  if (shouldRequireProviderReachableVideoFrames() && isVideoJobRequest(body) && assetIds.length > 0 && isLoopbackBaseUrl(workerBaseUrls.publicBaseUrl)) {
    return NextResponse.json({ error: "video_public_asset_url_required" }, { status: 400 });
  }
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
        assetIds,
        creativePackId: typeof body.params?.creativePackId === "string" ? body.params.creativePackId : undefined,
        customerModelId: typeof body.params?.customerModelId === "string" ? body.params.customerModelId : undefined
      }
    });
    const workerPayload = await buildWorkerPayload({ job, siteAiApp, baseUrls: workerBaseUrls });
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
