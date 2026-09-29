#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SOURCE_ROOT = process.env.AIDREAMCAPES_UGC_VIDEO_SOURCE || "/Users/a1/Downloads/ugc视频";
const manifest = JSON.parse(readFileSync(new URL("../src/lib/aidreamcapes-ugc-video-media.json", import.meta.url), "utf8"));
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert(!(applyLocal && applyProduction), "Choose one database write target.");
assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
if (applyProduction) {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: confirmation === "production" });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
}
if (apply) {
  assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
  if (!applyProduction) assertNonProductionWriteTarget();
}

const slugByRoute = new Map(manifest.map((item) => [item.route, item]));
const videoPathFor = (item) => `/assets/sites/site_aidreamcapes/ugc-video-themes/${item.slug}.mp4`;
const imageThemeRoutes = [
  "/ai-image-generation/ecommerce-main-image",
  "/ai-image-generation/on-model-generation",
  "/ai-image-generation/professional-headshot",
  "/ai-image-generation/macro-details",
  "/ai-image-generation/lookbook-cover",
  "/ai-image-generation/lifestyle-scene",
  "/ai-image-generation/feed-ad-still",
  "/ai-image-generation/background-remove-replace",
  "/ai-image-generation/virtual-try-on",
  "/ai-image-generation/fashion-editorial"
];
const homepageVideoBlocks = new Map([
  ["video_ugc", "/ai-video-generation/ugc-ad-video"],
  ["video_url_ad", "/ai-video-generation/url-to-ad"],
  ["video_hooks", "/ai-video-generation/hook-lab"],
  ["video_talking", "/ai-video-generation/talking-photo-recs"],
  ["video_demo", "/ai-video-generation/product-video"],
  ["video_unboxing", "/ai-video-generation/unboxing-experience"],
  ["video_before_after", "/ai-video-generation/before-after-showcases"],
  ["video_promo", "/ai-video-generation/promo-video"]
]);
const homepageFeatureImages = new Map([
  ["workflow_output_1", "/ai-video-generation/ugc-ad-video"],
  ["workflow_output_2", "/ai-video-generation/hook-lab"],
  ["workflow_output_3", "/ai-video-generation/product-video"],
  ["ad_hook_lab", "/ai-video-generation/hook-lab"],
  ["ad_actor", "/ai-video-generation/ai-actor-product-ads"]
]);

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function section(page, id) {
  const candidate = page.contentJson?.sections?.[id];
  assert(candidate, `${page.slug}: section ${id} is missing`);
  return structuredClone(candidate);
}

function detailHero(content) {
  if (content.layoutVariant === "ugc-ad-detail" && content.ugcAdDetail?.hero) return content.ugcAdDetail.hero;
  if (content.layoutVariant === "ads-testing-detail" && content.adsTestingDetail?.hero && !content.hero?.productImage) return content.adsTestingDetail.hero;
  assert(content.hero, "video landing hero is missing");
  return content.hero;
}

function imageFromHero(content) {
  const hero = content?.hero;
  if (!hero || typeof hero !== "object") return undefined;
  return hero.outputImage || hero.image || hero.productImage;
}

function videoFor(item, hero) {
  const outputImage = hero.outputImage || hero.output?.image;
  assert(outputImage?.src, `${item.route}: hero output image is missing for poster`);
  return {
    src: videoPathFor(item),
    poster: outputImage.src,
    alt: `${item.label} video preview`,
    label: item.label,
    width: 1344,
    height: 768,
    fit: "cover",
    loading: "eager",
    fetchPriority: "high",
    sizes: "(max-width: 1024px) 100vw, 960px"
  };
}

function updateDetailPage(page, item) {
  const next = structuredClone(page.contentJson);
  const contentEntry = Object.values(next.sections ?? {}).find((entry) => entry?.type === "ai_video_topic_landing");
  const content = contentEntry?.settings?.content;
  assert(content, `${page.slug}: content cannot be updated`);
  const hero = detailHero(content);
  hero.video = videoFor(item, hero);
  const existingManifest = Array.isArray(next.mediaManifest) ? next.mediaManifest : [];
  next.mediaManifest = [
    ...existingManifest.filter((entry) => entry?.role !== "video"),
    {
      src: hero.video.src,
      poster: hero.video.poster,
      alt: hero.video.alt,
      width: hero.video.width,
      height: hero.video.height,
      role: "video",
      loading: "eager",
      fetchPriority: "high",
      sizes: "(max-width: 1024px) 100vw, 960px"
    }
  ];
  if (next.contentContract && typeof next.contentContract === "object") {
    next.contentContract.mediaCount = next.mediaManifest.length;
    next.contentContract.sourceRevision = "aidreamcapes-ugc-video-media-v1";
  }
  return next;
}

