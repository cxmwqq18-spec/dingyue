#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const refreshContent = args.has("--refresh-content");
const siteIdArg = process.argv.find((arg) => arg.startsWith("--site-id="));
const SITE_ID = siteIdArg ? siteIdArg.slice("--site-id=".length) : process.env.SITE_ID || "site_dreamshoot";
const UPDATE_TIMESTAMP = "2026-08-16T00:00:00.000Z";
const RUN_TIMESTAMP = new Date().toISOString();
const EMPTY_UNPUBLISHED_PAGE_JSON = {
  pageType: "content",
  version: 1,
  sectionsOrder: [],
  sections: {}
};
const nonPublicVideoTopicSlugs = new Set(["text-to-video", "image-to-video"]);

const videoCategories = [
  {
    slug: "text-to-video",
    label: "Text to Video",
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
    sortOrder: 60
  },
  {
    slug: "tiktok-video",
    label: "TikTok Video",
    description: "Create TikTok-first vertical video briefs with hooks, safe zones, captions, sound, and focused closes.",
    sortOrder: 70
  },
  {
    slug: "instagram-reels",
    label: "Instagram Reels",
    description: "Shape Reels around cover-aware framing, captions, visual story, audio, and profile consistency.",
    sortOrder: 80
  },
  {
    slug: "social-media-video",
    label: "Social Media Video",
    description: "Adapt one master story into platform-aware social cuts with safer text placement and CTAs.",
    sortOrder: 110
  },
  {
    slug: "youtube-video",
    label: "YouTube Video",
    description: "Plan long-form YouTube drafts around title promise, opening minute, chapters, depth, and next steps.",
    sortOrder: 100
  },
  {
    slug: "story-video",
    label: "Story Video",
    description: "Shape story-led videos around setup, tension, turning point, payoff, and meaning.",
    sortOrder: 120
  },
  {
    slug: "meme-video",
    label: "Meme Video",
    description: "Turn reactions, POV setups, everyday situations, and punchlines into clear meme video directions.",
    sortOrder: 130
  },
  {
    slug: "product-video",
    label: "Product Video",
    description: "Turn product photos into clear video directions that answer buyer questions about scale, detail, use, features, and packaging.",
    sortOrder: 140
  },
  {
    slug: "product-ad-video",
    label: "Product Ad Video",
    description: "Build product ads around one audience, product promise, visual proof, offer, and clear next action.",
    sortOrder: 160
  },
  {
    slug: "ugc-ad-video",
    label: "UGC Ad Video",
    description: "Plan creator-style product ads around speaker status, hooks, product context, visible proof, and clear CTAs.",
    sortOrder: 170
  },
  {
    slug: "promo-video",
    label: "Promo Video",
    description: "Turn launches, offers, events, seasonal campaigns, and product updates into clear promotional video briefs.",
    sortOrder: 180
  },
  {
    slug: "video-ad",
    label: "Video Ad",
    description: "Plan paid-social video ad concepts around objective, hook, proof, placement, CTA, and meaningful test variants.",
    sortOrder: 190
  },
  {
    slug: "brand-video",
    label: "Brand Video",
    description: "Present a company, brand story, or positioning through video.",
    sortOrder: 200
  },
  {
    slug: "music-video",
    label: "Music Video",
    description: "Develop artist-, performance-, and track-led visual concepts with a coherent visual language.",
    sortOrder: 210
  },
  {
    slug: "fashion-video",
    label: "Fashion Video",
    description: "Create fashion-focused motion for editorial, lookbook, runway, styling, and garment detail concepts.",
    sortOrder: 230
  },
  {
    slug: "food-video",
    label: "Food Video",
    description: "Create food-focused motion for cooking action, plating, ingredient prep, restaurant service, beverages, and culinary social content.",
    sortOrder: 240
  },
  {
    slug: "pet-video",
    label: "Pet Video",
    description: "Create pet-focused motion for portraits, play, routines, owner interaction, and animal lifestyle content.",
    sortOrder: 260
  },
  {
    slug: "explainer-video",
    label: "Explainer Video",
    description: "Explain products, processes, data, technology, education, business frameworks, and user journeys with clear visual structure.",
    sortOrder: 270
  }
];

