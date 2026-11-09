import "server-only";

import crypto from "crypto";
import { generatePlatformText, type PlatformTextContentPart, type PlatformTextMessage } from "@/lib/platform-text-provider";
import { WAN30_OPTIMIZER_SYSTEM_PREFIX, WAN30_PROMPT_SKILL_MD, WAN30_PROMPT_SKILL_VERSION } from "@/lib/wan30-prompt-skill";
import { isWan30VideoTypeId, wan30VideoType, type Wan30VideoTypeId } from "@/lib/wan30-video-prompt-types";

export const WAN30_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH = 5000;
export const WAN30_PROMPT_OPTIMIZATION_MAX_REFERENCES = 4;
/** gpt-5.6 with the full skill runs ~40-80s; the provider default is 30s. */
const WAN30_OPTIMIZER_TIMEOUT_MS = 180_000;

export type Wan30PromptSkillRef = {
  slug: string;
  title: string;
  /** Full skill markdown injected after the fixed system prefix. */
  skillMd: string;
  /** Skill version; part of the optimizer identity for caching/debugging. */
  version: string;
};

export type Wan30PromptOptimizationInput = {
  sourcePrompt: string;
  videoTypeId: Wan30VideoTypeId;
  durationSeconds: number;
  aspectRatio: string;
  resolution: string;
  /** Reference images as data URIs (already ownership-checked by the route). */
  referenceImages: string[];
  /** Admin-curated skill row resolved by the route. Absent = built-in Wan3.0 skill. */
  skill?: Wan30PromptSkillRef;
  /** Confirmed product facts from the product-links importer. When present the
   * optimizer states these facts verbatim instead of guessing, and the
   * unverified-claim validator allows the sourced price. */
  productBrief?: {
    title?: string;
    description?: string;
    price?: { amount: string; currency?: string };
    variants?: string[];
  };
};

export type Wan30PromptOptimizationResult = {
  optimizedPrompt: string;
  videoTypeId: Wan30VideoTypeId;
  sourceHash: string;
  optimizerVersion: string;
};

type OptimizationPayload = { optimizedPrompt?: unknown };

