import { isVideoProviderModel } from "@/lib/video-provider-limits";

export const platformAiProviderTypes = ["image", "video", "text"] as const;

export type PlatformAiProviderType = typeof platformAiProviderTypes[number];

export function normalizePlatformAiProviderType(value: unknown, fallback: PlatformAiProviderType = "image"): PlatformAiProviderType {
  return value === "video" || value === "image" || value === "text" ? value : fallback;
}

export function inferPlatformAiProviderType(provider: {
  label?: string | null;
  aiUrl?: string | null;
  modelType?: string | null;
}): PlatformAiProviderType {
  const text = [provider.modelType, provider.label, provider.aiUrl].filter(Boolean).join(" ").toLowerCase();
  return isVideoProviderModel(provider.modelType) ||
    text.includes("smartpicklid") ||
    text.includes("magic666") ||
    text.includes("tokengo") ||
    text.includes("token6688") ||
    text.includes("buming")
    ? "video"
    : "image";
}

export function platformProviderTypeForAppType(appType: unknown): PlatformAiProviderType {
  return appType === "video" ? "video" : "image";
}

export function platformAiProviderTypeLabel(providerType: PlatformAiProviderType): string {
  if (providerType === "video") return "AI 生成视频";
  if (providerType === "text") return "AI 文本生成";
  return "AI 生图";
}
