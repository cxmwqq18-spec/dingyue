#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const PUBLIC_ROOT = path.resolve("public");
const REPORT_PATH = path.resolve(process.argv.find((arg) => arg.startsWith("--report="))?.slice(9) || "reports/aidreamcapes-eu-image-source-map-current.json");
const RESTORED_RELATIVE_ROOT = "assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1";
const RESTORED_PUBLIC_ROOT = `/${RESTORED_RELATIVE_ROOT}/`;
const APPLY = process.argv.includes("--apply");

function argValue(name, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) || fallback;
}

const FAMILY = argValue("family", "image-pack-recovered");
const OFFSET = Math.max(0, Number(argValue("offset", "0")) || 0);
const LIMIT_VALUE = argValue("limit", "");
const LIMIT = LIMIT_VALUE ? Math.max(0, Number(LIMIT_VALUE) || 0) : Infinity;

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function localPathForUrl(value) {
  const clean = stripQuery(value);
  assert(clean.startsWith("/assets/"), `Expected local public asset URL: ${value}`);
  const resolved = path.resolve(PUBLIC_ROOT, clean.slice(1));
  assert(resolved === PUBLIC_ROOT || resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Asset escaped public root: ${value}`);
  return resolved;
}

function versioned(url) {
  return `${stripQuery(url)}?v=aidreamcapes-eu-no-crop-v1`;
}

function rewriteValue(value, replacements) {
  if (typeof value === "string") return replacements.get(stripQuery(value)) || value;
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteValue(item, replacements)]));
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function sourceIsAllowed(sourcePath) {
  const resolved = path.resolve(sourcePath);
  const euRoot = path.resolve("public/assets/sites/site_aidreamcapes_eu") + path.sep;
  const stagedRoots = [
    path.resolve(".tmp/aidreamcapes-eu-image-regeneration") + path.sep,
    path.resolve(".tmp/aidreamcapes-eu-video-topic-regeneration") + path.sep,
    path.resolve(".tmp/aidreamcapes-eu-talking-photo-regeneration") + path.sep
  ];
  assert(resolved.startsWith(euRoot) || stagedRoots.some((root) => resolved.startsWith(root)), `Rebind source is not EU-local or EU-staged: ${sourcePath}`);
  assert(!resolved.includes("/site_aidreamshoots/"), `Rebind source points at site_aidreamshoots: ${sourcePath}`);
}

function destinationFor(asset) {
  const currentPath = stripQuery(asset.currentUrl);
  const currentParent = currentPath.split("/").at(-2) || "asset";
  const slug = /-v\d+$/i.test(currentParent) ? asset.family : currentParent;
  const currentName = path.basename(currentPath);
  const role = currentName.startsWith("cover-") ? "cover" : currentName.match(/^gallery-\d+/)?.[0] || "asset";
  const sourceName = path.basename(asset.sourcePath);
  const destinationRelative = `${RESTORED_RELATIVE_ROOT}/${slug}/${role}-${sourceName}`;
  return {
    filePath: path.resolve(PUBLIC_ROOT, destinationRelative),
    url: versioned(`/${destinationRelative}`)
  };
}

function copyByteForByte(sourcePath, targetPath) {
  sourceIsAllowed(sourcePath);
  assert(fs.existsSync(sourcePath), `Missing local source: ${sourcePath}`);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  if (!fs.existsSync(targetPath)) {
    const pending = `${targetPath}.pending`;
    fs.copyFileSync(sourcePath, pending);
    fs.renameSync(pending, targetPath);
  }
  assert.equal(sha256(targetPath), sha256(sourcePath), `Byte-for-byte copy mismatch: ${targetPath}`);
}

function assertReportTarget(report) {
  assert.equal(report.siteId, SITE_ID, "Source map siteId mismatch");
  assert.equal(report.siteSlug, SITE_SLUG, "Source map site slug mismatch");
  assert.equal(report.policy.providerCalls, 0, "The source map must not include provider calls");
  assert.equal(report.policy.copiedFromSiteAidreamshoots, 0, "The source map must not include site_aidreamshoots copies");
}

async function updateJsonModel(tx, modelName, rows, fields, replacements) {
  let updates = 0;
  for (const row of rows) {
    const data = {};
    for (const field of fields) {
      if (!(field in row) || row[field] === null || row[field] === undefined) continue;
      const next = rewriteValue(row[field], replacements);
      if (changed(row[field], next)) data[field] = next;
    }
    if (Object.keys(data).length) {
      await tx[modelName].update({ where: { id: row.id }, data });
      updates += 1;
    }
  }
  return updates;
}

async function findManyOptional(client, modelName, args) {
  try {
    return await client[modelName].findMany(args);
  } catch (error) {
    if (error?.code === "P2021") return [];
    throw error;
  }
}

const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
assertReportTarget(report);
const candidates = report.assets
  .filter((asset) => asset.family === FAMILY && ["eligible-eu-local-original", "eligible-eu-staged-original"].includes(asset.rebindPolicy))
  .sort((left, right) => left.currentUrl.localeCompare(right.currentUrl))
  .slice(OFFSET, Number.isFinite(LIMIT) ? OFFSET + LIMIT : undefined);
assert(candidates.length > 0, `No eligible assets found for family ${FAMILY} at offset ${OFFSET}.`);

const plans = candidates.map((asset) => {
  assert(asset.sourcePath, `Missing source path in map: ${asset.currentUrl}`);
  sourceIsAllowed(asset.sourcePath);
  const destination = destinationFor(asset);
  const sourceMetadata = fs.existsSync(asset.sourcePath) ? fs.statSync(asset.sourcePath) : null;
  assert(sourceMetadata?.isFile(), `Source is not a file: ${asset.sourcePath}`);
  return { asset, destination, sourceBytes: sourceMetadata.size };
});

const destinationPaths = new Set();
for (const plan of plans) {
  assert(!destinationPaths.has(plan.destination.filePath), `Destination collision: ${plan.destination.filePath}`);
  destinationPaths.add(plan.destination.filePath);
}

if (!APPLY) {
  console.log(JSON.stringify({
    mode: "dry-run",
    siteId: SITE_ID,
    family: FAMILY,
    offset: OFFSET,
    count: plans.length,
    sourceScope: "site_aidreamcapes_eu only",
    providerCalls: 0,
    databaseWrites: 0,
    sample: plans.slice(0, 5).map(({ asset, destination }) => ({ currentUrl: asset.currentUrl, sourcePath: asset.sourcePath, destinationUrl: destination.url, sourceDimensions: asset.sourceFile }))
  }, null, 2));
  process.exit(0);
}

assertDatabaseTarget({ expectedTarget: "local" });
assertNonProductionWriteTarget();

for (const plan of plans) copyByteForByte(plan.asset.sourcePath, plan.destination.filePath);

const replacements = new Map(plans.map(({ asset, destination }) => [stripQuery(asset.currentUrl), destination.url]));
const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: "aidreamcapes.eu" });

  const result = await prisma.$transaction(async (tx) => {
    const counts = {};
    counts.livePage = await updateJsonModel(tx, "livePage", await findManyOptional(tx, "livePage", { where: { siteId: SITE_ID } }), ["contentJson"], replacements);
    counts.themePage = await updateJsonModel(tx, "themePage", await findManyOptional(tx, "themePage", { where: { siteId: SITE_ID } }), ["draftJson", "publishedJson", "draftMeta"], replacements);
    counts.themeSettings = await updateJsonModel(tx, "themeSettings", await findManyOptional(tx, "themeSettings", { where: { siteId: SITE_ID } }), ["draftJson", "publishedJson"], replacements);
    counts.storefrontProfile = await updateJsonModel(tx, "storefrontProfile", await findManyOptional(tx, "storefrontProfile", { where: { siteId: SITE_ID } }), ["draftJson", "publishedJson", "draftMeta"], replacements);
    // This local database does not have the optional SitePublishedState table.
    // LivePage/ThemePage remain the runtime owners for this target.
    counts.sitePublishedState = 0;
    counts.site = await updateJsonModel(tx, "site", await findManyOptional(tx, "site", { where: { id: SITE_ID } }), ["branding"], replacements);
    counts.videoTheme = await updateJsonModel(tx, "videoTheme", await findManyOptional(tx, "videoTheme", { where: { siteId: SITE_ID } }), ["imageUrl", "galleryImages"], replacements);
    counts.videoThemeExample = await updateJsonModel(tx, "videoThemeExample", await findManyOptional(tx, "videoThemeExample", { where: { siteId: SITE_ID } }), ["imageUrl", "galleryImages"], replacements);
    counts.videoThemeCategory = await updateJsonModel(tx, "videoThemeCategory", await findManyOptional(tx, "videoThemeCategory", { where: { siteId: SITE_ID } }), ["imageUrl"], replacements);
    counts.creativePackCategory = await updateJsonModel(tx, "creativePackCategory", await findManyOptional(tx, "creativePackCategory", { where: { siteId: SITE_ID } }), ["imageUrl"], replacements);
    counts.creativePack = await updateJsonModel(tx, "creativePack", await findManyOptional(tx, "creativePack", { where: { siteId: SITE_ID } }), ["imageUrl", "galleryImages"], replacements);

    const mediaAssets = await tx.mediaAsset.findMany({ where: { siteId: SITE_ID } });
    let mediaAssetWrites = 0;
    for (const mediaAsset of mediaAssets) {
      const currentUrl = `/${String(mediaAsset.storageKey || "").replace(/^\//, "")}`;
      const replacement = replacements.get(currentUrl);
      if (!replacement) continue;
      const plan = plans.find((item) => stripQuery(item.asset.currentUrl) === currentUrl);
      assert(plan, `Missing rebind plan for MediaAsset ${mediaAsset.id}`);
      await tx.mediaAsset.update({
        where: { id: mediaAsset.id },
        data: {
          storageKey: stripQuery(replacement).replace(/^\//, ""),
          previewUrl: replacement,
          originUrl: replacement,
          sourceType: "aidreamcapes-eu-local-original-no-crop",
          notes: `${mediaAsset.notes ? `${mediaAsset.notes} ` : ""}Restored byte-for-byte from ${urlForSource(plan.asset.sourcePath)}; no resize or crop.`
        }
      });
      mediaAssetWrites += 1;
    }
    for (const plan of plans) {
      const replacement = plan.destination.url;
      const storageKey = stripQuery(replacement).replace(/^\//, "");
      const existing = await tx.mediaAsset.findUnique({ where: { siteId_storageKey: { siteId: SITE_ID, storageKey } } });
      if (existing) continue;
      const extension = path.extname(plan.asset.sourcePath).toLowerCase();
      const mimeType = extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : extension === ".png" ? "image/png" : "image/webp";
      await tx.mediaAsset.create({
        data: {
          id: `media_${SITE_ID}_no_crop_original_${crypto.createHash("sha256").update(storageKey).digest("hex").slice(0, 24)}`,
          siteId: SITE_ID,
          label: path.basename(storageKey),
          storageKey,
          mimeType,
          usageType: "theme",
          sourceType: "aidreamcapes-eu-local-original-no-crop",
          previewUrl: replacement,
          originUrl: replacement,
          altText: plan.asset.mediaAsset?.altText || null,
          notes: `Restored byte-for-byte from ${urlForSource(plan.asset.sourcePath)}; no resize or crop.`
        }
      });
      mediaAssetWrites += 1;
    }
    counts.mediaAsset = mediaAssetWrites;
    await assertAidreamcapesEuHomepageIntegrity(tx);
    return counts;
  }, { isolationLevel: "RepeatableRead" });

  console.log(JSON.stringify({
    mode: "apply",
    siteId: SITE_ID,
    family: FAMILY,
    offset: OFFSET,
    count: plans.length,
    providerCalls: 0,
    copiedByteForByte: plans.length,
    databaseWrites: result,
    destinationRoot: RESTORED_PUBLIC_ROOT
  }, null, 2));
} finally {
  await prisma.$disconnect();
}

function urlForSource(sourcePath) {
  const resolved = path.resolve(sourcePath);
  const publicPrefix = `${PUBLIC_ROOT}${path.sep}`;
  if (resolved.startsWith(publicPrefix)) return `/${path.relative(PUBLIC_ROOT, resolved).split(path.sep).join("/")}`;
  const workspacePrefix = `${path.resolve(".")}${path.sep}`;
  assert(resolved.startsWith(workspacePrefix), `Source outside workspace: ${sourcePath}`);
  return resolved;
}