const pages = [
  {
    slug: "talking-photo",
    title: "Talking Photo",
    seoTitle: "AI Talking Photo Generator – Make a Photo Talk | myDreamshoots",
    description:
      "Make a photo talk from one clear portrait and a short script. Create talking-photo videos for birthday wishes, personal messages, explainers, social intros, product pitches, and holiday greetings.",
    keywords:
      "AI talking photo generator, make a photo talk, talking photo AI, photo talking video, talking picture generator, speaking photo generator, animate a photo to talk, talking portrait",
    imageUrl: "/assets/dreamshoot/talking-photo/ai-talking-photo-older-woman-portrait.png"
  },
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
  },
  {
    slug: "product-ad-video",
    title: "Product Ad Video",
    seoTitle: "AI Product Ad Video Generator – Create Product Ads With Clear Proof & CTA | myDreamshoots",
    description:
      "Create product ad videos around a specific audience, problem or desire, product promise, visual proof, offer, and call to action. Plan launch ads, problem-solution ads, benefit ads, offers, comparison ads, and retargeting reminders.",
    keywords:
      "AI product ad video generator, product ad video maker, AI product advertising video, product video ad generator, ecommerce video ad maker, social media product ad video, product launch ad video, product marketing video generator",
    imageUrl: "/assets/dreamshoot/product-ad-video/ai-product-ad-video-new-product-unboxing-creative.jpg"
  },
  {
    slug: "promo-video",
    title: "Promo Video",
    seoTitle: "AI Promo Video Maker for Launches, Offers & Announcements | myDreamshoots",
    description:
      "Create promotional videos for launches, limited-time offers, events, seasonal campaigns, and product updates with an AI promo video maker. Structure the message, proof, timing, terms, and CTA around verified product inputs and real generated outputs.",
    keywords:
      "AI promo video maker, AI promotional video maker, promo video generator, promotional video generator, AI marketing promo video, product launch video maker, sale promo video maker, event promo video generator, social media promo video maker",
    imageUrl: "/assets/dreamshoot/promo-video/promo-video-product-launch-presentation.jpg"
  },
  {
    slug: "ugc-ad-video",
    title: "UGC Ad Video",
    seoTitle: "AI UGC Video Generator for Creator-Style Product Ads | myDreamshoots",
    description:
      "Create creator-style product ads with an AI UGC video generator. Plan hooks, speaker roles, product-in-use scenes, visible proof, voiceover, and clear CTAs—then validate every claim against your real product assets and generated output.",
    keywords:
      "AI UGC video generator, UGC ad video generator, AI UGC ad creator, UGC product video maker, creator-style product video, AI creator ad video, UGC style video ad, short-form creator ad generator",
    imageUrl: "/assets/dreamshoot/ugc-ad-video/ai-ugc-video-creator-lip-product-hook.jpg"
  },
  {
    slug: "video-ad",
    title: "Video Ad",
    seoTitle: "AI Video Ad Generator for Paid Social | myDreamshoots",
    description:
      "Create video ad concepts with AI for paid social, product campaigns, launches, retargeting, and creator-style placements. Start from text or an image, shape the hook, proof, and CTA, then review the output in your myDreamshoots workflow.",
    keywords:
      "ai video ad generator, paid social video ad generator, AI video ad maker, performance marketing video creator, paid social creative generator, campaign video variant creator",
    imageUrl: "/assets/dreamshoot/video-ad/video-ad-creator-phone-tripod.jpg"
  },
  {
    slug: "brand-video",
    title: "Brand Video",
    seoTitle: "AI Brand Video Generator for Brand Stories | myDreamshoots",
    description:
      "Create brand-video concepts with AI for founder stories, company values, product origin, culture, community, and campaign identity. Start from text or an approved image, shape the narrative, then review the result in your myDreamshoots workflow.",
    keywords:
      "ai brand video generator, AI brand video maker, brand storytelling video generator, founder story video, brand identity video, company values video, product origin video, brand culture video",
    imageUrl: "/assets/dreamshoot/brand-video/brand-video-founder-story.jpg"
  },
  {
    slug: "music-video",
    title: "Music Video",
    seoTitle: "AI Music Video Generator for Artist Visuals | myDreamshoots",
    description: "Create AI music-video visuals from text or images for performances, artist promos, dance, visualizers, and cinematic sequences. Plan the look, generate clips, review continuity, and pair approved visuals with properly licensed audio in your publishing workflow.",
    keywords: "ai music video generator, AI music video maker, artist visual generator, performance video generator, AI visualizer maker, dance video concept generator, music promo video maker",
    imageUrl: "/assets/dreamshoot/music-video/hero-music-video-performance.jpg"
  },
  {
    slug: "fashion-video",
    title: "Fashion Video",
    seoTitle: "AI Fashion Video Generator for Editorial & Lookbook Visuals | myDreamshoots",
    description: "Create AI fashion-video visuals from text or approved images for editorials, lookbooks, runway concepts, styling, garment details, and campaign sequences. Define the look, generate clips, review garment and model continuity, and publish only with cleared source rights.",
    keywords: "ai fashion video generator, AI fashion video maker, fashion editorial video generator, lookbook video maker, runway video concept, styling video generator, garment detail video",
    imageUrl: "/assets/dreamshoot/fashion-video/hero-fashion-video-editorial-frame.jpg"
  },
  {
    slug: "food-video",
    title: "Food Video",
    seoTitle: "AI Food Video Generator for Cooking & Culinary Visuals | myDreamshoots",
    description: "Create AI food-video visuals from text or approved images for cooking, plating, ingredient prep, restaurant scenes, beverage pours, and culinary social clips.",
    keywords: "ai food video generator, AI food video maker, cooking video generator, plating video maker, culinary video generator, food styling video, restaurant video concept",
    imageUrl: "/assets/dreamshoot/food-video/hero-food-video-creator-frame.jpg"
  },
  {
    slug: "pet-video",
    title: "Pet Video",
    seoTitle: "AI Pet Video Generator for Pet Portraits & Animal Content | myDreamshoots",
    description: "Create AI pet-video visuals from text or approved images for pet portraits, playful moments, owner interactions, walks, grooming, training, and animal lifestyle content.",
    keywords: "ai pet video generator, AI pet video maker, pet portrait video generator, animal video generator, pet lifestyle video, dog video generator, cat video maker, pet social video creator",
    imageUrl: "/assets/dreamshoot/pet-video/hero-pet-video-training-frame.jpg"
  },
  {
    slug: "explainer-video",
    title: "Explainer Video",
    seoTitle: "AI Explainer Video Generator for Concepts & Product Explanations | myDreamshoots",
    description: "Create AI explainer-video visuals for products, processes, data, technology, education, business frameworks, and user journeys from text or approved images.",
    keywords: "ai explainer video generator, explainer video maker, AI product explainer video, process visualization video, data storytelling video, educational video generator, technology explainer video, business framework video",
    imageUrl: "/assets/dreamshoot/explainer-video/hero-explainer-video-product-concept.jpg"
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readPlatformState() {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
    if (!document?.state) throw new Error("missing_platform_state_document:platform");
    const state = clone(document.state);
    const persistedPages = await prisma.themePage.findMany({
      where: {
        siteId: SITE_ID,
        slug: { in: pages.map((page) => pagePath(page.slug)) }
      }
    });
    const site = (state.sites ?? []).find((item) => item.id === SITE_ID);
    if (!site) throw new Error(`missing_site:${SITE_ID}`);
    site.pages ??= [];
    for (const persistedPage of persistedPages) {
      const slug = persistedPage.slug.replace("/ai-video-generation/", "");
      if (!hasStoredVideoTopicContent(persistedPage.draftJson, slug)) continue;
      const statePage = site.pages.find((page) => page.id === persistedPage.id || page.slug === persistedPage.slug);
      const relationalPage = {
        id: persistedPage.id,
        siteId: persistedPage.siteId,
        pageType: persistedPage.pageType,
        templateKey: persistedPage.templateKey ?? undefined,
        slug: persistedPage.slug,
        title: persistedPage.title,
        draftJson: clone(persistedPage.draftJson),
        publishedJson: clone(persistedPage.publishedJson),
        draftMeta: persistedPage.draftMeta ? clone(persistedPage.draftMeta) : undefined,
        createdAt: persistedPage.createdAt.toISOString(),
        updatedAt: persistedPage.updatedAt.toISOString()
      };
      if (statePage) Object.assign(statePage, relationalPage);
      else site.pages.push(relationalPage);
    }
    return state;
  } finally {
    await prisma.$disconnect();
  }
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
  return `video_cat_${SITE_ID}_${slug.replaceAll("-", "_")}`;
}

