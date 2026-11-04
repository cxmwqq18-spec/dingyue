#!/usr/bin/env node
// Fast release gate for code-only Aidreamcapes deployments. It checks the
// public entry points, the fixed workspace routes, legacy redirects and the
// inspiration gallery without walking the whole sitemap. The exhaustive SEO
// contract stays available as `npm run smoke:aidreamcapes-seo-contract`.
import assert from "node:assert/strict";

const BASE_URL = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3013").replace(/\/$/, "");
const MEDIA_BASE_URL = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_MEDIA_ORIGIN || "https://www.aivideosugc.com").replace(/\/$/, "");
// The public host is always the production hostname, including loopback runs:
// forwarding a loopback host:port would send the canonical-host redirect to
// https://loopback and fail TLS. The origin (and the port) comes from BASE_URL.
const forwardedHeaders = {
  "x-forwarded-host": process.env.AIDREAMCAPES_ROUTE_SMOKE_PUBLIC_HOST || "www.aivideosugc.com",
  "x-forwarded-proto": "https",
};
const started = Date.now();
const checks = [];
const warnings = [];

async function get(path, { redirect = "follow", timeout = 45_000 } = {}) {
  // The dev server closes idle keep-alive sockets and restarts while it
  // recompiles. A transient socket reset is retried against the same path; a
  // real failure still fails the gate.
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      return await fetch(`${BASE_URL}${path}`, { redirect, headers: forwardedHeaders, signal: controller.signal });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

/** Reads a response body, retrying a socket that closed mid-stream. */
async function getText(path, options) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await get(path, options);
      return { response, html: await response.text() };
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function expectPage(path, markers) {
  const { response, html } = await getText(path);
  assert.equal(response.status, 200, `${path}: status ${response.status}`);
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

// ---- Public media detail contract (media detail remediation, 2026-10-21) ---
//
// Every public media card opens the item's own detail page:
//   /ai-video-generation/<publicSlug>, /ai-image-generation/<publicSlug> and
//   /ai-actors/<name> (flat). The card link is a plain path: no query string,
// no fragment and no inert `data-workspace-entry` payload. The workspace is
// reached from the detail page CTA, which carries the card identity. Derived
// detail pages are `index, follow` and submit themselves to the sitemap.
const MEDIA_DETAIL_RE = /^\/(ai-image-generation|ai-video-generation)\/([a-z0-9][a-z0-9-]{0,119})$/i;
const FLAT_ACTOR_RE = /^\/ai-actors\/([a-z0-9][a-z0-9-]{0,79})$/i;
const NESTED_ACTOR_RE = /^\/ai-actors\/(?:men|women)\/[a-z0-9][a-z0-9-]{0,79}$/i;

function sitePath(href) {
  let url;
  try {
    url = new URL(href, `${BASE_URL}/`);
  } catch {
    return undefined;
  }
  let pathname = url.pathname;
  const prefix = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0];
  if (prefix) pathname = pathname.slice(prefix.length) || "/";
  return { pathname, query: url.search, hash: url.hash };
}

function robotsContent(html) {
  const tag = (html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i) || [""])[0];
  return (tag.match(/\bcontent=["']([^"']*)["']/i)?.[1] || "").toLowerCase();
}

