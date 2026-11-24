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

/**
 * Public name of each detail root. A breadcrumb is navigation, so it has to
 * read like the address it links to. The directory page headline is a
 * marketing sentence and never belongs in a trail.
 */
const MEDIA_DETAIL_ROOT_LABEL: Record<MediaDetailKind, string> = {
  photo: "AI Image Generation",
  video: "AI Video Generation",
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
  /** Canonical facet directory slugs this card is directly placed in. */
  placement?: string[];
  image: { src: string; alt?: string; w?: number; h?: number };
  video?: { src: string; previewSrc?: string; poster?: { src: string; alt?: string }; width?: number; height?: number };
  /** Assets the example was built from, when the card lists them explicitly. */
  referenceImages?: { src: string; alt?: string }[];
  referenceVideos?: { src: string; poster?: { src: string; alt?: string } }[];
};

export type MediaDetailReferenceImage = { src: string; alt?: string };
export type MediaDetailReferenceVideo = { src: string; poster?: string; alt?: string };
export type MediaDetailParameter = { label: string; value: string };
export type MediaDetailReferences = { images: MediaDetailReferenceImage[]; videos: MediaDetailReferenceVideo[] };

export function mediaDetailPath(kind: MediaDetailKind, slug: string | undefined): string | undefined {
  if (!slug || !MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  return `/${MEDIA_DETAIL_ROOT[kind]}/${slug}`;
}

/**
 * Dedicated watch page for a video card.
 *
 * Google indexes a video only when its page is a watch page: the video is the
 * main content, the page exists for that video, and VideoObject.url points at
 * it. The template detail page keeps the prompt, references and related cards,
 * so it is an entry page, not a watch page. Photos have no watch page.
 */
export function mediaWatchPath(kind: MediaDetailKind, slug: string | undefined): string | undefined {
  if (kind !== "video" || !slug || !MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  return `/watch/${slug}`;
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

/** Only curated public copy belongs in the detail description. The lead is
 * the page's per-example paragraph, so the cap leaves room for a short
 * curated passage (2-4 sentences) instead of one clipped sentence. */
export function mediaDetailIntro(card: Pick<MediaDetailCard, "line" | "prompt">): string {
  return trimmed(card.line, 600);
}

/**
 * The generation prompt the workspace opens this template with. It is the same
 * text the customer edits in the prompt field, so it is public copy. Cards
 * without a prompt render no prompt block.
 *
 * Paragraph breaks are kept, because the prompt is written as labelled
 * sections and the customer reads them one by one. The cap stays above the
 * longest published prompt, so the copy button always hands over the complete
 * instruction, including its closing negative block.
 */
export function mediaDetailPrompt(card: Pick<MediaDetailCard, "prompt">): string {
  const paragraphs = String(card.prompt ?? "")
    .split(/\n{2,}/)
    // A paragraph keeps its single line breaks, because the prompt is written
    // as labelled sections and a timed shot list.
    .map((paragraph) => paragraph.replace(/[ \t]+/g, " ").replace(/[ \t]*\n[ \t]*/g, "\n").trim())
    .filter(Boolean);
  const text = paragraphs.join("\n\n");
  if (!text) return "";
  return text.length > 4000 ? `${text.slice(0, 3999).trimEnd()}…` : text;
}

/**
 * Search snippets are truncated around 155 characters. Cut at a sentence or
 * word boundary so the visible snippet ends on a whole phrase instead of the
 * middle of a word; never fall below a readable minimum.
 */
const META_DESCRIPTION_LIMIT = 155;

function clampMetaDescription(text: string): string {
  const value = text.replace(/\s+/gu, " ").trim();
  if (value.length <= META_DESCRIPTION_LIMIT) return value;
  const cut = value.slice(0, META_DESCRIPTION_LIMIT);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "), cut.lastIndexOf("; "), cut.lastIndexOf(", "));
  const at = sentence >= 100 ? sentence + 1 : cut.lastIndexOf(" ");
  const clipped = value.slice(0, at > 60 ? at : META_DESCRIPTION_LIMIT).replace(/[\s,;:–—-]+$/u, "");
  return clipped.length >= 80 ? clipped : value.slice(0, META_DESCRIPTION_LIMIT).trim();
}

export function mediaDetailDescription(
  card: Pick<MediaDetailCard, "label" | "line" | "prompt" | "video" | "duration">,
  kind?: MediaDetailKind,
  surface: "detail" | "watch" = "detail"
): string {
  const intro = mediaDetailIntro(card);
  const label = mediaDetailTitle(card);
  if (surface === "watch") {
    const seconds = Math.round(Number(card.duration) || 0);
    const length = seconds > 0 ? `${seconds}-second ` : "";
    const lead = intro ? ` ${intro}` : "";
    return clampMetaDescription(`Watch ${label} — the finished ${length}AI product video made with AIVideosUGC.${lead} See the prompt and template page to recreate it with your own product.`);
  }
  if (intro) return clampMetaDescription(`${label}: ${intro}`);
  // A card without a one-line intro would otherwise repeat its label as the
  // whole search description. Describe what the page actually shows instead:
  // the finished example plus the prompt behind it. The video claim follows
  // the real file, never the card kind.
  const example = kind === "photo" || !card.video?.src
    ? "an AI product photo example made with AIVideosUGC"
    : "an AI product video example made with AIVideosUGC";
  return clampMetaDescription(`${label} — ${example}. See the finished result and copy the prompt to generate your own version with your product photos.`);
}

/**
 * The assets this result was generated from. The card's own image is the
 * visible example asset; any explicitly listed references extend it. The
 * finished example video (`card.video`) is the result, never a reference, so
 * it is excluded here.
 */
export function mediaDetailReferences(card: MediaDetailCard): MediaDetailReferences {
  const images: MediaDetailReferenceImage[] = [];
  const seen = new Set<string>();
  const addImage = (src: string | undefined, alt: string | undefined) => {
    const value = (src ?? "").trim();
    if (!value || seen.has(value)) return;
    seen.add(value);
    images.push({ src: value, ...(alt ? { alt } : {}) });
  };
  addImage(card.image.src, card.image.alt);
  for (const image of card.referenceImages ?? []) addImage(image.src, image.alt);
  const videos: MediaDetailReferenceVideo[] = [];
  const seenVideos = new Set<string>();
  for (const video of card.referenceVideos ?? []) {
    const src = video.src.trim();
    if (!src || seenVideos.has(src)) continue;
    seenVideos.add(src);
    videos.push({ src, ...(video.poster?.src ? { poster: video.poster.src } : {}), ...(video.poster?.alt ? { alt: video.poster.alt } : {}) });
  }
  return { images: images.slice(0, 4), videos: videos.slice(0, 4) };
}

/** The generation settings this result was produced with. */
export function mediaDetailParameters(card: Pick<MediaDetailCard, "aspect" | "duration" | "tool">): MediaDetailParameter[] {
  const parameters: MediaDetailParameter[] = [];
  if (card.aspect) parameters.push({ label: "Format", value: card.aspect });
  if (card.duration) parameters.push({ label: "Length", value: `${card.duration}s` });
  if (card.tool) parameters.push({ label: "Tool", value: card.tool.replace(/-/g, " ") });
  return parameters;
}

/** Breadcrumb trail for a detail page: home -> example gallery -> owning directory -> the card. */
export function mediaDetailCrumbs(card: Pick<MediaDetailCard, "kind" | "label">): { label: string; href: string }[] {
  const rootPath = `/${MEDIA_DETAIL_ROOT[card.kind]}`;
  return [
    { label: "Home", href: "/" },
    // The /templates gallery aggregates every public example of this kind; it
    // gives each detail page a real link back to the browsing context visitors
    // come from (and an extra internal link to the gallery). Point at the bare
    // /templates URL — that is the canonical form both the sitemap and the
    // ?kind variants converge on.
    { label: "Examples", href: "/templates" },
    { label: MEDIA_DETAIL_ROOT_LABEL[card.kind], href: rootPath },
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
