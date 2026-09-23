#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const DOMAIN = "aidreamcapes.eu";
const PUBLIC_ROOT = path.resolve("public");
const ASSET_PREFIX = "/assets/sites/site_aidreamcapes_eu/";
const RESTORED_ROOT = path.resolve("public/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1");
const REPORT_PATH = path.resolve(process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) || "reports/aidreamcapes-eu-production-media-map.json");
const MATERIALIZE = process.argv.includes("--materialize");
const IMAGE_RE = /\.(?:jpe?g|png|webp|avif|gif|svg)(?:$|[?#])/i;
const MODELS = [
  "livePage", "themePage", "themeSettings", "videoTheme", "videoThemeExample",
  "videoThemeCategory", "creativePack", "creativePackCategory", "storefrontProfile", "sitePublishedState"
];
const STAGED_ROOTS = [
  path.resolve(".tmp/aidreamcapes-eu-image-regeneration"),
  path.resolve(".tmp/aidreamcapes-eu-video-topic-regeneration"),
  path.resolve(".tmp/aidreamcapes-eu-talking-photo-regeneration")
];

function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function normalizeAssetUrl(value) {
  const clean = stripQuery(value);
  if (clean.startsWith("/assets/")) return clean;
  if (clean.startsWith("assets/")) return `/${clean}`;
  if (clean.startsWith("/sites/site_aidreamcapes_eu/")) return `/assets${clean}`;
  if (clean.startsWith("sites/site_aidreamcapes_eu/")) return `/assets/${clean}`;
  return clean;
}
function sha256(filePath) { return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex"); }
function safeRelative(filePath) {
  const resolved = path.resolve(filePath);
  assert(resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Source is outside public root: ${filePath}`);
  return `/${path.relative(PUBLIC_ROOT, resolved).split(path.sep).join("/")}`;
}
function walk(root, result = []) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) walk(filePath, result);
    else if (entry.isFile() && IMAGE_RE.test(entry.name)) result.push(filePath);
  }
  return result;
}
function basenameStem(value) { return path.basename(value).replace(/\.[^.]+$/, ""); }
function replaceExt(value, ext) { return value.replace(/\.[^.]+$/, ext); }
function normalizePackFileName(value) {
  return value.replace(/^(cover|gallery-\d+)-[a-f0-9]{8,16}-/i, "$1-");
}
function findExisting(index, key) {
  const matches = index.get(key) || [];
  return matches.length === 1 ? matches[0] : null;
}
function copyByteForByte(sourcePath, destinationPath) {
  assert(!sourcePath.includes("/site_aidreamshoots/"), `Forbidden cross-site source: ${sourcePath}`);
  assert(fs.existsSync(sourcePath), `Missing source: ${sourcePath}`);
  fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
  const pending = `${destinationPath}.pending`;
  fs.copyFileSync(sourcePath, pending);
  fs.renameSync(pending, destinationPath);
  assert.equal(sha256(sourcePath), sha256(destinationPath), `Copy verification failed: ${destinationPath}`);
}
async function findManyOptional(client, modelName, args) {
  try { return await client[modelName].findMany(args); }
  catch (error) { if (error?.code === "P2021") return []; throw error; }
}
function collect(value, output) {
  if (typeof value === "string") {
    for (const match of value.match(/(?:\/?(?:assets\/|sites\/))[^?#"'\s]+/g) || []) {
      const url = normalizeAssetUrl(match);
      if (url.startsWith(ASSET_PREFIX) && IMAGE_RE.test(url)) output.add(url);
    }
    return;
  }
  if (Array.isArray(value)) { value.forEach((item) => collect(item, output)); return; }
  if (value && typeof value === "object") Object.values(value).forEach((item) => collect(item, output));
}
function loadLocalRebindMap() {
  const beforePath = path.resolve("reports/aidreamcapes-eu-image-source-map-before-staged-rebind.json");
  const finalPath = path.resolve("reports/aidreamcapes-eu-image-source-map-final.json");
  if (!fs.existsSync(beforePath) || !fs.existsSync(finalPath)) return new Map();
  const before = JSON.parse(fs.readFileSync(beforePath, "utf8"));
  const final = JSON.parse(fs.readFileSync(finalPath, "utf8"));
  const finalBySource = new Map(final.assets.filter((asset) => asset.sourcePath).map((asset) => [asset.sourcePath, asset.currentUrl]));
  const map = new Map();
  for (const asset of before.assets) {
    const destination = finalBySource.get(asset.sourcePath);
    if (destination && asset.currentUrl !== destination) map.set(stripQuery(asset.currentUrl), destination);
  }
  return map;
}

assertDatabaseTarget({ expectedTarget: "remote-readonly" });
fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
const restoredFiles = walk(RESTORED_ROOT);
const restoredByRelative = new Map(restoredFiles.map((filePath) => [path.relative(RESTORED_ROOT, filePath).split(path.sep).join("/"), filePath]));
const restoredByBasename = new Map();
for (const filePath of restoredFiles) {
  const key = basenameStem(filePath);
  restoredByBasename.set(key, [...(restoredByBasename.get(key) || []), filePath]);
}
const stagedByBasename = new Map();
for (const root of STAGED_ROOTS) for (const filePath of walk(root)) {
  const key = path.basename(filePath);
  stagedByBasename.set(key, [...(stagedByBasename.get(key) || []), filePath]);
}
const localRebindMap = loadLocalRebindMap();
const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: DOMAIN });
  const urls = new Set();
  for (const modelName of MODELS) {
    const rows = await findManyOptional(prisma, modelName, { where: { siteId: SITE_ID } });
    for (const row of rows) {
      for (const field of ["contentJson", "draftJson", "publishedJson", "draftMeta", "branding", "imageUrl", "galleryImages"]) collect(row[field], urls);
      if (modelName === "mediaAsset") collect(row.storageKey, urls);
    }
  }
  const mediaAssets = await prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, select: { storageKey: true, previewUrl: true, originUrl: true } });
  for (const row of mediaAssets) [row.storageKey, row.previewUrl, row.originUrl].forEach((value) => collect(value, urls));

  const replacements = [];
  const unresolved = [];
  const destinationSource = new Map();
  for (const currentUrl of [...urls].sort()) {
    if (localRebindMap.has(currentUrl)) {
      replacements.push({ from: currentUrl, to: localRebindMap.get(currentUrl), reason: "verified-local-rebind-map" });
      continue;
    }
    const relative = currentUrl.slice(ASSET_PREFIX.length);
    let sourcePath = null;
    let destinationUrl = null;
    const packMatch = relative.match(/^generated\/recovered\/aidreamcapes-eu-image-pack-[^/]+\/(.+)$/);
    if (packMatch) {
      const packRelative = packMatch[1];
      const directory = path.posix.dirname(packRelative);
      const filename = normalizePackFileName(path.posix.basename(packRelative)).replace(/\.(?:jpe?g|png)$/i, ".webp");
      const candidate = path.posix.join(directory, filename);
      sourcePath = restoredByRelative.get(candidate) || null;
      if (sourcePath) destinationUrl = safeRelative(sourcePath);
    }
    if (!sourcePath && /\/generated\/recovered\/aidreamcapes-eu-provider-[^/]+\//.test(currentUrl)) {
      const key = `asset-${basenameStem(relative)}\u0000webp`;
      const matches = restoredFiles.filter((filePath) => `${path.basename(filePath).replace(/\.[^.]+$/, "")}\u0000webp` === key);
      sourcePath = matches.length === 1 ? matches[0] : null;
      if (sourcePath) destinationUrl = safeRelative(sourcePath);
    }
    if (!sourcePath && relative.startsWith("generated/eu-regenerated/")) {
      const fileName = path.basename(relative);
      const matches = stagedByBasename.get(fileName) || [];
      sourcePath = matches.length === 1 ? matches[0] : null;
      if (sourcePath) {
        const digest = sha256(sourcePath).slice(0, 16);
        const destinationPath = path.join(RESTORED_ROOT, "production-source", `${digest}-${fileName}`);
        destinationUrl = safeRelative(destinationPath);
        if (MATERIALIZE && !fs.existsSync(destinationPath)) copyByteForByte(sourcePath, destinationPath);
      }
    }
    if (!sourcePath && /\/generated\/recovered\/aidreamcapes-eu-legacy-paths-[^/]+\//.test(currentUrl)) {
      const fileName = path.basename(relative);
      const stem = fileName.replace(/\.[^.]+$/, "").replace(/^[a-f0-9]{8,16}-/, "");
      const matches = restoredFiles.filter((filePath) => path.basename(filePath).replace(/^asset-/, "").replace(/\.[^.]+$/, "") === stem);
      sourcePath = matches.length === 1 ? matches[0] : null;
      if (sourcePath) destinationUrl = safeRelative(sourcePath);
    }
    if (sourcePath && destinationUrl) {
      const previousSource = destinationSource.get(destinationUrl);
      if (previousSource && previousSource !== sourcePath) assert.fail(`Destination maps to multiple sources: ${destinationUrl}`);
      destinationSource.set(destinationUrl, sourcePath);
      replacements.push({ from: currentUrl, to: destinationUrl, sourcePath, sourceUrl: path.relative(process.cwd(), sourcePath).split(path.sep).join("/"), reason: "verified-EU-original" });
    } else {
      unresolved.push({ url: currentUrl, reason: "no-trusted-EU-original-mapping" });
    }
  }
  const result = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    siteSlug: SITE_SLUG,
    primaryDomain: DOMAIN,
    policy: { providerCalls: 0, copiedFromSiteAidreamshoots: 0, derivativesUsedAsOriginal: 0, databaseWrites: 0 },
    sourceRoot: "EU-local-restored-or-staged-only",
    totalCurrentUrls: urls.size,
    mappedUrls: replacements.length,
    unresolvedUrls: unresolved.length,
    replacements,
    unresolved
  };
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ ...result, replacements: undefined }, null, 2));
  if (unresolved.length) process.exitCode = 2;
} finally { await prisma.$disconnect(); }
