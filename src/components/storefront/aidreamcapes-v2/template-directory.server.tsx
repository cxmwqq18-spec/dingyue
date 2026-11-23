import "server-only";
import { cache } from "react";
import { permanentRedirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThemeRenderer } from "@/components/theme-renderer";
import type { SectionInstance, ThemePageJson } from "@/lib/types";
import type { V2Data, V2VisualImage, V2VisualPickerCard } from "./types";
import type { Directory, Template } from "./template-directory";
import { resolveDirectoryMedia } from "@/lib/aidreamcapes-workspace/media-placement.server";
import { AIDREAMCAPES_KIND_CATALOG_COPY, resolveAidreamcapesTemplateFilter } from "@/lib/aidreamcapes-template-filter.server";
import { aidreamcapesV2ResponsivePosterSrc } from "@/lib/aidreamcapes-v2-responsive-images";
import { listAidreamcapesExampleGalleryEntries } from "@/lib/aidreamcapes-workspace/media-cards.server";
import { MEDIA_PAGE_SIZE } from "./types";
import { listingPagePath } from "@/lib/listing-pagination";
import { publicSiteSlug } from "@/lib/domain-routing";
import type { ExampleDirectoryConfig, GalleryItem } from "./template-directory";
const readTemplates = cache(async (paths: string[]) => {
  if (!paths.length) return [];
  const pages = await prisma.$queryRaw<Array<{ slug: string; definition: Template | null }>>`
    SELECT "slug", jsonb_path_query_first("contentJson", '$.sections.*.settings.data.templateDefinition') AS definition
    FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes' AND "slug" IN (${Prisma.join(paths)})
  `;
  const byPath = new Map(pages.map(page => [page.slug, page]));
  const seen = new Set<string>();
  return [...new Set(paths)].flatMap(path => {
    const definition = byPath.get(path)?.definition;
    if (!definition || seen.has(definition.id)) return [];
    seen.add(definition.id);
    return [{ ...definition, path }];
  });
});

/** Resolve reusable template cards to one current detail owner, across public pages. */
const readDefinitions = cache(async () => {
  const pages = await prisma.$queryRaw<Array<{ definition: Template }>>`
    SELECT section.value->'settings'->'data'->'templateDefinition' AS definition
    FROM "LivePage", LATERAL jsonb_each("contentJson"->'sections') AS section
    WHERE "siteId" = 'site_aidreamcapes'
      AND section.value->'settings'->'data'->'templateDefinition' IS NOT NULL
  `;
  return pages.map(p => p.definition);
});

export async function resolveTemplateCardLinks(data: V2Data): Promise<V2Data> {
  const definitions = await readDefinitions();
  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== "object") return value;
    const item = value as Record<string, unknown>;
    if (typeof item.name === "string" && typeof item.href === "string" && item.cardType !== "case") {
      // Several catalogs reuse the same tool CTA. Resolve only an unambiguous
      // template owner; never collapse distinct templates by a shared href.
      const matches = definitions.filter(t => t.card.href === item.href
        && t.name === item.name
        && (!item.kind || t.kind === item.kind));
      if (matches.length === 1) return { ...item, href: matches[0].path, name: matches[0].name, kind: matches[0].kind };
    }
    // Preset identity fields must retain their original tool path.
    return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, key === "templateDefinition" || key === "workspaceCases" ? entry : rewrite(entry)]));
  };
  const result = rewrite(data) as V2Data;
  const definition = data.templateDefinition as Template | undefined;
  if (definition && result.visual) result.visual = { ...(result.visual as Record<string, unknown>), picker: { ...((result.visual as { picker: object }).picker), cards: [definition.card] } };
  return result;
}

