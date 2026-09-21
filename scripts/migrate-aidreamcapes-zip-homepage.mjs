#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { PrismaClient } from "@prisma/client";
import ts from "typescript";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const siteId = process.env.AIDREAMCAPES_SITE_ID || "site_aidreamcapes";
const applyDraft = process.argv.includes("--apply-draft");
const applyProduction = hasArgument("--apply-production");
assert.equal(!(applyDraft && applyProduction), true, "Choose exactly one homepage apply target.");
const apply = applyDraft || applyProduction;
const confirmation = argumentValue("--confirm") ?? "";
if (apply) {
  assertDatabaseTarget({
    expectedTarget: applyProduction ? "production" : "local",
    requireProductionConfirmation: applyProduction,
    productionConfirmed: confirmation === "production"
  });
  assert.equal(confirmation, applyProduction ? "production" : siteId, `Applying requires --confirm=${applyProduction ? "production" : siteId}.`);
}
const assetRoot = "/assets/sites/site_aidreamcapes/homepage-seo";

function loadZipNavigation() {
  const navigationPath = path.join(repoRoot, "src/lib/aidreamcapes-navigation.ts");
  const source = fs.readFileSync(navigationPath, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const moduleRecord = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRecord, exports: moduleRecord.exports });
  const value = moduleRecord.exports;
  return {
    actions: {
      pricing: { label: "Pricing", href: "/pricing" },
      login: { label: "Log in", href: "/login" },
      getStarted: { label: "Get Started", href: "/app/create" }
    },
    video: { label: "Video", groups: value.aidreamcapesZipVideoGroups, collection: value.aidreamcapesZipVideoCollection },
    image: { label: "Image", groups: value.aidreamcapesZipImageGroups, collection: value.aidreamcapesZipImageCollection },
    marketing: { label: "Marketing", groups: value.aidreamcapesZipMarketingGroups, collection: value.aidreamcapesZipMarketingCollection },
    scenarios: { label: "Scenarios", groups: value.aidreamcapesZipScenarioGroups, collection: value.aidreamcapesZipScenarioCollection },
    footerGroups: value.aidreamcapesZipFooterGroups
  };
}

const imageData = {
  product: ["ai-product-image-to-video-smartwatch-product-shot.webp", "White smartwatch product photo on a mint studio background", 800, 1000],
  productOutput: ["ai-product-image-to-video-ugc-creator-smartwatch.webp", "Creator holding a white smartwatch toward the camera in a casual UGC-style scene", 720, 1280],
  urlOg: ["ai-product-url-to-ugc-ad-workflow.webp", "Product page transforming into several vertical UGC ad concepts", 1120, 720],
  urlWorkflow: ["ai-url-to-ad-smartwatch-workflow.webp", "Laptop and phone showing a smartwatch product page and ad creative workflow", 720, 900],
  ugc: ["ai-ugc-product-ad-skincare-creator.webp", "Creator presenting a skincare bottle while filming a UGC product ad", 720, 900],
  hooks: ["ai-video-hook-variants-smartwatch.webp", "Three smartwatch ad opening concepts shown as hook variations", 720, 900],
  talkingPhoto: ["ai-talking-photo-presenter-portrait.webp", "Natural presenter portrait prepared for a talking photo video", 720, 900],
  productDemo: ["ai-product-demo-sneaker-multi-angle.webp", "Premium sneaker product image prepared for a multi-angle product demo video", 720, 900],
  unboxing: ["ai-unboxing-video-product-experience.webp", "Hands opening an ecommerce package in a home unboxing scene", 720, 900],
  beforeAfter: ["ai-before-after-skincare-results.webp", "Side-by-side skincare before and after portrait comparison", 720, 900],
  promo: ["ai-promo-sale-product-campaign.webp", "Luxury ecommerce products styled for a seasonal promotional campaign", 720, 900],
  adHooks: ["ai-ad-hook-variants-testing.webp", "Three skincare ad opening concepts displayed side by side for hook testing", 900, 600],
  actor: ["ai-actor-product-ad-skincare-demo.webp", "Presenter holding a skincare bottle in a bright home setting for a product ad", 900, 600],
  mainImage: ["ai-ecommerce-product-main-image-running-shoe.webp", "Red running shoe centered on a clean white ecommerce background", 720, 720],
  onModel: ["ai-on-model-fashion-photo-beige-set.webp", "Woman wearing a neutral beige outfit in a clean fashion studio", 720, 720],
  headshot: ["ai-professional-headshot-business-woman.webp", "Professional business headshot of a smiling woman on a gray background", 720, 720],
  macro: ["ai-product-macro-detail-shoe-material.webp", "Close-up of sneaker suede, leather, stitching and laces", 720, 720],
  lookbook: ["ai-fashion-lookbook-editorial-portrait.webp", "Editorial fashion portrait in a warm minimalist interior", 720, 720],
  lifestyle: ["ai-ecommerce-lifestyle-photo-water-bottle.webp", "Reusable green bottle featured in a bright wellness lifestyle scene", 720, 720],
  feed: ["ai-social-feed-ad-image-wellness-product.webp", "Wellness product styled in a calm sunlit social feed composition", 720, 720],
  background: ["ai-background-removal-product-image-perfume.webp", "Perfume bottle isolated on a transparent background after background removal", 720, 720],
  tryOn: ["ai-virtual-try-on-fashion-model-blazer.webp", "Model wearing a beige blazer and jeans in a virtual try-on fashion preview", 720, 720]
};

