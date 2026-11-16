import { workspaceEntryTarget, type WorkspaceEntryTransfer } from "@/lib/aidreamcapes-workspace/entry-transfer";
// Client-safe types and pure helpers for the AIVideosUGC in-site inspiration
// library. The server-only data loader (prisma, media catalog reads) lives in
// aidreamcapes-inspirations.ts and must never be imported by client components.

import { staticViewHref } from "@/lib/aidreamcapes-workspace/static-routes";
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

export type InspirationExampleVideo = {
  src: string;
  previewSrc?: string;
  poster?: { src: string; alt?: string };
  width?: number;
  height?: number;
};

/** Server/client-safe example shape used by the standalone page and embedded workspace tab. */
export type InspirationExample = Pick<InspirationCard, "id" | "label" | "imageSrc" | "imageAlt" | "pageTitle" | "kind" | "description" | "category"> & {
  /** Public card link: the media detail page when the example owns one. */
  createHref: string;
  /** Fixed workspace entry path used only by the example's creation CTA. */
  workspaceHref: string;
  entry?: WorkspaceEntryTransfer;
  /** The example's real generation prompt, cleaned for display. */
  prompt: string;
  /** Rendered result video when the underlying detail card ships one. */
  video?: InspirationExampleVideo;
  duration?: number;
};

/** Fixed inspiration page size, shared by the loader and the workspace pager. */
export const INSPIRATIONS_PAGE_SIZE = 20;

/** Seconds of the example video a card hover preview plays before looping. */
export const INSPIRATIONS_PREVIEW_SECONDS = 10;

/**
 * The workspace destination for one example. It never points at a content
 * page: the workspace path is fixed so the entry payload stays meaningful.
 */
function inspirationWorkspaceHref(card: Pick<InspirationCard, "toolSlug" | "prompt" | "kind" | "pageSlug" | "sceneSlug">, basePath = ""): string {
  const sceneRouteSlug = workspaceSceneRouteSlug(card.pageSlug, card.sceneSlug);
  if (sceneRouteSlug) return `${basePath}/app/create/scene/${sceneRouteSlug}`;
  const params = new URLSearchParams();
  if (card.kind === "photo") {
    params.set("tool_id", "image_generator");
  }
  if (basePath) params.set("view", card.kind === "photo" ? "images" : "video");
  params.set("tool", card.toolSlug);
  if (card.prompt) params.set("prompt", card.prompt);
  return `${staticViewHref(basePath, card.kind === "photo" ? "images" : "video")}?${params.toString()}`;
}

export type InspirationPage = {
  cards: InspirationExample[];
  nextOffset: number | null;
  total: number;
  counts: { all: number; video: number; photo: number };
  categories: string[];
};

export function inspirationCreateTarget(card: Parameters<typeof inspirationWorkspaceHref>[0], basePath = "") {
  const target = workspaceEntryTarget(inspirationWorkspaceHref(card, basePath), true);
  if (target.transfer?.scene && card.kind === "photo") {
    target.transfer.view = "images";
    target.href = staticViewHref(basePath, "images");
  }
  return target;
}

/**
 * Public card link. A card that owns a detail page links there first; the
 * workspace stays behind that page's own CTA. Cards without a slug keep their
 * current workspace destination.
 */
export function inspirationCreateHref(card: Parameters<typeof inspirationWorkspaceHref>[0] & Pick<InspirationCard, "publicSlug">, basePath = ""): string {
  const mediaPath = workspaceMediaRoutePath(card.kind, card.publicSlug);
  if (mediaPath) return `${basePath}${mediaPath}`;
  return inspirationCreateTarget(card, basePath).href;
}

/**
 * Both destinations for one example, resolved once where the cards are built:
 * the card keeps its public link while the creation CTA always enters the
 * fixed workspace path that owns the entry payload.
 */
export function inspirationExampleLinks(
  card: Parameters<typeof inspirationWorkspaceHref>[0] & Pick<InspirationCard, "publicSlug">,
  basePath = ""
): Pick<InspirationExample, "createHref" | "workspaceHref" | "entry"> {
  const workspace = inspirationCreateTarget(card, basePath);
  return {
    createHref: inspirationCreateHref(card, basePath),
    workspaceHref: workspace.href,
    entry: workspace.transfer
  };
}
