#!/usr/bin/env node

// Bounded local repair for legacy Aidreamcapes EU mirror media embedded in
// current relational rows. It only updates site_aidreamcapes_xby, never the
// source site, and remains dry-run by default. The runtime projection applies
// the same resolver as a fail-closed guard while this data repair is applied.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import jiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const TARGET_SITE_ID = "site_aidreamcapes_xby";
const SOURCE_SITE_ID = "site_dreamshoot";
const ASSET_PREFIX = "/assets/sites/site_aidreamcapes_eu/";
const MIRROR_PREFIX = `${ASSET_PREFIX}mirror/`;
const STORAGE_MIRROR_PREFIXES = [
  `${ASSET_PREFIX.slice(1)}mirror/`,
  "sites/site_aidreamcapes_eu/mirror/"
];
const MIRROR_PATTERN = /\/assets\/sites\/site_aidreamcapes_eu\/mirror\/[^"'\\\s<>|)]+/g;
const APPLY_LOCAL = process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-mirror-repair");

const loadTsModule = jiti(import.meta.url);
const { replaceAidreamcapesEuLegacyMedia } = loadTsModule("../src/lib/aidreamcapes-eu-legacy-media.ts");

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function rewriteString(value) {
  if (typeof value !== "string" || !value.includes(MIRROR_PREFIX)) return value;
  return value.replace(MIRROR_PATTERN, (match) => replaceAidreamcapesEuLegacyMedia(match));
}

function rewriteJson(value) {
  if (typeof value === "string") return rewriteString(value);
  if (Array.isArray(value)) return value.map(rewriteJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteJson(child)]));
}

function rewriteStorageKey(value) {
  if (typeof value !== "string") return value;
  const publicUrl = value.startsWith("/assets/") ? value : `/assets/${value}`;
  const rewritten = rewriteString(publicUrl);
  return rewritten.startsWith("/assets/") ? rewritten.slice("/assets/".length) : rewritten;
}

function isMirrorStorageKey(value) {
  return typeof value === "string" && (value.startsWith(MIRROR_PREFIX) || STORAGE_MIRROR_PREFIXES.some((prefix) => value.startsWith(prefix)));
}

function containsMirror(value) {
  return typeof value === "string" && (value.includes(MIRROR_PREFIX) || value.includes("sites/site_aidreamcapes_eu/mirror/"));
}

