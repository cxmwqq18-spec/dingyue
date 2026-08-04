#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  localShowcasePosterPath,
  localShowcaseVideoPath,
  publicShowcasePosterPath,
  publicShowcaseVideoPath,
  showcaseStoreBySlug
} from "./dreamshoot-homepage-showcase-data.mjs";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const aidreamcapesSiteId = "site_aidreamcapes";
const assetVersion = "20260801visualfix2";
const publicAssetBase = "/assets/sites/site_aidreamcapes/fan-holiday-theme";
const localAssetRoot = path.join(repoRoot, "public", "assets", "sites", "site_aidreamcapes", "fan-holiday-theme");
const legacyVideoShowcase = showcaseStoreBySlug("aidreamcapes");
const sourceAssetRoot = path.join(repoRoot, "public", "assets", "sites", "site_aidreamcapes", "creative-packs");
const supportEmail = "support@aidreamcapes.com";
const complianceCopy =
  "Use only photos you own or have permission to use. Aidreamcapes does not recreate real celebrities, real athletes, public figures, official team logos, event marks, brand logos, trademarks, or protected materials without permission.";
const aidreamcapesBranding = {
  logoText: "Aidreamcapes",
  market: "Private fan-scene photo albums, game-day group portraits, holiday memory albums, visible credits, and customer-only galleries",
  description: "Aidreamcapes is a private AI photo studio for fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas group albums, Thanksgiving keepsakes, Halloween party portraits, and customer-only gallery delivery.",
  logoImageUrl: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c"
};
const aidreamcapesProductCopy = {
  prod_aidreamcapes_starter: {
    name: "Fan Moment",
    planFamily: "fan_moment",
    planSubtitle: "For one focused fan-scene or holiday album",
    editingLabel: "Source-photo permission review",
    occasionCount: 2
  },
  prod_aidreamcapes_pro: {
    name: "Occasion Album",
    planFamily: "occasion_album",
    planSubtitle: "For comparing several fan, game-day, premiere, and holiday directions",
    editingLabel: "Occasion-aware prompt review",
    occasionCount: 4
  },
  prod_aidreamcapes_premium: {
    name: "Celebration Gallery",
    planFamily: "celebration_gallery",
    planSubtitle: "For creators planning a full private fan and seasonal album library",
    editingLabel: "Premium album continuity",
    occasionCount: 8
  },
  prod_aidreamcapes_boost: {
    name: "Extra 150 Occasion Credits",
    planFamily: "occasion_credit_boost",
    planSubtitle: "A one-time credit top-up for extra fan or holiday album requests",
    editingLabel: "Extra album credits",
    occasionCount: 1
  }
};
const aidreamcapesAiAppCopy = {
  name: "Aidreamcapes Occasion Album Studio",
  description: "Private fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, and seasonal album generation with account-only gallery delivery.",
  parameterSchema: [
    {
      id: "style",
      label: "Album style",
      type: "select",
      options: [
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
      ]
    },
    {
      id: "outputCount",
      label: "Output count",
      type: "select",
      options: ["8", "20", "40"]
    }
  ]
};

const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.replace(/^--/, "")));
const dryRun = flags.has("dry-run");
const updateDb = flags.has("db");
const skipAssets = flags.has("skip-assets");
const forceAssets = flags.has("force-assets") || flags.has("force");
const fallbackDerivedAssets = flags.has("fallback-derived-assets") || process.env.AIDREAMCAPES_FAN_HOLIDAY_FALLBACK_DERIVED_ASSETS === "1";
const gallerySlotCount = 12;
let sharpLoader;

const rootCategoryDefs = [
  {
    slug: "fan-scene-albums",
    label: "Fan-Scene Albums",
    description: "Private album sets for permission-safe fan meetup moments, creator supporter scenes, and star-adjacent photo storytelling.",
    heroTitle: "Fan-scene photo albums for private moments",
    heroSubtitle: "Build the feeling of a fan meetup or signed-poster moment without copying a real celebrity or protected brand.",
    icon: "sparkles",
    source: "parent-creator.webp"
  },
  {
    slug: "game-day-group-photos",
    label: "Game-Day Group Portraits",
    description: "Sports-energy group portraits, watch-party albums, arena-light scenes, and supporter photos without official marks.",
    heroTitle: "Game-day group portraits",
    heroSubtitle: "Turn approved source photos into supporter scenes, arena energy, and private group albums.",
    icon: "trophy",
    source: "parent-adventure.webp"
  },
  {
    slug: "premiere-style-portraits",
    label: "Premiere-Inspired Portrait Sets",
    description: "Red carpet inspired portraits, spotlight arrivals, VIP evening albums, and polished creator moments.",
    heroTitle: "Premiere-inspired photo sets",
    heroSubtitle: "Create the polished atmosphere of a premiere, gala, or VIP arrival while keeping the result original.",
    icon: "star",
    source: "editorial-getaways.webp"
  },
  {
    slug: "christmas-holiday-albums",
    label: "Christmas Holiday Albums",
    description: "Festive group portraits, greeting-card albums, cozy winter scenes, and private holiday keepsakes.",
    heroTitle: "Christmas holiday albums",
    heroSubtitle: "Create warm holiday memory albums from photos your family or group has permission to use.",
    icon: "gift",
    source: "parent-occasions.webp"
  },
  {
    slug: "thanksgiving-memory-sets",
    label: "Thanksgiving Keepsake Sets",
    description: "Gratitude table portraits, Friendsgiving memories, autumn host stories, and family-style albums.",
    heroTitle: "Thanksgiving keepsake sets",
    heroSubtitle: "Build warm gratitude portraits and private group keepsakes with clear credit costs.",
    icon: "heart",
    source: "parent-moments.webp"
  },
  {
    slug: "halloween-party-portraits",
    label: "Halloween Party Portraits",
    description: "Costume-party portraits, dramatic group cards, spooky spotlight looks, and seasonal albums.",
    heroTitle: "Halloween party portraits",
    heroSubtitle: "Turn approved party photos into cinematic costume portraits without protected characters or logos.",
    icon: "wand",
    source: "dreamscape-portraits.webp"
  },
  {
    slug: "seasonal-celebration-photos",
    label: "Seasonal Celebration Photos",
    description: "Occasion portraits for birthdays, New Year moments, family celebrations, and rotating seasonal albums.",
    heroTitle: "Seasonal celebration photos",
    heroSubtitle: "Keep every occasion in one private, credit-visible album workflow.",
    icon: "calendar",
    source: "parent-lifestyle.webp"
  }
];

const themeCategoryDefs = [
  {
    slug: "private-fan-scene-albums",
    rootSlug: "fan-scene-albums",
    label: "Private Fan-Scene Albums",
    description: "Private fan-meetup inspired albums with supporter moments, polished cover crops, and original star-adjacent atmosphere.",
    heroTitle: "Private fan-scene photo albums",
    heroSubtitle: "Build a fan-meetup feeling from approved photos without copying real public figures, athlete likenesses, official marks, or protected branding.",
    icon: "sparkles",
    source: "gala-night-portraits-cover.webp"
  },
  {
    slug: "backstage-meetup-portraits",
    rootSlug: "fan-scene-albums",
    label: "Backstage Meetup Portraits",
    description: "Velvet-rope inspired meetup portraits, soft flash scenes, and private keepsake crops for fan-friendly galleries.",
    heroTitle: "Backstage meetup portraits",
    heroSubtitle: "Create private meetup moments with original atmosphere, clear upload permissions, and account-only gallery delivery.",
    icon: "sparkles",
    source: "review-aria-result.webp"
  },
  {
    slug: "supporter-photo-walls",
    rootSlug: "fan-scene-albums",
    label: "Supporter Photo Walls",
    description: "Creator community walls, supporter collages, and profile-ready album frames for private fan moments.",
    heroTitle: "Supporter photo wall albums",
    heroSubtitle: "Design an original supporter wall from approved portraits while keeping credit cost and safety rules visible.",
    icon: "layout",
    source: "private-album-curator-cover.webp"
  },
  {
    slug: "fan-keepsake-card-sets",
    rootSlug: "fan-scene-albums",
    label: "Fan Keepsake Card Sets",
    description: "Giftable fan-card images, warm note moments, and private supporter keepsakes with original styling.",
    heroTitle: "Fan keepsake card sets",
    heroSubtitle: "Turn approved portraits into giftable supporter cards and album crops without protected people, logos, or trademarks.",
    icon: "card",
    source: "postcard-story-sets-cover.webp"
  },
  {
    slug: "game-day-group-portraits",
    rootSlug: "game-day-group-photos",
    label: "Game-Day Group Portraits",
    description: "Supporter group portraits with arena energy, watch-party atmosphere, and no official team or event marks.",
    heroTitle: "Game-day group portraits",
    heroSubtitle: "Create sports-energy group albums from approved photos while keeping the output original and logo-free.",
    icon: "trophy",
    source: "shared-route-albums-cover.webp"
  },
  {
    slug: "stadium-night-fan-sets",
    rootSlug: "game-day-group-photos",
    label: "Stadium Night Fan Sets",
    description: "Floodlight fan portraits, dramatic supporter scenes, and social-ready crops for private game-night albums.",
    heroTitle: "Stadium night fan sets",
    heroSubtitle: "Shape arena-light mood and supporter confidence without recreating real athletes or protected uniforms.",
    icon: "lights",
    source: "city-light-night-walks-cover.webp"
  },
  {
    slug: "watch-party-albums",
    rootSlug: "game-day-group-photos",
    label: "Watch Party Albums",
    description: "Private watch-party albums, group celebration portraits, and lively supporter keepsakes.",
    heroTitle: "Watch party photo albums",
    heroSubtitle: "Build a private game-day celebration gallery from photos you own or have permission to use.",
    icon: "users",
    source: "family-travel-keepsakes-cover.webp"
  },
  {
    slug: "premiere-flash-portraits",
    rootSlug: "premiere-style-portraits",
    label: "Premiere Flash Portraits",
    description: "Camera-flash portraits, formal evening mood, and polished creator-ready images with original VIP atmosphere.",
    heroTitle: "Premiere flash portraits",
    heroSubtitle: "Create a formal flash-lit portrait set without copying public figures, protected event marks, or brand signage.",
    icon: "star",
    source: "soft-glam-studio.webp"
  },
  {
    slug: "vip-arrival-photo-sets",
    rootSlug: "premiere-style-portraits",
    label: "VIP Arrival Photo Sets",
    description: "Arrival-scene portraits, refined profile crops, and private creator media images with original styling.",
    heroTitle: "VIP arrival photo sets",
    heroSubtitle: "Design polished arrival moments from approved portraits, with visible credits and private delivery.",
    icon: "sparkles",
    source: "professional-headshot-studio-cover.webp"
  },
  {
    slug: "award-night-keepsake-albums",
    rootSlug: "premiere-style-portraits",
    label: "Award Night Keepsake Albums",
    description: "Elegant award-night inspired albums, spotlight group images, and formal celebration keepsakes.",
    heroTitle: "Award night keepsake albums",
    heroSubtitle: "Build a polished evening album with original styling and clear protected-mark boundaries.",
    icon: "award",
    source: "gala-night-portraits-category.webp"
  },
  {
    slug: "christmas-group-albums",
    rootSlug: "christmas-holiday-albums",
    label: "Christmas Group Albums",
    description: "Festive group albums, warm greeting-card scenes, and private holiday downloads for families and groups.",
    heroTitle: "Christmas group albums",
    heroSubtitle: "Create cozy Christmas group portraits from approved photos with private gallery delivery.",
    icon: "gift",
    source: "holiday-couple-cards-cover.webp"
  },
  {
    slug: "cozy-card-portrait-sets",
    rootSlug: "christmas-holiday-albums",
    label: "Cozy Card Portrait Sets",
    description: "Warm card-ready portraits with winter light, simple decor, and album-friendly crops.",
    heroTitle: "Cozy card portrait sets",
    heroSubtitle: "Create greeting-card portraits and warm seasonal crops without protected characters, logos, or trademarks.",
    icon: "mail",
    source: "holiday-couple-cards-category.webp"
  },
  {
    slug: "winter-fan-greeting-albums",
    rootSlug: "christmas-holiday-albums",
    label: "Winter Fan Greeting Albums",
    description: "Seasonal supporter greetings, group-card scenes, and private winter album images.",
    heroTitle: "Winter fan greeting albums",
    heroSubtitle: "Build original fan-friendly winter greetings from photos you own or can use with permission.",
    icon: "snowflake",
    source: "snow-lodge-escapes-cover.webp"
  },
  {
    slug: "thanksgiving-table-keepsakes",
    rootSlug: "thanksgiving-memory-sets",
    label: "Thanksgiving Table Keepsakes",
    description: "Warm table portraits, gratitude-note scenes, and family-style private keepsake albums.",
    heroTitle: "Thanksgiving table keepsakes",
    heroSubtitle: "Create warm gathering portraits with clear source-photo permission and visible credit cost.",
    icon: "heart",
    source: "heritage-celebration-portraits-cover.webp"
  },
  {
    slug: "gratitude-group-portraits",
    rootSlug: "thanksgiving-memory-sets",
    label: "Gratitude Group Portraits",
    description: "Autumn group portraits, gratitude album covers, and private celebration frames.",
    heroTitle: "Gratitude group portraits",
    heroSubtitle: "Turn approved group photos into warm gratitude portraits for private review and download.",
    icon: "heart",
    source: "heritage-celebration-portraits-category.webp"
  },
  {
    slug: "friendsgiving-memory-sets",
    rootSlug: "thanksgiving-memory-sets",
    label: "Friendsgiving Memory Sets",
    description: "Friend-group portraits, host moments, and share-ready seasonal album images for private galleries.",
    heroTitle: "Friendsgiving memory sets",
    heroSubtitle: "Build a warm friend-group album from approved photos with account-only delivery.",
    icon: "users",
    source: "review-mira-result.webp"
  },
  {
    slug: "halloween-party-portrait-sets",
    rootSlug: "halloween-party-portraits",
    label: "Halloween Party Portrait Sets",
    description: "Dramatic party portraits, moody color, and original costume-friendly scenes without protected character copying.",
    heroTitle: "Halloween party portrait sets",
    heroSubtitle: "Create cinematic party images from approved photos while avoiding protected characters, branded costumes, and logos.",
    icon: "wand",
    source: "fantasy-avatars.webp"
  },
  {
    slug: "costume-cast-photo-albums",
    rootSlug: "halloween-party-portraits",
    label: "Costume Cast Photo Albums",
    description: "Original costume-group albums, cast-wall layouts, and private Halloween download sets.",
    heroTitle: "Costume cast photo albums",
    heroSubtitle: "Build a private cast-style album with original costumes, dramatic lighting, and safety boundaries.",
    icon: "users",
    source: "storybook-headshots.webp"
  },
  {
    slug: "birthday-fan-moment-sets",
    rootSlug: "seasonal-celebration-photos",
    label: "Birthday Fan Moment Sets",
    description: "Birthday spotlight photos, giftable supporter greetings, family occasion portraits, and private keepsake images.",
    heroTitle: "Birthday fan moment sets",
    heroSubtitle: "Create birthday and family occasion portraits from approved photos with private album continuity.",
    icon: "cake",
    source: "review-rowan-result.webp"
  },
  {
    slug: "new-year-countdown-albums",
    rootSlug: "seasonal-celebration-photos",
    label: "New Year Countdown Albums",
    description: "Countdown group portraits, party album covers, and polished New Year celebration frames.",
    heroTitle: "New Year countdown albums",
    heroSubtitle: "Build a private countdown album with festive group energy and original, permission-safe styling.",
    icon: "calendar",
    source: "rooftop-city-nights-cover.webp"
  }
];

const parentCategories = rootCategoryDefs;
const homepageShowcaseImageSlugs = [
  "fan-scene-albums",
  "game-day-group-photos",
  "stadium-night-fan-sets",
  "premiere-style-portraits",
  "christmas-holiday-albums",
  "thanksgiving-memory-sets",
  "halloween-party-portraits",
  "seasonal-celebration-photos"
];
const allCategoryDefs = [...rootCategoryDefs, ...themeCategoryDefs];

