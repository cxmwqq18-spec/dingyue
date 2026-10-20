import "server-only";

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { classifyRelayModels, extractRelayModelIds, type RelayModelClassification } from "@/lib/relay-model-catalog";

export type RelayModelListResult = {
  ok: boolean;
  models: RelayModelClassification[];
  rawCount: number;
  message: string;
};

const relayModelListTimeoutMs = Math.max(2_000, Number(process.env.AI_RELAY_MODEL_LIST_TIMEOUT_MS ?? "15000") || 15_000);

function relayModelsUrl(baseUrl: string) {
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  if (/\/v1$/.test(normalized)) return `${normalized}/models`;
  return `${normalized}/v1/models`;
}

/**
 * 拉取中转平台当前账号可见的模型目录。
 * 中转平台（New API 兼容）只在 /v1/models 返回模型 ID，能力元数据需本地规则补齐。
 */
export async function fetchRelayModelList(params: { baseUrl: string; apiKey?: string }): Promise<RelayModelListResult> {
  const baseUrl = params.baseUrl.trim();
  if (!baseUrl) {
    return { ok: false, models: [], rawCount: 0, message: "缺少中转平台地址" };
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { ok: false, models: [], rawCount: 0, message: "中转平台地址无效" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, models: [], rawCount: 0, message: "中转平台地址必须使用 http 或 https" };
  }

  const apiKey = params.apiKey?.trim();
  if (!apiKey) {
    return { ok: false, models: [], rawCount: 0, message: "缺少中转平台 API Key" };
  }

  try {
    const response = await fetchWithTimeout(relayModelsUrl(baseUrl), {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
      timeoutMs: relayModelListTimeoutMs
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const errorMessage = (payload as { error?: { message?: string }; message?: string })?.error?.message
        ?? (payload as { message?: string })?.message
        ?? `HTTP ${response.status}`;
      return { ok: false, models: [], rawCount: 0, message: `读取中转模型目录失败：${errorMessage}` };
    }
    const modelIds = extractRelayModelIds(payload);
    if (!modelIds.length) {
      return { ok: false, models: [], rawCount: 0, message: "中转平台未返回可用模型，请确认 API Key 所属分组" };
    }
    return {
      ok: true,
      models: classifyRelayModels(modelIds),
      rawCount: modelIds.length,
      message: `已读取 ${modelIds.length} 个模型`
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return { ok: false, models: [], rawCount: 0, message: `读取中转模型目录失败：${message}` };
  }
}
