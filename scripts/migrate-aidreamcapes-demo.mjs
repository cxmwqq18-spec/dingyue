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
const visualSiteTitle = "ልiጋreamርapes";
const aidreamcapesImageBase = "/assets/sites/site_aidreamcapes/creative-packs";
const aidreamcapesPackImages = {
  dreamscape: `${aidreamcapesImageBase}/dreamscape-portraits.png`,
  coastal: `${aidreamcapesImageBase}/coastal-escapes.png`,
  avatar: `${aidreamcapesImageBase}/fantasy-avatars.png`,
  couple: `${aidreamcapesImageBase}/golden-hour-couples.png`,
  headshot: `${aidreamcapesImageBase}/storybook-headshots.png`,
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
    { from: "/assets/aidreamcapes/", to: "/assets/dreamshoot/" },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/stadium-portrait.png", to: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-travel.png" },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/fan-poster.png", to: "/assets/dreamshoot/holiday-card-gpt2.png" },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/friend-fan-photos.png", to: "/assets/dreamshoot/frames/sample-engagement.png" },
    { from: "/assets/dreamshoot/generated/20260621-worldcup-pack/banner-cover.png", to: "/assets/dreamshoot/generated/20260619/nature-adventure-solo-v1.png" },
    { from: "/assets/dreamshoot/generated/20260619/cyberpunk-solo-city-v1.png", to: "/assets/dreamshoot/generated/20260622-homepage-unique/proof-cinematic-worlds.png" },
    { from: "/assets/dreamshoot/generated/20260619/mafia-noir-single-v1.png", to: "/assets/dreamshoot/frames/story-beauty-portrait.png" },
    { from: "/assets/dreamshoot/generated/20260619/storybook-storybook shadow-single-v1.png", to: "/assets/dreamshoot/frames/story-beauty-portrait.png" },
    { from: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-storybook shadow.png", to: "/assets/dreamshoot/frames/story-beauty-portrait.png" },
    { from: "/assets/dreamshoot/generated/20260619/editorial getaway-solo-city-v1.png", to: "/assets/dreamshoot/editorial-headshot-gpt2.png" },
    { from: "/assets/dreamshoot/frames/sample-cyberpunk.png", to: "/assets/dreamshoot/frames/story-beauty-portrait.png" },
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
  ["AI photo packages", "AI dreamscape portraits"],
  ["photo packages", "dreamscape packages"],
  ["Photo packages", "Dreamscape packages"],
  ["private AI photo workspace", "private cinematic escape workspace"],
  ["private photo workspace", "private escape portrait workspace"],
  ["AI photo workspace", "AI dreamscape workspace"]
].map(([from, to]) => ({ from, to })).sort((left, right) => right.from.length - left.from.length);

brandReplacements.push(
  { from: "MydreamShoots header", to: "Aidreamcapes header" },
  { from: "MydreamShoots footer", to: "Aidreamcapes footer" }
);
brandReplacements.sort((left, right) => right.from.length - left.from.length);

const aidreamcapesLegacyReplacements = [
  ["/tools/world-cup-fan-photos", "/tools/coastal-portrait"],
  ["/tools/cyberpunk-portrait", "/tools/editorial-getaway"],
  ["/tools/background-changer", "/tools/dreamscape-generator"],
  ["/tools/background-remover", "/tools/dreamscape-generator"],
  ["/tools/gala-photo", "/tools/soft-glam"],
  ["/tools/noir-portrait", "/tools/storybook-headshot"],
  ["/tools/headshot", "/tools/storybook-headshot"],
  ["/tools/nature-adventure", "/tools/cinematic-travel"],
  ["/tools/virtual-try-on", "/tools/soft-glam"],
  ["/tools/image-to-video", "/tools/dreamscape-generator"],
  ["/collections/sports", "/collections/coastal-escapes"],
  ["/collections/headshots", "/collections/storybook-headshots"],
  ["/collections/beauty", "/collections/soft-glam-studio"],
  ["/collections/creative", "/collections/dreamscape-portraits"],
  ["/collections/travel", "/collections/cinematic-travel"],
  ["World Cup fan photos", "Coastal escape portraits"],
  ["World Cup Fan Photos", "Coastal Escape Portraits"],
  ["World Cup Pack", "Coastal Escape Pack"],
  ["World Cup", "Coastal Escape"],
  ["football fan photos", "coastal escape portraits"],
  ["fan photos", "coastal portraits"],
  ["fan set", "coastal set"],
  ["Fan posters|Large portrait graphics for match day|Stadium portraits|Cinematic scenes with floodlights|Match-day avatars|Profile-ready square crops|Social banners|Wide cover images for sharing", "Dreamscape portraits|Cinematic escape scenes|Coastal profile crops|Fantasy avatar squares|Golden hour couple images|Editorial travel crops|Soft product reverie frames|Social keepsake cards"],
  ["Safe styling: no real player likenesses, official team logos, or protected marks required.", "Private styling: no public gallery is created unless the customer chooses to share finished images."],
  ["Match-day looks without a studio.", "Dreamlike escape portraits without a destination shoot."],
  ["Seasonal packs rotate around tournaments, holidays, and high-intent photo moments.", "Dreamscape packages rotate around travel moods, fantasy scenes, romantic keepsakes, and creator launch moments."],
  ["Match-day Lenatar", "Fantasy Avatar"],
  ["fan poster|avatar|stadium|social-ready", "dreamscape|coastal|fantasy|gallery-ready"],
  ["Next: Valentine / Graduation Season", "Next: Coastal Reverie / Storybook Season"],
  ["How it works + proof bridge", "Dreamscape workflow bridge"],
  ["Choose a plan for your photo set", "Choose credits for your dreamscape set"],
  ["Realistic customer stories for AI photo package buyers", "Private gallery stories from dreamscape customers"],
  ["A visual catalogue with clear package intent.", "A visual catalog for escape moods and private gallery outcomes."],
  ["Recent generation status", "Recent dreamscape status"],
  ["Track every generation request from queue to delivery.", "Track every Aidreamcapes request from mood selection to private gallery delivery."],
  ["Current generation status", "Current dreamscape status"],
  ["Delivered images stay inside a customer-only album.", "Delivered dreamscape portraits stay inside a customer-only album."],
  ["This page is not available.", "This Aidreamcapes page is not available."],
  ["AI Image Studio - Generate Headshots and Portrait Scene Packs", "Aidreamcapes Dreamscape Generator - cinematic escape portraits"],
  ["AI Image Studio", "Dreamscape Studio"],
  ["AI Photo Job Progress - Track Generation and Delivery", "Aidreamcapes Job Progress - track dreamscape delivery"],
  ["AI Photo Job Detail - Review Outputs and Credit Activity", "Aidreamcapes Job Detail - review private gallery outputs"],
  ["Page Not Found - Return to Aidreamcapes AI Photo Packages", "Page Not Found - return to Aidreamcapes dreamscape packages"],
  ["Cyberpunk portrait maker", "Editorial getaway builder"],
  ["Cyberpunk", "Editorial Getaway"],
  ["cyberpunk", "editorial getaway"],
  ["Background changer", "Dreamscape mood planner"],
  ["background changer", "dreamscape mood planner"],
  ["background edits", "mood references"],
  ["Mafia", "Storybook"],
  ["mafia", "storybook"],
  ["Noir", "Storybook Shadow"],
  ["noir", "storybook shadow"],
  ["Gala photo maker", "Soft glam portrait tool"],
  ["gala scenes", "soft glam scenes"],
  ["gala looks", "soft glam looks"],
  ["gala", "soft glam"],
  ["Free AI tools", "Aidreamcapes planning tools"],
  ["free tools", "planning tools"],
  ["free enhancer", "source-photo planner"],
  ["AI headshots", "storybook portraits"],
  ["headshots, sports, beauty, creator, travel, or cinematic portrait pack", "dreamscape, coastal, fantasy, editorial, product, social, or cinematic travel pack"],
  ["headshots, Coastal escape portraits, creator portraits, dreamscape mood planner tools", "dreamscape portraits, coastal escapes, fantasy avatars, storybook portraits, and product reverie tools"],
  ["headshots to football fan photos", "dreamscape portraits to coastal escapes"],
  ["headshots to AI photos", "dreamscape portraits to fantasy avatars"],
  ["headshots, creator portraits", "storybook portraits, fantasy avatars"],
  ["creator portraits", "cinematic keepsakes"],
  ["AI motion ideas", "dreamscape planning ideas"],
  ["virtual try-on previews", "soft glam previews"]
].map(([from, to]) => ({ from, to })).sort((left, right) => right.from.length - left.from.length);