function validatePublicValue(value, label) {
  const visit = (current, location) => {
    if (typeof current === "string") {
      assert(!current.includes(MIRROR_PREFIX), `${label}${location}: mirror media remains: ${current}`);
      const matches = current.match(/\/assets\/sites\/site_aidreamcapes_eu\/[^"'\\\s<>|)]+/g) ?? [];
      for (const match of matches) {
        assert(match.startsWith(ASSET_PREFIX), `${label}${location}: escaped target asset root: ${match}`);
      }
      return;
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${location}[${index}]`));
      return;
    }
    if (current && typeof current === "object") {
      Object.entries(current).forEach(([key, child]) => visit(child, `${location}.${key}`));
    }
  };
  visit(value, "");
}

function targetOwnedFileExists(publicUrl) {
  const clean = String(publicUrl).split(/[?#]/)[0];
  if (!clean.startsWith(ASSET_PREFIX) || clean.includes("/mirror/")) return false;
  const filePath = path.resolve("public", clean.slice(1));
  return fs.existsSync(filePath) && fs.statSync(filePath).isFile();
}

function updatePlan(rows, fields) {
  return rows.map((row) => {
    const data = {};
    for (const field of fields) data[field] = field === "storageKey" ? rewriteStorageKey(row[field]) : rewriteJson(row[field]);
    return { row, data, changed: fields.some((field) => changed(row[field], data[field])) };
  });
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const [targetSite, sourceSite, livePages, themePages, themeSettings, profiles, videoThemes, videoExamples, mediaAssets] = await Promise.all([
      prisma.site.findUnique({ where: { id: TARGET_SITE_ID } }),
      prisma.site.findUnique({ where: { id: SOURCE_SITE_ID }, select: { id: true } }),
      prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findMany({ where: { siteId: TARGET_SITE_ID } }),
      prisma.storefrontProfile.findMany({ where: { siteId: TARGET_SITE_ID } }),
      prisma.videoTheme.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.videoThemeExample.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { id: "asc" } }),
      prisma.mediaAsset.findMany({ where: { siteId: TARGET_SITE_ID }, orderBy: { storageKey: "asc" } })
    ]);

    assert(targetSite, `Missing target site: ${TARGET_SITE_ID}`);
    assert.equal(sourceSite?.id, SOURCE_SITE_ID, "Source-site identity check failed.");
    assert.equal(targetSite.id, TARGET_SITE_ID, "Unexpected target site.");

    const plans = {
      livePages: updatePlan(livePages, ["contentJson"]),
      themePages: updatePlan(themePages, ["draftJson", "publishedJson"]),
      themeSettings: updatePlan(themeSettings, ["draftJson", "publishedJson"]),
      profiles: updatePlan(profiles, ["draftJson", "publishedJson"]),
      videoThemes: updatePlan(videoThemes, ["imageUrl", "galleryImages"]),
      videoExamples: updatePlan(videoExamples, ["imageUrl", "galleryImages"]),
      mediaAssets: updatePlan(mediaAssets, ["storageKey", "previewUrl", "originUrl"])
    };

    // A regenerated/current asset may already exist under the destination
    // storage key. Coalesce those rows instead of violating the
    // siteId/storageKey unique constraint: the legacy mirror row is redundant
    // and is removed only after the full target-table backup below.
    const occupiedStorageKeys = new Map(
      mediaAssets
        .filter((row) => !isMirrorStorageKey(row.storageKey))
        .map((row) => [row.storageKey, row.id])
    );
    const deletedMediaAssetIds = [];
    for (const entry of plans.mediaAssets) {
      const destination = entry.data.storageKey;
      if (!entry.changed || typeof destination !== "string") continue;
      const occupiedBy = occupiedStorageKeys.get(destination);
      if (occupiedBy && occupiedBy !== entry.row.id) {
        entry.delete = true;
        deletedMediaAssetIds.push(entry.row.id);
        continue;
      }
      occupiedStorageKeys.set(destination, entry.row.id);
    }

    for (const [table, entries] of Object.entries(plans)) {
      for (const entry of entries) {
        for (const field of Object.keys(entry.data)) validatePublicValue(entry.data[field], `${table}.${entry.row.id}.${field}`);
      }
    }

    const changes = Object.fromEntries(Object.entries(plans).map(([table, entries]) => [table, entries.filter((entry) => entry.changed).length]));
    const mirrorStringsBefore = Object.values(plans).flatMap((entries) => entries.flatMap((entry) => Object.values(entry.row))).filter(containsMirror).length;
    const mirrorStringsAfter = Object.values(plans).flatMap((entries) => entries.flatMap((entry) => Object.values(entry.data))).filter(containsMirror).length;

    const report = {
      mode: APPLY_LOCAL ? "apply-local" : "dry-run",
      targetSiteId: TARGET_SITE_ID,
      sourceSiteId: SOURCE_SITE_ID,
      sourceWrites: 0,
      rows: {
        livePages: livePages.length,
        themePages: themePages.length,
        themeSettings: themeSettings.length,
        profiles: profiles.length,
        videoThemes: videoThemes.length,
        videoExamples: videoExamples.length,
        mediaAssets: mediaAssets.length
      },
      changedRows: changes,
      deletedRows: { mediaAssets: deletedMediaAssetIds.length },
      mirrorStringsBefore,
      mirrorStringsAfter,
      missingTargetFiles: []
    };

    for (const entry of plans.mediaAssets.filter((item) => item.changed)) {
      const storageKey = entry.data.storageKey;
      if (typeof storageKey === "string") {
        const publicUrl = storageKey.startsWith("assets/") ? `/${storageKey}` : `/assets/${storageKey}`;
        if (!targetOwnedFileExists(publicUrl)) report.missingTargetFiles.push(publicUrl);
      }
    }

    assert.equal(mirrorStringsAfter, 0, "Repair plan still contains mirror media.");
    writeJson(path.join(REPORT_ROOT, `report-${timestamp()}.json`), report);

    if (!APPLY_LOCAL) {
      console.log(JSON.stringify(report, null, 2));
      return;
    }

    const backup = {
      createdAt: new Date().toISOString(),
      targetSiteId: TARGET_SITE_ID,
      sourceWrites: 0,
      site: targetSite,
      livePages,
      themePages,
      themeSettings,
      profiles,
      videoThemes,
      videoExamples,
      mediaAssets
    };
    const backupPath = path.join(REPORT_ROOT, `backup-before-aidreamcapes-eu-mirror-repair-${timestamp()}.json`);
    writeJson(backupPath, backup);

    await prisma.$transaction(async (tx) => {
      for (const entry of plans.livePages.filter((item) => item.changed)) await tx.livePage.update({ where: { id: entry.row.id }, data: { contentJson: entry.data.contentJson } });
      for (const entry of plans.themePages.filter((item) => item.changed)) await tx.themePage.update({ where: { id: entry.row.id }, data: { draftJson: entry.data.draftJson, publishedJson: entry.data.publishedJson } });
      for (const entry of plans.themeSettings.filter((item) => item.changed)) await tx.themeSettings.update({ where: { id: entry.row.id }, data: { draftJson: entry.data.draftJson, publishedJson: entry.data.publishedJson } });
      for (const entry of plans.profiles.filter((item) => item.changed)) await tx.storefrontProfile.update({ where: { id: entry.row.id }, data: { draftJson: entry.data.draftJson, publishedJson: entry.data.publishedJson } });
      for (const entry of plans.videoThemes.filter((item) => item.changed)) await tx.videoTheme.update({ where: { id: entry.row.id }, data: { imageUrl: entry.data.imageUrl, galleryImages: entry.data.galleryImages } });
      for (const entry of plans.videoExamples.filter((item) => item.changed)) await tx.videoThemeExample.update({ where: { id: entry.row.id }, data: { imageUrl: entry.data.imageUrl, galleryImages: entry.data.galleryImages } });
      for (const entry of plans.mediaAssets.filter((item) => item.delete)) await tx.mediaAsset.delete({ where: { id: entry.row.id } });
      for (const entry of plans.mediaAssets.filter((item) => item.changed && !item.delete)) await tx.mediaAsset.update({ where: { id: entry.row.id }, data: { storageKey: entry.data.storageKey, previewUrl: entry.data.previewUrl, originUrl: entry.data.originUrl } });
    });

    console.log(JSON.stringify({ ...report, backupPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exitCode = 1;
});
