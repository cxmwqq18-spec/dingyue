#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, parseDatabaseUrl } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const productionConfirmed = process.argv.includes("--confirm-production");
const target = String(process.env.DATABASE_TARGET ?? "").trim().toLowerCase();
const expectedTarget = target === "remote" ? "remote" : "local";
const database = parseDatabaseUrl();

assertDatabaseTarget({ expectedTarget });
if (expectedTarget === "remote" && !productionConfirmed) {
  throw new Error("Production TDK publication requires --confirm-production.");
}
if (!apply) {
  throw new Error("Use --apply to publish the approved MyDreamShoots homepage TDK.");
}

const approvedSeo = {
  title: "AI Video & Photo Generator | myDreamshoots",
  description: "Create AI videos from your photos, professional AI headshots, portraits, and themed photo sets. Make personalized Save the Date videos with myDreamshoots.",
  keywords: "Dream Shoots,Wedding Photoshoot,Travel Selfies,Free AI Photos,Free Photo Generator,AI Couple Photo,AI Headshot",
  canonicalPath: "/",
  index: true,
  follow: true,
  robots: { index: true, follow: true }
};

const repoRoot = process.cwd();
const backupDir = path.join(repoRoot, "releases", "backups");
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
const { publishReviewedDraftSiteRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function applySeo(json, homePageId) {
  const next = clone(json) ?? {};
  next.seo = { ...(next.seo ?? {}), ...approvedSeo, robots: { ...approvedSeo.robots } };
  if (next.seo.pages && homePageId) {
    next.seo.pages[homePageId] = { ...(next.seo.pages[homePageId] ?? {}), ...approvedSeo, robots: { ...approvedSeo.robots } };
  }
  return next;
}

function applySettingsSeo(json, homePageId) {
  const next = clone(json) ?? {};
  next.seo = {
    ...(next.seo ?? {}),
    siteDescription: approvedSeo.description,
    siteKeywords: approvedSeo.keywords
  };
  next.seo.pages = { ...(next.seo.pages ?? {}) };
  next.seo.pages[homePageId] = { ...(next.seo.pages[homePageId] ?? {}), ...approvedSeo, robots: { ...approvedSeo.robots } };
  return next;
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { pages: true, settings: true, activePublication: { include: { publication: true } } }
  });
  assert(site?.settings, "MyDreamShoots site and settings are required");
  const home = site.pages.find((page) => page.slug === "/");
  assert(home, "MyDreamShoots homepage is required");
  const active = site.activePublication?.publication;
  assert(active?.snapshot && typeof active.snapshot === "object", "active publication snapshot is required");

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-homepage-tdk-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), target: expectedTarget, database, home, settings: site.settings, activePublication: active }, null, 2)}\n`, { mode: 0o600 });

  const nextDraft = applySeo(home.draftJson, home.id);
  const nextPublished = applySeo(home.publishedJson, home.id);
  const nextDraftSettings = applySettingsSeo(site.settings.draftJson, home.id);
  const nextPublishedSettings = applySettingsSeo(site.settings.publishedJson, home.id);

  await prisma.$transaction(async (tx) => {
    await tx.themePage.update({ where: { id: home.id }, data: { draftJson: nextDraft, updatedAt: new Date() } });
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson: nextDraftSettings, updatedAt: new Date() } });
  }, { timeout: 120_000 });

  const snapshot = clone(active.snapshot);
  const snapshotHome = snapshot.pages.find((page) => page.id === home.id || page.slug === "/");
  assert(snapshotHome, "active publication homepage is required");
  snapshotHome.publishedJson = nextPublished;
  snapshot.themeSettings = nextPublishedSettings;
  snapshot.snapshotHash = "";
  snapshot.revisions = { ...(snapshot.revisions ?? {}), snapshotHash: "" };
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "updated TDK publication snapshot must be valid");

  const published = await publishReviewedDraftSiteRelational(siteId, `publish:mydreamshoots-homepage-tdk:${expectedTarget}`);
  const readback = await prisma.themePublication.findUnique({ where: { id: published.publication.id } });
  assert.equal(readback?.snapshot?.pages?.find((page) => page.slug === "/")?.publishedJson?.seo?.description, approvedSeo.description, "publication TDK readback failed");
  console.log(JSON.stringify({ ok: true, target: expectedTarget, publicationId: published.publication.id, version: published.publishedVersion, snapshotHash: published.publication.snapshot.snapshotHash, backupPath, seo: approvedSeo }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
