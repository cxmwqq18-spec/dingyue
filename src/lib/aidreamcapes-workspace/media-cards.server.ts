import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "./types";
import type { MediaDetailCard, MediaDetailKind } from "./media-detail";
import { mediaDetailDescription, mediaDetailPath } from "./media-detail";
import { placementValues } from "./media-placement";
import { presetFromCard, presetGenerationIdentity } from "./presets.server";

// Every public media card shape is stored in LivePage.contentJson. The detail
// page, the directory media grid and the audit script all have to read the same
// four shapes; this module is the single runtime extractor.

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

/** Explicit reference assets a card may list; `video` (the result) is never read here. */
function referenceImages(value: unknown): { src: string; alt?: string }[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const images: { src: string; alt?: string }[] = [];
  for (const item of value) {
    const entry = record(item);
    const src = typeof item === "string" ? str(item) : str(entry?.src);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const alt = typeof item === "string" ? undefined : str(entry?.alt);
    images.push({ src, ...(alt ? { alt } : {}) });
  }
  return images;
}

function referenceVideos(value: unknown): { src: string; poster?: { src: string; alt?: string } }[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const videos: { src: string; poster?: { src: string; alt?: string } }[] = [];
  for (const item of value) {
    const entry = record(item);
    const src = typeof item === "string" ? str(item) : str(entry?.src);
    if (!src || seen.has(src)) continue;
    seen.add(src);
    const poster = record(entry?.poster);
    const posterSrc = str(poster?.src);
    const posterAlt = str(poster?.alt);
    videos.push({ src, ...(posterSrc ? { poster: { src: posterSrc, ...(posterAlt ? { alt: posterAlt } : {}) } } : {}) });
  }
  return videos;
}

/**
 * Cards that can own a public detail page:
 * template definition cards, picker cards, workspace cases and legacy example
 * gallery items. Keep this in sync with pagesOwningSlug in media-detail.server.
 */
export function cardsFromContent(contentJson: unknown): RecordValue[] {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const cards: RecordValue[] = [];
  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) cards.push(definition!.card as RecordValue);
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) cards.push(...picker.cards.map(record).filter((item): item is RecordValue => Boolean(item)));
    if (Array.isArray(data?.workspaceCases)) cards.push(...data.workspaceCases.map(record).filter((item): item is RecordValue => Boolean(item)));
    // Legacy example galleries (`data.examples.groups[*].items[*]`) are cards too:
    // they carry `title` + `kind` instead of `label` + `kind` and can own a
    // public detail slug like any other media card.
    const examples = record(data?.examples);
    if (examples && Array.isArray(examples.groups)) {
      for (const group of examples.groups) {
        const items = record(group)?.items;
        if (Array.isArray(items)) cards.push(...items.map(record).filter((item): item is RecordValue => Boolean(item)));
      }
    }
  }
  return cards;
}