const aidreamcapesFinalPolishReplacements = [
  ["Lenatars", "Avatars"],
  ["Lenatar", "Avatar"],
  ["Create realistic AI photo packages from everyday uploads.", "Create cinematic dreamscape portraits from everyday uploads."],
  ["Gala, editorial getaway, travel, beauty, and profile packs.", "Editorial getaways, coastal scenes, soft glam, product reveries, and social keepsakes."],
  ["Magic upscaler, AI video concepts, and style preview flows.", "Mood planning, private galleries, credit tracking, and downloadable portraits."]
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
    title: "Aidreamcapes - AI dreamscape portraits from everyday uploads",
    description: "Create cinematic escape portraits, fantasy travel scenes, soft glam albums, and private dreamscape galleries with Aidreamcapes.",
    keywords: "Aidreamcapes, AI dreamscape portraits, cinematic travel photos, fantasy portrait generator",
    canonicalPath: "/",
    index: true,
    follow: true
  },
  pricing: {
    title: "Aidreamcapes Pricing - credits for cinematic escape portraits",
    description: "Compare Aidreamcapes plans, monthly credits, one-time top-ups, private uploads, and dreamscape gallery delivery before creating a portrait request.",
    keywords: "Aidreamcapes pricing, AI portrait credits, cinematic portrait subscription, dreamscape photo plans",
    canonicalPath: "/pricing",
    index: true,
    follow: true
  },
  collections: {
    title: "Aidreamcapes Dreamscape Packages - cinematic portrait themes",
    description: "Browse Aidreamcapes dreamscape packages for coastal escapes, fantasy avatars, golden hour couples, editorial getaways, and social keepsakes.",
    keywords: "Aidreamcapes packages, AI dreamscape categories, cinematic portrait themes, fantasy travel photos",
    canonicalPath: "/collections",
    index: true,
    follow: true
  },
  tools: {
    title: "Aidreamcapes AI Tools - dreamscape portraits and soft travel edits",
    description: "Explore Aidreamcapes AI tools for dreamscape portraits, coastal scenes, fantasy avatars, storybook headshots, editorial getaways, and product reveries.",
    keywords: "Aidreamcapes tools, AI dreamscape generator, fantasy avatar tool, coastal portrait AI",
    canonicalPath: "/tools",
    index: true,
    follow: true
  },
  help: {
    title: "Aidreamcapes Help - uploads, credits, dreamscape delivery",
    description: "Get Aidreamcapes help for source photo prep, dreamscape package selection, credit use, private gallery delivery, refunds, and account privacy.",
    keywords: "Aidreamcapes help, dreamscape portrait upload guide, AI portrait credits, private gallery support",
    canonicalPath: "/help",
    index: true,
    follow: true
  },
  blog: {
    title: "Aidreamcapes Guides - dreamscape portrait planning and source photos",
    description: "Read Aidreamcapes guides for cinematic escape portraits, fantasy avatar planning, coastal portrait source photos, credit usage, and private gallery delivery.",
    keywords: "Aidreamcapes guides, dreamscape portrait tips, fantasy avatar guide, cinematic travel photo planning",
    canonicalPath: "/blog",
    index: true,
    follow: true
  },
  blogDreamscape: {
    title: "How to plan source photos for cinematic dreamscape portraits",
    description: "Learn how to choose source photos, outfit notes, and mood references for Aidreamcapes dreamscape portraits, coastal escapes, fantasy avatars, and private galleries.",
    keywords: "dreamscape portrait source photos, Aidreamcapes source photo guide, fantasy travel portrait tips",
    canonicalPath: "/blog/planning-dreamscape-source-photos",
    index: true,
    follow: true
  },
  search: {
    title: "Search Aidreamcapes - dreamscape tools, packages, guides, and policies",
    description: "Search Aidreamcapes for dreamscape portrait tools, coastal escape packages, fantasy avatars, pricing, upload help, privacy, refunds, and private gallery guidance.",
    keywords: "Aidreamcapes search, dreamscape portrait tools, fantasy avatar packages, coastal escape photos",
    canonicalPath: "/search",
    index: true,
    follow: true
  },
  about: {
    title: "About Aidreamcapes - private AI dreamscape portraits and galleries",
    description: "Learn about Aidreamcapes, a private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery.",
    keywords: "About Aidreamcapes, AI dreamscape portraits, private AI portrait gallery, fantasy travel photos, cinematic portrait workspace",
    canonicalPath: "/about-us",
    index: true,
    follow: true
  },
  contact: {
    title: "Contact Aidreamcapes - support, sales, and company address",
    description: "Contact Aidreamcapes for dreamscape portrait support, source photo guidance, sales questions, billing review, privacy requests, or company address information.",
    keywords: "Contact Aidreamcapes, Aidreamcapes support, AI dreamscape support, Aidreamcapes sales, private gallery help",
    canonicalPath: "/contact-us",
    index: true,
    follow: true
  },
  privacy: {
    title: "Aidreamcapes Privacy Policy - private uploads and gallery data",
    description: "Learn how Aidreamcapes handles customer accounts, source photos, dreamscape requests, credits, payment status, private galleries, and deletion requests.",
    keywords: "Aidreamcapes privacy, AI portrait upload privacy, private dreamscape gallery data",
    canonicalPath: "/privacy",
    index: true,
    follow: true
  },
  refunds: {
    title: "Aidreamcapes Refund Policy - credits, failed jobs, and support review",
    description: "Review Aidreamcapes refund rules for unused credits, failed dreamscape generation jobs, subscriptions, technical failures, and customer support review.",
    keywords: "Aidreamcapes refunds, AI portrait credits refund, failed generation credit return",
    canonicalPath: "/refunds",
    index: true,
    follow: true
  },
  shipping: {
    title: "Aidreamcapes Shipping and Digital Delivery Policy",
    description: "Review how Aidreamcapes delivers AI dreamscape portrait credits, generated images, downloads, and private galleries digitally without physical shipping.",
    keywords: "Aidreamcapes shipping policy, Aidreamcapes digital delivery, AI portrait delivery, private gallery delivery",
    canonicalPath: "/shipping",
    index: true,
    follow: true
  },
  terms: {
    title: "Aidreamcapes Terms of Service - accounts, credits, and generated portraits",
    description: "Read Aidreamcapes terms for customer accounts, source photo rights, AI dreamscape credits, private gallery delivery, acceptable use, and support contact.",
    keywords: "Aidreamcapes terms, AI dreamscape portrait terms, source photo rights, generated portrait policy",
    canonicalPath: "/terms",
    index: true,
    follow: true
  },
  content: {
    title: "Aidreamcapes Content Policy - safe source photos and portrait requests",
    description: "Understand Aidreamcapes rules for allowed uploads, disallowed requests, impersonation, moderation, generated image review, and responsible use.",
    keywords: "Aidreamcapes content policy, AI portrait moderation, safe source photo uploads",
    canonicalPath: "/content",
    index: true,
    follow: true
  },
  cookies: {
    title: "Aidreamcapes Cookie Policy - sign-in, checkout, and site preferences",
    description: "Learn how Aidreamcapes uses essential cookies and local storage for sign-in, checkout continuity, cart state, account preferences, and site reliability.",
    keywords: "Aidreamcapes cookie policy, AI portrait site cookies, checkout continuity storage",
    canonicalPath: "/cookies",
    index: true,
    follow: true
  },
  login: {
    title: "Sign in to Aidreamcapes - private escape portrait workspace",
    description: "Sign in to Aidreamcapes to manage private uploads, credits, dreamscape requests, generated galleries, and downloadable cinematic portraits.",
    keywords: "Aidreamcapes login, private AI portrait workspace, dreamscape gallery sign in",
    canonicalPath: "/login",
    index: false,
    follow: true
  }
};

const aidreamcapesTools = [
  ["tool_dreamscape", "Dreamscape Generator", "Turn everyday portraits into cinematic imagined places with soft light, story-led atmosphere, and private gallery delivery.", "Dreamscape", "Core", aidreamcapesPackImages.dreamscape, "/tools/dreamscape-generator"],
  ["tool_coastal", "Coastal Portrait Composer", "Create beach, island, resort, and cliffside portraits with warm travel light and relaxed escape energy.", "Escape", "Coastal", aidreamcapesPackImages.coastal, "/tools/coastal-portrait"],
  ["tool_avatar", "Fantasy Avatar Studio", "Build storybook avatars, ethereal profile crops, and soft fictional identity art from private uploads.", "Avatar", "Fantasy", aidreamcapesPackImages.avatar, "/tools/fantasy-avatar"],
  ["tool_couple", "Golden Hour Couple Maker", "Create romantic sunset, garden, city, and coastal couple scenes for gifts, announcements, and private albums.", "Couples", "Romance", aidreamcapesPackImages.couple, "/tools/golden-hour-couple"],
  ["tool_storybook", "Storybook Headshot Maker", "Make warm professional portraits for authors, creators, coaches, founders, and profile pages.", "Profile", "Warm", aidreamcapesPackImages.headshot, "/tools/storybook-headshot"],
  ["tool_editorial", "Editorial Getaway Builder", "Shape magazine-style travel portraits with fashion-led settings, elegant crops, and cinematic polish.", "Editorial", "Travel", aidreamcapesPackImages.editorial, "/tools/editorial-getaway"],
  ["tool_glam", "Soft Glam Portrait Tool", "Create cream-light beauty portraits, gentle makeup moods, and polished profile-ready crops.", "Beauty", "Glam", aidreamcapesPackImages.glam, "/tools/soft-glam"],
  ["tool_travel", "Cinematic Travel Scene Tool", "Explore old cities, coast roads, gardens, cafes, and scenic overlooks as private portrait scenes.", "Travel", "Scene", aidreamcapesPackImages.travel, "/tools/cinematic-travel"],
  ["tool_product", "Product Reverie Tool", "Place small products into dreamy lifestyle scenes for creator launches, moodboards, and soft social visuals.", "Product", "Reverie", aidreamcapesPackImages.product, "/tools/product-reverie"],
  ["tool_social", "Social Keepsake Maker", "Create dreamy announcement cards, memory posts, profile banners, and private gift visuals.", "Keepsake", "Social", aidreamcapesPackImages.social, "/tools/social-keepsake"]
].map(([id, title, description, category, badge, imageUrl, href]) => ({
  id,
  type: "tool_card",
  settings: { title, description, category, badge, imageUrl, href }
}));

