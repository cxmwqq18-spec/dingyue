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
const storefrontRender = read("src/lib/storefront-render.tsx");
const jsonLd = read("src/lib/theme/json-ld.ts");

for (const field of ["publishedRoutes", "publishedPageCopy", "publishedPageMedia", "publishedPackFacts", "publishedCollectionRefs", "revisions"]) {
  assert.match(types, new RegExp(`${field}\\?`), `ThemePublication snapshot must persist ${field}`);
  assert.match(themeStore, new RegExp(field), `publication builder must write ${field}`);
}

assert.match(snapshot, /publicationSnapshot\?\.publishedRoutes/, "runtime route manifest must prefer the immutable publication snapshot");
assert.match(snapshot, /hasImmutableSeoProjection/, "current-format snapshots must have an explicit immutable projection boundary");
assert.match(snapshot, /publicationSnapshot\?\.publishedPageMedia/, "runtime media must prefer the immutable publication snapshot");
assert.match(metadata, /snapshot\?\.publishedPageMedia\.find/, "metadata must consume published media projection");
assert.match(snapshot, /route\.status !== "published"/, "review-required leaf routes must fail closed");
assert.doesNotMatch(blogSync, /themePublication\.update(?:Many)?\s*\(/, "blog sync must not mutate existing publications");
assert.match(blogSync, /immutable_publication_requires_publish_service/, "blog sync must direct changes through the publish service");
assert.match(storefrontRender, /getPublishedSiteRenderData\(state, publishedSnapshot\)/, "published render must materialize render data from the snapshot");
assert.match(storefrontRender, /!immutableSeoProjection && !preferLocalPathModeState/, "immutable publications must disable current pack completion");
assert.match(jsonLd, /collectionRefs\?\.filter/, "collection JSON-LD must consume published collection refs");

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
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
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
    publishedOffers: [],
    publishedFacts: { claimRevision: "facts-empty" },
    publishedCollectionRefs: [],
    publishedCreativePacks: [],
    revisions: { factsRevision: "facts-empty", routeRevision: "routes-empty", copyRevision: "copy-empty", mediaRevision: "media-empty" }
  },
  factsRevision: "facts-empty",
  publishedBy: "smoke",
  publishedAt: new Date(0).toISOString()
};
publication.snapshot.revisions.snapshotHash = publicationSnapshotHash(publication.snapshot);
publication.snapshotIntegrity = publicationSnapshotIntegrity(publication.snapshot);
const site = { ...sourceSite, latestPublication: publication };
const isolatedState = { ...state, sites: [site], themePublications: [publication] };
const emptyProjectionSnapshot = createPublishedSiteSnapshot(isolatedState, site);
assert.deepEqual(emptyProjectionSnapshot.publishedRoutes, [], "an intentional empty route projection must not repopulate from current taxonomy");
assert.deepEqual(emptyProjectionSnapshot.products, [], "v1 runtime must not inject current products");
assert.deepEqual(emptyProjectionSnapshot.creativePacks, [], "v1 runtime must not inject current creative packs");
assert.deepEqual(resolvePublicCollectionItems(emptyProjectionSnapshot), [], "an empty collection projection must remain authoritative");
assert.deepEqual(resolvePublicPricingOffers(emptyProjectionSnapshot), [], "an empty offer projection must remain authoritative");
assert.equal(resolvePublishedRouteDisposition(emptyProjectionSnapshot, "/ai-image-generation/headshot").kind, "not_found", "a route absent from the publication must fail closed");

const tamperedPublication = structuredClone(publication);
tamperedPublication.id = "pub_tampered_projection";
tamperedPublication.snapshot.pages[0].publishedJson.seo.title = "Tampered title";
delete tamperedPublication.snapshotIntegrity;
const tamperedSite = { ...sourceSite, latestPublication: tamperedPublication };
const tamperedSnapshot = createPublishedSiteSnapshot({ ...state, sites: [tamperedSite], themePublications: [tamperedPublication] }, tamperedSite);
assert.equal(tamperedSnapshot.snapshotIntegrity, "invalid", "hash mismatch must invalidate the whole publication");
assert.deepEqual(tamperedSnapshot.pages, [], "hash-invalid page content must not reach runtime");
assert.equal(resolvePublishedRouteDisposition(tamperedSnapshot, "/").kind, "not_found", "hash-invalid publications must fail closed");

const malformedPublication = structuredClone(publication);
malformedPublication.snapshot.publishedOffers = [{ currency: null }];
malformedPublication.snapshot.revisions.snapshotHash = publicationSnapshotHash(malformedPublication.snapshot);
assert.equal(publicationSnapshotIntegrity(malformedPublication.snapshot), "invalid", "schema-invalid DTOs must fail even with a matching hash");

console.log("MyDreamShoots immutable publication snapshot contract passed");
