#!/usr/bin/env node
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const APPLY = process.argv.includes("--apply");
const PAGE_DEFINITIONS = JSON.parse(
  await fsPromises.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-manifest.json", import.meta.url), "utf8")
);
const ALT_OVERRIDES = JSON.parse(
  await fsPromises.readFile(new URL("./data/aidreamcapes-eu-save-the-date-vendor-alt-fr.json", import.meta.url), "utf8")
);
const PAGE_PATH = (slug) => "/ai-save-the-date/" + slug;
const outputFilename = (filename) => filename.replace(/\.(?:webp|jpe?g)$/i, ".jpg");
const filenameFromUrl = (value) => {
  if (typeof value !== "string") return "";
  return value.split("?")[0].split("#")[0].split("/").at(-1) || "";
};
const assets = PAGE_DEFINITIONS.flatMap((page) =>
  page.assets.map(([originalFilename, alt], index) => {
    const filename = outputFilename(originalFilename);
    const hero = index === 0;
    return {
      pageSlug: page.slug,
      pagePath: PAGE_PATH(page.slug),
      originalFilename,
      filename,
      alt: ALT_OVERRIDES[page.slug]?.[index] ?? alt,
      caption: alt,
      src: PUBLIC_BASE + "/" + page.slug + "/" + filename,
      storageKey: PUBLIC_BASE.slice(1) + "/" + page.slug + "/" + filename,
      width: 3840,
      height: 2160,
      format: "JPEG",
      loading: hero ? "eager" : "lazy",
      fetchPriority: hero ? "high" : "auto"
    };
  })
);
if (assets.length !== 109) throw new Error("unexpected_asset_count:" + assets.length);
const assetByKey = new Map(assets.map((asset) => [asset.pageSlug + ":" + asset.originalFilename, asset]));
const assetByOutputKey = new Map(assets.map((asset) => [asset.pageSlug + ":" + asset.filename, asset]));
const assetByAlt = new Map(assets.map((asset) => [asset.pageSlug + ":" + asset.alt, asset]));
function findAsset(pageSlug, value) {
  const name = filenameFromUrl(value);
  return assetByKey.get(pageSlug + ":" + name) ?? assetByOutputKey.get(pageSlug + ":" + name) ?? assetByAlt.get(pageSlug + ":" + String(value ?? "").trim());
}
function patchImageObjects(value, pageSlug, state) {
  if (Array.isArray(value)) return value.map((item) => patchImageObjects(item, pageSlug, state));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, patchImageObjects(item, pageSlug, state)]));
  const hasImageReference = typeof next.imageUrl === "string" || typeof next.imageOriginalUrl === "string" || typeof next.src === "string";
  const asset = findAsset(pageSlug, next.imageUrl) ?? findAsset(pageSlug, next.imageOriginalUrl) ?? findAsset(pageSlug, next.src) ?? findAsset(pageSlug, next.alt ?? next.imageAlt);
  const pageAssets = assets.filter((item) => item.pageSlug === pageSlug);
  const positionalAsset = pageSlug === "engagement" && hasImageReference && pageAssets.length
    ? pageAssets[state.imageIndex++ % pageAssets.length]
    : null;
  const resolvedAsset = asset ?? positionalAsset;
  if (!resolvedAsset) return next;
  return {
    ...next,
    imageUrl: resolvedAsset.src,
    imageOriginalUrl: resolvedAsset.src,
    imageAlt: resolvedAsset.alt,
    alt: resolvedAsset.alt,
    caption: typeof next.caption === "string" ? resolvedAsset.alt : next.caption,
    imageWidth: resolvedAsset.width,
    imageHeight: resolvedAsset.height,
    imageLoading: resolvedAsset.loading,
    imageFetchPriority: resolvedAsset.fetchPriority
  };
}
function patchPageJson(value, pageSlug) {
  const next = patchImageObjects(structuredClone(value ?? {}), pageSlug, { imageIndex: 0 });
  if (Array.isArray(next.mediaManifest)) {
    next.mediaManifest = next.mediaManifest.map((item, index) => {
      const asset = findAsset(pageSlug, item?.filename) ?? findAsset(pageSlug, item?.src);
      if (!asset) return item;
      return {
        ...item,
        filename: asset.originalFilename,
        src: asset.src,
        alt: asset.alt,
        alt_text: asset.alt,
        caption: asset.alt,
        width: asset.width,
        height: asset.height,
        format: asset.format,
        loading: asset.loading,
        fetchPriority: asset.fetchPriority,
        fetchpriority: asset.fetchPriority,
        role: item.role ?? (index === 0 ? "hero" : "supporting"),
        source: "AI-generated 4K editorial photograph via supplier API"
      };
    });
  }
  if (next.seo && typeof next.seo === "object") {
    const hero = assets.find((asset) => asset.pageSlug === pageSlug);
    if (hero) next.seo = { ...next.seo, ogImage: hero.src, twitterImage: hero.src };
  }
  return next;
}
function patchNavigation(value) {
  if (Array.isArray(value)) return value.map(patchNavigation);
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, patchNavigation(item)]));
  if (typeof next.href === "string") {
    const pageSlug = PAGE_DEFINITIONS.find((page) => PAGE_PATH(page.slug) === next.href)?.slug;
    const hero = pageSlug ? assets.find((asset) => asset.pageSlug === pageSlug) : null;
    if (hero) return { ...next, imageUrl: hero.src, imageAlt: hero.alt };
  }
  return next;
}
for (const asset of assets) {
  const filePath = path.join(LOCAL_BASE, asset.pageSlug, asset.filename);
  if (!fs.existsSync(filePath)) throw new Error("missing_generated_4k_asset:" + filePath);
}
assertDatabaseTarget({ expectedTarget: "local" });
const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({
    where: { siteId: SITE_ID, slug: { in: PAGE_DEFINITIONS.map((page) => PAGE_PATH(page.slug)) } },
    select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true }
  });
  const pageBySlug = new Map(pages.map((page) => [page.slug.slice("/ai-save-the-date/".length), page]));
  const settings = await prisma.themeSettings.findUnique({
    where: { siteId: SITE_ID },
    select: { draftJson: true, publishedJson: true }
  });
  const pageResults = [];
  for (const pageDefinition of PAGE_DEFINITIONS) {
    const page = pageBySlug.get(pageDefinition.slug);
    if (!page) throw new Error("theme_page_not_found:" + SITE_ID + PAGE_PATH(pageDefinition.slug));
    const nextDraft = patchPageJson(page.draftJson, pageDefinition.slug);
    const publishedSource = page.publishedJson && typeof page.publishedJson === "object" && Object.keys(page.publishedJson).length ? page.publishedJson : page.draftJson;
    const nextPublished = patchPageJson(publishedSource, pageDefinition.slug);
    pageResults.push({
      pageDefinition,
      page,
      nextDraft,
      nextPublished,
      assetCount: pageDefinition.assets.length
    });
  }
  const nextSettingsDraft = settings ? patchNavigation(settings.draftJson) : null;
  const nextSettingsPublished = settings ? patchNavigation(settings.publishedJson) : null;
  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      for (const asset of assets) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.storageKey } },
          create: {
            id: "media_" + SITE_ID + "_save_date_vendor_v1_" + asset.pageSlug + "_" + asset.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase(),
            siteId: SITE_ID,
            label: asset.filename,
            storageKey: asset.storageKey,
            mimeType: "image/jpeg",
            usageType: "theme",
            sourceType: "save-the-date-" + asset.pageSlug + "-vendor-api-gpt-image-2-4k-v1",
            previewUrl: asset.src,
            originUrl: asset.src,
            altText: asset.alt,
            notes: asset.caption
          },
          update: {
            label: asset.filename,
            previewUrl: asset.src,
            originUrl: asset.src,
            altText: asset.alt,
            notes: asset.caption
          }
        });
      }
      for (const result of pageResults) {
        await tx.themePage.update({
          where: { id: result.page.id },
          data: { draftJson: result.nextDraft, publishedJson: result.nextPublished }
        });
        await tx.livePage.updateMany({
          where: { siteId: SITE_ID, slug: result.page.slug },
          data: { contentJson: result.nextPublished }
        });
      }
      if (settings && nextSettingsDraft && nextSettingsPublished) {
        await tx.themeSettings.update({
          where: { siteId: SITE_ID },
          data: { draftJson: nextSettingsDraft, publishedJson: nextSettingsPublished }
        });
      }
    });
  }
  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    mode: APPLY ? "applied" : "dry-run",
    pages: pageResults.map((result) => ({
      slug: result.pageDefinition.slug,
      path: result.page.slug,
      assets: result.assetCount,
      hero: assets.find((asset) => asset.pageSlug === result.pageDefinition.slug)?.src
    })),
    totalAssets: assets.length,
    targetSize: "3840x2160",
    seo: "descriptive alt, mediaManifest, page image objects, OG image, Twitter image, and save-the-date navigation updated",
    generatedSource: "supplier API"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