function sourceHash(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function validateWan30OptimizationInput(input: Wan30PromptOptimizationInput): Wan30PromptOptimizationInput {
  const sourcePrompt = input.sourcePrompt.trim();
  if (!sourcePrompt) throw new Error("wan30_prompt_optimization_prompt_required");
  if (sourcePrompt.length > WAN30_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH) throw new Error("wan30_prompt_optimization_prompt_too_long");
  if (!isWan30VideoTypeId(input.videoTypeId)) throw new Error("wan30_prompt_optimization_video_type_invalid");
  const durationSeconds = Math.trunc(Number(input.durationSeconds));
  if (!Number.isFinite(durationSeconds) || durationSeconds < 3 || durationSeconds > 60) throw new Error("wan30_prompt_optimization_duration_invalid");
  if (!/^\d{1,2}:\d{1,2}$/.test(input.aspectRatio.trim())) throw new Error("wan30_prompt_optimization_aspect_ratio_invalid");
  const resolution = input.resolution.trim();
  if (!resolution || resolution.length > 12) throw new Error("wan30_prompt_optimization_resolution_invalid");
  if (input.referenceImages.length > WAN30_PROMPT_OPTIMIZATION_MAX_REFERENCES) throw new Error("wan30_prompt_optimization_reference_count_invalid");
  for (const dataUri of input.referenceImages) {
    if (!/^data:image\/(?:jpeg|png|webp);base64,/.test(dataUri)) throw new Error("wan30_prompt_optimization_reference_image_invalid");
  }
  if (input.skill) {
    const { slug, title, skillMd, version } = input.skill;
    if (!/^[\w-]{1,100}$/.test(slug) || !title.trim() || title.length > 200 || !version.trim() || version.length > 100) throw new Error("wan30_prompt_optimization_skill_invalid");
    if (skillMd.trim().length < 200 || skillMd.length > 60_000) throw new Error("wan30_prompt_optimization_skill_invalid");
  }
  return { ...input, sourcePrompt, videoTypeId: input.videoTypeId, durationSeconds, aspectRatio: input.aspectRatio.trim(), resolution, referenceImages: input.referenceImages };
}

function mockOptimizedPrompt(input: Wan30PromptOptimizationInput): string {
  const references = input.referenceImages.length
    ? `商品款式、标识布局、配色和尺寸比例沿用图1${input.referenceImages.length > 1 ? `至图${input.referenceImages.length}` : ""}的参考；镜头中的抓握、朝向和状态按下文连续变化。`
    : "无参考图：商品外观按正文描述，包装文字准确性待核验，不声称已锁定真实包装。";
  return [
    "真实商品摄影，材质遵从商品本身，动作具有可信重量和连续的接触关系。",
    `${input.durationSeconds} 秒、${input.aspectRatio}、${input.resolution.toUpperCase()} 电商展示视频，以清晰的商品收尾。`,
    `${references} 不擅自补写未展示的文字和细节。`,
    "场景与光线按正文设定，商品清晰对焦，接触阴影真实。",
    "镜头1[0-" + `${input.durationSeconds}秒]：完整呈现正文描述的动作过程，机位稳定，不跳变。`,
    "人声与音效按正文语言执行，背景音乐音量低于人声。",
    "避免商品外观、颜色、尺寸比例发生变化，避免手指穿入产品、商品悬空、画面文字乱码、错误品牌标识，结尾保持画面稳定。"
  ].join("\n");
}

function mockPayload(input: Wan30PromptOptimizationInput): string {
  return JSON.stringify({ optimizedPrompt: mockOptimizedPrompt(input) });
}

function stripMarkdownFence(value: string): string {
  const trimmed = value.trim();
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return match?.[1]?.trim() ?? trimmed;
}

function parsePayload(value: string): OptimizationPayload {
  try {
    return JSON.parse(stripMarkdownFence(value)) as OptimizationPayload;
  } catch {
    throw new Error("wan30_prompt_optimization_invalid_json");
  }
}

function promptMentionsWrongSettings(prompt: string, input: Wan30PromptOptimizationInput): boolean {
  const ratios = Array.from(prompt.matchAll(/\b(\d{1,2})\s*:\s*(\d{1,2})\b/g), (match) => `${match[1]}:${match[2]}`);
  if (ratios.some((ratio) => ratio !== input.aspectRatio)) return true;
  const durations = [
    ...Array.from(prompt.matchAll(/\b(\d{1,3})\s*(?:-| )?seconds?\b/gi), (match) => Number(match[1])),
    // 总时长声明（如「15秒、9:16」）；时间轴区间「[0-15秒]」以 ] 结尾，不算声明。
    ...Array.from(prompt.matchAll(/(\d{1,3})\s*秒(?!\])/g), (match) => Number(match[1]))
  ];
  // Natural-language timelines mention segment boundaries ("前5秒…后5秒") that
  // legitimately under-run the requested length; only a mention EXCEEDING the
  // requested duration (e.g. claiming 15s of a 10s video) is a conflict.
  if (durations.some((duration) => duration > input.durationSeconds)) return true;
  const resolutions = Array.from(prompt.matchAll(/\b(480p|720p|1080p|1440p|4k)\b/gi), (match) => match[1].toLowerCase());
  const expectedResolution = input.resolution.toLowerCase();
  if (resolutions.some((resolution) => resolution !== expectedResolution)) return true;
  const referenceIndexes = Array.from(prompt.matchAll(/图(\d{1,2})/g), (match) => Number(match[1]));
  if (referenceIndexes.some((index) => index > input.referenceImages.length)) return true;
  // Only flag ASSERTIVE use of reference images ("根据参考图…" / "参考图中…");
  // honest negatives like "当前没有商品参考图" are correct and must pass.
  if (input.referenceImages.length === 0 && /(?:使用|根据|按|参照|对照|参见|结合)参考图|参考图(?:中|里|上|所示|显示|呈现|展示)/i.test(prompt)) return true;
  return false;
}

function sourceDialogues(sourcePrompt: string): string[] {
  return Array.from(
    sourcePrompt.matchAll(/"([^"\n]{1,4000})"|“([^”\n]{1,4000})”|‘([^’\n]{1,4000})’|「([^」\n]{1,4000})」|『([^『\n]{1,4000})』/g),
    (match) => match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5]
  );
}

function validatePreservedDialogues(prompt: string, input: Wan30PromptOptimizationInput): void {
  const missing = sourceDialogues(input.sourcePrompt).filter((dialogue) => dialogue?.trim() && !prompt.includes(dialogue.trim()));
  if (missing.length) throw new Error("wan30_prompt_optimization_dialogue_missing");
}

