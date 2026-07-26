import { normalizeVideoModelFamily, type VideoModelFamily } from "@/lib/video-frame-config";

export function isHuituOpenApiBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "api.huitu.xyz" || hostname === "sd2.huitu.xyz";
  } catch {
    return false;
  }
}

export function videoProviderModelFamilyForProvider(provider: { aiUrl?: string | null; modelType?: string | null }): VideoModelFamily {
  const model = provider.modelType?.trim().toLowerCase() ?? "";
  const aiUrl = provider.aiUrl?.trim() ?? "";
  if (model.includes("gemini") || model.includes("huitu") || isHuituOpenApiBaseUrl(aiUrl)) return "gemini";
  return "grok";
}

export function videoProviderMatchesModelFamily(
  provider: { aiUrl?: string | null; modelType?: string | null },
  modelFamily: unknown
) {
  return videoProviderModelFamilyForProvider(provider) === normalizeVideoModelFamily(modelFamily);
}
