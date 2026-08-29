import "server-only";

import { generatePlatformText } from "@/lib/platform-text-provider";
import { defaultVideoThemeExamplePrompt, validateVideoPrompt } from "@/lib/video-prompt-format";

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

function mockPrompt(input: PromptGenerationInput): string {
  const subject = input.themeName.trim() || "the featured subject";
  return defaultVideoThemeExamplePrompt.replace(
    "A single adult subject with clear wardrobe and grounded physical presence.",
    `A single adult subject in a ${subject} moment, with clear wardrobe and grounded physical presence.`
  );
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
  const generated = await generatePlatformText({
    idempotencyKey: key,
    temperature: 0.7,
    mockText: mockPrompt(params.input),
    messages: [
      {
        role: "system",
        content: "You write safe, provider-ready AI video prompts. Return only the prompt with exactly these labelled sections: Subject / Character, Action / Motion, Scene / Environment, Camera / Shot / Lens, Lighting / Atmosphere, Style / Mood / Palette, Sound / Audio, Duration / Aspect Ratio / Resolution, Continuity, Negative Constraints. Include a concrete first action, explicit camera movement and lens, environmental pressure, physical micro-action, sound or visual anchor, and a clear final frame. Do not include markdown fences."
      },
      {
        role: "user",
        content: JSON.stringify(params.input)
      }
    ]
  });
  const prompt = generated.text;
  const validation = validateVideoPrompt(prompt);
  if (!validation.valid) throw new Error(`text_provider_prompt_invalid: ${validation.errors.join(" ")}`);
  cache.set(key, { prompt, expiresAt: Date.now() + idempotencyTtlMs });
  return { prompt, providerId: generated.providerId, providerLabel: generated.providerLabel, validation };
}
