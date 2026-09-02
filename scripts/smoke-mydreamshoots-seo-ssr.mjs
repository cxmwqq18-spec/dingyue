#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const managedServer = !process.env.SMOKE_BASE_URL;
const port = process.env.MYDREAMSHOOTS_SEO_SSR_PORT || "3002";
const baseUrl = (process.env.SMOKE_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";
const prisma = new PrismaClient();
const localTaxonomy = JSON.parse(fs.readFileSync(new URL("../src/lib/mydreamshoots-theme-taxonomy.json", import.meta.url), "utf8"));
const localPageCopyProfiles = JSON.parse(fs.readFileSync(new URL("../src/lib/photo-package-use-case-profiles.json", import.meta.url), "utf8")).mydreamshootsCategories ?? {};
process.on("exit", () => { void prisma.$disconnect(); });
const hasProviderBackedPrice = await prisma.product
  .findMany({
    where: { siteId: "site_dreamshoot", status: "active" },
    include: { prices: true }
  })
  .then((products) =>
    products
      .flatMap((product) => product.prices ?? [])
      .some((price) => /^price_[A-Za-z0-9]+$/.test(String(price.stripePriceId ?? "")) && Boolean(price.providerVerifiedAt))
  );
const verifiedPublicPrices = await prisma.price
  .findMany({
    where: {
      siteId: "site_dreamshoot",
      status: "active",
      providerVerifiedAt: { not: null },
      product: { status: "active" }
    },
    select: { amountCents: true, currency: true }
  })
  .then((prices) => new Set(prices.map((price) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: price.currency.toUpperCase()
  }).format(price.amountCents / 100))));
const requestTimeoutMs = Number(process.env.MYDREAMSHOOTS_SEO_SSR_TIMEOUT_MS || 30_000);
const requestAttempts = Number(process.env.MYDREAMSHOOTS_SEO_SSR_ATTEMPTS || 3);
let serverProcess;

function stopManagedServer() {
  if (!serverProcess || serverProcess.killed) return;
  serverProcess.kill("SIGTERM");
  setTimeout(() => {
    if (serverProcess && !serverProcess.killed) serverProcess.kill("SIGKILL");
  }, 2_000).unref();
}

process.on("exit", stopManagedServer);
process.on("SIGINT", () => {
  stopManagedServer();
  process.exit(130);
});

async function waitForManagedServer() {
  if (!managedServer) return;
  if (!fs.existsSync(".next-build")) {
    throw new Error(".next-build is missing; run npm run build before the self-contained SSR smoke");
  }
  serverProcess = spawn(process.execPath, ["server.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: "production", NEXT_DIST_DIR: ".next-build", PORT: port, STOREFRONT_PATH_MODE_READS: "database" },
    stdio: ["ignore", "ignore", "pipe"]
  });
  let serverError = "";
  serverProcess.stderr?.on("data", (chunk) => { serverError = `${serverError}${chunk}`.slice(-2_000); });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (serverProcess.exitCode !== null) throw new Error(`SSR server exited before readiness: ${serverError}`);
    try {
      const response = await fetch(`${baseUrl}/robots.txt`, { headers: { "x-forwarded-host": host }, redirect: "manual" });
      await response.arrayBuffer();
      if (response.status >= 200 && response.status < 500) return;
    } catch {}
    await wait(500);
  }
  throw new Error(`SSR server did not become ready: ${serverError}`);
}

await waitForManagedServer();

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

