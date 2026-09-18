#!/usr/bin/env node

// Read-only acceptance audit for the local Aidreamcapes EU 12-topic scope.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const ORIGIN = "https://aidreamcapes.eu";
const PREFIX = "/ai-save-the-date/";
const PUBLIC_ROOT = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date";
const LOCAL_ROOT = path.resolve("public", PUBLIC_ROOT.slice(1));
const TOPICS = ["valentines-day", "engagement", "proposal", "save-the-date", "wedding-invitation", "wedding-ceremony", "christmas", "halloween", "thanksgiving", "new-year", "mothers-day", "fathers-day"];
const SUPPLIER = /\/vendor-api-gpt-image-2-4k-v1\/|\/valentines-day-4k-vendor-v1\//;

function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function stableHash(value) { return sha256(Buffer.from(JSON.stringify(value ?? {}))); }
function imageUrl(value) { return typeof value === "string" ? value.split("?")[0].split("#")[0] : ""; }
function localFile(url) { return path.join("public", url.replace(/^\//, "")); }
function collectPageImageRefs(value, refs = []) {
  if (Array.isArray(value)) return value.forEach((item) => collectPageImageRefs(item, refs)), refs;
  if (!value || typeof value !== "object") return refs;
  if (typeof value.imageUrl === "string") refs.push({ src: imageUrl(value.imageUrl), alt: String(value.imageAlt ?? value.alt ?? "").trim() });
  if (typeof value.imageOriginalUrl === "string") refs.push({ src: imageUrl(value.imageOriginalUrl), alt: String(value.imageAlt ?? value.alt ?? "").trim() });
  if (Array.isArray(value.mediaManifest)) for (const item of value.mediaManifest) refs.push({ src: imageUrl(item.src), alt: String(item.alt ?? item.alt_text ?? "").trim() });
  for (const child of Object.values(value)) collectPageImageRefs(child, refs);
  return refs;
}
async function dHash(filePath) {
  const { data } = await sharp(filePath).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
  return bits;
}
function hamming(a, b) { let n = 0; for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) n += 1; return n; }

assertDatabaseTarget({ expectedTarget: "local" });
const prisma = new PrismaClient();
try {
  const paths = TOPICS.map((slug) => PREFIX + slug);
  const [pages, livePages, settings, mediaAssets, videoTheme] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: paths } }, select: { slug: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: paths } }, select: { slug: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true } }),
    prisma.mediaAsset.findMany({ where: { siteId: SITE_ID, storageKey: { contains: "/save-the-date/" } }, select: { storageKey: true, altText: true, mimeType: true, sourceType: true, previewUrl: true, originUrl: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "wedding-invitation" } }, select: { imageUrl: true, galleryImages: true } })
  ]);
  assert.equal(pages.length, 12, "ThemePage count");
  assert.equal(livePages.length, 12, "LivePage count");
  const pageMap = new Map(pages.map((page) => [page.slug, page]));
  const liveMap = new Map(livePages.map((page) => [page.slug, page]));
  const allManifest = [];
  const sourceAltByUrl = new Map();
  const pageReports = [];
  for (const slug of TOPICS) {
    const page = pageMap.get(PREFIX + slug);
    const live = liveMap.get(PREFIX + slug);
    const json = page.publishedJson;
    const manifest = json.mediaManifest ?? [];
    assert(manifest.length === (slug === "proposal" ? 10 : 11), `${slug}: manifest count`);
    assert.equal(stableHash(json), stableHash(live.contentJson), `${slug}: LivePage matches published JSON`);
    const heroTitle = json.sections[json.sectionsOrder.find((id) => json.sections[id]?.type === "editorial_hero")]?.settings?.title;
    assert.equal(page.title, json.seo.title, `${slug}: database title/SEO title`);
    assert(heroTitle?.trim(), `${slug}: hero/H1 source`);
    assert.equal(json.seo.canonical, `${ORIGIN}${PREFIX}${slug}`, `${slug}: canonical`);
    assert.equal(json.seo.canonicalPath, PREFIX + slug, `${slug}: canonicalPath`);
    assert.equal(json.seo.index, true, `${slug}: indexable`);
    assert.equal(json.seo.follow, true, `${slug}: followable`);
    assert.equal(json.seo.robots.maxImagePreview, "large", `${slug}: max image preview`);
    const manifestUrls = new Set();
    for (const item of manifest) {
      const url = imageUrl(item.src);
      assert(SUPPLIER.test(url), `${slug}: non-supplier manifest ${url}`);
      assert(!url.includes("eu-regenerated"), `${slug}: legacy manifest ${url}`);
      assert(!manifestUrls.has(url), `${slug}: duplicate manifest ${url}`);
      manifestUrls.add(url);
      assert(item.alt?.trim(), `${slug}: empty manifest alt`);
      allManifest.push({ slug, url, alt: item.alt });
    }
    const refs = collectPageImageRefs(json);
    for (const ref of refs) {
      if (!SUPPLIER.test(ref.src)) continue;
      const prior = sourceAltByUrl.get(ref.src);
      if (prior && prior !== ref.alt) throw new Error(`${slug}: same image has multiple alts: ${ref.src}`);
      sourceAltByUrl.set(ref.src, ref.alt);
    }
    assert(!JSON.stringify(json).includes("eu-regenerated"), `${slug}: legacy image reference`);
    pageReports.push({ slug, manifest: manifest.length, uniqueManifest: manifestUrls.size, imageObjects: refs.filter((ref) => SUPPLIER.test(ref.src)).length });
  }
  assert.equal(new Set(allManifest.map((item) => item.url)).size, 131, "cross-topic manifest duplicates");
  const binaryHashes = new Map();
  const perceptual = [];
  for (const item of allManifest) {
    const filePath = localFile(item.url);
    assert(fs.existsSync(filePath), `missing asset ${item.url}`);
    const buffer = await fsPromises.readFile(filePath);
    const metadata = await sharp(buffer).metadata();
    assert.equal(metadata.width, 3840, `${item.url}: width`);
    assert.equal(metadata.height, 2160, `${item.url}: height`);
    assert.equal(metadata.format, "jpeg", `${item.url}: format`);
    assert(!binaryHashes.has(sha256(buffer)), `exact binary duplicate ${item.url}`);
    binaryHashes.set(sha256(buffer), item.url);
    perceptual.push({ url: item.url, hash: await dHash(filePath) });
  }
  const nearDuplicates = [];
  for (let i = 0; i < perceptual.length; i += 1) for (let j = i + 1; j < perceptual.length; j += 1) if (hamming(perceptual[i].hash, perceptual[j].hash) <= 2) nearDuplicates.push([perceptual[i].url, perceptual[j].url]);
  assert.equal(nearDuplicates.length, 0, "perceptual duplicates");
  const mediaByKey = new Map(mediaAssets.map((asset) => [asset.storageKey, asset]));
  for (const item of allManifest) {
    const record = mediaByKey.get(item.url.slice(1));
    assert(record, `missing MediaAsset ${item.url}`);
    assert.equal(record.altText, item.alt, `MediaAsset alt ${item.url}`);
    assert.equal(record.mimeType, "image/jpeg", `MediaAsset mime ${item.url}`);
    assert(/vendor-api|4k-vendor|gpt-image-2/i.test(record.sourceType ?? ""), `MediaAsset source ${item.url}`);
  }
  const nav = settings?.publishedJson?.saveTheDateNavigation;
  assert.equal(nav?.groups?.length, 2, "navigation groups");
  const navItems = nav.groups.flatMap((group) => group.items ?? []).filter((item) => paths.includes(item.href));
  assert.equal(navItems.length, 12, "navigation topics");
  for (const item of navItems) assert(SUPPLIER.test(item.imageUrl) && item.imageAlt?.trim(), `navigation asset/alt ${item.href}`);
  if (videoTheme) {
    assert.equal(videoTheme.imageUrl, allManifest.find((item) => item.slug === "wedding-invitation").url, "wedding invitation VideoTheme cover");
    assert.deepEqual(videoTheme.galleryImages, allManifest.filter((item) => item.slug === "wedding-invitation").slice(1).map((item) => item.url), "wedding invitation VideoTheme gallery");
  }
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, pages: pageReports, totalManifest: allManifest.length, actual4K: allManifest.length, exactDuplicates: 0, perceptualDuplicates: 0, emptyAlts: 0, legacyReferences: 0, mediaAssetMatches: allManifest.length, navigationGroups: nav.groups.length, navigationTopics: navItems.length, videoThemeUpdated: Boolean(videoTheme), mode: "read-only" }, null, 2));
} finally {
  await prisma.$disconnect();
}
