import "server-only";
import { FetchTimeoutError, fetchWithTimeout } from "@/lib/fetch-timeout";
import type { PlatformAiProvider } from "@/lib/types";

export function maskAiProviderKey(apiKey?: string): string {
  const value = apiKey?.trim() ?? "";
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function aiProviderStatus(provider?: PlatformAiProvider) {
  return {
    configured: Boolean(provider?.label?.trim() && provider?.aiUrl?.trim() && provider?.apiKey?.trim() && provider?.modelType?.trim()),
    aiUrlConfigured: Boolean(provider?.aiUrl?.trim()),
    apiKeyConfigured: Boolean(provider?.apiKey?.trim()),
    apiKeyPreview: maskAiProviderKey(provider?.apiKey),
    label: provider?.label ?? "",
    aiUrl: provider?.aiUrl ?? "",
    modelType: provider?.modelType ?? "",
    updatedAt: provider?.updatedAt,
    updatedBy: provider?.updatedBy
  };
}

export function assertValidAiProviderUrl(aiUrl: string): string {
  const trimmed = aiUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("invalid_ai_provider_url");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("invalid_ai_provider_url");
  return trimmed;
}

const aiProviderHeadTimeoutMs = Math.max(500, Number(process.env.AI_PROVIDER_HEAD_TIMEOUT_MS ?? "3000") || 3000);
const aiProviderGetTimeoutMs = Math.max(1000, Number(process.env.AI_PROVIDER_GET_TIMEOUT_MS ?? "5000") || 5000);

export async function testAiProviderConnection(provider: Pick<PlatformAiProvider, "aiUrl" | "apiKey">): Promise<{
  ok: boolean;
  status?: number;
  method?: "HEAD" | "GET";
  message: string;
}> {
  const aiUrl = assertValidAiProviderUrl(provider.aiUrl);
  const apiKey = provider.apiKey?.trim();
  if (!apiKey) throw new Error("missing_ai_provider_api_key");
  if (process.env.SMOKE_PROVIDER_MOCK === "1") {
    return { ok: true, status: 200, method: "HEAD", message: "mock provider reachable" };
  }

  const headers = { Authorization: `Bearer ${apiKey}` };
  const head = await fetchWithTimeout(aiUrl, { method: "HEAD", headers, cache: "no-store", timeoutMs: aiProviderHeadTimeoutMs }).catch((error) => error as Error);
  if (!(head instanceof Error) && head.status < 500) {
    return { ok: head.ok, status: head.status, method: "HEAD", message: head.ok ? "provider reachable" : `provider returned ${head.status}` };
  }
  if (head instanceof FetchTimeoutError) {
    return { ok: false, status: 504, method: "HEAD", message: "provider timeout" };
  }

  const get = await fetchWithTimeout(aiUrl, { method: "GET", headers, cache: "no-store", timeoutMs: aiProviderGetTimeoutMs });
  return { ok: get.ok, status: get.status, method: "GET", message: get.ok ? "provider reachable" : `provider returned ${get.status}` };
}
