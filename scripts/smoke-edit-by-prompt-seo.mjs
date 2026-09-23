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
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request === "server-only") return serverOnlyStub;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { createPublishedSiteSnapshot } = jiti("../src/lib/storefront-context/snapshot.ts");
const { resolveStorefrontContext } = jiti("../src/lib/storefront-context/core.ts");
const { buildCollectionDirectoryJsonLd } = jiti("../src/lib/theme/json-ld.ts");
const { canonicalSeoDirectoryPathForSite } = jiti("../src/lib/dreamshoot-seo-content.ts");
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const { mydreamshootsPageCopyForRoute } = jiti("../src/lib/mydreamshoots-page-copy.ts");
const { metadataForPublishedStorefrontDirectoryPage } = jiti("../src/lib/storefront-metadata.ts");

const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
assert.ok(site, "MyDreamShoots site must exist");
const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
const canonicalPath = canonicalSeoDirectoryPathForSite(site, "collection", "edit-by-prompt");
const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === canonicalPath);
assert.ok(route, "Edit By Prompt route must exist");
assert.equal(route.disposition, "render");
assert.equal(route.indexable, true);
assert.equal(route.sitemapEligible, true);
const media = snapshot.publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId);
assert.ok(media, "Edit By Prompt page media must exist");
assert.equal(media.status, "ready");
const images = [media.primaryImage, ...media.galleryImages];
assert.equal(images.length, 13);
assert.ok(images.every((url) => /(?:^|\/)edit-by-prompt(?:\/|\?|$)/.test(url)));
assert.ok(images.every((url) => !/social-cards|Social Cards|Social profile portrait/i.test(url)));
assert.ok(media.imageAlts.every((alt) => /edit|prompt|photo/i.test(alt) && !/social-cards|Social Cards|Social profile portrait/i.test(alt)));
const pageCopy = mydreamshootsPageCopyForRoute({ siteId: site.id, routeKind: "ai-image-theme-leaf", canonicalSlug: "edit-by-prompt", canonicalPath });
assert.ok(pageCopy, "Edit By Prompt page copy must exist");
const page = snapshot.pages.find((candidate) => candidate.slug === canonicalPath) || snapshot.pages.find((candidate) => candidate.slug === "/");
const baseContext = resolveStorefrontContext({
  site,
  page,
  products: snapshot.products,
  creativePacks: snapshot.creativePacks,
  publication: snapshot.publication,
  factsRevision: "edit-by-prompt-smoke",
  buildId: "edit-by-prompt-smoke",
  publishedFacts: snapshot.publishedFacts,
  publishedPageMedia: Object.fromEntries(snapshot.publishedPageMedia.map((row) => [row.pageEntityId, row])),
  publishedStandardPageMedia: Object.fromEntries(snapshot.publishedStandardPageMedia.map((row) => [row.canonicalPath, row])),
  publishedPageEntities: Object.fromEntries(snapshot.publishedPageEntities.map((row) => [row.canonicalPath, row])),
  publishedLinkRefs: snapshot.publishedLinkRefs,
  snapshotIntegrity: "valid"
}, "published");
const context = {
  ...baseContext,
  seo: { ...baseContext.seo, canonicalPath, canonicalUrl: `https://www.mydreamshoots.com${canonicalPath}` },
  pageCopy,
  publishedPageMedia: undefined
};
const graph = buildCollectionDirectoryJsonLd({
  site,
  collectionSlug: "edit-by-prompt",
  routeMode: "host",
  creativePacks: snapshot.creativePacks,
  products: snapshot.products,
  context
}).flatMap((node) => Array.isArray(node?.["@graph"]) ? node["@graph"] : []);
assert.ok(!graph.some((node) => node?.["@type"] === "Product"), "Edit By Prompt must not expose a Product node for a credit-redeemed theme pack");
const pageNode = graph.find((node) => node?.["@type"] === "CollectionPage");
assert.ok(pageNode, "Edit By Prompt page JSON-LD must exist");
assert.ok(Array.isArray(pageNode.image) && pageNode.image.length > 0);
assert.ok(pageNode.image.every((url) => /edit-by-prompt/i.test(url) && !/social-cards/i.test(url)));
assert.equal(pageNode.primaryImageOfPage?.["@type"], "ImageObject", "Edit By Prompt page must carry a primaryImageOfPage");
const sitemap = sitemapEntriesForSite(state, site);
const sitemapEntry = sitemap.find((entry) => new URL(entry.loc).pathname === canonicalPath);
assert.ok(sitemapEntry, "Edit By Prompt sitemap entry must exist");
assert.ok(sitemapEntry.images?.length >= 13);
assert.ok(sitemapEntry.images.every((image) => /edit-by-prompt/i.test(image.loc) && !/social-cards/i.test(image.loc)));
assert.ok(sitemapEntry.images.every((image) => !/Social Cards|Social profile portrait/i.test(`${image.title ?? ""}`)));
const metadata = await metadataForPublishedStorefrontDirectoryPage({
  site,
  page,
  kind: "collection",
  directorySlug: "edit-by-prompt",
  path: canonicalPath,
  products: snapshot.products,
  creativePacks: snapshot.creativePacks,
  snapshot
});
assert.equal(metadata.alternates?.canonical, "https://www.mydreamshoots.com/ai-image-generation/edit-by-prompt");
assert.notEqual(metadata.title, "Browse private AI photo packages | myDreamshoots");
const ogImage = metadata.openGraph?.images?.[0]?.url;
const twitterImage = Array.isArray(metadata.twitter?.images) ? metadata.twitter.images[0] : metadata.twitter?.images;
assert.ok(/edit-by-prompt/i.test(String(ogImage)) && !/social-cards/i.test(String(ogImage)));
assert.ok(/edit-by-prompt/i.test(String(twitterImage)) && !/social-cards/i.test(String(twitterImage)));
console.log(JSON.stringify({ ok: true, canonicalPath, routeDisposition: route.disposition, indexable: route.indexable, sitemapEligible: route.sitemapEligible, packId: media.packId, imageCount: images.length, productSku: product.sku, sitemapImageCount: sitemapEntry.images.length }, null, 2));
