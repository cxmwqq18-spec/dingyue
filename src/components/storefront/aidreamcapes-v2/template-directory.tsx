import { preload } from "react-dom";
import styles from "./template-directory.module.css";
import { Crumbs, Faq } from "./parts";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { pickerPresetId } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { DirectoryMediaCard } from "@/lib/aidreamcapes-workspace/media-placement";
import { templateMatchesFilters, type TemplateFilterState } from "@/lib/aidreamcapes-template-filter";
import { Adc2VideoPreview } from "./video-preview-card";
import type { V2Data, V2Resolvers, V2VisualPickerCard } from "./types";
export type Directory = { paths: string[]; links: { label: string; href: string }[]; hideTemplates?: boolean };
export type Template = { id: string; kind: "photo" | "video"; path: string; name: string; description: string; card: V2VisualPickerCard; industries: string[]; platforms: string[]; occasions: string[] };
export type ExampleDirectoryConfig = { links: { label: string; href: string }[]; pageSize?: number };
export type GalleryItem = { kind: "photo" | "video"; slug: string; label: string; href: string; image: { src: string; alt?: string; w?: number; h?: number }; video?: { src: string; poster: string; width?: number; height?: number; duration?: number; name?: string } };
export type ExampleGalleryState = { items: GalleryItem[]; total: number; page: number; totalPages: number; kind?: "photo" | "video"; basePath?: string };
export type MediaPaginationState = { page: number; totalPages: number; total: number; basePath: string };

/** The /templates example gallery: every public example, newest first.
 * Pages are independent SSR documents: the grid shows the requested number of
 * cards and the pager links the neighbouring pages as plain anchors, so every
 * page — including deep-linked URLs — is directly addressable and crawlable
 * without any browser data request. */
/** Discrete pager window: the three first pages, the three last pages and
 * the pages around the current one, with gap markers where the groups do not
 * touch. Everything renders as plain anchors (or a marker span), so deep
 * pagination stays crawlable without JavaScript. */
