import styles from "./template-directory.module.css";
import { Crumbs, Faq } from "./parts";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { pickerPresetId } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { DirectoryMediaCard } from "@/lib/aidreamcapes-workspace/media-placement";
import { templateMatchesFilters, type TemplateFilterState } from "@/lib/aidreamcapes-template-filter";
import type { V2Data, V2Resolvers, V2VisualPickerCard } from "./types";
export type Directory = { paths: string[]; links: { label: string; href: string }[] };
export type Template = { id: string; kind: "photo" | "video"; path: string; name: string; description: string; card: V2VisualPickerCard; industries: string[]; platforms: string[]; occasions: string[] };
export type ExampleDirectoryConfig = { links: { label: string; href: string }[]; pageSize?: number };
export type GalleryItem = { kind: "photo" | "video"; slug: string; label: string; href: string; image: { src: string; alt?: string; w?: number; h?: number } };
export type ExampleGalleryState = { items: GalleryItem[]; total: number; page: number; pageSize: number; totalPages: number; kind?: "photo" | "video" };

/** The /templates example gallery: every public example, newest first, SSR-cumulative pagination. */
export function ExampleDirectory({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const directory = data.exampleDirectory as ExampleDirectoryConfig;
  const gallery = data.exampleGallery as ExampleGalleryState | undefined;
  if (!gallery) return null;
  const loadMoreHref = (() => {
    if (gallery.page >= gallery.totalPages) return undefined;
    const params = new URLSearchParams();
    params.set("page", String(gallery.page + 1));
    if (gallery.kind) params.set("kind", gallery.kind);
    return `/templates?${params.toString()}`;
  })();
  return <>
    <section className="sec"><div className={`wrap ${styles.directory}`}>
      <Crumbs items={data.breadcrumbs} r={r} />
      <h1>{String(data.h1)}</h1><p>{String(data.lead ?? "")}</p>
      <nav aria-label="Browse examples" className={styles.links}>{directory.links.map(link => <WorkspaceEntryLink className="chip" key={link.href} href={r.href(link.href)}>{link.label}</WorkspaceEntryLink>)}</nav>
      <p className="meta-line">{gallery.total} examples</p>
      <div className="tgrid" data-example-gallery="true">{gallery.items.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
        <a className="ti" href={r.href(item.href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} /></a>
        <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
      </article>)}</div>
      {loadMoreHref ? <p style={{ marginTop: 28 }}><a className="btn btn-ghost" href={r.href(loadMoreHref)} rel="next">Load more examples</a></p> : null}
    </div></section>
    {data.faq.length ? <Faq items={data.faq} r={r} /> : null}
  </>;
}

export function TemplateDirectory({ data, r, query = {} }: { data: V2Data; r: V2Resolvers; query?: Record<string, string | string[] | undefined> }) {
  const directory = data.templateDirectory as Directory;
  const all = data.directoryTemplates as Template[] | undefined;
  if (!all) return null;
  const state = data.directoryFilterState as TemplateFilterState | undefined;
  const value = (key: string) => state ? state.filters[key as keyof typeof state.filters] ?? "" : typeof query[key] === "string" ? query[key] as string : "";
  const templates = state?.invalid ? [] : all.filter(t => templateMatchesFilters(t, state?.filters ?? Object.fromEntries(["kind", "industries", "platforms", "occasions"].map(key => [key, value(key)]))));
  const media = state?.invalid ? [] : ((data.directoryMedia as DirectoryMediaCard[] | undefined) ?? []).filter(card => !value("kind") || card.kind === value("kind"));
  const labels = data.directoryLabels as Record<string, string>;
  const label = (path: string) => labels[path] ?? path;
  const mediaHeading = String(data.label ?? "").trim() || "category";
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
      {templates.length && data.templateHeading ? <h2>{String(data.templateHeading)}</h2> : null}
      <div className="tgrid">{templates.map((template, index) => {
        // A template card in the directory opens the template's own page. The
        // media of the template is a separate detail page, linked from the
        // template page itself.
        const href = template.path;
        return <article className="tc" key={template.id} data-template-id={template.id} data-type={template.kind}>
          <a className="ti" href={r.href(href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" src={r.asset(template.card.image.src)} alt={template.card.image.alt} width={template.card.image.w ?? 640} height={template.card.image.h ?? 640} /></a>
          <div className="tb"><span>{template.kind === "photo" ? "Photo template" : "Video template"}</span><h2><a href={r.href(href)}>{template.name}</a></h2><p>{template.description}</p><a className="use" href={r.href(href)}>View template →</a></div>
        </article>;
      })}</div>
      {!templates.length ? <p>No templates are available in this category yet.</p> : null}
      {media.length ? <section aria-labelledby="category-media-heading" className={styles.mediaSection} data-directory-media="true">
        <div className="sec-head">
          <div className="eyebrow">More examples</div>
          <h2 id="category-media-heading">{data.mediaHeading ? String(data.mediaHeading) : `More ${mediaHeading} examples`}</h2>
          {data.mediaLead ? <p>{String(data.mediaLead)}</p> : null}
        </div>
        <div className="tgrid">{media.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
          <a className="ti" href={r.href(item.href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} /></a>
          <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
        </article>)}</div>
      </section> : null}
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