function pageId(slug) {
  return `${SITE_ID}_${slug.replaceAll("-", "_")}`;
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
  for (const page of pages) {
    for (const assetUrl of assetUrlsIn(videoTopicContentSeedForSlug(page.slug))) {
      assertPublicAssetExists(assetUrl, `${page.slug}:content`);
    }
  }
}

function assetUrlsIn(value) {
  if (Array.isArray(value)) return value.flatMap(assetUrlsIn);
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, nested]) => key === "src" && typeof nested === "string" ? [nested] : assetUrlsIn(nested));
}

function loadVideoTopicContentSeeds() {
  const jiti = createJiti(import.meta.url);
  return {
    aiVideoTopicLandingContentByKey: jiti("./seed-mydreamshoots-ai-video-topic-content.ts").aiVideoTopicLandingContentByKey,
    talkingPhotoContent: jiti("./seed-mydreamshoots-talking-photo-content.ts").talkingPhotoContent
  };
}

const videoTopicContentSeeds = loadVideoTopicContentSeeds();

function videoTopicContentSeedForSlug(slug) {
  const content = slug === "talking-photo"
    ? videoTopicContentSeeds.talkingPhotoContent
    : videoTopicContentSeeds.aiVideoTopicLandingContentByKey[slug];
  if (!content) throw new Error(`missing_video_topic_content_seed:${slug}`);
  return content;
}

