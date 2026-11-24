import { preload } from "react-dom";
import styles from "./template-directory.module.css";
import { Crumbs, Faq, Section, ThematicLinkChips } from "./parts";
import { WorkspaceEntryLink } from "@/components/aidreamcapes-workspace/entry-link";
import { pickerPresetId } from "@/lib/aidreamcapes-workspace/preset-contract";
import type { DirectoryMediaCard } from "@/lib/aidreamcapes-workspace/media-placement";
import { templateMatchesFilters, type TemplateFilterState } from "@/lib/aidreamcapes-template-filter";
import { listingGalleryPagePath, listingPagePath } from "@/lib/listing-pagination";
import { Adc2VideoPreview } from "./video-preview-card";
import { aidreamcapesV2ResponsiveImagePropsFor } from "@/lib/aidreamcapes-v2-responsive-images";
import { AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES } from "./image-sizes";
import type { V2Data, V2Resolvers, V2VisualPickerCard } from "./types";
import { MEDIA_PAGE_SIZE } from "./types";
export type Directory = { paths: string[]; links: { label: string; href: string }[]; hideTemplates?: boolean };
export type Template = { id: string; kind: "photo" | "video"; path: string; name: string; description: string; card: V2VisualPickerCard; industries: string[]; platforms: string[]; occasions: string[] };
export type ExampleDirectoryConfig = { links: { label: string; href: string }[]; pageSize?: number };
export type GalleryItem = { kind: "photo" | "video"; slug: string; label: string; href: string; image: { src: string; alt?: string; w?: number; h?: number }; video?: { src: string; poster: string; width?: number; height?: number; duration?: number; name?: string } };
export type ExampleGalleryState = { items: GalleryItem[]; total: number; page: number; totalPages: number; kind?: "photo" | "video"; basePath?: string };
export type MediaPaginationState = { page: number; totalPages: number; total: number; basePath: string };

function listingAbsoluteUrl(href: string): string {
  if (/^https?:\/\//i.test(href)) return href;
  return `https://www.aivideosugc.com${href.startsWith("/") ? "" : "/"}${href}`;
}

/** ItemList for the cards actually rendered on this paginated page. Positions
 * continue the global list, so page 2 starts at 21 instead of restarting at 1. */
export function ListingItemListJsonLd({ items, startPosition }: { items: { name: string; url: string }[]; startPosition: number }) {
  if (!items.length) return null;
  const json = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: startPosition + index,
      name: item.name,
      url: listingAbsoluteUrl(item.url)
    }))
  }).replace(/</g, "\\u003c");
  // The storefront middleware hoists SEO tags into <head> after SSR. A body
  // `application/ld+json` script would move and break hydration, so this uses
  // the reviewed body-marker contract: inert JSON in the body, a normalized
  // ld+json copy in <head>.
  return <script dangerouslySetInnerHTML={{ __html: json }} data-storefront-json-ld="body-marker" type="application/json" />;
}

function exampleRange(page: number, pageSize: number, count: number, total: number): { start: number; end: number } {
  const start = Math.max(1, (page - 1) * pageSize + 1);
  return { start, end: Math.max(start, Math.min(total, start + Math.max(0, count - 1))) };
}

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
export function DiscretePager({ page, totalPages, basePath, params = {}, r, ariaLabel, pageParam = "page" }: {
  page: number;
  totalPages: number;
  /** Canonical row path ("", "/templates", "/industries/beauty-skincare", …). */
  basePath: string;
  params?: Record<string, string | undefined>;
  r: V2Resolvers;
  ariaLabel: string;
  /** Which pager this is. The page identity always lives in the path
   * (`/page2`, or `/gallery/page2` for the secondary hub pager); the parameter
   * name only selects that namespace. */
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (target: number) => {
    const kind = params.kind;
    const kindSuffix = (kind === "photo" || kind === "video") && basePath === "/templates" ? `/${kind}` : "";
    const base = `${basePath}${kindSuffix}`;
    const pagePath = pageParam === "galleryPage" ? listingGalleryPagePath(base, target) : listingPagePath(base, target);
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) if (value && key !== "kind") search.set(key, value);
    return r.href(search.size ? `${pagePath}?${search}` : pagePath);
  };
  return <nav aria-label={ariaLabel} className={styles.galleryPages}>
    <span className={styles.pageRange}>Page {page} of {totalPages}</span>
    {page > 1 ? <a className="btn btn-ghost" href={href(page - 1)} rel="prev">Previous</a> : null}
    {paginationWindow(page, totalPages).map((entry, index) => entry === "gap"
      ? <span key={`gap-${index}`} className={styles.pageGap} aria-hidden="true">…</span>
      : entry === page
        ? <span key={`page-${entry}`} className={styles.pageNum} aria-current="page">{entry}</span>
        : <a key={`page-${entry}`} className={styles.pageNum} href={href(entry)}>{entry}</a>)}
    {page < totalPages ? <a className="btn btn-primary" href={href(page + 1)} rel="next">Next</a> : null}
  </nav>;
}

