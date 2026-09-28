import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

import { assertDatabaseTarget } from "./lib/database-target.mjs";

const TARGET_SITE_IDS = ["site_aidreamcapes_xby", "site_mydreamshoots_xby"];
const SOURCE_SITE_ID = "site_dreamshoot";
const EXPECTED_CONFIRMATION = "eu-target-state-sync-production";
const DEFAULT_BACKUP_DIR = "/www/wwwroot/mydreamshoots.com/backups";

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const [key, inlineValue] = token.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      args.set(key, true);
    }
  }
  return args;
}

function requireTarget(target) {
  if (target !== "production") {
    throw new Error("This script is production-only. Pass --target=production.");
  }
  assertDatabaseTarget({ expectedTarget: "production", operation: "EU target state sync" });
}

function stableId(prefix, siteId, key) {
  const digest = crypto
    .createHash("sha256")
    .update(`${siteId}:${key}`)
    .digest("hex")
    .slice(0, 28);
  return `eu_sync_${prefix}_${digest}`;
}

function keyFor(siteId, key) {
  return `${siteId}::${key}`;
}

function indexRows(rows, keyName) {
  return new Map(rows.map((row) => [keyFor(row.siteId, row[keyName]), row]));
}

function noindexJson(value) {
  const json = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const seo = json.seo && typeof json.seo === "object" && !Array.isArray(json.seo) ? json.seo : {};
  return {
    ...json,
    seo: {
      ...seo,
      index: false,
      follow: false,
      robots: {
        ...(seo.robots && typeof seo.robots === "object" && !Array.isArray(seo.robots) ? seo.robots : {}),
        index: false,
        follow: false,
      },
    },
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.source !== "local") {
    throw new Error("The input snapshot must declare source=local.");
  }
  if (JSON.stringify([...snapshot.siteIds].sort()) !== JSON.stringify([...TARGET_SITE_IDS].sort())) {
    throw new Error("The input snapshot must contain exactly the two EU target sites.");
  }
  for (const collection of [
    "sites",
    "livePages",
    "themePages",
    "themeSettings",
    "profiles",
    "videoThemes",
    "mediaAssets",
  ]) {
    if (!Array.isArray(snapshot[collection])) throw new Error(`Snapshot collection ${collection} is missing.`);
  }
  for (const collection of ["livePages", "themePages", "themeSettings", "profiles", "videoThemes", "mediaAssets"]) {
    for (const row of snapshot[collection]) {
      if (!TARGET_SITE_IDS.includes(row.siteId) || row.siteId === SOURCE_SITE_ID) {
        throw new Error(`Snapshot ${collection} contains a non-EU row.`);
      }
    }
  }
  if (snapshot.livePages.length !== 194 && snapshot.livePages.length !== 97 * TARGET_SITE_IDS.length) {
    throw new Error(`Unexpected LivePage snapshot count: ${snapshot.livePages.length}`);
  }
}

function publicCounts(rows) {
  return Object.fromEntries(
    TARGET_SITE_IDS.map((siteId) => [
      siteId,
      rows.filter((row) => row.siteId === siteId).length,
    ]),
  );
}

async function loadSnapshot(inputPath) {
  const raw = await fs.readFile(path.resolve(inputPath), "utf8");
  const snapshot = JSON.parse(raw);
  validateSnapshot(snapshot);
  return snapshot;
}

async function readCurrent(prisma) {
  const [sites, livePages, themePages, themeSettings, profiles, videoThemes, mediaAssets] = await Promise.all([
    prisma.site.findMany({ where: { id: { in: TARGET_SITE_IDS } } }),
    prisma.livePage.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
    prisma.themePage.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
    prisma.themeSettings.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
    prisma.storefrontProfile.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
    prisma.videoTheme.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
    prisma.mediaAsset.findMany({ where: { siteId: { in: TARGET_SITE_IDS } } }),
  ]);
  return { sites, livePages, themePages, themeSettings, profiles, videoThemes, mediaAssets };
}

