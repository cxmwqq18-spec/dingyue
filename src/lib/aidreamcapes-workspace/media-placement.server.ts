import "server-only";

import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "./types";
import { mediaDetailPath } from "./media-detail";
import type { MediaDetail } from "./media-detail.server";
import { cardsFromContent, templateDefinitionFrom, toDetailCard } from "./media-cards.server";
import { aidreamcapesV2ResponsivePosterSrc } from "@/lib/aidreamcapes-v2-responsive-images";
import {
  MEDIA_PLACEMENT_PATTERN,
  PLACEMENT_GROUP_LABEL,
  productIdentityOf,
  type DirectoryMediaCard,
  type MediaPlacementGroup,
  type PlacementCatalog,
  type PlacementDirectory
} from "./media-placement";

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function productIdentityOfDetailCard(card: MediaDetail["card"]) {
  return productIdentityOf({
    kind: card.kind,
    imageSrc: card.image.src,
    videoSrc: card.video?.src,
    posterSrc: card.video?.poster?.src
  });
}

/** The first v2 section data block that carries a template directory. */
function directoryData(contentJson: unknown): RecordValue | undefined {
  const sections = record(record(contentJson)?.sections);
  for (const section of Object.values(sections ?? {})) {
    if (record(section)?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(record(section)?.settings)?.data);
    if (data && record(data.templateDirectory)) return data;
  }
  return undefined;
}

/**
 * The 17 facet pages plus the three template catalogs, read from current
 * LivePage rows. This is the only taxonomy registry; nothing is hardcoded and
 * no tag table exists.
 */
export const loadPlacementRegistry = cache(async () => {
  const pages = await prisma.$queryRaw<Array<{ slug: string; title: string | null; contentJson: unknown }>>`
    SELECT "slug", "title", "contentJson"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND jsonb_path_exists("contentJson", '$.sections.*.settings.data.templateDirectory')
    ORDER BY "slug"
  `;
  const facets = new Map<string, PlacementDirectory>();
  const catalogs = new Map<string, PlacementCatalog>();
  for (const page of pages) {
    const data = directoryData(page.contentJson);
    if (!data) continue;
    const directory = record(data.templateDirectory);
    if (!directory || !Array.isArray(directory.paths)) continue;
    const paths = directory.paths.filter((path): path is string => typeof path === "string" && Boolean(path.trim()));
    const label = str(data.label) ?? str(page.title) ?? page.slug;
    const kind = str(data.kind);
    if (kind === "industry" || kind === "platform" || kind === "occasion") {
      facets.set(page.slug, { slug: page.slug, kind, label, paths });
    } else if (page.slug === "/templates" || page.slug === "/templates/photo" || page.slug === "/templates/video") {
      catalogs.set(page.slug, { slug: page.slug, kind: "catalog", label, paths });
    }
  }
  return { facets, catalogs };
});

type ProductPlacementEntry = {
  placements: Set<string>;
};

/**
 * Tool-owner reverse index: publicSlug -> the tool pages (hubs, tool routes,
 * and template pages under /ai-video-generation and /ai-image-generation that
 * carry a picker) whose cards reference that slug. This is the "Made with"
 * tool dimension — a reference relation, derived at render time, never stored.
 */
export const loadToolOwnerIndex = cache(async () => {
  const pages = await prisma.$queryRaw<Array<{ slug: string; title: string | null; contentJson: unknown }>>`
    SELECT "slug", "title", "contentJson"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND "slug" ~ '^/ai-(video|image)-generation(/[a-z0-9][a-z0-9-]*)?$'
      AND jsonb_path_exists("contentJson", '$.sections.*.settings.data.visual.picker')
    ORDER BY "slug"
  `;
  const index = new Map<string, Map<string, { label: string; href: string }>>();
  for (const page of pages) {
    const data = (() => {
      const sections = record(page.contentJson)?.sections;
      for (const section of Object.values(sections ?? {})) {
        if (record(section)?.type !== "aidreamcapes_v2_page") continue;
        const sectionData = record(record(record(section)?.settings)?.data);
        if (sectionData && record(record(sectionData.visual)?.picker)) return sectionData;
      }
      return undefined;
    })();
    if (!data) continue;
    const label = str(data.label) ?? str(page.title) ?? page.slug;
    const link = { label, href: page.slug };
    for (const value of cardsFromContent(page.contentJson)) {
      const card = toDetailCard(value);
      if (!card?.publicSlug) continue;
      const owners = index.get(card.publicSlug) ?? new Map<string, { label: string; href: string }>();
      owners.set(page.slug, link);
      index.set(card.publicSlug, owners);
    }
  }
  return index;
});

/**
 * Product-level placement index. One media asset can be copied into many
 * page-local cards with different `publicSlug` values; tags written to any of
 * those cards belong to the asset, not to one page. The index is built from
 * current LivePage rows and is never persisted.
 */
export const loadProductPlacementIndex = cache(async () => {
  const pages = await prisma.$queryRaw<Array<{ slug: string; contentJson: unknown }>>`
    SELECT "slug", "contentJson"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND jsonb_path_exists("contentJson", '$.**.placement[*]')
    ORDER BY "slug"
  `;
  const index = new Map<string, ProductPlacementEntry>();
  for (const page of pages) {
    for (const value of cardsFromContent(page.contentJson)) {
      const card = toDetailCard(value);
      if (!card?.publicSlug || !card.placement?.length) continue;
      const identity = productIdentityOfDetailCard(card);
      if (!identity) continue;
      const entry = index.get(identity.key) ?? { placements: new Set<string>() };
      for (const placement of card.placement) entry.placements.add(placement);
      index.set(identity.key, entry);
    }
  }
  return index;
});

