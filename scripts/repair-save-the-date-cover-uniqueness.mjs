#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import Module from "node:module";
import path from "node:path";
import fs from "node:fs";
import createJiti from "jiti";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const target = String(process.env.DATABASE_TARGET || "").trim().toLowerCase();
assertDatabaseTarget({ expectedTarget: target || "remote" });
const siteId = "site_dreamshoot";
const coverRepairs = new Map([
  ["/holidays-events/save-the-date", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/hero-ai-save-the-date-video-announcement.jpg",
    alt: "Couple recording a direct-to-camera Save the Date announcement outdoors at golden hour."
  }],
  ["/holidays-events/wedding-invitation", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/save-the-date-couple-ring-announcement.jpg",
    alt: "Couple showing an engagement ring for a wedding invitation announcement scene."
  }],
  ["/holidays-events/wedding-anniversary", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/save-the-date-romantic-beach-walk.jpg",
    alt: "Couple holding hands on the beach at sunset for a wedding anniversary story."
  }]
]);
const repairByCover = new Map([...coverRepairs.values()].map((repair) => [repair.cover, repair]));
const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};
const jiti = createJiti(import.meta.url);
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
}
function revision(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: true, settings: true, activePublication: { include: { publication: true } } } });
  assert(site?.activePublication?.publication?.snapshot, "active publication is required");
  const nextPages = new Map();
  const mediaAssetRepairs = new Map();
  for (const [pathName, repair] of coverRepairs) {
    const page = site.pages.find((candidate) => candidate.slug === pathName);
    assert(page, `${pathName} page is required`);
    const nextPage = clone(page.publishedJson ?? page.draftJson);
    nextPage.mediaManifest = (nextPage.mediaManifest ?? []).map((item) => {
      const relatedRepair = repairByCover.get(item.src);
      return relatedRepair ? { ...item, alt: relatedRepair.alt } : item;
    });
    nextPage.mediaManifest[0] = { ...nextPage.mediaManifest[0], src: repair.cover, alt: repair.alt };
    nextPage.seo = { ...(nextPage.seo ?? {}), ogImage: repair.cover };
    nextPages.set(pathName, { page, nextPage, repair });
    const mediaAsset = await prisma.mediaAsset.findFirst({ where: { siteId, storageKey: repair.cover } });
    assert(mediaAsset, `${pathName} cover media asset is required`);
    mediaAssetRepairs.set(mediaAsset.id, repair.alt);
    await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextPage } });
  }
  const settings = clone(site.settings?.publishedJson ?? site.settings?.draftJson ?? {});
  for (const group of settings.saveTheDateNavigation?.groups ?? []) {
    for (const item of group.items ?? []) {
      const repair = coverRepairs.get(item.href);
      if (repair) {
        item.imageUrl = repair.cover;
        item.imageAlt = repair.alt;
      }
    }
  }
  await prisma.themeSettings.update({ where: { siteId }, data: { draftJson: settings } });

  const snapshot = clone(site.activePublication.publication.snapshot);
  for (const { page, nextPage } of nextPages.values()) {
    const snapshotPage = snapshot.pages.find((candidate) => candidate.id === page.id);
    if (snapshotPage) snapshotPage.publishedJson = nextPage;
  }
  snapshot.themeSettings = settings;
  for (const [pathName, { repair }] of nextPages) {
    const standard = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === pathName);
    assert(standard, `${pathName} standard media projection is required`);
    standard.primaryImage = repair.cover;
    standard.primaryImageAlt = repair.alt;
    standard.ogImage = repair.cover;
    standard.twitterImage = repair.cover;
    standard.jsonLdImage = repair.cover;
    standard.sitemapImages = [repair.cover, ...standard.sitemapImages.filter((item) => item !== repair.cover)];
    standard.revision = revision(standard);
    const showcase = (snapshot.publishedHomepageShowcases ?? []).find((item) => item.kind === "save_the_date" && item.canonicalPath === pathName);
    if (showcase) {
      showcase.imageUrl = repair.cover;
      showcase.imageAlt = repair.alt;
      showcase.mediaRevision = standard.revision;
    }
  }
  snapshot.revisions.mediaRevision = revision({ leaf: snapshot.publishedPageMedia, standard: snapshot.publishedStandardPageMedia });
  if (snapshot.publishedHomepageShowcases) snapshot.revisions.homepageShowcaseRevision = revision(snapshot.publishedHomepageShowcases);
  snapshot.snapshotHash = "";
  snapshot.revisions.snapshotHash = "";
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "cover repair must preserve snapshot integrity");
  const latest = await prisma.themePublication.findFirst({ where: { siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }], select: { version: true } });
  const publishedVersion = Math.max(latest?.version ?? 0, site.pages.reduce((max, page) => Math.max(max, Number(page.publishedJson?.version ?? 0)), 0)) + 1;
  for (const { nextPage } of nextPages.values()) nextPage.version = publishedVersion;
  for (const { page, nextPage } of nextPages.values()) {
    const snapshotPage = snapshot.pages.find((candidate) => candidate.id === page.id);
    if (snapshotPage) snapshotPage.publishedJson = nextPage;
  }
  snapshot.snapshotHash = "";
  snapshot.revisions.snapshotHash = "";
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "versioned cover repair must preserve snapshot integrity");
  const actor = `repair:save-the-date-cover:${target}`;
  const publication = await prisma.$transaction(async (tx) => {
    for (const { page, nextPage } of nextPages.values()) {
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: nextPage, publishedJson: nextPage } });
    }
    for (const [mediaAssetId, altText] of mediaAssetRepairs) {
      await tx.mediaAsset.update({ where: { id: mediaAssetId }, data: { altText } });
    }
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson: settings, publishedJson: settings } });
    const record = await tx.themePublication.create({
      data: {
        id: `pub_${siteId}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`,
        siteId,
        version: publishedVersion,
        snapshot,
        pageCount: snapshot.pages.length,
        sectionCount: snapshot.pages.reduce((sum, page) => sum + (page.publishedJson?.sectionsOrder?.length ?? 0), 0),
        snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
        publishedBy: actor,
        scope: { type: "site", pageIds: [...nextPages.values()].map(({ page }) => page.id), mediaAssetIds: [...mediaAssetRepairs.keys()], includeThemeSettings: true, includeStorefrontProfile: false },
        factsRevision: snapshot.revisions.factsRevision
      }
    });
    await tx.activeThemePublication.upsert({
      where: { siteId },
      create: { siteId, publicationId: record.id, activatedBy: actor },
      update: { publicationId: record.id, activatedAt: new Date(), activatedBy: actor }
    });
    return record;
  });
  console.log(JSON.stringify({ ok: true, target, repairedPaths: [...coverRepairs.keys()], publicationId: publication.id, version: publishedVersion, snapshotHash: snapshot.snapshotHash }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
