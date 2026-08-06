#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3010").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";

function fetchText(pathname, accept, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, `${baseUrl}/`);
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      headers: { accept, host }
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", async () => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirectCount < 5) {
          const nextUrl = new URL(location, url);
          const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
          resolve(await fetchText(nextPath, accept, redirectCount + 1));
          return;
        }
        resolve({ body: chunks.join(""), headers: response.headers, status });
      });
    });
    request.on("error", reject);
    request.end();
  });
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

const homepage = await fetchHtml("/");
const pricing = await fetchHtml("/pricing");
const collection = await fetchHtml("/collections/professional-headshots");
const workflow = await fetchHtml("/workflow");
const faq = await fetchHtml("/faq");
const sitemap = (await fetchText("/sitemap.xml", "application/xml")).body;
const homepageGraph = graphNodes(homepage);
const collectionGraph = graphNodes(collection);
const homepageVideos = homepageGraph.filter((node) => node?.["@type"] === "VideoObject");
const collectionProducts = collectionGraph.filter((node) => node?.["@type"] === "Product");
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
const publicHtmlPages = {
  homepage,
  pricing,
  collection,
  workflow,
  faq
};

for (const [pageName, html] of Object.entries(publicHtmlPages)) {
  for (const copy of forbiddenLoadingCopy) {
    assert.equal(html.includes(copy), false, `${pageName} must not SSR loading placeholder copy: ${copy}`);
  }
}
assert.ok(pricing.includes("Starter") && (pricing.includes("$24.50") || pricing.includes("24.50")), "pricing HTML must contain real plan content");
assert.equal(homepageVideos.length, 8, "homepage SSR must contain 8 VideoObject nodes");
for (const video of homepageVideos) {
  assert.equal(video.encodingFormat, "video/mp4", "homepage VideoObject must expose video encodingFormat");
  assert.equal(video.publisher?.["@id"], "https://www.mydreamshoots.com#organization", "homepage VideoObject must connect to the Organization publisher");
  assert.equal(video.potentialAction?.["@type"], "WatchAction", "homepage VideoObject must expose WatchAction");
  assert.match(video.potentialAction?.target ?? "", /^https:\/\/www\.mydreamshoots\.com\/assets\/.+\.mp4(?:[?#].*)?$/, "homepage VideoObject WatchAction target must be an absolute MP4 asset");
  assert.equal(video.thumbnail?.["@type"], "ImageObject", "homepage VideoObject must include an ImageObject thumbnail");
  assert.equal(video.thumbnail?.contentUrl, video.thumbnailUrl?.[0], "homepage VideoObject thumbnail ImageObject must reuse thumbnailUrl");
}
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
assert.ok(sitemap.includes("https://www.mydreamshoots.com/collections/headshots"), "sitemap must contain the canonical headshots URL");

console.log(JSON.stringify({
  ok: true,
  pages: ["/", "/pricing", "/collections/professional-headshots", "/workflow", "/faq"],
  placeholders: 0,
  homepageVideoObjects: homepageVideos.length,
  collectionProductObjects: collectionProducts.length,
  collectionOfferPrice: collectionOffer.price
}, null, 2));