const src = (name) => `${assetRoot}/${name}`;
const image = (key, role = "content") => {
  const [filename, alt, width, height] = imageData[key];
  return { src: src(filename), alt, width, height, role, loading: role === "hero" ? "eager" : "lazy", fetchPriority: role === "hero" ? "high" : "auto", filename };
};
const imageSettings = (item) => ({ imageUrl: item.src, imageAlt: item.alt, imageWidth: item.width, imageHeight: item.height, imageLoading: item.loading, imageFetchPriority: item.fetchPriority });
const block = (id, type, settings) => ({ id, type, settings });
const card = (id, type, title, description, href, media, extra = {}) => block(id, type, { title, description, href, ...(media ? imageSettings(media) : {}), ...extra });

const zipImages = Object.values(imageData).map(([filename]) => pathForAsset(src(filename)));
function pathForAsset(assetPath) {
  return `${repoRoot}/public${assetPath}`;
}
for (const file of zipImages) if (!fs.existsSync(file)) throw new Error(`Missing ZIP homepage asset: ${file}`);

function homepageJson(existing) {
  const hero = image("product", "hero");
  const output = image("productOutput", "hero");
  const videoCards = [
    card("video_ugc", "video_card", "UGC Product Ad", "Meta / TikTok tests", "/ai-video-generation/ugc-ad-video", image("ugc"), { badge: "#1 Ads" }),
    card("video_url_ad", "video_card", "URL → Ad", "PDP link to creatives", "/ai-video-generation/url-to-ad", image("urlWorkflow")),
    card("video_hooks", "video_card", "Hook variants", "First 3 seconds", "/ai-video-generation/video-ad", image("hooks")),
    card("video_talking", "video_card", "Talking Photo", "Pitch on camera", "/ai-video-generation/talking-photo", image("talkingPhoto")),
    card("video_demo", "video_card", "Product Demo", "Still to motion", "/ai-video-generation/product-video", image("productDemo")),
    card("video_unboxing", "video_card", "Unboxing", "Trust creatives", "/ai-video-generation/product-video", image("unboxing")),
    card("video_before_after", "video_card", "Before–After", "Result ads", "/ai-video-generation/before-after-showcases", image("beforeAfter")),
    card("video_promo", "video_card", "Promo / Sale", "Launch creatives", "/ai-video-generation/promo-video", image("promo"))
  ];
  const photoCards = [
    card("photo_main", "photo_card", "Ecommerce Main Image", "", "/ai-image-generation/ecommerce-main-image", image("mainImage")),
    card("photo_on_model", "photo_card", "On-Model Generation", "", "/ai-image-generation/on-model-generation", image("onModel")),
    card("photo_headshot", "photo_card", "Professional Headshot", "", "/ai-image-generation/professional-headshot", image("headshot")),
    card("photo_macro", "photo_card", "Macro Details", "", "/ai-image-generation/macro-details", image("macro")),
    card("photo_lookbook", "photo_card", "Lookbook Cover", "", "/ai-image-generation/lookbook-cover", image("lookbook")),
    card("photo_lifestyle", "photo_card", "Lifestyle Scene", "", "/ai-image-generation/lifestyle-scene", image("lifestyle")),
    card("photo_feed", "photo_card", "Feed Ad Still", "", "/ai-image-generation/feed-ad-still", image("feed")),
    card("photo_background", "photo_card", "BG Remove / Replace", "", "/ai-image-generation/background-remove-replace", image("background")),
    card("photo_try_on", "photo_card", "Virtual Try-On", "", "/ai-image-generation/virtual-try-on", image("tryOn"))
  ];
  const scenarios = [
    ["Engagement", "Love", "Announcement stills & story clips", "/ai-save-the-date/engagement"],
    ["Wedding", "Love", "Mood, invites, guest updates", "/ai-save-the-date/wedding-invitation"],
    ["Birthday", "Celebrate", "Wish & invite sets", "/ai-save-the-date/birthday"],
    ["Christmas", "Seasonal", "Holiday cards & greetings", "/ai-save-the-date/christmas"],
    ["Anniversary", "Celebrate", "Milestone films & portraits", "/ai-save-the-date/wedding-anniversary"],
    ["Valentine’s", "Seasonal", "Couple stills & clips", "/ai-save-the-date/valentines-day"],
    ["Thank You", "Celebrate", "After events or orders", "/ai-save-the-date/thank-you"],
    ["Proposal", "Love", "Story beats to share", "/ai-save-the-date/proposal"]
  ].map(([title, category, description, href], index) => block(`scenario_${index + 1}`, "scenario_card", { title, category, description, href, tone: index % 3 === 0 ? "purple" : index % 3 === 1 ? "pink" : "blue" }));
  const workflow = [
    ["Choose a workflow", "Marketing UGC, video tool, or image set."],
    ["Upload or paste URL", "Product images, portraits, or a PDP link."],
    ["Review credits", "Cost visible before generate."],
    ["Deliver to gallery", "Review privately, download or iterate."]
  ].map(([title, description], index) => block(`how_${index + 1}`, "step", { title, description }));
  const credits = [
    ["Shown on request", "Every job lists credit cost first."],
    ["Reserve → settle", "Reserved on start; settled on success."],
    ["Failed jobs release", "Failed requests can release reservation."],
    ["Private by default", "Uploads and albums stay in-account."]
  ].map(([title, description], index) => block(`credit_${index + 1}`, "rule", { title, description }));
  const outputCards = [image("productOutput"), image("hooks"), image("productDemo")].map((media, index) => block(`workflow_output_${index + 1}`, "workflow_output", imageSettings(media)));
  const adFeatures = [
    card("ad_hook_lab", "ad_feature", "Hook Lab", "Generate dozens of first-3-second variations to test retention rates.", "", image("adHooks")),
    card("ad_actor", "ad_feature", "AI Actor Product Ads", "Lifelike virtual avatars speaking your script with natural hand gestures holding products.", "/ai-video-generation/talking-head-video", image("actor"), { ctaLabel: "Explore Actors →" })
  ];

  const old = existing || {};
  const existingPricing = old.sections?.pricing_1 || { type: "pricing_table", settings: {}, blocks: [] };
  const existingProof = old.sections?.proof_1 || { type: "testimonial_wall", settings: {}, blocks: [] };
  const existingFaq = old.sections?.faq_1 || { type: "faq", settings: {}, blocks: [] };
  const existingConversion = old.sections?.conversion_1 || { type: "conversion_panel", settings: {}, blocks: [] };
  return {
    pageType: "home",
    version: 1,
    sectionsOrder: ["aidreamcapes_hero", "aidreamcapes_video_grid", "aidreamcapes_ad_testing", "aidreamcapes_photo_grid", "aidreamcapes_scenarios", "aidreamcapes_how", "aidreamcapes_credits", "pricing_1", "proof_1", "faq_1", "conversion_1"],
    sections: {
      aidreamcapes_hero: { type: "aidreamcapes_home_hero", settings: { anchor: "home", eyebrow: "Marketing UGC studio is live", title: "Create AI Videos, Professional AI Ads & Photo Sets.", titleLine1: "Create AI Videos,", titleAccent: "Professional AI Ads", titleLine3: "& Photo Sets.", intro: "Turn a simple URL or product image into high-converting UGC videos and studio-quality imagery. Perfect for scaling your e-commerce campaigns and marketing assets instantly.", primaryCta: "Create Marketing UGC", primaryHref: "/ai-video-generation/url-to-ad", secondaryCta: "Explore video tools", secondaryHref: "/ai-video-generation", trustEyebrow: "Review credits before generation", googleCta: "Continue with Google", googleHref: "/login?provider=google", emailSeparator: "or", emailPlaceholder: "Email address", emailCta: "Start with email", emailHref: "/login", studioUrl: "aidreamcapes.com/studio", studioWorkflowLabel: "Product → Video", studioWorkflowIntro: "Upload a product still. Get a vertical UGC ad clip.", studioProductLabel: "01 · Product", studioProductFilename: "product-watch.jpg", studioProcessLabel: "Rendering", studioOutputLabel: "02 · UGC Video", studioOutputMeta: "9:16 · Hook + demo · 8s", studioStep1: "1. Drop product photo", studioStep2: "2. Pick UGC style", studioStep3: "3. Export vertical ad", imageUrl: hero.src, imageAlt: hero.alt, imageWidth: hero.width, imageHeight: hero.height, outputImageUrl: output.src, outputImageAlt: output.alt, outputImageWidth: output.width, outputImageHeight: output.height, outputHref: "/ai-video-generation/url-to-ad", outputCta: "Turn product into video →" }, blocks: [block("hero_trust_private", "trust_item", { label: "Private uploads" }), block("hero_trust_credits", "trust_item", { label: "Credits visible" }), block("hero_trust_refund", "trust_item", { label: "Refund review" }), block("hero_stat_ugc", "stat", { value: "UGC-first", label: "Marketing hub for ad tests" }), block("hero_stat_video", "stat", { value: "22+", label: "AI video workflows" }), block("hero_stat_image", "stat", { value: "39+", label: "AI image workflows" }), block("hero_stat_private", "stat", { value: "Private", label: "Uploads, albums, checkout" })] },
      aidreamcapes_video_grid: { type: "aidreamcapes_video_grid", settings: { anchor: "video-generation", title: "Explore AI Video Generation", intro: "UGC ads, URL→Ad, hooks, demos, and social-ready formats.", ctaLabel: "View all video", ctaHref: "/ai-video-generation" }, blocks: videoCards },
      aidreamcapes_ad_testing: { type: "aidreamcapes_ad_testing", settings: { anchor: "ad-testing", eyebrow: "Ad Testing Hub", title: "High-Converting UGC Ads at Scale", intro: "Deploy tested ad frameworks (PAS, Hooks, Testimonials) optimized for social algorithms without shooting a single frame.", workflowTitle: "URL to Ad Workflow", workflowIntro: "Paste a product link. Aidreamcapes turns the product context into ad-ready creative directions you can review before publishing.", outputTitle: "Review UGC Ad Concepts", outputIntro: "Compare several creative directions before export." }, blocks: [block("url_to_ad", "url_to_ad", { title: "Paste Product URL", description: "Start from a product page or product image.", urlPlaceholder: "https://yourstore.com/product", ...imageSettings(image("product")) }), ...outputCards, ...adFeatures] },
      aidreamcapes_photo_grid: { type: "aidreamcapes_photo_grid", settings: { anchor: "photo-sets", title: "Professional AI Photo Sets", intro: "Listing heroes, lifestyle scenes, feed stills, on-model, try-on, and headshots.", ctaLabel: "View all photo", ctaHref: "/ai-image-generation" }, blocks: photoCards },
      aidreamcapes_scenarios: { type: "aidreamcapes_scenario_grid", settings: { anchor: "scenarios", title: "Occasion Scenarios", intro: "Personal and seasonal moments—after Marketing. Stills, video, or both.", ctaLabel: "View all scenarios", ctaHref: "/ai-save-the-date/save-the-date" }, blocks: scenarios },
      aidreamcapes_how: { type: "aidreamcapes_how_it_works", settings: { anchor: "how-it-works", title: "How it works", intro: "Upload approved photos or a product URL, review credits, generate in your private workspace." }, blocks: workflow },
      aidreamcapes_credits: { type: "aidreamcapes_credit_rules", settings: { anchor: "credits", title: "Credits, clear before you spend", intro: "Plans refill monthly. Top-ups when you need more tests." }, blocks: credits },
      pricing_1: { ...existingPricing, settings: { ...existingPricing.settings, title: "Subscription Plans", anchor: "plans", subtitle: "Scale your creative output. Cancel anytime.", description: "Use credits across eligible AI photo and video workflows. The required credit cost is shown before generation.", billingMonthlyLabel: "Monthly", billingYearlyLabel: "Yearly", billingDiscountLabel: "-20%", billingPeriodLabel: "/mo", pricingHref: "/pricing" }, blocks: [block("plan_starter", "plan", { productId: "prod_aidreamcapes_starter", name: "Starter", description: "For individuals exploring AI generation.", features: "200 monthly credits|Private photo albums|AI photo editor + filters|Create AI videos|No watermark", cta: "Subscribe", href: "/pricing", featured: "false" }), block("plan_pro", "plan", { productId: "prod_aidreamcapes_pro", name: "Pro", description: "For marketers and e-commerce brands.", features: "300 monthly credits|UGC URL-to-Ad + Hook Lab|AI Actor product ads|Private albums + video tools|Magic Upscaler · no watermark", cta: "Subscribe Pro", href: "/pricing", featured: "true", badge: "Most Popular" }), block("plan_premium", "plan", { productId: "prod_aidreamcapes_premium", name: "Premium", description: "Highest allowance for repeat albums, ads, and premium outputs.", features: "600 monthly credits|Everything in Pro|Priority render queue|4K ultra-high outputs|Team-ready commercial use", cta: "Choose Premium", href: "/pricing", featured: "false" })] },
      proof_1: { ...existingProof, settings: { ...existingProof.settings, title: "What Our Customers Say", anchor: "reviews" } },
      faq_1: { ...existingFaq, settings: { ...existingFaq.settings, title: "FAQ", anchor: "faq", subtitle: "Credits, UGC ads, uploads, and delivery—answered before you spend.", fullFaqLabel: "Full FAQ →", fullFaqHref: "/faq" } },
      conversion_1: { ...existingConversion, settings: { ...existingConversion.settings, title: "Ready to try Aidreamcapes?", anchor: "start", audienceLabel: "Built for", subtitle: "Create AI videos, UGC ad concepts, and ecommerce image sets in one private workspace.", primaryCta: "Get Started Free", primaryHref: "/app/create", secondaryCta: "See pricing", secondaryHref: "/pricing" }, blocks: [...(existingConversion.blocks || []).filter((item) => item.type !== "audience_item"), block("audience_dtc", "audience_item", { label: "DTC brands" }), block("audience_performance", "audience_item", { label: "Performance marketers" }), block("audience_sellers", "audience_item", { label: "Ecommerce sellers" }), block("audience_agencies", "audience_item", { label: "Agencies" }), block("audience_creators", "audience_item", { label: "Creators" }), block("audience_apps", "audience_item", { label: "App growth teams" })] }
    },
    mediaManifest: Object.values(imageData).map(([filename, alt, width, height], index) => ({ src: src(filename), alt: alt || "Aidreamcapes homepage creative", width, height, role: index === 0 ? "hero" : "content", loading: index === 0 ? "eager" : "lazy", fetchPriority: index === 0 ? "high" : "auto", filename })),
    seo: { title: "AI UGC Ads, Product Videos & Ecommerce Photos | Aidreamcapes", description: "Create UGC ad concepts, product videos and ecommerce image sets from product images or URLs in one private workspace.", twitterDescription: "Create UGC ad concepts, product videos and ecommerce image sets from product images or URLs.", keywords: "AI UGC ads, product videos, ecommerce photos, URL to ad, AI marketing workflows", canonical: "https://www.aidreamcapes.com/", canonicalPath: "/", ogImage: src(imageData.urlOg[0]), ogImageAlt: imageData.urlOg[1], index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } }
  };
}

