#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const siteId = "site_aidreamcapes_xby";
const assetPrefix = "/assets/sites/site_aidreamcapes_eu/";
const expectedSlugs = [
  "avatar", "background-changer", "background-remover", "bikini", "black-friday", "boudoir", "cannes",
  "christmas-photo", "color-correction", "cyberpunk", "edit-by-prompt", "engagement-photo", "gala-photo",
  "hairstyle-generator", "halloween-photo", "headshot", "holiday", "mafia", "magic-eraser", "motion-generator",
  "nightlife", "old-photo-restoration", "only-fans", "photo-enhancer", "portrait-photo", "portrait-retouch",
  "rich-lifestyle", "singles-awareness-day", "soccer", "social-cards", "street-style", "swimsuit",
  "thanksgiving-photo", "travel", "unblur-image", "urban", "valentines-photo", "virtual-try-on", "wedding-photo"
];
const legacySlugs = new Set([
  "motion-generator", "background-remover", "color-correction", "edit-by-prompt", "hairstyle-generator",
  "magic-eraser", "old-photo-restoration", "portrait-retouch", "background-changer", "social-cards",
  "unblur-image", "photo-enhancer", "virtual-try-on"
]);
const genericAltPattern = /(?:cover image|storefront image|image de couverture|imagen de escaparate|representative cover|polished .* style|half-body editorial pose|group-friendly composition|wide environmental scene|candid social-style expression|album-cover-inspired|distinct themed pose|close portrait with net facial detail)/i;
const mixedEnglishAltPattern = /(?:representative|polished|half-body|group-friendly|wide environmental|candid social-style|natural posture|detailed portrait|vertical profile|net composition|cinematic color grading|directional light|strong subject focus|lifestyle portrait|natural setting|event-style portrait|refined style|facial detail)/i;

const failures = [];
const warnings = [];
const shaToAssets = new Map();

function fail(kind, detail) { failures.push({ kind, ...detail }); }
function warn(kind, detail) { warnings.push({ kind, ...detail }); }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }

function localPathForUrl(value) {
  const raw = String(value || "").trim();
  const pathname = raw.startsWith("http://") || raw.startsWith("https://") ? new URL(raw).pathname : raw.split(/[?#]/)[0];
  if (!pathname.startsWith(assetPrefix)) return undefined;
  const relative = pathname.slice(1);
  const filePath = path.resolve(process.cwd(), "public", relative);
  const publicRoot = path.resolve(process.cwd(), "public");
  if (filePath !== publicRoot && !filePath.startsWith(`${publicRoot}${path.sep}`)) return undefined;
  return { pathname, filePath };
}

async function inspectAsset(slug, role, value, index) {
  const local = localPathForUrl(value);
  if (!local) {
    fail("asset-namespace", { slug, role, index, value });
    return;
  }
  if (!fs.existsSync(local.filePath)) {
    fail("asset-missing", { slug, role, index, path: local.pathname });
    return;
  }
  let buffer;
  try {
    buffer = fs.readFileSync(local.filePath);
    const metadata = await sharp(buffer).metadata();
    if (!metadata.width || !metadata.height) fail("asset-dimensions", { slug, role, index, path: local.pathname });
    if (metadata.format !== "jpeg" || metadata.width !== 3840 || metadata.height !== 2160) {
      fail("asset-not-4k-jpeg", { slug, role, index, path: local.pathname, format: metadata.format, width: metadata.width, height: metadata.height });
    }
    if (buffer.length <= 1024) fail("asset-size", { slug, role, index, bytes: buffer.length, path: local.pathname });
    const sha = sha256(buffer);
    const entry = { slug, role, index, path: local.pathname, bytes: buffer.length, width: metadata.width, height: metadata.height, sha };
    const previous = shaToAssets.get(sha) || [];
    previous.push(entry);
    shaToAssets.set(sha, previous);
    return entry;
  } catch (error) {
    fail("asset-decode", { slug, role, index, path: local.pathname, error: error instanceof Error ? error.message : String(error) });
  }
}

const prisma = new PrismaClient();
try {
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active", categoryRecord: { slug: { in: expectedSlugs } } },
    include: { categoryRecord: true },
    orderBy: { id: "asc" }
  });
  const bySlug = new Map(packs.map((pack) => [String(pack.categoryRecord?.slug || "").toLowerCase(), pack]));
  const missingSlugs = expectedSlugs.filter((slug) => !bySlug.has(slug));
  if (packs.length !== expectedSlugs.length || missingSlugs.length) fail("theme-count", { expected: expectedSlugs.length, actual: packs.length, missingSlugs });

  const rows = [];
  for (const slug of expectedSlugs) {
    const pack = bySlug.get(slug);
    if (!pack) continue;
    const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string" && value.trim()) : [];
    const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.map((value) => String(value || "").trim()) : [];
    const urls = [String(pack.imageUrl || "").trim(), ...gallery];
    if (urls[0] === "") fail("cover-missing", { slug });
    if (gallery.length !== 12) fail("gallery-count", { slug, expected: 12, actual: gallery.length });
    if (new Set(urls).size !== urls.length) fail("duplicate-url", { slug, urls });
    if (alts.length !== 13) fail("alt-count", { slug, expected: 13, actual: alts.length });
    if (new Set(alts.map((alt) => alt.toLowerCase())).size !== alts.length) fail("duplicate-alt", { slug, alts });
    if (alts[0] && alts[0].toLowerCase() === alts[1]?.toLowerCase()) fail("cover-gallery-alt-same", { slug });
    alts.forEach((alt, index) => {
      if (!alt) fail("empty-alt", { slug, index });
      if (genericAltPattern.test(alt) || mixedEnglishAltPattern.test(alt)) fail("non-independent-alt", { slug, index, alt });
      if (alt.length < 60 || alt.length > 125) warn("alt-length", { slug, index, length: alt.length, alt });
    });
    const assets = [];
    for (let index = 0; index < urls.length; index += 1) {
      const entry = await inspectAsset(slug, index === 0 ? "cover" : "gallery", urls[index], index);
      if (entry) assets.push(entry);
    }
    if (assets[0] && assets.slice(1).some((asset) => asset.sha === assets[0].sha)) fail("cover-gallery-same-file", { slug });
    const legacyRefs = urls.filter((url) => url.includes("/mirror/") || url.includes("/eu-regenerated/")).length;
    if (legacyRefs) warn("legacy-mirror-reference", { slug, count: legacyRefs, expectedReplacement: legacySlugs.has(slug) });
    rows.push({ slug, source: legacySlugs.has(slug) ? "legacy-regeneration-target" : "retained-theme", hasLegacyReferences: legacyRefs > 0, cover: urls[0], galleryCount: gallery.length, altCount: alts.length, assets });
  }

  for (const [sha, assets] of shaToAssets) {
    if (assets.length < 2) continue;
    const sameTheme = new Set(assets.map((asset) => asset.slug)).size === 1;
    if (sameTheme) fail("same-binary-within-theme", { sha, assets: assets.map(({ slug, role, index, path: assetPath }) => ({ slug, role, index, path: assetPath })) });
    else warn("same-binary-across-themes", { sha, assets: assets.map(({ slug, role, index, path: assetPath }) => ({ slug, role, index, path: assetPath })) });
  }

  const result = {
    ok: failures.length === 0,
    siteId,
    expectedThemes: expectedSlugs.length,
    inspectedThemes: rows.length,
    inspectedFiles: rows.reduce((sum, row) => sum + row.assets.length, 0),
    uniqueFiles: shaToAssets.size,
    failureCounts: failures.reduce((counts, failure) => {
      counts[failure.kind] = (counts[failure.kind] || 0) + 1;
      return counts;
    }, {}),
    warningCounts: warnings.reduce((counts, warning) => {
      counts[warning.kind] = (counts[warning.kind] || 0) + 1;
      return counts;
    }, {}),
    pendingLegacyThemes: rows.filter((row) => row.hasLegacyReferences || row.assets.some((asset) => asset.width !== 3840 || asset.height !== 2160)).map((row) => row.slug),
    failures,
    warnings,
    rows
  };
  const outputPath = process.argv.find((arg) => arg.startsWith("--out="))?.slice("--out=".length);
  if (outputPath) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = failures.length ? 1 : 0;
} finally {
  await prisma.$disconnect();
}