function imageThemeOutput(page) {
  const sections = Object.values(page.contentJson?.sections ?? {});
  const entry = sections.find((item) => item?.type === "ai_image_theme_landing");
  const image = imageFromHero(entry?.settings?.content);
  assert(image?.src, `${page.slug}: image theme hero output is missing`);
  return image;
}

function applyHomepageVideoSettings(block, route, detailByRoute) {
  const item = slugByRoute.get(route);
  const detail = detailByRoute.get(route);
  assert(item && detail, `Homepage video mapping is missing for ${route}`);
  const content = Object.values(detail.contentJson?.sections ?? {}).find((entry) => entry?.type === "ai_video_topic_landing")?.settings?.content;
  const hero = detailHero(content);
  const outputImage = hero.outputImage || hero.output?.image;
  assert(outputImage?.src, `${route}: output image is missing`);
  block.settings.href = route;
  block.settings.videoUrl = videoPathFor(item);
  block.settings.videoPosterUrl = outputImage.src;
  block.settings.videoAlt = `${item.label} video preview`;
  block.settings.imageUrl = outputImage.src;
  block.settings.imageAlt = outputImage.alt || block.settings.videoAlt;
  block.settings.imageWidth = outputImage.width || 1344;
  block.settings.imageHeight = outputImage.height || 768;
}

function applyHomepageImageSettings(block, route, detailByRoute, source = "output") {
  const detail = detailByRoute.get(route);
  assert(detail, `Homepage detail image mapping is missing for ${route}`);
  const content = Object.values(detail.contentJson?.sections ?? {}).find((entry) => entry?.type === "ai_video_topic_landing")?.settings?.content;
  const hero = detailHero(content);
  const image = source === "product" ? hero.productImage || hero.product?.image : hero.outputImage || hero.output?.image;
  assert(image?.src, `${route}: detail image is missing`);
  block.settings.href = route;
  block.settings.imageUrl = image.src;
  block.settings.imageAlt = image.alt || block.settings.title || "AI video theme image";
  block.settings.imageWidth = image.width || 400;
  block.settings.imageHeight = image.height || 400;
  delete block.settings.videoUrl;
  delete block.settings.videoPosterUrl;
  delete block.settings.videoAlt;
}

function updateHomepage(page, detailByRoute, imageByRoute) {
  const next = structuredClone(page.contentJson);
  const hero = section({ contentJson: next }, "aidreamcapes_hero");
  hero.settings.outputVideoUrl = videoPathFor(slugByRoute.get("/ai-video-generation/ugc-ad-video"));
  const ugcContent = detailByRoute.get("/ai-video-generation/ugc-ad-video");
  const ugcHero = detailHero(Object.values(ugcContent.contentJson.sections).find((entry) => entry?.type === "ai_video_topic_landing")?.settings?.content);
  hero.settings.outputVideoPosterUrl = ugcHero.outputImage?.src || ugcHero.output?.image?.src;
  hero.settings.outputVideoAlt = "UGC Product Ad video preview";

  const videoGrid = section({ contentJson: next }, "aidreamcapes_video_grid");
  for (const block of videoGrid.blocks ?? []) {
    const route = homepageVideoBlocks.get(block.id);
    if (route) applyHomepageVideoSettings(block, route, detailByRoute);
  }

  const adTesting = section({ contentJson: next }, "aidreamcapes_ad_testing");
  for (const block of adTesting.blocks ?? []) {
    const route = homepageFeatureImages.get(block.id);
    if (route) applyHomepageImageSettings(block, route, detailByRoute);
  }
  const urlCard = adTesting.blocks?.find((block) => block.id === "url_to_ad");
  if (urlCard) {
    applyHomepageImageSettings(urlCard, "/ai-video-generation/url-to-ad", detailByRoute, "product");
  }

  const photoGrid = section({ contentJson: next }, "aidreamcapes_photo_grid");
  if (!(photoGrid.blocks ?? []).some((block) => block.id === "photo_fashion_editorial")) {
    photoGrid.blocks = [
      ...(photoGrid.blocks ?? []),
      {
        id: "photo_fashion_editorial",
        type: "photo_card",
        settings: {
          href: "/ai-image-generation/fashion-editorial",
          title: "Fashion Editorial",
          imageAlt: "Adult model in a tailored neutral fashion editorial scene",
          imageLoading: "lazy",
          imageFetchPriority: "auto"
        }
      }
    ];
  }
  for (const block of photoGrid.blocks ?? []) {
    const route = block.settings?.href;
    const image = imageByRoute.get(route);
    assert(image, `Homepage image mapping is missing for ${route}`);
    block.settings.imageUrl = image.src;
    block.settings.imageAlt = image.alt || block.settings.title || "AI photo theme output";
    block.settings.imageWidth = image.width || 1600;
    block.settings.imageHeight = image.height || 1200;
  }

  next.sections.aidreamcapes_hero = hero;
  next.sections.aidreamcapes_video_grid = videoGrid;
  next.sections.aidreamcapes_ad_testing = adTesting;
  next.sections.aidreamcapes_photo_grid = photoGrid;
  return next;
}