function hasStoredVideoTopicContent(pageJson, slug) {
  if (!pageJson || typeof pageJson !== "object") return false;
  const sectionId = slug === "talking-photo" ? "talking_photo_landing_1" : "ai_video_topic_landing_1";
  const content = pageJson.sections?.[sectionId]?.settings?.content;
  return Boolean(content && typeof content === "object" && !Array.isArray(content));
}

function pageJson(page, content = videoTopicContentSeedForSlug(page.slug)) {
  const canonicalPath = content.seo?.canonicalPath || pagePath(page.slug);
  const sectionId = page.slug === "talking-photo" ? "talking_photo_landing_1" : "ai_video_topic_landing_1";
  const sectionType = page.slug === "talking-photo" ? "talking_photo_landing" : "ai_video_topic_landing";
  // The explainer package includes editorial references only; first-party product evidence gates indexation.
  const indexable = page.slug !== "explainer-video";
  return {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: [sectionId],
    sections: {
      [sectionId]: {
        type: sectionType,
        settings: {
          anchor: page.slug,
          contentKey: page.slug,
          content: clone(content)
        },
        blocks: []
      }
    },
    seo: {
      title: content.seo?.title || page.seoTitle,
      description: content.seo?.description || page.description,
      keywords: content.seo?.keywords || page.keywords,
      canonicalPath,
      canonical: canonicalPath,
      robots: {
        index: indexable,
        follow: true
      },
      index: indexable,
      follow: true
    }
  };
}

function syncCategories(state, changes) {
  const categories = state.videoThemeCategories ?? (state.videoThemeCategories = []);
  return videoCategories
    .filter((category) => !nonPublicVideoTopicSlugs.has(category.slug))
    .map((category) => {
    let record = categories.find((item) => item.siteId === SITE_ID && item.slug === category.slug);
    const before = JSON.stringify(record ?? {});
    if (!record) {
      record = {
        id: categoryId(category.slug),
        siteId: SITE_ID,
        createdAt: RUN_TIMESTAMP
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
        status: "active"
      },
      changes,
      "VideoThemeCategory"
    );
    if (JSON.stringify(record) !== before) record.updatedAt = RUN_TIMESTAMP;
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
        createdAt: RUN_TIMESTAMP
      };
      site.pages.push(page);
      changes.push({ targetType: "ThemePage", id: page.id, field: "create", after: slug });
    }
    const before = JSON.stringify(page);
    const draftJson = !refreshContent && hasStoredVideoTopicContent(page.draftJson, pageDefinition.slug)
      ? clone(page.draftJson)
      : pageJson(pageDefinition);
    const pageFields = {
      id: page.id || pageId(pageDefinition.slug),
      siteId: SITE_ID,
      pageType: "ai_tool",
      templateKey: `ai-video-topic-${pageDefinition.slug}`,
      slug,
      title: page.title || pageDefinition.title,
      draftJson
    };
    if (!page.publishedJson) pageFields.publishedJson = clone(EMPTY_UNPUBLISHED_PAGE_JSON);
    updateRecord(page, pageFields, changes, "ThemePage");
    if (JSON.stringify(page) !== before) page.updatedAt = RUN_TIMESTAMP;
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
}

