import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import nextConfig from "../next.config.mjs";

const seoContent = readFileSync(new URL("../src/lib/dreamshoot-seo-content.ts", import.meta.url), "utf8");
const siteRouteCanonical = readFileSync(new URL("../src/lib/site-route-canonical.ts", import.meta.url), "utf8");
const hostCatchAll = readFileSync(new URL("../src/app/[...path]/page.tsx", import.meta.url), "utf8");
const siteCatchAll = readFileSync(new URL("../src/app/site/[siteSlug]/[...path]/page.tsx", import.meta.url), "utf8");

function assertMetadataSource(path) {
  const escapedPath = path.replace("/", "\\/");
  assert.match(seoContent, new RegExp(`"${escapedPath}"\\s*:\\s*{[\\s\\S]*canonicalPath:\\s*"${escapedPath}"[\\s\\S]*index:\\s*true[\\s\\S]*follow:\\s*true`), `${path} should have indexable public metadata`);
  assert.match(seoContent, new RegExp(`dreamshootPublicSeoPageMetadata\\[normalizedPath\\]`), `${path} metadata should be used by fallback route metadata`);
}

async function assertHeaders() {
  const headers = await nextConfig.headers();
  const bySource = new Map(headers.map((entry) => [entry.source, entry.headers]));
  for (const source of [
    "/policies/:path*",
    "/help",
    "/blog",
    "/blog/:path*",
    "/creators-circle",
    "/partner-registration",
    "/site/:siteSlug/policies/:path*",
    "/site/:siteSlug/help",
    "/site/:siteSlug/blog",
    "/site/:siteSlug/blog/:path*",
    "/site/:siteSlug/creators-circle",
    "/site/:siteSlug/partner-registration"
  ]) {
    const cache = bySource.get(source)?.find((header) => header.key === "Cache-Control")?.value ?? "";
    assert.match(cache, /^public,/, `${source} should use public cache headers`);
  }
  for (const source of ["/app", "/site/:siteSlug/app", "/login", "/site/:siteSlug/login"]) {
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

assertMetadataSource("/creators-circle");
assertMetadataSource("/partner-registration");
await assertHeaders();
assertRedirectSource(hostCatchAll, "/refund-policy", "/policies/refunds");
assertRedirectSource(hostCatchAll, "/content-policy", "/policies/content");
assertRedirectSource(siteCatchAll, "/refund-policy", "/policies/refunds");
assertRedirectSource(siteCatchAll, "/content-policy", "/policies/content");
assert.ok(
  siteRouteCanonical.includes("requestedPath === `${sitePrefix}/`") &&
    siteRouteCanonical.includes("requestedPath === `${canonicalSitePrefix}/`") &&
    siteRouteCanonical.includes('permanentRedirect("/")'),
  "/site/:slug/ should directly canonicalize to host root"
);

console.log("public SEO policy smoke passed");
