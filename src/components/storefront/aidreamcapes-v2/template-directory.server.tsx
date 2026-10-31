import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThemeRenderer } from "@/components/theme-renderer";
import type { SectionInstance, ThemePageJson } from "@/lib/types";
import type { V2Data } from "./types";
import type { Directory, Template } from "./template-directory";
import { resolveDirectoryMedia } from "@/lib/aidreamcapes-workspace/media-placement.server";
import { resolveAidreamcapesTemplateFilter } from "@/lib/aidreamcapes-template-filter.server";
import { listAidreamcapesExampleGalleryEntries } from "@/lib/aidreamcapes-workspace/media-cards.server";
import type { ExampleDirectoryConfig, ExampleGalleryState, GalleryItem } from "./template-directory";
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

export async function AidreamcapesTemplateRenderer(props: Parameters<typeof ThemeRenderer>[0]) {
  const sections = { ...props.page.sections };
  for (const [id, section] of Object.entries(sections)) {
    if (section.type !== "aidreamcapes_v2_page") continue;
    const settings = section.settings as Record<string, unknown>;
    const data = settings.data as V2Data;
    if (!data) continue;
    let resolved: V2Data;
    if (data.exampleDirectory) {
      // The /templates example gallery: every public detail card, newest
      // first, SSR-cumulative pagination (?page=N shows the first N pages).
      // The browser fetches no data; "load more" is a plain link.
      const directory = data.exampleDirectory as ExampleDirectoryConfig;
      const pageSize = Math.max(1, Math.min(50, Math.floor(Number(directory.pageSize)) || 20));
      const kind = props.query?.kind === "video" || props.query?.kind === "photo" ? props.query.kind : undefined;
      const all = (await listAidreamcapesExampleGalleryEntries()).filter(entry => !kind || entry.kind === kind);
      const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
      const page = Math.min(Math.max(1, Math.floor(Number(props.query?.page)) || 1), totalPages);
      const items: GalleryItem[] = all.slice(0, page * pageSize).map(entry => ({
        kind: entry.kind,
        slug: entry.slug,
        label: entry.label,
        href: entry.href,
        image: { src: entry.image.src, ...(entry.image.alt ? { alt: entry.image.alt } : {}), w: entry.image.w, h: entry.image.h },
        ...(entry.video?.src ? { video: { src: entry.video.src, poster: entry.video.poster?.src ?? entry.image.src, ...(entry.video.width ? { width: entry.video.width } : {}), ...(entry.video.height ? { height: entry.video.height } : {}), ...(entry.duration ? { duration: entry.duration } : {}), name: entry.label } } : {})
      }));
      resolved = { ...data, exampleGallery: { items, total: all.length, page, pageSize, totalPages, ...(kind ? { kind } : {}) } };
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
      resolved = { ...data, directoryFilterState: filterState, directoryTemplates: orderedTemplates, directoryMedia: filteredMedia, directoryLabels: Object.fromEntries(facets.map(page => [page.slug, page.label ?? page.title])) };
    } else resolved = await resolveTemplateCardLinks(data);
    sections[id] = { ...section, settings: { ...settings, data: resolved } as unknown as SectionInstance["settings"] };
  }
  return <ThemeRenderer {...props} page={{ ...props.page, sections } as ThemePageJson} />;
}
