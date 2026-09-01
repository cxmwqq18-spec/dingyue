#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite(process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot");
assertDatabaseTarget({ expectedTarget: "local" });

const repoRoot = process.cwd();
const clone = (value) => JSON.parse(JSON.stringify(value));
const slugify = (value) => String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const themePath = (slug) => `/ai-save-the-date/${slug}`;

const saveTheDateNavBlueprint = [
  { href: "/ai-save-the-date/valentines-day", label: "Valentine's Day", group: "love-wedding" },
  { href: "/ai-save-the-date/engagement", label: "Engagement", group: "love-wedding" },
  { href: "/ai-save-the-date/proposal", label: "Proposal", group: "love-wedding" },
  { href: "/ai-save-the-date/save-the-date", label: "Save the Date", group: "love-wedding" },
  { href: "/ai-save-the-date/wedding-ceremony", label: "Wedding Ceremony", group: "love-wedding" },
  { href: "/ai-save-the-date/christmas", label: "Christmas", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/halloween", label: "Halloween", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/thanksgiving", label: "Thanksgiving", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/new-year", label: "New Year", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/easter", label: "Easter", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/mothers-day", label: "Mother's Day", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/fathers-day", label: "Father's Day", group: "seasonal-holidays" }
];

const easterMedia = [
  ["hero-ai-mothers-day-family-breakfast.jpg", "Children sharing an Easter breakfast table with flowers, eggs, and a handmade card."],
  ["hero-ai-mothers-day-garden-portrait.jpg", "Family laughing together in a spring garden with blooming flowers."],
  ["hero-ai-mothers-day-gift-breakfast.jpg", "Flat-lay Easter brunch scene with tulips, a gift box, greeting card, pastries, and coffee on a wooden table."],
  ["ai-mothers-day-brunch-table.jpg", "Elegant Easter brunch table with waffles, berries, tea, flowers, and a pastel gift box."],
  ["ai-mothers-day-family-baking.jpg", "Family decorating cupcakes and Easter treats together in a bright kitchen filled with spring details."],
  ["ai-mothers-day-gift-still-life.jpg", "Easter gift arrangement with flowers, wrapped presents, a basket, and a greeting card on a dresser."],
  ["ai-mothers-day-phone-photo.jpg", "Hand holding a smartphone to capture a cheerful Easter breakfast moment with family in the background."],
  ["ai-mothers-day-family-toast.jpg", "Three generations of family raising glasses around flowers and cake during a cozy Easter celebration."],
  ["ai-mothers-day-cozy-living-room.jpg", "Family relaxing on a sofa with flowers, a wrapped gift, and a warm drink in a cozy Easter living room."],
  ["ai-mothers-day-pet-portrait.jpg", "Smiling family sitting with a golden retriever and a flower bouquet in a sunny porch setting for Easter."],
  ["ai-mothers-day-spring-walk.jpg", "Family walking under blooming spring trees while holding a bouquet of tulips and Easter treats."]
].map(([filename, alt]) => ({
  filename,
  src: `/assets/dreamshoot/seasonal/easter/${filename}`,
  alt,
  role: filename.startsWith("hero-") ? "hero" : "content",
  width: 1024,
  height: 1024,
  format: "WEBP",
  loading: filename.startsWith("hero-") ? "eager" : "lazy",
  fetchPriority: filename.startsWith("hero-") ? "high" : "auto"
}));

function mediaSource(pageJson) {
  return Array.isArray(pageJson?.mediaManifest) ? pageJson.mediaManifest : [];
}

function deepReplace(value, replacements) {
  if (typeof value === "string") {
    let next = value;
    for (const [from, to] of replacements) next = next.split(from).join(to);
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => deepReplace(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, deepReplace(item, replacements)]));
}

function renamePagePrefix(json, fromPrefix, toPrefix) {
  const next = clone(json);
  next.contentContract = { ...(next.contentContract || {}), pageKey: toPrefix };
  const prefix = `${fromPrefix}_`;
  const nextPrefix = `${toPrefix}_`;
  const idMap = new Map();
  next.sectionsOrder = (next.sectionsOrder || []).map((id) => {
    if (typeof id !== "string" || !id.startsWith(prefix)) return id;
    const renamed = `${nextPrefix}${id.slice(prefix.length)}`;
    idMap.set(id, renamed);
    return renamed;
  });
  next.sections = Object.fromEntries(Object.entries(next.sections || {}).map(([key, section]) => [idMap.get(key) || key, section]));
  return next;
}

