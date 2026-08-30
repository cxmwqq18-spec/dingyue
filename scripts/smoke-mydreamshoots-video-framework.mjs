#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const expectedTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() === "remote-readonly" ? "remote-readonly" : "local";
assertDatabaseTarget({ expectedTarget });

const frameworkSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "mydreamshoots-video-framework.ts"), "utf8");
const siteStoreSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "stores", "site-store.ts"), "utf8");
const themeRendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
const targetSiteIds = ["site_dreamshoot"];
const jiti = createJiti(import.meta.url);
const frameworkModule = jiti("../src/lib/mydreamshoots-video-framework.ts");
const aiTopicContentModule = jiti("../scripts/seed-mydreamshoots-ai-video-topic-content.ts");
const talkingPhotoContentModule = jiti("../scripts/seed-mydreamshoots-talking-photo-content.ts");
const baseExpectedCategories = [
  ["text-to-video", "Text to Video", 10],
  ["image-to-video", "Image to Video", 20]
];
const expectedCategoriesBySite = {
  site_dreamshoot: [
    ...baseExpectedCategories,
    ["talking-photo", "Talking Photo", 30],
    ["cinematic-video", "Cinematic Video", 60],
    ["tiktok-video", "TikTok Video", 70],
    ["instagram-reels", "Instagram Reels", 80],
    ["social-media-video", "Social Media Video", 110],
    ["youtube-video", "YouTube Video", 100],
    ["story-video", "Story Video", 120],
    ["meme-video", "Meme Video", 130],
    ["product-video", "Product Video", 140],
    ["product-ad-video", "Product Ad Video", 160],
    ["promo-video", "Promo Video", 180],
    ["ugc-ad-video", "UGC Ad Video", 170],
    ["video-ad", "Video Ad", 190],
    ["brand-video", "Brand Video", 200],
    ["music-video", "Music Video", 210],
    ["fashion-video", "Fashion Video", 230],
    ["food-video", "Food Video", 240],
    ["pet-video", "Pet Video", 260]
  ],
  site_grownstride_test: [
    ["text-to-video", "Text to Video", 10],
    ["image-to-video", "Image to Video", 20]
  ]
};