/** The public gallery-card projection of an enumerated detail entry. */
function toGalleryItem(entry: Awaited<ReturnType<typeof listAidreamcapesExampleGalleryEntries>>[number]): GalleryItem {
  return {
    kind: entry.kind,
    slug: entry.slug,
    label: entry.label,
    href: entry.href,
    image: { src: entry.image.src, ...(entry.image.alt ? { alt: entry.image.alt } : {}), w: entry.image.w, h: entry.image.h },
    ...(entry.video?.src ? { video: { src: entry.video.src, ...(entry.video.previewSrc ? { previewSrc: entry.video.previewSrc } : {}), poster: aidreamcapesV2ResponsivePosterSrc(entry.video.poster?.src ?? entry.image.src), ...(entry.video.width ? { width: entry.video.width } : {}), ...(entry.video.height ? { height: entry.video.height } : {}), ...(entry.duration ? { duration: entry.duration } : {}), name: entry.label } } : {})
  };
}

/** The page number a listing request asks for; invalid values resolve to 1. */
function requestedListingPage(query: Record<string, string | string[] | undefined> | undefined): number {
  const raw = Array.isArray(query?.page) ? query?.page[0] : query?.page;
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) && value >= 1 ? value : 1;
}

/** Keep only the listing filters that change the result set; tracking params
 * and the page parameter itself do not belong on the redirect target. */
/** Keep only the listing filters that change the result set; tracking params,
 * the page parameter and the kind identity (now a path) do not belong on the
 * redirect target. */
const LISTING_FILTER_KEYS = new Set(["industries", "platforms", "occasions", "galleryPage"]);

/** Keep only listing filters on a canonical redirect target. */
function listingSearch(
  query: Record<string, string | string[] | undefined> | undefined
): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, raw] of Object.entries(query ?? {})) {
    if (!LISTING_FILTER_KEYS.has(key)) continue;
    for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) {
      if (value) search.append(key, value);
    }
  }
  return search;
}

/** A kind catalog's public base: `/templates?kind=photo` → `/templates/photo`. */
function listingBasePath(
  path: string | undefined,
  query: Record<string, string | string[] | undefined> | undefined
): string | undefined {
  if (!path) return undefined;
  const kind = query?.kind === "photo" || query?.kind === "video" ? query.kind : undefined;
  return kind && path === "/templates" ? `${path}/${kind}` : path;
}

function listingRedirect(path: string, page: number, search: URLSearchParams, routePrefix = ""): never {
  const target = `${routePrefix}${listingPagePath(path, page)}${search.size ? `?${search.toString()}` : ""}`;
  permanentRedirect(target);
}

/** `page=1` and unparseable values have no address of their own. A permanent
 * redirect keeps the parameter space finite and never answers 404: the base
 * listing is the canonical address for both. */
function redirectNonCanonicalPage(
  path: string | undefined,
  query: Record<string, string | string[] | undefined> | undefined,
  routePrefix = ""
): void {
  if (!path) return;
  const raw = Array.isArray(query?.page) ? query?.page[0] : query?.page;
  if (raw === undefined) return;
  const value = String(raw).trim();
  if (/^[1-9][0-9]*$/.test(value) && Number(value) > 1) return;
  listingRedirect(listingBasePath(path, query)!, 0, listingSearch(query), routePrefix);
}

/** A page past the last real page has no content of its own. Send it to the
 * last page instead of rendering a clamped copy with a "Page N" canonical. */
function redirectPastLastPage(
  path: string | undefined,
  requested: number,
  totalPages: number,
  query: Record<string, string | string[] | undefined> | undefined,
  routePrefix = ""
): void {
  if (!path || requested <= totalPages) return;
  listingRedirect(listingBasePath(path, query)!, totalPages, listingSearch(query), routePrefix);
}

