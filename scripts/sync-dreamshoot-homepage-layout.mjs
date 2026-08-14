#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import createJiti from "jiti";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};
const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const homeOrderByStore = {
  mydreamshoots: [
    "hero_1",
    "generation_showcase_1",
    "tutorial_video_1",
    "tutorial_video_2",
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
  mydreamshoots: ["mobile_video_1", "visual_proof_1", "flow_bridge_1", "trust_1", "featured_pack_1", "featured_christmas_1", "featured_thanksgiving_1"],
  aidreamcapes: ["featured_pack_1", "featured_christmas_1"]
};
const bestPageTemplateKeys = ["best-packages", "best-ai-image", "best-ai-video"];
const assetVersion = "20260801visualfix1";
const aidreamAssetVersion = "20260801visualfix2";

const rawArgs = process.argv.slice(2);
const flags = new Set();
const args = new Map();
for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
    continue;
  }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    flags.add(key);
  }
}
const dryRun = flags.has("dry-run");
const updateDb = flags.has("db");
const requestedStoreKey = String(args.get("site") ?? args.get("store") ?? "all").trim().toLowerCase();

function versioned(pathname, version = assetVersion) {
  return `${pathname}?v=${version}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function section(type, settings, blocks = []) {
  return { type, settings, blocks };
}

function block(id, type, settings) {
  return { id, type, settings };
}

const myAssets = {
  flowPrivateAlbumWorkspace: "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png",
  reviewAvaAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-ava-avatar.png",
  reviewLucasAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-lucas-avatar.png",
  reviewMiaAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-mia-avatar.png",
  reviewNoahAvatar: "/assets/dreamshoot/generated/20260622-homepage-unique/review-noah-avatar.png",
  womanPortrait: "/assets/dreamshoot/beauty-portrait-gpt2.png",
  selfie: "/assets/dreamshoot/frames/faq-intro-portrait.png",
  galleryWorldCupFanThree: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03.webp",
  galleryGalaTwo: "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02.webp",
  galleryChristmasCoupleTwo: "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-02.webp",
  galleryCreatorOne: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp",
  galleryCreatorTwo: "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-02.webp",
  galleryThanksgiving: versioned("/assets/dreamshoot/generated/pack-covers/thanksgiving-group-photos/thanksgiving-group-photos-cover.webp"),
  galleryHoliday: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260803safecover1"
};

const mydreamshootsTrustedLogoAssetBase = "/assets/dreamshoot/brand/trusted-creators-dark-v2";
const aidreamTrustedLogoAssetBase = "/assets/sites/site_aidreamcapes/trusted-logos";
const mydreamshootsAboutBody = "myDreamshoots is an AI photo and video studio produced by MRNARUEBET LLC. No studio, no outfits, no photographer, and nothing to book, just magic. Turn your selfies into stunning photo and video in seconds with myDreamshoots's: upload your photos, choose a theme, and create realistic headshots, creator portraits, fan photos, seasonal cards, private albums, and short video-ready images. Plans start at $24.50/month, and every package shows the credit cost before generation.";
const mydreamshootsTrustedLogoDefinitions = [
  { key: "ikraddy", name: "iKraddy", file: "01__ikraddy.webp" },
  { key: "beer", name: "Beer", file: "02__beer.webp" },
  { key: "fumei", name: "FUMEI", file: "03__fumei.webp" },
  { key: "mrlin", name: "MRLIN", file: "04__mrlin.webp" },
  { key: "popo", name: "POPO", file: "05__popo.webp" },
  { key: "mr-sdm", name: "MR.SDM", file: "06__mr-sdm.webp" },
  { key: "ezzy", name: "EZZY", file: "07__ezzy.webp" },
  { key: "xraz", name: "XRAZ", file: "08__xraz.webp" },
  { key: "giantdc", name: "Giantdc", file: "09__giantdc.webp" },
  { key: "smart-check", name: "SMART Check", file: "10__smart-check.webp" },
  { key: "jo", name: "JO", file: "11__jo.webp" },
  { key: "mashtacore", name: "Mashtacore", file: "12__mashtacore.webp" },
  { key: "fb", name: "FB", file: "13__fb.webp" },
  { key: "shurong-lim", name: "SHURONG LIM", file: "14__shurong-lim.webp" },
  { key: "coffee-swap", name: "COFFEE SWAP", file: "15__coffee-swap.webp" },
  { key: "heart-beat", name: "HEART BEAT", file: "16__heart-beat.webp" },
  { key: "chinawuzhougem", name: "CHINAWUZHOUGEM", file: "17__chinawuzhougem.webp" },
  { key: "tosaco", name: "TOSACO", file: "18__tosaco.webp" },
  { key: "monkey", name: "Monkey", file: "19__monkey.webp" },
  { key: "yu-kidsrooms", name: "YU kidsrooms", file: "20__yu-kidsrooms.webp" },
  { key: "yx", name: "YX", file: "21__yx.webp" },
  { key: "laboom", name: "LABOOM", file: "22__laboom.webp" },
  { key: "moonpizza", name: "MOONPIZZA", file: "23__moonpizza.webp" },
  { key: "observer", name: "OBSERVER", file: "24__observer.webp" },
  { key: "anteater", name: "Anteater", file: "25__anteater.webp" },
  { key: "prevence", name: "Prevence", file: "26__prevence.webp" },
  { key: "bison", name: "BISON", file: "27__bison.webp" },
  { key: "hana-pet", name: "HANA PET", file: "28__hana-pet.webp" },
  { key: "oficina", name: "Oficina", file: "29__oficina.webp" },
  { key: "panda-ber", name: "Panda BER", file: "30__panda-ber.webp" }
];
const trustedLogoDefinitions = [
  { key: "wliano", name: "Wliano", file: "39__wliano__wliano.com.png" },
  { key: "hmaxio", name: "Hmaxio", file: "13__hmaxio__hmaxio.co.za.png" },
  { key: "invorae", name: "Invorae", file: "14__invorae__invorae.com.png" },
  { key: "bolvian", name: "Bolvian", file: "03__bolvian__bolvian.co.za.png" },
  { key: "ravinr", name: "Ravinr", file: "24__ravinr__ravinr.co.za.png" },
  { key: "luntra", name: "Luntra", file: "19__luntra__luntra.co.za.png" },
  { key: "yaveno", name: "Yaveno", file: "44__yaveno__yaveno.co.za.png" },
  { key: "vkovel", name: "Vkovel", file: "37__vkovel__vkovel.com.webp" },
  { key: "orvinoe", name: "Orvinoe", file: "21__orvinoe__orvinoe.com.png" },
  { key: "elvorae", name: "Elvorae", file: "06__elvorae__elvorae.co.za.png" },
  { key: "trovic", name: "Trovic", file: "31__trovic__trovic.co.za.png" },
  { key: "aroveno", name: "Aroveno", file: "02__aroveno__aroveno.co.za.png" },
  { key: "ulvanx", name: "Ulvanx", file: "33__ulvanx__ulvanx.com.png" },
  { key: "kernivo", name: "Kernivo", file: "17__kernivo__kernivo.com.png" },
  { key: "bpickr", name: "Bpickr", file: "04__bpickr__bpickr.co.za.png" },
  { key: "jurvina", name: "Jurvina", file: "15__jurvina__jurvina.com.png" },
  { key: "zervino", name: "Zervino", file: "45__zervino__zervino.co.za.png" },
  { key: "harlivo", name: "Harlivo", file: "12__harlivo__harlivo.com.png" },
  { key: "qervon", name: "Qervon", file: "22__qervon__qervon.com.png" },
  { key: "zuvric", name: "Zuvric", file: "46__zuvric__zuvric.com.png" },
  { key: "urmino", name: "Urmino", file: "34__urmino__urmino.com.png" },
  { key: "wlivon", name: "Wlivon", file: "41__wlivon__wlivon.com.png" },
  { key: "rpfira", name: "Rpfira", file: "25__rpfira__rpfira.com.png" },
  { key: "klnova", name: "Klnova", file: "42__klnova__klnova.com.png" },
  { key: "qmarto", name: "Qmarto", file: "47__qmarto__xn--qmarto-220j.co.za.png" },
  { key: "folvian", name: "Folvian", file: "09__folvian__folvian.com.webp" },
  { key: "gmarto", name: "Gmarto", file: "10__gmarto__gmarto.co.za.png" },
  { key: "tuzemo", name: "Tuzemo", file: "32__tuzemo__tuzemo.com.png" },
  { key: "ervanoe", name: "Ervanoe", file: "07__ervanoe__ervanoe.com.webp" }
];

function trustedLogoBlocks(definitions, basePath, prefix) {
  return definitions.map(({ key, name, file }) =>
    block(`${prefix}${key}`, "logo", { name, imageUrl: `${basePath}/${file}`, badge: "Creator proof" })
  );
}

const mydreamshootsTrustedLogoBlocks = trustedLogoBlocks(mydreamshootsTrustedLogoDefinitions, mydreamshootsTrustedLogoAssetBase, "trusted_logo_");
const aidreamcapesTrustedLogoBlocks = trustedLogoBlocks(trustedLogoDefinitions, aidreamTrustedLogoAssetBase, "aidream_trusted_logo_");

const aidreamAssets = {
  hero: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/private-fan-scene-album.webp", aidreamAssetVersion),
  fan: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/private-fan-scene-album.webp", aidreamAssetVersion),
  gameDay: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/game-day-group-portraits.webp", aidreamAssetVersion),
  premiere: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/premiere-flash-portraits.webp", aidreamAssetVersion),
  christmas: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/christmas-group-album.webp", aidreamAssetVersion),
  thanksgiving: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/thanksgiving-keepsake-table-set.webp", aidreamAssetVersion),
  halloween: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/halloween-party-portrait-set.webp", aidreamAssetVersion),
  seasonal: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/covers/seasonal-celebration-photo-set.webp", aidreamAssetVersion),
  gallery: versioned("/assets/sites/site_aidreamcapes/fan-holiday-theme/gallery/private-fan-scene-album-01.webp", aidreamAssetVersion)
};

const stores = [
  {
    key: "mydreamshoots",
    siteId: "site_dreamshoot",
    siteSlug: "mydreamshoots",
    heroSettings: null,
    packageSettings: {
      anchor: "packages",
      label: "AI PHOTO STUDIOS",
      title: "Professional AI Photo Packages",
      subtitle: "Whether solo or with a partner, you can create stunning AI photo albums in just one click with myDreamshoots's themed photo packs. We've curated the best poses, outfit ideas, and hairstyles for you. Plus, we're always adding new photo packs to our collection. Send a ❤️ to a special someone. Or use it just for fun!",
      directoryLabel: "AI PHOTO THEMED",
      directorySubtitle: "Use your own creativity surprise your partner with a romantic video or photo."
    },
    pricingSettings: {
      title: "Subscription Plans",
      subtitle: "Choose the plan that works for you",
      marketComparison: "The average professional photoshoot can cost around $725. myDreamshoots keeps plan selection simple with monthly or quarterly and semiannually subscriptions.",
      description: "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.",
      sidePanelEyebrow: "Why people subscribe",
      sidePanelTitle: "Our plans starts from $24.50 and are designed to be more affordable and flexible.",
      sidePanelBody: "Credits stay predictable while packs stay flexible. You can generate private photo albums after reviewing credits, keep credit use predictable, and top up only when they need more runs."
    },
    generationSettings: {
      anchor: "generated-showcase",
      showTrustedLogoIntro: true,
      trustedLogoTitle: "Most Trusted Creators. | myDreamshoots",
      aboutTitle: "What is myDreamshoots?",
      aboutBody: mydreamshootsAboutBody,
      embeddedPricingSectionId: "pricing_1",
      trustedLogoSplitIndex: 15,
      eyebrow: "Customer-created examples",
      title: "Browse image and video themes customers have already created.",
      subtitle: "These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Best Photo Generator",
      imageAllLabel: "VIEW ALL PHOTO",
      imageAllHref: "/best-ai-image",
      videoTitle: "Best Video Generator",
      videoAllLabel: "VIEW ALL VIDEO",
      videoAllHref: "/best-ai-video",
      primaryCta: "Start with your photos",
      primaryHref: "/app/create",
      imageSlugs: "world-cup-fan-photos|christmas-couple|christmas-photos|creator-portraits|gala-photos|holiday|professional-headshots|cyberpunk",
      videoSlugs: "cinematic-portrait-motion|social-profile-clip|travel-route-story|wedding-memory-film|holiday-card-motion|product-showcase-motion|prompt-directed-motion|creator-intro-motion",
      videoItemLimit: 8
    },
    generationBlocks: mydreamshootsTrustedLogoBlocks,
    featuredPack: section("dreamshoot_featured_pack", {
      anchor: "featured-pack",
      label: "Recommended seasonal pack",
      badge: "Current seasonal pick",
      title: "World Cup fan photos for sports-idol style moments.",
      subtitle: "Compare a focused campaign direction before browsing the full catalog. Turn approved selfies into fan meetups, stadium-style group photos, match-day posters, and private albums.",
      primaryCta: "Create Fan Photos",
      primaryHref: "/login",
      secondaryCta: "View all themes",
      secondaryHref: "/collections",
      photos: "Private gallery",
      credits: "26 credits",
      privacy: "Approved uploads",
      includedTitle: "Recommended outputs",
      includedOutputs: "Fan meetup photos|Group-friendly shots for match day|Stadium portraits|Profile-ready avatars|Social banners|Private album downloads",
      safetyCopy: "Fan-safe styling: no real player or celebrity likenesses, official team logos, event marks, or protected brand assets without permission.",
      overlayTitle: "World Cup fan pack",
      overlaySubtitle: "A focused sports direction to compare first.",
      overlayChips: "fan meetup|group shot|stadium|social-ready",
      bottomNote: "Recommendations can rotate around tournaments, Christmas, Thanksgiving, Halloween, and personal fan-photo moments.",
      campaignLabel: "Current recommendation: World Cup Fan Photos",
      nextCampaignLabel: "Next: Christmas / Thanksgiving / Halloween"
    }, [
      block("featured_worldcup_stadium", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: myAssets.galleryWorldCupFanThree, collectionSlug: "soccer", shape: "square" }),
      block("featured_worldcup_gala", "seasonal_image", { label: "Fan Meetup Photos", meta: "Group-friendly shots", imageUrl: myAssets.galleryGalaTwo, collectionSlug: "gala-photo", shape: "square" }),
      block("featured_worldcup_christmas", "seasonal_image", { label: "Seasonal Card Direction", meta: "Holiday campaign option", imageUrl: myAssets.galleryChristmasCoupleTwo, collectionSlug: "christmas-photo", shape: "square" }),
      block("featured_worldcup_creator", "seasonal_image", { label: "Creator Profile Crop", meta: "Social-ready portrait", imageUrl: myAssets.galleryCreatorOne, collectionSlug: "portrait-photo", shape: "square" }),
      block("featured_worldcup_thanksgiving", "seasonal_image", { label: "Thanksgiving Keepsake", meta: "Warm group album", imageUrl: myAssets.galleryThanksgiving, collectionSlug: "thanksgiving-photo", shape: "square" }),
      block("featured_worldcup_holiday", "seasonal_image", { label: "Holiday Cover", meta: "Private album art", imageUrl: myAssets.galleryHoliday, collectionSlug: "holiday", shape: "square" })
    ]),
    tutorial: section("video_feature", {
      anchor: "ai-image-tutorial",
      eyebrow: "AI image tutorial",
      title: "Create an AI photo set from source photos.",
      subtitle: "Watch the signed-in flow: choose a photo package, upload a clear source photo, review audience, credits, and selected uploads, start generation, refresh the workspace, and open the finished image.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-20260814.jpg",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-20260814.mp4",
      videoBadge: "AI photo generation",
      playLabel: "Watch the myDreamshoots AI image tutorial"
    }),
    imageTutorial: section("video_feature", {
      anchor: "ai-video-tutorial",
      eyebrow: "AI video tutorial",
      title: "Turn selected images into a private AI video.",
      subtitle: "Watch the image-to-video flow: upload frame images, choose the video mode, set the aspect ratio and duration, generate the clip, and preview the finished motion result.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-video-tutorial-20260814.jpg",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-video-tutorial-20260814.mp4",
      videoBadge: "AI image-to-video",
      playLabel: "Watch the myDreamshoots AI video tutorial"
    }),
    mobile: section("mobile_video_showcase", {
      anchor: "mobile-video-tutorial",
      eyebrow: "Mobile tutorial",
      title: "How it works",
      subtitle: "Upload selfies and start creating your AI photshoot now",
      supportingCopy: "Use myDreamshoots's AI Video design your videos with your own creativity. Your next video content can instantly go viral.",
      imageUrl: myAssets.flowPrivateAlbumWorkspace,
      imageAlt: "Mobile myDreamshoots workspace screen showing private source-photo setup, credit review, and finished AI photo gallery steps.",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-45s.mp4?v=20260806mobile45a",
      videoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-45s.jpg?v=20260806mobile45a",
      videoBadge: "Mobile workflow",
      playLabel: "Watch the video tutorial",
      leftTitle: "AI image tutorial",
      leftVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-mobile-tutorial-55s.mp4?v=20260806chooserfix1",
      leftVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-mobile-tutorial-55s.jpg?v=20260806chooserfix1",
      leftPlayLabel: "Watch the image tutorial",
      rightTitle: "AI video tutorial",
      rightVideoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-mobile-tutorial-55s.mp4?v=20260806mobile55a",
      rightVideoPoster: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-mobile-tutorial-55s.jpg?v=20260806mobile55a",
      rightPlayLabel: "Watch the video tutorial",
      placeholderTitle: "Mobile tutorial coming soon",
      placeholderBody: "The vertical mobile walkthrough will appear here when the final file is ready."
    }),
    reviews: section("testimonial_wall", {
      anchor: "reviews",
      mode: "reviews",
      title: "What Our Customers Say",
      subtitle: "Our users love us and we love them!",
      summaryTitle: "What Our Customers Say",
      summaryBody: "myDreamshoots is an AI photo and video creator platform with creativity creators from all over the world. Creators are not simply content distributors. At their best, they are brokers of trust.",
      summaryRating: "",
      summaryMeta: ""
    }, [
      block("review_ava", "testimonial", { quote: "The package cards made it easy to pick a direction before I spent credits. My sports fan set looked polished and stayed organized in one private gallery.", name: "Ava M.", role: "Sports fan album", location: "Fan photos", rating: "5", avatarUrl: myAssets.reviewAvaAvatar, resultImageUrl: myAssets.galleryWorldCupFanThree }),
      block("review_lucas", "testimonial", { quote: "I needed profile images for a launch week. The VIP-style portraits gave me several usable looks without arranging a shoot or chasing edits.", name: "Lucas R.", role: "Creator portraits", location: "VIP-style set", rating: "5", avatarUrl: myAssets.reviewLucasAvatar, resultImageUrl: myAssets.galleryGalaTwo }),
      block("review_mia", "testimonial", { quote: "The Christmas couple pack saved a lot of time. We compared the theme first, checked credits, then downloaded card-ready images from the gallery.", name: "Mia C.", role: "Holiday cards", location: "Christmas album", rating: "5", avatarUrl: myAssets.reviewMiaAvatar, resultImageUrl: myAssets.galleryChristmasCoupleTwo }),
      block("review_noah", "testimonial", { quote: "My favorite part is the workflow. Upload, choose a package, approve the cost, and the finished set is easy to review with the rest of my account history.", name: "Noah P.", role: "Private gallery user", location: "Credit planning", rating: "5", avatarUrl: myAssets.reviewNoahAvatar, resultImageUrl: myAssets.flowPrivateAlbumWorkspace }),
      block("review_chloe", "testimonial", { quote: "The theme labels helped me explain options to a client. We tested creator portraits, holiday images, and short motion ideas from the same source photos.", name: "Chloe S.", role: "Social seller", location: "Creator workflow", rating: "5", avatarUrl: myAssets.womanPortrait, resultImageUrl: myAssets.galleryCreatorOne }),
      block("review_eli", "testimonial", { quote: "Good quality, clear wording, and no confusing checkout surprise. I knew what each generation would use before starting the album.", name: "Eli T.", role: "Small team admin", location: "Headshots and cards", rating: "5", avatarUrl: myAssets.selfie, resultImageUrl: myAssets.galleryCreatorTwo })
    ]),
    faq: mydreamshootsFaqSection(),
    conversion: section("conversion_panel", {
      anchor: "start",
      eyebrow: "BEST AI MAKER",
      title: "Ready to try the myDreamshoots's Best AI Maker?",
      subtitle: "We've designed myDreamshoots to be as easy as possible to use, allowing you to focus on unleashing your creativity with complete peace of mind. Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.",
      primaryCta: "Create my first photo set",
      primaryHref: "/login",
      secondaryCta: "Choose a plan",
      secondaryHref: "/pricing"
    }, [
      block("cta_metric_credits", "stat", { value: "200", label: "starter credits" }),
      block("cta_metric_styles", "stat", { value: "15+", label: "live scene packs" }),
      block("cta_metric_private", "stat", { value: "Private", label: "uploads and albums" })
    ]),
    partnerStrip: section("brand_logo_strip", {
      anchor: "trusted",
      title: "For creators, photographers, social sellers, studios, fan communities, and small teams.",
      style: "dark"
    }, [
      block("partner_creator_teams", "logo", { name: "Creator teams", imageUrl: "", badge: "Content" }),
      block("partner_photo_studios", "logo", { name: "Photo studios", imageUrl: "", badge: "Studio" }),
      block("partner_social_sellers", "logo", { name: "Social sellers", imageUrl: "", badge: "Commerce" }),
      block("partner_fan_pages", "logo", { name: "Fan pages", imageUrl: "", badge: "Community" }),
      block("partner_event_marketers", "logo", { name: "Event marketers", imageUrl: "", badge: "Campaigns" }),
      block("partner_holiday_shops", "logo", { name: "Holiday shops", imageUrl: "", badge: "Seasonal" }),
      block("partner_creator_coaches", "logo", { name: "Creator coaches", imageUrl: "", badge: "Guides" }),
      block("partner_small_teams", "logo", { name: "Small teams", imageUrl: "", badge: "Profiles" })
    ])
  },
  {
    key: "aidreamcapes",
    siteId: "site_aidreamcapes",
    siteSlug: "aidreamcapes",
    preserveExistingCopy: true,
    heroSettings: {
      anchor: "home",
      eyebrow: "",
      headline: "Create private fan-scene, game-day, and holiday albums from approved photos.",
      subheadline: "Upload photos you own or have permission to use, then build private fan-scene albums, game-day group portraits, premiere-inspired looks, Christmas keepsakes, Thanksgiving table sets, Halloween party portraits, and seasonal celebration images. Credit costs are shown before generation starts, and finished albums stay in your signed-in Aidreamcapes gallery.",
      imageUrl: aidreamAssets.hero,
      secondaryImageUrl: aidreamAssets.gameDay,
      tertiaryImageUrl: aidreamAssets.premiere,
      heroGridImages: [aidreamAssets.fan, aidreamAssets.gameDay, aidreamAssets.premiere, aidreamAssets.christmas, aidreamAssets.thanksgiving, aidreamAssets.halloween, aidreamAssets.seasonal, aidreamAssets.gallery].join("|"),
      bulletList: "Upload approved source photos.|Choose fan-scene, game-day, premiere, or holiday albums.|Review credits before generation starts.|Download finished images from your private gallery.",
      highlightWord: "private",
      heroBadge: "AI occasion album studio",
      authRibbon: "Plans start at $24.50/month",
      authPrimaryLabel: "Continue with email",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create account with email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      imageBadge: "Fan and holiday album categories",
      imageCaption: "Choose an occasion album, then generate a private gallery.",
      socialProofLabel: "Approved uploads and visible credit costs",
      layout: "immersive_dark"
    },
    packageSettings: {
      anchor: "packages",
      label: "Occasion album catalog",
      title: "Choose an Aidreamcapes album direction first.",
      subtitle: "Every album card explains the look, source-photo expectations, credit cost, and boundaries before you begin. Browse fan scenes, game-day portraits, premiere-inspired sets, Christmas albums, Thanksgiving memory sets, Halloween party portraits, and seasonal celebration photos.",
      tabs: "All|Fan Scenes|Game Day|Premiere|Christmas|Thanksgiving|Halloween|Seasonal",
      steps: "Pick album|See credit cost|Generate gallery",
      source: "creative_packs",
      featuredCount: 12
    },
    generationSettings: {
      anchor: "generated-showcase",
      showTrustedLogoIntro: true,
      trustedLogoTitle: "Trusted by Aidreamcapes creators worldwide",
      aboutTitle: "What is Aidreamcapes?",
      aboutBody: "Aidreamcapes is an AI photo and video studio: upload your photos, choose a theme, and create realistic headshots, creator portraits, fan photos, seasonal cards, private albums, and short video-ready images. There is no photographer to book; you review credits before generation, keep uploads private, and download finished results from your private gallery. Plans start at $24.50/month, and every package shows the credit cost before generation.",
      embeddedPricingSectionId: "pricing_1",
      trustedLogoSplitIndex: 15,
      eyebrow: "Customer-created examples",
      title: "Browse Aidreamcapes image and video themes customers have already created.",
      subtitle: "These Aidreamcapes examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Best Photo Generator",
      imageAllLabel: "View all photos",
      imageAllHref: "/best-ai-image",
      videoTitle: "Best Video Generator",
      videoAllLabel: "View all videos",
      videoAllHref: "/best-ai-video",
      primaryCta: "Start with your photos",
      primaryHref: "/app/create",
      imageSlugs: "fan-scene-albums|game-day-group-photos|stadium-night-fan-sets|premiere-style-portraits|christmas-holiday-albums|thanksgiving-memory-sets|halloween-party-portraits|seasonal-celebration-photos",
      videoSlugs: "route-atlas-motion|coastal-memory-clip|old-quarter-walkthrough|resort-balcony-motion|scenic-overlook-pan|alpine-trail-motion|solo-traveler-profile-clip|heritage-celebration-film",
      videoItemLimit: 8
    },
    generationBlocks: aidreamcapesTrustedLogoBlocks,
    featuredPack: section("dreamshoot_featured_pack", {
      anchor: "featured-pack",
      label: "Recommended occasion album",
      badge: "Current seasonal pick",
      title: "Christmas and game-day albums for the next campaign.",
      subtitle: "Compare a focused occasion direction before browsing the full catalog. Start with approved source photos, review the credit cost, and keep the finished gallery private.",
      primaryCta: "Create this album",
      primaryHref: "/login",
      secondaryCta: "View all themes",
      secondaryHref: "/collections",
      photos: "Private gallery",
      credits: "20-24 credits",
      privacy: "Approved uploads",
      includedTitle: "Recommended directions",
      includedOutputs: "Game-day group portraits|Watch-party and supporter scenes|Christmas holiday albums|Card-ready festive crops|Premiere-inspired portraits|Private occasion keepsakes",
      safetyCopy: "Use photos you own or have permission to use. Aidreamcapes does not recreate public-figure likenesses, official marks, logos, or protected event artwork without permission.",
      overlayTitle: "Occasion picks",
      overlaySubtitle: "A small set of seasonal directions to compare first.",
      overlayChips: "game day|Christmas|premiere|private",
      bottomNote: "Recommendations can rotate around tournaments, holidays, celebrations, and local campaign needs.",
      campaignLabel: "Current recommendation: Game day + Christmas",
      nextCampaignLabel: "Next: Premiere / Thanksgiving / Halloween"
    }, [
      block("aidream_featured_game_day", "seasonal_image", { label: "Game-Day Group Portraits", meta: "Supporter scenes", imageUrl: aidreamAssets.gameDay, collectionSlug: "game-day-group-photos", shape: "square" }),
      block("aidream_featured_christmas", "seasonal_image", { label: "Christmas Holiday Albums", meta: "Card-ready mood", imageUrl: aidreamAssets.christmas, collectionSlug: "christmas-holiday-albums", shape: "square" }),
      block("aidream_featured_premiere", "seasonal_image", { label: "Premiere-Inspired Portraits", meta: "Spotlight arrivals", imageUrl: aidreamAssets.premiere, collectionSlug: "premiere-style-portraits", shape: "square" }),
      block("aidream_featured_fan", "seasonal_image", { label: "Private Fan-Scene Album", meta: "Approved group photos", imageUrl: aidreamAssets.fan, collectionSlug: "fan-scene-albums", shape: "square" }),
      block("aidream_featured_thanksgiving", "seasonal_image", { label: "Thanksgiving Keepsakes", meta: "Warm table scenes", imageUrl: aidreamAssets.thanksgiving, collectionSlug: "thanksgiving-memory-sets", shape: "square" }),
      block("aidream_featured_seasonal", "seasonal_image", { label: "Seasonal Celebration Photos", meta: "Rotating campaign pick", imageUrl: aidreamAssets.seasonal, collectionSlug: "seasonal-celebration-photos", shape: "square" })
    ]),
    tutorial: section("video_feature", {
      anchor: "how-it-works",
      eyebrow: "How it works",
      title: "See how an Aidreamcapes occasion album is planned.",
      subtitle: "Start with approved source photos, choose a fan-scene or holiday direction, confirm the visible credit cost, and keep finished images inside your private Aidreamcapes gallery.",
      imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-tutorial-55s.jpg?v=20260804resultfix2",
      videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4?v=20260804resultfix2",
      videoBadge: "Occasion album workflow",
      playLabel: "Watch the Aidreamcapes workflow"
    }),
    imageTutorial: section("video_feature", {
      anchor: "ai-image-tutorial",
      eyebrow: "AI image tutorial",
      title: "Create a private fan-scene image album.",
      subtitle: "Follow the Aidreamcapes workspace flow: choose a fan-scene album, add approved source photos, review the album details and credit cost, start generation, refresh All assets, and open the finished image.",
      imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260805imagepreview1",
      videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260805imagepreview1",
      videoBadge: "AI image album workflow",
      playLabel: "Watch the Aidreamcapes AI image tutorial"
    }),
    mobile: section("mobile_video_showcase", {
      anchor: "mobile-video-tutorial",
      eyebrow: "Mobile tutorial",
      title: "Aidreamcapes mobile private album preview.",
      subtitle: "Compare portrait intake and album review steps in a vertical phone layout.",
      imageUrl: aidreamAssets.gallery,
      imageAlt: "Mobile Aidreamcapes private album screen showing approved source-photo intake, fan-scene review, and finished gallery delivery.",
      videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
      videoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
      videoBadge: "Mobile workflow",
      playLabel: "Watch the video tutorial",
      leftTitle: "AI image tutorial",
      leftVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-mobile-tutorial-55s.mp4?v=20260804mobile1",
      leftVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-mobile-tutorial-55s.jpg?v=20260804mobile1",
      leftPlayLabel: "Watch the image tutorial",
      rightTitle: "AI video tutorial",
      rightVideoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-mobile-tutorial-55s.mp4?v=20260804mobile1",
      rightVideoPoster: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-mobile-tutorial-55s.jpg?v=20260804mobile1",
      rightPlayLabel: "Watch the video tutorial",
      placeholderTitle: "Mobile tutorial coming soon",
      placeholderBody: "The vertical mobile walkthrough will appear here when the final file is ready."
    }),
    reviews: section("testimonial_wall", {
      anchor: "reviews",
      mode: "reviews",
      title: "Positive words from Aidreamcapes customers.",
      subtitle: "Customers mention the private album flow, clear occasion categories, fan-safe boundaries, and simple credit review before generation.",
      summaryTitle: "Occasion albums feel easy to plan.",
      summaryBody: "Aidreamcapes helps fan communities, event planners, creators, and holiday sellers build private album ideas without handling protected marks or public-figure likenesses.",
      summaryRating: "4.8/5",
      summaryMeta: "Occasion album feedback"
    }, [
      block("aidream_review_maya", "testimonial", { quote: "The fan-scene album made our group photos feel planned instead of random. I liked seeing the credit cost before the request started.", name: "Maya L.", role: "Fan community admin", location: "Private fan scene", rating: "5", avatarUrl: aidreamAssets.fan, resultImageUrl: aidreamAssets.gallery }),
      block("aidream_review_owen", "testimonial", { quote: "Game-day portraits were easy to brief. The site kept the boundaries clear, so we avoided logos and still got a strong match-day mood.", name: "Owen K.", role: "Event organizer", location: "Game day album", rating: "5", avatarUrl: aidreamAssets.gameDay, resultImageUrl: aidreamAssets.gameDay }),
      block("aidream_review_lena", "testimonial", { quote: "I used the premiere look for creator posts. The examples helped me choose the right direction before I uploaded source photos.", name: "Lena V.", role: "Creator", location: "Premiere portraits", rating: "5", avatarUrl: aidreamAssets.premiere, resultImageUrl: aidreamAssets.premiere }),
      block("aidream_review_sam", "testimonial", { quote: "Christmas albums came together quickly for our seasonal shop. The finished images were easy to review and download from one private space.", name: "Sam D.", role: "Holiday seller", location: "Christmas group album", rating: "5", avatarUrl: aidreamAssets.christmas, resultImageUrl: aidreamAssets.christmas }),
      block("aidream_review_nora", "testimonial", { quote: "The Thanksgiving set had the warm mood we wanted. It felt useful for planning cards, table scenes, and private keepsakes.", name: "Nora H.", role: "Family album planner", location: "Thanksgiving set", rating: "5", avatarUrl: aidreamAssets.thanksgiving, resultImageUrl: aidreamAssets.thanksgiving }),
      block("aidream_review_ian", "testimonial", { quote: "I appreciate that Aidreamcapes explains approved photos and protected-mark limits in plain language. It makes the creative brief much safer.", name: "Ian B.", role: "Community creator", location: "Seasonal albums", rating: "5", avatarUrl: aidreamAssets.seasonal, resultImageUrl: aidreamAssets.seasonal })
    ]),
    faq: aidreamcapesFaqSection(),
    partnerStrip: section("brand_logo_strip", {
      anchor: "trusted",
      title: "Aidreamcapes for fan communities, event planners, holiday sellers, creator teams, and local studios.",
      style: "dark"
    }, [
      block("aidream_partner_fan_communities", "logo", { name: "Fan communities", imageUrl: "", badge: "Groups" }),
      block("aidream_partner_event_planners", "logo", { name: "Event planners", imageUrl: "", badge: "Occasions" }),
      block("aidream_partner_holiday_sellers", "logo", { name: "Holiday sellers", imageUrl: "", badge: "Seasonal" }),
      block("aidream_partner_creator_teams", "logo", { name: "Creator teams", imageUrl: "", badge: "Content" }),
      block("aidream_partner_local_studios", "logo", { name: "Local studios", imageUrl: "", badge: "Photo" }),
      block("aidream_partner_newsletters", "logo", { name: "Newsletter teams", imageUrl: "", badge: "Audience" }),
      block("aidream_partner_watch_parties", "logo", { name: "Watch parties", imageUrl: "", badge: "Game day" }),
      block("aidream_partner_card_shops", "logo", { name: "Card shops", imageUrl: "", badge: "Keepsakes" })
    ])
  }
];

function mydreamshootsFaqSection() {
  return clone(dreamshootAiStudioTemplatesForSite().home.sections.faq_1);
}

function aidreamcapesFaqSection() {
  return clone(dreamshootAiStudioTemplatesForSite({
    slug: "aidreamcapes",
    name: "Aidreamcapes",
    primaryDomain: "www.aidreamcapes.com",
    branding: { logoText: "Aidreamcapes" }
  }).home.sections.faq_1);
}

async function readState() {
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

function findSite(state, store) {
  return (state.sites ?? []).find((site) => site.id === store.siteId || site.slug === store.siteSlug);
}

function homePageForSite(site) {
  return site?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
}

function settingText(section, key) {
  const value = section?.settings?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function firstSeasonalBlockImage(section) {
  return (section?.blocks ?? [])
    .map((block) => block?.settings?.imageUrl)
    .find((value) => typeof value === "string" && value.trim());
}

function uniqueStringList(values) {
  const seen = new Set();
  return values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

function trustedLogoBlocksFromSection(section) {
  const blocks = section?.blocks ?? [];
  return blocks
    .filter((block) => block?.type === "logo")
    .map((block, index) => ({
      ...clone(block),
      id: `trusted_${block.id || `logo_${index + 1}`}`,
      type: "logo"
    }));
}

function aidreamcapesFaqImages(sections) {
  const primaryImage = firstSeasonalBlockImage(sections.featured_christmas_1) ||
    firstSeasonalBlockImage(sections.featured_pack_1) ||
    settingText(sections.hero_1, "imageUrl");
  const imageList = uniqueStringList([
    firstSeasonalBlockImage(sections.featured_christmas_1),
    firstSeasonalBlockImage(sections.featured_thanksgiving_1),
    firstSeasonalBlockImage(sections.featured_pack_1),
    settingText(sections.hero_1, "imageUrl"),
    settingText(sections.hero_1, "secondaryImageUrl"),
    settingText(sections.hero_1, "tertiaryImageUrl")
  ]).filter((value) => value.startsWith("/assets/sites/site_aidreamcapes/"));
  return { primaryImage, imageList };
}

function applyFeaturedThanksgivingToHomeSections(sections, featuredSections) {
  if (featuredSections?.featured_thanksgiving_1) {
    sections.featured_thanksgiving_1 = clone(featuredSections.featured_thanksgiving_1);
  }
}

function applyAidreamcapesArchitectureOnly(pageJson, store, featuredSections = {}) {
  if (!pageJson?.sections) return false;
  const sections = pageJson.sections;
  const generation = sections.generation_showcase_1 ?? { type: "dreamshoot_generation_showcase", settings: {}, blocks: [] };
  const generationSourceSettings = clone(store.generationSettings ?? {});
  const generationSettings = {
    ...generation.settings,
    ...generationSourceSettings,
    anchor: generationSourceSettings.anchor ?? generation.settings?.anchor ?? "generated-showcase",
    embeddedPricingSectionId: "pricing_1",
    videoItemLimit: Number(generationSourceSettings.videoItemLimit ?? generation.settings?.videoItemLimit ?? generation.settings?.itemLimit ?? 8) || 8
  };
  delete generationSettings.itemLimit;

  const trustedBlocks = clone(store.generationBlocks ?? trustedLogoBlocksFromSection(store.partnerStrip));
  const aboutTitle = settingText({ settings: generationSettings }, "aboutTitle");
  const aboutBody = settingText({ settings: generationSettings }, "aboutBody");
  if (trustedBlocks.length && aboutTitle && aboutBody) {
    generationSettings.showTrustedLogoIntro = true;
    generationSettings.trustedLogoTitle = settingText({ settings: generationSettings }, "trustedLogoTitle") || settingText(store.partnerStrip, "title");
    generationSettings.trustedLogoSplitIndex = Math.max(
      1,
      Math.min(trustedBlocks.length - 1, Number(generationSettings.trustedLogoSplitIndex ?? Math.ceil(trustedBlocks.length / 2)) || Math.ceil(trustedBlocks.length / 2))
    );
    generationSettings.aboutTitle = aboutTitle;
    generationSettings.aboutBody = aboutBody;
  } else {
    generationSettings.showTrustedLogoIntro = false;
    delete generationSettings.trustedLogoTitle;
    delete generationSettings.trustedLogoSplitIndex;
    delete generationSettings.aboutTitle;
    delete generationSettings.aboutBody;
  }

  sections.generation_showcase_1 = {
    ...generation,
    type: "dreamshoot_generation_showcase",
    settings: generationSettings,
    blocks: trustedBlocks
  };

  if (sections.package_catalog_1) {
    sections.package_catalog_1 = {
      ...sections.package_catalog_1,
      settings: {
        ...sections.package_catalog_1.settings,
        featuredCount: 12
      }
    };
  }
  if (store.mobile) {
    sections.mobile_video_1 = clone(store.mobile);
  }
  applyFeaturedThanksgivingToHomeSections(sections, featuredSections);
  for (const sectionId of removedHomeSectionsByStore[store.key] ?? []) delete sections[sectionId];
  if (sections.proof_1) {
    sections.proof_1 = {
      ...sections.proof_1,
      settings: {
        ...sections.proof_1.settings,
        mode: "reviews"
      }
    };
  }
  if (sections.faq_1) {
    const faqImages = aidreamcapesFaqImages(sections);
    sections.faq_1 = {
      ...sections.faq_1,
      settings: {
        ...sections.faq_1.settings,
        layout: "visual_faq",
        ...(faqImages.primaryImage ? { imageUrl: faqImages.primaryImage } : {}),
        ...(faqImages.imageList.length ? { imageList: faqImages.imageList.join("|") } : {}),
        imageAlt: settingText(sections.faq_1, "imageAlt") || settingText(sections.faq_1, "subtitle"),
        imageListAlt: settingText(sections.faq_1, "imageListAlt") || settingText(sections.faq_1, "subtitle"),
        featureCaption: settingText(sections.faq_1, "featureCaption") || settingText(sections.faq_1, "subtitle")
      }
    };
  }

  const homeOrder = homeOrderByStore[store.key] ?? homeOrderByStore.mydreamshoots;
  pageJson.sectionsOrder = homeOrder.filter((sectionId) => Boolean(sections[sectionId]));
  return true;
}

function applyStoreSpecificExistingSections(pageJson, store, featuredSections = {}) {
  if (!pageJson?.sections) return false;
  if (store.preserveExistingCopy) return applyAidreamcapesArchitectureOnly(pageJson, store, featuredSections);
  const sections = pageJson.sections;
  const removedHomeSections = removedHomeSectionsByStore[store.key] ?? [];
  if (store.heroSettings && sections.hero_1) {
    sections.hero_1 = {
      ...sections.hero_1,
      settings: { ...sections.hero_1.settings, ...clone(store.heroSettings) }
    };
  }
  if (store.packageSettings && sections.package_catalog_1) {
    sections.package_catalog_1 = {
      ...sections.package_catalog_1,
      settings: { ...sections.package_catalog_1.settings, ...clone(store.packageSettings) }
    };
  }
  if (store.pricingSettings && sections.pricing_1) {
    sections.pricing_1 = {
      ...sections.pricing_1,
      settings: { ...sections.pricing_1.settings, ...clone(store.pricingSettings) }
    };
  }
  if (sections.package_catalog_1) {
    sections.package_catalog_1 = {
      ...sections.package_catalog_1,
      settings: {
        ...sections.package_catalog_1.settings,
        featuredCount: 12
      }
    };
  }
  const generationSettings = { ...(sections.generation_showcase_1?.settings ?? {}), ...clone(store.generationSettings) };
  delete generationSettings.itemLimit;
  sections.generation_showcase_1 = {
    ...(sections.generation_showcase_1 ?? { type: "dreamshoot_generation_showcase", blocks: [] }),
    type: "dreamshoot_generation_showcase",
    settings: generationSettings,
    blocks: clone(store.generationBlocks ?? [])
  };
  sections.tutorial_video_1 = clone(store.tutorial);
  sections.tutorial_video_2 = clone(store.imageTutorial);
  if (store.mobile && !removedHomeSections.includes("mobile_video_1")) {
    sections.mobile_video_1 = clone(store.mobile);
  } else {
    delete sections.mobile_video_1;
  }
  sections.proof_1 = clone(store.reviews);
  sections.faq_1 = clone(store.faq);
  if (store.conversion) {
    sections.conversion_1 = clone(store.conversion);
  }
  sections.brand_strip_1 = clone(store.partnerStrip);
  applyFeaturedThanksgivingToHomeSections(sections, featuredSections);
  for (const sectionId of removedHomeSections) delete sections[sectionId];
  const homeOrder = homeOrderByStore[store.key] ?? homeOrderByStore.mydreamshoots;
  pageJson.sectionsOrder = homeOrder.filter((sectionId) => Boolean(sections[sectionId]));
  return true;
}

function bestPageSlug(templateKey) {
  return `/${templateKey}`;
}

function bestPageTitle(templateKey) {
  if (templateKey === "best-ai-image") return "Best AI image";
  if (templateKey === "best-ai-video") return "Best AI video";
  return "Best Packages";
}

function bestPageIdSuffix(templateKey) {
  return templateKey.replaceAll("-", "_");
}

function bestPageTemplatesForSite(site) {
  return dreamshootAiStudioTemplatesForSite({
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    branding: site.branding
  });
}

function bestPageOgImage(site, json) {
  const sections = json?.sections ?? {};
  const homeSections = site.pages?.find((page) => page.slug === "/" || page.pageType === "home")?.publishedJson?.sections ?? {};
  return firstSeasonalBlockImage(sections.featured_pack_1) ||
    firstSeasonalBlockImage(sections.featured_christmas_1) ||
    firstSeasonalBlockImage(sections.featured_thanksgiving_1) ||
    site.themeSettings?.publishedJson?.seo?.defaultOgImage ||
    site.themeSettings?.draftJson?.seo?.defaultOgImage ||
    settingText(homeSections.hero_1, "heroVisualOverride") ||
    settingText(homeSections.hero_1, "imageUrl") ||
    settingText(homeSections.hero_1, "secondaryImageUrl") ||
    "";
}

function bestThemePageRecord(site, templateKey, json) {
  const slug = bestPageSlug(templateKey);
  const pageJson = clone(json);
  if (pageJson.seo && !pageJson.seo.ogImage) {
    const ogImage = bestPageOgImage(site, pageJson);
    if (ogImage) pageJson.seo = { ...pageJson.seo, ogImage };
  }
  return {
    id: `${site.id}_${bestPageIdSuffix(templateKey)}`,
    siteId: site.id,
    pageType: pageJson.pageType ?? "content",
    templateKey,
    slug,
    title: bestPageTitle(templateKey),
    draftJson: clone(pageJson),
    publishedJson: clone(pageJson)
  };
}

function upsertBestPagesForSite(site) {
  const templates = bestPageTemplatesForSite(site);
  let updates = 0;
  for (const templateKey of bestPageTemplateKeys) {
    const json = templates[templateKey];
    if (!json) continue;
    const nextPage = bestThemePageRecord(site, templateKey, json);
    const existingIndex = site.pages.findIndex((page) => page.slug === nextPage.slug);
    if (existingIndex >= 0) {
      site.pages[existingIndex] = { ...site.pages[existingIndex], ...nextPage, id: site.pages[existingIndex].id || nextPage.id };
    } else {
      const homeIndex = site.pages.findIndex((page) => page.slug === "/");
      site.pages.splice(homeIndex >= 0 ? homeIndex + 1 : site.pages.length, 0, nextPage);
    }
    updates += 1;
  }
  return updates;
}

function upsertBestTemplates(theme, site) {
  const templates = bestPageTemplatesForSite(site);
  theme.templates ??= {};
  let updates = 0;
  for (const templateKey of bestPageTemplateKeys) {
    if (!templates[templateKey]) continue;
    theme.templates[templateKey] = clone(templates[templateKey]);
    updates += 1;
  }
  return updates;
}

function upsertBestPagesInPublication(publication, site) {
  const pages = publication.snapshot?.pages;
  if (!Array.isArray(pages)) return 0;
  const templates = bestPageTemplatesForSite(site);
  let updates = 0;
  for (const templateKey of bestPageTemplateKeys) {
    const json = templates[templateKey];
    if (!json) continue;
    const page = bestThemePageRecord(site, templateKey, json);
    const snapshotPage = {
      id: page.id,
      siteId: page.siteId,
      pageType: page.pageType,
      templateKey: page.templateKey,
      slug: page.slug,
      title: page.title,
      draftJson: clone(page.draftJson),
      publishedJson: clone(page.publishedJson)
    };
    const existingIndex = pages.findIndex((item) => item.slug === snapshotPage.slug);
    if (existingIndex >= 0) pages[existingIndex] = { ...pages[existingIndex], ...snapshotPage, id: pages[existingIndex].id || snapshotPage.id };
    else {
      const homeIndex = pages.findIndex((item) => item.slug === "/");
      pages.splice(homeIndex >= 0 ? homeIndex + 1 : pages.length, 0, snapshotPage);
    }
    updates += 1;
  }
  return updates;
}

function refreshPublicationStats(publication) {
  if ("snapshotBytes" in publication) publication.snapshotBytes = Buffer.byteLength(JSON.stringify(publication.snapshot), "utf8");
  if ("pageCount" in publication) publication.pageCount = publication.snapshot?.pages?.length ?? publication.pageCount;
  if ("sectionCount" in publication) {
    publication.sectionCount = (publication.snapshot?.pages ?? []).reduce((count, page) => count + Object.keys(page.publishedJson?.sections ?? {}).length, 0);
  }
}

function applyStoreToState(state, store) {
  let pageUpdates = 0;
  let themeUpdates = 0;
  let publicationUpdates = 0;
  const site = findSite(state, store);
  const homePage = homePageForSite(site);
  if (!site || !homePage) throw new Error(`missing_home_page:${store.key}`);
  const featuredSections = bestPageTemplatesForSite(site)["best-packages"]?.sections ?? {};
  if (applyStoreSpecificExistingSections(homePage.draftJson, store, featuredSections)) pageUpdates += 1;
  if (applyStoreSpecificExistingSections(homePage.publishedJson, store, featuredSections)) pageUpdates += 1;
  pageUpdates += upsertBestPagesForSite(site);

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== store.siteId) continue;
    themeUpdates += upsertBestTemplates(theme, site);
    const template = theme.templates?.index;
    const templateOrder = Array.isArray(template?.sectionsOrder) ? template.sectionsOrder : template?.content_for_page;
    if (!template?.sections || !Array.isArray(templateOrder)) continue;
    const syntheticPage = {
      sections: template.sections,
      sectionsOrder: templateOrder
    };
    applyStoreSpecificExistingSections(syntheticPage, store, featuredSections);
    template.sectionsOrder = syntheticPage.sectionsOrder;
    template.content_for_page = syntheticPage.sectionsOrder;
    themeUpdates += 1;
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== store.siteId) continue;
    const snapshotHome = publication.snapshot?.pages?.find((page) => page.slug === "/");
    if (snapshotHome?.publishedJson && applyStoreSpecificExistingSections(snapshotHome.publishedJson, store, featuredSections)) {
      publicationUpdates += 1;
    }
    publicationUpdates += upsertBestPagesInPublication(publication, site);
    refreshPublicationStats(publication);
  }

  return { pageUpdates, themeUpdates, publicationUpdates };
}

async function updateDatabase(state, selectedStores) {
  const prisma = new PrismaClient();
  const report = { pages: 0, siteThemes: 0, publications: 0 };
  try {
    for (const store of selectedStores) {
      const site = findSite(state, store);
      const homePage = homePageForSite(site);
      if (homePage) {
        await prisma.themePage.updateMany({
          where: { siteId: store.siteId, slug: "/" },
          data: {
            draftJson: homePage.draftJson,
            publishedJson: homePage.publishedJson
          }
        });
        report.pages += 1;
      }
      for (const templateKey of bestPageTemplateKeys) {
        const page = site?.pages?.find((item) => item.slug === bestPageSlug(templateKey));
        if (!page) continue;
        await prisma.themePage.upsert({
          where: { siteId_slug: { siteId: store.siteId, slug: page.slug } },
          create: {
            id: page.id,
            siteId: store.siteId,
            pageType: page.pageType,
            templateKey: page.templateKey,
            slug: page.slug,
            title: page.title,
            draftJson: page.draftJson,
            publishedJson: page.publishedJson
          },
          update: {
            pageType: page.pageType,
            templateKey: page.templateKey,
            title: page.title,
            draftJson: page.draftJson,
            publishedJson: page.publishedJson
          }
        });
        report.pages += 1;
      }

      for (const theme of (state.siteThemes ?? []).filter((item) => item.siteId === store.siteId)) {
        await prisma.siteTheme.updateMany({
          where: { siteId: store.siteId, themeId: theme.themeId },
          data: { templates: theme.templates }
        });
        report.siteThemes += 1;
      }

      for (const publication of (state.themePublications ?? []).filter((item) => item.siteId === store.siteId)) {
        await prisma.themePublication.updateMany({
          where: { siteId: store.siteId, version: publication.version },
          data: { snapshot: publication.snapshot }
        });
        report.publications += 1;
      }
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = await readState();
  const report = {};
  const selectedStores = requestedStoreKey === "all"
    ? stores
    : stores.filter((store) => store.key === requestedStoreKey || store.siteSlug === requestedStoreKey || store.siteId === requestedStoreKey);
  if (!selectedStores.length) throw new Error(`unknown_store:${requestedStoreKey}`);
  for (const store of selectedStores) report[store.key] = applyStoreToState(state, store);
  if (!dryRun) await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const dbReport = updateDb && !dryRun ? await updateDatabase(state, selectedStores) : undefined;
  console.log(JSON.stringify({ dryRun, selectedStores: selectedStores.map((store) => store.key), report, dbReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
