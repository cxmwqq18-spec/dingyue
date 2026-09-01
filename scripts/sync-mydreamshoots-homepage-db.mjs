#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { showcaseStores } from "./dreamshoot-homepage-showcase-data.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = process.env.SYNC_SITE_ID?.trim() || "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
if (siteId === "site_dreamshoot") {
  assertDatabaseTarget({ expectedTarget: "local" });
  assert(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
  assert(parsed.port === "15433", `homepage DB sync must use local port 15433 (received ${parsed.port})`);
} else if (siteId === "site_grownstride_test") {
  assertDatabaseTarget({ expectedTarget: "test" });
  assertNonProductionWriteTarget();
} else {
  throw new Error(`homepage DB sync refuses unsupported site ${siteId}`);
}

const repoRoot = process.cwd();
const backupDir = path.join(repoRoot, "releases", "backups");
const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function homepageJsonFrom(siteRecord) {
  const page = siteRecord.pages.find((candidate) => candidate.slug === "/");
  assert(page, "MyDreamShoots homepage is required");
  return { page, json: clone(page.draftJson ?? page.publishedJson) };
}

function pageJsonFromSlug(siteRecord, slug) {
  const page = siteRecord.pages.find((candidate) => candidate.slug === slug);
  assert(page, `${slug} page is required`);
  return { page, json: clone(page.draftJson ?? page.publishedJson) };
}

const catalogOrder = [
  "soccer",
  "portrait-photo",
  "gala-photo",
  "headshot",
  "hairstyle-generator",
  "cyberpunk",
  "mafia",
  "travel",
  "urban",
  "virtual-try-on",
  "avatar",
  "street-style",
  "motion-generator",
  "photo-enhancer",
  "christmas-photo",
  "thanksgiving-photo"
];

const subscriptionMetadata = {
  Starter: {
    badgeLabel: "Photo plan",
    summary: "A practical starting plan for first private albums and quick profile sets.",
    features: [],
    sidePanelItems: []
  },
  Pro: {
    badgeLabel: "Most popular",
    summary: "More credits for several albums, edits, and style tests.",
    features: [],
    sidePanelItems: []
  },
  Premium: {
    badgeLabel: "Best value",
    summary: "The highest credit allowance for repeat albums, video ideas, and premium outputs.",
    features: [],
    sidePanelItems: []
  }
};

function menuLink(id, label, href, group) {
  return { id, type: "menu_link", settings: { label, href, group } };
}

function mergeFooter(settings) {
  const next = clone(settings);
  next.navigation ??= {};
  next.navigation.footerLinks = [
    ["AI Video Generation", "/ai-video-generation", "product"],
    ["AI Save the Date", "/ai-save-the-date/save-the-date", "product"],
    ["AI Image Generation", "/ai-image-generation", "product"],
    ["AI Photo Packages", "/best-packages", "product"],
    ["Pricing", "/pricing", "product"],
    ["How it works", "/workflow", "product"],
    ["Blog", "/blog", "company"],
    ["About us", "/about-us", "company"],
    ["Contact us", "/contact-us", "company"],
    ["Creators Circle", "/creators-circle", "company"],
    ["Refund Policy", "/refunds", "company"],
    ["Privacy Policy", "/privacy", "support"],
    ["Content policy", "/content", "support"],
    ["Terms of Service", "/terms", "support"],
    ["Cookie Policy", "/cookies", "support"]
  ].map(([label, href, group], index) => ({ label, href, group, id: `footer_nav_${group}_${index + 1}` }));
  next.globalSections ??= {};
  next.globalSections.footer ??= { type: "footer", settings: {}, blocks: [] };
  next.globalSections.footer.settings = {
    ...(next.globalSections.footer.settings ?? {}),
    title: "myDreamshoots",
    tagline: "AI videos, Save the Date moments, photo sets, and private album delivery with visible credit costs",
    body: "Upload your photos, choose a video or photo workflow, review the credit cost, and download private results.",
    bottomLine: "Credits, AI video and photo projects, private albums, and checkout stay inside your account.",
    productHeading: "Explore",
    companyHeading: "Content",
    supportHeading: "Support",
    socialHeading: "Why it works",
    socialBody: "myDreamshoots helps you turn your own photos into AI videos, Save the Date moments, private AI headshots, portraits, and themed albums.",
    instagramUrl: "https://www.instagram.com/blydey_inc",
    facebookUrl: "https://www.facebook.com/blydeyinc",
    youtubeUrl: "https://www.youtube.com/@blydey-inc",
    showPaymentIcons: true
  };
  next.globalSections.footer.blocks = [
    ["AI Video Generation", "/ai-video-generation", "product"],
    ["AI Save the Date", "/ai-save-the-date/save-the-date", "product"],
    ["AI Image Generation", "/ai-image-generation", "product"],
    ["AI Photo Packages", "/best-packages", "product"],
    ["Pricing", "/pricing", "product"],
    ["How it works", "/workflow", "product"],
    ["Blog", "/blog", "company"],
    ["About us", "/about-us", "company"],
    ["Contact us", "/contact-us", "company"],
    ["Creators Circle", "/creators-circle", "company"],
    ["Refund Policy", "/refunds", "company"],
    ["Privacy Policy", "/privacy", "support"],
    ["Content policy", "/content", "support"],
    ["Terms of Service", "/terms", "support"],
    ["Cookie Policy", "/cookies", "support"]
  ].map(([label, href, group], index) => menuLink(`dreamshoot_footer_${group}_${index + 1}`, label, href, group));
  return next;
}

function mergeHomepage(pageJson, templateHome, pricingPageJson) {
  const next = clone(pageJson);
  const templateGeneration = templateHome.sections?.generation_showcase_1;
  assert(templateGeneration, "studio template must provide generation_showcase_1");
  next.sections ??= {};
  next.sectionsOrder ??= Object.keys(next.sections);
  next.seo = {
    ...(next.seo ?? {}),
    title: "AI Video & Photo Generator | myDreamshoots",
    description: "Create AI videos from your photos, professional AI headshots, portraits, and themed photo sets. Make personalized Save the Date videos with myDreamshoots.",
    keywords: "AI headshot generator, AI portrait generator, AI photo packages, AI photo editor, AI video workflows",
    canonicalPath: "/",
    index: true,
    follow: true,
    robots: { index: true, follow: true }
  };
  next.sections.generation_showcase_1 = {
    ...clone(next.sections.generation_showcase_1 ?? {}),
    ...clone(templateGeneration),
    settings: {
      ...clone(next.sections.generation_showcase_1?.settings ?? {}),
      ...clone(templateGeneration.settings),
      showTrustedLogoIntro: true,
      trustedLogoEyebrow: "CREATIVE SHOWCASE",
      trustedLogoTitle: "Empowering creators worldwide",
      trustedLogoSubtitle: "Ideas, brands and visual experiments brought together with AI.",
      aboutTitle: "What is myDreamshoots?",
      aboutBody: "myDreamshoots is an AI video and photo generation platform that turns your images into AI videos, personalized Save the Date videos, professional AI headshots, portraits, couple photos, and themed photo sets.",
      embeddedPricingSectionId: "pricing_1",
      trustedLogoSplitIndex: 15
    },
    blocks: clone(templateGeneration.blocks ?? [])
  };
  delete next.sections.generation_showcase_1.settings.imageSlugs;
  delete next.sections.generation_showcase_1.settings.videoSlugs;
  const hero = next.sections.hero_1;
  if (hero) {
    hero.settings = {
      ...(hero.settings ?? {}),
      eyebrow: "AI Video & Photo Creation",
      heroBadge: "AI Video & Photo Creation",
      headline: "Create AI Videos, Professional AI Headshots & Photo Sets from Your Images",
      subheadline: "Upload your photos and choose what you want to create—from AI videos and personalized Save the Date videos to professional AI headshots, portraits, couple photos, seasonal images, and creative photo sets. Review examples and credit costs before generation, then access your finished results in your workspace.",
      bulletList: "Training policy - {LIVE_TRAINING_POLICY_STATEMENT}|Source-photo retention - Source photos follow the published {LIVE_SOURCE_MEDIA_RETENTION_DAYS}-day retention period.|Refund review - {LIVE_REFUND_REVIEW_POLICY_STATEMENT} Requests should be submitted within {LIVE_REFUND_WINDOW_DAYS} days.|Secure account workflow - Uploads, requests, credit review, and galleries stay inside your signed-in account.",
      imageBadge: "AI video & photo workflows",
      imageCaption: "Create AI videos and photo sets for social content, Save the Date moments, professional profiles, portraits, couple photos, seasonal images, and creative projects.",
      authRibbon: "Review credits before generation",
      socialProofLabel: "Private uploads, requests, galleries"
    };
    hero.blocks = (hero.blocks ?? []).map((entry) => {
      if (entry.id === "hero_cta_secondary") return { ...entry, settings: { ...(entry.settings ?? {}), label: "Explore AI Video", href: "/ai-video-generation" } };
      if (entry.id === "hero_stat_packs") return { ...entry, settings: { ...(entry.settings ?? {}), value: "Video + Photo", label: "AI video & photo workflows" } };
      return entry;
    });
    next.sections.hero_1 = hero;
  }
  const pricing = clone(pricingPageJson?.sections?.pricing_1 ?? templateHome.sections?.pricing_1);
  if (pricing) {
    pricing.settings = {
      ...(pricing.settings ?? {}),
      title: "Subscription Plans",
      subtitle: "Compare the current price, included credits, renewal interval, and supported workflows before selecting a plan.",
      marketComparison: "Choose a monthly, quarterly, or semiannual plan based on the credits you expect to use. Compare the current price, included credits, renewal interval, and supported workflows before selecting a plan.",
      description: "Use credits across eligible AI photo and video workflows. The required credit cost is shown before generation.",
      sidePanelEyebrow: "Why people subscribe",
      sidePanelTitle: "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option.",
      sidePanelBody: "Review the credit cost before each generation and use the current plan or top-up options when you need additional runs."
    };
    next.sections.pricing_1 = pricing;
  }
  const reviews = clone(templateHome.sections?.proof_1);
  if (reviews) {
    const reviewOverrides = {
      proof_chloe: { role: "Creator workflow", meta: "Creator scenes", quote: "The theme labels helped me explain options to a client. We tested portrait photos, holiday images, and short motion ideas from the same source photos." },
      proof_eli: { role: "Headshots and cards", meta: "Headshots and cards", quote: "Good quality, clear wording, and no confusing checkout surprise. I knew what each generation would use before starting the album." },
      proof_jordan: { role: "Seasonal and profile images", meta: "Seasonal and profile images", quote: "I compared the creator, holiday, and profile directions before choosing a set. The result previews made the decision much easier." },
      proof_riley: { role: "Image and video examples", meta: "Image and video examples", quote: "The short motion examples gave our social team a clear visual reference before we planned the next image set." }
    };
    reviews.blocks = (reviews.blocks ?? []).map((block) => {
      const override = reviewOverrides[block.id];
      return override ? { ...block, settings: { ...block.settings, ...override } } : block;
    });
    next.sections.proof_1 = reviews;
  }
  delete next.sections.package_catalog_1;
  // Pricing is embedded by the showcase renderer and must remain out of the ordered sections.
  next.sectionsOrder = next.sectionsOrder.filter((id) => id !== "package_catalog_1" && id !== "pricing_1");
  return next;
}

function mergeBestGallery(pageJson, kind, videoSlugs = []) {
  const next = clone(pageJson);
  const sectionEntry = Object.entries(next.sections ?? {}).find(([sectionId, section]) => section?.type === "dreamshoot_media_gallery" && sectionId);
  assert(sectionEntry, `best ${kind} gallery section is required`);
  const [sectionId, section] = sectionEntry;
  next.sections[sectionId] = {
    ...section,
    settings: {
      ...section.settings,
      kind,
      title: kind === "video" ? "Best Video Generator" : "Best Photo Generator",
      ...(kind === "video"
        ? { fullGallery: false, videoSlugs: videoSlugs.join("|") }
        : { fullGallery: false, imageItemLimit: 16, imageSlugs: catalogOrder.join("|") })
    }
  };
  return next;
}

const prisma = new PrismaClient();
try {
  const siteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      connect: true
    }
  });
  assert(siteRecord?.settings, "site and settings are required");
  const mergedThemeSettings = mergeFooter(siteRecord.settings.draftJson ?? siteRecord.settings.publishedJson);
  const pricingPage = siteRecord.pages.find((page) => page.slug === "/pricing");
  const templateHome = dreamshootAiStudioTemplatesForSite({
    id: siteId,
    slug: siteRecord.slug,
    name: siteRecord.name,
    primaryDomain: siteRecord.primaryDomain,
    branding: siteRecord.branding
  }).home;
  const { page: homepage, json: currentJson } = homepageJsonFrom(siteRecord);
  const mergedJson = mergeHomepage(currentJson, templateHome, pricingPage?.draftJson ?? pricingPage?.publishedJson);
  const { page: bestImagePage, json: currentBestImageJson } = pageJsonFromSlug(siteRecord, "/best-ai-image");
  const { page: bestVideoPage, json: currentBestVideoJson } = pageJsonFromSlug(siteRecord, "/best-ai-video");
  const mergedBestImageJson = mergeBestGallery(currentBestImageJson, "image");
  const mergedBestVideoJson = mergeBestGallery(currentBestVideoJson, "video", [
    "motion-generator",
    "talking-photo",
    "cinematic-video",
    "tiktok-video",
    "instagram-reels",
    "product-video",
    "product-ad-video",
    "promo-video"
  ]);
  const showcase = showcaseStores.find((store) => store.siteId === siteId)
    ?? (siteId === "site_grownstride_test" ? showcaseStores.find((store) => store.siteId === "site_dreamshoot") : null);
  assert(showcase, `showcase source missing for ${siteId}`);
  const showcaseCategories = Array.from(new Map([
    ...showcase.videoCategories,
    ...showcase.videoThemes.map((theme) => ({
      slug: theme.categorySlug,
      label: theme.categorySlug.split("-").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" "),
      description: "Published homepage video showcase category."
    }))
  ].map((category) => [category.slug, category])).values());

  const backup = {
    createdAt: new Date().toISOString(),
    siteId,
    themeSettings: siteRecord.settings,
    homepage,
    bestImagePage,
    bestVideoPage,
    pricingPage
  };
  const backupPath = path.join(backupDir, `mydreamshoots-homepage-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      siteId,
      homepageId: homepage.id,
      trustedLogoBlocks: mergedJson.sections.generation_showcase_1.blocks?.length ?? 0,
      homepageCatalogBlocks: 0,
      footerLinks: mergedThemeSettings.navigation.footerLinks.length,
      embedsPricing: mergedJson.sections.generation_showcase_1.settings?.embeddedPricingSectionId === "pricing_1",
      homepageVideoSlugs: undefined,
      bestVideoSlugs: ["motion-generator", "talking-photo", "cinematic-video", "tiktok-video", "instagram-reels", "product-video", "product-ad-video", "promo-video"],
      showcaseVideoThemes: showcase.videoThemes.length,
      wouldWriteBackup: backupPath
    }, null, 2));
  } else {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
  await prisma.$transaction(async (tx) => {
    await tx.themePage.update({ where: { id: homepage.id }, data: { draftJson: mergedJson, publishedJson: mergedJson, updatedAt: new Date() } });
    await tx.themePage.update({ where: { id: bestImagePage.id }, data: { draftJson: mergedBestImageJson, publishedJson: mergedBestImageJson, updatedAt: new Date() } });
    await tx.themePage.update({ where: { id: bestVideoPage.id }, data: { draftJson: mergedBestVideoJson, publishedJson: mergedBestVideoJson, updatedAt: new Date() } });
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson: mergedThemeSettings, updatedAt: new Date() } });
    for (const product of Object.entries(subscriptionMetadata)) {
      const [name, metadata] = product;
      await tx.product.updateMany({ where: { siteId, name, type: "subscription" }, data: { metadata } });
    }
    const monthlyOriginalAmounts = { Starter: 3500, Pro: 5000, Premium: 9000 };
    for (const [name, originalAmountCents] of Object.entries(monthlyOriginalAmounts)) {
      const product = await tx.product.findFirst({ where: { siteId, name, type: "subscription" }, select: { id: true } });
      if (!product) continue;
      await tx.price.updateMany({
        where: { siteId, productId: product.id, interval: "month", status: "active" },
        data: { metadata: { originalAmountCents, discountLabel: "30% off" } }
      });
    }
    for (const category of showcaseCategories) {
      await tx.videoThemeCategory.upsert({
        where: { siteId_slug: { siteId, slug: category.slug } },
        create: { id: `video_cat_${siteId}_${category.slug}`, siteId, slug: category.slug, label: category.label, description: category.description, status: "active", sortOrder: 500, createdAt: new Date(), updatedAt: new Date() },
        update: { label: category.label, description: category.description, status: "active", updatedAt: new Date() }
      });
    }
    const categories = await tx.videoThemeCategory.findMany({ where: { siteId, slug: { in: showcaseCategories.map((category) => category.slug) } }, select: { id: true, slug: true } });
    const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));
    for (const theme of showcase.videoThemes) {
      const categoryId = categoryIds.get(theme.categorySlug);
      if (!categoryId) throw new Error(`missing showcase video category ${theme.categorySlug}`);
      await tx.videoTheme.upsert({
        where: { siteId_slug: { siteId, slug: theme.slug } },
        create: {
          id: `video_theme_${siteId}_${theme.slug}`,
          siteId,
          categoryId,
          slug: theme.slug,
          name: theme.name,
          headline: theme.headline,
          description: theme.description,
          prompt: theme.prompt,
          status: "active",
          creditCost: theme.creditCost,
          durationSeconds: theme.durationSeconds,
          maxFrames: 10,
          sortOrder: 500 + showcase.videoThemes.indexOf(theme),
          imageUrl: `${showcase.publicRoot}/posters/${theme.slug}.webp`,
          galleryImages: [`${showcase.publicRoot}/videos/${theme.slug}.mp4`],
          createdAt: new Date(),
          updatedAt: new Date()
        },
        update: {
          categoryId,
          name: theme.name,
          headline: theme.headline,
          description: theme.description,
          prompt: theme.prompt,
          status: "active",
          creditCost: theme.creditCost,
          durationSeconds: theme.durationSeconds,
          imageUrl: `${showcase.publicRoot}/posters/${theme.slug}.webp`,
          galleryImages: [`${showcase.publicRoot}/videos/${theme.slug}.mp4`],
          updatedAt: new Date()
        }
      });
    }
  }, { timeout: 120_000 });

    const manifest = await prepareDraftPublishManifestRelational(siteId);
    console.log(JSON.stringify({ ok: true, mode: "draft-only", siteId, backupPath, manifestHash: manifest.manifestHash, publicationRequired: false, showcaseVideoThemes: showcase.videoThemes.length }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
