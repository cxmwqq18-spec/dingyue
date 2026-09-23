#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const databaseTarget = String(process.env.DATABASE_TARGET || "").trim().toLowerCase();
const productionConfirmed = process.argv.includes("--confirm-production");
const siteId = "site_mydreamshoots_xby";
const siteSlug = "aidreamshoots";
const siteDomain = "aidreamshoots.eu";
const batchId = "aidreamshoots-other-topics-20260914-v1";
const manifestArgument = process.argv.find((arg) => arg.startsWith("--manifest="));
const manifestPath = path.resolve(manifestArgument ? manifestArgument.slice("--manifest=".length) : `.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const publicPrefix = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}/`;
const confirmation = "aidreamshoots-other-topic-media-rebind";
const dryRun = process.argv.includes("--dry-run");
const topicSlugs = [
  "brand-video", "cinematic-video", "explainer-video", "fashion-video", "food-video",
  "how-to-video", "instagram-reels", "meme-video", "music-video", "pet-video",
  "product-ad-video", "product-video", "promo-video", "social-media-video", "story-video",
  "talking-head-video", "tiktok-video", "ugc-ad-video", "video-ad", "youtube-video"
];
const imageKeys = new Set(["src", "poster", "imageUrl", "url"]);
const imagePattern = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const videoPattern = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function withoutQuery(value) {
  return typeof value === "string" ? value.split(/[?#]/)[0] : value;
}

function isImageUrl(value) {
  return typeof value === "string" && imagePattern.test(value) && !videoPattern.test(value);
}

function isGeneratedUrl(value) {
  return typeof value === "string" && withoutQuery(value).startsWith(publicPrefix);
}

function collectImageUrls(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (imageKeys.has(key) && isImageUrl(child)) output.push(child);
    collectImageUrls(child, output);
  }
  return output;
}

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

function rewriteContent(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => rewriteContent(item, replacements));
  if (!value || typeof value !== "object") {
    const replacement = replacements.get(withoutQuery(value));
    return replacement?.publicUrl ?? value;
  }
  const object = value;
  const sourceUrl = Object.entries(object)
    .filter(([key, child]) => imageKeys.has(key) && isImageUrl(child))
    .map(([, child]) => withoutQuery(child))
    .find((candidate) => replacements.has(candidate));
  const sourceReplacement = sourceUrl ? replacements.get(sourceUrl) : null;
  const next = Object.fromEntries(Object.entries(object).map(([key, child]) => [key, rewriteContent(child, replacements)]));
  if (sourceReplacement) next.alt = sourceReplacement.altText;
  return next;
}

function createReplacements(manifest) {
  const replacements = new Map();
  for (const task of manifest.tasks) {
    const sourceUrl = withoutQuery(task.sourceUrl);
    const replacement = { publicUrl: task.publicUrl, altText: task.altText };
    replacements.set(sourceUrl, replacement);
    replacements.set(withoutQuery(task.publicUrl), replacement);
    if (sourceUrl.startsWith("/assets/sites/site_aidreamshoots/visuals/")) {
      replacements.set(sourceUrl.replace("/assets/sites/site_aidreamshoots/visuals/", "/assets/dreamshoot/"), replacement);
    }
  }
  const tasksBySource = new Map(manifest.tasks.map((task) => [withoutQuery(task.sourceUrl), task]));
  for (const alias of manifest.before?.pages?.flatMap((page) => page.imageAliases ?? []) ?? []) {
    const target = tasksBySource.get(withoutQuery(alias.targetSourceUrl));
    assert(target, `Missing generated task for image alias: ${alias.targetSourceUrl}`);
    replacements.set(withoutQuery(alias.sourceUrl), { publicUrl: target.publicUrl, altText: target.altText });
  }
  return replacements;
}

function publicAssetPath(publicUrl) {
  return path.join(repoRoot, "public", publicUrl);
}

function assertManifest(manifest) {
  assert.equal(manifest.mode, "applied", "The existing generated batch must already be applied.");
  assert.equal(manifest.tasks.length, 180, "The generated batch must contain exactly 180 image tasks.");
  assert.equal(manifest.runtime?.succeeded, manifest.tasks.length, "The generated batch contains incomplete tasks.");
  assert.equal(manifest.diversityResult?.pass, true, "The generated batch did not pass its diversity gate.");
  for (const task of manifest.tasks) {
    assert(task.publicUrl.startsWith(publicPrefix), `Generated task escaped the public namespace: ${task.id}`);
    assert(fs.existsSync(task.finalFile) || fs.existsSync(publicAssetPath(task.publicUrl)), `Missing generated output: ${task.id}`);
  }
}

function taskByTopicAndSlot(tasks, topicSlug, slotIndex) {
  const task = tasks.find((item) => item.topicSlug === topicSlug && item.slotIndex === slotIndex);
  assert(task, `Missing generated task: ${topicSlug}:${slotIndex}`);
  return task;
}

if (databaseTarget === "production") {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assertManifest(manifest);
const replacements = createReplacements(manifest);
const prisma = new PrismaClient();

try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
  assert(site, `Missing target site: ${siteId}`);
  assert.equal(site.slug, siteSlug, "Target site slug mismatch.");
  assert.equal(site.primaryDomain, siteDomain, "Target site domain mismatch.");

  const slugs = topicSlugs.map((slug) => `/ai-video-generation/${slug}`);
  const [pages, themes] = await Promise.all([
    prisma.livePage.findMany({
      where: { siteId, slug: { in: slugs } },
      select: { id: true, slug: true, contentJson: true, updatedAt: true },
      orderBy: { slug: "asc" }
    }),
    prisma.videoTheme.findMany({
      where: { siteId, slug: { in: topicSlugs } },
      select: { id: true, slug: true, imageUrl: true, galleryImages: true },
      orderBy: { slug: "asc" }
    })
  ]);
  assert.equal(pages.length, topicSlugs.length, "Target topic page count changed.");
  assert.equal(themes.length, topicSlugs.length, "Target VideoTheme count changed.");

  const themeBySlug = new Map(themes.map((theme) => [theme.slug, theme]));
  const pagePlan = pages.map((page) => {
    const slug = page.slug.replace("/ai-video-generation/", "");
    const currentVideos = collectVideoRefs(page.contentJson);
    const contentJson = rewriteContent(page.contentJson, replacements);
    const imageUrls = [...new Set(collectImageUrls(contentJson).map(withoutQuery))];
    assert(imageUrls.length > 0, `No images found after rebind planning: ${page.slug}`);
    assert(imageUrls.every((url) => isGeneratedUrl(url)), `An old image remains after rebind planning: ${page.slug}`);
    assert.deepEqual(collectVideoRefs(contentJson), currentVideos, `Video source changed in rebind planning: ${page.slug}`);
    return { ...page, slug, contentJson, currentVideos };
  });

  const themePlan = themes.map((theme) => {
    const heroTask = taskByTopicAndSlot(manifest.tasks, theme.slug, 0);
    const imageUrl = replacements.get(withoutQuery(theme.imageUrl))?.publicUrl
      ?? (isGeneratedUrl(theme.imageUrl) ? theme.imageUrl : heroTask.publicUrl);
    const galleryImages = Array.isArray(theme.galleryImages)
      ? theme.galleryImages.map((url) => replacements.get(withoutQuery(url))?.publicUrl ?? url)
      : theme.galleryImages;
    const imageRefs = [imageUrl, ...(Array.isArray(galleryImages) ? galleryImages : [])].filter(isImageUrl);
    assert(imageRefs.every((url) => isGeneratedUrl(url)), `An old VideoTheme image remains after rebind planning: ${theme.slug}`);
    return { ...theme, imageUrl, galleryImages };
  });

  const changedPages = pagePlan.filter((page, index) => JSON.stringify(page.contentJson) !== JSON.stringify(pages[index].contentJson)).length;
  const changedThemes = themePlan.filter((theme, index) => theme.imageUrl !== themes[index].imageUrl || JSON.stringify(theme.galleryImages) !== JSON.stringify(themes[index].galleryImages)).length;
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dryRun: true, siteId, pages: pages.length, themes: themes.length, generatedImages: manifest.tasks.length, changedPages, changedThemes }, null, 2));
    process.exit(0);
  }

  assert.equal(String(process.argv.find((arg) => arg.startsWith("--confirm="))?.split("=")[1] ?? ""), confirmation, `Run with --confirm=${confirmation}.`);
  if (databaseTarget !== "production") assertNonProductionWriteTarget();

  const backupDirectory = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/backups`);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `media-rebind-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, batchId, pages, themes }, null, 2)}\n`, { mode: 0o600 });

  await prisma.$transaction(async (tx) => {
    for (const page of pagePlan) {
      await tx.livePage.update({ where: { id: page.id }, data: { contentJson: clone(page.contentJson) } });
    }
    for (const theme of themePlan) {
      await tx.videoTheme.update({
        where: { id: theme.id },
        data: { imageUrl: theme.imageUrl, galleryImages: theme.galleryImages }
      });
    }
    for (const task of manifest.tasks) {
      await tx.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId, storageKey: task.outputRelative } },
        create: {
          id: `media_${siteId}_${task.outputRelative.replace(/[^a-z0-9]+/gi, "_").slice(-80)}`,
          siteId,
          label: task.altText,
          storageKey: task.outputRelative,
          mimeType: "image/webp",
          usageType: "theme",
          sourceType: "ai-other-topic-regeneration",
          previewUrl: task.publicUrl,
          originUrl: task.publicUrl,
          altText: task.altText,
          notes: `Generated for ${task.pageSlug}; batch ${batchId}.`
        },
        update: {
          label: task.altText,
          mimeType: "image/webp",
          usageType: "theme",
          sourceType: "ai-other-topic-regeneration",
          previewUrl: task.publicUrl,
          originUrl: task.publicUrl,
          altText: task.altText,
          notes: `Generated for ${task.pageSlug}; batch ${batchId}.`
        }
      });
    }
  }, { timeout: 180_000 });

  const [readbackPages, readbackThemes] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId, slug: { in: slugs } }, select: { slug: true, contentJson: true }, orderBy: { slug: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId, slug: { in: topicSlugs } }, select: { slug: true, imageUrl: true, galleryImages: true }, orderBy: { slug: "asc" } })
  ]);
  for (const page of readbackPages) {
    const images = [...new Set(collectImageUrls(page.contentJson).map(withoutQuery))];
    assert(images.every((url) => isGeneratedUrl(url)), `Readback contains an old image: ${page.slug}`);
    assert.deepEqual(collectVideoRefs(page.contentJson), pagePlan.find((item) => item.slug === page.slug.replace("/ai-video-generation/", "")).currentVideos, `Readback changed video source: ${page.slug}`);
  }
  for (const theme of readbackThemes) {
    const imageRefs = [theme.imageUrl, ...(Array.isArray(theme.galleryImages) ? theme.galleryImages : [])].filter(isImageUrl);
    assert(imageRefs.every((url) => isGeneratedUrl(url)), `Readback contains an old VideoTheme image: ${theme.slug}`);
  }
  console.log(JSON.stringify({ ok: true, dryRun: false, siteId, batchId, pages: readbackPages.length, themes: readbackThemes.length, generatedImages: manifest.tasks.length, changedPages, changedThemes, backupPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
