#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";

const ORIGIN = String(argumentValue("--origin") || process.env.AIDREAMCAPES_AUDIT_ORIGIN || "https://aidreamcapes.com").replace(/\/$/, "");
const WWW_ORIGIN = String(argumentValue("--www-origin") || "https://www.aidreamcapes.com").replace(/\/$/, "");
const REQUEST_ORIGIN = String(argumentValue("--request-origin") || ORIGIN).replace(/\/$/, "");
const WWW_REQUEST_ORIGIN = String(argumentValue("--www-request-origin") || WWW_ORIGIN).replace(/\/$/, "");
const SKIP_ROBOTS = process.argv.includes("--skip-robots");
const DB_TARGET = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
const SITE_ID = "site_aidreamcapes";
const THEME_SLUGS = [
  "ecommerce-main-image", "lifestyle-scene", "packshot-multi-angle", "macro-details", "bundle-sets", "size-reference", "feature-infographic", "comparison-chart",
  "feed-ad-still", "ugc-still-ad", "story-ad-vertical", "carousel-set", "sale-campaign-key-visual", "lookbook-cover",
  "on-model-generation", "virtual-try-on", "hair-makeup-preview", "jewelry-positioning", "ghost-mannequin", "colorway-variations",
  "background-remove-replace", "enhance-upscale", "old-photo-restore", "commercial-lighting", "packaging-mockup",
  "professional-headshot", "creator-portrait", "team-directory", "social-profile-photo", "fashion-editorial"
];
const RETIRED_PATHS = [
  "/ai-image-generation/motion-generator",
  "/ai-image-generation/rich-lifestyle", "/ai-image-generation/social-cards", "/ai-image-generation/black-friday", "/ai-image-generation/street-style",
  "/ai-image-generation/hairstyle-generator", "/ai-image-generation/edit-by-prompt", "/ai-image-generation/background-remover", "/ai-image-generation/photo-enhancer",
  "/ai-image-generation/old-photo-restoration", "/ai-image-generation/headshot", "/ai-image-generation/avatar", "/ai-image-generation/portrait-photo",
  "/tools/product-reverie", "/tools/permission-safe-photo-planner",
  "/ai-image-generation/background-changer", "/ai-image-generation/bikini", "/ai-image-generation/boudoir",
  "/ai-image-generation/cannes", "/ai-image-generation/christmas-photo", "/ai-image-generation/color-correction",
  "/ai-image-generation/cyberpunk", "/ai-image-generation/engagement-photo", "/ai-image-generation/gala-photo",
  "/ai-image-generation/halloween-photo", "/ai-image-generation/holiday", "/ai-image-generation/mafia",
  "/ai-image-generation/magic-eraser", "/ai-image-generation/nightlife", "/ai-image-generation/only-fans",
  "/ai-image-generation/portrait-retouch", "/ai-image-generation/singles-awareness-day", "/ai-image-generation/soccer",
  "/ai-image-generation/swimsuit", "/ai-image-generation/thanksgiving-photo", "/ai-image-generation/travel",
  "/ai-image-generation/unblur-image", "/ai-image-generation/urban", "/ai-image-generation/valentines-photo",
  "/ai-image-generation/wedding-photo", "/ai-image-generation/premiere-style-portraits"
];
const LEGACY_SITEMAP_ALIASES = [
  "christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day", "valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony"
].map((slug) => `/ai-video-generation/${slug}`);

function decode(value) {
  return String(value || "")
    .replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attr(tag, name) {
  return decode(tag.match(new RegExp(`\\s${name}=["']([^"']*)["']`, "i"))?.[1] || "");
}

function canonicalFromHtml(html) {
  const tag = (html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i) || [""])[0];
  return attr(tag, "href");
}

function imageTags(html) {
  return html.match(/<img\b[^>]*>/gi) || [];
}

function visibleHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
}

