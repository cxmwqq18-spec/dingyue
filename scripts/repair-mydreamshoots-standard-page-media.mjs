#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
assertDatabaseTarget({ expectedTarget: "local" });
const parsedDatabaseUrl = new URL(databaseUrl);
assert(["localhost", "127.0.0.1", "::1"].includes(parsedDatabaseUrl.hostname), `refusing non-local database host: ${parsedDatabaseUrl.hostname}`);
assert.equal(parsedDatabaseUrl.port, "15433", "MyDreamShoots standard media repair must use local PostgreSQL port 15433");

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

const jiti = createJiti(import.meta.url);
const { buildPublicationSnapshot, prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function normalizedPack(pack) {
  return {
    id: pack.id,
    status: ["active", "draft", "paused"].includes(pack.status) ? pack.status : "draft",
    creditCost: Number(pack.creditCost ?? 0),
    outputCount: Number(pack.outputCount ?? 0),
    category: pack.category ?? undefined,
    categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: typeof pack.imageUrl === "string" ? pack.imageUrl : undefined,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string") : [],
    galleryImageAlts: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.filter((value) => typeof value === "string") : []
  };
}

function withOgImage(pageJson, imageUrl) {
  const next = clone(pageJson) ?? {};
  next.seo = { ...(next.seo ?? {}), ogImage: imageUrl };
  return next;
}

const prisma = new PrismaClient();
try {
  const siteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      activePublication: { include: { publication: true } },
      connect: true
    }
  });
  assert.ok(siteRecord, `${siteId} must exist`);

  const [packRows, productRows] = await Promise.all([
    prisma.creativePack.findMany({
      where: { siteId },
      select: { id: true, status: true, creditCost: true, outputCount: true, category: true, imageUrl: true, galleryImages: true, galleryImageAlts: true, categoryRecord: { select: { slug: true } } },
      orderBy: { id: "asc" }
    }),
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } })
  ]);
  const site = toSite(siteRecord);
  const packs = packRows.map(normalizedPack);
  const products = productRows.map(mapProduct);
  const activeSnapshot = siteRecord.activePublication?.publication?.snapshot;
  assert.equal(publicationSnapshotIntegrity(activeSnapshot), "valid", "an active publication is required before repair");
  const initialSnapshot = buildPublicationSnapshot(site, undefined, packs, products);

  const firstReadyLeaf = initialSnapshot.publishedRoutes
    .filter((route) => route.disposition === "render" && route.routeKind === "ai-image-theme-leaf" && route.status === "published")
    .map((route) => initialSnapshot.publishedPageMedia.find((media) => media.pageEntityId === route.pageEntityId && media.status === "ready"))
    .find(Boolean);
  assert.ok(firstReadyLeaf?.primaryImage, "a first ready MyDreamShoots image theme is required");
  assert.doesNotMatch(firstReadyLeaf.primaryImage, /cyberpunk/i, "first ready image theme must not be Cyberpunk");

  const pageRecord = siteRecord.pages.find((page) => page.slug === "/best-ai-image");
  const mappedPage = site.pages.find((page) => page.slug === "/best-ai-image");
  assert.ok(pageRecord && mappedPage, "/best-ai-image ThemePage is required");
  const draftJson = withOgImage(pageRecord.draftJson, firstReadyLeaf.primaryImage);
  if (apply) await prisma.themePage.update({ where: { id: pageRecord.id }, data: { draftJson } });
  mappedPage.draftJson = draftJson;

  const snapshot = buildPublicationSnapshot(site, undefined, packs, products);
  // Keep the already validated publication facts while the relational page/media
  // projections are rebuilt from the current SQL rows.
  snapshot.publishedFacts = clone(activeSnapshot.publishedFacts);
  snapshot.revisions.factsRevision = activeSnapshot.revisions.factsRevision;
  snapshot.revisions.policyRevision = activeSnapshot.revisions.policyRevision;
  snapshot.snapshotHash = "";
  snapshot.revisions.snapshotHash = "";
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (!apply && integrity !== "valid") {
    const manifest = await prepareDraftPublishManifestRelational(siteId);
    console.log(JSON.stringify({ ok: true, siteId, canonicalPath: "/best-ai-image", mode: "dry-run", candidateIntegrity: integrity, manifestHash: manifest.manifestHash, publicationRequired: true }, null, 2));
  } else {
    assert.equal(integrity, "valid", "repaired standard media snapshot must be valid");
  const bestImage = snapshot.publishedStandardPageMedia.find((row) => row.canonicalPath === "/best-ai-image");
  assert.ok(bestImage, "repaired /best-ai-image standard media is required");
  assert.equal(bestImage.primaryImage, firstReadyLeaf.primaryImage);
  assert.doesNotMatch(bestImage.primaryImage, /cyberpunk/i);
  assert.equal(bestImage.sitemapImages.some((image) => /cyberpunk/i.test(image)), false, "standard media sitemap images must not retain Cyberpunk fallback");

  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({
    ok: true,
    siteId,
    canonicalPath: "/best-ai-image",
    primaryImage: bestImage.primaryImage,
    mode: apply ? "draft-only" : "dry-run",
    manifestHash: manifest.manifestHash,
    publicationRequired: true
    }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