function diffCollection(currentRows, desiredRows, keyName) {
  const current = indexRows(currentRows, keyName);
  const desired = indexRows(desiredRows, keyName);
  let creates = 0;
  let updates = 0;
  let noindex = 0;
  for (const key of desired.keys()) {
    if (current.has(key)) updates += 1;
    else creates += 1;
  }
  for (const [key, row] of current) {
    if (desired.has(key)) continue;
    const payload = row.contentJson ?? row.publishedJson ?? row.draftJson;
    if (payload?.seo?.index !== false || payload?.seo?.follow !== false) noindex += 1;
  }
  return { current: currentRows.length, desired: desiredRows.length, creates, updates, noindex };
}

function summarize(current, snapshot) {
  return {
    sites: current.sites.map(({ id, slug, primaryDomain, status }) => ({ id, slug, primaryDomain, status })),
    livePages: diffCollection(current.livePages, snapshot.livePages, "slug"),
    themePages: diffCollection(current.themePages, snapshot.themePages, "slug"),
    themeSettings: { current: current.themeSettings.length, desired: snapshot.themeSettings.length },
    profiles: { current: current.profiles.length, desired: snapshot.profiles.length },
    videoThemes: diffCollection(current.videoThemes, snapshot.videoThemes, "slug"),
    mediaAssets: diffCollection(current.mediaAssets, snapshot.mediaAssets, "storageKey"),
    desiredLivePagesBySite: publicCounts(snapshot.livePages),
    desiredThemePagesBySite: publicCounts(snapshot.themePages),
    desiredVideoThemesBySite: publicCounts(snapshot.videoThemes),
    desiredMediaAssetsBySite: publicCounts(snapshot.mediaAssets),
  };
}

async function writeBackup(current, backupDir) {
  await fs.mkdir(backupDir, { recursive: true, mode: 0o750 });
  const stamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
  const backupPath = path.join(backupDir, `eu-target-state-before-sync-${stamp}.json`);
  await fs.writeFile(
    backupPath,
    JSON.stringify({ backedUpAt: new Date().toISOString(), targetSiteIds: TARGET_SITE_IDS, ...current }),
    { mode: 0o600 },
  );
  return backupPath;
}

async function upsertLivePages(tx, desired, current) {
  const currentByKey = indexRows(current, "slug");
  const desiredKeys = new Set(desired.map((row) => keyFor(row.siteId, row.slug)));
  for (const row of desired) {
    const existing = currentByKey.get(keyFor(row.siteId, row.slug));
    const data = {
      siteId: row.siteId,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug: row.slug,
      title: row.title,
      contentJson: row.contentJson,
    };
    if (existing) await tx.livePage.update({ where: { id: existing.id }, data });
    else await tx.livePage.create({ data: { id: stableId("live", row.siteId, row.slug), ...data } });
  }
  for (const row of current) {
    if (desiredKeys.has(keyFor(row.siteId, row.slug))) continue;
    await tx.livePage.update({ where: { id: row.id }, data: { contentJson: noindexJson(row.contentJson) } });
  }
}

async function upsertThemePages(tx, desired, current) {
  const currentByKey = indexRows(current, "slug");
  const desiredKeys = new Set(desired.map((row) => keyFor(row.siteId, row.slug)));
  for (const row of desired) {
    const existing = currentByKey.get(keyFor(row.siteId, row.slug));
    const data = {
      siteId: row.siteId,
      pageType: row.pageType,
      templateKey: row.templateKey,
      slug: row.slug,
      title: row.title,
      draftJson: row.draftJson,
      publishedJson: row.publishedJson,
      draftMeta: row.draftMeta,
    };
    if (existing) await tx.themePage.update({ where: { id: existing.id }, data });
    else await tx.themePage.create({ data: { id: stableId("theme", row.siteId, row.slug), ...data } });
  }
  for (const row of current) {
    if (desiredKeys.has(keyFor(row.siteId, row.slug))) continue;
    await tx.themePage.update({
      where: { id: row.id },
      data: { draftJson: noindexJson(row.draftJson), publishedJson: noindexJson(row.publishedJson) },
    });
  }
}