const aidreamcapesTaxonomyBlocks = [
  ["taxonomy_dreamscape", "Dreamscape Portraits", "Misty terraces, moon gardens, painterly rooms, and cinematic escape portraits.", "Core", "dreamscape|cinematic|escape", aidreamcapesPackImages.dreamscape, "/collections/dreamscape-portraits"],
  ["taxonomy_coastal", "Coastal Escapes", "Beach, island, resort, and cliffside portraits with warm travel light.", "Coastal", "beach|island|resort", aidreamcapesPackImages.coastal, "/collections/coastal-escapes"],
  ["taxonomy_avatar", "Fantasy Avatars", "Storybook avatars, ethereal profile art, and fictional identity crops.", "Fantasy", "avatar|storybook|profile", aidreamcapesPackImages.avatar, "/collections/fantasy-avatars"],
  ["taxonomy_couple", "Golden Hour Couples", "Romantic sunset, garden, city, and seaside couple albums.", "Couples", "romantic|sunset|gift", aidreamcapesPackImages.couple, "/collections/golden-hour-couples"],
  ["taxonomy_editorial", "Editorial Getaways", "Magazine-style travel portraits with fashion-led locations and cinematic crops.", "Editorial", "fashion|travel|campaign", aidreamcapesPackImages.editorial, "/collections/editorial-getaways"],
  ["taxonomy_product", "Product Reverie", "Dreamy lifestyle concepts for small products, creator launches, and visual moodboards.", "Product", "product|moodboard|launch", aidreamcapesPackImages.product, "/collections/product-reverie"],
  ["taxonomy_social", "Social Keepsakes", "Announcement cards, memory posts, and soft private keepsake visuals.", "Keepsake", "social|cards|memory", aidreamcapesPackImages.social, "/collections/social-keepsakes"]
].map(([id, title, description, meta, keywords, imageUrl, href]) => ({
  id,
  type: "taxonomy_card",
  settings: { title, description, meta, keywords, imageUrl, href }
}));

const aidreamcapesFeatureTabs = [
  ["tab_dreamscape", "Dreamscape packages", "Choose a complete escape mood", "Start from Aidreamcapes packages such as coastal escapes, fantasy avatars, golden hour couples, editorial getaways, soft glam, and product reverie.", aidreamcapesPackImages.dreamscape, "/collections"],
  ["tab_source", "Source photo planning", "Guide the scene before generation", "Use clear portraits, outfit notes, and atmosphere references so each private gallery feels intentional.", "/assets/dreamshoot/frames/faq-intro-portrait.png", "/blog/planning-dreamscape-source-photos"],
  ["tab_gallery", "Private galleries", "Review finished portraits in one place", "Credits, jobs, albums, and downloads remain connected to the signed-in Aidreamcapes account.", aidreamcapesPackImages.social, "/app"]
].map(([id, label, title, description, imageUrl, href]) => ({
  id,
  type: "feature_tab",
  settings: { label, title, description, imageUrl, href }
}));

const aidreamcapesFlowBlocks = [
  ["pkg_path_upload", "Upload", "Add clear portraits, outfit notes, and atmosphere references to your private Aidreamcapes workspace.", "Step 01", "/assets/dreamshoot/frames/faq-intro-portrait.png"],
  ["pkg_path_mood", "Choose a mood", "Pick a dreamscape, coastal, fantasy, couple, editorial, glam, travel, product, or keepsake direction.", "Step 02", aidreamcapesPackImages.dreamscape],
  ["pkg_path_generate", "Generate", "Spend credits only after the request is clear, with the cost shown before the private job starts.", "Step 03", aidreamcapesPackImages.avatar],
  ["pkg_path_deliver", "Download", "Finished escape portraits return to the private album and stay tied to the customer account.", "Step 04", aidreamcapesPackImages.social]
].map(([id, title, text, meta, imageUrl]) => ({
  id,
  type: "card",
  settings: { title, text, meta, imageUrl }
}));

const aidreamcapesSampleBlocks = [
  ["sample_dreamscape", "Dreamscape", aidreamcapesPackImages.dreamscape, "Cinematic escape"],
  ["sample_coastal", "Coastal", aidreamcapesPackImages.coastal, "Warm seaside"],
  ["sample_avatar", "Fantasy avatar", aidreamcapesPackImages.avatar, "Storybook profile"],
  ["sample_couple", "Golden hour", aidreamcapesPackImages.couple, "Romantic keepsake"],
  ["sample_editorial", "Editorial", aidreamcapesPackImages.editorial, "Travel campaign"],
  ["sample_glam", "Soft glam", aidreamcapesPackImages.glam, "Cream-light beauty"]
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
  ["plan_rule_mood", "creative direction", "Choose a dreamscape path", "Use Aidreamcapes categories so the request has a focused atmosphere instead of a generic prompt."],
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
    badge: ["Escape", "Coastal", "Fantasy", "Romance", "Editorial"][index] ?? "Dreamscape",
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
  ["faq_source", "Which source photos work best for Aidreamcapes?", "Use recent, clear portraits with natural expressions, varied angles, and minimal filters. Add outfit or mood references when the package needs a specific escape feeling."],
  ["faq_package", "How should I choose a dreamscape package?", "Start with the final use: Dreamscape Portraits for atmosphere, Coastal Escapes for travel warmth, Fantasy Avatars for profile art, Storybook Headshots for warm professional pages, and Product Reverie for soft campaign concepts."],
  ["faq_private", "Are Aidreamcapes uploads and galleries private?", "Yes. Source photos, generation jobs, albums, credit records, and downloads stay connected to the signed-in customer account."],
  ["faq_credits", "When are credits spent?", "Credits are visible before a request starts. A job reserves the needed credits first, successful results consume them, and failed requests can release them."],
  ["faq_delivery", "Where do finished portraits arrive?", "Finished dreamscape portraits return to the private account gallery so customers can compare crops, download favorites, and decide what to share."],
  ["faq_refund", "Can unused credits be reviewed?", "Unused purchased credits can be reviewed under the refund policy. Credits spent on successful generation jobs are generally not refundable."],
  ["faq_cancel", "What remains after a plan is canceled?", "Customers can keep access to existing private albums according to the site's account rules, while new premium requests may require an active plan or available credits."]
].map(([id, question, answer]) => ({
  id,
  type: "faq_item",
  settings: { question, answer }
}));

