import "server-only";

import { prisma } from "@/lib/prisma";
import aidreamcapesV2Redirects from "@/lib/aidreamcapes-site-v2-redirects.json";
import { AIVIDEOSUGC_SITE_ID } from "./types";
import {
  MEDIA_DETAIL_SLUG_PATTERN,
  actorDetailSlug,
  mediaDetailPath,
  mediaDetailWorkspaceEntry,
  type MediaDetailCard,
  type MediaDetailKind
} from "./media-detail";

// Server-side resolution for public media detail pages. Every field is read
// from the current LivePage row; nothing is cached, generated, or persisted.
// A committed LivePage update is visible on the next request.

type RecordValue = Record<string, unknown>;

/** Retired public paths defined by the AIVideosUGC v2 route map. */
const AIDREAMCAPES_REDIRECTS = new Map<string, string>(aidreamcapesV2Redirects as Array<[string, string]>);

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

type RawCard = { card: RecordValue; ownerPath: string; ownerLabel?: string };

function pageLabel(contentJson: unknown): string | undefined {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    const data = record(record(record(section)?.settings)?.data);
    const label = str(data?.h1) ?? str(data?.label);
    if (label) return label;
  }
  return undefined;
}

function cardValues(contentJson: unknown): RecordValue[] {
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
function mediaKindOf(value: unknown): MediaDetailKind | undefined {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

function toDetailCard(value: RecordValue): MediaDetailCard | undefined {
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
  const videoSrc = str(video?.src);
  const posterSrc = str(poster?.src);
  const posterAlt = str(poster?.alt);
  const videoWidth = num(video?.width);
  const videoHeight = num(video?.height);
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
    ...(typeof duration === "number" || typeof duration === "string" ? { duration } : {}),
    image: {
      src,
      ...(imageAlt ? { alt: imageAlt } : {}),
      ...(width ? { w: width } : {}),
      ...(height ? { h: height } : {}),
    },
    ...(videoSrc
      ? {
          video: {
            src: videoSrc,
            ...(posterSrc ? { poster: { src: posterSrc, ...(posterAlt ? { alt: posterAlt } : {}) } } : {}),
            ...(videoWidth ? { width: videoWidth } : {}),
            ...(videoHeight ? { height: videoHeight } : {}),
          },
        }
      : {}),
  };
}

/** Pages that contain the requested public card slug for this media kind. */
async function pagesOwningSlug(slug: string) {
  // Slugs are unique per site, so the query matches the slug across every card
  // shape and the caller filters by media kind. This keeps one slug source for
  // template cards, picker cards, workspace cases, and legacy example galleries.
  return prisma.$queryRaw<Array<{ slug: string; contentJson: unknown }>>`
    SELECT "slug", "contentJson"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND (jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.visual.picker.cards[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${slug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.workspaceCases[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${slug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.examples.groups[*].items[*] ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${slug})
      ) OR jsonb_path_exists(
        "contentJson",
        '$.sections.*.settings.data.templateDefinition.card ? (@.publicSlug == $slug)'::jsonpath,
        jsonb_build_object('slug', ${slug})
      ))
    LIMIT 3
  `;
}

export type MediaDetail = {
  kind: MediaDetailKind;
  slug: string;
  path: string;
  ownerPath: string;
  ownerLabel?: string;
  card: MediaDetailCard;
  /** Canonical in-site path of the card itself. */
  canonicalPath: string;
  /** Workspace CTA target plus the inert entry transfer. */
  cta: { href: string; entry?: ReturnType<typeof mediaDetailWorkspaceEntry>["entry"] };
  related: { slug: string; label: string; kind: MediaDetailKind; image: { src: string; alt?: string }; href: string }[];
};

/**
 * Resolve a public detail route against current relational data.
 *
 * Returns undefined when the slug is not a public card, so callers can fall
 * through to published content pages and their own 404 handling.
 */
export async function resolveMediaDetail(kind: MediaDetailKind, slug: string): Promise<MediaDetail | undefined> {
  if (!MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  const pages = await pagesOwningSlug(slug);
  if (pages.length !== 1) return undefined;
  const owner = pages[0];
  const cards = cardValues(owner.contentJson);
  const ownerCard = cards
    .map(toDetailCard)
    .find((card): card is MediaDetailCard => Boolean(card) && card!.kind === kind && card!.publicSlug === slug);
  if (!ownerCard) return undefined;
  const path = mediaDetailPath(kind, slug);
  if (!path) return undefined;

  const related = cards
    .map(toDetailCard)
    .filter((card): card is MediaDetailCard => Boolean(card) && card!.kind === kind && Boolean(card!.publicSlug) && card!.publicSlug !== slug)
    .slice(0, 6)
    .flatMap((card) => {
      const href = mediaDetailPath(kind, card.publicSlug);
      if (!href) return [];
      return [{
        slug: card.publicSlug!,
        label: card.label,
        kind,
        image: { src: card.image.src, ...(card.image.alt ? { alt: card.image.alt } : {}) },
        href,
      }];
    });

  return {
    kind,
    slug,
    path,
    ownerPath: owner.slug,
    ...(pageLabel(owner.contentJson) ? { ownerLabel: pageLabel(owner.contentJson) } : {}),
    card: ownerCard,
    canonicalPath: path,
    cta: mediaDetailWorkspaceEntry(path),
    related,
  };
}

export type ActorDetail = {
  slug: string;
  name: string;
  gender?: string;
  /** LivePage slug of the stored actor row; rendered with the flat public path. */
  detailPageSlug: string;
  actor: RecordValue;
};

/**
 * Resolve `/ai-actors/<name>` against the stored actor detail rows.
 *
 * The relational rows still live at `/ai-actors/{men|women}/<name>`; the flat
 * address is a rendering projection, so nothing is migrated.
 */
export async function resolveActorDetail(segment: string): Promise<ActorDetail | undefined> {
  const slug = actorDetailSlug(segment);
  if (!slug || slug !== segment) return undefined;
  for (const gender of ["men", "women"] as const) {
    const page = await prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: `/ai-actors/${gender}/${slug}` } },
      select: { slug: true, contentJson: true },
    });
    if (!page) continue;
    const actor = actorFromPage(page.contentJson);
    if (!actor) continue;
    return {
      slug,
      name: str(actor.name) ?? segment,
      ...(str(actor.gender) ? { gender: str(actor.gender) } : {}),
      detailPageSlug: page.slug,
      actor,
    };
  }
  return undefined;
}

