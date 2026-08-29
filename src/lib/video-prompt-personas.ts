export const VIDEO_PROMPT_PERSONAS = [
  { id: "ad_rhythm_editor", labels: { en: "Ad Rhythm Editor", es: "Editor de ritmo publicitario" } },
  { id: "food_short_video_director", labels: { en: "Food Short-Video Director", es: "Director de videos cortos de comida" } },
  { id: "shot_director", labels: { en: "Shot Director", es: "Director de planos" } },
  { id: "short_drama_emotion_director", labels: { en: "Short-Drama Emotion Director", es: "Director emocional de minidramas" } },
  { id: "dynamic_visual_artist", labels: { en: "Motion Visual Artist", es: "Artista visual de movimiento" } },
  { id: "camera_movement_designer", labels: { en: "Camera Movement Designer", es: "Disenador de movimiento de camara" } },
  { id: "fashion_film_director", labels: { en: "Fashion Film Director", es: "Director de moda" } },
  { id: "travel_vlog_director", labels: { en: "Travel Vlog Director", es: "Director de vlogs de viaje" } },
  { id: "product_ad_director", labels: { en: "Product Ad Director", es: "Director de anuncios de producto" } }
] as const;

export type VideoPromptPersonaId = (typeof VIDEO_PROMPT_PERSONAS)[number]["id"];

export const DEFAULT_VIDEO_PROMPT_PERSONA_ID: VideoPromptPersonaId = "shot_director";

const VIDEO_PROMPT_PERSONA_IDS = new Set<string>(VIDEO_PROMPT_PERSONAS.map((persona) => persona.id));

export function isVideoPromptPersonaId(value: unknown): value is VideoPromptPersonaId {
  return typeof value === "string" && VIDEO_PROMPT_PERSONA_IDS.has(value);
}

export function videoPromptPersonaLabel(personaId: VideoPromptPersonaId, locale: "en" | "es"): string {
  return VIDEO_PROMPT_PERSONAS.find((persona) => persona.id === personaId)?.labels[locale] ?? personaId;
}