const packDefs = [
  ["private-fan-scene-album", "private-fan-scene-albums", "Private Fan-Scene Album", "Build a private album with fan meetup atmosphere, poster-wall styling, and original star-adjacent energy.", "Fan-scene album", 24, 24, "gala-night-portraits-cover.webp"],
  ["backstage-meetup-portraits", "backstage-meetup-portraits", "Backstage Meetup Portraits", "Create permission-safe backstage-style moments with velvet rope details, soft flash, and private gallery delivery.", "Meetup portraits", 24, 22, "review-aria-result.webp"],
  ["fan-letter-moment-set", "fan-keepsake-card-sets", "Fan Keepsake Card Set", "Turn personal source photos into warm supporter scenes, autograph-table mood, and keepsake-ready crops.", "Keepsake cards", 18, 20, "postcard-story-sets-cover.webp"],
  ["creator-supporter-photo-wall", "supporter-photo-walls", "Creator Supporter Photo Wall", "Plan a photo-wall set for creators, followers, and fan community moments without public figure copying.", "Community wall", 22, 24, "private-album-curator-cover.webp"],
  ["game-day-group-portraits", "game-day-group-portraits", "Game-Day Group Portraits", "Create supporter group photos with arena glow, team-color styling notes, and no official marks.", "Game-day group", 24, 24, "shared-route-albums-cover.webp"],
  ["stadium-night-fan-set", "stadium-night-fan-sets", "Stadium Night Fan Set", "Build floodlight portraits, tunnel mood, and social-ready supporter crops from approved uploads.", "Arena mood", 24, 24, "city-light-night-walks-cover.webp"],
  ["championship-watch-party-album", "watch-party-albums", "Championship Watch Party Album", "Create watch-party portraits, living-room celebration energy, and private group downloads.", "Watch party", 20, 22, "family-travel-keepsakes-cover.webp"],
  ["tunnel-entrance-fan-portraits", "stadium-night-fan-sets", "Tunnel Entrance Fan Portraits", "Shape dramatic pre-game walkout energy for fans while avoiding real athlete likenesses and official marks.", "Supporter tunnel", 22, 22, "nature-portrait-studio-cover.webp"],
  ["premiere-flash-portraits", "premiere-flash-portraits", "Premiere Flash Portraits", "Create premiere inspired portraits with camera flash mood, formal styling, and original identity-safe scenes.", "Premiere flash", 24, 24, "soft-glam-studio.webp"],
  ["vip-arrival-photo-set", "vip-arrival-photo-sets", "VIP Arrival Photo Set", "Build polished arrival photos, step-and-repeat atmosphere, and private creator-ready crops.", "VIP arrival", 24, 22, "professional-headshot-studio-cover.webp"],
  ["award-night-keepsake-album", "award-night-keepsake-albums", "Award Night Keepsake Album", "Create elegant award-night memories, spotlight portraits, and formal group images for private albums.", "Award night", 26, 24, "gala-night-portraits-category.webp"],
  ["spotlight-couple-portrait-set", "vip-arrival-photo-sets", "Spotlight Couple Portrait Set", "Turn couple or friend photos into polished spotlight portraits with gala atmosphere and safe styling.", "Spotlight pair", 22, 22, "boudoir-editorial-portraits-cover.webp"],
  ["christmas-group-album", "christmas-group-albums", "Christmas Group Album", "Create festive group portraits, card covers, cozy gathering photos, and private holiday downloads.", "Christmas album", 22, 24, "holiday-couple-cards-cover.webp"],
  ["cozy-card-portrait-set", "cozy-card-portrait-sets", "Cozy Card Portrait Set", "Build warm card-ready portraits with winter light, soft decor, and family-friendly compositions.", "Card portraits", 18, 20, "holiday-couple-cards-category.webp"],
  ["winter-fan-greeting-album", "winter-fan-greeting-albums", "Winter Fan Greeting Album", "Create seasonal fan greetings, group-card scenes, and permission-safe festive supporter moments.", "Winter greeting", 20, 22, "snow-lodge-escapes-cover.webp"],
  ["holiday-party-photo-wall", "christmas-group-albums", "Holiday Party Photo Wall", "Turn party photos into polished wall-of-memories scenes for private sharing and downloads.", "Holiday party", 22, 24, "review-lena-result.webp"],
  ["thanksgiving-keepsake-table-set", "thanksgiving-table-keepsakes", "Thanksgiving Keepsake Table Set", "Create warm table portraits, gratitude notes, and family-style keepsake crops from approved uploads.", "Table keepsakes", 20, 22, "heritage-celebration-portraits-cover.webp"],
  ["gratitude-group-portrait-album", "gratitude-group-portraits", "Gratitude Group Portrait Album", "Build autumn group portraits with soft gathering light, private gallery delivery, and clear credit cost.", "Gratitude group", 22, 24, "heritage-celebration-portraits-category.webp"],
  ["friendsgiving-memory-set", "friendsgiving-memory-sets", "Friendsgiving Memory Set", "Create friend-group portraits, warm host moments, and share-ready seasonal album images.", "Friendsgiving", 20, 22, "review-mira-result.webp"],
  ["autumn-host-photo-story", "thanksgiving-table-keepsakes", "Autumn Host Photo Story", "Turn solo or group host photos into polished autumn occasion portraits and card crops.", "Autumn host", 18, 20, "milestone-postcard-sets-cover.webp"],
  ["halloween-party-portrait-set", "halloween-party-portrait-sets", "Halloween Party Portrait Set", "Create dramatic party portraits, moody lighting, and costume-friendly album scenes without protected characters.", "Party portraits", 22, 24, "fantasy-avatars.webp"],
  ["costume-cast-photo-album", "costume-cast-photo-albums", "Costume Cast Photo Album", "Build original costume-group portraits, cast-wall layouts, and private seasonal downloads.", "Costume cast", 22, 24, "storybook-headshots.webp"],
  ["haunted-premiere-portrait-set", "halloween-party-portrait-sets", "Haunted Premiere Portrait Set", "Mix premiere flash with spooky atmosphere for original, permission-safe seasonal portraits.", "Spooky premiere", 24, 24, "evening-route-portraits-cover.webp"],
  ["spooky-fan-card-portraits", "costume-cast-photo-albums", "Spooky Fan Card Portraits", "Create fan-card style images with dramatic color, playful seasonal mood, and no protected marks.", "Fan cards", 18, 20, "product-reverie.webp"],
  ["seasonal-celebration-photo-set", "birthday-fan-moment-sets", "Seasonal Celebration Photo Set", "Create rotating occasion portraits for birthdays, holidays, and family updates in one private workflow.", "Seasonal set", 20, 24, "milestone-postcard-sets-category.webp"],
  ["new-year-countdown-group-album", "new-year-countdown-albums", "New Year Countdown Group Album", "Build countdown portraits, party group images, and polished cover crops for private albums.", "Countdown album", 22, 24, "rooftop-city-nights-cover.webp"],
  ["birthday-fan-moment-set", "birthday-fan-moment-sets", "Birthday Fan Moment Set", "Create birthday spotlight photos, fan-style greetings, and giftable private keepsake images.", "Birthday moment", 18, 20, "review-rowan-result.webp"],
  ["family-occasion-portrait-album", "birthday-fan-moment-sets", "Family Occasion Portrait Album", "Create family celebration portraits with warm styling, album continuity, and download-ready crops.", "Family occasion", 22, 24, "lake-house-weekends-cover.webp"]
].map(([slug, parentSlug, name, description, meta, creditCost, outputCount, source], index) => ({
  slug,
  parentSlug,
  name,
  headline: `${name} for Aidreamcapes private occasion albums`,
  description,
  meta,
  creditCost,
  outputCount,
  source,
  sortOrder: index + 1
}));

const toolCategoryDefs = [
  { slug: "fan-scene-builders", label: "Fan-Scene Builders", description: "Builders for private fan-scene albums, supporter walls, and keepsake cards.", icon: "sparkles" },
  { slug: "game-day-builders", label: "Game-Day Builders", description: "Sports-energy group portrait tools without official marks.", icon: "trophy" },
  { slug: "premiere-creator-tools", label: "Premiere Creator Tools", description: "Flash-lit portrait, VIP arrival, and award-night builder tools.", icon: "star" },
  { slug: "holiday-album-tools", label: "Holiday Album Tools", description: "Christmas, Thanksgiving, Halloween, and winter album studios.", icon: "gift" },
  { slug: "occasion-card-tools", label: "Occasion Card Tools", description: "Birthday, New Year, cozy card, and Friendsgiving portrait makers.", icon: "calendar" },
  { slug: "safety-prep-tools", label: "Safety Prep Tools", description: "Permission, credit, and album planning tools for original private photo sets.", icon: "shield" }
];

const toolDefs = [
  ["fan-scene-album-builder", "fan-scene-builders", "Fan-Scene Album Builder", "Build private fan-scene albums with meetup energy, spotlight mood, and original identity-safe styling.", "private-fan-scene-album"],
  ["backstage-meetup-scene-builder", "fan-scene-builders", "Backstage Meetup Scene Builder", "Create private backstage-style meetup portraits with soft flash, velvet-rope mood, and clear safety boundaries.", "backstage-meetup-portraits"],
  ["supporter-photo-wall-maker", "fan-scene-builders", "Supporter Photo Wall Maker", "Build supporter wall layouts, creator community portraits, and profile-ready fan album frames.", "creator-supporter-photo-wall"],
  ["fan-keepsake-card-maker", "fan-scene-builders", "Fan Keepsake Card Maker", "Create giftable supporter cards, warm note moments, and private fan keepsake crops.", "fan-letter-moment-set"],
  ["game-day-group-portrait-maker", "game-day-builders", "Game-Day Group Portrait Maker", "Create supporter group portraits, watch-party albums, and arena-style fan photos without official marks.", "game-day-group-portraits"],
  ["stadium-night-fan-set-maker", "game-day-builders", "Stadium Night Fan Set Maker", "Build floodlight fan portraits and dramatic supporter scenes from approved uploads.", "stadium-night-fan-set"],
  ["watch-party-album-builder", "game-day-builders", "Watch Party Album Builder", "Create lively watch-party portraits, celebration group photos, and private supporter albums.", "championship-watch-party-album"],
  ["premiere-portrait-set-builder", "premiere-creator-tools", "Premiere Portrait Set Builder", "Shape premiere-inspired portraits, VIP arrival crops, and polished private creator albums.", "premiere-flash-portraits"],
  ["vip-arrival-photo-maker", "premiere-creator-tools", "VIP Arrival Photo Maker", "Design polished arrival portraits with original evening atmosphere and private gallery delivery.", "vip-arrival-photo-set"],
  ["award-night-album-studio", "premiere-creator-tools", "Award Night Album Studio", "Create elegant award-night keepsakes, spotlight portraits, and formal group images.", "award-night-keepsake-album"],
  ["new-year-countdown-album-maker", "occasion-card-tools", "New Year Countdown Album Maker", "Build countdown portraits, party group images, and polished New Year private album covers.", "new-year-countdown-group-album"],
  ["christmas-group-album-studio", "holiday-album-tools", "Christmas Group Album Studio", "Create festive group portraits, cozy cards, and private Christmas album images.", "christmas-group-album"],
  ["cozy-card-portrait-maker", "occasion-card-tools", "Cozy Card Portrait Maker", "Create warm card-ready portraits with winter light, simple decor, and album-friendly crops.", "cozy-card-portrait-set"],
  ["winter-fan-greeting-maker", "holiday-album-tools", "Winter Fan Greeting Maker", "Build seasonal fan greetings, group-card scenes, and private winter album images.", "winter-fan-greeting-album"],
  ["thanksgiving-keepsake-set-maker", "holiday-album-tools", "Thanksgiving Keepsake Set Maker", "Build warm gratitude portraits, Friendsgiving scenes, and family-style album crops.", "thanksgiving-keepsake-table-set"],
  ["friendsgiving-memory-maker", "occasion-card-tools", "Friendsgiving Memory Maker", "Create friend-group portraits, host moments, and share-ready seasonal album images.", "friendsgiving-memory-set"],
  ["halloween-party-portrait-maker", "holiday-album-tools", "Halloween Party Portrait Maker", "Create dramatic party portraits and original costume-friendly Halloween images.", "halloween-party-portrait-set"],
  ["costume-cast-album-builder", "holiday-album-tools", "Costume Cast Album Builder", "Build original costume-group portraits, cast-wall layouts, and private seasonal downloads.", "costume-cast-photo-album"],
  ["birthday-fan-moment-maker", "occasion-card-tools", "Birthday Fan Moment Maker", "Create birthday spotlight photos, fan-style greetings, and giftable private keepsake images.", "birthday-fan-moment-set"],
  ["permission-safe-photo-planner", "safety-prep-tools", "Permission-Safe Photo Planner", "Check source-photo permissions, protected mark boundaries, credit cost, and album intent before generation.", "family-occasion-portrait-album"]
].map(([slug, categorySlug, title, description, packSlug], index) => ({ slug, categorySlug, title, description, packSlug, sortOrder: index + 1 }));

function packDefsForCategorySlug(categorySlug) {
  const childSlugs = new Set(themeCategoryDefs.filter((category) => category.rootSlug === categorySlug).map((category) => category.slug));
  return packDefs.filter((pack) => pack.parentSlug === categorySlug || childSlugs.has(pack.parentSlug));
}

function firstPackDefForCategorySlug(categorySlug) {
  return packDefsForCategorySlug(categorySlug)[0];
}

if (!legacyVideoShowcase) throw new Error("missing_legacy_aidreamcapes_video_showcase");
const videoCategoryDefs = legacyVideoShowcase.videoCategories;
const videoDefs = legacyVideoShowcase.videoThemes.map((theme, index) => ({
  ...theme,
  packSlug: theme.posterSlug,
  sortOrder: index + 1
}));

const blogDefs = [
  {
    slug: "private-fan-scene-album-photo-package-guide",
    title: "How to plan fan-scene photo albums safely",
    summary: "Plan private fan-scene albums with approved source photos, original styling, visible credits, and clear likeness boundaries.",
    imageSlug: "private-fan-scene-album",
    tags: "Fan-scene albums|Source photo permissions|Private gallery|AI photo guide"
  },
  {
    slug: "game-day-group-portraits-photo-package-guide",
    title: "Game-day group portraits without official marks",
    summary: "Create supporter scenes and group portraits while avoiding official team logos, event marks, and real athlete likenesses.",
    imageSlug: "game-day-group-portraits",
    tags: "Game-day portraits|Sports fan photos|Original styling|Private albums"
  },
  {
    slug: "premiere-flash-portraits-photo-package-guide",
    title: "Premiere-inspired portrait sets for private albums",
    summary: "Use flash mood, formal styling, and original VIP atmosphere without copying real public figures or protected brands.",
    imageSlug: "premiere-flash-portraits",
    tags: "Premiere portraits|VIP style photos|Creator albums|Permission-safe AI"
  },
  {
    slug: "christmas-group-album-photo-package-guide",
    title: "Holiday memory albums for Christmas, Thanksgiving, and Halloween",
    summary: "Compare seasonal photo directions, credit costs, and source-photo guidance before creating a private Aidreamcapes album.",
    imageSlug: "seasonal-celebration-photo-set",
    tags: "Holiday memory albums|Christmas group albums|Thanksgiving keepsakes|Halloween portraits"
  }
];

const legacyCollectionAliases = {
  adventure: "game-day-group-photos",
  city: "premiere-style-portraits",
  coastal: "christmas-group-albums",
  costero: "christmas-group-albums",
  destination: "fan-scene-albums",
  destino: "fan-scene-albums",
  postcard: "seasonal-celebration-photos",
  postal: "seasonal-celebration-photos",
  "route-portrait-albums": "fan-scene-albums",
  "destination-portrait-albums": "fan-scene-albums",
  "coastal-light-sets": "christmas-group-albums",
  "coastal-getaways": "christmas-group-albums",
  "old-quarter-walks": "premiere-style-portraits",
  "old-city-walks": "premiere-style-portraits",
  "island-resort-scenes": "seasonal-celebration-photos",
  "scenic-overlooks": "game-day-group-photos",
  "alpine-trail-frames": "seasonal-celebration-photos",
  "mountain-trails": "game-day-group-photos",
  "road-trip-frames": "game-day-group-photos",
  "cinematic-travel": "game-day-group-photos",
  "itinerary-moodboards": "permission-safe-photo-planner",
  "route-moodboards": "permission-safe-photo-planner",
  "postcard-social-sets": "seasonal-celebration-photos",
  "postcard-story-sets": "seasonal-celebration-photos",
  "travel-profile-stories": "fan-scene-albums",
  "solo-traveler-profiles": "fan-scene-albums",
  "family-travel-keepsakes": "thanksgiving-memory-sets",
  "travel-journal-covers": "seasonal-celebration-photos"
};