export async function AidreamcapesTemplateRenderer(props: Parameters<typeof ThemeRenderer>[0]) {
  const sections = { ...props.page.sections };
  // Path mode ("/site/<slug>/...") needs the route prefix on redirects; host
  // mode has an empty prefix. Mirrors hrefForDirectoryPath in storefront-render.
  const routePrefix = props.routeMode === "host" ? "" : `/site/${publicSiteSlug(props.site.slug)}`;
  for (const [id, section] of Object.entries(sections)) {
    if (section.type !== "aidreamcapes_v2_page") continue;
    const settings = section.settings as Record<string, unknown>;
    const data = settings.data as V2Data;
    if (!data) continue;
    let resolved: V2Data;
    if (data.exampleDirectory) {
      // The /templates example gallery: every public detail card, newest
      // first, paginated into independent SSR pages (?page=N shows page N).
      // The browser fetches no data; the pager at the end of the grid links
      // neighbouring pages, and deep-linked pages stay directly addressable.
      const directory = data.exampleDirectory as ExampleDirectoryConfig;
      const pageSize = Math.max(1, Math.min(50, Math.floor(Number(directory.pageSize)) || 12));
      const kind = props.query?.kind === "video" || props.query?.kind === "photo" ? props.query.kind : undefined;
      const all = (await listAidreamcapesExampleGalleryEntries()).filter(entry => !kind || entry.kind === kind);
      const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
      const requestedPage = requestedListingPage(props.query);
      const listingPath = props.pagePath ?? "/templates";
      redirectNonCanonicalPage(listingPath, props.query, routePrefix);
      redirectPastLastPage(listingPath, requestedPage, totalPages, props.query, routePrefix);
      const page = Math.min(requestedPage, totalPages);
      const start = (page - 1) * pageSize;
      const items: GalleryItem[] = all.slice(start, start + pageSize).map(toGalleryItem);
      resolved = { ...data, exampleGallery: { items, total: all.length, page, totalPages, ...(kind ? { kind } : {}), basePath: props.pagePath ?? "/templates" } };
      // The kind catalogs are standalone pages: their heading and lead must
      // describe the filtered result set, not the all-examples catalog.
      if (kind) {
        const copy = AIDREAMCAPES_KIND_CATALOG_COPY[kind];
        resolved = { ...resolved, h1: copy.h1, lead: copy.lead };
      }
    } else if (data.templateDirectory) {
      const directory = data.templateDirectory as Directory;
      const kind = typeof data.kind === "string" ? data.kind : "";
      const isFacet = kind === "industry" || kind === "platform" || kind === "occasion";
      const filterState = props.pagePath ? await resolveAidreamcapesTemplateFilter(props.pagePath, props.query ?? {}) : undefined;
      // Example-first facet pages keep the template registry (paths) in the
      // row but render no template grid, so their template list is not read.
      const [all, directoryMedia] = await Promise.all([
        directory.hideTemplates ? Promise.resolve([] as Template[]) : readTemplates(directory.paths),
        isFacet && props.pagePath ? resolveDirectoryMedia(props.pagePath) : Promise.resolve([])
      ]);
      // Catalog pages (/templates, /templates/photo, /templates/video) present
      // their templates in a fixed order — the video group first, then by
      // slug — instead of the arbitrary stored order. Facet pages keep their
      // reviewed curation order.
      const orderedTemplates = isFacet ? all : [...all].sort((left, right) => ((left.kind === "video" ? 0 : 1) - (right.kind === "video" ? 0 : 1)) || left.path.localeCompare(right.path));
      const paths = [...new Set(orderedTemplates.flatMap(t => [...t.industries, ...t.platforms, ...t.occasions]))];
      const facets = paths.length ? await prisma.$queryRaw<Array<{ slug: string; title: string; label: string | null }>>`
        SELECT "slug", "title", jsonb_path_query_first("contentJson", '$.sections.*.settings.data.label') #>> '{}' AS label
        FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes' AND "slug" IN (${Prisma.join(paths)})
      ` : [];
      const selectedFacets = Object.values(filterState?.filters ?? {}).filter(value => value.startsWith("/"));
      const intersections = await Promise.all(selectedFacets.filter(value => value !== props.pagePath).map(resolveDirectoryMedia));
      const filteredMedia = directoryMedia.filter(card => intersections.every(cards => cards.some(other => other.kind === card.kind && other.slug === card.slug)));
      // Video-bearing examples lead the grid (stable within each group), and
      // the grid paginates into discrete SSR pages: ?page=N shows page N with
      // MEDIA_PAGE_SIZE cards, and the pager links the neighbouring pages as
      // plain anchors. The browser fetches no catalog data.
      const orderedMedia = [...filteredMedia].sort((left, right) => ((left.video ? 0 : 1) - (right.video ? 0 : 1)));
      const mediaTotal = orderedMedia.length;
      const mediaTotalPages = Math.max(1, Math.ceil(mediaTotal / MEDIA_PAGE_SIZE));
      const requestedPage = requestedListingPage(props.query);
      redirectNonCanonicalPage(props.pagePath, props.query, routePrefix);
      redirectPastLastPage(props.pagePath, requestedPage, mediaTotalPages, props.query, routePrefix);
      const mediaPage = Math.min(requestedPage, mediaTotalPages);
      const mediaStart = (mediaPage - 1) * MEDIA_PAGE_SIZE;
      resolved = {
        ...data,
        directoryFilterState: filterState,
        directoryTemplates: orderedTemplates,
        directoryMedia: orderedMedia.slice(mediaStart, mediaStart + MEDIA_PAGE_SIZE),
        ...(mediaTotalPages > 1 && props.pagePath ? { directoryMediaPagination: { page: mediaPage, totalPages: mediaTotalPages, total: mediaTotal, basePath: props.pagePath } } : {}),
        directoryLabels: Object.fromEntries(facets.map(page => [page.slug, page.label ?? page.title]))
      };
    } else {
      resolved = await resolveTemplateCardLinks(data);
      // The video hub's picker grid is the single place that browses videos
      // (the owner retired the separate full-catalog gallery module). The
      // row's curated cards lead — they carry the filter chips — then every
      // remaining public video example follows in gallery order (video-first,
      // newest first, clusters spread). The appended entries come from the
      // same single-owner enumeration of relational owner rows that the
      // sitemap reads, so future videos appear without a data write. The
      // merged list paginates below like any other hub picker grid.
      if (props.pagePath && resolved.id === "video-hub") {
        const hubPicker = (resolved.visual as { picker?: { cards: V2VisualPickerCard[] } } | undefined)?.picker;
        if (hubPicker) {
          const curated = new Set(hubPicker.cards.map((card) => card.publicSlug ?? card.label));
          hubPicker.cards = [...hubPicker.cards, ...(await listAidreamcapesExampleGalleryEntries())
            .filter((entry) => entry.kind === "video" && !curated.has(entry.slug))
            .map((entry) => {
              const image: V2VisualImage = { src: entry.image.src, alt: entry.image.alt ?? entry.label, w: entry.image.w ?? 0, h: entry.image.h ?? 0, kind: "video" };
              return {
                image,
                label: entry.label,
                chips: [] as string[],
                href: entry.href,
                prompt: "",
                kind: "video" as const,
                publicSlug: entry.slug,
                // Catalog video cards always carry dimensions, a poster and a
                // preview path; without all of them the card renders its still.
                ...(entry.video && entry.video.width && entry.video.height
                  ? {
                    video: {
                      ...entry.video,
                      poster: entry.video.poster ? { src: entry.video.poster.src, alt: entry.video.poster.alt ?? image.alt } : { src: image.src, alt: image.alt },
                      width: entry.video.width,
                      height: entry.video.height
                    }
                  }
                  : {})
              };
            })];
        }
      }
      // Hub/tool picker grids hold the full media list in the row. When it
      // exceeds one page, the grid paginates server-side (?page=N slices the
      // stored list) instead of the former client-side loader, so the browser
      // never fetches catalog data. The homepage picker keeps its curated
      // first-page slice and never paginates.
      const visual = resolved.visual as { picker?: { cards?: unknown[] } } | undefined;
      const cards = visual?.picker?.cards;
      if (props.pagePath && resolved.id !== "home" && Array.isArray(cards)) {
        const total = cards.length;
        const totalPages = Math.max(1, Math.ceil(total / MEDIA_PAGE_SIZE));
        const requestedPage = requestedListingPage(props.query);
        redirectNonCanonicalPage(props.pagePath, props.query);
        redirectPastLastPage(props.pagePath, requestedPage, totalPages, props.query, routePrefix);
        if (total > MEDIA_PAGE_SIZE) {
          const page = Math.min(requestedPage, totalPages);
          resolved.pickerPagination = { page, totalPages, total, basePath: props.pagePath };
        }
      }
    }
    sections[id] = { ...section, settings: { ...settings, data: resolved } as unknown as SectionInstance["settings"] };
  }
  return <ThemeRenderer {...props} page={{ ...props.page, sections } as ThemePageJson} />;
}
