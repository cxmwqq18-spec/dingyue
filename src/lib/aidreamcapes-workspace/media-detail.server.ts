import "server-only";

import { prisma } from "@/lib/prisma";
import aidreamcapesV2Redirects from "@/lib/aidreamcapes-site-v2-redirects.json";
import { getStorefrontProfileRelational } from "@/lib/stores/storefront-profile-store";
import type { StorefrontProfileJson } from "@/lib/types";
import {
  aidreamcapesLatestArticlesHeading,
  latestAidreamcapesArticles,
  type AidreamcapesFooterArticle
} from "@/components/storefront/aidreamcapes-v2/latest-articles";
import { AIVIDEOSUGC_SITE_ID } from "./types";
import {
  MEDIA_DETAIL_SLUG_PATTERN,
  actorDetailSlug,
  mediaDetailPath,
  mediaDetailWorkspaceEntry,
  type MediaDetailCard,
  type MediaDetailKind
} from "./media-detail";
import { cardsFromContent, templateDefinitionFrom, toDetailCard, type OwnerTemplate } from "./media-cards.server";
import { mediaCardCanonicalSlug } from "./media-card-canonical";
import { mediaAliasTarget } from "./media-alias.server";
import { presetFromCard, presetGenerationIdentity } from "./presets.server";

// Retired hub example addresses. Their owning cards were retired together
// with the all-video-examples catalog module, and the card rewrite could not
// carry the persisted publicAliases across, so the relational alias lookup no
// longer knows them. These crawlable addresses must keep answering 308 —
// never 404. Each redirects to the nearest surviving example of the same
// content shape (a detail page with its single workspace CTA), because the
// alias contract resolves to a detail canonical, not a catalog index.
const RETIRED_HUB_EXAMPLE_ADDRESSES: Readonly<Record<string, string>> = {
  "a-clip-sized-for-the-feed": "/ai-video-generation/open-ear-sports-earbuds-park-walk",
  "a-showcase-in-a-real-room": "/ai-video-generation/sunset-lamp-room-glow-before-after",
  "a-spoken-ad-with-a-person-on-camera": "/ai-video-generation/wrinkled-shirt-steamer-rescue",
  "an-actor-matched-to-the-buyer": "/ai-video-generation/washed-graphic-tee-fit-check",
  "the-same-product-walkthrough": "/ai-video-generation/vegetable-chopper-kitchen-demo",
  // Retired tool-style video pages (2026-11-17 GSC 404 audit): their cards
  // left the relational content without alias claims, so Google's crawled
  // addresses answer 404. Same contract as above: 308 to the nearest
  // surviving same-shape detail page, never 404.
  "talking-photo": "/ai-video-generation/talking-head-skin-lesson",
  "talking-head-video": "/ai-video-generation/talking-head-skin-lesson",
  // The first target here was the /promo-video tool page, which renders four
  // workspace entries and cannot satisfy the one-CTA rule every retired
  // address promises, so the same-shape example detail page is used instead.
  "product-ad-video": "/ai-video-generation/candle-cozy-gift",
  "bottle-ad-with-a-person": "/ai-video-generation/water-bottle-demo-cap-twists-open",
  "close-unboxing-makeup-tools-ai-video-generation-cinematic-video": "/ai-video-generation/quiet-unboxing-makeup-tools"
};

/** Living page a retired address still redirects to, if any. */
export function retiredMediaPageRedirect(kind: MediaDetailKind, slug: string): string | undefined {
  return kind === "video" ? RETIRED_HUB_EXAMPLE_ADDRESSES[slug] : undefined;
}

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

function pageLabel(contentJson: unknown): string | undefined {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    const data = record(record(record(section)?.settings)?.data);
    const label = str(data?.h1) ?? str(data?.label);
    if (label) return label;
  }
  return undefined;
}

