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
const oldCover = "/assets/dreamshoot/save-the-date/save-the-date/hero-ai-save-the-date-couple-sunset.jpg";
const uniqueCover = "/assets/dreamshoot/generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp";
const uniqueAlt = "Wedding portrait example for a Save the Date video.";
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
const { publishReviewedDraftSiteRelational } = jiti("../src/lib/stores/theme-store.ts");
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
  const page = site.pages.find((candidate) => candidate.slug === "/holidays-events/save-the-date");
  assert(page, "Save the Date page is required");
  const nextPage = clone(page.publishedJson ?? page.draftJson);
  nextPage.mediaManifest[0] = { ...nextPage.mediaManifest[0], src: uniqueCover, alt: uniqueAlt };
  nextPage.seo = { ...(nextPage.seo ?? {}), ogImage: uniqueCover };
  await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextPage } });
  const settings = clone(site.settings?.publishedJson ?? site.settings?.draftJson ?? {});
  for (const group of settings.saveTheDateNavigation?.groups ?? []) {
    for (const item of group.items ?? []) {
      if (item.href === "/holidays-events/save-the-date") {
        item.imageUrl = uniqueCover;
        item.imageAlt = uniqueAlt;
      }
    }
  }
  await prisma.themeSettings.update({ where: { siteId }, data: { draftJson: settings } });

  const snapshot = clone(site.activePublication.publication.snapshot);
  const snapshotPage = snapshot.pages.find((candidate) => candidate.id === page.id);
  if (snapshotPage) snapshotPage.publishedJson = nextPage;
  snapshot.themeSettings = settings;
  const standard = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === "/holidays-events/save-the-date");
  assert(standard, "Save the Date standard media projection is required");
  standard.primaryImage = uniqueCover;
  standard.primaryImageAlt = uniqueAlt;
  standard.ogImage = uniqueCover;
  standard.twitterImage = uniqueCover;
  standard.jsonLdImage = uniqueCover;
  standard.sitemapImages = [uniqueCover, ...standard.sitemapImages.filter((item) => item !== uniqueCover)];
  standard.revision = revision(standard);
  const showcase = (snapshot.publishedHomepageShowcases ?? []).find((item) => item.kind === "save_the_date" && item.canonicalPath === "/holidays-events/save-the-date");
  if (showcase) {
    showcase.imageUrl = uniqueCover;
    showcase.imageAlt = uniqueAlt;
    showcase.mediaRevision = standard.revision;
  }
  snapshot.revisions.mediaRevision = revision({ leaf: snapshot.publishedPageMedia, standard: snapshot.publishedStandardPageMedia });
  if (snapshot.publishedHomepageShowcases) snapshot.revisions.homepageShowcaseRevision = revision(snapshot.publishedHomepageShowcases);
  snapshot.snapshotHash = "";
  snapshot.revisions.snapshotHash = "";
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "cover repair must preserve snapshot integrity");
  const published = await publishReviewedDraftSiteRelational(siteId, `repair:save-the-date-cover:${target}`);
  console.log(JSON.stringify({ ok: true, target, oldCover, uniqueCover, publicationId: published.publication.id, version: published.publishedVersion, snapshotHash: snapshot.snapshotHash }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