const aidreamcapesTestimonialBlocks = [
  ["proof_aria", "Aidreamcapes helped me turn ordinary portraits into a soft coastal gallery without planning a trip.", "Aria Vale", "Creator"],
  ["proof_rowan", "The dreamscape package gave my author bio photos a warmer world than a standard studio headshot.", "Rowan Ellis", "Author"],
  ["proof_lena", "I used Product Reverie for launch moodboards, then kept the best concepts in my private gallery.", "Lena Park", "Founder"],
  ["proof_mira", "The source-photo guide made the final fantasy avatar set feel cohesive instead of random.", "Mira Sol", "Designer"]
].map(([id, quote, name, role]) => ({
  id,
  type: "testimonial",
  settings: { quote, name, role, avatarUrl: "/assets/dreamshoot/frames/story-beauty-portrait.png" }
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
  globalSections.header.settings.logoAlt = "Aidreamcapes heart logo for cinematic dreamscape portraits and private galleries";
  globalSections.header.settings.style = "light_commerce";
  globalSections.header.settings.title = visualSiteTitle;
  globalSections.header.settings.announcement = "Create cinematic AI dreamscape portraits from everyday uploads.";
  globalSections.header.blocks = [
    { id: "aidreamcapes_header_collections", type: "menu_link", settings: { label: "Dreamscape Packages", href: "/collections" } },
    { id: "aidreamcapes_header_tools", type: "menu_link", settings: { label: "Tools", href: "/tools" } },
    { id: "aidreamcapes_header_how", type: "menu_link", settings: { label: "How it works", href: "#workflow" } },
    { id: "aidreamcapes_header_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing" } },
    { id: "aidreamcapes_header_help", type: "menu_link", settings: { label: "Help", href: "/help" } },
    ...clone(aidreamcapesTools),
    ...clone(aidreamcapesTaxonomyBlocks.slice(0, 6))
  ];
  globalSections.footer.settings.title = visualSiteTitle;
  globalSections.footer.settings.tagline = "Cinematic dreamscape portraits from everyday uploads.";
  globalSections.footer.settings.body = "Aidreamcapes helps customers plan source photos, choose a dreamscape package, generate private escape portraits, and download gallery-ready results from one account.";
  globalSections.footer.settings.bottomLine = "Private uploads, visible credits, and customer-only galleries.";
  globalSections.footer.settings.contactAddress = companyAddress;
  globalSections.footer.settings.contactEmail = supportEmail;
  globalSections.footer.settings.salesEmail = salesEmail;
  globalSections.footer.settings.copyright = "© 2026 Aidreamcapes. All rights reserved.";
  globalSections.footer.blocks = [
    { id: "aidreamcapes_footer_collections", type: "menu_link", settings: { label: "Dreamscape Packages", href: "/collections", group: "product" } },
    { id: "aidreamcapes_footer_tools", type: "menu_link", settings: { label: "Dreamscape Generator", href: "/tools/dreamscape-generator", group: "product" } },
    { id: "aidreamcapes_footer_pricing", type: "menu_link", settings: { label: "Pricing", href: "/pricing", group: "product" } },
    { id: "aidreamcapes_footer_guides", type: "menu_link", settings: { label: "Guides", href: "/blog", group: "company" } },
    { id: "aidreamcapes_footer_about", type: "menu_link", settings: { label: "About us", href: "/about-us", group: "company" } },
    { id: "aidreamcapes_footer_contact", type: "menu_link", settings: { label: "Contact us", href: "/contact-us", group: "company" } },
    { id: "aidreamcapes_footer_help", type: "menu_link", settings: { label: "Help Center", href: "/help", group: "support" } },
    { id: "aidreamcapes_footer_privacy", type: "menu_link", settings: { label: "Privacy Policy", href: "/privacy", group: "support" } },
    { id: "aidreamcapes_footer_refunds", type: "menu_link", settings: { label: "Refunds", href: "/refunds", group: "support" } },
    { id: "aidreamcapes_footer_shipping", type: "menu_link", settings: { label: "Shipping & Delivery", href: "/shipping", group: "support" } },
    { id: "aidreamcapes_footer_terms", type: "menu_link", settings: { label: "Terms of Service", href: "/terms", group: "support" } },
    { id: "aidreamcapes_footer_content", type: "menu_link", settings: { label: "Content Policy", href: "/content", group: "support" } },
    { id: "aidreamcapes_footer_cookies", type: "menu_link", settings: { label: "Cookie Policy", href: "/cookies", group: "support" } }
  ];
  const seo = source.seo ?? {};
  const saasSettingsCurrent = scrubAidreamcapesText(clone(source.saasSettingsCurrent ?? {}));
  Object.assign(saasSettingsCurrent, {
    skin_bg: "#FBF3E4",
    skin_title_color: "#1E1712",
    skin_text_color: "#6F6257",
    skin_primary_btn_bg_color: "#1E1712",
    skin_primary_btn_text_color: "#FFF8ED",
    skin_secondary_btn_bg_color: "#FFF8ED",
    skin_secondary_btn_text_color: "#1E1712",
    skin_accent_color: "#D88A4B",
    skin_price_color: "#B86E36",
    skin_muted_color: "#FFF8ED"
  });
  if (saasSettingsCurrent.sections?.header_plus?.settings) {
    saasSettingsCurrent.sections.header_plus.settings.announce_title = "Create cinematic dreamscape portraits from everyday uploads.";
    saasSettingsCurrent.sections.header_plus.settings.announcement = "Create cinematic dreamscape portraits from everyday uploads.";
    saasSettingsCurrent.sections.header_plus.settings.announce_bg_color = "#FFF8ED";
    saasSettingsCurrent.sections.header_plus.settings.announce_color = "#1E1712";
  }

  const navigation = scrubAidreamcapesText(clone(source.navigation ?? { headerLinks: [], footerLinks: [] }));
  navigation.footerLinks = globalSections.footer.blocks.map((block) => ({
    label: block.settings.label,
    href: block.settings.href,
    group: block.settings.group
  }));
  return {
    colors: {
      background: "#FBF3E4",
      foreground: "#1E1712",
      accent: "#D88A4B",
      muted: "#FFF8ED"
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
        "Aidreamcapes is a private AI studio for cinematic dreamscape portraits, fantasy travel scenes, soft glam albums, and customer-only gallery delivery.",
      siteKeywords: "Aidreamcapes, AI dreamscape portraits, cinematic travel photos, fantasy avatar generator, private AI portrait gallery",
      titleTemplate: `%s | ${siteName}`,
      defaultOgImage: aidreamcapesPackImages.dreamscape,
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
        skin_bg: "#FBF3E4",
        skin_title_color: "#1E1712",
        skin_text_color: "#6F6257",
        skin_primary_btn_bg_color: "#1E1712",
        skin_primary_btn_text_color: "#FFF8ED",
        skin_secondary_btn_bg_color: "#FFF8ED",
        skin_secondary_btn_text_color: "#1E1712",
        skin_accent_color: "#D88A4B",
        skin_price_color: "#B86E36",
        skin_muted_color: "#FFF8ED",
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
              announce_title: "Create cinematic dreamscape portraits from everyday uploads.",
              announcement: "Create cinematic dreamscape portraits from everyday uploads.",
              announce_bg_color: "#FFF8ED",
              announce_color: "#1E1712"
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
  { idSuffix: "collections", packageTemplate: "packages", templateKey: "collection", slug: "/collections", title: "Dreamscape packages", pageType: "collection", seoKey: "collections" },
  { idSuffix: "tools", packageTemplate: "tools", templateKey: "tools", slug: "/tools", title: "AI dreamscape tools", pageType: "tools", seoKey: "tools" },
  { idSuffix: "tool_dreamscape", packageTemplate: "tool-detail", templateKey: "product", slug: "/tools/dreamscape-generator", title: "Dreamscape Generator", pageType: "ai_tool" },
  { idSuffix: "login", packageTemplate: "login", templateKey: "login", slug: "/login", title: "Customer login", pageType: "login", seoKey: "login" },
  { idSuffix: "app", packageTemplate: "app-home", templateKey: "app-home", slug: "/app", title: "Customer workspace", pageType: "workspace" },
  { idSuffix: "job_progress", packageTemplate: "job-progress", templateKey: "job-progress", slug: "/app/jobs/progress", title: "Job progress", pageType: "job_progress" },
  { idSuffix: "job_detail", packageTemplate: "job-detail", templateKey: "job-detail", slug: "/app/jobs/detail", title: "Job detail", pageType: "job_detail" },
  { idSuffix: "album", packageTemplate: "album", templateKey: "album", slug: "/album", title: "Private album", pageType: "album" },
  { idSuffix: "account", packageTemplate: "account-billing", templateKey: "account-billing", slug: "/account", title: "Account and billing", pageType: "account" },
  { idSuffix: "privacy", packageTemplate: "policy", templateKey: "privacy", slug: "/policies/privacy", title: "Privacy policy", pageType: "policy", seoKey: "privacy" },
  { idSuffix: "refunds", packageTemplate: "policy", templateKey: "refunds", slug: "/policies/refunds", title: "Refund policy", pageType: "policy", seoKey: "refunds" },
  { idSuffix: "shipping", packageTemplate: "policy", templateKey: "shipping", slug: "/policies/shipping", title: "Shipping and Digital Delivery Policy", pageType: "policy", seoKey: "shipping" },
  { idSuffix: "terms_service", packageTemplate: "policy", templateKey: "terms", slug: "/policies/terms", title: "Terms of Service", pageType: "policy", seoKey: "terms" },
  { idSuffix: "content", packageTemplate: "policy", templateKey: "content", slug: "/policies/content", title: "Content policy", pageType: "policy", seoKey: "content" },
  { idSuffix: "cookies", packageTemplate: "policy", templateKey: "cookies", slug: "/policies/cookies", title: "Cookie policy", pageType: "policy", seoKey: "cookies" },
  { idSuffix: "help", packageTemplate: "help", templateKey: "help", slug: "/help", title: "Help center", pageType: "help", seoKey: "help" },
  { idSuffix: "blog", packageTemplate: "blog-list", templateKey: "blog", slug: "/blog", title: "Guides", pageType: "blog", seoKey: "blog" },
  { idSuffix: "blog_detail", packageTemplate: "blog-detail", templateKey: "blog-detail", slug: "/blog/planning-dreamscape-source-photos", title: "Planning dreamscape source photos", pageType: "article", seoKey: "blogDreamscape" },
  { idSuffix: "about_us", packageTemplate: "about-us", templateKey: "about-us", slug: "/about-us", title: "About Us", pageType: "content", seoKey: "about" },
  { idSuffix: "contact_us", packageTemplate: "contact-us", templateKey: "contact-us", slug: "/contact-us", title: "Contact Us", pageType: "content", seoKey: "contact" },
  { idSuffix: "search", packageTemplate: "search", templateKey: "search", slug: "/search", title: "Search", pageType: "search", seoKey: "search" },
  { idSuffix: "cart", packageTemplate: "cart", templateKey: "cart", slug: "/cart", title: "Cart", pageType: "cart" },
  { idSuffix: "404", packageTemplate: "404", templateKey: "404", slug: "/404", title: "404", pageType: "404" }
];

const pageCopy = {
  "/": {
    title: "Create cinematic dreamscape portraits from everyday uploads.",
    subtitle: "Choose a dreamscape package, upload clear source photos, and receive private gallery-ready escape portraits without planning a full destination shoot."
  },
  "/pricing": {
    title: "Choose credits for your next escape portrait set.",
    subtitle: "Aidreamcapes plans cover private uploads, cinematic dreamscape generation, gallery delivery, and top-ups when inspiration keeps going."
  },
  "/collections": {
    title: "Choose a dreamscape package",
    subtitle: "Each package locks the atmosphere, preview look, output target, and source-photo guidance for a private cinematic album."
  },
  "/tools": {
    title: "Aidreamcapes AI tools",
    subtitle: "Start with a focused tool for dreamscape portraits, fantasy avatars, coastal scenes, editorial getaways, and soft creator visuals."
  },
  "/help": {
    title: "Aidreamcapes help for dreamscape uploads, credits, and private albums.",
    subtitle: "Get clear answers about source photos, mood references, credit usage, checkout, refunds, privacy, and gallery delivery."
  },
  "/blog": {
    title: "Dreamscape portrait guides for better source photos and richer scenes.",
    subtitle: "Learn how to plan cinematic escape portraits, choose references, protect private albums, and use Aidreamcapes credits intentionally."
  },
  "/blog/planning-dreamscape-source-photos": {
    title: "How to plan source photos for cinematic dreamscape portraits",
    subtitle: "A practical guide to choosing portraits, outfit notes, and mood references before starting an Aidreamcapes private gallery."
  },
  "/search": {
    title: "Search Aidreamcapes tools, packages, guides, and policies.",
    subtitle: "Find dreamscape portrait tools, coastal escape packages, fantasy avatars, pricing, upload help, privacy, refunds, and private gallery guidance."
  },
  "/about-us": {
    title: "About Aidreamcapes",
    subtitle: "A private AI dreamscape portrait workspace for source photo planning, visible credits, cinematic scenes, and customer-only gallery delivery."
  },
  "/contact-us": {
    title: "Contact Aidreamcapes",
    subtitle: "Reach support or sales for dreamscape portrait help, source photo guidance, billing review, privacy requests, and business questions."
  }
};

const aidreamcapesPolicyBodies = {
  privacy: `<h3>1. Information we collect</h3><p>Aidreamcapes collects the information needed to operate a private AI portrait workspace: account email, authentication state, source photos, reference notes, package selections, prompts, generation settings, credit ledger events, checkout status, support messages, generated outputs, downloads, and basic device or request metadata used for security and reliability.</p><h3>2. How we use information</h3><p>We use this information to create requested dreamscape portraits, reserve and settle credits, deliver private galleries, keep account history accurate, provide support, prevent misuse, troubleshoot failed jobs, improve source-photo guidance, and show the right workspace pages after sign-in.</p><h3>3. Source photos and generated images</h3><p>Uploads and generated results stay tied to the current Aidreamcapes site and signed-in customer account. They are not sold as stock images, published in public galleries, or transferred to unrelated storefronts by default. Infrastructure and AI providers may process files only as needed to complete the service requested by the customer.</p><h3>4. Payments, credits, and retention</h3><p>Payments are handled by a connected payment provider. Aidreamcapes stores order IDs, checkout status, subscription state, credit purchases, reservations, reversals, and refund records; it does not store full card numbers on its own servers. Account records and generated assets are retained while needed for delivery, support, compliance, security, and customer access.</p><h3>5. Customer choices and contact</h3><p>Customers can contact support to ask about access, deletion, correction, privacy review, or account-specific delivery questions. Email <a href="mailto:${supportEmail}">${supportEmail}</a> and include the account email plus any relevant order, job, or gallery details so the request can be reviewed safely.</p>`,
  refunds: `<h3>1. Refund eligibility</h3><p>Refunds are reviewed based on credit use, checkout status, subscription state, and whether generation work has already been completed. Unused one-time credit purchases may be eligible for review within the stated support window, while credits already consumed by successful dreamscape generations are generally not refundable.</p><h3>2. Failed or interrupted jobs</h3><p>If a service-side technical failure prevents generation or private gallery delivery, Aidreamcapes may release reserved credits, rerun the request, provide troubleshooting, or review a refund. Support may ask for the account email, package name, job status, approximate request time, and any error message shown in the workspace.</p><h3>3. Subscriptions and renewals</h3><p>Canceling a subscription stops future renewals but does not automatically refund credits already granted or spent. Subscription refunds depend on payment status, usage, local requirements, and whether credits from the billing period have been applied to completed generations.</p><h3>4. Non-refundable cases</h3><p>Refunds are usually not available for dissatisfaction caused by unclear source photos, unsupported requests, changed creative preferences after generation, or outputs that were delivered according to the selected package. Customers should review source-photo guidance before starting a package run.</p><h3>5. How to request review</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> with the Aidreamcapes account email, checkout reference if available, package or job details, and a short explanation. Support will review the ledger and delivery records before deciding whether to release credits, rerun work, or refund eligible payments.</p>`,
  shipping: `<h3>1. No physical shipping</h3><p>Aidreamcapes sells digital AI dreamscape portrait credits, generated image packages, downloads, and private gallery access. We do not ship physical products, printed photos, USB drives, or mailed merchandise from this storefront.</p><h3>2. Digital delivery</h3><p>Credits are added after payment confirmation. Generated images are delivered inside the signed-in customer workspace or private gallery when a job completes. Delivery timing can vary based on source photo quality, selected package settings, provider availability, moderation review, and system load.</p><h3>3. Failed or delayed jobs</h3><p>If a service-side issue prevents delivery, Aidreamcapes may release reserved credits, rerun the job, troubleshoot the account, or review refund eligibility under the refund policy. Support may ask for the account email, package name, order details, and job status.</p><h3>4. No carrier tracking or customs</h3><p>Because orders are digital, customers do not receive carrier tracking numbers and are not charged shipping, customs, duties, or physical handling fees by Aidreamcapes.</p><h3>5. Contact</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> with the Aidreamcapes account email, order or job details, and a short description if a digital delivery does not appear in the workspace.</p>`,
  terms: `<h3>1. Acceptance</h3><p>By using Aidreamcapes, creating an account, purchasing credits, uploading source photos, starting a generation job, or opening a private gallery, you agree to these terms and the privacy policy that governs account data, uploads, payment status, and delivery records.</p><h3>2. Accounts and security</h3><p>Customers must provide accurate account information, keep sign-in credentials secure, and use the service only for lawful personal, creator, or business workflows. Each account is scoped to its site customer record and should not be shared in a way that bypasses billing, moderation, or privacy controls.</p><h3>3. Credits, packages, and delivery</h3><p>Credits are granted after confirmed payment, displayed before package creation, reserved when a job starts, consumed after successful delivery, and released when a request fails or times out. Delivery times, output counts, and creative results can vary based on source-photo quality, package settings, provider availability, and safety review.</p><h3>4. Uploaded content and rights</h3><p>You may only upload portraits, references, product images, or creative direction that you own or have permission to use. You remain responsible for the source material you submit and for how you use generated outputs. Aidreamcapes may reject, remove, or restrict requests that violate law, policy, platform safety rules, or third-party rights.</p><h3>5. Service limits and changes</h3><p>Aidreamcapes may update packages, pricing, credit rules, workflows, providers, delivery limits, or safety practices to keep the service reliable. We may pause or limit access when needed for security, abuse prevention, maintenance, payment issues, or policy enforcement.</p><h3>6. Contact</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> for account, billing, privacy, refund, policy, generation, or private gallery questions. Include the account email and relevant job or order details when requesting support.</p>`,
  content: `<h3>1. Allowed uploads</h3><p>Upload only portraits, product references, wardrobe notes, location inspiration, or creative direction that you own, created, licensed, or have permission to use. Source photos should be clear enough to support identity-safe dreamscape portraits and should not include people who have not consented to the intended use.</p><h3>2. Disallowed requests</h3><p>Do not use Aidreamcapes for impersonation, harassment, explicit exploitation, non-consensual imagery, illegal activity, stolen images, hateful or abusive content, deceptive identity use, attempts to bypass moderation, or requests involving protected marks or people in a misleading way.</p><h3>3. Generated outputs</h3><p>AI results may contain artifacts, inaccurate details, unexpected styling, or visual assumptions. Customers should review final images before using them publicly, commercially, or in identity-sensitive contexts. Generated results should not be presented as factual documentary evidence of events that did not happen.</p><h3>4. Review and enforcement</h3><p>Aidreamcapes may block prompts, reject uploads, pause jobs, remove outputs, release credits, or restrict accounts when content appears unsafe, unauthorized, abusive, unlawful, or outside supported package intent. Support may request more context when a request is ambiguous.</p><h3>5. Reporting concerns</h3><p>Email <a href="mailto:${supportEmail}">${supportEmail}</a> to report content concerns, suspected misuse, account access issues, or generated output that needs review. Include the account email, job details, and a concise description of the concern.</p>`,
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
      layout: "studio_commerce",
      eyebrow: "AI dreamscape studio",
      imageBadge: "Aidreamcapes preview",
      imageCaption: "Private escape portraits, ready for download.",
      heroVisualOverride: aidreamcapesPackImages.dreamscape,
      socialProofLabel: "4.9/5 from dreamscape customers"
    };
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_tool_collection" || section.type === "dreamshoot_tool_collection", (section) => {
    section.type = "aidreamcapes_tool_collection";
    section.settings = {
      ...section.settings,
      eyebrow: "Aidreamcapes tools",
      title: "Choose a dreamscape tool",
      subtitle: "Use focused tools for cinematic escape portraits, fantasy avatars, coastal scenes, editorial getaways, product reveries, and social keepsakes.",
      categories: "All tools|Dreamscape|Coastal|Fantasy|Couples|Editorial|Glam|Travel|Product|Keepsake",
      primaryCta: "Start Dreamscape Generator",
      primaryHref: "/tools/dreamscape-generator",
      secondaryCta: "Browse packages",
      secondaryHref: "/collections"
    };
    section.blocks = clone(aidreamcapesTools);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_package_taxonomy" || section.type === "dreamshoot_package_taxonomy", (section) => {
    section.type = "aidreamcapes_package_taxonomy";
    section.settings = {
      ...section.settings,
      eyebrow: "Dreamscape taxonomy",
      title: "Aidreamcapes package paths",
      subtitle: "Browse package families built around escape mood, destination feel, subject type, and gallery use case.",
      layout: "editorial"
    };
    section.blocks = clone(aidreamcapesTaxonomyBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_feature_tabs" || section.type === "dreamshoot_feature_tabs", (section) => {
    section.type = "aidreamcapes_feature_tabs";
    section.settings = {
      ...section.settings,
      eyebrow: "Creation flow",
      title: "Plan the scene before you generate.",
      subtitle: "Aidreamcapes keeps each request anchored to source photos, mood references, visible credits, and private delivery."
    };
    section.blocks = clone(aidreamcapesFeatureTabs);
  });
  setSectionBlocks(pageJson, "feature_grid", aidreamcapesFlowBlocks);
  setSectionBlocks(pageJson, "sample_strip", aidreamcapesSampleBlocks);
  updateSections(pageJson, (section) => section.type === "photo_package_wall", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Dreamscape packages",
      title: "AI dreamscape portraits for private galleries and memorable profiles.",
      subtitle: "Compare Aidreamcapes packages by mood, credit cost, source-photo guidance, output count, and delivery fit.",
      source: "creative_packs",
      layout: "editorial",
      maxCount: "32"
    };
  });
  updateSections(pageJson, (section) => section.type === "brand_logo_strip", (section) => {
    section.settings = {
      ...section.settings,
      title: "Dreamscape signals for creators, couples, founders, and soft product stories",
      style: "quiet"
    };
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_visual_proof" || section.type === "dreamshoot_visual_proof", (section) => {
    section.type = "aidreamcapes_visual_proof";
    section.settings = {
      ...section.settings,
      label: "Visual directions",
      title: "See how one upload set can become an escape world.",
      subtitle: "Browse Aidreamcapes outcomes across dreamscape portraits, coastal scenes, fantasy avatars, golden hour couples, and editorial getaways.",
      tabs: "All|Dreamscape|Coastal|Fantasy|Couples|Editorial|Glam|Product"
    };
    section.blocks = clone(aidreamcapesVisualProofBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_featured_pack" || section.type === "dreamshoot_featured_pack", (section) => {
    section.type = "aidreamcapes_featured_pack";
    section.settings = {
      ...section.settings,
      label: "Featured package",
      badge: "Signature",
      title: "Dreamscape Portraits for cinematic escape moments.",
      subtitle: "Build a private gallery of imagined places, warm light, and profile-ready portraits from everyday uploads.",
      primaryCta: "Create dreamscape portraits",
      primaryHref: "/tools/dreamscape-generator",
      secondaryCta: "Browse all packages",
      secondaryHref: "/collections",
      overlayTitle: "Dreamscape Pack",
      overlaySubtitle: "Dreamlike escape portraits without a destination shoot.",
      campaignLabel: "Current focus: cinematic escape portraits",
      includedOutputs: "Dreamscape portraits|Cinematic escape scenes|Coastal profile crops|Fantasy avatar squares|Golden hour couple images|Editorial travel crops|Soft product reverie frames|Social keepsake cards",
      safetyCopy: "Private styling: no public gallery is created unless the customer chooses to share finished images.",
      bottomNote: "Dreamscape packages rotate around travel moods, fantasy scenes, romantic keepsakes, and creator launch moments."
    };
    section.blocks = clone(aidreamcapesFeaturedPackBlocks);
  });
  updateSections(pageJson, (section) => section.type === "aidreamcapes_package_catalog" || section.type === "dreamshoot_package_catalog", (section) => {
    section.type = "aidreamcapes_package_catalog";
    section.settings = {
      ...section.settings,
      label: "Package catalog",
      title: "Choose a finished dreamscape direction before generating.",
      subtitle: "Each Aidreamcapes package has a mood, output count, credit cost, source-photo guidance, and one clear next action.",
      tabs: "All|Dreamscape|Coastal|Fantasy|Couples|Editorial|Glam|Product",
      steps: "Choose mood|Review credit cost|Generate private gallery"
    };
    section.blocks = clone(aidreamcapesCatalogBlocks);
  });
  updateSections(pageJson, (section) => section.type === "testimonial_wall", (section) => {
    section.settings = {
      ...section.settings,
      title: "Dreamscape stories from private gallery customers",
      subtitle: "Aidreamcapes customers use packages for profile refreshes, fantasy keepsakes, soft travel concepts, and product moodboards.",
      summaryTitle: "Private escape portraits",
      summaryBody: "Source photos, credits, and finished galleries stay connected to one signed-in account."
    };
    section.blocks = clone(aidreamcapesTestimonialBlocks);
  });
  updateSections(pageJson, (section) => section.type === "dreamshoot_flow_bridge" || section.type === "aidreamcapes_flow_bridge", (section) => {
    section.type = "aidreamcapes_flow_bridge";
    section.settings = {
      ...section.settings,
      label: "Dreamscape workflow bridge",
      title: "From source photos to a private escape gallery.",
      subtitle: "Aidreamcapes turns upload planning, mood choice, credit spend, and gallery delivery into one clear customer journey.",
      albumImageOne: aidreamcapesPackImages.dreamscape,
      albumImageTwo: aidreamcapesPackImages.coastal,
      albumImageThree: aidreamcapesPackImages.avatar
    };
    section.blocks = clone(aidreamcapesFlowBlocks);
  });
  updateSections(pageJson, (section) => section.type === "faq", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Dreamscape questions",
      title: "Aidreamcapes FAQ",
      subtitle: "Answers about source photos, dreamscape package choice, credits, privacy, delivery, and refunds.",
      journeyTitle: "Your dreamscape flow",
      journeyTitles: "Upload|Choose Mood|Generate|Download",
      journeyDescriptions: "Add clear source photos.|Pick an escape direction.|Spend visible credits.|Review the private gallery."
    };
    section.blocks = clone(aidreamcapesFaqBlocks);
  });
  updateSections(pageJson, (section) => section.type === "conversion_panel", (section) => {
    section.settings = {
      ...section.settings,
      eyebrow: "Start creating",
      title: "Open your private Aidreamcapes studio.",
      subtitle: "Plan the mood, upload source photos, spend visible credits, and keep finished dreamscape portraits in one private workspace.",
      primaryCta: "Start a dreamscape set",
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
        eyebrow: "Help center",
        title: "Aidreamcapes help for dreamscape uploads, credits, and private albums.",
        body: "Find practical answers about source photo quality, dreamscape package choice, mood references, credit usage, checkout, refunds, privacy, cookies, and private gallery delivery."
      };
    }
    const planRules = pageJson.sections.plan_rules_1;
    if (planRules?.settings) {
      planRules.settings = {
        ...planRules.settings,
        eyebrow: "Plans and credits",
        title: "Plan the mood first. Spend credits when ready.",
        body: "Aidreamcapes uses visible credits for private dreamscape generation, with source photos, requests, albums, and downloads kept inside the signed-in account.",
        imageUrl: aidreamcapesPackImages.dreamscape,
        primaryCta: "Choose a plan",
        primaryHref: "/pricing",
        secondaryCta: "Browse dreamscape tools",
        secondaryHref: "/tools"
      };
      planRules.blocks = clone(aidreamcapesPlanRuleBlocks);
    }
  }
  if (mapping.slug === "/blog") {
    if (pageJson.sections.blog_intro_1?.settings) {
      pageJson.sections.blog_intro_1.settings = {
        eyebrow: "Guides",
        title: "Dreamscape portrait guides for richer AI escape scenes.",
        body: "Learn how to prepare source portraits, choose outfit notes, describe coastal or fantasy moods, manage credits, protect private albums, and get more intentional Aidreamcapes results."
      };
    }
    if (pageJson.sections.blog_list_1?.settings) {
      pageJson.sections.blog_list_1.settings = {
        title: "Aidreamcapes dreamscape guides",
        body: "Guides for source photos, cinematic escape moods, fantasy avatars, credit planning, private delivery, and gallery review.",
        guideType: "Dreamscape guide"
      };
    }
  }
  if (mapping.slug === "/blog/planning-dreamscape-source-photos" && pageJson.sections.blog_detail_1?.settings) {
    pageJson.sections.blog_detail_1.settings = {
      eyebrow: "Dreamscape guide",
      title: "How to plan source photos for cinematic dreamscape portraits",
      body: `<p>Strong Aidreamcapes results start before generation. Choose recent portraits with clear facial detail, natural expressions, and enough variation in angle, lighting, and distance for the private workflow to understand the subject.</p><h3>Pick photos that preserve identity</h3><p>Use simple, sharp images first. Avoid heavy filters, sunglasses, extreme crops, and group shots when the request needs consistent dreamscape portraits.</p><h3>Add mood references without overloading the request</h3><p>A coastal escape might need warm light and relaxed wardrobe notes. A fantasy avatar might need a softer color world. An editorial getaway can benefit from outfit references and a preferred destination mood.</p><h3>Match the package to the final use</h3><p>Choose Dreamscape Portraits for atmosphere, Coastal Escapes for travel warmth, Fantasy Avatars for profile art, Storybook Headshots for warm professional pages, and Product Reverie for soft campaign concepts.</p><h3>Review privately before sharing</h3><p>Finished images return to the Aidreamcapes account gallery, where customers can compare crops, download favorites, and decide what belongs on profiles, social posts, gifts, or private keepsakes.</p>`
    };
  }
  if (mapping.slug === "/search") {
    if (pageJson.sections.search_intro_1?.settings) {
      pageJson.sections.search_intro_1.settings = {
        eyebrow: "Search",
        title: "Search Aidreamcapes tools, packages, guides, and policies.",
        body: "Find dreamscape portrait tools, coastal escape packages, fantasy avatar guidance, pricing, source-photo help, privacy details, refund information, and private gallery support."
      };
    }
    if (pageJson.sections.search_1?.settings) {
      pageJson.sections.search_1.settings = {
        ...pageJson.sections.search_1.settings,
        eyebrow: "Site search",
        title: "Search Aidreamcapes",
        subtitle: "Search dreamscape packages, AI tools, pricing, help guides, and policies.",
        emptyTitle: "No matching Aidreamcapes content yet.",
        emptyBody: "Try dreamscape, coastal, fantasy avatar, editorial, product reverie, pricing, uploads, privacy, or refunds.",
        resultLimit: 12
      };
    }
  }
  if (mapping.slug === "/about-us") {
    if (pageJson.sections.about_intro_1?.settings) {
      pageJson.sections.about_intro_1.settings = {
        eyebrow: "About Aidreamcapes",
        title: "Private AI dreamscape portraits with clear credits and customer-only delivery.",
        body: "Aidreamcapes helps customers turn everyday source photos into cinematic dreamscape portraits, fantasy travel scenes, soft glam albums, and private galleries without planning a destination shoot."
      };
    }
    if (pageJson.sections.about_values_1?.settings) {
      pageJson.sections.about_values_1.settings = {
        eyebrow: "What we focus on",
        title: "Source photos, mood planning, visible credits, and private albums.",
        subtitle: "Each Aidreamcapes page is designed around a clear portrait outcome so customers know what to upload, what credits are reserved, and where finished images will arrive."
      };
      pageJson.sections.about_values_1.blocks = [
        { id: "about_private", type: "rich_text_card", settings: { meta: "Private by default", title: "Customer-only galleries", description: "Uploads and generated portraits stay tied to the signed-in Aidreamcapes account unless the customer chooses to share results." } },
        { id: "about_credits", type: "rich_text_card", settings: { meta: "Clear pricing", title: "Visible credit usage", description: "Plans, one-time top-ups, package costs, reservations, and delivery states are shown before customers commit to a request." } },
        { id: "about_scenes", type: "rich_text_card", settings: { meta: "Creative direction", title: "Dreamscape package themes", description: "Coastal escapes, fantasy avatars, golden hour couples, editorial getaways, soft glam, and product reveries each have focused guidance." } }
      ];
    }
    if (pageJson.sections.trust_1?.settings) {
      pageJson.sections.trust_1.settings = {
        eyebrow: "Customer trust",
        title: "Built for private portrait workflows, not public galleries.",
        contactEmail: supportEmail,
        body: `Aidreamcapes keeps source photos, request history, credit ledger events, generated outputs, downloads, support details, and policy pages scoped to the storefront account. Email <a href="mailto:${supportEmail}">${supportEmail}</a> for privacy, account, billing, or private gallery questions.`
      };
    }
  }
  if (mapping.slug === "/contact-us") {
    if (pageJson.sections.contact_intro_1?.settings) {
      pageJson.sections.contact_intro_1.settings = {
        eyebrow: "Contact",
        title: "Contact Aidreamcapes support or sales.",
        body: "Reach the right Aidreamcapes inbox for source photo guidance, dreamscape request status, account access, billing review, privacy questions, plan fit, or creator and business use cases."
      };
      pageJson.sections.contact_intro_1.blocks = [
        { id: "contact_support", type: "rich_text_card", settings: { meta: "Support", title: supportEmail, description: "For account access, billing review, credit questions, upload help, privacy requests, and private gallery delivery support." } },
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
  if (mapping.slug === "/tools/dreamscape-generator") {
    updateSections(pageJson, () => true, (section) => {
      if (section.settings.eyebrow === "Dreamscape Studio" || /AI Image Studio/i.test(section.settings.eyebrow ?? "")) section.settings.eyebrow = "Dreamscape Studio";
      if (typeof section.settings.title === "string") section.settings.title = section.settings.title.replace(/AI Image Studio|Generate Headshots and Portrait Scene Packs/gi, "Dreamscape Generator");
      if (typeof section.settings.subtitle === "string") section.settings.subtitle = section.settings.subtitle.replace(/headshots|portrait scene packs/gi, "cinematic escape portraits");
    });
    pageJson.seo = {
      title: "Aidreamcapes Dreamscape Generator - cinematic escape portraits",
      description: "Start the Aidreamcapes Dreamscape Generator to create cinematic escape portraits from private uploads, mood references, credits, and gallery delivery.",
      keywords: "Aidreamcapes dreamscape generator, cinematic escape portraits, private AI portrait tool",
      canonicalPath: "/tools/dreamscape-generator",
      robots: { index: true, follow: true }
    };
  }
  if (mapping.slug === "/app/jobs/progress") {
    pageJson.seo = {
      title: "Aidreamcapes Job Progress - track dreamscape delivery",
      description: "Track Aidreamcapes dreamscape generation progress, reserved credits, request status, and private gallery delivery from the customer workspace.",
      keywords: "Aidreamcapes job progress, dreamscape generation status, private AI gallery delivery",
      canonicalPath: "/app/jobs/progress",
      robots: { index: false, follow: true }
    };
  }
  if (mapping.slug === "/app/jobs/detail") {
    pageJson.seo = {
      title: "Aidreamcapes Job Detail - review private gallery outputs",
      description: "Review Aidreamcapes generation details, credit activity, private outputs, and delivered dreamscape portraits inside the customer workspace.",
      keywords: "Aidreamcapes job detail, dreamscape outputs, private portrait gallery",
      canonicalPath: "/app/jobs/detail",
      robots: { index: false, follow: true }
    };
  }
  if (mapping.slug === "/cart") {
    updateSections(pageJson, (section) => section.type === "cart_summary", (section) => {
      section.settings = {
        ...section.settings,
        title: "Your selected Aidreamcapes credit plan",
        subtitle: "Review credits, price, and dreamscape package access before continuing to secure checkout."
      };
    });
  }
  if (mapping.slug === "/404") {
    pageJson.seo = {
      title: "Page Not Found - return to Aidreamcapes dreamscape packages",
      description: "This Aidreamcapes page is not available. Return to dreamscape packages, tools, pricing, help, or the private customer workspace.",
      keywords: "Aidreamcapes 404, dreamscape packages, Aidreamcapes help",
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
  ["prod_aidreamcapes_starter", "Daydream", "price_aidreamcapes_starter", 3500, 200, false, "For one focused dreamscape set", "Cream-light editing", 20, 2, 3],
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
  ["cat_aidreamcapes_parent_escape", "dreamscape-escapes", "Dreamscape Escapes", "Cinematic location-led portrait packages for imagined trips and atmospheric scenes.", "Dreamscape escape portraits", "Choose a cinematic world, then generate a private gallery around it.", "sparkles", aidreamcapesPackImages.dreamscape],
  ["cat_aidreamcapes_parent_identity", "fantasy-identity", "Fantasy & Identity", "Profile-ready fantasy, storybook, and warm personal portrait directions.", "Fantasy identity portraits", "Create avatars, profile crops, and memorable personal portraits.", "wand", aidreamcapesPackImages.avatar],
  ["cat_aidreamcapes_parent_romance", "romance-glam", "Romance & Glam", "Romantic couple scenes, soft glam looks, and polished beauty-led albums.", "Romance and glam portraits", "Build warm, polished portraits for keepsakes, profiles, and private albums.", "heart", aidreamcapesPackImages.couple],
  ["cat_aidreamcapes_parent_creator", "creator-keepsakes", "Creator & Keepsakes", "Editorial, product, and social-ready visuals for creators and personal projects.", "Creator keepsake visuals", "Plan campaign concepts, product reveries, and share-ready memory cards.", "camera", aidreamcapesPackImages.editorial]
];

const childCategoryRows = [
  ["cat_aidreamcapes_dreamscape", "dreamscape-portraits", "Dreamscape Portraits", "Cinematic imagined places for personal portraits.", "Create cinematic dreamscape portraits", "Turn everyday uploads into soft, story-led escape scenes.", "sparkles", aidreamcapesPackImages.dreamscape, "cat_aidreamcapes_parent_escape"],
  ["cat_aidreamcapes_coastal", "coastal-escapes", "Coastal Escapes", "Beach, island, resort, and cliffside portrait moods.", "AI coastal escape portraits", "Warm seaside imagery without planning a destination shoot.", "waves", aidreamcapesPackImages.coastal, "cat_aidreamcapes_parent_escape"],
  ["cat_aidreamcapes_travel", "cinematic-travel", "Cinematic Travel", "Destination-led portraits with scenic story energy.", "Cinematic travel photos", "Explore old cities, coast roads, gardens, and mountain overlooks.", "map", aidreamcapesPackImages.travel, "cat_aidreamcapes_parent_escape"],
  ["cat_aidreamcapes_avatar", "fantasy-avatars", "Fantasy Avatars", "Storybook avatars and profile-ready fantasy portraits.", "Fantasy avatar maker", "Create ethereal profile art from private uploads.", "wand", aidreamcapesPackImages.avatar, "cat_aidreamcapes_parent_identity"],
  ["cat_aidreamcapes_headshot", "storybook-headshots", "Storybook Headshots", "Warm professional portraits for creators and founders.", "Warm storybook headshots", "Make profile photos feel polished, approachable, and memorable.", "user", aidreamcapesPackImages.headshot, "cat_aidreamcapes_parent_identity"],
  ["cat_aidreamcapes_couple", "golden-hour-couples", "Golden Hour Couples", "Romantic sunset and travel-inspired couple albums.", "Golden hour couple portraits", "Create warm couple scenes for gifts and announcements.", "heart", aidreamcapesPackImages.couple, "cat_aidreamcapes_parent_romance"],
  ["cat_aidreamcapes_glam", "soft-glam-studio", "Soft Glam Studio", "Cream-light beauty portraits and private glam albums.", "Soft glam AI portraits", "Create polished beauty looks with gentle light.", "flower", aidreamcapesPackImages.glam, "cat_aidreamcapes_parent_romance"],
  ["cat_aidreamcapes_editorial", "editorial-getaways", "Editorial Getaways", "Magazine-style travel portraits and campaign visuals.", "Editorial getaway portraits", "Pair fashion-led composition with imagined locations.", "camera", aidreamcapesPackImages.editorial, "cat_aidreamcapes_parent_creator"],
  ["cat_aidreamcapes_product", "product-reverie", "Product Reverie", "Dreamy lifestyle product concepts for creators.", "Dreamy product lifestyle visuals", "Place small products into soft, story-led scenes.", "package", aidreamcapesPackImages.product, "cat_aidreamcapes_parent_creator"],
  ["cat_aidreamcapes_social", "social-keepsakes", "Social Keepsakes", "Dreamy cards, announcements, and personal visual keepsakes.", "Social keepsake maker", "Create gentle share-ready visuals for memorable moments.", "cards", aidreamcapesPackImages.social, "cat_aidreamcapes_parent_creator"]
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
  ["pack_aidreamcapes_dreamscape", "Dreamscape Portraits", "Cinematic imagined places, misty terraces, moon gardens, and soft escape portraits.", "dreamscape-portraits", 24, 24, aidreamcapesPackImages.dreamscape],
  ["pack_aidreamcapes_coastal", "Coastal Escapes", "Beach, island, resort, and cliffside portraits with warm travel light.", "coastal-escapes", 24, 22, aidreamcapesPackImages.coastal],
  ["pack_aidreamcapes_avatar", "Fantasy Avatars", "Storybook avatars, ethereal profile art, and soft fictional identity crops.", "fantasy-avatars", 20, 20, aidreamcapesPackImages.avatar],
  ["pack_aidreamcapes_couple", "Golden Hour Couples", "Romantic sunset scenes, garden walks, coastal evenings, and gift-ready albums.", "golden-hour-couples", 24, 24, aidreamcapesPackImages.couple],
  ["pack_aidreamcapes_headshots", "Storybook Headshots", "Warm professional portraits for authors, creators, coaches, and founders.", "storybook-headshots", 20, 20, aidreamcapesPackImages.headshot],
  ["pack_aidreamcapes_editorial", "Editorial Getaways", "Magazine-style travel portraits with fashion-led settings and cinematic crops.", "editorial-getaways", 28, 26, aidreamcapesPackImages.editorial],
  ["pack_aidreamcapes_glam", "Soft Glam Studio", "Cream-light beauty portraits, gentle makeup moods, and polished profile crops.", "soft-glam-studio", 20, 18, aidreamcapesPackImages.glam],
  ["pack_aidreamcapes_travel", "Cinematic Travel", "Old cities, coast roads, scenic overlooks, rainy cafes, and dream-trip visuals.", "cinematic-travel", 28, 24, aidreamcapesPackImages.travel],
  ["pack_aidreamcapes_product", "Product Reverie", "Dreamy lifestyle product concepts for launches, moodboards, and soft social visuals.", "product-reverie", 16, 18, aidreamcapesPackImages.product],
  ["pack_aidreamcapes_social", "Social Keepsakes", "Dreamy announcement cards, profile banners, memory posts, and private gift visuals.", "social-keepsakes", 20, 18, aidreamcapesPackImages.social]
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
  ["media_aidreamcapes_hero", "Aidreamcapes cinematic dreamscape portrait hero", "sites/site_aidreamcapes/theme/dreamscape-portraits.png", aidreamcapesPackImages.dreamscape],
  ["media_aidreamcapes_coastal", "Aidreamcapes coastal escape portrait cover", "sites/site_aidreamcapes/theme/coastal-escapes.png", aidreamcapesPackImages.coastal],
  ["media_aidreamcapes_avatar", "Aidreamcapes fantasy avatar portrait cover", "sites/site_aidreamcapes/theme/fantasy-avatars.png", aidreamcapesPackImages.avatar],
  ["media_aidreamcapes_editorial", "Aidreamcapes editorial getaway portrait cover", "sites/site_aidreamcapes/theme/editorial-getaways.png", aidreamcapesPackImages.editorial],
  ["media_aidreamcapes_glam", "Aidreamcapes soft glam portrait cover", "sites/site_aidreamcapes/theme/soft-glam-studio.png", aidreamcapesPackImages.glam]
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
      return seo ? [page.id, { ...seo, ogImage: aidreamcapesPackImages.dreamscape }] : undefined;
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
    market: "AI dreamscape portraits, fantasy travel scenes, cinematic escape packages, credits, and private galleries",
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
  name: "Aidreamcapes Dreamscape Studio",
  description: "Private AI dreamscape portraits, cinematic escape packages, soft travel scenes, and customer-only gallery delivery.",
  parameterSchema: [
    { id: "style", label: "Style", type: "select", options: ["dreamscape", "coastal", "fantasy-avatar", "golden-hour", "storybook-headshot", "editorial-getaway", "soft-glam", "product-reverie"] },
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
    requestJson: { style: "dreamscape", outputCount: 20, worker: "n8n.image.aidreamcapes.v1" },
    resultJson: { outputCount: 20, albumId: "album_aidreamcapes_aria_dreamscape" }
  }
]);
state.albums = replaceWhere(state.albums ?? [], (item) => item.siteId === siteId, [
  {
    id: "album_aidreamcapes_aria_dreamscape",
    siteId,
    customerId: "cust_aidreamcapes_aria",
    title: "Dreamscape portrait set",
    sourceJobId: "job_aidreamcapes_1001",
    creativePackId: "pack_aidreamcapes_dreamscape",
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
    label: "Dreamscape set cover",
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
