#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const homeOrder = [
  "hero_1",
  "featured_pack_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "tutorial_video_2",
  "package_catalog_1",
  "proof_1",
  "pricing_1",
  "faq_1",
  "conversion_1",
  "brand_strip_1"
];
const removedHomeSections = [
  "visual_proof_1",
  "featured_christmas_1",
  "featured_thanksgiving_1",
  "flow_bridge_1",
  "trust_1"
];
const assetVersion = "20260801visualfix1";
const aidreamAssetVersion = "20260801visualfix2";

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2)));
const dryRun = flags.has("dry-run");
const updateDb = flags.has("db");

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
  galleryHoliday: "/assets/dreamshoot/generated/pack-covers/holiday/holiday-cover.webp?v=20260731themeuniqueness1"
};

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
    packageSettings: null,
    generationSettings: {
      anchor: "generated-showcase",
      eyebrow: "Customer-created examples",
      title: "Browse image and video themes customers have already created.",
      subtitle: "These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Customer image themes",
      videoTitle: "Customer video themes",
      primaryCta: "Start with your photos",
      primaryHref: "/login",
      imageSlugs: "world-cup-fan-photos|christmas-couple|christmas-photos|creator-portraits|gala-photos|holiday|professional-headshots|cyberpunk",
      videoSlugs: "cinematic-portrait-motion|social-profile-clip|creator-scene-motion|wedding-memory-film|holiday-card-motion|product-showcase-motion|prompt-directed-motion|creator-intro-motion",
      videoItemLimit: 8
    },
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
      block("featured_worldcup_stadium", "seasonal_image", { label: "Stadium Portrait", meta: "Cinematic fan look", imageUrl: myAssets.galleryWorldCupFanThree, shape: "square" }),
      block("featured_worldcup_gala", "seasonal_image", { label: "Fan Meetup Photos", meta: "Group-friendly shots", imageUrl: myAssets.galleryGalaTwo, shape: "square" }),
      block("featured_worldcup_christmas", "seasonal_image", { label: "Seasonal Card Direction", meta: "Holiday campaign option", imageUrl: myAssets.galleryChristmasCoupleTwo, shape: "square" }),
      block("featured_worldcup_creator", "seasonal_image", { label: "Creator Profile Crop", meta: "Social-ready portrait", imageUrl: myAssets.galleryCreatorOne, shape: "square" }),
      block("featured_worldcup_thanksgiving", "seasonal_image", { label: "Thanksgiving Keepsake", meta: "Warm group album", imageUrl: myAssets.galleryThanksgiving, shape: "square" }),
      block("featured_worldcup_holiday", "seasonal_image", { label: "Holiday Cover", meta: "Private album art", imageUrl: myAssets.galleryHoliday, shape: "square" })
    ]),
    tutorial: section("video_feature", {
      anchor: "how-it-works",
      eyebrow: "How it works",
      title: "Watch the private photo package workflow.",
      subtitle: "Upload photos you own, choose an AI photo package, review credits, generate the album, and download finished images from your private MyDreamShoots gallery.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-i2v-tutorial-45s.jpg?v=20260803assetfix2",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-i2v-tutorial-45s.mp4?v=20260803assetfix2",
      videoBadge: "Private gallery workflow",
      playLabel: "Watch the MyDreamShoots workflow"
    }),
    imageTutorial: section("video_feature", {
      anchor: "ai-image-tutorial",
      eyebrow: "AI image tutorial",
      title: "Create an AI photo set from source photos.",
      subtitle: "Watch the signed-in flow: choose a photo package, upload a clear source photo, review audience, credits, and selected uploads, start generation, refresh the workspace, and open the finished image.",
      imageUrl: "/assets/dreamshoot/generated/homepage-showcase/posters/mydreamshoots-ai-image-tutorial-55s.jpg?v=20260803aitutorial1",
      videoUrl: "/assets/dreamshoot/generated/homepage-showcase/videos/mydreamshoots-ai-image-tutorial-55s.mp4?v=20260803aitutorial1",
      videoBadge: "AI photo generation",
      playLabel: "Watch the MyDreamShoots AI image tutorial"
    }),
    reviews: section("testimonial_wall", {
      anchor: "reviews",
      mode: "reviews",
      title: "What customers like about MyDreamShoots.",
      subtitle: "Clear credit costs, realistic-looking themes, private galleries, and quick planning keep showing up in customer feedback.",
      summaryTitle: "Customers love the private gallery flow.",
      summaryBody: "Creators, small teams, sports fans, and holiday-card buyers use MyDreamShoots to test polished AI photo ideas before booking a studio or building a campaign.",
      summaryRating: "4.9/5",
      summaryMeta: "Customer feedback"
    }, [
      block("review_ava", "testimonial", { quote: "The package cards made it easy to pick a direction before I spent credits. My sports fan set looked polished and stayed organized in one private gallery.", name: "Ava M.", role: "Sports fan album", location: "Fan photos", rating: "5", avatarUrl: myAssets.reviewAvaAvatar, resultImageUrl: myAssets.galleryWorldCupFanThree }),
      block("review_lucas", "testimonial", { quote: "I needed profile images for a launch week. The VIP-style portraits gave me several usable looks without arranging a shoot or chasing edits.", name: "Lucas R.", role: "Creator portraits", location: "VIP-style set", rating: "5", avatarUrl: myAssets.reviewLucasAvatar, resultImageUrl: myAssets.galleryGalaTwo }),
      block("review_mia", "testimonial", { quote: "The Christmas couple pack saved a lot of time. We compared the theme first, checked credits, then downloaded card-ready images from the gallery.", name: "Mia C.", role: "Holiday cards", location: "Christmas album", rating: "5", avatarUrl: myAssets.reviewMiaAvatar, resultImageUrl: myAssets.galleryChristmasCoupleTwo }),
      block("review_noah", "testimonial", { quote: "My favorite part is the workflow. Upload, choose a package, approve the cost, and the finished set is easy to review with the rest of my account history.", name: "Noah P.", role: "Private gallery user", location: "Credit planning", rating: "5", avatarUrl: myAssets.reviewNoahAvatar, resultImageUrl: myAssets.flowPrivateAlbumWorkspace }),
      block("review_chloe", "testimonial", { quote: "The theme labels helped me explain options to a client. We tested creator portraits, holiday images, and short motion ideas from the same source photos.", name: "Chloe S.", role: "Social seller", location: "Creator workflow", rating: "5", avatarUrl: myAssets.womanPortrait, resultImageUrl: myAssets.galleryCreatorOne }),
      block("review_eli", "testimonial", { quote: "Good quality, clear wording, and no confusing checkout surprise. I knew what each generation would use before starting the album.", name: "Eli T.", role: "Small team admin", location: "Headshots and cards", rating: "5", avatarUrl: myAssets.selfie, resultImageUrl: myAssets.galleryCreatorTwo })
    ]),
    faq: mydreamshootsFaqSection(),
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
      eyebrow: "Customer occasion examples",
      title: "Browse private fan-scene, game-day, and holiday themes customers can create.",
      subtitle: "These examples use Aidreamcapes-owned theme assets and approved source-photo assumptions. Scan fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, and seasonal directions.",
      imageTitle: "Fan and holiday image themes",
      videoTitle: "Fan and holiday video themes",
      primaryCta: "Start with approved photos",
      primaryHref: "/login",
      imageSlugs: "fan-scene-albums|game-day-group-photos|stadium-night-fan-sets|premiere-style-portraits|christmas-holiday-albums|thanksgiving-memory-sets|halloween-party-portraits|seasonal-celebration-photos",
      videoSlugs: "route-atlas-motion|coastal-memory-clip|old-quarter-walkthrough|resort-balcony-motion|scenic-overlook-pan|alpine-trail-motion|solo-traveler-profile-clip|heritage-celebration-film",
      videoItemLimit: 8
    },
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
      block("aidream_featured_game_day", "seasonal_image", { label: "Game-Day Group Portraits", meta: "Supporter scenes", imageUrl: aidreamAssets.gameDay, shape: "square" }),
      block("aidream_featured_christmas", "seasonal_image", { label: "Christmas Holiday Albums", meta: "Card-ready mood", imageUrl: aidreamAssets.christmas, shape: "square" }),
      block("aidream_featured_premiere", "seasonal_image", { label: "Premiere-Inspired Portraits", meta: "Spotlight arrivals", imageUrl: aidreamAssets.premiere, shape: "square" }),
      block("aidream_featured_fan", "seasonal_image", { label: "Private Fan-Scene Album", meta: "Approved group photos", imageUrl: aidreamAssets.fan, shape: "square" }),
      block("aidream_featured_thanksgiving", "seasonal_image", { label: "Thanksgiving Keepsakes", meta: "Warm table scenes", imageUrl: aidreamAssets.thanksgiving, shape: "square" }),
      block("aidream_featured_seasonal", "seasonal_image", { label: "Seasonal Celebration Photos", meta: "Rotating campaign pick", imageUrl: aidreamAssets.seasonal, shape: "square" })
    ]),
    tutorial: section("video_feature", {
      anchor: "how-it-works",
      eyebrow: "How it works",
      title: "See how an Aidreamcapes occasion album is planned.",
      subtitle: "Start with approved source photos, choose a fan-scene or holiday direction, confirm the visible credit cost, and keep finished images inside your private Aidreamcapes gallery.",
      imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-tutorial-55s.jpg?v=20260803assetfix2",
      videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4?v=20260803assetfix2",
      videoBadge: "Occasion album workflow",
      playLabel: "Watch the Aidreamcapes workflow"
    }),
    imageTutorial: section("video_feature", {
      anchor: "ai-image-tutorial",
      eyebrow: "AI image tutorial",
      title: "Create a private fan-scene image album.",
      subtitle: "Follow the Aidreamcapes workspace flow: choose a fan-scene album, add approved source photos, review the album details and credit cost, start generation, refresh All assets, and open the finished image.",
      imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260803aitutorial1",
      videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260803aitutorial1",
      videoBadge: "AI image album workflow",
      playLabel: "Watch the Aidreamcapes AI image tutorial"
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
      title: "For fan communities, event planners, holiday sellers, creator teams, and local studios.",
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
  return section("faq", {
    anchor: "faq",
    eyebrow: "Questions before upload",
    title: "FAQ",
    subtitle: "Answers to photo uploads, AI video examples, package themes, credits, privacy, refunds, subscriptions, quality, and gallery delivery.",
    journeyTitle: "Your photo flow",
    journeyTitles: "Upload|Choose Pack|Generate|Download",
    journeyDescriptions: "Add clean source photos.|Pick a scene or style.|AI builds your set.|Download from the private gallery."
  }, [
    block("faq_free", "faq_item", { question: "Can I try MyDreamShoots for free?", answer: "Some lightweight tools can be free. Private model creation, premium photo packages, and AI video requests require credits because they use dedicated generation capacity." }),
    block("faq_credits", "faq_item", { question: "When are credits used?", answer: "The credit cost is shown before each generation. Credits are reserved when a request starts, used after successful delivery, and returned when a failed request releases the reservation." }),
    block("faq_private", "faq_item", { question: "Are my uploaded photos private?", answer: "Yes. Source photos, generation jobs, albums, orders, and credits stay connected to your signed-in MyDreamShoots account and are not public by default." }),
    block("faq_uploads", "faq_item", { question: "What photos should I upload?", answer: "Recent, clear, high-quality phone photos work best. Use different angles, expressions, lighting, and outfits so the private workflow has enough visual range." }),
    block("faq_videos", "faq_item", { question: "Can I create AI videos too?", answer: "Yes. Some themes include short AI video examples or video add-ons. The request screen shows source requirements and credit cost before video generation begins." }),
    block("faq_categories", "faq_item", { question: "Why are there so many package categories?", answer: "Each category represents a different output goal such as fan photos, VIP-style portraits, headshots, creator images, Christmas cards, Thanksgiving albums, Halloween portraits, or seasonal group photos." }),
    block("faq_faces", "faq_item", { question: "Will the images keep my facial features?", answer: "Results depend on source photo quality, lighting, pose, and model behavior. Clear source photos usually help the generated images stay more consistent, but AI output can vary." }),
    block("faq_safety", "faq_item", { question: "Can I use celebrity, athlete, or brand references?", answer: "Do not upload or request content that copies real celebrities, athletes, public figures, official marks, logos, trademarks, or protected materials without permission." }),
    block("faq_delete", "faq_item", { question: "Can I delete my photos?", answer: "You can request deletion of uploaded or generated photos from your account. Some billing, security, and dispute records may be retained where required." }),
    block("faq_refunds", "faq_item", { question: "What is the refund policy?", answer: "Refund eligibility follows the site policy and checkout terms. Credits already spent on successful generations are generally not refundable, while failed requests can return reserved credits according to request status." }),
    block("faq_cancel", "faq_item", { question: "What happens if I cancel a plan?", answer: "Access to previous albums follows the account and gallery policy. New package requests may require an active plan or enough available credits." }),
    block("faq_commercial", "faq_item", { question: "Can I use results for business or social content?", answer: "Many customers use finished images for profiles, social posts, cards, campaigns, or creator content. Review the output, rights, and platform rules before publishing or selling anything." })
  ]);
}

function aidreamcapesFaqSection() {
  return section("faq", {
    anchor: "faq",
    eyebrow: "Questions before upload",
    title: "FAQ",
    subtitle: "Answers to approved source photos, fan-scene albums, game-day group portraits, holiday albums, credits, privacy, refunds, and gallery delivery.",
    journeyTitle: "Your private album flow",
    journeyTitles: "Upload|Choose Album|Review Credits|Download",
    journeyDescriptions: "Add approved source photos.|Pick a fan or holiday direction.|Confirm the credit cost.|Download from your gallery."
  }, [
    block("aidream_faq_sources", "faq_item", { question: "What photos can I upload?", answer: "Upload only photos you own or have permission to use. Clear portraits and group photos work best for Aidreamcapes fan-scene and holiday albums." }),
    block("aidream_faq_likeness", "faq_item", { question: "Can Aidreamcapes recreate a real celebrity or athlete?", answer: "No. Aidreamcapes can create original fan-scene, game-day, premiere, and holiday atmosphere, but it does not promise or support copying real celebrities, real athletes, public figures, official marks, brand logos, trademarks, or protected materials." }),
    block("aidream_faq_credits", "faq_item", { question: "When are credits used?", answer: "The album cost is shown before generation. Credits are reserved when a private request starts, used after successful delivery, or released when a failed request returns the reservation." }),
    block("aidream_faq_private", "faq_item", { question: "Are my uploaded photos private?", answer: "Yes. Source photos, album briefs, generation jobs, finished images, orders, and credits stay connected to your signed-in Aidreamcapes account and are not public by default." }),
    block("aidream_faq_delete", "faq_item", { question: "Can I delete my photos?", answer: "You can request deletion of uploaded or generated photos from your account. Some billing, security, and dispute records may be retained where required." }),
    block("aidream_faq_refunds", "faq_item", { question: "What is the refund policy?", answer: "Refund eligibility follows the site policy and checkout terms. Credits spent on successful generations are generally not refundable, while failed requests can return reserved credits according to request status." }),
    block("aidream_faq_videos", "faq_item", { question: "Can I make AI videos from an album?", answer: "Some occasion themes include short motion examples or video add-ons. The generation screen explains the source-photo needs and credit cost before any video request starts." }),
    block("aidream_faq_categories", "faq_item", { question: "Which album categories are available?", answer: "Aidreamcapes focuses on fan-scene albums, game-day group portraits, premiere-inspired portraits, Christmas group albums, Thanksgiving memory sets, Halloween party portraits, and seasonal celebration photos." }),
    block("aidream_faq_group_photos", "faq_item", { question: "Can I create group albums?", answer: "Yes. Group source photos can work well for game-day, Christmas, Thanksgiving, Halloween, and seasonal celebration albums when every person in the upload is approved for that use." }),
    block("aidream_faq_quality", "faq_item", { question: "What affects final quality?", answer: "Lighting, focus, face visibility, pose variety, source-photo resolution, and the chosen album direction can all affect results. AI output can vary, so review finished images before sharing." }),
    block("aidream_faq_commercial", "faq_item", { question: "Can I use the images for business or social content?", answer: "Many customers use finished images for personal pages, creator posts, seasonal shops, or event previews. You are responsible for checking rights, platform rules, and any required AI disclosure before publishing." }),
    block("aidream_faq_cancel", "faq_item", { question: "What happens if I cancel a plan?", answer: "Access to previous albums follows the account and gallery policy. New album requests may require an active plan or enough available credits." })
  ]);
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

function applyStoreSpecificExistingSections(pageJson, store) {
  if (!pageJson?.sections) return false;
  const sections = pageJson.sections;
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
  if (sections.package_catalog_1) {
    sections.package_catalog_1 = {
      ...sections.package_catalog_1,
      settings: {
        ...sections.package_catalog_1.settings,
        featuredCount: 12
      }
    };
  }
  if (store.featuredPack) {
    sections.featured_pack_1 = clone(store.featuredPack);
  }
  const generationSettings = { ...(sections.generation_showcase_1?.settings ?? {}), ...clone(store.generationSettings) };
  delete generationSettings.itemLimit;
  sections.generation_showcase_1 = {
    ...(sections.generation_showcase_1 ?? { type: "dreamshoot_generation_showcase", blocks: [] }),
    type: "dreamshoot_generation_showcase",
    settings: generationSettings,
    blocks: []
  };
  sections.tutorial_video_1 = clone(store.tutorial);
  sections.tutorial_video_2 = clone(store.imageTutorial);
  sections.proof_1 = clone(store.reviews);
  sections.faq_1 = clone(store.faq);
  sections.brand_strip_1 = clone(store.partnerStrip);
  for (const sectionId of removedHomeSections) delete sections[sectionId];
  pageJson.sectionsOrder = homeOrder.filter((sectionId) => Boolean(sections[sectionId]));
  return true;
}

function applyStoreToState(state, store) {
  let pageUpdates = 0;
  let themeUpdates = 0;
  let publicationUpdates = 0;
  const site = findSite(state, store);
  const homePage = homePageForSite(site);
  if (!site || !homePage) throw new Error(`missing_home_page:${store.key}`);
  if (applyStoreSpecificExistingSections(homePage.draftJson, store)) pageUpdates += 1;
  if (applyStoreSpecificExistingSections(homePage.publishedJson, store)) pageUpdates += 1;

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== store.siteId) continue;
    const template = theme.templates?.index;
    if (!template?.sections || !Array.isArray(template.content_for_page)) continue;
    const syntheticPage = {
      sections: template.sections,
      sectionsOrder: template.content_for_page
    };
    applyStoreSpecificExistingSections(syntheticPage, store);
    template.content_for_page = syntheticPage.sectionsOrder;
    themeUpdates += 1;
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== store.siteId) continue;
    const snapshotHome = publication.snapshot?.pages?.find((page) => page.slug === "/");
    if (snapshotHome?.publishedJson && applyStoreSpecificExistingSections(snapshotHome.publishedJson, store)) {
      publicationUpdates += 1;
      if ("snapshotBytes" in publication) publication.snapshotBytes = Buffer.byteLength(JSON.stringify(publication.snapshot), "utf8");
      if ("pageCount" in publication) publication.pageCount = publication.snapshot?.pages?.length ?? publication.pageCount;
      if ("sectionCount" in publication) {
        publication.sectionCount = (publication.snapshot?.pages ?? []).reduce((count, page) => count + Object.keys(page.publishedJson?.sections ?? {}).length, 0);
      }
    }
  }

  return { pageUpdates, themeUpdates, publicationUpdates };
}

async function updateDatabase(state) {
  const prisma = new PrismaClient();
  const report = { pages: 0, siteThemes: 0, publications: 0 };
  try {
    for (const store of stores) {
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
  for (const store of stores) report[store.key] = applyStoreToState(state, store);
  if (!dryRun) await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const dbReport = updateDb && !dryRun ? await updateDatabase(state) : undefined;
  console.log(JSON.stringify({ dryRun, report, dbReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
