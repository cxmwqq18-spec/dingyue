import "server-only";
import { cache } from "react";
import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { normalizeAidreamcapesTemplateFilter, templateMatchesFilters, TEMPLATE_FACETS, type TemplateFilterQuery } from "./aidreamcapes-template-filter";

type Definition = { id: string; path: string; kind: string; industries: string[]; platforms: string[]; occasions: string[] };
type Directory = { slug: string; paths: string[] };
const readInventory = cache(async () => {
  const rows = await prisma.$queryRaw<Array<{ slug: string; data: { templateDefinition?: Definition; templateDirectory?: { paths?: string[] } } }>>`
    SELECT "slug", section.value->'settings'->'data' AS data
    FROM "LivePage", LATERAL jsonb_each("contentJson"->'sections') section
    WHERE "siteId" = 'site_aidreamcapes' AND section.value->>'type' = 'aidreamcapes_v2_page'
      AND (section.value->'settings'->'data' ? 'templateDefinition'
        OR section.value->'settings'->'data' ? 'templateDirectory')
  `;
  return {
    templates: rows.flatMap(row => row.data.templateDefinition ? [{ ...row.data.templateDefinition, path: row.slug }] : []),
    directories: rows.flatMap(row => Array.isArray(row.data.templateDirectory?.paths) ? [{ slug: row.slug, paths: row.data.templateDirectory.paths }] : []) as Directory[]
  };
});

export const resolveAidreamcapesTemplateFilter = cache(async (path: string, query: TemplateFilterQuery) => {
  if (!/^\/(?:templates|industries|platforms|occasions)(?:\/|$)/.test(path)) return undefined;
  // Ordinary directory requests need no inventory scan for URL normalization.
  if (!["kind", "type", ...TEMPLATE_FACETS].some(key => Boolean(query[key]))) return normalizeAidreamcapesTemplateFilter(path, query);
  const inventory = await readInventory();
  const owner = inventory.directories.find(directory => directory.slug === path);
  if (!owner) return undefined;
  const state = normalizeAidreamcapesTemplateFilter(path, query);
  const facets = TEMPLATE_FACETS.filter(key => state.filters[key]);
  if (facets.some(key => !inventory.directories.some(directory => directory.slug === state.filters[key]))) {
    return { ...state, invalid: true, noindex: true, redirectPath: undefined };
  }
  // A single facet may replace a query only when it preserves the actual list.
  // Placed examples make the facet a different result set, so preserve those
  // filtered views rather than dropping their meaning into a broader page.
  if (path === "/templates" && !state.filters.kind && !state.invalid && facets.length === 1) {
    const target = inventory.directories.find(directory => directory.slug === state.filters[facets[0]]);
    const filtered = inventory.templates.filter(t => owner.paths.includes(t.path) && templateMatchesFilters(t, state.filters)).map(t => t.path).sort();
    const targetPaths = [...new Set(target?.paths ?? [])].sort();
    if (target && filtered.length && JSON.stringify(filtered) === JSON.stringify(targetPaths)) {
      const placed = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS(SELECT 1 FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes'
          AND jsonb_path_exists("contentJson", '$.**.placement[*] ? (@ == $facet)', jsonb_build_object('facet', ${target.slug}))) AS exists
      `;
      if (!placed[0]?.exists) {
        const extras = new URLSearchParams();
        for (const [key, raw] of Object.entries(query)) {
          if (["kind", "type", ...TEMPLATE_FACETS].includes(key)) continue;
          for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) extras.append(key, value);
        }
        return { ...state, path: target.slug, canonicalPath: target.slug, noindex: false,
          redirectPath: target.slug + (extras.size ? `?${extras}` : "") };
      }
    }
  }
  return state;
});

export async function redirectAidreamcapesTemplateFilter(siteSlug: string | undefined, path: string, query: TemplateFilterQuery, basePath = "") {
  if (siteSlug !== "aidreamcapes" && siteSlug !== "aivideosugc") return;
  const state = await resolveAidreamcapesTemplateFilter(path, query);
  if (state?.redirectPath) permanentRedirect(basePath + state.redirectPath);
}

/** Copy for the standalone kind catalogs (/templates?kind=video|photo).
 * These are indexable pages, so the copy must describe exactly the filtered
 * result set instead of reusing the all-examples title. */
export const AIDREAMCAPES_KIND_CATALOG_COPY: Record<"video" | "photo", { title: string; description: string; h1: string; lead: string }> = {
  video: {
    title: "AI UGC Video Examples | AIVideosUGC",
    description: "Browse every AI product video example on AIVideosUGC. Open any example to see the full prompt behind it and recreate it with your own product.",
    h1: "Video Examples",
    lead: "Every AI product video example in one place. Open any example to see the full prompt behind it, then recreate it with your own product."
  },
  photo: {
    title: "AI Product Photo Examples | AIVideosUGC",
    description: "Browse every AI product photo example on AIVideosUGC. Open any example to see the prompt behind it and recreate it with your own product.",
    h1: "Photo Examples",
    lead: "Every AI product photo example in one place. Open any example to see the prompt behind it, then recreate it with your own product."
  }
};

/** Kind catalog views are indexable pages with their own copy; facet-filtered
 * variants keep the noindex metadata and inherit the current page's copy. */
export async function aidreamcapesTemplateFilterMetadata(siteSlug: string | undefined, path: string, query: TemplateFilterQuery): Promise<Metadata | undefined> {
  if (siteSlug !== "aidreamcapes" && siteSlug !== "aivideosugc") return;
  // Kind catalogs are decided by pure URL rules — they must not depend on the
  // template inventory, which content rewrites may reshuffle at any time.
  if (path === "/templates") {
    const urlState = normalizeAidreamcapesTemplateFilter(path, query);
    const kind = urlState.filters.kind;
    if (!urlState.noindex && (kind === "video" || kind === "photo")) {
      const copy = AIDREAMCAPES_KIND_CATALOG_COPY[kind];
      const canonical = new URL(urlState.canonicalPath, "https://www.aivideosugc.com").href;
      const row = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: "site_aidreamcapes", slug: path } }, select: { contentJson: true } });
      const seo = (row?.contentJson as { seo?: { ogImage?: string; ogImageAlt?: string } } | undefined)?.seo;
      const images = seo?.ogImage ? [{ url: new URL(seo.ogImage, canonical).href, alt: seo.ogImageAlt }] : [];
      return {
        title: { absolute: copy.title },
        description: copy.description,
        alternates: { canonical },
        openGraph: { title: copy.title, description: copy.description, url: canonical, images },
        twitter: { card: "summary_large_image", title: copy.title, description: copy.description, images }
      };
    }
  }
  const state = await resolveAidreamcapesTemplateFilter(path, query);
  if (!state) return;
  if (!state?.noindex) return;
  const row = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: "site_aidreamcapes", slug: path } }, select: { contentJson: true } });
  const content = row?.contentJson as { seo?: { title?: string; description?: string; ogImage?: string; ogImageAlt?: string } } | undefined;
  const seo = content?.seo;
  if (!seo?.title || !seo.description) return;
  const canonical = new URL(state.canonicalPath, "https://www.aivideosugc.com").href;
  const images = seo.ogImage ? [{ url: new URL(seo.ogImage, canonical).href, alt: seo.ogImageAlt }] : [];
  return { title: { absolute: seo.title }, description: seo.description, robots: { index: false, follow: true },
    alternates: { canonical }, openGraph: { title: seo.title, description: seo.description, url: canonical, images },
    twitter: { card: "summary_large_image", title: seo.title, description: seo.description, images } };
}