function paginationWindow(current: number, total: number): Array<number | "gap"> {
  const wanted = new Set<number>([1, 2, 3, total - 2, total - 1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter(page => page >= 1 && page <= total).sort((a, b) => a - b);
  const entries: Array<number | "gap"> = [];
  let previous = 0;
  for (const page of pages) {
    if (previous && page - previous > 1) entries.push("gap");
    entries.push(page);
    previous = page;
  }
  return entries;
}

/** Shared discrete pager for SSR media grids (example gallery, directory
 * media, hub pickers). Every page is a plain anchor, so deep pagination stays
 * addressable and crawlable without JavaScript; page 1 keeps the bare
 * canonical URL, and preserved filters (e.g. the kind filter) ride along on
 * every link and as hidden fields in the no-JS jump form. */
export function DiscretePager({ page, totalPages, basePath, params = {}, r, ariaLabel }: {
  page: number;
  totalPages: number;
  /** Canonical row path ("", "/templates", "/industries/beauty-skincare", …). */
  basePath: string;
  params?: Record<string, string | undefined>;
  r: V2Resolvers;
  ariaLabel: string;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
    if (target > 1) search.set("page", String(target));
    const query = search.toString();
    return r.href(query ? `${basePath}?${query}` : basePath);
  };
  const jumpParams = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  return <nav aria-label={ariaLabel} className={styles.galleryPages}>
    {page > 1 ? <a className="btn btn-ghost" href={href(page - 1)} rel="prev">Previous</a> : null}
    {paginationWindow(page, totalPages).map((entry, index) => entry === "gap"
      ? <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">…</span>
      : entry === page
        ? <span key={`page-${entry}`} className={styles.pageNum} aria-current="page">{entry}</span>
        : <a key={`page-${entry}`} className={styles.pageNum} href={href(entry)}>{entry}</a>)}
    {page < totalPages ? <a className="btn btn-primary" href={href(page + 1)} rel="next">Next</a> : null}
    <form className={styles.pageJump} method="get" action={r.href(basePath)}>
      {jumpParams.map(([key, value]) => <input key={key} type="hidden" name={key} value={value} />)}
      <input name="page" type="number" inputMode="numeric" min={1} max={totalPages} defaultValue={page} aria-label={`Go to page, 1 to ${totalPages}`} />
      <button type="submit" className="btn btn-ghost">Go</button>
    </form>
  </nav>;
}

export function ExampleDirectory({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const directory = data.exampleDirectory as ExampleDirectoryConfig;
  const gallery = data.exampleGallery as ExampleGalleryState | undefined;
  if (!gallery) return null;
  // The first video card is the gallery's LCP element on both mobile and
  // desktop (equal-sized cards, first DOM position wins). Preloading its
  // display poster moves the discover-or-fetch-latency out of the critical
  // path; the second card covers the first row on multi-column layouts.
  const firstVideo = gallery.items.find(item => item.video);
  const secondVideo = gallery.items.filter(item => item.video)[1];
  if (firstVideo) preload(r.asset(firstVideo.video!.poster), { as: "image", fetchPriority: "high" });
  if (secondVideo) preload(r.asset(secondVideo.video!.poster), { as: "image" });
  return <>
    <section className="sec"><div className={`wrap ${styles.directory}`}>
      <Crumbs items={data.breadcrumbs} r={r} />
      <h1>{String(data.h1)}</h1><p>{String(data.lead ?? "")}</p>
      <nav aria-label="Browse examples" className={styles.links}>{directory.links.map(link => <WorkspaceEntryLink className="chip" key={link.href} href={r.href(link.href)}>{link.label}</WorkspaceEntryLink>)}</nav>
      <p className="meta-line">{gallery.total} examples</p>
      <div className="tgrid" data-example-gallery="true">{gallery.items.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
        <a className="ti" href={r.href(item.href)}>{item.video ? (
          <Adc2VideoPreview ariaLabel={item.video.name ?? item.label} media={{ ...item.video, poster: r.asset(item.video.poster) }} />
        ) : <img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} />}</a>
        <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
      </article>)}
      </div>
      {gallery.totalPages > 1 ? <DiscretePager page={gallery.page} totalPages={gallery.totalPages} basePath={gallery.basePath ?? "/templates"} params={gallery.kind ? { kind: gallery.kind } : {}} r={r} ariaLabel="Browse more examples by page" /> : null}
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
  const media = state?.invalid ? [] : ((data.directoryMedia as DirectoryMediaCard[] | undefined) ?? []).filter(card => !value("kind") || card.kind === value("kind"));
  const labels = data.directoryLabels as Record<string, string>;
  const label = (path: string) => labels[path] ?? path;
  const mediaHeading = String(data.label ?? "").trim() || "category";
  const mediaPager = data.directoryMediaPagination as MediaPaginationState | undefined;
  if (directory.hideTemplates) {
    // The directory is example-first: the template registry (paths) stays in
    // the row data, but the page presents the placed media grid only. Cards
    // with a video preview play their 10-second loop in place, like the
    // /templates gallery; the grid paginates as independent SSR documents.
    return <>
      <section className="sec"><div className={`wrap ${styles.directory}`}>
        <Crumbs items={data.breadcrumbs} r={r} />
        <h1>{String(data.h1)}</h1><p>{String(data.lead ?? "")}</p>
        <nav aria-label="Browse examples" className={styles.links}>{directory.links.map(link => <WorkspaceEntryLink className="chip" key={link.href} href={r.href(link.href)}>{link.label}</WorkspaceEntryLink>)}</nav>
        {media.length ? <section aria-labelledby="category-media-heading" className={styles.mediaSection} data-directory-media="true">
          <div className="sec-head">
            <div className="eyebrow">Examples</div>
            <h2 id="category-media-heading">{data.mediaHeading ? String(data.mediaHeading) : `${mediaHeading} examples`}</h2>
            {data.mediaLead ? <p>{String(data.mediaLead)}</p> : null}
          </div>
          <div className="tgrid">{media.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
            <a className="ti" href={r.href(item.href)}>{item.video ? (
              <Adc2VideoPreview ariaLabel={item.label} media={{ ...item.video, name: item.label, poster: r.asset(item.video.poster) }} />
            ) : <img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} />}</a>
            <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
          </article>)}</div>
          {mediaPager ? <DiscretePager page={mediaPager.page} totalPages={mediaPager.totalPages} basePath={mediaPager.basePath} r={r} ariaLabel="Browse more examples by page" /> : null}
        </section> : null}
      </div></section>
      {data.faq.length ? <Faq items={data.faq} r={r} /> : null}
    </>;
  }
  const templates = state?.invalid ? [] : all.filter(t => templateMatchesFilters(t, state?.filters ?? Object.fromEntries(["kind", "industries", "platforms", "occasions"].map(key => [key, value(key)]))));
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

