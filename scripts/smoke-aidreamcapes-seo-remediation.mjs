#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";

const ORIGIN = String(argumentValue("--origin") || process.env.AIDREAMCAPES_AUDIT_ORIGIN || "https://aidreamcapes.com").replace(/\/$/, "");
const WWW_ORIGIN = String(argumentValue("--www-origin") || "https://www.aidreamcapes.com").replace(/\/$/, "");
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
  "/tools/product-reverie", "/tools/permission-safe-photo-planner"
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

async function fetchChecked(url, options = {}) {
  const response = await fetch(url, { redirect: "manual", headers: { "Cache-Control": "no-cache", ...options.headers } });
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

  const { response, html } = await fetchChecked(`${ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assert.equal(canonicalFromHtml(html), expectedCanonical, `${path}: rendered canonical mismatch`);
  assert.equal((html.match(/<h1\b/gi) || []).length, 1, `${path}: expected one H1`);
  assert.equal((html.match(/"@type"\s*:\s*"Question"/g) || []).length, 6, `${path}: expected six FAQ questions in JSON-LD`);
  assert(!/premiere-style-portraits|ItemList|"@type"\s*:\s*"Product"/i.test(html), `${path}: stale or unrelated structured data found`);
  assert(html.includes('"@type":"Service"') || html.includes('"@type": "Service"'), `${path}: Service JSON-LD missing`);
  assert(html.includes('"@type":"SoftwareApplication"') || html.includes('"@type": "SoftwareApplication"'), `${path}: SoftwareApplication JSON-LD missing`);
  const tags = imageTags(html);
  assert(tags.length >= manifest.length, `${path}: rendered images ${tags.length} below manifest ${manifest.length}`);
  for (const tag of tags) {
    for (const name of ["alt", "width", "height", "loading", "sizes"]) assert(tag.match(new RegExp(`\\s${name}=["']`, "i")), `${path}: image missing ${name}`);
  }
  for (const media of manifest) assert(html.includes(String(media.src).split("?")[0]), `${path}: manifest image not rendered: ${media.src}`);
  return { path, mediaCount: manifest.length, imageTagCount: tags.length };
}

async function main() {
  assertDatabaseTarget({ expectedTarget: DB_TARGET });
  const prisma = new PrismaClient();
  try {
    const sitemap = await fetchChecked(`${ORIGIN}/sitemap.xml`);
    assert.equal(sitemap.response.status, 200, `sitemap: HTTP ${sitemap.response.status}`);
    const locs = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decode(match[1]));
    const locSet = new Set(locs);
    for (const slug of THEME_SLUGS) assert(locSet.has(`${ORIGIN}/ai-image-generation/${slug}`), `sitemap missing image theme: ${slug}`);
    assert(!locs.some((loc) => loc.startsWith(`${WWW_ORIGIN}/`)), "sitemap contains a www Aidreamcapes page URL");
    assert(!locs.some((loc) => loc.includes("/tools")), "sitemap contains a /tools URL");
    for (const alias of LEGACY_SITEMAP_ALIASES) assert(!locs.includes(`${ORIGIN}${alias}`), `sitemap contains legacy alias: ${alias}`);

    const themeResults = [];
    for (const slug of THEME_SLUGS) themeResults.push(await checkThemePage(prisma, slug));
    const virtualTryOn = await fetchChecked(`${ORIGIN}/ai-image-generation/virtual-try-on`);
    assert.equal(virtualTryOn.response.status, 200, "virtual-try-on must remain published");

    for (const origin of [ORIGIN, WWW_ORIGIN]) {
      const page = await fetchChecked(`${origin}/ai-image-generation/fashion-editorial`);
      assert.equal(page.response.status, 200, `${origin}: fashion-editorial status`);
      assert.equal(canonicalFromHtml(page.html), `${ORIGIN}/ai-image-generation/fashion-editorial`, `${origin}: fashion-editorial canonical`);
    }

    for (const path of RETIRED_PATHS) {
      const { response } = await fetchChecked(`${ORIGIN}${path}`);
      assert.equal(response.status, 404, `${path}: expected 404`);
      assert.equal(response.headers.get("location"), null, `${path}: unexpected Location header`);
    }
    const stale = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-image-generation/headshot" } }, select: { id: true } });
    assert.equal(stale, null, "stale Aidreamcapes headshot LivePage still exists");
    console.log(JSON.stringify({ ok: true, origin: ORIGIN, wwwOrigin: WWW_ORIGIN, sitemapPageLocs: locs.length, themes: themeResults, retiredRoutes: RETIRED_PATHS.length, pageSpeed: "skipped" }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
