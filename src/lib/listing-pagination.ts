/**
 * Paginated listing identity for the Aidreamcapes storefronts.
 *
 * Listing pages are addressable by path only — `?page=` and `?kind=` never
 * appear in a canonical URL:
 *
 *   /templates                page 1 of the example gallery
 *   /templates/page2          page 2
 *   /templates/photo          photo-kind catalog, page 1
 *   /templates/photo/page3    photo-kind catalog, page 3
 *   /ai-video-generation/page2
 *   /industries/beauty-skincare/page2
 *   /ai-video-generation/gallery/page2   (secondary hub-picker pager)
 *
 * Internally the renderer still receives the query contract it already
 * understands (`?page=N`, `?kind=photo`, `?galleryPage=N`); the middleware
 * rewrites the public path into that contract so every renderer, metadata and
 * pager keeps a single source of truth for slicing.
 */

/** Path families whose deeper pages are standalone SSR documents. */
export const PAGINATED_LISTING_BASE_RE =
  /^(?:\/templates|\/industries\/[a-z0-9]+(?:-[a-z0-9]+)*|\/platforms\/[a-z0-9]+(?:-[a-z0-9]+)*|\/occasions\/[a-z0-9]+(?:-[a-z0-9]+)*|\/ai-video-generation(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?|\/tools\/[a-z0-9]+(?:-[a-z0-9]+)*)$/;

/** The kind catalogs that own a path of their own under /templates. */
export const TEMPLATE_KIND_PATHS = { "/templates/photo": "photo", "/templates/video": "video" } as const;
export type TemplateKindSlug = keyof typeof TEMPLATE_KIND_PATHS;

const PAGE_SEGMENT_RE = /^page([1-9][0-9]{0,2})$/;
const PAGE_SEGMENT_LIKE_RE = /^page\d*/i;
const GALLERY_PAGE_SEGMENT_PREFIX = "gallery";

export type ListingPageMatch =
  | { kind: "page"; basePath: string; page: number; gallery: boolean }
  | { kind: "invalid"; basePath: string };

/** Split a public listing path into its base path and page number.
 * Returns undefined when the path carries no pagination segment. */
export function matchListingPagePath(path: string): ListingPageMatch | undefined {
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) return undefined;
  const last = segments[segments.length - 1];
  const segment = PAGE_SEGMENT_RE.exec(last);
  const looksLikePage = PAGE_SEGMENT_LIKE_RE.test(last);
  const isGallery = segments.length >= 2 && segments[segments.length - 2] === GALLERY_PAGE_SEGMENT_PREFIX;
  if (!segment && !looksLikePage) {
    // `/templates/gallery` alone is not a page.
    return undefined;
  }
  const cut = isGallery ? 2 : 1;
  const basePath = `/${segments.slice(0, segments.length - cut).join("/")}`;
  if (!basePath || !isPaginatedListingBase(basePath)) return undefined;
  // The secondary `galleryPage` pager only exists on the video hub; no other
  // listing owns a `/gallery/pageN` address.
  if (isGallery && !/^\/ai-video-generation(?:\/|$)/.test(basePath)) return { kind: "invalid", basePath };
  if (!segment) return { kind: "invalid", basePath };
  const page = Number(segment[1]);
  if (page < 2) return { kind: "invalid", basePath };
  return { kind: "page", basePath, page, gallery: isGallery };
}

export function isPaginatedListingBase(path: string): boolean {
  return PAGINATED_LISTING_BASE_RE.test(path) || path in TEMPLATE_KIND_PATHS;
}

/** Public address of a listing page: page 1 is the bare path. */
export function listingPagePath(basePath: string, page: number): string {
  return page > 1 ? `${basePath}/page${page}` : basePath;
}

/** Public address of the secondary hub-picker pager. */
export function listingGalleryPagePath(basePath: string, page: number): string {
  return page > 1 ? `${basePath}/${GALLERY_PAGE_SEGMENT_PREFIX}/page${page}` : basePath;
}

/** Kind catalog address (`/templates?kind=photo` → `/templates/photo`). */
export function templateKindPath(kind: "photo" | "video"): string {
  return `/templates/${kind}`;
}

/** Replace a canonical URL's page identity with the path form. Keeps every
 * other query parameter intact (none of them are identity today, but the
 * helper must never silently drop one if that changes). */
export function listingPageCanonicalUrl(canonical: string | undefined, page: number): string | undefined {
  if (!canonical || !page) return canonical;
  try {
    const url = new URL(canonical);
    url.searchParams.delete("page");
    const base = url.pathname.replace(/\/+$/, "") || "/";
    url.pathname = listingPagePath(base, page);
    return url.toString();
  } catch {
    return canonical;
  }
}

/**
 * Project a content-authored href onto the path identity. Online content still
 * carries `?kind=photo` / `?page=2` links (edit screens and older revisions);
 * they must render as the canonical path without rewriting the stored data.
 */
export function normalizeListingHref(href: string): string {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  const [pathAndQuery, rawHash] = href.split("#");
  const queryStart = pathAndQuery.indexOf("?");
  if (queryStart < 0) return href;
  const path = pathAndQuery.slice(0, queryStart) || "/";
  const params = new URLSearchParams(pathAndQuery.slice(queryStart + 1));
  const kind = params.get("kind") ?? params.get("type");
  const page = Math.floor(Number(params.get("page")));
  const gallery = Math.floor(Number(params.get("galleryPage")));
  const kindIdentity = kind === "photo" || kind === "video";
  if (!kindIdentity && !(page >= 2) && !(gallery >= 2)) return href;
  const base = kindIdentity && path === "/templates" ? `${path}/${kind}` : path;
  if (!isPaginatedListingBase(base)) return href;
  for (const key of ["kind", "type", "page", "galleryPage"]) params.delete(key);
  const suffix = gallery >= 2 ? `${base}/gallery/page${gallery}` : page >= 2 ? listingPagePath(base, page) : base;
  const search = params.toString();
  return `${suffix}${search ? `?${search}` : ""}${rawHash ? `#${rawHash}` : ""}`;
}

/** True when a public path is a listing identity (base, kind catalog or a
 * deeper page). Used by the sitemap guard so pagination rows are not
 * collapsed into their page-1 path. */
export function isListingPublicPath(path: string): boolean {
  return isPaginatedListingBase(path) || matchListingPagePath(path)?.kind === "page";
}
