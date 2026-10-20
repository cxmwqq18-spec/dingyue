/**
 * 中转平台（relay）模型目录同步的分类规则。
 *
 * 中转平台只返回模型 ID（OpenAI 兼容的 /v1/models 列表），不返回能力元数据。
 * 这里用可解释的规则把模型 ID 映射到平台的能力类型与协议默认值，
 * 未识别的模型一律落到 "text"，并且在同步结果里标记为需要人工确认。
 */

export type RelayModelCapability = "image" | "video" | "audio" | "text";

export type RelayModelClassification = {
  modelId: string;
  capability: RelayModelCapability;
  protocol: "openai-compatible" | "openai-videos" | "lk888-media" | "huitu-openapi" | "tokengo-media";
  modelFamily: "auto" | "grok" | "gemini";
  needsReview: boolean;
  reason: string;
};

/** 视频模型：与 runtime 的 isVideoProviderModel 保持同一套命名族。 */
const videoModelPatterns: Array<[RegExp, string]> = [
  [/grok-imagine/, "grok-imagine 视频族"],
  [/grok-video/, "grok-video 视频族"],
  [/^veo[-.]?\d/, "Veo 视频族"],
  [/^sora-/, "Sora 视频族"],
  [/^seedance-/, "Seedance 视频族"],
  [/^doubao-seedance-/, "Seedance 视频族"],
  [/^kling-/, "Kling 视频族"],
  [/^vidu/, "Vidu 视频族"],
  [/^pixverse-/, "PixVerse 视频族"],
  [/^dola/, "Dola 视频族"],
  [/^wan.*-video$/, "Wan 视频族"],
  [/^minimax-hailuo-/, "海螺视频族"],
  [/^happyhorse-/, "HappyHorse 视频族"],
  [/wanneng-video/, "WanNeng 视频族"]
];

/** 图片模型：覆盖 OpenAI 兼容图片接口常见的中转模型名。 */
const imageModelPatterns: Array<[RegExp, string]> = [
  [/^gpt-image-/, "gpt-image 图片族"],
  [/^dall-e-/, "DALL·E 图片族"],
  [/flux/, "Flux 图片族"],
  [/^imagen/, "Imagen 图片族"],
  [/nano-banana/, "Nano Banana 图片族"],
  [/^seedream/, "Seedream 图片族"],
  [/^qwen-image/, "Qwen Image 图片族"],
  [/^kolors/, "Kolors 图片族"],
  [/^ideogram/, "Ideogram 图片族"],
  [/^recraft/, "Recraft 图片族"],
  [/^midjourney/, "Midjourney 图片族"],
  [/^mj_/, "Midjourney 图片族"]
];

/** 音频模型：区分 TTS、ASR 与通用音频。 */
const audioModelPatterns: Array<[RegExp, string]> = [
  [/^whisper-/, "Whisper 语音识别"],
  [/^tts-/, "OpenAI TTS"],
  [/^gpt-4o-mini-tts/, "TTS"],
  [/elevenlabs/, "ElevenLabs 语音"],
  [/^cosyvoice/, "CosyVoice 语音"],
  [/^fish-speech/, "Fish Speech 语音"],
  [/^index-tts/, "IndexTTS 语音"],
  [/^mureka/, "Mureka 音乐"],
  [/^suno/, "Suno 音乐"]
];

function matches(patterns: Array<[RegExp, string]>, modelId: string): string | undefined {
  for (const [pattern, reason] of patterns) {
    if (pattern.test(modelId)) return reason;
  }
  return undefined;
}

export function classifyRelayModel(modelId: string): RelayModelClassification {
  const normalized = modelId.trim().toLowerCase();
  if (!normalized) {
    return { modelId, capability: "text", protocol: "openai-compatible", modelFamily: "auto", needsReview: true, reason: "模型 ID 为空" };
  }

  const video = matches(videoModelPatterns, normalized);
  if (video) {
    return {
      modelId,
      capability: "video",
      protocol: "openai-videos",
      modelFamily: /veo[-.]?\d|gemini/.test(normalized) ? "gemini" : "grok",
      needsReview: false,
      reason: video
    };
  }

  const image = matches(imageModelPatterns, normalized);
  if (image) {
    return { modelId, capability: "image", protocol: "openai-compatible", modelFamily: "auto", needsReview: false, reason: image };
  }

  const audio = matches(audioModelPatterns, normalized);
  if (audio) {
    return { modelId, capability: "audio", protocol: "openai-compatible", modelFamily: "auto", needsReview: true, reason: audio };
  }

  return {
    modelId,
    capability: "text",
    protocol: "openai-compatible",
    modelFamily: "auto",
    needsReview: true,
    reason: "按对话模型处理，建议人工确认"
  };
}

export function classifyRelayModels(modelIds: string[]): RelayModelClassification[] {
  return modelIds.map((modelId) => classifyRelayModel(modelId));
}

/** 从 OpenAI 兼容的 /v1/models 响应中提取模型 ID。 */
export function extractRelayModelIds(payload: unknown): string[] {
  const data = (payload as { data?: unknown })?.data;
  const items = Array.isArray(data) ? data : Array.isArray(payload) ? payload : [];
  const ids = items
    .map((item) => {
      if (typeof item === "string") return item;
      const id = (item as { id?: unknown; model?: unknown; name?: unknown })?.id
        ?? (item as { model?: unknown })?.model
        ?? (item as { name?: unknown })?.name;
      return typeof id === "string" ? id : "";
    })
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  return Array.from(new Set(ids));
}
