#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const CACHE_BUST = argumentValue("--version") ?? "20260921-media-v2";
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert(!(applyLocal && applyProduction), "Choose one database write target.");
if (applyProduction) {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: confirmation === "production" });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
}

// These are the current Aidreamcapes media batches. Legacy media is left
// untouched so this migration only changes the assets already rebound to the
// current storefront content.
const currentAssetRoots = new Set([
  "homepage-seo",
  "ads-testing-v3",
  "conversion-seeding-v1",
  "promo-category-v1",
  "brand-creator-v1",
  "ugc-ad-v4",
  "ecommerce-main-image-v1",
  "lifestyle-scene-v1",
  "packshot-multi-angle-v1",
  "macro-details-v1",
  "bundle-sets-v1",
  "size-reference-v1",
  "feature-infographic-v1",
  "comparison-chart-v1",
  "feed-ad-still-v1",
  "ugc-still-ad-v1",
  "story-ad-vertical-v1",
  "carousel-set-v1",
  "sale-campaign-key-visual-v1",
  "lookbook-cover-v1",
  "on-model-generation-v1",
  "virtual-try-on-v1",
  "hair-makeup-preview-v1",
  "jewelry-positioning-v1",
  "ghost-mannequin-v1",
  "colorway-variations-v1",
  "background-remove-replace-v1",
  "enhance-upscale-v1",
  "old-photo-restore-v1",
  "commercial-lighting-v1",
  "packaging-mockup-v1",
  "professional-headshot-v1",
  "creator-portrait-v1",
  "team-directory-v1",
  "social-profile-photo-v1",
  "fashion-editorial-v1"
]);

function cacheBustedAsset(value) {
  if (typeof value !== "string") return value;
  const match = value.match(/^\/assets\/sites\/site_aidreamcapes\/([^/]+)\//);
  if (!match || !currentAssetRoots.has(match[1])) return value;
  const hashIndex = value.indexOf("#");
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const base = withoutHash.split("?")[0];
  return `${base}?v=${encodeURIComponent(CACHE_BUST)}${hash}`;
}

function rewrite(value, counter) {
  if (typeof value === "string") {
    const next = cacheBustedAsset(value);
    if (next !== value) counter.changed += 1;
    counter.seen += 1;
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, counter));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item, counter)]));
  }
  return value;
}

const prisma = new PrismaClient();
try {
  const [site, pages, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true, updatedAt: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);

  const counters = { seen: 0, changed: 0 };
  const nextPages = pages.map((page) => ({ ...page, contentJson: rewrite(page.contentJson, counters) }));
  const nextDraftJson = rewrite(settings.draftJson, counters);
  const nextPublishedJson = rewrite(settings.publishedJson, counters);
  const report = {
    siteId: SITE_ID,
    pageCount: pages.length,
    version: CACHE_BUST,
    stringsScanned: counters.seen,
    assetRefsChanged: counters.changed
  };

  if (applyLocal || applyProduction) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `media-cache-bust-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, pages, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.update({ where: { id: page.id }, data: { contentJson: page.contentJson } });
      }
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: nextDraftJson, publishedJson: nextPublishedJson } });
    });
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "local-applied", backupPath, ...report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", ...report, applyCommand: `node scripts/migrate-aidreamcapes-media-cache-bust.mjs --apply-local --confirm=${SITE_ID}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
