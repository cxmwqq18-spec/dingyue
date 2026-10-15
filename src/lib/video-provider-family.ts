import { normalizeVideoModelFamily, normalizeVideoModelPreference, VIDEO_MODEL_FAMILIES, type VideoModelFamily } from "@/lib/video-frame-config";

export type VideoProviderProtocol = "lk888-media" | "openai-videos" | "huitu-openapi" | "tokengo-media";
export type AiProviderProtocol = VideoProviderProtocol | "tokengo-image" | "openai-compatible";
export type AiProviderProtocolSetting = "auto" | AiProviderProtocol;

const videoProviderProtocols: readonly VideoProviderProtocol[] = ["lk888-media", "openai-videos", "huitu-openapi", "tokengo-media"];
const aiProviderProtocols: readonly AiProviderProtocol[] = [...videoProviderProtocols, "tokengo-image", "openai-compatible"];

export function normalizeAiProviderProtocol(value: unknown): AiProviderProtocolSetting {
  return value === "auto" || aiProviderProtocols.includes(value as AiProviderProtocol) ? value as AiProviderProtocolSetting : "auto";
}

export function normalizeVideoProviderProtocol(value: unknown): VideoProviderProtocol | undefined {
  return videoProviderProtocols.includes(value as VideoProviderProtocol) ? value as VideoProviderProtocol : undefined;
}

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

export function isYinglingApiBaseUrl(baseUrl: string) {
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    return hostname === "yinglingapi.com" || hostname.endsWith(".yinglingapi.com");
  } catch {
    return false;
  }
}

export function videoProviderProtocolForBaseUrl(baseUrl: string, configured?: unknown): VideoProviderProtocol {
  const explicit = normalizeVideoProviderProtocol(configured);
  if (explicit) return explicit;
  try {
    const hostname = new URL(baseUrl).hostname.toLowerCase();
    if (isHuituOpenApiBaseUrl(baseUrl)) return "huitu-openapi";
    if (isTokengoMediaBaseUrl(baseUrl)) return "tokengo-media";
    if (isYinglingApiBaseUrl(baseUrl)) return "openai-videos";
    if (hostname.includes("smartpicklid") || hostname.includes("magic666") || hostname === "apis.2ken.com") return "openai-videos";
    if (hostname === "api.lk888.ai" || hostname === "api.lk666.ai" || hostname === "api.lingkeai.ai") return "lk888-media";
  } catch {
    // Preserve the legacy default for existing malformed or unknown URLs.
  }
  return "lk888-media";
}

export function videoProviderModelFamilyForProvider(provider: { aiUrl?: string | null; modelType?: string | null; videoModelFamily?: string | null }): VideoModelFamily {
  if (provider.videoModelFamily === "gemini" || provider.videoModelFamily === "grok") return provider.videoModelFamily;
  const model = provider.modelType?.trim().toLowerCase() ?? "";
  const aiUrl = provider.aiUrl?.trim() ?? "";
  if (model.includes("gemini") || model.includes("huitu") || /^veo[-.]?\d/.test(model) || isHuituOpenApiBaseUrl(aiUrl)) return "gemini";
  return "grok";
}

export function videoProviderMatchesModelFamily(
  provider: { aiUrl?: string | null; modelType?: string | null; videoModelFamily?: string | null },
  modelFamily: unknown
) {
  return videoProviderModelFamilyForProvider(provider) === normalizeVideoModelFamily(modelFamily);
}

export function videoProviderMatchesModelPreference(
  provider: { aiUrl?: string | null; modelType?: string | null; videoModelFamily?: string | null },
  modelPreference: unknown
) {
  const preference = normalizeVideoModelPreference(modelPreference);
  return preference === "auto" || videoProviderMatchesModelFamily(provider, preference);
}

export function videoProviderModelFamiliesForProviders(
  providers: Array<{ aiUrl?: string | null; modelType?: string | null; videoModelFamily?: string | null }>
): VideoModelFamily[] {
  const families = new Set(providers.map(videoProviderModelFamilyForProvider));
  return VIDEO_MODEL_FAMILIES.filter((family) => families.has(family));
}