const legacyToolAliases = {
  "ai-image-studio": "fan-scene-album-builder",
  "background-changer": "fan-scene-album-builder",
  "background-remover": "fan-scene-album-builder",
  "dreamscape-generator": "fan-scene-album-builder",
  "image-generator": "fan-scene-album-builder",
  "image-to-video": "new-year-countdown-album-maker",
  "image-studio": "fan-scene-album-builder",
  "portrait-generator": "fan-scene-album-builder",
  "portrait-maker": "fan-scene-album-builder",
  "product-reverie": "permission-safe-photo-planner",
  "soft-glam": "premiere-portrait-set-builder",
  "couple-escape-album": "birthday-fan-moment-maker",
  "wedding-portraits": "birthday-fan-moment-maker",
  "world-cup-fan-photos": "game-day-group-portrait-maker",
  headshot: "premiere-portrait-set-builder",
  "route-portrait-engine": "fan-scene-album-builder",
  "coastal-portrait": "christmas-group-album-studio",
  "island-resort-scenes": "new-year-countdown-album-maker",
  "scenic-overlook-story": "game-day-group-portrait-maker",
  "travel-profile-story": "fan-scene-album-builder",
  "editorial-getaway": "premiere-portrait-set-builder",
  "cafe-street-story": "premiere-portrait-set-builder",
  "cinematic-travel": "game-day-group-portrait-maker",
  "route-moodboard": "permission-safe-photo-planner",
  "social-keepsake": "birthday-fan-moment-maker",
  "seasonal-celebration-album-maker": "new-year-countdown-album-maker",
  "family-travel-keepsakes": "thanksgiving-keepsake-set-maker",
  "travel-journal-cover-maker": "new-year-countdown-album-maker"
};

function slugId(prefix, slug) {
  return `${prefix}_${slug.replace(/[^a-z0-9]+/g, "_")}`;
}

function asset(folder, slug, ext = "webp") {
  return `${publicAssetBase}/${folder}/${slug}.${ext}?v=${assetVersion}`;
}

function localAsset(folder, slug, ext = "webp") {
  return path.join(localAssetRoot, folder, `${slug}.${ext}`);
}

function stripVersion(value = "") {
  return String(value).split("?")[0];
}

