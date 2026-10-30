import "server-only";

import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "./types";
import type { MediaDetailCard, MediaDetailKind } from "./media-detail";
import { mediaDetailDescription } from "./media-detail";
import { placementValues } from "./media-placement";

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
  const posterSrc = str(poster?.src);
  const posterAlt = str(poster?.alt);
  const videoWidth = num(video?.width);
  const videoHeight = num(video?.height);
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
            ...(posterSrc ? { poster: { src: posterSrc, ...(posterAlt ? { alt: posterAlt } : {}) } } : {}),
            ...(videoWidth ? { width: videoWidth } : {}),
            ...(videoHeight ? { height: videoHeight } : {})
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
  durationSeconds?: number;
  updatedAt: Date;
};

/**
 * Enumerate every public media detail card for the AIVideosUGC storefront.
 *
 * Detail pages are rendering projections of card data, so the sitemap has to
 * read the same relational rows the detail resolver reads. A card is listed
 * only when exactly one LivePage row owns it — the same single-owner rule the
 * detail resolver applies — and alias cards (detailAliasOf) are skipped
 * because their canonical detail page is the alias target's. Future videos
 * added to any card are picked up automatically.
 */
export async function listAidreamcapesMediaDetailEntries(): Promise<MediaDetailSitemapEntry[]> {
  const rows = await prisma.livePage.findMany({
    where: { siteId: AIVIDEOSUGC_SITE_ID },
    select: { slug: true, contentJson: true, updatedAt: true }
  });
  type Candidate = MediaDetailSitemapEntry & { owners: Set<string> };
  const byKey = new Map<string, Candidate>();
  for (const row of rows) {
    const cards = cardsFromContent(row.contentJson);
    const claimedKeys = new Set<string>();
    const rowEntries: Array<[string, MediaDetailSitemapEntry]> = [];
    for (const raw of cards) {
      const card = toDetailCard(raw);
      if (!card || !card.publicSlug || str(raw.detailAliasOf)) continue;
      const key = `${card.kind}:${card.publicSlug}`;
      claimedKeys.add(key);
      const description = mediaDetailDescription(card);
      rowEntries.push([key, {
        kind: card.kind,
        slug: card.publicSlug,
        label: card.label,
        description,
        imagePath: card.image.src,
        ...(card.image.alt ? { imageAlt: card.image.alt } : {}),
        ...(card.video?.src ? { videoPath: card.video.src } : {}),
        ...(card.duration !== undefined ? { durationSeconds: Number(card.duration) || undefined } : {}),
        updatedAt: row.updatedAt
      }]);
    }
    for (const [key, entry] of rowEntries) {
      const existing = byKey.get(key);
      if (existing) {
        existing.owners.add(row.slug);
      } else {
        byKey.set(key, { ...entry, owners: new Set([row.slug]) });
      }
    }
  }
  return [...byKey.values()]
    .filter((candidate) => candidate.owners.size === 1)
    .map(({ owners: _owners, ...entry }) => entry);
}
