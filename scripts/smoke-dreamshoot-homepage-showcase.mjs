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
const expectedHomeOrder = [
  "hero_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "package_catalog_1",
  "proof_1",
  "pricing_1",
  "faq_1",
  "brand_strip_1",
  "conversion_1"
];
const removedHomeSections = [
  "visual_proof_1",
  "featured_pack_1",
  "featured_christmas_1",
  "featured_thanksgiving_1",
  "flow_bridge_1",
  "trust_1"
];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function siteForStore(store) {
  return (state.sites ?? []).find((site) => site.id === store.siteId || site.slug === store.siteSlug);
}

function showcaseSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function activeCreativePacksForSite(site) {
  return (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id && pack.status === "active");
}

function activeCreativePackCategoriesForSite(site) {
  return (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id && category.status === "active");
}

function expectedShowcaseImageSources(store, site) {
  if (store.key === "aidreamcapes") return activeCreativePackCategoriesForSite(site);
  return activeCreativePacksForSite(site);
}

function assertShowcaseImageSourceData(store, site) {
  const sources = expectedShowcaseImageSources(store, site);
  const expectedFirstRow = Math.ceil(sources.length / 2);
  const expectedSecondRow = Math.floor(sources.length / 2);
  assert(sources.length > 0, `${store.key}: expected dynamic showcase image sources`);
  assert(expectedFirstRow + expectedSecondRow === sources.length, `${store.key}: invalid dynamic image split`);
  assert(expectedFirstRow >= expectedSecondRow, `${store.key}: first image row should be the same size or one larger`);
  if (store.key === "aidreamcapes") {
    const activePacks = activeCreativePacksForSite(site);
    for (const category of sources) {
      const categorySlug = showcaseSlug(category.slug || category.label);
      const relatedPacks = activePacks.filter((pack) =>
        [pack.categoryRecord?.id, pack.categoryRecord?.parent?.id].filter(Boolean).some((value) => String(value) === category.id) ||
        [pack.categoryRecord?.slug, pack.categoryRecord?.parent?.slug, pack.category, pack.name].filter(Boolean).map(showcaseSlug).includes(categorySlug)
      );
      assert(relatedPacks.length > 0, `${store.key}: category ${category.slug} should have a related active pack for alternate showcase art`);
      assert((relatedPacks[0]?.galleryImages ?? []).length >= 3, `${store.key}: category ${category.slug} needs at least three gallery images for non-cover showcase art`);
    }
    return;
  }
  for (const pack of sources) {
    assert((pack.galleryImages ?? []).length >= 3, `${store.key}: pack ${pack.name} needs at least three gallery images for non-cover showcase art`);
    const selected = pack.galleryImages?.[2] ?? "";
    assert(selected && selected !== pack.imageUrl, `${store.key}: pack ${pack.name} showcase image should not reuse the package cover`);
  }
}

function assertOrder(order, label) {
  assert(Array.isArray(order), `${label}: sections order should be an array`);
  assert(order.join("|") === expectedHomeOrder.join("|"), `${label}: unexpected homepage order ${order.join("|")}`);
  for (const sectionId of removedHomeSections) {
    assert(!order.includes(sectionId), `${label}: obsolete homepage section still ordered: ${sectionId}`);
  }
}

