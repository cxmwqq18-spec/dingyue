#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";
const requestTimeoutMs = Number(process.env.MYDREAMSHOOTS_SEO_SSR_TIMEOUT_MS || 30_000);
const requestAttempts = Number(process.env.MYDREAMSHOOTS_SEO_SSR_ATTEMPTS || 3);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTextOnce(pathname, accept, redirectCount = 0) {
  const url = new URL(pathname, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${pathname} timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept, "x-forwarded-host": host },
      redirect: "manual",
      signal: controller.signal
    });
    const body = await response.text();
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location && redirectCount < 5) {
      const nextUrl = new URL(location, url);
      return fetchTextOnce(`${nextUrl.pathname}${nextUrl.search}`, accept, redirectCount + 1);
    }
    return {
      body,
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function withRetry(label, operation) {
  let lastError;
  for (let attempt = 1; attempt <= requestAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === requestAttempts) break;
      await wait(400 * attempt);
    }
  }
  throw lastError ?? new Error(`${label} failed`);
}

async function fetchText(pathname, accept) {
  return withRetry(`fetch ${pathname}`, () => fetchTextOnce(pathname, accept));
}

async function fetchStatusNoRedirectOnce(pathname, accept = "text/html") {
  const url = new URL(pathname, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${pathname} timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      headers: { accept, "x-forwarded-host": host },
      redirect: "manual",
      signal: controller.signal
    });
    await response.arrayBuffer();
    return {
      headers: Object.fromEntries(response.headers.entries()),
      status: response.status
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchStatusNoRedirect(pathname, accept = "text/html") {
  return withRetry(`fetch status ${pathname}`, () => fetchStatusNoRedirectOnce(pathname, accept));
}

async function fetchHtml(pathname) {
  const response = await fetchText(pathname, "text/html");
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response.body;
}

function graphNodes(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const payload = JSON.parse(match[1]);
        return Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [];
      } catch {
        return [];
      }
    });
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1] ?? "";
}

