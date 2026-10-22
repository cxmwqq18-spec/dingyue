#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { request } from "playwright";
import { nearSlugCandidates } from "./lib/aidreamcapes-near-slug-rules.mjs";

const BASE_URL = String(process.env.AIDREAMCAPES_SEO_ORIGIN || "http://127.0.0.1:3002").replace(/\/$/, "");
const MEDIA_BASE_URL = String(process.env.AIDREAMCAPES_SEO_MEDIA_ORIGIN || BASE_URL).replace(/\/$/, "");
// The Aidreamcapes release candidate is checked before its guarded LivePage
// path migration. In that one phase, validate the existing SSR surface and
// redirects while leaving the renamed rows for the post-switch readback.
const preNavigationMigration = process.env.AIDREAMCAPES_SEO_PRE_NAV_MIGRATION === "1";
const SITE_HEADERS = {
  "x-forwarded-host": "www.aivideosugc.com",
  "x-forwarded-proto": "https"
};
// Aidreamcapes.com v2 retires v1 URLs with 301 redirects (applied by the middleware).
const SITE_V2_REDIRECTS = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-site-v2-redirects.json", import.meta.url), "utf8"));
const SITE_V2_NEAR_SLUGS = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-site-v2-near-slugs.json", import.meta.url), "utf8"));
const SITE_V2_REDIRECT_SOURCES = new Set(SITE_V2_REDIRECTS.map(([from]) => from));
const SITE_V2_REDIRECT_TARGETS = new Set(SITE_V2_REDIRECTS.map(([, to]) => to));
const SITE_V2_TARGET_PATHS = [
  "/ai-video-generation",
  "/ai-video-generation/url-to-video",
  "/ai-video-generation/video-ads",
  "/ai-video-generation/product-video",
  "/ai-video-generation/before-after-video",
  "/ai-video-generation/spokesperson-video",
  "/ai-video-generation/text-to-video",
  "/ai-video-generation/ai-twin",
  "/ai-image-generation",
  "/ai-image-generation/white-background-photos",
  "/ai-image-generation/lifestyle-photos",
  "/ai-image-generation/model-photos",
  "/ai-image-generation/change-background",
  "/ai-image-generation/social-ad-photos",
  "/templates",
  "/industries/beauty-skincare",
  "/platforms/tiktok-ads",
  "/guides",
  "/blog",
  "/inspiration",
  "/trust-and-safety",
  "/ai-info",
  "/about-us",
  "/contact-us",
  "/faq",
  "/pricing",
  "/children-privacy",
  "/content",
  "/privacy",
  "/refunds",
  "/state-privacy",
  "/terms"
];
const V1_TARGET_PATHS = [
  "/ai-video-generation/multilingual-video",
  "/ai-video-generation/music-video",
  "/blog/ai-talking-photo-video-guide",
  "/ai-image-generation/ecommerce-main-image",
  "/ai-image-generation/lifestyle-scene",
  "/children-privacy",
  "/contact-us",
  "/content",
  "/creators-circle",
  "/faq",
  "/pricing",
  "/privacy",
  "/refunds",
  "/state-privacy",
  "/terms",
  "/workflow"
];

function htmlTitle(html) {
  return load(html)("title").first().text().trim();
}

function htmlMeta(html, name) {
  return load(html)(`meta[name="${name}"]`).attr("content")?.trim() || "";
}

function htmlCanonical(html) {
  return load(html)('link[rel="canonical"]').attr("href")?.trim() || "";
}

function h1Count(html) {
  return load(html)("h1").length;
}

function parseJsonLd(html) {
  const $ = load(html);
  return $('script[type="application/ld+json"]').toArray().map((node) => JSON.parse($(node).text()));
}

function flattenJsonLd(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  return [value, ...(Array.isArray(value["@graph"]) ? value["@graph"].flatMap(flattenJsonLd) : [])];
}

function imageKey(value, base = "https://www.aivideosugc.com/") {
  const url = new URL(value, base);
  if (url.pathname === "/_next/image") return imageKey(url.searchParams.get("url"), base);
  return `${url.origin}${decodeURIComponent(url.pathname)}`;
}

