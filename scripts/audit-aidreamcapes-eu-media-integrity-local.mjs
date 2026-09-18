#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const ASSET_PREFIX = "/assets/sites/site_aidreamcapes_eu/";
const PUBLIC_ROOT = path.resolve("public");
const REPORT_PATH = path.resolve(process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) || "reports/aidreamcapes-eu-media-integrity-final.json");
const SAVE_DATE_PATHS = [
  "/ai-save-the-date/valentines-day", "/ai-save-the-date/engagement", "/ai-save-the-date/proposal", "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation", "/ai-save-the-date/wedding-ceremony", "/ai-save-the-date/christmas", "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving", "/ai-save-the-date/new-year", "/ai-save-the-date/mothers-day", "/ai-save-the-date/fathers-day"
];

const EXPECTED_PACKS = 39;
const EXPECTED_PACK_ASSETS = 507;
const EXPECTED_SAVE_DATE_ASSETS = 131;

function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function isAssetUrl(value) { return typeof value === "string" && stripQuery(value).startsWith(ASSET_PREFIX); }
function localPath(value) { return path.resolve(PUBLIC_ROOT, stripQuery(value).slice(1)); }
function sha256(buffer) { return crypto.createHash("sha256").update(buffer).digest("hex"); }
function hamming(left, right) { let count = 0; for (let index = 0; index < left.length; index += 1) if (left[index] !== right[index]) count += 1; return count; }

async function perceptualHash(filePath) {
  const { data, info } = await sharp(filePath).resize(32, 32, { fit: "fill" }).greyscale().raw().toBuffer({ resolveWithObject: true });
  const values = [];
  for (let v = 0; v < 8; v += 1) for (let u = 0; u < 8; u += 1) {
    let sum = 0;
    for (let y = 0; y < 32; y += 1) for (let x = 0; x < 32; x += 1) sum += data[y * info.width + x] * Math.cos(Math.PI * (x + 0.5) * u / 32) * Math.cos(Math.PI * (y + 0.5) * v / 32);
    values.push(sum);
  }
  const median = [...values.slice(1)].sort((a, b) => a - b)[31];
  return values.slice(1).map((value) => value >= median ? "1" : "0").join("");
}

function addAsset(map, group, slot, url, alt) {
  if (!isAssetUrl(url)) return;
  const key = stripQuery(url);
  const previous = map.get(key);
  if (previous && previous.alt && alt && previous.alt !== alt) previous.altConflict = [previous.alt, alt];
  map.set(key, { url: previous?.url || url, groups: [...new Set([...(previous?.groups || []), group])], slots: [...(previous?.slots || []), { group, slot }], alt: previous?.alt || String(alt || "").trim(), altConflict: previous?.altConflict || null });
}

function walk(value, callback) {
  if (Array.isArray(value)) { value.forEach((item) => walk(item, callback)); return; }
  if (!value || typeof value !== "object") return;
  callback(value);
  Object.values(value).forEach((item) => walk(item, callback));
}

function writeMarkdown(result) {
  const lines = [
    "# Aidreamcapes EU media integrity audit",
    "",
    `- Status: **${result.ok ? "PASS" : "FAIL"}**`,
    `- Package assets: ${result.packageAssets} (${result.packageThemes} themes)`,
    `- Save the Date navigation assets: ${result.saveDateAssets} (${result.saveDateThemes} themes)`,
    `- Validated assets: ${result.validatedAssets}/${result.totalAssets}`,
    `- 4K JPEG failures: ${result.fourKFailures.length}`,
    `- Missing MediaAsset rows: ${result.mediaAssetMissing.length}`,
    `- Exact duplicate groups in strict scope: ${result.exactDuplicateGroups.length}`,
    `- Perceptual near-duplicate pairs in strict scope: ${result.perceptualDuplicatePairs.length}`,
    `- Retired Easter page rows: ${result.retiredEasterPagePresent ? 1 : 0}`,
    "",
    "The strict scope is the 39 active image packs plus the 12 Save the Date navigation themes. Easter is a retired route and is excluded from the public page and sitemap scope.",
    ""
  ];
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH.replace(/\.json$/i, ".md"), `${lines.join("\n")}\n`);
}

