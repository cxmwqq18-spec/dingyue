import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "platform-state.json"), "utf8"));
const frameworkSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "mydreamshoots-video-framework.ts"), "utf8");
const siteStoreSource = fs.readFileSync(path.join(repoRoot, "src", "lib", "stores", "site-store.ts"), "utf8");
const themeRendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
const targetSiteIds = ["site_dreamshoot", "site_grownstride_test"];
const baseExpectedCategories = [
  ["text-to-video", "Text to video", 10],
  ["image-to-video", "Image to Video", 20]
];
const expectedCategoriesBySite = {
  site_dreamshoot: [
    ...baseExpectedCategories,
    ["talking-photo", "Talking Photo", 30],
    ["cinematic-video", "Cinematic Video", 40],
    ["tiktok-video", "TikTok Video", 50],
    ["instagram-reels", "Instagram Reels", 60],
    ["social-media-video", "Social Media Video", 70],
    ["youtube-video", "YouTube Video", 80],
    ["story-video", "Story Video", 90],
    ["meme-video", "Meme Video", 100],
    ["product-video", "Product Video", 110],
    ["product-ad-video", "Product Ad Video", 120],
    ["ugc-ad-video", "UGC Ad Video", 130]
  ],
  site_grownstride_test: baseExpectedCategories
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
  videoThemeRowsBySite: Object.fromEntries(targetSiteIds.map((siteId) => [
    siteId,
    (state.videoThemes ?? []).filter((row) => row.siteId === siteId).length
  ])),
  checkedSeedImages: frameworkImageUrls.length
}, null, 2));
