import { NextRequest, NextResponse } from "next/server";
import { aiProviderStatus, assertValidAiProviderUrl, testAiProviderConnection } from "@/lib/ai-provider-config";
import { getCurrentPlatformAdmin, requirePlatformMutation } from "@/lib/api-auth";
import { createAsyncJob, toAsyncJobAcceptedPayload } from "@/lib/async-jobs";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { StoreError } from "@/lib/server-store";
import {
  deletePlatformAiProviderRelational,
  getPlatformAiProviderRelational,
  listPlatformAiProvidersRelational,
  setCurrentPlatformAiProviderRelational,
  setPlatformAiProviderEnabledRelational,
  upsertPlatformAiProviderRelational
} from "@/lib/stores/platform-store";
import type { PlatformAiProvider } from "@/lib/types";
import { inferPlatformAiProviderType, normalizePlatformAiProviderType, platformAiProviderTypes, type PlatformAiProviderType } from "@/lib/ai-provider-type";
import { normalizeAiProviderProtocol } from "@/lib/video-provider-family";

const defaultModelTypes = [
  "gpt-image-2",
  "gpt-5.5",
  "grok-video-3-pro",
  "grok-video-3-max",
  "seedance-2-0-special",
  "grok-imagine-video-special",
  "grok-imagine-1.5-special",
  "grok-imagine-video",
  "grok-imagine-1.5",
  "grok-imagine-video-1.5-preview",
  "grok-imagine-video-1.5",
  "veo-3-1-manju-special",
  "veo-4-omni-manju-special",
  "veo-4-omni",
  "veo-3.1",
  "veo-4-omni-v2v",
  "grok-video-3.5-1015"
];

async function requirePlatformRead() {
  const current = await getCurrentPlatformAdmin();
  if (!current) return { ok: false as const, response: NextResponse.json({ error: "platform_login_required" }, { status: 401 }) };
  return { ok: true as const, current };
}

async function payload(extra: Record<string, unknown> = {}) {
  const providers = await listPlatformAiProvidersRelational();
  const enabledProviders = providers.filter((provider) => provider.enabled);
  const currentProviderIds = Object.fromEntries(platformAiProviderTypes.map((providerType) => {
    const typed = enabledProviders.filter((provider) => provider.providerType === providerType);
    const current = typed[0];
    return [providerType, current?.id ?? ""];
  })) as Record<PlatformAiProviderType, string>;
  const current = enabledProviders.find((provider) => provider.id === currentProviderIds.image) ?? enabledProviders[0];
  const summaryForType = (providerType: PlatformAiProviderType) => {
    const typed = providers.filter((provider) => provider.providerType === providerType);
    const enabledTyped = typed.filter((provider) => provider.enabled);
    const currentTyped = enabledTyped.find((provider) => provider.id === currentProviderIds[providerType]);
    return {
      totalProviders: typed.length,
      enabledProviders: enabledTyped.length,
      configuredProviders: typed.filter((provider) => aiProviderStatus(provider).configured).length,
      runnableProviders: typed.filter((provider) => aiProviderStatus(provider).runnable).length,
      currentProviderId: currentTyped?.id ?? "",
      currentConfigured: aiProviderStatus(currentTyped).runnable
    };
  };
  return {
    ok: true,
    currentProviderId: current?.id ?? "",
    currentProviderIds,
    modelTypes: Array.from(new Set([...defaultModelTypes, ...providers.map((provider) => provider.modelType).filter(Boolean)])),
    providers: providers.map((provider) => ({
      id: provider.id,
      label: provider.label,
      aiUrl: provider.aiUrl,
      modelType: provider.modelType,
      providerType: provider.providerType,
      priority: provider.priority,
      preferred: provider.preferred,
      enabled: provider.enabled,
      supportsGenerationN: provider.supportsGenerationN,
      supportsEditN: provider.supportsEditN,
      maxImagesPerRequest: provider.maxImagesPerRequest,
      imageAspectRatio: provider.imageAspectRatio,
      imageResolution: provider.imageResolution,
      imageQuality: provider.imageQuality,
      imageOutputFormat: provider.imageOutputFormat,
      apiProtocol: provider.apiProtocol,
      videoModelFamily: provider.videoModelFamily,
      videoDurations: provider.videoDurations,
      videoAspectRatios: provider.videoAspectRatios,
      videoNativeSpeech: provider.videoNativeSpeech,
      priceEnabled: provider.priceEnabled,
      priceCredits: provider.priceCredits,
      priceVideoDurations: provider.priceVideoDurations,
      priceVideoResolutions: provider.priceVideoResolutions,
      priceImageQualities: provider.priceImageQualities,
      priceImageResolutions: provider.priceImageResolutions,
      priceImageInput: provider.priceImageInput,
      priceVideoInput: provider.priceVideoInput,
      priceVideoInputPerSecond: provider.priceVideoInputPerSecond,
      priceAudioInput: provider.priceAudioInput,
      priceAudioInputPerSecond: provider.priceAudioInputPerSecond,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      updatedBy: provider.updatedBy,
      isCurrent: provider.id === currentProviderIds[provider.providerType],
      status: aiProviderStatus(provider)
    })),
    summary: {
      totalProviders: providers.length,
      enabledProviders: enabledProviders.length,
      configuredProviders: providers.filter((provider) => aiProviderStatus(provider).configured).length,
      runnableProviders: providers.filter((provider) => aiProviderStatus(provider).runnable).length,
      currentConfigured: aiProviderStatus(current).runnable,
      byType: Object.fromEntries(platformAiProviderTypes.map((providerType) => [providerType, summaryForType(providerType)]))
    },
    ...extra
  };
}

