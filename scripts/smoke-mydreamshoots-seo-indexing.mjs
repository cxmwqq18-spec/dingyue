import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function fail(message, details = {}) {
  console.error(`MyDreamShoots SEO indexing smoke failed: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

function normalizePath(slug) {
  const value = String(slug || "").trim();
  if (!value || value === "/") return "/";
  return `/${value.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function walk(value, visit, pathSegments = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, visit, [...pathSegments, String(index)]));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = [...pathSegments, key];
    visit(key, child, nextPath);
    walk(child, visit, nextPath);
  }
}

const seoIndexing = readText("src/lib/seo-indexing.ts");
const jsonLd = readText("src/lib/theme/json-ld.ts");
const robots = readText("src/app/robots.ts");
const sitemapRoute = readText("src/app/sitemap.xml/route.ts");
const hostCatchAllPage = readText("src/app/[...path]/page.tsx");
const siteCatchAllPage = readText("src/app/site/[siteSlug]/[...path]/page.tsx");
const siteToolPage = readText("src/app/site/[siteSlug]/tools/[toolSlug]/page.tsx");
const templates = readText("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const platformState = readJson("data/platform-state.json");
const mydreamshootsSite = platformState.sites.find((site) => site.id === "site_dreamshoot");
const aidreamcapesSite = platformState.sites.find((site) => site.id === "site_aidreamcapes");

assert(mydreamshootsSite, "MyDreamShoots site must exist in platform state");
assert(aidreamcapesSite, "AIDreamCapes site must exist in platform state");

const slugRows = mydreamshootsSite.pages.map((page) => ({
  id: page.id,
  slug: normalizePath(page.slug),
  pageType: page.pageType,
  title: page.title,
  index: mydreamshootsSite.themeSettings?.publishedJson?.seo?.pages?.[page.id]?.index
}));
const duplicateSlugRows = Array.from(
  slugRows.reduce((map, row) => map.set(row.slug, [...(map.get(row.slug) ?? []), row]), new Map())
).filter(([, rows]) => rows.length > 1);
const headshotSlugOwner = slugRows.find((row) => row.slug === "/tools/headshot" && row.index === true);

assert(!duplicateSlugRows.length, "MyDreamShoots page slugs must be unique before sitemap expansion", { duplicateSlugRows });
assert(
  Boolean(headshotSlugOwner),
  "canonical headshot tool page must expose /tools/headshot and remain indexable"
);
assert(
  !slugRows.some((row) => row.slug === "/app/legacy-ai-image-studio" && row.index !== false),
  "legacy image studio page must not enter the sitemap when present"
);

const hrefHits = [];
walk(mydreamshootsSite, (key, value, location) => {
  if (key === "href" && typeof value === "string") hrefHits.push({ href: value, location: location.join(".") });
});
const badLegacyHrefHits = hrefHits.filter((hit) => ["/cookie-policy", "/privacy-policy", "/terms-of-service"].includes(hit.href));
assert(!badLegacyHrefHits.length, "MyDreamShoots internal hrefs must use canonical policy paths to avoid redirects", { badLegacyHrefHits });
assert(
  hrefHits.some((hit) => hit.href === "/cookies"),
  "MyDreamShoots navigation/footer data must link directly to /cookies"
);

assert(
  templates.includes('href: "/creators-circle"') &&
    hostCatchAllPage.includes("canUseMydreamshootsSyntheticPage(site, publicPageSlug)") &&
    siteCatchAllPage.includes("dreamshootPartnerTemplateSlugs"),
  "Creators Circle must be backed by the synthetic DreamShoot template in both host and site routes"
);
assert(!templates.includes('href: "/cookie-policy"'), "MyDreamShoots templates must not generate /cookie-policy links");

for (const pathName of ["/cookie-policy", "/privacy-policy", "/terms-of-service"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap legacy duplicate exclusions must include old policy paths", { pathName });
}

for (const pathName of ["/tools/image-studio", "/tools/ai-image-studio", "/tools/travel-portraits"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap non-indexable tool exclusions must include blocked legacy paths", { pathName });
}

for (const pathName of ["/tools/headshot", "/tools/background-changer", "/tools/image-to-video"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap required indexable tool paths must include primary static tool pages", { pathName });
}

assert(
  robots.includes('"/search"') && robots.includes('"/site/*/search"') && !jsonLd.includes('"SearchAction"'),
  "JSON-LD must not emit WebSite.SearchAction while /search is blocked and no indexable search page exists"
);

for (const pathName of ["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "fallback and required policy sitemap paths must use canonical short paths", { pathName });
}

for (const pathName of ["/policies/privacy", "/policies/terms", "/policies/refunds", "/policies/shipping", "/policies/content", "/policies/cookies"]) {
  assert(!seoIndexing.includes(`  "${pathName}",`), "fallback and required policy sitemap paths must not use long policy paths", { pathName });
}

assert(
  seoIndexing.includes("new Set(paths.map((path) => sitemapUrl(site, path)))"),
  "sitemap URL expansion must dedupe canonical paths after static, dynamic, and required paths are merged"
);
assert(
  seoIndexing.includes("getExplicitSeoDirectorySlugsForSite") &&
    seoIndexing.includes("collectExplicitSeoDirectoryPaths(site)") &&
    seoIndexing.includes('`/collections/${slug}`') &&
    seoIndexing.includes('`/tools/${slug}`'),
  "sitemap URL expansion must include all explicit SEO collection and tool directory pages"
);
assert(
  sitemapRoute.includes('export const dynamic = "force-dynamic"') &&
    sitemapRoute.includes('request.headers.get("x-forwarded-host")') &&
    sitemapRoute.includes('request.headers.get("host")') &&
    sitemapRoute.includes("getStorefrontSitemapUrlsForHost") &&
    sitemapRoute.includes('"cache-control"') &&
    sitemapRoute.includes('"x-sitemap-url-count"'),
  "sitemap route must select URLs using the request host and emit cache/diagnostic headers"
);
assert(
  seoIndexing.includes("getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>") &&
    seoIndexing.includes("normalizedHosts.some((host) => isHostForSite(item, host))") &&
    seoIndexing.includes("getAidreamcapesSitemapUrls") &&
    seoIndexing.includes("isLocalDevelopmentHost") &&
    seoIndexing.includes("runtime.sites.flatMap((site) => getSitemapUrlsForSite(runtime.state, site))"),
  "sitemap indexing must expose a host-aware single-site URL selector"
);

const sitemapDomains = [
  { site: mydreamshootsSite, ownHost: "www.mydreamshoots.com", forbiddenHost: "www.aidreamcapes.com" },
  { site: aidreamcapesSite, ownHost: "www.aidreamcapes.com", forbiddenHost: "www.mydreamshoots.com" }
];
for (const { site, ownHost, forbiddenHost } of sitemapDomains) {
  assert(
    site.primaryDomain === ownHost,
    "sitemap site primary domain must match the expected production host",
    { siteId: site.id, primaryDomain: site.primaryDomain, ownHost }
  );
  assert(
    !(platformState.siteDomains ?? []).some((domain) => domain.siteId === site.id && domain.domain === forbiddenHost),
    "sitemap site domain bindings must not include the other production host",
    { siteId: site.id, forbiddenHost }
  );
}
assert(
  siteToolPage.includes("permanentRedirect(`/site/${publicSiteSlug}${redirectPath}`)") &&
    hostCatchAllPage.includes("permanentRedirect(redirectPath)") &&
    siteToolPage.includes('"ai-image-studio": "/tools"') &&
    hostCatchAllPage.includes('"ai-image-studio": "/tools"'),
  "legacy image studio tool paths must continue to permanently redirect to /tools"
);

console.log(JSON.stringify({
  ok: true,
  mydreamshootsPageSlugCount: slugRows.length,
  duplicateSlugCount: duplicateSlugRows.length,
  headshotSlugOwner: headshotSlugOwner?.id,
  legacyToolPage: {
    id: "site_dreamshoot_tool_image",
    slug: "/app/legacy-ai-image-studio",
    index: false
  },
  canonicalInternalLinks: {
    cookies: "/cookies",
    forbiddenLegacyPolicyHrefs: badLegacyHrefHits.length
  },
  syntheticRoutes: ["/creators-circle", "/partner-registration"],
  sitemapStrategy: "dedupe merged static, dynamic, required, and policy canonical URLs per request host",
  hostAwareSitemaps: {
    mydreamshoots: "www.mydreamshoots.com only",
    aidreamcapes: "www.aidreamcapes.com only"
  }
}, null, 2));
