#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const CONFIRMATION = "aidreamshoots-video-topic-media";
const PRODUCTION_CONFIRMATION = `${CONFIRMATION}-production`;
const SITE_ASSET_ROOT = "/assets/sites/site_aidreamshoots/visuals";
const TOPICS = [
  {
    slug: "talking-photo",
    source: "seedance-2-5-special-c93b39e2-660b-48c4-a956-17a29b237186.mp4",
    width: 1280,
    height: 720,
    alt: "Mujer mayor hablando a la cámara en un vídeo de fotografía parlante."
  },
  {
    slug: "cinematic-video",
    source: "seedance-2-5-special-f7216782-29c8-4e46-ae8e-61afa35a18ed.mp4",
    width: 1920,
    height: 1080,
    alt: "Persona adulta en una escena cinematográfica con iluminación dramática y composición cuidada."
  },
  {
    slug: "music-video",
    source: "seedance-2-5-special-304ab296-6376-4402-998d-a054c12775a6.mp4",
    width: 1920,
    height: 1080,
    alt: "Artista adulta preparando una propuesta visual para una canción en un estudio de producción."
  },
  {
    slug: "tiktok-video",
    source: "seedance-2-5-special-0549a9fd-7340-43d8-82de-75f6006550ad.mp4",
    width: 1920,
    height: 1080,
    alt: "Creadora adulta preparando un vídeo corto para TikTok con cámara y accesorios coloridos."
  },
  {
    slug: "product-video",
    source: "minimax-h3-48328a9a-b0b2-4d80-9aa3-b0c0598d21f8.mp4",
    width: 1344,
    height: 768,
    alt: "Producto de consumo sin marca presentado en un estudio comercial con iluminación limpia y precisa."
  },
  {
    slug: "promo-video",
    source: "seedance-2-0-special-ecab1e89-60cb-4764-9bfa-10eefbd3ab38.mp4",
    width: 1280,
    height: 720,
    alt: "Persona adulta presentando un adelanto de lanzamiento con iluminación promocional y ambiente dinámico."
  },
  {
    slug: "product-ad-video",
    source: "minimax-h3-c024c37e-93b0-42f3-a1c1-ab2ce4fed08c.mp4",
    width: 1344,
    height: 768,
    alt: "Presentadora adulta mostrando un producto sin marca en una escena centrada en una decisión de compra."
  },
  {
    slug: "instagram-reels",
    source: "seedance-2-5-special-17db935e-7d9b-4ac9-828c-b854d981ab23.mp4",
    width: 1920,
    height: 1080,
    alt: "Creadora adulta preparando un Reel en un estudio casero con cámara y accesorios de grabación."
  }
].map((topic) => ({
  ...topic,
  video: `${SITE_ASSET_ROOT}/${topic.slug}/${topic.slug}.mp4`,
  poster: `${SITE_ASSET_ROOT}/${topic.slug}/${topic.slug}-poster.jpg`,
  pagePath: `/ai-video-generation/${topic.slug}`
}));

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const confirmation = process.argv.find((value) => value.startsWith("--confirm="))?.slice("--confirm=".length) ?? "";
const topicBySlug = new Map(TOPICS.map((topic) => [topic.slug, topic]));
const repoRoot = process.cwd();
const sectionIdFor = (slug) => slug === "talking-photo" ? "talking_photo_landing_1" : "ai_video_topic_landing_1";
const topicForPage = (slug) => topicBySlug.get(String(slug).replace(/^\/ai-video-generation\//, ""));

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isVideoUrl(value) {
  return typeof value === "string" && /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(value);
}

function contentForPageJson(pageJson, topic) {
  const section = pageJson?.sections?.[sectionIdFor(topic.slug)];
  const content = section?.settings?.content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    throw new Error(`missing_topic_content:${topic.pagePath}`);
  }
  return content;
}

function updatePageJson(pageJson, topic) {
  const next = clone(pageJson);
  const content = contentForPageJson(next, topic);
  const hero = content.hero && typeof content.hero === "object" && !Array.isArray(content.hero) ? content.hero : {};
  const currentVideo = hero.video && typeof hero.video === "object" && !Array.isArray(hero.video) ? hero.video : {};
  const currentSrc = typeof currentVideo.src === "string" ? currentVideo.src : "";
  if (currentSrc && !currentSrc.includes(`/visuals/${topic.slug}/`) && currentSrc !== topic.video) {
    throw new Error(`unexpected_topic_video_source:${topic.slug}:${currentSrc}`);
  }
  const currentImage = hero.image && typeof hero.image === "object" && !Array.isArray(hero.image) ? hero.image : {};
  content.hero = {
    ...content.hero,
    image: {
      ...currentImage,
      src: topic.poster,
      alt: topic.alt,
      width: topic.width,
      height: topic.height
    },
    video: {
      ...currentVideo,
      src: topic.video,
      poster: topic.poster,
      alt: topic.alt,
      width: topic.width,
      height: topic.height,
      fit: "cover"
    }
  };
  return next;
}

function updateThemeGallery(galleryImages, topic) {
  const gallery = Array.isArray(galleryImages) ? galleryImages.filter((value) => typeof value === "string" && value.trim()) : [];
  const withoutVideos = gallery.filter((value) => !isVideoUrl(value));
  return [topic.video, ...withoutVideos];
}

function updatePlatformState(state, pageJsonByPath, themeBySlug) {
  const next = clone(state);
  const site = next.sites?.find((candidate) => candidate.id === SITE_ID);
  if (!site) throw new Error(`missing_platform_state_site:${SITE_ID}`);
  for (const topic of TOPICS) {
    const page = site.pages?.find((candidate) => candidate.slug === topic.pagePath);
    if (page) {
      for (const key of ["draftJson", "publishedJson", "contentJson"]) {
        const pageJson = page[key];
        if (pageJson?.sections?.[sectionIdFor(topic.slug)]?.settings?.content) {
          page[key] = updatePageJson(pageJson, topic);
        }
      }
    }
    const theme = site.videoThemes?.find((candidate) => candidate.slug === topic.slug)
      ?? next.videoThemes?.find((candidate) => candidate.siteId === SITE_ID && candidate.slug === topic.slug);
    if (theme) {
      theme.imageUrl = topic.poster;
      theme.galleryImages = updateThemeGallery(theme.galleryImages, topic);
    }
  }
  return next;
}

function assertPublicAssets() {
  for (const topic of TOPICS) {
    for (const assetUrl of [topic.video, topic.poster]) {
      const filePath = path.resolve(repoRoot, "public", assetUrl.slice(1));
      if (!fs.existsSync(filePath)) throw new Error(`missing_public_asset:${assetUrl}`);
    }
  }
}

function assertTarget(target) {
  if (target === "production") {
    return assertDatabaseTarget({
      expectedTarget: "production",
      requireProductionConfirmation: true,
      productionConfirmed: confirmation === PRODUCTION_CONFIRMATION
    });
  }
  return assertDatabaseTarget({ expectedTarget: "local" });
}

function summarizeTopic(topic, pageBefore, pageAfter, themeBefore, themeAfter) {
  const sectionId = sectionIdFor(topic.slug);
  const beforeContent = pageBefore?.sections?.[sectionId]?.settings?.content;
  const afterContent = pageAfter?.sections?.[sectionId]?.settings?.content;
  return {
    slug: topic.slug,
    pageChanged: !sameJson(pageBefore, pageAfter),
    previousVideo: beforeContent?.hero?.video?.src ?? "",
    video: afterContent?.hero?.video?.src ?? "",
    poster: afterContent?.hero?.video?.poster ?? "",
    alt: afterContent?.hero?.video?.alt ?? "",
    dimensions: `${afterContent?.hero?.video?.width ?? 0}x${afterContent?.hero?.video?.height ?? 0}`,
    themeChanged: !sameJson(themeBefore, themeAfter)
  };
}

const target = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
assertTarget(target);
if (apply && ![CONFIRMATION, PRODUCTION_CONFIRMATION].includes(confirmation)) {
  throw new Error(`Run with --confirm=${target === "production" ? PRODUCTION_CONFIRMATION : CONFIRMATION}.`);
}
assertPublicAssets();

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try {
  const pageWhere = { siteId: SITE_ID, slug: { in: TOPICS.map((topic) => topic.pagePath) } };
  const [livePages, themePages, videoThemes, platformState] = await Promise.all([
    prisma.livePage.findMany({ where: pageWhere, select: { id: true, slug: true, contentJson: true } }),
    prisma.themePage.findMany({ where: pageWhere, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.videoTheme.findMany({ where: { siteId: SITE_ID, slug: { in: TOPICS.map((topic) => topic.slug) } }, select: { id: true, slug: true, imageUrl: true, galleryImages: true } }),
    prisma.platformStateDocument.findUnique({ where: { id: "platform" }, select: { state: true } })
  ]);
  if (livePages.length !== TOPICS.length) throw new Error(`unexpected_live_page_count:${livePages.length}`);
  if (themePages.length !== TOPICS.length) throw new Error(`unexpected_theme_page_count:${themePages.length}`);
  if (videoThemes.length !== TOPICS.length) throw new Error(`unexpected_video_theme_count:${videoThemes.length}`);
  if (!platformState?.state) throw new Error("missing_platform_state_document:platform");

  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const themePageBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const themeBySlug = new Map(videoThemes.map((row) => [row.slug, row]));
  const plannedLivePages = livePages.map((row) => ({ ...row, contentJson: updatePageJson(row.contentJson, topicForPage(row.slug)) }));
  const plannedThemePages = themePages.map((row) => ({
    ...row,
    draftJson: updatePageJson(row.draftJson, topicForPage(row.slug)),
    publishedJson: updatePageJson(row.publishedJson, topicForPage(row.slug))
  }));
  const plannedThemes = videoThemes.map((row) => {
    const topic = topicBySlug.get(row.slug);
    if (!topic) throw new Error(`missing_topic_definition:${row.slug}`);
    return {
      ...row,
      imageUrl: topic.poster,
      galleryImages: updateThemeGallery(row.galleryImages, topic)
    };
  });
  const plannedState = updatePlatformState(platformState.state, Object.fromEntries(plannedLivePages.map((row) => [row.slug, row.contentJson])), Object.fromEntries(plannedThemes.map((row) => [row.slug, row])));
  const summaries = TOPICS.map((topic) => {
    const liveBefore = liveBySlug.get(topic.pagePath);
    const liveAfter = plannedLivePages.find((row) => row.slug === topic.pagePath);
    const themeBefore = themeBySlug.get(topic.slug);
    const themeAfter = plannedThemes.find((row) => row.slug === topic.slug);
    return summarizeTopic(topic, liveBefore?.contentJson, liveAfter?.contentJson, themeBefore, themeAfter);
  });

  const result = { target, apply, siteId: SITE_ID, topics: summaries, platformStateChanged: !sameJson(platformState.state, plannedState) };
  if (!apply) {
    console.log(JSON.stringify(result, null, 2));
    await prisma.$disconnect();
    process.exit(0);
  }

  const backupDirectory = path.resolve(repoRoot, ".tmp/aidreamshoots-video-topic-media/backups");
  fs.mkdirSync(backupDirectory, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDirectory, `before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({
    createdAt: new Date().toISOString(),
    siteId: SITE_ID,
    livePages,
    themePages,
    videoThemes,
    platformStateSite: platformState.state.sites?.find((site) => site.id === SITE_ID) ?? null
  }, null, 2)}\n`, { mode: 0o600 });

  await prisma.$transaction(async (tx) => {
    for (const row of plannedLivePages) {
      await tx.livePage.update({ where: { id: row.id }, data: { contentJson: row.contentJson } });
    }
    for (const row of plannedThemePages) {
      await tx.themePage.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson } });
    }
    for (const row of plannedThemes) {
      await tx.videoTheme.update({ where: { id: row.id }, data: { imageUrl: row.imageUrl, galleryImages: row.galleryImages } });
    }
    await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state: plannedState } });
  }, { timeout: 180_000 });

  const readback = await prisma.livePage.findMany({ where: pageWhere, select: { slug: true, contentJson: true } });
  for (const row of readback) {
    const topic = topicForPage(row.slug);
    const content = contentForPageJson(row.contentJson, topic);
    if (content.hero.video.src !== topic.video || content.hero.video.poster !== topic.poster || content.hero.video.alt !== topic.alt) {
      throw new Error(`readback_mismatch:${row.slug}`);
    }
  }
  console.log(JSON.stringify({ ...result, backupPath, readbackPages: readback.length, paidProviderCalls: 0 }, null, 2));
} finally {
  await prisma.$disconnect();
}
