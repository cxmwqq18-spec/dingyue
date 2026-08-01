#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  localShowcaseImagePath,
  localShowcasePosterPath,
  localShowcaseVideoPath,
  showcaseImageThemesForStore,
  showcaseStores
} from "./dreamshoot-homepage-showcase-data.mjs";

const repoRoot = process.cwd();
const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data", "platform-state.json"), "utf8"));
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function siteForStore(store) {
  return (state.sites ?? []).find((site) => site.id === store.siteId || site.slug === store.siteSlug);
}

function assertOrder(order, label) {
  const packageIndex = order.indexOf("package_catalog_1");
  const showcaseIndex = order.indexOf("generation_showcase_1");
  const workflowIndex = order.indexOf("flow_bridge_1");
  assert(packageIndex >= 0, `${label}: missing package_catalog_1`);
  assert(showcaseIndex >= 0, `${label}: missing generation_showcase_1`);
  assert(workflowIndex >= 0, `${label}: missing flow_bridge_1`);
  assert(packageIndex < showcaseIndex, `${label}: showcase should follow package catalog`);
  assert(showcaseIndex < workflowIndex, `${label}: showcase should precede workflow`);
}

function assertPage(pageJson, label) {
  assert(pageJson?.sections?.generation_showcase_1?.type === "dreamshoot_generation_showcase", `${label}: wrong showcase section type`);
  assertOrder(pageJson?.sectionsOrder ?? [], label);
  const settings = pageJson?.sections?.generation_showcase_1?.settings ?? {};
  assert(String(settings.imageSlugs ?? "").split("|").filter(Boolean).length === 8, `${label}: expected 8 image slugs`);
  assert(String(settings.videoSlugs ?? "").split("|").filter(Boolean).length === 8, `${label}: expected 8 video slugs`);
  assert(settings.primaryHref === "/login", `${label}: primary CTA should stay customer-safe`);
}

function assetUrlsFromValue(value, urls = []) {
  if (typeof value === "string") {
    for (const part of value.split("|")) {
      const url = part.trim();
      if (url.startsWith("/assets/")) urls.push(url);
    }
    return urls;
  }
  if (!value || typeof value !== "object") return urls;
  if (Array.isArray(value)) {
    for (const item of value) assetUrlsFromValue(item, urls);
    return urls;
  }
  for (const item of Object.values(value)) assetUrlsFromValue(item, urls);
  return urls;
}

