// Client-safe types and pure helpers for the AIVideosUGC in-site inspiration
// library. The server-only data loader (prisma, media catalog reads) lives in
// aidreamcapes-inspirations.ts and must never be imported by client components.

import { workspaceMediaRoutePath, workspaceSceneRouteSlug } from "@/lib/aidreamcapes-workspace/preset-contract";

export type InspirationCard = {
  id: string;
  ref: string;
  label: string;
  prompt: string;
  imageSrc: string;
  imageAlt: string;
  toolSlug: string;
  pageSlug: string;
  sceneSlug?: string;
  publicSlug?: string;
  pageTitle: string;
  kind: "video" | "photo";
  description: string;
  category: string;
};

/** Server/client-safe example shape used by the standalone page and embedded workspace tab. */
export type InspirationExample = Pick<InspirationCard, "id" | "label" | "imageSrc" | "imageAlt" | "pageTitle" | "kind" | "description" | "category"> & { createHref: string };

export function inspirationCreateHref(card: Pick<InspirationCard, "toolSlug" | "prompt" | "kind" | "pageSlug" | "sceneSlug" | "publicSlug">, basePath = ""): string {
  const mediaPath = workspaceMediaRoutePath(card.kind, card.publicSlug);
  if (mediaPath) return `${basePath}${mediaPath}`;
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