function mediaUrlForOrigin(src) {
  const value = String(src || "").trim();
  if (/^https?:\/\//i.test(value)) return value.replace(ORIGIN, REQUEST_ORIGIN).replace(WWW_ORIGIN, WWW_REQUEST_ORIGIN);
  return `${REQUEST_ORIGIN}${value.startsWith("/") ? value : `/${value}`}`;
}

function requestUrl(url) {
  return String(url).replace(ORIGIN, REQUEST_ORIGIN).replace(WWW_ORIGIN, WWW_REQUEST_ORIGIN);
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function readResponseWithTimeout(response, timeoutMs = 30_000) {
  let timer;
  try {
    return await Promise.race([
      response.arrayBuffer(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`response body timeout after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (response.body) response.body.cancel().catch(() => {});
  }
}

async function assertImageResponse(url) {
  let response;
  try {
    response = await fetchWithRetry(url, { redirect: "manual", headers: { "Cache-Control": "no-cache" } });
  } catch (error) {
    throw new Error(`${url}: ${error?.message || error}`);
  }
  const contentType = response.headers.get("content-type") || "";
  assert.equal(response.status, 200, `${url}: image HTTP ${response.status}`);
  assert(contentType.toLowerCase().startsWith("image/"), `${url}: expected image MIME, received ${contentType || "missing"}`);
  let body;
  try {
    body = await readResponseWithTimeout(response);
  } catch (error) {
    throw new Error(`${url}: ${error?.message || error}`);
  }
  assert(body.byteLength > 64, `${url}: image response is empty or suspiciously small`);
}

async function checkImageUrls(urls) {
  const unique = [...new Set(urls.filter(Boolean).map(requestUrl))];
  for (let start = 0; start < unique.length; start += 4) {
    await Promise.all(unique.slice(start, start + 4).map(assertImageResponse));
  }
  return unique.length;
}

function jsonLdGraphFromHtml(html, path) {
  const blocks = [...html.matchAll(/<script\b([^>]*)type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => ({ attributes: match[1] || "", json: match[2] || "" }));
  assert.equal(blocks.length, 1, `${path}: expected exactly one JSON-LD script`);
  try {
    return JSON.parse(blocks[0].json);
  } catch (error) {
    assert.fail(`${path}: invalid JSON-LD: ${error.message}`);
  }
}

function metaByProperty(html, property) {
  const tag = (html.match(new RegExp(`<meta\\b[^>]*property=["']${property}["'][^>]*>`, "i")) || [""])[0];
  return attr(tag, "content");
}

function metaPropertyCount(html, property) {
  const pattern = "<meta\\b[^>]*property=[\"']" + property + "[\"'][^>]*>";
  return (html.match(new RegExp(pattern, "gi")) || []).length;
}

async function fetchChecked(url, options = {}) {
  const response = await fetchWithRetry(url, { redirect: "manual", headers: { "Cache-Control": "no-cache", ...options.headers } });
  return { response, html: await response.text() };
}

async function checkThemePage(prisma, slug) {
  const path = `/ai-image-generation/${slug}`;
  const expectedCanonical = `${ORIGIN}${path}`;
  const dbPage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: path } }, select: { slug: true, contentJson: true } });
  assert(dbPage, `${path}: LivePage missing`);
  assert.equal(dbPage.contentJson?.seo?.canonical, expectedCanonical, `${path}: SQL canonical mismatch`);
  const manifest = Array.isArray(dbPage.contentJson?.mediaManifest) ? dbPage.contentJson.mediaManifest : [];
  assert.equal(manifest.length, Number(dbPage.contentJson?.contentContract?.mediaCount), `${path}: SQL media count mismatch`);
  assert.equal(dbPage.contentJson?.contentContract?.faqCount, 6, `${path}: SQL FAQ contract mismatch`);

  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(canonicalFromHtml(html), expectedCanonical, `${path}: rendered canonical mismatch`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${path}: expected one H1`);
  assert.equal((html.match(/<details class=["']group py-5["'][^>]*>/gi) || []).length, 6, `${path}: expected six FAQ details`);
  const jsonLdValue = jsonLdGraphFromHtml(html, path);
  const jsonLd = JSON.stringify(jsonLdValue);
  assert.equal((jsonLd.match(/"@type"\s*:\s*"Question"/g) || []).length, 6, `${path}: expected six FAQ questions in JSON-LD`);
  assert(!/premiere-style-portraits|["']@type["']\s*:\s*["'](?:ItemList|Product)["']/i.test(jsonLd), `${path}: stale or unrelated structured data found`);
  assert(!/premiere-style-portraits|\/ai-image-generation\/(?:headshot|avatar|portrait-photo)/i.test(visibleHtml(html)), `${path}: stale route or theme reference found`);
  assert(html.includes('"@type":"Service"') || html.includes('"@type": "Service"'), `${path}: Service JSON-LD missing`);
  assert(html.includes('"@type":"SoftwareApplication"') || html.includes('"@type": "SoftwareApplication"'), `${path}: SoftwareApplication JSON-LD missing`);
  const graph = Array.isArray(jsonLdValue?.["@graph"]) ? jsonLdValue["@graph"] : [];
  const organization = graph.find((node) => node?.["@type"] === "Organization");
  assert.equal(organization?.logo?.url, `${ORIGIN}/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg`, `${path}: Aidreamcapes Organization logo mismatch`);
  const tags = imageTags(html);
  assert(tags.length >= manifest.length, `${path}: rendered images ${tags.length} below manifest ${manifest.length}`);
  for (const tag of tags) {
    for (const name of ["alt", "width", "height", "loading", "sizes"]) assert(tag.match(new RegExp(`\\s${name}=["']`, "i")), `${path}: image missing ${name}`);
  }
  for (const media of manifest) assert(html.includes(String(media.src).split("?")[0]), `${path}: manifest image not rendered: ${media.src}`);
  return { path, mediaCount: manifest.length, imageTagCount: tags.length, mediaUrls: manifest.map((media) => mediaUrlForOrigin(media.src)) };
}

async function main() {
  assertDatabaseTarget({ expectedTarget: DB_TARGET });
  const prisma = new PrismaClient();
  try {
    const sitemap = await fetchChecked(`${REQUEST_ORIGIN}/sitemap.xml`);
    assert.equal(sitemap.response.status, 200, `sitemap: HTTP ${sitemap.response.status}`);
    const locs = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decode(match[1]));
    const locSet = new Set(locs);
    const publicPageLocs = [...new Set(locs.filter((loc) => loc === ORIGIN || loc === `${ORIGIN}/` || loc.startsWith(`${ORIGIN}/`)))];
    assert.equal(publicPageLocs.length, 86, "sitemap must contain exactly 86 Aidreamcapes public pages");
    for (const slug of THEME_SLUGS) assert(locSet.has(`${ORIGIN}/ai-image-generation/${slug}`), `sitemap missing image theme: ${slug}`);
    assert(!locs.some((loc) => loc.startsWith(`${WWW_ORIGIN}/`)), "sitemap contains a www Aidreamcapes page URL");
    assert(!locs.some((loc) => loc.includes("/tools")), "sitemap contains a /tools URL");
    for (const alias of LEGACY_SITEMAP_ALIASES) assert(!locs.includes(`${ORIGIN}${alias}`), `sitemap contains legacy alias: ${alias}`);
    assert(!locs.some((loc) => loc.includes("premiere-style-portraits")), "sitemap contains the stale premiere route");

    if (!SKIP_ROBOTS) {
      const robots = await fetchChecked(`${REQUEST_ORIGIN}/robots.txt`);
      assert.equal(robots.response.status, 200, `robots.txt: HTTP ${robots.response.status}`);
      assert(robots.html.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "robots.txt does not point to the non-www sitemap");
    }

    const themeResults = [];
    for (const slug of THEME_SLUGS) themeResults.push(await checkThemePage(prisma, slug));
    for (const pageUrl of publicPageLocs) {
      const path = new URL(pageUrl).pathname || "/";
      const { response, html } = await fetchChecked(requestUrl(pageUrl));
      assert.equal(response.status, 200, `${path}: public page HTTP ${response.status}`);
      assert.equal(response.headers.get("location"), null, `${path}: public page unexpectedly redirects`);
      assert.equal(metaByProperty(html, "og:type"), path.startsWith("/blog/") ? "article" : "website", `${path}: og:type mismatch`);
      assert.equal(metaPropertyCount(html, "og:type"), 1, path + ": expected exactly one og:type");
      const jsonLdValue = jsonLdGraphFromHtml(html, path);
      const graph = Array.isArray(jsonLdValue?.["@graph"]) ? jsonLdValue["@graph"] : [];
      const organization = graph.find((node) => node?.["@type"] === "Organization");
      assert.equal(organization?.logo?.url, ORIGIN + "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg", path + ": Aidreamcapes Organization logo mismatch");
    }
    const sitemapImageUrls = [...sitemap.html.matchAll(/<image:loc>([^<]+)<\/image:loc>/gi)].map((match) => decode(match[1]));
    const themeImageUrls = themeResults.flatMap((result) => result.mediaUrls);
    const checkedImageCount = await checkImageUrls([...sitemapImageUrls, ...themeImageUrls]);
    await assertImageResponse(`${REQUEST_ORIGIN}/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg`);
    const virtualTryOn = await fetchChecked(`${REQUEST_ORIGIN}/ai-image-generation/virtual-try-on`);
    assert.equal(virtualTryOn.response.status, 200, "virtual-try-on must remain published");

    for (const [origin, requestOrigin] of [[ORIGIN, REQUEST_ORIGIN], [WWW_ORIGIN, WWW_REQUEST_ORIGIN]]) {
      const page = await fetchChecked(`${requestOrigin}/ai-image-generation/fashion-editorial`);
      assert.equal(page.response.status, 200, `${origin}: fashion-editorial status`);
      assert.equal(canonicalFromHtml(page.html), `${ORIGIN}/ai-image-generation/fashion-editorial`, `${origin}: fashion-editorial canonical`);
    }

    for (const path of RETIRED_PATHS) {
      const { response } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
      assert.equal(response.status, 404, `${path}: expected 404`);
      assert.equal(response.headers.get("location"), null, `${path}: unexpected Location header`);
    }
    const stale = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-image-generation/headshot" } }, select: { id: true } });
    assert.equal(stale, null, "stale Aidreamcapes headshot LivePage still exists");
    console.log(JSON.stringify({ ok: true, origin: ORIGIN, wwwOrigin: WWW_ORIGIN, sitemapPageLocs: locs.length, sitemapImageLocs: sitemapImageUrls.length, checkedImageCount, themes: themeResults.map(({ mediaUrls: _mediaUrls, ...result }) => result), retiredRoutes: RETIRED_PATHS.length, pageSpeed: "skipped" }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
