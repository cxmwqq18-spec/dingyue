#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const publicRoot = path.join(repoRoot, "public");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const failures = [];

const aidreamcapesSiteId = "site_aidreamcapes";
const mydreamshootsSiteId = "site_dreamshoot";
const expectedFeaturedOrder = ["featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"];
const aidreamcapesRootCategories = [
  "fan-scene-albums",
  "game-day-group-photos",
  "premiere-style-portraits",
  "christmas-holiday-albums",
  "thanksgiving-memory-sets",
  "halloween-party-portraits",
  "seasonal-celebration-photos"
];
const aidreamcapesNewCategories = [
  "private-fan-scene-albums",
  "backstage-meetup-portraits",
  "supporter-photo-walls",
  "fan-keepsake-card-sets",
  "game-day-group-portraits",
  "stadium-night-fan-sets",
  "watch-party-albums",
  "premiere-flash-portraits",
  "vip-arrival-photo-sets",
  "award-night-keepsake-albums",
  "christmas-group-albums",
  "cozy-card-portrait-sets",
  "winter-fan-greeting-albums",
  "thanksgiving-table-keepsakes",
  "gratitude-group-portraits",
  "friendsgiving-memory-sets",
  "halloween-party-portrait-sets",
  "costume-cast-photo-albums",
  "birthday-fan-moment-sets",
  "new-year-countdown-albums"
];
const aidreamcapesNewTools = [
  "fan-scene-album-builder",
  "backstage-meetup-scene-builder",
  "supporter-photo-wall-maker",
  "fan-keepsake-card-maker",
  "game-day-group-portrait-maker",
  "stadium-night-fan-set-maker",
  "watch-party-album-builder",
  "premiere-portrait-set-builder",
  "vip-arrival-photo-maker",
  "award-night-album-studio",
  "new-year-countdown-album-maker",
  "christmas-group-album-studio",
  "cozy-card-portrait-maker",
  "winter-fan-greeting-maker",
  "thanksgiving-keepsake-set-maker",
  "friendsgiving-memory-maker",
  "halloween-party-portrait-maker",
  "costume-cast-album-builder",
  "birthday-fan-moment-maker",
  "permission-safe-photo-planner"
];
const aidreamcapesNewBlogs = [
  "/blog/private-fan-scene-album-photo-package-guide",
  "/blog/game-day-group-portraits-photo-package-guide",
  "/blog/premiere-flash-portraits-photo-package-guide",
  "/blog/christmas-group-album-photo-package-guide"
];
const aidreamcapesLegacyPatterns = [
  /travel/i,
  /route-portrait/i,
  /route portrait/i,
  /coastal/i,
  /old-quarter/i,
  /old quarter/i,
  /old city/i,
  /cinematic-travel/i,
  /travel-journal/i,
  /family-travel/i,
  /solo-traveler/i
];

function fail(message) {
  failures.push(message);
}

function siteById(siteId) {
  return state.sites.find((site) => site.id === siteId);
}

function rowsFor(key, siteId) {
  return (state[key] ?? []).filter((row) => row.siteId === siteId);
}

function activeRowsFor(key, siteId) {
  return rowsFor(key, siteId).filter((row) => row.status !== "inactive");
}

function effectiveDataForSite(siteId) {
  const site = siteById(siteId);
  return {
    branding: site?.branding ?? {},
    pages: site?.pages ?? [],
    products: rowsFor("products", siteId),
    siteAiApps: rowsFor("siteAiApps", siteId),
    themeSettings: site?.themeSettings,
    siteThemes: rowsFor("siteThemes", siteId),
    themePublications: rowsFor("themePublications", siteId),
    creativePackCategories: activeRowsFor("creativePackCategories", siteId),
    creativePacks: activeRowsFor("creativePacks", siteId),
    toolCategories: activeRowsFor("toolCategories", siteId),
    toolMenuItems: activeRowsFor("toolMenuItems", siteId),
    videoThemeCategories: activeRowsFor("videoThemeCategories", siteId),
    videoThemes: activeRowsFor("videoThemes", siteId),
    mediaAssets: rowsFor("mediaAssets", siteId)
  };
}

function stripAssetVersion(value) {
  return String(value).split("?")[0].split("#")[0];
}