function assertPage(pageJson, label) {
  assert(pageJson?.sections?.generation_showcase_1?.type === "dreamshoot_generation_showcase", `${label}: wrong showcase section type`);
  assert(pageJson?.sections?.tutorial_video_1?.type === "video_feature", `${label}: missing tutorial video section`);
  assert(pageJson?.sections?.proof_1?.type === "testimonial_wall", `${label}: wrong review section type`);
  assert(pageJson?.sections?.proof_1?.settings?.mode === "reviews", `${label}: testimonial wall should render customer reviews`);
  assert((pageJson?.sections?.proof_1?.blocks ?? []).length >= 6, `${label}: expected at least 6 review cards`);
  assert((pageJson?.sections?.faq_1?.blocks ?? []).length >= 12, `${label}: expected expanded FAQ content`);
  assert(pageJson?.sections?.brand_strip_1?.type === "brand_logo_strip", `${label}: missing partner trust strip after FAQ`);
  for (const sectionId of removedHomeSections) {
    assert(!pageJson?.sections?.[sectionId], `${label}: obsolete homepage section still present: ${sectionId}`);
  }
  assertOrder(pageJson?.sectionsOrder ?? [], label);
  const settings = pageJson?.sections?.generation_showcase_1?.settings ?? {};
  assert(String(settings.videoSlugs ?? "").split("|").filter(Boolean).length === 8, `${label}: expected 8 video slugs`);
  assert(Number(settings.videoItemLimit ?? 0) === 8, `${label}: expected 8 video showcase items`);
  assert(!("itemLimit" in settings), `${label}: old image-limiting itemLimit should be removed`);
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
  assertShowcaseImageSourceData(store, site);
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
const imageShowcaseRenderer = showcaseRenderer.match(/<div className="mt-10">[\s\S]*?<div className="mt-12">/)?.[0] ?? "";
const videoShowcaseRenderer = showcaseRenderer.match(/<div className="mt-12">[\s\S]*?<\/DreamshootShowcasePreview>/)?.[0] ?? "";
const videoFeatureRenderer = themeRenderer.match(/if \(section\.type === "video_feature"\)[\s\S]*?if \(section\.type === "luxury_highlight"\)/)?.[0] ?? "";
const testimonialRenderer = themeRenderer.match(/if \(section\.type === "testimonial_wall"\)[\s\S]*?if \(section\.type === "faq"\)/)?.[0] ?? "";
assert(videoFeatureRenderer.includes('setting(section, "videoUrl", "")') && videoFeatureRenderer.includes("<video"), "tutorial video feature should render a real videoUrl when configured");
assert(videoFeatureRenderer.includes("poster={image || undefined}") && videoFeatureRenderer.includes("preload=\"metadata\""), "tutorial video feature should keep poster fallback and metadata loading");
assert(showcaseRenderer.includes("dreamshoot-showcase-track"), "showcase should render horizontal showcase rails");
assert(showcaseRenderer.includes("DreamshootShowcaseRail"), "showcase rails should auto-scroll without duplicating card data");
assert(showcaseRenderer.includes("<figure"), "showcase material cards should render as figures");
assert(showcaseRenderer.includes("DreamshootShowcasePreview"), "showcase material cards should open an image/video preview lightbox");
assert(showcaseRenderer.includes('data-dreamshoot-showcase-preview="image"'), "showcase image cards should be clickable preview triggers");
assert(showcaseRenderer.includes('data-dreamshoot-showcase-preview="video"'), "showcase video cards should be clickable preview triggers");
assert(themeRenderer.includes("dreamshootShowcaseImagePath"), "showcase images should keep dedicated AI-generated homepage fallback assets");
assert(themeRenderer.includes('dreamshootHomepageShowcaseVersion = "20260801visualfix1"'), "showcase image URLs should use the 20260801visualfix1 cache-busting version");
assert(showcaseRenderer.includes("generationShowcaseImageCardsForSite(site, creativePacks, creativePackCategories, selectedImageSlugs)"), "showcase images should come from each store's dynamic theme source list");
assert(showcaseRenderer.includes("Math.ceil(imageCards.length / 2)"), "showcase images should split dynamically with the first row taking the odd extra card");
assert(imageShowcaseRenderer.includes("imageRailRows.map"), "showcase image cards should render in two dynamic rows");
assert(imageShowcaseRenderer.includes("aspect-[3/4]") && imageShowcaseRenderer.includes("md:w-[clamp(24rem,25vw,34rem)]"), "showcase image cards should use large portrait tiles");
assert(imageShowcaseRenderer.includes("StorefrontImage"), "showcase image cards should render fixed-ratio large images");
assert(imageShowcaseRenderer.includes("preview={false}"), "showcase image img tags should not duplicate the outer lightbox trigger");
assert(showcaseRenderer.includes("alt={`${card.meta} customer-created image example"), "showcase images should have customer-created alt text");
assert(showcaseRenderer.includes('fetchPriority={card.index < 4 ? "high" : "low"}'), "showcase should prioritize initially visible image cards");
assert(showcaseRenderer.includes('loading={card.index < 4 ? "eager" : "lazy"}'), "showcase should eagerly load initially visible image cards");
assert(!imageShowcaseRenderer.includes("{String(card.index + 1).padStart"), "showcase image cards should not show visible numbers");
assert(!imageShowcaseRenderer.includes("{card.title}</p>"), "showcase image cards should not show visible titles");
assert(!imageShowcaseRenderer.includes("{card.meta}</span>"), "showcase image cards should not show visible meta pills");
assert(showcaseRenderer.includes("DreamshootShowcaseVideo"), "showcase videos should render through the autoplay client component");
assert(showcaseRenderer.includes("priority={card.index < 4}"), "showcase should eagerly prepare initially visible motion cards");
assert(videoShowcaseRenderer.includes("aspect-[3/4]") && videoShowcaseRenderer.includes("md:w-[clamp(24rem,25vw,34rem)]"), "showcase video cards should match the large portrait image tile size");
assert(videoShowcaseRenderer.includes('className="h-full w-full object-cover"'), "showcase video cards should preserve media ratio without stretching");
assert(!videoShowcaseRenderer.includes("{String(card.index + 1).padStart"), "showcase video cards should not show visible numbers");
assert(!videoShowcaseRenderer.includes("{card.title}</p>"), "showcase video cards should not show visible titles");
assert(!videoShowcaseRenderer.includes("{card.meta}</div>") && !videoShowcaseRenderer.includes("{card.meta}</span>"), "showcase video cards should not show visible meta pills");
assert(!videoShowcaseRenderer.includes("Motion clip"), "showcase video cards should not show visible motion labels");
assert(!showcaseRenderer.includes("autoLoad={railIndex"), "showcase videos must not leave most rail cards poster-only behind an index gate");
assert(showcaseRenderer.includes("customer-created video example"), "showcase videos should have accessible labels");
assert(!showcaseRenderer.includes("[...imageCards, ...imageCards]"), "showcase image rail must not duplicate the data array");
assert(!showcaseRenderer.includes("[...videoCards, ...videoCards]"), "showcase video rail must not duplicate the data array");
assert(!showcaseRenderer.includes("dreamshoot-showcase-marquee"), "showcase rails should not use duplicated marquee animation");
assert(!showcaseRenderer.includes("mask-image"), "showcase rails should not use white edge fade masks");
assert(!showcaseRenderer.includes("href: \"/tools/image-to-video\""), "showcase videos should not link to the workspace tool");
assert(!showcaseRenderer.includes("href={hrefFor(site, card.href)}"), "showcase material cards should not be wrapped in internal links");
assert(!showcaseRenderer.includes("Make a clip"), "showcase material cards should not show workspace CTAs");
assert(testimonialRenderer.includes('setting(section, "mode", "use_cases") === "reviews"'), "testimonial wall should support explicit customer review mode");
assert(testimonialRenderer.includes("items.slice(0, reviewMode ? 6 : 4)"), "review mode should render six cards for a two-row desktop wall");

const showcasePreviewComponent = fs.readFileSync(path.join(repoRoot, "src/components/storefront/dreamshoot-showcase-preview.tsx"), "utf8");
assert(showcasePreviewComponent.includes('role="dialog"') && showcasePreviewComponent.includes('aria-modal="true"'), "showcase preview should render an accessible modal dialog");
assert(showcasePreviewComponent.includes("controls") && showcasePreviewComponent.includes("video.muted = false") && !showcasePreviewComponent.includes(" muted"), "showcase detail videos should play from the source with sound enabled");
assert(showcasePreviewComponent.includes("fixed inset-0 z-[160] bg-black"), "showcase preview should be a true fullscreen lightbox");
assert(showcasePreviewComponent.includes("ArrowLeft") && showcasePreviewComponent.includes("ArrowRight") && showcasePreviewComponent.includes("Escape"), "showcase preview should support keyboard navigation and close");
assert(showcasePreviewComponent.includes("ChevronLeft") && showcasePreviewComponent.includes("ChevronRight"), "showcase preview should include previous and next controls");

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
