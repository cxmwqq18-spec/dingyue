import styles from "./template-directory.module.css";
import { Crumbs, Faq } from "./parts";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { pickerPresetHref, pickerPresetId } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { V2Data, V2Resolvers, V2VisualPickerCard } from "./types";
export type Directory = { paths: string[]; links: { label: string; href: string }[] };
export type Template = { id: string; kind: "photo" | "video"; path: string; name: string; description: string; card: V2VisualPickerCard; industries: string[]; platforms: string[]; occasions: string[] };

export function TemplateDirectory({ data, r, query = {} }: { data: V2Data; r: V2Resolvers; query?: Record<string, string | string[] | undefined> }) {
  const directory = data.templateDirectory as Directory;
  const all = data.directoryTemplates as Template[] | undefined;
  if (!all) return null;
  const value = (key: string) => typeof query[key] === "string" ? query[key] as string : "";
  const templates = all.filter(t => (!value("kind") || t.kind === value("kind")) && (["industries", "platforms", "occasions"] as const).every(key => !value(key) || t[key].includes(value(key))));
  const labels = data.directoryLabels as Record<string, string>;
  const label = (path: string) => labels[path] ?? path;
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
      <div className="tgrid">{templates.map((template, index) => {
        const href = pickerPresetHref(template.card, template.path);
        return <article className="tc" key={template.id} data-template-id={template.id} data-type={template.kind}>
          <WorkspaceEntryLink className="ti" href={r.href(href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" src={r.asset(template.card.image.src)} alt={template.card.image.alt} width={template.card.image.w ?? 640} height={template.card.image.h ?? 640} /></WorkspaceEntryLink>
          <div className="tb"><span>{template.kind === "photo" ? "Photo template" : "Video template"}</span><h2><WorkspaceEntryLink href={r.href(href)}>{template.name}</WorkspaceEntryLink></h2><p>{template.description}</p><WorkspaceEntryLink className="use" href={r.href(href)}>View template →</WorkspaceEntryLink></div>
        </article>;
      })}</div>
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