function syncExistingVideoThemePreviews(state, changes) {
  const themeRows = state.videoThemes ?? [];
  for (const page of pages) {
    if (!page.imageUrl) continue;
    const theme = themeRows.find((item) => item.siteId === SITE_ID && item.slug === page.slug);
    if (!theme) continue;
    const before = JSON.stringify(theme);
    updateRecord(
      theme,
      {
        imageUrl: page.imageUrl,
        galleryImages: [page.imageUrl]
      },
      changes,
      "VideoTheme"
    );
    if (JSON.stringify(theme) !== before) theme.updatedAt = RUN_TIMESTAMP;
  }
}

function syncVideoThemeStateFromRelational(state, themes, changes) {
  const themeRows = state.videoThemes ?? (state.videoThemes = []);
  for (const theme of themes) {
    const serializedTheme = toPrismaJson(theme);
    const existingTheme = themeRows.find((item) => item.siteId === SITE_ID && item.slug === theme.slug);
    if (!existingTheme) {
      themeRows.push(serializedTheme);
      changes.push({
        targetType: "VideoTheme",
        id: theme.id,
        field: "create",
        after: theme.slug
      });
      continue;
    }
    updateRecord(existingTheme, serializedTheme, changes, "VideoTheme");
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

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (!value || typeof value !== "object") return value ?? null;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, stableJson(item)])
  );
}

function sameJson(left, right) {
  return JSON.stringify(stableJson(left)) === JSON.stringify(stableJson(right));
}

function loadPublicationTools() {
  const sourceRoot = path.resolve(repoRoot, "src");
  const originalResolveFilename = Module._resolveFilename;
  const originalLoad = Module._load;
  Module._load = function load(request, ...args) {
    if (request === "server-only") return {};
    return originalLoad.call(this, request, ...args);
  };
  Module._resolveFilename = function resolveFilename(request, ...args) {
    if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
    let resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
    if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) resolved = `${resolved}.ts`;
    return originalResolveFilename.call(this, resolved, ...args);
  };
  try {
    const jiti = createJiti(import.meta.url);
    return {
      buildPublicationSnapshot: jiti("../src/lib/stores/theme-store.ts").buildPublicationSnapshot,
      missingStorefrontProfileFacts: jiti("../src/lib/storefront-context/facts.ts").missingStorefrontProfileFacts,
      publishSeoSnapshotRelational: jiti("../src/lib/stores/theme-store.ts").publishSeoSnapshotRelational,
      applyMydreamshootsVideoTopicPublication: jiti("../src/lib/mydreamshoots-video-topic-publication.ts").applyMydreamshootsVideoTopicPublication,
      publicationSnapshotHash: jiti("../src/lib/publication-snapshot-integrity.ts").publicationSnapshotHash,
      publicationSnapshotIntegrity: jiti("../src/lib/publication-snapshot-integrity.ts").publicationSnapshotIntegrity
    };
  } finally {
    Module._resolveFilename = originalResolveFilename;
    Module._load = originalLoad;
  }
}

function refreshSnapshotHash(snapshot, publicationSnapshotHash) {
  snapshot.snapshotHash = publicationSnapshotHash({
    ...snapshot,
    snapshotHash: "",
    revisions: { ...snapshot.revisions, snapshotHash: "" }
  });
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  return snapshot;
}

function addPublicationToState(state, publication) {
  const publications = state.themePublications ?? (state.themePublications = []);
  const existingIndex = publications.findIndex((candidate) => candidate.id === publication.id);
  if (existingIndex === -1) publications.push(toPrismaJson(publication));
  else publications[existingIndex] = toPrismaJson(publication);
}

