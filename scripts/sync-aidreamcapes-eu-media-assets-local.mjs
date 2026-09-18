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
const ASSET_PREFIX = "/assets/sites/site_aidreamcapes_eu/";
const PUBLIC_ROOT = path.resolve("public");
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-media-asset-sync");
const SAVE_DATE_PREFIX = "/ai-save-the-date/";
const args = new Set(process.argv.slice(2));
const APPLY = args.has("--apply") || args.has("--mode=apply");

const EXPECTED_PACKS = 39;
// The retired Easter page is no longer part of the EU public set. The
// wedding-anniversary row remains as a legacy no-content alias and is still
// included in this synchronization query.
const EXPECTED_SAVE_DATE_PAGES = 13;

function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function isAssetUrl(value) { return typeof value === "string" && stripQuery(value).startsWith(ASSET_PREFIX); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function storageKey(value) { return stripQuery(value).replace(/^\//, ""); }
function localPath(value) { return path.resolve(PUBLIC_ROOT, stripQuery(value).slice(1)); }
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

function collectAsset(assets, url, alt, label, usageType, sourceType) {
  if (!isAssetUrl(url)) return;
  const cleanUrl = stripQuery(url);
  const previous = assets.get(cleanUrl);
  const normalizedAlt = String(alt || "").trim();
  // Package assets are registered first. If a page reuses one of those URLs,
  // retain the package's canonical alt and normalize the page JSON below.
  assets.set(cleanUrl, {
    url: previous?.url || url,
    alt: previous?.alt || normalizedAlt,
    label: previous?.label || label,
    usageType: previous?.usageType || usageType,
    sourceType: previous?.sourceType || sourceType
  });
}

function normalizeCanonicalAlts(value, canonicalAlts) {
  if (Array.isArray(value)) return value.map((item) => normalizeCanonicalAlts(item, canonicalAlts));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeCanonicalAlts(item, canonicalAlts)]));
  const imageUrl = typeof next.src === "string" && isAssetUrl(next.src)
    ? next.src
    : typeof next.imageUrl === "string" && isAssetUrl(next.imageUrl)
      ? next.imageUrl
      : null;
  if (imageUrl) {
    const alt = canonicalAlts.get(stripQuery(imageUrl));
    if (alt) for (const key of ["alt", "imageAlt", "altText", "alt_text"]) if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = alt;
  }
  return next;
}