async function providerFromBody(body: { id?: string; aiUrl?: string; apiKey?: string; modelType?: string; providerType?: string; apiProtocol?: string }): Promise<Pick<PlatformAiProvider, "aiUrl" | "apiKey" | "modelType" | "providerType" | "apiProtocol">> {
  const existing = await getPlatformAiProviderRelational(body.id);
  if (!body.aiUrl?.trim()) throw new Error("missing_ai_provider_url");
  return {
    aiUrl: body.aiUrl,
    apiKey: body.apiKey?.trim() || existing?.apiKey || undefined,
    modelType: body.modelType?.trim() || existing?.modelType || "",
    providerType: normalizePlatformAiProviderType(body.providerType, existing?.providerType ?? "image"),
    apiProtocol: normalizeAiProviderProtocol(body.apiProtocol ?? existing?.apiProtocol)
  };
}

export async function GET() {
  const permission = await requirePlatformRead();
  if (!permission.ok) return permission.response;
  return NextResponse.json(await payload());
}

export async function PUT(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    label?: string;
    aiUrl?: string;
    apiKey?: string;
    modelType?: string;
    providerType?: string;
    makeCurrent?: boolean;
    enabled?: boolean;
    supportsGenerationN?: boolean;
    supportsEditN?: boolean;
    maxImagesPerRequest?: number;
    imageAspectRatio?: string;
    imageResolution?: string;
    imageQuality?: string;
    imageOutputFormat?: string;
    apiProtocol?: string;
    videoModelFamily?: string;
    videoDurations?: number[];
    videoAspectRatios?: string[];
    videoNativeSpeech?: boolean | null;
    priceEnabled?: boolean;
    priceCredits?: number;
    priceVideoDurations?: unknown;
    priceVideoResolutions?: unknown;
    priceImageQualities?: unknown;
    priceImageResolutions?: unknown;
    priceImageInput?: number;
    priceVideoInput?: number;
    priceVideoInputPerSecond?: number;
    priceAudioInput?: number;
    priceAudioInputPerSecond?: number;
    priority?: unknown;
  };
  if (!body.label?.trim()) return NextResponse.json({ error: "missing_ai_provider_label" }, { status: 400 });
  if (!body.id && !body.aiUrl?.trim()) return NextResponse.json({ error: "missing_ai_provider_url" }, { status: 400 });
  if (!body.modelType?.trim()) return NextResponse.json({ error: "missing_ai_provider_model_type" }, { status: 400 });
  if (body.apiProtocol !== undefined && normalizeAiProviderProtocol(body.apiProtocol) !== body.apiProtocol) return NextResponse.json({ error: "invalid_ai_provider_protocol" }, { status: 400 });
  const existing = body.id && body.providerType === undefined ? await getPlatformAiProviderRelational(body.id) : undefined;
  const providerType = normalizePlatformAiProviderType(body.providerType, existing?.providerType ?? inferPlatformAiProviderType({ label: body.label, aiUrl: body.aiUrl, modelType: body.modelType }));
  const allowedProtocols = providerType === "video"
    ? ["auto", "lk888-media", "openai-videos", "huitu-openapi", "tokengo-media"]
    : providerType === "image"
      ? ["auto", "tokengo-image", "openai-compatible"]
      : ["auto", "openai-compatible"];
  if (body.apiProtocol !== undefined && !allowedProtocols.includes(body.apiProtocol)) return NextResponse.json({ error: "invalid_ai_provider_protocol_for_type" }, { status: 400 });
  if (body.videoModelFamily !== undefined && !["auto", "grok", "gemini"].includes(body.videoModelFamily)) return NextResponse.json({ error: "invalid_ai_provider_model_family" }, { status: 400 });
  if (body.videoDurations !== undefined && (!Array.isArray(body.videoDurations) || !body.videoDurations.length || body.videoDurations.some((value) => ![6, 10, 15].includes(Number(value))))) return NextResponse.json({ error: "invalid_ai_provider_video_durations" }, { status: 400 });
  if (body.videoAspectRatios !== undefined && (!Array.isArray(body.videoAspectRatios) || !body.videoAspectRatios.length || body.videoAspectRatios.some((value) => !["9:16", "1:1", "16:9"].includes(value)))) return NextResponse.json({ error: "invalid_ai_provider_video_aspects" }, { status: 400 });
  if (body.videoNativeSpeech !== undefined && body.videoNativeSpeech !== null && typeof body.videoNativeSpeech !== "boolean") return NextResponse.json({ error: "invalid_ai_provider_native_speech" }, { status: 400 });
  if (body.priority !== undefined) {
    const priority = Number(body.priority);
    if (!Number.isFinite(priority) || !Number.isInteger(priority) || priority < 0) {
      return NextResponse.json({ error: "invalid_ai_provider_priority" }, { status: 400 });
    }
  }
  if (body.aiUrl?.trim()) {
    try {
      assertValidAiProviderUrl(body.aiUrl);
    } catch {
      return NextResponse.json({ error: "invalid_ai_provider_url" }, { status: 400 });
    }
  }

  await upsertPlatformAiProviderRelational({
    id: body.id,
    label: body.label,
    aiUrl: body.aiUrl ?? "",
    apiKey: body.apiKey,
    modelType: body.modelType,
    providerType,
    makeCurrent: body.makeCurrent,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    supportsGenerationN: Boolean(body.supportsGenerationN),
    supportsEditN: Boolean(body.supportsEditN),
    maxImagesPerRequest: body.maxImagesPerRequest,
    imageAspectRatio: body.imageAspectRatio,
    imageResolution: body.imageResolution,
    imageQuality: body.imageQuality,
    imageOutputFormat: body.imageOutputFormat,
    apiProtocol: body.apiProtocol,
    videoModelFamily: body.videoModelFamily,
    videoDurations: body.videoDurations,
    videoAspectRatios: body.videoAspectRatios,
    videoNativeSpeech: body.videoNativeSpeech,
    priceEnabled: body.priceEnabled,
    priceCredits: body.priceCredits,
    priceVideoDurations: body.priceVideoDurations,
    priceVideoResolutions: body.priceVideoResolutions,
    priceImageQualities: body.priceImageQualities,
    priceImageResolutions: body.priceImageResolutions,
    priceImageInput: body.priceImageInput,
    priceVideoInput: body.priceVideoInput,
    priceVideoInputPerSecond: body.priceVideoInputPerSecond,
    priceAudioInput: body.priceAudioInput,
    priceAudioInputPerSecond: body.priceAudioInputPerSecond,
    priority: body.priority,
    actor: permission.current.platformAdmin.id
  });
  return NextResponse.json(await payload());
}

