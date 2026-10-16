import type { V2Image } from "./types";

export const HOME_EXPERIENCE_KINDS = ["hero", "picker", "steps", "features", "audience", "reviews"] as const;
export type HomeExperienceKind = (typeof HOME_EXPERIENCE_KINDS)[number];
export type HomeExperienceData = {
  version: 1;
  language: "en" | "zh-CN";
  labels: Record<string, string>;
  media: Record<string, V2Image>;
  blocks: { after: HomeExperienceKind; href: string; actions?: Record<string, string>; copy: Record<string, string>; presentation?: { sceneCategories?: Record<string, string[]>; steps?: { number: string; title: string; description: string }[] } }[];
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
