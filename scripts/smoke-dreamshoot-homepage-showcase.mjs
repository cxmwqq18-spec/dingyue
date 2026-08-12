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
const expectedHomeOrders = {
  mydreamshoots: [
    "hero_1",
    "generation_showcase_1",
    "tutorial_video_1",
    "tutorial_video_2",
    "mobile_video_1",
    "package_catalog_1",
    "proof_1",
    "faq_1",
    "conversion_1",
    "brand_strip_1"
  ],
  aidreamcapes: [
    "hero_1",
    "generation_showcase_1",
    "featured_thanksgiving_1",
    "tutorial_video_1",
    "tutorial_video_2",
    "mobile_video_1",
    "package_catalog_1",
    "proof_1",
    "faq_1",
    "conversion_1",
    "brand_strip_1"
  ]
};
const removedHomeSectionsByStore = {
  mydreamshoots: ["visual_proof_1", "flow_bridge_1", "trust_1", "featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"],
  aidreamcapes: ["featured_pack_1", "featured_christmas_1"]
};
const expectedBestPackagesOrder = ["featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1", "faq_1"];
const expectedImageShowcasePriorityCount = 8;
const expectedImageShowcaseCardCount = 28;
const expectedHomepageImageGridCardCount = 16;
const expectedHomepageVideoGridCardCount = 4;
const expectedTrustedLogoCount = 29;
const dreamshootHomepageSafeShowcaseImagePathBySlug = {
  "ai-video-add-ons": "/assets/dreamshoot/generated/pack-galleries/ai-video-add-ons/ai-video-add-ons-06.webp",
  "anime-avatar": "/assets/dreamshoot/generated/pack-galleries/anime-avatar/anime-avatar-12.webp",
  boudoir: "/assets/dreamshoot/generated/pack-galleries/boudoir/boudoir-10.webp",
  "christmas-couple": "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-03.webp",
  "christmas-photos": "/assets/dreamshoot/generated/pack-galleries/christmas-photos/christmas-photos-03.webp",
  "creator-portraits": "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-04.webp",
  cyberpunk: "/assets/dreamshoot/generated/pack-galleries/cyberpunk/cyberpunk-03.webp",
  "desi-wedding": "/assets/dreamshoot/generated/pack-galleries/desi-wedding/desi-wedding-07.webp",
  engagement: "/assets/dreamshoot/generated/pack-galleries/engagement/engagement-05.webp",
  "fashion-editorial": "/assets/dreamshoot/generated/pack-galleries/fashion-editorial/fashion-editorial-03.webp",
  "gala-photos": "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-03.webp",
  hairstyle: "/assets/dreamshoot/generated/homepage-showcase/images/hairstyle.webp",
  "halloween-party-photos": "/assets/dreamshoot/generated/pack-galleries/halloween-party-photos/halloween-party-photos-10.webp",
  holiday: "/assets/dreamshoot/generated/pack-galleries/holiday/holiday-03.webp",
  "indian-wedding": "/assets/dreamshoot/generated/pack-galleries/indian-wedding/indian-wedding-04.webp",
  mafia: "/assets/dreamshoot/generated/pack-galleries/mafia/mafia-06.webp",
  "magic-upscaler": "/assets/dreamshoot/generated/20260618/upscaler-utility-v1.webp",
  nature: "/assets/dreamshoot/generated/homepage-showcase/images/nature.webp",
  "outdoor-creator-scenes": "/assets/dreamshoot/generated/pack-galleries/outdoor-creator-scenes/outdoor-creator-scenes-04.webp",
  "product-style": "/assets/dreamshoot/generated/pack-galleries/product-style/product-style-09.webp",
  "professional-headshots": "/assets/dreamshoot/generated/pack-galleries/professional-headshots/professional-headshots-03.webp",
  "profile-cards": "/assets/dreamshoot/generated/pack-galleries/profile-cards/profile-cards-04.webp",
  "social-cards": "/assets/dreamshoot/generated/pack-galleries/social-cards/social-cards-06.webp",
  "thanksgiving-group-photos": "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-02.webp",
  "valentine-photos": "/assets/dreamshoot/generated/pack-galleries/valentine-photos/valentine-photos-08.webp",
  "virtual-try-on": "/assets/dreamshoot/generated/pack-galleries/virtual-try-on/virtual-try-on-08.webp",
  "wedding-portraits": "/assets/dreamshoot/generated/homepage-showcase/images/wedding-portraits.webp",
  "world-cup-fan-photos": "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03.webp"
};
const bannedDreamshootHomepageSafeImages = new Set([
  "/assets/dreamshoot/generated/pack-galleries/magic-upscaler/magic-upscaler-03.webp",
  "/assets/dreamshoot/generated/pack-galleries/thanksgiving-group-photos/thanksgiving-group-photos-03.webp",
  "/assets/dreamshoot/generated/pack-galleries/halloween-party-photos/halloween-party-photos-03.webp"
]);

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
  const categories = (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  return (state.creativePacks ?? [])
    .filter((pack) => pack.siteId === site.id && pack.status === "active")
    .map((pack) => {
      const categoryRecord = pack.categoryRecord ?? categoryById.get(pack.categoryId);
      const parent = categoryRecord?.parent ?? categoryById.get(categoryRecord?.parentId);
      return {
        ...pack,
        categoryRecord: categoryRecord ? { ...categoryRecord, parent } : pack.categoryRecord
      };
    });
}

function comparableImageUrl(value) {
  return String(value || "").trim().split("?")[0];
}

function isAidreamcapesStore(store, site) {
  return /aidreamcapes/i.test(`${store.key} ${site?.slug ?? ""} ${site?.primaryDomain ?? ""}`);
}

function homepageShowcaseImageUrlForStore(store, site, slug) {
  const normalizedSlug = showcaseSlug(slug);
  if (isAidreamcapesStore(store, site)) {
    return `/assets/sites/site_aidreamcapes/fan-holiday-theme/categories/${normalizedSlug}.webp`;
  }
  return `/assets/dreamshoot/generated/homepage-showcase/images/${normalizedSlug}.webp`;
}

function looksLikeCompositeShowcaseAsset(value) {
  const normalized = comparableImageUrl(value).toLowerCase();
  return /(?:^|[-_/])(collage|contact-sheet|contact|sheet|split|before-after|beforeafter|grid|montage|storyboard|multi-panel|panel)(?:[-_/]|$)/.test(normalized) ||
    normalized.includes("/_sheets/");
}