function localFileForPublicPath(publicPath) {
  return path.join(repoRoot, "public", stripVersion(publicPath).replace(/^\/+/, ""));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function section(type, settings, blocks = []) {
  return { type, version: "1", card_name: type, settings, blocks };
}

function block(id, type, settings) {
  return { id, type, settings };
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function paletteForIndex(index) {
  const palettes = [
    ["#071019", "#c9793e", "#f7d8aa"],
    ["#11091a", "#ba5e88", "#f3c6da"],
    ["#061314", "#2a9d8f", "#d9fff8"],
    ["#1b1010", "#d64d3c", "#ffe0c2"],
    ["#101614", "#8a9f3f", "#f1e4b8"],
    ["#100a19", "#7c5cc8", "#e1d8ff"],
    ["#111016", "#e2a13b", "#fff0c4"]
  ];
  return palettes[index % palettes.length];
}

const galleryAltVariants = [
  "close portrait",
  "half-body portrait",
  "two-person moment",
  "wide scene",
  "candid smile",
  "detail crop",
  "group pose",
  "evening light",
  "vertical portrait",
  "lifestyle frame",
  "soft flash portrait",
  "album cover crop"
];

function galleryAltForPack(pack, index) {
  const variant = galleryAltVariants[index % galleryAltVariants.length];
  return `${pack.name} ${variant} for Aidreamcapes private ${pack.meta.toLowerCase()} album`;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function sourcePathFor(filename) {
  return path.join(sourceAssetRoot, filename);
}

async function renderDerivedImage({ source, output, title, meta, index, width = 1280, height = 960 }) {
  if (!forceAssets && await fileExists(output)) {
    return { output, created: false };
  }
  const sharp = await loadSharp();
  await ensureDir(output);
  const [background, accent, soft] = paletteForIndex(index);
  const overlay = Buffer.from(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="${background}" stop-opacity="0.50"/>
          <stop offset="0.62" stop-color="${background}" stop-opacity="0.08"/>
          <stop offset="1" stop-color="${accent}" stop-opacity="0.38"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#shade)"/>
      <rect x="42" y="${height - 202}" width="${width - 84}" height="150" rx="34" fill="#05070e" fill-opacity="0.62"/>
      <rect x="62" y="${height - 184}" width="132" height="28" rx="14" fill="${accent}"/>
      <text x="80" y="${height - 164}" fill="#ffffff" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="700" letter-spacing="2">AIDREAMCAPES</text>
      <text x="62" y="${height - 112}" fill="${soft}" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800">${xmlEscape(title).slice(0, 42)}</text>
      <text x="64" y="${height - 70}" fill="#fff7ed" fill-opacity="0.86" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="600">${xmlEscape(meta).slice(0, 70)}</text>
    </svg>
  `);
  await sharp(source)
    .rotate()
    .resize(width, height, { fit: "cover" })
    .modulate({ saturation: 0.9 + (index % 4) * 0.06, brightness: 0.92 + (index % 3) * 0.04 })
    .composite([{ input: overlay, blend: "over" }])
    .webp({ quality: 86 })
    .toFile(output);
  return { output, created: true };
}

async function loadSharp() {
  if (sharpLoader !== undefined) return sharpLoader;
  try {
    const moduleName = "sharp";
    const mod = await import(moduleName);
    sharpLoader = mod.default ?? mod;
    return sharpLoader;
  } catch (error) {
    throw new Error(`sharp_unavailable_for_fallback_asset_generation:${error instanceof Error ? error.message : String(error)}`);
  }
}

async function prepareAssets() {
  const report = { images: 0, videos: 0, skipped: 0 };
  if (skipAssets) return report;
  if (fallbackDerivedAssets) {
    const allImageJobs = [];
    allCategoryDefs.forEach((category, index) => {
      allImageJobs.push({
        source: sourcePathFor(category.source),
        output: localAsset("categories", category.slug),
        title: category.label,
        meta: "Private occasion album category",
        index
      });
    });
    packDefs.forEach((pack, index) => {
      allImageJobs.push({
        source: sourcePathFor(pack.source),
        output: localAsset("covers", pack.slug),
        title: pack.name,
        meta: pack.meta,
        index
      });
      for (let slot = 1; slot <= gallerySlotCount; slot += 1) {
        allImageJobs.push({
          source: sourcePathFor(pack.source),
          output: localAsset("gallery", `${pack.slug}-${String(slot).padStart(2, "0")}`),
          title: pack.name,
          meta: `${pack.meta} gallery ${slot}`,
          index: index + slot
        });
      }
    });
    parentCategories.slice(0, 7).forEach((category, index) => {
      allImageJobs.push({
        source: sourcePathFor(category.source),
        output: localAsset("images", category.slug),
        title: category.label,
        meta: "Customer-created example",
        index: index + 10
      });
      allImageJobs.push({
        source: sourcePathFor(category.source),
        output: localAsset("showcase", category.slug),
        title: category.label,
        meta: "Customer-created example",
        index: index + 10
      });
    });
    const categoryByPack = new Map(packDefs.map((pack) => [pack.slug, pack]));
    videoDefs.forEach((theme, index) => {
      const pack = categoryByPack.get(theme.packSlug) ?? packDefs[index % packDefs.length];
      allImageJobs.push({
        source: sourcePathFor(pack.source),
        output: localAsset("posters", theme.slug),
        title: theme.name,
        meta: "Private motion preview",
        index: index + 22,
        width: 960,
        height: 960
      });
    });

    for (const job of allImageJobs) {
      if (!fsSync.existsSync(job.source)) throw new Error(`missing_aidreamcapes_source_asset:${job.source}`);
      const result = await renderDerivedImage(job);
      if (result.created) report.images += 1;
      else report.skipped += 1;
    }
  } else {
    report.skipped += allCategoryDefs.length + packDefs.length * (gallerySlotCount + 1) + parentCategories.slice(0, 7).length * 2 + videoDefs.length;
  }
  for (const theme of videoDefs) {
    const poster = path.resolve(repoRoot, localShowcasePosterPath(legacyVideoShowcase, theme.slug));
    const video = path.resolve(repoRoot, localShowcaseVideoPath(legacyVideoShowcase, theme.slug));
    if (!await fileExists(poster)) throw new Error(`missing_legacy_showcase_poster:${poster}`);
    if (!await fileExists(video)) throw new Error(`missing_legacy_showcase_video:${video}`);
    report.skipped += 1;
  }
  return report;
}

function parentRows(now) {
  const rootRows = rootCategoryDefs.map((category, index) => ({
    id: slugId("cat_aidreamcapes_fan_holiday", category.slug),
    siteId: aidreamcapesSiteId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    heroTitle: category.heroTitle,
    heroSubtitle: category.heroSubtitle,
    icon: category.icon,
    imageUrl: asset("categories", category.slug),
    sortOrder: index + 1,
    status: "active",
    createdAt: now
  }));
  const rootBySlug = new Map(rootRows.map((category) => [category.slug, category]));
  const childRows = themeCategoryDefs.map((category, index) => {
    const parent = rootBySlug.get(category.rootSlug);
    return {
      id: slugId("cat_aidreamcapes_fan_holiday", category.slug),
      siteId: aidreamcapesSiteId,
      parentId: parent?.id,
      parent: parent ? { ...parent } : undefined,
      slug: category.slug,
      label: category.label,
      description: category.description,
      heroTitle: category.heroTitle,
      heroSubtitle: category.heroSubtitle,
      icon: category.icon,
      imageUrl: asset("categories", category.slug),
      sortOrder: 100 + index + 1,
      status: "active",
      createdAt: now
    };
  });
  return [...rootRows, ...childRows];
}

function creativePackRows(categories, now) {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  return packDefs.map((pack) => {
    const category = categoryBySlug.get(pack.parentSlug);
    return {
      id: slugId("pack_aidreamcapes", pack.slug),
      siteId: aidreamcapesSiteId,
      categoryId: category?.id,
      category: pack.parentSlug,
      name: pack.name,
      headline: pack.headline,
      description: `${pack.description} ${complianceCopy}`,
      prompt: `Create ${pack.name.toLowerCase()} from approved source photos. Preserve the people provided by the customer, keep the scene original, use ${pack.meta.toLowerCase()} mood, and avoid real public figure likenesses, official marks, logos, trademarks, text, watermarks, and protected material.`,
      aiAppSlug: "image_generator",
      status: "active",
      creditCost: pack.creditCost,
      outputCount: pack.outputCount,
      trainingRequired: false,
      generationCount: 0,
      conversionRate: 0,
      imageUrl: asset("covers", pack.slug),
      galleryImages: Array.from({ length: gallerySlotCount }, (_, index) => asset("gallery", `${pack.slug}-${String(index + 1).padStart(2, "0")}`)),
      galleryImageAlts: Array.from({ length: gallerySlotCount }, (_, index) => galleryAltForPack(pack, index)),
      createdAt: now,
      categoryRecord: category ? { ...category } : undefined
    };
  });
}

function toolCategoryRows(now) {
  return toolCategoryDefs.map((category, index) => ({
    id: slugId("tool_cat_aidreamcapes_fan_holiday", category.slug),
    siteId: aidreamcapesSiteId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    icon: category.icon,
    sortOrder: index + 1,
    status: "active",
    createdAt: now
  }));
}

function toolMenuRows(toolCategories, now) {
  const categoryBySlug = new Map(toolCategories.map((category) => [category.slug, category]));
  const packBySlug = new Map(packDefs.map((pack) => [pack.slug, pack]));
  return toolDefs.map((tool) => {
    const pack = packBySlug.get(tool.packSlug) ?? packDefs[0];
    const category = categoryBySlug.get(tool.categorySlug);
    return {
      id: slugId("tool_menu_aidreamcapes", tool.slug),
      siteId: aidreamcapesSiteId,
      categoryId: category?.id,
      category,
      slug: tool.slug,
      title: tool.title,
      description: `${tool.description} ${complianceCopy}`,
      badge: tool.sortOrder <= 3 ? "Featured" : "Seasonal",
      icon: category?.icon ?? "sparkles",
      imageUrl: asset("covers", pack.slug),
      href: `/tools/${tool.slug}`,
      detailJson: {
        title: tool.title,
        subtitle: `${tool.description} Review source-photo permission and credit cost before starting.`,
        ctaLabel: "Start this Aidreamcapes set",
        guideTitle: `${tool.title} guide`,
        guideBody: `${tool.title} works best with clear approved portraits, a focused fan or holiday direction, and notes about what should not appear.`,
        detailTitle: `What ${tool.title} creates`,
        detailBody: complianceCopy,
        workflow: ["Upload approved source photos.", "Choose the fan or holiday direction.", "Review the visible credit cost.", "Download finished results from the private gallery."],
        useCases: ["Private fan-scene albums", "Game-day group portraits", "Holiday memory albums", "Permission-safe creator moments"]
      },
      sortOrder: tool.sortOrder,
      status: "active",
      createdAt: now
    };
  });
}

function videoCategoryRows(now) {
  return videoCategoryDefs.map((category, index) => ({
    id: slugId("video_cat_aidreamcapes", category.slug),
    siteId: aidreamcapesSiteId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    imageUrl: publicShowcasePosterPath(legacyVideoShowcase, videoDefs[index % videoDefs.length].slug),
    sortOrder: index + 1,
    status: "active",
    createdAt: now
  }));
}

function videoThemeRows(categories, now) {
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  return videoDefs.map((theme) => {
    const category = categoryBySlug.get(theme.categorySlug);
    return {
      id: slugId("video_theme_aidreamcapes", theme.slug),
      siteId: aidreamcapesSiteId,
      categoryId: category?.id,
      category,
      slug: theme.slug,
      name: theme.name,
      headline: `${theme.name} for Aidreamcapes private albums`,
      description: theme.description,
      prompt: theme.prompt,
      status: "active",
      creditCost: theme.creditCost,
      durationSeconds: 6,
      maxFrames: 7,
      generationCount: 0,
      imageUrl: publicShowcasePosterPath(legacyVideoShowcase, theme.slug),
      galleryImages: [publicShowcaseVideoPath(legacyVideoShowcase, theme.slug)],
      createdAt: now
    };
  });
}

function mediaAssetRows(now) {
  return [
    { slug: "hero", label: "Aidreamcapes private fan-scene album hero", image: asset("covers", "private-fan-scene-album") },
    { slug: "game-day", label: "Aidreamcapes game-day group portrait cover", image: asset("covers", "game-day-group-portraits") },
    { slug: "premiere", label: "Aidreamcapes premiere inspired portrait cover", image: asset("covers", "premiere-flash-portraits") },
    { slug: "christmas", label: "Aidreamcapes Christmas group album cover", image: asset("covers", "christmas-group-album") },
    { slug: "thanksgiving", label: "Aidreamcapes Thanksgiving keepsake set cover", image: asset("covers", "thanksgiving-keepsake-table-set") },
    { slug: "halloween", label: "Aidreamcapes Halloween party portrait cover", image: asset("covers", "halloween-party-portrait-set") },
    { slug: "seasonal", label: "Aidreamcapes seasonal celebration album cover", image: asset("covers", "seasonal-celebration-photo-set") }
  ].map((item) => ({
    id: `media_aidreamcapes_fan_holiday_${item.slug.replace(/[^a-z0-9]+/g, "_")}`,
    siteId: aidreamcapesSiteId,
    label: item.label,
    storageKey: `sites/site_aidreamcapes/fan-holiday-theme/${item.slug}.webp`,
    mimeType: "image/webp",
    usage: "theme",
    usageType: "theme",
    sourceType: "fan_holiday_theme_sync",
    previewUrl: item.image,
    originUrl: item.image,
    altText: item.label,
    createdAt: now
  }));
}

function seo(title, description, canonicalPath, keywords, ogImage = asset("covers", "private-fan-scene-album"), index = true) {
  return {
    title,
    description,
    keywords,
    canonicalPath,
    ogImage,
    robots: { index, follow: true },
    index,
    follow: true
  };
}

function aidreamcapesTutorialVideoSection() {
  return section("video_feature", {
    anchor: "how-it-works",
    eyebrow: "How it works",
    title: "See how an Aidreamcapes occasion album is planned.",
    subtitle: "Start with approved source photos, choose a fan-scene or holiday direction, confirm the visible credit cost, and keep finished images inside your private Aidreamcapes gallery.",
    imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-i2v-tutorial-55s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4?v=20260804resultfix2",
    videoBadge: "Occasion album workflow",
    playLabel: "Watch the Aidreamcapes workflow"
  });
}

function aidreamcapesImageTutorialVideoSection() {
  return section("video_feature", {
    anchor: "ai-image-tutorial",
    eyebrow: "AI image tutorial",
    title: "Create a private fan-scene image album.",
    subtitle: "Follow the Aidreamcapes workspace flow: choose a fan-scene album, add approved source photos, review the album details and credit cost, start generation, refresh All assets, and open the finished image.",
    imageUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/posters/aidreamcapes-ai-image-tutorial-55s.jpg?v=20260804resultfix2",
    videoUrl: "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4?v=20260804resultfix2",
    videoBadge: "AI image album workflow",
    playLabel: "Watch the Aidreamcapes AI image tutorial"
  });
}

function aidreamcapesMobileVideoShowcaseSection() {
  return section("mobile_video_showcase", {
    anchor: "mobile-video-tutorial",
    eyebrow: "Mobile tutorial",
    title: "Mobile workflow preview for Aidreamcapes.",
    subtitle: "See the image tutorial and video tutorial side by side in a vertical phone layout.",
    imageUrl: asset("gallery", "private-fan-scene-album-01"),
    imageAlt: "Aidreamcapes private fan-scene album preview",
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
    placeholderBody: "The vertical mobile walkthrough will appear here when the final video is ready."
  });
}

function homeSections() {
  return {
    hero_1: section("hero", {
      anchor: "home",
      eyebrow: "Private fan-scene and holiday albums",
      headline: "Create private fan-scene albums, game-day group portraits, and holiday memory sets.",
      subheadline: `Aidreamcapes turns approved source photos into original fan-scene photo albums, game-day group portraits, premiere-inspired portrait sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos. ${complianceCopy}`,
      imageUrl: asset("covers", "private-fan-scene-album"),
      secondaryImageUrl: asset("covers", "game-day-group-portraits"),
      tertiaryImageUrl: asset("covers", "christmas-group-album"),
      heroGridImages: [
        asset("covers", "private-fan-scene-album"),
        asset("covers", "game-day-group-portraits"),
        asset("covers", "premiere-flash-portraits"),
        asset("covers", "christmas-group-album"),
        asset("covers", "thanksgiving-keepsake-table-set"),
        asset("covers", "halloween-party-portrait-set"),
        asset("covers", "seasonal-celebration-photo-set")
      ].join("|"),
      bulletList: "Upload photos you own or have permission to use.|Choose fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal albums.|Review visible credit costs before generation starts.|Download finished results from your private Aidreamcapes gallery.",
      highlightWord: "private",
      heroBadge: "Permission-safe photo albums",
      authRibbon: "Fan and holiday themes live now",
      authPrimaryLabel: "Continue with email",
      authEmailPlaceholder: "Email address",
      authButtonLabel: "Create my private album with Email",
      authPrimaryHref: "/login?mode=login",
      authEmailHref: "/login?mode=register",
      imageBadge: "Fan and holiday albums",
      imageCaption: "Choose a private occasion album before starting.",
      socialProofLabel: "Approved source photos - visible credits - private album delivery",
      layout: "immersive_dark"
    }, [
      block("hero_cta_primary", "cta", { label: "Create a private album", href: "/login", style: "primary" }),
      block("hero_cta_secondary", "cta", { label: "Browse occasion albums", href: "/collections", style: "secondary" }),
      block("hero_stat_permission", "stat", { value: "Rights", label: "source-photo permission required" }),
      block("hero_stat_themes", "stat", { value: "7", label: "fan and holiday categories" }),
      block("hero_stat_private", "stat", { value: "Private", label: "uploads and albums" })
    ]),
    brand_strip_1: section("brand_logo_strip", {
      anchor: "trusted",
      title: "Fan-scene albums, game-day group portraits, premiere looks, Christmas groups, Thanksgiving keepsakes, Halloween party portraits, and seasonal celebration photos.",
      style: "quiet"
    }, [
      block("logo_fan_scene", "logo", { name: "Fan-scene albums", imageUrl: "", badge: "Private" }),
      block("logo_game_day", "logo", { name: "Game-day portraits", imageUrl: "", badge: "Sports energy" }),
      block("logo_premiere", "logo", { name: "Premiere-inspired sets", imageUrl: "", badge: "VIP mood" }),
      block("logo_christmas", "logo", { name: "Christmas groups", imageUrl: "", badge: "Holiday" }),
      block("logo_seasonal", "logo", { name: "Thanksgiving and Halloween", imageUrl: "", badge: "Seasonal" })
    ]),
    visual_proof_1: section("dreamshoot_visual_proof", {
      anchor: "proof-gallery",
      label: "Occasion proof gallery",
      title: "See how approved photos become private fan and holiday albums.",
      subtitle: "Compare fan-scene albums, game-day group portraits, premiere-inspired sets, Christmas groups, Thanksgiving keepsakes, Halloween party portraits, and seasonal celebration photos before you start.",
      tabs: "All|Fan Scenes|Game Day|Premiere|Christmas|Thanksgiving|Halloween|Seasonal",
      badges: "Private albums|Permission-safe styling|Holiday-ready sets",
      primaryCta: "Start this album",
      primaryHref: "/login"
    }, [
      block("proof_fan_scene", "proof_card", { title: "Private fan-scene albums", description: "Meetup-style moments, fan wall portraits, and original supporter scenes.", category: "Fan Scenes", badge: "Featured", imageUrl: asset("covers", "private-fan-scene-album"), previewImages: `${asset("gallery", "private-fan-scene-album-11")}|${asset("gallery", "backstage-meetup-portraits-12")}`, tags: "Fan-Scene Albums|Supporter Moments|Private Gallery", photoCountLabel: "20 Photos", usesLabel: "Fan-scene albums", href: "/collections/fan-scene-albums" }),
      block("proof_game_day", "proof_card", { title: "Game-day group portraits", description: "Arena energy, watch-party album mood, and supporter group photos without official marks.", category: "Game Day", badge: "Group", imageUrl: asset("covers", "game-day-group-portraits"), previewImages: `${asset("gallery", "game-day-group-portraits-11")}|${asset("gallery", "stadium-night-fan-set-12")}`, tags: "Game-Day Portraits|Watch-Party Albums|Supporter Moments", photoCountLabel: "20 Photos", usesLabel: "Game-day portraits", href: "/collections/game-day-group-photos" }),
      block("proof_premiere", "proof_card", { title: "Premiere flash portraits", description: "Red-carpet flash, VIP arrival mood, and polished creator portraits.", category: "Premiere", badge: "VIP", imageUrl: asset("covers", "premiere-flash-portraits"), previewImages: `${asset("gallery", "premiere-flash-portraits-11")}|${asset("gallery", "vip-arrival-photo-set-12")}`, tags: "Premiere Sets|VIP Mood|Private Gallery", photoCountLabel: "20 Photos", usesLabel: "Premiere sets", href: "/collections/premiere-style-portraits" }),
      block("proof_christmas", "proof_card", { title: "Cozy Christmas card portraits", description: "Warm card-ready portraits, festive interiors, and private winter album images.", category: "Christmas", badge: "Holiday", imageUrl: asset("covers", "cozy-card-portrait-set"), previewImages: `${asset("gallery", "christmas-group-album-11")}|${asset("gallery", "cozy-card-portrait-set-12")}`, tags: "Christmas Albums|Holiday Memories|Card-Ready Crops", photoCountLabel: "20 Photos", usesLabel: "Christmas albums", href: "/collections/christmas-holiday-albums" }),
      block("proof_halloween", "proof_card", { title: "Halloween party portraits", description: "Original costume-friendly portraits, dramatic color, and seasonal album scenes.", category: "Halloween", badge: "Seasonal", imageUrl: asset("covers", "halloween-party-portrait-set"), href: "/collections/halloween-party-portraits" })
    ]),
    featured_pack_1: section("dreamshoot_featured_pack", {
      anchor: "featured-pack",
      label: "Featured Aidreamcapes album",
      badge: "Signature",
      title: "Fan-scene albums with private, permission-safe styling.",
      subtitle: "Build a fan meetup feeling, supporter photo wall, spotlight portrait, and album-ready crops from source photos you are allowed to use.",
      primaryCta: "Create a fan-scene album",
      primaryHref: "/tools/fan-scene-album-builder",
      secondaryCta: "Browse occasion albums",
      secondaryHref: "/collections",
      photos: "Private album",
      credits: "24 credits",
      privacy: "Permission-safe",
      includedTitle: "Included outputs",
      includedOutputs: "Fan-scene portraits|Meetup-style moments|Supporter photo-wall crops|Spotlight images|Private album cover|Square profile crops|Group-friendly scenes|Download-ready visuals",
      safetyCopy: complianceCopy,
      overlayTitle: "Fan-Scene Album",
      overlaySubtitle: "Original fan mood without copying real public figures.",
      overlayChips: "fan-scene|group-friendly|spotlight|private",
      bottomNote: "Seasonal Aidreamcapes albums rotate around game-day moments, Christmas, Thanksgiving, Halloween, and personal celebration sets.",
      campaignLabel: "Current focus: private fan-scene albums",
      nextCampaignLabel: "Next: Christmas / Thanksgiving / Halloween"
    }, [
      block("featured_fan_scene", "seasonal_image", { label: "Fan-scene album", meta: "Private meetup mood", imageUrl: asset("covers", "private-fan-scene-album"), collectionSlug: "fan-scene-albums", shape: "wide" }),
      block("featured_game_day", "seasonal_image", { label: "Game-day group", meta: "Supporter energy", imageUrl: asset("covers", "game-day-group-portraits"), collectionSlug: "game-day-group-photos", shape: "tall" }),
      block("featured_premiere", "seasonal_image", { label: "Premiere flash", meta: "VIP-inspired", imageUrl: asset("covers", "premiere-flash-portraits"), collectionSlug: "premiere-style-portraits", shape: "tall" }),
      block("featured_christmas", "seasonal_image", { label: "Christmas album", meta: "Group cards", imageUrl: asset("covers", "christmas-group-album"), collectionSlug: "christmas-group-albums", shape: "wide" }),
      block("featured_thanksgiving", "seasonal_image", { label: "Thanksgiving set", meta: "Keepsake warmth", imageUrl: asset("covers", "thanksgiving-keepsake-table-set"), collectionSlug: "thanksgiving-table-keepsakes", shape: "tall" }),
      block("featured_halloween", "seasonal_image", { label: "Halloween portraits", meta: "Original party mood", imageUrl: asset("covers", "halloween-party-portrait-set"), collectionSlug: "halloween-party-portraits", shape: "tall" })
    ]),
    featured_christmas_1: section("dreamshoot_featured_pack", {
      anchor: "christmas-holiday-albums",
      label: "Featured Aidreamcapes holiday album",
      badge: "Christmas albums",
      title: "Build a private Christmas album around the people in your own photos.",
      subtitle: "Create festive group portraits, card covers, winter greeting scenes, and cozy album crops from approved source photos.",
      primaryCta: "Create a Christmas album",
      primaryHref: "/tools/christmas-group-album-studio",
      secondaryCta: "Browse Christmas albums",
      secondaryHref: "/collections/christmas-holiday-albums",
      photos: "Group album",
      credits: "22 credits",
      privacy: "Permission-safe",
      includedTitle: "Included outputs",
      includedOutputs: "Festive group portraits|Christmas album scenes|Card cover images|Cozy winter crops|Greeting album visuals|Private downloads|Family-style keepsakes|Account-only gallery",
      safetyCopy: complianceCopy,
      overlayTitle: "Christmas Holiday Albums",
      overlaySubtitle: "Cozy festive sets with account-only delivery.",
      overlayChips: "Christmas|group album|card cover|private",
      bottomNote: "Aidreamcapes Christmas albums keep source-photo permission, visible credits, and private delivery clear before generation.",
      campaignLabel: "Current focus: Christmas holiday albums",
      nextCampaignLabel: "Next: Thanksgiving / Halloween / Seasonal"
    }, [
      block("featured_christmas_album", "seasonal_image", { label: "Christmas album", meta: "Festive cover", imageUrl: asset("covers", "christmas-group-album"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_category", "seasonal_image", { label: "Holiday category", meta: "Group-ready set", imageUrl: asset("categories", "christmas-holiday-albums"), collectionSlug: "christmas-holiday-albums", shape: "square" }),
      block("featured_christmas_gallery_1", "seasonal_image", { label: "Card cover", meta: "Cozy crop", imageUrl: asset("gallery", "christmas-group-album-01"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_gallery_2", "seasonal_image", { label: "Winter greeting", meta: "Private album", imageUrl: asset("gallery", "christmas-group-album-02"), collectionSlug: "winter-fan-greeting-albums", shape: "square" }),
      block("featured_christmas_group", "seasonal_image", { label: "Group album", meta: "Family-style mood", imageUrl: asset("categories", "christmas-group-albums"), collectionSlug: "christmas-group-albums", shape: "square" }),
      block("featured_christmas_motion", "seasonal_image", { label: "Holiday story", meta: "Album-ready frame", imageUrl: asset("posters", "christmas-card-motion"), collectionSlug: "christmas-holiday-albums", shape: "square" })
    ]),
    featured_thanksgiving_1: section("dreamshoot_featured_pack", {
      anchor: "thanksgiving-memory-sets",
      label: "Featured Aidreamcapes occasion album",
      badge: "Thanksgiving sets",
      title: "Turn a gathering table into a permission-safe Thanksgiving keepsake set.",
      subtitle: "Create gratitude portraits, Friendsgiving memories, host-story crops, and warm dinner-table album images from approved photos.",
      primaryCta: "Create a Thanksgiving set",
      primaryHref: "/tools/thanksgiving-keepsake-set-maker",
      secondaryCta: "Browse Thanksgiving sets",
      secondaryHref: "/collections/thanksgiving-memory-sets",
      photos: "Keepsake set",
      credits: "20 credits",
      privacy: "Private delivery",
      includedTitle: "Included outputs",
      includedOutputs: "Gratitude portraits|Dinner-table warmth|Friendsgiving memories|Group-friendly keepsakes|Host story crops|Seasonal card images|Private album covers|Download-ready visuals",
      safetyCopy: complianceCopy,
      overlayTitle: "Thanksgiving Keepsake Sets",
      overlaySubtitle: "Warm occasion albums from approved source photos.",
      overlayChips: "Thanksgiving|keepsake|Friendsgiving|private",
      bottomNote: "Thanksgiving sets work best when each person is clear and the album mood stays simple, warm, and permission-safe.",
      campaignLabel: "Current focus: Thanksgiving keepsake sets",
      nextCampaignLabel: "Next: Christmas / Halloween / Seasonal"
    }, [
      block("featured_thanksgiving_cover", "seasonal_image", { label: "Keepsake table", meta: "Warm cover", imageUrl: asset("covers", "thanksgiving-keepsake-table-set"), collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_category", "seasonal_image", { label: "Memory sets", meta: "Occasion category", imageUrl: asset("categories", "thanksgiving-memory-sets"), collectionSlug: "thanksgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_gallery_1", "seasonal_image", { label: "Gratitude portrait", meta: "Private gallery", imageUrl: asset("gallery", "thanksgiving-keepsake-table-set-01"), collectionSlug: "gratitude-group-portraits", shape: "square" }),
      block("featured_thanksgiving_gallery_2", "seasonal_image", { label: "Friendsgiving scene", meta: "Group crop", imageUrl: asset("gallery", "thanksgiving-keepsake-table-set-02"), collectionSlug: "friendsgiving-memory-sets", shape: "square" }),
      block("featured_thanksgiving_table", "seasonal_image", { label: "Table keepsake", meta: "Seasonal card", imageUrl: asset("categories", "thanksgiving-table-keepsakes"), collectionSlug: "thanksgiving-table-keepsakes", shape: "square" }),
      block("featured_thanksgiving_motion", "seasonal_image", { label: "Host story", meta: "Album-ready frame", imageUrl: asset("posters", "thanksgiving-keepsake-film"), collectionSlug: "thanksgiving-memory-sets", shape: "square" })
    ]),
    package_catalog_1: section("dreamshoot_package_catalog", {
      anchor: "packages",
      label: "Occasion album catalog",
      title: "Choose a private fan or holiday album first.",
      subtitle: `Each Aidreamcapes album shows a finished direction, output count, credit cost, source-photo guidance, and safety boundary before you generate. ${complianceCopy}`,
      tabs: "All|Fan Scenes|Game Day|Premiere|Christmas|Thanksgiving|Halloween|Seasonal",
      steps: "Pick album|Review credit cost|Generate private gallery",
      source: "creative_packs",
      featuredCount: 7
    }, parentCategories.map((category, index) => block(`catalog_${category.slug.replace(/[^a-z0-9]+/g, "_")}`, "catalog_pack", {
      title: category.label,
      description: category.description,
      category: category.label.replace(/ Albums| Portraits| Sets| Photos/g, ""),
      meta: index < 3 ? "Fan-scene direction" : "Holiday direction",
      credits: `${firstPackDefForCategorySlug(category.slug)?.creditCost ?? 20} credits`,
      imageUrl: asset("categories", category.slug),
      href: `/collections/${category.slug}`
    }))),
    generation_showcase_1: section("dreamshoot_generation_showcase", {
      anchor: "generated-showcase",
      eyebrow: "Customer-created occasion examples",
      title: "Browse private fan-scene, game-day, and holiday themes customers can create.",
      subtitle: "These examples use Aidreamcapes-owned theme assets and approved source-photo assumptions. Scan the labels for fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, and seasonal directions.",
      imageTitle: "Fan and holiday image themes",
      videoTitle: "Customer travel video themes",
      primaryCta: "Start with approved photos",
      primaryHref: "/login",
      imageSlugs: homepageShowcaseImageSlugs.join("|"),
      videoSlugs: videoDefs.map((theme) => theme.slug).join("|"),
      itemLimit: 8
    }),
    tutorial_video_1: aidreamcapesTutorialVideoSection(),
    tutorial_video_2: aidreamcapesImageTutorialVideoSection(),
    mobile_video_1: aidreamcapesMobileVideoShowcaseSection(),
    flow_bridge_1: section("dreamshoot_flow_bridge", {
      anchor: "workflow",
      label: "Private album workflow",
      title: "From approved upload to private fan or holiday album.",
      subtitle: "Aidreamcapes keeps source-photo rights, album direction, credit spend, and private delivery in one clear customer workflow.",
      beforeImage: asset("covers", "private-fan-scene-album"),
      afterImage: asset("covers", "premiere-flash-portraits"),
      albumImageOne: asset("covers", "christmas-group-album"),
      albumImageTwo: asset("covers", "thanksgiving-keepsake-table-set"),
      albumImageThree: asset("covers", "halloween-party-portrait-set"),
      bridgeCta: "Choose credits for an occasion album",
      bridgeHref: "/pricing"
    }, [
      block("flow_upload", "card", { title: "Upload approved photos", text: "Add clear source photos that you own or have permission to use.", meta: "01", imageUrl: asset("covers", "private-fan-scene-album") }),
      block("flow_pick", "card", { title: "Pick a fan or holiday direction", text: "Choose fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal album styling.", meta: "02", imageUrl: asset("covers", "game-day-group-portraits") }),
      block("flow_credit", "card", { title: "Review credits first", text: "The credit cost is visible before generation reserves anything.", meta: "03", imageUrl: asset("covers", "thanksgiving-keepsake-table-set") }),
      block("flow_download", "card", { title: "Download privately", text: "Finished results return to the signed-in account gallery.", meta: "04", imageUrl: asset("covers", "seasonal-celebration-photo-set") })
    ]),
    pricing_1: section("pricing_table", {
      anchor: "plans",
      title: "Fan and holiday album credit plans",
      subtitle: "Choose a plan based on how many private fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, or seasonal albums you want to create.",
      productType: "subscription",
      featuredProductId: "prod_aidreamcapes_pro",
      featuredBadgeLabel: "Most Popular",
      showCheckoutNote: true,
      backgroundImage: asset("covers", "seasonal-celebration-photo-set")
    }),
    proof_1: section("testimonial_wall", {
      anchor: "reviews",
      title: "Ways customers use Aidreamcapes.",
      subtitle: "Private examples for fan-scene albums, game-day groups, premiere-inspired portraits, and seasonal celebration photos.",
      summaryTitle: "Private occasion albums",
      summaryBody: "Source photos, credits, and finished galleries stay connected to one signed-in account.",
      summaryRating: "",
      summaryMeta: "Use cases"
    }, [
      block("proof_album", "testimonial", { quote: "The fan-scene album gave our group a polished supporter moment without copying any real star.", name: "Private fan album", role: "Fan-scene use case", avatarUrl: asset("covers", "private-fan-scene-album"), resultImageUrl: asset("gallery", "private-fan-scene-album-01") }),
      block("proof_game", "testimonial", { quote: "We made a game-day group set that felt energetic and stayed free of official marks.", name: "Game-day group", role: "Sports-energy use case", avatarUrl: asset("covers", "game-day-group-portraits"), resultImageUrl: asset("gallery", "game-day-group-portraits-01") }),
      block("proof_holiday", "testimonial", { quote: "Our seasonal album had Christmas, Thanksgiving, and Halloween directions in one private workflow.", name: "Holiday memories", role: "Seasonal album use case", avatarUrl: asset("covers", "christmas-group-album"), resultImageUrl: asset("gallery", "halloween-party-portrait-set-01") })
    ]),
    trust_1: section("trust_signal_bar", {
      anchor: "trust",
      title: "Approved photos, visible credits, no protected likeness or marks."
    }, [
      block("trust_permission", "stat", { value: "Permission", label: "upload photos you own or have permission to use" }),
      block("trust_likeness", "stat", { value: "Original", label: "no real celebrity, athlete, or public figure recreation" }),
      block("trust_marks", "stat", { value: "No marks", label: "no official team logos, event marks, brand logos, or trademarks" }),
      block("trust_private", "stat", { value: "Private", label: "uploads, credits, jobs, and albums stay account-scoped" })
    ]),
    faq_1: section("faq", {
      anchor: "faq",
      eyebrow: "Fan and holiday album questions",
      title: "Aidreamcapes FAQ",
      subtitle: "Answers about source-photo permission, fan-scene styling, game-day boundaries, holiday albums, credits, privacy, and delivery.",
      journeyTitle: "Your private album flow",
      journeyTitles: "Upload|Choose Theme|Review Credits|Download",
      journeyDescriptions: "Add approved photos.|Pick a fan or holiday direction.|See the credit cost first.|Review the private gallery."
    }, [
      block("faq_source", "faq_item", { question: "What photos can I upload?", answer: "Upload only photos you own or have permission to use. Clear recent portraits and group photos work best for private fan-scene and holiday albums." }),
      block("faq_likeness", "faq_item", { question: "Can Aidreamcapes recreate a real celebrity or athlete?", answer: "No. Aidreamcapes can create original fan-scene, game-day, and premiere-inspired atmosphere, but it does not promise or support copying real celebrities, real athletes, public figures, official marks, or protected assets." }),
      block("faq_logos", "faq_item", { question: "Can I use official team logos or brand marks?", answer: "Only if you have permission. Otherwise requests should use original colors, generic supporter mood, and non-branded styling." }),
      block("faq_credits", "faq_item", { question: "When are credits spent?", answer: "Credits are shown before generation. A request reserves credits while it runs, uses them after successful delivery, and can release them if the request fails." }),
      block("faq_private", "faq_item", { question: "Are uploads and galleries private?", answer: "Yes. Source photos, jobs, credits, finished albums, and downloads stay tied to the signed-in Aidreamcapes account." })
    ]),
    conversion_1: section("conversion_panel", {
      anchor: "start",
      eyebrow: "Start a private occasion album",
      title: "Create fan-scene, game-day, or holiday photos from approved source images.",
      subtitle: "Choose a theme, upload photos you can use, review the credit cost, and keep finished results in your private Aidreamcapes gallery.",
      primaryCta: "Start an album",
      primaryHref: "/login",
      secondaryCta: "Browse albums",
      secondaryHref: "/collections"
    }, [
      block("cta_metric_credits", "stat", { value: "Credits", label: "shown before generation" }),
      block("cta_metric_themes", "stat", { value: "7", label: "fan and holiday categories" }),
      block("cta_metric_private", "stat", { value: "Private", label: "uploads and albums" })
    ])
  };
}

function applyHomePage(pageJson) {
  pageJson.pageType = "home";
  pageJson.version = pageJson.version ?? 1;
  pageJson.sectionsOrder = [
    "hero_1",
    "brand_strip_1",
    "visual_proof_1",
    "featured_pack_1",
    "featured_christmas_1",
    "featured_thanksgiving_1",
    "package_catalog_1",
    "generation_showcase_1",
    "tutorial_video_1",
    "tutorial_video_2",
    "mobile_video_1",
    "flow_bridge_1",
    "pricing_1",
    "proof_1",
    "faq_1",
    "trust_1",
    "conversion_1"
  ];
  pageJson.sections = homeSections();
  pageJson.seo = seo(
    "Aidreamcapes private fan-scene photo albums and holiday memory sets",
    "Create Aidreamcapes fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos from approved source images.",
    "/",
    "fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, holiday memory albums, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, Aidreamcapes"
  );
  return pageJson;
}

function applyCollectionPage(pageJson) {
  pageJson.pageType = "collection";
  pageJson.sections ??= {};
  pageJson.sectionsOrder = Array.from(new Set(["taxonomy_1", "packages_1", "sample_strip_1", "proof_pairs_1", "packages_strip_1", "feature_tabs_1", "trust_1", "conversion_1"].filter(Boolean)));
  pageJson.sections.taxonomy_1 = section("package_taxonomy", {
    anchor: "collections",
    eyebrow: "Occasion albums",
    title: "Browse fan-scene and holiday album categories.",
    subtitle: `Choose from fan-scene albums, game-day group portraits, premiere-inspired portrait sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos. ${complianceCopy}`,
    source: "creative_packs",
    layout: "editorial",
    maxCount: "28"
  });
  pageJson.sections.packages_1 = section("photo_package_wall", {
    anchor: "packages",
    eyebrow: "Private album catalog",
    title: "Aidreamcapes fan and holiday photo packages.",
    subtitle: "Compare album direction, credit cost, output count, and safety boundaries before generation.",
    source: "creative_packs",
    layout: "editorial",
    maxCount: "32"
  });
  pageJson.sections.sample_strip_1 = section("sample_strip", {
    eyebrow: "Theme samples",
    title: "Fan-scene, game-day, premiere, and holiday visual directions.",
    subtitle: "Preview the kind of private album each category is built to support."
  }, parentCategories.slice(0, 6).map((category, index) => block(`sample_${category.slug}`, "sample", { label: category.label, imageUrl: asset("categories", category.slug), meta: index < 3 ? "Fan theme" : "Holiday theme" })));
  pageJson.sections.proof_pairs_1 = section("feature_grid", {
    eyebrow: "Rights first",
    title: "Original scenes from approved photos.",
    subtitle: complianceCopy,
    source: "blocks",
    layout: "cards"
  }, [
    block("proof_source", "card", { meta: "01", title: "Approved source photos", text: "Every album starts with images you own or have permission to use." }),
    block("proof_original", "card", { meta: "02", title: "Original atmosphere", text: "Fan, game-day, premiere, and holiday mood without copying protected likenesses." }),
    block("proof_private", "card", { meta: "03", title: "Private delivery", text: "Finished results stay inside the customer account gallery." })
  ]);
  pageJson.sections.packages_strip_1 = homeSections().flow_bridge_1;
  pageJson.sections.feature_tabs_1 = section("feature_tabs", {
    eyebrow: "Album fit",
    title: "Pick by occasion, not by prompt.",
    subtitle: "Choose the category that matches the final use case, then review credit cost and source guidance."
  }, parentCategories.slice(0, 4).map((category, index) => block(`tab_${category.slug}`, "tab", { title: category.label, text: category.description, imageUrl: asset("categories", category.slug), meta: `0${index + 1}` })));
  pageJson.sections.trust_1 = homeSections().trust_1;
  pageJson.sections.conversion_1 = homeSections().conversion_1;
  pageJson.seo = seo(
    "Fan-scene and holiday photo album categories | Aidreamcapes",
    "Browse Aidreamcapes fan-scene albums, game-day group portraits, premiere-inspired portrait sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos.",
    "/collections",
    "Aidreamcapes collections, fan-scene albums, game-day group portraits, holiday memory albums, Christmas group albums, Halloween party portraits"
  );
  return pageJson;
}

function applyToolsPage(pageJson) {
  pageJson.pageType = "tools";
  pageJson.sections ??= {};
  pageJson.sectionsOrder = ["free_tools_1", "feature_tabs_1", "plan_rules_1", "packages_1", "trust_1", "pricing_1", "faq_1", "conversion_1"];
  pageJson.sections.free_tools_1 = section("free_tool_wall", {
    anchor: "tools",
    eyebrow: "Aidreamcapes tools",
    title: "Tools for fan-scene albums and holiday memory sets.",
    subtitle: `Start with a tool built around the occasion you want. ${complianceCopy}`,
    source: "tool_menu",
    maxCount: "20",
    primaryCta: "Open private workspace",
    primaryHref: "/login"
  });
  pageJson.sections.feature_tabs_1 = section("feature_tabs", {
    eyebrow: "Choose the right builder",
    title: "Fan-scene, game-day, premiere, and seasonal tools stay separate.",
    subtitle: "Each tool keeps credit cost, source-photo guidance, and safety boundaries visible before generation."
  }, toolDefs.slice(0, 6).map((tool, index) => block(`tool_tab_${tool.slug}`, "tab", { title: tool.title, text: tool.description, imageUrl: asset("covers", tool.packSlug), href: `/tools/${tool.slug}`, meta: `0${index + 1}` })));
  pageJson.sections.plan_rules_1 = section("rich_text", {
    anchor: "plan-rules",
    eyebrow: "Before generation",
    title: "Credits and permissions are checked first.",
    body: complianceCopy,
    imageUrl: asset("covers", "creator-supporter-photo-wall"),
    primaryCta: "Choose a plan",
    primaryHref: "/pricing",
    secondaryCta: "Browse albums",
    secondaryHref: "/collections",
    tone: "dark"
  });
  pageJson.sections.packages_1 = section("photo_package_wall", { anchor: "packages", eyebrow: "Related albums", title: "Fan and holiday packages", subtitle: "Browse album categories before opening a tool.", source: "creative_packs", layout: "editorial", maxCount: "12" });
  pageJson.sections.trust_1 = homeSections().trust_1;
  pageJson.sections.pricing_1 = homeSections().pricing_1;
  pageJson.sections.faq_1 = homeSections().faq_1;
  pageJson.sections.conversion_1 = homeSections().conversion_1;
  pageJson.seo = seo(
    "Aidreamcapes tools for fan-scene photo albums and holiday memory sets",
    "Use Aidreamcapes tools for fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos.",
    "/tools",
    "Aidreamcapes tools, fan-scene album builder, game-day group portrait maker, Christmas group album studio, Halloween party portrait maker"
  );
  return pageJson;
}

function applyPricingPage(pageJson) {
  pageJson.sections ??= {};
  pageJson.sections.pricing_intro_1 = section("rich_text", {
    eyebrow: "Pricing",
    title: "Choose credits for private fan and holiday albums.",
    body: "Plans support fan-scene albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos.",
    headingLevel: "h1",
    imageUrl: asset("covers", "seasonal-celebration-photo-set")
  });
  pageJson.sections.pricing_1 = homeSections().pricing_1;
  pageJson.sections.plan_rules_1 = section("rich_text", {
    anchor: "plan-rules",
    eyebrow: "Credit rules",
    title: "Review credit cost before every generation.",
    body: `Credits are shown before generation, reserved while the private request runs, used after successful delivery, and released if a request fails. ${complianceCopy}`,
    imageUrl: asset("covers", "creator-supporter-photo-wall"),
    primaryCta: "Browse albums",
    primaryHref: "/collections",
    secondaryCta: "FAQ",
    secondaryHref: "/faq"
  });
  pageJson.sections.trust_1 = homeSections().trust_1;
  pageJson.sections.faq_1 = homeSections().faq_1;
  pageJson.sections.conversion_1 = homeSections().conversion_1;
  pageJson.seo = seo(
    "Aidreamcapes pricing for fan-scene and holiday photo albums",
    "Compare Aidreamcapes credit plans for private fan-scene albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos.",
    "/pricing",
    "Aidreamcapes pricing, AI photo credits, fan-scene albums, holiday memory albums, private gallery credits"
  );
  return pageJson;
}

function applyFaqPage(pageJson) {
  pageJson.sections ??= {};
  pageJson.sections.intro_1 = section("rich_text", {
    eyebrow: "Help",
    title: "Aidreamcapes fan and holiday album help.",
    body: "Find practical answers about approved source photos, fan-scene styling, game-day groups, holiday albums, credit use, private delivery, and refunds.",
    headingLevel: "h1"
  });
  pageJson.sections.faq_1 = homeSections().faq_1;
  pageJson.sections.plan_rules_1 = pageJson.sections.plan_rules_1 ?? homeSections().trust_1;
  pageJson.seo = seo(
    "Aidreamcapes FAQ for fan-scene and holiday photo albums",
    "Find Aidreamcapes FAQ answers about source-photo permission, celebrity and athlete likeness boundaries, game-day portraits, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, credits, privacy, and delivery.",
    "/faq",
    "Aidreamcapes FAQ, fan-scene albums FAQ, holiday photo album help, AI photo credit questions"
  );
  return pageJson;
}

function applyWorkflowPage(pageJson) {
  pageJson.pageType = "content";
  pageJson.sectionsOrder = ["workflow_intro_1", "tutorial_video_1", "tutorial_image_video_1", "mobile_video_1", "workflow_1", "plan_rules_1", "faq_1", "conversion_1"];
  pageJson.sections = {
    workflow_intro_1: section("rich_text", {
      eyebrow: "How it works",
      title: "How Aidreamcapes creates private fan-scene and holiday albums.",
      body: `Upload photos you own or have permission to use, choose a fan or holiday direction, review the visible credit cost, generate the private request, and download finished images from your account gallery. ${complianceCopy}`,
      headingLevel: "h1",
      tone: "dark",
      imageUrl: asset("covers", "private-fan-scene-album"),
      primaryCta: "Browse albums",
      primaryHref: "/collections",
      secondaryCta: "View pricing",
      secondaryHref: "/pricing"
    }, [
      block("workflow_private", "rich_text_card", { meta: "Private", title: "Account-scoped uploads", description: "Source photos, jobs, credits, and albums stay attached to the signed-in customer account." }),
      block("workflow_credits", "rich_text_card", { meta: "Credits", title: "Visible cost before generation", description: "Customers see the credit cost before a private request reserves credits." }),
      block("workflow_rights", "rich_text_card", { meta: "Rights", title: "Permission-safe theme boundaries", description: "Fan-scene and holiday album prompts avoid protected likenesses, logos, and official marks unless permission exists." })
    ]),
    tutorial_video_1: aidreamcapesTutorialVideoSection(),
    tutorial_image_video_1: aidreamcapesImageTutorialVideoSection(),
    mobile_video_1: aidreamcapesMobileVideoShowcaseSection(),
    workflow_1: homeSections().flow_bridge_1,
    plan_rules_1: homeSections().trust_1,
    faq_1: homeSections().faq_1,
    conversion_1: homeSections().conversion_1
  };
  pageJson.seo = seo(
    "How Aidreamcapes works for private fan-scene and holiday albums",
    "Learn how Aidreamcapes customers upload approved source photos, choose fan-scene or holiday album directions, review visible credits, generate private results, and download finished galleries.",
    "/workflow",
    "Aidreamcapes workflow, fan-scene photo albums, holiday memory albums, private AI photo gallery credits"
  );
  return pageJson;
}

function applyAboutPage(pageJson) {
  pageJson.sectionsOrder = ["about_intro_1", "about_values_1", "trust_1", "conversion_1"];
  pageJson.sections = {
    about_intro_1: section("rich_text", {
      eyebrow: "About Aidreamcapes",
      title: "Private fan-scene and holiday photo albums with clear boundaries.",
      body: "Aidreamcapes helps customers turn approved source photos into private fan-scene albums, game-day group portraits, premiere-inspired portrait sets, and holiday memory albums with visible credit costs and account-only delivery.",
      headingLevel: "h1",
      tone: "dark",
      imageUrl: asset("covers", "premiere-flash-portraits"),
      primaryCta: "Explore albums",
      primaryHref: "/collections",
      secondaryCta: "Contact us",
      secondaryHref: "/contact-us"
    }),
    about_values_1: section("rich_text", {
      eyebrow: "How we work",
      title: "Original occasion styling, not protected likeness copying.",
      body: complianceCopy,
      imageUrl: asset("covers", "creator-supporter-photo-wall")
    }, [
      block("about_permission", "rich_text_card", { meta: "01", title: "Permission first", description: "Source photos should belong to the customer or be used with permission." }),
      block("about_original", "rich_text_card", { meta: "02", title: "Original outputs", description: "Fan-scene, sports-energy, premiere, and holiday atmospheres stay original." }),
      block("about_private", "rich_text_card", { meta: "03", title: "Private delivery", description: "Finished albums return to the customer account for review and download." })
    ]),
    trust_1: homeSections().trust_1,
    conversion_1: homeSections().conversion_1
  };
  pageJson.seo = seo(
    "About Aidreamcapes private fan-scene and holiday albums",
    "Learn about Aidreamcapes, a private AI photo album workspace for fan-scene albums, game-day group portraits, premiere-inspired photo sets, and holiday memory albums from approved source photos.",
    "/about-us",
    "About Aidreamcapes, fan-scene albums, holiday memory albums, private AI photo gallery"
  );
  return pageJson;
}

function applyContactPage(pageJson) {
  pageJson.sectionsOrder = ["contact_intro_1", "contact_details_1", "faq_1", "conversion_1"];
  pageJson.sections = {
    contact_intro_1: section("rich_text", {
      eyebrow: "Contact Aidreamcapes",
      title: "Contact support for fan-scene and holiday album questions.",
      body: "Reach Aidreamcapes for account help, billing review, credit questions, upload guidance, source-photo permission questions, private album support, privacy requests, or plan questions.",
      headingLevel: "h1",
      tone: "dark",
      imageUrl: asset("covers", "seasonal-celebration-photo-set"),
      primaryCta: "Email support",
      primaryHref: `mailto:${supportEmail}`,
      secondaryCta: "View FAQ",
      secondaryHref: "/faq"
    }, [
      block("contact_support", "rich_text_card", { meta: "Support", title: supportEmail, description: "For account access, billing review, credit questions, upload help, privacy requests, and delivered album support." }),
      block("contact_safety", "rich_text_card", { meta: "Safety", title: "Source-photo and protected mark questions", description: "Ask before uploading images with unclear rights, official marks, or public-figure references." })
    ]),
    contact_details_1: section("policy_content", {
      title: "Contact information",
      headingLevel: "h2",
      lastUpdated: "July 30, 2026",
      contactEmail: supportEmail,
      body: `<h3>Company</h3><p>Aidreamcapes</p><h3>Contact Us</h3><p><a href="mailto:${supportEmail}">${supportEmail}</a></p>`
    }),
    faq_1: homeSections().faq_1,
    conversion_1: homeSections().conversion_1
  };
  pageJson.seo = seo(
    "Contact Aidreamcapes support",
    "Contact Aidreamcapes for fan-scene album support, holiday photo album guidance, source-photo permission questions, billing review, privacy requests, and private gallery help.",
    "/contact-us",
    "Contact Aidreamcapes, Aidreamcapes support, fan-scene album support, holiday photo album support"
  );
  return pageJson;
}

function buildToolPage(tool) {
  const pack = packDefs.find((item) => item.slug === tool.packSlug) ?? packDefs[0];
  return {
    id: `site_aidreamcapes_tool_${tool.slug.replace(/[^a-z0-9]+/g, "_")}`,
    siteId: aidreamcapesSiteId,
    pageType: "ai_tool",
    templateKey: "tool-detail",
    slug: `/tools/${tool.slug}`,
    title: tool.title,
    draftJson: toolPageJson(tool, pack),
    publishedJson: toolPageJson(tool, pack)
  };
}

function toolPageJson(tool, pack) {
  return {
    pageType: "ai_tool",
    version: 1,
    sectionsOrder: ["tool_banner_1", "entry_1", "upload_1", "form_1", "progress_1", "album_1", "trust_1", "faq_1"],
    sections: {
      tool_banner_1: section("tool_banner", { eyebrow: "Aidreamcapes tool", title: tool.title, subtitle: `${tool.description} ${complianceCopy}`, imageUrl: asset("covers", pack.slug) }),
      entry_1: section("ai_tool_entry", { aiAppSlug: "image_generator", eyebrow: "Private album builder", title: tool.title, subtitle: tool.description, ctaLabel: "Start this tool", ctaHref: `/app/create?tool_id=${tool.slug}`, imageUrl: asset("covers", pack.slug), toolSlug: tool.slug }),
      upload_1: section("upload_panel", { title: "Upload approved source photos", helper: "Use clear photos you own or have permission to use.", imageUrl: asset("covers", pack.slug) }),
      form_1: section("generation_form", { aiAppSlug: "image_generator", title: "Generate a private occasion album", helper: "Choose the theme, confirm credit cost, and start a private Aidreamcapes request." }),
      progress_1: section("job_progress", { title: "Generation progress" }),
      album_1: section("album_gallery", { title: "Private Aidreamcapes album", showDownloads: true }),
      trust_1: homeSections().trust_1,
      faq_1: homeSections().faq_1
    },
    seo: seo(
      `${tool.title} | Aidreamcapes`,
      `${tool.description} Review source-photo permission, visible credits, private gallery delivery, and protected likeness boundaries before generation.`,
      `/tools/${tool.slug}`,
      `${tool.title}, Aidreamcapes tool, fan-scene photo albums, holiday memory albums, private AI photo tool`,
      asset("covers", pack.slug)
    )
  };
}

function buildBlogPage(def) {
  const imageUrl = asset("covers", def.imageSlug);
  const body = [
    `<p>${def.summary}</p>`,
    "<h2>Start with approved source photos</h2>",
    "<p>Use photos you own or have permission to use. Clear faces, stable lighting, and simple group references help Aidreamcapes create a more consistent private album.</p>",
    "<h2>Keep the theme original</h2>",
    "<p>Fan-scene, game-day, premiere, and holiday styling should create atmosphere without copying real celebrities, real athletes, public figures, official marks, team logos, brand logos, trademarks, or protected materials.</p>",
    "<h2>Review credits before generation</h2>",
    "<p>Each package shows credit cost before the job starts. Finished results return to the signed-in account gallery for private review and download.</p>"
  ].join("");
  const pageJson = {
    pageType: "article",
    version: 1,
    sectionsOrder: ["blog_detail_1"],
    sections: {
      blog_detail_1: section("blog_article", {
        eyebrow: "Aidreamcapes guide",
        title: def.title,
        headingLevel: "h1",
        summary: def.summary,
        author: "Aidreamcapes editorial team",
        publishedAt: "2026-07-30",
        updatedAt: "2026-07-30",
        readMinutes: "6",
        imageUrl,
        imageAlt: `${def.title} cover image for Aidreamcapes private album guide`,
        tags: def.tags,
        primaryCta: "Start a private album",
        primaryHref: "/login",
        secondaryCta: "Browse albums",
        secondaryHref: "/collections",
        targetLabel: "Occasion Albums",
        targetHref: "/collections",
        body
      })
    },
    seo: seo(
      `${def.title} | Aidreamcapes`,
      def.summary,
      `/blog/${def.slug}`,
      `${def.tags.replaceAll("|", ", ")}, Aidreamcapes`,
      imageUrl
    )
  };
  return {
    id: `site_aidreamcapes_blog_${def.slug.replace(/[^a-z0-9]+/g, "_")}`,
    siteId: aidreamcapesSiteId,
    pageType: "article",
    templateKey: "blog-detail",
    slug: `/blog/${def.slug}`,
    title: def.title,
    draftJson: clone(pageJson),
    publishedJson: clone(pageJson)
  };
}

function applyBlogListPage(pageJson) {
  pageJson.pageType = "blog";
  pageJson.sectionsOrder = ["blog_intro_1", "blog_list_1", "packages_strip_1", "conversion_1"];
  pageJson.sections = {
    blog_intro_1: section("rich_text", {
      eyebrow: "Aidreamcapes guides",
      title: "Guides for fan-scene albums and holiday memory sets.",
      body: "Read source-photo, credit, and permission-safe planning guides for fan-scene albums, game-day group portraits, premiere-inspired photo sets, and seasonal albums.",
      headingLevel: "h1",
      imageUrl: asset("covers", "private-fan-scene-album")
    }),
    blog_list_1: section("blog_list", { title: "Aidreamcapes album guides", body: "Guides for source photos, fan-scene planning, game-day portraits, holiday albums, visible credits, and private delivery.", guideType: "AI photo album guide" }),
    packages_strip_1: homeSections().flow_bridge_1,
    conversion_1: homeSections().conversion_1
  };
  pageJson.seo = seo(
    "Aidreamcapes guides for fan-scene and holiday photo albums",
    "Read Aidreamcapes guides for fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, holiday memory albums, credits, source-photo permission, and private galleries.",
    "/blog",
    "Aidreamcapes blog, fan-scene photo album guide, holiday memory album guide, game-day group portraits"
  );
  return pageJson;
}

function applySearchPage(pageJson) {
  pageJson.sections ??= {};
  pageJson.sections.search_intro_1 = section("rich_text", { eyebrow: "Search", title: "Search albums, tools, pricing, and guides.", body: "Find Aidreamcapes fan-scene albums, game-day group portraits, premiere-inspired sets, holiday albums, tools, pricing, privacy, refunds, and upload guidance.", headingLevel: "h1" });
  pageJson.sections.search_1 = section("search_results", { eyebrow: "Site search", title: "Search Aidreamcapes fan and holiday albums", emptyTitle: "No matching content yet.", emptyBody: "Try fan-scene, game-day, premiere, Christmas, Thanksgiving, Halloween, seasonal, credits, uploads, or refunds.", resultLimit: 12 });
  pageJson.sections.packages_1 = section("photo_package_wall", { anchor: "packages", eyebrow: "Albums", title: "Related Aidreamcapes albums", subtitle: "Browse fan and holiday categories.", source: "creative_packs", maxCount: "12" });
  pageJson.sections.packages_strip_1 = homeSections().flow_bridge_1;
  pageJson.sections.conversion_1 = homeSections().conversion_1;
  pageJson.seo = seo(
    "Search Aidreamcapes fan-scene albums and holiday photo tools",
    "Search Aidreamcapes for fan-scene albums, game-day group portraits, premiere-inspired portrait sets, holiday memory albums, pricing, upload help, privacy, refunds, and private gallery guidance.",
    "/search",
    "Aidreamcapes search, fan-scene albums, holiday photo tools, private AI album help"
  );
  return pageJson;
}

function applyCartPage(pageJson) {
  pageJson.sections ??= {};
  pageJson.sections.cart_intro_1 = section("rich_text", { eyebrow: "Cart", title: "Confirm credits before creating private albums.", body: "Review your selected subscription or credit pack before starting Aidreamcapes fan-scene, game-day, premiere, or holiday album generation.", headingLevel: "h1" });
  pageJson.sections.cart_1 = section("cart_summary", { eyebrow: "Checkout summary", title: "Your selected Aidreamcapes plan", subtitle: "Plan, credits, and checkout status stay connected to your Aidreamcapes account.", emptyTitle: "Choose a plan first", emptyBody: "Open pricing to select a monthly or yearly plan.", returnLabel: "Back to pricing", returnHref: "/pricing" });
  pageJson.sections.pricing_1 = homeSections().pricing_1;
  pageJson.sections.plan_rules_1 = homeSections().trust_1;
  pageJson.sections.conversion_1 = homeSections().conversion_1;
  pageJson.seo = seo(
    "Aidreamcapes checkout for private fan and holiday albums",
    "Confirm selected Aidreamcapes credits for fan-scene albums, game-day group portraits, premiere-inspired photo sets, and holiday memory albums.",
    "/cart",
    "Aidreamcapes checkout, fan-scene album credits, holiday album credits",
    asset("covers", "seasonal-celebration-photo-set"),
    false
  );
  return pageJson;
}

function applyNotFoundPage(pageJson) {
  pageJson.sectionsOrder = ["not_found_1", "packages_1", "packages_strip_1", "conversion_1"];
  pageJson.sections = {
    not_found_1: section("not_found", { eyebrow: "404", title: "This Aidreamcapes page is not available.", subtitle: "Return to fan-scene albums, holiday packages, pricing, sign-in, or your private Aidreamcapes workspace.", primaryCta: "Return home", primaryHref: "/", secondaryCta: "View occasion albums", secondaryHref: "/collections" }),
    packages_1: section("photo_package_wall", { anchor: "packages", eyebrow: "Occasion albums", title: "Fan and holiday albums are available.", subtitle: "Choose a current Aidreamcapes album category before generating.", source: "creative_packs", layout: "editorial", maxCount: "12" }),
    packages_strip_1: homeSections().flow_bridge_1,
    conversion_1: homeSections().conversion_1
  };
  pageJson.seo = seo(
    "Aidreamcapes page not found",
    "The requested Aidreamcapes page is unavailable. Continue to fan-scene albums, holiday tools, help, pricing, or the private account workspace.",
    "/404",
    "Aidreamcapes 404, fan-scene albums, holiday photo albums",
    asset("covers", "private-fan-scene-album"),
    false
  );
  return pageJson;
}

function genericPageSeo(slug) {
  const safeSlug = slug === "/" ? "/" : slug;
  const titleBySlug = {
    "/login": "Sign in to Aidreamcapes private fan and holiday albums",
    "/app": "Aidreamcapes private album workspace",
    "/app/jobs/progress": "Aidreamcapes album generation progress",
    "/app/jobs/detail": "Aidreamcapes album request detail",
    "/album": "Aidreamcapes private album gallery",
    "/account": "Aidreamcapes credit account",
    "/privacy": "Aidreamcapes privacy for private photo albums",
    "/refunds": "Aidreamcapes refunds for private album credits",
    "/shipping": "Aidreamcapes digital album delivery",
    "/terms": "Aidreamcapes terms for private fan and holiday albums",
    "/content": "Aidreamcapes creative safety for fan and holiday albums",
    "/cookies": "Aidreamcapes cookie notice",
    "/children-privacy": "Aidreamcapes children privacy",
    "/state-privacy": "Aidreamcapes state privacy rights"
  };
  return seo(
    titleBySlug[safeSlug] ?? "Aidreamcapes private fan and holiday albums",
    "Aidreamcapes manages approved source photos, private fan-scene albums, game-day group portraits, holiday memory sets, visible credits, checkout records, and account-only gallery delivery.",
    safeSlug,
    "Aidreamcapes, private fan-scene albums, holiday memory albums, AI photo credits"
  );
}

function sanitizeString(value) {
  const replacements = [
    [/\/assets\/sites\/site_aidreamcapes\/creative-packs\/premiere-style-portraits-cover\.(?:png|webp)(?:\?[^"'|<> )]+)?/gi, asset("covers", "premiere-flash-portraits")],
    [/\/assets\/sites\/site_aidreamcapes\/creative-packs\/occasion-story\.(?:png|webp)(?:\?[^"'|<> )]+)?/gi, asset("covers", "private-fan-scene-album")],
    [/\/assets\/sites\/site_aidreamcapes\/creative-packs\/seasonal-groups\.(?:png|webp)(?:\?[^"'|<> )]+)?/gi, asset("covers", "seasonal-celebration-photo-set")],
    [/\/collections\/route-portrait-albums/gi, "/collections/fan-scene-albums"],
    [/\/collections\/destination-portrait-albums/gi, "/collections/fan-scene-albums"],
    [/\/collections\/coastal-light-sets/gi, "/collections/christmas-group-albums"],
    [/\/collections\/coastal-getaways/gi, "/collections/christmas-group-albums"],
    [/\/collections\/old-quarter-walks/gi, "/collections/premiere-style-portraits"],
    [/\/collections\/old-city-walks/gi, "/collections/premiere-style-portraits"],
    [/\/collections\/island-resort-scenes/gi, "/collections/seasonal-celebration-photos"],
    [/\/collections\/scenic-overlooks/gi, "/collections/game-day-group-photos"],
    [/\/collections\/alpine-trail-frames/gi, "/collections/seasonal-celebration-photos"],
    [/\/collections\/mountain-trails/gi, "/collections/game-day-group-photos"],
    [/\/collections\/cinematic-travel/gi, "/collections/game-day-group-photos"],
    [/\/collections\/travel-journal-covers/gi, "/collections/seasonal-celebration-photos"],
    [/\/collections\/family-travel-keepsakes/gi, "/collections/thanksgiving-memory-sets"],
    [/\/tools\/route-portrait-engine/gi, "/tools/fan-scene-album-builder"],
    [/\/tools\/coastal-portrait/gi, "/tools/christmas-group-album-studio"],
    [/\/tools\/travel-profile-story/gi, "/tools/fan-scene-album-builder"],
    [/\/tools\/cinematic-travel/gi, "/tools/game-day-group-portrait-maker"],
    [/\/tools\/route-moodboard/gi, "/tools/permission-safe-photo-planner"],
    [/\/tools\/family-travel-keepsakes/gi, "/tools/thanksgiving-keepsake-set-maker"],
    [/route-portrait-albums/gi, "fan-scene-albums"],
    [/destination-portrait-albums/gi, "fan-scene-albums"],
    [/coastal-light-sets/gi, "christmas-group-albums"],
    [/old-quarter-walks/gi, "premiere-style-portraits"],
    [/old-city-walks/gi, "premiere-style-portraits"],
    [/island-resort-scenes/gi, "seasonal-celebration-photos"],
    [/scenic-overlooks/gi, "game-day-group-photos"],
    [/alpine-trail-frames/gi, "seasonal-celebration-photos"],
    [/cinematic-travel/gi, "game-day-group-photos"],
    [/travel-journal-covers/gi, "seasonal-celebration-photos"],
    [/family-travel-keepsakes/gi, "thanksgiving-memory-sets"],
    [/\bAI travel portrait(s)?\b/gi, "AI fan-scene photo album$1"],
    [/\btravel portrait(s)?\b/gi, "fan-scene album$1"],
    [/\btravel package(s)?\b/gi, "occasion album$1"],
    [/\btravel album(s)?\b/gi, "private occasion album$1"],
    [/\bdestination album(s)?\b/gi, "private occasion album$1"],
    [/\bdestination scene(s)?\b/gi, "occasion scene$1"],
    [/\bdestination(s)?\b/gi, "occasion$1"],
    [/\broute portrait(s)?\b/gi, "fan-scene photo$1"],
    [/\broute(s)?\b/gi, "scene$1"],
    [/\bcoastal\b/gi, "holiday"],
    [/\bcoast\b/gi, "holiday"],
    [/\btravel\b/gi, "occasion"],
    [/\btraveler(s)?\b/gi, "customer$1"],
    [/\btrip(s)?\b/gi, "occasion$1"],
    [/\bjourney(s)?\b/gi, "album$1"],
    [/\bgetaway(s)?\b/gi, "occasion$1"],
    [/\bold quarter\b/gi, "premiere night"],
    [/\bold city\b/gi, "premiere night"],
    [/\balpine\b/gi, "winter"],
    [/\bmountain\b/gi, "seasonal"],
    [/\btrail(s)?\b/gi, "group$1"],
    [/\bresort(s)?\b/gi, "celebration$1"]
  ];
  let next = value;
  for (const [pattern, replacement] of replacements) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function sanitizeJson(value) {
  if (typeof value === "string") return sanitizeString(value);
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sanitizeJson);
  for (const [key, item] of Object.entries(value)) {
    value[key] = sanitizeJson(item);
  }
  return value;
}

function applyPageBySlug(page) {
  const pageSlug = page.slug;
  page.draftJson = sanitizeJson(page.draftJson ?? {});
  page.publishedJson = sanitizeJson(page.publishedJson ?? {});
  if (pageSlug === "/") {
    page.title = "Home";
    page.draftJson = applyHomePage(page.draftJson);
    page.publishedJson = applyHomePage(page.publishedJson);
  } else if (pageSlug === "/collections") {
    page.title = "Occasion albums";
    page.draftJson = applyCollectionPage(page.draftJson);
    page.publishedJson = applyCollectionPage(page.publishedJson);
  } else if (pageSlug === "/tools") {
    page.title = "Fan and holiday tools";
    page.draftJson = applyToolsPage(page.draftJson);
    page.publishedJson = applyToolsPage(page.publishedJson);
  } else if (pageSlug === "/pricing") {
    page.title = "Pricing";
    page.draftJson = applyPricingPage(page.draftJson);
    page.publishedJson = applyPricingPage(page.publishedJson);
  } else if (pageSlug === "/faq") {
    page.title = "FAQ";
    page.draftJson = applyFaqPage(page.draftJson);
    page.publishedJson = applyFaqPage(page.publishedJson);
  } else if (pageSlug === "/workflow") {
    page.title = "How it works";
    page.draftJson = applyWorkflowPage(page.draftJson);
    page.publishedJson = applyWorkflowPage(page.publishedJson);
  } else if (pageSlug === "/about-us") {
    page.title = "About Aidreamcapes";
    page.draftJson = applyAboutPage(page.draftJson);
    page.publishedJson = applyAboutPage(page.publishedJson);
  } else if (pageSlug === "/contact-us") {
    page.title = "Contact Aidreamcapes";
    page.draftJson = applyContactPage(page.draftJson);
    page.publishedJson = applyContactPage(page.publishedJson);
  } else if (pageSlug === "/blog") {
    page.title = "Guides";
    page.draftJson = applyBlogListPage(page.draftJson);
    page.publishedJson = applyBlogListPage(page.publishedJson);
  } else if (pageSlug === "/search") {
    page.title = "Search";
    page.draftJson = applySearchPage(page.draftJson);
    page.publishedJson = applySearchPage(page.publishedJson);
  } else if (pageSlug === "/cart") {
    page.title = "Cart";
    page.draftJson = applyCartPage(page.draftJson);
    page.publishedJson = applyCartPage(page.publishedJson);
  } else if (pageSlug === "/404") {
    page.title = "Page not found";
    page.draftJson = applyNotFoundPage(page.draftJson);
    page.publishedJson = applyNotFoundPage(page.publishedJson);
  } else {
    page.draftJson.seo = genericPageSeo(pageSlug);
    page.publishedJson.seo = genericPageSeo(pageSlug);
  }
  return page;
}

function currentCorePages(site) {
  const allowed = new Set([
    "/",
    "/pricing",
    "/collections",
    "/tools",
    "/login",
    "/app",
    "/app/jobs/progress",
    "/app/jobs/detail",
    "/album",
    "/account",
    "/privacy",
    "/refunds",
    "/shipping",
    "/terms",
    "/content",
    "/cookies",
    "/faq",
    "/blog",
    "/about-us",
    "/contact-us",
    "/search",
    "/cart",
    "/404",
    "/workflow",
    "/children-privacy",
    "/state-privacy"
  ]);
  return (site.pages ?? [])
    .filter((page) => allowed.has(page.slug))
    .map((page) => applyPageBySlug(clone(page)));
}

function sectionCountFromPages(pages) {
  return pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0);
}

function templateFromPageJson(pageJson) {
  return {
    ...clone(pageJson),
    content_for_page: clone(pageJson.sectionsOrder ?? []),
    sections: clone(pageJson.sections ?? {})
  };
}

function applyTemplateUpdates(theme) {
  theme.templates = sanitizeJson(theme.templates ?? {});
  theme.settings = sanitizeJson(theme.settings ?? {});
  const pagesByKey = {
    index: applyHomePage({}),
    collection: applyCollectionPage({}),
    tools: applyToolsPage({}),
    page: applyPricingPage({}),
    help: applyFaqPage({}),
    workflow: applyWorkflowPage({}),
    "about-us": applyAboutPage({}),
    "contact-us": applyContactPage({}),
    blog: applyBlogListPage({}),
    "blog-list": applyBlogListPage({}),
    search: applySearchPage({}),
    cart: applyCartPage({}),
    "404": applyNotFoundPage({}),
    product: toolPageJson(toolDefs[0], packDefs[0]),
    "blog-detail": buildBlogPage(blogDefs[0]).publishedJson
  };
  for (const [key, pageJson] of Object.entries(pagesByKey)) {
    if (theme.templates[key] || ["index", "collection", "tools", "page", "help", "product"].includes(key)) {
      theme.templates[key] = templateFromPageJson(pageJson);
    }
  }
  theme.settings = applyThemeSettings(theme.settings);
  return theme;
}

function applyThemeSettings(settings) {
  const next = sanitizeJson(settings ?? {});
  next.navigation ??= {};
  next.navigation.headerLinks = [
    { label: "Occasion Albums", href: "/collections" },
    { label: "Tools", href: "/tools" },
    { label: "How it works", href: "/workflow" },
    { label: "Help", href: "/faq" },
    { label: "Guides", href: "/blog" }
  ];
  next.navigation.footerLinks = [
    { label: "Fan-Scene Albums", href: "/collections/fan-scene-albums", group: "product" },
    { label: "Game-Day Group Portraits", href: "/collections/game-day-group-photos", group: "product" },
    { label: "Holiday Memory Albums", href: "/collections/seasonal-celebration-photos", group: "product" },
    { label: "Pricing", href: "/pricing", group: "product" },
    { label: "Guides", href: "/blog", group: "company" },
    { label: "About the Studio", href: "/about-us", group: "company" },
    { label: "Contact the Studio", href: "/contact-us", group: "company" },
    { label: "Refund Policy", href: "/refunds", group: "company" },
    { label: "Help Center", href: "/faq", group: "support" },
    { label: "Privacy Promise", href: "/privacy", group: "support" },
    { label: "Studio Terms", href: "/terms", group: "support" },
    { label: "Creative Safety", href: "/content", group: "support" },
    { label: "Cookie Notice", href: "/cookies", group: "support" }
  ];
  next.seo = {
    title: "Aidreamcapes private fan-scene photo albums and holiday memory sets",
    description: "Create private Aidreamcapes fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits, and seasonal celebration photos from approved source images.",
    keywords: "Aidreamcapes, fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, holiday memory albums, Christmas group albums, Thanksgiving keepsake sets, Halloween party portraits",
    canonicalPath: "/",
    canonicalUrl: "https://www.aidreamcapes.com/",
    ogImage: asset("covers", "private-fan-scene-album"),
    robots: { index: true, follow: true }
  };
  next.globalSections ??= {};
  next.globalSections.header ??= { type: "header", settings: {}, blocks: [] };
  next.globalSections.header.settings = {
    ...(next.globalSections.header.settings ?? {}),
    title: "ልiጋreamርapes",
    sticky: true,
    ctaLabel: "Start an album",
    ctaHref: "/login",
    style: "dark_pills",
    mobileLabel: "Menu",
    logoImageUrl: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c",
    logoAlt: "Aidreamcapes logo for private fan-scene and holiday photo albums",
    announcement: "Create private fan-scene and holiday albums from approved photos."
  };
  const headerBlocks = [
    ...next.navigation.headerLinks.map((link, index) => block(`global_header_${index + 1}`, "menu_link", link)),
    ...toolDefs.slice(0, 6).map((tool) => block(`tool_${tool.slug}`, "tool_card", {
      title: tool.title,
      description: tool.description,
      category: toolCategoryDefs.find((category) => category.slug === tool.categorySlug)?.label ?? "Tool",
      badge: tool.sortOrder <= 3 ? "Featured" : "Seasonal",
      imageUrl: asset("covers", tool.packSlug),
      href: `/tools/${tool.slug}`
    }))
  ];
  next.globalSections.header.blocks = headerBlocks;
  next.globalSections.footer = section("footer", {
    title: "Aidreamcapes",
    description: "Private fan-scene photo albums, game-day group portraits, premiere-inspired photo sets, and holiday memory albums from approved source photos.",
    socialBody: "Fan-scene album ideas, seasonal keepsake planning, private delivery, and elegant AI-generated photo sets.",
    bottomLine: "Private albums, live pricing, and fan-to-holiday photo storytelling in one storefront.",
    logoImageUrl: "/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg?v=20260708c",
    logoAlt: "Aidreamcapes logo for private fan-scene and holiday photo albums",
    contactEmail: supportEmail,
    copyright: "© 2026 Aidreamcapes.com. All rights reserved."
  }, next.navigation.footerLinks.map((link, index) => block(`global_footer_${index + 1}`, "menu_link", link)));
  const currentSettings = sanitizeJson(next.settings_data?.current ?? {});
  const headerPlusSection = section("header_plus", {
    ...next.globalSections.header.settings,
    is_announce_show: true,
    announce_title: "Create private fan-scene and holiday albums from approved photos.",
    announce_bg_color: "#05070E",
    announce_color: "#F8FAFF"
  }, headerBlocks);
  const footerPlusSection = section("footer_plus", {
    footer_bg_color: "#111114",
    footer_text_color: "#d8d0c7",
    title: "Aidreamcapes",
    description: "Private fan-scene and holiday photo albums with visible credits and account-only delivery.",
    contactEmail: supportEmail
  }, next.navigation.footerLinks.map((link, index) => block(`footer_plus_${index + 1}`, "menu_link", link)));
  currentSettings.sections = {
    ...(currentSettings.sections ?? {}),
    header_plus: headerPlusSection,
    footer_plus: footerPlusSection
  };
  currentSettings.seo = clone(next.seo);
  next.settings_data = {
    ...(next.settings_data ?? {}),
    current: currentSettings
  };
  const saasSettingsCurrent = sanitizeJson(next.saasSettingsCurrent ?? {});
  saasSettingsCurrent.sections = {
    ...(saasSettingsCurrent.sections ?? {}),
    header_plus: headerPlusSection,
    footer_plus: footerPlusSection
  };
  saasSettingsCurrent.seo = clone(next.seo);
  for (const settingsBucket of [currentSettings, saasSettingsCurrent]) {
    if (settingsBucket?.skin_btn_font_family && typeof settingsBucket.skin_btn_font_family === "object") {
      settingsBucket.skin_btn_font_family.varin = "Standard Italic";
    }
    if (settingsBucket?.skin_product_header_font_family && typeof settingsBucket.skin_product_header_font_family === "object") {
      settingsBucket.skin_product_header_font_family.varin = "Standard Italic";
    }
  }
  next.saasSettingsCurrent = saasSettingsCurrent;
  return next;
}

function replaceSiteRows(state, key, siteId, nextRows) {
  state[key] = [
    ...(state[key] ?? []).filter((row) => row.siteId !== siteId),
    ...nextRows
  ];
}

function applyAidreamcapesProductCopy(state) {
  const products = (state.products ?? []).filter((product) => product.siteId === aidreamcapesSiteId);
  let prices = 0;
  for (const product of products) {
    const copy = aidreamcapesProductCopy[product.id];
    if (!copy) continue;
    product.name = copy.name;
    for (const price of product.prices ?? []) {
      const yearly = price.interval === "year";
      price.label = yearly ? `${copy.name} yearly` : copy.name;
      const metadata = sanitizeJson(price.metadata ?? {});
      delete metadata.destinationCount;
      metadata.occasionCount = copy.occasionCount;
      metadata.planSubtitle = copy.planSubtitle;
      metadata.editingLabel = copy.editingLabel;
      metadata.planFamily = copy.planFamily;
      metadata.publicReference = `Aidreamcapes ${copy.name} ${yearly ? "yearly" : price.interval === "one_time" ? "one-time" : "monthly"} fan and holiday album credit plan`;
      if (!yearly && price.interval !== "one_time") metadata.discountLabel = "Album launch price";
      if (price.interval === "one_time") metadata.discountLabel = "Occasion credit top-up";
      price.metadata = metadata;
      prices += 1;
    }
  }
  return { products: products.filter((product) => aidreamcapesProductCopy[product.id]).length, prices };
}

function applyAidreamcapesSiteAiAppCopy(state) {
  let count = 0;
  for (const siteApp of state.siteAiApps ?? []) {
    if (siteApp.siteId !== aidreamcapesSiteId || siteApp.aiApp?.slug !== "image_generator") continue;
    siteApp.aiApp = {
      ...siteApp.aiApp,
      ...aidreamcapesAiAppCopy
    };
    count += 1;
  }
  return count;
}

function rewriteFanHolidayAssetVersions(value) {
  let count = 0;
  const pattern = /(\/assets\/sites\/site_aidreamcapes\/fan-holiday-theme\/[^?#|\s"']+\.(?:webp|png|jpe?g|mp4))(?:\?v=[A-Za-z0-9._:-]+)?/g;

  function visit(entry, parent, key) {
    if (typeof entry === "string") {
      const next = entry.replace(pattern, `$1?v=${assetVersion}`);
      if (next !== entry && parent && key !== undefined) {
        parent[key] = next;
        count += 1;
      }
      return;
    }
    if (!entry || typeof entry !== "object") return;
    if (Array.isArray(entry)) {
      entry.forEach((item, index) => visit(item, entry, index));
      return;
    }
    for (const [childKey, childValue] of Object.entries(entry)) {
      visit(childValue, entry, childKey);
    }
  }

  visit(value);
  return count;
}

function applyFanHolidayThemeToState(state) {
  const now = new Date().toISOString();
  const site = (state.sites ?? []).find((item) => item.id === aidreamcapesSiteId);
  if (!site) throw new Error("missing_site_aidreamcapes");
  site.branding = {
    ...(site.branding ?? {}),
    ...aidreamcapesBranding
  };

  const categories = parentRows(now);
  const packs = creativePackRows(categories, now);
  const toolCategories = toolCategoryRows(now);
  const tools = toolMenuRows(toolCategories, now);
  const videoCategories = videoCategoryRows(now);
  const videos = videoThemeRows(videoCategories, now);
  const mediaAssets = mediaAssetRows(now);
  const corePages = currentCorePages(site);
  const toolPages = tools.map(buildToolPage);
  const blogPages = blogDefs.map(buildBlogPage);
  const productReport = applyAidreamcapesProductCopy(state);
  const siteAiAppCount = applyAidreamcapesSiteAiAppCopy(state);
  site.pages = [...corePages, ...toolPages, ...blogPages];
  site.themeSettings = {
    draftJson: applyThemeSettings(site.themeSettings?.draftJson ?? {}),
    publishedJson: applyThemeSettings(site.themeSettings?.publishedJson ?? {})
  };

  replaceSiteRows(state, "creativePackCategories", aidreamcapesSiteId, categories);
  replaceSiteRows(state, "creativePacks", aidreamcapesSiteId, packs);
  replaceSiteRows(state, "toolCategories", aidreamcapesSiteId, toolCategories);
  replaceSiteRows(state, "toolMenuItems", aidreamcapesSiteId, tools);
  replaceSiteRows(state, "videoThemeCategories", aidreamcapesSiteId, videoCategories);
  replaceSiteRows(state, "videoThemes", aidreamcapesSiteId, videos);
  replaceSiteRows(state, "mediaAssets", aidreamcapesSiteId, mediaAssets);

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== aidreamcapesSiteId) continue;
    applyTemplateUpdates(theme);
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== aidreamcapesSiteId) continue;
    publication.snapshot = {
      pages: site.pages.map((page) => ({
        id: page.id,
        slug: page.slug,
        title: page.title,
        pageType: page.pageType,
        publishedJson: clone(page.publishedJson)
      })),
      themeSettings: clone(site.themeSettings.publishedJson)
    };
    publication.pageCount = site.pages.length;
    publication.sectionCount = sectionCountFromPages(site.pages);
    publication.snapshotBytes = Buffer.byteLength(JSON.stringify(publication.snapshot));
  }

  const assetVersionRewrites = rewriteFanHolidayAssetVersions(state);

  return {
    categories: categories.length,
    packs: packs.length,
    toolCategories: toolCategories.length,
    tools: tools.length,
    videoCategories: videoCategories.length,
    videos: videos.length,
    mediaAssets: mediaAssets.length,
    pages: site.pages.length,
    products: productReport.products,
    prices: productReport.prices,
    siteAiApps: siteAiAppCount,
    assetVersionRewrites
  };
}

async function readState() {
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

async function writeState(state) {
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

async function updateDatabase(state) {
  const prisma = new PrismaClient();
  const site = state.sites.find((item) => item.id === aidreamcapesSiteId);
  const report = { site: 0, products: 0, prices: 0, categories: 0, packs: 0, toolCategories: 0, tools: 0, videoCategories: 0, videos: 0, mediaAssets: 0, themePages: 0, settings: 0, siteThemes: 0, publications: 0 };
  try {
    if (site?.branding) {
      const result = await prisma.site.updateMany({ where: { id: aidreamcapesSiteId }, data: { branding: site.branding } });
      report.site += result.count;
    }
    for (const product of (state.products ?? []).filter((row) => row.siteId === aidreamcapesSiteId && aidreamcapesProductCopy[row.id])) {
      const productResult = await prisma.product.updateMany({ where: { id: product.id, siteId: aidreamcapesSiteId }, data: { name: product.name } });
      report.products += productResult.count;
      for (const price of product.prices ?? []) {
        const priceResult = await prisma.price.updateMany({ where: { id: price.id, siteId: aidreamcapesSiteId }, data: { label: price.label, metadata: price.metadata ?? undefined } });
        report.prices += priceResult.count;
      }
    }
    const categories = (state.creativePackCategories ?? []).filter((row) => row.siteId === aidreamcapesSiteId);
    await prisma.creativePack.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    await prisma.creativePackCategory.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    for (const category of categories) {
      await prisma.creativePackCategory.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: category.slug } },
        create: { id: category.id, siteId: aidreamcapesSiteId, parentId: category.parentId ?? null, slug: category.slug, label: category.label, description: category.description, heroTitle: category.heroTitle, heroSubtitle: category.heroSubtitle, icon: category.icon, imageUrl: category.imageUrl, sortOrder: category.sortOrder, status: category.status },
        update: { parentId: category.parentId ?? null, label: category.label, description: category.description, heroTitle: category.heroTitle, heroSubtitle: category.heroSubtitle, icon: category.icon, imageUrl: category.imageUrl, sortOrder: category.sortOrder, status: category.status }
      });
      report.categories += 1;
    }
    for (const pack of (state.creativePacks ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.creativePack.upsert({
        where: { id: pack.id },
        create: { id: pack.id, siteId: aidreamcapesSiteId, categoryId: pack.categoryId, name: pack.name, headline: pack.headline, description: pack.description, prompt: pack.prompt, category: pack.category, aiAppSlug: pack.aiAppSlug, status: pack.status, creditCost: pack.creditCost, outputCount: pack.outputCount, trainingRequired: pack.trainingRequired, generationCount: pack.generationCount, conversionRate: pack.conversionRate, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages },
        update: { categoryId: pack.categoryId, name: pack.name, headline: pack.headline, description: pack.description, prompt: pack.prompt, category: pack.category, aiAppSlug: pack.aiAppSlug, status: pack.status, creditCost: pack.creditCost, outputCount: pack.outputCount, trainingRequired: pack.trainingRequired, imageUrl: pack.imageUrl, galleryImages: pack.galleryImages }
      });
      report.packs += 1;
    }
    await prisma.toolMenuItem.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    await prisma.toolCategory.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    for (const category of (state.toolCategories ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.toolCategory.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: category.slug } },
        create: { id: category.id, siteId: aidreamcapesSiteId, slug: category.slug, label: category.label, description: category.description, icon: category.icon, sortOrder: category.sortOrder, status: category.status },
        update: { label: category.label, description: category.description, icon: category.icon, sortOrder: category.sortOrder, status: category.status }
      });
      report.toolCategories += 1;
    }
    for (const tool of (state.toolMenuItems ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.toolMenuItem.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: tool.slug } },
        create: { id: tool.id, siteId: aidreamcapesSiteId, categoryId: tool.categoryId, slug: tool.slug, title: tool.title, description: tool.description, badge: tool.badge, icon: tool.icon, imageUrl: tool.imageUrl, href: tool.href, detailJson: tool.detailJson, sortOrder: tool.sortOrder, status: tool.status },
        update: { categoryId: tool.categoryId, title: tool.title, description: tool.description, badge: tool.badge, icon: tool.icon, imageUrl: tool.imageUrl, href: tool.href, detailJson: tool.detailJson, sortOrder: tool.sortOrder, status: tool.status }
      });
      report.tools += 1;
    }
    await prisma.videoTheme.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    await prisma.videoThemeCategory.updateMany({ where: { siteId: aidreamcapesSiteId }, data: { status: "inactive" } });
    for (const category of (state.videoThemeCategories ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: category.slug } },
        create: { id: category.id, siteId: aidreamcapesSiteId, slug: category.slug, label: category.label, description: category.description, imageUrl: category.imageUrl, sortOrder: category.sortOrder, status: category.status },
        update: { label: category.label, description: category.description, imageUrl: category.imageUrl, sortOrder: category.sortOrder, status: category.status }
      });
      report.videoCategories += 1;
    }
    for (const theme of (state.videoThemes ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.videoTheme.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: theme.slug } },
        create: { id: theme.id, siteId: aidreamcapesSiteId, categoryId: theme.categoryId, slug: theme.slug, name: theme.name, headline: theme.headline, description: theme.description, prompt: theme.prompt, status: theme.status, creditCost: theme.creditCost, durationSeconds: theme.durationSeconds, maxFrames: theme.maxFrames, generationCount: theme.generationCount, imageUrl: theme.imageUrl, galleryImages: theme.galleryImages },
        update: { categoryId: theme.categoryId, name: theme.name, headline: theme.headline, description: theme.description, prompt: theme.prompt, status: theme.status, creditCost: theme.creditCost, durationSeconds: theme.durationSeconds, maxFrames: theme.maxFrames, imageUrl: theme.imageUrl, galleryImages: theme.galleryImages }
      });
      report.videos += 1;
    }
    for (const assetRow of (state.mediaAssets ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId: aidreamcapesSiteId, storageKey: assetRow.storageKey } },
        create: { id: assetRow.id, siteId: aidreamcapesSiteId, label: assetRow.label, storageKey: assetRow.storageKey, mimeType: assetRow.mimeType, usageType: assetRow.usageType ?? assetRow.usage, sourceType: assetRow.sourceType, previewUrl: assetRow.previewUrl, originUrl: assetRow.originUrl, altText: assetRow.altText, notes: assetRow.notes },
        update: { label: assetRow.label, mimeType: assetRow.mimeType, usageType: assetRow.usageType ?? assetRow.usage, sourceType: assetRow.sourceType, previewUrl: assetRow.previewUrl, originUrl: assetRow.originUrl, altText: assetRow.altText, notes: assetRow.notes }
      });
      report.mediaAssets += 1;
    }
    if (site?.themeSettings) {
      await prisma.themeSettings.upsert({
        where: { siteId: aidreamcapesSiteId },
        create: { id: `theme_settings_${aidreamcapesSiteId}`, siteId: aidreamcapesSiteId, draftJson: site.themeSettings.draftJson, publishedJson: site.themeSettings.publishedJson },
        update: { draftJson: site.themeSettings.draftJson, publishedJson: site.themeSettings.publishedJson }
      });
      report.settings += 1;
    }
    for (const page of site?.pages ?? []) {
      await prisma.themePage.upsert({
        where: { siteId_slug: { siteId: aidreamcapesSiteId, slug: page.slug } },
        create: { id: page.id, siteId: aidreamcapesSiteId, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson },
        update: { pageType: page.pageType, templateKey: page.templateKey, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson }
      });
      report.themePages += 1;
    }
    for (const theme of (state.siteThemes ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.siteTheme.updateMany({ where: { siteId: aidreamcapesSiteId, themeId: theme.themeId }, data: { templates: theme.templates, settings: theme.settings } });
      report.siteThemes += 1;
    }
    for (const publication of (state.themePublications ?? []).filter((row) => row.siteId === aidreamcapesSiteId)) {
      await prisma.themePublication.updateMany({ where: { siteId: aidreamcapesSiteId, version: publication.version }, data: { snapshot: publication.snapshot, pageCount: publication.pageCount, sectionCount: publication.sectionCount, snapshotBytes: publication.snapshotBytes } });
      report.publications += 1;
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyLocalAssets(state) {
  const imageUrls = new Set();
  const add = (value) => {
    if (typeof value === "string" && value.startsWith(publicAssetBase)) imageUrls.add(value);
  };
  for (const row of [
    ...(state.creativePackCategories ?? []),
    ...(state.creativePacks ?? []),
    ...(state.toolMenuItems ?? []),
    ...(state.videoThemeCategories ?? []),
    ...(state.videoThemes ?? []),
    ...(state.mediaAssets ?? [])
  ]) {
    if (row.siteId !== aidreamcapesSiteId) continue;
    add(row.imageUrl);
    add(row.previewUrl);
    add(row.originUrl);
    for (const item of row.galleryImages ?? []) add(item);
  }
  for (const url of imageUrls) {
    const localFile = localFileForPublicPath(url);
    if (!await fileExists(localFile)) throw new Error(`missing_generated_asset:${url}`);
  }
  for (const category of parentCategories) {
    const showcaseImage = asset("images", category.slug);
    const localFile = localFileForPublicPath(showcaseImage);
    if (!await fileExists(localFile)) throw new Error(`missing_generated_showcase_image:${showcaseImage}`);
  }
  return imageUrls.size;
}

async function main() {
  const assetReport = await prepareAssets();
  const state = await readState();
  const dataReport = applyFanHolidayThemeToState(state);
  const assetReferenceCount = await verifyLocalAssets(state);
  if (!dryRun) await writeState(state);
  const dbReport = updateDb && !dryRun ? await updateDatabase(state) : "skipped";
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    assets: assetReport,
    assetReferenceCount,
    data: dataReport,
    db: dbReport,
    legacyCollectionAliases,
    legacyToolAliases
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
