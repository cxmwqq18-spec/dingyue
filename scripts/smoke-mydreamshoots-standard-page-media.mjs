#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const sourceRoot = path.resolve("src");
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

try {
  const prisma = new PrismaClient();
  const state = await readPlatformStateFromSql(prisma);
  const site = state.sites.find((candidate) => candidate.id === "site_dreamshoot");
  assert.ok(site, "MyDreamShoots source site is required");
  const packs = state.creativePacks.filter((candidate) => candidate.siteId === site.id);
  const products = state.products.filter((candidate) => candidate.siteId === site.id);
  const { buildPublicationSnapshot } = createJiti(import.meta.url)("../src/lib/stores/theme-store.ts");
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products);
  const expectedPaths = ["/about-us", "/best-packages", "/best-ai-image", "/pricing", "/faq", "/workflow", "/ai-save-the-date/valentines-day", "/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date", "/ai-video-generation/wedding-ceremony", "/holidays-events/thanksgiving", "/holidays-events/christmas", "/holidays-events/new-year"];
  assert.equal(snapshot.publishedStandardPageMedia.length, expectedPaths.length);
  assert.deepEqual(snapshot.publishedStandardPageMedia.map((row) => row.canonicalPath).sort(), expectedPaths.slice().sort());
  for (const row of snapshot.publishedStandardPageMedia) {
    assert.equal(row.status, "ready", `${row.canonicalPath} standard media must be ready`);
    assert.ok(row.pageEntityId && row.pageId && row.mediaEntityId && row.revision);
    assert.equal(row.primaryImage, row.ogImage);
    assert.equal(row.primaryImage, row.twitterImage);
    assert.equal(row.primaryImage, row.jsonLdImage);
    assert.equal(row.primaryImage, row.sitemapImages[0]);
    assert.ok(row.primaryImageAlt.trim());
  }
  const bestImage = snapshot.publishedStandardPageMedia.find((row) => row.canonicalPath === "/best-ai-image");
  assert.ok(bestImage);
  assert.doesNotMatch(bestImage.primaryImage, /cyberpunk/i, "/best-ai-image must not inherit the Cyberpunk default image");
  assert.equal(bestImage.sitemapImages.some((image) => /cyberpunk/i.test(image)), false, "/best-ai-image sitemap images must not retain the Cyberpunk fallback");
  const firstReadyLeaf = snapshot.publishedRoutes
    .filter((route) => route.disposition === "render" && route.routeKind === "ai-image-theme-leaf" && route.status === "published")
    .map((route) => snapshot.publishedPageMedia.find((media) => media.pageEntityId === route.pageEntityId && media.status === "ready"))
    .find(Boolean);
  assert.equal(bestImage.primaryImage, firstReadyLeaf?.primaryImage, "/best-ai-image must use the first visible published collection image");
  console.log(JSON.stringify({ ok: true, standardPageMediaRows: expectedPaths.length, bestAiImage: bestImage.primaryImage }, null, 2));
  await prisma.$disconnect();
} finally {
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
