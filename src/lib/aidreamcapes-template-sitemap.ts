import type { Site, ThemePage, ThemePageJson } from "./types";

type Data = { templateDefinition?: { card?: { image?: { src?: string; alt?: string } } }; templateDirectory?: { paths?: string[] }; blockOrder?: string[] };
function templateData(content: ThemePageJson | undefined): Data | undefined {
  return Object.values(content?.sections ?? {}).filter(section => section.type === "aidreamcapes_v2_page")
    .map(section => section.settings.data as unknown as Data).find(data => data?.templateDefinition || data?.templateDirectory);
}

/** Sitemap images follow the same current LivePage references as the SSR directory. */
export function aidreamcapesTemplateSitemapMedia(site: Site, page: ThemePage): { src: string; alt: string }[] | undefined {
  if (site.id !== "site_aidreamcapes") return;
  const data = templateData(page.publishedJson);
  if (!data) return;
  const definitions = data.templateDirectory
    ? [...new Set(data.templateDirectory.paths ?? [])].flatMap(path => {
      const owner = site.pages.find(candidate => candidate.slug === path) as (ThemePage & { liveContentJson?: ThemePageJson }) | undefined;
      const definition = templateData(owner?.liveContentJson)?.templateDefinition;
      return definition ? [definition] : [];
    })
    : data.blockOrder && !data.blockOrder.includes("picker") ? [] : data.templateDefinition ? [data.templateDefinition] : [];
  const seen = new Set<string>();
  return definitions.flatMap(definition => {
    const image = definition.card?.image;
    if (!image?.src || !image.alt || seen.has(image.src)) return [];
    seen.add(image.src);
    return [{ src: image.src, alt: image.alt }];
  });
}
