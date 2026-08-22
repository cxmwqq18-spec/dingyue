#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const databaseUrl = process.env.DATABASE_URL?.trim();
assert(databaseUrl, "DATABASE_URL is required");
const parsed = new URL(databaseUrl);
const expectedTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() === "remote-readonly" ? "remote-readonly" : "local";
assertDatabaseTarget({ expectedTarget });

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const { mydreamshootsCurrentVideoMenuSlugs, mydreamshootsVideoGenerationParentCategories } = jiti("../src/lib/mydreamshoots-video-framework.ts");
const currentVideoSlugs = new Set(mydreamshootsCurrentVideoMenuSlugs);
const expectedVideoParents = new Set(mydreamshootsVideoGenerationParentCategories.map((category) => category.slug));

const prisma = new PrismaClient();
try {
  const [site, packs, categories, themes, products, prices] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      include: {
        pages: { where: { slug: { in: ["/", "/best-ai-image", "/best-ai-video"] } }, orderBy: { slug: "asc" } },
        activePublication: { include: { publication: true } }
      }
    }),
    prisma.creativePack.findMany({ where: { siteId, status: "active" }, select: { id: true } }),
    prisma.videoThemeCategory.findMany({ where: { siteId }, include: { parent: true }, orderBy: { sortOrder: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId, status: "active" }, include: { category: { include: { parent: true } } }, orderBy: { sortOrder: "asc" } }),
    prisma.product.findMany({ where: { siteId, status: "active" }, select: { id: true } }),
    prisma.price.findMany({ where: { siteId, status: "active" }, select: { id: true, productId: true, amountCents: true, interval: true, creditsGranted: true } })
  ]);
  assert(site?.activePublication?.publication, "active MyDreamShoots publication is required");
  const publication = site.activePublication.publication;
  const snapshot = publication.snapshot;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "active publication snapshot must be valid");
  assert.equal(publicationSnapshotHash(snapshot), snapshot.snapshotHash, "active publication snapshot hash must read back");
  assert.equal(snapshot.publishedCollectionRefs.length, packs.length, "collection refs must cover all active photo packs");
  assert.equal(snapshot.publishedCollectionRefs.length, 38, "production photo collection count must be 38");
  assert.equal(snapshot.publishedOffers.length, prices.length, "published offers must cover active prices");
  assert.equal(snapshot.publishedOffers.length, 13, "production offer count must be 13");
  assert.equal(snapshot.publishedPageMedia.length, snapshot.publishedCollectionRefs.length, "page media and collection refs must align");

  const home = site.pages.find((page) => page.slug === "/");
  assert(home, "homepage is required");
  const homeSection = home.publishedJson?.sections?.generation_showcase_1;
  assert.equal(homeSection?.settings?.showTrustedLogoIntro, true, "trusted logo intro must be enabled");
  assert.equal(homeSection?.settings?.embeddedPricingSectionId, "pricing_1", "homepage must embed pricing_1");
  assert.equal((homeSection?.blocks ?? []).filter((block) => block?.type === "logo").length, 30, "homepage must carry the full trusted logo block set");
  assert.equal(home.publishedJson?.sections?.pricing_1?.type, "pricing_table", "homepage pricing section must be present");
  const reviews = home.publishedJson?.sections?.proof_1;
  assert.equal(reviews?.type, "testimonial_wall", "homepage customer review wall must be present");
  assert.equal(reviews?.settings?.title, "What Our Customers Say", "homepage customer reviews must use the published title");
  assert((reviews?.blocks ?? []).length >= 6, "homepage must include the published customer review set");

  assert.equal(expectedVideoParents.size, 5, "video menu must define five parent categories");
  const currentThemes = themes.filter((theme) => currentVideoSlugs.has(theme.slug));
  assert.equal(currentThemes.length, currentVideoSlugs.size, "all 13 current video menu themes must be active in the local database");
  const currentParents = new Set(currentThemes.map((theme) => theme.category?.parent?.slug ?? theme.category?.slug));
  assert([...currentParents].every((slug) => expectedVideoParents.has(slug)), "current video themes must belong to the five local parent categories");
  assert.equal(categories.filter((category) => !category.parent && expectedVideoParents.has(category.slug)).length, 5, "five video parent categories must be present in the local database");

  const bestVideo = site.pages.find((page) => page.slug === "/best-ai-video");
  const bestVideoSection = Object.values(bestVideo?.publishedJson?.sections ?? {}).find((section) => section?.type === "dreamshoot_media_gallery");
  assert.equal(bestVideoSection?.settings?.kind, "video", "Best Video Generator must use the video gallery renderer");
  const productionVideoSlugs = String(bestVideoSection?.settings?.videoSlugs ?? "").split("|").filter(Boolean);
  assert.equal(productionVideoSlugs.length, 8, "Best Video Generator must use the eight production showcase themes");
  const productionVideoThemes = productionVideoSlugs.map((slug) => themes.find((theme) => theme.slug === slug));
  assert(productionVideoThemes.every(Boolean), "Best Video Generator slugs must resolve to local database themes");
  assert(productionVideoThemes.every((theme) => (Array.isArray(theme.galleryImages) ? theme.galleryImages : []).some((url) => /\.(?:mp4|webm)(?:\?|#|$)/i.test(url))), "Best Video Generator must contain video media only");

  assert.equal(products.length, 7, "local public product count must remain intact");
  assert.equal(prices.length, 13, "local public price count must remain intact");
  assert(prices.every((price) => products.some((product) => product.id === price.productId) && price.amountCents > 0 && price.creditsGranted >= 0), "prices must reference public products with valid amounts and credits");

  console.log(JSON.stringify({
    ok: true,
    siteId,
    publication: { id: publication.id, version: publication.version, snapshotHash: snapshot.snapshotHash },
    counts: { photoPacks: packs.length, collectionRefs: snapshot.publishedCollectionRefs.length, offers: snapshot.publishedOffers.length, logoBlocks: (homeSection.blocks ?? []).filter((block) => block?.type === "logo").length, reviews: (reviews?.blocks ?? []).length, currentVideoThemes: currentThemes.length, bestVideoThemes: productionVideoThemes.length, products: products.length, prices: prices.length }
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
