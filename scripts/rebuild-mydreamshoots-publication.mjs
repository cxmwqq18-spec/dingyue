#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: hasArgument("--confirm-production")
});
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
if (target === "production" && apply && argumentValue("--confirm") !== "rebuild-mydreamshoots-publication") {
  throw new Error("Production rebuild requires --confirm=rebuild-mydreamshoots-publication.");
}
const siteId = "site_dreamshoot";
const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/")) {
    const tsPath = `${aliased}.ts`;
    if (fs.existsSync(tsPath)) return originalResolveFilename.call(this, tsPath, ...args);
    const jsonPath = `${aliased}.json`;
    if (fs.existsSync(jsonPath)) return originalResolveFilename.call(this, jsonPath, ...args);
  }
  return originalResolveFilename.call(this, aliased, ...args);
};

const jiti = createJiti(import.meta.url);
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { toSite } = jiti("../src/lib/stores/prisma-mappers.ts");
const { mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();

function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function counts(site) {
  return {
    pages: site.pages.length,
    activePacks: site.creativePacks.filter((row) => row.status === "active").length,
    videos: site.videoThemes.filter((row) => row.status === "active").length,
    publicationVersion: site.activePublication?.publication?.version ?? null
  };
}

try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      activePublication: { include: { publication: true } },
      siteThemes: { orderBy: [{ status: "asc" }, { updatedAt: "desc" }] },
      themeCopies: { orderBy: { updatedAt: "desc" } },
      creativePackCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      creativePacks: { include: { categoryRecord: true }, orderBy: { createdAt: "asc" } },
      mediaAssets: { orderBy: { storageKey: "asc" } },
      toolCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemeCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemes: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      products: { include: { prices: true }, orderBy: { name: "asc" } }
    }
  });
  assert(site, `missing_site:${siteId}`);
  const source = toSite(site);
  if (!source.storefrontProfile && site.activePublication?.publication?.snapshot?.storefrontProfile) {
    source.storefrontProfile = {
      id: `profile_${siteId}`,
      siteId,
      draftJson: clone(site.activePublication.publication.snapshot.storefrontProfile),
      publishedJson: clone(site.activePublication.publication.snapshot.storefrontProfile)
    };
  }
  const packs = site.creativePacks.map((pack) => ({
    id: pack.id,
    status: ["active", "draft", "paused"].includes(pack.status) ? pack.status : "draft",
    creditCost: Number(pack.creditCost ?? 0),
    outputCount: Number(pack.outputCount ?? 0),
    category: pack.category ?? undefined,
    categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: typeof pack.imageUrl === "string" ? pack.imageUrl : undefined,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string") : [],
    galleryImageAlts: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.filter((value) => typeof value === "string") : []
  }));
  const snapshot = buildPublicationSnapshot(source, undefined, packs, site.products.map(mapProduct));
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "publication_snapshot_invalid");
  const summary = {
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    target,
    before: counts(site),
    routes: snapshot.publishedRoutes.length,
    publishedRoutes: snapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.status === "published").length,
    reviewRoutes: snapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.status !== "published").length,
    media: snapshot.publishedPageMedia.length + snapshot.publishedStandardPageMedia.length,
    policies: snapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.routeKind === "policy").length,
    videos: snapshot.publishedRoutes.filter((route) => route.disposition === "render" && route.routeKind === "ai-video-topic-leaf").length
  };
  if (apply) {
    const backupDir = path.join(repoRoot, "releases", "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-publication-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, activePublication: site.activePublication?.publication ?? null }, null, 2)}\n`, { mode: 0o600 });
    const published = await publishSeoSnapshotRelational({ siteId, snapshot, actor: "repair:mydreamshoots-publication" });
    summary.publicationId = published.publication.id;
    summary.version = published.publishedVersion;
    summary.backupPath = backupPath;
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
