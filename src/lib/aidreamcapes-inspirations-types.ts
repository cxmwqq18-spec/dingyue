// Client-safe types and pure helpers for the AIVideosUGC in-site inspiration
// library. The server-only data loader (prisma, media catalog reads) lives in
// aidreamcapes-inspirations.ts and must never be imported by client components.

import { workspaceSceneRouteSlug } from "@/lib/aidreamcapes-workspace/preset-contract";

export type InspirationCard = {
  ref: string;
  label: string;
  prompt: string;
  imageSrc: string;
  imageAlt: string;
  toolSlug: string;
  pageSlug: string;
  sceneSlug?: string;
  pageTitle: string;
  kind: "video" | "photo";
  description: string;
  category: string;
};

export function inspirationCreateHref(card: Pick<InspirationCard, "toolSlug" | "prompt" | "kind" | "pageSlug" | "sceneSlug">, basePath = ""): string {
  const sceneRouteSlug = workspaceSceneRouteSlug(card.pageSlug, card.sceneSlug);
  if (sceneRouteSlug) return `${basePath}/app/create/scene/${sceneRouteSlug}`;
  const params = new URLSearchParams();
  if (card.kind === "photo") {
    params.set("tool_id", "image_generator");
  }
  if (basePath) params.set("view", card.kind === "photo" ? "images" : "video");
  params.set("tool", card.toolSlug);
  if (card.prompt) params.set("prompt", card.prompt);
  return `${basePath}/app/create?${params.toString()}`;
}