async function validate(url) {
  const filePath = localPath(url);
  assert(fs.existsSync(filePath), `Missing referenced EU image: ${url}`);
  const buffer = fs.readFileSync(filePath);
  const metadata = await sharp(buffer).metadata();
  assert.equal(metadata.format, "jpeg", `EU image must be JPEG: ${url}`);
  assert.equal(metadata.width, 3840, `EU image width must be 3840: ${url}`);
  assert.equal(metadata.height, 2160, `EU image height must be 2160: ${url}`);
  return { path: filePath, bytes: buffer.length, format: metadata.format, width: metadata.width, height: metadata.height };
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [packs, savePages, mediaAssets] = await Promise.all([
      prisma.creativePack.findMany({ where: { siteId: SITE_ID, status: "active" }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: SAVE_DATE_PREFIX } }, orderBy: { slug: "asc" } }),
      prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } })
    ]);
    assert.equal(packs.length, EXPECTED_PACKS, `Expected ${EXPECTED_PACKS} active EU image packs, got ${packs.length}.`);
    assert.equal(savePages.length, EXPECTED_SAVE_DATE_PAGES, `Expected ${EXPECTED_SAVE_DATE_PAGES} Save the Date LivePages, got ${savePages.length}.`);

    const assets = new Map();
    for (const pack of packs) {
      const slug = pack.categoryRecord?.slug || pack.category || pack.id;
      const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
      const urls = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])];
      urls.forEach((url, index) => collectAsset(assets, url, alts[index], `${slug} ${index === 0 ? "cover" : `gallery ${index}`}`, "package", "aidreamcapes-eu-image-pack-existing-asset-normalized-4k"));
    }
    for (const page of savePages) {
      const manifest = Array.isArray(page.contentJson?.mediaManifest) ? page.contentJson.mediaManifest : [];
      for (const [index, item] of manifest.entries()) collectAsset(assets, item?.src, item?.alt, `${page.slug} ${index === 0 ? "hero" : `image ${index}`}`, "save-the-date", "buming-image / gpt-image-2 existing supplier asset");
    }
    assert.equal(assets.size, 638, `Expected 638 unique EU package/Save the Date assets, got ${assets.size}.`);

    const canonicalAlts = new Map([...assets.values()].map((item) => [stripQuery(item.url), item.alt]).filter(([, alt]) => alt));
    const nextSavePages = savePages.map((page) => ({ page, contentJson: normalizeCanonicalAlts(page.contentJson, canonicalAlts) }));
    const saveThemePages = await prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: SAVE_DATE_PREFIX } }, orderBy: { slug: "asc" } });
    const nextSaveThemePages = saveThemePages.map((page) => ({ page, draftJson: normalizeCanonicalAlts(page.draftJson, canonicalAlts), publishedJson: normalizeCanonicalAlts(page.publishedJson, canonicalAlts) }));

    const validation = [];
    for (const item of assets.values()) validation.push({ ...item, validation: await validate(item.url) });
    const existingByStorageKey = new Map(mediaAssets.map((row) => [String(row.storageKey || ""), row]));
    const updates = [];
    const creates = [];
    for (const item of validation) {
      const key = storageKey(item.url);
      const data = {
        label: item.label,
        storageKey: key,
        mimeType: "image/jpeg",
        usageType: item.usageType,
        sourceType: item.sourceType,
        previewUrl: item.url,
        originUrl: item.url,
        altText: item.alt || null
      };
      const existing = existingByStorageKey.get(key);
      if (existing) updates.push({ existing, data });
      else creates.push({ id: `media_${SITE_ID}_${sha256(key).slice(0, 16)}`, data });
    }

    const summary = {
      ok: true,
      mode: APPLY ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      activePacks: packs.length,
      saveDatePages: savePages.length,
      uniqueAssets: assets.size,
      validatedAssets: validation.length,
      expectedDimensions: "3840x2160",
      expectedFormat: "jpeg",
      mediaAssetsAlreadyPresent: updates.length,
      mediaAssetsToCreate: creates.length,
      providerCalls: 0,
      oldResourcesDeleted: 0,
      saveDateLivePagesNeedingCanonicalAlt: nextSavePages.filter(({ page, contentJson }) => JSON.stringify(page.contentJson) !== JSON.stringify(contentJson)).length,
      saveDateThemePagesNeedingCanonicalAlt: nextSaveThemePages.filter(({ page, draftJson, publishedJson }) => JSON.stringify(page.draftJson) !== JSON.stringify(draftJson) || JSON.stringify(page.publishedJson) !== JSON.stringify(publishedJson)).length
    };
    if (APPLY) {
      const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        createdAt: new Date().toISOString(),
        siteId: SITE_ID,
        updates: updates.map(({ existing }) => existing),
        creates: creates.map(({ id, data }) => ({ id, ...data })),
        livePages: nextSavePages.filter(({ page, contentJson }) => JSON.stringify(page.contentJson) !== JSON.stringify(contentJson)).map(({ page }) => page),
        themePages: nextSaveThemePages.filter(({ page, draftJson, publishedJson }) => JSON.stringify(page.draftJson) !== JSON.stringify(draftJson) || JSON.stringify(page.publishedJson) !== JSON.stringify(publishedJson)).map(({ page }) => page)
      });
      await prisma.$transaction(async (tx) => {
        for (const { existing, data } of updates) await tx.mediaAsset.update({ where: { id: existing.id }, data });
        for (const { id, data } of creates) await tx.mediaAsset.create({ data: { id, siteId: SITE_ID, ...data } });
        for (const { page, contentJson } of nextSavePages) {
          if (JSON.stringify(page.contentJson) !== JSON.stringify(contentJson)) await tx.livePage.update({ where: { id: page.id }, data: { contentJson, updatedAt: new Date() } });
        }
        for (const { page, draftJson, publishedJson } of nextSaveThemePages) {
          if (JSON.stringify(page.draftJson) !== JSON.stringify(draftJson) || JSON.stringify(page.publishedJson) !== JSON.stringify(publishedJson)) await tx.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson, updatedAt: new Date() } });
        }
      }, { maxWait: 30_000, timeout: 180_000 });
      summary.backupPath = backupPath;
    }
    writeJson(path.join(REPORT_ROOT, `${APPLY ? "apply" : "dry-run"}-summary.json`), summary);
    console.log(JSON.stringify(summary, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
