#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "aidreamcapes-public-media-sources-production";
const LEGACY_PREFIX = "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/";
const productionRoot = "/www/wwwroot/mydreamshoots.com/current/public/assets/sites/site_aidreamcapes";
const payloadArg = process.argv.find((arg) => arg.startsWith("--backup="));
const backupPath = path.resolve(payloadArg?.slice("--backup=".length) || "");
const apply = process.argv.includes("--apply");
const confirmation = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice("--confirm=".length) || "";

if (!backupPath) throw new Error("A backup path is required.");
if (!apply || confirmation !== CONFIRMATION) throw new Error(`Applying requires --apply --confirm=${CONFIRMATION}.`);

function walkFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walkFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function stable(value) {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function isVideoSource(value) {
  return /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(String(value));
}

function sourcePathForFile(filePath) {
  return `/assets/sites/site_aidreamcapes/${path.relative(productionRoot, filePath).split(path.sep).join("/")}`;
}

const productionFiles = walkFiles(productionRoot);
const validAssetPaths = new Set(productionFiles.map(sourcePathForFile));
const imagePool = productionFiles.filter((filePath) => /\.webp$/i.test(filePath)).map(sourcePathForFile).sort();
const videoPool = productionFiles.filter((filePath) => /\.(?:mp4|webm|mov)$/i.test(filePath)).map(sourcePathForFile).sort();
if (!imagePool.length || !videoPool.length) throw new Error("Production Aidreamcapes image/video pools are incomplete.");

const sourceTargets = new Map();
function targetFor(source) {
  const pool = isVideoSource(source) ? videoPool : imagePool;
  if (!sourceTargets.has(source)) {
    const digest = crypto.createHash("sha1").update(source).digest().readUInt32BE(0);
    sourceTargets.set(source, pool[digest % pool.length]);
  }
  return sourceTargets.get(source);
}

function replaceString(value) {
  let output = "";
  let cursor = 0;
  while (true) {
    const start = value.indexOf("/assets/sites/site_aidreamcapes/", cursor);
    if (start < 0) return output + value.slice(cursor);
    let end = start + "/assets/sites/site_aidreamcapes/".length;
    while (end < value.length && !/[\s]/.test(value[end]) && !["\"", "<", ">", "|", ",", ";", "]", "}"].includes(value[end])) end += 1;
    const source = value.slice(start, end);
    const sourcePath = source.split(/[?#]/, 1)[0];
    const replacement = validAssetPaths.has(sourcePath) ? source : targetFor(source);
    output += value.slice(cursor, start) + replacement;
    cursor = end;
  }
}

function replaceValue(value) {
  if (typeof value === "string") return replaceString(value);
  if (Array.isArray(value)) return value.map(replaceValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceValue(child)]));
  return value;
}

function countInvalidAssets(value) {
  if (typeof value === "string") {
    let count = 0;
    let cursor = 0;
    while (true) {
      const start = value.indexOf("/assets/sites/site_aidreamcapes/", cursor);
      if (start < 0) return count;
      let end = start + "/assets/sites/site_aidreamcapes/".length;
      while (end < value.length && !/[\s]/.test(value[end]) && !["\"", "<", ">", "|", ",", ";", "]", "}"].includes(value[end])) end += 1;
      if (!validAssetPaths.has(value.slice(start, end).split(/[?#]/, 1)[0])) count += 1;
      cursor = end;
    }
  }
  if (Array.isArray(value)) return value.reduce((total, child) => total + countInvalidAssets(child), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((total, child) => total + countInvalidAssets(child), 0);
  return 0;
}

async function loadSources(client) {
  const [pages, livePages, settings, profile, publishedState, themes, mediaAssets, packs, packCategories, videoThemes, videoExamples, videoCategories, products] = await Promise.all([
    client.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.themeSettings.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.storefrontProfile.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.sitePublishedState.findMany({ where: { siteId: SITE_ID }, orderBy: { siteId: "asc" } }),
    client.siteTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.mediaAsset.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.creativePack.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.creativePackCategory.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.videoTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.videoThemeExample.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.videoThemeCategory.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } }),
    client.product.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } })
  ]);
  return { pages, livePages, settings, profile, publishedState, themes, mediaAssets, packs, packCategories, videoThemes, videoExamples, videoCategories, products };
}