/** Photo stays photo; clips and scenes are moving pictures. */
export function mediaKindOf(value: unknown): MediaDetailKind | undefined {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

export function toDetailCard(value: RecordValue): MediaDetailCard | undefined {
  const image = record(value.image);
  const src = str(image?.src);
  const label = str(value.label) ?? str(value.title);
  const kind = mediaKindOf(value.kind);
  if (!src || !label || !kind) return undefined;
  const video = record(value.video);
  const poster = record(video?.poster);
  const width = num(image?.w);
  const height = num(image?.h);
  const duration = value.duration;
  const imageAlt = str(image?.alt);
  const line = str(value.line);
  const href = str(value.href);
  const publicSlug = str(value.publicSlug);
  const sceneSlug = str(value.sceneSlug);
  const tool = str(value.tool);
  const aspect = str(value.aspect);
  const placement = placementValues(value.placement);
  const videoSrc = str(video?.src);
  const videoPreviewSrc = str(video?.previewSrc);
  const posterSrc = str(poster?.src);
  const posterAlt = str(poster?.alt);
  const videoWidth = num(video?.width);
  const videoHeight = num(video?.height);
  const videoPublishedAt = str(video?.publishedAt);
  const refImages = referenceImages(value.referenceImages ?? value.referenceImageUrls ?? value.referenceAssets);
  const refVideos = referenceVideos(value.referenceVideos ?? value.referenceVideoUrls);
  return {
    kind,
    label,
    prompt: str(value.prompt) ?? "",
    ...(line ? { line } : {}),
    ...(href ? { href } : {}),
    ...(publicSlug ? { publicSlug } : {}),
    ...(sceneSlug ? { sceneSlug } : {}),
    ...(tool ? { tool } : {}),
    ...(aspect ? { aspect } : {}),
    ...(placement.length ? { placement } : {}),
    ...(typeof duration === "number" || typeof duration === "string" ? { duration } : {}),
    image: {
      src,
      ...(imageAlt ? { alt: imageAlt } : {}),
      ...(width ? { w: width } : {}),
      ...(height ? { h: height } : {})
    },
    ...(videoSrc
      ? {
          video: {
            src: videoSrc,
            ...(videoPreviewSrc ? { previewSrc: videoPreviewSrc } : {}),
            ...(posterSrc ? { poster: { src: posterSrc, ...(posterAlt ? { alt: posterAlt } : {}) } } : {}),
            ...(videoWidth ? { width: videoWidth } : {}),
            ...(videoHeight ? { height: videoHeight } : {}),
            ...(videoPublishedAt ? { publishedAt: videoPublishedAt } : {})
          }
        }
      : {}),
    ...(refImages.length ? { referenceImages: refImages } : {}),
    ...(refVideos.length ? { referenceVideos: refVideos } : {})
  };
}

export type OwnerTemplate = {
  path: string;
  name: string;
  cardSlug?: string;
  /** industries + platforms + occasions, deduplicated. */
  facets: string[];
};

/** The page's template definition, when it owns a reusable template card. */
export function templateDefinitionFrom(contentJson: unknown, ownerPath: string): OwnerTemplate | undefined {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    const definition = record(data?.templateDefinition);
    if (!definition) continue;
    const card = record(definition.card);
    const cardSlug = str(card?.publicSlug);
    const facets = [...new Set([
      ...stringList(definition.industries),
      ...stringList(definition.platforms),
      ...stringList(definition.occasions)
    ])].sort();
    return {
      path: ownerPath,
      name: str(definition.name) ?? str(card?.label) ?? ownerPath,
      ...(cardSlug ? { cardSlug } : {}),
      facets
    };
  }
  return undefined;
}

export type MediaDetailSitemapEntry = {
  kind: MediaDetailKind;
  slug: string;
  label: string;
  description: string;
  imagePath: string;
  imageAlt?: string;
  videoPath?: string;
  /** Poster frame the watch page and VideoObject use. */
  videoPosterPath?: string;
  durationSeconds?: number;
  /** Stable publication date for sitemap/video indexing when declared. */
  publishedAt?: string;
  updatedAt: Date;
};

/** One public example for the /templates gallery. */
export type MediaGalleryEntry = {
  kind: MediaDetailKind;
  slug: string;
  label: string;
  href: string;
  image: { src: string; alt?: string; w?: number; h?: number };
  /** Present when the card ships a rendered result video; the gallery previews it. */
  video?: { src: string; previewSrc?: string; poster?: { src: string; alt?: string }; width?: number; height?: number };
  duration?: number;
  updatedAt: Date;
};

type EnumeratedDetailCard = {
  kind: MediaDetailKind;
  slug: string;
  card: MediaDetailCard;
  updatedAt: Date;
  /** The one LivePage row that owns this detail slug after the single-owner filter. */
  ownerSlug: string;
};

/**
 * Enumerate every public media detail card with its owning row's timestamp.
 * Detail pages are rendering projections of card data, so the sitemap, the
 * /templates gallery and the detail resolver all read the same relational
 * rows. A card is listed only when exactly one LivePage row owns it — the
 * same single-owner rule the detail resolver applies. Alias cards
 * (detailAliasOf) stay out by default because their canonical detail page is
 * the alias target's; the sitemap path opts in to reviewed `detailAliasPublish`
 * examples and never lists a `detailAliasMerge` shortcut that answers 308.
 */
