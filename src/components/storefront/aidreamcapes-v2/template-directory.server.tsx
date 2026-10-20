import "server-only";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ThemeRenderer } from "@/components/theme-renderer";
import type { SectionInstance, ThemePageJson } from "@/lib/types";
import type { V2Data } from "./types";
import type { Directory, Template } from "./template-directory";
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
    if (data.templateDirectory) {
      const directory = data.templateDirectory as Directory;
      const all = await readTemplates(directory.paths);
      const paths = [...new Set(all.flatMap(t => [...t.industries, ...t.platforms, ...t.occasions]))];
      const facets = paths.length ? await prisma.$queryRaw<Array<{ slug: string; title: string; label: string | null }>>`
        SELECT "slug", "title", jsonb_path_query_first("contentJson", '$.sections.*.settings.data.label') #>> '{}' AS label
        FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes' AND "slug" IN (${Prisma.join(paths)})
      ` : [];
      resolved = { ...data, directoryTemplates: all, directoryLabels: Object.fromEntries(facets.map(page => [page.slug, page.label ?? page.title])) };
    } else resolved = await resolveTemplateCardLinks(data);
    sections[id] = { ...section, settings: { ...settings, data: resolved } as unknown as SectionInstance["settings"] };
  }
  return <ThemeRenderer {...props} page={{ ...props.page, sections } as ThemePageJson} />;
}
