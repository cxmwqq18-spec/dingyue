#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const serverOnlyStub = path.join(repoRoot, "scripts", "server-only-stub.js");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request === "server-only") return serverOnlyStub;
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
const {
  getStorefrontSitemapEntriesForHost
} = jiti("../src/lib/seo-indexing.ts");

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

function assertMydreamshootsEntityId(value, label) {
  assert.equal(typeof value, "string", `${label} should be a string`);
  assert.match(value, /^https:\/\/www\.mydreamshoots\.com(?:\/|#)/, `${label} should be a MyDreamShoots schema @id`);
}

function assertUnique(values, label) {
  assert.equal(new Set(values).size, values.length, `${label} should not contain duplicate values`);
}

function assertPositiveInteger(value, label) {
  assert.equal(Number.isInteger(value), true, `${label} should be an integer`);
  assert.ok(value > 0, `${label} should be positive`);
}

function assertPublicAssetUrl(value, label) {
  assertAbsoluteUrl(value, label);
  const url = new URL(value);
  assert.ok(url.pathname.startsWith("/assets/"), `${label} should point at a public storefront asset`);
  const assetPath = path.join(repoRoot, "public", url.pathname.replace(/^\/+/, ""));
  assert.ok(fs.existsSync(assetPath), `${label} should exist on disk: ${assetPath}`);
  return assetPath;
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
assert.equal(activeVideoThemes.length, 9, "MyDreamShoots should retain 9 active video themes including the internal-only Creator Scene Motion preset");
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
assert.ok(!videoObjects.some((video) => schemaSlug(video.name) === "creator-scene-motion"), "homepage JSON-LD must not expose Creator Scene Motion");
for (const video of videoObjects) {
  assertMydreamshootsEntityId(video["@id"], "VideoObject @id");
  assert.ok(video.name, "VideoObject should include name");
  assert.ok(video.description, "VideoObject should include description");
  assert.match(video.duration, /^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?$/, "VideoObject duration should be ISO 8601");
  assert.match(video.uploadDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "VideoObject uploadDate should be ISO timestamp");
  assert.equal(video.encodingFormat, "video/mp4", "VideoObject should declare an MP4 encodingFormat");
  assert.equal(video.mainEntityOfPage, "https://www.mydreamshoots.com/", "VideoObject should link back to the visible homepage");
  assert.equal(video.isPartOf?.["@id"], "https://www.mydreamshoots.com#website", "VideoObject should connect to the WebSite entity");
  assert.equal(video.publisher?.["@id"], "https://www.mydreamshoots.com#organization", "VideoObject should connect to the Organization publisher");
  assert.equal(video.potentialAction?.["@type"], "WatchAction", "VideoObject should expose a WatchAction");
  assertAbsoluteUrl(video.potentialAction?.target, "VideoObject WatchAction target");
  assert.ok(Array.isArray(video.thumbnailUrl) && video.thumbnailUrl.length === 1, "VideoObject should include one thumbnail URL");
  assertPublicAssetUrl(video.thumbnailUrl[0], "VideoObject thumbnailUrl");
  assertPublicAssetUrl(video.contentUrl, "VideoObject contentUrl");
  assert.equal(video.thumbnail?.["@type"], "ImageObject", "VideoObject thumbnail should be an ImageObject");
  assert.equal(video.thumbnail?.contentUrl, video.thumbnailUrl[0], "VideoObject thumbnail ImageObject should reuse thumbnailUrl");
  assert.equal(video.thumbnail?.encodingFormat, "image/webp", "VideoObject thumbnail should declare image/webp encoding");
  assertPositiveInteger(video.thumbnail?.width, "VideoObject thumbnail width");
  assertPositiveInteger(video.thumbnail?.height, "VideoObject thumbnail height");
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
  assertMydreamshootsEntityId(product["@id"], `${canonicalPath} Product @id`);
  assert.equal(schemaSlug(product.name), schemaSlug(pack.name), `${canonicalPath} Product name should match the package`);
  assertAbsoluteUrl(product.url, `${canonicalPath} Product url`);
  assert.equal(product.mainEntityOfPage, product.url, `${canonicalPath} Product should link to its visible page`);
  assert.ok(Array.isArray(product.image) && product.image.length === 8, `${canonicalPath} Product should include cover plus gallery image URLs`);
  assertUnique(product.image, `${canonicalPath} Product images`);
  for (const [index, imageUrl] of product.image.entries()) {
    assertPublicAssetUrl(imageUrl, `${canonicalPath} Product image ${index + 1}`);
  }
  assert.ok(product.image[0].includes("/pack-covers/"), `${canonicalPath} first Product image should be the package cover`);
  assert.ok(product.image.some((imageUrl) => imageUrl.includes("/pack-galleries/")), `${canonicalPath} Product images should include gallery previews`);
  assert.equal(product.sku, pack.id, `${canonicalPath} Product sku should use pack id`);
  assert.equal(product.brand?.name, "MyDreamShoots", `${canonicalPath} Product brand should use the plain SEO brand name`);
  assert.equal(product.subjectOf?.["@type"], "ImageObject", `${canonicalPath} Product subjectOf should be ImageObject`);
  assertMydreamshootsEntityId(product.subjectOf?.["@id"], `${canonicalPath} ImageObject @id`);
  assertPublicAssetUrl(product.subjectOf.contentUrl, `${canonicalPath} ImageObject contentUrl`);
  assert.equal(product.subjectOf.url, product.subjectOf.contentUrl, `${canonicalPath} ImageObject url should match contentUrl`);
  assert.equal(product.subjectOf.thumbnailUrl, product.image[0], `${canonicalPath} ImageObject thumbnail should use the package cover`);
  assert.match(product.subjectOf.encodingFormat, /^image\//, `${canonicalPath} ImageObject should declare an image encodingFormat`);
  assert.equal(product.subjectOf.representativeOfPage, true, `${canonicalPath} ImageObject should be representative of the page`);
  assertPositiveInteger(product.subjectOf.width, `${canonicalPath} ImageObject width`);
  assertPositiveInteger(product.subjectOf.height, `${canonicalPath} ImageObject height`);
  assert.equal(product.offers?.["@type"], "Offer", `${canonicalPath} Product should include one Offer`);
  assertMydreamshootsEntityId(product.offers?.["@id"], `${canonicalPath} Offer @id`);
  assertAbsoluteUrl(product.offers.url, `${canonicalPath} Offer url`);
  assert.equal(product.offers.availability, "https://schema.org/InStock", `${canonicalPath} availability should use schema.org URL`);
  assert.equal(product.offers.itemCondition, "https://schema.org/NewCondition", `${canonicalPath} itemCondition should use schema.org URL`);
  assert.equal(product.offers.priceCurrency, "USD", `${canonicalPath} offer currency should be USD`);
  assert.match(product.offers.price, /^\d+\.\d{2}$/, `${canonicalPath} offer price should be a decimal string`);
  assert.equal(Math.round(Number(product.offers.price) * 100), lowestUsdCents, `${canonicalPath} offer should use the lowest active USD price`);
  const propertyNames = new Set((product.additionalProperty ?? []).map((property) => property.name));
  assert.ok(propertyNames.has("Credit cost"), `${canonicalPath} should expose credit cost as additionalProperty`);
  assert.ok(propertyNames.has("Output count"), `${canonicalPath} should expose output count as additionalProperty`);
  assert.equal(
    (product.additionalProperty ?? []).find((property) => property.name === "Credit cost")?.value,
    pack.creditCost,
    `${canonicalPath} credit cost should match the package`
  );
  assert.equal(
    (product.additionalProperty ?? []).find((property) => property.name === "Output count")?.value,
    pack.outputCount,
    `${canonicalPath} output count should match the package`
  );
}
assert.equal(productPaths.size, 28, "each active pack should map to a unique canonical Product detail path");
assert.equal(homeGraph.some((node) => node?.["@type"] === "Review" || node?.["@type"] === "AggregateRating"), false, "homepage JSON-LD should not emit review rating schema without a real review source");

const sitemapEntries = await getStorefrontSitemapEntriesForHost(["www.mydreamshoots.com"]);
const sitemapEntryByPath = new Map(sitemapEntries.map((entry) => [new URL(entry.loc).pathname, entry]));
function assertRichSitemapImageTitle(image, pathName) {
  const title = String(image.title ?? "").replace(/\s+/g, " ").trim();
  assert.ok(title, `${pathName} image sitemap entry should include a title`);
  assert.ok(title.split(/\s+/).length >= 8, `${pathName} image sitemap title should be descriptive: ${title}`);
  assert.doesNotMatch(title, /https?:\/\/|\/assets\//i, `${pathName} image sitemap title should not contain a URL`);
  assert.doesNotMatch(title, /Aidreamcapes/i, `${pathName} image sitemap title should not mention another brand`);
  assert.doesNotMatch(title, /^(?:image|photo|preview|thumbnail|hero|.+\s+preview)$/i, `${pathName} image sitemap title should not be a placeholder: ${title}`);
}
assert.ok((sitemapEntryByPath.get("/collections")?.images ?? []).length > 0, "collections sitemap entry should include image references");
for (const pathName of ["/", "/pricing", "/workflow", "/faq", "/blog"]) {
  const entry = sitemapEntryByPath.get(pathName);
  assert.ok(entry, `${pathName} sitemap entry should exist`);
  assert.ok((entry.images ?? []).length > 0, `${pathName} sitemap entry should include image references`);
  for (const image of entry.images.slice(0, 3)) {
    assert.match(image.loc, /^https:\/\/www\.mydreamshoots\.com\//, `${pathName} image sitemap loc should be absolute`);
  }
}
for (const pack of activePacks) {
  const canonicalPath = canonicalSeoDirectoryPathForSite(site, "collection", pack.category || pack.name);
  const entry = sitemapEntryByPath.get(canonicalPath);
  assert.ok(entry, `${canonicalPath} should appear in the sitemap`);
  assert.ok((entry.images ?? []).length > 0, `${canonicalPath} should include image sitemap entries`);
  for (const image of entry.images) {
    assert.match(image.loc, /^https:\/\/www\.mydreamshoots\.com\//, `${canonicalPath} image sitemap loc should be absolute`);
    assertRichSitemapImageTitle(image, canonicalPath);
  }
}

console.log(JSON.stringify({
  ok: true,
  products: productPaths.size,
  videos: videoObjects.length,
  lowestOffer: videoObjects.length ? "validated" : "missing",
  mediaUrls: "validated"
}, null, 2));
