#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, buildTunneledDatabaseUrl, parseDatabaseUrl } from "./lib/database-target.mjs";

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
const BLOG_HOME_PATH = "/blog";
const BLOG_ARTICLE_PATHS = [
  "/blog/ai-product-photography-guide",
  "/blog/ai-ugc-video-ads-guide",
  "/blog/ai-talking-photo-video-guide",
  "/blog/ecommerce-product-image-workflow",
  "/blog/ai-video-review-checklist",
  "/blog/ai-content-disclosure-safe-usage",
  "/blog/video-photo-package-guide"
];
const VIDEO_TOPIC_SEO = {
  "/ai-video-generation/explainer-video": "AI Explainer Video Generator for Teams | Aidreamcapes",
  "/ai-video-generation/fashion-video": "AI Fashion Video Generator for Brands | Aidreamcapes",
  "/ai-video-generation/motion-generator": "AI Motion Generator for Product Ideas | Aidreamcapes",
  "/ai-video-generation/meme-video": "AI Meme Video Generator for Creators | Aidreamcapes",
  "/ai-video-generation/instagram-reels": "AI Instagram Reels Generator for Creators | Aidreamcapes",
  "/ai-video-generation/pet-video": "AI Pet Video Generator for Stories | Aidreamcapes",
  "/ai-video-generation/product-ad-video": "AI Product Ad Video Generator for Stores | Aidreamcapes",
  "/ai-video-generation/social-media-video": "AI Social Media Video Generator | Aidreamcapes",
  "/ai-video-generation/story-video": "AI Story Video Generator for Creators | Aidreamcapes",
  "/ai-video-generation/youtube-video": "AI YouTube Video Generator for Creators | Aidreamcapes",
  "/ai-video-generation/tiktok-video": "AI TikTok Video Generator for Creators | Aidreamcapes",
  "/ai-video-generation/talking-head-video": "AI Talking Head Video Generator | Aidreamcapes"
};
const VIDEO_DESCRIPTION_SEO = {
  "/ai-video-generation/brand-video": "Create AI brand videos for founder stories, product origins, company values, and campaigns with guided scenes, clear messaging, and review-ready outputs.",
  "/ai-video-generation/talking-photo": "Create talking-photo videos from an approved portrait and short script for messages, explainers, product pitches, and social intros, with clear review steps.",
  "/ai-video-generation/video-ad": "Create AI video ads for paid social, product launches, retargeting, and creator-style campaigns with a focused hook, proof, CTA, and review workflow."
};
const SEO_QUALITY_EXPECTATIONS = {
  "/marketing": { title: "AI Marketing Workflows for Ecommerce | Aidreamcapes" },
  "/ai-image-generation/fashion-editorial": { description: "Create AI fashion editorial images for lookbooks, product launches, campaigns, and social content with guided styling and review-ready outputs." },
  "/ai-image-generation/feed-ad-still": { description: "Create AI feed ad images for product launches, paid social, and ecommerce campaigns with a clear hook, product proof, and review-ready framing." },
  "/ai-image-generation/jewelry-positioning": { description: "Create AI jewelry positioning images for ecommerce, catalogs, and social campaigns with controlled placement and review-ready product detail." },
  "/ai-image-generation/colorway-variations": { description: "Create AI product color variations for ecommerce listings, catalogs, and campaigns while keeping the product shape, materials, and details ready for review." },
  "/ai-image-generation/carousel-set": { description: "Create AI carousel ad images for ecommerce and social campaigns with a consistent product story, clear sequence, and review-ready visuals for every slide." },
  "/ai-image-generation/enhance-upscale": { description: "Enhance soft, dark, or compressed product and portrait images with AI before using them in listings, profiles, campaigns, or private creative workflows." },
  "/ai-image-generation/packaging-mockup": { description: "Create AI packaging mockups for product launches, ecommerce pages, and campaign concepts with clear proportions, readable structure, and review-ready visuals." },
  "/ai-image-generation/bundle-sets": { description: "Create AI product bundle images for ecommerce listings, promotions, and catalogs with clear item grouping, consistent scale, and review-ready composition." },
  "/ai-image-generation/on-model-generation": { description: "Create AI on-model product images for ecommerce, fashion campaigns, and social content with guided styling, clear product placement, and review-ready results." },
  "/ai-image-generation/background-remove-replace": { description: "Remove or replace photo backgrounds with AI for products, portraits, listings, and campaigns while preserving subject edges, scale, and review-ready detail." },
  "/ai-image-generation/commercial-lighting": { description: "Create AI commercial lighting images for product pages, catalogs, and campaigns with controlled highlights, clear material detail, and review-ready composition." },
  "/ai-image-generation/story-ad-vertical": { description: "Create AI vertical story ad images for mobile campaigns, product launches, and social promotions with a clear hook, readable framing, and review-ready visuals." },
  "/ai-image-generation/macro-details": { description: "Create AI macro product detail images for ecommerce pages, catalogs, and campaigns with close-up material focus, controlled framing, and review-ready results." },
  "/ai-image-generation/team-directory": { description: "Create AI team directory portraits for company pages, staff profiles, and internal communications with consistent framing and review-ready results." },
  "/ai-video-generation/founder-update": { description: "Create AI founder update videos from an approved portrait, product image, or short message with clear pacing, reviewable claims, and a publishing workflow." },
  "/ai-video-generation/how-to-video": { description: "Create AI how-to videos from approved images and steps for tutorials, demonstrations, and training with clear sequencing and review before publishing." },
  "/ai-video-generation/local-service-ad": { description: "Create AI local service ad videos with an offer, service area, proof, and CTA while keeping contact details and claims under your control before publishing." },
  "/ai-video-generation/multilingual-video": { description: "Create AI multilingual videos from approved source material with reviewable pronunciation, subtitles, timing, names, and final messaging for each audience." },
  "/ai-video-generation/home-organization": { description: "Create AI home organization videos that show a space, the change, and useful steps with clear continuity, practical context, and review before sharing." },
  "/blog/ai-talking-photo-video-guide": { description: "Use this AI talking photo guide to plan portraits, scripts, consent, disclosure, review steps, and publishing choices before sharing a generated video." }
};
const THEME_SLUGS = [
  "ecommerce-main-image", "lifestyle-scene", "packshot-multi-angle", "macro-details", "bundle-sets", "size-reference", "feature-infographic", "comparison-chart",
  "feed-ad-still", "ugc-still-ad", "story-ad-vertical", "carousel-set", "sale-campaign-key-visual", "lookbook-cover",
  "on-model-generation", "virtual-try-on", "hair-makeup-preview", "jewelry-positioning", "ghost-mannequin", "colorway-variations",
  "background-remove-replace", "enhance-upscale", "old-photo-restore", "commercial-lighting", "packaging-mockup",
  "professional-headshot", "creator-portrait", "team-directory", "social-profile-photo", "fashion-editorial"
];
const RETIRED_PATHS = [
  "/collections",
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
  "/ai-image-generation/unblur-image",
  "/ai-image-generation/best-themes-presets",
  "/ai-image-generation/lifestyle-creative",
  "/ai-image-generation/magic",
  "/ai-image-generation/photo-tools",
  "/ai-image-generation/professional"
];
const LEGACY_SITEMAP_ALIASES = [
  "christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day", "valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony"
].map((slug) => `/ai-video-generation/${slug}`);
const LEGACY_AIDREAMCAPES_MEDIA_RE = /\/assets\/sites\/site_aidreamcapes\/(?:creative-packs|fan-holiday-theme)(?:\/|$)/i;
const LEGACY_GALLERY_REDIRECTS = new Map([
  ["/best-ai-image", "/ai-image-generation"],
  ["/best-ai-video", "/ai-video-generation"],
  ["/best-packages", "/ai-image-generation"]
]);

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