const GROUP_ORDER: Array<MediaPlacementGroup["kind"]> = ["industry", "platform", "occasion", "catalog", "tool"];

/**
 * Resolve the category links of one detail page.
 *
 * Template cards use the reverse index of directory `paths`, so a directory is
 * shown only when it really lists the template page. Other cards aggregate
 * `placement` across every page copy of the same media asset; the same list
 * drives the directory media grid, so the link is true by construction.
 */
export async function resolveMediaPlacements(detail: MediaDetail): Promise<MediaPlacementGroup[]> {
  const isTemplateCard = Boolean(detail.ownerTemplate?.cardSlug && detail.ownerTemplate.cardSlug === detail.slug);
  let explicit = detail.card.placement ?? [];

  if (!isTemplateCard) {
    const identity = productIdentityOfDetailCard(detail.card);
    if (identity) {
      const indexed = (await loadProductPlacementIndex()).get(identity.key);
      if (indexed) explicit = [...indexed.placements].sort();
    }
  }
  // "Made with": every tool page whose picker references this media asset.
  // The relation is derived from current rows at render time; no field stores it.
  const toolOwners = (await loadToolOwnerIndex()).get(detail.slug);
  if (!isTemplateCard && !explicit.length && !toolOwners) return [];

  const registry = await loadPlacementRegistry();
  const links: Record<MediaPlacementGroup["kind"], { label: string; href: string }[]> = {
    industry: [],
    platform: [],
    occasion: [],
    catalog: [],
    tool: []
  };

  // Relation already resolved above; merge the tool owners into the groups.
  const toolOwnerLinks = toolOwners ? [...toolOwners.values()] : [];

  if (isTemplateCard) {
    for (const directory of registry.facets.values()) {
      if (directory.paths.includes(detail.ownerPath)) links[directory.kind].push({ label: directory.label, href: directory.slug });
    }
    for (const catalog of registry.catalogs.values()) {
      if (catalog.paths.includes(detail.ownerPath)) links.catalog.push({ label: catalog.label, href: catalog.slug });
    }
  } else {
    for (const slug of explicit) {
      const directory = registry.facets.get(slug);
      if (directory) links[directory.kind].push({ label: directory.label, href: directory.slug });
    }
  }
  links.tool.push(...toolOwnerLinks);

  return GROUP_ORDER.flatMap((kind) => {
    const values = links[kind];
    if (!values.length) return [];
    const unique = new Map(values.map((value) => [value.href, value]));
    return [{
      kind,
      label: PLACEMENT_GROUP_LABEL[kind],
      links: [...unique.values()].sort((left, right) => left.label.localeCompare(right.label))
    }];
  });
}

/**
 * Media cards directly placed in one facet directory, in deterministic source
 * order. The query prefilters pages with a cheap JSONB path; the shared card
 * extractor then validates every card shape.
 */
export const resolveDirectoryMedia = cache(async (directorySlug: string): Promise<DirectoryMediaCard[]> => {
  if (!MEDIA_PLACEMENT_PATTERN.test(directorySlug)) return [];
  const pages = await prisma.$queryRaw<Array<{ slug: string; contentJson: unknown }>>`
    SELECT "slug", "contentJson"
    FROM "LivePage"
    WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID}
      AND jsonb_path_exists(
        "contentJson",
        '$.**.placement[*] ? (@ == $facet)',
        jsonb_build_object('facet', ${directorySlug})
      )
    ORDER BY "slug"
  `;
  // One image/video asset is one product. Many page-local cards can share the
  // asset, so deduplicate by product identity and pick one deterministic
  // representative instead of rendering the same product up to 21 times.
  const groups = new Map<string, { page: string; card: DirectoryMediaCard; rank: string }>();
  for (const page of pages) {
    const templateCardSlug = templateDefinitionFrom(page.contentJson, page.slug)?.cardSlug;
    for (const value of cardsFromContent(page.contentJson)) {
      const card = toDetailCard(value);
      if (!card?.publicSlug || !card.placement?.includes(directorySlug)) continue;
      // A template card already appears in the template grid; never duplicate it.
      if (templateCardSlug && card.publicSlug === templateCardSlug) continue;
      const identity = productIdentityOfDetailCard(card);
      const href = mediaDetailPath(card.kind, card.publicSlug);
      if (!identity || !href) continue;
      const rank = `${page.slug === "/" ? "0" : page.slug.startsWith("/templates") ? "1" : "2"}|${String(card.publicSlug.length).padStart(3, "0")}|${page.slug}|${card.publicSlug}`;
      const existing = groups.get(identity.key);
      if (existing && existing.rank <= rank) continue;
      groups.set(identity.key, {
        page: page.slug,
        rank,
        card: {
          slug: card.publicSlug,
          label: card.label,
          kind: card.kind,
          href,
          image: {
            src: card.image.src,
            ...(card.image.alt ? { alt: card.image.alt } : {}),
            ...(card.image.w ? { w: card.image.w } : {}),
            ...(card.image.h ? { h: card.image.h } : {})
          },
          ...(card.video?.src ? {
            video: {
              src: card.video.src,
              ...(card.video.previewSrc ? { previewSrc: card.video.previewSrc } : {}),
              poster: aidreamcapesV2ResponsivePosterSrc(card.video.poster?.src ?? card.image.src),
              ...(card.video.width ? { width: card.video.width } : {}),
              ...(card.video.height ? { height: card.video.height } : {})
            }
          } : {}),
          ...(Number.isFinite(Number(card.duration)) && card.duration !== "" && card.duration !== undefined ? { duration: Number(card.duration) } : {})
        }
      });
    }
  }
  return [...groups.values()]
    .sort((left, right) => left.page.localeCompare(right.page) || left.card.slug.localeCompare(right.card.slug))
    .map((entry) => entry.card);
});
