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
const apply = process.argv.includes("--apply");
assertDatabaseTarget({ expectedTarget: target || "remote" });
const siteId = "site_dreamshoot";
const coverRepairs = new Map([
  ["/holidays-events/save-the-date", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/hero-ai-save-the-date-couple-sunset.jpg",
    alt: "Couple embracing at sunset as the opening scene of an AI Save the Date video."
  }],
  ["/holidays-events/wedding-invitation", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/save-the-date-couple-ring-announcement.jpg",
    alt: "Couple showing an engagement ring for a wedding invitation announcement scene."
  }],
  ["/holidays-events/wedding-anniversary", {
    cover: "/assets/dreamshoot/save-the-date/save-the-date/save-the-date-romantic-beach-walk.jpg",
    alt: "Couple holding hands on the beach at sunset for a wedding anniversary story."
  }],
  ["/holidays-events/christmas", {
    cover: "/assets/dreamshoot/seasonal/christmas/hero-ai-christmas-family-gift.jpg",
    alt: "Family exchanging gifts together in a warm Christmas living room.",
    mediaAssetId: "media_site_dreamshoot_holidays_events_christmas_hero_family_gift"
  }],
  ["/holidays-events/thanksgiving", {
    cover: "/assets/dreamshoot/seasonal/thanksgiving/hero-ai-thanksgiving-family-dinner.jpg",
    alt: "Family gathering around a warm Thanksgiving dinner table.",
    mediaAssetId: "media_site_dreamshoot_holidays_events_thanksgiving_hero_family_dinner"
  }],
  ["/holidays-events/new-year", {
    cover: "/assets/dreamshoot/seasonal/new-year/hero-ai-new-year-family-celebration.jpg",
    alt: "Family celebrating the New Year together with festive lights.",
    mediaAssetId: "media_site_dreamshoot_holidays_events_new_year_hero_family_celebration"
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
    const mediaAsset = apply ? await prisma.mediaAsset.upsert({
      where: { siteId_storageKey: { siteId, storageKey: repair.cover } },
      create: {
        id: repair.mediaAssetId ?? `media_${siteId}_${Buffer.from(repair.cover).toString("hex").slice(0, 24)}`,
        siteId,
        label: repair.cover.split("/").pop() || repair.cover,
        storageKey: repair.cover,
        mimeType: "image/jpeg",
        usageType: "theme",
        sourceType: "save-the-date-cover-repair",
        previewUrl: repair.cover,
        originUrl: repair.cover,
        altText: repair.alt
      },
      update: { altText: repair.alt, previewUrl: repair.cover, originUrl: repair.cover }
    }) : await prisma.mediaAsset.findUnique({ where: { siteId_storageKey: { siteId, storageKey: repair.cover } }, select: { id: true } });
    if (mediaAsset) mediaAssetRepairs.set(mediaAsset.id, repair.alt);
    if (apply) await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextPage } });
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
  if (apply) await prisma.themeSettings.update({ where: { siteId }, data: { draftJson: settings } });

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
  if (apply) for (const [mediaAssetId, altText] of mediaAssetRepairs) {
    await prisma.mediaAsset.update({ where: { id: mediaAssetId }, data: { altText } });
  }
  console.log(JSON.stringify({
    ok: true,
    target,
    mode: apply ? "draft-only" : "dry-run",
    repairedPaths: [...coverRepairs.keys()],
    changedPageIds: [...nextPages.values()].map(({ page }) => page.id),
    changedMediaAssetIds: [...mediaAssetRepairs.keys()],
    candidateSnapshotHash: snapshot.snapshotHash,
    publicationRequired: true
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
