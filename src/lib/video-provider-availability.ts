import "server-only";
import { isVideoProviderModel } from "@/lib/video-provider-limits";
import { videoProviderModelFamiliesForProviders, videoProviderProtocolForBaseUrl } from "@/lib/video-provider-family";
import type { VideoModelFamily } from "@/lib/video-frame-config";

export type VideoProviderAvailabilityReason =
  | "ai_provider_disabled"
  | "ai_provider_url_missing"
  | "ai_provider_api_key_missing"
  | "ai_provider_not_video_model"
  | "ai_provider_video_content_unverified_smartpicklid"
  | "ai_provider_video_content_unverified_magic666"
  | "ai_provider_video_reference_channel_unreliable_smartpicklid"
  | "ai_provider_video_first_frame_required_lk888_media"
  | "ai_provider_video_reference_required_huitu"
  | "ai_provider_video_channel_disabled_aivideosugc_wan1080";

export type VideoProviderAvailabilityInput = {
  id?: string;
  label?: string;
  aiUrl?: string | null;
  apiKey?: string | null;
  modelType?: string | null;
  providerType?: string | null;
  apiProtocol?: string | null;
  videoModelFamily?: string | null;
  enabled?: boolean;
};

export type VideoProviderAvailabilityDiagnostic = {
  id?: string;
  label?: string;
  reason?: VideoProviderAvailabilityReason;
};

export function normalizeVideoProviderBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function isLk888MediaBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "api.lk888.ai" || hostname === "api.lk666.ai" || hostname === "api.lingkeai.ai";
  } catch {
    return false;
  }
}

export function isSmartPickLidBaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("smartpicklid");
  } catch {
    return false;
  }
}

export function isMagic666BaseUrl(baseUrl: string) {
  try {
    return new URL(baseUrl).hostname.toLowerCase().includes("magic666");
  } catch {
    return false;
  }
}

export function isGrokImagineVideoModel(model: string) {
  return model.trim().toLowerCase().includes("grok-imagine-video");
}

function envFlag(name: string): boolean | undefined {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === "1" || value === "true" || value === "yes" || value === "on") return true;
  if (value === "0" || value === "false" || value === "no" || value === "off") return false;
  return undefined;
}

export function shouldAllowMagic666VideoProvider() {
  return envFlag("AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO") === true;
}

export function shouldAllowSmartPickLidVideoProvider() {
  return envFlag("AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO") ?? true;
}

export function shouldAllowSmartPickLidReferenceVideo() {
  return envFlag("AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO") ?? true;
}

/** Kill switch for the aidreamcapes dedicated wan-1080p channel (local.video.grok):
 * set AI_WORKER_ALLOW_AIVIDEOSUGC_WAN1080_VIDEO=0 to refuse it at both the
 * submit-side availability check and the dispatch loop while a provider-side
 * incident is investigated. */
export function shouldAllowAivideosugcWan1080VideoProvider() {
  return envFlag("AI_WORKER_ALLOW_AIVIDEOSUGC_WAN1080_VIDEO") ?? true;
}

export function videoProviderAvailabilityReason(
  provider: VideoProviderAvailabilityInput,
  params: { referenceAssetCount: number }
): VideoProviderAvailabilityReason | undefined {
  const model = provider.modelType?.trim() ?? "";
  if (provider.providerType !== "video" && !isVideoProviderModel(model)) return "ai_provider_not_video_model";
  if (provider.enabled === false) return "ai_provider_disabled";
  if (provider.id === "aiprov_aivideosugc_wan1080" && !shouldAllowAivideosugcWan1080VideoProvider()) {
    return "ai_provider_video_channel_disabled_aivideosugc_wan1080";
  }
  if (!provider.aiUrl?.trim()) return "ai_provider_url_missing";
  if (!provider.apiKey?.trim()) return "ai_provider_api_key_missing";

  const baseUrl = normalizeVideoProviderBaseUrl(provider.aiUrl);
  const protocol = videoProviderProtocolForBaseUrl(baseUrl, provider.apiProtocol);
  if (isSmartPickLidBaseUrl(baseUrl) && !shouldAllowSmartPickLidVideoProvider()) {
    return "ai_provider_video_content_unverified_smartpicklid";
  }
  if (isMagic666BaseUrl(baseUrl) && !shouldAllowMagic666VideoProvider()) {
    return "ai_provider_video_content_unverified_magic666";
  }
  if (
    params.referenceAssetCount > 0 &&
    protocol === "openai-videos" &&
    isSmartPickLidBaseUrl(baseUrl) &&
    !shouldAllowSmartPickLidReferenceVideo()
  ) {
    return "ai_provider_video_reference_channel_unreliable_smartpicklid";
  }
  if (protocol === "lk888-media" && isGrokImagineVideoModel(model) && params.referenceAssetCount <= 0) {
    return "ai_provider_video_first_frame_required_lk888_media";
  }
  if (protocol === "huitu-openapi" && params.referenceAssetCount <= 0) {
    return "ai_provider_video_reference_required_huitu";
  }
  return undefined;
}

export function videoProviderAvailability(
  providers: VideoProviderAvailabilityInput[],
  params: { referenceAssetCount: number }
) {
  const diagnostics = providers.map((provider): VideoProviderAvailabilityDiagnostic => ({
    id: provider.id,
    label: provider.label,
    reason: videoProviderAvailabilityReason(provider, params)
  }));
  const videoDiagnostics = diagnostics.filter((diagnostic) => diagnostic.reason !== "ai_provider_not_video_model");
  const runnableProviders = videoDiagnostics.filter((diagnostic) => !diagnostic.reason);
  if (runnableProviders.length > 0) {
    return {
      ok: true as const,
      error: undefined,
      runnableProviders,
      blockedProviders: videoDiagnostics.filter((diagnostic) => diagnostic.reason)
    };
  }
  return {
    ok: false as const,
    error: videoDiagnostics.length ? "video_provider_temporarily_unavailable" : "no_video_ai_provider_configured",
    runnableProviders,
    blockedProviders: videoDiagnostics.filter((diagnostic) => diagnostic.reason)
  };
}

export function runnableVideoProviderModelFamiliesForRequest<T extends VideoProviderAvailabilityInput>(
  providers: T[],
  params: { referenceAssetCount: number; assumeApiKeyConfigured?: boolean }
): VideoModelFamily[] {
  return videoProviderModelFamiliesForProviders(
    providers.filter((provider) => !videoProviderAvailabilityReason(
      params.assumeApiKeyConfigured && !provider.apiKey
        ? { ...provider, apiKey: "configured" }
        : provider,
      params
    ))
  );
}
