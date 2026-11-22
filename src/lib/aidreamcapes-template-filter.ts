/** Pure URL rules for the Aidreamcapes SSR template directories. */
export type TemplateFilterQuery = Record<string, string | string[] | undefined>;
export const TEMPLATE_FACETS = ["industries", "platforms", "occasions"] as const;
export type TemplateFacetKey = typeof TEMPLATE_FACETS[number];

/** Listing routes whose ?page=N views are standalone indexable SSR pages.
 * Facet-filtered views stay noindexed utility views; only the pagination
 * dimension gains its own indexable identity. */
const PAGINATED_LISTING_PATH_RE = /^(?:\/templates|\/industries\/[^/]+|\/platforms\/[^/]+|\/occasions\/[^/]+|\/ai-video-generation|\/tools\/[^/]+)$/;

/** The pagination page a listing request addresses. Page 1 (explicit or
 * defaulted) and unparsable values resolve to the page-1 identity, so they
 * keep today's canonical; only genuinely deeper pages differ. */
export function aidreamcapesListingPageNumber(query: TemplateFilterQuery): number {
  const raw = Array.isArray(query.page) ? query.page[0] : query.page;
  const value = Math.floor(Number(raw));
  return Number.isFinite(value) && value >= 2 && value <= 999 ? value : 0;
}

/** Distinct title for a deeper listing page: the page marker lands before the
 * trailing "| Brand" segment so the brand suffix stays the last element. */
export function aidreamcapesListingPageTitle(title: string | undefined, page: number): string | undefined {
  if (!title || !page || title.includes(`Page ${page}`)) return title;
  const marker = ` · Page ${page}`;
  const brandAt = title.lastIndexOf(" | ");
  return brandAt > 0 ? `${title.slice(0, brandAt)}${marker}${title.slice(brandAt)}` : `${title}${marker}`;
}

/** A page-distinct meta description for a deeper listing page. The base copy
 * keeps its module identity; a page marker makes every paginated URL carry a
 * different search snippet. Trimmed to the 150-character snippet target so the
 * serialized meta tag stays below the 160-character limit. */
export function aidreamcapesListingPageDescription(description: string | undefined, page: number): string | undefined {
  if (!description || !page) return description;
  if (description.startsWith(`Page ${page}`)) return description;
  const prefix = `Page ${page}: `;
  const limit = 150;
  const room = Math.max(40, limit - prefix.length - 1);
  let base = description.replace(/\s+/g, " ").trim();
  if (base.length > room) {
    const cut = base.slice(0, room + 1).replace(/\s+\S*$/, "").trim();
    base = `${(cut || base.slice(0, room).trim()).replace(/[\s,;:|–—-]+$/, "")}…`;
  }
  return `${prefix}${base}`;
}

/** Self-referencing canonical for a deeper listing page: the base canonical
 * keeps its other parameters (the kind catalogs) and gains ?page=N. */
export function aidreamcapesListingPageCanonical(canonical: string | undefined, page: number): string | undefined {
  if (!canonical || !page) return canonical;
  try {
    const url = new URL(canonical);
    url.searchParams.delete("page");
    url.searchParams.set("page", String(page));
    return url.toString();
  } catch {
    return canonical;
  }
}
export type TemplateFilters = Partial<Record<TemplateFacetKey | "kind", string>>;
export type TemplateFilterState = {
  path: string;
  filters: TemplateFilters;
  invalid: boolean;
  badRequest: boolean;
  canonicalPath: string;
  noindex: boolean;
  redirectPath?: string;
};