function verifyAssetFiles() {
  const publicRoot = path.resolve("public");
  for (const item of manifest) {
    const publicFile = path.join(publicRoot, videoPathFor(item).replace(/^\/+/, ""));
    assert(existsSync(publicFile), `Missing public video asset: ${publicFile}`);
    const sourceFile = path.join(SOURCE_ROOT, item.directory, `${item.directory}.mp4`);
    if (existsSync(SOURCE_ROOT)) assert(existsSync(sourceFile), `Missing source video asset: ${sourceFile}`);
  }
}

verifyAssetFiles();
assert.equal(manifest.length, 35, "Expected exactly 35 Aidreamcapes UGC video mappings.");
assert.equal(new Set(manifest.map((item) => item.slug)).size, manifest.length, "Video slugs must be unique.");

const prisma = new PrismaClient();
try {
  const requestedRoutes = ["/", ...manifest.map((item) => item.route), ...imageThemeRoutes];
  const [pages, themePage] = await Promise.all([
    prisma.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: requestedRoutes } },
      select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true }
    }),
    prisma.themePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: "/" } },
      select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true, updatedAt: true }
    })
  ]);
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
  assert.equal(pages.length, requestedRoutes.length, `Expected ${requestedRoutes.length} targeted LivePages, found ${pages.length}.`);
  const home = pageBySlug.get("/");
  assert(home, "Aidreamcapes homepage is missing.");

  const nextPages = [];
  const detailByRoute = new Map();
  for (const item of manifest) {
    const page = pageBySlug.get(item.route);
    assert(page, `Missing video detail page: ${item.route}`);
    const contentJson = updateDetailPage(page, item);
    const nextPage = { ...page, contentJson };
    nextPages.push(nextPage);
    detailByRoute.set(item.route, nextPage);
  }

  const imageByRoute = new Map(imageThemeRoutes.map((route) => [route, imageThemeOutput(pageBySlug.get(route))]));
  const nextHomepage = { ...home, contentJson: updateHomepage(home, detailByRoute, imageByRoute) };
  nextPages.push(nextHomepage);

  assert(themePage?.draftJson?.sections?.aidreamcapes_video_grid, "Aidreamcapes homepage draft must use the ZIP homepage before video media can be synced.");
  const nextHomepageDraft = {
    ...themePage,
    draftJson: updateHomepage({ ...themePage, contentJson: themePage.draftJson }, detailByRoute, imageByRoute)
  };

  const report = nextPages.map((page) => ({
    slug: page.slug,
    action: "UPDATE",
    contentHash: hashJson(page.contentJson),
    previousHash: hashJson(pageBySlug.get(page.slug).contentJson)
  }));
  console.log(JSON.stringify({
    siteId: SITE_ID,
    sourceRoot: SOURCE_ROOT,
    videoCount: manifest.length,
    detailPages: manifest.map((item) => item.route),
    homepage: { videoCards: homepageVideoBlocks.size, featureImages: homepageFeatureImages.size, photoCards: imageThemeRoutes.length, draftUpdated: true },
    pages: report
  }, null, 2));

  if (apply) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `ugc-video-media-${stamp}.json`);
    mkdirSync(path.dirname(backupPath), { recursive: true });
    writeFileSync(backupPath, JSON.stringify({ siteId: SITE_ID, themePage, pages }, null, 2) + "\n", "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.update({
          where: { id: page.id },
          data: { contentJson: page.contentJson }
        });
      }
      await tx.themePage.update({
        where: { id: themePage.id },
        data: { draftJson: nextHomepageDraft.draftJson }
      });
    });
    const readback = await prisma.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: requestedRoutes } },
      select: { slug: true, contentJson: true }
    });
    const readbackBySlug = new Map(readback.map((page) => [page.slug, page]));
    for (const item of manifest) {
      const page = readbackBySlug.get(item.route);
      const content = Object.values(page.contentJson.sections).find((entry) => entry?.type === "ai_video_topic_landing")?.settings?.content;
      assert.equal(detailHero(content).video?.src, videoPathFor(item), `Readback mismatch: ${item.route}`);
    }
    const readbackThemePage = await prisma.themePage.findUnique({ where: { id: themePage.id }, select: { draftJson: true } });
    assert.equal(readbackThemePage?.draftJson?.sections?.aidreamcapes_hero?.settings?.outputVideoUrl, videoPathFor(slugByRoute.get("/ai-video-generation/ugc-ad-video")), "Homepage draft hero video mismatch");
    for (const block of readbackThemePage?.draftJson?.sections?.aidreamcapes_video_grid?.blocks ?? []) {
      assert(block.settings?.videoUrl, `Homepage draft video URL missing for ${block.id}`);
    }
    console.log(`Applied ${nextPages.length} LivePage updates for ${SITE_ID}. Backup: ${backupPath}`);
  }
} finally {
  await prisma.$disconnect();
}
