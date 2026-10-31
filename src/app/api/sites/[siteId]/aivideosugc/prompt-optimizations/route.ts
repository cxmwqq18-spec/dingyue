import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AsyncJobRollingLimitError, createAsyncJob, getAsyncJobByIdempotency, type AsyncJobSnapshot } from "@/lib/async-jobs";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, jsonBody } from "@/lib/aidreamcapes-workspace/api";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { getCustomerAssetRelational, readCustomerAssetFileByStorageKey } from "@/lib/stores/asset-store";
import {
  optimizeWan30VideoPrompt,
  WAN30_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH,
  WAN30_PROMPT_OPTIMIZATION_MAX_REFERENCES,
  type Wan30PromptOptimizationInput,
  type Wan30PromptOptimizationResult
} from "@/lib/wan30-video-prompt-optimizer";
import { isWan30VideoTypeId } from "@/lib/wan30-video-prompt-types";

const JOB_KIND = "wan30_video_prompt_optimization";
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUOTA_MAX_JOBS = 10;
const MAX_REFERENCE_IMAGE_BYTES = 8 * 1024 * 1024;
const REFERENCE_IMAGE_MIME_PREFIX = "image/";

type RequestBody = {
  prompt?: unknown;
  videoTypeId?: unknown;
  durationSeconds?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
  referenceUrls?: unknown;
  productBrief?: unknown;
};

/** 确认过的产品简介：标题/描述/价格/规格，作为优化器的事实锚点。 */
function parseProductBrief(value: unknown): Wan30PromptOptimizationInput["productBrief"] {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("wan30_prompt_optimization_product_brief_invalid", 400);
  const record = value as Record<string, unknown>;
  const text = (input: unknown, max: number, code: string): string | undefined => {
    if (input === undefined || input === null) return undefined;
    if (typeof input !== "string" || input.length > max) throw new WorkspaceError(code, 400);
    return input.trim() || undefined;
  };
  let price: { amount: string; currency?: string } | undefined;
  if (record.price !== undefined && record.price !== null) {
    if (typeof record.price !== "object" || Array.isArray(record.price)) throw new WorkspaceError("wan30_prompt_optimization_product_brief_invalid", 400);
    const raw = record.price as Record<string, unknown>;
    if (typeof raw.amount !== "string" || !/^(?:0|[1-9]\d{0,8})(?:\.\d{1,4})?$/.test(raw.amount)) throw new WorkspaceError("wan30_prompt_optimization_product_brief_invalid", 400);
    price = { amount: raw.amount, ...(typeof raw.currency === "string" && /^[A-Z]{3}$/.test(raw.currency) ? { currency: raw.currency } : {}) };
  }
  let variants: string[] | undefined;
  if (record.variants !== undefined && record.variants !== null) {
    if (!Array.isArray(record.variants) || record.variants.length > 24 || record.variants.some((entry) => typeof entry !== "string" || entry.length > 120)) {
      throw new WorkspaceError("wan30_prompt_optimization_product_brief_invalid", 400);
    }
    variants = record.variants.map((entry) => (entry as string).trim()).filter(Boolean);
  }
  const brief: NonNullable<Wan30PromptOptimizationInput["productBrief"]> = {
    ...(text(record.title, 200, "wan30_prompt_optimization_product_brief_invalid") ? { title: text(record.title, 200, "wan30_prompt_optimization_product_brief_invalid") } : {}),
    ...(text(record.description, 800, "wan30_prompt_optimization_product_brief_invalid") ? { description: text(record.description, 800, "wan30_prompt_optimization_product_brief_invalid") } : {}),
    ...(price ? { price } : {}),
    ...(variants?.length ? { variants } : {})
  };
  return Object.keys(brief).length ? brief : undefined;
}

/** 工作台作曲家的参考图下载路径 → 校验归属并解析 assetId。 */
function parseOwnedReferenceAssetIds(value: unknown, siteId: string, customerId: string): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new WorkspaceError("wan30_prompt_optimization_reference_invalid", 400);
  const urls = value.map((item) => typeof item === "string" ? item.trim() : "");
  if (urls.length > WAN30_PROMPT_OPTIMIZATION_MAX_REFERENCES) throw new WorkspaceError("wan30_prompt_optimization_reference_count_invalid", 400);
  const prefix = `/api/sites/${siteId}/customers/${customerId}/assets/`;
  return urls.map((url) => {
    const path = url.startsWith("http") ? (() => { try { return new URL(url).pathname; } catch { return ""; } })() : url;
    if (!path.startsWith(prefix) || !path.endsWith("/download")) throw new WorkspaceError("wan30_prompt_optimization_reference_invalid", 400);
    const assetId = path.slice(prefix.length, -"/download".length);
    if (!assetId || assetId.includes("/")) throw new WorkspaceError("wan30_prompt_optimization_reference_invalid", 400);
    return assetId;
  });
}

