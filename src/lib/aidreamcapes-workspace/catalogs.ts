import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type SceneId, type SceneSchema, type TaskInput, type VideoLanguage } from "./types";

export const WORKSPACE_LANGUAGES: { value: VideoLanguage; label: string }[] = [
  { value: "zh", label: "中文" }, { value: "en", label: "English" }, { value: "es", label: "Español" },
  { value: "pt", label: "Português" }, { value: "ja", label: "日本語" }, { value: "ko", label: "한국어" },
  { value: "th", label: "ไทย" }, { value: "vi", label: "Tiếng Việt" }, { value: "id", label: "Bahasa Indonesia" }
];
export const WORKSPACE_ASPECTS = ["9:16", "1:1", "16:9"] as const;
export const WORKSPACE_DURATIONS = [6, 10, 15, 30] as const;
export const SCENES: SceneSchema[] = [
  {
    id: "presenter_showcase", name: "Presenter showcase", summary: "An on-camera creator introduces your product and its benefits.",
    tags: ["Creator", "Product showcase"], needsActor: true, structureField: "occasions", productNoun: "product",
    styleDefault: "relaxed_daily", styleOptions: [{ value: "premium_cool", label: "Premium & cool" }, { value: "relaxed_daily", label: "Relaxed & everyday" }, { value: "festive", label: "Warm & festive" }],
    refImagePolicy: ["actor", "product", "composite"], cover: "product", version: "1",
    sections: [{ id: "product", label: "Your product", fields: [
      { id: "productImages", label: "Product images", hint: "Upload 1–4 clear photos of the product you want to feature.", type: "images", required: true, refKind: "product", min: 1, max: 4 },
      { id: "sellingPoints", label: "Key benefits", hint: "Describe the benefits the creator should explain. Use facts you can support.", type: "textarea", required: true },
      { id: "occasions", label: "Where it is used", hint: "Add the settings where your product is used, one per line.", type: "tags", required: false },
      { id: "tone", label: "Speaking tone", hint: "Choose how the creator should speak to your audience.", type: "select", required: false, options: [{ value: "natural", label: "Natural" }, { value: "enthusiastic", label: "Enthusiastic" }, { value: "calm", label: "Calm" }] }
    ] }]
  },
  {
    id: "process_demo", name: "Product demo", summary: "Show how your product works, step by step.", tags: ["How to", "Product demo"],
    needsActor: false, structureField: "steps", productNoun: "product", styleDefault: "professional",
    styleOptions: [{ value: "clean", label: "Clean & calming" }, { value: "professional", label: "Professional & clear" }, { value: "fresh", label: "Bright & energetic" }],
    refImagePolicy: ["product", "texture"], cover: "product", version: "1",
    sections: [{ id: "product", label: "Your product", fields: [
      { id: "productImages", label: "Product images", hint: "Upload 1–4 clear photos showing your product.", type: "images", required: true, refKind: "product", min: 1, max: 4 },
      { id: "textureImages", label: "Detail images", hint: "Optional: add up to 3 photos of a detail or material you want to highlight.", type: "images", required: false, refKind: "texture", min: 0, max: 3 },
      { id: "steps", label: "How to use it", hint: "Write the actual steps in order, one per line.", type: "textarea", required: true },
      { id: "features", label: "Features to highlight", hint: "List the product features you want viewers to remember.", type: "textarea", required: false }
    ] }]
  },
  {
    id: "texture_closeup", name: "Product close-up", summary: "Highlight your product with detailed close-ups and a pace you choose.", tags: ["Close-up", "Product details"],
    needsActor: false, structureField: "pace", productNoun: "product", styleDefault: "natural",
    styleOptions: [{ value: "warm", label: "Warm & inviting" }, { value: "cool", label: "Cool & premium" }, { value: "natural", label: "Natural daylight" }],
    refImagePolicy: ["product"], cover: "product", version: "1",
    sections: [{ id: "product", label: "Your product", fields: [
      { id: "productImages", label: "Product images", hint: "Upload 1–4 clear photos of the product in its finished state.", type: "images", required: true, refKind: "product", min: 1, max: 4 },
      { id: "detail", label: "The detail to highlight", hint: "Describe the visible detail or texture the camera should focus on.", type: "textarea", required: true },
      { id: "pace", label: "Editing pace", hint: "Choose slow close-ups or more frequent cuts.", type: "select", required: false, options: [{ value: "slow", label: "Slow close-ups" }, { value: "balanced", label: "Balanced" }, { value: "fast", label: "Fast cuts" }] }
    ] }]
  }
];

export const STYLE_FRAGMENTS: Record<string, { colorGrade: string; lighting: string }> = {
  premium_cool: { colorGrade: "restrained cool neutral colors with balanced contrast", lighting: "soft directional light with clean highlights" },
  relaxed_daily: { colorGrade: "natural neutral colors with soft contrast", lighting: "soft window daylight" },
  festive: { colorGrade: "warm rich colors with balanced saturation", lighting: "warm diffused practical lighting" },
  clean: { colorGrade: "clean neutral colors with gentle contrast", lighting: "even diffused lighting" },
  professional: { colorGrade: "accurate product colors with crisp tonal separation", lighting: "controlled soft key lighting" },
  fresh: { colorGrade: "bright natural colors with clear midtones", lighting: "bright diffused daylight" },
  warm: { colorGrade: "warm colors with soft highlight rolloff", lighting: "warm angled soft light" },
  cool: { colorGrade: "cool neutral colors with restrained saturation", lighting: "cool diffused light with precise highlights" },
  natural: { colorGrade: "accurate natural colors with gentle contrast", lighting: "natural window daylight" }
};
export const CAMERA_FRAGMENTS: Record<string, string> = {
  static: "The camera stays steady with its focus locked on the subject.",
  push_in: "The camera slowly moves forward at a constant speed, keeping the subject in focus.",
  slide: "The camera slides gently sideways, keeping the product centered and in focus."
};
export const FRAMING_FRAGMENTS: Record<string, string> = {
  medium: "A medium shot presents the product and its immediate surroundings.",
  close: "A close-up clearly shows the product's visible details.",
  macro: "A macro close-up emphasizes the texture visible in the product reference."
};
export function assertWorkspaceSite(siteId: string): asserts siteId is typeof AIVIDEOSUGC_SITE_ID {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_allowed", 404);
}
export function sceneSchema(sceneId: string): SceneSchema {
  const scene = SCENES.find((candidate) => candidate.id === sceneId);
  if (!scene) throw new WorkspaceError("workspace_scene_invalid");
  return structuredClone(scene);
}
export function defaultTaskInput(sceneId: SceneId): TaskInput {
  return { images: {}, fields: {}, options: { duration: 15, aspect: "9:16", style: sceneSchema(sceneId).styleDefault, language: "en", subtitle: false, subtitleStyle: "classic" } };
}