function metaDescription(html) {
  return firstMatch(html, /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
}

function canonicalHref(html) {
  return firstMatch(html, /<link\s+rel=["']canonical["']\s+href=["']([^"']*)["']/i);
}

function pageTitle(html) {
  return firstMatch(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ").trim();
}

const homepage = await fetchHtml("/");
const pricing = await fetchHtml("/pricing");
const collection = await fetchHtml("/ai-image-generation/headshot");
const focusCollectionPaths = [
  "/ai-image-generation/motion-generator",
  "/ai-image-generation/avatar",
  "/ai-image-generation/black-friday",
  "/ai-image-generation/only-fans",
  "/ai-image-generation/singles-awareness-day"
];
const focusCollections = {};
for (const pathname of focusCollectionPaths) {
  focusCollections[pathname] = await fetchHtml(pathname);
}
const videoGeneration = await fetchHtml("/ai-video-generation/image-to-video");
const workflow = await fetchHtml("/workflow");
const faq = await fetchHtml("/faq");
const sitemap = (await fetchText("/sitemap.xml", "application/xml")).body;
const legacyCollectionStatuses = [];
for (const pathname of [
  "/collections/wedding-portraits",
  "/collections/profile-cards",
  "/collections/headshots",
  "/collections/ai-video-add-ons",
  "/ai-photoshoot",
  "/ai-photoshoot/professional/headshot",
  "/ai-image-generation/professional",
  "/ai-image-generation/professional/headshot",
  "/tools",
  "/tools/image-to-video",
  "/tool"
]) {
  legacyCollectionStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const homepageGraph = graphNodes(homepage);
const collectionGraph = graphNodes(collection);
const videoGenerationGraph = graphNodes(videoGeneration);
const homepageVideos = homepageGraph.filter((node) => node?.["@type"] === "VideoObject");
const collectionProducts = collectionGraph.filter((node) => node?.["@type"] === "Product");
const videoGenerationProducts = videoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const collectionProduct = collectionProducts[0];
const collectionOffer = collectionProduct?.offers;
const forbiddenLoadingCopy = [
  "Reviews and trust signals are loading now",
  "Preparing credits and plan options",
  "Preparing this section.",
  "Preparing this information.",
  "Fresh storefront content is loading now.",
  "Helpful details are being loaded for this section.",
  "Loading section"
];
const forbiddenGenericThemeCopy = [
  "turn approved uploads into a focused private photo set",
  "A private gallery of",
  "works best when the source photos are current, sharp",
  "Keep the request focused on",
  "Confirm the visible credit cost before generation starts"
];
const publicHtmlPages = {
  homepage,
  pricing,
  collection,
  ...focusCollections,
  videoGeneration,
  workflow,
  faq
};

for (const [pageName, html] of Object.entries(publicHtmlPages)) {
  for (const copy of forbiddenLoadingCopy) {
    assert.equal(html.includes(copy), false, `${pageName} must not SSR loading placeholder copy: ${copy}`);
  }
}
const focusTopicNeedles = {
  "/ai-image-generation/motion-generator": ["image-to-video", "pan", "tilt", "orbit", "storyboard"],
  "/ai-image-generation/avatar": ["profile icons", "gaming", "discord", "square crops"],
  "/ai-image-generation/black-friday": ["sale banners", "social ads", "shopping", "campaign"],
  "/ai-image-generation/only-fans": ["subscription", "feed teasers", "non-explicit", "creator"],
  "/ai-image-generation/singles-awareness-day": ["self-love", "solo", "dating profile", "confidence"]
};
for (const [pathname, html] of Object.entries(focusCollections)) {
  const title = pageTitle(html);
  const description = metaDescription(html);
  const canonical = canonicalHref(html);
  const normalizedHtml = html.toLowerCase();
  assert.equal(canonical, `https://www.mydreamshoots.com${pathname}`, `${pathname} must expose the canonical AI Image Generation URL`);
  assert.ok(title.includes("myDreamshoots"), `${pathname} must expose branded title metadata`);
  assert.ok(description.length >= 90 && description.length <= 220, `${pathname} must expose a useful meta description`, { description });
  assert.match(description, /[.!?]$/, `${pathname} meta description must end as a complete sentence`);
  for (const copy of forbiddenGenericThemeCopy) {
    assert.equal(normalizedHtml.includes(copy.toLowerCase()), false, `${pathname} must not SSR generic theme copy: ${copy}`);
  }
  for (const needle of focusTopicNeedles[pathname]) {
    assert.ok(normalizedHtml.includes(needle), `${pathname} must contain topic-specific SEO copy: ${needle}`);
  }
}
assert.ok(pricing.includes("Starter") && (pricing.includes("$24.50") || pricing.includes("24.50")), "pricing HTML must contain real plan content");
assert.ok(homepage.includes('data-dreamshoot-embedded-pricing="true"'), "homepage HTML must contain the embedded pricing section");
assert.ok(
  homepage.includes("price_dreamshoot_starter_monthly") &&
    homepage.includes("price_dreamshoot_pro_monthly") &&
    homepage.includes("price_dreamshoot_premium_monthly"),
  "homepage embedded pricing must contain real plan cards and checkout links"
);
assert.equal(homepageVideos.length, 0, "homepage SSR must not expose legacy video theme VideoObject nodes after the AI Video Generation route migration");
assert.match(videoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/image-to-video/, "video generation detail SSR must expose the canonical video generation URL");
assert.ok(videoGenerationProducts.length >= 1, "video generation detail SSR must expose product or service JSON-LD");
assert.equal(collectionProducts.length, 1, "collection SSR must contain one Product node");
assert.ok(Array.isArray(collectionProduct?.image) && collectionProduct.image.length === 8, "collection Product must contain cover plus gallery image URLs");
assert.equal(new Set(collectionProduct.image).size, collectionProduct.image.length, "collection Product image URLs must be unique");
assert.equal(collectionProduct?.mainEntityOfPage, collectionProduct?.url, "collection Product must link to its visible page");
assert.equal(collectionProduct?.subjectOf?.["@type"], "ImageObject", "collection Product must contain an ImageObject subject");
assert.equal(collectionProduct?.subjectOf?.url, collectionProduct?.subjectOf?.contentUrl, "collection ImageObject url should match contentUrl");
assert.equal(collectionProduct?.subjectOf?.thumbnailUrl, collectionProduct?.image?.[0], "collection ImageObject thumbnail should use the Product cover");
assert.match(collectionProduct?.subjectOf?.encodingFormat ?? "", /^image\//, "collection ImageObject must expose image encodingFormat");
assert.equal(collectionOffer?.["@type"], "Offer", "collection Product must contain a purchasable Offer");
assert.equal(collectionOffer?.priceCurrency, "USD", "collection Offer must use USD");
assert.match(collectionOffer?.price ?? "", /^\d+\.\d{2}$/, "collection Offer must contain a decimal price");
assert.equal(collectionOffer?.availability, "https://schema.org/InStock", "collection Offer must use the schema.org InStock URL");
assert.equal(collectionOffer?.itemCondition, "https://schema.org/NewCondition", "collection Offer must use the schema.org NewCondition URL");
assert.ok(
  (collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Credit cost"),
  "collection Product must expose credit cost"
);
assert.ok(
  (collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Output count"),
  "collection Product must expose output count"
);
assert.ok(sitemap.includes("https://www.mydreamshoots.com/pricing"), "sitemap must contain the canonical pricing URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-image-generation/headshot"), "sitemap must contain the canonical headshot collection URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/ai-video-generation/image-to-video"), "sitemap must contain the canonical image-to-video URL");
for (const forbidden of ["/collections/headshots", "/ai-photoshoot", "/tools/image-to-video"]) {
  assert.equal(sitemap.includes(`https://www.mydreamshoots.com${forbidden}`), false, `sitemap must not contain ${forbidden}`);
}
for (const legacyStatus of legacyCollectionStatuses) {
  assert.equal(legacyStatus.status, 404, `${legacyStatus.pathname} should return HTTP 404 after the collection slug migration`);
}

console.log(JSON.stringify({
  ok: true,
  pages: ["/", "/pricing", "/ai-image-generation/headshot", "/ai-video-generation/image-to-video", "/workflow", "/faq"],
  legacy404s: legacyCollectionStatuses.map(({ pathname, status }) => ({ pathname, status })),
  placeholders: 0,
  homepageVideoObjects: homepageVideos.length,
  videoGenerationSchemaObjects: videoGenerationProducts.length,
  collectionProductObjects: collectionProducts.length,
  collectionOfferPrice: collectionOffer.price
}, null, 2));