function buildEasterPage(templateJson) {
  const next = renamePagePrefix(templateJson, "mothers_day", "easter");
  const replacements = [
    ["Mother’s Day", "Easter"],
    ["Mother's Day", "Easter"],
    ["mother's day", "easter"],
    ["mothers day", "easter"],
    ["Mother and young daughter laughing together.", "Family laughing together in a spring garden."],
    ["Children surprising their mother with flowers and a handmade card during a warm Mother's Day family breakfast.", "Children sharing an Easter breakfast table with flowers, eggs, and a handmade card."],
    ["Flat-lay Mother's Day breakfast scene with pink flowers, gift box, greeting card, pastries, and coffee on a wooden table.", "Flat-lay Easter brunch scene with tulips, a gift box, greeting card, pastries, and coffee on a wooden table."],
    ["Elegant brunch table with waffles, berries, tea, flowers, and a pink gift box for Mother's Day celebration.", "Elegant Easter brunch table with waffles, berries, tea, flowers, and a pastel gift box."],
    ["Mother and children decorating cupcakes together in a bright kitchen filled with pastel Mother's Day details.", "Family decorating cupcakes and Easter treats together in a bright kitchen filled with spring details."],
    ["Mother's Day gift arrangement with flowers, wrapped presents, perfume, jewelry box, and a greeting card on a dresser.", "Easter gift arrangement with flowers, wrapped presents, a basket, and a greeting card on a dresser."],
    ["Hand holding a smartphone to capture a cheerful Mother's Day breakfast moment with mother and daughter in the background.", "Hand holding a smartphone to capture a cheerful Easter breakfast moment with family in the background."],
    ["Three generations of women and children raising glasses around flowers and cake during a cozy Mother's Day celebration.", "Three generations of family raising glasses around flowers and cake during a cozy Easter celebration."],
    ["Mother relaxing on a sofa with flowers, a wrapped gift, and a warm drink in a cozy Mother's Day living room.", "Family relaxing on a sofa with flowers, a wrapped gift, and a warm drink in a cozy Easter living room."],
    ["Smiling woman sitting with a golden retriever and a flower bouquet in a sunny home porch setting.", "Smiling family sitting with a golden retriever and a flower bouquet in a sunny porch setting for Easter."],
    ["Mother walking with two children under blooming spring trees while holding a bouquet of tulips.", "Family walking under blooming spring trees while holding a bouquet of tulips and Easter treats."]
  ];
  const withCopy = deepReplace(next, replacements);
  const easterSeo = {
    title: "AI Easter Photo & Video Generator | Spring Content",
    description: "Create Easter photos and videos with AI for spring celebrations, egg hunts, brunch, family portraits, gifts, and seasonal social content.",
    keywords: "AI Easter photo generator, AI Easter video generator, Easter family photos, Easter brunch content, spring celebration visuals",
    canonicalPath: "/ai-save-the-date/easter",
    canonical: "https://www.mydreamshoots.com/ai-save-the-date/easter",
    index: true,
    follow: true,
    robots: { index: true, follow: true, maxImagePreview: "large" },
    ogImage: easterMedia[0].src
  };
  withCopy.seo = easterSeo;
  withCopy.mediaManifest = easterMedia;
  withCopy.contentContract = { ...(withCopy.contentContract || {}), schema: "editorial-page-v1", pageKey: "easter", mediaCount: easterMedia.length, sourceRevision: "easter-manual-20260901" };
  withCopy.relatedLinks = [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/ai-save-the-date/save-the-date" }];
  withCopy.sections = deepReplace(withCopy.sections, replacements);
  withCopy.sections = deepReplace(withCopy.sections, [
    ["hero", "hero"],
    ["definition", "definition"],
    ["use-cases", "use-cases"],
    ["quality", "quality"],
    ["workflow", "workflow"],
    ["scene-ideas", "scene-ideas"],
    ["formats", "formats"],
    ["family-match", "family-match"],
    ["faq", "faq"],
    ["final-cta", "final-cta"]
  ]);
  return withCopy;
}

function navItemFromPage(label, href, pageJson, groupSlug) {
  const media = mediaSource(pageJson)[0];
  return {
    label,
    slug: slugify(label),
    href,
    groupSlug,
    status: "published",
    sortOrder: 0,
    description: pageJson?.seo?.description || "",
    ...(media ? { imageUrl: media.src, imageAlt: media.alt || `${label} Save the Date theme preview` } : {})
  };
}

async function copyEasterMediaAssets() {
  const sourceDir = path.join(repoRoot, "public/assets/dreamshoot/seasonal/mothers-day");
  const targetDir = path.join(repoRoot, "public/assets/dreamshoot/seasonal/easter");
  fs.mkdirSync(targetDir, { recursive: true });
  for (const asset of easterMedia) {
    const source = path.join(sourceDir, asset.filename);
    const target = path.join(targetDir, asset.filename);
    if (!fs.existsSync(source)) throw new Error(`Missing source asset: ${source}`);
    if (!fs.existsSync(target) || fs.statSync(source).mtimeMs > fs.statSync(target).mtimeMs) {
      fs.copyFileSync(source, target);
    }
  }
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, settings] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...saveTheDateNavBlueprint.map((item) => item.href), "/ai-save-the-date/mothers-day"] } }, select: { id: true, slug: true, pageType: true, templateKey: true, title: true, draftJson: true, publishedJson: true, draftMeta: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...saveTheDateNavBlueprint.map((item) => item.href), "/ai-save-the-date/mothers-day"] } }, select: { id: true, slug: true, pageType: true, templateKey: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } })
  ]);

  const themeBySlug = new Map(themePages.map((page) => [page.slug, page]));
  const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
  const mothersDayTheme = themeBySlug.get("/ai-save-the-date/mothers-day");
  if (!mothersDayTheme) throw new Error("Missing Mother's Day template page");
  const mothersDayJson = clone(mothersDayTheme.publishedJson || mothersDayTheme.draftJson);
  const engagementTheme = themeBySlug.get("/ai-save-the-date/engagement");
  if (!engagementTheme) throw new Error("Missing Engagement page");

  const engagementJson = clone(engagementTheme.publishedJson || engagementTheme.draftJson);
  const easterJson = buildEasterPage(mothersDayJson);

  await copyEasterMediaAssets();

  const pageWrites = [
    { slug: "/ai-save-the-date/engagement", pageJson: engagementJson, title: engagementTheme.title, pageType: engagementTheme.pageType, templateKey: engagementTheme.templateKey, id: engagementTheme.id },
    { slug: "/ai-save-the-date/easter", pageJson: easterJson, title: "Create Easter Photos and Videos with AI", pageType: "standard-content", templateKey: "seasonal-editorial", id: `page_${SITE_ID}_easter` }
  ];

  const nextSettings = clone(settings?.draftJson || settings?.publishedJson || {});
  const pageJsonByHref = new Map(pageWrites.map((item) => [item.slug, item.pageJson]));
  const nextGroups = [
    {
      label: "Love & Wedding",
      slug: "love-wedding",
      sortOrder: 1,
      items: [
        navItemFromPage("Valentine's Day", "/ai-save-the-date/valentines-day", themeBySlug.get("/ai-save-the-date/valentines-day")?.publishedJson || themeBySlug.get("/ai-save-the-date/valentines-day")?.draftJson, "love-wedding"),
        navItemFromPage("Engagement", "/ai-save-the-date/engagement", engagementJson, "love-wedding"),
        navItemFromPage("Proposal", "/ai-save-the-date/proposal", themeBySlug.get("/ai-save-the-date/proposal")?.publishedJson || themeBySlug.get("/ai-save-the-date/proposal")?.draftJson, "love-wedding"),
        navItemFromPage("Save the Date", "/ai-save-the-date/save-the-date", themeBySlug.get("/ai-save-the-date/save-the-date")?.publishedJson || themeBySlug.get("/ai-save-the-date/save-the-date")?.draftJson, "love-wedding"),
        navItemFromPage("Wedding Ceremony", "/ai-save-the-date/wedding-ceremony", themeBySlug.get("/ai-save-the-date/wedding-ceremony")?.publishedJson || themeBySlug.get("/ai-save-the-date/wedding-ceremony")?.draftJson, "love-wedding")
      ]
    },
    {
      label: "Seasonal Holidays",
      slug: "seasonal-holidays",
      sortOrder: 2,
      items: [
        navItemFromPage("Christmas", "/ai-save-the-date/christmas", themeBySlug.get("/ai-save-the-date/christmas")?.publishedJson || themeBySlug.get("/ai-save-the-date/christmas")?.draftJson, "seasonal-holidays"),
        navItemFromPage("Halloween", "/ai-save-the-date/halloween", themeBySlug.get("/ai-save-the-date/halloween")?.publishedJson || themeBySlug.get("/ai-save-the-date/halloween")?.draftJson, "seasonal-holidays"),
        navItemFromPage("Thanksgiving", "/ai-save-the-date/thanksgiving", themeBySlug.get("/ai-save-the-date/thanksgiving")?.publishedJson || themeBySlug.get("/ai-save-the-date/thanksgiving")?.draftJson, "seasonal-holidays"),
        navItemFromPage("New Year", "/ai-save-the-date/new-year", themeBySlug.get("/ai-save-the-date/new-year")?.publishedJson || themeBySlug.get("/ai-save-the-date/new-year")?.draftJson, "seasonal-holidays"),
        navItemFromPage("Easter", "/ai-save-the-date/easter", easterJson, "seasonal-holidays"),
        navItemFromPage("Mother's Day", "/ai-save-the-date/mothers-day", mothersDayJson, "seasonal-holidays"),
        navItemFromPage("Father's Day", "/ai-save-the-date/fathers-day", themeBySlug.get("/ai-save-the-date/fathers-day")?.publishedJson || themeBySlug.get("/ai-save-the-date/fathers-day")?.draftJson, "seasonal-holidays")
      ]
    }
  ];
  nextSettings.saveTheDateNavigation = { menuLabel: "Save the Date", groups: nextGroups };

  await prisma.$transaction(async (tx) => {
    for (const item of pageWrites) {
      await tx.themePage.upsert({
        where: { siteId_slug: { siteId: SITE_ID, slug: item.slug } },
        create: { id: item.id, siteId: SITE_ID, pageType: item.pageType, templateKey: item.templateKey, slug: item.slug, title: item.title, draftJson: item.pageJson, publishedJson: item.pageJson },
        update: { pageType: item.pageType, templateKey: item.templateKey, title: item.title, draftJson: item.pageJson, publishedJson: item.pageJson, draftMeta: null }
      });
      const live = liveBySlug.get(item.slug);
      await tx.livePage.upsert({
        where: { siteId_slug: { siteId: SITE_ID, slug: item.slug } },
        create: { id: live?.id || `live_${SITE_ID}_${slugify(item.slug)}`, siteId: SITE_ID, pageType: item.pageType, templateKey: item.templateKey, slug: item.slug, title: item.title, contentJson: item.pageJson },
        update: { pageType: item.pageType, templateKey: item.templateKey, title: item.title, contentJson: item.pageJson }
      });
    }

    for (const asset of easterMedia) {
      const fileName = asset.src.split("/").pop() || asset.src;
      await tx.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.src } },
        create: {
          id: `media_${SITE_ID}_easter_${slugify(fileName)}`,
          siteId: SITE_ID,
          label: fileName,
          storageKey: asset.src,
          mimeType: "image/jpeg",
          usageType: "theme",
          sourceType: "save-the-date-easter",
          previewUrl: asset.src,
          originUrl: asset.src,
          altText: asset.alt,
          notes: asset.alt
        },
        update: {
          label: fileName,
          mimeType: "image/jpeg",
          usageType: "theme",
          sourceType: "save-the-date-easter",
          previewUrl: asset.src,
          originUrl: asset.src,
          altText: asset.alt,
          notes: asset.alt
        }
      });
    }

    await tx.themeSettings.upsert({
      where: { siteId: SITE_ID },
      create: { id: `settings_${SITE_ID}`, siteId: SITE_ID, draftJson: nextSettings, publishedJson: nextSettings },
      update: { draftJson: nextSettings, publishedJson: nextSettings }
    });
  });

  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    repaired: ["/ai-save-the-date/engagement", "/ai-save-the-date/easter"],
    saveTheDateThemes: nextGroups.flatMap((group) => group.items).length
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