function actorFromPage(contentJson: unknown): RecordValue | undefined {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    const data = record(record(record(section)?.settings)?.data);
    const actor = record(data?.actor);
    if (actor && str(actor.name)) return actor;
  }
  return undefined;
}

export type AidreamcapesSiteChrome = {
  navigation: unknown;
  keywords?: string;
};

/** Navigation is published once on the home LivePage and shared by every route. */
export async function loadAidreamcapesChrome(): Promise<AidreamcapesSiteChrome | undefined> {
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: "/" } },
    select: { contentJson: true },
  });
  const content = record(page?.contentJson);
  const navigation = content?.siteNavigation;
  if (!record(navigation)) return undefined;
  const seo = record(content?.seo);
  const keywords = str(seo?.keywords);
  return {
    navigation,
    ...(keywords ? { keywords } : {}),
  };
}

/** Full inventory used by the media detail regression gates. */
export async function listMediaDetailSlugs(): Promise<Array<{ kind: MediaDetailKind; slug: string; ownerPath: string; label: string }>> {
  const pages = await prisma.livePage.findMany({
    where: { siteId: AIVIDEOSUGC_SITE_ID },
    select: { slug: true, contentJson: true },
  });
  const rows: Array<{ kind: MediaDetailKind; slug: string; ownerPath: string; label: string }> = [];
  for (const page of pages) {
    for (const value of cardValues(page.contentJson)) {
      const card = toDetailCard(value);
      if (!card?.publicSlug) continue;
      rows.push({ kind: card.kind, slug: card.publicSlug, ownerPath: page.slug, label: card.label });
    }
  }
  return rows;
}

/**
 * Retired public paths redirect to their mapped target when no LivePage row owns
 * the address. A live page always wins, so current content is never redirected.
 */
export async function aidreamcapesMissingPageRedirect(path: string): Promise<string | undefined> {
  const target = AIDREAMCAPES_REDIRECTS.get(path);
  if (!target) return undefined;
  const row = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: path } },
    select: { id: true },
  });
  return row ? undefined : target;
}

/** Actor names are the public identifiers; the stored rows are gendered. */
export async function listActorDetailSlugs(): Promise<Array<{ slug: string; name: string; detailPageSlug: string }>> {
  const pages = await prisma.livePage.findMany({
    where: { siteId: AIVIDEOSUGC_SITE_ID, slug: { startsWith: "/ai-actors/" } },
    select: { slug: true, contentJson: true },
  });
  const rows: Array<{ slug: string; name: string; detailPageSlug: string }> = [];
  for (const page of pages) {
    if (page.slug.split("/").length !== 4) continue;
    const actor = actorFromPage(page.contentJson);
    const name = str(actor?.name);
    const slug = name ? actorDetailSlug(name) : undefined;
    if (!name || !slug) continue;
    rows.push({ slug, name, detailPageSlug: page.slug });
  }
  return rows;
}
