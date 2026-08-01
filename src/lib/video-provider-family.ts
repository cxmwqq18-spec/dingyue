import { normalizeVideoModelFamily, type VideoModelFamily } from "@/lib/video-frame-config";

export type VideoProviderProtocol = "lk888-media" | "openai-videos" | "huitu-openapi" | "tokengo-media";

export function isHuituOpenApiBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "api.huitu.xyz" || hostname === "sd2.huitu.xyz";
  } catch {
    return false;
  }
}

export function isTokengoMediaBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "buming.token6688.com" || hostname === "api.tokengo.love";
  } catch {
    return false;
  }
}

export function videoProviderModelFamilyForProvider(provider: { aiUrl?: string | null; modelType?: string | null }): VideoModelFamily {
  const model = provider.modelType?.trim().toLowerCase() ?? "";
  const aiUrl = provider.aiUrl?.trim() ?? "";
  if (model.includes("gemini") || model.includes("huitu") || /^veo[-.]?\d/.test(model) || isHuituOpenApiBaseUrl(aiUrl)) return "gemini";
  return "grok";
}

export function videoProviderMatchesModelFamily(
  provider: { aiUrl?: string | null; modelType?: string | null },
  modelFamily: unknown
) {
  return videoProviderModelFamilyForProvider(provider) === normalizeVideoModelFamily(modelFamily);
}