export async function POST(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as {
    action?: "current" | "test" | "enabled" | "reveal";
    providerId?: string;
    enabled?: boolean;
    id?: string;
    aiUrl?: string;
    apiKey?: string;
    modelType?: string;
    providerType?: string;
    apiProtocol?: string;
  };
  try {
    if (body.action === "reveal") {
      const providerId = body.providerId?.trim() || body.id?.trim();
      if (!providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });
      const provider = await getPlatformAiProviderRelational(providerId);
      if (!provider) return NextResponse.json({ error: "ai_provider_not_found" }, { status: 404 });
      const status = aiProviderStatus(provider);
      return NextResponse.json({
        ok: true,
        providerId: provider.id,
        apiKey: provider.apiKey ?? "",
        apiKeyPreview: status.apiKeyPreview
      });
    }
    if (body.action === "test") {
      const provider = await providerFromBody(body);
      const job = await createAsyncJob({
        kind: "ai_provider_test",
        actorId: permission.current.platformAdmin.id,
        metadata: {
          providerId: body.providerId ?? body.id ?? "",
          aiUrl: provider.aiUrl,
          hasApiKey: Boolean(provider.apiKey)
        },
        ttlMs: 10 * 60 * 1000,
        run: async () => testAiProviderConnection(provider)
      });
      return NextResponse.json(toAsyncJobAcceptedPayload(job), { status: 202 });
    }
    if (!body.providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });
    if (body.action === "enabled") {
      await setPlatformAiProviderEnabledRelational({
        providerId: body.providerId,
        enabled: body.enabled !== false,
        actor: permission.current.platformAdmin.id
      });
      return NextResponse.json(await payload());
    }
    await setCurrentPlatformAiProviderRelational({ providerId: body.providerId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ai_provider_action_failed" }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  const permission = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], rateLimit: RATE_LIMITS.adminProviderConfig });
  if (!permission.ok) return permission.response;

  const body = (await request.json().catch(() => ({}))) as { providerId?: string };
  const providerId = body.providerId?.trim() || new URL(request.url).searchParams.get("providerId")?.trim();
  if (!providerId) return NextResponse.json({ error: "missing_ai_provider" }, { status: 400 });

  try {
    await deletePlatformAiProviderRelational({ providerId, actor: permission.current.platformAdmin.id });
    return NextResponse.json(await payload());
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "ai_provider_delete_failed" }, { status });
  }
}
