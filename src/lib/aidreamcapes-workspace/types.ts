import type { WorkspacePreset } from "./preset-contract";
export const AIVIDEOSUGC_SITE_ID = "site_aidreamcapes" as const;
/**
 * Longest brief a customer can write in one prompt field. Shared by the
 * composer, the draft editor and every server validator so a prompt that the
 * form accepts is always accepted by the pipeline.
 */
export const WORKSPACE_PROMPT_MAX_LENGTH = 10000;
export type SceneId = "presenter_showcase" | "process_demo" | "texture_closeup" | "text_to_video";
export type VideoDuration = 6 | 10 | 15 | 30;
export type SubtitleStyle = "classic" | "bold" | "minimal";
export type SubtitleTextSize = "small" | "medium" | "large";
export type SubtitleTextPosition = "bottom" | "middle" | "top";
export type SubtitleTextColor = "white" | "yellow" | "cyan" | "black";
export type SubtitleBackdrop = "none" | "box" | "outline";
export type VideoAspect = "9:16" | "1:1" | "16:9";
export type VideoLanguage = "zh" | "en" | "es" | "pt" | "ja" | "ko" | "th" | "vi" | "id";
export type ActorGender = "female" | "male";
export type RefKind = "actor" | "product" | "texture" | "composite";
export type TaskStatus = "draft" | "storyboard_ready" | "rendering" | "completed" | "failed" | "cancelled";
export interface SceneField {
  id: string; label: string; hint: string; type: "text" | "textarea" | "select" | "tags" | "images";
  required: boolean; options?: { value: string; label: string }[]; refKind?: RefKind; min?: number; max?: number;
}
export interface SceneSchema {
  id: SceneId; name: string; summary: string; tags: string[]; needsActor: boolean;
  structureField: string; styleDefault: string; styleOptions: { value: string; label: string }[];
  sections: { id: string; label: string; fields: SceneField[] }[];
  refImagePolicy: RefKind[]; cover: RefKind; productNoun: string; version: string;
}
export interface TaskInput {
  images: Record<string, string[]>; fields: Record<string, string | string[]>;
  creativeDirection?: string;
  /**
   * The composer's direct-video mode: the customer prompt is the complete
   * generation prompt. No storyboard planner or prompt template may rewrite it,
   * and the whole selected duration is sent as one clip.
   */
  direct?: boolean;
  options: { duration: VideoDuration; aspect: VideoAspect; resolution?: string; style: string; language: VideoLanguage; subtitle: boolean; subtitleStyle?: SubtitleStyle };
  referenceVideos?: string[];
  referenceAudios?: string[];
  actorId?: string;
  musicUrl?: string;
  modelId?: string;
}
export type MusicUsage = "ads" | "organic";
export interface WorkspaceMusicSelection {
  trackId: string;
  licenseId: string;
  licenseRevision: number;
  territory: string;
  usage: MusicUsage;
  attributionRequired: boolean;
  attributionText?: string;
  attachedAt: string;
}
export type ProductBriefConfidence = "high" | "medium" | "low";
export interface ConfirmedProductBriefField<T> {
  value: T; sourceUrl: string; sourceLabel: string; confidence: ProductBriefConfidence;
  userConfirmed: true;
}
export interface UnconfirmedProductBriefPrice {
  amount: string; currency?: string; sourceUrl: string; sourceLabel: string;
  confidence: ProductBriefConfidence; userConfirmed: false;
}
export interface ProductBriefSnapshot {
  sourceUrl: string; fetchedPageUrl: string;
  title: ConfirmedProductBriefField<string> | null;
  description: ConfirmedProductBriefField<string> | null;
  possiblePrice: UnconfirmedProductBriefPrice | null;
  userConfirmed: true; confirmedAt: string;
}
export interface ActorVoice {
  voiceId: string; gender: ActorGender; timbre: string; label?: string;
  language: VideoLanguage; languages?: VideoLanguage[]; vocalProfile: string;
  refAudio: string; speed: number; pitch: number;
}
export interface ActorVoiceSnapshot {
  actorId: string; actorName: string; actorGender: ActorGender; voiceId: string;
  profile: Omit<ActorVoice, "voiceId">;
}
export interface ActorAsset {
  actorId: string; name: string; imageUrl: string; gender: ActorGender; ageRange: string; identityPrompt: string;
  genderLabel?: string; appearance?: string; scene?: string; style?: string; description?: string;
  category?: string; talent?: string; sampleLine?: string; action?: string; ambient?: string; sourceRef?: string;
  voice: ActorVoice;
}
export interface ShotSnapshot {
  visual: string; voiceover: string; refKinds: RefKind[]; refImgs: Partial<Record<RefKind, string>>;
  firstFrame?: string; lastFrame?: string; actorId?: string; voiceSnapshot?: ActorVoiceSnapshot;
  environment: string; start: number; end: number; duration: number;
  camera: string; framing: string; lighting: string; expression: string;
}
export interface SubtitleCue { start: number; end: number; text: string }
export interface CaptionEditDraft { renderId: string; lines: SubtitleCue[]; updatedAt: string }
export interface ShotVersion extends ShotSnapshot {
  vid: string; ts: string; prompt: string; clipUrl?: string; generationJobId?: string;
  origin: "auto" | "manual" | "before_reroll" | "before_rewrite";
  status: "pending" | "run" | "done" | "fail" | "expired"; error?: string;
  speechCues?: SubtitleCue[]; speechTimingVerified?: boolean;
  modelId?: string; nativeAudioVerified?: boolean;
  inputSnapshot?: TaskInput;
}
export interface StoryboardShot extends ShotSnapshot {
  shotId: string; locked: boolean; genStatus: "pending" | "run" | "done" | "fail" | "expired";
  curVer?: string; versions: ShotVersion[]; prompt: string; error?: string;
  compositeGenerationJobId?: string; compositeStatus?: "pending" | "run" | "done" | "fail"; compositeError?: string; compositeInputHash?: string;
}
export interface Storyboard {
  scenePlan: { strategy: "single" | "multiple"; scenes: string[]; mainScene: string; reason: string };
  lang: VideoLanguage; source: "auto" | "user_edited"; shots: StoryboardShot[];
  colorGrade: string; musicGenre: string; version: string;
}
export interface RenderStep { id: "confirm" | "concat" | "subtitles" | "audio"; status: "pending" | "run" | "done" | "skipped" | "fail"; reason?: string }
export interface VideoRender {
  renderId: string; storyboardHash: string; clips: { shotId: string; vid: string; clipUrl: string }[];
  status: "pending" | "run" | "done" | "fail"; steps: RenderStep[]; finalUrl?: string; subtitleUrl?: string;
  captionLines?: SubtitleCue[]; stale: boolean; error?: string; createdAt: string; completedAt?: string;
}
export interface WorkspaceTask {
  taskId: string; siteId: typeof AIVIDEOSUGC_SITE_ID; customerId: string; sceneId: SceneId; title: string;
  status: TaskStatus; createdAt: string; updatedAt: string; revision: number; cancelledAt?: string;
  input: TaskInput; voiceSnapshot?: ActorVoiceSnapshot; productBrief?: ProductBriefSnapshot; storyboard?: Storyboard; storyboardStale: boolean;
  sourceTemplate?: WorkspacePreset;
  sourceAnalysis?: {
    jobId: string; referenceAnalysisId: string; sourceAssetId: string; analysisRevision: number;
    consentId: string; consentRevision: number; synthetic: boolean; capabilityState: "mock_only" | "ready";
    segments: { start: number; end: number; role: "hook" | "body" | "cta"; visual: string }[];
    transcript: { start: number; end: number; text: string }[]; userEdited: boolean;
  };
  musicSelection?: WorkspaceMusicSelection;
  storyboardHistory: Storyboard[];
  revisions: { at: string; shotId?: string; field: string; before: unknown; after: unknown }[];
  video?: VideoRender; videoHistory: VideoRender[]; captionEdits?: CaptionEditDraft; error?: string;
  subtitleCompletion?: { at: string; opId: string; renderId: string }[];
  operation?: { action: string; state: "pending" | "run" | "done" | "fail" | "cancelled"; error?: string };
  featureJobs?: WorkspaceFeatureJob[];
}
export type WorkspaceFeatureId = "output_4k" | "video_extension" | "actor_replacement" | "advanced_shot_tools";
export interface WorkspaceFeatureCapabilities {
  output4k: boolean;
  videoExtension: boolean;
  actorReplacement: boolean;
  advancedShotTools: boolean;
}
export type WorkspaceFeatureRequest =
  | { feature: "output_4k"; shotId: string; resolution: "4k" }
  | { feature: "video_extension"; shotId: string; extendBySeconds: number }
  | { feature: "actor_replacement"; shotId: string; replacementActorId: string }
  | { feature: "advanced_shot_tools"; shotId: string; controls: AdvancedShotControls };
