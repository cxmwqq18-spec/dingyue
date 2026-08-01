import "server-only";
import { FetchTimeoutError, fetchWithTimeout } from "@/lib/fetch-timeout";
import type { PlatformAiProvider } from "@/lib/types";
import { isHuituOpenApiBaseUrl, isTokengoMediaBaseUrl, type VideoProviderProtocol } from "@/lib/video-provider-family";

export function maskAiProviderKey(apiKey?: string): string {
  const value = apiKey?.trim() ?? "";
  if (!value) return "";
  if (value.length <= 10) return `${value.slice(0, 2)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export function aiProviderProtocol(provider?: Pick<PlatformAiProvider, "aiUrl" | "modelType">): VideoProviderProtocol | "openai-compatible" {
  const aiUrl = provider?.aiUrl?.trim() ?? "";
  try {
    const hostname = new URL(aiUrl).hostname.toLowerCase();
    if (isHuituOpenApiBaseUrl(aiUrl)) return "huitu-openapi";
    if (isTokengoMediaBaseUrl(aiUrl)) return "tokengo-media";
    if (hostname.includes("smartpicklid") || hostname.includes("magic666") || hostname === "apis.2ken.com") return "openai-videos";
    if (hostname === "api.lk888.ai" || hostname === "api.lk666.ai" || hostname === "api.lingkeai.ai") return "lk888-media";
  } catch {
    // Keep unknown or in-progress URLs generic in the admin UI.
  }
  const model = provider?.modelType?.trim().toLowerCase() ?? "";
  if (model.includes("huitu") || model.includes("gemini")) return "huitu-openapi";
  return model.includes("video") || model.includes("grok-imagine-video") ? "lk888-media" : "openai-compatible";
}

export function aiProviderStatus(provider?: PlatformAiProvider) {
  return {
    configured: Boolean(provider?.label?.trim() && provider?.aiUrl?.trim() && provider?.apiKey?.trim() && provider?.modelType?.trim()),
    enabled: provider?.enabled ?? true,
    runnable: Boolean((provider?.enabled ?? true) && provider?.label?.trim() && provider?.aiUrl?.trim() && provider?.apiKey?.trim() && provider?.modelType?.trim()),
    aiUrlConfigured: Boolean(provider?.aiUrl?.trim()),
    apiKeyConfigured: Boolean(provider?.apiKey?.trim()),
    apiKeyPreview: maskAiProviderKey(provider?.apiKey),
    label: provider?.label ?? "",
    aiUrl: provider?.aiUrl ?? "",
    modelType: provider?.modelType ?? "",
    protocol: aiProviderProtocol(provider),
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

function lk888SkillsUrl(aiUrl: string) {
  const parsed = new URL(aiUrl);
  parsed.pathname = "/v1/skills";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function openAiModelsUrl(aiUrl: string) {
  const parsed = new URL(aiUrl);
  const path = parsed.pathname.replace(/\/+$/, "");
  parsed.pathname = path.endsWith("/models") ? path : `${path || "/v1"}/models`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function huituHealthUrl(aiUrl: string) {
  const parsed = new URL(aiUrl);
  parsed.pathname = "/api/health";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function tokengoModelsCatalogUrl(aiUrl: string) {
  const parsed = new URL(aiUrl);
  parsed.pathname = "/v1/skills/models";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

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
  const protocol = aiProviderProtocol({ ...provider, modelType: "" });
  if (protocol === "lk888-media") {
    const skills = await fetchWithTimeout(lk888SkillsUrl(aiUrl), { method: "GET", headers, cache: "no-store", timeoutMs: aiProviderGetTimeoutMs });
    return { ok: skills.ok, status: skills.status, method: "GET", message: skills.ok ? "provider reachable" : `provider returned ${skills.status}` };
  }

  if (protocol === "openai-videos") {
    const models = await fetchWithTimeout(openAiModelsUrl(aiUrl), { method: "GET", headers, cache: "no-store", timeoutMs: aiProviderGetTimeoutMs });
    return { ok: models.ok, status: models.status, method: "GET", message: models.ok ? "provider reachable" : `provider returned ${models.status}` };
  }

  if (protocol === "huitu-openapi") {
    const health = await fetchWithTimeout(huituHealthUrl(aiUrl), { method: "GET", headers, cache: "no-store", timeoutMs: aiProviderGetTimeoutMs });
    return { ok: health.ok, status: health.status, method: "GET", message: health.ok ? "provider reachable" : `provider returned ${health.status}` };
  }

  if (protocol === "tokengo-media") {
    const models = await fetchWithTimeout(tokengoModelsCatalogUrl(aiUrl), { method: "GET", headers, cache: "no-store", timeoutMs: aiProviderGetTimeoutMs });
    return { ok: models.ok, status: models.status, method: "GET", message: models.ok ? "provider reachable" : `provider returned ${models.status}` };
  }

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
