import type { V2Image, V2MoreSection, V2Video } from "./types";

export type HomeCampaignSections = {
  workflow: V2MoreSection;
};

export type HomeWorkflowDemo = {
  version: 1;
  labels: Record<string, string>;
  scenes: { id: string; label: string; media: string }[];
  shots: { label: string; media: string; description: string }[];
  aspects: string[];
  durations: { value: string; label: string }[];
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