const prisma = new PrismaClient();
try {
  assertDatabaseTarget({ expectedTarget: "local" });
  const [packs, savePages, easter, mediaAssets] = await Promise.all([
    prisma.creativePack.findMany({ where: { siteId: SITE_ID, status: "active" }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: SAVE_DATE_PATHS } }, orderBy: { slug: "asc" } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-save-the-date/easter" } }, select: { slug: true } }),
    prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, select: { storageKey: true } })
  ]);
  const assetMap = new Map();
  for (const pack of packs) {
    const slug = pack.categoryRecord?.slug || pack.category || pack.id;
    const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
    [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])].forEach((url, slot) => addAsset(assetMap, `pack:${slug}`, slot, url, alts[slot]));
  }
  for (const page of savePages) {
    const manifest = Array.isArray(page.contentJson?.mediaManifest) ? page.contentJson.mediaManifest : [];
    manifest.forEach((item, slot) => addAsset(assetMap, `save:${page.slug.split("/").at(-1)}`, slot, item?.src, item?.alt));
  }
  const strictAssets = [...assetMap.values()];
  const validated = [];
  const fourKFailures = [];
  for (const item of strictAssets) {
    const filePath = localPath(item.url);
    try {
      const buffer = fs.readFileSync(filePath);
      const metadata = await sharp(buffer).metadata();
      const entry = { ...item, path: filePath, bytes: buffer.length, format: metadata.format, width: metadata.width, height: metadata.height, sha256: sha256(buffer), phash: await perceptualHash(filePath) };
      validated.push(entry);
      if (metadata.format !== "jpeg" || metadata.width !== 3840 || metadata.height !== 2160) fourKFailures.push({ url: item.url, format: metadata.format, width: metadata.width, height: metadata.height });
    } catch (error) {
      fourKFailures.push({ url: item.url, error: error instanceof Error ? error.message : String(error) });
    }
  }
  const exact = new Map();
  for (const item of validated) exact.set(item.sha256, [...(exact.get(item.sha256) || []), item]);
  const exactDuplicateGroups = [...exact.values()].filter((group) => group.length > 1).map((group) => group.map(({ groups, slots, url, sha256: digest }) => ({ groups, slots, url, sha256: digest })));
  const perceptualDuplicatePairs = [];
  for (let leftIndex = 0; leftIndex < validated.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < validated.length; rightIndex += 1) {
    const left = validated[leftIndex];
    const right = validated[rightIndex];
    if (left.groups.some((group) => right.groups.includes(group))) continue;
    const distance = hamming(left.phash, right.phash);
    if (distance <= 6) perceptualDuplicatePairs.push({ distance, left: { groups: left.groups, url: left.url }, right: { groups: right.groups, url: right.url } });
  }
  const mediaKeys = new Set(mediaAssets.map((row) => String(row.storageKey || "").replace(/^\//, "")));
  const mediaAssetMissing = strictAssets.filter((item) => !mediaKeys.has(stripQuery(item.url).replace(/^\//, ""))).map((item) => item.url);
  const emptyAlts = strictAssets.filter((item) => !item.alt).map((item) => item.url);
  const altConflicts = [...assetMap.values()].filter((item) => item.altConflict).map((item) => ({ url: item.url, values: item.altConflict }));
  const result = {
    ok: !easter && packs.length === EXPECTED_PACKS && strictAssets.filter((item) => item.groups.some((group) => group.startsWith("pack:"))).length === EXPECTED_PACK_ASSETS && strictAssets.filter((item) => item.groups.some((group) => group.startsWith("save:"))).length === EXPECTED_SAVE_DATE_ASSETS && validated.length === strictAssets.length && fourKFailures.length === 0 && exactDuplicateGroups.length === 0 && perceptualDuplicatePairs.length === 0 && emptyAlts.length === 0 && altConflicts.length === 0 && mediaAssetMissing.length === 0,
    siteId: SITE_ID,
    packageThemes: packs.length,
    packageAssets: strictAssets.filter((item) => item.groups.some((group) => group.startsWith("pack:"))).length,
    saveDateThemes: savePages.length,
    saveDateAssets: strictAssets.filter((item) => item.groups.some((group) => group.startsWith("save:"))).length,
    totalAssets: strictAssets.length,
    validatedAssets: validated.length,
    fourKFailures,
    emptyAlts,
    altConflicts,
    mediaAssetMissing,
    exactDuplicateGroups,
    perceptualDuplicatePairs,
    retiredEasterPagePresent: Boolean(easter),
    providerCalls: 0,
    oldResourcesDeleted: 0
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  writeMarkdown(result);
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
} finally {
  await prisma.$disconnect();
}
