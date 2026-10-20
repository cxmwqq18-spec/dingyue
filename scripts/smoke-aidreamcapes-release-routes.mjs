#!/usr/bin/env node
// Fast release gate for code-only Aidreamcapes deployments. It checks the
// public entry points, the fixed workspace routes, legacy redirects and the
// inspiration gallery without walking the whole sitemap. The exhaustive SEO
// contract stays available as `npm run smoke:aidreamcapes-seo-contract`.
import assert from "node:assert/strict";

const BASE_URL = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
const MEDIA_BASE_URL = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN || "https://www.aivideosugc.com").replace(/\/$/, "");
const forwardedHeaders = {
  "x-forwarded-host": new URL(MEDIA_BASE_URL).host,
  "x-forwarded-proto": "https",
};
const started = Date.now();
const checks = [];
const warnings = [];

async function get(path, { redirect = "follow", timeout = 45_000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fetch(`${BASE_URL}${path}`, { redirect, headers: forwardedHeaders, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function expectPage(path, markers) {
  const response = await get(path);
  assert.equal(response.status, 200, `${path}: status ${response.status}`);
  const html = await response.text();
  assert.match(html, /<html[\s>]/i, `${path}: HTML document`);
  for (const marker of markers) assert.ok(html.includes(marker), `${path}: missing ${marker}`);
  checks.push(`${path}: 200`);
}

async function expectRedirect(path, location) {
  const response = await get(path, { redirect: "manual" });
  assert.equal(response.status, 308, `${path}: status ${response.status}`);
  assert.equal(response.headers.get("location"), location, `${path}: location`);
  checks.push(`${path}: 308 -> ${location}`);
}

await expectPage("/", ["AIVideosUGC"]);
await expectPage("/app/create", ["Workspace navigation", "AIVideosUGC"]);
await expectPage("/app/create/ai-video-generation", ["Workspace navigation", "AI Video"]);
await expectPage("/app/create/ai-image-generation", ["Workspace navigation", "AI Image"]);
await expectPage("/app/create/ai-actors", ["Workspace navigation", "AI Avatar"]);
await expectPage("/app/create/url-to-video", ["Workspace navigation", "URL to Video"]);
await expectPage("/app/create/text-to-video", ["Workspace navigation", "Text to Video"]);
await expectPage("/app/create/photo-hub/color", ["Workspace navigation"]);
await expectPage("/app/create/video-ads/creator", ["Workspace navigation"]);
await expectPage("/app/create/inspirations", ["Workspace navigation", "data-inspiration-card="]);
await expectPage("/app/inspirations", ["AIVideosUGC"]);
await expectPage("/site/aidreamcapes/app/create/ai-image-generation", ["Workspace navigation", "AI Image"]);
await expectPage("/site/aidreamcapes/app/create/url-to-video", ["Workspace navigation", "URL to Video"]);
await expectPage("/templates", ["AIVideosUGC"]);
await expectPage("/templates/video", ["AIVideosUGC"]);
await expectPage("/ai-video-generation", ["AIVideosUGC"]);
await expectPage("/ai-image-generation", ["AIVideosUGC"]);
await expectPage("/inspiration", ["AIVideosUGC"]);
await expectPage("/pricing", ["AIVideosUGC"]);

await expectRedirect("/app/create/video", "/app/create/ai-video-generation");
await expectRedirect("/app/create/images", "/app/create/ai-image-generation");
await expectRedirect("/app/create/actors", "/app/create/ai-actors");
await expectRedirect("/app/create/product", "/app/create/url-to-video");
await expectRedirect("/app/create/agent", "/app/create/text-to-video");
await expectRedirect("/app/create/ai-video-generation/text-to-video", "/app/create/text-to-video");
await expectPage("/app/create/ai-video-generation/url-to-video", ["Workspace navigation", "URL to Video"]);
await expectPage("/app/create/tool/video-ads/creator", ["Workspace navigation"]);
await expectPage("/app/create/ai-video-generation/video-ads/creator", ["Workspace navigation"]);
await expectRedirect("/app/create?tool=image-to-video&size=9:16&length=10", "/app/create/image-to-video?size=9%3A16&length=10");
await expectRedirect("/app/create?view=product", "/app/create/url-to-video");
await expectRedirect("/app/create?view=library&filter=completed", "/app/create/library/completed");
await expectRedirect("/site/aidreamcapes/app/create?view=images", "/site/aidreamcapes/app/create/ai-image-generation");

const inspirationResponse = await get("/api/sites/site_aidreamcapes/aivideosugc/inspirations");
assert.equal(inspirationResponse.status, 200, `inspirations API: status ${inspirationResponse.status}`);
const inspirationBody = await inspirationResponse.json();
assert.ok(Array.isArray(inspirationBody.cards) && inspirationBody.cards.length > 0, "inspirations API: cards");
assert.equal(typeof inspirationBody.total, "number", "inspirations API: total");
assert.equal(typeof inspirationBody.nextOffset, "number", "inspirations API: nextOffset");
assert.ok(inspirationBody.counts && typeof inspirationBody.counts.all === "number", "inspirations API: counts");
checks.push(`inspirations API: ${inspirationBody.cards.length} cards / ${inspirationBody.total} total`);

const home = await get("/");
assert.equal(home.status, 200, "home: status");
const homeHtml = await home.text();
const legacyQueryLinks = (homeHtml.match(/href="[^"]*\/app\/create\?[^"]*(?:tool|template|prompt|size|length|view)=/gi) || []).length;
const nextHashLinks = (homeHtml.match(/nextHash=/gi) || []).length;
if (legacyQueryLinks || nextHashLinks) {
  warnings.push(`home: ${legacyQueryLinks} legacy query workspace links, ${nextHashLinks} nextHash links (content, not code)`);
} else {
  checks.push("home: no legacy query workspace links");
}

const sitemap = await get("/sitemap.xml");
assert.equal(sitemap.status, 200, `sitemap: status ${sitemap.status}`);
assert.match(await sitemap.text(), /<urlset[\s>]/i, "sitemap: urlset");
const robots = await get("/robots.txt");
assert.equal(robots.status, 200, `robots: status ${robots.status}`);
// The origin is reached over plain HTTP on loopback, so the robots route also
// sees a non-production Host alongside X-Forwarded-Host. Checking the body here
// would report a false "Disallow: /" on every release; the exhaustive SEO
// contract owns robots content.
checks.push("robots.txt: 200 (content owned by the full SEO contract)");

console.log(JSON.stringify({
  ok: true,
  origin: BASE_URL,
  mediaOrigin: MEDIA_BASE_URL,
  checks,
  warnings,
  durationMs: Date.now() - started,
}));
