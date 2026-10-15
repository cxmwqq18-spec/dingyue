import { WorkspaceError, type SubtitleCue } from "./types";

export type WorkspaceStabilityOperation = "video" | "image" | "tts" | "worker" | "ledger";

const MOCK_TEXT = {
  environment: "A clear product setting.",
  visual: "Show the supplied product clearly.",
  voiceovers: {
    zh: "请看这款产品。",
    en: "Take a look at this product.",
    es: "Mira este producto.",
    pt: "Veja este produto.",
    ja: "この商品をご覧ください。",
    ko: "이 제품을 확인해 보세요.",
    th: "ลองดูผลิตภัณฑ์นี้",
    vi: "Hãy xem sản phẩm này.",
    id: "Lihat produk ini.",
  },
} as const;

const MOCK_LANGUAGE_CODES: Record<string, keyof typeof MOCK_TEXT.voiceovers> = {
  中文: "zh", English: "en", Español: "es", Português: "pt", 日本語: "ja", 한국어: "ko", ไทย: "th", "Tiếng Việt": "vi", "Bahasa Indonesia": "id",
};

export function isWorkspaceStabilityMockMode(): boolean {
  const mode = process.env.AIVIDEOSUGC_STABILITY_MODE?.trim().toLowerCase();
  if (!mode || mode === "live") return false;
  if (mode === "mock") return true;
  throw new WorkspaceError("workspace_stability_mode_invalid", 500);
}

export function assertWorkspaceExternalOperation(operation: WorkspaceStabilityOperation): void {
  if (isWorkspaceStabilityMockMode()) {
    throw new WorkspaceError("workspace_stability_mock_dispatch_disabled", 503, { operation });
  }
}

/** Deterministic JSON fixtures for storyboard and camera-tag decisions in mock mode. */
export function mockStructuredDecision(system: string, data: unknown): Record<string, unknown> {
  const input = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const shots = Array.isArray(input.shots) ? input.shots : [];
  const countValue = Number(input.shotCount ?? shots.length ?? 1);
  const count = Number.isSafeInteger(countValue) && countValue > 0 && countValue <= 30 ? countValue : 1;
  if (system.includes("Choose camera and framing tags")) {
    return { shots: Array.from({ length: count }, () => ({ camera: "static", framing: "medium" })) };
  }
  const language = typeof input.language === "string" ? MOCK_LANGUAGE_CODES[input.language] ?? "en" : "en";
  const voiceover = input.actor ? MOCK_TEXT.voiceovers[language] : "";
  return {
    environment: MOCK_TEXT.environment,
    shots: Array.from({ length: count }, () => ({ visual: MOCK_TEXT.visual, voiceover, factSources: [] })),
  };
}

/** Deterministic ASR timing fixture; it is used only under the explicit mock mode. */
export function mockSpeechCues(dialogue: string, duration: number): SubtitleCue[] {
  const text = dialogue.trim();
  if (!text || !Number.isFinite(duration) || duration <= 0) throw new WorkspaceError("workspace_speech_timing_invalid", 422);
  return [{ start: 0, end: duration, text }];
}
