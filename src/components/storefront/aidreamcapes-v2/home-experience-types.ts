import type { V2Image, V2MoreSection, V2Video } from "./types";

export type HomeCampaignSections = {
  workflow: V2MoreSection;
};

export type HomeWorkflowDemo = {
  /** 1: original shot-grid storyboard and clip assembly examples. 2: draft sheet (product + presenter + dialogue), generation progress and a real finished example clip. */
  version: 1 | 2;
  labels: Record<string, string>;
  scenes: { id: string; label: string; media: string }[];
  shots: { label: string; media: string; description: string }[];
  aspects: string[];
  durations: { value: string; label: string }[];
  /** v2: key into HomeExperienceData.videos for the finished example clip shown in step 06. */
  video?: string;
  /** v2: brief form duration preselected before the user chooses. */
  defaultDuration?: string;
};

/** "One platform, infinite possibilities": workspace capability rows with looping demos.
 * Copy lives in the block copy record under wf* keys; templates reference page media. */
export type HomeWorkspaceFlowDemo = {
  version: 1;
  /** Template cards: `video` keys resolve against HomeExperienceData.videos, `media` keys against HomeExperienceData.media. Exactly one of the two per card. */
  templates: { id: string; label: string; video?: string; media?: string }[];
  /** Key into HomeExperienceData.videos for the Subtitle Studio demo clip. */
  captionsVideo: string;
};

export const HOME_EXPERIENCE_KINDS = ["hero", "picker", "steps", "features", "audience", "reviews"] as const;
export type HomeExperienceKind = (typeof HOME_EXPERIENCE_KINDS)[number];
export type HomeExperienceData = {
  version: 1;
  language: "en" | "zh-CN";
  labels: Record<string, string>;
  media: Record<string, V2Image>;
  /** Example clips referenced by blocks; keys are stable media ids, not copy. */
  videos?: Record<string, V2Video>;
  blocks: {
    after: HomeExperienceKind;
    href: string;
    actions?: Record<string, string>;
    copy: Record<string, string>;
    presentation?: {
      contentLayout?: "benefits-workflow";
      workflowDemo?: HomeWorkflowDemo;
      workflowVisuals?: { kind: "product" | "presenter" | "brief" | "storyboard" | "assembly" | "review"; media: string[]; label: string; detail: string; preview: string }[];
      sceneCategories?: Record<string, string[]>;
      steps?: { number: string; title: string; description: string }[];
      /** Tabbed presenter showcase: presenter photo + product photo = generated video. */
      presenterShowcase?: {
        presenters: { key: string; tab: string; scene: string; quote: string; quoteWho: string; actorMedia: string; productMedia: string; video: string }[];
        connectors: { plus: string; arrow: string };
        cards: { presenter: string; product: string; productSub: string; video: string; videoSub: string };
        stepsTitle: string;
        steps: { number: string; title: string; description: string }[];
        spec: string;
      };
      /** Workspace capability rows (assistant, prompt optimizer, example templates, Subtitle Studio). */
      workspaceFlow?: HomeWorkspaceFlowDemo;
    };
  }[];
};

/** Page-owned translations; destinations and identifiers retain their original values. */
export function homePresentationValue<T>(value: T, labels: Record<string, string>): T {
  if (typeof value === "string") return (labels[value] ?? value) as T;
  if (Array.isArray(value)) return value.map((item) => homePresentationValue(item, labels)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, homePresentationValue(item, labels)])) as T;
  }
  return value;
}