export function normalizeAidreamcapesTemplateFilter(path: string, query: TemplateFilterQuery): TemplateFilterState {
  const filters: TemplateFilters = {};
  let invalid = false;
  let badRequest = false;
  const scalar = (key: string) => {
    const raw = query[key];
    const values = [...new Set((Array.isArray(raw) ? raw : [raw]).filter((v): v is string => typeof v === "string" && v !== ""))];
    if (values.length > 1) { invalid = true; badRequest = true; }
    const value = values[0] ?? "";
    if (value.length > 300 || /[\u0000-\u001f\u007f\ufffd]/.test(value)) { invalid = true; badRequest = true; }
    return value;
  };
  const catalog = /^\/templates(?:\/(photo|video))?$/.exec(path);
  const kind = scalar("kind") || scalar("type");
  const pathKind = catalog?.[1];
  if (kind && kind !== "photo" && kind !== "video") invalid = true;
  const effectiveKind = pathKind || kind;
  if (effectiveKind) filters.kind = effectiveKind;
  for (const key of TEMPLATE_FACETS) {
    const value = scalar(key);
    if (!value) continue;
    if (!new RegExp(`^/${key}/[a-z0-9]+(?:-[a-z0-9]+)*$`).test(value)) { invalid = true; badRequest = true; }
    filters[key] = value;
  }
  // The retired /templates/photo and /templates/video catalogs fold into the
  // /templates gallery; the kind dimension lives in the ?kind= query there.
  const retiredKindPath = Boolean(catalog && pathKind);
  const targetPath = retiredKindPath && !invalid ? "/templates" : path;
  const params = new URLSearchParams();
  if (effectiveKind && (retiredKindPath || !catalog || kind)) params.set("kind", effectiveKind);
  for (const key of TEMPLATE_FACETS) if (filters[key]) params.set(key, filters[key]!);
  // Keep invalid inputs distinguishable from an unfiltered, indexable catalog.
  if (invalid) {
    for (const key of ["kind", "type", ...TEMPLATE_FACETS]) {
      const raw = query[key];
      if (Array.isArray(raw)) { params.delete(key); for (const value of raw) params.append(key, value); }
      else if (raw) params.set(key, raw);
    }
  }
  const suffix = params.size ? `?${params}` : "";
  const canonicalPath = targetPath + suffix;
  // A valid kind filter on the /templates catalog is a standalone, indexable
  // view — the video-examples / photo-examples catalogs — with its own copy
  // and self canonical. Facet filters and any invalid input keep the
  // noindexed utility-view treatment.
  const kindOnlyCatalog = targetPath === "/templates" && !invalid
    && Boolean(filters.kind) && !filters.industries && !filters.platforms && !filters.occasions;
  // Tracking and unknown parameters stay on real navigation; they are excluded
  // from canonical identity. They must never cause a redirect loop.
  const hasUrlChange = targetPath !== path || Boolean(query.type) || Boolean(pathKind && query.kind);
  const navigationParams = new URLSearchParams(params);
  for (const [key, raw] of Object.entries(query)) {
    if (["kind", "type", ...TEMPLATE_FACETS].includes(key)) continue;
    for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) navigationParams.append(key, value);
  }
  const redirectPath = !invalid && hasUrlChange ? targetPath + (navigationParams.size ? `?${navigationParams}` : "") : undefined;
  return { path: targetPath, filters, invalid, badRequest, canonicalPath, noindex: invalid || (params.size > 0 && !kindOnlyCatalog), ...(redirectPath ? { redirectPath } : {}) };
}

export function templateMatchesFilters(template: { kind: string; industries: string[]; platforms: string[]; occasions: string[] }, filters: TemplateFilters) {
  return (!filters.kind || template.kind === filters.kind)
    && TEMPLATE_FACETS.every(key => !filters[key] || template[key].includes(filters[key]!));
}

/** Update only this page's structured identity, leaving linked entities intact. */
export function aidreamcapesFilterJsonLd<T>(nodes: T, path: string, query: TemplateFilterQuery): T {
  const state = normalizeAidreamcapesTemplateFilter(path, query);
  if (/^\/(templates|industries|platforms|occasions)(?:\/|$)/.test(path) && state.noindex) {
    return rewriteAidreamcapesJsonLdIdentity(nodes, `https://www.aivideosugc.com${path}`, `https://www.aivideosugc.com${state.canonicalPath}`);
  }
  // Paginated indexable listing views carry a page-inclusive canonical, so the
  // page nodes in the graph must address the same identity instead of
  // disagreeing with the link tag about which document this is.
  const page = aidreamcapesListingPageNumber(query);
  if (page && PAGINATED_LISTING_PATH_RE.test(path)) {
    const before = `https://www.aivideosugc.com${path}`;
    const after = aidreamcapesListingPageCanonical(before, page);
    if (after && after !== before) return rewriteAidreamcapesJsonLdIdentity(nodes, before, after);
  }
  return nodes;
}

function rewriteAidreamcapesJsonLdIdentity<T>(nodes: T, before: string, after: string): T {
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return value === before ? after : value.startsWith(`${before}#`) ? after + value.slice(before.length) : value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry)]));
    return value;
  };
  return walk(nodes) as T;
}
