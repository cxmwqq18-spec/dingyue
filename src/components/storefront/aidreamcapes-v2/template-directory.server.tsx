import "server-only";
import styles from "./template-directory.module.css";
import { Crumbs, Faq } from "./parts";
import { cache } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { pickerPresetId } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { V2Data, V2Resolvers, V2VisualPickerCard } from "./types";

type Directory = { paths: string[]; links: { label: string; href: string }[] };
type Template = { id: string; kind: "photo" | "video"; path: string; name: string; description: string; card: V2VisualPickerCard; industries: string[]; platforms: string[]; occasions: string[] };
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

export async function TemplateDirectory({ data, r, query = {} }: { data: V2Data; r: V2Resolvers; query?: Record<string, string | string[] | undefined> }) {
  const directory = data.templateDirectory as Directory;
  const all = await readTemplates(directory.paths);
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const templates = all.filter(t => (!value("kind") || t.kind === value("kind")) && (["industries", "platforms", "occasions"] as const).every(key => !value(key) || t[key].includes(value(key))));
  const paths = [...new Set(all.flatMap(t => [...t.industries, ...t.platforms, ...t.occasions]))];
  const facets = paths.length ? await prisma.$queryRaw<Array<{ slug: string; title: string; label: string | null }>>`
    SELECT "slug", "title", jsonb_path_query_first("contentJson", '$.sections.*.settings.data.label') #>> '{}' AS label
    FROM "LivePage" WHERE "siteId" = 'site_aidreamcapes' AND "slug" IN (${Prisma.join(paths)})
  ` : [];
  const label = (path: string) => facets.find(page => page.slug === path)?.label ?? facets.find(page => page.slug === path)?.title ?? path;
  return <>
    <section className="sec"><div className={`wrap ${styles.directory}`}>
      <Crumbs items={data.breadcrumbs} r={r} />
      <h1>{String(data.h1)}</h1><p>{String(data.lead ?? "")}</p>
      <nav aria-label="Browse templates" className={styles.links}>{directory.links.map(link => <WorkspaceEntryLink className="chip" key={link.href} href={r.href(link.href)}>{link.label}</WorkspaceEntryLink>)}</nav>
      <form method="get" className={styles.filters} aria-label="Filter templates">
        <label>Type <select name="kind" defaultValue={value("kind")}><option value="">All types</option>{[...new Set(all.map(t => t.kind))].map(kind => <option key={kind} value={kind}>{kind === "photo" ? "Photo" : "Video"}</option>)}</select></label>
        {(["industries", "platforms", "occasions"] as const).map(key => <label key={key}>{key === "industries" ? "Industry" : key === "platforms" ? "Platform" : "Occasion"} <select name={key} defaultValue={value(key)}><option value="">All</option>{[...new Set(all.flatMap(t => t[key]))].map(path => <option key={path} value={path}>{label(path)}</option>)}</select></label>)}
        <button className="btn btn-primary" type="submit">Apply filters</button>
      </form>
      <p className="meta-line">{templates.length} templates</p>
      <div className="tgrid">{templates.map(template => <article className="tc" key={template.id} data-template-id={template.id} data-type={template.kind}>
        <WorkspaceEntryLink className="ti" href={r.href(template.path)}><img className={styles.cardImage} loading="lazy" decoding="async" src={r.asset(template.card.image.src)} alt={template.card.image.alt} width={template.card.image.w ?? 640} height={template.card.image.h ?? 640} /></WorkspaceEntryLink>
        <div className="tb"><span>{template.kind === "photo" ? "Photo template" : "Video template"}</span><h2><WorkspaceEntryLink href={r.href(template.path)}>{template.name}</WorkspaceEntryLink></h2><p>{template.description}</p><WorkspaceEntryLink className="use" href={r.href(template.path)}>View template →</WorkspaceEntryLink></div>
      </article>)}</div>
      {!templates.length ? <p>No templates are available in this category yet.</p> : null}
    </div></section>
    {data.faq.length ? <Faq items={data.faq} r={r} /> : null}
  </>;
}

/** Use the detail owner's current preset for every CTA on that detail. */
export function templateDetailResolvers(data: V2Data, r: V2Resolvers): V2Resolvers {
  const template = data.templateDefinition as Template | undefined;
  if (!template) return r;
  const target = `/app/create/${template.kind === "photo" ? "ai-image-generation" : "ai-video-generation"}?source=${encodeURIComponent(template.path)}&preset=${pickerPresetId(template.card)}`;
  return { ...r, href: value => value.startsWith("/app/create") ? r.href(target) : r.href(value) };
}

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
      const definition = definitions.find(t => t.card.href === item.href);
      if (definition) return { ...item, href: definition.path, name: definition.name, kind: definition.kind };
    }
    // Preset identity fields must retain their original tool path.
    return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, key === "templateDefinition" || key === "workspaceCases" ? entry : rewrite(entry)]));
  };
  const result = rewrite(data) as V2Data;
  const definition = data.templateDefinition as Template | undefined;
  if (definition && result.visual) result.visual = { ...(result.visual as Record<string, unknown>), picker: { ...((result.visual as { picker: object }).picker), cards: [definition.card] } };
  return result;
}
