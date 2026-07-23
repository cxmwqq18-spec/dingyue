import { NextRequest, NextResponse } from "next/server";
import { submitGenerationJob } from "@/lib/generation-submit";
import { RATE_LIMITS, checkRateLimitOrResponse } from "@/lib/security/rate-limit";
import { publicUrlForRequest } from "@/lib/session";
import { StoreError } from "@/lib/server-store";
import { requireSiteApiKey } from "@/lib/site-api-keys";
import { isLoopbackBaseUrl, resolveWorkerBaseUrls } from "@/lib/worker";

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function isVideoJobRequest(body: { aiAppSlug?: string; params?: Record<string, unknown> }) {
  const requestParams = body.params ?? {};
  const fields = recordValue(requestParams.fields);
  return body.aiAppSlug === "video_generator" ||
    requestParams.mode === "video" ||
    requestParams.outputType === "video" ||
    typeof requestParams.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function requestAssetIds(body: { aiAppSlug?: string; params?: Record<string, unknown> & { assetIds?: unknown } }): string[] {
  const requestParams = body.params ?? {};
  const fields = recordValue(requestParams.fields);
  return Array.from(new Set([
    ...stringArray(requestParams.assetIds),
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
  const auth = await requireSiteApiKey(request, { siteId, scope: "generation:create" });
  if ("response" in auth) return auth.response;
  const limited = checkRateLimitOrResponse(request, RATE_LIMITS.generation, `${siteId}:external:${auth.apiKey.id}:jobs`);
  if (!limited.allowed) return limited.response;

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return NextResponse.json({ error: "idempotency_key_required" }, { status: 400 });

  const body = (await request.json().catch(() => ({}))) as {
    customerId?: string;
    aiAppSlug?: string;
    params?: Record<string, unknown>;
  };
  if (!body.customerId || !body.aiAppSlug) {
    return NextResponse.json({ error: "missing_customer_or_ai_app" }, { status: 400 });
  }
  const workerBaseUrls = resolveWorkerBaseUrls(publicUrlForRequest(request, "/").origin);
  const assetIds = requestAssetIds(body);
  if (shouldRequireProviderReachableVideoFrames() && isVideoJobRequest(body) && assetIds.length > 0 && isLoopbackBaseUrl(workerBaseUrls.publicBaseUrl)) {
    return NextResponse.json({ error: "video_public_asset_url_required" }, { status: 400 });
  }

  try {
    const result = await submitGenerationJob({
      siteId,
      customerId: body.customerId,
      aiAppSlug: body.aiAppSlug,
      params: {
        ...(body.params ?? {}),
        assetIds
      },
      entryPoint: "external_api",
      idempotencyKey,
      authContext: { kind: "external_api", apiKeyId: auth.apiKey.id, scopes: auth.apiKey.scopes },
      baseUrls: workerBaseUrls,
      includeWorkerPayload: false
    });
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        error: result.workerDispatch.error ?? "worker_dispatch_failed",
        job: result.job,
        customerBalance: result.customerBalance,
        workerDispatch: result.workerDispatch,
        note: result.note
      }, { status: result.workerDispatch.status === "skipped" ? 503 : 502 });
    }
    return NextResponse.json({
      ok: true,
      job: result.job,
      customerBalance: result.customerBalance,
      ledgerAction: result.ledgerAction ?? null,
      workerDispatch: result.workerDispatch,
      reused: result.reused === true,
      note: result.note
    }, { status: result.reused ? 200 : 202 });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "external_generation_create_failed" }, { status });
  }
}
