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
const UPDATE_TIMESTAMP = "2026-08-16T00:00:00.000Z";

const videoCategories = [
  {
    slug: "text-to-video",
    label: "Text to video",
    description: "Video themes created from written prompts.",
    sortOrder: 10
  },
  {
    slug: "image-to-video",
    label: "Image to Video",
    description: "Video themes created from uploaded or selected images.",
    sortOrder: 20
  },
  {
    slug: "talking-photo",
    label: "Talking Photo",
    description: "Explore a talking-photo workflow from one clear portrait and a focused message.",
    sortOrder: 30
  },
  {
    slug: "cinematic-video",
    label: "Cinematic Video",
    description: "Plan story-driven cinematic clips with mood, shot design, lighting, pacing, and camera movement.",
    sortOrder: 40
  },
  {
    slug: "tiktok-video",
    label: "TikTok Video",
    description: "Create TikTok-first vertical video briefs with hooks, safe zones, captions, sound, and focused closes.",
    sortOrder: 50
  },
  {
    slug: "instagram-reels",
    label: "Instagram Reels",
    description: "Shape Reels around cover-aware framing, captions, visual story, audio, and profile consistency.",
    sortOrder: 60
  },
  {
    slug: "social-media-video",
    label: "Social Media Video",
    description: "Adapt one master story into platform-aware social cuts with safer text placement and CTAs.",
    sortOrder: 70
  },
  {
    slug: "youtube-video",
    label: "YouTube Video",
    description: "Plan long-form YouTube drafts around title promise, opening minute, chapters, depth, and next steps.",
    sortOrder: 80
  },
  {
    slug: "story-video",
    label: "Story Video",
    description: "Shape story-led videos around setup, tension, turning point, payoff, and meaning.",
    sortOrder: 90
  },
  {
    slug: "meme-video",
    label: "Meme Video",
    description: "Turn reactions, POV setups, everyday situations, and punchlines into clear meme video directions.",
    sortOrder: 100
  },
  {
    slug: "product-video",
    label: "Product Video",
    description: "Turn product photos into clear video directions that answer buyer questions about scale, detail, use, features, and packaging.",
    sortOrder: 110
  }
];

