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
const nextConfig = readText("next.config.mjs");
const sitemapRoute = readText("src/app/sitemap.xml/route.ts");
const hostCatchAllPage = readText("src/app/[...path]/page.tsx");
const siteCatchAllPage = readText("src/app/site/[siteSlug]/[...path]/page.tsx");
const siteToolPage = readText("src/app/site/[siteSlug]/tools/[toolSlug]/page.tsx");
const siteRouteCanonical = readText("src/lib/site-route-canonical.ts");
const storefrontRender = readText("src/lib/storefront-render.tsx");
const storefrontStateRelational = readText("src/lib/storefront-state-relational.ts");
const themeRenderer = readText("src/components/theme-renderer.tsx");
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
const mydreamshootsWorkflow = slugRows.find((row) => row.slug === "/workflow");
const aidreamcapesWorkflow = aidreamcapesSite.pages.find((page) => normalizePath(page.slug) === "/workflow");

assert(!duplicateSlugRows.length, "MyDreamShoots page slugs must be unique before sitemap expansion", { duplicateSlugRows });
assert(
  Boolean(mydreamshootsWorkflow) && mydreamshootsWorkflow.pageType === "content",
  "MyDreamShoots must expose a standalone /workflow content page",
  { mydreamshootsWorkflow }
);
assert(
  Boolean(aidreamcapesWorkflow) && aidreamcapesWorkflow.pageType === "content",
  "Aidreamcapes must expose a standalone /workflow content page",
  { aidreamcapesWorkflow: aidreamcapesWorkflow && { id: aidreamcapesWorkflow.id, slug: aidreamcapesWorkflow.slug, pageType: aidreamcapesWorkflow.pageType } }
);
assert(
  !/requestedPath === "\/workflow"[\s\S]*return "\/"/.test(siteRouteCanonical),
  "/workflow must not canonicalize to the homepage"
);
assert(
  siteRouteCanonical.includes('requestedPath === "/how-it-works") return "/workflow"'),
  "/how-it-works should canonicalize to /workflow for legacy compatibility"
);
assert(
  Boolean(headshotSlugOwner),
  "canonical headshot tool page must expose /tools/headshot and remain indexable"
);
assert(
  !slugRows.some((row) => row.slug === "/app/legacy-ai-image-studio" && row.index !== false),
  "legacy image studio page must not enter the sitemap when present"
);

const hrefHits = [];
const visiblePackageLabelHits = [];
walk(mydreamshootsSite, (key, value, location) => {
  if (key === "href" && typeof value === "string") hrefHits.push({ href: value, location: location.join(".") });
  if (["label", "primaryCta", "secondaryCta", "ctaLabel"].includes(key) && typeof value === "string") {
    if (value === "Headshot Generator" || value === "Browse packages") {
      visiblePackageLabelHits.push({ label: value, location: location.join(".") });
    }
  }
});
const badLegacyHrefHits = hrefHits.filter((hit) => ["/cookie-policy", "/privacy-policy", "/terms-of-service"].includes(hit.href));
assert(!badLegacyHrefHits.length, "MyDreamShoots internal hrefs must use canonical policy paths to avoid redirects", { badLegacyHrefHits });
assert(
  hrefHits.some((hit) => hit.href === "/cookies"),
  "MyDreamShoots navigation/footer data must link directly to /cookies"
);
assert(
  hrefHits.some((hit) => hit.href === "/collections/headshots"),
  "MyDreamShoots visible Headshot Generator entries must link to /collections/headshots"
);
assert(
  visiblePackageLabelHits.some((hit) => hit.label === "Headshot Generator"),
  "MyDreamShoots visible CTA/nav labels must expose Headshot Generator"
);
assert(
  !visiblePackageLabelHits.some((hit) => hit.label === "Browse packages"),
  "MyDreamShoots visible CTA/nav labels must not use Browse packages",
  { visiblePackageLabelHits }
);