const homepageImagePool = Object.values(imageData).map(([filename, alt, width, height]) => ({ src: src(filename), alt, width, height }));
let homepageImageCursor = 0;
function isLegacyHomepageImage(value) {
  return typeof value === "string" && /\/assets\/sites\/site_aidreamcapes\/(?:fan-holiday-theme|creative-packs|homepage-showcase\/images)\/.*\.(?:avif|gif|jpe?g|png|webp)(?:[?#].*)?$/i.test(value);
}
function replaceLegacyHomepageImages(value) {
  if (isLegacyHomepageImage(value)) {
    const replacement = homepageImagePool[homepageImageCursor++ % homepageImagePool.length];
    return replacement.src;
  }
  if (Array.isArray(value)) return value.map(replaceLegacyHomepageImages);
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (key === "src" && isLegacyHomepageImage(child)) {
      const replacement = homepageImagePool[homepageImageCursor++ % homepageImagePool.length];
      next[key] = replacement.src;
      if (typeof value.alt === "string") next.alt = replacement.alt;
      if (typeof value.width === "number") next.width = replacement.width;
      if (typeof value.height === "number") next.height = replacement.height;
    } else if ((key === "imageUrl" || key === "avatarUrl" || key === "resultImageUrl" || key === "backgroundImage" || key === "imageList") && isLegacyHomepageImage(child)) {
      const replacement = homepageImagePool[homepageImageCursor++ % homepageImagePool.length];
      next[key] = replacement.src;
    } else {
      next[key] = replaceLegacyHomepageImages(child);
    }
  }
  return next;
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { settings: true, pages: true } });
  if (!site) throw new Error(`Site not found: ${siteId}`);
  const page = site.pages.find((item) => item.slug === "/");
  if (!page) throw new Error("Aidreamcapes homepage page record was not found");
  const current = page.draftJson || page.publishedJson || {};
  homepageImageCursor = 0;
  const nextPage = replaceLegacyHomepageImages(homepageJson(current));
  const nextPageSerialized = JSON.stringify(nextPage);
  assert.equal(/\/assets\/sites\/site_aidreamcapes\/(?:fan-holiday-theme|creative-packs|homepage-showcase\/images)\/.*\.(?:avif|gif|jpe?g|png|webp)/i.test(nextPageSerialized), false, "homepage still contains a legacy image asset");
  const currentSettings = site.settings?.draftJson || site.settings?.publishedJson || {};
  const homeSeo = nextPage.seo;
  const currentFooter = currentSettings.globalSections?.footer || { type: "footer", blocks: [], settings: {} };
  const nextFooter = {
    ...currentFooter,
    settings: {
      ...currentFooter.settings,
      title: "Aidreamcapes",
      homeHref: "/",
      tagline: "The ultimate generative AI studio for e-commerce, marketing, and creative professionals.",
      copyright: "© 2026 Aidreamcapes. All rights reserved.",
      xLabel: "𝕏",
      linkedInLabel: "in"
    }
  };
  const nextSettings = {
    ...currentSettings,
    aidreamcapesZipNavigation: loadZipNavigation(),
    globalSections: { ...currentSettings.globalSections, footer: nextFooter },
    colors: { ...currentSettings.colors, background: "#050505", muted: "#0a0a0a", foreground: "#ffffff", accent: "#8b5cf6" },
    radii: { ...currentSettings.radii, control: 14, section: 24 },
    typography: { ...currentSettings.typography, body: "Outfit, ui-sans-serif, system-ui, sans-serif", display: "Outfit, ui-sans-serif, system-ui, sans-serif" },
    saasSettingsCurrent: { ...currentSettings.saasSettingsCurrent, skin_bg: "#050505", skin_text_color: "#d4d4d8", skin_title_color: "#ffffff", skin_primary_btn_bg_color: "linear-gradient(90deg,#8b5cf6 0%,#ec4899 52%,#3b82f6 100%)", skin_primary_btn_text_color: "#ffffff", general_layout_width: 1400 },
    seo: { ...currentSettings.seo, pages: { ...currentSettings.seo?.pages, site_aidreamcapes_home: homeSeo } }
  };
  let backupPath = null;
  if (apply) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = path.resolve("releases/backups/aidreamcapes", `homepage-draft-${stamp}.json`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      siteId,
      themePage: { id: page.id, slug: page.slug, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson },
      themeSettings: site.settings ? { id: site.settings.id, draftJson: site.settings.draftJson, publishedJson: site.settings.publishedJson } : null
    }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction([
      prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextPage, title: "AI UGC Ads, Product Videos & Ecommerce Photos" } }),
      prisma.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: {} }, update: { draftJson: nextSettings } })
    ]);
  }
  const readback = apply ? await prisma.themePage.findUnique({ where: { id: page.id }, select: { draftJson: true, publishedJson: true, title: true } }) : null;
  console.log(JSON.stringify({ siteId, domain: site.primaryDomain, mode: applyProduction ? "production-draft-only" : applyDraft ? "draft-only" : "dry-run", backupPath, zipHomepage: { sections: nextPage.sectionsOrder, images: nextPage.mediaManifest.length, imageRoot: assetRoot, seo: nextPage.seo }, readback: readback ? { title: readback.title, draftSections: readback.draftJson?.sectionsOrder, publishedStillUnchanged: JSON.stringify(readback.publishedJson) === JSON.stringify(page.publishedJson) } : null }, null, 2));
} finally {
  await prisma.$disconnect();
}
