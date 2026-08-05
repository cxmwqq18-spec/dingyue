#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const {
  buildCollectionDirectoryJsonLd,
  buildStorefrontJsonLd
} = jiti("../src/lib/theme/json-ld.ts");
const {
  canonicalSeoDirectoryPathForSite
} = jiti("../src/lib/dreamshoot-seo-content.ts");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

function graphNodes(nodes) {
  return nodes.flatMap((node) => Array.isArray(node?.["@graph"]) ? node["@graph"] : []);
}

function assertAbsoluteUrl(value, label) {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert.match(value, /^https:\/\/www\.mydreamshoots\.com\//, `${label} should be an absolute MyDreamShoots URL`);
}

function schemaSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const state = readJson("data/platform-state.json");
const site = state.sites.find((item) => item.id === "site_dreamshoot");
assert.ok(site, "MyDreamShoots site must exist");
assert.equal(site.primaryDomain, "www.mydreamshoots.com", "MyDreamShoots primary domain should stay production canonical");

const activePacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id && pack.status === "active");
const activeProducts = (state.products ?? []).filter((product) => product.siteId === site.id && product.status === "active");
const activeVideoThemes = (state.videoThemes ?? []).filter((theme) => theme.siteId === site.id && theme.status === "active");
const homePage = site.pages.find((page) => page.slug === "/");
const lowestUsdCents = Math.min(
  ...activeProducts.flatMap((product) => (product.prices ?? [])
    .filter((price) => price.siteId === site.id && String(price.currency).toLowerCase() === "usd")
    .map((price) => price.amountCents))
);

assert.equal(activePacks.length, 28, "MyDreamShoots should expose 28 active photo package themes");
assert.equal(activeProducts.length, 7, "MyDreamShoots should expose 7 active pricing products");
assert.equal(activeVideoThemes.length, 8, "MyDreamShoots should expose 8 active video themes");
assert.ok(homePage, "MyDreamShoots homepage should exist");

const homeGraph = graphNodes(buildStorefrontJsonLd({
  site,
  page: homePage,
  pageJson: homePage.publishedJson,
  pagePath: "/",
  routeMode: "host",
  creativePacks: activePacks,
  products: activeProducts,
  videoThemes: activeVideoThemes
}));
const videoObjects = homeGraph.filter((node) => node?.["@type"] === "VideoObject");
assert.equal(videoObjects.length, 8, "homepage JSON-LD should expose exactly 8 VideoObject nodes");
for (const video of videoObjects) {
  assert.ok(video.name, "VideoObject should include name");
  assert.ok(video.description, "VideoObject should include description");
  assert.match(video.duration, /^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?$/, "VideoObject duration should be ISO 8601");
  assert.match(video.uploadDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "VideoObject uploadDate should be ISO timestamp");
  assert.ok(Array.isArray(video.thumbnailUrl) && video.thumbnailUrl.length === 1, "VideoObject should include one thumbnail URL");
  assertAbsoluteUrl(video.thumbnailUrl[0], "VideoObject thumbnailUrl");
  assertAbsoluteUrl(video.contentUrl, "VideoObject contentUrl");
}

const productPaths = new Set();
for (const pack of activePacks) {
  const canonicalPath = canonicalSeoDirectoryPathForSite(site, "collection", pack.category || pack.name);
  productPaths.add(canonicalPath);
  const collectionSlug = canonicalPath.split("/").pop();
  const graph = graphNodes(buildCollectionDirectoryJsonLd({
    site,
    collectionSlug,
    routeMode: "host",
    creativePacks: activePacks,
    products: activeProducts
  }));
  const products = graph.filter((node) => node?.["@type"] === "Product");
  assert.equal(products.length, 1, `${canonicalPath} should expose one Product node`);
  const product = products[0];
  assert.equal(schemaSlug(product.name), schemaSlug(pack.name), `${canonicalPath} Product name should match the package`);
  assertAbsoluteUrl(product.url, `${canonicalPath} Product url`);
  assert.ok(Array.isArray(product.image) && product.image.length >= 1, `${canonicalPath} Product should include image`);
  assertAbsoluteUrl(product.image[0], `${canonicalPath} Product image`);
  assert.equal(product.sku, pack.id, `${canonicalPath} Product sku should use pack id`);
  assert.equal(product.subjectOf?.["@type"], "ImageObject", `${canonicalPath} Product subjectOf should be ImageObject`);
  assertAbsoluteUrl(product.subjectOf.contentUrl, `${canonicalPath} ImageObject contentUrl`);
  assert.equal(product.offers?.["@type"], "Offer", `${canonicalPath} Product should include one Offer`);
  assertAbsoluteUrl(product.offers.url, `${canonicalPath} Offer url`);
  assert.equal(product.offers.availability, "https://schema.org/InStock", `${canonicalPath} availability should use schema.org URL`);
  assert.equal(product.offers.itemCondition, "https://schema.org/NewCondition", `${canonicalPath} itemCondition should use schema.org URL`);
  assert.equal(product.offers.priceCurrency, "USD", `${canonicalPath} offer currency should be USD`);
  assert.match(product.offers.price, /^\d+\.\d{2}$/, `${canonicalPath} offer price should be a decimal string`);
  assert.equal(Math.round(Number(product.offers.price) * 100), lowestUsdCents, `${canonicalPath} offer should use the lowest active USD price`);
  const propertyNames = new Set((product.additionalProperty ?? []).map((property) => property.name));
  assert.ok(propertyNames.has("Credit cost"), `${canonicalPath} should expose credit cost as additionalProperty`);
  assert.ok(propertyNames.has("Output count"), `${canonicalPath} should expose output count as additionalProperty`);
}
assert.equal(productPaths.size, 28, "each active pack should map to a unique canonical Product detail path");
assert.equal(homeGraph.some((node) => node?.["@type"] === "Review" || node?.["@type"] === "AggregateRating"), false, "homepage JSON-LD should not emit review rating schema without a real review source");

console.log(JSON.stringify({
  ok: true,
  products: productPaths.size,
  videos: videoObjects.length,
  lowestOffer: videoObjects.length ? "validated" : "missing"
}, null, 2));
