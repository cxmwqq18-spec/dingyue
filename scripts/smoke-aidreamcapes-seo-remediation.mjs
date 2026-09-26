#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";

const ORIGIN = String(argumentValue("--origin") || process.env.AIDREAMCAPES_AUDIT_ORIGIN || "https://aidreamcapes.com").replace(/\/$/, "");
const WWW_ORIGIN = String(argumentValue("--www-origin") || "https://www.aidreamcapes.com").replace(/\/$/, "");
const REQUEST_ORIGIN = String(argumentValue("--request-origin") || ORIGIN).replace(/\/$/, "");
const WWW_REQUEST_ORIGIN = String(argumentValue("--www-request-origin") || WWW_ORIGIN).replace(/\/$/, "");
const REQUEST_HOST = String(argumentValue("--request-host") || process.env.AIDREAMCAPES_REQUEST_HOST || "").trim();
const WWW_REQUEST_HOST = String(argumentValue("--www-request-host") || process.env.AIDREAMCAPES_WWW_REQUEST_HOST || "").trim();
const REQUEST_PROTO = String(argumentValue("--request-proto") || process.env.AIDREAMCAPES_REQUEST_PROTO || "").trim();
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
  "/ai-image-generation/urban", "/ai-image-generation/valentines-photo",
  "/ai-image-generation/wedding-photo", "/ai-image-generation/premiere-style-portraits"
];
const GONE_PATHS = [
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-image-generation/unblur-image"
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

function nextFlightPayloadText(html) {
  const prefix = 'self.__next_f.push([1,"';
  const chunks = [];
  let cursor = 0;
  while (true) {
    const start = html.indexOf(prefix, cursor);
    if (start < 0) break;
    const payloadStart = start + prefix.length;
    const payloadEnd = html.indexOf('"])', payloadStart);
    if (payloadEnd < 0) break;
    try {
      chunks.push(JSON.parse(`"${html.slice(payloadStart, payloadEnd)}"`));
    } catch {
      // Ignore non-JSON flight chunks and continue scanning the response.
    }
    cursor = payloadEnd + 3;
  }
  return chunks.join("\n");
}

function balancedJsonObjectAt(text, start) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  return "";
}

function nextFlightJsonLdBlocks(html) {
  const payloadText = nextFlightPayloadText(html);
  const blocks = [];
  const marker = '{"@context":"https://schema.org"';
  let cursor = 0;
  while (true) {
    const start = payloadText.indexOf(marker, cursor);
    if (start < 0) break;
    const serialized = balancedJsonObjectAt(payloadText, start);
    if (serialized) {
      try {
        blocks.push(JSON.parse(serialized));
      } catch {
        // Ignore incomplete or non-JSON fragments in the flight stream.
      }
    }
    cursor = start + marker.length;
  }
  return blocks;
}

function requestUrl(url) {
  return String(url).replace(ORIGIN, REQUEST_ORIGIN).replace(WWW_ORIGIN, WWW_REQUEST_ORIGIN);
}

async function assertImageResponse(url) {
  const response = await fetchWithRetry(url, { method: "HEAD", redirect: "manual", headers: { "Cache-Control": "no-cache", ...(REQUEST_HOST ? { host: REQUEST_HOST, "x-forwarded-host": REQUEST_HOST } : {}), ...(REQUEST_PROTO ? { "x-forwarded-proto": REQUEST_PROTO } : {}) } });
  const contentType = response.headers.get("content-type") || "";
  assert.equal(response.status, 200, `${url}: image HTTP ${response.status}`);
  assert(contentType.toLowerCase().startsWith("image/"), `${url}: expected image MIME, received ${contentType || "missing"}`);
}

async function checkImageUrls(urls) {
  const unique = [...new Set(urls.filter(Boolean).map(requestUrl))];
  for (let start = 0; start < unique.length; start += 48) {
    await Promise.all(unique.slice(start, start + 48).map(assertImageResponse));
  }
  return unique.length;
}

