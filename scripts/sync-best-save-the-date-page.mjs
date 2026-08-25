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
const removedLegacyPaths = new Set([
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year"
]);
const sourcePaths = [
  "/ai-save-the-date/valentines-day",
  "/holidays-events/engagement",
  "/holidays-events/proposal",
  "/holidays-events/save-the-date",
  "/ai-video-generation/wedding-ceremony",
  "/ai-image-generation/thanksgiving-photo",
  "/ai-image-generation/christmas-photo",
  "/ai-image-generation/holiday"
];

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, publishReviewedDraftSiteRelational } = jiti("../src/lib/stores/theme-store.ts");
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
  const existingPublishedItems = existingGroups.flatMap((candidate) => candidate.items.filter((item) => item.status === "published" && !removedLegacyPaths.has(item.href)).map((item) => ({ ...item, groupSlug: candidate.slug })));
  const eligiblePaths = new Set([...sourcePaths, ...existingPublishedItems.map((item) => item.href)]);
  const sourcePages = new Map(siteRecord.pages.filter((page) => eligiblePaths.has(page.slug)).map((page) => [page.slug, page]));
  const missingPublishedSources = existingPublishedItems.filter((item) => !sourcePages.has(item.href)).map((item) => item.href);
  if (missingPublishedSources.length) throw new Error(`Published Save the Date navigation items have no source page: ${missingPublishedSources.join(", ")}`);
  const labelByPath = new Map([
    ["/ai-save-the-date/valentines-day", "Valentine's Day"],
    ["/holidays-events/engagement", "Engagement"],
    ["/holidays-events/proposal", "Proposal"],
    ["/holidays-events/save-the-date", "Save the Date"],
    ["/ai-video-generation/wedding-ceremony", "Wedding Ceremony"],
    ["/ai-image-generation/thanksgiving-photo", "Thanksgiving Photo"],
    ["/ai-image-generation/christmas-photo", "Christmas Photo"],
    ["/ai-image-generation/holiday", "Holiday"]
  ]);
  const existingPathsForGroup = (groupSlug) => existingPublishedItems
    .filter((item) => item.groupSlug === groupSlug && !sourcePaths.includes(item.href) && sourcePages.has(item.href))
    .map((item) => item.href);
  const lovePaths = [...sourcePaths.slice(0, 4), ...existingPathsForGroup("love-wedding")];
  const seasonalPaths = [...sourcePaths.slice(4), ...existingPublishedItems
    .filter((item) => item.groupSlug !== "love-wedding" && !sourcePaths.includes(item.href) && sourcePages.has(item.href))
    .map((item) => item.href)];
  const buildItems = (paths) => paths.map((href, index) => {
    const sourcePage = sourcePages.get(href);
    const media = firstMedia(sourcePage);
    const existingItem = existingPublishedItems.find((item) => item.href === href);
    const label = labelByPath.get(href) || existingItem?.label || href.split("/").pop() || "Save the Date theme";
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
    { label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: buildItems(lovePaths) },
    { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: buildItems(seasonalPaths) }
  ];
  const nextItems = nextGroups.flatMap((candidate) => candidate.items);
  const leadMedia = firstMedia(sourcePages.get(sourcePaths[0]));
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
    ...(leadMedia ? { mediaManifest: [{ ...leadMedia, role: "hero", loading: "eager", fetchPriority: "high" }] } : {}),
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
  await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: {} }, update: { draftJson: nextSettings } });
  });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") throw new Error(`Save the Date publication snapshot is invalid: ${integrity}`);
  await publishReviewedDraftSiteRelational(siteId, "best-save-the-date-sync");
  console.log(JSON.stringify({ siteId, pagePath, categories: nextGroups.length, themes: nextItems.length, snapshotHash: snapshot.snapshotHash }, null, 2));
} finally {
  await prisma.$disconnect();
}
