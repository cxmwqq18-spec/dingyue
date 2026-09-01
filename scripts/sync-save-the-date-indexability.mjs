#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const formalPaths = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/easter",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];

function indexablePageJson(value, canonicalPath) {
  const json = structuredClone(value || {});
  json.seo = {
    ...(json.seo || {}),
    canonicalPath,
    canonical: `https://www.mydreamshoots.com${canonicalPath}`,
    index: true,
    follow: true,
    robots: {
      ...(json.seo?.robots || {}),
      index: true,
      follow: true,
      maxImagePreview: "large"
    }
  };
  return json;
}

function synchronizeManifestAlt(value, mediaAssetByStorageKey) {
  const json = structuredClone(value || {});
  if (Array.isArray(json.mediaManifest)) {
    json.mediaManifest = json.mediaManifest.map((item) => {
      const asset = mediaAssetByStorageKey.get(item.src);
      return asset?.altText ? { ...item, alt: asset.altText } : item;
    });
  }
  return json;
}

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
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) {
    return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  }
  return originalResolveFilename.call(this, resolved, ...args);
};

const prisma = new PrismaClient();
try {
  const [pages, mediaAssets] = await Promise.all([
    prisma.themePage.findMany({
      where: { siteId, slug: { in: formalPaths } },
      select: { id: true, slug: true, draftJson: true, publishedJson: true }
    }),
    prisma.mediaAsset.findMany({
      where: { siteId },
      select: { id: true, storageKey: true, altText: true }
    })
  ]);
  const found = new Set(pages.map((page) => page.slug));
  const missing = formalPaths.filter((canonicalPath) => !found.has(canonicalPath));
  if (missing.length) throw new Error(`missing_save_the_date_pages:${missing.join(",")}`);

  const changed = pages
    .filter((page) => page.draftJson?.seo?.index !== true || page.draftJson?.seo?.robots?.index !== true || page.publishedJson?.seo?.index !== true || page.publishedJson?.seo?.robots?.index !== true)
    .map((page) => page.slug)
    .sort();
  const mediaAssetByStorageKey = new Map(mediaAssets.map((asset) => [asset.storageKey, asset]));
  const manifestMedia = pages.flatMap((page) => (page.publishedJson?.mediaManifest || []).map((item) => ({ page: page.slug, ...item })));
  const missingMedia = manifestMedia.filter((item) => !mediaAssetByStorageKey.has(item.src));
  if (missingMedia.length) throw new Error(`missing_save_the_date_media:${missingMedia.map((item) => `${item.page}:${item.src}`).join(",")}`);
  const mediaAltChanged = manifestMedia
    .filter((item) => mediaAssetByStorageKey.get(item.src)?.altText !== item.alt)
    .map((item) => item.src)
    .sort();

  let currentState = null;
  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const page of pages) {
        const nextDraft = indexablePageJson(synchronizeManifestAlt(page.draftJson, mediaAssetByStorageKey), page.slug);
        const nextPublished = indexablePageJson(synchronizeManifestAlt(page.publishedJson, mediaAssetByStorageKey), page.slug);
        await tx.themePage.update({
          where: { id: page.id },
          data: {
            draftJson: nextDraft,
            publishedJson: nextPublished
          }
        });
      }
      for (const item of manifestMedia) {
        const asset = mediaAssetByStorageKey.get(item.src);
        if (asset?.altText === item.alt) continue;
        await tx.mediaAsset.update({ where: { id: asset.id }, data: { altText: item.alt } });
      }
    });
    currentState = { mode: "live-draft-json", noOp: false };
  }

  console.log(JSON.stringify({
    ok: true,
    siteId,
    mode: apply ? "save-immediately-live" : "dry-run",
    formalPageCount: formalPaths.length,
    changed,
    mediaAltChanged,
    currentState
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