const pages = [
  {
    slug: "cinematic-video",
    title: "Cinematic Video",
    seoTitle: "AI Cinematic Video Generator – Create Story-Driven Cinematic Clips | myDreamshoots",
    description:
      "Create cinematic videos with stronger mood, shot design, lighting, pacing, and camera movement. Turn ideas into short-film-style scenes for noir stories, luxury launches, music clips, sci-fi concepts, period moods, and brand storytelling.",
    keywords:
      "AI cinematic video generator, cinematic video maker, cinematic AI video, create cinematic video, story-driven video generator, cinematic scene generator, short film style AI video, AI video with camera movement and mood",
    imageUrl: "/assets/dreamshoot/cinematic-video/cinematic-video-hotel-corridor-mystery-scene.png"
  },
  {
    slug: "tiktok-video",
    title: "TikTok Video",
    seoTitle: "AI TikTok Video Generator – Create TikTok-First Vertical Videos | myDreamshoots",
    description:
      "Turn photos and ideas into TikTok-first vertical videos with a clearer hook, mobile-safe framing, sound-aware structure, captions, and a focused close. Build short demos, micro-lessons, creator stories, event snippets, and campaign videos.",
    keywords:
      "AI TikTok video generator, TikTok video maker, AI TikTok video creator, make TikTok videos from photos, vertical video generator, TikTok content creator, TikTok video from images, short-form video maker",
    imageUrl: "/assets/dreamshoot/tiktok-video/ai-tiktok-video-creator-phone-portrait.png"
  },
  {
    slug: "instagram-reels",
    title: "Instagram Reels",
    seoTitle: "AI Instagram Reels Generator – Create Reels From Photos & Ideas | myDreamshoots",
    description:
      "Turn photos and ideas into Instagram Reels with 9:16 framing, safer text placement, stronger cover choices, captions, audio-aware pacing, and a clear visual story for tutorials, BTS, portfolios, launches, and product demos.",
    keywords:
      "AI Instagram Reels generator, Instagram Reels maker, create Instagram Reels from photos, AI Reels generator, Instagram video maker, vertical Reels creator, make Reels from images, Instagram short video generator",
    imageUrl: "/assets/dreamshoot/instagram-reels/ai-instagram-reels-creator-editorial-portrait.png"
  },
  {
    slug: "social-media-video",
    title: "Social Media Video",
    seoTitle: "AI Social Media Video Maker – Adapt One Idea Across Platforms | myDreamshoots",
    description:
      "Turn one core idea into platform-aware social media videos. Adapt hooks, crops, captions, audio, pacing, safe zones, and CTAs for TikTok, Instagram Reels, YouTube Shorts, campaigns, testimonials, events, and weekly content.",
    keywords:
      "AI social media video maker, social media video generator, AI social video maker, create videos for social media, multi-platform video creator, social media content video maker, repurpose content into social videos, make vertical social media videos",
    imageUrl: "/assets/dreamshoot/social-media-video/social-media-video-cross-platform-creator.png"
  },
  {
    slug: "youtube-video",
    title: "YouTube Video",
    seoTitle: "AI YouTube Video Generator – Create Long-Form Videos From Photos & Ideas | myDreamshoots",
    description:
      "Create YouTube videos from photos and ideas with a stronger opening, clearer structure, chapter-ready sequencing, captions, and a better path to the next video, playlist, or deeper explanation.",
    keywords:
      "AI YouTube video generator, YouTube video maker, AI long-form video generator, create YouTube videos, make YouTube videos from photos, YouTube content creator, long-form YouTube video maker, video generator for YouTube channel",
    imageUrl: "/assets/dreamshoot/youtube-video/youtube-video-expert-presenter.png"
  },
  {
    slug: "story-video",
    title: "Story Video",
    seoTitle: "AI Story Video Generator – Turn Photos & Moments Into a Clear Story | myDreamshoots",
    description:
      "Turn photos, clips, memories, and ideas into story-led videos with a clearer setup, tension, turning point, payoff, and meaning. Create origin stories, personal journeys, comeback stories, mini documentaries, community stories, and fictional shorts.",
    keywords:
      "AI story video generator, story video maker, AI storytelling video generator, turn photos into a story video, narrative video generator, create story videos from photos, short story video maker, AI video story creator",
    imageUrl: "/assets/dreamshoot/story-video/story-video-hero-woman-sunset-reflection.png"
  },
  {
    slug: "meme-video",
    title: "Meme Video",
    seoTitle: "AI Meme Video Generator – Make Reaction, POV & Relatable Meme Videos | myDreamshoots",
    description:
      "Turn photos, reactions, comments, awkward moments, and everyday situations into meme videos with bold captions, reaction timing, POV setups, expectation-vs-reality edits, and punchlines people instantly understand.",
    keywords:
      "AI meme video generator, meme video maker, reaction meme video, AI meme generator video, POV meme video maker, create meme videos from photos, funny reaction video maker, meme caption video, relatable meme video creator",
    imageUrl: "/assets/dreamshoot/meme-video/meme-video-message-overload.png"
  },
  {
    slug: "product-video",
    title: "Product Video",
    seoTitle: "AI Product Video Generator – Turn Product Photos Into Clear Videos | myDreamshoots",
    description:
      "Turn product photos and source images into videos that show scale, materials, features, real-world use, packaging, and the details buyers need before they decide.",
    keywords:
      "AI product video generator, product video maker, product showcase video, ecommerce product video, product video from images, product video generator from photos, product page video, product marketing video",
    imageUrl: "/assets/dreamshoot/product-video/product-video-size-scale-backpack.jpg"
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  const tempFile = `${filePath}.tmp`;
  fs.writeFileSync(tempFile, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(tempFile, filePath);
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

function categoryId(slug) {
  return `video_cat_dreamshoot_${slug.replaceAll("-", "_")}`;
}

function pageId(slug) {
  return `site_dreamshoot_${slug.replaceAll("-", "_")}`;
}

function pagePath(slug) {
  return `/ai-video-generation/${slug}`;
}

const nonPublicVideoTopicPaths = [
  "/ai-video-generation/text-to-video",
  "/ai-video-generation/image-to-video"
];

function publicAssetPath(assetUrl) {
  if (!assetUrl?.startsWith("/assets/")) return "";
  const cleanUrl = assetUrl.split(/[?#]/)[0];
  return path.join(repoRoot, "public", cleanUrl);
}

function assertPublicAssetExists(assetUrl, context) {
  const assetPath = publicAssetPath(assetUrl);
  if (assetPath && !fs.existsSync(assetPath)) throw new Error(`missing_public_asset:${context}:${assetUrl}`);
  const optimizedAssetUrl = assetUrl.startsWith("/assets/dreamshoot/") ? assetUrl.split(/[?#]/)[0].replace(/\.png$/i, ".webp") : "";
  if (!optimizedAssetUrl || optimizedAssetUrl === assetUrl.split(/[?#]/)[0]) return;
  const optimizedAssetPath = publicAssetPath(optimizedAssetUrl);
  if (optimizedAssetPath && !fs.existsSync(optimizedAssetPath)) throw new Error(`missing_public_optimized_asset:${context}:${optimizedAssetUrl}`);
}

function assertPageImageAssets() {
  for (const page of pages) {
    if (!page.imageUrl) continue;
    assertPublicAssetExists(page.imageUrl, page.slug);
  }
}

function pageJson(page) {
  const canonicalPath = pagePath(page.slug);
  return {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: ["ai_video_topic_landing_1"],
    sections: {
      ai_video_topic_landing_1: {
        type: "ai_video_topic_landing",
        settings: {
          anchor: page.slug,
          contentKey: page.slug
        },
        blocks: []
      }
    },
    seo: {
      title: page.seoTitle,
      description: page.description,
      keywords: page.keywords,
      canonicalPath,
      robots: {
        index: true,
        follow: true
      },
      index: true,
      follow: true
    }
  };
}

function syncCategories(state, changes) {
  const categories = state.videoThemeCategories ?? (state.videoThemeCategories = []);
  return videoCategories.map((category) => {
    let record = categories.find((item) => item.siteId === SITE_ID && item.slug === category.slug);
    if (!record) {
      record = {
        id: categoryId(category.slug),
        siteId: SITE_ID,
        createdAt: UPDATE_TIMESTAMP
      };
      categories.push(record);
      changes.push({
        targetType: "VideoThemeCategory",
        id: record.id,
        field: "create",
        after: category.slug
      });
    }
    updateRecord(
      record,
      {
        siteId: SITE_ID,
        slug: category.slug,
        label: category.label,
        description: category.description,
        sortOrder: category.sortOrder,
        status: "active",
        updatedAt: UPDATE_TIMESTAMP
      },
      changes,
      "VideoThemeCategory"
    );
    return record;
  });
}

function syncPages(state, changes) {
  const site = (state.sites ?? []).find((item) => item.id === SITE_ID);
  if (!site) throw new Error(`missing_site:${SITE_ID}`);
  site.pages ??= [];
  return pages.map((pageDefinition) => {
    const slug = pagePath(pageDefinition.slug);
    let page = site.pages.find((item) => item.slug === slug);
    if (!page) {
      page = {
        id: pageId(pageDefinition.slug),
        siteId: SITE_ID,
        createdAt: UPDATE_TIMESTAMP
      };
      site.pages.push(page);
      changes.push({ targetType: "ThemePage", id: page.id, field: "create", after: slug });
    }
    const json = pageJson(pageDefinition);
    updateRecord(
      page,
      {
        id: page.id || pageId(pageDefinition.slug),
        siteId: SITE_ID,
        pageType: "ai_tool",
        templateKey: `ai-video-topic-${pageDefinition.slug}`,
        slug,
        title: pageDefinition.title,
        draftJson: clone(json),
        publishedJson: clone(json),
        updatedAt: UPDATE_TIMESTAMP
      },
      changes,
      "ThemePage"
    );

    for (const settingsKey of ["draftJson", "publishedJson"]) {
      const settings = site.themeSettings?.[settingsKey];
      const seoPages = settings?.seo?.pages;
      if (!seoPages) continue;
      updateRecord(
        seoPages,
        {
          [slug]: {
            title: pageDefinition.seoTitle,
            description: pageDefinition.description,
            keywords: pageDefinition.keywords,
            canonicalPath: slug,
            index: true,
            follow: true
          }
        },
        changes,
        `ThemeSettings.${settingsKey}.seo.pages`
      );
    }
    return page;
  });
}

function pruneNonPublicVideoTopicPages(state, changes) {
  const site = (state.sites ?? []).find((item) => item.id === SITE_ID);
  if (!site) return;
  if (site.pages?.length) {
    const removed = site.pages.filter((page) => nonPublicVideoTopicPaths.includes(page.slug));
    if (removed.length) {
      site.pages = site.pages.filter((page) => !nonPublicVideoTopicPaths.includes(page.slug));
      for (const page of removed) {
        changes.push({
          targetType: "ThemePage",
          id: page.id,
          field: "delete",
          before: page.slug
        });
      }
    }
  }
  for (const settingsKey of ["draftJson", "publishedJson"]) {
    const seoPages = site.themeSettings?.[settingsKey]?.seo?.pages;
    if (!seoPages) continue;
    for (const nonPublicPath of nonPublicVideoTopicPaths) {
      if (!(nonPublicPath in seoPages)) continue;
      changes.push({
        targetType: `ThemeSettings.${settingsKey}.seo.pages`,
        id: SITE_ID,
        field: nonPublicPath,
        before: seoPages[nonPublicPath]
      });
      delete seoPages[nonPublicPath];
    }
  }
}

function syncExistingVideoThemePreviews(state, changes) {
  const themeRows = state.videoThemes ?? [];
  for (const page of pages) {
    if (!page.imageUrl) continue;
    const theme = themeRows.find((item) => item.siteId === SITE_ID && item.slug === page.slug);
    if (!theme) continue;
    updateRecord(
      theme,
      {
        imageUrl: page.imageUrl,
        galleryImages: [page.imageUrl],
        updatedAt: UPDATE_TIMESTAMP
      },
      changes,
      "VideoTheme"
    );
  }
}

function clearPlatformStateCaches() {
  for (const cachePath of [
    ".next-build/cache/platform-state-postgres.json",
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

async function updateDatabase(state, categories, syncedPages) {
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
        for (const category of categories) {
          const definition = videoCategories.find((item) => item.slug === category.slug);
          await tx.videoThemeCategory.upsert({
            where: {
              siteId_slug: {
                siteId: SITE_ID,
                slug: category.slug
              }
            },
            create: {
              id: category.id,
              siteId: SITE_ID,
              slug: definition.slug,
              label: definition.label,
              description: definition.description,
              sortOrder: definition.sortOrder,
              status: "active",
              createdAt: new Date(UPDATE_TIMESTAMP)
            },
            update: {
              label: definition.label,
              description: definition.description,
              sortOrder: definition.sortOrder,
              status: "active"
            }
          });
        }
        await tx.themePage.deleteMany({
          where: {
            siteId: SITE_ID,
            slug: {
              in: nonPublicVideoTopicPaths
            }
          }
        });
        for (const page of pages) {
          if (!page.imageUrl) continue;
          await tx.videoTheme.updateMany({
            where: {
              siteId: SITE_ID,
              slug: page.slug
            },
            data: {
              imageUrl: page.imageUrl,
              galleryImages: [page.imageUrl]
            }
          });
        }
        for (const page of syncedPages) {
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
        }
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

assertPageImageAssets();

const state = readJson(statePath);
const changes = [];
const categories = syncCategories(state, changes);
const syncedPages = syncPages(state, changes);
pruneNonPublicVideoTopicPages(state, changes);
syncExistingVideoThemePreviews(state, changes);

if (!dryRun) writeJson(statePath, state);
if (updateDb && !dryRun) await updateDatabase(state, categories, syncedPages);

console.log(
  JSON.stringify(
    {
      dryRun,
      updateDb,
      siteId: SITE_ID,
      pages: pages.map((page) => pagePath(page.slug)),
      categories: categories.map((category) => category.slug),
      changedFields: changes.length,
      changedRecords: new Set(changes.map((change) => `${change.targetType}:${change.id}`)).size,
      sampleChanges: changes.slice(0, 12)
    },
    null,
    2
  )
);