function assertMydreamshootsHomepageAssets(pageJson, label) {
  const assetUrls = [...new Set(assetUrlsFromValue(pageJson))];
  assert(assetUrls.length > 0, `${label}: expected homepage image assets`);
  for (const url of assetUrls) {
    const pathname = url.split("?")[0];
    const assetFile = path.resolve(repoRoot, "public", `.${pathname}`);
    assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing homepage image asset ${assetFile}`);
  }
}

function imageSlugsForPage(pageJson) {
  return String(pageJson?.sections?.generation_showcase_1?.settings?.imageSlugs ?? "")
    .split("|")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

function assertMydreamshootsImageSlugPriority(pageJson, label) {
  const slugs = imageSlugsForPage(pageJson);
  const expected = [
    "world-cup-fan-photos",
    "christmas-couple",
    "christmas-photos",
    "creator-portraits",
    "gala-photos",
    "holiday",
    "professional-headshots",
    "cyberpunk"
  ];
  assert(slugs.join("|") === expected.join("|"), `${label}: MyDreamShoots showcase image slugs drifted: ${slugs.join("|")}`);
  assert(!slugs.includes("thanksgiving-group-photos"), `${label}: Thanksgiving should stay out of showcase image front row until a dedicated clear asset exists`);
  assert(!slugs.includes("halloween-party-photos"), `${label}: Halloween should stay out of showcase image front row until a dedicated clear asset exists`);
}

for (const store of showcaseStores) {
  const site = siteForStore(store);
  assert(site, `${store.key}: site missing from platform state`);
  const home = site?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
  assert(home, `${store.key}: home page missing`);
  assertPage(home?.draftJson, `${store.key}: draft home`);
  assertPage(home?.publishedJson, `${store.key}: published home`);
  if (store.key === "mydreamshoots") {
    assertMydreamshootsImageSlugPriority(home?.draftJson, `${store.key}: draft home`);
    assertMydreamshootsImageSlugPriority(home?.publishedJson, `${store.key}: published home`);
    assertMydreamshootsHomepageAssets(home?.draftJson, `${store.key}: draft home`);
    assertMydreamshootsHomepageAssets(home?.publishedJson, `${store.key}: published home`);
    assert(store.imageSlugs.join("|") === imageSlugsForPage(home?.publishedJson).join("|"), `${store.key}: showcase seed and published page image slug order differ`);
  }

  for (const theme of (state.siteThemes ?? []).filter((item) => item.siteId === store.siteId)) {
    const template = theme.templates?.index;
    assert(template?.sections?.generation_showcase_1?.type === "dreamshoot_generation_showcase", `${store.key}: site theme ${theme.id} missing showcase`);
    assertOrder(template?.content_for_page ?? [], `${store.key}: site theme ${theme.id}`);
    if (store.key === "mydreamshoots") {
      assertMydreamshootsImageSlugPriority({ sections: { generation_showcase_1: template?.sections?.generation_showcase_1 } }, `${store.key}: site theme ${theme.id}`);
      assertMydreamshootsHomepageAssets(template, `${store.key}: site theme ${theme.id}`);
    }
  }

  for (const publication of (state.themePublications ?? []).filter((item) => item.siteId === store.siteId)) {
    const snapshotHome = publication.snapshot?.pages?.find((page) => page.slug === "/")?.publishedJson;
    assertPage(snapshotHome, `${store.key}: publication ${publication.version}`);
    if (store.key === "mydreamshoots") {
      assertMydreamshootsImageSlugPriority(snapshotHome, `${store.key}: publication ${publication.version}`);
      assertMydreamshootsHomepageAssets(snapshotHome, `${store.key}: publication ${publication.version}`);
    }
  }

  const categories = (state.videoThemeCategories ?? []).filter((category) => category.siteId === store.siteId);
  const themes = (state.videoThemes ?? []).filter((theme) => theme.siteId === store.siteId);
  assert(categories.length >= store.videoCategories.length, `${store.key}: missing video theme categories`);
  assert(themes.length >= store.videoThemes.length, `${store.key}: missing video themes`);

  for (const imageSeed of showcaseImageThemesForStore(store)) {
    const imageFile = path.resolve(repoRoot, localShowcaseImagePath(store, imageSeed.slug));
    assert(fs.existsSync(imageFile) && fs.statSync(imageFile).size > 1000, `${store.key}: missing AI-generated showcase image ${imageFile}`);
  }

  for (const themeSeed of store.videoThemes) {
    const theme = themes.find((item) => item.slug === themeSeed.slug);
    assert(theme, `${store.key}: missing theme ${themeSeed.slug}`);
    assert(theme?.imageUrl?.includes("/posters/"), `${store.key}: ${themeSeed.slug} missing poster imageUrl`);
    assert((theme?.galleryImages ?? []).some((item) => /\.mp4(?:\?|$)/.test(item)), `${store.key}: ${themeSeed.slug} missing mp4 gallery asset`);
    const posterFile = path.resolve(repoRoot, localShowcasePosterPath(store, themeSeed.slug));
    const videoFile = path.resolve(repoRoot, localShowcaseVideoPath(store, themeSeed.slug));
    assert(fs.existsSync(posterFile) && fs.statSync(posterFile).size > 0, `${store.key}: missing poster file ${posterFile}`);
    assert(fs.existsSync(videoFile) && fs.statSync(videoFile).size > 1000, `${store.key}: missing video file ${videoFile}`);
  }
}

const videoHashes = new Map();
for (const store of showcaseStores) {
  for (const themeSeed of store.videoThemes) {
    const videoFile = path.resolve(repoRoot, localShowcaseVideoPath(store, themeSeed.slug));
    if (!fs.existsSync(videoFile)) continue;
    const hash = crypto.createHash("sha256").update(fs.readFileSync(videoFile)).digest("hex");
    const key = `${store.key}:${themeSeed.slug}`;
    videoHashes.set(hash, [...(videoHashes.get(hash) ?? []), key]);
  }
}
for (const [hash, keys] of videoHashes.entries()) {
  assert(keys.length === 1, `duplicate homepage showcase video ${hash.slice(0, 16)}: ${keys.join(", ")}`);
}

const storefrontRender = fs.readFileSync(path.join(repoRoot, "src/lib/storefront-render.tsx"), "utf8");
assert(storefrontRender.includes("prompt: \"\""), "storefront lazy payload should redact video theme prompts");
assert(storefrontRender.includes("videoThemes: needsVideoThemes ? trimVideoThemesForStorefront"), "storefront lazy payload should request video themes only for showcase sections");
assert(storefrontRender.includes("pageSectionTypes(pageJson).has(\"dreamshoot_generation_showcase\") && !pageRenderData.videoThemes.length"), "full storefront page render should recover public showcase video themes when the lean runtime state omits them");
assert(storefrontRender.includes("loadStorefrontPublicVideoThemesForSection(currentSite, renderData.videoThemes, 32)"), "full storefront page render should use the cached public video theme reader for the homepage showcase fallback");

const themeRenderer = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
const showcaseRenderer = themeRenderer.match(/if \(section\.type === "dreamshoot_generation_showcase"\)[\s\S]*?if \(section\.type === "dreamshoot_featured_pack"\)/)?.[0] ?? "";
assert(showcaseRenderer.includes("dreamshoot-showcase-track"), "showcase should render horizontal showcase rails");
assert(showcaseRenderer.includes("DreamshootShowcaseRail"), "showcase rails should auto-scroll without duplicating card data");
assert(showcaseRenderer.includes("<figure"), "showcase material cards should render as display-only figures");
assert(showcaseRenderer.includes("dreamshootShowcaseImagePath"), "showcase images should use dedicated AI-generated homepage image assets");
assert(themeRenderer.includes('dreamshootHomepageShowcaseVersion = "20260801visualfix1"'), "showcase image URLs should use the 20260801visualfix1 cache-busting version");
assert(showcaseRenderer.includes("StorefrontNaturalImage"), "showcase image cards should render natural-height images instead of fixed square shells");
assert(showcaseRenderer.includes("alt={`${card.meta} customer-created image example"), "showcase images should have customer-created alt text");
assert(showcaseRenderer.includes('fetchPriority={card.index < 4 ? "high" : "low"}'), "showcase should prioritize initially visible image cards");
assert(showcaseRenderer.includes('loading={card.index < 4 ? "eager" : "lazy"}'), "showcase should eagerly load initially visible image cards");
assert(showcaseRenderer.includes("DreamshootShowcaseVideo"), "showcase videos should render through the autoplay client component");
assert(showcaseRenderer.includes("priority={card.index < 4}"), "showcase should eagerly prepare initially visible motion cards");
assert(!showcaseRenderer.includes("autoLoad={railIndex"), "showcase videos must not leave most rail cards poster-only behind an index gate");
assert(showcaseRenderer.includes("customer-created video example"), "showcase videos should have accessible labels");
assert(!showcaseRenderer.includes("[...imageCards, ...imageCards]"), "showcase image rail must not duplicate the data array");
assert(!showcaseRenderer.includes("[...videoCards, ...videoCards]"), "showcase video rail must not duplicate the data array");
assert(!showcaseRenderer.includes("dreamshoot-showcase-marquee"), "showcase rails should not use duplicated marquee animation");
assert(!showcaseRenderer.includes("mask-image"), "showcase rails should not use white edge fade masks");
assert(!showcaseRenderer.includes("href: \"/tools/image-to-video\""), "showcase videos should not link to the workspace tool");
assert(!showcaseRenderer.includes("href={hrefFor(site, card.href)}"), "showcase material cards should not be wrapped in internal links");
assert(!showcaseRenderer.includes("Make a clip"), "showcase material cards should not show workspace CTAs");

const showcaseVideoComponent = fs.readFileSync(path.join(repoRoot, "src/components/storefront/dreamshoot-showcase-video.tsx"), "utf8");
assert(showcaseVideoComponent.includes("priority?: boolean") && showcaseVideoComponent.includes("initialShouldLoad = priority"), "showcase video component should support priority eager loading for initially visible cards");
assert(showcaseVideoComponent.includes("video.play()"), "showcase video component should actively start muted playback");
assert(showcaseVideoComponent.includes("IntersectionObserver"), "showcase video component should play videos when the showcase rail is near the viewport");
assert(showcaseVideoComponent.includes("autoPlay={shouldLoad}") && showcaseVideoComponent.includes("loop") && showcaseVideoComponent.includes("muted") && showcaseVideoComponent.includes("playsInline"), "showcase video component should keep gated autoplay attributes");
assert(showcaseVideoComponent.includes('preload={shouldLoad ? "auto" : "none"}') && showcaseVideoComponent.includes("src={shouldLoad ? src : undefined}"), "showcase video component should keep mp4 requests gated until the video rail is near the viewport");
assert(showcaseVideoComponent.includes("SHOWCASE_VIDEO_LOAD_DELAY_MS") && showcaseVideoComponent.includes('rootMargin: "360px 0px"'), "showcase video component should give the rail enough lead time to load and start playback");
assert(showcaseVideoComponent.includes('closest(".dreamshoot-showcase-rail")'), "showcase video component should observe the rail instead of individual horizontally scrolling cards");

const generatorScript = fs.readFileSync(path.join(repoRoot, "scripts/generate-dreamshoot-homepage-videos.mjs"), "utf8");
assert(generatorScript.includes("/v1/videos"), "showcase video generation should call internal video providers");
assert(generatorScript.includes("grok-imagine-video"), "showcase video generation should use internal Grok image-to-video models");
assert(generatorScript.includes("duplicate_video_hash"), "showcase video generation should reject duplicate provider outputs");
assert(generatorScript.includes("normalizeShowcaseVideoBytes") && generatorScript.includes("scale=720:720"), "showcase video generation should normalize provider videos to square playback assets");
assert(!generatorScript.includes("-loop") && !generatorScript.includes("createMotionClip"), "showcase video generation should not synthesize static ffmpeg clips");

const siteStore = fs.readFileSync(path.join(repoRoot, "src/lib/stores/site-store.ts"), "utf8");
assert(siteStore.includes("existingGalleryImages.length ? existingGalleryImages : [theme.imageUrl]"), "default video theme seeding should preserve existing showcase mp4 gallery assets");

const imageGeneratorScript = fs.readFileSync(path.join(repoRoot, "scripts/generate-dreamshoot-homepage-images.mjs"), "utf8");
assert(imageGeneratorScript.includes("/images/generations"), "showcase image generation should call configured image providers");
assert(imageGeneratorScript.includes("gpt-image-2"), "showcase image generation should default to the internal gpt-image-2 provider");

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, stores: showcaseStores.map((store) => store.key) }, null, 2));
