// Public media detail routes for AIVideosUGC.
//
// Every public media card (a picker card, a workspace case, or a template
// definition card) owns exactly one detail page derived from its current
// LivePage card. The workspace is reached only from that page, through the
// existing inert entry handoff.
//
// This module is client-safe: it contains route shapes and copy helpers only.

import { workspaceEntryTarget, type WorkspaceEntryTransfer } from "./entry-transfer";

export type MediaDetailKind = "photo" | "video";
export const MEDIA_DETAIL_PUBLIC_ORIGIN = "https://www.aivideosugc.com";

/** Directory prefix that owns the detail routes, keyed by media kind. */
export const MEDIA_DETAIL_ROOT: Record<MediaDetailKind, string> = {
  photo: "ai-image-generation",
  video: "ai-video-generation",
};

export const MEDIA_DETAIL_SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

/** Public card shape the detail page is rendered from. */
export type MediaDetailCard = {
  kind: MediaDetailKind;
  label: string;
  prompt: string;
  line?: string;
  href?: string;
  publicSlug?: string;
  sceneSlug?: string;
  tool?: string;
  aspect?: string;
  duration?: number | string;
  image: { src: string; alt?: string; w?: number; h?: number };
  video?: { src: string; poster?: { src: string; alt?: string }; width?: number; height?: number };
};

export function mediaDetailPath(kind: MediaDetailKind, slug: string | undefined): string | undefined {
  if (!slug || !MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  return `/${MEDIA_DETAIL_ROOT[kind]}/${slug}`;
}

/** Matches exactly the two-segment detail route (`/ai-video-generation/<slug>`). */
export function parseMediaDetailSegments(segments: readonly string[]): { kind: MediaDetailKind; slug: string } | undefined {
  if (segments.length !== 2) return undefined;
  const [root, slug] = segments;
  const kind: MediaDetailKind | undefined = root === MEDIA_DETAIL_ROOT.photo ? "photo" : root === MEDIA_DETAIL_ROOT.video ? "video" : undefined;
  if (!kind || !MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  return { kind, slug };
}

/**
 * The only way into the workspace from a detail page. The workspace re-reads
 * the current card from its LivePage row; nothing but the media locator crosses
 * the boundary.
 */
export function mediaDetailWorkspaceEntry(detailPath: string): { href: string; entry?: WorkspaceEntryTransfer } {
  const target = workspaceEntryTarget(detailPath, true);
  return { href: target.href, entry: target.transfer };
}

/** Plain, query-free href for a public media card. */
export function mediaCardHref(kind: MediaDetailKind, slug: string | undefined, fallback: string): string {
  return mediaDetailPath(kind, slug) ?? fallback;
}

export function mediaDetailTitle(card: Pick<MediaDetailCard, "label">): string {
  return card.label.trim().slice(0, 120);
}

function trimmed(value: string | undefined, max: number): string {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= max) return text;
  const clipped = text.slice(0, max - 1);
  const boundary = clipped.lastIndexOf(" ");
  return `${(boundary > max * 0.6 ? clipped.slice(0, boundary) : clipped).trimEnd()}…`;
}

/** Only curated public copy belongs in the detail description. */
export function mediaDetailIntro(card: Pick<MediaDetailCard, "line" | "prompt">): string {
  return trimmed(card.line, 240);
}

export function mediaDetailDescription(card: Pick<MediaDetailCard, "label" | "line" | "prompt">): string {
  const intro = mediaDetailIntro(card);
  const label = mediaDetailTitle(card);
  return (intro ? `${label}: ${intro}` : label).slice(0, 300);
}

/** Breadcrumb trail for a detail page: home -> owning directory -> the card. */
export function mediaDetailCrumbs(card: Pick<MediaDetailCard, "kind" | "label">, ownerLabel?: string): { label: string; href: string }[] {
  const rootPath = `/${MEDIA_DETAIL_ROOT[card.kind]}`;
  return [
    { label: "Home", href: "/" },
    { label: ownerLabel || (card.kind === "photo" ? "AI product photos" : "AI video ads"), href: rootPath },
    { label: mediaDetailTitle(card), href: "" },
  ];
}

// --- Actor detail routes -------------------------------------------------
//
// Actor detail pages are addressed by the actor's own name: /ai-actors/<name>.
// The first path segment under /ai-actors is still shared with the directory
// hubs, so those stay reserved.

export const ACTOR_DETAIL_ROOT = "ai-actors";

export const ACTOR_RESERVED_SEGMENTS: ReadonlySet<string> = new Set(["men", "women", "scene", "age-range"]);

export function actorDetailSlug(name: string): string | undefined {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || slug.length > 80 || ACTOR_RESERVED_SEGMENTS.has(slug)) return undefined;
  return slug;
}

export function actorDetailPath(name: string | undefined): string | undefined {
  if (!name) return undefined;
  const slug = actorDetailSlug(name);
  return slug ? `/${ACTOR_DETAIL_ROOT}/${slug}` : undefined;
}

/** True when a two-segment `/ai-actors/<segment>` request is an actor, not a hub. */
export function isActorDetailSegment(segment: string | undefined): boolean {
  if (!segment || !MEDIA_DETAIL_SLUG_PATTERN.test(segment)) return false;
  return !ACTOR_RESERVED_SEGMENTS.has(segment);
}

/** Legacy nested actor paths redirect to the flat canonical address. */
export function actorFlatRedirectTarget(segments: readonly string[]): string | undefined {
  if (segments.length !== 3) return undefined;
  const [root, gender, slug] = segments;
  if (root !== ACTOR_DETAIL_ROOT || (gender !== "men" && gender !== "women")) return undefined;
  if (!MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  return `/${ACTOR_DETAIL_ROOT}/${slug}`;
}
