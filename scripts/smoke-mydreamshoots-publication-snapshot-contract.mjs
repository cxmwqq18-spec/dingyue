#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const read = (file) => fs.readFileSync(file, "utf8");
const types = read("src/lib/types.ts");
const themeStore = read("src/lib/stores/theme-store.ts");
const snapshot = read("src/lib/storefront-context/snapshot.ts");
const metadata = read("src/lib/storefront-metadata.ts");
const templates = read("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const blogSync = read("scripts/sync-dreamshoot-blog-content.mjs");

for (const field of ["publishedRoutes", "publishedPageCopy", "publishedPageMedia", "publishedPackFacts", "publishedCollectionRefs", "revisions"]) {
  assert.match(types, new RegExp(`${field}\\?`), `ThemePublication snapshot must persist ${field}`);
  assert.match(themeStore, new RegExp(field), `publication builder must write ${field}`);
}

assert.match(snapshot, /publication\?\.snapshot\?\.publishedRoutes/, "runtime route manifest must prefer the immutable publication snapshot");
assert.match(snapshot, /hasImmutableSeoProjection/, "current-format snapshots must have an explicit immutable projection boundary");
assert.match(snapshot, /publication\?\.snapshot\?\.publishedPageMedia/, "runtime media must prefer the immutable publication snapshot");
assert.match(metadata, /snapshot\?\.publishedPageMedia\.find/, "metadata must consume published media projection");
assert.match(snapshot, /route\.status !== "published"/, "review-required leaf routes must fail closed");
assert.doesNotMatch(blogSync, /themePublication\.update(?:Many)?\s*\(/, "blog sync must not mutate existing publications");
assert.match(blogSync, /immutable_publication_requires_publish_service/, "blog sync must direct changes through the publish service");

const soccerBlock = templates.slice(templates.indexOf('block("seasonal_worldcup_1"'), templates.indexOf('anchor: "christmas-holiday-pack"'));
assert.equal((soccerBlock.match(/collectionSlug: "soccer"/g) ?? []).length, 6, "all six Soccer cards must target the Soccer entity");
assert.doesNotMatch(soccerBlock, /collectionSlug: "(?:gala-photo|avatar|thanksgiving-photo|holiday)"/, "Soccer cards must not target unrelated entities");

const sourceRoot = path.join(process.cwd(), "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  return originalResolveFilename.call(this, request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request, ...args);
};
const jiti = createJiti(import.meta.url);
const { createPublishedSiteSnapshot, resolvePublishedRouteDisposition, resolvePublicCollectionItems, resolvePublicPricingOffers } = jiti("../src/lib/storefront-context/snapshot.ts");
const state = JSON.parse(read("data/platform-state.json"));
const sourceSite = state.sites.find((site) => site.id === "site_dreamshoot");
assert.ok(sourceSite, "MyDreamShoots fixture site is required");
const publication = {
  id: "pub_immutable_empty_projection",
  siteId: sourceSite.id,
  version: 999,
  snapshot: {
    seoProjectionVersion: 1,
    pages: sourceSite.pages.map((page) => ({ id: page.id, slug: page.slug, publishedJson: page.publishedJson })),
    themeSettings: sourceSite.themeSettings.publishedJson,
    publishedRoutes: [],
    publishedPageCopy: [],
    publishedPageMedia: [],
    publishedPackFacts: [],
    publishedCollectionRefs: [],
    revisions: { factsRevision: "facts-empty", routeRevision: "routes-empty", copyRevision: "copy-empty", mediaRevision: "media-empty" }
  },
  factsRevision: "facts-empty",
  publishedBy: "smoke",
  publishedAt: new Date(0).toISOString()
};
const site = { ...sourceSite, latestPublication: publication };
const isolatedState = { ...state, sites: [site], themePublications: [publication] };
const emptyProjectionSnapshot = createPublishedSiteSnapshot(isolatedState, site);
assert.deepEqual(emptyProjectionSnapshot.publishedRoutes, [], "an intentional empty route projection must not repopulate from current taxonomy");
assert.deepEqual(emptyProjectionSnapshot.products, [], "v1 runtime must not inject current products");
assert.deepEqual(emptyProjectionSnapshot.creativePacks, [], "v1 runtime must not inject current creative packs");
assert.deepEqual(resolvePublicCollectionItems(emptyProjectionSnapshot), [], "an empty collection projection must remain authoritative");
assert.deepEqual(resolvePublicPricingOffers(emptyProjectionSnapshot), [], "an empty offer projection must remain authoritative");
assert.equal(resolvePublishedRouteDisposition(emptyProjectionSnapshot, "/ai-image-generation/headshot").kind, "not_found", "a route absent from the publication must fail closed");

console.log("MyDreamShoots immutable publication snapshot contract passed");