function ensureSmokeDatabaseTarget() {
  if (DB_TARGET !== "production") return;
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if ((current.database === "dingyue_local" || current.port === 15433) && process.env.REMOTE_DB_DATABASE_URL) {
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
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

function jsonLdScriptMatches(html) {
  return [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
}

function jsonLdBlocks(html) {
  const matches = jsonLdScriptMatches(html);
  assert.equal(matches.length, 1, "source HTML must contain exactly one JSON-LD script");
  const headOpen = html.search(/<head\b[^>]*>/i);
  const headClose = html.search(/<\/head>/i);
  assert(headOpen >= 0 && headClose > headOpen, "source HTML head is missing");
  const scriptIndex = matches[0].index ?? -1;
  assert(scriptIndex > headOpen && scriptIndex < headClose, "JSON-LD must be emitted inside <head>");
  const openingTag = matches[0][0].slice(0, matches[0][0].indexOf(">") + 1);
  assert(!/data-storefront-json-ld=["']body-marker["']/i.test(openingTag), "JSON-LD body marker must not remain in source HTML");
  assert(!/<script\b[^>]*type=["']application\/ld\+json["']/i.test(html.slice(headClose)), "source HTML must not contain a body JSON-LD duplicate");
  return matches
    .map((match) => {
      try {
        return JSON.parse(match[1] || "");
      } catch (error) {
        throw new Error(`Invalid source JSON-LD: ${error.message}`);
      }
    });
}

function bodyJsonLd(html) {
  return JSON.stringify(jsonLdBlocks(html));
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
  assert(!LEGACY_AIDREAMCAPES_MEDIA_RE.test(html), `${path}: legacy Aidreamcapes media residual found in HTML`);
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

function titleText(html) {
  return decode((html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]).replace(/<[^>]+>/g, "").trim();
}

function metaDescription(html) {
  const tag = (html.match(/<meta\b[^>]*name=["']description["'][^>]*>/i) || [""])[0];
  return attr(tag, "content");
}

function visibleWordCount(html) {
  return decode(visibleHtml(html).replace(/<[^>]+>/g, " ")).split(/\s+/).filter(Boolean).length;
}

function contactContentWordCount(html) {
  const mainHtml = (html.match(/<main\b[\s\S]*?<\/main>/i) || [html])[0];
  const heroHtml = (mainHtml.match(/<section\b[^>]*data-aidreamcapes-public-section=["']hero["'][\s\S]*?<\/section>/i) || [""])[0];
  const policyHtml = (mainHtml.match(/<section\b[^>]*data-aidreamcapes-public-section=["']policy["'][\s\S]*?<\/section>/i) || [""])[0];
  const policyText = decode(visibleHtml(policyHtml).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const marker = "How to contact Aidreamcapes";
  const firstMarker = policyText.indexOf(marker);
  const secondMarker = firstMarker < 0 ? -1 : policyText.indexOf(marker, firstMarker + marker.length);
  const firstResponsiveCopy = secondMarker > 0 ? policyText.slice(0, secondMarker) : policyText;
  const text = `${decode(visibleHtml(heroHtml).replace(/<[^>]+>/g, " "))} ${firstResponsiveCopy}`;
  return text.split(/\s+/).filter(Boolean).length;
}

async function assertInternalLinks200(hrefs, context) {
  const unique = [...new Set(hrefs.filter((href) => href && href.startsWith("/") && !href.startsWith("//")))];
  await Promise.all(unique.map(async (href) => {
    const { response } = await fetchChecked(`${REQUEST_ORIGIN}${href}`);
    assert.equal(response.status, 200, `${context}: internal link ${href} returned ${response.status}`);
  }));
  return unique.length;
}

async function checkSeoQualityPage(path, expected) {
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  if (expected.title) {
    assert.equal(titleText(html), expected.title, `${path}: title mismatch`);
    assert(expected.title.length <= 60, `${path}: title exceeds 60 characters`);
  }
  if (expected.description) {
    assert.equal(metaDescription(html), expected.description, `${path}: description mismatch`);
    assert(expected.description.length >= 140 && expected.description.length <= 160, `${path}: description length ${expected.description.length} is outside 140-160`);
    assert(bodyJsonLd(html).includes(expected.description), `${path}: JSON-LD description mismatch`);
  }
  return { path, titleLength: titleText(html).length, descriptionLength: metaDescription(html).length };
}

async function checkContactAndPolicies() {
  const contact = await fetchChecked(`${REQUEST_ORIGIN}/contact-us`);
  assert.equal(contact.response.status, 200, "/contact-us: HTTP status");
  assertSeoContract("/contact-us", contact.html);
  const contactWords = contactContentWordCount(contact.html);
  assert(contactWords >= 350 && contactWords <= 500, `/contact-us: visible word count ${contactWords} is outside 350-500`);
  const contactLinks = ["/privacy", "/terms", "/refunds", "/content"];
  for (const href of contactLinks) assert(contact.html.includes(`href="${href}"`), `/contact-us: missing ${href} link`);
  const policyResults = [];
  for (const path of ["/content", "/children-privacy", "/cookies", "/digital-delivery", "/state-privacy", "/refunds"]) {
    const page = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
    assert.equal(page.response.status, 200, `${path}: HTTP status`);
    assertSeoContract(path, page.html);
    assertHeadingHierarchy(path, page.html);
    assert(!/<h1\b[^>]*>[\s\S]*?<\/h1>[\s\S]*?<h3\b/i.test(page.html), `${path}: H1 to H3 jump remains`);
    policyResults.push(path);
  }
  return { contactWords, policies: policyResults };
}

function relatedToolHrefs(html) {
  const mainHtml = (html.match(/<main\b[\s\S]*?<\/main>/i) || [html])[0];
  return new Set([...mainHtml.matchAll(/\bhref=["'](\/ai-(?:image|video)-generation\/[^"']+)["']/gi)].map((match) => match[1].split(/[?#]/, 1)[0]));
}

async function checkBlogHome(prisma) {
  const path = BLOG_HOME_PATH;
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  assert.equal(titleText(html), "AI Ecommerce, UGC & Talking Photo Guides | Aidreamcapes", `${path}: stale SEO title`);
  assert.equal(metaDescription(html), "Practical guides for AI product photography, UGC video ads, talking photos, ecommerce workflows, video review, and safe AI content publishing.", `${path}: stale SEO description`);
  assert(/AI guides for ecommerce images, UGC video, and talking photos/i.test(visibleHtml(html)), `${path}: updated H1 missing`);
  assert(!/private albums|AI photo packages/i.test(titleText(html)), `${path}: stale private-album positioning in title`);
  assert.equal((BLOG_ARTICLE_PATHS.filter((articlePath) => html.includes(`href="${articlePath}"`)).length), BLOG_ARTICLE_PATHS.length, `${path}: not all content-cluster articles are linked`);

  const dbPage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: path } }, select: { title: true, contentJson: true } });
  assert(dbPage, `${path}: LivePage missing`);
  assert.equal(dbPage.title, "AI image and video guides", `${path}: SQL title is stale`);
  assert.equal(dbPage.contentJson?.seo?.title, "AI Ecommerce, UGC & Talking Photo Guides | Aidreamcapes", `${path}: SQL SEO title is stale`);
  assert.equal(dbPage.contentJson?.seo?.description, "Practical guides for AI product photography, UGC video ads, talking photos, ecommerce workflows, video review, and safe AI content publishing.", `${path}: SQL SEO description is stale`);
  return { path, articleLinks: BLOG_ARTICLE_PATHS.length };
}

async function checkBlogArticle(prisma, path) {
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  const serializedJsonLd = JSON.stringify(jsonLdBlocks(html));
  assert(/BlogPosting/.test(serializedJsonLd), `${path}: BlogPosting JSON-LD missing`);
  for (const field of ["author", "datePublished", "dateModified", "image"]) {
    assert(new RegExp(`"${field}"\\s*:\\s*(?:\\{|\\[|"[^"].*?"|https?://)`, "i").test(serializedJsonLd), `${path}: BlogPosting ${field} missing`);
  }
  assert(relatedToolHrefs(html).size >= 3, `${path}: fewer than three related tool links`);
  const dbPage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: path } }, select: { pageType: true, templateKey: true, contentJson: true } });
  assert(dbPage, `${path}: LivePage missing`);
  assert.equal(dbPage.pageType, "article", `${path}: pageType mismatch`);
  assert.equal(dbPage.templateKey, "blog-detail", `${path}: templateKey mismatch`);
  const settings = dbPage.contentJson?.sections?.blog_detail_1?.settings;
  assert(settings, `${path}: article settings missing`);
  assert.equal(settings.author, "Aidreamcapes editorial team", `${path}: author mismatch`);
  assert(settings.publishedAt && settings.updatedAt, `${path}: publication dates missing`);
  assert(Array.isArray(settings.relatedLinks) && settings.relatedLinks.length >= 3, `${path}: SQL related links missing`);
  return { path, relatedToolLinks: relatedToolHrefs(html).size };
}

async function checkVideoTopicPage(path, expectedTitle) {
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  assert.equal(titleText(html), expectedTitle, `${path}: video topic title is not scoped to Aidreamcapes`);
  const description = metaDescription(html);
  assert(description.length >= 140 && description.length <= 160, `${path}: video topic description length ${description.length} is outside 140-160`);
  const serializedJsonLd = JSON.stringify(jsonLdBlocks(html));
  assert(serializedJsonLd.includes(expectedTitle), `${path}: JSON-LD does not use the scoped video topic title`);
  assert(serializedJsonLd.includes(description), `${path}: JSON-LD does not use the scoped video topic description`);
  return { path, titleLength: expectedTitle.length, descriptionLength: description.length };
}

async function checkVideoDescriptionPage(path, expectedDescription) {
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  assert.equal(metaDescription(html), expectedDescription, `${path}: description override mismatch`);
  assert(expectedDescription.length >= 140 && expectedDescription.length <= 160, `${path}: description length ${expectedDescription.length} is outside 140-160`);
  const serializedJsonLd = JSON.stringify(jsonLdBlocks(html));
  assert(serializedJsonLd.includes(expectedDescription), `${path}: JSON-LD does not use the scoped description`);
  return { path, descriptionLength: expectedDescription.length };
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
  const themeSection = Object.values(dbPage.contentJson?.sections ?? {}).find((section) => section?.type === "ai_image_theme_landing");
  const relatedLinks = Array.isArray(themeSection?.settings?.content?.internalLinks) ? themeSection.settings.content.internalLinks : [];
  assert(relatedLinks.length >= 3, `${path}: SQL related links missing`);
  const relatedHrefs = relatedLinks.map((link) => String(link.href || "")).filter(Boolean);
  assert.equal(new Set(relatedHrefs).size, relatedHrefs.length, `${path}: duplicate related links`);
  assert(!relatedHrefs.some((href) => /collections|\/tools(?:\/|$)/i.test(href)), `${path}: retired related route found`);

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
  for (const href of relatedHrefs) assert(html.includes(`href="${href}"`), `${path}: related link not rendered: ${href}`);
  const checkedRelatedLinks = await assertInternalLinks200(relatedHrefs, path);
  return { path, mediaCount: manifest.length, imageTagCount: tags.length, relatedLinks: checkedRelatedLinks, mediaUrls: manifest.map((media) => mediaUrlForOrigin(media.src)) };
}

async function checkImageDirectory() {
  const path = "/ai-image-generation";
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  const jsonLd = bodyJsonLd(html);
  const legacyDirectoryResidual = /\/assets\/sites\/site_aidreamcapes\/creative-packs|christmas photo|background remover|magic eraser|premiere-style-portraits|\/ai-image-generation\/(?:headshot|avatar|portrait-photo|unblur-image)/i;
  assert(!legacyDirectoryResidual.test(html), `${path}: legacy CreativePack/category residual found in HTML`);
  assert(!legacyDirectoryResidual.test(jsonLd), `${path}: legacy CreativePack/category residual found in JSON-LD`);
  assert(jsonLd.includes('"@type":"CollectionPage"') || jsonLd.includes('"@type": "CollectionPage"'), `${path}: clean CollectionPage JSON-LD missing`);
  assert(jsonLd.includes('"@type":"ItemList"') || jsonLd.includes('"@type": "ItemList"'), `${path}: clean ItemList JSON-LD missing`);
  for (const slug of THEME_SLUGS) {
    assert(html.includes(`/ai-image-generation/${slug}`), `${path}: current image theme missing: ${slug}`);
    assert(jsonLd.includes(`/ai-image-generation/${slug}`), `${path}: current image theme missing from JSON-LD: ${slug}`);
  }
  const guideLinks = [
    "/blog/ai-product-photography-guide",
    "/blog/ecommerce-product-image-workflow",
    "/blog/ai-content-disclosure-safe-usage"
  ];
  for (const href of guideLinks) assert(html.includes(`href="${href}"`), `${path}: missing guide link ${href}`);
  const checkedGuideLinks = await assertInternalLinks200(guideLinks, path);
  return { path, themeCount: THEME_SLUGS.length, guideLinks: checkedGuideLinks };
}

async function checkVideoDirectory() {
  const path = "/ai-video-generation";
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  const guideLinks = [
    "/ai-video-generation/brand-video",
    "/ai-video-generation/video-ad",
    "/ai-video-generation/talking-photo",
    "/blog/ai-ugc-video-ads-guide"
  ];
  for (const href of guideLinks) assert(html.includes(`href="${href}"`), `${path}: missing guide link ${href}`);
  const checkedGuideLinks = await assertInternalLinks200(guideLinks, path);
  return { path, guideLinks: checkedGuideLinks };
}

async function checkFaq(prisma) {
  const path = "/faq";
  const { response, html } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  assertSeoContract(path, html);
  const expectedLinks = ["/ai-image-generation", "/ai-video-generation", "/blog/ai-content-disclosure-safe-usage"];
  for (const href of expectedLinks) assert(html.includes(`href="${href}"`), `${path}: missing related link ${href}`);
  const dbPage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: path } }, select: { contentJson: true } });
  assert(dbPage, `${path}: LivePage missing`);
  const introLinks = dbPage.contentJson?.sections?.intro_1?.settings?.relatedLinks;
  assert(Array.isArray(introLinks) && introLinks.length >= 3, `${path}: SQL related links missing`);
  const checkedRelatedLinks = await assertInternalLinks200(expectedLinks, path);
  return { path, relatedLinks: checkedRelatedLinks };
}

async function main() {
  ensureSmokeDatabaseTarget();
  assertDatabaseTarget({ expectedTarget: DB_TARGET });
  const prisma = new PrismaClient();
  try {
    const sitemap = await fetchChecked(`${REQUEST_ORIGIN}/sitemap.xml`);
    assert.equal(sitemap.response.status, 200, `sitemap: HTTP ${sitemap.response.status}`);
    const locs = [...sitemap.html.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => decode(match[1]));
    const locSet = new Set(locs);
    for (const slug of THEME_SLUGS) assert(locSet.has(`${ORIGIN}/ai-image-generation/${slug}`), `sitemap missing image theme: ${slug}`);
    assert(locSet.has(`${ORIGIN}${BLOG_HOME_PATH}`), "sitemap missing blog home");
    for (const path of BLOG_ARTICLE_PATHS) assert(locSet.has(`${ORIGIN}${path}`), `sitemap missing content-cluster article: ${path}`);
    assert(!locs.some((loc) => loc.startsWith(`${WWW_ORIGIN}/`)), "sitemap contains a www Aidreamcapes page URL");
    assert(!locs.some((loc) => loc.includes("/tools")), "sitemap contains a /tools URL");
    for (const alias of LEGACY_SITEMAP_ALIASES) assert(!locs.includes(`${ORIGIN}${alias}`), `sitemap contains legacy alias: ${alias}`);
    for (const path of GONE_PATHS) assert(!locs.includes(`${ORIGIN}${path}`), `sitemap contains gone URL: ${path}`);
    assert(!locs.some((loc) => loc.includes("premiere-style-portraits")), "sitemap contains the stale premiere route");
    assert(!locs.includes(`${ORIGIN}/collections`), "sitemap contains retired /collections alias");

    if (!SKIP_ROBOTS) {
      const robots = await fetchChecked(`${REQUEST_ORIGIN}/robots.txt`);
      assert.equal(robots.response.status, 200, `robots.txt: HTTP ${robots.response.status}`);
      assert(robots.html.includes(`Sitemap: ${ORIGIN}/sitemap.xml`), "robots.txt does not point to the non-www sitemap");
    }

    const blogHomeResult = await checkBlogHome(prisma);
    const blogArticleResults = [];
    for (const path of BLOG_ARTICLE_PATHS) blogArticleResults.push(await checkBlogArticle(prisma, path));
    const videoTopicResults = [];
    for (const [path, expectedTitle] of Object.entries(VIDEO_TOPIC_SEO)) videoTopicResults.push(await checkVideoTopicPage(path, expectedTitle));
    const videoDescriptionResults = [];
    for (const [path, expectedDescription] of Object.entries(VIDEO_DESCRIPTION_SEO)) videoDescriptionResults.push(await checkVideoDescriptionPage(path, expectedDescription));
    const seoQualityResults = [];
    for (const [path, expected] of Object.entries(SEO_QUALITY_EXPECTATIONS)) seoQualityResults.push(await checkSeoQualityPage(path, expected));
    const imageDirectoryResult = await checkImageDirectory();
    const videoDirectoryResult = await checkVideoDirectory();
    const faqResult = await checkFaq(prisma);
    const contactPolicyResult = await checkContactAndPolicies();

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
    assert(!LEGACY_AIDREAMCAPES_MEDIA_RE.test(sitemap.html), "sitemap contains retired Aidreamcapes media paths");
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
    for (const [path, targetPath] of LEGACY_GALLERY_REDIRECTS) {
      const { response } = await fetchChecked(`${REQUEST_ORIGIN}${path}`);
      assert.equal(response.status, 301, `${path}: expected legacy gallery redirect`);
      assert.equal(response.headers.get("location"), `${ORIGIN}${targetPath}`, `${path}: redirect target mismatch`);
    }
    for (const path of ["/ai-image-generation", "/ai-video-generation", "/blog", "/workflow"]) {
      const { response } = await fetchChecked(`${REQUEST_ORIGIN}${path}/`);
      assert.equal(response.status, 301, `${path}/: expected trailing-slash redirect`);
      assert.equal(response.headers.get("location"), `${ORIGIN}${path}`, `${path}/: trailing-slash target mismatch`);
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
    console.log(JSON.stringify({ ok: true, origin: ORIGIN, wwwOrigin: WWW_ORIGIN, sitemapPageLocs: locs.length, sitemapImageLocs: sitemapImageUrls.length, checkedImageCount, contentCluster: { blogHome: blogHomeResult, articles: blogArticleResults }, seoQuality: seoQualityResults, videoTopics: videoTopicResults, videoDescriptions: videoDescriptionResults, imageDirectory: imageDirectoryResult, videoDirectory: videoDirectoryResult, faq: faqResult, contactPolicy: contactPolicyResult, themes: themeResults.map(({ mediaUrls: _mediaUrls, ...result }) => result), retiredRoutes: RETIRED_PATHS.length, goneRoutes: GONE_PATHS.length, pageSpeed: "skipped" }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