function sourceHash(sources) {
  return hash(sources);
}

const protectedSql = ["Customer", "CustomerSession", "Subscription", "Order", "PaymentEvent", "CreditBalance", "CreditLedger", "GenerationJob", "CustomerModel", "AssetUpload", "Album"]
  .map((table) => `SELECT '${table}' AS model, count(*)::text AS count, md5(coalesce(string_agg("id"::text, ',' ORDER BY "id"::text),'')) AS hash FROM "${table}" WHERE "siteId" = '${SITE_ID}'`)
  .join(" UNION ALL ");

async function protectedFingerprint(client) {
  return client.$queryRawUnsafe(protectedSql);
}

function changed(value, next) {
  return hash(value) !== hash(next);
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, status: true } });
  if (!site || site.primaryDomain.toLowerCase() !== "www.aidreamcapes.com") throw new Error("Production Aidreamcapes site identity failed.");
  const before = await loadSources(prisma);
  const beforeHash = sourceHash(before);
  fs.mkdirSync(path.dirname(backupPath), { recursive: true });
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), site, before }, null, 2)}\n`, { mode: 0o600 });

  const nextMediaStorageKeys = new Map();
  const reservedStorageKeys = new Set(before.mediaAssets.map((asset) => asset.storageKey));
  for (const asset of before.mediaAssets) {
    if (!String(asset.storageKey || "").includes(LEGACY_PREFIX)) continue;
    let candidate = targetFor(asset.storageKey);
    const pool = isVideoSource(asset.storageKey) ? videoPool : imagePool;
    let offset = pool.indexOf(candidate);
    while (reservedStorageKeys.has(candidate)) {
      offset = (offset + 1) % pool.length;
      candidate = pool[offset];
    }
    reservedStorageKeys.add(candidate);
    nextMediaStorageKeys.set(asset.id, candidate);
  }

  const next = {
    ...before,
    pages: before.pages.map((row) => ({ ...row, draftJson: replaceValue(row.draftJson), publishedJson: replaceValue(row.publishedJson) })),
    livePages: before.livePages.map((row) => ({ ...row, contentJson: replaceValue(row.contentJson) })),
    settings: before.settings.map((row) => ({ ...row, draftJson: replaceValue(row.draftJson), publishedJson: replaceValue(row.publishedJson) })),
    profile: before.profile.map((row) => ({ ...row, draftJson: replaceValue(row.draftJson), publishedJson: replaceValue(row.publishedJson), draftMeta: replaceValue(row.draftMeta) })),
    publishedState: before.publishedState.map((row) => ({ ...row, payload: replaceValue(row.payload) })),
    themes: before.themes.map((row) => ({ ...row, templates: replaceValue(row.templates), settings: replaceValue(row.settings) })),
    mediaAssets: before.mediaAssets.map((row) => ({
      ...row,
      storageKey: nextMediaStorageKeys.get(row.id) ?? row.storageKey,
      previewUrl: replaceValue(row.previewUrl),
      originUrl: replaceValue(row.originUrl),
      altText: replaceValue(row.altText),
      notes: replaceValue(row.notes),
      mimeType: nextMediaStorageKeys.has(row.id) ? (isVideoSource(nextMediaStorageKeys.get(row.id)) ? "video/mp4" : "image/webp") : row.mimeType
    })),
    packs: before.packs.map((row) => ({ ...row, imageUrl: replaceValue(row.imageUrl), galleryImages: replaceValue(row.galleryImages), galleryImageAlts: replaceValue(row.galleryImageAlts) })),
    packCategories: before.packCategories.map((row) => ({ ...row, imageUrl: replaceValue(row.imageUrl), icon: replaceValue(row.icon) })),
    videoThemes: before.videoThemes.map((row) => ({ ...row, imageUrl: replaceValue(row.imageUrl), galleryImages: replaceValue(row.galleryImages) })),
    videoExamples: before.videoExamples.map((row) => ({ ...row, imageUrl: replaceValue(row.imageUrl), galleryImages: replaceValue(row.galleryImages) })),
    videoCategories: before.videoCategories.map((row) => ({ ...row, imageUrl: replaceValue(row.imageUrl), icon: replaceValue(row.icon) })),
    products: before.products.map((row) => ({ ...row, metadata: replaceValue(row.metadata) }))
  };

  const counts = { before: countInvalidAssets(before), after: countInvalidAssets(next) };
  if (counts.before <= 0 || counts.after !== 0) throw new Error(`Media source transformation did not eliminate legacy references: ${JSON.stringify(counts)}`);

  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${SITE_ID} FOR UPDATE`;
    const current = await loadSources(tx);
    if (sourceHash(current) !== beforeHash) throw new Error("Aidreamcapes media source snapshot changed before production lock.");
    const protectedBefore = await protectedFingerprint(tx);
    let updates = 0;
    for (const row of next.pages) if (changed(before.pages.find((item) => item.id === row.id), row)) { await tx.themePage.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson } }); updates += 1; }
    for (const row of next.livePages) if (changed(before.livePages.find((item) => item.id === row.id), row)) { await tx.livePage.update({ where: { id: row.id }, data: { contentJson: row.contentJson } }); updates += 1; }
    for (const row of next.settings) if (changed(before.settings.find((item) => item.id === row.id), row)) { await tx.themeSettings.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson } }); updates += 1; }
    for (const row of next.profile) if (changed(before.profile.find((item) => item.id === row.id), row)) { await tx.storefrontProfile.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson, draftMeta: row.draftMeta } }); updates += 1; }
    for (const row of next.publishedState) if (changed(before.publishedState.find((item) => item.siteId === row.siteId), row)) { await tx.sitePublishedState.update({ where: { siteId: row.siteId }, data: { payload: row.payload } }); updates += 1; }
    for (const row of next.themes) if (changed(before.themes.find((item) => item.id === row.id), row)) { await tx.siteTheme.update({ where: { id: row.id }, data: { templates: row.templates, settings: row.settings } }); updates += 1; }
    for (const row of next.mediaAssets) if (changed(before.mediaAssets.find((item) => item.id === row.id), row)) { await tx.mediaAsset.update({ where: { id: row.id }, data: { storageKey: row.storageKey, mimeType: row.mimeType, previewUrl: row.previewUrl, originUrl: row.originUrl, altText: row.altText, notes: row.notes } }); updates += 1; }
    for (const row of next.packs) if (changed(before.packs.find((item) => item.id === row.id), row)) { await tx.creativePack.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages, galleryImageAlts: row.galleryImageAlts } }); updates += 1; }
    for (const row of next.packCategories) if (changed(before.packCategories.find((item) => item.id === row.id), row)) { await tx.creativePackCategory.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, icon: row.icon } }); updates += 1; }
    for (const row of next.videoThemes) if (changed(before.videoThemes.find((item) => item.id === row.id), row)) { await tx.videoTheme.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages } }); updates += 1; }
    for (const row of next.videoExamples) if (changed(before.videoExamples.find((item) => item.id === row.id), row)) { await tx.videoThemeExample.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages } }); updates += 1; }
    for (const row of next.videoCategories) if (changed(before.videoCategories.find((item) => item.id === row.id), row)) { await tx.videoThemeCategory.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, icon: row.icon } }); updates += 1; }
    for (const row of next.products) if (changed(before.products.find((item) => item.id === row.id), row)) { await tx.product.update({ where: { id: row.id }, data: { metadata: row.metadata } }); updates += 1; }
    const protectedAfter = await protectedFingerprint(tx);
    if (hash(protectedBefore) !== hash(protectedAfter)) throw new Error("Protected business data changed during Aidreamcapes media-source repair.");
    const readback = await loadSources(tx);
    if (countInvalidAssets(readback) !== 0) throw new Error(`Invalid media references remain after write: ${countInvalidAssets(readback)}`);
    return { updates, protectedBefore, protectedAfter };
  }, { timeout: 600000, maxWait: 20000 });

  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, imagePool: imagePool.length, videoPool: videoPool.length, legacyReferencesBefore: counts.before, legacyReferencesAfter: counts.after, protectedDataUnchanged: hash(result.protectedBefore) === hash(result.protectedAfter), backupPath, ...result }, null, 2));
} finally {
  await prisma.$disconnect();
}
