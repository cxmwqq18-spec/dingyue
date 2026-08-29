export const MINIMAL_VIDEO_CLEAN_OUTPUT_CONSTRAINT = "Create one clean MP4 video clip. No unintended captions, text overlay, watermark, UI, collage, split screen, or storyboard panels.";
export const MINIMAL_VIDEO_EXPLICIT_TEXT_OUTPUT_CONSTRAINT = "Create one clean MP4 video clip. Follow any explicit request for dialogue, captions, subtitles, shop names, phone numbers, or other on-screen text. Do not add unintended watermarks, UI, collage, split screen, or storyboard panels.";
export const VIDEO_REFERENCE_STYLE_FIDELITY_INSTRUCTION = "Style fidelity lock: preserve the requested 3D/CG/semi-realistic animated-film look from the prompt and reference frames. Do not flatten it into conventional 2D TV-anime line art or simple cel shading; use visible depth, volumetric light, realistic lens behavior, detailed hair, cloth, skin, glasses, and physically based shading cues.";

type VideoProviderPromptPayload = {
  prompt?: unknown;
  params?: Record<string, unknown>;
};

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function promptText(value: unknown) {
  if (typeof value === "string") return value.trim();
  const record = recordValue(value);
  return textValue(record?.rendered) || textValue(record?.template);
}

function promptRequestsTextOutput(value: unknown) {
  const prompt = textValue(value).toLowerCase();
  if (!prompt) return false;
  return /中文解说|普通话(?:解说|口播)?|口播|旁白|中文字幕|文字叠加|画面文字|屏幕文字|画面中.{0,20}(出现|显示)|清晰.{0,20}(店名|电话|电话号码|联系方式)|(?:add|include|show|display|with).{0,30}(captions?|subtitles?|text overlay|on-screen text|shop name|phone number|voiceover|voice-over|dialogue)/.test(prompt);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function normalizedReferenceCount(value: unknown) {
  return Math.max(0, Math.trunc(Number(value ?? 0) || 0));
}

export function videoProviderUserPrompt(payload: VideoProviderPromptPayload) {
  const fields = recordValue(payload.params?.fields);
  return textValue(fields?.promptNote) ||
    textValue(fields?.prompt) ||
    textValue(payload.params?.promptNote) ||
    textValue(payload.params?.prompt) ||
    promptText(payload.prompt);
}

export function videoProviderThemePrompt(payload: VideoProviderPromptPayload) {
  const fields = recordValue(payload.params?.fields);
  return textValue(fields?.videoThemePrompt) || textValue(payload.params?.videoThemePrompt);
}

export function minimalVideoReferenceInstruction(referenceCount: number) {
  if (referenceCount > 1) {
    return [
      "Use the uploaded images in the selected order as visual references.",
      "Treat the uploaded frames as binding visual evidence, not loose inspiration. Preserve the most character-readable face, apparent age, hair, glasses, wardrobe, product shape, props, lighting direction, camera geometry, and scene facts across the whole clip instead of averaging them into a generic actor or unrelated preset scene. If an action is hard, simplify the motion before changing the source subject or style."
    ].join(" ");
  }
  if (referenceCount === 1) {
    return [
      "Use the uploaded image as the visual reference and first-frame source.",
      "Treat it as binding visual evidence, not loose inspiration. Preserve the visible subject identity, face shape, apparent age, hair, glasses, wardrobe, product shape, props, lighting direction, camera angle, and scene facts across the whole clip. If an action is hard, simplify the motion before changing the source subject or style."
    ].join(" ");
  }
  return "";
}

export function minimalVideoOutputFormatInstruction(params: {
  aspectRatio?: unknown;
  duration?: unknown;
  resolution?: unknown;
}) {
  const duration = textValue(params.duration) || (typeof params.duration === "number" && Number.isFinite(params.duration) ? String(params.duration) : "");
  const aspectRatio = textValue(params.aspectRatio);
  const resolution = textValue(params.resolution).toUpperCase();
  const details = [
    duration ? `${duration}-second` : "",
    aspectRatio ? `${aspectRatio}` : "",
    resolution ? `${resolution}` : ""
  ].filter(Boolean).join(" ");
  if (!details) return "";
  return `Output format lock: create exactly one ${details} MP4. Follow these request settings even if the customer note mentions a different orientation, aspect ratio, duration, or resolution.`;
}

export function minimalVideoStyleFidelityInstruction(userPrompt: unknown, referenceCount: number) {
  if (referenceCount < 1) return "";
  const prompt = textValue(userPrompt).toLowerCase();
  if (!/(?:\b3d\b|\bcg\b|cgi|unreal|octane|pbr|physically based|semi[-\s]?realistic|not flat|flat 2d|2d anime|cel[-\s]?shad|animated movie|anime film)/i.test(prompt)) return "";
  return VIDEO_REFERENCE_STYLE_FIDELITY_INSTRUCTION;
}

export function buildMinimalVideoProviderPromptText(params: {
  aspectRatio?: unknown;
  duration?: unknown;
  resolution?: unknown;
  themePrompt?: unknown;
  userPrompt?: unknown;
  referenceCount?: number;
}) {
  const referenceCount = normalizedReferenceCount(params.referenceCount);
  const themePrompt = textValue(params.themePrompt);
  const userPrompt = textValue(params.userPrompt);
  const userPromptCarriesThemeStructure = /(?:^|\n)\s*Subject\s*\/\s*Character\s*:/i.test(userPrompt)
    && /(?:^|\n)\s*Sound\s*\/\s*Audio\s*:/i.test(userPrompt);
  return [
    userPrompt,
    themePrompt && !userPromptCarriesThemeStructure
      ? `Supporting selected-theme production direction (apply only where consistent with the mandatory user direction above):\n${themePrompt}`
      : "",
    minimalVideoOutputFormatInstruction(params),
    minimalVideoReferenceInstruction(referenceCount),
    minimalVideoStyleFidelityInstruction(`${themePrompt}\n${userPrompt}`, referenceCount),
    promptRequestsTextOutput(`${themePrompt}\n${userPrompt}`)
      ? MINIMAL_VIDEO_EXPLICIT_TEXT_OUTPUT_CONSTRAINT
      : MINIMAL_VIDEO_CLEAN_OUTPUT_CONSTRAINT
  ].filter(Boolean).join("\n\n");
}

export function videoProviderPromptInputsFromRequest(requestJson: unknown) {
  const request = recordValue(requestJson);
  const fields = recordValue(request?.fields);
  const frameAssetIds = Array.from(new Set([
    ...stringArray(request?.assetIds),
    ...stringArray(fields?.frameAssetIds)
  ]));
  return {
    userPrompt: textValue(fields?.promptNote) ||
      textValue(fields?.prompt) ||
      textValue(request?.promptNote) ||
      promptText(request?.prompt),
    frameAssetIds,
    referenceCount: frameAssetIds.length
  };
}