function localFileForAssetUrl(value) {
  return path.join(publicRoot, stripAssetVersion(value).replace(/^\/+/, ""));
}

function collectAssetUrls(value, urls = new Set()) {
  if (typeof value === "string") {
    for (const part of value.split("|")) {
      const trimmed = part.trim();
      if (/^\/assets\/.+\.(?:png|jpe?g|webp|avif|svg|mp4)(?:\?|$)/i.test(trimmed)) urls.add(trimmed);
    }
    for (const match of value.matchAll(/\/assets\/[^"'|<> )]+\.(?:png|jpe?g|webp|avif|svg|mp4)(?:\?[^"'|<> )]+)?/gi)) {
      urls.add(match[0]);
    }
    return urls;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAssetUrls(item, urls));
    return urls;
  }
  if (!value || typeof value !== "object") return urls;
  Object.values(value).forEach((item) => collectAssetUrls(item, urls));
  return urls;
}

function requireText(text, pattern, label) {
  if (!pattern.test(text)) fail(`missing_theme_signal:${label}:${pattern}`);
}

function collectionSlugsForFeaturedSection(section) {
  return (section?.blocks ?? [])
    .filter((block) => block?.type === "seasonal_image")
    .map((block) => String(block?.settings?.collectionSlug ?? "").trim());
}

function requireHomeFeaturedPacks(data, siteId, checks) {
  const homePage = data.pages.find((page) => page.slug === "/" || page.pageType === "home");
  const pageJson = homePage?.publishedJson;
  const order = pageJson?.sectionsOrder ?? [];
  const featuredOrder = order.filter((id) => id.startsWith("featured_"));
  if (JSON.stringify(featuredOrder) !== JSON.stringify(expectedFeaturedOrder)) {
    fail(`${siteId}_featured_pack_order:${featuredOrder.join(",")}`);
  }
  for (const id of expectedFeaturedOrder) {
    if (pageJson?.sections?.[id]?.type !== "dreamshoot_featured_pack") fail(`${siteId}_missing_featured_pack:${id}`);
  }
  for (const check of checks) {
    const section = pageJson?.sections?.[check.id] ?? {};
    const raw = JSON.stringify(section);
    for (const phrase of check.requiredPhrases) {
      if (!raw.includes(phrase)) fail(`${siteId}_${check.id}_missing_phrase:${phrase}`);
    }
    for (const asset of check.requiredAssets) {
      if (!raw.includes(asset)) fail(`${siteId}_${check.id}_missing_asset:${asset}`);
    }
    for (const forbidden of check.forbiddenPatterns ?? []) {
      if (forbidden.test(raw)) fail(`${siteId}_${check.id}_forbidden_asset_or_copy:${forbidden}`);
    }
    if (check.collectionSlugs) {
      const actual = collectionSlugsForFeaturedSection(section);
      if (actual.join("|") !== check.collectionSlugs.join("|")) {
        fail(`${siteId}_${check.id}_collection_slug_order:${actual.join("|")}`);
      }
      if (actual.some((slug) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || /^https?:|\/collections\//i.test(slug))) {
        fail(`${siteId}_${check.id}_collection_slug_not_stable:${actual.join("|")}`);
      }
    }
  }
}

function requirePublishedSnapshotFeaturedPacks(data, siteId) {
  for (const publication of data.themePublications) {
    const homeSnapshot = publication.snapshot?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
    const pageJson = homeSnapshot?.publishedJson ?? homeSnapshot?.draftJson;
    const featuredOrder = (pageJson?.sectionsOrder ?? []).filter((id) => String(id).startsWith("featured_"));
    if (JSON.stringify(featuredOrder) !== JSON.stringify(expectedFeaturedOrder)) {
      fail(`${siteId}_publication_featured_pack_order:${publication.id}:${featuredOrder.join(",")}`);
    }
    for (const id of expectedFeaturedOrder) {
      if (pageJson?.sections?.[id]?.type !== "dreamshoot_featured_pack") {
        fail(`${siteId}_publication_missing_featured_pack:${publication.id}:${id}`);
      }
    }
  }
}

function requireSeo(page, siteId) {
  const seo = page?.publishedJson?.seo ?? page?.draftJson?.seo;
  if (!seo) {
    fail(`missing_seo:${siteId}:${page.slug}`);
    return;
  }
  if (!String(seo.title ?? "").trim()) fail(`missing_seo_title:${siteId}:${page.slug}`);
  if (!String(seo.description ?? "").trim()) fail(`missing_seo_description:${siteId}:${page.slug}`);
  if (!String(seo.canonicalPath ?? "").trim()) fail(`missing_seo_canonical:${siteId}:${page.slug}`);
  if (!String(seo.ogImage ?? "").trim()) fail(`missing_seo_og_image:${siteId}:${page.slug}`);
}

const aidreamcapesData = effectiveDataForSite(aidreamcapesSiteId);
const mydreamshootsData = effectiveDataForSite(mydreamshootsSiteId);
const aidreamcapesText = JSON.stringify(
  {
    ...aidreamcapesData,
    pages: aidreamcapesData.pages.filter((page) => !/-video-theme-guide$/i.test(page.slug)),
    siteThemes: [],
    themePublications: [],
    // Aidreamcapes keeps its travel video showcase; that content has its own regression suite.
    videoThemeCategories: [],
    videoThemes: []
  },
  (key, value) => {
    if (key === "generation_showcase_1") return undefined;
    if (/blog_video-theme_.*_video_theme_guide/i.test(key)) return undefined;
    if (/-video-theme-guide$/i.test(value?.slug ?? "")) return undefined;
    if (/-video-theme-guide$/i.test(value?.canonicalPath ?? "")) return undefined;
    return value;
  }
);
const mydreamshootsText = JSON.stringify(mydreamshootsData);

requireHomeFeaturedPacks(mydreamshootsData, mydreamshootsSiteId, [
  {
    id: "featured_christmas_1",
    requiredPhrases: ["Christmas group photos for cards, posts, and private albums.", "Create Christmas Photos", "/collections/christmas-photos"],
    collectionSlugs: ["christmas-photos", "christmas-photos", "christmas-couple", "christmas-photos", "christmas-photos", "christmas-couple"],
    requiredAssets: [
      "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-06.webp",
      "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-07.webp",
      "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-04.webp",
      "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-08.webp",
      "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-05.webp",
      "/assets/dreamshoot/generated/pack-covers/christmas-photos/christmas-photos-cover.webp"
    ],
    forbiddenPatterns: [/\/assets\/sites\/site_aidreamcapes\//i]
  },
  {
    id: "featured_thanksgiving_1",
    requiredPhrases: ["Thanksgiving group photos for warm private albums.", "Create Thanksgiving Photos", "/collections/thanksgiving-group-photos"],
    collectionSlugs: ["thanksgiving-group-photos", "thanksgiving-group-photos", "thanksgiving-group-photos", "thanksgiving-group-photos", "thanksgiving-group-photos", "thanksgiving-group-photos"],
    requiredAssets: [
      "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-05.webp",
      "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-06.webp",
      "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-07.webp",
      "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-08.webp",
      "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-09.webp",
      "/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"
    ],
    forbiddenPatterns: [/\/assets\/sites\/site_aidreamcapes\//i]
  }
]);

requireHomeFeaturedPacks(aidreamcapesData, aidreamcapesSiteId, [
  {
    id: "featured_christmas_1",
    requiredPhrases: ["Build a private Christmas album around the people in your own photos.", "Create a Christmas album", "/collections/christmas-holiday-albums"],
    collectionSlugs: ["christmas-group-albums", "christmas-holiday-albums", "christmas-group-albums", "winter-fan-greeting-albums", "christmas-group-albums", "christmas-holiday-albums"],
    requiredAssets: [
      "/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/christmas-group-album.webp",
      "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/christmas-holiday-albums.webp"
    ],
    forbiddenPatterns: [/\/assets\/dreamshoot\//i, /MyDreamShoots/i]
  },
  {
    id: "featured_thanksgiving_1",
    requiredPhrases: ["Turn a gathering table into a permission-safe Thanksgiving keepsake set.", "Create a Thanksgiving set", "/collections/thanksgiving-memory-sets"],
    collectionSlugs: ["thanksgiving-table-keepsakes", "thanksgiving-memory-sets", "gratitude-group-portraits", "friendsgiving-memory-sets", "thanksgiving-table-keepsakes", "thanksgiving-memory-sets"],
    requiredAssets: [
      "/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/thanksgiving-keepsake-table-set.webp",
      "/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/thanksgiving-memory-sets.webp"
    ],
    forbiddenPatterns: [/\/assets\/dreamshoot\//i, /MyDreamShoots/i]
  }
]);
requirePublishedSnapshotFeaturedPacks(mydreamshootsData, mydreamshootsSiteId);
requirePublishedSnapshotFeaturedPacks(aidreamcapesData, aidreamcapesSiteId);

const aidreamcapesRootRows = aidreamcapesData.creativePackCategories.filter((category) => !category.parentId && aidreamcapesRootCategories.includes(category.slug));
const aidreamcapesChildRows = aidreamcapesData.creativePackCategories.filter((category) => category.parentId && aidreamcapesNewCategories.includes(category.slug));
if (aidreamcapesRootRows.length !== 7) fail(`aidreamcapes_root_category_count:${aidreamcapesRootRows.length}`);
if (aidreamcapesChildRows.length !== 20) fail(`aidreamcapes_child_category_count:${aidreamcapesChildRows.length}`);

for (const categorySlug of aidreamcapesRootCategories) {
  if (!aidreamcapesData.creativePackCategories.some((category) => category.slug === categorySlug && !category.parentId)) fail(`missing_aidreamcapes_root_category:${categorySlug}`);
  if (!aidreamcapesText.includes(`/collections/${categorySlug}`)) fail(`missing_aidreamcapes_root_collection_link:${categorySlug}`);
}

for (const categorySlug of aidreamcapesNewCategories) {
  const category = aidreamcapesData.creativePackCategories.find((row) => row.slug === categorySlug);
  if (!category) fail(`missing_aidreamcapes_category:${categorySlug}`);
  if (category && !category.parentId) fail(`aidreamcapes_child_category_missing_parent:${categorySlug}`);
}

if (new Set(aidreamcapesData.creativePackCategories.map((category) => category.slug)).size !== aidreamcapesData.creativePackCategories.length) {
  fail("aidreamcapes_duplicate_category_slug");
}
if (new Set(aidreamcapesData.creativePackCategories.map((category) => category.imageUrl).filter(Boolean)).size !== aidreamcapesData.creativePackCategories.filter((category) => category.imageUrl).length) {
  fail("aidreamcapes_duplicate_category_image_url");
}

for (const toolSlug of aidreamcapesNewTools) {
  if (!aidreamcapesData.toolMenuItems.some((tool) => tool.slug === toolSlug || tool.href === `/tools/${toolSlug}`)) fail(`missing_aidreamcapes_tool:${toolSlug}`);
  if (!aidreamcapesData.pages.some((page) => page.slug === `/tools/${toolSlug}`)) fail(`missing_aidreamcapes_tool_page:${toolSlug}`);
}
if (aidreamcapesData.toolMenuItems.length < 20) fail(`aidreamcapes_tool_count:${aidreamcapesData.toolMenuItems.length}`);

for (const blogPath of aidreamcapesNewBlogs) {
  if (!aidreamcapesData.pages.some((page) => page.slug === blogPath)) fail(`missing_aidreamcapes_blog_page:${blogPath}`);
}

requireText(aidreamcapesText, /fan-scene/i, "aidreamcapes_fan_scene");
requireText(aidreamcapesText, /game-day/i, "aidreamcapes_game_day");
requireText(aidreamcapesText, /premiere/i, "aidreamcapes_premiere");
requireText(aidreamcapesText, /Christmas/i, "aidreamcapes_christmas");
requireText(aidreamcapesText, /Thanksgiving/i, "aidreamcapes_thanksgiving");
requireText(aidreamcapesText, /Halloween/i, "aidreamcapes_halloween");
requireText(aidreamcapesText, /seasonal/i, "aidreamcapes_seasonal");

requireText(mydreamshootsText, /sports fan photos|World Cup fan photos|game-day/i, "mydreamshoots_sports");
requireText(mydreamshootsText, /celebrity-style|fan meetup|VIP-style|red-carpet/i, "mydreamshoots_star_vip");
requireText(mydreamshootsText, /Christmas/i, "mydreamshoots_christmas");
requireText(mydreamshootsText, /Thanksgiving/i, "mydreamshoots_thanksgiving");
requireText(mydreamshootsText, /Halloween/i, "mydreamshoots_halloween");

for (const pattern of aidreamcapesLegacyPatterns) {
  if (pattern.test(aidreamcapesText)) fail(`aidreamcapes_legacy_theme_residual:${pattern}`);
}

if (/MyDreamShoots|DreamShootAI|support@mydreamshoots\.com|\/assets\/dreamshoot\//i.test(aidreamcapesText)) {
  fail("aidreamcapes_brand_or_asset_leak_from_mydreamshoots");
}
if (/Aidreamcapes|support@aidreamcapes\.com|\/assets\/sites\/site_aidreamcapes\//i.test(mydreamshootsText)) {
  fail("mydreamshoots_brand_or_asset_leak_from_aidreamcapes");
}

for (const page of aidreamcapesData.pages) {
  requireSeo(page, aidreamcapesSiteId);
  if (/-video-theme-guide$/i.test(page.slug)) continue;
  const seo = page.publishedJson?.seo ?? {};
  const canonicalPath = String(seo.canonicalPath ?? "");
  if (aidreamcapesLegacyPatterns.some((pattern) => pattern.test(canonicalPath))) {
    fail(`aidreamcapes_legacy_canonical:${page.slug}:${canonicalPath}`);
  }
}

for (const url of collectAssetUrls(aidreamcapesData)) {
  if (!url.startsWith("/assets/sites/site_aidreamcapes/")) fail(`aidreamcapes_non_owned_asset:${url}`);
  if (url.startsWith("/assets/dreamshoot/")) fail(`aidreamcapes_dreamshoot_asset:${url}`);
  if (!fs.existsSync(localFileForAssetUrl(url))) fail(`missing_aidreamcapes_asset:${url}`);
}

for (const url of collectAssetUrls(mydreamshootsData)) {
  if (url.startsWith("/assets/sites/site_aidreamcapes/")) fail(`mydreamshoots_aidreamcapes_asset:${url}`);
  if (/^\/assets\//.test(url) && !fs.existsSync(localFileForAssetUrl(url))) fail(`missing_mydreamshoots_asset:${url}`);
}

for (const pack of aidreamcapesData.creativePacks) {
  if ((pack.galleryImages?.length ?? 0) < 12) fail(`aidreamcapes_pack_missing_12_gallery:${pack.slug ?? pack.id}:${pack.galleryImages?.length ?? 0}`);
  if ((pack.galleryImageAlts?.length ?? 0) < 12) fail(`aidreamcapes_pack_missing_12_gallery_alts:${pack.slug ?? pack.id}:${pack.galleryImageAlts?.length ?? 0}`);
  const meaningfulAlts = (pack.galleryImageAlts ?? []).map((alt) => String(alt ?? "").trim()).filter(Boolean);
  if (meaningfulAlts.length >= 12 && new Set(meaningfulAlts).size < 8) fail(`aidreamcapes_pack_repetitive_gallery_alts:${pack.slug ?? pack.id}`);
  const cardImageCandidates = [pack.imageUrl, ...(pack.galleryImages ?? []).slice(0, 2)].filter(Boolean);
  if (new Set(cardImageCandidates).size !== cardImageCandidates.length) fail(`aidreamcapes_pack_duplicate_card_candidate_image:${pack.slug ?? pack.id}`);
}

for (const asset of aidreamcapesData.mediaAssets) {
  if (!String(asset.altText ?? "").trim()) fail(`aidreamcapes_media_missing_alt:${asset.storageKey ?? asset.id}`);
}

if (failures.length) {
  console.error("Fan and holiday storefront theme smoke failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  aidreamcapes: {
    categories: aidreamcapesData.creativePackCategories.length,
    packs: aidreamcapesData.creativePacks.length,
    tools: aidreamcapesData.toolMenuItems.length,
    videoThemes: aidreamcapesData.videoThemes.length,
    pages: aidreamcapesData.pages.length,
    assetRefs: collectAssetUrls(aidreamcapesData).size
  },
  mydreamshoots: {
    pages: mydreamshootsData.pages.length,
    assetRefs: collectAssetUrls(mydreamshootsData).size
  }
}, null, 2));
