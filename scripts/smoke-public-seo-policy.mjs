import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config.mjs";

const seoContent = readFileSync(new URL("../src/lib/dreamshoot-seo-content.ts", import.meta.url), "utf8");
const siteRouteCanonical = readFileSync(new URL("../src/lib/site-route-canonical.ts", import.meta.url), "utf8");
const mydreamshootsLegacyRedirects = readFileSync(new URL("../src/lib/mydreamshoots-legacy-public-redirects.ts", import.meta.url), "utf8");
const hostCatchAll = readFileSync(new URL("../src/app/[...path]/page.tsx", import.meta.url), "utf8");
const siteCatchAll = readFileSync(new URL("../src/app/site/[siteSlug]/[...path]/page.tsx", import.meta.url), "utf8");
const robotsRoute = readFileSync(new URL("../src/app/robots.txt/route.ts", import.meta.url), "utf8");
const sitemapRoute = readFileSync(new URL("../src/app/sitemap.xml/route.ts", import.meta.url), "utf8");
const middleware = readFileSync(new URL("../src/middleware.ts", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const publicStorefrontCdnCache = "public, s-maxage=300, stale-while-revalidate=1800";

const legacyPolicyAliases = [
  ["/policies/privacy-policy", "/privacy"],
  ["/policies/terms-of-service", "/terms"],
  ["/policies/cookie-policy", "/cookies"],
  ["/policies/delivery", "/shipping"],
  ["/policies/delivery-policy", "/shipping"],
  ["/policies/children", "/children-privacy"],
  ["/policies/children-privacy-policy", "/children-privacy"],
  ["/policies/childrens-privacy", "/children-privacy"],
  ["/policies/state-privacy-rights", "/state-privacy"],
  ["/policies/california-privacy", "/state-privacy"],
  ["/policies/ccpa", "/state-privacy"]
];

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
    "/ai-image-generation",
    "/ai-image-generation/:path*",
    "/ai-video-generation",
    "/ai-video-generation/:path*",
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
    "/site/:siteSlug/ai-image-generation",
    "/site/:siteSlug/ai-image-generation/:path*",
    "/site/:siteSlug/ai-video-generation",
    "/site/:siteSlug/ai-video-generation/:path*",
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
    const headersForSource = bySource.get(source) ?? [];
    const cache = headersForSource.find((header) => header.key === "Cache-Control")?.value ?? "";
    assert.match(cache, /^public,/, `${source} should use public cache headers`);
    assert.equal(headersForSource.find((header) => header.key === "CDN-Cache-Control")?.value, publicStorefrontCdnCache, `${source} should expose CDN cache headers`);
    assert.equal(headersForSource.find((header) => header.key === "Cloudflare-CDN-Cache-Control")?.value, publicStorefrontCdnCache, `${source} should expose Cloudflare cache headers`);
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

function assertRedirectSource(source, canonicalSource, from, to) {
  assert.ok(source.includes("legacyPublicPathTarget"), "catch-all should use the shared legacy public path redirect map");
  assert.ok(canonicalSource.includes(`"${from}": "${to}"`), `${from} should map to ${to} in the shared canonical redirect map`);
}

assertMetadataSource("/workflow");
assertMetadataSource("/creators-circle");
assertMetadataSource("/partner-registration");
assertMetadataSource("/best-packages");
assertMetadataSource("/best-ai-image");
assertMetadataSource("/best-ai-video");
assertMetadataSource("/best-save-the-date");
await assertHeaders();
assert.ok(middleware.includes("guardCookieEnabled !== true"), "storefront guard cookie should be opt-in so public HTML stays cacheable by default");
assert.match(middleware, /cloudflare-cdn-cache-control/i, "HTML rewrite responses should keep Cloudflare CDN cache headers");
assert.match(middleware, /rewriteStorefrontHtmlStream/i, "public HTML rewrite should stream after the head instead of buffering the full page");
assertRedirectSource(hostCatchAll, siteRouteCanonical, "/refund-policy", "/refunds");
assertRedirectSource(hostCatchAll, siteRouteCanonical, "/content-policy", "/content");
assertRedirectSource(siteCatchAll, siteRouteCanonical, "/refund-policy", "/refunds");
assertRedirectSource(siteCatchAll, siteRouteCanonical, "/content-policy", "/content");
for (const [alias, target] of [
  ["/ai-video-generation/ai-avatar-video", "/ai-video-generation"],
  ["/corporate-video", "/ai-video-generation"],
  ["/fitness-video", "/ai-video-generation"],
  ["/partner-registration", "/creators-circle"]
]) {
  assert.ok(mydreamshootsLegacyRedirects.includes(`aliasPath: "${alias}", targetPath: "${target}"`), `${alias} must be a published legacy redirect`);
  assert.ok(middleware.includes("MYDREAMSHOOTS_PUBLISHED_LEGACY_REDIRECTS"), `${alias} must use the published legacy redirect list at the edge`);
}
for (const [alias, target] of legacyPolicyAliases) {
  assert.ok(hostCatchAll.includes("legacyPublicPathTarget"), `host catch-all should use shared legacy policy redirect logic for ${alias}`);
  assert.ok(siteCatchAll.includes("legacyPublicPathTarget"), `site catch-all should use shared legacy policy redirect logic for ${alias}`);
  assert.ok(siteRouteCanonical.includes(`"${alias}"`), `canonical helpers should normalize legacy policy alias ${alias}`);
}
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
  /Disallow:\s*\//,
  "grownstride robots.txt should disallow crawling"
);
assert.match(
  sitemapRoute,
  /const host = request\.headers\.get\("host"\);[\s\S]*const forwardedHost = request\.headers\.get\("x-forwarded-host"\);[\s\S]*getStorefrontSitemapPayloadForHost\(\[forwardedHost, host\]\)/,
  "sitemap route should prefer x-forwarded-host over host behind proxies"
);
assert.doesNotMatch(sitemapRoute, /x-(?:storefront|sitemap)-[a-z-]+["']\s*:/i, "sitemap route must not expose internal diagnostic headers");
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
  /const collectionRootPageSlug = fallbackCollectionRootPathForHost\(host\);[\s\S]*const publicPageSlug = isCollectionRequest[\s\S]*\? collectionRootPageSlug/,
  "host catch-all should route validated collection requests through the host-aware collection directory context"
);
assert.match(
  hostCatchAll,
  /const collectionRoute = isCollectionRequest \? parsePublicCollectionRouteForSite\(site, path\) : undefined;/,
  "host catch-all should validate root and leaf collection route combinations"
);
assert.match(
  hostCatchAll,
  /const videoGenerationRoute = isVideoGenerationRequest \? parsePublicVideoGenerationRouteForSite\(site, path\) : undefined;/,
  "host catch-all should validate ai-video-generation root and detail routes"
);
assert.match(
  hostCatchAll,
  /const hasKnownPublicRoute =[\s\S]*Boolean\(collectionRoute\)[\s\S]*;/,
  "host catch-all should allow validated ai-image-generation routes"
);
assert.match(
  hostCatchAll,
  /const hasKnownPublicRoute =[\s\S]*Boolean\(videoGenerationRoute\)[\s\S]*;/,
  "host catch-all should allow validated ai-video-generation routes"
);
assert.match(
  hostCatchAll,
  /const hasKnownPublicRoute =[\s\S]*Boolean\(findPage\(site, publicPageSlug\)\)[\s\S]*;/,
  "host catch-all should still allow normal published pages"
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
  /usesAiGenerationPublicSlug[\s\S]*canonicalSiteSlug/,
  "paired storefront canonical redirects should use shared capability and site-slug identity helpers"
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
for (const command of [
  "npm run guard:storefront-launch-seo-contract",
  "npm run guard:mydreamshoots-content"
]) {
  assert.ok(packageJson.scripts?.["deploy:precheck"]?.includes(command), `deploy:precheck should include ${command}`);
}
for (const command of [
  "npm run guard:storefront-launch-seo-contract",
  "npm run smoke:storefront-sitemap-directory-coverage",
  "npm run smoke:storefront-head-title-order",
  "npm run smoke:storefront-seo-fingerprint",
  "npm run guard:mydreamshoots-content"
]) {
  assert.ok(packageJson.scripts?.["launch:storefront-precheck"]?.includes(command), `launch:storefront-precheck should include ${command}`);
}

console.log("public SEO policy smoke passed");