/** Preload the first two card covers of a media grid. The first card is the
 * grid's LCP element on mobile and desktop (equal-sized cards, first DOM
 * position wins); the second covers the first row on multi-column layouts.
 * Video cards contribute their display poster, photo cards their image. */
function preloadMediaGridLcp(items: ReadonlyArray<GalleryItem | DirectoryMediaCard>, r: V2Resolvers): void {
  const covers = items.slice(0, 2)
    .map(item => (item.video ? item.video.poster : item.image.src))
    .filter((src): src is string => Boolean(src));
  covers.forEach((src, index) => preload(r.asset(src), { as: "image", ...(index === 0 ? { fetchPriority: "high" } : {}) }));
}

/** The owner-approved internal-link module ("Related Pages" cards). Data-driven:
 * every directory page carries its own relatedLinks list, so the module renders
 * wherever the page provides it without per-page code. */
export function DirectoryRelatedSection({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const links = data.relatedLinks as { label: string; href: string }[] | undefined;
  if (!Array.isArray(links) || !links.length) return null;
  const title = typeof data.relatedH2 === "string" && data.relatedH2 ? data.relatedH2 : "Related Pages";
  return <Section eyebrow="Related Pages" title={title}><ThematicLinkChips links={links} r={r} /></Section>;
}

/** The gallery card grid shared by the /templates directory and hub galleries. */
function GalleryCards({ items, r }: { items: GalleryItem[]; r: V2Resolvers }) {
  return <>{items.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
    <a className="ti" href={r.href(item.href)}>{item.video ? (
      <Adc2VideoPreview ariaLabel={item.video.name ?? item.label} media={{ ...item.video, poster: r.asset(item.video.poster) }} posterEager={index < 6} posterEagerMobile={index === 0} forceAspectRatio="9 / 16" />
    ) : <img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" {...aidreamcapesV2ResponsiveImagePropsFor(item.image.src, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES, r.asset)} src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} />}</a>
    <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
  </article>)}</>;
}

/** A paginated example-gallery section inside another page layout (the video
 * hub's "browse every video example"). Same card grid and pager as
 * /templates, but anchored to the hosting page's own URLs. */
export function ExampleGallerySection({ gallery, r, eyebrow, title, lead, pageParam = "page" }: {
  gallery: ExampleGalleryState;
  r: V2Resolvers;
  eyebrow: string;
  title: string;
  lead?: string;
  pageParam?: string;
}) {
  // The hub gallery renders below the page's own hero, so it is not the LCP
  // element — preloading its posters here would pull bandwidth away from the
  // element that is. Card posters stay on their normal image priorities.
  const range = exampleRange(gallery.page, MEDIA_PAGE_SIZE, gallery.items.length, gallery.total);
  return <section className="sec"><div className="wrap">
    <div className="sec-head">
      <div className="eyebrow">{eyebrow}</div>
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}
      <p className="meta-line">Examples {range.start}–{range.end} of {gallery.total}</p>
    </div>
    <div className="tgrid" data-example-gallery="true"><GalleryCards items={gallery.items} r={r} /></div>
    <DiscretePager page={gallery.page} totalPages={gallery.totalPages} basePath={gallery.basePath ?? "/"} r={r} pageParam={pageParam} ariaLabel="Browse more examples by page" />
    <ListingItemListJsonLd items={gallery.items.map(item => ({ name: item.label, url: item.href }))} startPosition={range.start} />
  </div></section>;
}