function bodyJsonLd(html) {
  const blocks = [...html.matchAll(/<script\b([^>]*)type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => ({ attributes: match[1] || "", json: match[2] || "" }));
  if (blocks.length) {
    return blocks.find((block) => /data-storefront-json-ld=["']body-marker["']/i.test(block.attributes))?.json
      || blocks[0]?.json
      || "";
  }
  const flightBlock = nextFlightJsonLdBlocks(html)[0];
  return flightBlock ? JSON.stringify(flightBlock) : "";
}

function jsonLdBlocks(html) {
  const blocks = [...html.matchAll(/<script\b([^>]*)type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => {
      try {
        return JSON.parse(match[2] || "");
      } catch (error) {
        throw new Error(`Invalid JSON-LD: ${error.message}`);
      }
    });
  return blocks.length ? blocks : nextFlightJsonLdBlocks(html);
}

function collectJsonLdIds(value, result = []) {
  if (Array.isArray(value)) value.forEach((item) => collectJsonLdIds(item, result));
  else if (value && typeof value === "object") {
    // A reference such as {"@id":"...#organization"} is not a second
    // entity definition. Count only typed/expanded nodes as definitions.
    if (typeof value["@id"] === "string" && (typeof value["@type"] === "string" || Object.keys(value).some((key) => key !== "@id"))) {
      result.push(value["@id"]);
    }
    Object.values(value).forEach((child) => collectJsonLdIds(child, result));
  }
  return result;
}

function assertHeadingHierarchy(path, html) {
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
  for (let index = 1; index < levels.length; index += 1) {
    assert(levels[index] <= levels[index - 1] + 1, `${path}: heading level jumps from H${levels[index - 1]} to H${levels[index]}`);
  }
}

function assertSeoContract(path, html) {
  const canonical = canonicalFromHtml(html);
  assert.equal((html.match(/<title\b[^>]*>[\s\S]*?<\/title>/gi) || []).length, 1, `${path}: expected one title`);
  assert.equal((html.match(/<meta\b(?=[^>]*name=["']description["'])[^>]*>/gi) || []).length, 1, `${path}: expected one description`);
  assert.equal((html.match(/<link\b(?=[^>]*rel=["']canonical["'])[^>]*>/gi) || []).length, 1, `${path}: expected one canonical`);
  assert.equal(canonical, `${ORIGIN}${path}`, `${path}: canonical mismatch`);
  assert(!canonical.includes("www.aidreamcapes.com"), `${path}: canonical uses www`);
  assert(/<meta\b(?=[^>]*property=["']og:type["'])[^>]*>/i.test(html), `${path}: og:type missing`);
  if (/<meta\b(?=[^>]*property=["']og:image["'])[^>]*>/i.test(html)) {
    assert(/<meta\b(?=[^>]*property=["']og:image:alt["'])[^>]*>/i.test(html), `${path}: og:image:alt missing`);
  }
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${path}: expected one H1`);
  assert(!/mydreamshoots/i.test(html), `${path}: MyDreamShoots residual found in HTML`);
  if (path === "/") assertHeadingHierarchy(path, html);
  assert(!/mydreamshoots/i.test(visibleHtml(html)), `${path}: MyDreamShoots residual found in visible HTML`);
  assert(!/mydreamshoots/i.test(bodyJsonLd(html)), `${path}: MyDreamShoots residual found in JSON-LD`);
  const ids = collectJsonLdIds(jsonLdBlocks(html));
  assert.equal(ids.length, new Set(ids).size, `${path}: duplicate JSON-LD @id`);
  for (const tag of html.match(/<video\b[^>]*>[\s\S]*?<\/video>|<video\b[^>]*\/>/gi) || []) {
    assert(attr(tag, "poster"), `${path}: video poster missing`);
    assert(attr(tag, "width"), `${path}: video width missing`);
    assert(attr(tag, "height"), `${path}: video height missing`);
    const directSrc = attr(tag, "src");
    if (directSrc) assert(/\.(?:mp4|webm|m4v|mov)(?:[?#]|$)/i.test(directSrc), `${path}: video src is not a video asset`);
    for (const source of tag.match(/<source\b[^>]*>/gi) || []) {
      assert(/\.(?:mp4|webm|m4v|mov)(?:[?#]|$)/i.test(attr(source, "src")), `${path}: source is not a video asset`);
      assert(/^video\//i.test(attr(source, "type")), `${path}: video source MIME missing`);
    }
  }
}

async function fetchChecked(url, options = {}) {
  const isWwwRequest = options.headers?.["x-smoke-www"] === "1" || (WWW_REQUEST_ORIGIN !== REQUEST_ORIGIN && String(url).startsWith(WWW_REQUEST_ORIGIN));
  const host = isWwwRequest ? WWW_REQUEST_HOST : REQUEST_HOST;
  const response = await fetchWithRetry(url, { redirect: "manual", headers: { "Cache-Control": "no-cache", ...(host ? { host, "x-forwarded-host": host } : {}), ...(REQUEST_PROTO ? { "x-forwarded-proto": REQUEST_PROTO } : {}), ...options.headers } });
  return { response, html: await response.text() };
}

async function fetchWithRetry(url, options, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
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
  const jsonLd = bodyJsonLd(html);
  assert.equal((jsonLd.match(/"@type"\s*:\s*"Question"/g) || []).length, 6, `${path}: expected six FAQ questions in JSON-LD`);
  assert(!/premiere-style-portraits|["']@type["']\s*:\s*["'](?:ItemList|Product)["']/i.test(jsonLd), `${path}: stale or unrelated structured data found`);
  assert(!/premiere-style-portraits|\/ai-image-generation\/(?:headshot|avatar|portrait-photo)/i.test(visibleHtml(html)), `${path}: stale route or theme reference found`);
  assert(jsonLd.includes('"@type":"Service"') || jsonLd.includes('"@type": "Service"'), `${path}: Service JSON-LD missing`);
  assert(jsonLd.includes('"@type":"SoftwareApplication"') || jsonLd.includes('"@type": "SoftwareApplication"'), `${path}: SoftwareApplication JSON-LD missing`);
  const tags = imageTags(html);
  assert(tags.length >= manifest.length, `${path}: rendered images ${tags.length} below manifest ${manifest.length}`);
  for (const tag of tags) {
    for (const name of ["alt", "width", "height"]) assert(tag.match(new RegExp(`\\s${name}=["']`, "i")), `${path}: image missing ${name}`);
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
    for (let start = 0; start < THEME_SLUGS.length; start += 6) {
      themeResults.push(...await Promise.all(THEME_SLUGS.slice(start, start + 6).map((slug) => checkThemePage(prisma, slug))));
    }
    const sitemapPagePaths = locs
      .map((loc) => new URL(loc))
      .filter((pageUrl) => pageUrl.hostname === new URL(ORIGIN).hostname)
      .map((pageUrl) => `${pageUrl.pathname}${pageUrl.search}`);
    for (let start = 0; start < sitemapPagePaths.length; start += 12) {
      await Promise.all(sitemapPagePaths.slice(start, start + 12).map(async (path) => {
        const page = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
        assert.equal(page.response.status, 200, `${path}: HTTP ${page.response.status}`);
        assertSeoContract(path, page.html);
      }));
    }
    const sitemapImageUrls = [...sitemap.html.matchAll(/<image:loc>([^<]+)<\/image:loc>/gi)].map((match) => decode(match[1]));
    const themeImageUrls = themeResults.flatMap((result) => result.mediaUrls);
    const checkedImageCount = await checkImageUrls([...sitemapImageUrls, ...themeImageUrls]);
    const virtualTryOn = await fetchChecked(`${REQUEST_ORIGIN}/ai-image-generation/virtual-try-on`);
    assert.equal(virtualTryOn.response.status, 200, "virtual-try-on must remain published");

    for (const [origin, requestOrigin] of [[ORIGIN, REQUEST_ORIGIN], [WWW_ORIGIN, WWW_REQUEST_ORIGIN]]) {
      const page = await fetchChecked(`${requestOrigin}/ai-image-generation/fashion-editorial`, origin === WWW_ORIGIN ? { headers: { "x-smoke-www": "1" } } : {});
      if (origin === ORIGIN) {
        assert.equal(page.response.status, 200, `${origin}: fashion-editorial status`);
        assert.equal(canonicalFromHtml(page.html), `${ORIGIN}/ai-image-generation/fashion-editorial`, `${origin}: fashion-editorial canonical`);
      } else {
        assert.equal(page.response.status, 301, `${origin}: expected 301`);
        assert.equal(page.response.headers.get("location"), `${ORIGIN}/ai-image-generation/fashion-editorial`, `${origin}: expected non-www redirect`);
      }
    }

    for (const path of RETIRED_PATHS) {
      const { response } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
      assert.equal(response.status, 404, `${path}: expected 404`);
      assert.equal(response.headers.get("location"), null, `${path}: unexpected Location header`);
    }
    for (const path of GONE_PATHS) {
      const { response } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
      assert.equal(response.status, 410, `${path}: expected 410`);
      assert.equal(response.headers.get("location"), null, `${path}: unexpected Location header`);
    }
    const stale = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-image-generation/headshot" } }, select: { id: true } });
    assert.equal(stale, null, "stale Aidreamcapes headshot LivePage still exists");
    const random404 = await fetchChecked(`${REQUEST_ORIGIN}/seo-smoke-random-404`);
    assert.equal(random404.response.status, 404, "random 404 must remain 404");
    assert(/<meta\b(?=[^>]*name=["']robots["'])(?=[^>]*content=["'][^"']*noindex)/i.test(random404.html), "random 404 must remain noindex");
    console.log(JSON.stringify({ ok: true, origin: ORIGIN, wwwOrigin: WWW_ORIGIN, sitemapPageLocs: locs.length, sitemapImageLocs: sitemapImageUrls.length, checkedImageCount, themes: themeResults.map(({ mediaUrls: _mediaUrls, ...result }) => result), retiredRoutes: RETIRED_PATHS.length, goneRoutes: GONE_PATHS.length, pageSpeed: "skipped" }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
