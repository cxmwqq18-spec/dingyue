import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
let stateSource = "local-json";

async function readPlatformState() {
  if (fs.existsSync(statePath)) {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  }
  stateSource = "postgres";
  const prisma = new PrismaClient();
  try {
    const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
    if (!document?.state) throw new Error("missing platform state document");
    return document.state;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

const state = await readPlatformState();
const frameworkSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "mydreamshoots-video-framework.ts"), "utf8");
const siteStoreSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "stores", "site-store.ts"), "utf8");
const themeRendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
const targetSiteIds = ["site_dreamshoot", "site_grownstride_test"];
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
    ["fashion-video", "Fashion Video", 230]
  ],
  site_grownstride_test: [
    ["text-to-video", "Text to video", 10],
    ["image-to-video", "Image to Video", 20]
  ]
};

function fail(message, details) {
  console.error(`myDreamShoots video framework smoke failed: ${message}`);
  if (details) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

for (const siteId of targetSiteIds) {
  const toolCategories = (state.toolCategories ?? []).filter((row) => row.siteId === siteId);
  const toolMenuItems = (state.toolMenuItems ?? []).filter((row) => row.siteId === siteId);
  const videoCategories = (state.videoThemeCategories ?? [])
    .filter((row) => row.siteId === siteId && row.status === "active")
    .sort((left, right) => left.sortOrder - right.sortOrder);
  const expectedCategories = expectedCategoriesBySite[siteId] ?? baseExpectedCategories;
  assert(toolCategories.length === 0, `${siteId} should have no legacy tool categories`, { count: toolCategories.length });
  assert(toolMenuItems.length === 0, `${siteId} should have no legacy tool menu items`, { count: toolMenuItems.length });
  for (const [slug, label, sortOrder] of expectedCategories) {
    const category = videoCategories.find((row) => row.slug === slug);
    assert(category, `${siteId} should include the ${slug} video category`, { categories: videoCategories });
    assert(category.label === label && category.sortOrder === sortOrder, `${siteId} ${slug} video category does not match the framework`, { category, expected: { label, sortOrder } });
  }
}
assert(frameworkSource.includes("mydreamshootsVideoGenerationCategoriesForSite"), "video framework must expose site-scoped category seeds");
assert(frameworkSource.includes("siteId === \"site_dreamshoot\""), "full video framework categories must be limited to site_dreamshoot");
assert(siteStoreSource.includes("mydreamshootsVideoGenerationCategoriesForSite(siteId)"), "relational video framework initialization must use site-scoped category seeds");
assert(themeRendererSource.includes("if (site.id !== \"site_dreamshoot\") return []"), "public video header topics must stay scoped to site_dreamshoot");

for (const siteId of ["site_aidreamcapes", "site_aidreamcapes_xby", "site_mydreamshoots_xby"]) {
  const toolCount = (state.toolMenuItems ?? []).filter((row) => row.siteId === siteId).length;
  assert(toolCount > 0, `${siteId} should remain outside the MyDreamShoots reset`, { toolCount });
}

const frameworkImageUrls = Array.from(frameworkSource.matchAll(/imageUrl:\s*"([^"]*)"/g))
  .map((match) => match[1])
  .filter((imageUrl) => imageUrl.startsWith("/assets/"));
for (const imageUrl of frameworkImageUrls) {
  const assetPath = path.join(repoRoot, "public", imageUrl.split(/[?#]/)[0]);
  assert(fs.existsSync(assetPath), "video framework seed image must exist in public assets", { imageUrl, assetPath });
  const optimizedImageUrl = imageUrl.startsWith("/assets/dreamshoot/") ? imageUrl.split(/[?#]/)[0].replace(/\.png$/i, ".webp") : "";
  if (optimizedImageUrl && optimizedImageUrl !== imageUrl.split(/[?#]/)[0]) {
    const optimizedAssetPath = path.join(repoRoot, "public", optimizedImageUrl);
    assert(fs.existsSync(optimizedAssetPath), "video framework optimized seed image must exist in public assets", { imageUrl: optimizedImageUrl, assetPath: optimizedAssetPath });
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
  stateSource,
  videoThemeRowsBySite: Object.fromEntries(targetSiteIds.map((siteId) => [
    siteId,
    (state.videoThemes ?? []).filter((row) => row.siteId === siteId).length
  ])),
  checkedSeedImages: frameworkImageUrls.length
}, null, 2));
