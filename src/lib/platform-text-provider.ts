import "server-only";

import type { PlatformAiProvider } from "@/lib/types";

export type PlatformTextMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type PlatformTextGenerationResult = {
  text: string;
  providerId: string;
  providerLabel: string;
};

type PlatformTextGenerationParams = {
  messages: PlatformTextMessage[];
  temperature: number;
  idempotencyKey: string;
  mockText: string;
};

export function platformTextChatCompletionsUrl(aiUrl: string): string {
  const url = new URL(aiUrl);
  let path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) return url.toString();
  if (path.endsWith("/models")) path = path.slice(0, -"/models".length);
  url.pathname = path.endsWith("/v1") ? `${path}/chat/completions` : `${path || "/v1"}/chat/completions`;
  return url.toString();
}

function contentFromResponse(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> })?.choices?.[0]?.message?.content
    ?? (payload as { choices?: Array<{ text?: unknown }> })?.choices?.[0]?.text;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => typeof item === "string" ? item : (item as { text?: string })?.text ?? "")
      .join("\n")
      .trim();
  }
  return "";
}

export async function callPlatformTextProvider(params: {
  provider: PlatformAiProvider;
  messages: PlatformTextMessage[];
  temperature: number;
  idempotencyKey: string;
  fetcher?: typeof fetch;
  /** Defaults to 30s; long-form generation needs a longer budget. */
  timeoutMs?: number;
  /** Combined with the timeout so callers can propagate client aborts. */
  signal?: AbortSignal;
}): Promise<string> {
  const timedSignal = AbortSignal.any([AbortSignal.timeout(params.timeoutMs ?? 30_000), ...(params.signal ? [params.signal] : [])]);
  const response = await (params.fetcher ?? fetch)(platformTextChatCompletionsUrl(params.provider.aiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.provider.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": params.idempotencyKey
    },
    body: JSON.stringify({
      model: params.provider.modelType,
      temperature: params.temperature,
      messages: params.messages
    }),
    cache: "no-store",
    signal: timedSignal
  });
  if (!response.ok) throw new Error(`text_provider_http_${response.status}`);
  const text = contentFromResponse(await response.json().catch(() => ({})));
  if (!text) throw new Error("text_provider_empty_response");
  return text;
}

export async function generatePlatformText(params: PlatformTextGenerationParams): Promise<PlatformTextGenerationResult> {
  const testHook = (globalThis as typeof globalThis & {
    __dingyuePlatformTextProviderTestHook?: (input: PlatformTextGenerationParams) => Promise<PlatformTextGenerationResult> | PlatformTextGenerationResult;
  }).__dingyuePlatformTextProviderTestHook;
  if (process.env.NODE_ENV === "test" && testHook) return testHook(params);
  if (process.env.SMOKE_PROVIDER_MOCK === "1" || process.env.AI_TEXT_PROVIDER_MOCK === "1") {
    return { text: params.mockText, providerId: "mock-text-provider", providerLabel: "Mock text provider" };
  }
  const [{ aiProviderStatus }, { listPlatformAiProvidersRelational }] = await Promise.all([
    import("@/lib/ai-provider-config"),
    import("@/lib/stores/platform-store")
  ]);
  const providers = await listPlatformAiProvidersRelational({ providerType: "text" });
  const provider = providers.find((candidate) => aiProviderStatus(candidate).runnable);
  if (!provider) throw new Error("text_provider_not_configured");
  const text = await callPlatformTextProvider({
    provider,
    messages: params.messages,
    temperature: params.temperature,
    idempotencyKey: params.idempotencyKey
  });
  return { text, providerId: provider.id, providerLabel: provider.label };
}

export type PlatformTextStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; providerId: string; providerLabel: string; complete: boolean };

/**
 * Streams an OpenAI-compatible chat completion (SSE) through the given text
 * provider. Yields delta events as they arrive; the caller owns aggregation
 * and persistence. Aborts cleanly when the caller's signal aborts.
 */
export async function* streamPlatformTextProvider(params: {
  provider: PlatformAiProvider;
  messages: PlatformTextMessage[];
  temperature: number;
  signal?: AbortSignal;
}): AsyncGenerator<PlatformTextStreamEvent> {
  const response = await fetch(platformTextChatCompletionsUrl(params.provider.aiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.provider.apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: params.provider.modelType,
      temperature: params.temperature,
      stream: true,
      messages: params.messages
    }),
    cache: "no-store",
    signal: params.signal
  });
  if (!response.ok || !response.body) throw new Error(`text_provider_http_${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // A relay can drop the connection mid-reply, so a stream that ends without
  // the upstream's own terminator is an interruption, not a finished answer.
  let upstreamFinished = false;
  while (true) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch (error) {
      if ((error as Error)?.name === "AbortError") return;
      throw error;
    }
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload) continue;
      if (payload === "[DONE]") { upstreamFinished = true; continue; }
      try {
        const parsed = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: unknown }; finish_reason?: unknown }> };
        const delta = parsed.choices?.[0]?.delta?.content;
        if (typeof delta === "string" && delta) yield { type: "delta", text: delta };
        if (parsed.choices?.[0]?.finish_reason) upstreamFinished = true;
      } catch { /* Ignore malformed keep-alive fragments. */ }
    }
  }
  yield { type: "done", providerId: params.provider.id, providerLabel: params.provider.label, complete: upstreamFinished };
}