assert(
  templates.includes('href: "/creators-circle"') &&
    hostCatchAllPage.includes("canUseStorefrontPartnerTemplate(site, publicPageSlug)") &&
    hostCatchAllPage.includes("!findPage(site, pageSlug) && !canUseStorefrontPartnerTemplate(site, pageSlug)") &&
    siteCatchAllPage.includes("dreamshootPartnerTemplateSlugs.has(pageSlug)") &&
    siteCatchAllPage.includes("isDreamshootPartnerTemplateSite(publicSite)") &&
    storefrontRender.includes("function syntheticDreamShootPartnerPage") &&
    storefrontRender.includes("dreamshootAiStudioTemplatesForSite(site)[templateKey]"),
  "Creators Circle must be backed by the synthetic DreamShoot template in both host and site routes"
);
assert(!templates.includes('href: "/cookie-policy"'), "MyDreamShoots templates must not generate /cookie-policy links");
assert(
  templates.includes('label: "Headshot Generator"') && templates.includes('href: "/collections/headshots"'),
  "MyDreamShoots templates must expose Headshot Generator links to /collections/headshots"
);
assert(
  !templates.includes('label: "Browse packages"') &&
    !templates.includes('primaryCta: "Browse packages"') &&
    !templates.includes('ctaLabel: "Browse packages"'),
  "MyDreamShoots templates must not expose Browse packages as a CTA or navigation label"
);

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
  !/disallow|Disallow/.test(robots) &&
    nextConfig.includes('source: "/search"') &&
    nextConfig.includes('source: "/site/:siteSlug/search"') &&
    !jsonLd.includes('"SearchAction"'),
  "robots should allow noindex discovery, /search should receive X-Robots-Tag, and JSON-LD must not emit SearchAction without an indexable search page"
);
assert(
  themeRenderer.includes("publicSeoCriticalSectionTypes") &&
    themeRenderer.includes('"pricing_table"') &&
    themeRenderer.includes('"testimonial_wall"') &&
    themeRenderer.includes('"reviews"') &&
    themeRenderer.includes('"trust_signal_bar"') &&
    themeRenderer.includes('"brand_logo_strip"') &&
    themeRenderer.includes("isPublicSeoRoute(pagePath) && publicSeoCriticalSectionTypes.has(sectionType)"),
  "public SEO critical pricing, review, and trust sections must be server-rendered instead of lazy placeholders"
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
    seoIndexing.includes("canonicalSeoDirectoryPathForSite") &&
    seoIndexing.includes("collectExplicitSeoDirectoryPaths(site)") &&
    seoIndexing.includes('canonicalSeoDirectoryPathForSite(site, "collection", slug)') &&
    seoIndexing.includes('canonicalSeoDirectoryPathForSite(site, "collection", normalized)') &&
    seoIndexing.includes('`/tools/${slug}`'),
  "sitemap URL expansion must include explicit SEO directory pages using canonical collection paths"
);
assert(
  seoIndexing.includes("DREAMSHOOT_DEFAULT_PUBLIC_TOOL_PATHS") &&
    seoIndexing.includes('"/tools/creator-portrait"') &&
    seoIndexing.includes('"/tools/background-remover"') &&
    seoIndexing.includes('"/tools/fashion-reel"') &&
    seoIndexing.includes("state.toolMenuItems ?? []") &&
    seoIndexing.includes("state.creativePackCategories ?? []") &&
    seoIndexing.includes("collectInternalHrefPaths(state, site, paths, site.themeSettings.publishedJson)") &&
    seoIndexing.includes('"/about-us"') &&
    seoIndexing.includes('"/contact-us"') &&
    seoIndexing.includes('"/children-privacy"') &&
    seoIndexing.includes('"/state-privacy"'),
  "sitemap URL expansion must cover storefront menu tools, package categories, theme hrefs, and canonical public support pages"
);
assert(
  storefrontStateRelational.includes("creativePackCategories.map(toCreativePackCategory)") &&
    storefrontStateRelational.includes("toolCategories.map(toToolCategory)") &&
    storefrontStateRelational.includes("toolMenuItems.map(toToolMenuItem)") &&
    storefrontStateRelational.includes("prisma.creativePackCategory.findMany") &&
    storefrontStateRelational.includes("prisma.toolMenuItem.findMany") &&
    storefrontStateRelational.includes("categoryRecord: { include: { parent: true } }"),
  "relational platform state used by sitemap must include storefront navigation categories and tool menu items"
);
assert(
  sitemapRoute.includes('export const dynamic = "force-dynamic"') &&
    sitemapRoute.includes('request.headers.get("x-forwarded-host")') &&
    sitemapRoute.includes('request.headers.get("host")') &&
    sitemapRoute.includes("getStorefrontSitemapEntriesForHost") &&
    sitemapRoute.includes("xmlns:image=\"http://www.google.com/schemas/sitemap-image/1.1\"") &&
    sitemapRoute.includes('"cache-control"') &&
    sitemapRoute.includes('"x-sitemap-url-count"') &&
    sitemapRoute.includes('"x-sitemap-image-count"'),
  "sitemap route must select URLs using the request host and emit cache/diagnostic headers"
);
assert(
  seoIndexing.includes("getStorefrontSitemapUrlsForHost(hosts: string | null | undefined | Array<string | null | undefined>") &&
    seoIndexing.includes("pageSitemapPathForSite(site: Site, page: ThemePage): string") &&
    seoIndexing.includes("getSiteByHostCandidatesFromState(runtime.state, siteHostCandidates)") &&
    seoIndexing.includes("siteHostCandidates.some((host) => isHostForSite(item, host))") &&
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
  siteToolPage.includes("legacyToolRedirectPath(publicSiteSlug, toolSlug)") &&
    siteToolPage.includes("permanentRedirect(storefrontPathForRouteMode(publicSiteSlug, redirectPath, routeMode))") &&
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
  syntheticRoutes: ["/workflow", "/creators-circle", "/partner-registration"],
  sitemapStrategy: "dedupe merged static, dynamic, required, and policy canonical URLs per request host",
  hostAwareSitemaps: {
    mydreamshoots: "www.mydreamshoots.com only",
    aidreamcapes: "www.aidreamcapes.com only"
  }
}, null, 2));