function creativePackHrefSlug(pack) {
  return showcaseSlug(pack.categoryRecord?.slug || pack.category || pack.name);
}

function creativePackTokens(pack) {
  return Array.from(new Set([
    pack.categoryRecord?.id,
    pack.categoryRecord?.slug,
    pack.categoryRecord?.label,
    pack.categoryRecord?.parent?.id,
    pack.categoryRecord?.parent?.slug,
    pack.categoryRecord?.parent?.label,
    pack.category,
    pack.name,
    pack.aiAppSlug,
    creativePackHrefSlug(pack)
  ].filter(Boolean).map((value) => showcaseSlug(String(value)))));
}

function creativePackMatchesShowcaseSlug(pack, slug) {
  const normalizedSlug = showcaseSlug(slug);
  return Boolean(normalizedSlug) && creativePackTokens(pack).includes(normalizedSlug);
}

function dreamshootHomepageSafeShowcaseImageForPack(pack) {
  const source = [
    creativePackHrefSlug(pack),
    pack.categoryRecord?.slug,
    pack.category,
    pack.name
  ].map(showcaseSlug).map((slug) => dreamshootHomepageSafeShowcaseImagePathBySlug[slug]).find(Boolean);
  return source || "";
}

function assertShowcaseImageSourceData(store, site, pageJson, label) {
  const slugs = imageSlugsForPage(pageJson).map(showcaseSlug);
  const expectedSlugs = (store.imageSlugs ?? []).map(showcaseSlug);
  const uniqueSlugs = new Set(slugs);
  const imageSources = slugs.map((slug) => homepageShowcaseImageUrlForStore(store, site, slug));
  const uniqueSources = new Set(imageSources.map(comparableImageUrl));
  const activePacks = activeCreativePacksForSite(site);
  assert(slugs.length > 0, `${label}: expected configured homepage image theme slugs`);
  assert(slugs.join("|") === expectedSlugs.join("|"), `${label}: homepage image slug order drifted: ${slugs.join("|")}`);
  assert(uniqueSlugs.size === slugs.length, `${label}: duplicate homepage image theme slugs: ${slugs.join("|")}`);
  assert(uniqueSources.size === imageSources.length, `${label}: duplicate homepage image source paths: ${imageSources.join("|")}`);
  assert(imageSources.length === expectedImageShowcasePriorityCount, `${label}: expected ${expectedImageShowcasePriorityCount} priority homepage image themes, got ${imageSources.length}`);
  assert(activePacks.length === expectedImageShowcaseCardCount, `${label}: expected ${expectedImageShowcaseCardCount} active homepage image product themes, got ${activePacks.length}`);
  for (const slug of slugs) {
    const source = homepageShowcaseImageUrlForStore(store, site, slug);
    const assetFile = path.resolve(repoRoot, "public", `.${comparableImageUrl(source)}`);
    assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing single-image homepage showcase asset ${assetFile}`);
    assert(!looksLikeCompositeShowcaseAsset(source), `${label}: homepage image source must not be a collage/contact-sheet composite asset: ${source}`);
    assert(activePacks.some((pack) => creativePackMatchesShowcaseSlug(pack, slug)), `${label}: homepage image slug has no active creative pack match: ${slug}`);
  }
  const packCoverSources = activePacks.map((pack) => comparableImageUrl(pack.imageUrl));
  const uniquePackCoverSources = new Set(packCoverSources);
  assert(uniquePackCoverSources.size === activePacks.length, `${label}: duplicate active homepage pack image sources: ${packCoverSources.join("|")}`);
  for (const source of packCoverSources) {
    const assetFile = path.resolve(repoRoot, "public", `.${source}`);
    assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing active homepage pack image asset ${assetFile}`);
    assert(!looksLikeCompositeShowcaseAsset(source), `${label}: active homepage pack image must not be a collage/contact-sheet composite asset: ${source}`);
  }
  if (isAidreamcapesStore(store, site)) {
    assert(imageSources.every((source) => source.includes("/fan-holiday-theme/categories/")), `${label}: Aidreamcapes homepage should use clean category images, got ${imageSources.join("|")}`);
  } else {
    const safePackSources = activePacks.map((pack) => dreamshootHomepageSafeShowcaseImageForPack(pack));
    const uniqueSafePackSources = new Set(safePackSources.map(comparableImageUrl));
    assert(safePackSources.length === activePacks.length && safePackSources.every(Boolean), `${label}: every DreamShoot homepage pack should have a curated safe single-image source`);
    assert(uniqueSafePackSources.size === safePackSources.length, `${label}: duplicate curated DreamShoot homepage image sources: ${safePackSources.join("|")}`);
    for (const source of safePackSources) {
      const comparableSource = comparableImageUrl(source);
      const assetFile = path.resolve(repoRoot, "public", `.${comparableSource}`);
      assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing curated DreamShoot homepage image asset ${assetFile}`);
      assert(!comparableSource.includes("/pack-covers/"), `${label}: curated DreamShoot homepage images must not fall back to pack covers: ${source}`);
      assert(!looksLikeCompositeShowcaseAsset(source), `${label}: curated DreamShoot homepage image must be a single clean image: ${source}`);
      assert(!bannedDreamshootHomepageSafeImages.has(comparableSource), `${label}: curated DreamShoot homepage image selected a known split/collage candidate: ${source}`);
    }
    assert(imageSources.every((source) => source.includes("/homepage-showcase/images/")), `${label}: DreamShoot homepage should use dedicated single-image showcase assets, got ${imageSources.join("|")}`);
  }
}

function assertOrder(order, label, storeKey) {
  const expectedHomeOrder = expectedHomeOrders[storeKey] ?? expectedHomeOrders.mydreamshoots;
  const removedHomeSections = removedHomeSectionsByStore[storeKey] ?? [];
  assert(Array.isArray(order), `${label}: sections order should be an array`);
  assert(order.join("|") === expectedHomeOrder.join("|"), `${label}: unexpected homepage order ${order.join("|")}`);
  for (const sectionId of removedHomeSections) {
    assert(!order.includes(sectionId), `${label}: obsolete homepage section still ordered: ${sectionId}`);
  }
}

function assertPage(pageJson, label, storeKey) {
  assert(pageJson?.sections?.generation_showcase_1?.type === "dreamshoot_generation_showcase", `${label}: wrong showcase section type`);
  if (storeKey === "aidreamcapes") {
    assert(pageJson?.sections?.featured_thanksgiving_1?.type === "dreamshoot_featured_pack", `${label}: missing Thanksgiving featured pack on homepage`);
  }
  assert(pageJson?.sections?.package_catalog_1?.type === "dreamshoot_package_catalog", `${label}: wrong package catalog section type`);
  assert(pageJson?.sections?.proof_1?.type === "testimonial_wall", `${label}: wrong review section type`);
  assert(pageJson?.sections?.conversion_1?.type === "conversion_panel", `${label}: missing conversion CTA before customer types`);
  assert(pageJson?.sections?.brand_strip_1?.type === "brand_logo_strip", `${label}: missing customer type strip before footer`);
  for (const sectionId of removedHomeSectionsByStore[storeKey] ?? []) {
    assert(!pageJson?.sections?.[sectionId], `${label}: obsolete homepage section still present: ${sectionId}`);
  }
  assertOrder(pageJson?.sectionsOrder ?? [], label, storeKey);
  const settings = pageJson?.sections?.generation_showcase_1?.settings ?? {};
  const expectedImageAllLabel = storeKey === "mydreamshoots" ? "VIEW ALL PHOTO" : "View all photos";
  const expectedVideoAllLabel = storeKey === "mydreamshoots" ? "VIEW ALL VIDEO" : "View all videos";
  assert(String(settings.videoSlugs ?? "").split("|").filter(Boolean).length === 8, `${label}: expected 8 video slugs`);
  assert(settings.imageTitle === "Best Photo Generator", `${label}: image showcase heading drifted`);
  assert(settings.imageAllLabel === expectedImageAllLabel, `${label}: image showcase all-link label drifted`);
  assert(settings.imageAllHref === "/best-ai-image", `${label}: image showcase all-link href drifted`);
  assert(settings.videoTitle === "Best Video Generator", `${label}: video showcase heading drifted`);
  assert(settings.videoAllLabel === expectedVideoAllLabel, `${label}: video showcase all-link label drifted`);
  assert(settings.videoAllHref === "/best-ai-video", `${label}: video showcase all-link href drifted`);
  assert(settings.primaryHref === "/app/create", `${label}: primary CTA should point to the workspace create flow`);
  assert(!String(settings.videoSlugs ?? "").includes("creator-scene-motion"), `${label}: showcase video slugs should not include creator-scene-motion`);
  if (storeKey === "mydreamshoots") {
    assert(String(settings.videoSlugs ?? "").includes("travel-route-story"), `${label}: showcase video slugs should include travel-route-story`);
  }
  if (storeKey === "aidreamcapes") {
    assert(pageJson?.sections?.visual_proof_1?.type === "dreamshoot_visual_proof", `${label}: missing Aidreamcapes proof gallery`);
    assert(pageJson?.sections?.flow_bridge_1?.type === "dreamshoot_flow_bridge", `${label}: missing Aidreamcapes workflow bridge`);
    assert(pageJson?.sections?.trust_1?.type === "trust_signal_bar", `${label}: missing Aidreamcapes trust signal`);
    assert(pageJson?.sections?.tutorial_video_1?.type === "video_feature", `${label}: missing Aidreamcapes workflow video section`);
    assert(pageJson?.sections?.tutorial_video_2?.type === "video_feature", `${label}: missing Aidreamcapes image tutorial section`);
    assert(pageJson?.sections?.mobile_video_1?.type === "mobile_video_showcase", `${label}: missing Aidreamcapes mobile tutorial section`);
    assertTutorialVideoSection(pageJson?.sections?.tutorial_video_1, `${label}: aidreamcapes workflow tutorial`, "how it works");
    assertTutorialVideoSection(pageJson?.sections?.tutorial_video_2, `${label}: aidreamcapes image tutorial`);
    assertMobileVideoSection(pageJson?.sections?.mobile_video_1, `${label}: aidreamcapes mobile tutorial`);
    assert(Number(pageJson?.sections?.package_catalog_1?.settings?.featuredCount ?? 0) >= 7, `${label}: Aidreamcapes homepage package catalog should feature at least 7 packs`);
    assert((pageJson?.sections?.proof_1?.blocks ?? []).length >= 3, `${label}: expected at least 3 Aidreamcapes review cards`);
    assert((pageJson?.sections?.faq_1?.blocks ?? []).length >= 5, `${label}: expected Aidreamcapes FAQ content`);
    assert(Number(settings.videoItemLimit ?? settings.itemLimit ?? 0) === 8, `${label}: expected 8 Aidreamcapes video showcase items`);
    return;
  }
  assert(pageJson?.sections?.tutorial_video_1?.type === "video_feature", `${label}: missing tutorial video section`);
  assert(pageJson?.sections?.tutorial_video_2?.type === "video_feature", `${label}: missing AI image tutorial video section`);
  assert(pageJson?.sections?.mobile_video_1?.type === "mobile_video_showcase", `${label}: missing mobile tutorial section`);
  assert(pageJson?.sections?.pricing_1?.type === "pricing_table", `${label}: pricing section should remain available for embedded rendering`);
  assert(!pageJson?.sectionsOrder?.includes("pricing_1"), `${label}: pricing_1 should be embedded in showcase instead of ordered at the bottom`);
  assertMobileVideoSection(pageJson?.sections?.mobile_video_1, `${label}: mydreamshoots mobile tutorial`);
  assert(Number(pageJson?.sections?.package_catalog_1?.settings?.featuredCount ?? 0) === 12, `${label}: homepage package catalog should feature 12 packs`);
  assert(pageJson?.sections?.proof_1?.settings?.mode === "reviews", `${label}: testimonial wall should render customer reviews`);
  assert((pageJson?.sections?.proof_1?.blocks ?? []).length >= 6, `${label}: expected at least 6 review cards`);
  assert((pageJson?.sections?.faq_1?.blocks ?? []).length >= 12, `${label}: expected expanded FAQ content`);
  assert(Number(settings.videoItemLimit ?? 0) === 8, `${label}: expected 8 video showcase items`);
  assert(settings.showTrustedLogoIntro === true, `${label}: trusted logo intro should be enabled`);
  assert(settings.trustedLogoTitle === "Most Trusted Creators. | myDreamshoots", `${label}: trusted logo title drifted`);
  assert(settings.aboutTitle === "What is myDreamshoots?", `${label}: about title drifted`);
  assert(String(settings.aboutBody ?? "").startsWith("myDreamshoots is an AI photo and video studio produced by MRNARUEBET LLC"), `${label}: about body should describe myDreamshoots`);
  assert(settings.embeddedPricingSectionId === "pricing_1", `${label}: showcase should embed pricing_1`);
  assert(Number(settings.trustedLogoSplitIndex ?? 0) === 15, `${label}: trusted logo row split should stay at 15`);
  assert((pageJson?.sections?.generation_showcase_1?.blocks ?? []).filter((block) => block?.type === "logo").length === expectedTrustedLogoCount, `${label}: expected ${expectedTrustedLogoCount} trusted logo blocks`);
  assert(!("itemLimit" in settings), `${label}: old image-limiting itemLimit should be removed`);
  const pricingSettings = pageJson?.sections?.pricing_1?.settings ?? {};
  assert(pricingSettings.subtitle === "Choose the plan that works for you", `${label}: pricing subtitle drifted`);
  assert(String(pricingSettings.marketComparison ?? "").includes("$725"), `${label}: pricing market comparison should mention the $725 photoshoot comparison`);
  assert(String(pricingSettings.description ?? "").startsWith("Choose Starter, Pro, or Premium."), `${label}: pricing description drifted`);
  assert(pricingSettings.sidePanelTitle === "Our plans starts from $24.50 and are designed to be more affordable and flexible.", `${label}: pricing side panel title drifted`);
  const mobileSettings = pageJson?.sections?.mobile_video_1?.settings ?? {};
  assert(mobileSettings.title === "How it works", `${label}: mobile tutorial title drifted`);
  assert(String(mobileSettings.supportingCopy ?? "").includes("Your next video content can instantly go viral."), `${label}: mobile tutorial supporting copy drifted`);
  const catalogSettings = pageJson?.sections?.package_catalog_1?.settings ?? {};
  assert(catalogSettings.label === "AI PHOTO STUDIOS", `${label}: package catalog label drifted`);
  assert(catalogSettings.title === "Professional AI Photo Packages", `${label}: package catalog title drifted`);
  assert(catalogSettings.directoryLabel === "AI PHOTO THEMED", `${label}: theme directory label drifted`);
  const proofSettings = pageJson?.sections?.proof_1?.settings ?? {};
  assert(proofSettings.title === "What Our Customers Say", `${label}: review title drifted`);
  assert(proofSettings.subtitle === "Our users love us and we love them!", `${label}: review subtitle drifted`);
  assert(String(proofSettings.summaryBody ?? "").includes("brokers of trust"), `${label}: review body drifted`);
  const conversionSettings = pageJson?.sections?.conversion_1?.settings ?? {};
  assert(conversionSettings.eyebrow === "BEST AI MAKER", `${label}: conversion eyebrow drifted`);
  assert(conversionSettings.title === "Ready to try the myDreamshoots's Best AI Maker?", `${label}: conversion title drifted`);
}

function assertBestPackagesPage(pageJson, label) {
  if (pageJson && "pageType" in pageJson) assert(pageJson.pageType === "content", `${label}: Best Packages should be a content page`);
  const order = pageJson?.sectionsOrder ?? pageJson?.content_for_page ?? [];
  assert(order.join("|") === expectedBestPackagesOrder.join("|"), `${label}: unexpected Best Packages order ${order.join("|")}`);
  for (const sectionId of expectedBestPackagesOrder.filter((id) => id !== "faq_1")) {
    assert(pageJson?.sections?.[sectionId]?.type === "dreamshoot_featured_pack", `${label}: missing Best Packages section ${sectionId}`);
  }
  assert(pageJson?.sections?.faq_1?.type === "faq", `${label}: missing Best Packages FAQ section`);
}

function assertBestMediaPage(pageJson, kind, label) {
  const sectionId = kind === "image" ? "best_ai_image_1" : "best_ai_video_1";
  if (pageJson && "pageType" in pageJson) assert(pageJson.pageType === "content", `${label}: Best AI ${kind} should be a content page`);
  const order = pageJson?.sectionsOrder ?? pageJson?.content_for_page ?? [];
  assert(order.join("|") === `${sectionId}|faq_1`, `${label}: unexpected Best AI ${kind} order ${order.join("|")}`);
  const section = pageJson?.sections?.[sectionId];
  assert(section?.type === "dreamshoot_media_gallery", `${label}: missing Best AI ${kind} media gallery`);
  assert(pageJson?.sections?.faq_1?.type === "faq", `${label}: missing Best AI ${kind} FAQ section`);
  assert(section?.settings?.kind === kind, `${label}: Best AI ${kind} gallery kind drifted`);
  assert(section?.settings?.fullGallery === true, `${label}: Best AI ${kind} gallery should use full active data`);
  assert(!String(section?.settings?.imageSlugs ?? "").trim(), `${label}: Best AI ${kind} gallery should not limit image slugs`);
  assert(!String(section?.settings?.videoSlugs ?? "").trim(), `${label}: Best AI ${kind} gallery should not limit video slugs`);
}

const expectedFeaturedPackCollectionSlugs = {
  mydreamshoots: ["world-cup-fan-photos", "gala-photos", "christmas-couple", "creator-portraits", "thanksgiving-group-photos", "holiday"],
  aidreamcapes: ["game-day-group-photos", "christmas-holiday-albums", "premiere-style-portraits", "fan-scene-albums", "thanksgiving-memory-sets", "seasonal-celebration-photos"]
};

function featuredPackCollectionSlugsForPage(pageJson) {
  return (pageJson?.sections?.featured_pack_1?.blocks ?? [])
    .filter((block) => block?.type === "seasonal_image")
    .map((block) => String(block?.settings?.collectionSlug ?? "").trim());
}

function assertFeaturedPackCollectionSlugs(pageJson, storeKey, label) {
  const actual = featuredPackCollectionSlugsForPage(pageJson);
  const expected = expectedFeaturedPackCollectionSlugs[storeKey] ?? [];
  assert(actual.join("|") === expected.join("|"), `${label}: featured pack collection slug order drifted: ${actual.join("|")}`);
  assert(actual.every((slug) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !/^https?:|\/collections\//i.test(slug)), `${label}: featured pack tiles must use stable collection slugs: ${actual.join("|")}`);
}

function assertTutorialVideoSection(section, label, expectedEyebrow = "ai image") {
  const settings = section?.settings ?? {};
  const imageUrl = comparableImageUrl(settings.imageUrl);
  const videoUrl = comparableImageUrl(settings.videoUrl);
  assert(String(settings.eyebrow ?? "").toLowerCase().includes(expectedEyebrow), `${label}: tutorial eyebrow should identify ${expectedEyebrow}`);
  assert(String(settings.title ?? "").trim().length > 12, `${label}: tutorial should have a real title`);
  assert(String(settings.subtitle ?? "").includes("source photo"), `${label}: tutorial copy should mention source photos`);
  assert(/\.jpg$/.test(imageUrl), `${label}: tutorial should use a poster jpg`);
  assert(/\.mp4$/.test(videoUrl), `${label}: tutorial should use an mp4 video`);
  for (const url of [imageUrl, videoUrl]) {
    const assetFile = path.resolve(repoRoot, "public", `.${url}`);
    assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing tutorial asset ${assetFile}`);
  }
}

