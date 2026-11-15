import { aidreamcapesV2ResponsivePosterSrc } from "./aidreamcapes-v2-responsive-images";
import { listAidreamcapesExampleGalleryEntries } from "./aidreamcapes-workspace/media-cards.server";
import { resolveDirectoryMedia } from "./aidreamcapes-workspace/media-placement.server";
import type { Site, ThemePage, ThemePageJson } from "./types";

type Data = {
  exampleDirectory?: { pageSize?: number };
  templateDirectory?: { paths?: string[]; hideTemplates?: boolean };
  templateDefinition?: { card?: { image?: { src?: string; alt?: string } } };
  kind?: string;
  blockOrder?: string[];
};
function templateData(content: ThemePageJson | undefined): Data | undefined {
  return Object.values(content?.sections ?? {}).filter(section => section.type === "aidreamcapes_v2_page")
    .map(section => section.settings.data as unknown as Data).find(data => data?.templateDefinition || data?.templateDirectory || data?.exampleDirectory);
}

function normalizePath(value: string): string {
  const trimmed = `/${value.trim()}`.replace(/\/+$/, "");
  return trimmed === "/" ? "/" : trimmed;
}

/**
 * Sitemap images follow the same current LivePage references as the SSR page.
 * Every branch mirrors the page-1 SSR of the matching renderer branch in
 * template-directory.server.tsx, so each submitted address is exactly an
 * address the page renders: video cards render their responsive poster
 * variant, cards without playable video render their still image raw.
 */
export async function aidreamcapesTemplateSitemapMedia(site: Site, page: ThemePage): Promise<{ src: string; alt: string }[] | undefined> {
  if (site.id !== "site_aidreamcapes") return undefined;
  const data = templateData(page.publishedJson);
  if (!data) return undefined;

  // Example-first catalogs (/templates): the page renders the public gallery
  // enumeration's first SSR page; video entries render their mapped poster.
  if (data.exampleDirectory) {
    const pageSize = Math.max(1, Math.min(50, Math.floor(Number(data.exampleDirectory.pageSize)) || 12));
    const all = await listAidreamcapesExampleGalleryEntries();
    return all.slice(0, pageSize).flatMap((entry) => {
      const alt = entry.image.alt ?? entry.label;
      if (entry.video?.src) return [{ src: aidreamcapesV2ResponsivePosterSrc(entry.video.poster?.src ?? entry.image.src), alt }];
      return [{ src: entry.image.src, alt }];
    });
  }

  if (data.templateDirectory) {
    const kind = typeof data.kind === "string" ? data.kind : "";
    const isFacet = kind === "industry" || kind === "platform" || kind === "occasion";
    if (isFacet) {
      // The "Made with" media grid: resolveDirectoryMedia already maps video
      // posters to the responsive variant the card renders. The canonical
      // address renders page 1, which has no filters, so the grid is the
      // video-first ordering's first page.
      const cards = await resolveDirectoryMedia(normalizePath(page.slug));
      const ordered = [...cards].sort((left, right) => (left.video ? 0 : 1) - (right.video ? 0 : 1));
      return ordered.slice(0, 20).flatMap((card) => {
        const alt = card.image.alt ?? card.label;
        return card.video ? [{ src: card.video.poster, alt }] : [{ src: card.image.src, alt }];
      });
    }
    if (data.templateDirectory.hideTemplates) return [];
    // Template registry grid: owner template card images render raw.
    const definitions = [...new Set(data.templateDirectory.paths ?? [])].flatMap(path => {
      const owner = site.pages.find(candidate => candidate.slug === path) as (ThemePage & { liveContentJson?: ThemePageJson }) | undefined;
      const definition = templateData(owner?.liveContentJson)?.templateDefinition;
      return definition ? [definition] : [];
    });
    const seen = new Set<string>();
    return definitions.flatMap(definition => {
      const image = definition.card?.image;
      if (!image?.src || !image.alt || seen.has(image.src)) return [];
      seen.add(image.src);
      return [{ src: image.src, alt: image.alt }];
    });
  }

  // Own template page: the template card leads the picker grid, and a page
  // whose block order has no picker block renders its step UI instead —
  // neither renders a card image, so neither submits one.
  if (data.blockOrder && !data.blockOrder.includes("picker")) return [];
  const image = data.templateDefinition?.card?.image;
  if (!image?.src || !image.alt) return [];
  return [{ src: image.src, alt: image.alt }];
}