async function upsertSiteSettings(tx, model, desired, current, fields, prefix) {
  const currentBySite = new Map(current.map((row) => [row.siteId, row]));
  for (const row of desired) {
    const existing = currentBySite.get(row.siteId);
    const data = Object.fromEntries(fields.map((field) => [field, row[field]]));
    if (existing) await tx[model].update({ where: { id: existing.id }, data });
    else await tx[model].create({ data: { id: stableId(prefix, row.siteId, row.siteId), siteId: row.siteId, ...data } });
  }
}

async function upsertVideoThemes(tx, desired, current) {
  const currentByKey = indexRows(current, "slug");
  const desiredKeys = new Set(desired.map((row) => keyFor(row.siteId, row.slug)));
  for (const row of desired) {
    const existing = currentByKey.get(keyFor(row.siteId, row.slug));
    const data = {
      siteId: row.siteId,
      slug: row.slug,
      name: row.name,
      headline: row.headline,
      description: row.description,
      prompt: row.prompt,
      status: row.status,
      creditCost: row.creditCost,
      modelPricing: row.modelPricing,
      durationSeconds: row.durationSeconds,
      maxFrames: row.maxFrames,
      generationCount: row.generationCount,
      sortOrder: row.sortOrder,
      imageUrl: row.imageUrl,
      galleryImages: row.galleryImages,
    };
    if (existing) await tx.videoTheme.update({ where: { id: existing.id }, data });
    else await tx.videoTheme.create({ data: { id: stableId("video", row.siteId, row.slug), categoryId: null, ...data } });
  }
  for (const row of current) {
    if (desiredKeys.has(keyFor(row.siteId, row.slug))) continue;
    if (row.status === "active") await tx.videoTheme.update({ where: { id: row.id }, data: { status: "archived" } });
  }
}

async function upsertMediaAssets(tx, desired, current) {
  const currentByKey = indexRows(current, "storageKey");
  for (const row of desired) {
    const existing = currentByKey.get(keyFor(row.siteId, row.storageKey));
    const data = {
      siteId: row.siteId,
      label: row.label,
      storageKey: row.storageKey,
      mimeType: row.mimeType,
      usageType: row.usageType,
      sourceType: row.sourceType,
      previewUrl: row.previewUrl,
      originUrl: row.originUrl,
      altText: row.altText,
      notes: row.notes,
    };
    if (existing) await tx.mediaAsset.update({ where: { id: existing.id }, data });
    else await tx.mediaAsset.create({ data: { id: stableId("media", row.siteId, row.storageKey), ...data } });
  }
}

async function applySnapshot(prisma, current, snapshot) {
  await prisma.$transaction(
    async (tx) => {
      await upsertLivePages(tx, snapshot.livePages, current.livePages);
      await upsertThemePages(tx, snapshot.themePages, current.themePages);
      await upsertSiteSettings(tx, "themeSettings", snapshot.themeSettings, current.themeSettings, ["draftJson", "publishedJson"], "settings");
      await upsertSiteSettings(tx, "storefrontProfile", snapshot.profiles, current.profiles, ["draftJson", "publishedJson", "draftMeta"], "profile");
      await upsertVideoThemes(tx, snapshot.videoThemes, current.videoThemes);
      await upsertMediaAssets(tx, snapshot.mediaAssets, current.mediaAssets);
    },
    { maxWait: 30_000, timeout: 300_000 },
  );
}

const args = parseArgs(process.argv.slice(2));
const target = args.get("target");
const apply = args.get("apply-production") === true || args.get("apply-production") === "true";
const confirmation = args.get("confirm");
const inputPath = args.get("input");
const backupDir = args.get("backup-dir") || DEFAULT_BACKUP_DIR;

if (!inputPath) throw new Error("Pass --input=/path/to/eu-target-state.json.");
requireTarget(target);
if (apply && confirmation !== EXPECTED_CONFIRMATION) {
  throw new Error(`Production apply requires --confirm=${EXPECTED_CONFIRMATION}.`);
}

const snapshot = await loadSnapshot(inputPath);
const prisma = new PrismaClient();
try {
  const current = await readCurrent(prisma);
  const summary = summarize(current, snapshot);
  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", target, summary }, null, 2));
  } else {
    const backupPath = await writeBackup(current, backupDir);
    await applySnapshot(prisma, current, snapshot);
    console.log(JSON.stringify({ ok: true, mode: "apply-production", target, backupPath, summary }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
