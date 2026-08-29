import crypto from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { AsyncJobRollingLimitError, createAsyncJob, getAsyncJobByIdempotency, type AsyncJobSnapshot } from "@/lib/async-jobs";
import { requireCustomerMutation } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  isVideoPromptOptimizationAspectRatio,
  isVideoPromptOptimizationDuration,
  isVideoPromptOptimizationResolution,
  VIDEO_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH,
  VIDEO_PROMPT_OPTIMIZATION_MAX_REFERENCES
} from "@/lib/video-prompt-optimization-contract";
import { isVideoPromptPersonaId } from "@/lib/video-prompt-personas";
import { optimizeVideoPrompt, type VideoPromptOptimizationResult } from "@/lib/video-prompt-optimizer";

const JOB_KIND = "video_prompt_optimization";
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUOTA_MAX_JOBS = 10;

type RequestBody = {
  customerId?: unknown;
  prompt?: unknown;
  personaId?: unknown;
  locale?: unknown;
  videoThemeId?: unknown;
  frameAssetIds?: unknown;
  durationSeconds?: unknown;
  aspectRatio?: unknown;
  resolution?: unknown;
};

function acceptedJob(job: AsyncJobSnapshot<VideoPromptOptimizationResult>) {
  return {
    ok: true,
    accepted: true,
    jobId: job.id,
    job: {
      id: job.id,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt
    }
  };
}

function badRequest(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST,OPTIONS" } });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const body = await request.json().catch(() => ({})) as RequestBody;
  const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
  if (!customerId) return badRequest("video_prompt_optimization_customer_required");

  const guard = await requireCustomerMutation(request, siteId, customerId, {
    rateLimit: RATE_LIMITS.videoPromptOptimizationBurst,
    key: `${siteId}:${customerId}:video-prompt-optimization`
  });
  if (!guard.ok) return guard.response;

  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) return badRequest("idempotency_key_required");
  if (idempotencyKey.length > 200) return badRequest("idempotency_key_invalid");

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  const locale = body.locale === "en" || body.locale === "es" ? body.locale : undefined;
  const personaId = typeof body.personaId === "string" && isVideoPromptPersonaId(body.personaId) ? body.personaId : undefined;
  const videoThemeId = typeof body.videoThemeId === "string" ? body.videoThemeId.trim() : "";
  const durationSeconds = Number(body.durationSeconds);
  const aspectRatio = typeof body.aspectRatio === "string" ? body.aspectRatio.trim() : "";
  const resolution = typeof body.resolution === "string" ? body.resolution.trim().toLowerCase() : "";
  const frameAssetIds = Array.isArray(body.frameAssetIds)
    ? Array.from(new Set(body.frameAssetIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0).map((value) => value.trim())))
    : undefined;

  if (!prompt) return badRequest("video_prompt_optimization_prompt_required");
  if (prompt.length > VIDEO_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH) return badRequest("video_prompt_optimization_prompt_too_long");
  if (!personaId) return badRequest("video_prompt_optimization_persona_invalid");
  if (!locale) return badRequest("video_prompt_optimization_locale_invalid");
  if (!videoThemeId) return badRequest("video_prompt_optimization_theme_required");
  if (!frameAssetIds || frameAssetIds.length > VIDEO_PROMPT_OPTIMIZATION_MAX_REFERENCES) return badRequest("video_prompt_optimization_reference_count_invalid");
  if (!isVideoPromptOptimizationDuration(durationSeconds)) return badRequest("video_prompt_optimization_duration_invalid");
  if (!isVideoPromptOptimizationAspectRatio(aspectRatio)) return badRequest("video_prompt_optimization_aspect_ratio_invalid");
  if (!isVideoPromptOptimizationResolution(resolution)) return badRequest("video_prompt_optimization_resolution_invalid");

  const promptHash = crypto.createHash("sha256").update(prompt).digest("hex");
  const requestFingerprint = crypto.createHash("sha256").update(JSON.stringify({
    siteId,
    customerId,
    promptHash,
    personaId,
    locale,
    videoThemeId,
    frameAssetIds,
    durationSeconds,
    aspectRatio,
    resolution
  })).digest("hex");
  const scopedIdempotencyKey = `${siteId}:${customerId}:${idempotencyKey}`;
  const existingJob = await getAsyncJobByIdempotency({
    kind: JOB_KIND,
    actorId: customerId,
    idempotencyKey: scopedIdempotencyKey
  });
  if (existingJob) {
    if (existingJob.metadata.requestFingerprint !== requestFingerprint) {
      return NextResponse.json({ ok: false, error: "idempotency_key_conflict" }, { status: 409 });
    }
    return NextResponse.json(acceptedJob(existingJob as AsyncJobSnapshot<VideoPromptOptimizationResult>), { status: 202 });
  }

  const [theme, ownedAssetCount] = await Promise.all([
    prisma.videoTheme.findFirst({
      where: { id: videoThemeId, siteId, status: "active" },
      select: { id: true, name: true, category: { select: { label: true } } }
    }),
    frameAssetIds.length
      ? prisma.assetUpload.count({
          where: { id: { in: frameAssetIds }, siteId, customerId, deletedAt: null }
        })
      : Promise.resolve(0)
  ]);
  if (!theme) return NextResponse.json({ ok: false, error: "video_prompt_optimization_theme_not_found" }, { status: 404 });
  if (ownedAssetCount !== frameAssetIds.length) return badRequest("video_prompt_optimization_frame_asset_invalid");

  try {
    const job = await createAsyncJob<VideoPromptOptimizationResult>({
      kind: JOB_KIND,
      actorId: customerId,
      idempotencyKey: scopedIdempotencyKey,
      ttlMs: QUOTA_WINDOW_MS,
      rollingLimit: {
        windowMs: QUOTA_WINDOW_MS,
        maxJobs: QUOTA_MAX_JOBS,
        statuses: ["queued", "running", "succeeded"]
      },
      metadata: {
        siteId,
        customerId,
        requestFingerprint,
        sourceHash: promptHash,
        sourceLength: prompt.length,
        personaId,
        locale,
        videoThemeId: theme.id,
        mode: frameAssetIds.length > 0 ? "image_to_video" : "text_to_video",
        referenceCount: frameAssetIds.length,
        durationSeconds,
        aspectRatio,
        resolution
      },
      run: () => optimizeVideoPrompt({
        sourcePrompt: prompt,
        personaId,
        locale,
        theme: { id: theme.id, name: theme.name, category: theme.category?.label },
        mode: frameAssetIds.length > 0 ? "image_to_video" : "text_to_video",
        referenceCount: frameAssetIds.length,
        durationSeconds,
        aspectRatio,
        resolution
      })
    });
    if (job.metadata.requestFingerprint !== requestFingerprint) {
      return NextResponse.json({ ok: false, error: "idempotency_key_conflict" }, { status: 409 });
    }
    return NextResponse.json(acceptedJob(job), { status: 202 });
  } catch (error) {
    if (error instanceof AsyncJobRollingLimitError) {
      return NextResponse.json(
        { ok: false, error: "video_prompt_optimization_limit_reached", retryAfter: error.retryAfterSeconds },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    const message = error instanceof Error ? error.message : "video_prompt_optimization_create_failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