async function fetchStatusNoRedirectOnce(pathname, accept = "text/html", method = "GET") {
  const url = new URL(pathname, `${baseUrl}/`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error(`${pathname} timed out after ${requestTimeoutMs}ms`)), requestTimeoutMs);
  try {
    const response = await fetch(url, {
      method,
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

async function fetchStatusNoRedirect(pathname, accept = "text/html", method = "GET") {
  return withRetry(`fetch status ${pathname}`, () => fetchStatusNoRedirectOnce(pathname, accept, method));
}

async function fetchHtml(pathname) {
  const response = await fetchText(pathname, "text/html");
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response.body;
}

async function fetchPublishedOrReviewHtml(pathname) {
  const response = await fetchText(pathname, "text/html");
  const published = sitemapHasLoc(`https://${host}${pathname}`);
  assert.ok(published ? response.status === 200 : [200, 404].includes(response.status), `${pathname} must render or fail closed while deferred`);
  return response.status === 200 ? response.body : "";
}

function sitemapHasLoc(url) {
  const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`<loc>${escaped}</loc>`, "i").test(sitemap);
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

function robotsContent(html) {
  return firstMatch(html, /<meta\s+name=["']robots["']\s+content=["']([^"']*)["']/i);
}

function pageTitle(html) {
  return firstMatch(html, /<title>([\s\S]*?)<\/title>/i).replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function headingSequence(html) {
  return [...renderedMarkup(html).matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((match) => ({
      level: Number(match[1]),
      text: visibleText(match[2])
    }));
}

function visibleText(html) {
  return decodeHtmlEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderedMarkup(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

const homepage = await fetchHtml("/");
const sitePathHomepage = await fetchHtml("/site/mydreamshoots/");
const pricing = await fetchHtml("/pricing");
const policyPages = Object.fromEntries(await Promise.all(["/content", "/privacy", "/refunds", "/shipping", "/terms"].map(async (pathname) => [pathname, await fetchHtml(pathname)])));
const aiImageDirectory = await fetchHtml("/ai-image-generation");
const aiVideoDirectory = await fetchHtml("/ai-video-generation");
const sitemap = (await fetchText("/sitemap.xml", "application/xml")).body;
const robotsResponse = await fetchStatusNoRedirect("/robots.txt", "text/plain");
assert.equal(robotsResponse.status, 200, "robots.txt must return HTTP 200");
for (const header of ["x-storefront-publication", "x-storefront-publication-version", "x-storefront-snapshot-hash", "x-storefront-build", "x-storefront-route-revision", "x-storefront-page-revision", "x-storefront-copy-revision", "x-storefront-media-revision", "x-storefront-facts-revision", "x-storefront-offer-revision", "x-storefront-collection-revision", "x-storefront-link-revision", "x-storefront-policy-revision", "x-sitemap-url-count", "x-sitemap-image-count", "x-sitemap-generation-ms"]) {
  assert.equal(robotsResponse.headers[header], undefined, `robots.txt must not expose ${header}`);
}
const headshotPath = "/ai-image-generation/headshot";
const headshotIsPublished = sitemapHasLoc(`https://${host}${headshotPath}`);
const collectionResponse = await fetchText(headshotPath, "text/html");
assert.equal(collectionResponse.status, headshotIsPublished ? 200 : 404, `${headshotPath} status must match the active immutable snapshot`);
const collection = headshotIsPublished ? collectionResponse.body : "";
const focusCollectionSlugs = (localTaxonomy.items ?? [])
  .filter((item) => item.slug !== "motion-generator")
  .map((item) => item.slug)
  .filter(Boolean);
const focusCollectionPaths = focusCollectionSlugs.map((slug) => `/ai-image-generation/${slug}`);
const focusCollections = {};
for (const pathname of focusCollectionPaths) {
  const expectedPublished = sitemapHasLoc(`https://${host}${pathname}`);
  const response = await fetchText(pathname, "text/html");
  assert.equal(response.status, expectedPublished ? 200 : 404, `${pathname} status must match the active immutable snapshot`);
  if (expectedPublished) focusCollections[pathname] = response.body;
}
for (const pathname of focusCollectionPaths.filter((pathname) => !sitemapHasLoc(`https://${host}${pathname}`))) {
  const response = await fetchStatusNoRedirect(pathname);
  assert.equal(response.status, 404, `${pathname} must return 404 while its page entity is review_required`);
  assert.equal(response.headers.location, undefined, `${pathname} review response must not redirect`);
}
for (const pathname of focusCollectionPaths) {
  const expectedPublished = sitemapHasLoc(`https://${host}${pathname}`);
  for (const candidate of [pathname, `/site/mydreamshoots${pathname}`]) {
    const getResponse = await fetchStatusNoRedirect(candidate, "text/html", "GET");
    const headResponse = await fetchStatusNoRedirect(candidate, "text/html", "HEAD");
    const expectedStatus = expectedPublished ? 200 : 404;
    const isSitePathAlias = candidate.startsWith("/site/");
    if (isSitePathAlias) {
      assert.ok([expectedStatus, 301].includes(getResponse.status), `${candidate} GET must render or use the canonical host alias`);
      assert.ok([expectedStatus, 301].includes(headResponse.status), `${candidate} HEAD must render or use the canonical host alias`);
      if (getResponse.status === 301) assert.ok(getResponse.headers.location?.endsWith(pathname), `${candidate} GET alias must target ${pathname}`);
      if (headResponse.status === 301) assert.ok(headResponse.headers.location?.endsWith(pathname), `${candidate} HEAD alias must target ${pathname}`);
    } else {
      assert.equal(getResponse.status, expectedStatus, `${candidate} GET status must match the active immutable snapshot`);
      assert.equal(headResponse.status, expectedStatus, `${candidate} HEAD status must match the active immutable snapshot`);
      assert.equal(getResponse.headers.location, undefined, `${candidate} GET must not emit an unexpected redirect`);
      assert.equal(headResponse.headers.location, undefined, `${candidate} HEAD must not emit an unexpected redirect`);
    }
  }
}
for (const [canonicalPath, aliases] of [["/privacy", ["/privacy-policy", "/policies/privacy", "/policies/privacy-policy"]], ["/terms", ["/terms-of-service", "/policies/terms", "/policies/terms-of-service"]]]) {
  assert.equal((await fetchStatusNoRedirect(canonicalPath)).status, 200, `${canonicalPath} must be the sole policy render route`);
  for (const alias of aliases) {
    const response = await fetchStatusNoRedirect(alias);
    assert.equal(response.status, 301, `${alias} must be a policy redirect-only alias`);
    assert.ok(response.headers.location?.endsWith(canonicalPath), `${alias} must redirect to ${canonicalPath}`);
    assert.doesNotMatch(response.headers.location ?? "", /(?:localhost|127\.0\.0\.1)/i, `${alias} redirect must not expose a local origin`);
  }
}
const talkingPhotoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/talking-photo");
const explainerVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/explainer-video");
const howToVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/how-to-video");
const talkingHeadVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/talking-head-video");
const videoGenerationDirectory = await fetchHtml("/ai-video-generation");
assert.match(videoGenerationDirectory, /<h1[^>]*>AI Video Generation<\/h1>/, "AI Video Generation root must render the video directory heading");
assert.doesNotMatch(videoGenerationDirectory, /Paid AI photo tools for better source images\./, "AI Video Generation root must not render the legacy photo-tool heading");
assert.match(videoGenerationDirectory, /data-video-theme-card=/, "AI Video Generation root must render published video theme cards");
const storyVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/story-video");
const memeVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/meme-video");
const productVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/product-video");
const productAdVideoPath = "/ai-video-generation/product-ad-video";
const productAdIsPublished = sitemapHasLoc(`https://${host}${productAdVideoPath}`);
const productAdResponse = await fetchText(productAdVideoPath, "text/html");
assert.equal(productAdResponse.status, productAdIsPublished ? 200 : 404, `${productAdVideoPath} status must match its current published snapshot`);
const productAdVideoGeneration = productAdIsPublished ? productAdResponse.body : "";
const ugcAdVideoPath = "/ai-video-generation/ugc-ad-video";
const ugcAdIsPublished = sitemapHasLoc(`https://${host}${ugcAdVideoPath}`);
const ugcAdResponse = await fetchText(ugcAdVideoPath, "text/html");
assert.equal(ugcAdResponse.status, ugcAdIsPublished ? 200 : 404, `${ugcAdVideoPath} status must match its current published snapshot`);
const ugcAdVideoGeneration = ugcAdIsPublished ? ugcAdResponse.body : "";
const promoVideoPath = "/ai-video-generation/promo-video";
const promoIsPublished = sitemapHasLoc(`https://${host}${promoVideoPath}`);
const promoResponse = await fetchText(promoVideoPath, "text/html");
assert.equal(promoResponse.status, promoIsPublished ? 200 : 404, `${promoVideoPath} status must match its current published snapshot`);
const promoVideoGeneration = promoIsPublished ? promoResponse.body : "";
const videoAdPath = "/ai-video-generation/video-ad";
const videoAdIsPublished = sitemapHasLoc(`https://${host}${videoAdPath}`);
const videoAdResponse = await fetchText(videoAdPath, "text/html");
assert.equal(videoAdResponse.status, videoAdIsPublished ? 200 : 404, `${videoAdPath} status must match its current published snapshot`);
const videoAdGeneration = videoAdIsPublished ? videoAdResponse.body : "";
const brandVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/brand-video");
const musicVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/music-video");
const fashionVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/fashion-video");
const foodVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/food-video");
const petVideoGeneration = await fetchPublishedOrReviewHtml("/ai-video-generation/pet-video");
const videoTopicGenerationByPath = {
  "/ai-video-generation/talking-photo": talkingPhotoGeneration,
  "/ai-video-generation/explainer-video": explainerVideoGeneration,
  "/ai-video-generation/how-to-video": howToVideoGeneration,
  "/ai-video-generation/talking-head-video": talkingHeadVideoGeneration,
  "/ai-video-generation/cinematic-video": await fetchPublishedOrReviewHtml("/ai-video-generation/cinematic-video"),
  "/ai-video-generation/tiktok-video": await fetchPublishedOrReviewHtml("/ai-video-generation/tiktok-video"),
  "/ai-video-generation/instagram-reels": await fetchPublishedOrReviewHtml("/ai-video-generation/instagram-reels"),
  "/ai-video-generation/social-media-video": await fetchPublishedOrReviewHtml("/ai-video-generation/social-media-video"),
  "/ai-video-generation/youtube-video": await fetchPublishedOrReviewHtml("/ai-video-generation/youtube-video"),
  "/ai-video-generation/story-video": storyVideoGeneration,
  "/ai-video-generation/meme-video": memeVideoGeneration,
  "/ai-video-generation/product-video": productVideoGeneration,
  ...(productAdIsPublished ? { [productAdVideoPath]: productAdVideoGeneration } : {}),
  ...(promoIsPublished ? { [promoVideoPath]: promoVideoGeneration } : {}),
  ...(ugcAdIsPublished ? { [ugcAdVideoPath]: ugcAdVideoGeneration } : {}),
  ...(videoAdIsPublished ? { [videoAdPath]: videoAdGeneration } : {}),
  "/ai-video-generation/brand-video": brandVideoGeneration,
  "/ai-video-generation/music-video": musicVideoGeneration,
  "/ai-video-generation/fashion-video": fashionVideoGeneration,
  "/ai-video-generation/food-video": foodVideoGeneration,
  "/ai-video-generation/pet-video": petVideoGeneration
};
const workflow = await fetchHtml("/workflow");
const faq = await fetchHtml("/faq");
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
  "/tool"
]) {
  legacyCollectionStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const legacyToolRedirectStatuses = [];
for (const pathname of ["/tools"]) {
  legacyToolRedirectStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const socialCardsRedirect = await fetchStatusNoRedirect("/ai-image-generation/social-cards");
assert.equal(socialCardsRedirect.status, 301, "MyDreamShoots Social Cards must return a server-side 301");
assert.ok(socialCardsRedirect.headers.location?.endsWith("/ai-image-generation"), "Social Cards 301 must target /ai-image-generation");
const siteSocialCardsRedirect = await fetchStatusNoRedirect("/site/mydreamshoots/ai-image-generation/social-cards");
assert.equal(siteSocialCardsRedirect.status, 301, "MyDreamShoots site-path Social Cards must return a server-side 301");
assert.ok(siteSocialCardsRedirect.headers.location?.endsWith("/ai-image-generation"), "site-path Social Cards 301 must target /ai-image-generation");
const hiddenVideoStatuses = [];
for (const pathname of ["/ai-video-generation/text-to-video", "/ai-video-generation/image-to-video", "/tools/image-to-video"]) {
  hiddenVideoStatuses.push({ pathname, ...(await fetchStatusNoRedirect(pathname)) });
}
const homepageGraph = graphNodes(homepage);
const collectionGraph = graphNodes(collection);
const talkingPhotoGenerationGraph = graphNodes(talkingPhotoGeneration);
const storyVideoGenerationGraph = graphNodes(storyVideoGeneration);
const memeVideoGenerationGraph = graphNodes(memeVideoGeneration);
const productVideoGenerationGraph = graphNodes(productVideoGeneration);
const productAdVideoGenerationGraph = graphNodes(productAdVideoGeneration);
const ugcAdVideoGenerationGraph = graphNodes(ugcAdVideoGeneration);
const promoVideoGenerationGraph = graphNodes(promoVideoGeneration);
const videoAdGenerationGraph = graphNodes(videoAdGeneration);
const homepageVideos = homepageGraph.filter((node) => node?.["@type"] === "VideoObject");
const collectionProducts = collectionGraph.filter((node) => node?.["@type"] === "Product");
const talkingPhotoGenerationProducts = talkingPhotoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const storyVideoGenerationProducts = storyVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const memeVideoGenerationProducts = memeVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const productVideoGenerationProducts = productVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const productAdVideoGenerationProducts = productAdVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const ugcAdVideoGenerationProducts = ugcAdVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const promoVideoGenerationProducts = promoVideoGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const videoAdGenerationProducts = videoAdGenerationGraph.filter((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service");
const collectionProduct = collectionProducts[0];
const collectionOffer = collectionProduct?.offers;
const packageFacts = {
  "background-changer": { outputCount: 12, creditCost: 12 },
  "background-remover": { outputCount: 10, creditCost: 10 },
  bikini: { outputCount: 24, creditCost: 24 },
  "black-friday": { outputCount: 20, creditCost: 22 },
  boudoir: { outputCount: 24, creditCost: 24 },
  cannes: { outputCount: 24, creditCost: 24 }
};
const pricingGraph = graphNodes(pricing);
const pricingOfferCatalog = pricingGraph.find((node) => node?.["@type"] === "OfferCatalog");
const pricingOffers = Array.isArray(pricingOfferCatalog?.itemListElement) ? pricingOfferCatalog.itemListElement : [];
const starterOffer = pricingOffers.find((offer) => offer?.name === "Starter");
for (const [slug, facts] of Object.entries(packageFacts)) {
  const pathname = `/ai-image-generation/${slug}`;
  const html = focusCollections[pathname];
  assert.ok(html, `${pathname} must be published for the P1-01 package contract`);
  const text = visibleText(html);
  assert.match(text, new RegExp(`\\b${facts.outputCount} (?:Photos|outputs)\\b`, "i"), `${pathname} visible copy must show its output count`);
  assert.match(text, new RegExp(`\\b${facts.creditCost} credits\\b`, "i"), `${pathname} visible copy must show its credit cost`);
  const graph = graphNodes(html);
  const products = graph.filter((node) => node?.["@type"] === "Product");
  assert.equal(products.length, 1, `${pathname} must expose one Product node`);
  const product = products[0];
  const canonical = canonicalHref(html);
  const ogUrl = firstMatch(html, /<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i);
  assert.equal(sitemapHasLoc(product.url), true, `${pathname} canonical Product URL must be present in the sitemap`);
  assert.equal(product.offers, undefined, `${pathname} Product must not inherit a site-level subscription Offer`);
  assert.equal(product.price, undefined, `${pathname} Product must not expose a subscription price`);
  assert.equal(product.priceCurrency, undefined, `${pathname} Product must not expose a subscription currency`);
  assert.equal(JSON.stringify(product).includes("Starter"), false, `${pathname} Product must not expose Starter`);
  assert.equal(JSON.stringify(product).includes("24.50"), false, `${pathname} Product must not expose the Starter price`);
  assert.equal(JSON.stringify(product).includes("/pricing"), false, `${pathname} Product must not reference /pricing`);
  assert.equal(product.url, `https://www.mydreamshoots.com${pathname}`, `${pathname} Product URL must match the visible page`);
  assert.equal(product.mainEntityOfPage, product.url, `${pathname} Product mainEntityOfPage must match its URL`);
  assert.equal(canonical, product.url, `${pathname} canonical must match its Product URL`);
  assert.equal(ogUrl, product.url, `${pathname} og:url must match its Product URL`);
  const additionalProperties = new Map((product.additionalProperty ?? []).map((property) => [property.name, property.value]));
  assert.deepEqual(Object.fromEntries(additionalProperties), {
    "Credit cost": facts.creditCost,
    "Output count": facts.outputCount
  }, `${pathname} Product additionalProperty facts must match the visible package facts`);
}
assert.match(visibleText(pricing), /Starter/i, "pricing visible copy must retain the Starter subscription");
assert.match(pricing, /\$24\.50/, "pricing visible copy must retain the $24.50 price");
assert.equal(starterOffer?.["@type"], "Offer", "pricing JSON-LD must retain the Starter Offer");
assert.equal(starterOffer?.price, "24.50", "pricing JSON-LD Starter Offer must retain the $24.50 price");
assert.equal(starterOffer?.priceCurrency, "USD", "pricing JSON-LD Starter Offer must retain USD currency");
assert.equal(starterOffer?.url, "https://www.mydreamshoots.com/pricing", "pricing JSON-LD Starter Offer must point to /pricing");
assert.equal(canonicalHref(pricing), "https://www.mydreamshoots.com/pricing", "pricing canonical must remain self-referential");
assert.equal(firstMatch(pricing, /<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i), "https://www.mydreamshoots.com/pricing", "pricing og:url must remain self-referential");
const aiImageOgImage = firstMatch(aiImageDirectory, /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
const aiImageTwitterImage = firstMatch(aiImageDirectory, /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i);
assert.ok(aiImageOgImage, "AI Image directory SSR must contain og:image");
assert.equal(aiImageTwitterImage, aiImageOgImage, "AI Image directory Twitter image must match og:image");
assert.doesNotMatch(aiImageOgImage, /cyberpunk-solo-city/i, "AI Image directory must not reuse the shared Cyberpunk default image");
const aiImageMain = aiImageDirectory.match(/<main\b[\s\S]*?<\/main>/i)?.[0] ?? aiImageDirectory;
assert.doesNotMatch(aiImageMain, /<a\s+class=["'][^"']*group\/package[^"']*["'][^>]*href=["'][^"']*motion-generator/i, "AI Image package content must not expose Motion Generator");
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
  "Confirm the visible credit cost before generation starts"
];
const focusTopicNeedles = Object.fromEntries(
  (localTaxonomy.items ?? []).map((item) => {
    const topicTokens = Array.from(new Set([item.label, item.slug, ...(item.tags ?? [])]
      .flatMap((value) => String(value).toLowerCase().split(/[^a-z0-9]+/))
      .filter((token) => token.length >= 4 && !["photo", "photos", "image", "images", "private", "style"].includes(token))));
    return [`/ai-image-generation/${item.slug}`, topicTokens];
  })
);
const publicHtmlPages = {
  homepage,
  pricing,
  ...policyPages,
  collection,
  ...focusCollections,
  talkingPhotoGeneration,
  explainerVideoGeneration,
  howToVideoGeneration,
  talkingHeadVideoGeneration,
  storyVideoGeneration,
  memeVideoGeneration,
  productVideoGeneration,
  ...(productAdIsPublished ? { productAdVideoGeneration } : {}),
  ...(promoIsPublished ? { promoVideoGeneration } : {}),
  ...(ugcAdIsPublished ? { ugcAdVideoGeneration } : {}),
  ...(videoAdIsPublished ? { videoAdGeneration } : {}),
  brandVideoGeneration,
  musicVideoGeneration,
  fashionVideoGeneration,
  foodVideoGeneration,
  petVideoGeneration,
  workflow,
  faq
};

for (const [pageName, html] of Object.entries({ explainerVideoGeneration, howToVideoGeneration, talkingHeadVideoGeneration })) {
  assert.ok(html, `${pageName} must be published and render HTML`);
  assert.doesNotMatch(robotsContent(html), /noindex/i, `${pageName} must never emit noindex`);
  assert.match(robotsContent(html), /(?:^|[ ,])index(?:$|[ ,])/i, `${pageName} must emit index`);
  assert.match(robotsContent(html), /(?:^|[ ,])follow(?:$|[ ,])/i, `${pageName} must emit follow`);
}

for (const [pageName, html] of Object.entries(publicHtmlPages)) {
  for (const copy of forbiddenLoadingCopy) {
    assert.equal(html.includes(copy), false, `${pageName} must not SSR loading placeholder copy: ${copy}`);
  }
}
for (const [pathname, html] of Object.entries(policyPages)) {
  assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, `${pathname} must render exactly one H1`);
}
for (const [pageName, html] of Object.entries(publicHtmlPages)) {
  for (const internalTerm of ["search intent", "content structure", "SEO strategy", "keyword layout", "review required", "TODO", "FIXME"]) {
    assert.equal(html.toLowerCase().includes(internalTerm.toLowerCase()), false, `${pageName} must not expose internal term: ${internalTerm}`);
  }
}
for (const [pathname, html] of Object.entries(focusCollections)) {
  const slug = pathname.split("/").pop();
  const pageCopy = localPageCopyProfiles[slug];
  assert.ok(pageCopy, `${pathname} must have source page copy`);
  const title = pageTitle(html);
  const description = metaDescription(html);
  const canonical = canonicalHref(html);
  const text = visibleText(html);
  const normalizedHtml = text.toLowerCase();
  const headings = headingSequence(html);
  const h1Headings = headings.filter((heading) => heading.level === 1);
  assert.equal(h1Headings.length, 1, `${pathname} must render exactly one H1`);
  assert.equal(headings[0]?.level, 1, `${pathname} first content heading must be an H1`);
  assert.equal(headings[0]?.text, pageCopy.headline, `${pathname} first content heading must match the approved page headline`);
  assert.ok(headings.some((heading) => heading.level === 2 && heading.text === pageCopy.galleryTitle), `${pathname} gallery title must render as H2`);
  assert.equal(h1Headings.some((heading) => heading.text === pageCopy.galleryTitle), false, `${pathname} gallery title must never render as H1`);
  assert.equal(canonical, `https://www.mydreamshoots.com${pathname}`, `${pathname} must expose the canonical AI Image Generation URL`);
  assert.equal(decodeHtmlEntities(title), pageCopy.seoTitle, `${pathname} must expose the approved page-copy SEO title`);
  assert.equal(decodeHtmlEntities(description), pageCopy.cardDescription, `${pathname} must keep the approved meta description`);
  const mediaReviewRequired = localTaxonomy.items?.find((item) => item.slug === slug)?.mediaReviewStatus === "review_required";
  if (mediaReviewRequired) {
    assert.match(robotsContent(html), /noindex/i, `${pathname} must be noindex while its page media owner is under review`);
    assert.equal(sitemapHasLoc(`https://www.mydreamshoots.com${pathname}`), false, `${pathname} must not enter the sitemap while its page media owner is under review`);
  } else {
    assert.doesNotMatch(robotsContent(html), /noindex/i, `${pathname} should remain indexable after its page media contract passes`);
  }
  assert.ok(text.includes(pageCopy.galleryTitle), `${pathname} must render the approved gallery H2`);
  assert.ok(text.includes(pageCopy.ctaTitle), `${pathname} must render the approved page-copy CTA title`);
  for (const copy of forbiddenGenericThemeCopy) {
    assert.equal(normalizedHtml.includes(copy.toLowerCase()), false, `${pathname} must not SSR generic theme copy: ${copy}`);
  }
  const topicTokens = focusTopicNeedles[pathname] ?? [];
  assert.ok(topicTokens.some((needle) => normalizedHtml.includes(needle)), `${pathname} must contain topic-specific SEO copy: ${topicTokens.join(", ")}`);
  if (slug === "black-friday") {
    assert.equal(/anime avatar|avatar package/i.test(text), false, `${pathname} must not inherit Anime Avatar page copy`);
    assert.equal(/anime-avatar/i.test(html), false, `${pathname} must not expose Anime Avatar media in HTML, JSON-LD, or social metadata`);
  }
  if (slug === "singles-awareness-day") {
    assert.equal(/media kits|sponsor decks/i.test(text), false, `${pathname} must not inherit generic creator portrait page copy`);
  }
  const faqSchema = graphNodes(html).find((node) => node?.["@type"] === "FAQPage");
  const schemaQuestions = Array.isArray(faqSchema?.mainEntity) ? faqSchema.mainEntity : [];
  assert.equal(schemaQuestions.length, pageCopy.faqItems.length, `${pathname} FAQPage must expose the page-copy FAQ count`);
  pageCopy.faqItems.forEach((faqItem, index) => {
    assert.ok(text.includes(faqItem.question), `${pathname} must render visible FAQ question: ${faqItem.id}`);
    assert.ok(text.includes(faqItem.answer), `${pathname} must render visible FAQ answer: ${faqItem.id}`);
    assert.equal(schemaQuestions[index]?.name, faqItem.question, `${pathname} FAQPage question order must match visible FAQ: ${faqItem.id}`);
    assert.equal(schemaQuestions[index]?.acceptedAnswer?.text, faqItem.answer, `${pathname} FAQPage answer must match visible FAQ: ${faqItem.id}`);
  });
}
assert.match(visibleText(pricing), /credits/i, "pricing HTML must contain credit information");
assert.ok(
  !pricing.includes(["$", "24.50"].join("")) || verifiedPublicPrices.has("$24.50"),
  "pricing may only render $24.50 when an active provider-verified price owns that amount"
);
const homepageForbiddenCopy = [
  "Upload selfies and create your own AI model",
  "100% money-back guarantee",
  "instantly go viral",
  "15+ package categories",
  "photshoot",
  "Our plans starts",
  "Most Trusted Creators"
];
for (const copy of homepageForbiddenCopy) {
  assert.equal(homepage.includes(copy), false, `homepage must not contain deprecated SEO copy: ${copy}`);
}
assert.equal((homepage.match(/<h1\b/gi) ?? []).length, 1, "homepage must render exactly one H1");
assert.equal((sitePathHomepage.match(/<h1\b/gi) ?? []).length, 1, "site path homepage must render exactly one H1");
assert.equal(metaDescription(homepage), "Create AI videos from your photos, professional AI headshots, portraits, and themed photo sets. Make personalized Save the Date videos with myDreamshoots.", "homepage meta description must match the approved MyDreamShoots SEO copy");
assert.equal(canonicalHref(homepage), "https://www.mydreamshoots.com/", "homepage canonical must point to the slash-terminated root URL");
assert.equal(firstMatch(homepage, /<meta\s+property=["']og:url["']\s+content=["']([^"']*)["']/i), "https://www.mydreamshoots.com/", "homepage og:url must point to the slash-terminated root URL");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/"), true, "sitemap must contain the slash-terminated homepage URL");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com"), false, "sitemap must not contain a duplicate slashless homepage URL");
assert.equal(homepage.includes('href="/pricing"'), true, "homepage header must link Pricing to /pricing");
assert.equal(homepage.includes('href="#plans"'), false, "homepage header must not link Pricing to the embedded plans anchor");
assert.ok(homepage.includes('data-dreamshoot-embedded-pricing="true"'), "homepage HTML must contain the embedded pricing section");
assert.ok(
  homepage.includes('data-dreamshoot-embedded-pricing="true"') &&
    (!homepage.includes(["$", "24.50"].join("")) || verifiedPublicPrices.has("$24.50")),
  "homepage embedded pricing may only render $24.50 from an active provider-verified price"
);
assert.equal(homepageVideos.length, 0, "homepage SSR must not expose legacy video theme VideoObject nodes after the AI Video Generation route migration");
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  if (html) assert.match(html, new RegExp(`https://www\\.mydreamshoots\\.com${pathname.replaceAll("/", "\\/")}`), `${pathname} detail SSR must expose its canonical AI Video Generation URL`);
}
if (productAdIsPublished) {
  assert.match(productAdVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/product-ad-video/, "Product Ad Video detail SSR must expose the canonical AI Video Generation URL");
  assert.equal(pageTitle(productAdVideoGeneration), "AI Product Ad Video Generator – Create Product Ads With Clear Proof &amp; CTA | myDreamshoots", "Product Ad Video title must match the approved SEO title");
  assert.equal(
    metaDescription(productAdVideoGeneration),
    "Create product ad videos around a specific audience, problem or desire, product promise, visual proof, offer, and call to action. Plan launch ads, problem-solution ads, benefit ads, offers, comparison ads, and retargeting reminders.",
    "Product Ad Video description must match the approved SEO description"
  );
  assert.doesNotMatch(productAdVideoGeneration, /<meta\s+name=["']keywords["']/i, "Product Ad Video must not serialize CMS SEO keywords as a public meta tag");
  const productAdAssetPaths = [
    "ai-product-ad-video-new-product-unboxing-creative.jpg",
    "product-ad-video-new-product-launch-shoes.jpg",
    "product-ad-video-problem-solution-cleaning-scene.jpg",
    "product-ad-video-benefit-feature-headphones.jpg",
    "product-ad-video-limited-offer-shopping-response.jpg",
    "product-ad-video-comparison-shopping-decision.jpg",
    "product-ad-video-retargeting-purchase-reminder.jpg",
    "product-ad-video-skincare-customer-context.jpg"
  ];
  const renderedProductAdAssetPaths = Array.from(productAdVideoGeneration.matchAll(/\/assets\/dreamshoot\/product-ad-video\/([^"'?\\]+)/g)).map((match) => match[1]);
  assert.equal(new Set(renderedProductAdAssetPaths).size, 8, "Product Ad Video SSR must render eight unique topic assets");
  for (const assetPath of productAdAssetPaths) {
    assert.ok(renderedProductAdAssetPaths.includes(assetPath), `Product Ad Video SSR must render ${assetPath}`);
  }
  const normalizedProductAdVideoGeneration = productAdVideoGeneration
    .toLowerCase()
    .replaceAll("&gt;", ">")
    .replaceAll("&amp;", "&");
  for (const label of [
    "new product launch ad",
    "problem -> solution ad",
    "benefit / feature ad",
    "limited-time offer ad",
    "comparison / why choose it ad",
    "retargeting / reminder ad"
  ]) {
    assert.ok(normalizedProductAdVideoGeneration.includes(label), `Product Ad Video SSR must expose the scenario label ${label}`);
  }
}
if (ugcAdIsPublished) {
  assert.match(ugcAdVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/ugc-ad-video/, "UGC Ad Video detail SSR must expose the canonical AI Video Generation URL");
  assert.equal(pageTitle(ugcAdVideoGeneration), "AI UGC Video Generator for Creator-Style Product Ads | myDreamshoots", "UGC Ad Video title must match the approved SEO title");
  assert.equal(
    metaDescription(ugcAdVideoGeneration),
    "Create creator-style product ads with an AI UGC video generator. Plan hooks, speaker roles, product-in-use scenes, visible proof, voiceover, and clear CTAs—then validate every claim against your real product assets and generated output.",
    "UGC Ad Video description must match the approved SEO description"
  );
  assert.match(
    ugcAdVideoGeneration,
    /<meta name="keywords" content="AI UGC video generator, UGC ad video generator, AI UGC ad creator, UGC product video maker, creator-style product video, AI creator ad video, UGC style video ad, short-form creator ad generator"/,
    "UGC Ad Video must expose the approved SEO keywords"
  );
  const ugcAssetPaths = [
    "ai-ugc-video-creator-lip-product-hook.jpg",
    "ugc-ad-video-unboxing-first-impression.jpg",
    "ugc-ad-video-product-review-direct-to-camera.jpg",
    "ugc-ad-video-kitchen-product-demo.jpg",
    "ugc-ad-video-fashion-try-on-creator.jpg",
    "ugc-ad-video-scripted-talking-points.jpg",
    "ugc-ad-video-broll-phone-recording-food.jpg",
    "ugc-ad-video-creator-conversation-recording.jpg"
  ];
  const renderedUgcAssetPaths = Array.from(ugcAdVideoGeneration.matchAll(/\/assets\/dreamshoot\/ugc-ad-video\/([^"'?\\]+)/g)).map((match) => match[1]);
  assert.equal(new Set(renderedUgcAssetPaths).size, 8, "UGC Ad Video SSR must render eight unique topic assets");
  for (const assetPath of ugcAssetPaths) {
    assert.ok(renderedUgcAssetPaths.includes(assetPath), `UGC Ad Video SSR must render ${assetPath}`);
  }
  const normalizedUgcAdVideoGeneration = ugcAdVideoGeneration.toLowerCase();
  assert.doesNotMatch(normalizedUgcAdVideoGeneration, /first-party product evidence|v2 - real examples|pending capture|pending review|page differentiation \/ internal linking/, "UGC Ad Video SSR must not expose internal production notes");
  for (const label of [
    "ai ugc video generator",
    "what to make clear",
    "brief model",
    "natural script model",
    "creator-native framing",
    "how it works",
    "message testing",
    "which video format fits",
    "responsible use",
    "questions that belong on a ugc generator page"
  ]) {
    assert.ok(normalizedUgcAdVideoGeneration.includes(label), `UGC Ad Video SSR must expose the section label ${label}`);
  }
  const ugcRenderedMarkup = renderedMarkup(ugcAdVideoGeneration);
  const ugcSectionOrder = [
    "WHAT TO MAKE CLEAR",
    "UGC JOBS",
    "BRIEF MODEL",
    "NATURAL SCRIPT MODEL",
    "CREATOR-NATIVE FRAMING",
    "HOW IT WORKS",
    "MESSAGE TESTING",
    "WHICH VIDEO FORMAT FITS",
    "RESPONSIBLE USE",
    "FAQ",
    "CREATE WITH VERIFIED PRODUCT INPUTS"
  ].map((needle) => ugcRenderedMarkup.indexOf(needle));
  assert(ugcSectionOrder.every((index) => index >= 0) && ugcSectionOrder.every((index, position, values) => position === 0 || index > values[position - 1]), "UGC Ad Video SSR sections must follow the documented UGC order");
  assert.equal((ugcRenderedMarkup.match(/data-video-topic-use-case-card/g) ?? []).length, 6, "UGC Ad Video must render exactly six use-case cards");
  const ugcFaq = ugcAdVideoGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
  assert.equal(ugcFaq?.mainEntity?.length, 7, "UGC Ad Video JSON-LD must expose seven FAQ entries");
}
if (promoIsPublished) {
  assert.match(promoVideoGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/promo-video/, "Promo Video detail SSR must expose the canonical AI Video Generation URL");
  assert.equal(pageTitle(promoVideoGeneration), "AI Promo Video Maker for Launches, Offers &amp; Announcements | myDreamshoots", "Promo Video title must match the approved SEO title");
  assert.equal(
    metaDescription(promoVideoGeneration),
    "Create promotional videos for launches, limited-time offers, events, seasonal campaigns, and product updates with an AI promo video maker. Structure the message, proof, timing, terms, and CTA around verified product inputs and real generated outputs.",
    "Promo Video description must match the approved SEO description"
  );
  assert.match(
    promoVideoGeneration,
    /<meta name="keywords" content="AI promo video maker, AI promotional video maker, promo video generator, promotional video generator, AI marketing promo video, product launch video maker, sale promo video maker, event promo video generator, social media promo video maker"/,
    "Promo Video must expose the approved SEO keywords"
  );
  const promoAssetPaths = [
    "promo-video-product-launch-presentation.jpg",
    "promo-video-limited-time-offer-sale.jpg",
    "promo-video-event-announcement-conference.jpg",
    "promo-video-feature-release-laptop.jpg",
    "promo-video-seasonal-campaign-holiday-retail.jpg",
    "promo-video-social-promo-creator-setup.jpg",
    "promo-video-retail-sale-shopping.jpg",
    "promo-video-brand-activation-booth.jpg"
  ];
  const renderedPromoAssetPaths = Array.from(promoVideoGeneration.matchAll(/\/assets\/dreamshoot\/promo-video\/([^"'?\\]+)/g)).map((match) => match[1]);
  assert.equal(new Set(renderedPromoAssetPaths).size, 8, "Promo Video SSR must render eight unique topic assets");
  for (const assetPath of promoAssetPaths) {
    assert.ok(renderedPromoAssetPaths.includes(assetPath), `Promo Video SSR must render ${assetPath}`);
  }
  const normalizedPromoVideoGeneration = promoVideoGeneration.toLowerCase();
  assert.doesNotMatch(normalizedPromoVideoGeneration, /first-party product evidence|real promo examples|pending capture|pending review|page differentiation \/ internal linking/, "Promo Video SSR must not expose internal production notes");
  for (const label of [
    "what to make clear",
    "six promo video jobs",
    "promo brief model",
    "message hierarchy",
    "urgency without inventing scarcity",
    "how it works",
    "which video format fits",
    "responsible use"
  ]) {
    assert.ok(normalizedPromoVideoGeneration.includes(label), `Promo Video SSR must expose the section label ${label}`);
  }
  const promoFaq = promoVideoGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
  assert.equal(promoFaq?.mainEntity?.length, 8, "Promo Video JSON-LD must expose eight FAQ entries");
}
if (videoAdIsPublished) {
  const videoAdRenderedMarkup = renderedMarkup(videoAdGeneration);
  assert.match(videoAdGeneration, /https:\/\/www\.mydreamshoots\.com\/ai-video-generation\/video-ad/, "Video Ad detail SSR must expose the canonical AI Video Generation URL");
  assert.equal(pageTitle(videoAdGeneration), "AI Video Ad Generator for Paid Social | myDreamshoots", "Video Ad title must match the approved SEO title");
  assert.equal(
    metaDescription(videoAdGeneration),
    "Create video ad concepts with AI for paid social, product campaigns, launches, retargeting, and creator-style placements. Start from text or an image, shape the hook, proof, and CTA, then review the output in your myDreamshoots workflow.",
    "Video Ad description must match the approved SEO description"
  );
  assert.match(
    videoAdGeneration,
    /<meta name="keywords" content="ai video ad generator, paid social video ad generator, AI video ad maker, performance marketing video creator, paid social creative generator, campaign video variant creator"/,
    "Video Ad must expose the approved SEO keywords"
  );
  const videoAdAssetPaths = [
    "video-ad-creator-phone-tripod.jpg",
    "video-ad-ecommerce-shopping-intent.jpg",
    "video-ad-editing-variant-workflow.jpg",
    "video-ad-influencer-recording.jpg",
    "video-ad-performance-analytics.jpg",
    "video-ad-product-studio-shoot.jpg",
    "video-ad-social-feed-placement.jpg",
    "video-ad-social-platform-phone.jpg"
  ];
  const renderedVideoAdAssetPaths = Array.from(videoAdRenderedMarkup.matchAll(/\/assets\/dreamshoot\/video-ad\/([^"'?\\]+)/g)).map((match) => match[1]);
  assert.equal(new Set(renderedVideoAdAssetPaths).size, 8, "Video Ad SSR must render eight unique topic assets");
  for (const assetPath of videoAdAssetPaths) {
    assert.ok(renderedVideoAdAssetPaths.includes(assetPath), `Video Ad SSR must render ${assetPath}`);
  }
  const normalizedVideoAdGeneration = videoAdGeneration.toLowerCase();
  for (const label of [
    "what this creates",
    "style cues + best for",
    "how it works",
    "8 video-ad scene directions",
    "video ad guide",
    "start this video workflow",
    "video ad questions",
    "related pages"
  ]) {
    assert.ok(normalizedVideoAdGeneration.includes(label), `Video Ad SSR must expose the section label ${label}`);
  }
  assert.equal((videoAdRenderedMarkup.match(/data-video-ad-scene/g) ?? []).length, 8, "Video Ad must render exactly eight scene cards");
  assert.equal((videoAdRenderedMarkup.match(/data-video-ad-guide-card/g) ?? []).length, 5, "Video Ad must render exactly five guide cards");
  assert.equal((videoAdRenderedMarkup.match(/data-video-ad-step/g) ?? []).length, 4, "Video Ad must render exactly four workflow steps");
  assert.ok(videoAdRenderedMarkup.includes("data-video-ad-workspace"), "Video Ad must render the workspace evidence panel");
  const videoAdFaq = videoAdGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
  assert.equal(videoAdFaq?.mainEntity?.length, 6, "Video Ad JSON-LD must expose six FAQ entries");
}
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  if (!sitemapHasLoc(`https://${host}${pathname}`) || !html) continue;
  const slug = pathname.split("/").at(-1);
  const pageMarkup = renderedMarkup(html);
  assert.equal((pageMarkup.match(/data-video-topic-page=/g) ?? []).length, 1, `${pathname} must render the shared video topic page marker`);
  if (["brand-video", "music-video", "fashion-video", "food-video", "pet-video"].includes(slug)) {
    const sectionNames = slug === "brand-video"
      ? ["hero", "what-this-creates", "brand-story-map", "brand-signals", "how-it-works", "scene-gallery", "brand-consistency-guide", "workflow", "brand-integrity-review", "faq", "related-pages", "final-cta"]
      : ["hero", "what-this-creates", "visual-map", "how-it-works", "scene-gallery", "sequence-guide", "product-boundary", "workflow", "integrity-review", "faq", "related-pages", "final-cta"];
    for (const section of sectionNames) {
      assert.ok(pageMarkup.includes(`data-video-topic-section="${section}"`), `${pathname} must render the ${section} section`);
    }
    const sceneCardMarker = slug === "brand-video" ? "data-brand-video-scene" : "data-scene-topic-scene";
    assert.equal((pageMarkup.match(new RegExp(sceneCardMarker, "g")) ?? []).length, 8, `${pathname} must render exactly eight scene cards`);
    continue;
  }
  if (slug === "video-ad") {
    const sectionNames = ["hero", "what-this-creates", "style-cues", "how-it-works", "scene-gallery", "guide", "workflow", "faq", "related-pages", "final-cta"];
    for (const section of sectionNames) {
      assert.ok(pageMarkup.includes(`data-video-topic-section="${section}"`), `${pathname} must render the Video Ad ${section} section`);
    }
    assert.equal((pageMarkup.match(/data-video-ad-scene/g) ?? []).length, 8, `${pathname} must render exactly eight scene gallery cards`);
    assert.equal((pageMarkup.match(/data-video-ad-guide-card/g) ?? []).length, 5, `${pathname} must render exactly five guide cards`);
    assert.equal((pageMarkup.match(/data-video-ad-step/g) ?? []).length, 4, `${pathname} must render exactly four workflow steps`);
    assert.ok(pageMarkup.includes(`/app/create?videoMode=${slug}`), `${pathname} must expose a topic-specific workspace CTA`);
    continue;
  }
  assert.equal((pageMarkup.match(/<article[^>]+data-video-topic-use-case-card/g) ?? []).length, 6, `${pathname} must render exactly six use-case cards`);
  const sectionNames = slug === "ugc-ad-video"
    ? ["hero", "quick-answer", "use-cases", "foundation", "guidance", "creator-native-framing", "how-it-works", "value", "comparison", "trust", "faq", "final-cta"]
    : slug === "promo-video"
      ? ["hero", "quick-answer", "use-cases", "foundation", "guidance", "urgency", "how-it-works", "comparison", "trust", "faq", "final-cta"]
    : ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"];
  for (const section of sectionNames) {
    assert.ok(pageMarkup.includes(`data-video-topic-section="${section}"`), `${pathname} must render the shared ${section} section`);
  }
  const useCaseSection = pageMarkup.match(/data-video-topic-section="use-cases"[\s\S]*?data-video-topic-section="foundation"/)?.[0] ?? "";
  const imageUrls = Array.from(useCaseSection.matchAll(/<img[^>]+src=["']([^"']+)/g)).map((match) => match[1]);
  assert.equal(imageUrls.length, 6, `${pathname} use-case cards must each expose one image`);
  assert.equal(new Set(imageUrls).size, imageUrls.length, `${pathname} use-case images must be unique`);
  assert.equal(useCaseSection.includes('href="#how-it-works"'), false, `${pathname} use-case cards must not expose repeated anchor CTAs`);
  assert.ok(pageMarkup.includes(`/app/create?videoMode=${slug}`), `${pathname} must expose a topic-specific workspace CTA`);
}
assert.equal(memeVideoGeneration.includes("Meme Video Examples"), false, "Meme Video must not render the duplicate gallery heading");
assert.equal(memeVideoGeneration.includes("See More Meme Examples"), false, "Meme Video must not render the duplicate gallery CTA");
const sharedSectionOrder = ["hero", "use-cases", "foundation", "guidance", "steps", "value", "trust", "faq", "final-cta"];
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  if (!sitemapHasLoc(`https://${host}${pathname}`) || !html) continue;
  const slug = pathname.split("/").at(-1);
  const pageMarkup = renderedMarkup(html);
  const sectionOrder = slug === "ugc-ad-video"
      ? ["hero", "quick-answer", "use-cases", "foundation", "guidance", "creator-native-framing", "how-it-works", "value", "comparison", "trust", "faq", "final-cta"]
    : slug === "promo-video"
      ? ["hero", "quick-answer", "use-cases", "foundation", "guidance", "urgency", "how-it-works", "comparison", "trust", "faq", "final-cta"]
    : slug === "video-ad"
      ? ["hero", "what-this-creates", "style-cues", "how-it-works", "scene-gallery", "guide", "workflow", "faq", "related-pages", "final-cta"]
      : slug === "brand-video"
        ? ["hero", "what-this-creates", "brand-story-map", "brand-signals", "how-it-works", "scene-gallery", "brand-consistency-guide", "workflow", "brand-integrity-review", "faq", "related-pages", "final-cta"]
        : ["music-video", "fashion-video", "food-video", "pet-video"].includes(slug)
          ? ["hero", "what-this-creates", "visual-map", "how-it-works", "scene-gallery", "sequence-guide", "product-boundary", "workflow", "integrity-review", "faq", "related-pages", "final-cta"]
    : pageMarkup.includes('data-video-topic-section="supporting"')
      ? ["hero", "use-cases", "foundation", "guidance", "supporting", "steps", "value", "trust", "faq", "final-cta"]
      : sharedSectionOrder;
  const indexes = sectionOrder.map((section) => pageMarkup.indexOf(`data-video-topic-section="${section}"`));
  assert(indexes.every((index) => index >= 0) && indexes.every((index, position, values) => position === 0 || index > values[position - 1]), `${pathname} must keep the shared section order`);
}
if (productAdIsPublished) {
  const productAdRenderedMarkup = renderedMarkup(productAdVideoGeneration);
  const productAdSectionOrder = [
    "PLACEMENT ADAPTATION",
    "CHOOSE THE RIGHT VIDEO JOB",
    "FROM PRODUCT GOAL TO AD DRAFT",
    "MESSAGE TESTING WITHOUT CHANGING THE FACTS",
    "CREATE RESPONSIBLY"
  ].map((needle) => productAdRenderedMarkup.indexOf(needle));
  assert(productAdSectionOrder.every((index) => index >= 0) && productAdSectionOrder.every((index, position, values) => position === 0 || index > values[position - 1]), "Product Ad Video SSR sections must follow guidance, supporting content, how it works, and responsible storytelling order");
}
if (talkingPhotoGeneration) assert.ok(talkingPhotoGeneration.includes("/app/create#step-video") || talkingPhotoGeneration.includes("/app/create"), "Talking Photo CTA must point into the video workspace");
if (storyVideoGeneration) assert.ok(storyVideoGeneration.includes("/app/create#step-video") || storyVideoGeneration.includes("/app/create"), "Story Video CTA must point into the video workspace");
if (memeVideoGeneration) assert.ok(memeVideoGeneration.includes("/app/create") && memeVideoGeneration.includes("videoMode=meme-video"), "Meme Video CTA must point into the video workspace with its topic mode");
if (productVideoGeneration) assert.ok(productVideoGeneration.includes("/app/create") && productVideoGeneration.includes("videoMode=product-video"), "Product Video CTA must point into the video workspace with its topic mode");
if (productAdIsPublished) assert.ok(productAdVideoGeneration.includes("/app/create") && productAdVideoGeneration.includes("videoMode=product-ad-video"), "Product Ad Video CTA must point into the video workspace with its topic mode");
if (ugcAdIsPublished) assert.ok(ugcAdVideoGeneration.includes("/app/create") && ugcAdVideoGeneration.includes("videoMode=ugc-ad-video"), "UGC Ad Video CTA must point into the video workspace with its topic mode");
if (promoIsPublished) assert.ok(promoVideoGeneration.includes("/app/create") && promoVideoGeneration.includes("videoMode=promo-video"), "Promo Video CTA must point into the video workspace with its topic mode");
if (videoAdIsPublished) assert.ok(videoAdGeneration.includes("/app/create") && videoAdGeneration.includes("videoMode=video-ad"), "Video Ad CTA must point into the video workspace with its topic mode");
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  if (!html) continue;
  const pageName = pathname.split("/").at(-1) ?? pathname;
  for (const copy of ["what to prepare", "Credits held before creation", "Upload source images"]) {
    assert.equal(html.includes(copy), false, `${pageName} must not render the generic ai_tool_entry hero copy: ${copy}`);
  }
  const pageGraph = graphNodes(html);
  assert.ok(pageGraph.some((node) => node?.["@type"] === "Product" || node?.["@type"] === "Service"), `${pathname} must expose product or service JSON-LD`);
  const pageFaq = pageGraph.find((node) => node?.["@type"] === "FAQPage");
  assert.ok(Array.isArray(pageFaq?.mainEntity) && pageFaq.mainEntity.length >= 4, `${pathname} must expose its FAQ JSON-LD`);
}
if (talkingPhotoGeneration) assert.ok(talkingPhotoGenerationProducts.length >= 1, "Talking Photo detail SSR must expose product or service JSON-LD");
if (storyVideoGeneration) assert.ok(storyVideoGenerationProducts.length >= 1, "Story Video detail SSR must expose product or service JSON-LD");
if (memeVideoGeneration) assert.ok(memeVideoGenerationProducts.length >= 1, "Meme Video detail SSR must expose product or service JSON-LD");
if (productVideoGeneration) assert.ok(productVideoGenerationProducts.length >= 1, "Product Video detail SSR must expose product or service JSON-LD");
if (productAdIsPublished) assert.ok(productAdVideoGenerationProducts.length >= 1, "Product Ad Video detail SSR must expose product or service JSON-LD");
if (ugcAdIsPublished) assert.ok(ugcAdVideoGenerationProducts.length >= 1, "UGC Ad Video detail SSR must expose product or service JSON-LD");
if (promoIsPublished) assert.ok(promoVideoGenerationProducts.length >= 1, "Promo Video detail SSR must expose product or service JSON-LD");
if (videoAdIsPublished) assert.ok(videoAdGenerationProducts.length >= 1, "Video Ad detail SSR must expose product or service JSON-LD");
const productAdFaq = productAdVideoGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
if (productAdIsPublished) assert.equal(productAdFaq?.mainEntity?.length, 8, "Product Ad Video JSON-LD must expose eight FAQ entries");
const ugcFaq = ugcAdVideoGenerationGraph.find((node) => node?.["@type"] === "FAQPage");
if (ugcAdIsPublished) assert.equal(ugcFaq?.mainEntity?.length, 7, "UGC Ad Video JSON-LD must expose seven FAQ entries");
if (headshotIsPublished) {
  assert.equal(collectionProducts.length, 1, "collection SSR must contain one Product node");
  assert.ok(Array.isArray(collectionProduct?.image) && collectionProduct.image.length >= 2, "collection Product must contain page-owned image URLs");
  assert.equal(new Set(collectionProduct.image).size, collectionProduct.image.length, "collection Product image URLs must be unique");
  assert.equal(collectionProduct?.mainEntityOfPage, collectionProduct?.url, "collection Product must link to its visible page");
  assert.equal(collectionProduct?.subjectOf?.["@type"], "ImageObject", "collection Product must contain an ImageObject subject");
  assert.equal(collectionProduct?.subjectOf?.url, collectionProduct?.subjectOf?.contentUrl, "collection ImageObject url should match contentUrl");
  assert.equal(collectionProduct?.subjectOf?.thumbnailUrl, collectionProduct?.image?.[0], "collection ImageObject thumbnail should use the Product cover");
  assert.match(collectionProduct?.subjectOf?.encodingFormat ?? "", /^image\//, "collection ImageObject must expose image encodingFormat");
  assert.equal(collectionOffer, undefined, "collection Product must not expose a site-level subscription Offer");
  assert.ok((collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Credit cost"), "collection Product must expose credit cost");
  assert.ok((collectionProduct?.additionalProperty ?? []).some((property) => property?.name === "Output count"), "collection Product must expose output count");
}
assert.ok(sitemapHasLoc("https://www.mydreamshoots.com/pricing"), "sitemap must contain the canonical pricing URL");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/ai-image-generation/headshot"), headshotIsPublished, "headshot sitemap membership must match the active immutable snapshot");
for (const [pathname, html] of Object.entries(videoTopicGenerationByPath)) {
  assert.equal(sitemapHasLoc(`https://www.mydreamshoots.com${pathname}`), true, `${pathname} must remain in the sitemap for the published AI Video theme`);
}
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/ai-video-generation/product-ad-video"), productAdIsPublished, "Product Ad Video sitemap membership must match the published snapshot");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/ai-video-generation/ugc-ad-video"), ugcAdIsPublished, "UGC Ad Video sitemap membership must match the published snapshot");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/ai-video-generation/promo-video"), promoIsPublished, "Promo Video sitemap membership must match the published snapshot");
assert.equal(sitemapHasLoc("https://www.mydreamshoots.com/ai-video-generation/video-ad"), videoAdIsPublished, "Video Ad sitemap membership must match the published snapshot");
for (const forbidden of ["/collections/headshots", "/ai-photoshoot", "/tools/image-to-video", "/ai-video-generation/text-to-video", "/ai-video-generation/image-to-video"]) {
    assert.equal(sitemapHasLoc(`https://www.mydreamshoots.com${forbidden}`), false, `sitemap must not contain ${forbidden}`);
}
for (const legacyStatus of legacyCollectionStatuses) {
  assert.equal(legacyStatus.status, 404, `${legacyStatus.pathname} should return HTTP 404 after the collection slug migration`);
}
for (const legacyStatus of legacyToolRedirectStatuses) {
  assert.equal(legacyStatus.status, 404, `${legacyStatus.pathname} should stay retired after the AI Video Generation route migration`);
}
for (const hiddenStatus of hiddenVideoStatuses) {
  assert.equal(hiddenStatus.status, 404, `${hiddenStatus.pathname} should return HTTP 404 while hidden from public video topics`);
}

stopManagedServer();
console.log(JSON.stringify({
  ok: true,
  pages: ["/", "/site/mydreamshoots/", "/pricing", ...(headshotIsPublished ? [headshotPath] : []), ...Object.entries(videoTopicGenerationByPath).filter(([, html]) => Boolean(html)).map(([pathname]) => pathname), "/workflow", "/faq"],
  legacy404s: legacyCollectionStatuses.map(({ pathname, status }) => ({ pathname, status })),
  retiredTool404s: legacyToolRedirectStatuses.map(({ pathname, status }) => ({ pathname, status })),
  socialCardsRedirect: { status: socialCardsRedirect.status, location: socialCardsRedirect.headers.location },
  hiddenVideo404s: hiddenVideoStatuses.map(({ pathname, status }) => ({ pathname, status })),
  placeholders: 0,
  homepageVideoObjects: homepageVideos.length,
  talkingPhotoGenerationSchemaObjects: talkingPhotoGenerationProducts.length,
  storyVideoGenerationSchemaObjects: storyVideoGenerationProducts.length,
  memeVideoGenerationSchemaObjects: memeVideoGenerationProducts.length,
  productVideoGenerationSchemaObjects: productVideoGenerationProducts.length,
  productAdVideoGenerationSchemaObjects: productAdVideoGenerationProducts.length,
  collectionProductObjects: collectionProducts.length,
  collectionOfferPrice: collectionOffer?.price ?? null,
  providerBackedPrice: hasProviderBackedPrice
}, null, 2));
