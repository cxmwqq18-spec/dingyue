#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_ASSET_SLUG = "site_aidreamcapes_eu";
const ASSET_PREFIX = `/assets/sites/${SITE_ASSET_SLUG}/`;
const PUBLIC_ROOT = path.resolve("public");
const LEGACY_MARKER = `${ASSET_PREFIX}generated/eu-regenerated/`;
const RECOVERY_RELATIVE_ROOT = `assets/sites/${SITE_ASSET_SLUG}/generated/recovered/aidreamcapes-eu-legacy-paths-20260916-v1`;
const RECOVERY_PUBLIC_ROOT = `/${RECOVERY_RELATIVE_ROOT}/`;
const RECOVERY_FS_ROOT = path.resolve(PUBLIC_ROOT, RECOVERY_RELATIVE_ROOT);
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-legacy-path-recovery");
const VERSION = "20260916eulegacypathrecovery1";
const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|avif)$/i;

const args = process.argv.slice(2);
const APPLY = args.includes("--apply") || args.some((arg) => arg === "--mode=apply");

function clone(value) { return value === undefined ? undefined : structuredClone(value); }
function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function withVersion(value) { return `${stripQuery(value)}?v=${VERSION}`; }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function storageKey(value) { return stripQuery(value).replace(/^\//, ""); }
function isLegacyImage(value) { return typeof value === "string" && value.startsWith(LEGACY_MARKER) && IMAGE_EXT_RE.test(stripQuery(value)); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }
function publicFile(value) {
  const pathname = stripQuery(value);
  assert(pathname.startsWith(ASSET_PREFIX), `Unexpected asset namespace: ${value}`);
  const filePath = path.resolve(PUBLIC_ROOT, pathname.slice(1));
  assert(filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Asset escaped public root: ${value}`);
  return filePath;
}

async function imageInfo(filePath) {
  const buffer = fs.readFileSync(filePath);
  const metadata = await sharp(buffer).metadata();
  assert(metadata.width && metadata.height, `Invalid image dimensions: ${filePath}`);
  assert(buffer.length > 1024, `Image is unexpectedly small: ${filePath}`);
  return { buffer, width: metadata.width, height: metadata.height, format: metadata.format, bytes: buffer.length, sha256: sha256(buffer) };
}

function altFromAsset(value, existing) {
  if (existing && String(existing).trim()) return String(existing).trim();
  const basename = path.basename(stripQuery(value), path.extname(stripQuery(value))).replace(/[-_]+/g, " ").trim();
  return `Image éditoriale illustrant ${basename || "une scène visuelle"}.`;
}

function rewriteJson(value, rewriteUrl) {
  if (Array.isArray(value)) return value.map((item) => rewriteJson(item, rewriteUrl));
  if (value && typeof value === "object") {
    const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteJson(item, rewriteUrl)]));
    if (typeof next.imageList === "string") next.imageList = next.imageList.split("|").map((url) => isLegacyImage(url) ? rewriteUrl(url) : url).join("|");
    if (typeof next.galleryImages === "string") next.galleryImages = next.galleryImages.split("|").map((url) => isLegacyImage(url) ? rewriteUrl(url) : url).join("|");
    return next;
  }
  return isLegacyImage(value) ? rewriteUrl(value) : value;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const models = ["themePage", "livePage", "themeSettings", "siteTheme", "videoTheme", "videoThemeExample", "videoThemeCategory", "creativePack", "creativePackCategory", "mediaAsset"];
    const rows = [];
    for (const model of models) rows.push(...(await prisma[model].findMany({ where: { siteId: SITE_ID } })).map((row) => ({ model, row })));
    const legacyUrls = new Set();
    const collect = (value) => {
      if (Array.isArray(value)) value.forEach(collect);
      else if (value && typeof value === "object") Object.values(value).forEach(collect);
      else if (isLegacyImage(value)) legacyUrls.add(stripQuery(value));
    };
    rows.forEach(({ row }) => collect(row));
    const urlMap = new Map();
    const altMap = new Map();
    const files = [];
    const existingAltByUrl = new Map();
    for (const { model, row } of rows.filter(({ model }) => model === "mediaAsset")) {
      for (const key of ["previewUrl", "originUrl"]) if (isLegacyImage(row[key]) && row.altText) existingAltByUrl.set(stripQuery(row[key]), row.altText);
    }
    for (const legacyUrl of [...legacyUrls].sort()) {
      const source = publicFile(legacyUrl);
      const info = await imageInfo(source);
      const filename = `${info.sha256.slice(0, 12)}-${path.basename(source)}`;
      const targetFile = path.join(RECOVERY_FS_ROOT, filename);
      const targetUrl = withVersion(`${RECOVERY_PUBLIC_ROOT}${filename}`);
      urlMap.set(legacyUrl, targetUrl);
      altMap.set(targetUrl, altFromAsset(legacyUrl, existingAltByUrl.get(legacyUrl)));
      files.push({ legacyUrl, source, targetFile, targetUrl, info });
    }
    const rewriteUrl = (value) => {
      const base = stripQuery(value);
      return urlMap.get(base) || value;
    };
    const rewrittenRows = rows.map(({ model, row }) => {
      const next = clone(row);
      if (model === "themePage") {
        next.draftJson = rewriteJson(next.draftJson, rewriteUrl);
        next.publishedJson = rewriteJson(next.publishedJson, rewriteUrl);
      } else if (model === "livePage") next.contentJson = rewriteJson(next.contentJson, rewriteUrl);
      else if (model === "themeSettings") {
        next.draftJson = rewriteJson(next.draftJson, rewriteUrl);
        next.publishedJson = rewriteJson(next.publishedJson, rewriteUrl);
      } else if (model === "siteTheme") {
        next.templates = rewriteJson(next.templates, rewriteUrl);
        next.settings = rewriteJson(next.settings, rewriteUrl);
      } else if (["videoTheme", "videoThemeExample", "videoThemeCategory", "creativePack", "creativePackCategory"].includes(model)) {
        if (isLegacyImage(next.imageUrl)) next.imageUrl = rewriteUrl(next.imageUrl);
        if (Array.isArray(next.galleryImages)) next.galleryImages = next.galleryImages.map((url) => isLegacyImage(url) ? rewriteUrl(url) : url);
        if (Array.isArray(next.galleryImageAlts)) next.galleryImageAlts = next.galleryImages.map((url) => altMap.get(url) || "");
      } else if (model === "mediaAsset") {
        if (isLegacyImage(next.previewUrl)) next.previewUrl = rewriteUrl(next.previewUrl);
        if (isLegacyImage(next.originUrl)) next.originUrl = rewriteUrl(next.originUrl);
        const url = isLegacyImage(row.previewUrl) ? rewriteUrl(row.previewUrl) : isLegacyImage(row.originUrl) ? rewriteUrl(row.originUrl) : null;
        if (url) next.altText = altMap.get(url) || altFromAsset(url, row.altText);
      }
      return { model, row, next };
    });
    const changed = rewrittenRows.filter(({ row, next }) => JSON.stringify(row) !== JSON.stringify(next));
    const report = {
      ok: true,
      mode: APPLY ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      legacyUnique: legacyUrls.size,
      copiedFiles: files.length,
      changedRows: changed.length,
      recoveryRoot: RECOVERY_PUBLIC_ROOT,
      legacyProviderCalls: 0,
      sourceDimensions: [...new Set(files.map((file) => `${file.info.width}x${file.info.height}`))],
      note: "Legacy files were copied and rebound without deleting originals or calling an image provider."
    };
    if (APPLY) {
      fs.mkdirSync(RECOVERY_FS_ROOT, { recursive: true });
      for (const file of files) if (!fs.existsSync(file.targetFile)) fs.copyFileSync(file.source, file.targetFile);
      const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, rows);
      await prisma.$transaction(async (tx) => {
        for (const { model, row, next } of rewrittenRows) {
          if (JSON.stringify(row) === JSON.stringify(next)) continue;
          if (model === "themePage") await tx.themePage.update({ where: { id: row.id }, data: { draftJson: next.draftJson, publishedJson: next.publishedJson } });
          else if (model === "livePage") await tx.livePage.update({ where: { id: row.id }, data: { contentJson: next.contentJson } });
          else if (model === "themeSettings") await tx.themeSettings.update({ where: { id: row.id }, data: { draftJson: next.draftJson, publishedJson: next.publishedJson } });
          else if (model === "siteTheme") await tx.siteTheme.update({ where: { id: row.id }, data: { templates: next.templates, settings: next.settings } });
          else if (model === "mediaAsset") await tx.mediaAsset.update({ where: { id: row.id }, data: { previewUrl: next.previewUrl, originUrl: next.originUrl, altText: next.altText } });
          else if (model === "videoTheme") await tx.videoTheme.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages } });
          else if (model === "videoThemeExample") await tx.videoThemeExample.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages } });
          else if (model === "videoThemeCategory") await tx.videoThemeCategory.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl } });
          else if (model === "creativePack") await tx.creativePack.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages, galleryImageAlts: next.galleryImageAlts } });
          else if (model === "creativePackCategory") await tx.creativePackCategory.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl } });
        }
        for (const file of files) {
          const url = file.targetUrl;
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey: storageKey(url) } },
            create: { id: `media_${SITE_ID}_legacy_recovery_${sha256(Buffer.from(url)).slice(0, 24)}`, siteId: SITE_ID, label: path.basename(url.split("?")[0]), storageKey: storageKey(url), mimeType: file.info.format === "jpeg" ? "image/jpeg" : `image/${file.info.format || "webp"}`, usageType: "theme", sourceType: "aidreamcapes-eu-legacy-path-recovered", previewUrl: url, originUrl: url, altText: altMap.get(url), notes: `Copied from ${file.legacyUrl}; original retained; no provider request.` },
            update: { previewUrl: url, originUrl: url, altText: altMap.get(url), sourceType: "aidreamcapes-eu-legacy-path-recovered" }
          });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    writeJson(path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), report);
    console.log(JSON.stringify(report, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
