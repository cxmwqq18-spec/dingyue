import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const workspaceRoot = process.cwd();
const dataPath = path.join(workspaceRoot, "data", "platform-state.json");
const siteId = "site_aidreamcapes";
const siteSlug = "aidreamcapes";
const now = "2026-06-27T00:00:00.000Z";
const siteName = "Aidreamcapes";
const themeKey = "dreamshoot-ai-studio";
const primaryDomain = "www.aidreamcapes.com";
const apexDomain = "aidreamcapes.com";
const localDomain = "aidreamcapes.localhost";
const supportEmail = "support@aidreamcapes.com";
const salesEmail = "sales@aidreamcapes.com";
const companyAddress = "8 THE GREEN STE B, DOVER, DE 19901";
const logoImageUrl = "/assets/sites/site_aidreamcapes/brand/aidreamcapes-wordmark.svg?v=20260628b";
const visualSiteTitle = "Aidreamcapes";
const aidreamcapesImageBase = "/assets/sites/site_aidreamcapes/creative-packs";
const aidreamcapesPackImages = {
  dreamscape: `${aidreamcapesImageBase}/dreamscape-portraits.png`,
  coastal: `${aidreamcapesImageBase}/coastal-escapes.png`,
  destination: `${aidreamcapesImageBase}/destination-story.png`,
  mountain: `${aidreamcapesImageBase}/mountain-trails.png`,
  postcard: `${aidreamcapesImageBase}/postcard-journey.png`,
  avatar: `${aidreamcapesImageBase}/fantasy-avatars.png`,
  couple: `${aidreamcapesImageBase}/golden-hour-couples.png`,
  profileStory: `${aidreamcapesImageBase}/travel-profile-stories.png`,
  editorial: `${aidreamcapesImageBase}/editorial-getaways.png`,
  glam: `${aidreamcapesImageBase}/soft-glam-studio.png`,
  travel: `${aidreamcapesImageBase}/cinematic-travel.png`,
  product: `${aidreamcapesImageBase}/product-reverie.png`,
  social: `${aidreamcapesImageBase}/social-keepsakes.png`
};
const displayFontStack = "var(--font-display-ui), var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif";
const bodyFontStack = "var(--font-sans-ui), Helvetica Neue, ui-sans-serif, system-ui, sans-serif";
const stripeAccountId = process.env.AIDREAMCAPES_STRIPE_ACCOUNT_ID?.trim() || "acct_pending_aidreamcapes";
const stripeChargesEnabled = process.env.AIDREAMCAPES_STRIPE_CHARGES_ENABLED === "1";
const stripePayoutsEnabled = process.env.AIDREAMCAPES_STRIPE_PAYOUTS_ENABLED === "1";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashPassword(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function toDate(value) {
  return value ? new Date(value) : undefined;
}

function envOrManualPrice(envName, fallback) {
  return process.env[envName]?.trim() || fallback;
}

function replaceWhere(items, predicate, nextItems) {
  return [...items.filter((item) => !predicate(item)), ...nextItems];
}

function applyTextReplacements(value, replacements) {
  return replacements.reduce((current, replacement) => {
    if (!replacement.from || replacement.from === replacement.to) return current;
    return current.split(replacement.from).join(replacement.to);
  }, value);
}

function deepReplaceText(value, replacements) {
  if (typeof value === "string") return applyTextReplacements(value, replacements);
  if (Array.isArray(value)) return value.map((item) => deepReplaceText(item, replacements));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entryValue]) => [key, deepReplaceText(entryValue, replacements)]));
  }
  return value;
}

