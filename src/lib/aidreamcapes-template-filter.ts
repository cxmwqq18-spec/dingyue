/** Pure URL rules for the Aidreamcapes SSR template directories. */
export type TemplateFilterQuery = Record<string, string | string[] | undefined>;
export const TEMPLATE_FACETS = ["industries", "platforms", "occasions"] as const;
export type TemplateFacetKey = typeof TEMPLATE_FACETS[number];
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
  // Tracking and unknown parameters stay on real navigation; they are excluded
  // from canonical identity. They must never cause a redirect loop.
  const hasUrlChange = targetPath !== path || Boolean(query.type) || Boolean(pathKind && query.kind);
  const navigationParams = new URLSearchParams(params);
  for (const [key, raw] of Object.entries(query)) {
    if (["kind", "type", ...TEMPLATE_FACETS].includes(key)) continue;
    for (const value of Array.isArray(raw) ? raw : raw === undefined ? [] : [raw]) navigationParams.append(key, value);
  }
  const redirectPath = !invalid && hasUrlChange ? targetPath + (navigationParams.size ? `?${navigationParams}` : "") : undefined;
  return { path: targetPath, filters, invalid, badRequest, canonicalPath, noindex: invalid || params.size > 0, ...(redirectPath ? { redirectPath } : {}) };
}

export function templateMatchesFilters(template: { kind: string; industries: string[]; platforms: string[]; occasions: string[] }, filters: TemplateFilters) {
  return (!filters.kind || template.kind === filters.kind)
    && TEMPLATE_FACETS.every(key => !filters[key] || template[key].includes(filters[key]!));
}

/** Update only this page's structured identity, leaving linked entities intact. */
export function aidreamcapesFilterJsonLd<T>(nodes: T, path: string, query: TemplateFilterQuery): T {
  const state = normalizeAidreamcapesTemplateFilter(path, query);
  if (!/^\/(templates|industries|platforms|occasions)(?:\/|$)/.test(path) || !state.noindex) return nodes;
  const before = `https://www.aivideosugc.com${path}`;
  const after = `https://www.aivideosugc.com${state.canonicalPath}`;
  const walk = (value: unknown): unknown => {
    if (typeof value === "string") return value === before ? after : value.startsWith(`${before}#`) ? after + value.slice(before.length) : value;
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, walk(entry)]));
    return value;
  };
  return walk(nodes) as T;
}