const UNSUPPORTED_CLAIM_PATTERNS: Array<{ pattern: RegExp; /** A confirmed product brief turns the price into a sourced fact. */ briefAllowsPrice?: boolean }> = [
  { pattern: /\b(?:clinically proven|doctor approved|guaranteed|certified|award[- ]winning|best[- ]selling|waterproof|cure[sd]?)\b/i },
  { pattern: /\b(?:recommended|endorsed) by\b/i },
  // A plain price mention becomes a sourced fact once the confirmed product
  // brief carries one; offer/urgency language stays rejected either way.
  { pattern: /\b(?:price|costs?)\b/i, briefAllowsPrice: true },
  { pattern: /\b(?:discount|sale price|limited[- ]time offer|free shipping|buy now)\b/i },
  { pattern: /临床(?:验证|证明)|包治|根治|治愈| guaranteed|获奖|最低价|免费送|买一送一|限时优惠/i }
];

function hasPositiveClaim(value: string, pattern: RegExp): boolean {
  const match = pattern.exec(value);
  if (!match) return false;
  const before = value.slice(Math.max(0, (match.index ?? 0) - 56), match.index ?? 0);
  const clause = before.split(/[.!?;。\n]/).pop() ?? before;
  return !/\b(?:avoid|without|never|not|no|do not|don't|dont|exclude)\b|避免|不要|禁止|不得|不出现|不写|不做|无|别/i.test(clause);
}

function validateNoInventedClaims(prompt: string, input: Wan30PromptOptimizationInput): void {
  for (const { pattern, briefAllowsPrice } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (!hasPositiveClaim(prompt, pattern)) continue;
    if (hasPositiveClaim(input.sourcePrompt, pattern)) continue;
    if (briefAllowsPrice && input.productBrief?.price && !/discount|sale|limited|free shipping|buy now/i.test(prompt)) continue;
    throw new Error("wan30_prompt_optimization_unverified_claim");
  }
  const inventedReferenceContent = /\b(?:reference|source|uploaded|selected)\s+(?:image|photo|frame)\s+(?:shows?|contains?|features?|depicts?)\b|参考图[\S]{0,6}(?:显示|包含|出现|展示)/i;
  if (inventedReferenceContent.test(prompt)) {
    throw new Error("wan30_prompt_optimization_unverified_reference_content");
  }
}

function validateNoSensitiveLeak(prompt: string): void {
  const credentialPattern = /\bauthorization\s*:\s*bearer\s+\S+|\bapi[_ -]?key\s*(?::|=|is)\s*\S+|\bsk-[a-z0-9_-]{8,}|-----begin (?:rsa |ec |openssh )?private key-----/i;
  const hiddenInstructionPattern = /\b(?:system|developer) (?:prompt|instructions?)\s*(?::|=)|\bhidden (?:(?:system|developer) )?(?:prompt|instructions?|configuration)\b/i;
  if (credentialPattern.test(prompt) || hiddenInstructionPattern.test(prompt)) {
    throw new Error("wan30_prompt_optimization_safety_failed");
  }
}

function validateHasNegativeConstraints(prompt: string): void {
  if (!/避免|不要|禁止|不得|不出现|负面|negative/i.test(prompt)) {
    throw new Error("wan30_prompt_optimization_negative_missing");
  }
}

/** The seven-section skill is an internal checklist; section codes must never
 * reach the merchant-facing prompt (B1–B7 labels, markdown headings). */
function validateNoSectionLabels(prompt: string): void {
  if (/\bB[1-7]\b/.test(prompt) || /^#{1,6}\s/m.test(prompt)) {
    throw new Error("wan30_prompt_optimization_section_labels");
  }
}

function validatePayload(payload: OptimizationPayload, input: Wan30PromptOptimizationInput): string {
  const prompt = typeof payload.optimizedPrompt === "string" ? payload.optimizedPrompt.trim() : "";
  if (!prompt) throw new Error("wan30_prompt_optimization_empty_response");
  if (prompt.length > WAN30_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH) throw new Error("wan30_prompt_optimization_response_too_long");
  if (promptMentionsWrongSettings(prompt, input)) throw new Error("wan30_prompt_optimization_setting_conflict");
  validatePreservedDialogues(prompt, input);
  validateNoInventedClaims(prompt, input);
  validateNoSensitiveLeak(prompt);
  validateHasNegativeConstraints(prompt);
  validateNoSectionLabels(prompt);
  return prompt;
}

function generationMessages(input: Wan30PromptOptimizationInput): PlatformTextMessage[] {
  const videoType = wan30VideoType(input.videoTypeId);
  const textPayload = JSON.stringify({
    task: "把下面的用户描述优化成一条可直接粘贴给 Wan3.0 的电商商品视频提示词。",
    sourcePrompt: input.sourcePrompt,
    videoType: videoType.label,
    videoTypeInstruction: videoType.instruction,
    videoTypeStrategy: videoType.strategy,
    durationSeconds: input.durationSeconds,
    aspectRatio: input.aspectRatio,
    resolution: input.resolution.toUpperCase(),
    referenceCount: input.referenceImages.length,
    references: input.referenceImages.map((_, index) => ({ label: `图${index + 1}`, role: index === 0 ? "商品主图（外观/配色/标识基准）" : "补充参考（角度/场景/使用方式）" })),
    // 已确认的产品事实：优化后的提示词必须与这些事实一致，不得虚构参数。
    ...(input.productBrief ? {
      productBrief: {
        ...(input.productBrief.title ? { title: input.productBrief.title } : {}),
        ...(input.productBrief.description ? { description: input.productBrief.description } : {}),
        ...(input.productBrief.price ? { price: input.productBrief.price.currency ? `${input.productBrief.price.currency} ${input.productBrief.price.amount}` : input.productBrief.price.amount } : {}),
        ...(input.productBrief.variants?.length ? { variants: input.productBrief.variants } : {}),
        rule: "提示词中涉及产品名称、材质、规格、颜色、尺寸与价格时，只能使用这里的事实；未提供的事实不得编造。"
      }
    } : {})
  });
  const content: string | PlatformTextContentPart[] = input.referenceImages.length
    ? [
        { type: "text", text: textPayload },
        ...input.referenceImages.map((dataUri): PlatformTextContentPart => ({ type: "image_url", image_url: { url: dataUri } }))
      ]
    : textPayload;
  return [
    { role: "system", content: WAN30_OPTIMIZER_SYSTEM_PREFIX + (input.skill?.skillMd ?? WAN30_PROMPT_SKILL_MD) },
    { role: "user", content }
  ];
}

function repairMessages(input: Wan30PromptOptimizationInput, invalidText: string, reason: string): PlatformTextMessage[] {
  return [
    ...generationMessages(input),
    { role: "assistant", content: invalidText.slice(0, 6000) },
    {
      role: "user",
      content: `The previous response was rejected (${reason}). Return corrected strict JSON {"optimizedPrompt":"..."} only. Keep every quoted dialogue and proper noun from the source, use exactly ${input.durationSeconds} seconds, ${input.aspectRatio}, ${input.resolution.toUpperCase()}, and reference at most 图${input.referenceImages.length}.`
    }
  ];
}

async function generateAndValidate(input: Wan30PromptOptimizationInput, idempotencyKey: string): Promise<string> {
  let first: Awaited<ReturnType<typeof generatePlatformText>>;
  try {
    first = await generatePlatformText({
      messages: generationMessages(input),
      temperature: 0.7,
      idempotencyKey,
      mockText: mockPayload(input),
      timeoutMs: WAN30_OPTIMIZER_TIMEOUT_MS
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "text_provider_empty_response") throw error;
    first = { text: "", providerId: "unknown", providerLabel: "Unknown text provider" };
  }
  try {
    return validatePayload(parsePayload(first.text), input);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "wan30_prompt_optimization_invalid_response";
    const repaired = await generatePlatformText({
      messages: repairMessages(input, first.text, reason),
      temperature: 0.2,
      idempotencyKey: `${idempotencyKey}:repair`,
      mockText: mockPayload(input),
      timeoutMs: WAN30_OPTIMIZER_TIMEOUT_MS
    });
    return validatePayload(parsePayload(repaired.text), input);
  }
}

export async function optimizeWan30VideoPrompt(input: Wan30PromptOptimizationInput): Promise<Wan30PromptOptimizationResult> {
  const normalized = validateWan30OptimizationInput(input);
  const hash = sourceHash(normalized.sourcePrompt);
  const invocationId = crypto.randomUUID();
  const optimizerVersion = `wan30-video-prompt-optimizer-v1:${normalized.skill?.version ?? WAN30_PROMPT_SKILL_VERSION}`;
  const optimizedPrompt = await generateAndValidate(
    normalized,
    `${optimizerVersion}:${hash}:${normalized.videoTypeId}:${invocationId}`
  );
  return {
    optimizedPrompt,
    videoTypeId: normalized.videoTypeId,
    sourceHash: hash,
    optimizerVersion
  };
}
