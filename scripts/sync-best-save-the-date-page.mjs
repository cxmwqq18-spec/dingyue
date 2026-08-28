#!/usr/bin/env node
import "./load-runtime-env.mjs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolveFilename.call(this, resolved, ...args);
};

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const pagePath = "/best-save-the-date";
const navigationCatalogue = [
  { href: "/ai-save-the-date/valentines-day", label: "Valentine's Day", group: "love-wedding" },
  { href: "/ai-save-the-date/engagement", label: "Engagement", group: "love-wedding" },
  { href: "/ai-save-the-date/proposal", label: "Proposal", group: "love-wedding" },
  { href: "/ai-save-the-date/save-the-date", label: "Save the Date", group: "love-wedding" },
  { href: "/holidays-events/wedding-invitation", label: "Wedding Invitation", group: "love-wedding" },
  { href: "/ai-save-the-date/wedding-ceremony", label: "Wedding Ceremony", group: "love-wedding" },
  { href: "/ai-save-the-date/christmas", label: "Christmas", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/halloween", label: "Halloween", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/thanksgiving", label: "Thanksgiving", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/new-year", label: "New Year", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/easter", label: "Easter", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/mothers-day", label: "Mother's Day", group: "seasonal-holidays" },
  { href: "/ai-save-the-date/fathers-day", label: "Father's Day", group: "seasonal-holidays" }
];
const sourcePaths = navigationCatalogue.map((item) => item.href);

const directoryMedia = [
  ["save-the-date-01.webp", "Save the Date couple portrait for the opening theme directory card."],
  ["save-the-date-02.webp", "Save the Date announcement scene for the theme directory."],
  ["save-the-date-03.webp", "Save the Date garden couple scene for the theme directory."],
  ["save-the-date-04.webp", "Save the Date planning scene for the theme directory."],
  ["save-the-date-05.webp", "Save the Date city walk scene for the theme directory."],
  ["save-the-date-06.webp", "Save the Date destination scene for the theme directory."],
  ["save-the-date-07.webp", "Save the Date beach transition scene for the theme directory."],
  ["save-the-date-08.webp", "Save the Date ring detail scene for the theme directory."],
  ["save-the-date-09.webp", "Save the Date proposal memory scene for the theme directory."],
  ["save-the-date-10.webp", "Save the Date ring announcement scene for the theme directory."],
  ["save-the-date-11.webp", "Save the Date production scene for the theme directory."]
].map(([filename, alt], index) => ({
  filename,
  src: `/assets/dreamshoot/generated/standard-page-media/save-the-date/${filename}`,
  alt,
  role: index === 0 ? "hero" : "content",
  width: 1600,
  height: 1000,
  format: "WEBP",
  loading: index === 0 ? "eager" : "lazy",
  fetchPriority: index === 0 ? "high" : "auto"
}));

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();

function firstMedia(page) {
  const manifest = page?.publishedJson?.mediaManifest;
  if (!Array.isArray(manifest)) return undefined;
  return manifest.find((item) => item && typeof item.src === "string" && item.src.trim());
}

function pageDescription(page, fallback) {
  const sections = page?.publishedJson?.sections;
  if (sections && typeof sections === "object") {
    for (const section of Object.values(sections)) {
      const intro = section?.settings?.intro ?? section?.settings?.subtitle ?? section?.settings?.description;
      if (typeof intro === "string" && intro.trim()) return intro.trim();
    }
  }
  return fallback;
}

try {
  const siteRecord = await prisma.site.findUnique({
    where: { id: siteId },
    include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true }
  });
  if (!siteRecord) throw new Error(`Site not found: ${siteId}`);
  const existingSettings = siteRecord.settings?.draftJson || siteRecord.settings?.publishedJson || {};
  const existingGroups = existingSettings.saveTheDateNavigation?.groups ?? [];
  const publishedItems = existingGroups.flatMap((candidate) => candidate.items.filter((item) => item.status === "published").map((item) => ({ ...item, groupSlug: candidate.slug })));
  const sourcePages = new Map(siteRecord.pages.filter((page) => sourcePaths.includes(page.slug)).map((page) => [page.slug, page]));
  const missingPublishedSources = publishedItems.filter((item) => !sourcePages.has(item.href)).map((item) => item.href);
  const existingItemsByHref = new Map(publishedItems.map((item) => [item.href, item]));
  const availableEntries = navigationCatalogue.filter((entry) => sourcePages.has(entry.href));
  const buildItems = (entries) => entries.map((entry, index) => {
    const { href, label } = entry;
    const sourcePage = sourcePages.get(href);
    const media = firstMedia(sourcePage);
    const existingItem = existingItemsByHref.get(href);
    return {
      ...(existingItem || {}),
      label,
      slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      href,
      description: pageDescription(sourcePage, existingItem?.description || `Create a polished ${label} story from approved couple photos and a clear announcement direction.`),
      ...(media ? { imageUrl: media.src, imageAlt: media.alt || `${label} Save the Date theme preview` } : {}),
      status: "published",
      sortOrder: index + 1
    };
  });
  const nextGroups = [
    { label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: buildItems(availableEntries.filter((entry) => entry.group === "love-wedding")) },
    { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: buildItems(availableEntries.filter((entry) => entry.group === "seasonal-holidays")) }
  ];
  const nextItems = nextGroups.flatMap((candidate) => candidate.items);
  const nextSettings = {
    ...existingSettings,
    saveTheDateNavigation: {
      menuLabel: "Save the Date",
      groups: nextGroups
    }
  };
  const pageJson = {
    pageType: "content",
    version: 1,
    sectionsOrder: ["best_save_the_date_1"],
    sections: { best_save_the_date_1: { type: "dreamshoot_save_the_date_directory", settings: { anchor: "best-save-the-date", headingLevel: "h1" }, blocks: [] } },
    mediaManifest: directoryMedia,
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: "best_save_the_date",
      mediaCount: directoryMedia.length
    },
    seo: {
      title: "Best Save the Date themes | myDreamshoots",
      description: "Browse every myDreamshoots Save the Date theme for Valentine announcements, engagements, proposals, and wedding date stories.",
      keywords: "Best Save the Date themes, myDreamshoots Save the Date, AI wedding announcement video, engagement announcement themes",
      canonicalPath: pagePath,
      canonical: pagePath,
      index: true,
      follow: true,
      robots: { index: true, follow: true, maxImagePreview: "large" }
    }
  };
  const pageId = `page_${siteId}_best_save_the_date`;
  await prisma.$transaction(async (tx) => {
  await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: pagePath } }, create: { id: pageId, siteId, pageType: "content", templateKey: "best-save-the-date", slug: pagePath, title: "Best Save the Date themes", draftJson: pageJson, publishedJson: {} }, update: { pageType: "content", templateKey: "best-save-the-date", title: "Best Save the Date themes", draftJson: pageJson } });
  for (const item of directoryMedia) {
    await tx.mediaAsset.upsert({
      where: { siteId_storageKey: { siteId, storageKey: item.src } },
      create: {
        id: `media_${siteId}_best_save_the_date_${item.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
        siteId,
        label: item.filename,
        storageKey: item.src,
        mimeType: "image/webp",
        usageType: "theme",
        sourceType: "best-save-the-date-directory",
        previewUrl: item.src,
        originUrl: item.src,
        altText: item.alt
      },
      update: { altText: item.alt, previewUrl: item.src, originUrl: item.src, usageType: "theme", sourceType: "best-save-the-date-directory" }
    });
  }
  await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: {} }, update: { draftJson: nextSettings } });
  });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  const site = toSite(fresh);
  for (const page of site.pages) page.publishedJson = page.draftJson;
  site.themeSettings.publishedJson = nextSettings;
  const candidatePage = site.pages.find((page) => page.slug === pagePath);
  if (candidatePage) candidatePage.publishedJson = pageJson;
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") throw new Error(`Save the Date publication snapshot is invalid: ${integrity}`);
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ siteId, pagePath, mode: "draft-only", categories: nextGroups.length, themes: nextItems.length, removedMissingSources: missingPublishedSources, snapshotHash: snapshot.snapshotHash, manifestHash: manifest.manifestHash, publicationRequired: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
