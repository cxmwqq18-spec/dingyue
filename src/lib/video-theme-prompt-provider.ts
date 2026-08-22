import "server-only";

import { aiProviderStatus } from "@/lib/ai-provider-config";
import { listPlatformAiProvidersRelational } from "@/lib/stores/platform-store";
import { defaultVideoThemeExamplePrompt, validateVideoPrompt } from "@/lib/video-prompt-format";
import type { PlatformAiProvider } from "@/lib/types";

type PromptGenerationInput = {
  themeName: string;
  themeDescription?: string;
  exampleName?: string;
  referencePrompt?: string;
};

type CachedPrompt = { expiresAt: number; prompt: string };
const idempotencyCacheKey = "__dingyue_video_theme_prompt_generation__";
const idempotencyTtlMs = 15 * 60 * 1000;

function idempotencyCache(): Map<string, CachedPrompt> {
  const root = globalThis as typeof globalThis & { [idempotencyCacheKey]?: Map<string, CachedPrompt> };
  if (!root[idempotencyCacheKey]) root[idempotencyCacheKey] = new Map();
  return root[idempotencyCacheKey];
}

function chatCompletionsUrl(aiUrl: string): string {
  const url = new URL(aiUrl);
  const path = url.pathname.replace(/\/+$/, "");
  if (path.endsWith("/chat/completions")) return url.toString();
  url.pathname = path.endsWith("/v1") ? `${path}/chat/completions` : `${path || "/v1"}/chat/completions`;
  return url.toString();
}

function mockPrompt(input: PromptGenerationInput): string {
  const subject = input.themeName.trim() || "the featured subject";
  return defaultVideoThemeExamplePrompt.replace(
    "A single adult subject with clear wardrobe and grounded physical presence.",
    `A single adult subject in a ${subject} moment, with clear wardrobe and grounded physical presence.`
  );
}

function contentFromResponse(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown }; text?: unknown }> })?.choices?.[0]?.message?.content
    ?? (payload as { choices?: Array<{ text?: unknown }> })?.choices?.[0]?.text;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) return content.map((item) => typeof item === "string" ? item : (item as { text?: string })?.text ?? "").join("\n").trim();
  return "";
}

async function callTextProvider(provider: PlatformAiProvider, input: PromptGenerationInput, idempotencyKey: string): Promise<string> {
  if (process.env.SMOKE_PROVIDER_MOCK === "1" || process.env.AI_TEXT_PROVIDER_MOCK === "1") return mockPrompt(input);
  const response = await fetch(chatCompletionsUrl(provider.aiUrl), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey
    },
    body: JSON.stringify({
      model: provider.modelType,
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: "You write safe, provider-ready AI video prompts. Return only the prompt with exactly these labelled sections: Subject / Character, Action / Motion, Scene / Environment, Camera / Shot / Lens, Lighting / Atmosphere, Style / Mood / Palette, Sound / Audio, Duration / Aspect Ratio / Resolution, Continuity, Negative Constraints. Include a concrete first action, explicit camera movement and lens, environmental pressure, physical micro-action, sound or visual anchor, and a clear final frame. Do not include markdown fences."
        },
        {
          role: "user",
          content: JSON.stringify(input)
        }
      ]
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`text_provider_http_${response.status}`);
  const payload = await response.json().catch(() => ({}));
  const prompt = contentFromResponse(payload);
  if (!prompt) throw new Error("text_provider_empty_response");
  return prompt;
}

export async function generateVideoThemePromptCandidate(params: {
  idempotencyKey: string;
  input: PromptGenerationInput;
}): Promise<{ prompt: string; providerId: string; providerLabel: string; validation: ReturnType<typeof validateVideoPrompt> }> {
  const key = params.idempotencyKey.trim();
  if (!key) throw new Error("idempotency_key_required");
  const cache = idempotencyCache();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    const validation = validateVideoPrompt(cached.prompt);
    return { prompt: cached.prompt, providerId: "cached", providerLabel: "Cached candidate", validation };
  }
  cache.delete(key);
  const providers = await listPlatformAiProvidersRelational({ providerType: "text" });
  const provider = providers.find((candidate) => aiProviderStatus(candidate).runnable);
  if (!provider && process.env.SMOKE_PROVIDER_MOCK !== "1" && process.env.AI_TEXT_PROVIDER_MOCK !== "1") throw new Error("text_provider_not_configured");
  const prompt = await callTextProvider(provider ?? {
    id: "mock-text-provider",
    label: "Mock text provider",
    aiUrl: "http://localhost/mock",
    apiKey: "mock",
    modelType: "mock-text",
    providerType: "text",
    priority: 0,
    preferred: true,
    enabled: true,
    supportsGenerationN: false,
    supportsEditN: false,
    maxImagesPerRequest: 1,
    createdAt: "",
    updatedAt: ""
  }, params.input, key);
  const validation = validateVideoPrompt(prompt);
  if (!validation.valid) throw new Error(`text_provider_prompt_invalid: ${validation.errors.join(" ")}`);
  cache.set(key, { prompt, expiresAt: Date.now() + idempotencyTtlMs });
  return { prompt, providerId: provider?.id ?? "mock-text-provider", providerLabel: provider?.label ?? "Mock text provider", validation };
}
