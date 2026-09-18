#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const batchId = "aidreamshoots-other-topics-20260914-v1";
const manifestPath = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const backupDirectory = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/backups`);
const publicPrefix = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}/`;
const siteId = "site_mydreamshoots_xby";
const confirmation = "aidreamshoots-other-topic-image-metadata-repair";
const imageKeys = new Set(["src", "poster", "imageUrl", "url"]);
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const videoPattern = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;

const topicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];

function collectVideoRefs(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoRefs(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (["src", "poster", "url"].includes(key) && typeof child === "string" && videoPattern.test(child)) output.push(child);
    collectVideoRefs(child, output);
  }
  return output;
}

function rewriteImageDimensions(value, dimensionsByUrl) {
  if (Array.isArray(value)) return value.map((item) => rewriteImageDimensions(item, dimensionsByUrl));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) output[key] = rewriteImageDimensions(child, dimensionsByUrl);
  for (const key of imageKeys) {
    const sourceUrl = typeof value[key] === "string" ? value[key] : "";
    if (!sourceUrl || !sourceUrl.startsWith(publicPrefix) || !imagePattern.test(sourceUrl)) continue;
    const dimensions = dimensionsByUrl.get(sourceUrl);
    if (!dimensions) continue;
    output.width = dimensions.width;
    output.height = dimensions.height;
  }
  return output;
}

function collectGeneratedImageObjects(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectGeneratedImageObjects(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (imageKeys.has(key) && typeof child === "string" && child.startsWith(publicPrefix) && imagePattern.test(child)) output.push({ ...value, url: child });
    collectGeneratedImageObjects(child, output);
  }
  return output;
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.mode, "applied", "The image batch must already be applied before metadata repair.");
assert.equal(manifest.tasks.length, 180, "The applied batch must contain 180 image tasks.");
assertDatabaseTarget({ expectedTarget: "local" });
assertNonProductionWriteTarget();
assert.equal(String(process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1] ?? ""), confirmation, `Run with --confirm=${confirmation}.`);

const dimensionsByUrl = new Map();
for (const task of manifest.tasks) {
  assert(task.publicUrl.startsWith(publicPrefix), `Task escaped the generated asset namespace: ${task.id}`);
  assert(fs.existsSync(task.finalFile), `Missing regenerated image: ${task.finalFile}`);
  const metadata = await sharp(task.finalFile).metadata();
  assert(Number.isInteger(metadata.width) && Number.isInteger(metadata.height), `Image dimensions unavailable: ${task.finalFile}`);
  dimensionsByUrl.set(task.publicUrl, { width: metadata.width, height: metadata.height });
  task.outputWidth = metadata.width;
  task.outputHeight = metadata.height;
}
assert.equal(dimensionsByUrl.size, 180, "Every generated task must have a unique public URL.");

const prisma = new PrismaClient();
try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { id: true, slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, topicSlugs.length, "The target topic page count changed.");
  const beforeVideos = new Map(pages.map((page) => [page.slug, collectVideoRefs(page.contentJson)]));
  const beforePages = pages.map((page) => ({ ...page }));

  const rewrittenPages = pages.map((page) => ({ ...page, contentJson: rewriteImageDimensions(page.contentJson, dimensionsByUrl) }));
  const changedPages = rewrittenPages.filter((page, index) => JSON.stringify(page.contentJson) !== JSON.stringify(pages[index].contentJson));
  let pageImageReferences = 0;
  let metadataMismatchCount = 0;
  for (const page of rewrittenPages) {
    for (const image of collectGeneratedImageObjects(page.contentJson)) {
      pageImageReferences += 1;
      const expected = dimensionsByUrl.get(image.url);
      if (!expected || image.width !== expected.width || image.height !== expected.height) metadataMismatchCount += 1;
    }
    assert.deepEqual(collectVideoRefs(page.contentJson), beforeVideos.get(page.slug), `Video source changed before write: ${page.slug}`);
  }
  assert.equal(metadataMismatchCount, 0, "Every generated image reference must use its real output dimensions.");

  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `image-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, batchId, pages: beforePages }, null, 2)}\n`, { mode: 0o600 });

  await prisma.$transaction(async (tx) => {
    for (const page of rewrittenPages) {
      await tx.livePage.update({ where: { id: page.id }, data: { contentJson: page.contentJson } });
    }
  });

  const readback = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  let readbackReferences = 0;
  for (const page of readback) {
    assert.deepEqual(collectVideoRefs(page.contentJson), beforeVideos.get(page.slug), `Video source changed after write: ${page.slug}`);
    for (const image of collectGeneratedImageObjects(page.contentJson)) {
      readbackReferences += 1;
      const expected = dimensionsByUrl.get(image.url);
      assert(expected, `Unknown generated image URL in ${page.slug}: ${image.url}`);
      assert.equal(image.width, expected.width, `Width metadata mismatch in ${page.slug}: ${image.url}`);
      assert.equal(image.height, expected.height, `Height metadata mismatch in ${page.slug}: ${image.url}`);
    }
  }
  assert.equal(readbackReferences, pageImageReferences, "Readback generated image reference count changed.");

  manifest.metadataRepair = {
    repairedAt: new Date().toISOString(),
    imageAssets: dimensionsByUrl.size,
    pages: pages.length,
    pageImageReferences,
    changedPages: changedPages.length,
    backupPath: path.relative(repoRoot, backupPath),
    paidProviderCalls: 0,
    validation: "LivePage image width/height metadata synchronized to actual local output dimensions; video refs preserved"
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    batchId,
    imageAssets: dimensionsByUrl.size,
    pages: pages.length,
    pageImageReferences,
    changedPages: changedPages.length,
    backupPath,
    paidProviderCalls: 0
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
