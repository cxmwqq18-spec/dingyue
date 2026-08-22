#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { showcaseStores } from "./dreamshoot-homepage-showcase-data.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
assert(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
assert(parsed.port === "15433", `homepage DB sync must use local port 15433 (received ${parsed.port})`);

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
const { publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => [key, stable(item)]));
}

function projectionRevision(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
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

const catalogCopy = {
  soccer: { title: "Soccer", category: "Fan Photos", meta: "Match Day", description: "Create personal soccer fan portraits, stadium-style posters, match-day social images, and supporter albums without official marks." },
  "portrait-photo": { title: "Portrait Photo", category: "Creator", meta: "Personal Brand", description: "Build polished creator portraits, media-kit images, founder visuals, newsletter photos, and personal-brand profile crops." },
  "gala-photo": { title: "Gala Photo", category: "Vip Looks", meta: "Formal Event", description: "Create formal gala portraits with eveningwear mood, polished event lighting, red-carpet energy, and elegant editorial crops." },
  headshot: { title: "Headshot", category: "Professional", meta: "LinkedIn", description: "Generate realistic professional headshots for LinkedIn, resumes, speaker pages, founder bios, and team profile updates." },
  "hairstyle-generator": { title: "Hairstyle Generator", category: "Beauty", meta: "Hair Color", description: "Preview hairstyle, hair color, texture, bangs, length, and salon inspiration portraits before choosing a real-world look." },
  cyberpunk: { title: "Cyberpunk", category: "Creative", meta: "Neon City", description: "Turn portraits into neon cyberpunk city scenes with rain reflections, futuristic styling, cinematic light, and poster crops." },
  mafia: { title: "Mafia", category: "Creative", meta: "Noir Character", description: "Create mafia-inspired noir portraits with tailored wardrobe, moody interiors, dramatic light, and private character albums." },
  travel: { title: "Travel", category: "Lifestyle", meta: "Destination Portraits", description: "Create travel portraits with scenic streets, coastal escapes, outdoor light, destination mood, and private creator albums." },
  urban: { title: "Urban", category: "Lifestyle", meta: "Street Portraits", description: "Build urban portraits with city textures, street scenes, modern wardrobe, creator energy, and private gallery delivery." },
  "virtual-try-on": { title: "Virtual Try-On", category: "Beauty", meta: "Outfit Ideas", description: "Preview outfit directions, wardrobe moodboards, fashion looks, creator styling ideas, and private try-on portraits." },
  avatar: { title: "Avatar", category: "Creator", meta: "Profile Icons", description: "Turn selfies into recognizable avatars for profile icons, gaming handles, Discord servers, creator pages, and social refreshes." },
  "street-style": { title: "Street Style", category: "Creator", meta: "Fashion Profile", description: "Generate fashion-forward street style portraits with outfit direction, editorial poses, city backdrops, and creator crops." },
  "motion-generator": { title: "Motion Generator", category: "Video", meta: "Short Motion", description: "Turn approved source photos into short motion-ready scenes for social posts, creator intros, and private visual tests." },
  "photo-enhancer": { title: "Photo Enhancer", category: "Utility", meta: "Image Polish", description: "Improve approved photos with a focused enhancement pass before using them in a private gallery workflow." },
  "christmas-photo": { title: "Christmas Photo", category: "Christmas", meta: "Holiday Cards", description: "Create festive group portraits, greeting-card visuals, cozy couple scenes, and warm seasonal images." },
  "thanksgiving-photo": { title: "Thanksgiving Photo", category: "Seasonal", meta: "Family Album", description: "Create warm family-style portraits, dinner-table keepsakes, gratitude cards, and private seasonal albums." }
};

const subscriptionMetadata = {
  Starter: {
    badgeLabel: "Photo plan",
    summary: "A practical starting plan for first private albums and quick profile sets.",
    features: [
      "Create private photo albums after generation completes",
      "AI photo editor with prompts",
      "Special AI photo filters",
      "Create photos by writing prompts in seconds",
      "Create AI videos",
      "Magic Upscaler for high-res images",
      "No watermark"
    ]
  },
  Pro: {
    badgeLabel: "Most popular",
    summary: "More credits for several albums, edits, and style tests.",
    features: [
      "Create private photo albums after generation completes",
      "AI photo editor with prompts",
      "Special AI photo filters",
      "Create photos by writing prompts in seconds",
      "Create AI videos",
      "Magic Upscaler for high-res images",
      "No watermark"
    ]
  },
  Premium: {
    badgeLabel: "Best value",
    summary: "The highest credit allowance for repeat albums, video ideas, and premium outputs.",
    features: [
      "Create private photo albums after generation completes",
      "AI photo editor with prompts",
      "Special AI photo filters",
      "Create photos by writing prompts in seconds",
      "Create AI videos",
      "Magic Upscaler for high-res images",
      "No watermark",
      "4K Ultra-High quality outputs"
    ]
  }
};

function menuLink(id, label, href, group) {
  return { id, type: "menu_link", settings: { label, href, group } };
}

function mergeFooter(settings) {
  const next = clone(settings);
  next.navigation ??= {};
  next.navigation.footerLinks = [
    ["AI Image Generation", "/ai-image-generation", "product"],
    ["AI Video Generation", "/ai-video-generation", "product"],
    ["Best Packages", "/best-packages", "product"],
    ["How it works", "/workflow", "product"],
    ["Pricing", "/pricing", "product"],
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
    tagline: "Private AI photo sets with visible credit costs and gallery delivery",
    body: "Upload your selfies, choose a style, review the credit cost, and download a private photo set.",
    bottomLine: "Monthly credits, one-time top-ups, and private galleries in one photo workspace.",
    productHeading: "Explore",
    companyHeading: "Content",
    supportHeading: "Support",
    socialHeading: "Why it works",
    socialBody: "myDreamshoots helps you turn your own photos into private AI headshots, portraits, and themed albums.",
    showPaymentIcons: true
  };
  next.globalSections.footer.blocks = [
    ["AI Image Generation", "/ai-image-generation", "product"],
    ["AI Video Generation", "/ai-video-generation", "product"],
    ["Best Packages", "/best-packages", "product"],
    ["How it works", "/workflow", "product"],
    ["Pricing", "/pricing", "product"],
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

function mergeHomepage(pageJson, templateHome, pricingPageJson, creativePacks) {
  const next = clone(pageJson);
  const templateGeneration = templateHome.sections?.generation_showcase_1;
  assert(templateGeneration, "studio template must provide generation_showcase_1");
  next.sections ??= {};
  next.sectionsOrder ??= Object.keys(next.sections);
  next.seo = {
    ...(next.seo ?? {}),
    title: "Professional AI Photo Generator Online - myDreamshoots",
    description: "Create AI headshots, portraits, themed photo sets, editing workflows, and supported short video results from your own approved photos. Compare examples and credit costs before you generate.",
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
      trustedLogoTitle: "Explore AI photo and video workflows | myDreamshoots",
      aboutTitle: "What is myDreamshoots?",
      aboutBody: "myDreamshoots is an AI photo and video studio. Upload photos you own or are permitted to use, choose a supported workflow, review the current credit cost before generation, and download finished results from your private gallery.",
      embeddedPricingSectionId: "pricing_1",
      trustedLogoSplitIndex: 15
    },
    blocks: clone(templateGeneration.blocks ?? [])
  };
  const hero = next.sections.hero_1;
  if (hero) {
    hero.settings = {
      ...(hero.settings ?? {}),
      heroBadge: "AI Headshot Photo Packages",
      headline: "Create AI Headshots, Portraits, and Themed Photo Sets from Your Photos",
      subheadline: "Upload a few clear photos to create AI headshots, portraits, couple photos, seasonal sets, and other themed images. Choose a workflow, review the credit cost before generation, and review finished results in your signed-in gallery. AI video tools are also available when you want to turn images or prompts into short motion clips.",
      bulletList: "Use photos you own or have permission to use.|Choose the photo or video workflow that fits your goal.|Review credits before the request starts.|Download finished results from your private gallery.",
      imageBadge: "AI image workflows",
      imageCaption: "Create a private AI photo set for professional profiles, portraits, couples, seasonal images, creative styles, or other supported workflows.",
      authRibbon: "Review credits before generation",
      socialProofLabel: "Private uploads · Credit cost shown upfront · Download your favorites"
    };
    next.sections.hero_1 = hero;
  }
  const pricing = clone(pricingPageJson?.sections?.pricing_1 ?? templateHome.sections?.pricing_1);
  if (pricing) {
    pricing.settings = {
      ...(pricing.settings ?? {}),
      title: "Subscription Plans",
      subtitle: "Choose the plan that works for you",
      marketComparison: "Choose a monthly, quarterly, or semiannual plan based on the credits you expect to use. Compare the current price, included credits, renewal interval, and supported workflows before selecting a plan.",
      description: "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.",
      sidePanelEyebrow: "Why people subscribe",
      sidePanelTitle: "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option.",
      sidePanelBody: "Review the credit cost before each generation, and use an available top-up when you need additional runs."
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
  const catalogPacks = new Map((creativePacks ?? []).map((pack) => [pack.slug, pack]));
  const catalogBlocks = catalogOrder.map((slug, index) => {
    const pack = catalogPacks.get(slug);
    assert(pack, `active CreativePack ${slug} is required for the homepage catalog`);
    const copy = catalogCopy[slug] ?? { title: pack.name, category: pack.category, meta: "Private gallery", description: pack.description || pack.headline };
    const images = Array.isArray(pack.galleryImages) ? pack.galleryImages : [];
    return {
      id: `catalog_${slug}`,
      type: "catalog_pack",
      settings: {
        title: copy.title,
        description: copy.description,
        category: copy.category,
        meta: copy.meta,
        credits: `${pack.outputCount} Photos`,
        imageUrl: images[2] || images[0] || pack.imageUrl || "",
        href: `/ai-image-generation/${slug}`
      }
    };
  });
  const catalog = next.sections.package_catalog_1 ?? {};
  next.sections.package_catalog_1 = {
    ...catalog,
    settings: {
      ...(catalog.settings ?? {}),
      source: "manual",
      featuredCount: 12,
      title: "AI Photo Packages by Style and Use Case",
      subtitle: "Browse all 38 myDreamshoots themes across professional, lifestyle, creative, magic, and photo tools before spending credits.",
      directoryLabel: "AI PHOTO THEMED",
      directorySubtitle: "Compare every active theme by category, title, cover, and route before starting a private photo package."
    },
    blocks: catalogBlocks
  };
  // Pricing is embedded by the showcase renderer and must remain out of the ordered sections.
  next.sectionsOrder = next.sectionsOrder.filter((id) => id !== "pricing_1");
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
      ...(kind === "video" ? { fullGallery: false, videoSlugs: videoSlugs.join("|") } : { fullGallery: true, imageSlugs: "" })
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
      activePublication: { include: { publication: true } },
      connect: true
    }
  });
  assert(siteRecord?.settings, "site and settings are required");
  const creativePackRows = await prisma.creativePack.findMany({
    where: { siteId, status: "active", aiAppSlug: "image_generator" },
    include: { categoryRecord: true },
    orderBy: { createdAt: "asc" }
  });
  const creativePacks = creativePackRows.map((pack) => ({
    slug: pack.categoryRecord?.slug || pack.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name: pack.name,
    headline: pack.headline,
    description: pack.description,
    category: pack.category,
    outputCount: pack.outputCount,
    imageUrl: pack.imageUrl,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages : []
  }));
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
  const mergedJson = mergeHomepage(currentJson, templateHome, pricingPage?.draftJson ?? pricingPage?.publishedJson, creativePacks);
  const { page: bestImagePage, json: currentBestImageJson } = pageJsonFromSlug(siteRecord, "/best-ai-image");
  const { page: bestVideoPage, json: currentBestVideoJson } = pageJsonFromSlug(siteRecord, "/best-ai-video");
  const productionVideoSlugs = String(mergedJson.sections.generation_showcase_1.settings?.videoSlugs ?? "")
    .split("|").map((slug) => slug.trim()).filter(Boolean);
  const mergedBestImageJson = mergeBestGallery(currentBestImageJson, "image");
  const mergedBestVideoJson = mergeBestGallery(currentBestVideoJson, "video", productionVideoSlugs);
  const showcase = showcaseStores.find((store) => store.siteId === siteId);
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
      homepageCatalogBlocks: mergedJson.sections.package_catalog_1.blocks?.length ?? 0,
      footerLinks: mergedThemeSettings.navigation.footerLinks.length,
      embedsPricing: mergedJson.sections.generation_showcase_1.settings?.embeddedPricingSectionId === "pricing_1",
      homepageVideoSlugs: mergedJson.sections.generation_showcase_1.settings?.videoSlugs,
      bestVideoSlugs: productionVideoSlugs,
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
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson: mergedThemeSettings, publishedJson: mergedThemeSettings, updatedAt: new Date() } });
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

  const freshSiteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: { pages: { orderBy: { slug: "asc" } }, products: { include: { prices: true } }, activePublication: { include: { publication: true } } }
  });
  assert(freshSiteRecord?.activePublication?.publication, "site publication readback failed");
  const activeSnapshot = clone(freshSiteRecord.activePublication.publication.snapshot);
  assert.equal(publicationSnapshotIntegrity(activeSnapshot), "valid", "active publication must be valid before homepage repair");
  // The homepage transaction updates Product/Price metadata. Re-project those
  // public offers before publishing so the local PostgreSQL snapshot, not the
  // previous publication, remains the storefront source of truth.
  const productsById = new Map(freshSiteRecord.products.map((product) => [product.id, product]));
  activeSnapshot.publishedOffers = (activeSnapshot.publishedOffers ?? []).map((offer) => {
    const product = productsById.get(offer.productId);
    const price = product?.prices.find((candidate) => candidate.id === offer.priceId);
    return product && price
      ? { ...offer, productMetadata: clone(product.metadata), priceMetadata: clone(price.metadata), revision: crypto.createHash("sha256").update(JSON.stringify([product.id, product.metadata, price])).digest("hex").slice(0, 20) }
      : offer;
  });
  activeSnapshot.revisions.offerRevision = projectionRevision(activeSnapshot.publishedOffers);
  for (const [pageId, pageJson] of [[homepage.id, mergedJson], [bestImagePage.id, mergedBestImageJson], [bestVideoPage.id, mergedBestVideoJson]]) {
    const publishedPage = activeSnapshot.pages.find((candidate) => candidate.id === pageId);
    assert(publishedPage, `page ${pageId} is missing from the active publication snapshot`);
    publishedPage.publishedJson = clone(pageJson);
  }
  const snapshotForPublish = {
    ...activeSnapshot,
    themeSettings: mergedThemeSettings,
    snapshotHash: "",
    revisions: { ...activeSnapshot.revisions, snapshotHash: "" }
  };
  snapshotForPublish.snapshotHash = publicationSnapshotHash(snapshotForPublish);
  snapshotForPublish.revisions.snapshotHash = snapshotForPublish.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshotForPublish), "valid", "homepage repair must preserve snapshot integrity");
  const published = await publishSeoSnapshotRelational({ siteId, snapshot: snapshotForPublish, actor: "sync:mydreamshoots-homepage-db" });
    console.log(JSON.stringify({ ok: true, mode: "applied", siteId, backupPath, publicationId: published.publication.id, version: published.publishedVersion, snapshotHash: published.publication.snapshot.snapshotHash, collectionRefs: published.publication.snapshot.publishedCollectionRefs.length, offers: published.publication.snapshot.publishedOffers.length, showcaseVideoThemes: showcase.videoThemes.length }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