async function enumerateSingleOwnerDetailCards(includePublishedAliases = false): Promise<EnumeratedDetailCard[]> {
  const rows = await prisma.livePage.findMany({
    where: { siteId: AIVIDEOSUGC_SITE_ID },
    select: { slug: true, contentJson: true, updatedAt: true }
  });
  const rowCards = rows.map((row) => ({ row, cards: cardsFromContent(row.contentJson) }));
  // A slug is owned when a card publishes it as publicSlug, but a card on any
  // other page can also claim it through publicAliases (the detail resolver
  // treats both as ownership). A slug claimed as an alias anywhere therefore
  // has more than one owner row and must stay out of the sitemap.
  const aliasClaims = new Set<string>();
  // Alias cards carry two reviewed flags:
  //   detailAliasMerge   - a duplicate shortcut; the resolver answers 308, so it
  //                        is never listed in the sitemap.
  //   detailAliasPublish - a distinct example that renders its own page and is
  //                        explicitly approved for the sitemap.
  // Without either flag an alias keeps its historical behaviour (renders, not
  // listed). The index below resolves the target card for the identity guard.
  const cardIndex = new Map<string, { raw: RecordValue; row: (typeof rowCards)[number]["row"] }>();
  for (const { row, cards } of rowCards) {
    for (const raw of cards) {
      if (!raw) continue;
      const slug = str(raw.publicSlug);
      if (slug && !cardIndex.has(slug)) cardIndex.set(slug, { raw, row });
      const aliases = raw.publicAliases;
      if (!Array.isArray(aliases)) continue;
      for (const alias of aliases) {
        const aliasSlug = str(alias);
        if (aliasSlug) aliasClaims.add(aliasSlug);
      }
    }
  }
  type Candidate = Omit<EnumeratedDetailCard, "ownerSlug"> & { owners: Set<string> };
  const byKey = new Map<string, Candidate>();
  for (const { row, cards } of rowCards) {
    for (const raw of cards) {
      if (!raw) continue;
      const card = toDetailCard(raw);
      const aliasOf = str(raw.detailAliasOf);
      let includeAlias = false;
      if (aliasOf && includePublishedAliases) {
        const publishAlias = (raw as { detailAliasPublish?: unknown }).detailAliasPublish === true;
        const mergeAlias = (raw as { detailAliasMerge?: unknown }).detailAliasMerge === true;
        // A published alias is still skipped when the resolver would merge it
        // through reviewed preset identity; the sitemap must only list URLs
        // that answer 200.
        const target = cardIndex.get(aliasOf);
        const targetDetail = target ? toDetailCard(target.raw) : undefined;
        const currentIdentity = presetGenerationIdentity(presetFromCard(row, row.slug, raw));
        const targetIdentity = target
          ? presetGenerationIdentity(presetFromCard(target.row, target.row.slug, target.raw))
          : undefined;
        const identityMerges = Boolean(target && currentIdentity && currentIdentity === targetIdentity
          && !str(target.raw.detailAliasOf)
          && (!card?.video?.src || card?.video?.src === targetDetail?.video?.src));
        includeAlias = publishAlias && !mergeAlias && !identityMerges;
      }
      if (!card || !card.publicSlug || (aliasOf && !includeAlias) || aliasClaims.has(card.publicSlug)) continue;
      const key = `${card.kind}:${card.publicSlug}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.owners.add(row.slug);
      } else {
        byKey.set(key, { kind: card.kind, slug: card.publicSlug, card, updatedAt: row.updatedAt, owners: new Set([row.slug]) });
      }
    }
  }
  return [...byKey.values()]
    .filter((candidate) => candidate.owners.size === 1 && !aliasClaims.has(candidate.slug))
    .map(({ owners, ...entry }) => ({ ...entry, ownerSlug: [...owners][0]! }));
}

/**
 * Process-level cache over the enumeration. Every storefront page request used
 * to re-scan the whole LivePage table (a full-contentJson parse per request),
 * which made each CDN cache MISS/SWR revalidation pay ~10s of origin work. All
 * consumers (gallery API, /templates SSR, sitemap) are public and tolerate
 * this short TTL; batch imports can call the invalidation hook for immediate
 * visibility. The in-flight promise also collapses concurrent misses.
 */
const MEDIA_CARD_CACHE_TTL_MS = 90_000;
let mediaCardCache: { at: number; entries: EnumeratedDetailCard[] } | null = null;
let mediaCardInflight: Promise<EnumeratedDetailCard[]> | null = null;
// The sitemap is the only consumer that also lists reviewed `detailAliasPublish`
// example pages. The gallery and the inspiration library keep the historical
// enumeration (no alias cards), so publishing an alias never adds a duplicate
// card to the public galleries.
let publishedAliasCache: { at: number; entries: EnumeratedDetailCard[] } | null = null;
let publishedAliasInflight: Promise<EnumeratedDetailCard[]> | null = null;

export function invalidateAidreamcapesMediaCardCaches(): void {
  mediaCardCache = null;
  mediaCardInflight = null;
  publishedAliasCache = null;
  publishedAliasInflight = null;
}

async function enumerateSingleOwnerDetailCardsCached(includePublishedAliases = false): Promise<EnumeratedDetailCard[]> {
  if (!includePublishedAliases) {
    if (mediaCardCache && Date.now() - mediaCardCache.at < MEDIA_CARD_CACHE_TTL_MS) return mediaCardCache.entries;
    if (!mediaCardInflight) {
      mediaCardInflight = enumerateSingleOwnerDetailCards()
        .then((entries) => {
          mediaCardCache = { at: Date.now(), entries };
          return entries;
        })
        .finally(() => {
          mediaCardInflight = null;
        });
    }
    return mediaCardInflight;
  }
  if (publishedAliasCache && Date.now() - publishedAliasCache.at < MEDIA_CARD_CACHE_TTL_MS) return publishedAliasCache.entries;
  if (!publishedAliasInflight) {
    publishedAliasInflight = enumerateSingleOwnerDetailCards(true)
      .then((entries) => {
        publishedAliasCache = { at: Date.now(), entries };
        return entries;
      })
      .finally(() => {
        publishedAliasInflight = null;
      });
  }
  return publishedAliasInflight;
}

/**
 * Enumerate every public media detail card for the AIVideosUGC storefront.
 * Future videos added to any card are picked up automatically.
 */
export async function listAidreamcapesMediaDetailEntries(): Promise<MediaDetailSitemapEntry[]> {
  const cards = await enumerateSingleOwnerDetailCardsCached(true);
  return cards.map(({ card, slug, kind, updatedAt }) => ({
    kind,
    slug,
    label: card.label,
    description: mediaDetailDescription(card, kind),
    imagePath: card.image.src,
    ...(card.image.alt ? { imageAlt: card.image.alt } : {}),
    ...(card.video?.src ? { videoPath: card.video.src } : {}),
    ...(card.video?.src ? { videoPosterPath: card.video.poster?.src ?? card.image.src } : {}),
    ...(card.duration !== undefined ? { durationSeconds: Number(card.duration) || undefined } : {}),
    ...(card.video?.publishedAt ? { publishedAt: card.video.publishedAt } : {}),
    updatedAt
  }));
}

/**
 * Cluster key for near-duplicate suppression in the gallery: cards from one
 * product/actor batch share a slug prefix (e.g. `open-ear-earbuds-run-and-call`
 * and `open-ear-earbuds-park-walk`), and a pure updatedAt sort lands them
 * adjacent. Strip the trailing numeric suffix, keep the first two semantic
 * segments. Deterministic, no data changes needed.
 */
export function galleryClusterKey(slug: string): string {
  return slug.replace(/-[0-9]+$/, "").split("-").slice(0, 2).join("-");
}

/**
 * Spread same-cluster cards at least `minGap` positions apart while keeping
 * the newest-first macro order. Items that would sit too close to a previous
 * cluster member are reinserted after the earliest allowed position in a
 * second pass. Pure and deterministic: the SSR gallery, its ?page=N pages and
 * the media-integrity audit always agree on the order.
 */
export function spreadGalleryByCluster<T extends { slug: string }>(items: T[], minGap = 4): T[] {
  const result: T[] = [];
  const deferred: T[] = [];
  const lastPos = new Map<string, number>();
  for (const item of items) {
    const key = galleryClusterKey(item.slug);
    const last = lastPos.get(key);
    if (last !== undefined && result.length - last < minGap) {
      deferred.push(item);
    } else {
      result.push(item);
      lastPos.set(key, result.length - 1);
    }
  }
  for (const item of deferred) {
    const key = galleryClusterKey(item.slug);
    let insertAt = result.length;
    for (let index = 0; index < result.length; index++) {
      if (galleryClusterKey(result[index].slug) === key) insertAt = Math.max(insertAt, index + minGap + 1);
    }
    result.splice(Math.min(insertAt, result.length), 0, item);
  }
  return result;
}

/**
 * Every public example for the /templates gallery: video-attached cards first
 * (newest first by the owning row's updatedAt, slug as the stable tiebreak),
 * image-only cards last. Same-batch near duplicates are spread apart. Same
 * ownership rules as the sitemap: exactly one owner row, no aliases.
 */
export const listAidreamcapesExampleGalleryEntries = cache(async (): Promise<MediaGalleryEntry[]> => {
  const cards = await enumerateSingleOwnerDetailCardsCached();
  const entries = cards
    .map(({ card, slug, kind, updatedAt }) => ({
      kind,
      slug,
      label: card.label,
      href: mediaDetailPath(kind, slug) ?? `/ai-${kind === "photo" ? "image" : "video"}-generation/${slug}`,
      image: card.image,
      ...(card.video?.src ? { video: card.video } : {}),
      ...(card.duration !== undefined ? { duration: Number(card.duration) || undefined } : {}),
      updatedAt
    }))
    .sort((left, right) =>
      Number(Boolean(right.video)) - Number(Boolean(left.video)) ||
      (right.updatedAt.getTime() - left.updatedAt.getTime()) ||
      left.slug.localeCompare(right.slug));
  // Spread each group separately so cluster spacing can never pull an
  // image-only card ahead of a video card across the group boundary.
  return [
    ...spreadGalleryByCluster(entries.filter((entry) => entry.video)),
    ...spreadGalleryByCluster(entries.filter((entry) => !entry.video))
  ];
});

/**
 * Source rows for the in-site inspiration library. Same enumeration and same
 * deterministic order as the /templates gallery (video-attached cards first,
 * newest first by the owning row's updatedAt, slug tiebreak, clusters spread
 * apart), but it keeps the full detail card so the library can show the real
 * prompt, video and category data behind every example.
 */
export type InspirationSourceEntry = {
  kind: MediaDetailKind;
  slug: string;
  label: string;
  line?: string;
  prompt: string;
  tool?: string;
  sceneSlug?: string;
  publicSlug: string;
  ownerSlug: string;
  image: { src: string; alt?: string; w?: number; h?: number };
  video?: { src: string; previewSrc?: string; poster?: { src: string; alt?: string }; width?: number; height?: number };
  duration?: number;
  placement: string[];
  updatedAt: Date;
};

export async function listAidreamcapesInspirationEntries(): Promise<InspirationSourceEntry[]> {
  const cards = await enumerateSingleOwnerDetailCardsCached();
  const entries = cards.map(({ card, slug, kind, updatedAt, ownerSlug }) => ({
    kind,
    slug,
    label: card.label,
    ...(card.line ? { line: card.line } : {}),
    prompt: card.prompt,
    ...(card.tool ? { tool: card.tool } : {}),
    ...(card.sceneSlug ? { sceneSlug: card.sceneSlug } : {}),
    publicSlug: slug,
    ownerSlug,
    image: card.image,
    ...(card.video?.src ? { video: card.video } : {}),
    ...(card.duration !== undefined ? { duration: Number(card.duration) || undefined } : {}),
    placement: card.placement ?? [],
    updatedAt
  }));
  return [
    ...spreadGalleryByCluster(entries.filter((entry) => entry.video)),
    ...spreadGalleryByCluster(entries.filter((entry) => !entry.video))
  ];
}
