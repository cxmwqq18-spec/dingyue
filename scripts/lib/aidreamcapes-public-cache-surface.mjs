// Shared description of the Aidreamcapes public HTML cache surface.
//
// The cache rule and the purge set must be derived from the same source, or a
// release can leave a stale page on the edge. Both sides therefore read the
// live sitemap and turn it into the same prefix and exact-path lists.

export const PUBLIC_HOST = "www.aivideosugc.com";

// Requests that must never be answered from a shared edge cache.
const PRIVATE_PATH_PREFIXES = ["/app/", "/api/", "/login", "/__maintenance"];
// Cookie fragments that identify an authenticated visitor. A request carrying
// one of them is served from the origin, never from the shared cache.
const SESSION_COOKIE_MARKERS = ["session", "csrf_"];
// Next.js client navigation sends these headers and expects a payload that
// matches its router state. The origin answers them with `Vary: rsc,
 // next-router-*`, so caching them would key one entry per router state.
const CLIENT_NAVIGATION_HEADERS = [
  "rsc",
  "next-router-prefetch",
  "next-router-state-tree",
  "next-router-segment-prefetch"
];

export function parseSitemapPaths(xml) {
  const paths = [];
  const pattern = /<loc>\s*https?:\/\/[^/]+([^<]*?)\s*<\/loc>/g;
  let match;
  while ((match = pattern.exec(xml)) !== null) {
    const path = match[1] || "/";
    paths.push(path.startsWith("/") ? path : `/${path}`);
  }
  return [...new Set(paths)];
}

/**
 * Turn the public sitemap into a purge plan.
 *
 * Directory-style surfaces are purged by prefix so that one request covers
 * every page below them, including pages that are not in the sitemap. Root
 * level pages are purged by exact URL.
 */
// Routes that used to be public. They are not in the sitemap any more, but
// the cache rule still matches their paths, so their cached 404/410 answers
// have to be dropped as well.
export const RETIRED_PUBLIC_PATHS = [
  "/best-save-the-date",
  "/ai-save-the-date",
  "/holidays-events"
];

export function buildPublicSurface(paths) {
  const prefixes = new Set();
  const files = new Set();
  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    if (segments.length <= 1) {
      files.add(path);
      continue;
    }
    prefixes.add(`/${segments[0]}/`);
  }
  // The home page and the crawler entry points are not covered by a prefix.
  files.add("/");
  files.add("/sitemap.xml");
  files.add("/robots.txt");
  for (const retired of RETIRED_PUBLIC_PATHS) files.add(retired);
  return {
    prefixes: [...prefixes].sort(),
    files: [...files].sort()
  };
}

export function cacheRuleExpression() {
  const exclusions = PRIVATE_PATH_PREFIXES.map((path) => `not starts_with(http.request.uri.path, "${path}")`);
  const cookieGuards = SESSION_COOKIE_MARKERS.map((marker) => `not http.cookie contains "${marker}"`);
  // A bare header lookup is not a boolean in the ruleset engine, and `hdr[0] != ""` on an
  // absent header does not match either (the whole rule silently stops matching). The
  // quantified form `any(hdr[*] != "")` is the variant that both parses and matches.
  const navigationGuards = CLIENT_NAVIGATION_HEADERS.map((header) => `not any(http.request.headers["${header}"][*] != "")`);
  return [
    `http.host eq "${PUBLIC_HOST}"`,
    `http.request.method in {"GET" "HEAD"}`,
    ...exclusions,
    ...cookieGuards,
    ...navigationGuards
  ].join(" and ");
}

export function cacheRule() {
  return {
    ref: "aidreamcapes_public_html_cache",
    description: "Cache public Aidreamcapes HTML while leaving private, internal and authenticated routes uncached.",
    expression: cacheRuleExpression(),
    action: "set_cache_settings",
    action_parameters: {
      cache: true,
      // The zone is on the Free plan: an explicit edge TTL below the 2h plan minimum is
      // clamped, and respect_origin never engaged (responses stayed DYNAMIC). 2h at the
      // edge is acceptable because every release purges exactly these URLs (purgePublicUrls).
      browser_ttl: { mode: "respect_origin" },
      edge_ttl: { mode: "override_origin", default: 7200 }
    }
  };
}

// Cloudflare accepts at most 30 exact URLs per purge request on Free, Pro and
// Business plans, and at most 100 prefixes per request.
export const PURGE_FILE_BATCH = 30;
export const PURGE_PREFIX_BATCH = 100;

export function chunk(items, size) {
  const batches = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
