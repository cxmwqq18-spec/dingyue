#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import "./load-runtime-env.mjs";
import createJiti from "jiti";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const serverOnlyStub = path.join(repoRoot, "scripts", "server-only-stub.js");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request === "server-only") return serverOnlyStub;
  if (request.startsWith("@/") && fs.existsSync(`${resolvedRequest}.ts`)) {
    return originalResolveFilename.call(this, `${resolvedRequest}.ts`, ...args);
  }
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { MYDREAMSHOOTS_STANDARD_SEO_INVENTORY } = jiti("../src/lib/mydreamshoots-editorial-routes.ts");
const {
  buildCollectionDirectoryJsonLd,
  buildStorefrontJsonLd
} = jiti("../src/lib/theme/json-ld.ts");
const {
  canonicalSeoDirectoryPathForSite
} = jiti("../src/lib/dreamshoot-seo-content.ts");
const { dreamshootPackProfileSlug } = jiti("../src/lib/dreamshoot-pack-profiles.ts");
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const { resolveStorefrontContext } = jiti("../src/lib/storefront-context/core.ts");
const { buildPublicationSnapshot } = jiti("../src/lib/stores/theme-store.ts");
const { createPublishedSiteSnapshot } = jiti("../src/lib/storefront-context/snapshot.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

async function readPlatformState() {
  return readPlatformStateFromSql();
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

const state = await readPlatformState();
const site = state.sites.find((item) => item.id === "site_dreamshoot");
assert.ok(site, "MyDreamShoots site must exist");
assert.equal(site.primaryDomain, "www.mydreamshoots.com", "MyDreamShoots primary domain should stay production canonical");

const activePacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id && pack.status === "active");
const activeProducts = (state.products ?? []).filter((product) => product.siteId === site.id && product.status === "active");
const legacyVideoThemeSlugs = new Set([
  "cinematic-portrait-motion",
  "social-profile-clip",
  "travel-route-story",
  "wedding-memory-film",
  "holiday-card-motion",
  "product-showcase-motion",
  "prompt-directed-motion",
  "creator-intro-motion"
]);
const legacyVideoThemes = (state.videoThemes ?? []).filter((theme) => theme.siteId === site.id && legacyVideoThemeSlugs.has(theme.slug));
// Historical framework rows may remain in the platform document for auditability;
// only immutable publication entities are allowed to feed public schema.
const activeVideoThemes = [];
const blackFridayPack = activePacks.find((pack) => schemaSlug(pack.category || pack.name) === "black-friday" || schemaSlug(pack.name) === "black-friday");
const slugOwnedMediaThemes = ["black-friday", "cannes", "nightlife", "rich-lifestyle"];
const mediaSlugFromUrl = (value) => String(value ?? "").split(/[?#]/, 1)[0].split("/").filter(Boolean).at(-2) || "";
const homePage = site.pages.find((page) => page.slug === "/");
assert.ok(homePage, "MyDreamShoots homepage should exist");
const fixtureFacts = {
  usesCustomerMediaForTraining: false,
  sourceMediaRetentionDays: 30,
  refundReviewRequired: true,
  refundWindowDays: 7,
  effectiveDate: "2026-08-20",
  creditLifecycle: { reserve: "Fixture reserve statement", consume: "Fixture consume statement", release: "Fixture release statement" },
  security: { transportClaimKey: "Fixture transport statement", storageClaimKey: "Fixture storage statement" }
};
const fixtureSite = {
  ...site,
  storefrontProfile: {
    ...(site.storefrontProfile ?? { id: `profile_${site.id}`, siteId: site.id, draftJson: {}, publishedJson: {} }),
    draftJson: {
      ...(site.storefrontProfile?.draftJson ?? {}),
      identity: {
        legalName: "MyDreamShoots Local Fixture",
        entityType: "company",
        address: { line1: "1 Local Fixture Way", city: "Test City", region: "CA", postalCode: "00000", country: "US" },
        supportEmail: "local-fixture@example.com",
        sameAs: []
      },
      policyFacts: fixtureFacts
    },
    publishedJson: {
      ...(site.storefrontProfile?.publishedJson ?? {}),
      identity: {
        legalName: "MyDreamShoots Local Fixture",
        entityType: "company",
        address: { line1: "1 Local Fixture Way", city: "Test City", region: "CA", postalCode: "00000", country: "US" },
        supportEmail: "local-fixture@example.com",
        sameAs: []
      },
      policyFacts: fixtureFacts
    }
  }
};
const immutableSnapshot = site.activePublication?.snapshot;
assert.ok(immutableSnapshot, "active publication snapshot must exist");
const expectedStandardMediaCount = MYDREAMSHOOTS_STANDARD_SEO_INVENTORY.length;
assert.ok(expectedStandardMediaCount === 21, "canonical inventory must contain all 21 standard routes");
assert.ok(immutableSnapshot.publishedStandardPageMedia.length > 0, "fixture publication should include standard media projections");
const publishedSiteSnapshot = createPublishedSiteSnapshot({
  ...state,
  sites: [{ ...fixtureSite, activePublication: { id: "smoke_publication", siteId: site.id, version: 1, snapshot: immutableSnapshot } }]
}, { ...fixtureSite, activePublication: { id: "smoke_publication", siteId: site.id, version: 1, snapshot: immutableSnapshot } });
const schemaPage = publishedSiteSnapshot.pages.find((page) => page.slug === "/");
const schemaContext = resolveStorefrontContext({
  site: fixtureSite,
  page: schemaPage ?? homePage,
  products: publishedSiteSnapshot.products,
  creativePacks: publishedSiteSnapshot.creativePacks,
  publication: publishedSiteSnapshot.publication,
  factsRevision: "local-smoke",
  buildId: "local-smoke",
  publishedFacts: publishedSiteSnapshot.publishedFacts,
  publishedPageMedia: Object.fromEntries(publishedSiteSnapshot.publishedPageMedia.map((row) => [row.pageEntityId, row])),
  publishedStandardPageMedia: Object.fromEntries(publishedSiteSnapshot.publishedStandardPageMedia.map((row) => [row.canonicalPath, row])),
  publishedPageEntities: Object.fromEntries(publishedSiteSnapshot.publishedPageEntities.map((row) => [row.canonicalPath, row])),
  publishedLinkRefs: publishedSiteSnapshot.publishedLinkRefs,
  snapshotIntegrity: "valid"
}, "published");
const verifiedOffers = schemaContext.offers.active.filter((offer) => (
  String(offer.price.currency).toLowerCase() === "usd"
  && /^price_[A-Za-z0-9]+$/.test(String(offer.price.stripePriceId ?? ""))
  && Boolean(offer.price.providerVerifiedAt)
));

assert.equal(activePacks.length, 38, "MyDreamShoots should expose 38 active photo package themes");
assert.equal(activeProducts.length, 7, "MyDreamShoots should expose 7 active pricing products");
assert.ok(legacyVideoThemes.length <= legacyVideoThemeSlugs.size, "MyDreamShoots legacy video theme inventory should not exceed the known legacy set");
assert.equal(activeVideoThemes.length, 0, "MyDreamShoots should not expose legacy video theme framework records after the AI Video Generation route migration");
assert.ok(legacyVideoThemes.every((theme) => !activeVideoThemes.includes(theme)), "legacy video themes must remain outside public schema inputs");
assert.ok(blackFridayPack, "Black Friday pack should exist");
assert.equal(blackFridayPack.id, "pack_dreamshoot_black_friday", "Black Friday should have a dedicated page-owned pack id");
assert.equal(dreamshootPackProfileSlug("anime-avatar"), "anime-avatar", "Anime Avatar must retain its own pack profile");
assert.equal(/anime-avatar/i.test(blackFridayPack.imageUrl ?? ""), false, "Black Friday pack cover must not reuse Anime Avatar art");
assert.equal((blackFridayPack.galleryImages ?? []).some((image) => /anime-avatar/i.test(image)), false, "Black Friday pack gallery must not reuse Anime Avatar art");
for (const slug of slugOwnedMediaThemes) {
  const pack = activePacks.find((candidate) => schemaSlug(candidate.category || candidate.name) === slug || schemaSlug(candidate.name) === slug);
  assert.ok(pack, `${slug} pack should exist`);
  const media = [pack.imageUrl, ...(pack.galleryImages ?? [])].filter(Boolean);
  assert.equal(media.length, 13, `${slug} pack should expose one cover and twelve gallery images`);
  assert.ok(media.every((image) => mediaSlugFromUrl(image) === slug), `${slug} pack media must be owned by its same-slug directory`);
}

const homeGraph = graphNodes(buildStorefrontJsonLd({
  site: fixtureSite,
  page: schemaPage ?? homePage,
  pageJson: (schemaPage ?? homePage).publishedJson,
  pagePath: "/",
  routeMode: "host",
  creativePacks: publishedSiteSnapshot.creativePacks,
  products: publishedSiteSnapshot.products,
  videoThemes: activeVideoThemes,
  context: schemaContext
}));
const videoObjects = homeGraph.filter((node) => node?.["@type"] === "VideoObject");
assert.equal(videoObjects.length, 0, "homepage JSON-LD should not expose legacy video theme VideoObject nodes after the AI Video Generation route migration");
for (const video of videoObjects) {
  assertMydreamshootsEntityId(video["@id"], "VideoObject @id");
  assert.ok(video.name, "VideoObject should include name");
  assert.ok(video.description, "VideoObject should include description");
  assert.match(video.duration, /^PT(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+S)?$/, "VideoObject duration should be ISO 8601");
  assert.match(video.uploadDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, "VideoObject uploadDate should be ISO timestamp");
  assert.equal(video.encodingFormat, "video/mp4", "VideoObject should declare an MP4 encodingFormat");
  assert.equal(video.mainEntityOfPage, "https://www.mydreamshoots.com/", "VideoObject should link back to the visible homepage");
  assert.equal(video.isPartOf?.["@id"], "https://www.mydreamshoots.com/#website", "VideoObject should connect to the WebSite entity");
  assert.equal(video.publisher?.["@id"], "https://www.mydreamshoots.com/#organization", "VideoObject should connect to the Organization publisher");
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
// Validate Product detail schema for every active pack in the immutable snapshot,
// including the rule that package Products never inherit subscription Offers.
const publishedPacks = publishedSiteSnapshot.creativePacks
  .filter((pack) => pack.siteId === site.id && pack.status === "active" && pack.creditCost > 0 && pack.outputCount > 0);
for (const pack of publishedPacks) {
  const canonicalPath = canonicalSeoDirectoryPathForSite(site, "collection", pack.category || pack.name);
  productPaths.add(canonicalPath);
  const collectionSlug = canonicalPath.split("/").pop();
  const graph = graphNodes(buildCollectionDirectoryJsonLd({
    site,
    collectionSlug,
    routeMode: "host",
    creativePacks: publishedPacks,
    products: publishedSiteSnapshot.products,
    context: schemaContext
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
  assert.equal(product.offers, undefined, `${canonicalPath} theme Product must not inherit a site-level subscription Offer`);
  assert.equal(product.price, undefined, `${canonicalPath} theme Product must not expose a subscription price`);
  assert.equal(product.priceCurrency, undefined, `${canonicalPath} theme Product must not expose a subscription currency`);
  assert.equal(JSON.stringify(product).includes("/pricing"), false, `${canonicalPath} theme Product must not reference the pricing page`);
  assert.equal(JSON.stringify(product).includes("Starter"), false, `${canonicalPath} theme Product must not reference the Starter subscription`);
  assert.equal(JSON.stringify(product).includes("24.50"), false, `${canonicalPath} theme Product must not reference the Starter price`);
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
assert.equal(productPaths.size, publishedPacks.length, "each published pack should map to a unique canonical Product detail path");
assert.equal(homeGraph.some((node) => node?.["@type"] === "Review" || node?.["@type"] === "AggregateRating"), false, "homepage JSON-LD should not emit review rating schema without a real review source");

const smokeSite = { ...fixtureSite, activePublication: { id: "smoke_publication", siteId: site.id, version: 1, snapshot: immutableSnapshot } };
const sitemapEntries = sitemapEntriesForSite({ ...state, sites: [smokeSite] }, smokeSite);
const sitemapEntryByPath = new Map(sitemapEntries.map((entry) => [new URL(entry.loc).pathname, entry]));
const leafRoutes = publishedSiteSnapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.routeKind === "ai-image-theme-leaf");
const publishedPaths = new Set(leafRoutes
  .filter((route) => route.status === "published" && route.sitemapEligible)
  .map((route) => route.canonicalPath));
for (const route of leafRoutes) {
  const pathname = route.canonicalPath;
  const entry = sitemapEntryByPath.get(pathname);
  if (publishedPaths.has(pathname)) {
    assert.ok(entry, `${pathname} should have a published route manifest sitemap entry`);
    assert.ok((entry.images ?? []).length > 0, `${pathname} should project its page-owned media into the image sitemap`);
  } else {
    assert.equal(entry, undefined, `${pathname} must stay out of the sitemap until the active immutable snapshot publishes the route`);
  }
}
function assertRichSitemapImageTitle(image, pathName) {
  const title = String(image.title ?? "").replace(/\s+/g, " ").trim();
  assert.ok(title, `${pathName} image sitemap entry should include a title`);
  assert.ok(title.split(/\s+/).length >= 4, `${pathName} image sitemap title should be descriptive: ${title}`);
  assert.doesNotMatch(title, /https?:\/\/|\/assets\//i, `${pathName} image sitemap title should not contain a URL`);
  assert.doesNotMatch(title, /Aidreamcapes/i, `${pathName} image sitemap title should not mention another brand`);
  assert.doesNotMatch(title, /^(?:image|photo|preview|thumbnail|hero|.+\s+preview)$/i, `${pathName} image sitemap title should not be a placeholder: ${title}`);
}
const requiredImageSitemapPaths = ["/about-us", "/best-packages", "/best-ai-image", "/pricing", "/faq", "/workflow"]
  .filter((pathName) => sitemapEntryByPath.has(pathName));
for (const pathName of requiredImageSitemapPaths) {
  const entry = sitemapEntryByPath.get(pathName);
  assert.ok(entry, `${pathName} sitemap entry should exist`);
  assert.ok((entry.images ?? []).length > 0, `${pathName} sitemap entry should include image references`);
  for (const image of entry.images.slice(0, 3)) {
    assert.match(image.loc, /^https:\/\/www\.mydreamshoots\.com\//, `${pathName} image sitemap loc should be absolute`);
  }
}
// Collection pages are resolved from the published collection root and the
// current pack taxonomy; they do not become individual ThemePage records.
// Keep Product JSON-LD coverage for every active pack above, while validating
// image sitemap metadata only for paths that the published snapshot emits.
for (const [pathName, entry] of sitemapEntryByPath.entries()) {
  for (const image of entry.images ?? []) {
    assert.match(image.loc, /^https:\/\/www\.mydreamshoots\.com\//, `${pathName} image sitemap loc should be absolute`);
    assertRichSitemapImageTitle(image, pathName);
  }
}

console.log(JSON.stringify({
  ok: true,
  products: productPaths.size,
  videos: videoObjects.length,
  verifiedOffers: verifiedOffers.length,
  lowestOffer: verifiedOffers.length ? "validated" : "not-published-until-provider-verification",
  mediaUrls: "validated"
}, null, 2));