function documentTitle(html) {
  return (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
}

/** Card anchors on a public media page: `<a class="v-pick-card">` and `<article class="tc">`. */
function mediaCardAnchors(html) {
  const anchors = [];
  for (const match of html.matchAll(/<a\b[^>]*\bclass=["'][^"']*\bv-pick-card\b[^"']*["'][^>]*>/gi)) anchors.push(match[0]);
  for (const match of html.matchAll(/<article\b[^>]*\bclass=["'][^"']*\btc\b[^"']*["'][\s\S]{0,4000}?<\/article>/gi)) {
    for (const anchor of match[0].matchAll(/<a\b[^>]*>/gi)) anchors.push(anchor[0]);
  }
  return anchors;
}

function anchorHref(anchor) {
  return anchor.match(/\bhref=["']([^"']*)["']/i)?.[1] || "";
}

/**
 * A public media card must point at its own detail route and carry no
 * workspace payload: the card opens the page, the page owns the workspace.
 */
function assertCardOpensDetailPage(scope, anchor) {
  const href = anchorHref(anchor);
  assert.ok(href, `${scope}: media card has no href`);
  const parsed = sitePath(href);
  assert.ok(parsed, `${scope}: media card href is not a path (${href})`);
  assert.equal(parsed.query, "", `${scope}: media card href carries a query string (${href})`);
  assert.equal(parsed.hash, "", `${scope}: media card href carries a fragment (${href})`);
  assert.doesNotMatch(anchor, /\bdata-workspace-entry=/i, `${scope}: media card href carries a data-workspace-entry payload (${href})`);
  assert.ok(
    MEDIA_DETAIL_RE.test(parsed.pathname) || FLAT_ACTOR_RE.test(parsed.pathname),
    `${scope}: media card does not open a detail route (${href})`
  );
  assert.ok(!parsed.pathname.startsWith("/app/create"), `${scope}: media card still enters the workspace (${href})`);
  return parsed.pathname;
}

/**
 * A detail page answers 200, is not the workspace shell, is indexable and
 * owns exactly one workspace CTA that names this card. A page that renders a
 * finished video must publish the matching VideoObject JSON-LD.
 */
async function expectDetailPage(path, { kind, slug }) {
  const { response, html } = await getText(path);
  assert.equal(response.status, 200, `${path}: status ${response.status}`);
  assert.match(html, /<html[\s>]/i, `${path}: HTML document`);
  assert.doesNotMatch(documentTitle(html), /workspace/i, `${path}: detail page renders the workspace shell`);
  const robots = robotsContent(html);
  assert.doesNotMatch(robots, /noindex/, `${path}: robots must be indexable (${robots || "missing"})`);
  assert.match(robots, /follow/, `${path}: robots must be follow (${robots || "missing"})`);
  assert.doesNotMatch(robots, /nofollow/, `${path}: robots must not be nofollow (${robots})`);
  assert.equal(
    /<video\b/i.test(html),
    /"VideoObject"/.test(html),
    `${path}: the video element and the VideoObject JSON-LD must agree`
  );
  const ctas = [...html.matchAll(/<a\b[^>]*\bdata-workspace-entry=(["'])([\s\S]*?)\1[^>]*>/gi)];
  assert.equal(ctas.length, 1, `${path}: expected exactly one workspace CTA, found ${ctas.length}`);
  let payload;
  try {
    payload = JSON.parse(ctas[0][2].replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, "&"));
  } catch (error) {
    assert.fail(`${path}: workspace CTA payload is unreadable (${error.message})`);
  }
  assert.equal(payload?.media?.kind, kind, `${path}: workspace CTA media kind`);
  assert.equal(payload?.media?.slug, slug, `${path}: workspace CTA media slug`);
  checks.push(`${path}: 200 detail page (index, follow, one workspace CTA for ${kind}/${slug})`);
  return html;
}

await expectPage("/", ["AIVideosUGC"]);
await expectPage("/app/create", ["Workspace navigation", "AIVideosUGC"]);
await expectPage("/app/create/ai-video-generation", ["Workspace navigation", "AI Video"]);
await expectPage("/app/create/ai-image-generation", ["Workspace navigation", "AI Image"]);
await expectPage("/app/create/ai-actors", ["Workspace navigation", "AI Avatar"]);
await expectPage("/app/create/url-to-video", ["Workspace navigation", "Product for your video"]);
await expectPage("/app/create/product-links", ["Workspace navigation", "Your product library"]);
await expectPage("/app/create/text-to-video", ["Workspace navigation", "Text to Video"]);
await expectPage("/app/create/photo-hub/color", ["Workspace navigation"]);
await expectPage("/app/create/video-ads/creator", ["Workspace navigation"]);
await expectPage("/app/create/inspirations", ["Workspace navigation", "data-inspiration-card="]);
await expectPage("/app/inspirations", ["AIVideosUGC"]);
await expectPage("/site/aidreamcapes/app/create/ai-image-generation", ["Workspace navigation", "AI Image"]);
await expectPage("/site/aidreamcapes/app/create/url-to-video", ["Workspace navigation", "Product for your video"]);
await expectPage("/site/aidreamcapes/app/create/product-links", ["Workspace navigation", "Your product library"]);
await expectPage("/templates", ["AIVideosUGC"]);
await expectPage("/templates/video", ["AIVideosUGC"]);
await expectPage("/ai-video-generation", ["AIVideosUGC"]);
await expectPage("/ai-image-generation", ["AIVideosUGC"]);
await expectPage("/inspiration", ["AIVideosUGC"]);
await expectPage("/pricing", ["AIVideosUGC"]);

await expectRedirect("/app/create/video", "/app/create/ai-video-generation");
await expectRedirect("/app/create/images", "/app/create/ai-image-generation");
await expectRedirect("/app/create/actors", "/app/create/ai-actors");
await expectRedirect("/app/create/product", "/app/create/product-links");
await expectRedirect("/app/create/agent", "/app/create/text-to-video");
await expectRedirect("/app/create/ai-video-generation/text-to-video", "/app/create/text-to-video");
await expectPage("/app/create/ai-video-generation/url-to-video", ["Workspace navigation", "Product for your video"]);
await expectPage("/app/create/tool/video-ads/creator", ["Workspace navigation"]);
await expectPage("/app/create/ai-video-generation/video-ads/creator", ["Workspace navigation"]);
await expectRedirect("/app/create?tool=image-to-video&size=9:16&length=10", "/app/create/image-to-video?size=9%3A16&length=10");
await expectRedirect("/app/create?view=product", "/app/create/product-links");
await expectRedirect("/app/create?view=videoLink", "/app/create/url-to-video");
await expectRedirect("/app/create?view=library&filter=completed", "/app/create/library/completed");
await expectRedirect("/site/aidreamcapes/app/create?view=images", "/site/aidreamcapes/app/create/ai-image-generation");

// ---- Public media cards open their own detail page -------------------------
// The card inventory is read from the live pages, so the gate follows the
// current relational content instead of a frozen slug list.
const detailSamples = [];
for (const listing of ["/ai-video-generation", "/ai-image-generation"]) {
  const { response: listingResponse, html: listingHtml } = await getText(listing);
  assert.equal(listingResponse.status, 200, `${listing}: status ${listingResponse.status}`);
  const anchors = mediaCardAnchors(listingHtml);
  assert.ok(anchors.length > 0, `${listing}: no media cards were rendered`);
  for (const anchor of anchors) assertCardOpensDetailPage(listing, anchor);
  checks.push(`${listing}: ${anchors.length} media card(s) open their own detail page`);
  for (const anchor of anchors) {
    const pathname = sitePath(anchorHref(anchor)).pathname;
    const match = pathname.match(MEDIA_DETAIL_RE);
    if (!match) continue;
    const slug = match[2];
    const kind = match[1] === "ai-image-generation" ? "photo" : "video";
    if (detailSamples.some((sample) => sample.kind === kind)) continue;
    detailSamples.push({ kind, slug, path: pathname });
  }
}
assert.ok(
  detailSamples.some((sample) => sample.kind === "video") && detailSamples.some((sample) => sample.kind === "photo"),
  "media listings did not expose both a video and a photo detail page"
);
for (const sample of detailSamples) await expectDetailPage(sample.path, sample);

// ---- Actor pages are flat; the stored nested rows redirect -----------------
const { response: actorDirectory, html: actorHtml } = await getText("/ai-actors");
assert.equal(actorDirectory.status, 200, `/ai-actors: status ${actorDirectory.status}`);
const actorCards = [...actorHtml.matchAll(/<article\b[^>]*\bclass=["'][^"']*\bactor-card\b[^"']*["'][\s\S]{0,4000}?<\/article>/gi)].map((match) => match[0]);
assert.ok(actorCards.length > 0, "/ai-actors: no actor cards were rendered");
for (const card of actorCards) {
  const anchor = (card.match(/<a\b[^>]*>/i) || [""])[0];
  const href = anchorHref(anchor);
  const parsed = sitePath(href);
  assert.ok(parsed, `/ai-actors: actor card href is not a path (${href})`);
  assert.equal(parsed.query, "", `/ai-actors: actor card href carries a query string (${href})`);
  assert.equal(parsed.hash, "", `/ai-actors: actor card href carries a fragment (${href})`);
  assert.doesNotMatch(anchor, /\bdata-workspace-entry=/i, `/ai-actors: actor card href carries a data-workspace-entry payload (${href})`);
  assert.ok(FLAT_ACTOR_RE.test(parsed.pathname), `/ai-actors: actor card does not open a flat actor page (${href})`);
}
checks.push(`/ai-actors: ${actorCards.length} actor card(s) open their flat /ai-actors/<name> page`);

const actorSlugs = actorCards
  .map((card) => {
    const anchor = (card.match(/<a\b[^>]*>/i) || [""])[0];
    const parsed = sitePath(anchorHref(anchor));
    return parsed?.pathname.match(FLAT_ACTOR_RE)?.[1];
  })
  .filter(Boolean);
assert.ok(actorSlugs.length > 0, "/ai-actors: no flat actor slug was found");
for (const slug of actorSlugs.slice(0, 3)) {
  const { response: flat, html: flatHtml } = await getText(`/ai-actors/${slug}`);
  assert.equal(flat.status, 200, `/ai-actors/${slug}: status ${flat.status}`);
  assert.doesNotMatch(documentTitle(flatHtml), /workspace/i, `/ai-actors/${slug}: renders the workspace shell`);
  for (const gender of ["men", "women"]) {
    const nested = await get(`/ai-actors/${gender}/${slug}`, { redirect: "manual" });
    assert.ok(
      nested.status === 301 || nested.status === 308,
      `/ai-actors/${gender}/${slug}: expected a permanent redirect, got ${nested.status}`
    );
    const location = sitePath(nested.headers.get("location") || "")?.pathname;
    assert.equal(location, `/ai-actors/${slug}`, `/ai-actors/${gender}/${slug}: redirect target`);
  }
}
checks.push(`/ai-actors: ${Math.min(3, actorSlugs.length)} flat actor page(s) 200 and their nested addresses redirect permanently`);

const inspirationResponse = await get("/api/sites/site_aidreamcapes/aivideosugc/inspirations");
assert.equal(inspirationResponse.status, 200, `inspirations API: status ${inspirationResponse.status}`);
const inspirationBody = await inspirationResponse.json();
assert.ok(Array.isArray(inspirationBody.cards) && inspirationBody.cards.length > 0, "inspirations API: cards");
assert.equal(typeof inspirationBody.total, "number", "inspirations API: total");
assert.equal(typeof inspirationBody.nextOffset, "number", "inspirations API: nextOffset");
assert.ok(inspirationBody.counts && typeof inspirationBody.counts.all === "number", "inspirations API: counts");
checks.push(`inspirations API: ${inspirationBody.cards.length} cards / ${inspirationBody.total} total`);

const { response: hubMediaResponse, html: hubMediaHtml } = await getText("/ai-video-generation?page=2");
assert.equal(hubMediaResponse.status, 200, "video hub page 2: status");
const hubMediaCards = (hubMediaHtml.match(/class="v-pick-card"/g) || []).length;
assert.ok(hubMediaCards > 0 && hubMediaCards <= 20, `video hub page 2: ${hubMediaCards} SSR picker cards (max 20 per page)`);
assert.ok(hubMediaHtml.includes('aria-label="Browse more tools by page"'), "video hub page 2: picker pager present");
assert.ok(!hubMediaHtml.includes("MediaGridLoader"), "video hub: no client media loader");
checks.push(`video hub SSR pagination: page 2 renders ${hubMediaCards} cards with a plain-anchor pager`);

const { response: hubGalleryResponse, html: hubGalleryHtml } = await getText("/ai-video-generation?galleryPage=2");
assert.equal(hubGalleryResponse.status, 200, "video hub gallery page 2: status");
// The full-catalog module is retired on the video-hub page (content-level
// decision); any galleryPage address must keep answering the standard layout
// without resurrecting it.
assert.ok(!hubGalleryHtml.includes("Browse every video example"), "video hub: retired full catalog stays absent");
assert.ok(!hubGalleryHtml.includes("data-media-slug="), "video hub: no retired catalog cards");
assert.ok(!hubGalleryHtml.includes("galleryPage=3"), "video hub: no retired catalog pager");
assert.ok(hubGalleryHtml.includes("TikTok Shop case studies"), "video hub: TikTok Shop case-studies section present");
const hubCaseCards = (hubGalleryHtml.match(/data-adc2-preview/g) || []).length;
assert.ok(hubCaseCards >= 20, `video hub: ${hubCaseCards} TikTok Shop case-study previews (expect the full set of 20)`);
checks.push(`video hub: retired catalog stays absent; ${hubCaseCards} case-study previews in industry groups`);

const hubMediaGone = await get("/api/aidreamcapes/media-cards?offset=20&limit=20");
assert.equal(hubMediaGone.status, 404, `retired hub media API: status ${hubMediaGone.status} (expected 404)`);
checks.push("retired hub media API: 404 (browser JS no longer fetches catalog data)");

const { response: home, html: homeHtml } = await getText("/");
assert.equal(home.status, 200, "home: status");
const legacyQueryLinks = (homeHtml.match(/href="[^"]*\/app\/create\?[^"]*(?:tool|template|prompt|size|length|view)=/gi) || []).length;
const nextHashLinks = (homeHtml.match(/nextHash=/gi) || []).length;
if (legacyQueryLinks || nextHashLinks) {
  warnings.push(`home: ${legacyQueryLinks} legacy query workspace links, ${nextHashLinks} nextHash links (content, not code)`);
} else {
  checks.push("home: no legacy query workspace links");
}

const { response: sitemap, html: sitemapXml } = await getText("/sitemap.xml");
assert.equal(sitemap.status, 200, `sitemap: status ${sitemap.status}`);
assert.match(sitemapXml, /<urlset[\s>]/i, "sitemap: urlset");
const sitemapPaths = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => {
  try {
    return new URL(match[1].trim()).pathname;
  } catch {
    return "";
  }
}).filter(Boolean);
// The sitemap submits canonical public pages: the nested actor rows are
// permanent redirects and must never submit. Media detail pages answer 200,
// submit themselves to the sitemap, and their alias addresses redirect
// permanently without submitting.
const nestedActorUrls = sitemapPaths.filter((path) => NESTED_ACTOR_RE.test(path));
assert.equal(nestedActorUrls.length, 0, `sitemap: ${nestedActorUrls.length} nested actor URL(s)`);
for (const sample of detailSamples) {
  const direct = await get(sample.path, { redirect: "manual" });
  const redirects = [301, 308].includes(direct.status);
  await direct.dispose?.();
  if (redirects) {
    assert.ok(!sitemapPaths.includes(sample.path), `sitemap: redirecting detail alias must not submit (${sample.path})`);
  } else {
    assert.ok(sitemapPaths.includes(sample.path), `sitemap: detail page must submit itself to the sitemap (${sample.path})`);
  }
}
checks.push(`sitemap: ${sitemapPaths.length} URL(s), no nested actor URL, canonical media detail pages submit`);
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