function assertMobileVideoSection(section, label) {
  const settings = section?.settings ?? {};
  const imageUrl = comparableImageUrl(settings.imageUrl);
  const leftVideoUrl = comparableImageUrl(settings.leftVideoUrl);
  const rightVideoUrl = comparableImageUrl(settings.rightVideoUrl);
  const leftPoster = comparableImageUrl(settings.leftVideoPoster);
  const rightPoster = comparableImageUrl(settings.rightVideoPoster);
  const videoUrl = comparableImageUrl(settings.videoUrl);
  const posterUrl = comparableImageUrl(settings.videoPoster);
  const usesMydreamDocCopy = String(settings.title ?? "").trim() === "How it works";
  if (usesMydreamDocCopy) {
    assert(String(settings.subtitle ?? "").includes("Upload selfies and start creating your AI photshoot now"), `${label}: mobile subtitle should match the approved myDreamshoots copy`);
    assert(String(settings.supportingCopy ?? "").includes("AI Video"), `${label}: mobile supporting copy should mention AI Video`);
  } else {
    assert(String(settings.eyebrow ?? "").toLowerCase().includes("mobile"), `${label}: mobile eyebrow should identify mobile workflow`);
    assert(String(settings.title ?? "").trim().length > 12, `${label}: mobile section should have a real title`);
    assert(String(settings.subtitle ?? "").includes("vertical phone layout"), `${label}: mobile copy should mention the vertical phone layout`);
  }
  assert(String(settings.leftTitle ?? "").toLowerCase().includes("image"), `${label}: left title should identify the image tutorial`);
  assert(String(settings.rightTitle ?? "").toLowerCase().includes("video"), `${label}: right title should identify the video tutorial`);
  assert(/\.mp4$/.test(leftVideoUrl), `${label}: left mobile tutorial should use an mp4 video`);
  assert(/\.mp4$/.test(rightVideoUrl), `${label}: right mobile tutorial should use an mp4 video`);
  assert(/\.jpg$/.test(leftPoster), `${label}: left mobile tutorial should use a poster jpg`);
  assert(/\.jpg$/.test(rightPoster), `${label}: right mobile tutorial should use a poster jpg`);
  assert(/\.mp4$/.test(videoUrl), `${label}: legacy mobile videoUrl should stay on an mp4`);
  assert(/\.jpg$/.test(posterUrl), `${label}: legacy mobile poster should stay on a jpg`);
  for (const url of [imageUrl, leftVideoUrl, rightVideoUrl, leftPoster, rightPoster, videoUrl, posterUrl]) {
    const assetFile = path.resolve(repoRoot, "public", `.${url}`);
    assert(fs.existsSync(assetFile) && fs.statSync(assetFile).size > 1000, `${label}: missing mobile tutorial asset ${assetFile}`);
  }
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
  assertPage(home?.draftJson, `${store.key}: draft home`, store.key);
  assertPage(home?.publishedJson, `${store.key}: published home`, store.key);
  const bestPackages = site?.pages?.find((page) => page.slug === "/best-packages");
  const bestAiImage = site?.pages?.find((page) => page.slug === "/best-ai-image");
  const bestAiVideo = site?.pages?.find((page) => page.slug === "/best-ai-video");
  assert(bestPackages, `${store.key}: Best Packages page missing`);
  assert(bestAiImage, `${store.key}: Best AI image page missing`);
  assert(bestAiVideo, `${store.key}: Best AI video page missing`);
  assertBestPackagesPage(bestPackages?.draftJson, `${store.key}: draft Best Packages`);
  assertBestPackagesPage(bestPackages?.publishedJson, `${store.key}: published Best Packages`);
  assertFeaturedPackCollectionSlugs(bestPackages?.draftJson, store.key, `${store.key}: draft Best Packages`);
  assertFeaturedPackCollectionSlugs(bestPackages?.publishedJson, store.key, `${store.key}: published Best Packages`);
  assertBestMediaPage(bestAiImage?.draftJson, "image", `${store.key}: draft Best AI image`);
  assertBestMediaPage(bestAiImage?.publishedJson, "image", `${store.key}: published Best AI image`);
  assertBestMediaPage(bestAiVideo?.draftJson, "video", `${store.key}: draft Best AI video`);
  assertBestMediaPage(bestAiVideo?.publishedJson, "video", `${store.key}: published Best AI video`);
  if (store.key === "mydreamshoots") {
    assertTutorialVideoSection(home?.draftJson?.sections?.tutorial_video_2, `${store.key}: draft home`);
    assertTutorialVideoSection(home?.publishedJson?.sections?.tutorial_video_2, `${store.key}: published home`);
  }
  assertShowcaseImageSourceData(store, site, home?.draftJson, `${store.key}: draft home`);
  assertShowcaseImageSourceData(store, site, home?.publishedJson, `${store.key}: published home`);
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
    assertOrder(template?.content_for_page ?? [], `${store.key}: site theme ${theme.id}`, store.key);
    assertBestPackagesPage(theme.templates?.["best-packages"], `${store.key}: site theme ${theme.id} Best Packages`);
    assertFeaturedPackCollectionSlugs(theme.templates?.["best-packages"], store.key, `${store.key}: site theme ${theme.id} Best Packages`);
    assertBestMediaPage(theme.templates?.["best-ai-image"], "image", `${store.key}: site theme ${theme.id} Best AI image`);
    assertBestMediaPage(theme.templates?.["best-ai-video"], "video", `${store.key}: site theme ${theme.id} Best AI video`);
    if (store.key === "mydreamshoots") {
      assertTutorialVideoSection(template?.sections?.tutorial_video_2, `${store.key}: site theme ${theme.id}`);
      assertMydreamshootsImageSlugPriority({ sections: { generation_showcase_1: template?.sections?.generation_showcase_1 } }, `${store.key}: site theme ${theme.id}`);
      assertMydreamshootsHomepageAssets(template, `${store.key}: site theme ${theme.id}`);
    }
  }

  for (const publication of (state.themePublications ?? []).filter((item) => item.siteId === store.siteId)) {
    const snapshotHome = publication.snapshot?.pages?.find((page) => page.slug === "/")?.publishedJson;
    assertPage(snapshotHome, `${store.key}: publication ${publication.version}`, store.key);
    const snapshotBestPackages = publication.snapshot?.pages?.find((page) => page.slug === "/best-packages")?.publishedJson;
    const snapshotBestAiImage = publication.snapshot?.pages?.find((page) => page.slug === "/best-ai-image")?.publishedJson;
    const snapshotBestAiVideo = publication.snapshot?.pages?.find((page) => page.slug === "/best-ai-video")?.publishedJson;
    assertBestPackagesPage(snapshotBestPackages, `${store.key}: publication ${publication.version} Best Packages`);
    assertFeaturedPackCollectionSlugs(snapshotBestPackages, store.key, `${store.key}: publication ${publication.version} Best Packages`);
    assertBestMediaPage(snapshotBestAiImage, "image", `${store.key}: publication ${publication.version} Best AI image`);
    assertBestMediaPage(snapshotBestAiVideo, "video", `${store.key}: publication ${publication.version} Best AI video`);
    if (store.key === "mydreamshoots") {
      assertTutorialVideoSection(snapshotHome?.sections?.tutorial_video_2, `${store.key}: publication ${publication.version}`);
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
assert(storefrontRender.includes("videoThemes: needsVideoThemes ? trimVideoThemesForStorefront"), "storefront lazy payload should request video themes only for showcase/media gallery sections");
assert(storefrontRender.includes("const pageNeedsPublicVideoThemes = currentPageSectionTypes.has(\"dreamshoot_generation_showcase\") || currentPageSectionTypes.has(\"dreamshoot_media_gallery\")"), "full storefront page render should recover public video themes for showcase and media gallery pages when the lean runtime state omits them");
assert(storefrontRender.includes("currentPageUsesFullMediaGallery ? undefined : publicDirectoryPackLimit"), "full storefront page render should use uncapped media-gallery data when fullGallery is enabled");

const themeRenderer = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
const showcaseRenderer = themeRenderer.match(/if \(section\.type === "dreamshoot_generation_showcase"\)[\s\S]*?if \(section\.type === "dreamshoot_featured_pack"\)/)?.[0] ?? "";
const mediaGalleryRenderer = themeRenderer.match(/if \(section\.type === "dreamshoot_media_gallery"\)[\s\S]*?if \(section\.type === "dreamshoot_generation_showcase"\)/)?.[0] ?? "";
const featuredPackRenderer = themeRenderer.match(/if \(section\.type === "dreamshoot_featured_pack"\)[\s\S]*?if \(section\.type === "dreamshoot_package_catalog"/)?.[0] ?? "";
const imageShowcaseRenderer = showcaseRenderer.match(/<div className="mt-5 space-y-3"[\s\S]*?<div className="mt-12">/)?.[0] ?? "";
const videoShowcaseRenderer = showcaseRenderer.match(/<div className="mt-12">[\s\S]*?<\/DreamshootShowcasePreview>/)?.[0] ?? "";
const videoFeatureRenderer = themeRenderer.match(/if \(section\.type === "video_feature"\)[\s\S]*?if \(section\.type === "luxury_highlight"\)/)?.[0] ?? "";
const testimonialRenderer = themeRenderer.match(/if \(section\.type === "testimonial_wall"\)[\s\S]*?if \(section\.type === "faq"\)/)?.[0] ?? "";
const pricingBillingTable = fs.readFileSync(path.join(repoRoot, "src/components/storefront/pricing-billing-table.tsx"), "utf8");
assert(videoFeatureRenderer.includes('setting(section, "videoUrl", "")') && videoFeatureRenderer.includes("<video"), "tutorial video feature should render a real videoUrl when configured");
assert(videoFeatureRenderer.includes("poster={image || undefined}") && videoFeatureRenderer.includes("preload=\"metadata\""), "tutorial video feature should keep poster fallback and metadata loading");
assert(showcaseRenderer.includes("dreamshoot-showcase-track"), "showcase should render horizontal showcase rails");
assert(showcaseRenderer.includes("DreamshootShowcaseRail"), "showcase video rails should auto-scroll without duplicating card data");
assert(showcaseRenderer.includes("<figure"), "showcase material cards should render as figures");
assert(showcaseRenderer.includes("DreamshootShowcasePreview"), "showcase material cards should open an image/video preview lightbox");
assert(showcaseRenderer.includes("canonicalGeneratorCopy"), "homepage showcase should force canonical Best Photo/Video Generator copy for .com stores");
assert(!showcaseRenderer.includes("imageCards.length} examples"), "homepage showcase should not display the photo count label");
assert(!showcaseRenderer.includes("videoCards.length} clips"), "homepage showcase should not display the video count label");
assert(mediaGalleryRenderer.includes("fullGallery"), "Best AI media gallery should support full active data mode");
assert(!mediaGalleryRenderer.includes("cardsCount"), "Best AI media gallery should not display examples/clips count labels");
assert(showcaseRenderer.includes("data-dreamshoot-trusted-logos"), "showcase should render the trusted logo intro wall");
assert(showcaseRenderer.includes('setting(section, "embeddedPricingSectionId")'), "showcase should read the embedded pricing section setting");
assert(showcaseRenderer.includes("PricingTableSectionView"), "showcase should reuse the pricing table renderer for embedded plans");
assert(showcaseRenderer.indexOf("</DreamshootShowcasePreview>") < showcaseRenderer.indexOf("{showcaseIntro}") && showcaseRenderer.indexOf("{showcaseIntro}") < showcaseRenderer.indexOf("{embeddedPricing}"), "showcase intro should render below image/video rails and above embedded pricing");
assert(showcaseRenderer.includes('data-dreamshoot-showcase-preview="image"'), "showcase image cards should be clickable preview triggers");
assert(showcaseRenderer.includes('data-dreamshoot-showcase-preview="video"'), "showcase video cards should be clickable preview triggers");
assert(themeRenderer.includes('"dreamshoot_generation_showcase",\n  "pricing_table"'), "showcase sections should receive live products for embedded pricing");
assert(themeRenderer.includes("dreamshootShowcaseImagePath"), "showcase images should keep dedicated AI-generated homepage fallback assets");
assert(themeRenderer.includes('dreamshootHomepageShowcaseVersion = "20260801visualfix1"'), "showcase image URLs should use the 20260801visualfix1 cache-busting version");
assert(themeRenderer.includes("dreamshootHomepageSafeShowcaseImagePathBySlug"), "homepage showcase should keep a curated safe single-image source table for DreamShoot product cards");
assert(themeRenderer.includes("dreamshootHomepageSafeImageForPack"), "homepage showcase should check curated safe product-card images before gallery fallback");
assert(themeRenderer.includes("homepageShowcaseImageCardFromSlug"), "homepage showcase should build cards directly from configured image slugs before falling back to pack galleries");
assert(themeRenderer.includes("generationShowcasePriorityImageCardFromSlug"), "homepage showcase should use configured image slugs as priority cards without limiting total image products");
assert(themeRenderer.includes("generationShowcasePackPriorityIndex"), "homepage showcase should sort active packs by configured priority image slugs");
assert(themeRenderer.includes("generationShowcasePackDedupeKey"), "homepage showcase should dedupe by active pack identity so all 28 visible themes remain available");
assert(!themeRenderer.includes("return generationShowcaseCardsFromSources(uniqueSelectedImageSlugs"), "homepage showcase must not return only the eight configured priority image slugs");
assert(themeRenderer.includes("looksLikeCompositeShowcaseImageUrl"), "homepage showcase image selection should reject collage/contact-sheet/gallery composite candidates");
assert(!themeRenderer.includes('normalized.includes("/pack-galleries/")'), "homepage showcase must not reject every gallery single image as a composite");
assert(!themeRenderer.includes('normalized.includes("/fan-holiday-theme/gallery/")'), "homepage showcase must not reject every Aidreamcapes gallery single image as a composite");
assert(showcaseRenderer.includes("generationShowcaseImageCardsForSite(site, creativePacks, selectedImageSlugs)"), "showcase images should come from each store's dynamic theme source list");
assert(featuredPackRenderer.includes("featuredPackTileHref"), "featured pack tiles should resolve links through the runtime taxonomy resolver");
assert(themeRenderer.includes('blockValue(block, "collectionSlug", "")'), "featured pack tile links should accept stable collection slug metadata");
assert(featuredPackRenderer.includes('data-featured-pack-tile-link="true"'), "featured pack tiles should render as tracked links");
assert(showcaseRenderer.includes("useMydreamShowcaseGrid"), "showcase should gate the new homepage grid to MyDreamShoots");
assert(showcaseRenderer.includes('data-dreamshoot-homepage-gallery-grid="photo"'), "MyDreamShoots homepage photo showcase should render the gallery-style grid");
assert(showcaseRenderer.includes('data-dreamshoot-homepage-gallery-grid="video"'), "MyDreamShoots homepage video showcase should render the gallery-style grid");
assert(showcaseRenderer.includes("grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4"), "MyDreamShoots homepage showcase grid should use one, two, then four columns");
assert(showcaseRenderer.includes(`const homepageImageProductCards = imageProductCards.slice(0, ${expectedHomepageImageGridCardCount})`), `MyDreamShoots homepage photo grid should show ${expectedHomepageImageGridCardCount} cards before sending customers to the full gallery`);
assert(showcaseRenderer.includes(`const homepageVideoCards = videoCards.slice(0, ${expectedHomepageVideoGridCardCount})`), `MyDreamShoots homepage video grid should render one row of ${expectedHomepageVideoGridCardCount} cards before sending customers to the full video gallery`);
assert(showcaseRenderer.includes("imageProductRows"), "showcase images should keep the scrolling row fallback for paired storefronts");
assert(imageShowcaseRenderer.includes("imageProductRows.map"), "showcase image cards should keep dynamically balanced wall rows for paired storefronts");
assert(showcaseRenderer.includes("Math.ceil(imageProductCards.length / 7)"), "showcase image wall should target seven products per row");
assert(!imageShowcaseRenderer.includes("row.concat(row)"), "showcase image wall must not duplicate homepage theme cards in the render tree");
assert(!imageShowcaseRenderer.includes("data-dreamshoot-image-product-clone"), "showcase image wall should not emit cloned product cards");
assert(!imageShowcaseRenderer.includes("xl:grid-cols-7"), "showcase image wall should not regress to the static seven-column grid");
assert(showcaseRenderer.includes("aspect-square") && (showcaseRenderer.includes("xl:grid-cols-4") || showcaseRenderer.includes("lg:w-[calc((100vw-5.5rem)/4)]")), "showcase image cards should use equal four-column square tiles on desktop");
assert(imageShowcaseRenderer.includes("StorefrontImage"), "showcase image cards should render fixed-ratio large images");
assert(imageShowcaseRenderer.includes("object-contain object-center"), "showcase image cards should show the complete source image without cover cropping");
assert(!imageShowcaseRenderer.includes('className="h-full w-full object-cover transition duration-700'), "showcase image cards must not crop source images with object-cover");
assert(!imageShowcaseRenderer.includes("group-hover:scale-[1.018]"), "showcase image cards must not crop source images on hover");
assert(imageShowcaseRenderer.includes("preview={false}"), "showcase image img tags should not duplicate the outer lightbox trigger");
assert(showcaseRenderer.includes("cardImageAltForSite(site") && showcaseRenderer.includes('role: "gallery"'), "showcase images should use rich gallery alt text");
assert(showcaseRenderer.includes("{card.title}</span>") && showcaseRenderer.includes("{card.meta}"), "MyDreamShoots homepage grid cards should show visible title and category copy");
assert(!imageShowcaseRenderer.includes("bg-gradient-to-t from-black/78"), "showcase image cards should not add a text overlay gradient");
assert(showcaseRenderer.includes("const imageProductCards = imageCards.map"), "homepage showcase should include every dynamic image product card in the wall");
assert(!showcaseRenderer.includes("imageCards.slice(0, 8)"), "homepage showcase image wall should not truncate themes to 8 priority cards");
assert(!showcaseRenderer.includes("imageCards.slice(0, 12)"), "homepage showcase image wall should not truncate themes to 12 cards");
assert(showcaseRenderer.includes('data-dreamshoot-image-product-grid="true"'), "showcase should expose a stable image product grid marker");
assert(showcaseRenderer.includes('data-dreamshoot-image-product-wall="true"'), "showcase should expose a stable four-row image product wall marker");
assert(showcaseRenderer.includes('data-dreamshoot-image-product-card="true"'), "showcase should expose stable image product card markers");
assert(showcaseRenderer.includes('fetchPriority={card.productIndex < 4 ? "high" : "low"}'), "showcase should prioritize initially visible image product cards");
assert(showcaseRenderer.includes('loading={card.productIndex < 4 ? "eager" : "lazy"}'), "showcase should eagerly load initially visible image product cards");
assert(!imageShowcaseRenderer.includes("{String(card.index + 1).padStart"), "showcase image cards should not show visible numbers");
assert(showcaseRenderer.includes("DreamshootShowcaseVideo"), "showcase videos should render through the autoplay client component");
assert(showcaseRenderer.includes("priority={card.index < 4}"), "showcase should eagerly prepare initially visible motion cards");
assert(videoShowcaseRenderer.includes("aspect-square"), "MyDreamShoots homepage video grid should use square media framing to match square showcase video assets");
assert(mediaGalleryRenderer.includes("aspect-square") && mediaGalleryRenderer.includes('data-dreamshoot-media-gallery-grid="video"'), "Best AI video gallery should use square media framing for MyDreamShoots video assets");
assert(videoShowcaseRenderer.includes("h-full w-full") && videoShowcaseRenderer.includes("object-cover"), "showcase video cards should preserve media ratio without stretching");
assert(!videoShowcaseRenderer.includes("{String(card.index + 1).padStart"), "showcase video cards should not show visible numbers");
assert(videoShowcaseRenderer.includes("<figcaption") && videoShowcaseRenderer.includes("{card.title}</span>") && videoShowcaseRenderer.includes("{card.meta}"), "MyDreamShoots homepage video grid cards should show visible title and category copy");
assert(!videoShowcaseRenderer.includes("Motion clip"), "showcase video cards should not show visible motion labels");
assert(!showcaseRenderer.includes("autoLoad={railIndex"), "showcase videos must not leave most rail cards poster-only behind an index gate");
assert(showcaseRenderer.includes("gallery video example"), "showcase videos should have accessible labels");
assert(!showcaseRenderer.includes("[...imageCards, ...imageCards]"), "showcase image wall must not duplicate the full product data array");
assert(!showcaseRenderer.includes("[...videoCards, ...videoCards]"), "showcase video rail must not duplicate the data array");
assert(!showcaseRenderer.includes("dreamshoot-showcase-marquee"), "showcase rails should not use duplicated marquee animation");
assert(!showcaseRenderer.includes("mask-image"), "showcase rails should not use white edge fade masks");
assert(!showcaseRenderer.includes("href: \"/tools/image-to-video\""), "showcase videos should not link to the workspace tool");
assert(!showcaseRenderer.includes("href={hrefFor(site, card.href)}"), "showcase material cards should not be wrapped in internal links");
assert(!showcaseRenderer.includes("Make a clip"), "showcase material cards should not show workspace CTAs");
assert(testimonialRenderer.includes('setting(section, "mode", "use_cases") === "reviews"'), "testimonial wall should support explicit customer review mode");
assert(testimonialRenderer.includes("slice(0, reviewMode ? 8 : 4)"), "review mode should render eight cards for a richer desktop wall");
assert(testimonialRenderer.includes('data-dreamshoot-review-preview="true"'), "review results should expose clickable preview markers");
assert(themeRenderer.includes("function DreamshootUnderlinedTitle"), "homepage section headings should share the gradient underline helper");
assert(!themeRenderer.includes("h-0.5 w-24 rounded-full bg-white/70"), "MyDreamShoots homepage headings should not regress to fixed short white underlines");
assert(pricingBillingTable.includes("mydreamshootsGradientUnderline") && pricingBillingTable.includes("sm:w-[25.25rem]"), "pricing billing switch underline should use the wider MyDreamShoots gradient treatment");
assert(!pricingBillingTable.includes("h-0.5 w-24 rounded-full bg-white/70"), "pricing billing switch should not regress to the fixed short white underline");

const showcasePreviewComponent = fs.readFileSync(path.join(repoRoot, "src/components/storefront/dreamshoot-showcase-preview.tsx"), "utf8");
assert(showcasePreviewComponent.includes('role="dialog"') && showcasePreviewComponent.includes('aria-modal="true"'), "showcase preview should render an accessible modal dialog");
assert(showcasePreviewComponent.includes("controls") && showcasePreviewComponent.includes("video.muted = false") && !showcasePreviewComponent.includes(" muted"), "showcase detail videos should play from the source with sound enabled");
assert(showcasePreviewComponent.includes("fixed inset-0 z-[160] bg-black"), "showcase preview should be a true fullscreen lightbox");
assert(showcasePreviewComponent.includes('data-dreamshoot-preview-media="image"') && showcasePreviewComponent.includes("max-h-[calc(100vh-8.5rem)]"), "showcase image preview should reserve safe space around full-size media");
assert(!showcasePreviewComponent.includes("max-h-screen max-w-screen object-contain"), "showcase image preview should not let controls overlap edge-to-edge media");
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
