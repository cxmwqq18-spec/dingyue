#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { load } from "cheerio";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { request } from "playwright";

const BASE_URL = String(process.env.AIDREAMCAPES_SEO_ORIGIN || "http://127.0.0.1:3002").replace(/\/$/, "");
const SITE_HEADERS = {
  "x-forwarded-host": "www.aivideosugc.com",
  "x-forwarded-proto": "https"
};
// Aidreamcapes.com v2 retires v1 URLs with 301 redirects (applied by the middleware).
const SITE_V2_REDIRECTS = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-site-v2-redirects.json", import.meta.url), "utf8"));
const SITE_V2_REDIRECT_SOURCES = new Set(SITE_V2_REDIRECTS.map(([from]) => from));
const SITE_V2_TARGET_PATHS = [
  "/ai-video-generation",
  "/ai-video-generation/url-to-video",
  "/ai-video-generation/ugc-ad-video",
  "/ai-image-generation",
  "/ai-image-generation/ecommerce-main-image",
  "/ai-image-generation/lifestyle-scene",
  "/templates",
  "/industries/beauty-skincare",
  "/platforms/tiktok-ads",
  "/guides",
  "/blog",
  "/inspiration",
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

async function get(path, options = {}) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await http.get(`${BASE_URL}${path}`, { maxRedirects: 0, ...options });
    if (![502, 503, 504, 522, 524].includes(response.status()) || attempt === 2) return response;
    await response.dispose();
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

function requestUrlFromSitemap(value) {
  const url = new URL(value);
  return `${BASE_URL}${url.pathname}${url.search}`;
}

const homepage = await get("/");
assert.equal(homepage.status(), 200, `homepage status: ${homepage.status()}`);
assert.equal(homepage.headers()["strict-transport-security"], "max-age=31536000; includeSubDomains", "Aidreamcapes HSTS header");
assert.equal(homepage.headers()["x-content-type-options"], "nosniff", "content type protection");
assert(homepage.headers()["referrer-policy"], "referrer policy missing");
assert(homepage.headers()["x-frame-options"], "frame protection missing");
const homepageHtml = await homepage.text();
const homepageDom = load(homepageHtml);
// The v2 storefront is live once the v2 LivePage rows and navigation are in the database.
// Before that (for example while a new release is checked against current data) the v1
// pages are still served and only redirected v1 paths are skipped.
const siteV2 = homepageDom('main[data-aidreamcapes-v2="true"]').length > 0;
const TARGET_PATHS = siteV2 ? SITE_V2_TARGET_PATHS : V1_TARGET_PATHS.filter((path) => !SITE_V2_REDIRECT_SOURCES.has(path));
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
const publicOrigin = new URL(BASE_URL).hostname === "www.aivideosugc.com";
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
  // Titles come from the stored pages, which name the brand from before the rename (Aidreamcapes) until the page data is refreshed.
  assert(/\| (?:AIVideosUGC|Aidreamcapes)$/.test(title), `${path}: missing brand suffix (${title})`);
  assert(title.length <= 60, `${path}: title too long (${title.length})`);
  assert(description.length >= 140 && description.length <= 160, `${path}: description length ${description.length}`);
  assert.equal(htmlCanonical(html), `https://www.aivideosugc.com${path}`, `${path}: canonical`);
  return { path, title, description };
});
assert.equal(new Set(metadataResults.map(({ title }) => title)).size, metadataResults.length, "target titles must be unique");

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
assert(pageUrls.length > 0, "sitemap page count");
assert.equal(new Set(pageUrls).size, pageUrls.length, "sitemap page URLs unique");
assert(!pageUrls.some((url) => /\/login(?:[/?]|$)|\/404(?:[/?]|$)/i.test(url)), "private/404 URL in sitemap");
assert(!sitemapXml.includes("engagement-photo image"), "stale sitemap image title");
assert(!sitemapXml.includes("An intimate engagement announcement"), "stale sitemap image caption");

const pageStatus = await mapLimit(entries, 3, async (entry) => {
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
  const response = await get(new URL(url).pathname + new URL(url).search);
  assert.equal(response.status(), 200, `sitemap image status ${response.status()}: ${url}`);
  assert.match(response.headers()["content-type"] || "", /^image\//, `sitemap asset must be an image: ${url}`);
  return url;
});

console.log(JSON.stringify({
  ok: true,
  origin: BASE_URL,
  storefront: siteV2 ? "site-v2" : "v1",
  redirects: SITE_V2_REDIRECTS.length,
  targetMetadataPages: metadataResults.length,
  sitemapPages: pageStatus.length,
  sitemapImageRecords: imageUrls.length,
  uniqueSitemapImages: imageStatus.length,
  checks: ["metadata", "jsonld", "site-v2-redirects", "canonical", "robots", "sitemap-xml", "image-page-membership", "image-status", "random-404", "retired-410", "https-www-redirects", "security-headers", "hsts"]
}));
await http.dispose();