export interface AdvancedShotControls {
  cameraMotion?: "static" | "pan_left" | "pan_right" | "tilt_up" | "tilt_down" | "dolly_in" | "dolly_out";
  lens?: "wide" | "normal" | "telephoto";
  motionStrength?: number;
}
export interface WorkspaceFeatureJob {
  jobId: string;
  taskId: string;
  siteId: typeof AIVIDEOSUGC_SITE_ID;
  customerId: string;
  feature: WorkspaceFeatureId;
  shotId: string;
  request: WorkspaceFeatureRequest;
  status: "queued" | "cancelled";
  createdAt: string;
  idempotencyKey?: string;
  error?: string;
}
export interface ModelCapability {
  id: string; label: string; model: string; available: boolean; reason?: string;
  durations: number[]; aspects: VideoAspect[]; resolutions: string[]; nativeSpeech: boolean; audioReference: boolean;
  referenceImageMax: number; videoReferenceMax: number; audioReferenceMax: number;
  firstFrame: boolean; lastFrame: boolean; multiReference: boolean;
  features: WorkspaceFeatureCapabilities;
}
export interface WorkspaceCatalog {
  scenes: SceneSchema[]; actors: ActorAsset[]; models: ModelCapability[];
  languages: { value: VideoLanguage; label: string }[]; aspects: VideoAspect[];
  durations: { value: VideoDuration; label: string; credits: number | null; generationAvailable: boolean; reason?: string }[];
  limitations: string[];
  billing?: { creditsPerShot: number; currency: "credits"; note: string };
  composition?: { available: boolean; credits: number | null; reason?: string };
  subtitles?: { available: boolean; reason?: string };
  quickStarts?: { label: string; sceneId: SceneId; aspect?: VideoAspect; duration?: VideoDuration }[];
  imageReferenceMax?: number;
}
export class WorkspaceError extends Error {
  constructor(public code: string, public status = 400, public details?: unknown) { super(code); this.name = "WorkspaceError"; }
}