async function loadReferenceDataUris(assetIds: string[], siteId: string, customerId: string): Promise<string[]> {
  const dataUris: string[] = [];
  for (const assetId of assetIds) {
    const { asset } = await getCustomerAssetRelational({ siteId, customerId, assetId });
    const mimeType = (asset.mimeType || "").toLowerCase();
    if (!mimeType.startsWith(REFERENCE_IMAGE_MIME_PREFIX) || !/image\/(?:jpeg|png|webp)/.test(mimeType)) {
      throw new WorkspaceError("wan30_prompt_optimization_reference_image_invalid", 400);
    }
    const result = await readCustomerAssetFileByStorageKey({ siteId, customerId, asset });
    if (result.bytes.length > MAX_REFERENCE_IMAGE_BYTES) throw new WorkspaceError("wan30_prompt_optimization_reference_too_large", 413);
    dataUris.push(`data:${mimeType};base64,${result.bytes.toString("base64")}`);
  }
  return dataUris;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST,OPTIONS" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;
    const body = await jsonBody(request) as RequestBody;

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) throw new WorkspaceError("wan30_prompt_optimization_prompt_required", 400);
    if (prompt.length > WAN30_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH) throw new WorkspaceError("wan30_prompt_optimization_prompt_too_long", 400);
    const videoTypeId = body.videoTypeId;
    if (!isWan30VideoTypeId(videoTypeId)) throw new WorkspaceError("wan30_prompt_optimization_video_type_invalid", 400);
    const durationSeconds = Number(body.durationSeconds);
    const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "";
    const resolution = typeof body.resolution === "string" ? body.resolution.trim() : "";
    const referenceAssetIds = parseOwnedReferenceAssetIds(body.referenceUrls, siteId, customerId);
    const productBrief = parseProductBrief(body.productBrief);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) throw new WorkspaceError("idempotency_key_required", 400);
    if (idempotencyKey.length > 200) throw new WorkspaceError("idempotency_key_invalid", 400);

    const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");
    const requestFingerprint = crypto.createHash("sha256").update(JSON.stringify({
      siteId, customerId, promptHash, videoTypeId, durationSeconds, aspectRatio, resolution, referenceAssetIds, productBrief
    })).digest("hex");
    const scopedIdempotencyKey = `${siteId}:${customerId}:wan30-prompt:${idempotencyKey}`;
    const existingJob = await getAsyncJobByIdempotency({ kind: JOB_KIND, actorId: customerId, idempotencyKey: scopedIdempotencyKey });
    if (existingJob) {
      if (existingJob.metadata.requestFingerprint !== requestFingerprint) {
        return NextResponse.json({ ok: false, error: "idempotency_key_conflict" }, { status: 409 });
      }
      return NextResponse.json({ ok: true, accepted: true, jobId: existingJob.id, job: jobView(existingJob as AsyncJobSnapshot<Wan30PromptOptimizationResult>) }, { status: 202 });
    }

    // 参考图在入库前完成归属校验与字节读取（data URI 传给视觉模型）。
    const referenceImages = await loadReferenceDataUris(referenceAssetIds, siteId, customerId);

    try {
      const job = await createAsyncJob<Wan30PromptOptimizationResult>({
        kind: JOB_KIND,
        actorId: customerId,
        idempotencyKey: scopedIdempotencyKey,
        ttlMs: QUOTA_WINDOW_MS,
        rollingLimit: { windowMs: QUOTA_WINDOW_MS, maxJobs: QUOTA_MAX_JOBS, statuses: ["queued", "running", "succeeded"] },
        metadata: {
          siteId,
          customerId,
          requestFingerprint,
          sourceHash: promptHash,
          sourceLength: prompt.length,
          videoTypeId,
          durationSeconds,
          aspectRatio,
          resolution,
          referenceCount: referenceImages.length
        },
        run: () => optimizeWan30VideoPrompt({
          sourcePrompt: prompt,
          videoTypeId,
          durationSeconds,
          aspectRatio,
          resolution,
          referenceImages,
          productBrief
        })
      });
      if (job.metadata.requestFingerprint !== requestFingerprint) {
        return NextResponse.json({ ok: false, error: "idempotency_key_conflict" }, { status: 409 });
      }
      return NextResponse.json({ ok: true, accepted: true, jobId: job.id, job: jobView(job as AsyncJobSnapshot<Wan30PromptOptimizationResult>) }, { status: 202 });
    } catch (error) {
      if (error instanceof AsyncJobRollingLimitError) {
        return NextResponse.json(
          { ok: false, error: "wan30_prompt_optimization_limit_reached", retryAfter: error.retryAfterSeconds },
          { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
        );
      }
      throw error;
    }
  } catch (error) { return workspaceFailure(error); }
}

function jobView(job: AsyncJobSnapshot<Wan30PromptOptimizationResult>) {
  return {
    id: job.id,
    status: job.status,
    result: job.result,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  };
}

export const dynamic = "force-dynamic";
