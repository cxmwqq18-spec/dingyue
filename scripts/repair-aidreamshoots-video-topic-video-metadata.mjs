#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
const publicRoot = path.resolve(repoRoot, "public");
const siteId = "site_mydreamshoots_xby";
const backupDirectory = path.resolve(repoRoot, ".tmp/aidreamshoots-video-topic-video-metadata-repair/backups");
const confirmation = "aidreamshoots-video-topic-video-metadata-repair";
const videoPattern = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;
const sourcePrefix = "/assets/sites/site_aidreamshoots/";
const topicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];

function collectVideoObjects(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectVideoObjects(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (typeof value.src === "string" && videoPattern.test(value.src)) output.push(value);
  for (const child of Object.values(value)) collectVideoObjects(child, output);
  return output;
}

function rewriteVideoDimensions(value, dimensionsBySrc) {
  if (Array.isArray(value)) return value.map((item) => rewriteVideoDimensions(item, dimensionsBySrc));
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) output[key] = rewriteVideoDimensions(child, dimensionsBySrc);
  if (typeof value.src === "string" && videoPattern.test(value.src)) {
    const dimensions = dimensionsBySrc.get(value.src);
    if (dimensions) {
      output.width = dimensions.width;
      output.height = dimensions.height;
    }
  }
  return output;
}

function withoutVideoDimensions(value) {
  if (Array.isArray(value)) return value.map(withoutVideoDimensions);
  if (!value || typeof value !== "object") return value;
  const output = {};
  for (const [key, child] of Object.entries(value)) {
    if ((key === "width" || key === "height") && typeof value.src === "string" && videoPattern.test(value.src)) continue;
    output[key] = withoutVideoDimensions(child);
  }
  return output;
}

function localPathForSource(src) {
  const pathname = src.split(/[?#]/, 1)[0];
  assert(pathname.startsWith(sourcePrefix), `Video source escaped the AIdreamshoots namespace: ${src}`);
  const filePath = path.resolve(publicRoot, pathname.slice(1));
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `Video source escaped the public directory: ${src}`);
  return filePath;
}

async function readVideoDimensions(filePath) {
  assert(fs.existsSync(filePath), `Missing local video source: ${filePath}`);
  const { stdout } = await execFileAsync(process.env.FFPROBE_BIN || "ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=width,height",
    "-of", "json",
    filePath
  ], { maxBuffer: 256 * 1024 });
  const stream = JSON.parse(stdout).streams?.[0];
  assert(Number.isInteger(stream?.width) && Number.isInteger(stream?.height), `Video dimensions unavailable: ${filePath}`);
  return { width: stream.width, height: stream.height };
}

assertDatabaseTarget({ expectedTarget: "local" });
assertNonProductionWriteTarget();
assert.equal(String(process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1] ?? ""), confirmation, `Run with --confirm=${confirmation}.`);

const prisma = new PrismaClient();
try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { id: true, slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, topicSlugs.length, "The target topic page count changed.");

  const videoRefs = pages.flatMap((page) => collectVideoObjects(page.contentJson).map((video) => ({ page, video })));
  const uniqueSources = [...new Set(videoRefs.map(({ video }) => video.src))];
  const dimensionsBySrc = new Map();
  for (const src of uniqueSources) dimensionsBySrc.set(src, await readVideoDimensions(localPathForSource(src)));

  const rewrittenPages = pages.map((page) => ({ ...page, contentJson: rewriteVideoDimensions(page.contentJson, dimensionsBySrc) }));
  const changedPages = rewrittenPages.filter((page, index) => JSON.stringify(page.contentJson) !== JSON.stringify(pages[index].contentJson));
  const changedVideos = videoRefs.filter(({ video }) => {
    const expected = dimensionsBySrc.get(video.src);
    return video.width !== expected.width || video.height !== expected.height;
  }).length;

  for (const page of rewrittenPages) {
    assert.deepEqual(withoutVideoDimensions(page.contentJson), withoutVideoDimensions(pages.find((before) => before.id === page.id).contentJson), `Non-video content changed before write: ${page.slug}`);
    for (const video of collectVideoObjects(page.contentJson)) {
      const expected = dimensionsBySrc.get(video.src);
      assert.equal(video.width, expected.width, `Width metadata mismatch in ${page.slug}: ${video.src}`);
      assert.equal(video.height, expected.height, `Height metadata mismatch in ${page.slug}: ${video.src}`);
    }
  }

  assert(videoRefs.length > 0, "No topic-page videos were found.");
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `video-metadata-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, pages }, null, 2)}\n`, { mode: 0o600 });

  await prisma.$transaction(async (tx) => {
    for (const page of changedPages) {
      await tx.livePage.update({ where: { id: page.id }, data: { contentJson: page.contentJson } });
    }
  });

  const readback = await prisma.livePage.findMany({
    where: { siteId, slug: { in: topicSlugs.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(readback.length, pages.length, "Readback page count changed.");
  let readbackVideos = 0;
  for (const page of readback) {
    for (const video of collectVideoObjects(page.contentJson)) {
      readbackVideos += 1;
      const expected = dimensionsBySrc.get(video.src);
      assert(expected, `Unknown video source in ${page.slug}: ${video.src}`);
      assert.equal(video.width, expected.width, `Readback width mismatch in ${page.slug}: ${video.src}`);
      assert.equal(video.height, expected.height, `Readback height mismatch in ${page.slug}: ${video.src}`);
    }
  }
  assert.equal(readbackVideos, videoRefs.length, "Readback video reference count changed.");

  console.log(JSON.stringify({
    ok: true,
    siteId,
    pages: pages.length,
    videoReferences: videoRefs.length,
    uniqueVideoSources: uniqueSources.length,
    changedVideos,
    changedPages: changedPages.length,
    dimensions: Object.fromEntries(dimensionsBySrc),
    backupPath,
    paidProviderCalls: 0
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
