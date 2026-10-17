import type { V2Image, V2Item } from "./types";

export type HomeToolKind = "url" | "text" | "video" | "image" | "avatar" | "twin";
export type HomeBrandTool = V2Item & { id: HomeToolKind; href: string; cta: string; img: V2Image };
export type HomeToolMedia = { id: string; label: string; image: V2Image };
export type HomeBrandToolsDemo = {
  version: 2;
  labels: Record<string, string>;
  product: V2Image;
  presenter: V2Image;
  twin: V2Image;
  shots: HomeToolMedia[];
  actors: HomeToolMedia[];
  tabs: { value: string; label: string }[];
  aspects: { value: string; label: string }[];
  durations: { value: string; label: string }[];
};