function fail(message, details) {
  console.error(`myDreamShoots video framework smoke failed: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assertCondition(condition, message, details) {
  if (!condition) fail(message, details);
}

const prisma = new PrismaClient();
try {
  for (const siteId of targetSiteIds) {
    const [toolCategories, toolMenuItems, videoCategories] = await Promise.all([
      prisma.toolCategory.findMany({ where: { siteId }, select: { id: true } }),
      prisma.toolMenuItem.findMany({ where: { siteId }, select: { id: true } }),
      prisma.videoThemeCategory.findMany({ where: { siteId, status: "active" }, select: { slug: true, label: true, sortOrder: true }, orderBy: { sortOrder: "asc" } })
    ]);
    const expectedCategories = expectedCategoriesBySite[siteId] ?? baseExpectedCategories;
    assertCondition(toolCategories.length === 0, `${siteId} should have no legacy tool categories`, { count: toolCategories.length });
    assertCondition(toolMenuItems.length === 0, `${siteId} should have no legacy tool menu items`, { count: toolMenuItems.length });
    for (const [slug, label, sortOrder] of expectedCategories) {
      const category = videoCategories.find((row) => row.slug === slug);
      assertCondition(category, `${siteId} should include the ${slug} video category`, { categories: videoCategories });
      assertCondition(category.label === label && category.sortOrder === sortOrder, `${siteId} ${slug} video category does not match the framework`, { category, expected: { label, sortOrder } });
    }
  }

  assertCondition(frameworkSource.includes("mydreamshootsVideoGenerationCategoriesForSite"), "video framework must expose site-scoped category seeds");
  assertCondition(frameworkSource.includes("siteId === \"site_dreamshoot\""), "full video framework categories must be limited to site_dreamshoot");
  assertCondition(siteStoreSource.includes("mydreamshootsVideoGenerationCategoriesForSite(siteId)"), "relational video framework initialization must use site-scoped category seeds");
  assertCondition(themeRendererSource.includes("if (site.id !== \"site_dreamshoot\") return []"), "public video header topics must stay scoped to site_dreamshoot");

  for (const siteId of ["site_aidreamcapes", "site_aidreamcapes_xby", "site_mydreamshoots_xby"]) {
    const toolCount = await prisma.toolMenuItem.count({ where: { siteId } });
    assertCondition(toolCount > 0, `${siteId} should remain outside the MyDreamShoots reset`, { toolCount });
  }

  const frameworkImageUrls = Array.from(frameworkSource.matchAll(/imageUrl:\s*"([^"]*)"/g))
    .map((match) => match[1])
    .filter((imageUrl) => imageUrl.startsWith("/assets/"));
  const socialMediaCover = "/assets/dreamshoot/generated/video-topic-clean/social-media-video/social-media-video-01.webp";
  assertCondition(
    frameworkSource.includes(`slug: "social-media-video"`) && frameworkSource.includes(`imageUrl: "${socialMediaCover}"`),
    "social-media-video must use its dedicated graduation cover",
    { socialMediaCover }
  );
  const seededImageUrls = Array.from(frameworkSource.matchAll(/slug:\s*"([^"]+)"[\s\S]{0,600}?imageUrl:\s*"([^"]*)"/g))
    .map((match) => ({ slug: match[1], imageUrl: match[2] }))
    .filter((item) => item.imageUrl.startsWith("/assets/"));
  const seededImageOwners = new Map();
  for (const item of seededImageUrls) {
    const owners = seededImageOwners.get(item.imageUrl) ?? [];
    owners.push(item.slug);
    seededImageOwners.set(item.imageUrl, owners);
  }
  assertCondition(
    [...seededImageOwners.values()].every((owners) => owners.length === 1),
    "video theme seed covers must not be reused across themes",
    { duplicates: [...seededImageOwners.entries()].filter(([, owners]) => owners.length > 1) }
  );
  const canonicalContentBySlug = {
    ...aiTopicContentModule.aiVideoTopicLandingContentByKey,
    "talking-photo": talkingPhotoContentModule.talkingPhotoContent
  };
  const canonicalThemes = frameworkModule.mydreamshootsVideoGenerationThemeSeedsForSite("site_dreamshoot")
    .filter((theme) => frameworkModule.mydreamshootsPublicVideoGenerationTopicSlugs.includes(theme.slug));
  const canonicalCoverOwners = new Map();
  for (const theme of canonicalThemes) {
    const content = canonicalContentBySlug[theme.slug];
    assertCondition(content?.hero?.image?.src, "every public video theme must have canonical detail hero media", { slug: theme.slug });
    assertCondition(theme.imageUrl === content.hero.image.src, "directory cover and detail hero must use the same canonical image", {
      slug: theme.slug,
      directoryCover: theme.imageUrl,
      detailHero: content.hero.image.src
    });
    if (content.hero.images?.length) {
      assertCondition(content.hero.images[0].src === content.hero.image.src, "detail hero carousel must start with its canonical cover", { slug: theme.slug });
    }
    const owners = canonicalCoverOwners.get(theme.imageUrl) ?? [];
    owners.push(theme.slug);
    canonicalCoverOwners.set(theme.imageUrl, owners);
  }
  assertCondition(
    [...canonicalCoverOwners.values()].every((owners) => owners.length === 1),
    "canonical detail hero covers must not be reused across public video themes",
    { duplicates: [...canonicalCoverOwners.entries()].filter(([, owners]) => owners.length > 1) }
  );
  for (const imageUrl of frameworkImageUrls) {
    const assetPath = path.join(repoRoot, "public", imageUrl.split(/[?#]/)[0]);
    assertCondition(fs.existsSync(assetPath), "video framework seed image must exist in public assets", { imageUrl, assetPath });
    const optimizedImageUrl = imageUrl.startsWith("/assets/dreamshoot/") ? imageUrl.split(/[?#]/)[0].replace(/\.png$/i, ".webp") : "";
    if (optimizedImageUrl && optimizedImageUrl !== imageUrl.split(/[?#]/)[0]) {
      const optimizedAssetPath = path.join(repoRoot, "public", optimizedImageUrl);
      assertCondition(fs.existsSync(optimizedAssetPath), "video framework optimized seed image must exist in public assets", { imageUrl: optimizedImageUrl, assetPath: optimizedAssetPath });
    }
  }

  console.log(JSON.stringify({
    ok: true,
    targetSites: targetSiteIds,
    categoriesBySite: Object.fromEntries(Object.entries(expectedCategoriesBySite).map(([siteId, categories]) => [
      siteId,
      categories.map(([slug, label]) => ({ slug, label }))
    ])),
    legacyTools: 0,
    stateSource: expectedTarget === "remote-readonly" ? "remote-readonly-db" : "postgres",
    videoThemeRowsBySite: Object.fromEntries(await Promise.all(targetSiteIds.map(async (siteId) => [
      siteId,
      await prisma.videoTheme.count({ where: { siteId } })
    ]))),
    checkedSeedImages: frameworkImageUrls.length
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
