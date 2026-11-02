import type { V2Image, V2Item } from "./types";

export type HomeToolKind = "url" | "text" | "video" | "image" | "avatar" | "twin";
export type HomeBrandTool = V2Item & { id: HomeToolKind; href: string; cta: string; img: V2Image };
export type HomeToolMedia = { id: string; label: string; image: V2Image };
export type HomeToolVideo = { src: string; poster: V2Image };
export type HomeToolGalleryImage = { image: V2Image; label: string };
export type HomeToolActorCard = { image: V2Image; name: string; role: string; video: string };
export type HomeBrandToolsDemo = {
  version: 2 | 3;
  labels: Record<string, string>;
  // Legacy v2 fields. Kept populated so the previous layout still renders while
  // the v3 data rolls out; the component prefers the v3 fields when present.
  product: V2Image;
  presenter: V2Image;
  twin: V2Image;
  shots: HomeToolMedia[];
  actors: HomeToolMedia[];
  tabs: { value: string; label: string }[];
  aspects: { value: string; label: string }[];
  durations: { value: string; label: string }[];
  // v3: design-v4 tools module (per-card media, motion demos, typed inputs).
  urlTyping?: string;
  importTitle?: string;
  importCount?: string;
  importGallery?: HomeToolGalleryImage[];
  ideaTyping?: string;
  phoneVideo?: HomeToolVideo;
  formula?: {
    actor: V2Image;
    product: V2Image;
    video: HomeToolVideo;
    actorLabel: string;
    productLabel: string;
    videoLabel: string;
    hint: string;
  };
  imageToVideo?: {
    source: V2Image;
    video: HomeToolVideo;
    sourceLabel: string;
    videoLabel: string;
    promptTyping: string;
  };
  actorWall?: { rows: HomeToolActorCard[][] };
  twinPair?: { source: V2Image; result: HomeToolVideo; hint: string };
};
