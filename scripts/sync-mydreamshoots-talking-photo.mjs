#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const statePath = path.join(repoRoot, "data", "platform-state.json");
const SITE_ID = "site_dreamshoot";
const PAGE_SLUG = "/ai-video-generation/talking-photo";
const PAGE_ID = "site_dreamshoot_talking_photo";
const UPDATE_TIMESTAMP = "2026-08-16T00:00:00.000Z";
const TALKING_PHOTO_IMAGE_URL = "/assets/dreamshoot/talking-photo/ai-talking-photo-older-woman-portrait.png";

const talkingPhotoCategory = {
  slug: "talking-photo",
  label: "Talking Photo",
  description: "Explore a talking-photo workflow from one clear portrait and a focused message.",
  sortOrder: 30
};

const pageJson = {
  pageType: "ai_tool",
  version: 1,
  sectionsOrder: ["talking_photo_landing_1"],
  sections: {
    talking_photo_landing_1: {
      type: "talking_photo_landing",
      settings: {
        anchor: "talking-photo",
        contentKey: "talking-photo"
      },
      blocks: []
    }
  },
  seo: {
    title: "AI Talking Photo Generator – Make a Photo Talk | myDreamshoots",
    description:
      "Make a photo talk from one clear portrait and a short script. Create talking-photo videos for birthday wishes, personal messages, explainers, social intros, product pitches, and holiday greetings.",
    keywords:
      "AI talking photo generator, make a photo talk, talking photo AI, photo talking video, talking picture generator, speaking photo generator, animate a photo to talk, talking portrait",
    canonicalPath: PAGE_SLUG,
    robots: {
      index: true,
      follow: true
    },
    index: true,
    follow: true
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function updateRecord(record, fields, changes, targetType) {
  for (const [field, value] of Object.entries(fields)) {
    if (JSON.stringify(record[field]) === JSON.stringify(value)) continue;
    changes.push({
      targetType,
      id: record.id,
      field,
      before: record[field],
      after: value
    });
    record[field] = value;
  }
}

function assertPublicAssetExists(assetUrl, context) {
  if (!assetUrl?.startsWith("/assets/")) return;
  const cleanUrl = assetUrl.split(/[?#]/)[0];
  const assetPath = path.join(repoRoot, "public", cleanUrl);
  if (!fs.existsSync(assetPath)) throw new Error(`missing_public_asset:${context}:${assetUrl}`);
  const optimizedAssetUrl = assetUrl.startsWith("/assets/dreamshoot/") ? cleanUrl.replace(/\.png$/i, ".webp") : "";
  if (!optimizedAssetUrl || optimizedAssetUrl === cleanUrl) return;
  const optimizedAssetPath = path.join(repoRoot, "public", optimizedAssetUrl);
  if (!fs.existsSync(optimizedAssetPath)) throw new Error(`missing_public_optimized_asset:${context}:${optimizedAssetUrl}`);
}

function syncCategory(state, changes) {
  const categories = state.videoThemeCategories ?? (state.videoThemeCategories = []);
  let category = categories.find((item) => item.siteId === SITE_ID && item.slug === talkingPhotoCategory.slug);
  if (!category) {
    category = {
      id: "video_cat_dreamshoot_talking_photo",
      siteId: SITE_ID,
      createdAt: UPDATE_TIMESTAMP
    };
    categories.push(category);
    changes.push({
      targetType: "VideoThemeCategory",
      id: category.id,
      field: "create",
      after: talkingPhotoCategory.slug
    });
  }
  updateRecord(
    category,
    {
      siteId: SITE_ID,
      slug: talkingPhotoCategory.slug,
      label: talkingPhotoCategory.label,
      description: talkingPhotoCategory.description,
      sortOrder: talkingPhotoCategory.sortOrder,
      status: "active"
    },
    changes,
    "VideoThemeCategory"
  );
  return category;
}

function syncPage(state, changes) {
  const site = (state.sites ?? []).find((item) => item.id === SITE_ID);
  if (!site) throw new Error(`missing_site:${SITE_ID}`);
  site.pages ??= [];
  let page = site.pages.find((item) => item.slug === PAGE_SLUG);
  if (!page) {
    page = {
      id: PAGE_ID,
      siteId: SITE_ID,
      createdAt: UPDATE_TIMESTAMP
    };
    site.pages.push(page);
    changes.push({ targetType: "ThemePage", id: page.id, field: "create", after: PAGE_SLUG });
  }
  updateRecord(
    page,
    {
      id: page.id || PAGE_ID,
      siteId: SITE_ID,
      pageType: "ai_tool",
      templateKey: "talking-photo",
      slug: PAGE_SLUG,
      title: "Talking Photo",
      draftJson: clone(pageJson),
      publishedJson: clone(pageJson),
      updatedAt: UPDATE_TIMESTAMP
    },
    changes,
    "ThemePage"
  );

  return { site, page };
}

function syncExistingVideoThemePreview(state, changes) {
  const theme = (state.videoThemes ?? []).find((item) => item.siteId === SITE_ID && item.slug === talkingPhotoCategory.slug);
  if (!theme) return;
  updateRecord(
    theme,
    {
      imageUrl: TALKING_PHOTO_IMAGE_URL,
      galleryImages: [TALKING_PHOTO_IMAGE_URL],
      updatedAt: UPDATE_TIMESTAMP
    },
    changes,
    "VideoTheme"
  );
}

function clearPlatformStateCaches() {
  for (const cachePath of [
    ".next/cache/platform-state-postgres.json",
    ".next-3002/cache/platform-state-postgres.json",
    ".next-3003/cache/platform-state-postgres.json",
    ".next-dev/cache/platform-state-postgres.json"
  ]) {
    fs.rmSync(path.join(repoRoot, cachePath), { force: true });
  }
}

function toPrismaJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function updateDatabase(state, category, page) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const parentSite = await prisma.site.findUnique({
      where: { id: SITE_ID },
      select: { id: true }
    });
    if (!parentSite) {
      throw new Error(`missing_site:${SITE_ID}; seed the MyDreamShoots site before running --db`);
    }
    await prisma.$transaction(
      async (tx) => {
        await tx.videoThemeCategory.upsert({
          where: {
            siteId_slug: {
              siteId: SITE_ID,
              slug: talkingPhotoCategory.slug
            }
          },
          create: {
            id: category.id,
            siteId: SITE_ID,
            slug: talkingPhotoCategory.slug,
            label: talkingPhotoCategory.label,
            description: talkingPhotoCategory.description,
            sortOrder: talkingPhotoCategory.sortOrder,
            status: "active",
            createdAt: new Date(UPDATE_TIMESTAMP)
          },
          update: {
            label: talkingPhotoCategory.label,
            description: talkingPhotoCategory.description,
            sortOrder: talkingPhotoCategory.sortOrder,
            status: "active"
          }
        });
        await tx.videoTheme.updateMany({
          where: {
            siteId: SITE_ID,
            slug: talkingPhotoCategory.slug
          },
          data: {
            imageUrl: TALKING_PHOTO_IMAGE_URL,
            galleryImages: [TALKING_PHOTO_IMAGE_URL]
          }
        });
        const pageData = {
          siteId: SITE_ID,
          pageType: page.pageType,
          templateKey: page.templateKey,
          slug: page.slug,
          title: page.title,
          draftJson: toPrismaJson(page.draftJson),
          publishedJson: toPrismaJson(page.publishedJson),
          draftMeta: page.draftMeta ? toPrismaJson(page.draftMeta) : null
        };
        await tx.themePage.upsert({
          where: { id: page.id },
          create: {
            id: page.id,
            ...pageData
          },
          update: pageData
        });
        await tx.platformStateDocument.upsert({
          where: { id: "platform" },
          create: { id: "platform", state: toPrismaJson(state) },
          update: { state: toPrismaJson(state) }
        });
      },
      { timeout: 120_000 }
    );
    clearPlatformStateCaches();
  } finally {
    await prisma.$disconnect();
  }
}

assertPublicAssetExists(TALKING_PHOTO_IMAGE_URL, talkingPhotoCategory.slug);

const state = readJson(statePath);
const changes = [];
const category = syncCategory(state, changes);
const { page } = syncPage(state, changes);
syncExistingVideoThemePreview(state, changes);

if (!dryRun) {
  writeJson(statePath, state);
}

if (updateDb && !dryRun) {
  await updateDatabase(state, category, page);
}

console.log(
  JSON.stringify(
    {
      dryRun,
      updateDb,
      siteId: SITE_ID,
      page: PAGE_SLUG,
      category: talkingPhotoCategory.slug,
      changedFields: changes.length,
      changedRecords: new Set(changes.map((change) => `${change.targetType}:${change.id}`)).size,
      sampleChanges: changes.slice(0, 8)
    },
    null,
    2
  )
);
