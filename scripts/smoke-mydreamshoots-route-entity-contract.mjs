#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const contract = jiti("../src/lib/mydreamshoots-published-contract.ts");
const routes = contract.mydreamshootsPublishedRouteManifest();
const entities = contract.mydreamshootsPublishedPageEntities();
const profiles = JSON.parse(fs.readFileSync(path.join(root, "src/lib/photo-package-use-case-profiles.json"), "utf8")).mydreamshootsCategories ?? {};

// motion-generator is a legacy alias owned by the published redirect
// projection, not an indexable image-leaf entity. The taxonomy therefore has
// 37 render rows plus one redirect disposition in the complete route inventory.
assert.equal(routes.length, 37, "all indexable taxonomy routes must have a projection row");
assert.equal(entities.length, 37, "all indexable taxonomy pages must have a page entity row");
const publishedRoutes = routes.filter((route) => route.status === "published");
const reviewRoutes = routes.filter((route) => route.status === "review_required");
assert.equal(publishedRoutes.length, 37, "all independent pages may be indexable");
assert.equal(reviewRoutes.length, 0, "all current taxonomy render rows must be publishable or explicitly removed");
for (const route of routes) {
  const entity = entities.find((candidate) => candidate.pageEntityId === route.pageEntityId);
  assert.ok(entity, `${route.canonicalSlug} must have a matching page entity`);
  assert.equal(entity.canonicalPath, route.canonicalPath, `${route.canonicalSlug} canonical path must agree`);
  assert.equal(entity.pageRevision, route.pageRevision, `${route.canonicalSlug} page revision must agree`);
  assert.equal(entity.copyRevision, route.copyRevision, `${route.canonicalSlug} copy revision must agree`);
  assert.equal(entity.mediaEntityId, route.mediaEntityId, `${route.canonicalSlug} media entity must agree`);
  assert.equal(route.fallbackUsed, false, `${route.canonicalSlug} may not use a fallback`);
  if (route.status === "review_required") {
    assert.equal(route.indexable, false);
    assert.equal(route.sitemapEligible, false);
    assert.equal(entity.indexable, false);
    assert.equal(entity.sitemapEligible, false);
    assert.equal(entity.content.ctaLinkEntityId.startsWith("mydreamshoots:"), true);
  } else {
    assert.equal(route.indexable, true);
    assert.equal(route.sitemapEligible, true);
    assert.equal(entity.indexable, true);
    assert.equal(entity.sitemapEligible, true);
  }
  assert.ok(profiles[route.canonicalSlug], `${route.canonicalSlug} must retain source copy provenance`);
}

const source = fs.readFileSync(path.join(root, "src/lib/storefront-context/snapshot.ts"), "utf8");
assert.match(source, /resolvePublishedRouteDisposition/);
assert.match(source, /route\.disposition === "redirect"/);
assert.match(source, /return \{ kind: "not_found"/);
console.log(JSON.stringify({ ok: true, sourceRows: 38, renderRows: 37, redirectRows: 1, independentRows: 37, reviewRows: 0, prospectiveProjectionRows: 38 }, null, 2));
