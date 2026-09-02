#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const STORY_SLUG = "/ai-video-generation/story-video";
const SECTION_ID = "ai_video_topic_landing_1";
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const productionConfirmed = args.has("--confirm-production");
const repoRoot = process.cwd();

if (!updateDb) throw new Error("This scoped sync requires --db. Use --db --dry-run to inspect without writing.");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableJson(nested)])
  );
}

function sameJson(left, right) {
  return JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right));
}

function cleanStoryImage(image) {
  assert.ok(image && typeof image === "object" && !Array.isArray(image) && typeof image.src === "string", "canonical_story_image_missing_src");
  const src = image.src.replace(
    /^\/assets\/dreamshoot\/story-video\/([^/?#]+)\.(?:png|jpe?g|webp)(?:[?#].*)?$/i,
    "/assets/dreamshoot/generated/video-topic-clean/story-video/$1.webp"
  );
  assert.match(src, /^\/assets\/dreamshoot\/generated\/video-topic-clean\/story-video\/[^/]+\.webp$/i, `canonical_story_image_not_clean:${src}`);
  const diskPath = path.join(repoRoot, "public", src);
  assert.equal(fs.existsSync(diskPath), true, `missing_canonical_story_image:${src}`);
  return { ...clone(image), src };
}

function isImage(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof value.src === "string");
}

function canonicalImageSources(value, output = []) {
  if (Array.isArray(value)) {
    for (const nested of value) canonicalImageSources(nested, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (typeof value.src === "string" && /^\/assets\/dreamshoot\/(?:generated\/video-topic-clean\/)?story-video\//i.test(value.src)) {
    output.push(cleanStoryImage(value).src);
    return output;
  }
  for (const nested of Object.values(value)) canonicalImageSources(nested, output);
  return output;
}

function syncImages(stored, canonical, pathLabel = "content", changes = []) {
  if (Array.isArray(stored) && Array.isArray(canonical)) {
    for (let index = 0; index < Math.min(stored.length, canonical.length); index += 1) {
      syncImages(stored[index], canonical[index], `${pathLabel}[${index}]`, changes);
    }
    return changes;
  }
  if (!stored || !canonical || typeof stored !== "object" || typeof canonical !== "object" || Array.isArray(stored) || Array.isArray(canonical)) return changes;

  for (const [key, canonicalValue] of Object.entries(canonical)) {
    if (!(key in stored)) continue;
    if (key === "image" && isImage(canonicalValue)) {
      const nextImage = cleanStoryImage(canonicalValue);
      if (!sameJson(stored[key], nextImage)) {
        stored[key] = nextImage;
        changes.push(`${pathLabel}.image`);
      }
      continue;
    }
    if (key === "images" && Array.isArray(stored[key]) && Array.isArray(canonicalValue)) {
      for (let index = 0; index < Math.min(stored[key].length, canonicalValue.length); index += 1) {
        if (!isImage(canonicalValue[index])) continue;
        const nextImage = cleanStoryImage(canonicalValue[index]);
        if (!sameJson(stored[key][index], nextImage)) {
          stored[key][index] = nextImage;
          changes.push(`${pathLabel}.images[${index}]`);
        }
      }
      continue;
    }
    syncImages(stored[key], canonicalValue, `${pathLabel}.${key}`, changes);
  }
  return changes;
}

function storyContentSeed() {
  const jiti = createJiti(import.meta.url);
  const { aiVideoTopicLandingContentByKey } = jiti("./seed-mydreamshoots-ai-video-topic-content.ts");
  const content = aiVideoTopicLandingContentByKey?.["story-video"];
  assert.ok(content, "missing_story_video_content_seed");
  return content;
}

const target = String(process.env.DATABASE_TARGET || "").trim().toLowerCase();
if (!new Set(["local", "production"]).has(target)) {
  throw new Error(`This scoped sync supports DATABASE_TARGET=local or production; received ${target || "(unset)"}.`);
}
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production" && !dryRun,
  productionConfirmed
});

const canonicalContent = storyContentSeed();
const prisma = new PrismaClient();
try {
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: STORY_SLUG } },
    select: { id: true, contentJson: true, updatedAt: true }
  });
  assert.ok(page, `missing_target_page:${STORY_SLUG}`);
  const storedContent = clone(page.contentJson);
  const storedSection = storedContent?.sections?.[SECTION_ID]?.settings?.content;
  assert.ok(storedSection && typeof storedSection === "object" && !Array.isArray(storedSection), `missing_target_content:${STORY_SLUG}`);
  const imageChanges = syncImages(storedSection, canonicalContent, "content");
  const nextContent = storedContent;
  const canonicalHero = cleanStoryImage(canonicalContent.hero?.image).src;
  const canonicalGallery = [...new Set(canonicalImageSources(canonicalContent).filter((src) => src !== canonicalHero))];
  const videoTheme = await prisma.videoTheme.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: "story-video" } },
    select: { id: true, galleryImages: true }
  });
  assert.ok(videoTheme, "missing_target_video_theme:story-video");
  const videoThemeGalleryChanged = !sameJson(videoTheme.galleryImages, canonicalGallery);

  if (!dryRun && imageChanges.length > 0) {
    await prisma.livePage.update({
      where: { id: page.id },
      data: { contentJson: nextContent }
    });
  }
  if (!dryRun && videoThemeGalleryChanged) {
    await prisma.videoTheme.update({
      where: { id: videoTheme.id },
      data: { galleryImages: canonicalGallery }
    });
  }

  console.log(JSON.stringify({
    dryRun,
    updateDb,
    target,
    page: STORY_SLUG,
    changedImageFields: imageChanges.length,
    imageFields: imageChanges,
    changedVideoThemeGallery: videoThemeGalleryChanged,
    written: !dryRun && (imageChanges.length > 0 || videoThemeGalleryChanged)
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