function repairSharedAssetPaths(value) {
  return deepReplaceText(value, [
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", to: aidreamcapesPackImages.mountain },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png", to: aidreamcapesPackImages.social },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", to: aidreamcapesPackImages.couple },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", to: aidreamcapesPackImages.destination },
    { from: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", to: aidreamcapesPackImages.editorial },
    { from: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png", to: aidreamcapesPackImages.avatar },
    { from: "/assets/dreamshoot/generated/20260619/storybook-storybook shadow-single-v1.png", to: aidreamcapesPackImages.profileStory },
    { from: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-storybook shadow.png", to: aidreamcapesPackImages.profileStory },
    { from: "/assets/dreamshoot/generated/20260619/editorial getaway-solo-city-v1.png", to: aidreamcapesPackImages.editorial },
    { from: "/assets/dreamshoot/frames/sample-cyberpunk.png", to: aidreamcapesPackImages.glam },
    { from: "/assets/dreamshoot/frames/story-beauty-portrait.png", to: aidreamcapesPackImages.glam },
    { from: "/assets/dreamshoot/frames/faq-intro-portrait.png", to: aidreamcapesPackImages.destination },
    { from: "/assets/dreamshoot/editorial-headshot-gpt2.png", to: aidreamcapesPackImages.editorial },
    { from: "/assets/aidreamcapes/generated/20260618/headshot-lifestyle-v1.png", to: aidreamcapesPackImages.profileStory },
    { from: "/assets/aidreamcapes/editorial-headshot-gpt2.png", to: aidreamcapesPackImages.editorial },
    { from: "/assets/sites/site_aidreamcapes/creative-packs/storybook-headshots.png", to: aidreamcapesPackImages.profileStory },
    { from: "/assets/sites/site_aidreamcapes/creative-packs/storybook-headshots.svg", to: `${aidreamcapesImageBase}/travel-profile-stories.svg` },
    { from: "标准斜体", to: "standard italic" }
  ]);
}

function scrubAidreamcapesText(value) {
  return repairSharedAssetPaths(deepReplaceText(value, [...aidreamcapesLegacyReplacements, ...brandReplacements, ...aidreamcapesFinalPolishReplacements]));
}

function sourceDreamshootSite(state) {
  return (state.sites ?? []).find((site) => site.id === "site_dreamshoot" || site.slug === "dreamshoot" || site.slug === "mydreamshoots");
}

function fallbackSourcePageJson(templateKey) {
  if (["privacy", "refunds", "shipping", "terms", "content", "cookies"].includes(templateKey)) {
    return {
      version: 1,
      pageType: "policy",
      sectionsOrder: ["policy_1", "conversion_1"],
      sections: {
        policy_1: { id: "policy_1", type: "policy_content", settings: {}, blocks: [] },
        conversion_1: { id: "conversion_1", type: "conversion_panel", settings: {}, blocks: [] }
      }
    };
  }
  if (templateKey === "about-us") {
    return {
      version: 1,
      pageType: "content",
      sectionsOrder: ["about_intro_1", "about_values_1", "trust_1", "conversion_1"],
      sections: {
        about_intro_1: { id: "about_intro_1", type: "rich_text", settings: {}, blocks: [] },
        about_values_1: { id: "about_values_1", type: "feature_grid", settings: {}, blocks: [] },
        trust_1: { id: "trust_1", type: "policy_content", settings: {}, blocks: [] },
        conversion_1: { id: "conversion_1", type: "conversion_panel", settings: {}, blocks: [] }
      }
    };
  }
  if (templateKey === "contact-us") {
    return {
      version: 1,
      pageType: "content",
      sectionsOrder: ["contact_intro_1", "contact_details_1", "faq_1", "conversion_1"],
      sections: {
        contact_intro_1: { id: "contact_intro_1", type: "rich_text", settings: {}, blocks: [] },
        contact_details_1: { id: "contact_details_1", type: "policy_content", settings: {}, blocks: [] },
        faq_1: { id: "faq_1", type: "faq", settings: {}, blocks: [] },
        conversion_1: { id: "conversion_1", type: "conversion_panel", settings: {}, blocks: [] }
      }
    };
  }
  return undefined;
}

function sourcePageByTemplate(sourceSite, templateKey, fallbackSlug) {
  const page = sourceSite?.pages?.find((item) => item.templateKey === templateKey) ?? sourceSite?.pages?.find((item) => item.slug === fallbackSlug);
  const fallbackPage = fallbackSourcePageJson(templateKey);
  if (!page?.publishedJson && fallbackPage) return fallbackPage;
  if (!page?.publishedJson) {
    throw new Error(`missing_source_page:${templateKey}:${fallbackSlug}`);
  }
  return page.publishedJson;
}

const brandReplacements = [
  ["MydreamShoots", siteName],
  ["mydreamshoots", siteSlug],
  ["MyDreamShoots", siteName],
  ["DreamShoot", "Aidreamcapes"],
  ["dreamshoot", siteSlug],
  ["support@mydreamshoots.com", supportEmail],
  ["owner@mydreamshoots.localhost", `owner@${localDomain}`],
  ["nora@mydreamshoots.localhost", `aria@${localDomain}`],
  ["Nora Whitman", "Aria Vale"],
  ["Popov", "Mira"],
  ["Ava", "Lena"],
  ["Lucas", "Rowan"],
  ["Mia", "Elise"],
  ["Noah", "Julian"],
  ["AI photo packages", "AI travel escape portraits"],
  ["photo packages", "travel packages"],
  ["Photo packages", "Travel packages"],
  ["private AI photo workspace", "private cinematic escape workspace"],
  ["private photo workspace", "private escape portrait workspace"],
  ["AI photo workspace", "AI travel portrait workspace"]
].map(([from, to]) => ({ from, to })).sort((left, right) => right.from.length - left.from.length);

brandReplacements.push(
  { from: "MydreamShoots header", to: "Aidreamcapes header" },
  { from: "MydreamShoots footer", to: "Aidreamcapes footer" }
);
brandReplacements.sort((left, right) => right.from.length - left.from.length);

const aidreamcapesLegacyReplacements = [
  ["/tools/world-cup-fan-photos", "/tools/coastal-portrait"],
  ["/tools/cyberpunk-portrait", "/tools/editorial-getaway"],
  ["/tools/background-changer", "/tools/destination-portrait-engine"],
  ["/tools/background-remover", "/tools/destination-portrait-engine"],
  ["/tools/gala-photo", "/tools/soft-glam"],
  ["/tools/noir-portrait", "/tools/travel-profile-story"],
  ["/tools/headshot", "/tools/travel-profile-story"],
  ["/tools/nature-adventure", "/tools/cinematic-travel"],
  ["/tools/virtual-try-on", "/tools/soft-glam"],
  ["/tools/image-to-video", "/tools/destination-portrait-engine"],
  ["/collections/sports", "/collections/coastal-escapes"],
  ["/collections/headshots", "/collections/travel-profile-stories"],
  ["/collections/beauty", "/collections/soft-glam-studio"],
  ["/collections/creative", "/collections/destination-portrait-albums"],
  ["/collections/travel", "/collections/cinematic-travel"],
  ["World Cup fan photos", "Coastal escape portraits"],
  ["World Cup Fan Photos", "Coastal Escape Portraits"],
  ["World Cup Pack", "Coastal Escape Pack"],
  ["World Cup", "Coastal Escape"],
  ["football fan photos", "coastal escape portraits"],
  ["fan photos", "coastal portraits"],
  ["fan set", "coastal set"],
  ["Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing", "Destination portraits|Cinematic travel scenes|Coastal profile crops|Old city walk frames|Sunset travel images|Editorial getaway crops|Itinerary moodboard frames|Postcard social cards"],
  ["Safe styling: no real player likenesses, official team logos, or protected marks required.", "Private styling: no public gallery is created unless the customer chooses to share finished images."],
  ["Match-day looks without a studio.", "Dreamlike escape portraits without a destination shoot."],
  ["Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.", "Travel packages rotate around coasts, cities, resorts, trails, cafe moments, and postcard-ready memories."],
  ["Match-day Lenatar", "Travel Portrait"],
  ["fan poster|avatar|stadium|social-ready", "destination|coastal|city|gallery-ready"],
  ["Next: Valentine / Graduation Season", "Next: Coastal Routes / Old City Walks"],
  ["How it works + proof bridge", "Travel workflow bridge"],
  ["Choose a plan for your photo set", "Choose credits for your travel portrait set"],
  ["Realistic customer stories for AI photo package buyers", "Private gallery stories from travel customers"],
  ["A visual catalogue with clear package intent.", "A visual catalog for escape moods and private gallery outcomes."],
  ["Recent generation status", "Recent travel portrait status"],
  ["Track every generation request from queue to delivery.", "Track every Aidreamcapes request from mood selection to private gallery delivery."],
  ["Current generation status", "Current travel portrait status"],
  ["Delivered images stay inside a customer-only album.", "Delivered travel escape portraits stay inside a customer-only album."],
  ["This page is not available.", "This Aidreamcapes page is not available."],
  ["AI Image Studio - Generate Profile Stories and Portrait Scene Packs", "Aidreamcapes Destination Portrait Engine - cinematic escape portraits"],
  ["AI Image Studio", "Travel Portrait Studio"],
  ["AI Photo Job Progress - Track Generation and Delivery", "Aidreamcapes Job Progress - track travel gallery delivery"],
  ["AI Photo Job Detail - Review Outputs and Credit Activity", "Aidreamcapes Job Detail - review private gallery outputs"],
  ["Page Not Found - Return to Aidreamcapes AI Photo Packages", "Page Not Found - return to Aidreamcapes travel packages"],
  ["Cyberpunk portrait maker", "Editorial getaway builder"],
  ["Cyberpunk", "Editorial Getaway"],
  ["cyberpunk", "editorial getaway"],
  ["Background changer", "Travel Portrait mood planner"],
  ["background changer", "travel portrait mood planner"],
  ["background edits", "mood references"],
  ["Mafia", "Storybook"],
  ["mafia", "storybook"],
  ["Noir", "Storybook Shadow"],
  ["noir", "storybook shadow"],
  ["Gala photo maker", "Soft glam portrait tool"],
  ["gala scenes", "cafe street scenes"],
  ["gala looks", "cafe street looks"],
  ["gala", "cafe street"],
  ["Free AI tools", "Aidreamcapes planning tools"],
  ["free tools", "planning tools"],
  ["free enhancer", "source-photo planner"],
  ["AI headshots", "travel profile stories"],
  ["headshots, sports, beauty, creator, travel, or cinematic portrait pack", "destination portrait, coastal getaway, old city walk, mountain trail, itinerary moodboard, postcard social, or cinematic travel pack"],
  ["headshots, Coastal escape portraits, creator portraits, travel portrait mood planner tools", "travel escape portraits, coastal escapes, travel portraits, travel profile stories, and itinerary moodboard tools"],
  ["headshots to football fan photos", "travel escape portraits to coastal escapes"],
  ["headshots to AI photos", "travel escape portraits to travel portraits"],
  ["headshots, creator portraits", "travel profile stories, travel portraits"],
  ["creator portraits", "cinematic keepsakes"],
  ["AI motion ideas", "travel portrait planning ideas"],
  ["virtual try-on previews", "cafe street previews"],
  ["Headshot pack", "Profile story set"],
  ["headshot pack", "profile story set"],
  ["headshot", "profile story"],
  ["Headshot", "Profile story"]
].map(([from, to]) => ({ from, to })).sort((left, right) => right.from.length - left.from.length);

const aidreamcapesFinalPolishReplacements = [
  ["Lenatars", "Avatars"],
  ["Lenatar", "Avatar"],
  ["Storybook Headshots", "Travel Profile Stories"],
  ["Gala result", "Soft glam result"],
  ["AI headshot and portrait packages", "travel portrait and escape packages"],
  ["Advanced packages need a customer model so results can stay consistent across headshots, cafe street, travel, and style sets.", "Advanced packages need a customer model so results stay consistent across profile stories, cafe street albums, travel scenes, and travel style sets."],
  ["Create realistic AI photo packages from everyday uploads.", "Create travel portrait albums from everyday uploads."],
  ["Gala, editorial getaway, travel, beauty, and profile packs.", "Destination portraits, coastal getaways, old city walks, mountain trails, and postcard social sets."],
  ["Magic upscaler, AI video concepts, and style preview flows.", "Travel mood planning, private galleries, credit tracking, and downloadable portraits."]
].map(([from, to]) => ({ from, to })).sort((left, right) => right.from.length - left.from.length);

function sectionForSaas(section) {
  return {
    type: section.type,
    version: "1",
    card_name: section.type,
    settings: clone(section.settings ?? {}),
    blocks: clone(section.blocks ?? [])
  };
}

function templateForSaas(pageJson) {
  const sections = Object.fromEntries(
    Object.entries(pageJson.sections)
      .filter(([, section]) => Boolean(section?.type))
      .map(([id, section]) => [id, sectionForSaas(section)])
  );
  return {
    content_for_page: pageJson.sectionsOrder.filter((id) => Boolean(sections[id])),
    sections
  };
}

function normalizeGlobalSection(type, section) {
  return {
    type,
    settings: clone(section?.settings ?? {}),
    blocks: clone(section?.blocks ?? [])
  };
}

const aidreamcapesSeoPages = {
  home: {
    title: "Aidreamcapes - AI travel portraits and destination-style albums",
    description: "Create AI travel portraits, destination scenes, itinerary-ready albums, and private escape galleries from everyday source photos with Aidreamcapes.",
    keywords: "Aidreamcapes, AI travel portraits, destination portrait generator, cinematic travel photos, private travel album",
    canonicalPath: "/",
    index: true,
    follow: true
  },
  pricing: {
    title: "Aidreamcapes Pricing - credits for AI travel portrait albums",
    description: "Compare Aidreamcapes plans, monthly credits, one-time top-ups, private uploads, and destination gallery delivery before creating a travel portrait request.",
    keywords: "Aidreamcapes pricing, AI travel portrait credits, destination photo subscription, private travel photo plans",
    canonicalPath: "/pricing",
    index: true,
    follow: true
  },
  collections: {
    title: "Aidreamcapes Travel Packages - AI destination portrait themes",
    description: "Browse Aidreamcapes travel packages for coastal getaways, old city walks, mountain trails, island stays, cafe stories, and postcard-ready private galleries.",
    keywords: "Aidreamcapes travel packages, AI destination portraits, coastal getaway photos, mountain trail portraits, private travel gallery",
    canonicalPath: "/collections",
    index: true,
    follow: true
  },
  tools: {
    title: "Aidreamcapes AI Tools - travel portraits and destination scene builders",
    description: "Explore Aidreamcapes tools for destination portraits, coastal scenes, mountain trail albums, old city walks, itinerary moodboards, and private travel gallery delivery.",
    keywords: "Aidreamcapes tools, AI travel portrait tool, destination scene builder, coastal portrait generator, itinerary moodboard AI",
    canonicalPath: "/tools",
    index: true,
    follow: true
  },
  help: {
    title: "Aidreamcapes Help - uploads, credits, travel gallery delivery",
    description: "Get Aidreamcapes help for source photo prep, destination package selection, travel mood references, credit use, private gallery delivery, refunds, and account privacy.",
    keywords: "Aidreamcapes help, AI travel photo upload guide, destination package help, private travel gallery support",
    canonicalPath: "/help",
    index: true,
    follow: true
  },
  blog: {
    title: "Aidreamcapes Field Notes - AI travel portrait planning",
    description: "Read Aidreamcapes guides for source-photo planning, destination mood references, coastal portraits, travel album credits, and private gallery delivery.",
    keywords: "Aidreamcapes guides, AI travel portrait tips, destination photo planning, private travel gallery workflow",
    canonicalPath: "/blog",
    index: true,
    follow: true
  },
  blogDreamscape: {
    title: "How to plan source photos for AI travel portraits",
    description: "Learn how to choose source photos, outfit notes, and destination mood references for Aidreamcapes travel portraits, coastal escapes, mountain scenes, and private galleries.",
    keywords: "AI travel portrait source photos, Aidreamcapes source photo guide, destination portrait tips",
    canonicalPath: "/blog/planning-dreamscape-source-photos",
    index: true,
    follow: true
  },
  search: {
    title: "Search Aidreamcapes - travel tools, packages, guides, and policies",
    description: "Search Aidreamcapes for destination portrait tools, coastal packages, mountain trail sets, pricing, upload help, privacy, refunds, and private gallery guidance.",
    keywords: "Aidreamcapes search, AI travel portrait tools, destination packages, coastal escape photos",
    canonicalPath: "/search",
    index: true,
    follow: true
  },
  about: {
    title: "About Aidreamcapes - private AI travel portraits and galleries",
    description: "Learn about Aidreamcapes, a private AI travel portrait workspace for source photo planning, visible credits, destination scenes, and customer-only gallery delivery.",
    keywords: "About Aidreamcapes, AI travel portraits, private AI travel gallery, destination portrait generator, cinematic travel workspace",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  contact: {
    title: "Contact Aidreamcapes - support, sales, and company address",
    description: "Contact Aidreamcapes for travel portrait support, source photo guidance, sales questions, billing review, privacy requests, or company address information.",
    keywords: "Contact Aidreamcapes, Aidreamcapes support, AI travel portrait support, Aidreamcapes sales, private gallery help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  },
  privacy: {
    title: "Aidreamcapes Privacy Promise - private uploads and gallery data",
    description: "Learn how Aidreamcapes handles customer accounts, source photos, travel portrait requests, credits, payment status, private galleries, and deletion requests.",
    keywords: "Aidreamcapes privacy, AI travel portrait upload privacy, private travel gallery data",
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  refunds: {
    title: "Aidreamcapes Refund Policy - credits, failed jobs, and support review",
    description: "Review Aidreamcapes refund rules for unused credits, failed travel portrait generation jobs, subscriptions, technical failures, and customer support review.",
    keywords: "Aidreamcapes refunds, AI portrait credits refund, failed generation credit return",
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  shipping: {
    title: "Aidreamcapes Shipping and Digital Delivery Policy",
    description: "Review how Aidreamcapes delivers AI travel portrait credits, generated images, downloads, and private galleries digitally without physical shipping.",
    keywords: "Aidreamcapes shipping policy, Aidreamcapes digital delivery, AI portrait delivery, private gallery delivery",
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  terms: {
    title: "Aidreamcapes Studio Terms - accounts, credits, and generated portraits",
    description: "Read Aidreamcapes terms for customer accounts, source photo rights, AI travel portrait credits, private gallery delivery, acceptable use, and support contact.",
    keywords: "Aidreamcapes terms, AI travel portrait terms, source photo rights, generated portrait policy",
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  content: {
    title: "Aidreamcapes Creative Safety - safe source photos and portrait requests",
    description: "Understand Aidreamcapes rules for allowed uploads, disallowed requests, impersonation, moderation, generated image review, and responsible use.",
    keywords: "Aidreamcapes content policy, AI portrait moderation, safe source photo uploads",
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  cookies: {
    title: "Aidreamcapes Cookie Notice - sign-in, checkout, and site preferences",
    description: "Learn how Aidreamcapes uses essential cookies and local storage for sign-in, checkout continuity, cart state, account preferences, and site reliability.",
    keywords: "Aidreamcapes cookie policy, AI portrait site cookies, checkout continuity storage",
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  login: {
    title: "Sign in to Aidreamcapes - private escape portrait workspace",
    description: "Sign in to Aidreamcapes to manage private uploads, credits, travel portrait requests, generated galleries, and downloadable cinematic portraits.",
    keywords: "Aidreamcapes login, private AI travel portrait workspace, private gallery sign in",
    canonicalPath: "/login",
    index: false,
    follow: true
  }
};

const aidreamcapesTools = [
  ["tool_destination", "Destination Portrait Engine", "Turn everyday portraits into cinematic travel scenes with destination mood, natural light, and private album delivery.", "Destination", "Core", aidreamcapesPackImages.destination, "/tools/destination-portrait-engine"],
  ["tool_coastal", "Coastal Getaway Composer", "Create beach, island, resort, cliffside, and sea-view portraits with relaxed travel warmth.", "Coastal", "Getaway", aidreamcapesPackImages.coastal, "/tools/coastal-portrait"],
  ["tool_resort", "Island Resort Scene Studio", "Build vacation-ready portraits for resort decks, white terraces, poolside light, and soft getaway stories.", "Resort", "Island", aidreamcapesPackImages.postcard, "/tools/island-resort-scenes"],
  ["tool_couple", "Sunset Travel Story Maker", "Create warm golden-hour travel scenes for shared trips, engagement escapes, and private destination albums.", "Sunset", "Story", aidreamcapesPackImages.couple, "/tools/golden-hour-couple"],
  ["tool_storybook", "Old City Walk Portrait Tool", "Make cinematic street portraits for plazas, stone lanes, museum days, and boutique hotel mornings.", "City", "Walk", aidreamcapesPackImages.profileStory, "/tools/travel-profile-story"],
  ["tool_editorial", "Editorial Getaway Builder", "Shape magazine-style travel portraits with destination styling, elegant crops, and polished itinerary energy.", "Editorial", "Getaway", aidreamcapesPackImages.editorial, "/tools/editorial-getaway"],
  ["tool_glam", "Cafe & Street Story Tool", "Create relaxed cafe, balcony, city-crossing, and soft daylight portraits for travel journals and profiles.", "Street", "Cafe", aidreamcapesPackImages.glam, "/tools/soft-glam"],
  ["tool_travel", "Mountain Trail Scene Tool", "Explore alpine trails, lakes, cabins, lookout points, and road-trip scenes as private portrait albums.", "Adventure", "Trail", aidreamcapesPackImages.mountain, "/tools/cinematic-travel"],
  ["tool_product", "Itinerary Moodboard Tool", "Turn trip notes, outfits, and reference images into a cohesive visual moodboard before generation.", "Itinerary", "Moodboard", aidreamcapesPackImages.travel, "/tools/product-reverie"],
  ["tool_social", "Postcard Social Set Maker", "Create postcard crops, story covers, memory cards, profile banners, and private travel keepsakes.", "Postcard", "Social", aidreamcapesPackImages.postcard, "/tools/social-keepsake"]
].map(([id, title, description, category, badge, imageUrl, href]) => ({
  id,
  type: "tool_card",
  settings: { title, description, category, badge, imageUrl, href }
}));

const aidreamcapesToolCategoryRows = [
  ["tool_cat_aidreamcapes_destination", "destination-tools", "Destination Tools", "Travel portrait planners for cities, coasts, resorts, and scenic overlooks.", "map"],
  ["tool_cat_aidreamcapes_moments", "travel-moment-tools", "Travel Moment Tools", "Street, cafe, balcony, sunset, and shared-trip portrait tools.", "camera"],
  ["tool_cat_aidreamcapes_adventure", "adventure-tools", "Adventure Tools", "Mountain trail, road trip, cabin, lake, and outdoor escape tools.", "sparkles"],
  ["tool_cat_aidreamcapes_creator", "creator-travel-tools", "Creator Travel Tools", "Postcard sets, itinerary moodboards, and editorial travel story tools.", "wand"]
];

const aidreamcapesToolCategoryForTool = {
  tool_dreamscape: "tool_cat_aidreamcapes_destination",
  tool_coastal: "tool_cat_aidreamcapes_destination",
  tool_avatar: "tool_cat_aidreamcapes_destination",
  tool_storybook: "tool_cat_aidreamcapes_moments",
  tool_couple: "tool_cat_aidreamcapes_moments",
  tool_glam: "tool_cat_aidreamcapes_moments",
  tool_travel: "tool_cat_aidreamcapes_adventure",
  tool_editorial: "tool_cat_aidreamcapes_creator",
  tool_product: "tool_cat_aidreamcapes_creator",
  tool_social: "tool_cat_aidreamcapes_creator"
};

function slugFromHref(href) {
  return String(href).split("?")[0].split("#")[0].replace(/^\/tools\//, "").replace(/^\//, "") || "destination-portrait-engine";
}

const toolCategories = aidreamcapesToolCategoryRows.map(([id, slug, label, description, icon], index) => ({
  id,
  siteId,
  slug,
  label,
  description,
  icon,
  sortOrder: index + 1,
  status: "active",
  createdAt: now
}));

const toolMenuItems = aidreamcapesTools.map((tool, index) => {
  const settings = tool.settings;
  const slug = slugFromHref(settings.href);
  return {
    id: `tool_menu_aidreamcapes_${slug.replace(/[^a-z0-9]+/g, "_")}`,
    siteId,
    categoryId: aidreamcapesToolCategoryForTool[tool.id],
    slug,
    title: settings.title,
    description: settings.description,
    badge: settings.badge,
    icon: toolCategories.find((category) => category.id === aidreamcapesToolCategoryForTool[tool.id])?.icon ?? "sparkles",
    imageUrl: settings.imageUrl,
    href: settings.href,
    detailJson: {
      eyebrow: "Aidreamcapes tool",
      title: settings.title,
      subtitle: settings.description,
      ctaLabel: "Start a private set",
      guideTitle: `${settings.badge} workflow`,
      guideBody: "Choose a mood, upload clear source photos, review visible credit use, then keep finished images inside the signed-in gallery.",
      detailTitle: `${settings.title} details`,
      detailBody: "This Aidreamcapes tool keeps the request focused on one cinematic outcome so customers do not start from a blank prompt.",
      useCases: [
        `${settings.badge} portraits`,
        "Private gallery planning",
        "Source photo guidance"
      ],
      workflow: [
        "Select the destination direction.",
        "Upload source portraits and mood notes.",
        "Confirm credits before generation.",
        "Review finished images in the private gallery."
      ]
    },
    sortOrder: index + 1,
    status: "active",
    createdAt: now
  };
});

const aidreamcapesTaxonomyBlocks = [
  ["taxonomy_destination", "Destination Portrait Albums", "Cohesive travel portraits across coast, city, resort, and scenic settings.", "Destination", "destination|travel|album", aidreamcapesPackImages.destination, "/collections/destination-portrait-albums"],
  ["taxonomy_coastal", "Coastal Getaways", "Beach, island, resort, and cliffside portraits with warm travel light.", "Coastal", "beach|island|resort", aidreamcapesPackImages.coastal, "/collections/coastal-getaways"],
  ["taxonomy_old_city", "Old City Walks", "Cafe streets, stone lanes, plazas, museums, and boutique hotel portraits.", "City", "city|cafe|street", aidreamcapesPackImages.profileStory, "/collections/old-city-walks"],
  ["taxonomy_resort", "Island Resort Scenes", "Terrace, balcony, poolside, and relaxed resort portrait directions.", "Resort", "island|terrace|poolside", aidreamcapesPackImages.postcard, "/collections/island-resort-scenes"],
  ["taxonomy_mountain", "Mountain Trails", "Alpine lakes, trail paths, cabins, and outdoor portrait albums.", "Adventure", "mountain|trail|cabin", aidreamcapesPackImages.mountain, "/collections/mountain-trails"],
  ["taxonomy_moodboard", "Itinerary Moodboards", "Visual planning sets for outfits, destinations, seasons, and album direction.", "Itinerary", "itinerary|planning|moodboard", aidreamcapesPackImages.travel, "/collections/itinerary-moodboards"],
  ["taxonomy_postcard", "Postcard Social Sets", "Postcard crops, story covers, memory cards, and profile banners.", "Postcard", "postcard|social|memory", aidreamcapesPackImages.postcard, "/collections/postcard-social-sets"]
].map(([id, title, description, meta, keywords, imageUrl, href]) => ({
  id,
  type: "taxonomy_card",
  settings: { title, description, meta, keywords, imageUrl, href }
}));

const aidreamcapesFeatureTabs = [
  ["tab_travel", "Travel packages", "Choose a complete destination mood", "Start from Aidreamcapes packages such as coastal getaways, old city walks, island resort scenes, mountain trails, and postcard social sets.", aidreamcapesPackImages.destination, "/collections"],
  ["tab_source", "Source photo planning", "Guide the scene before generation", "Use clear portraits, outfit notes, and atmosphere references so each private gallery feels intentional.", "/assets/dreamshoot/frames/faq-intro-portrait.png", "/blog/planning-dreamscape-source-photos"],
  ["tab_gallery", "Private galleries", "Review finished portraits in one place", "Credits, jobs, albums, and downloads remain connected to the signed-in Aidreamcapes account.", aidreamcapesPackImages.social, "/app"]
].map(([id, label, title, description, imageUrl, href]) => ({
  id,
  type: "feature_tab",
  settings: { label, title, description, imageUrl, href }
}));

const aidreamcapesFlowBlocks = [
  ["pkg_path_upload", "Upload", "Add clear portraits, outfit notes, and atmosphere references to your private Aidreamcapes workspace.", "Step 01", "/assets/dreamshoot/frames/faq-intro-portrait.png"],
  ["pkg_path_mood", "Choose a destination", "Pick a coastal, old city, island resort, mountain trail, road trip, or postcard direction.", "Step 02", aidreamcapesPackImages.destination],
  ["pkg_path_generate", "Generate", "Spend credits only after the request is clear, with the cost shown before the private job starts.", "Step 03", aidreamcapesPackImages.mountain],
  ["pkg_path_deliver", "Download", "Finished travel portraits return to the private album and stay tied to the customer account.", "Step 04", aidreamcapesPackImages.postcard]
].map(([id, title, text, meta, imageUrl]) => ({
  id,
  type: "card",
  settings: { title, text, meta, imageUrl }
}));

const aidreamcapesSampleBlocks = [
  ["sample_destination", "Destination", aidreamcapesPackImages.destination, "Travel album"],
  ["sample_coastal", "Coastal", aidreamcapesPackImages.coastal, "Warm seaside"],
  ["sample_city", "Old city", aidreamcapesPackImages.profileStory, "Cafe streets"],
  ["sample_resort", "Island resort", aidreamcapesPackImages.postcard, "Terrace light"],
  ["sample_mountain", "Mountain trail", aidreamcapesPackImages.mountain, "Outdoor escape"],
  ["sample_postcard", "Postcard", aidreamcapesPackImages.travel, "Social crops"]
].map(([id, label, imageUrl, meta]) => ({
  id,
  type: "sample",
  settings: { label, imageUrl, meta }
}));

const aidreamcapesFeaturedPackBlocks = aidreamcapesSampleBlocks.map((block, index) => ({
  id: block.id.replace("sample_", "featured_"),
  type: "seasonal_image",
  settings: {
    label: block.settings.label,
    imageUrl: block.settings.imageUrl,
    meta: block.settings.meta,
    shape: index % 3 === 0 ? "wide" : "tall"
  }
}));

const aidreamcapesPlanRuleBlocks = [
  ["plan_rule_source", "source prep", "Start with source photos", "Upload clear portraits and references that match the escape mood before spending credits."],
  ["plan_rule_mood", "creative direction", "Choose a travel path", "Use Aidreamcapes categories so the request has a focused destination atmosphere instead of a generic prompt."],
  ["plan_rule_credits", "credit history", "Generate with visible credits", "Credits are reserved, consumed, or released through the customer ledger."],
  ["plan_rule_gallery", "private delivery", "Review the gallery privately", "Finished portraits return to the signed-in account for review and download."]
].map(([id, meta, title, description]) => ({
  id,
  type: "card",
  settings: { meta, title, description }
}));

const aidreamcapesVisualProofBlocks = aidreamcapesTaxonomyBlocks.slice(0, 5).map((block, index) => ({
  id: `proof_${block.id.replace("taxonomy_", "")}`,
  type: "proof_card",
  settings: {
    title: block.settings.title,
    description: block.settings.description,
    category: block.settings.meta,
    badge: ["Destination", "Coastal", "City", "Resort", "Adventure"][index] ?? "Travel",
    imageUrl: block.settings.imageUrl,
    href: block.settings.href
  }
}));

const aidreamcapesCatalogBlocks = aidreamcapesTools.slice(0, 4).map((block, index) => ({
  id: `catalog_${block.id.replace("tool_", "")}`,
  type: "catalog_pack",
  settings: {
    title: block.settings.title,
    description: block.settings.description,
    category: block.settings.category,
    meta: ["24 portraits", "22 portraits", "20 avatars", "24 portraits"][index] ?? "Private gallery",
    credits: ["24 credits", "22 credits", "20 credits", "24 credits"][index] ?? "24 credits",
    imageUrl: block.settings.imageUrl,
    href: block.settings.href
  }
}));

const aidreamcapesFaqBlocks = [
  ["faq_source", "Which source photos work best for Aidreamcapes?", "Use recent, clear portraits with natural expressions, varied angles, and minimal filters. Add outfit or destination references when the package needs a specific travel feeling."],
  ["faq_package", "How should I choose a travel package?", "Start with the final use: Destination Portrait Albums for broad travel atmosphere, Coastal Getaways for sea light, Old City Walks for urban storytelling, Mountain Trails for adventure, and Postcard Social Sets for share-ready crops."],
  ["faq_private", "Are Aidreamcapes uploads and galleries private?", "Yes. Source photos, generation jobs, albums, credit records, and downloads stay connected to the signed-in customer account."],
  ["faq_credits", "When are credits spent?", "Credits are visible before a request starts. A job reserves the needed credits first, successful results consume them, and failed requests can release them."],
  ["faq_delivery", "Where do finished portraits arrive?", "Finished travel portraits return to the private account gallery so customers can compare crops, download favorites, and decide what to share."],
  ["faq_refund", "Can unused credits be reviewed?", "Unused purchased credits can be reviewed under the refund policy. Credits spent on successful generation jobs are generally not refundable."],
  ["faq_cancel", "What remains after a plan is canceled?", "Customers can keep access to existing private albums according to the site's account rules, while new premium requests may require an active plan or available credits."]
].map(([id, question, answer]) => ({
  id,
  type: "faq_item",
  settings: { question, answer }
}));

const aidreamcapesTestimonialBlocks = [
  ["proof_aria", "Aidreamcapes helped me turn ordinary portraits into a soft coastal gallery without planning a trip.", "Aria Vale", "Creator"],
  ["proof_rowan", "The old city package gave my travel journal a warmer story than a standard profile refresh.", "Rowan Ellis", "Author"],
  ["proof_lena", "I used itinerary moodboards to align outfits, locations, and crops before creating the private album.", "Lena Park", "Founder"],
  ["proof_mira", "The source-photo guide made the final mountain trail set feel cohesive instead of random.", "Mira Sol", "Designer"]
].map(([id, quote, name, role]) => ({
  id,
  type: "testimonial",
  settings: { quote, name, role, avatarUrl: aidreamcapesPackImages.coastal, resultImageUrl: aidreamcapesPackImages.destination }
}));

function setSectionBlocks(pageJson, sectionType, blocks) {
  for (const section of Object.values(pageJson.sections ?? {})) {
    if (section?.type === sectionType) section.blocks = clone(blocks);
  }
}

function updateSections(pageJson, predicate, updater) {
  for (const section of Object.values(pageJson.sections ?? {})) {
    if (section?.settings && predicate(section)) updater(section);
  }
}

function buildThemeSettings() {
  const source = clone(sourceSite.themeSettings?.publishedJson ?? sourceSite.themeSettings?.draftJson ?? {});
  const globalSections = clone(source.globalSections ?? {});
  globalSections.header = normalizeGlobalSection("header", globalSections.header);
  globalSections.footer = normalizeGlobalSection("footer", globalSections.footer);
  globalSections.header.settings.logoImageUrl = logoImageUrl;
  globalSections.header.settings.logoAlt = "Aidreamcapes logo for AI travel portraits and private destination albums";
  globalSections.header.settings.style = "dark_pills";
  globalSections.header.settings.title = visualSiteTitle;
  globalSections.header.settings.announcement = "Create AI travel portraits from everyday uploads.";
  globalSections.header.settings.ctaLabel = "Start a package";
  globalSections.header.settings.ctaHref = "/login";
  globalSections.header.blocks = [
    { id: "aidreamcapes_header_collections", type: "menu_link", settings: { label: "Travel Packages", href: "/collections" } },
    { id: "aidreamcapes_header_tools", type: "menu_link", settings: { label: "Tools", href: "/tools" } },
    { id: "aidreamcapes_header_how", type: "menu_link", settings: { label: "How it works", href: "#workflow" } },
    { id: "aidreamcapes_header_examples", type: "menu_link", settings: { label: "Examples", href: "/collections" } },
    { id: "aidreamcapes_header_help", type: "menu_link", settings: { label: "Help", href: "/help" } },
    ...clone(aidreamcapesTools),
    ...clone(aidreamcapesTaxonomyBlocks.slice(0, 6))
  ];
  globalSections.footer.settings.title = visualSiteTitle;
  globalSections.footer.settings.logoImageUrl = logoImageUrl;
  globalSections.footer.settings.logoAlt = "Aidreamcapes logo for AI travel portraits and private destination galleries";
  globalSections.footer.settings.tagline = "AI travel portraits and private destination albums from everyday uploads.";
  globalSections.footer.settings.body = "Aidreamcapes helps customers plan source photos, choose a travel package, generate destination-style portraits, and download private gallery-ready results from one account.";
  globalSections.footer.settings.bottomLine = "Private uploads, visible credits, and customer-only galleries.";
  globalSections.footer.settings.contactAddress = companyAddress;
  globalSections.footer.settings.contactEmail = supportEmail;
  globalSections.footer.settings.salesEmail = salesEmail;
  globalSections.footer.settings.copyright = "© 2026 Aidreamcapes. All rights reserved.";
  globalSections.footer.blocks = [
    { id: "aidreamcapes_footer_collections", type: "menu_link", settings: { label: "Travel Packages", href: "/collections", group: "product" } },
    { id: "aidreamcapes_footer_tools", type: "menu_link", settings: { label: "Destination Portrait Engine", href: "/tools/destination-portrait-engine", group: "product" } },
    { id: "aidreamcapes_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
    { id: "aidreamcapes_footer_guides", type: "menu_link", settings: { label: "Field Notes", href: "/blog", group: "company" } },
    { id: "aidreamcapes_footer_about", type: "menu_link", settings: { label: "About the Studio", href: "/about-us", group: "company" } },
    { id: "aidreamcapes_footer_contact", type: "menu_link", settings: { label: "Contact the Studio", href: "/contact-us", group: "company" } },
    { id: "aidreamcapes_footer_help", type: "menu_link", settings: { label: "Support Atlas", href: "/help", group: "support" } },
    { id: "aidreamcapes_footer_privacy", type: "menu_link", settings: { label: "Privacy Promise", href: "/privacy", group: "support" } },
    { id: "aidreamcapes_footer_terms", type: "menu_link", settings: { label: "Studio Terms", href: "/terms", group: "support" } },
    { id: "aidreamcapes_footer_content", type: "menu_link", settings: { label: "Creative Safety", href: "/content", group: "support" } },
    { id: "aidreamcapes_footer_cookies", type: "menu_link", settings: { label: "Cookie Notice", href: "/cookies", group: "support" } }
  ];
  const seo = source.seo ?? {};
  const saasSettingsCurrent = scrubAidreamcapesText(clone(source.saasSettingsCurrent ?? {}));
  Object.assign(saasSettingsCurrent, {
    skin_bg: "#05070E",
    skin_title_color: "#F8FAFF",
    skin_text_color: "#B7C0D8",
    skin_primary_btn_bg_color: "#F8FAFF",
    skin_primary_btn_text_color: "#0B1020",
    skin_secondary_btn_bg_color: "#0B1020",
    skin_secondary_btn_text_color: "#F8FAFF",
    skin_accent_color: "#8B5CF6",
    skin_price_color: "#FF7A59",
    skin_muted_color: "#0B1020"
  });
  if (saasSettingsCurrent.sections?.header_plus?.settings) {
    saasSettingsCurrent.sections.header_plus.settings.announce_title = "Create AI travel portraits from everyday uploads.";
    saasSettingsCurrent.sections.header_plus.settings.announcement = "Create AI travel portraits from everyday uploads.";
    saasSettingsCurrent.sections.header_plus.settings.announce_bg_color = "#05070E";
    saasSettingsCurrent.sections.header_plus.settings.announce_color = "#F8FAFF";
  }

  const navigation = scrubAidreamcapesText(clone(source.navigation ?? { headerLinks: [], footerLinks: [] }));
  navigation.headerLinks = globalSections.header.blocks
    .filter((block) => block.type === "menu_link" && !block.settings?.category && !block.settings?.badge)
    .slice(0, 5)
    .map((block) => ({
      label: block.settings.label,
      href: block.settings.href
    }));
  navigation.footerLinks = globalSections.footer.blocks.map((block) => ({
    label: block.settings.label,
    href: block.settings.href,
    group: block.settings.group
  }));
  return {
    colors: {
      background: "#05070E",
      foreground: "#F8FAFF",
      accent: "#8B5CF6",
      muted: "#0B1020"
    },
    typography: {
      display: source.typography?.display ?? displayFontStack,
      body: source.typography?.body ?? bodyFontStack
    },
    radii: {
      section: source.radii?.section ?? 20,
      control: source.radii?.control ?? 14
    },
    navigation,
    globalSections: scrubAidreamcapesText(globalSections),
    seo: {
      siteTitle: siteName,
      siteDescription:
        "Aidreamcapes is a private AI studio for travel portraits, destination-style albums, itinerary moodboards, and customer-only gallery delivery.",
      siteKeywords: "Aidreamcapes, AI travel portraits, destination portrait generator, cinematic travel photos, private AI travel gallery",
      titleTemplate: `%s | ${siteName}`,
      defaultOgImage: aidreamcapesPackImages.destination,
      robots: { index: true, follow: true },
      pages: {}
    },
    saasSettingsCurrent
  };
}

function buildSaasSettings(settings) {
  const current = clone(settings.saasSettingsCurrent ?? {});
  const currentSections = current.sections && typeof current.sections === "object" && !Array.isArray(current.sections)
    ? repairSharedAssetPaths(deepReplaceText(current.sections, brandReplacements))
    : {};
  if (currentSections.header_plus?.card_name) currentSections.header_plus.card_name = "Aidreamcapes header";
  if (currentSections.footer_plus?.card_name) currentSections.footer_plus.card_name = "Aidreamcapes footer";
  return {
    settings_data: {
      current: {
        ...scrubAidreamcapesText(current),
        navigation: clone(settings.navigation),
        seo: clone(settings.seo),
        general_layout_width: current.general_layout_width ?? 1280,
        general_layout_spacing: current.general_layout_spacing ?? 56,
        skin_bg: "#05070E",
        skin_title_color: "#F8FAFF",
        skin_text_color: "#B7C0D8",
        skin_primary_btn_bg_color: "#F8FAFF",
        skin_primary_btn_text_color: "#0B1020",
        skin_secondary_btn_bg_color: "#0B1020",
        skin_secondary_btn_text_color: "#F8FAFF",
        skin_accent_color: "#8B5CF6",
        skin_price_color: "#FF7A59",
        skin_muted_color: "#0B1020",
        skin_title_font_family: current.skin_title_font_family ?? settings.typography.display,
        skin_text_font_family: current.skin_text_font_family ?? settings.typography.body,
        sections: {
          ...currentSections,
          header_plus: {
            ...sectionForSaas(settings.globalSections.header),
            type: "header_plus",
            card_name: "Aidreamcapes header",
            settings: {
              ...sectionForSaas(settings.globalSections.header).settings,
              announce_title: "Create AI travel portraits from everyday uploads.",
              announcement: "Create AI travel portraits from everyday uploads.",
              announce_bg_color: "#0B1020",
              announce_color: "#F8FAFF"
            }
          },
          footer_plus: {
            ...sectionForSaas(settings.globalSections.footer),
            type: "footer_plus",
            card_name: "Aidreamcapes footer"
          }
        }
      },
      presets: []
    }
  };
}

const pageMappings = [
  { idSuffix: "home", packageTemplate: "home", templateKey: "index", slug: "/", title: "Home", pageType: "home", seoKey: "home" },
  { idSuffix: "pricing", packageTemplate: "pricing", templateKey: "page", slug: "/pricing", title: "Pricing", pageType: "pricing", seoKey: "pricing" },
  { idSuffix: "collections", packageTemplate: "packages", templateKey: "collection", slug: "/collections", title: "Travel packages", pageType: "collection", seoKey: "collections" },
  { idSuffix: "tools", packageTemplate: "tools", templateKey: "tools", slug: "/tools", title: "AI travel tools", pageType: "tools", seoKey: "tools" },
  { idSuffix: "tool_destination", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/destination-portrait-engine", title: "Destination Portrait Engine", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login", seoKey: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Customer workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy", seoKey: "privacy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refund policy", pageType: "policy", seoKey: "refunds" },
  { idSuffix: "shipping", packageTemplate: "policy", templateKey: "shipping", slug: "/policies/shipping", title: "Shipping and Digital Delivery Policy", pageType: "policy", seoKey: "shipping" },
  { idSuffix: "terms_service", packageTemplate: "policy", templateKey: "terms", slug: "/policies/terms", title: "Studio Terms", pageType: "policy", seoKey: "terms" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy", seoKey: "content" },
  { idSuffix: "cookies", packageTemplate: "policy", templateKey: "cookies", slug: "/policies/cookies", title: "Cookie policy", pageType: "policy", seoKey: "cookies" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/help", title: "Support atlas", pageType: "help", seoKey: "help" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Field Notes", pageType: "blog", seoKey: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/planning-dreamscape-source-photos", title: "Planning travel portrait source photos", pageType: "article", seoKey: "blogDreamscape" },
  { idSuffix: "about_us", packageTemplate: "about-us", templateKey: "about-us", slug: "/about-us", title: "About Us", pageType: "content", seoKey: "about" },
  { idSuffix: "contact_us", packageTemplate: "contact-us", templateKey: "contact-us", slug: "/contact-us", title: "Contact Us", pageType: "content", seoKey: "contact" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search", seoKey: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

const pageCopy = {
  "/": {
    title: "Create star-lit escape portraits from everyday uploads.",
    subtitle: "Choose a travel portrait path, upload clear source photos, and receive private gallery-ready destination albums without planning a full destination shoot."
  },
  "/pricing": {
    title: "Choose credits for your next escape portrait set.",
    subtitle: "Aidreamcapes plans cover private uploads, cinematic travel generation, gallery delivery, and top-ups when inspiration keeps going."
  },
  "/collections": {
    title: "Choose a travel portrait path",
    subtitle: "Each package locks the atmosphere, preview look, output target, and source-photo guidance for a private cinematic album."
  },
  "/tools": {
    title: "Aidreamcapes travel tools",
    subtitle: "Start with a focused tool for destination portraits, coastal getaways, old city walks, mountain trails, itinerary moodboards, and postcard visuals."
  },
  "/help": {
    title: "Aidreamcapes help for travel uploads, credits, and private albums.",
    subtitle: "Get clear answers about source photos, mood references, credit usage, checkout, refunds, privacy, and gallery delivery."
  },
  "/blog": {
    title: "Travel portrait guides for better source photos and richer scenes.",
    subtitle: "Learn how to plan cinematic escape portraits, choose references, protect private albums, and use Aidreamcapes credits intentionally."
  },
  "/blog/planning-dreamscape-source-photos": {
    title: "How to plan source photos for cinematic AI travel portraits",
    subtitle: "A practical guide to choosing portraits, outfit notes, and mood references before starting an Aidreamcapes private gallery."
  },
  "/search": {
    title: "Search Aidreamcapes tools, packages, guides, and policies.",
    subtitle: "Find travel portrait tools, coastal getaway packages, old city walks, pricing, upload help, privacy, refunds, and private gallery guidance."
  },
  "/about-us": {
    title: "About Aidreamcapes",
    subtitle: "A private AI travel portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery."
  },
  "/contact-us": {
    title: "Contact Aidreamcapes",
    subtitle: "Reach support or sales for travel portrait help, source photo guidance, billing review, privacy requests, and business questions."
  }
};

const aidreamcapesPolicyBodies = {
  privacy: `<h3>1. Information we collect</h3><p>Aidreamcapes collects the information needed to operate a private AI portrait workspace: account email, authentication state, source photos, reference notes, package selections, prompts, generation settings, credit ledger events, checkout status, support messages, generated outputs, downloads, and basic device or request metadata used for security and reliability.</p><h3>2. How we use information</h3><p>We use this information to create requested travel escape portraits, reserve and settle credits, deliver private galleries, keep account history accurate, provide support, prevent misuse, troubleshoot failed jobs, improve source-photo guidance, and show the right workspace pages after sign-in.</p><h3>3. Source photos and generated images</h3><p>Uploads and generated results stay tied to the current Aidreamcapes site and signed-in customer account. They are not sold as stock images, published in public galleries, or transferred to unrelated storefronts by default. Infrastructure and AI providers may process files only as needed to complete the service requested by the customer.</p><h3>4. Payments, credits, and retention</h3><p>Payments are handled by a connected payment provider. Aidreamcapes stores order IDs, checkout status, subscription state, credit purchases, reservations, reversals, and refund records; it does not store full card numbers on its own servers. Account records and generated assets are retained while needed for delivery, support, compliance, security, and customer access.</p><h3>5. Customer choices and contact</h3><p>Customers can contact support to ask about access, deletion, correction, privacy review, or account-specific delivery questions. Email <a href="mailto:${supportEmail}">${supportEmail}</a> and include the account email plus any relevant order, job, or gallery details so the request can be reviewed safely.</p>`,
  refunds: `<h3>1. Refund eligibility</h3><p>Credit Review are reviewed based on credit use, checkout status, subscription state, and whether generation work has already been completed. Unused one-time credit purchases may be eligible for review within the stated support window, while credits already consumed by successful travel generations are generally not refundable.</p><h3>2. Failed or interrupted jobs</h3><p>If a service-side technical failure prevents generation or private gallery delivery, Aidreamcapes may release reserved credits, rerun the request, provide troubleshooting, or review a refund. Support may ask for the account email, package name, job status, approximate request time, and any error message shown in the workspace.</p><h3>3. Subscriptions and renewals</h3><p>Canceling a subscription stops future renewals but does not automatically refund credits already granted or spent. Subscription refunds depend on payment status, usage, local requirements, and whether credits from the billing period have been applied to completed generations.</p><h3>4. Non-refundable cases</h3><p>Credit Review are usually not available for dissatisfaction caused by unclear source photos, unsupported requests, changed creative preferences after generation, or outputs that were delivered according to the selected package. Customers should review source-photo guidance before starting a package run.</p><h3>5. How to request review</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> with the Aidreamcapes account email, checkout reference if available, package or job details, and a short explanation. Support will review the ledger and delivery records before deciding whether to release credits, rerun work, or refund eligible payments.</p>`,
  shipping: `<h3>1. No physical shipping</h3><p>Aidreamcapes sells digital AI travel portrait credits, generated image packages, downloads, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>2. Digital delivery</h3><p>Credits are added after payment confirmation. Generated images are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>3. Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, Aidreamcapes may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy. Support may ask for the account email, package name, order details, and job status.</p><h3>4. No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by Aidreamcapes.</p><h3>5. Contact</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> with the Aidreamcapes account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>`,
  terms: `<h3>1. Acceptance</h3><p>By using Aidreamcapes, creating an account, purchasing credits, uploading source photos, starting a generation job, or opening a private gallery, you agree to these terms and the privacy policy that governs account data, uploads, payment status, and delivery records.</p><h3>2. Accounts and security</h3><p>Customers must provide accurate account information, keep sign-in credentials secure, and use the service only for lawful personal, creator, or business workflows. Each account is scoped to its site customer record and should not be shared in a way that bypasses billing, moderation, or privacy controls.</p><h3>3. Credits, packages, and delivery</h3><p>Credits are granted after confirmed payment, displayed before package creation, reserved when a job starts, consumed after successful delivery, and released when a request fails or times out. Delivery times, output counts, and creative results can vary based on source-photo quality, package settings, provider availability, and safety review.</p><h3>4. Uploaded content and rights</h3><p>You may only upload portraits, references, product images, or creative direction that you own or have permission to use. You remain responsible for the source material you submit and for how you use generated outputs. Aidreamcapes may reject, remove, or restrict requests that violate law, policy, platform safety rules, or third-party rights.</p><h3>5. Service limits and changes</h3><p>Aidreamcapes may update packages, pricing, credit rules, workflows, providers, delivery limits, or safety practices to keep the service reliable. We may pause or limit access when needed for security, abuse prevention, maintenance, payment issues, or policy enforcement.</p><h3>6. Contact</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for account, billing, privacy, refund, policy, generation, or private gallery questions. Include the account email and relevant job or order details when requesting support.</p>`,
  content: `<h3>1. Allowed uploads</h3><p>Upload only portraits, product references, wardrobe notes, location inspiration, or creative direction that you own, created, licensed, or have permission to use. Source photos should be clear enough to support identity-safe travel escape portraits and should not include people who have not consented to the intended use.</p><h3>2. Disallowed requests</h3><p>Do not use Aidreamcapes for impersonation, harassment, explicit exploitation, non-consensual imagery, illegal activity, stolen images, hateful or abusive content, deceptive identity use, attempts to bypass moderation, or requests involving protected marks or people in a misleading way.</p><h3>3. Generated outputs</h3><p>AI results may contain artifacts, inaccurate details, unexpected styling, or visual assumptions. Customers should review final images before using them publicly, commercially, or in identity-sensitive contexts. Generated results should not be presented as factual documentary evidence of events that did not happen.</p><h3>4. Review and enforcement</h3><p>Aidreamcapes may block prompts, reject uploads, pause jobs, remove outputs, release credits, or restrict accounts when content appears unsafe, unauthorized, abusive, unlawful, or outside supported package intent. Support may request more context when a request is ambiguous.</p><h3>5. Reporting concerns</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> to report content concerns, suspected misuse, account access issues, or generated output that needs review. Include the account email, job details, and a concise description of the concern.</p>`,
  cookies: `<h3>1. Essential cookies and local storage</h3><p>Aidreamcapes uses essential cookies and local storage to support sign-in, session security, checkout continuity, cart state, credit visibility, account preferences, private workspace routing, and customer-only gallery access. Some features may not work correctly if this storage is blocked or cleared.</p><h3>2. Security and reliability signals</h3><p>We may use limited operational signals such as request metadata, error state, device or browser type, and performance timing to detect failed requests, protect accounts, diagnose delivery issues, and improve site reliability. These signals are used to operate the service rather than to sell personal photos.</p><h3>3. Payment and third-party tools</h3><p>Checkout, email delivery, analytics, infrastructure, or AI processing providers may set or read cookies and related identifiers when they are necessary for payment status, fraud prevention, service delivery, security, or operational measurement. Their use is limited by the role they perform for the Aidreamcapes workflow.</p><h3>4. Your choices</h3><p>You can clear cookies or adjust browser settings at any time. Clearing storage may sign you out, interrupt checkout, remove local preferences, or require you to sign in again before accessing private albums, jobs, credit history, or downloads.</p><h3>5. Contact</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> if you have questions about cookies, account sessions, checkout continuity, or private gallery access on Aidreamcapes.</p>`
};

function customizePageJson(pageJson, mapping) {
  let next = scrubAidreamcapesText(clone(pageJson));
  next.pageType = mapping.pageType;
  next.version = 1;
  const copy = pageCopy[mapping.slug];
  if (copy) {
    for (const section of Object.values(next.sections)) {
      if (!section?.settings) continue;
      if (typeof section.settings.title === "string" && /MydreamShoots|photo package|AI photo|private/i.test(section.settings.title)) {
        section.settings.title = copy.title;
      }
      if (typeof section.settings.subtitle === "string" && /MydreamShoots|photo package|uploads|private/i.test(section.settings.subtitle)) {
        section.settings.subtitle = copy.subtitle;
      }
    }
  }
  applyAidreamcapesPageOverrides(next, mapping);
  const seo = mapping.seoKey ? aidreamcapesSeoPages[mapping.seoKey] : undefined;
  if (seo) {
    next.seo = {
      title: seo.title,
      description: seo.description,
      keywords: seo.keywords,
      canonicalPath: seo.canonicalPath,
      robots: {
        index: seo.index,
        follow: seo.follow
      }
    };
  }
  return scrubAidreamcapesText(next);
}

function applyAidreamcapesPageOverrides(pageJson, mapping) {
  updateSections(pageJson, (section) => section.type === "hero", (section) => {
    section.settings = {
      ...section.settings,
      layout: "immersive_dark",
      eyebrow: "AI travel portrait studio",
      title: "Portrait journeys that feel travelled, not generated.",
      headline: "Portrait journeys that feel travelled, not generated.",
      highlightWord: "travelled",
      subtitle: "Upload everyday photos and build private destination-style albums across coasts, old cities, mountain trails, cafe streets, and postcard scenes.",
      heroBadge: "Private destination albums",
      imageBadge: "Travel album",
      imageCaption: "Coastal, mountain, and city escape portraits delivered privately.",
      authRibbon: "Travel styles live now",
      bulletList: "Destination portraits from everyday photos|Coastal, mountain, city, and cafe scenes|Private travel albums with visible credits|No flights, crews, or public galleries",
      heroGridImages: [
        aidreamcapesPackImages.destination,
        aidreamcapesPackImages.coastal,
        aidreamcapesPackImages.mountain,
        aidreamcapesPackImages.postcard
      ].join("|"),
      heroVisualOverride: aidreamcapesPackImages.destination,
      socialProofLabel: "4.9/5 from private travel album customers",
      primaryCta: "Start a package",
      primaryHref: "/login",
      secondaryCta: "View travel packages",
      secondaryHref: "/collections"
    };
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_tool_collection" || section.type === "dreamshoot_tool_collection", (section) => {
    section.type = "aidreamcapes_tool_collection";
    section.settings = {
      ...section.settings,
      eyebrow: "Aidreamcapes tools",
      title: "Choose a travel portrait tool",
      subtitle: "Use focused tools for destination portraits, coastal getaways, old city walks, mountain trails, itinerary moodboards, and postcard social sets.",
      categories: "All tools|Destination|Coastal|Resort|City|Street|Adventure|Itinerary|Postcard",
      primaryCta: "Start Destination Portrait Engine",
      primaryHref: "/tools/destination-portrait-engine",
      secondaryCta: "Browse travel packages",
      secondaryHref: "/collections"
    };
    section.blocks = clone(aidreamcapesTools);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_package_taxonomy" || section.type === "dreamshoot_package_taxonomy", (section) => {
    section.type = "aidreamcapes_package_taxonomy";
    section.settings = {
      ...section.settings,
      eyebrow: "Travel taxonomy",
      title: "Aidreamcapes travel paths",
      subtitle: "Browse package families built around destination feel, travel moment, adventure setting, and creator-ready album use case.",
      layout: "editorial"
    };
    section.blocks = clone(aidreamcapesTaxonomyBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_feature_tabs" || section.type === "dreamshoot_feature_tabs", (section) => {
    section.type = "aidreamcapes_feature_tabs";
    section.settings = {
      ...section.settings,
      eyebrow: "Creation flow",
      title: "Plan the trip mood before you generate.",
      subtitle: "Aidreamcapes keeps each request anchored to source photos, destination references, visible credits, and private delivery."
    };
    section.blocks = clone(aidreamcapesFeatureTabs);
  });
  setSectionBlocks(pageJson, "feature_grid", aidreamcapesFlowBlocks);
  setSectionBlocks(pageJson, "sample_strip", aidreamcapesSampleBlocks);
  updateSections(pageJson, (section) => section.type === "photo_package_wall", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Travel packages",
      title: "AI travel portraits for destination-style private albums.",
      subtitle: "Compare Aidreamcapes packages by destination mood, credit cost, source-photo guidance, output count, and delivery fit.",
      source: "creative_packs",
      layout: "editorial",
      maxCount: "32"
    };
  });
  updateSections(pageJson, (section) => section.type === "brand_logo_strip", (section) => {
    section.settings = {
      ...section.settings,
      title: "Travel style signals for coasts, cities, trails, resorts, and postcard albums",
      style: "quiet"
    };
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_visual_proof" || section.type === "dreamshoot_visual_proof", (section) => {
    section.type = "aidreamcapes_visual_proof";
    section.settings = {
      ...section.settings,
      label: "Travel directions",
      title: "See how one upload set can become a destination story.",
      subtitle: "Browse Aidreamcapes outcomes across coastal getaways, old city walks, island stays, mountain trails, cafe stories, and postcard social sets.",
      tabs: "All|Destination|Coastal|City|Adventure|Postcard"
    };
    section.blocks = clone(aidreamcapesVisualProofBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_featured_pack" || section.type === "dreamshoot_featured_pack", (section) => {
    section.type = "aidreamcapes_featured_pack";
    section.settings = {
      ...section.settings,
      label: "Featured package",
      badge: "Signature",
      title: "Destination Portraits for cinematic travel moments.",
      subtitle: "Build a private gallery of coastal light, old city lanes, scenic overlooks, and postcard-ready portraits from everyday uploads.",
      primaryCta: "Create travel portraits",
      primaryHref: "/tools/destination-portrait-engine",
      secondaryCta: "Browse travel packages",
      secondaryHref: "/collections",
      overlayTitle: "Destination Pack",
      overlaySubtitle: "Travel portraits without planning a destination shoot.",
      campaignLabel: "Current focus: private travel albums",
      includedOutputs: "Destination portraits|Coastal getaway scenes|Old city walk crops|Island resort frames|Mountain trail portraits|Cafe street stories|Itinerary moodboards|Postcard social cards",
      safetyCopy: "Private styling: no public gallery is created unless the customer chooses to share finished images.",
      bottomNote: "Travel packages rotate around coasts, cities, resorts, trails, cafe moments, and postcard-ready memories."
    };
    section.blocks = clone(aidreamcapesFeaturedPackBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_package_catalog" || section.type === "dreamshoot_package_catalog", (section) => {
    section.type = "aidreamcapes_package_catalog";
    section.settings = {
      ...section.settings,
      label: "Package catalog",
      title: "Choose a finished travel direction before generating.",
      subtitle: "Each Aidreamcapes package has a destination mood, output count, credit cost, source-photo guidance, and one clear next action.",
      tabs: "All|Destination|Coastal|City|Adventure|Postcard",
      steps: "Choose destination mood|Review credit cost|Generate private gallery"
    };
    section.blocks = clone(aidreamcapesCatalogBlocks);
  });
  updateSections(pageJson, (section) => section.type === "testimonial_wall", (section) => {
    section.settings = {
      ...section.settings,
      title: "Travel album stories from private gallery customers",
      subtitle: "Aidreamcapes customers use packages for destination portraits, coastal memories, city walks, adventure scenes, and postcard-ready albums.",
      summaryTitle: "Private travel portraits",
      summaryBody: "Source photos, credits, and finished galleries stay connected to one signed-in account."
    };
    section.blocks = clone(aidreamcapesTestimonialBlocks);
  });
  updateSections(pageJson, (section) => section.type === "dreamshoot_flow_bridge" || section.type === "aidreamcapes_flow_bridge", (section) => {
    section.type = "aidreamcapes_flow_bridge";
    section.settings = {
      ...section.settings,
      label: "Travel workflow bridge",
      title: "From source photos to a private travel gallery.",
      subtitle: "Aidreamcapes turns upload planning, destination mood choice, credit spend, and gallery delivery into one clear customer journey.",
      albumImageOne: aidreamcapesPackImages.destination,
      albumImageTwo: aidreamcapesPackImages.coastal,
      albumImageThree: aidreamcapesPackImages.mountain
    };
    section.blocks = clone(aidreamcapesFlowBlocks);
  });
  updateSections(pageJson, (section) => section.type === "faq", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Travel portrait questions",
      title: "Aidreamcapes FAQ",
      subtitle: "Answers about source photos, travel package choice, credits, privacy, delivery, and refunds.",
      journeyTitle: "Your travel album flow",
      journeyTitles: "Upload|Choose Destination|Generate|Download",
      journeyDescriptions: "Add clear source photos.|Pick a travel direction.|Spend visible credits.|Review the private gallery."
    };
    section.blocks = clone(aidreamcapesFaqBlocks);
  });
  updateSections(pageJson, (section) => section.type === "conversion_panel", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Start creating",
      title: "Open your private Aidreamcapes studio.",
      subtitle: "Plan the destination mood, upload source photos, spend visible credits, and keep finished travel portraits in one private workspace.",
      primaryCta: "Start a travel set",
      primaryHref: "/login",
      secondaryCta: "Browse packages",
      secondaryHref: "/collections"
    };
  });
  if (mapping.slug === "/help") {
    const intro = pageJson.sections.intro_1;
    if (intro?.settings) {
      intro.settings = {
        ...intro.settings,
        eyebrow: "Support atlas",
        title: "Aidreamcapes help for travel uploads, credits, and private albums.",
        body: "Find practical answers about source photo quality, travel package choice, destination references, credit usage, checkout, refunds, privacy, cookies, and private gallery delivery."
      };
    }
    const planRules = pageJson.sections.plan_rules_1;
    if (planRules?.settings) {
      planRules.settings = {
        ...planRules.settings,
        eyebrow: "Plans and credits",
        title: "Plan the destination mood first. Spend credits when ready.",
        body: "Aidreamcapes uses visible credits for private travel portrait generation, with source photos, requests, albums, and downloads kept inside the signed-in account.",
        imageUrl: aidreamcapesPackImages.destination,
        primaryCta: "Choose a plan",
        primaryHref: "/pricing",
        secondaryCta: "Browse travel tools",
        secondaryHref: "/tools"
      };
      planRules.blocks = clone(aidreamcapesPlanRuleBlocks);
    }
  }
  if (mapping.slug === "/blog") {
    if (pageJson.sections.blog_intro_1?.settings) {
      pageJson.sections.blog_intro_1.settings = {
        eyebrow: "Field Notes",
        title: "Travel portrait guides for richer AI destination scenes.",
        body: "Learn how to prepare source portraits, choose outfit notes, describe coastal or city moods, manage credits, protect private albums, and get more intentional Aidreamcapes results."
      };
    }
    if (pageJson.sections.blog_list_1?.settings) {
      pageJson.sections.blog_list_1.settings = {
        title: "Aidreamcapes travel portrait guides",
        body: "Field Notes for source photos, destination moods, coastal portraits, credit planning, private delivery, and gallery review.",
        guideType: "Travel guide"
      };
    }
  }
  if (mapping.slug === "/blog/planning-dreamscape-source-photos" && pageJson.sections.blog_detail_1?.settings) {
    pageJson.sections.blog_detail_1.settings = {
      eyebrow: "Travel guide",
      title: "How to plan source photos for cinematic AI travel portraits",
      body: `<p>Strong Aidreamcapes results start before generation. Choose recent portraits with clear facial detail, natural expressions, and enough variation in angle, lighting, and distance for the private workflow to understand the subject.</p><h3>Pick photos that preserve identity</h3><p>Use simple, sharp images first. Avoid heavy filters, sunglasses, extreme crops, and group shots when the request needs consistent travel portraits.</p><h3>Add destination references without overloading the request</h3><p>A coastal getaway might need warm light and relaxed wardrobe notes. An old city walk can use cafe, plaza, and boutique hotel references. A mountain trail set benefits from outdoor layers, scenic overlook notes, and preferred season.</p><h3>Match the package to the final use</h3><p>Choose Destination Portraits for broad atmosphere, Coastal Getaways for warm sea light, Old City Walks for urban travel storytelling, Mountain Trails for adventure scenes, and Postcard Social Set for share-ready crops.</p><h3>Review privately before sharing</h3><p>Finished images return to the Aidreamcapes account gallery, where customers can compare crops, download favorites, and decide what belongs on profiles, travel posts, gifts, or private keepsakes.</p>`
    };
  }
  if (mapping.slug === "/search") {
    if (pageJson.sections.search_intro_1?.settings) {
      pageJson.sections.search_intro_1.settings = {
        eyebrow: "Search",
        title: "Search Aidreamcapes tools, packages, guides, and policies.",
        body: "Find travel portrait tools, coastal getaway packages, destination guidance, pricing, source-photo help, privacy details, refund information, and private gallery support."
      };
    }
    if (pageJson.sections.search_1?.settings) {
      pageJson.sections.search_1.settings = {
        ...pageJson.sections.search_1.settings,
        eyebrow: "Site search",
        title: "Search Aidreamcapes",
        subtitle: "Search travel packages, AI tools, pricing, help guides, and policies.",
        emptyTitle: "No matching Aidreamcapes content yet.",
        emptyBody: "Try destination portraits, coastal getaways, old city walks, mountain trails, pricing, uploads, privacy, or refunds.",
        resultLimit: 12
      };
    }
  }
  if (mapping.slug === "/about-us") {
    if (pageJson.sections.about_intro_1?.settings) {
      pageJson.sections.about_intro_1.settings = {
        eyebrow: "About Aidreamcapes",
        title: "Private AI travel portraits with clear credits and customer-only delivery.",
        body: "Aidreamcapes helps customers turn everyday source photos into cinematic destination portraits, coastal getaways, city walks, mountain scenes, and private galleries without planning a real destination shoot."
      };
    }
    if (pageJson.sections.about_values_1?.settings) {
      pageJson.sections.about_values_1.settings = {
        eyebrow: "What we focus on",
        title: "Source photos, destination planning, visible credits, and private albums.",
        subtitle: "Each Aidreamcapes page is designed around a clear travel portrait outcome so customers know what to upload, what credits are reserved, and where finished images will arrive."
      };
      pageJson.sections.about_values_1.blocks = [
        { id: "about_private", type: "rich_text_card", settings: { meta: "Private by default", title: "Customer-only galleries", description: "Uploads and generated portraits stay tied to the signed-in Aidreamcapes account unless the customer chooses to share results." } },
        { id: "about_credits", type: "rich_text_card", settings: { meta: "Clear pricing", title: "Visible credit usage", description: "Plans, one-time top-ups, package costs, reservations, and delivery states are shown before customers commit to a request." } },
        { id: "about_scenes", type: "rich_text_card", settings: { meta: "Creative direction", title: "Travel package themes", description: "Destination portraits, coastal getaways, old city walks, mountain trails, cafe stories, and postcard social sets each have focused guidance." } }
      ];
    }
    if (pageJson.sections.trust_1?.settings) {
      pageJson.sections.trust_1.settings = {
        eyebrow: "Customer trust",
        title: "Built for private portrait workflows, not public galleries.",
        contactEmail: supportEmail,
        body: `Aidreamcapes keeps source photos, request history, credit ledger events, generated outputs, downloads, support details, and policy pages scoped to the storefront account. Email <a href="mailto:${supportEmail}">${supportEmail}</a> for privacy, account, billing, or private travel gallery questions.`
      };
    }
  }
  if (mapping.slug === "/contact-us") {
    if (pageJson.sections.contact_intro_1?.settings) {
      pageJson.sections.contact_intro_1.settings = {
        eyebrow: "Contact",
        title: "Contact Aidreamcapes support or sales.",
        body: "Reach the right Aidreamcapes inbox for source photo guidance, travel request status, account access, billing review, privacy questions, plan fit, or creator and business use cases."
      };
      pageJson.sections.contact_intro_1.blocks = [
        { id: "contact_support", type: "rich_text_card", settings: { meta: "Support", title: supportEmail, description: "For account access, billing review, credit questions, upload help, privacy requests, and private travel gallery delivery support." } },
        { id: "contact_sales", type: "rich_text_card", settings: { meta: "Sales", title: salesEmail, description: "For plan questions, creator use cases, campaign planning, team workflows, and business inquiries." } },
        { id: "contact_address", type: "rich_text_card", settings: { meta: "Address", title: companyAddress, description: "Company mailing address for Aidreamcapes business correspondence." } }
      ];
    }
    if (pageJson.sections.contact_details_1?.settings) {
      pageJson.sections.contact_details_1.settings = {
        title: "Contact information",
        lastUpdated: "June 28, 2026",
        contactEmail: supportEmail,
        body: `<h3>Support</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for account access, source photo guidance, billing review, refunds, privacy requests, policy questions, credit history, generation status, or private gallery delivery help.</p><h3>Sales</h3><p>Email <a href="mailto:${salesEmail}">${salesEmail}</a> for plan questions, business use, creator collaborations, team workflows, or campaign planning.</p><h3>Company address</h3><p>${companyAddress}</p><h3>What to include</h3><p>For faster support, include the email address on your Aidreamcapes account, the page or package involved, order or checkout details if relevant, and a short description of what you need reviewed.</p>`
      };
    }
  }
  if (mapping.slug === "/tools/destination-portrait-engine") {
    updateSections(pageJson, () => true, (section) => {
      if (section.settings.eyebrow === "Travel Portrait Studio" || /AI Image Studio/i.test(section.settings.eyebrow ?? "")) section.settings.eyebrow = "Travel Studio";
      if (typeof section.settings.title === "string") section.settings.title = section.settings.title.replace(/AI Image Studio|Generate Profile Stories and Portrait Scene Packs|Destination Portrait Engine/gi, "Destination Portrait Engine");
      if (typeof section.settings.subtitle === "string") section.settings.subtitle = section.settings.subtitle.replace(/profile stories|portrait scene packs|cinematic escape portraits/gi, "cinematic travel portraits");
    });
    pageJson.seo = {
      title: "Aidreamcapes Destination Portrait Engine - cinematic AI travel portraits",
      description: "Start the Aidreamcapes Destination Portrait Engine to create cinematic travel portraits from private uploads, destination references, credits, and gallery delivery.",
      keywords: "Aidreamcapes destination portrait generator, cinematic AI travel portraits, private AI travel tool",
      canonicalPath: "/tools/destination-portrait-engine",
      robots: { index: true, follow: true }
    };
  }
  if (mapping.slug === "/app/jobs/progress") {
    pageJson.seo = {
      title: "Aidreamcapes Job Progress - track travel gallery delivery",
      description: "Track Aidreamcapes travel generation progress, reserved credits, request status, and private gallery delivery from the customer workspace.",
      keywords: "Aidreamcapes job progress, travel generation status, private AI gallery delivery",
      canonicalPath: "/app/jobs/progress",
      robots: { index: false, follow: true }
    };
  }
  if (mapping.slug === "/app/jobs/detail") {
    pageJson.seo = {
      title: "Aidreamcapes Job Detail - review private gallery outputs",
      description: "Review Aidreamcapes generation details, credit activity, private outputs, and delivered travel escape portraits inside the customer workspace.",
      keywords: "Aidreamcapes job detail, travel portrait outputs, private portrait gallery",
      canonicalPath: "/app/jobs/detail",
      robots: { index: false, follow: true }
    };
  }
  if (mapping.slug === "/cart") {
    updateSections(pageJson, (section) => section.type === "cart_summary", (section) => {
      section.settings = {
        ...section.settings,
        title: "Your selected Aidreamcapes credit plan",
        subtitle: "Review credits, price, and travel package access before continuing to secure checkout."
      };
    });
  }
  if (mapping.slug === "/404") {
    pageJson.seo = {
      title: "Page Not Found - return to Aidreamcapes travel packages",
      description: "This Aidreamcapes page is not available. Return to travel packages, tools, pricing, help, or the private customer workspace.",
      keywords: "Aidreamcapes 404, travel packages, Aidreamcapes help",
      canonicalPath: "/404",
      robots: { index: false, follow: true }
    };
  }
  const policyBody = aidreamcapesPolicyBodies[mapping.templateKey];
  if (policyBody) {
    const sectionId = pageJson.sections.policy_1 ? "policy_1" : Object.keys(pageJson.sections).find((id) => pageJson.sections[id]?.type === "policy" || pageJson.sections[id]?.settings?.body);
    if (sectionId) {
      pageJson.sections[sectionId].settings = {
        ...pageJson.sections[sectionId].settings,
        title: mapping.title,
        lastUpdated: "June 27, 2026",
        contactEmail: supportEmail,
        body: policyBody
      };
    }
  }
}

function buildPages(version) {
  return pageMappings.map((mapping) => {
    const sourcePageJson = sourcePageByTemplate(sourceSite, mapping.templateKey, mapping.slug);
    const pageJson = customizePageJson(sourcePageJson, mapping);
    return {
      id: `${siteId}_${mapping.idSuffix}`,
      siteId,
      pageType: mapping.pageType,
      templateKey: mapping.templateKey,
      slug: mapping.slug,
      title: mapping.title,
      draftJson: clone(pageJson),
      publishedJson: clone(pageJson)
    };
  });
}

function buildThemeRecord({ id, status, name, themeId, pages, settings }) {
  return {
    id,
    siteId,
    name,
    themeId,
    themeKey,
    status,
    templates: Object.fromEntries(
      pages.map((sitePage) => [
        sitePage.templateKey || sitePage.pageType,
        templateForSaas(status === "active" ? sitePage.publishedJson : sitePage.draftJson)
      ])
    ),
    settings: buildSaasSettings(settings),
    source: "site",
    createdBy: "admin_aidreamcapes_owner",
    createdAt: now,
    updatedAt: now
  };
}

const products = [
  ["prod_aidreamcapes_starter", "Daydream", "price_aidreamcapes_starter", 3500, 200, false, "For one focused travel portrait set", "Travel-soft editing", 20, 2, 3],
  ["prod_aidreamcapes_pro", "Voyage", "price_aidreamcapes_pro", 5000, 300, true, "Best for multiple escape directions", "Cinematic editing", 40, 4, 2],
  ["prod_aidreamcapes_premium", "Atlas", "price_aidreamcapes_premium", 9000, 600, false, "For creators building a full visual world", "Premium editorial retouching", 80, 8, 1]
].map(([id, name, priceId, amountCents, creditsGranted, featured, planSubtitle, editingLabel, generatedPhotos, destinationCount, deliveryDays]) => {
  const priceEnvName = `AIDREAMCAPES_STRIPE_PRICE_${String(name).toUpperCase()}`;
  return {
  id,
  siteId,
  name,
  type: "subscription",
  status: "active",
  prices: [
    {
      id: priceId,
      siteId,
      productId: id,
      label: name,
      amountCents,
      currency: "usd",
      interval: "month",
      creditsGranted,
      stripePriceId: envOrManualPrice(priceEnvName, `manual_${priceId}`),
      metadata: { generatedPhotos, destinationCount, deliveryDays, featured, planSubtitle, editingLabel, publicReference: `Aidreamcapes ${String(name).toLowerCase()} credit plan` }
    }
  ]
  };
});

products.push({
  id: "prod_aidreamcapes_boost",
  siteId,
  name: "Extra 150 Credits",
  type: "credit_pack",
  status: "active",
  prices: [
    {
      id: "price_aidreamcapes_boost",
      siteId,
      productId: "prod_aidreamcapes_boost",
      label: "Extra 150 credits",
      amountCents: 1800,
      currency: "usd",
      interval: "one_time",
      creditsGranted: 150,
      stripePriceId: envOrManualPrice("AIDREAMCAPES_STRIPE_PRICE_BOOST", "manual_aidreamcapes_boost_150")
    }
  ]
});

const parentCategoryRows = [
  ["cat_aidreamcapes_parent_destination", "destination-portraits", "Destination Portraits", "Location-led AI portrait packages for coasts, resorts, old cities, and scenic overlooks.", "Destination-style AI travel portraits", "Choose a travel setting, then generate a private album around it.", "map", aidreamcapesPackImages.destination],
  ["cat_aidreamcapes_parent_moments", "travel-moments", "Travel Moments", "Cafe, street, balcony, sunset, and shared-trip portrait directions.", "Travel moment portraits", "Turn small trip memories into polished private gallery scenes.", "camera", aidreamcapesPackImages.coastal],
  ["cat_aidreamcapes_parent_adventure", "adventure-escapes", "Adventure Escapes", "Mountain, lake, road-trip, forest cabin, and outdoor travel portrait themes.", "Adventure escape portraits", "Build cinematic outdoor albums without planning a full location shoot.", "sparkles", aidreamcapesPackImages.mountain],
  ["cat_aidreamcapes_parent_creator", "creator-travel-kits", "Creator Travel Kits", "Postcard, itinerary, editorial, and social-ready travel visuals for creators.", "Creator travel visuals", "Plan travel content, postcard crops, and destination-ready albums.", "wand", aidreamcapesPackImages.postcard]
];

const childCategoryRows = [
  ["cat_aidreamcapes_destination", "destination-portrait-albums", "Destination Portrait Albums", "Broad travel portrait albums across coast, city, resort, and scenic settings.", "Create destination-style AI portraits", "Turn everyday uploads into cohesive private travel albums.", "map", aidreamcapesPackImages.destination, "cat_aidreamcapes_parent_destination"],
  ["cat_aidreamcapes_coastal", "coastal-getaways", "Coastal Getaways", "Beach, island, resort, and cliffside portrait moods.", "AI coastal getaway portraits", "Warm seaside imagery without planning a destination shoot.", "waves", aidreamcapesPackImages.coastal, "cat_aidreamcapes_parent_destination"],
  ["cat_aidreamcapes_old_city", "old-city-walks", "Old City Walks", "Cafe streets, stone lanes, plazas, museums, and boutique hotel portraits.", "Old city walk portraits", "Create cinematic urban travel scenes from everyday source photos.", "camera", aidreamcapesPackImages.profileStory, "cat_aidreamcapes_parent_destination"],
  ["cat_aidreamcapes_resort", "island-resort-scenes", "Island Resort Scenes", "Terrace, balcony, poolside, and relaxed resort portrait directions.", "Island resort AI portraits", "Build sunlit resort-style albums with private source photos.", "sun", aidreamcapesPackImages.postcard, "cat_aidreamcapes_parent_destination"],
  ["cat_aidreamcapes_cafe", "cafe-street-stories", "Cafe & Street Stories", "Everyday travel portraits for cafes, corners, crossings, and slow mornings.", "Cafe and street travel portraits", "Create natural trip moments with polished editorial framing.", "coffee", aidreamcapesPackImages.glam, "cat_aidreamcapes_parent_moments"],
  ["cat_aidreamcapes_overlooks", "scenic-overlooks", "Scenic Overlooks", "Lookout points, terraces, sea cliffs, and panoramic travel scenes.", "Scenic overlook portraits", "Turn source photos into wide-open destination memories.", "sparkles", aidreamcapesPackImages.travel, "cat_aidreamcapes_parent_moments"],
  ["cat_aidreamcapes_mountain", "mountain-trails", "Mountain Trails", "Alpine lakes, trail paths, cabins, and outdoor portrait albums.", "Mountain trail portraits", "Create adventure-ready outdoor scenes from simple uploads.", "mountain", aidreamcapesPackImages.mountain, "cat_aidreamcapes_parent_adventure"],
  ["cat_aidreamcapes_roadtrip", "road-trip-frames", "Road Trip Frames", "Open roads, motel light, car-window memories, and weekend escape scenes.", "Road trip AI portraits", "Shape private travel galleries around movement and route mood.", "route", aidreamcapesPackImages.destination, "cat_aidreamcapes_parent_adventure"],
  ["cat_aidreamcapes_moodboard", "itinerary-moodboards", "Itinerary Moodboards", "Visual planning sets for outfits, destinations, seasons, and album direction.", "Travel itinerary moodboards", "Align the trip concept before spending generation credits.", "clipboard", aidreamcapesPackImages.travel, "cat_aidreamcapes_parent_creator"],
  ["cat_aidreamcapes_postcard", "postcard-social-sets", "Postcard Social Sets", "Postcard crops, story covers, memory cards, and profile banners.", "Postcard social set maker", "Create polished share-ready travel visuals from private albums.", "cards", aidreamcapesPackImages.postcard, "cat_aidreamcapes_parent_creator"]
];

const categories = [...parentCategoryRows, ...childCategoryRows].map(([id, slug, label, description, heroTitle, heroSubtitle, icon, imageUrl, parentId], index) => ({
  id,
  siteId,
  parentId,
  slug,
  label,
  description,
  heroTitle,
  heroSubtitle,
  icon,
  imageUrl,
  sortOrder: index + 1,
  status: "active",
  createdAt: now
}));

const packRows = [
  ["pack_aidreamcapes_destination", "Destination Portrait Albums", "Cohesive travel portraits across coast, city, resort, and scenic settings.", "destination-portrait-albums", 28, 24, aidreamcapesPackImages.destination],
  ["pack_aidreamcapes_coastal", "Coastal Getaways", "Beach, island, resort, and cliffside portraits with warm travel light.", "coastal-getaways", 24, 22, aidreamcapesPackImages.coastal],
  ["pack_aidreamcapes_old_city", "Old City Walks", "Cafe streets, stone lanes, plazas, museums, and boutique hotel portraits.", "old-city-walks", 24, 22, aidreamcapesPackImages.profileStory],
  ["pack_aidreamcapes_resort", "Island Resort Scenes", "Terrace, balcony, poolside, and soft resort portrait directions.", "island-resort-scenes", 24, 24, aidreamcapesPackImages.postcard],
  ["pack_aidreamcapes_cafe", "Cafe & Street Stories", "Everyday travel portraits for cafes, corners, crossings, and slow mornings.", "cafe-street-stories", 20, 18, aidreamcapesPackImages.glam],
  ["pack_aidreamcapes_overlooks", "Scenic Overlooks", "Lookout points, terraces, sea cliffs, and panoramic travel scenes.", "scenic-overlooks", 24, 22, aidreamcapesPackImages.travel],
  ["pack_aidreamcapes_mountain", "Mountain Trails", "Alpine lakes, trail paths, cabins, and outdoor portrait albums.", "mountain-trails", 24, 24, aidreamcapesPackImages.mountain],
  ["pack_aidreamcapes_roadtrip", "Road Trip Frames", "Open roads, motel light, car-window memories, and weekend escape scenes.", "road-trip-frames", 24, 22, aidreamcapesPackImages.destination],
  ["pack_aidreamcapes_moodboard", "Itinerary Moodboards", "Visual planning sets for outfits, destinations, seasons, and album direction.", "itinerary-moodboards", 16, 16, aidreamcapesPackImages.travel],
  ["pack_aidreamcapes_postcard", "Postcard Social Sets", "Postcard crops, story covers, memory cards, and profile banners.", "postcard-social-sets", 20, 18, aidreamcapesPackImages.postcard]
];

const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
const creativePacks = packRows.map(([id, name, description, categorySlug, outputCount, creditCost, imageUrl], index) => ({
  id,
  siteId,
  categoryId: categoryBySlug.get(categorySlug)?.id,
  name,
  headline: name,
  description,
  prompt: `Create ${name.toLowerCase()} with Aidreamcapes in a cinematic, cream-toned, dreamlike escape style.`,
  category: categorySlug,
  aiAppSlug: "image_generator",
  status: "active",
  creditCost,
  outputCount,
  trainingRequired: true,
  generationCount: 90 + index * 13,
  conversionRate: Number((7.4 + index * 0.5).toFixed(1)),
  imageUrl,
  galleryImages: [imageUrl],
  createdAt: now
}));

const mediaAssets = [
  ["media_aidreamcapes_hero", "Aidreamcapes cinematic travel portrait hero", "sites/site_aidreamcapes/theme/destination-story.png", aidreamcapesPackImages.destination],
  ["media_aidreamcapes_coastal", "Aidreamcapes coastal escape portrait cover", "sites/site_aidreamcapes/theme/coastal-escapes.png", aidreamcapesPackImages.coastal],
  ["media_aidreamcapes_resort", "Aidreamcapes island resort scene cover", "sites/site_aidreamcapes/theme/island-resort-scenes.png", aidreamcapesPackImages.avatar],
  ["media_aidreamcapes_editorial", "Aidreamcapes editorial getaway portrait cover", "sites/site_aidreamcapes/theme/editorial-getaways.png", aidreamcapesPackImages.editorial],
  ["media_aidreamcapes_glam", "Aidreamcapes cafe street portrait cover", "sites/site_aidreamcapes/theme/soft-glam-studio.png", aidreamcapesPackImages.glam]
].map(([id, label, storageKey, previewUrl]) => ({
  id,
  siteId,
  label,
  storageKey,
  mimeType: "image/png",
  usage: "theme",
  usageType: "theme",
  sourceType: "theme_seed",
  previewUrl,
  originUrl: previewUrl,
  altText: label,
  createdAt: now
}));

const state = JSON.parse(await fs.readFile(dataPath, "utf8"));
const sourceSite = sourceDreamshootSite(state);
if (!sourceSite) {
  throw new Error("missing_source_site:site_dreamshoot");
}

const pages = buildPages(1);
const settings = repairSharedAssetPaths(buildThemeSettings());
if (settings.saasSettingsCurrent?.sections?.header_plus?.card_name) settings.saasSettingsCurrent.sections.header_plus.card_name = "Aidreamcapes header";
if (settings.saasSettingsCurrent?.sections?.footer_plus?.card_name) settings.saasSettingsCurrent.sections.footer_plus.card_name = "Aidreamcapes footer";
settings.seo.pages = Object.fromEntries(
  pages
    .map((page) => {
      const mapping = pageMappings.find((item) => `${siteId}_${item.idSuffix}` === page.id);
      const seo = mapping?.seoKey ? aidreamcapesSeoPages[mapping.seoKey] : undefined;
      return seo ? [page.id, { ...seo, ogImage: aidreamcapesPackImages.destination }] : undefined;
    })
    .filter(Boolean)
);
const draftTheme = buildThemeRecord({ id: "theme_site_aidreamcapes_draft", status: "draft", name: "Aidreamcapes Draft", themeId: "site_aidreamcapes_draft", pages, settings });
const activeTheme = buildThemeRecord({ id: "theme_site_aidreamcapes_active", status: "active", name: "Aidreamcapes Live", themeId: "site_aidreamcapes_active_v1", pages, settings });

const site = {
  id: siteId,
  name: siteName,
  slug: siteSlug,
  status: "active",
  primaryDomain,
  currency: "usd",
  timezone: "America/New_York",
  branding: {
    logoText: siteName,
    market: "AI travel portraits, destination scenes, cinematic escape packages, credits, and private galleries",
    description: settings.seo.siteDescription,
    logoImageUrl
  },
  connect: {
    stripeAccountId,
    status: stripeChargesEnabled ? "enabled" : "pending",
    chargesEnabled: stripeChargesEnabled,
    payoutsEnabled: stripePayoutsEnabled
  },
  themeSettings: {
    draftJson: clone(settings),
    publishedJson: clone(settings)
  },
  pages
};

state.sites = replaceWhere(state.sites ?? [], (item) => item.id === siteId || item.slug === siteSlug, [site]);
state.siteDomains = replaceWhere(state.siteDomains ?? [], (item) => item.siteId === siteId || [primaryDomain, apexDomain, localDomain].includes(item.domain), [
  { id: "dom_aidreamcapes_primary", siteId, domain: primaryDomain, isPrimary: true, status: "active", createdAt: now },
  { id: "dom_aidreamcapes_apex", siteId, domain: apexDomain, isPrimary: false, status: "active", createdAt: now },
  { id: "dom_aidreamcapes_localhost", siteId, domain: localDomain, isPrimary: false, status: "active", createdAt: now }
]);
state.siteAdmins = replaceWhere(state.siteAdmins ?? [], (item) => item.siteId === siteId, [
  {
    id: "admin_aidreamcapes_owner",
    siteId,
    email: `owner@${localDomain}`,
    passwordHash: hashPassword("aidreamcapes123"),
    displayName: "Aidreamcapes Owner",
    role: "owner",
    createdAt: now
  }
]);
state.products = replaceWhere(state.products ?? [], (item) => item.siteId === siteId, products);
state.creativePackCategories = replaceWhere(state.creativePackCategories ?? [], (item) => item.siteId === siteId, categories);
state.creativePacks = replaceWhere(state.creativePacks ?? [], (item) => item.siteId === siteId, creativePacks);
state.toolCategories = replaceWhere(state.toolCategories ?? [], (item) => item.siteId === siteId, toolCategories);
state.toolMenuItems = replaceWhere(state.toolMenuItems ?? [], (item) => item.siteId === siteId, toolMenuItems);
state.mediaAssets = replaceWhere(state.mediaAssets ?? [], (item) => item.siteId === siteId, mediaAssets);

const baseImageApp = (state.aiApps ?? []).find((app) => app.slug === "image_generator") ?? {
  id: "ai_image",
  slug: "image_generator",
  name: "Image Studio",
  description: "Private image generation with signed album delivery.",
  appType: "image"
};
const imageApp = {
  ...baseImageApp,
  name: "Aidreamcapes Travel Portrait Studio",
  description: "Private AI travel escape portraits, cinematic escape packages, soft travel scenes, and customer-only gallery delivery.",
  parameterSchema: [
    { id: "style", label: "Style", type: "select", options: ["destination-portrait", "coastal-getaway", "island-resort", "old-city-walk", "mountain-trail", "editorial-getaway", "cafe-street", "postcard-social"] },
    { id: "outputCount", label: "Output count", type: "select", options: ["8", "20", "40"] }
  ]
};
state.siteAiApps = replaceWhere(state.siteAiApps ?? [], (item) => item.siteId === siteId, [
  { id: "sai_aidreamcapes_image", siteId, aiApp: imageApp, enabled: true, creditCost: 24, routeKey: "n8n.image.aidreamcapes.v1" }
]);
state.aiGatewayGroups = replaceWhere(state.aiGatewayGroups ?? [], (item) => item.siteId === siteId, [
  {
    id: "gw_aidreamcapes_primary",
    siteId,
    name: "Aidreamcapes image quota",
    status: "active",
    modelAllowlist: ["gpt-image-2", "gpt-4.1-mini"],
    monthlyQuota: 10000,
    usedQuota: 0,
    retryStatusCodes: [429, 500, 502, 503],
    rateLimitPerMinute: 60,
    accountPoolMode: "dedicated"
  }
]);
state.customers = replaceWhere(state.customers ?? [], (item) => item.siteId === siteId, [
  {
    id: "cust_aidreamcapes_aria",
    siteId,
    email: `aria@${localDomain}`,
    passwordHash: hashPassword("aria123"),
    name: "Aria Vale",
    status: "active",
    balance: { available: 276, reserved: 24 }
  },
  {
    id: "cust_aidreamcapes_test",
    siteId,
    email: `test@${localDomain}`,
    passwordHash: hashPassword("test123456"),
    name: "Aidreamcapes Test User",
    status: "active",
    balance: { available: 500, reserved: 0 }
  }
]);
state.subscriptions = replaceWhere(state.subscriptions ?? [], (item) => item.siteId === siteId, [
  {
    id: "sub_aidreamcapes_aria",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    productId: "prod_aidreamcapes_pro",
    priceId: "price_aidreamcapes_pro",
    stripeSubscriptionId: "sub_demo_aidreamcapes_voyage_300",
    status: "active",
    currentPeriodEnd: "2026-07-27T00:00:00.000Z",
    creditsPerCycle: 300,
    createdAt: now
  }
]);
state.orders = replaceWhere(state.orders ?? [], (item) => item.siteId === siteId, [
  {
    id: "order_aidreamcapes_voyage_001",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    status: "fulfilled",
    amountCents: 5000,
    currency: "usd",
    credits: 300,
    sourceId: "cs_demo_aidreamcapes_voyage_001",
    createdAt: now
  }
]);
state.jobs = replaceWhere(state.jobs ?? [], (item) => item.siteId === siteId, [
  {
    id: "job_aidreamcapes_1001",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    aiAppId: "ai_image",
    status: "succeeded",
    creditsReserved: 24,
    createdAt: now,
    updatedAt: now,
    requestJson: { style: "destination-travel", outputCount: 20, worker: "n8n.image.aidreamcapes.v1" },
    resultJson: { outputCount: 20, albumId: "album_aidreamcapes_aria_destination" }
  }
]);
state.albums = replaceWhere(state.albums ?? [], (item) => item.siteId === siteId, [
  {
    id: "album_aidreamcapes_aria_destination",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    title: "Destination portrait album",
    sourceJobId: "job_aidreamcapes_1001",
    creativePackId: "pack_aidreamcapes_destination",
    status: "ready",
    outputCount: 20,
    coverAssetId: "asset_aidreamcapes_aria_out_001",
    createdAt: now,
    updatedAt: now
  }
]);
state.assetUploads = replaceWhere(state.assetUploads ?? [], (item) => item.siteId === siteId, [
  {
    id: "asset_aidreamcapes_aria_out_001",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    jobId: "job_aidreamcapes_1001",
    label: "Destination portrait album cover",
    storageKey: "sites/site_aidreamcapes/customers/cust_aidreamcapes_aria/jobs/job_aidreamcapes_1001/out_001.webp",
    mimeType: "image/webp",
    role: "output",
    visibility: "private",
    reviewStatus: "approved",
    createdAt: now
  }
]);
state.ledger = replaceWhere(state.ledger ?? [], (item) => item.siteId === siteId, [
  { id: "led_aidreamcapes_grant", siteId, customerId: "cust_aidreamcapes_aria", amount: 300, type: "grant", sourceType: "subscription", sourceId: "sub_aidreamcapes_aria", createdAt: now },
  { id: "led_aidreamcapes_consume", siteId, customerId: "cust_aidreamcapes_aria", amount: -24, type: "consume", sourceType: "job", sourceId: "job_aidreamcapes_1001", createdAt: now }
]);
state.siteThemes = replaceWhere(state.siteThemes ?? [], (item) => item.siteId === siteId, [draftTheme, activeTheme]);
state.themePublications = replaceWhere(state.themePublications ?? [], (item) => item.siteId === siteId, [
  {
    id: "pub_site_aidreamcapes_v1",
    siteId,
    version: 1,
    snapshot: {
      pages: pages.map((sitePage) => ({ id: sitePage.id, slug: sitePage.slug, publishedJson: clone(sitePage.publishedJson) })),
      themeSettings: clone(settings),
      saasTheme: clone(activeTheme)
    },
    publishedBy: "admin_aidreamcapes_owner",
    publishedAt: now
  }
]);
state.auditLogs = [
  {
    id: "audit_aidreamcapes_demo_seeded",
    siteId,
    actorType: "site_admin",
    actorId: "admin_aidreamcapes_owner",
    action: "aidreamcapes_demo_seeded",
    targetType: "site",
    targetId: siteId,
    createdAt: now,
    metadata: { themeKey, pages: pages.length, productCount: products.length, packCount: creativePacks.length, categoryCount: categories.length }
  },
  ...(state.auditLogs ?? []).filter((item) => item.id !== "audit_aidreamcapes_demo_seeded")
];

async function syncAidreamcapesToDatabase() {
  const prisma = new PrismaClient();
  try {
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { siteId },
          { targetId: siteId },
          { id: "audit_aidreamcapes_demo_seeded" }
        ]
      }
    });
    await prisma.site.deleteMany({ where: { id: siteId } });
    await prisma.siteDomain.deleteMany({ where: { domain: { in: [primaryDomain, apexDomain, localDomain] } } });

    await prisma.site.create({
      data: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        primaryDomain: site.primaryDomain,
        timezone: site.timezone,
        currency: site.currency,
        branding: site.branding
      }
    });

    await prisma.stripeConnectAccount.create({
      data: {
        id: `connect_${siteId}`,
        siteId,
        stripeAccountId: site.connect.stripeAccountId,
        onboardingStatus: site.connect.status,
        chargesEnabled: site.connect.chargesEnabled,
        payoutsEnabled: site.connect.payoutsEnabled
      }
    });

    await prisma.siteDomain.createMany({
      data: state.siteDomains
        .filter((domain) => domain.siteId === siteId)
        .map((domain) => ({
          id: domain.id,
          siteId,
          domain: domain.domain,
          isPrimary: Boolean(domain.isPrimary),
          status: domain.status,
          createdAt: toDate(domain.createdAt)
        }))
    });

    await prisma.siteAdmin.createMany({
      data: state.siteAdmins
        .filter((admin) => admin.siteId === siteId)
        .map((admin) => ({
          id: admin.id,
          siteId,
          email: admin.email,
          passwordHash: admin.passwordHash,
          displayName: admin.displayName,
          role: admin.role,
          createdAt: toDate(admin.createdAt)
        }))
    });

    await prisma.themeSettings.create({
      data: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: site.themeSettings.draftJson,
        publishedJson: site.themeSettings.publishedJson
      }
    });

    await prisma.themePage.createMany({
      data: pages.map((page) => ({
        id: page.id,
        siteId,
        pageType: page.pageType,
        templateKey: page.templateKey,
        slug: page.slug,
        title: page.title,
        draftJson: page.draftJson,
        publishedJson: page.publishedJson
      }))
    });

    for (const product of products) {
      await prisma.product.create({
        data: {
          id: product.id,
          siteId,
          name: product.name,
          type: product.type,
          status: product.status,
          prices: {
            create: product.prices.map((price) => ({
              id: price.id,
              siteId,
              label: price.label,
              amountCents: price.amountCents,
              currency: price.currency,
              interval: price.interval,
              creditsGranted: price.creditsGranted,
              stripePriceId: price.stripePriceId,
              metadata: price.metadata
            }))
          }
        }
      });
    }

    await prisma.creativePackCategory.createMany({
      data: categories.map((category) => ({
        id: category.id,
        siteId,
        parentId: category.parentId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        heroTitle: category.heroTitle,
        heroSubtitle: category.heroSubtitle,
        icon: category.icon,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        status: category.status,
        createdAt: toDate(category.createdAt)
      }))
    });

    await prisma.creativePack.createMany({
      data: creativePacks.map((pack) => ({
        id: pack.id,
        siteId,
        categoryId: pack.categoryId,
        name: pack.name,
        headline: pack.headline,
        description: pack.description,
        prompt: pack.prompt,
        category: pack.category,
        aiAppSlug: pack.aiAppSlug,
        status: pack.status,
        creditCost: pack.creditCost,
        outputCount: pack.outputCount,
        trainingRequired: pack.trainingRequired,
        generationCount: pack.generationCount,
        conversionRate: pack.conversionRate,
        imageUrl: pack.imageUrl,
        galleryImages: pack.galleryImages,
        createdAt: toDate(pack.createdAt)
      }))
    });

    await prisma.toolCategory.createMany({
      data: toolCategories.map((category) => ({
        id: category.id,
        siteId,
        slug: category.slug,
        label: category.label,
        description: category.description,
        icon: category.icon,
        sortOrder: category.sortOrder,
        status: category.status,
        createdAt: toDate(category.createdAt)
      }))
    });

    await prisma.toolMenuItem.createMany({
      data: toolMenuItems.map((item) => ({
        id: item.id,
        siteId,
        categoryId: item.categoryId,
        slug: item.slug,
        title: item.title,
        description: item.description,
        badge: item.badge,
        icon: item.icon,
        imageUrl: item.imageUrl,
        href: item.href,
        detailJson: item.detailJson,
        sortOrder: item.sortOrder,
        status: item.status,
        createdAt: toDate(item.createdAt)
      }))
    });

    await prisma.mediaAsset.createMany({
      data: mediaAssets.map((asset) => ({
        id: asset.id,
        siteId,
        label: asset.label,
        storageKey: asset.storageKey,
        mimeType: asset.mimeType,
        usageType: asset.usageType,
        sourceType: asset.sourceType,
        previewUrl: asset.previewUrl,
        originUrl: asset.originUrl,
        altText: asset.altText,
        createdAt: toDate(asset.createdAt)
      }))
    });

    const aiAppId = baseImageApp.id;
    await prisma.aiApp.upsert({
      where: { id: aiAppId },
      create: {
        id: aiAppId,
        slug: baseImageApp.slug,
        name: baseImageApp.name,
        description: baseImageApp.description,
        appType: baseImageApp.appType,
        parameterSchema: baseImageApp.parameterSchema ?? []
      },
      update: {}
    });

    await prisma.siteAiApp.create({
      data: {
        id: "sai_aidreamcapes_image",
        siteId,
        aiAppId,
        enabled: true,
        creditCost: 24,
        routeKey: "n8n.image.aidreamcapes.v1"
      }
    });

    await prisma.aiGatewayGroup.createMany({
      data: state.aiGatewayGroups
        .filter((group) => group.siteId === siteId)
        .map((group) => ({
          id: group.id,
          siteId,
          name: group.name,
          status: group.status,
          modelAllowlist: group.modelAllowlist,
          monthlyQuota: group.monthlyQuota,
          usedQuota: group.usedQuota,
          retryStatusCodes: group.retryStatusCodes,
          rateLimitPerMinute: group.rateLimitPerMinute,
          accountPoolMode: group.accountPoolMode
        }))
    });

    for (const customer of state.customers.filter((item) => item.siteId === siteId)) {
      await prisma.customer.create({
        data: {
          id: customer.id,
          siteId,
          email: customer.email,
          passwordHash: customer.passwordHash,
          name: customer.name,
          status: customer.status,
          createdAt: toDate(customer.createdAt),
          balance: {
            create: {
              id: `balance_${customer.id}`,
              siteId,
              balance: customer.balance.available,
              reserved: customer.balance.reserved
            }
          }
        }
      });
    }

    await prisma.subscription.createMany({
      data: state.subscriptions
        .filter((subscription) => subscription.siteId === siteId)
        .map((subscription) => ({
          id: subscription.id,
          siteId,
          customerId: subscription.customerId,
          productId: subscription.productId,
          priceId: subscription.priceId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          status: subscription.status,
          currentPeriodStart: toDate(subscription.currentPeriodStart ?? subscription.createdAt),
          currentPeriodEnd: toDate(subscription.currentPeriodEnd),
          creditsPerCycle: subscription.creditsPerCycle,
          createdAt: toDate(subscription.createdAt)
        }))
    });

    await prisma.order.createMany({
      data: state.orders
        .filter((order) => order.siteId === siteId)
        .map((order) => ({
          id: order.id,
          siteId,
          customerId: order.customerId,
          status: order.status,
          amountCents: order.amountCents,
          currency: order.currency,
          credits: order.credits,
          sourceId: order.sourceId,
          createdAt: toDate(order.createdAt)
        }))
    });

    await prisma.generationJob.createMany({
      data: state.jobs
        .filter((job) => job.siteId === siteId)
        .map((job) => ({
          id: job.id,
          siteId,
          customerId: job.customerId,
          aiAppId: job.aiAppId,
          status: job.status,
          creditsReserved: job.creditsReserved,
          requestJson: job.requestJson,
          resultJson: job.resultJson,
          createdAt: toDate(job.createdAt),
          updatedAt: toDate(job.updatedAt)
        }))
    });

    await prisma.assetUpload.createMany({
      data: state.assetUploads
        .filter((asset) => asset.siteId === siteId)
        .map((asset) => ({
          id: asset.id,
          siteId,
          customerId: asset.customerId,
          jobId: asset.jobId,
          label: asset.label,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType,
          role: asset.role,
          visibility: asset.visibility,
          reviewStatus: asset.reviewStatus,
          createdAt: toDate(asset.createdAt)
        }))
    });

    await prisma.album.createMany({
      data: state.albums
        .filter((album) => album.siteId === siteId)
        .map((album) => ({
          id: album.id,
          siteId,
          customerId: album.customerId,
          title: album.title,
          sourceJobId: album.sourceJobId,
          creativePackId: album.creativePackId,
          status: album.status,
          outputCount: album.outputCount,
          coverAssetId: album.coverAssetId,
          createdAt: toDate(album.createdAt),
          updatedAt: toDate(album.updatedAt)
        }))
    });

    await prisma.creditLedger.createMany({
      data: state.ledger
        .filter((entry) => entry.siteId === siteId)
        .map((entry) => ({
          id: entry.id,
          siteId,
          customerId: entry.customerId,
          amount: entry.amount,
          type: entry.type,
          sourceType: entry.sourceType,
          sourceId: entry.sourceId,
          createdAt: toDate(entry.createdAt)
        }))
    });

    await prisma.siteTheme.createMany({
      data: [draftTheme, activeTheme].map((theme) => ({
        id: theme.id,
        siteId,
        name: theme.name,
        themeId: theme.themeId,
        themeKey: theme.themeKey,
        status: theme.status,
        templates: theme.templates,
        settings: theme.settings,
        source: theme.source,
        createdBy: theme.createdBy,
        createdAt: toDate(theme.createdAt),
        updatedAt: toDate(theme.updatedAt)
      }))
    });

    await prisma.themePublication.createMany({
      data: state.themePublications
        .filter((publication) => publication.siteId === siteId)
        .map((publication) => ({
          id: publication.id,
          siteId,
          version: publication.version,
          snapshot: publication.snapshot,
          pageCount: pages.length,
          publishedBy: publication.publishedBy,
          publishedAt: toDate(publication.publishedAt)
        }))
    });

    await prisma.auditLog.createMany({
      data: state.auditLogs
        .filter((log) => log.siteId === siteId)
        .map((log) => ({
          id: log.id,
          siteId,
          actorType: log.actorType,
          actorId: log.actorId,
          action: log.action,
          targetType: log.targetType,
          targetId: log.targetId,
          metadata: log.metadata,
          createdAt: toDate(log.createdAt)
        }))
    });
  } finally {
    await prisma.$disconnect();
  }
}

await fs.writeFile(dataPath, `${JSON.stringify(state, null, 2)}\n`);
console.log(`Seeded ${siteId} with ${pages.length} pages, ${products.length} products, ${categories.length} categories, and ${creativePacks.length} creative packs.`);

if (!process.argv.includes("--skip-db-import")) {
  await syncAidreamcapesToDatabase();
  console.log(`Synced ${siteId} to relational database.`);
}