function pageImageKeys(html, url) {
  const $ = load(html);
  const values = [];
  $("img,source,video,[style]").each((_, node) => {
    for (const attr of ["src", "poster", "data-src"]) {
      const value = $(node).attr(attr);
      if (value && !value.startsWith("data:")) values.push(value);
    }
    for (const attr of ["srcset", "data-srcset"]) {
      for (const part of ($(node).attr(attr) || "").split(",")) {
        const value = part.trim().split(/\s+/)[0];
        if (value && !value.startsWith("data:")) values.push(value);
      }
    }
    for (const match of ($(node).attr("style") || "").matchAll(/url\(["']?([^)'"\s]+)["']?\)/g)) values.push(match[1]);
  });
  return new Set(values.map((value) => imageKey(value, url)));
}

async function mapLimit(items, limit, worker) {
  const results = [];
  let nextIndex = 0;
  async function consume() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, consume));
  return results;
}

const http = await request.newContext({ extraHTTPHeaders: SITE_HEADERS, timeout: 60000 });

async function getUrl(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await http.get(url, { maxRedirects: 0, maxRetries: 2, ...options });
    if (![429, 502, 503, 504, 522, 524].includes(response.status()) || attempt === 2) return response;
    await response.dispose();
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}
const get = (path, options) => getUrl(`${BASE_URL}${path}`, options);

function requestUrlFromSitemap(value) {
  const url = new URL(value);
  return `${BASE_URL}${url.pathname}${url.search}`;
}

const homepage = await get("/");
assert.equal(homepage.status(), 200, `homepage status: ${homepage.status()}`);
// The TLS terminator owns HSTS, and only the public origin reaches it. A
// loopback run talks to the application directly, so the header is required on
// the public origin and reported as edge-owned here instead of passing silently.
const publicOrigin = new URL(BASE_URL).hostname === "www.aivideosugc.com";
const edgeOwnedChecks = [];
if (publicOrigin) {
  assert.equal(homepage.headers()["strict-transport-security"], "max-age=31536000; includeSubDomains", "Aidreamcapes HSTS header");
} else {
  edgeOwnedChecks.push("HSTS is served by the TLS terminator and is required on the public origin");
}
assert.equal(homepage.headers()["x-content-type-options"], "nosniff", "content type protection");
assert(homepage.headers()["referrer-policy"], "referrer policy missing");
assert(homepage.headers()["x-frame-options"], "frame protection missing");
const homepageHtml = await homepage.text();
const homepageDom = load(homepageHtml);
// The v2 storefront is live once the v2 LivePage rows and navigation are in the database.
// Before that (for example while a new release is checked against current data) the v1
// pages are still served and only redirected v1 paths are skipped.
const siteV2 = homepageDom('main[data-aidreamcapes-v2="true"]').length > 0;
const TARGET_PATHS = siteV2
  ? preNavigationMigration
    ? SITE_V2_TARGET_PATHS.filter((path) => !SITE_V2_REDIRECT_SOURCES.has(path) && !SITE_V2_REDIRECT_TARGETS.has(path))
    : SITE_V2_TARGET_PATHS
  : V1_TARGET_PATHS.filter((path) => !SITE_V2_REDIRECT_SOURCES.has(path));
const bodyMarkers = homepageDom('body script[data-storefront-json-ld="body-marker"]');
assert(bodyMarkers.length > 0, "JSON-LD body markers must remain present for React hydration");
assert(bodyMarkers.toArray().every((node) => homepageDom(node).attr("type") === "application/json"), "body markers must be inert JSON, not duplicate structured data");
assert.equal(htmlCanonical(homepageHtml), "https://www.aivideosugc.com/", "homepage canonical");
assert.equal((homepageHtml.match(/<link\b[^>]*\brel=["']alternate["']/gi) || []).length, 0, "single-language .com must not invent hreflang");
assert.doesNotMatch(homepageHtml, /engagement-photo image|An intimate engagement announcement/i, "stale homepage image sitemap copy");
const homepageNodes = flattenJsonLd(parseJsonLd(homepageHtml));
const homepageApplication = homepageNodes.find((node) => node["@type"] === "SoftwareApplication" && /#app$/.test(String(node["@id"] || "")));
const homepageOrganization = homepageNodes.find((node) => node["@type"] === "Organization");
const homepageCatalog = homepageNodes.find((node) => node["@type"] === "OfferCatalog") ?? homepageOrganization?.hasOfferCatalog;
assert.equal(homepageApplication?.applicationCategory, "MultimediaApplication", "homepage application category");
assert.equal(homepageCatalog?.name, "AIVideosUGC AI image and video plans", "homepage OfferCatalog name");
assert(Array.isArray(homepageApplication?.offers) && homepageApplication.offers.every((offer) => offer["@type"] === "Offer"), "application offers must not be an OfferCatalog");
// The apex host and the former aidreamcapes.com addresses move permanently to https://www.aivideosugc.com.
const OTHER_HOSTS = [["apex", "aivideosugc.com", "https"], ["former", "aidreamcapes.com", "https"], ["former-www", "www.aidreamcapes.com", "https"], ["http", "www.aivideosugc.com", "http"]];
for (const [variant, host, protocol] of OTHER_HOSTS) {
  const response = publicOrigin
    ? await http.get(`${protocol}://${host}/pricing?seo_contract=1`, { maxRedirects: 0 })
    : await get("/pricing?seo_contract=1", { headers: { "x-forwarded-host": host, "x-forwarded-proto": protocol } });
  assert.equal(response.status(), 301, `${variant}: canonical redirect status`);
  assert.equal(response.headers().location, "https://www.aivideosugc.com/pricing?seo_contract=1", `${variant}: redirect preserves path and query`);
}
for (const [from, to] of SITE_V2_REDIRECTS) {
  const response = await get(`${from}?seo_contract=1`);
  assert.equal(response.status(), 301, `${from}: v2 redirect status`);
  assert.equal(response.headers().location, `https://www.aivideosugc.com${to}?seo_contract=1`, `${from}: v2 redirect target`);
  await response.dispose();
}
if (siteV2) {
  const llms = await get("/llms.txt");
  assert.equal(llms.status(), 200, `llms.txt status: ${llms.status()}`);
  assert.match(llms.headers()["content-type"] || "", /^text\/plain/, "llms.txt content type");
  assert.match(await llms.text(), /^# (?:AIVideosUGC|Aidreamcapes)/m, "llms.txt heading");
  assert(homepageDom('header.site nav#adc2-main-nav a[href="/pricing"]').length > 0, "v2 header navigation");
  assert(homepageDom('footer.site a[href="/privacy"]').length > 0, "v2 footer legal links");
  for (const path of ["/ai-image-generation", "/templates/photo", "/templates/video"]) {
    const response = await get(path);
    assert.equal(response.status(), 200, `${path}: current v2 page status`);
    const html = await response.text();
    assert.match(html, /<nav[^>]*id=["']adc2-main-nav["']/i, `${path}: current v2 navigation must render`);
    assert.match(html, /href=["']\/pricing["']/i, `${path}: current pricing link must render`);
    // Stored v2 page graphs carry no breadcrumb node; the renderer must derive it.
    const v2Nodes = flattenJsonLd(parseJsonLd(html));
    assert(
      v2Nodes.some((node) => node["@type"] === "BreadcrumbList" && Array.isArray(node.itemListElement) && node.itemListElement.length >= 2),
      `${path}: stored v2 graph must publish a derived BreadcrumbList`
    );
    assert.match(htmlMeta(html, "robots"), /max-image-preview:\s*large/i, `${path}: robots must allow large image previews`);
  }
  if (!preNavigationMigration) {
    const headerLinks = homepageDom("header.site a").toArray().map((node) => ({
      href: homepageDom(node).attr("href"),
      text: homepageDom(node).text().replace(/\s+/g, " ").trim()
    }));
    for (const [label, href] of [
      ["Video Ads", "/ai-video-generation/video-ads"],
      ["Product Video", "/ai-video-generation/product-video"],
      ["Before & After Video", "/ai-video-generation/before-after-video"],
      ["Spokesperson Video", "/ai-video-generation/spokesperson-video"],
      ["Text to Video", "/ai-video-generation/text-to-video"],
      ["AI Twin", "/ai-video-generation/ai-twin"],
      ["White Background Photos", "/ai-image-generation/white-background-photos"],
      ["Lifestyle Photos", "/ai-image-generation/lifestyle-photos"],
      ["Model Photos", "/ai-image-generation/model-photos"],
      ["Change Background", "/ai-image-generation/change-background"],
      ["Social Ad Photos", "/ai-image-generation/social-ad-photos"],
      ["Templates", "/templates"]
    ]) {
      // Labels are page-owned copy: the Templates entry now reads
      // "See all 18 templates →", so match the route word case-insensitively
      // instead of pinning one exact string.
      assert(
        headerLinks.some((link) => link.href === href && link.text.toLowerCase().includes(label.toLowerCase())),
        `header ${label} route`
      );
    }
    const headerMenuLabels = homepageDom("header.site nav#adc2-main-nav button").toArray().map((node) => homepageDom(node).text().trim());
    assert(headerMenuLabels.includes("Image"), "Image menu label");
    assert(!headerLinks.some((link) => ["/text-to-video", "/ai-twin"].includes(link.href)), "Video directory routes include the video generation level");
  }
  // The company named in the Organization structured data is also visible on the page: in the
  // footer of every page, and in the main content of the About and Contact pages.
  const company = homepageOrganization ?? {};
  const companyFacts = [["legal name", company.legalName], ["phone", company.telephone], ["street address", company.address?.streetAddress]].filter(([, value]) => value);
  const footerText = homepageDom("footer.site").text();
  for (const [label, value] of companyFacts) assert(footerText.includes(value), `footer shows the company ${label} from the structured data: ${value}`);
  for (const path of ["/about-us", "/contact-us"]) {
    const response = await get(path);
    assert.equal(response.status(), 200, `${path} status`);
    const mainText = load(await response.text())("main").text();
    for (const [label, value] of companyFacts) assert(mainText.includes(value), `${path} shows the company ${label}: ${value}`);
  }
}
const robotsResponse = await get("/robots.txt");
assert.equal(robotsResponse.status(), 200, "robots.txt status");
const robotsText = await robotsResponse.text();
if (publicOrigin) {
  assert.match(robotsText, /Sitemap:\s*https:\/\/www\.aivideosugc\.com\/sitemap\.xml/i, "robots sitemap declaration");
  assert.doesNotMatch(robotsText, /^Disallow:\s*\/\s*$/m, "public site must not block every crawler");
} else {
  // Loopback deployments intentionally fail closed for discovery.
  assert.match(robotsText, /Disallow:\s*\/|Sitemap:\s*https:\/\/www\.aivideosugc\.com\/sitemap\.xml/i, "candidate robots policy");
}

const metadataResults = await mapLimit(TARGET_PATHS, 3, async (path) => {
  const response = await get(path);
  assert.equal(response.status(), 200, `${path}: status ${response.status()}`);
  const html = await response.text();
  const title = htmlTitle(html);
  const description = htmlMeta(html, "description");
  // Most pages suffix the brand. The approved About title leads with the brand, so require its
  // identity there without rewriting the page-owned title just to satisfy a suffix convention.
  const hasBrand = path === "/about-us"
    ? /(?:AIVideosUGC|Aidreamcapes)/i.test(title)
    : /\| (?:AIVideosUGC|Aidreamcapes)$/i.test(title);
  assert(hasBrand, `${path}: missing brand identity (${title})`);
  assert(title.length <= 60, `${path}: title too long (${title.length})`);
  assert(description.length >= 140 && description.length <= 160, `${path}: description length ${description.length}`);
  assert.equal(htmlCanonical(html), `https://www.aivideosugc.com${path}`, `${path}: canonical`);
  const robotsMeta = htmlMeta(html, "robots");
  assert.match(robotsMeta, /max-image-preview:\s*large/i, `${path}: robots must allow large image previews (${robotsMeta})`);
  const pageNodes = flattenJsonLd(parseJsonLd(html));
  const breadcrumbNode = pageNodes.find((node) => node["@type"] === "BreadcrumbList");
  assert(
    breadcrumbNode && Array.isArray(breadcrumbNode.itemListElement) && breadcrumbNode.itemListElement.length >= 2,
    `${path}: BreadcrumbList must list the home page and this page`
  );
  if (path === "/ai-video-generation/text-to-video" || path === "/ai-video-generation/ai-twin") {
    const pageSchemas = pageNodes;
    const webPage = pageSchemas.find((node) => node["@type"] === "WebPage");
    assert.equal(webPage?.url, `https://www.aivideosugc.com${path}`, `${path}: WebPage schema canonical URL`);
    assert.equal(webPage?.name, title, `${path}: WebPage schema title matches metadata`);
    assert.equal(webPage?.description, description, `${path}: WebPage schema description matches metadata`);
  }
  return { path, title, description };
});
assert.equal(new Set(metadataResults.map(({ title }) => title)).size, metadataResults.length, "target titles must be unique");

// Policy pages that are not part of the navigation target list still have to
// publish the large image preview directive; they read robots from page
// content that predates it, so the renderer supplies the default.
for (const path of ["/cookies", "/digital-delivery", "/platforms"]) {
  const response = await get(path);
  assert.equal(response.status(), 200, `${path}: policy page status ${response.status()}`);
  const html = await response.text();
  assert.match(htmlMeta(html, "robots"), /max-image-preview:\s*large/i, `${path}: robots must allow large image previews`);
  const nodes = flattenJsonLd(parseJsonLd(html));
  assert(
    nodes.some((node) => node["@type"] === "BreadcrumbList" && Array.isArray(node.itemListElement) && node.itemListElement.length >= 2),
    `${path}: BreadcrumbList must list the home page and this page`
  );
}

const login = await get("/login");
assert.equal(login.status(), 200, `login status: ${login.status()}`);
const loginHtml = await login.text();
assert.match(`${login.headers()["x-robots-tag"] || ""} ${htmlMeta(loginHtml, "robots")}`, /noindex\s*,?\s*nofollow/i, "login robots");
assert.match(htmlTitle(loginHtml), /AIVideosUGC|Aidreamcapes/i, "login title");
assert.equal(h1Count(loginHtml), 1, "login H1 count");
assert.equal(htmlCanonical(loginHtml), "", "login should not require a canonical");

for (const missingPath of ["/404", "/seo-contract-missing-page-20261002", "/blog/seo-contract-missing-post-20261002"]) {
const notFound = await get(missingPath);
assert.equal(notFound.status(), 404, `404 status: ${notFound.status()}`);
const notFoundHtml = await notFound.text();
assert.match(htmlTitle(notFoundHtml), /^Page not found \| (?:AIVideosUGC|Aidreamcapes)$/, "404 title");
assert.equal(h1Count(notFoundHtml), 1, "404 H1 count");
assert.match(`${notFound.headers()["x-robots-tag"] || ""} ${htmlMeta(notFoundHtml, "robots")}`, /noindex\s*,?\s*nofollow/i, "404 robots");
for (const path of ["/", "/ai-image-generation", "/ai-video-generation", "/pricing", "/contact-us"]) {
  assert.match(notFoundHtml, new RegExp(`href=["']${path.replaceAll("/", "\\/")}["']`), `404 link ${path}`);
}
}
for (const path of ["/ai-save-the-date/engagement", "/ai-image-generation/unblur-image"]) {
  const response = await get(path);
  assert.equal(response.status(), 410, `${path}: retired route must stay gone`);
  assert.match(response.headers()["x-robots-tag"] || "", /noindex/, `${path}: robots`);
}

const sitemap = await get("/sitemap.xml");
assert.equal(sitemap.status(), 200, `sitemap status: ${sitemap.status()}`);
const sitemapXml = await sitemap.text();
assert.equal(XMLValidator.validate(sitemapXml), true, "sitemap must parse as XML");
const entries = new XMLParser({ isArray: (name) => ["url", "image:image"].includes(name) }).parse(sitemapXml).urlset.url;
const pageUrls = entries.map((entry) => entry.loc);
const imageUrls = entries.flatMap((entry) => (entry["image:image"] || []).map((image) => image["image:loc"]));
const entriesForReadback = preNavigationMigration
  ? entries.filter((entry) => !SITE_V2_REDIRECT_SOURCES.has(new URL(entry.loc).pathname))
  : entries;
assert(pageUrls.length > 0, "sitemap page count");
assert.equal(new Set(pageUrls).size, pageUrls.length, "sitemap page URLs unique");
assert(!pageUrls.some((url) => /\/login(?:[/?]|$)|\/404(?:[/?]|$)/i.test(url)), "private/404 URL in sitemap");
assert(!sitemapXml.includes("engagement-photo image"), "stale sitemap image title");
assert(!sitemapXml.includes("An intimate engagement announcement"), "stale sitemap image caption");

// The near slug table sends a visitor who typed one address away to the page
// they meant. A source that answers today must never be redirected, and a
// target that does not answer would only move the problem.
const nearSlugTable = new Map(SITE_V2_NEAR_SLUGS);
const nearSlugLivePaths = new Set(entriesForReadback.map((entry) => new URL(entry.loc).pathname.replace(/\/+$/, "") || "/"));
for (const [from, to] of SITE_V2_NEAR_SLUGS) {
  assert(!nearSlugLivePaths.has(from), `near slug source must not be a live page: ${from}`);
  assert(nearSlugLivePaths.has(to), `near slug target must be a live page: ${from} -> ${to}`);
}
const missingNearSlugs = [];
for (const path of nearSlugLivePaths) {
  for (const candidate of nearSlugCandidates(path)) {
    if (candidate === path || nearSlugLivePaths.has(candidate)) continue;
    if (!nearSlugTable.has(candidate)) missingNearSlugs.push(`${candidate} -> ${path}`);
  }
}
assert.equal(missingNearSlugs.length, 0, `near slug table misses ${missingNearSlugs.length} address(es): ${JSON.stringify(missingNearSlugs.slice(0, 20))}`);

const nearSlugBehavior = await mapLimit(SITE_V2_NEAR_SLUGS, 6, async ([from, to]) => {
  const response = await get(from, { headers: SITE_HEADERS });
  const status = response.status();
  const location = response.headers().location || "";
  await response.dispose();
  return { from, to, status, location };
});
const nearSlugFailures = nearSlugBehavior.filter(({ to, status, location }) => {
  if (status !== 301) return true;
  try {
    return (new URL(location, BASE_URL).pathname.replace(/\/+$/, "") || "/") !== to;
  } catch {
    return true;
  }
});
assert.equal(
  nearSlugFailures.length,
  0,
  `${nearSlugFailures.length} near slug address(es) do not answer 301 at the page they meant: ${JSON.stringify(nearSlugFailures.slice(0, 10))}`
);

const pageStatus = await mapLimit(entriesForReadback, 3, async (entry) => {
  const url = entry.loc;
  assert.equal(new URL(url).origin, "https://www.aivideosugc.com", "sitemap origin");
  const response = await get(new URL(url).pathname);
  assert.equal(response.status(), 200, `sitemap URL status ${response.status()}: ${url}`);
  const html = await response.text();
  assert.equal(htmlCanonical(html), url, `sitemap URL canonical: ${url}`);
  assert.doesNotMatch(`${response.headers()["x-robots-tag"] || ""} ${htmlMeta(html, "robots")}`, /noindex/i, `${url}: indexable`);
  const jsonLdBlocks = parseJsonLd(html);
  if (siteV2) {
    assert(jsonLdBlocks.length > 0, `${url}: JSON-LD missing`);
    assert(jsonLdBlocks.every((block) => block["@context"] === "https://schema.org"), `${url}: JSON-LD @context`);
  }
  const actualImages = pageImageKeys(html, url);
  for (const image of entry["image:image"] || []) {
    assert(actualImages.has(imageKey(image["image:loc"])), `${url}: sitemap image not referenced by page: ${image["image:loc"]}`);
    assert(image["image:title"] && image["image:caption"], `${url}: image text missing`);
  }
  return { url, title: htmlTitle(html), description: htmlMeta(html, "description") };
});
assert.equal(new Set(pageStatus.map(({ title }) => title)).size, pageStatus.length, "all sitemap page titles must be unique");
assert.equal(new Set(pageStatus.map(({ description }) => description)).size, pageStatus.length, "all sitemap page descriptions must be unique");
const imageStatus = await mapLimit([...new Set(imageUrls)], 4, async (url) => {
  const imageUrl = new URL(url);
  const response = await getUrl(`${MEDIA_BASE_URL}${imageUrl.pathname}${imageUrl.search}`);
  assert.equal(response.status(), 200, `sitemap image status ${response.status()}: ${url}`);
  assert.match(response.headers()["content-type"] || "", /^image\//, `sitemap asset must be an image: ${url}`);
  return url;
});

// ---- Public media detail contract (media detail remediation, 2026-10-21) ---
//
// Every public media card opens the item's own detail page:
//   /ai-video-generation/<publicSlug>, /ai-image-generation/<publicSlug> and
//   /ai-actors/<name> (flat). The card link is a plain path without a query
// string, a fragment or an inert `data-workspace-entry` payload. Derived
// detail pages are `noindex, follow` and stay out of the sitemap. The stored
// nested actor rows answer with a permanent redirect to the flat address.
const sitemapPathSet = new Set(pageUrls.map((url) => new URL(url).pathname));
const nestedActorUrls = [...sitemapPathSet].filter((path) => /^\/ai-actors\/(?:men|women)\//.test(path));
assert.equal(nestedActorUrls.length, 0, `sitemap submits ${nestedActorUrls.length} nested actor URL(s)`);
const ACTOR_HUB_PATHS = new Set(["/ai-actors/men", "/ai-actors/women", "/ai-actors/scene", "/ai-actors/age-range"]);
const FLAT_ACTOR_RE = /^\/ai-actors\/([a-z0-9][a-z0-9-]*)$/i;
const flatActorUrls = [...sitemapPathSet].filter((path) => /^\/ai-actors\/[a-z0-9][a-z0-9-]*$/.test(path) && !ACTOR_HUB_PATHS.has(path));
assert(flatActorUrls.length > 0, "sitemap submits no flat actor URL");

// The sitemap submits exactly the actor pages the directory publishes.
const actorDirectory = await get("/ai-actors");
assert.equal(actorDirectory.status(), 200, `/ai-actors: status ${actorDirectory.status()}`);
const actorDirectoryDom = load(await actorDirectory.text());
const directoryActorPaths = new Set();
actorDirectoryDom("article.actor-card a[href]").each((_, node) => {
  const href = actorDirectoryDom(node).attr("href") || "";
  const path = new URL(href, `${BASE_URL}/`).pathname.replace(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/, "");
  if (FLAT_ACTOR_RE.test(path)) directoryActorPaths.add(path);
});
assert(directoryActorPaths.size > 0, "the actor directory publishes no actor page");
assert.equal(flatActorUrls.length, directoryActorPaths.size, `sitemap submits ${flatActorUrls.length} actor URLs, the directory publishes ${directoryActorPaths.size}`);
for (const path of directoryActorPaths) {
  assert(flatActorUrls.includes(path), `sitemap is missing the actor page ${path}`);
}

const mediaDetailPaths = new Set();
for (const listing of ["/ai-video-generation", "/ai-image-generation"]) {
  const listingResponse = await get(listing);
  assert.equal(listingResponse.status(), 200, `${listing}: status ${listingResponse.status()}`);
  const listingHtml = await listingResponse.text();
  const listingDom = load(listingHtml);
  const cards = listingDom("a.v-pick-card, article.tc a[href], article.actor-card a[href]");
  assert(cards.length > 0, `${listing}: no media cards were rendered`);
  cards.each((_, node) => {
    const anchor = listingDom(node);
    const href = anchor.attr("href") || "";
    const url = new URL(href, `${BASE_URL}/`);
    assert.equal(url.search, "", `${listing}: media card href carries a query string (${href})`);
    assert.equal(url.hash, "", `${listing}: media card href carries a fragment (${href})`);
    assert.equal(anchor.attr("data-workspace-entry"), undefined, `${listing}: media card carries a data-workspace-entry payload (${href})`);
    assert.match(
      url.pathname,
      /^\/(ai-image-generation|ai-video-generation)\/[a-z0-9][a-z0-9-]*$|^\/ai-actors\/[a-z0-9][a-z0-9-]*$/i,
      `${listing}: media card does not open a detail route (${href})`
    );
    mediaDetailPaths.add(url.pathname);
  });
}
assert(mediaDetailPaths.size > 0, "no media detail route was discovered on the public listings");

const mediaDetailResults = await mapLimit([...mediaDetailPaths], 4, async (path) => {
  let canonicalPath = path;
  let response = await get(canonicalPath);
  const visited = new Set([path]);
  // Reviewed equivalent cards now share one detail. Follow only permanent,
  // same-kind detail redirects; generic tool/root redirects still fail below.
  for (let hop = 0; [301, 308].includes(response.status()) && hop < 3; hop++) {
    const target = new URL(response.headers().location || "", "https://www.aivideosugc.com");
    assert.equal(target.origin, "https://www.aivideosugc.com", `${path}: redirect left this storefront`);
    assert.equal(target.search + target.hash, "", `${path}: detail redirect carries state`);
    assert.match(target.pathname, new RegExp(`^/${path.split("/")[1]}/[a-z0-9][a-z0-9-]*$`), `${path}: redirect left the detail namespace`);
    assert(!visited.has(target.pathname), `${path}: detail redirect cycle`);
    visited.add(target.pathname);
    canonicalPath = target.pathname;
    response = await get(canonicalPath);
  }
  assert.equal(response.status(), 200, `${path}: detail page status ${response.status()}`);
  const html = await response.text();
  assert.doesNotMatch(htmlTitle(html), /workspace/i, `${path}: detail page renders the workspace shell`);
  const robots = htmlMeta(html, "robots");
  assert.match(robots, /noindex/i, `${path}: robots is not noindex (${robots || "missing"})`);
  assert.match(robots, /follow/i, `${path}: robots is not follow (${robots || "missing"})`);
  assert.doesNotMatch(robots, /nofollow/i, `${path}: robots is nofollow (${robots})`);
  assert.equal(htmlCanonical(html), `https://www.aivideosugc.com${canonicalPath}`, `${path}: canonical`);
  assert(!sitemapPathSet.has(path), `${path}: derived detail page must stay out of the sitemap`);
  assert(!sitemapPathSet.has(canonicalPath), `${canonicalPath}: derived detail page must stay out of the sitemap`);
  return canonicalPath;
});

const actorRedirectResults = await mapLimit(flatActorUrls, 3, async (path) => {
  const slug = path.split("/").pop();
  for (const gender of ["men", "women"]) {
    const nestedPath = `/ai-actors/${gender}/${slug}`;
    const response = await get(nestedPath, { maxRedirects: 0 });
    assert(
      response.status() === 301 || response.status() === 308,
      `${nestedPath}: expected a permanent redirect to the flat actor page, got ${response.status()}`
    );
    assert.equal(response.headers().location, `https://www.aivideosugc.com${path}`, `${nestedPath}: redirect target`);
  }
  return path;
});

// ---- Internal links must not point at a redirecting address ----
//
// The storefront answers a permanent redirect for retired and renamed paths.
// A public page that still links to one of those addresses asks the visitor
// and the crawler to jump before the real page, so the link graph has to be
// free of them. The redirect sources are not a single list: they come from the
// runtime redirect table, from the LivePage rows and from the detail routes,
// so the gate asks the running storefront which addresses answer with 301 or
// 308 instead of reading a stored list.
const REDIRECT_LINK_HUB_PATHS = ["/ai-video-generation", "/ai-image-generation", "/ai-actors"];
const REDIRECT_LINK_DETAIL_SAMPLE = 6;

function internalLinkPaths(html) {
  const dom = load(html);
  const paths = new Set();
  dom("a[href]").each((_, node) => {
    const href = dom(node).attr("href") || "";
    if (!href.startsWith("/")) return;
    const path = href.split("#")[0].split("?")[0];
    if (path) paths.add(path);
  });
  return paths;
}

const redirectLinkSample = [{ path: "/", html: homepageHtml }];
for (const path of REDIRECT_LINK_HUB_PATHS) {
  const response = await get(path);
  assert.equal(response.status(), 200, `${path}: status ${response.status()}`);
  redirectLinkSample.push({ path, html: await response.text() });
}
// The detail pages publish their own related links, so they are part of the sample.
const redirectLinkDetailSample = [...mediaDetailPaths].filter((_, index) => index % 8 === 0).slice(0, REDIRECT_LINK_DETAIL_SAMPLE);
for (const path of redirectLinkDetailSample) {
  const response = await get(path);
  assert.equal(response.status(), 200, `${path}: status ${response.status()}`);
  redirectLinkSample.push({ path, html: await response.text() });
}

const redirectLinkTargets = new Map();
for (const sample of redirectLinkSample) {
  for (const target of internalLinkPaths(sample.html)) {
    if (!redirectLinkTargets.has(target)) redirectLinkTargets.set(target, new Set());
    redirectLinkTargets.get(target).add(sample.path);
  }
}

const redirectLinkViolations = [];
await mapLimit([...redirectLinkTargets.keys()], 4, async (target) => {
  const response = await get(target, { maxRedirects: 0 });
  const status = response.status();
  const location = response.headers().location || null;
  await response.dispose();
  if (status !== 301 && status !== 308) return;
  redirectLinkViolations.push({ target, status, location, from: [...redirectLinkTargets.get(target)].sort() });
});
redirectLinkViolations.sort((left, right) => left.target.localeCompare(right.target));

console.log(JSON.stringify({
  ok: true,
  origin: BASE_URL,
  storefront: siteV2 ? "site-v2" : "v1",
  redirects: SITE_V2_REDIRECTS.length,
  preNavigationMigration,
  edgeOwnedChecks,
  mediaDetail: {
    detailPages: mediaDetailResults.length,
    flatActorUrls: actorRedirectResults.length,
    nestedActorUrls: nestedActorUrls.length
  },
  internalLinkTargets: {
    sampledPages: redirectLinkSample.length,
    uniqueTargets: redirectLinkTargets.size,
    redirectingTargets: redirectLinkViolations.length
  },
  targetMetadataPages: metadataResults.length,
  nearSlugRedirects: { entries: SITE_V2_NEAR_SLUGS.length, verified: nearSlugBehavior.length, failures: nearSlugFailures.length },
  sitemapPages: pageStatus.length,
  sitemapImageRecords: imageUrls.length,
  uniqueSitemapImages: imageStatus.length,
  checks: ["metadata", "jsonld", "site-v2-redirects", "canonical", "robots", "sitemap-xml", "image-page-membership", "image-status", "random-404", "retired-410", "https-www-redirects", "security-headers", "hsts", "internal-link-redirect-targets", "near-slug-redirects"]
}));
// A public page that links to an address that answers 301 or 308 sends the
// visitor and the crawler through a jump before the real page. The redirect
// sources live in code and in the database, so the gate asks the running
// storefront which addresses answer with a permanent redirect.
assert.equal(
  redirectLinkViolations.length,
  0,
  `public pages must not link to a redirecting address: ${JSON.stringify(redirectLinkViolations.slice(0, 25), null, 2)}`
);
await http.dispose();
