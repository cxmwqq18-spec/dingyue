import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config.mjs";

const seoContent = readFileSync(new URL("../src/lib/dreamshoot-seo-content.ts", import.meta.url), "utf8");
const siteRouteCanonical = readFileSync(new URL("../src/lib/site-route-canonical.ts", import.meta.url), "utf8");
const hostCatchAll = readFileSync(new URL("../src/app/[...path]/page.tsx", import.meta.url), "utf8");
const siteCatchAll = readFileSync(new URL("../src/app/site/[siteSlug]/[...path]/page.tsx", import.meta.url), "utf8");
const robotsRoute = readFileSync(new URL("../src/app/robots.ts", import.meta.url), "utf8");
const sitemapRoute = readFileSync(new URL("../src/app/sitemap.xml/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");

function assertMetadataSource(path) {
  const escapedPath = path.replace("/", "\\/");
  assert.match(seoContent, new RegExp(`"${escapedPath}"\\s*:\\s*{[\\s\\S]*canonicalPath:\\s*"${escapedPath}"[\\s\\S]*index:\\s*true[\\s\\S]*follow:\\s*true`), `${path} should have indexable public metadata`);
  assert.match(seoContent, new RegExp(`dreamshootPublicSeoPageMetadata\\[normalizedPath\\]`), `${path} metadata should be used by fallback route metadata`);
}

async function assertHeaders() {
  const headers = await nextConfig.headers();
  const bySource = new Map(headers.map((entry) => [entry.source, entry.headers]));
  for (const source of [
    "/collections",
    "/collections/:path*",
    "/tools",
    "/tools/:path*",
    "/pricing",
    "/workflow",
    "/policies/:path*",
    "/help",
    "/blog",
    "/blog/:path*",
    "/creators-circle",
    "/partner-registration",
    "/site/:siteSlug/policies/:path*",
    "/site/:siteSlug/collections",
    "/site/:siteSlug/collections/:path*",
    "/site/:siteSlug/tools",
    "/site/:siteSlug/tools/:path*",
    "/site/:siteSlug/pricing",
    "/site/:siteSlug/workflow",
    "/site/:siteSlug/help",
    "/site/:siteSlug/blog",
    "/site/:siteSlug/blog/:path*",
    "/site/:siteSlug/creators-circle",
    "/site/:siteSlug/partner-registration"
  ]) {
    const cache = bySource.get(source)?.find((header) => header.key === "Cache-Control")?.value ?? "";
    assert.match(cache, /^public,/, `${source} should use public cache headers`);
  }
  for (const source of [
    "/admin",
    "/admin/:path*",
    "/app",
    "/app/:path*",
    "/account",
    "/account/:path*",
    "/cart",
    "/cart/:path*",
    "/checkout",
    "/checkout/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/job",
    "/job/:path*",
    "/login",
    "/search",
    "/search/:path*",
    "/site/:siteSlug/admin",
    "/site/:siteSlug/admin/:path*",
    "/site/:siteSlug/app",
    "/site/:siteSlug/app/:path*",
    "/site/:siteSlug/account",
    "/site/:siteSlug/account/:path*",
    "/site/:siteSlug/cart",
    "/site/:siteSlug/cart/:path*",
    "/site/:siteSlug/checkout",
    "/site/:siteSlug/checkout/:path*",
    "/site/:siteSlug/dashboard",
    "/site/:siteSlug/dashboard/:path*",
    "/site/:siteSlug/job",
    "/site/:siteSlug/job/:path*",
    "/site/:siteSlug/login",
    "/site/:siteSlug/search",
    "/site/:siteSlug/search/:path*"
  ]) {
    const headersForSource = bySource.get(source) ?? [];
    assert.equal(headersForSource.find((header) => header.key === "Cache-Control")?.value, "private, no-store, max-age=0, must-revalidate");
    assert.equal(headersForSource.find((header) => header.key === "X-Robots-Tag")?.value, "noindex, nofollow");
  }
}

function assertRedirectSource(source, from, to) {
  const conditionIndex = source.indexOf(`slug === "${from}"`);
  const targetIndex = source.indexOf(to);
  assert.ok(conditionIndex >= 0 && targetIndex > conditionIndex, `${from} should redirect to ${to}`);
}

assertMetadataSource("/workflow");
assertMetadataSource("/creators-circle");
assertMetadataSource("/partner-registration");
assertMetadataSource("/best-packages");
assertMetadataSource("/best-ai-image");
assertMetadataSource("/best-ai-video");
await assertHeaders();
assertRedirectSource(hostCatchAll, "/refund-policy", 'redirect("/refunds")');
assertRedirectSource(hostCatchAll, "/content-policy", 'redirect("/content")');
assertRedirectSource(siteCatchAll, "/refund-policy", 'redirect(routePath("/refunds"))');
assertRedirectSource(siteCatchAll, "/content-policy", 'redirect(routePath("/content"))');
assert.match(
  robotsRoute,
  /hostCandidates\.some\(isGrownstrideHost\)/,
  "grownstride robots.txt must apply its disallow rule behind a host guard"
);
assert.match(
  robotsRoute,
  /test\.grownstride\.com/,
  "robots.txt should recognize the grownstride test subdomain"
);
assert.match(
  robotsRoute,
  /grownstride\.com/,
  "robots.txt should recognize the grownstride test host"
);
assert.match(
  robotsRoute,
  /disallow:\s*"\/"/,
  "grownstride robots.txt should disallow crawling"
);
assert.match(
  sitemapRoute,
  /getStorefrontSitemapEntriesForHost\(\[\s*forwardedHost,\s*host\s*\]\)/,
  "sitemap route should prefer x-forwarded-host over host behind proxies"
);
assert.match(
  sitemapRoute,
  /xmlns:image="http:\/\/www\.google\.com\/schemas\/sitemap-image\/1\.1"/,
  "sitemap route should expose the image sitemap namespace"
);
assert.match(
  middleware,
  /function canonicalPublicHostSitePathRedirect[\s\S]*PRIVATE_STORE_PATH_RE\.test\(pathname\)\) return undefined;/,
  "public host canonical redirects must preserve site-scoped private routes such as the store admin login"
);
assert.match(
  hostCatchAll,
  /PUBLIC_DIRECTORY_PAGE_SLUGS\s*=\s*new Set\(\["\/collections", "\/tools", "\/best-packages", "\/best-ai-image", "\/best-ai-video"\]\)/,
  "host catch-all should treat collections, tools, and Best pages as public directory pages"
);
assert.match(
  hostCatchAll,
  /const publicPageSlug = firstSegment === "collections" && path\[1\] \? "\/collections" : firstSegment === "tools" && path\[1\] \? `\/tools\/\$\{path\[1\]\}` : publicContentPageSlug\(`\/\$\{path\.join\("\/"\)\}`\);/,
  "host catch-all should keep directory roots canonical while routing detail pages through their directory contexts"
);
assert.match(
  hostCatchAll,
  /PUBLIC_DIRECTORY_PAGE_SLUGS\.has\(publicPageSlug\)[\s\S]*Boolean\(resolvedToolPage\)[\s\S]*firstSegment === "collections" && Boolean\(path\[1\]\)/,
  "host catch-all should allow /collections and /tools roots plus validated directory detail pages"
);
assert.match(
  hostCatchAll,
  /siteAdminPathForHost\(host\)[\s\S]*redirect\(siteAdminPath\)[\s\S]*isPlatformHost\(host\)\) redirect\(`\/platform\/\$\{path\.join\("\/"\)\}`\);[\s\S]*if \(host\?\.startsWith\("localhost"\) \|\| host\?\.startsWith\("127\.0\.0\.1"\)\)/,
  "site admin hosts should redirect to their scoped admin before platform-host handling, and localhost defaults should stay local only"
);
assert.doesNotMatch(
  siteRouteCanonical,
  /https?:\/\/(?:www\.)?mydreamshoots\.com|www\.mydreamshoots\.com|mydreamshoots\.com/,
  "canonical host redirects must not hard-code the MyDreamShoots production domain for other public hosts"
);
assert.match(
  siteRouteCanonical,
  /mydreamshoots\|dreamshoot\|aidreamcapes/,
  "paired storefront canonical redirects should include both MyDreamShoots and Aidreamcapes identities"
);
assert.ok(
  siteRouteCanonical.includes("requestedPath === `${sitePrefix}/`") &&
    siteRouteCanonical.includes("requestedPath === `${canonicalSitePrefix}/`") &&
    siteRouteCanonical.includes('permanentRedirect("/")'),
  "/site/:slug/ should directly canonicalize to host root"
);
assert.doesNotMatch(
  siteRouteCanonical,
  /requestedPath === "\/workflow"[\s\S]*return "\/"/,
  "/workflow must not be canonicalized to the homepage"
);
assert.ok(
  siteRouteCanonical.includes('requestedPath === "/how-it-works") return "/workflow"'),
  "/how-it-works should remain a legacy alias for /workflow"
);

console.log("public SEO policy smoke passed");