/** Pages that contain the requested public card slug for this media kind. */
async function pagesOwningSlug(slug: string) {
  // Slugs are unique per site, so the query matches the slug across every card
  // shape and the caller filters by media kind. This keeps one slug source for
  // template cards, picker cards, workspace cases, and legacy example galleries.
  return prisma.$queryRaw<Array<{ slug: string; contentJson: unknown; updatedAt: Date }>>`
    SELECT "slug", "contentJson", "updatedAt"
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
      ) OR jsonb_path_exists(
        "contentJson", '$.**.publicAliases[*] ? (@ == $slug)'::jsonpath,
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
  /** Present when the owner page is a reusable template page. */
  ownerTemplate?: OwnerTemplate;
  card: MediaDetailCard;
  /** Last relational update of the owning LivePage row; drives video uploadDate. */
  ownerUpdatedAt: string;
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
export async function resolveMediaDetail(kind: MediaDetailKind, slug: string, followAlias = true,
  owners?: Awaited<ReturnType<typeof pagesOwningSlug>>): Promise<MediaDetail | undefined> {
  if (!MEDIA_DETAIL_SLUG_PATTERN.test(slug)) return undefined;
  const pages = owners ?? await pagesOwningSlug(slug);
  if (pages.length !== 1) return undefined;
  const owner = pages[0];
  const cards = cardsFromContent(owner.contentJson);
  const ownerCard = cards
    .map(toDetailCard)
    .find((card): card is MediaDetailCard => Boolean(card) && card!.kind === kind && card!.publicSlug === slug);
  if (!ownerCard) {
    if (followAlias) {
      const target = await mediaAliasTarget(kind, slug);
      if (target) return resolveMediaDetail(kind, target, false);
    }
    return undefined;
  }
  // Only a reviewed, persisted reference can merge details. Matching pictures
  // alone never choose a canonical. Recheck current generation options so a
  // later online edit cannot silently inherit another scene's preset.
  const rawCard = cards.find((card) => card.publicSlug === slug && toDetailCard(card)?.kind === kind);
  const aliasOf = str(rawCard?.detailAliasOf);
  if (followAlias && aliasOf && aliasOf !== slug && MEDIA_DETAIL_SLUG_PATTERN.test(aliasOf)) {
    const targetPages = await pagesOwningSlug(aliasOf);
    const targetPage = targetPages.length === 1 ? targetPages[0] : undefined;
    if (targetPage) {
      const currentIdentity = presetGenerationIdentity(presetFromCard(owner, owner.slug, rawCard));
      const targetCard = cardsFromContent(targetPage.contentJson)
        .find((card) => card.publicSlug === aliasOf && toDetailCard(card)?.kind === kind);
      const targetIdentity = presetGenerationIdentity(presetFromCard(targetPage, targetPage.slug, targetCard));
      // Reviewed duplicate shortcuts carry `detailAliasMerge` on the alias card
      // itself. They answer with a permanent redirect so inbound links and
      // ranking signals consolidate on the target example instead of competing
      // with a same-titled copy (approved 2026-11-22). Preset identity is not
      // compared for these: the duplicate was reviewed and marked explicitly.
      const mergesIntoTarget = (rawCard as { detailAliasMerge?: unknown } | undefined)?.detailAliasMerge === true;
      if (mergesIntoTarget && !str(targetCard?.detailAliasOf)) {
        return resolveMediaDetail(kind, aliasOf, false, targetPages);
      }
      // Chains/cycles fail closed to the original detail. Single-hop refs only.
      // A placeholder alias (no video of its own) completes its merge into the
      // target even when the target carries the real mp4 — the alias URL must
      // not keep rendering a duplicate placeholder page. An alias that HAS a
      // video never merges into a target without one.
      if (currentIdentity && currentIdentity === targetIdentity && !str(targetCard?.detailAliasOf)
        && (!ownerCard.video?.src || ownerCard.video?.src === (targetCard && toDetailCard(targetCard)?.video?.src))) {
        return resolveMediaDetail(kind, aliasOf, false, targetPages);
      }
    }
  }
  const path = mediaDetailPath(kind, slug);
  if (!path) return undefined;
  const ownerTemplate = templateDefinitionFrom(owner.contentJson, owner.slug);

  const related = cards
    .map((raw) => ({ raw, card: toDetailCard(raw) }))
    .filter((entry) => Boolean(entry.card) && entry.card!.kind === kind && Boolean(entry.card!.publicSlug) && entry.card!.publicSlug !== slug)
    .slice(0, 6)
    .flatMap(({ raw, card }) => {
      if (!card) return [];
      // A shortcut card keeps its own slug so old inbound links keep
      // resolving. Link to the card it stands for, so a visitor does not pay
      // for a redirect.
      const href = mediaDetailPath(kind, mediaCardCanonicalSlug({
        publicSlug: card.publicSlug,
        detailAliasOf: str((raw as { detailAliasOf?: unknown } | undefined)?.detailAliasOf),
        sceneSlug: str((raw as { sceneSlug?: unknown } | undefined)?.sceneSlug)
      }));
      if (!href) return [];
      return [{
        slug: card.publicSlug!,
        label: card.label,
        kind,
        image: { src: card.image.src, ...(card.image.alt ? { alt: card.image.alt } : {}) },
        href,
      }];
    })
    // One page can hold the same card twice, for example a template card and
    // its alias copy. The related grid would then render two entries with the
    // same address, so the duplicate is dropped here.
    .filter((item, index, list) => list.findIndex((other) => other.href === item.href) === index);

  return {
    kind,
    slug,
    path,
    ownerPath: owner.slug,
    ownerUpdatedAt: owner.updatedAt.toISOString(),
    ...(pageLabel(owner.contentJson) ? { ownerLabel: pageLabel(owner.contentJson) } : {}),
    ...(ownerTemplate ? { ownerTemplate } : {}),
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
  articles: AidreamcapesFooterArticle[];
  articlesTitle?: string;
  identity?: StorefrontProfileJson["identity"];
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
  // The footer carries the same company block and article list on every
  // storefront route, so the detail shell has to load them from the same
  // current rows the home route reads.
  const [articlePages, profile] = await Promise.all([
    prisma.livePage.findMany({
      where: { siteId: AIVIDEOSUGC_SITE_ID, slug: { startsWith: "/blog/" } },
      select: { slug: true, pageType: true, title: true, updatedAt: true, contentJson: true },
    }),
    getStorefrontProfileRelational(AIVIDEOSUGC_SITE_ID),
  ]);
  const articles = latestAidreamcapesArticles(articlePages.map((article) => ({
    slug: article.slug,
    pageType: article.pageType ?? undefined,
    title: article.title,
    updatedAt: article.updatedAt,
    liveContentJson: article.contentJson,
  })));
  const articlesTitle = aidreamcapesLatestArticlesHeading(page?.contentJson);
  const identity = profile?.publishedJson?.identity;
  return {
    navigation,
    ...(keywords ? { keywords } : {}),
    articles,
    articlesTitle,
    ...(identity ? { identity } : {}),
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
    for (const value of cardsFromContent(page.contentJson)) {
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