async function publishMissingVideoPages(state, syncedPages, prisma) {
  const {
    buildPublicationSnapshot,
    missingStorefrontProfileFacts,
    publishSeoSnapshotRelational,
    applyMydreamshootsVideoTopicPublication,
    publicationSnapshotHash,
    publicationSnapshotIntegrity
  } = loadPublicationTools();
  const activePointer = await prisma.activeThemePublication.findUnique({
    where: { siteId: SITE_ID },
    include: { publication: true }
  });
  const allPublications = await prisma.themePublication.findMany({
    where: { siteId: SITE_ID },
    orderBy: [{ version: "desc" }, { publishedAt: "desc" }]
  });
  const publicationCandidates = [
    activePointer?.publication,
    ...allPublications.filter((publication) => publication.id !== activePointer?.publication?.id)
  ].filter(Boolean);
  const currentPublication = publicationCandidates.find((publication) => publicationSnapshotIntegrity(publication.snapshot) === "valid");
  const sourceSite = (state.sites ?? []).find((site) => site.id === SITE_ID);
  if (!sourceSite) throw new Error(`missing_site:${SITE_ID}`);
  if (!currentPublication) {
    const profile = sourceSite.storefrontProfile?.draftJson ?? sourceSite.storefrontProfile?.publishedJson;
    const missingProfileFacts = missingStorefrontProfileFacts(profile, { requireProductionClaims: SITE_ID === "site_dreamshoot" });
    if (missingProfileFacts.length) {
      throw new Error(`missing_storefront_profile_facts:${SITE_ID}:${missingProfileFacts.join(",")}`);
    }
  }

  // Legacy publications cannot be patched. Recompile a complete immutable snapshot from
  // the current relational draft state, then let the normal publication transaction activate it.
  const snapshot = currentPublication
    ? clone(currentPublication.snapshot)
    : buildPublicationSnapshot(
      sourceSite,
      undefined,
      (state.creativePacks ?? []).filter((pack) => pack.siteId === SITE_ID),
      (state.products ?? []).filter((product) => product.siteId === SITE_ID)
    );
  const databaseVideoPages = await prisma.themePage.findMany({
    where: {
      siteId: SITE_ID,
      slug: { in: pages.map((page) => pagePath(page.slug)) }
    },
    orderBy: [{ slug: "asc" }]
  });
  const publishCandidates = [
    ...syncedPages,
    ...databaseVideoPages
  ];
  const dedupedBySlug = new Map(
    publishCandidates
      .filter((page) => page.slug.startsWith("/ai-video-generation/"))
      .map((page) => [page.slug, page])
  );
  const syncedPublicPages = [...dedupedBySlug.values()]
    .map((page) => ({
      id: page.id,
      siteId: page.siteId ?? SITE_ID,
      pageType: page.pageType,
      templateKey: page.templateKey,
      slug: page.slug,
      title: page.title,
      publishedJson: clone(page.draftJson ?? page.publishedJson),
      createdAt: page.createdAt instanceof Date ? page.createdAt.toISOString() : page.createdAt,
      updatedAt: page.updatedAt instanceof Date ? page.updatedAt.toISOString() : page.updatedAt
    }));
  const syncedBySlug = new Map(syncedPublicPages.map((page) => [page.slug, page]));
  let replacedCount = 0;
  const existingSlugs = new Set();
  snapshot.pages = snapshot.pages.map((page) => {
    existingSlugs.add(page.slug);
    const replacement = syncedBySlug.get(page.slug);
    if (!replacement) return page;
    if (sameJson(page, replacement)) return page;
    replacedCount += 1;
    return replacement;
  });
  const missingPages = syncedPublicPages.filter((page) => !existingSlugs.has(page.slug));
  snapshot.pages = [...snapshot.pages, ...missingPages];
  const publishedVideoRouteCount = Array.isArray(snapshot.publishedRoutes)
    ? snapshot.publishedRoutes.filter((route) => route.routeKind === "ai-video-topic-leaf").length
    : 0;
  const publishedVideoNavigation = Array.isArray(snapshot.publishedVideoNavigation)
    ? snapshot.publishedVideoNavigation
    : [];
  const needsVideoProjection = publishedVideoRouteCount !== syncedPublicPages.length ||
    publishedVideoNavigation.length !== syncedPublicPages.length ||
    publishedVideoNavigation.some((item) => typeof item.description !== "string" || !item.description.trim());
  if (currentPublication && !replacedCount && !missingPages.length && !needsVideoProjection) return undefined;
  const compiledSnapshot = applyMydreamshootsVideoTopicPublication(snapshot, SITE_ID);
  Object.assign(snapshot, compiledSnapshot);
  refreshSnapshotHash(snapshot, publicationSnapshotHash);
  if (publicationSnapshotIntegrity(snapshot) !== "valid") {
    throw new Error("video_topic_publication_snapshot_integrity_failed");
  }

  const result = await publishSeoSnapshotRelational({
    siteId: SITE_ID,
    snapshot,
    actor: "sync:mydreamshoots-video-topic-pages"
  });
  addPublicationToState(state, result.publication);
  return result.publication;
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
          const existingTheme = await tx.videoTheme.findUnique({
            where: { siteId_slug: { siteId: SITE_ID, slug: page.slug } },
            select: { imageUrl: true, galleryImages: true }
          });
          if (existingTheme && (existingTheme.imageUrl !== page.imageUrl || !sameJson(existingTheme.galleryImages, [page.imageUrl]))) {
            await tx.videoTheme.update({
              where: { siteId_slug: { siteId: SITE_ID, slug: page.slug } },
              data: {
                imageUrl: page.imageUrl,
                galleryImages: [page.imageUrl]
              }
            });
          }
        }
        for (const page of syncedPages) {
          const pageData = {
            siteId: SITE_ID,
            pageType: page.pageType,
            templateKey: page.templateKey,
            slug: page.slug,
            title: page.title,
            draftJson: toPrismaJson(page.draftJson),
            draftMeta: page.draftMeta ? toPrismaJson(page.draftMeta) : null
          };
          const existingPage = await tx.themePage.findFirst({
            where: {
              siteId: SITE_ID,
              OR: [{ id: page.id }, { slug: page.slug }]
            },
            select: { id: true, pageType: true, templateKey: true, slug: true, title: true, draftJson: true, draftMeta: true }
          });
          if (existingPage) {
            // Existing remote pages can predate deterministic import IDs. The stable slug is
            // the publication identity, so retain that relational ID in the draft and snapshot.
            page.id = existingPage.id;
            const pageChanged = existingPage.pageType !== pageData.pageType ||
              existingPage.templateKey !== pageData.templateKey ||
              existingPage.slug !== pageData.slug ||
              existingPage.title !== pageData.title ||
              !sameJson(existingPage.draftJson, pageData.draftJson) ||
              !sameJson(existingPage.draftMeta, pageData.draftMeta);
            if (pageChanged) {
              await tx.themePage.update({
                where: { id: existingPage.id },
                data: pageData
              });
            }
          } else {
            await tx.themePage.create({
              data: {
                id: page.id,
                ...pageData,
                publishedJson: toPrismaJson(EMPTY_UNPUBLISHED_PAGE_JSON),
                createdAt: new Date(page.createdAt ?? UPDATE_TIMESTAMP)
              }
            });
          }
        }
        const relationalVideoThemes = await tx.videoTheme.findMany({
          where: {
            siteId: SITE_ID,
            slug: { in: pages.map((page) => page.slug) }
          },
          orderBy: [{ sortOrder: "asc" }, { slug: "asc" }]
        });
        syncVideoThemeStateFromRelational(state, relationalVideoThemes, changes);
        await tx.platformStateDocument.upsert({
          where: { id: "platform" },
          create: { id: "platform", state: toPrismaJson(state) },
          update: { state: toPrismaJson(state) }
        });
      },
        { timeout: 120_000 }
    );
    const publication = await publishMissingVideoPages(state, syncedPages, prisma);
    if (publication) {
      await prisma.platformStateDocument.upsert({
        where: { id: "platform" },
        create: { id: "platform", state: toPrismaJson(state) },
        update: { state: toPrismaJson(state) }
      });
    }
    clearPlatformStateCaches();
    return publication;
  } finally {
    await prisma.$disconnect();
  }
}

assertPageImageAssets();

const state = await readPlatformState();
if (!dryRun && !updateDb) throw new Error("PostgreSQL-only sync requires --dry-run or --db");
const changes = [];
const categories = syncCategories(state, changes);
const syncedPages = syncPages(state, changes);
pruneNonPublicVideoTopicPages(state, changes);
syncExistingVideoThemePreviews(state, changes);

let databasePublication;
if (updateDb && !dryRun) {
  assertNonProductionWriteTarget();
  databasePublication = await updateDatabase(state, categories, syncedPages);
}
console.log(
  JSON.stringify(
    {
      dryRun,
      updateDb,
      stateSource: "postgres",
      siteId: SITE_ID,
      pages: pages.map((page) => pagePath(page.slug)),
      categories: categories.map((category) => category.slug),
      changedFields: changes.length,
      changedRecords: new Set(changes.map((change) => `${change.targetType}:${change.id}`)).size,
      publishedVersion: databasePublication?.version,
      publicationId: databasePublication?.id,
      sampleChanges: changes.slice(0, 12)
    },
    null,
    2
  )
);