export function ExampleDirectory({ data, r }: { data: V2Data; r: V2Resolvers }) {
  const directory = data.exampleDirectory as ExampleDirectoryConfig;
  const gallery = data.exampleGallery as ExampleGalleryState | undefined;
  if (!gallery) return null;
  // The first video card is the gallery's LCP element on both mobile and
  // desktop (equal-sized cards, first DOM position wins). Preloading its
  // display poster moves the discover-or-fetch-latency out of the critical
  // path; the second card covers the first row on multi-column layouts.
  preloadMediaGridLcp(gallery.items, r);
  const pageSize = Math.max(1, Math.min(50, Math.floor(Number(directory.pageSize)) || 12));
  const range = exampleRange(gallery.page, pageSize, gallery.items.length, gallery.total);
  return <>
    <section className="sec"><div className={`wrap ${styles.directory}`}>
      <Crumbs items={data.breadcrumbs} r={r} />
      <h1>{String(data.h1)}</h1><p>{String(data.lead ?? "")}</p>
      <p className="meta-line">Examples {range.start}–{range.end} of {gallery.total}</p>
      <div className="tgrid" data-example-gallery="true"><GalleryCards items={gallery.items} r={r} /></div>
      {gallery.totalPages > 1 ? <DiscretePager page={gallery.page} totalPages={gallery.totalPages} basePath={gallery.basePath ?? "/templates"} params={gallery.kind ? { kind: gallery.kind } : {}} r={r} ariaLabel="Browse more examples by page" /> : null}
    </div></section>
    <ListingItemListJsonLd items={gallery.items.map(item => ({ name: item.label, url: item.href }))} startPosition={range.start} />
    <DirectoryRelatedSection data={data} r={r} />
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
  const mediaRange = mediaPager ? exampleRange(mediaPager.page, MEDIA_PAGE_SIZE, media.length, mediaPager.total) : undefined;
  if (directory.hideTemplates) {
    // The directory is example-first: the template registry (paths) stays in
    // the row data, but the page presents the placed media grid only. Cards
    // with a video preview play their 10-second loop in place, like the
    // /templates gallery; the grid paginates as independent SSR documents.
    preloadMediaGridLcp(media, r);
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
            {mediaPager && mediaRange ? <p className="meta-line">Examples {mediaRange.start}–{mediaRange.end} of {mediaPager.total}</p> : null}
          </div>
          <div className="tgrid">{media.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
            <a className="ti" href={r.href(item.href)}>{item.video ? (
              <Adc2VideoPreview ariaLabel={item.label} media={{ ...item.video, name: item.label, poster: r.asset(item.video.poster) }} posterEager={index < 6} posterEagerMobile={index === 0} forceAspectRatio="9 / 16" />
            ) : <img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" {...aidreamcapesV2ResponsiveImagePropsFor(item.image.src, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES, r.asset)} src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} />}</a>
            <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
          </article>)}</div>
          {mediaPager ? <DiscretePager page={mediaPager.page} totalPages={mediaPager.totalPages} basePath={mediaPager.basePath} r={r} ariaLabel="Browse more examples by page" /> : null}
        </section> : null}
      </div></section>
      <ListingItemListJsonLd items={media.map(item => ({ name: item.label, url: item.href }))} startPosition={mediaRange?.start ?? 1} />
      <DirectoryRelatedSection data={data} r={r} />
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
          <a className="ti" href={r.href(href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} decoding="async" {...aidreamcapesV2ResponsiveImagePropsFor(template.card.image.src, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES, r.asset)} src={r.asset(template.card.image.src)} alt={template.card.image.alt} width={template.card.image.w ?? 640} height={template.card.image.h ?? 640} /></a>
          <div className="tb"><span>{template.kind === "photo" ? "Photo template" : "Video template"}</span><h2><a href={r.href(href)}>{template.name}</a></h2><p>{template.description}</p><a className="use" href={r.href(href)}>View template →</a></div>
        </article>;
      })}</div>
      {!templates.length ? <p>No templates are available in this category yet.</p> : null}
      {media.length ? <section aria-labelledby="category-media-heading" className={styles.mediaSection} data-directory-media="true">
        <div className="sec-head">
          <div className="eyebrow">More examples</div>
          <h2 id="category-media-heading">{data.mediaHeading ? String(data.mediaHeading) : `More ${mediaHeading} examples`}</h2>
          {data.mediaLead ? <p>{String(data.mediaLead)}</p> : null}
          {mediaPager && mediaRange ? <p className="meta-line">Examples {mediaRange.start}–{mediaRange.end} of {mediaPager.total}</p> : null}
        </div>
        <div className="tgrid">{media.map((item, index) => <article className="tc" data-media-slug={item.slug} key={`${item.kind}-${item.slug}`}>
          <a className="ti" href={r.href(item.href)}><img className={styles.cardImage} loading={index < 4 ? "eager" : "lazy"} decoding="async" {...aidreamcapesV2ResponsiveImagePropsFor(item.image.src, AIDREAMCAPES_V2_TEMPLATE_CARD_SIZES, r.asset)} src={r.asset(item.image.src)} alt={item.image.alt || item.label} width={item.image.w ?? 640} height={item.image.h ?? 640} /></a>
          <div className="tb"><span>{item.kind === "photo" ? "Photo example" : "Video example"}</span><h3><a href={r.href(item.href)}>{item.label}</a></h3></div>
        </article>)}</div>
      </section> : null}
    </div></section>
    <ListingItemListJsonLd items={media.map(item => ({ name: item.label, url: item.href }))} startPosition={mediaRange?.start ?? 1} />
    <DirectoryRelatedSection data={data} r={r} />
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

