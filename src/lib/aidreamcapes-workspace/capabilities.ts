import type { PlatformAiProvider } from "@/lib/types";
import { WORKSPACE_ASPECTS, WORKSPACE_LANGUAGES, WORKSPACE_VIDEO_DURATIONS, sceneSchema } from "./catalogs";
import { WorkspaceError, type ModelCapability, type SceneId, type TaskInput, type VideoAspect, type VideoDuration, type VideoLanguage } from "./types";

export type ProviderVideoCapabilitySource = Pick<PlatformAiProvider,
  "id" | "label" | "modelType" | "maxImagesPerRequest" | "maxVideoInputs" | "maxAudioInputs" | "videoDurations" | "videoAspectRatios" | "videoResolutions" | "videoNativeSpeech">;

const LEGACY_VIDEO_DURATIONS = [15, 30] as const;

/**
 * Convert the existing provider row fields into workspace capabilities.
 * Missing legacy fields retain the pre-capability defaults; explicit empty
 * arrays and false values mean that the provider supports none of that item.
 */
export function toWorkspaceModelCapability(provider: ProviderVideoCapabilitySource, availabilityReason?: string): ModelCapability {
  const model = provider.modelType.toLowerCase();
  const legacyNativeSpeech = model.includes("grok-imagine-video") || model.includes("grok-imagine-1.5") || model.includes("seedance-2") || /veo[-.]?3/.test(model);
  const configuredDurations = provider.videoDurations == null ? LEGACY_VIDEO_DURATIONS : provider.videoDurations;
  const configuredAspects = provider.videoAspectRatios == null ? WORKSPACE_ASPECTS : provider.videoAspectRatios;
  const supported = [...new Set(configuredDurations.filter((value) => Number.isSafeInteger(value) && value > 0))].sort((a, b) => a - b);
  // The workspace only offers its own length tiers. A model serves a tier when
  // it can produce a shot of the planned shot length for that tier.
  const durations = WORKSPACE_VIDEO_DURATIONS.filter((tier) => supported.some((value) => value >= plannedShotDuration(tier)));
  const aspects = WORKSPACE_ASPECTS.filter((aspect) => configuredAspects.includes(aspect));
  // 清晰度档位来自平台后台维护的 videoResolutions；未配置的旧通道回落到 720p 单档。
  const configuredResolutions = provider.videoResolutions == null ? ["720p"] : provider.videoResolutions;
  const resolutions = [...new Set(configuredResolutions.filter((value) => /^\d{3,4}p$/i.test(value)).map((value) => value.toLowerCase()))];
  return {
    id: provider.id,
    label: provider.label,
    model: provider.modelType,
    available: !availabilityReason,
    reason: availabilityReason,
    durations,
    aspects: [...aspects],
    resolutions: resolutions.length ? resolutions : ["720p"],
    // 参考素材上限直接来自平台后台维护值；0 表示该通道不接受这类参考。
    referenceImageMax: Math.max(0, Math.min(12, provider.maxImagesPerRequest ?? 4)),
    videoReferenceMax: Math.max(0, Math.min(8, provider.maxVideoInputs ?? 0)),
    audioReferenceMax: Math.max(0, Math.min(8, provider.maxAudioInputs ?? 0)),
    nativeSpeech: provider.videoNativeSpeech ?? legacyNativeSpeech,
    audioReference: false,
    firstFrame: false,
    lastFrame: false,
    multiReference: provider.maxImagesPerRequest >= 2,
    // The current provider configuration contains no explicit fields for these
    // planned features. Do not infer them from model names or unrelated limits.
    features: { output4k: false, videoExtension: false, actorReplacement: false, advancedShotTools: false },
  };
}

function plannedShotDuration(duration: VideoDuration): number {
  // Direct prompt mode sends the selected duration as one clip. The provider
  // capability list decides whether that duration is runnable.
  return duration;
}

export function modelSupportsWorkspaceDuration(model: ModelCapability, duration: VideoDuration, shotDuration?: number): boolean {
  const requiredDuration = shotDuration ?? plannedShotDuration(duration);
  return Number.isFinite(requiredDuration) && model.durations.some((supported) => supported >= requiredDuration);
}

/**
 * Catalog-level options represent at least one runnable provider. When no
 * provider is runnable yet, retain the workspace defaults so customers can
 * prepare drafts while generation remains unavailable.
 */
export function workspaceOutputOptions(models: ModelCapability[]): { aspects: VideoAspect[]; durations: VideoDuration[] } {
  const runnable = models.filter((model) => model.available);
  if (!runnable.length) return { aspects: [...WORKSPACE_ASPECTS], durations: [...WORKSPACE_VIDEO_DURATIONS] };
  return {
    aspects: WORKSPACE_ASPECTS.filter((aspect) => runnable.some((model) => model.aspects.includes(aspect))),
    durations: WORKSPACE_VIDEO_DURATIONS.filter((duration) => runnable.some((model) => modelSupportsWorkspaceDuration(model, duration))),
  };
}

/** Return a stable error when no selected/runnable model supports the input. */
export function workspaceCapabilityError(args: {
  sceneId: SceneId;
  input: TaskInput;
  models: ModelCapability[];
  shotDuration?: number;
  requireAvailable?: boolean;
}): string | undefined {
  let candidates: ModelCapability[];
  if (args.input.modelId) {
    const selected = args.models.find((model) => model.id === args.input.modelId);
    if (!selected || !selected.available) return "workspace_video_provider_unavailable";
    candidates = [selected];
  } else {
    candidates = args.models.filter((model) => model.available);
    // Drafts remain valid when no runnable provider is configured. Generation
    // and quotes still fail closed when they require an actual provider.
    if (!candidates.length) return args.requireAvailable ? "workspace_video_provider_unavailable" : undefined;
  }

  if (sceneSchema(args.sceneId).needsActor) {
    candidates = candidates.filter((model) => model.nativeSpeech);
    if (!candidates.length) return "workspace_native_speech_unsupported";
  }
  candidates = candidates.filter((model) => model.aspects.includes(args.input.options.aspect));
  if (!candidates.length) return "workspace_video_aspect_unsupported";
  candidates = candidates.filter((model) => modelSupportsWorkspaceDuration(model, args.input.options.duration, args.shotDuration));
  if (!candidates.length) return "workspace_shot_duration_unsupported";
  return undefined;
}

export function assertWorkspaceCapabilitySupport(args: Parameters<typeof workspaceCapabilityError>[0]): void {
  const error = workspaceCapabilityError(args);
  if (error) throw new WorkspaceError(error, error === "workspace_video_provider_unavailable" ? 503 : 422);
}

export function isKnownWorkspaceLanguage(value: unknown): value is VideoLanguage {
  return WORKSPACE_LANGUAGES.some((language) => language.value === value);
}
