#!/usr/bin/env node
import "./load-runtime-env.mjs";
import path from "node:path";
import Module from "node:module";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolve.call(this, resolved, ...args);
};

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const apply = process.argv.includes("--apply");
const databaseTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
if (databaseTarget === "production" && process.env.CONFIRM_SAVE_THE_DATE_PRODUCTION !== "1") {
  throw new Error("Production repair requires CONFIRM_SAVE_THE_DATE_PRODUCTION=1.");
}
assertDatabaseTarget({ expectedTarget: databaseTarget, env: process.env, requireProductionConfirmation: databaseTarget === "production", productionConfirmed: process.env.CONFIRM_SAVE_THE_DATE_PRODUCTION === "1" });
const prisma = new PrismaClient();
const clone = (value) => JSON.parse(JSON.stringify(value));
const routeLabel = new Map([
  ["/ai-save-the-date/valentines-day", "Valentine's Day"],
  ["/holidays-events/engagement", "Engagement"],
  ["/holidays-events/proposal", "Proposal"],
  ["/holidays-events/save-the-date", "Save the Date"],
  ["/holidays-events/wedding-invitation", "Wedding Invitation"],
  ["/ai-video-generation/wedding-ceremony", "Wedding Ceremony"],
  ["/holidays-events/wedding-anniversary", "Wedding Anniversary"],
  ["/holidays-events/christmas", "Christmas"],
  ["/holidays-events/thanksgiving", "Thanksgiving"],
  ["/holidays-events/new-year", "New Year"],
  ["/holidays-events/mothers-day", "Mother's Day"],
  ["/holidays-events/fathers-day", "Father's Day"],
  ["/holidays-events/halloween", "Halloween"]
]);
const lovePaths = [
  "/ai-save-the-date/valentines-day",
  "/holidays-events/engagement",
  "/holidays-events/proposal",
  "/holidays-events/save-the-date",
  "/holidays-events/wedding-invitation",
  "/ai-video-generation/wedding-ceremony",
  "/holidays-events/wedding-anniversary"
];
const seasonalPaths = [
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year",
  "/holidays-events/mothers-day",
  "/holidays-events/fathers-day",
  "/holidays-events/halloween"
];
const validPathSet = new Set([...lovePaths, ...seasonalPaths]);

function firstMedia(page) {
  return page?.draftJson?.mediaManifest?.find((item) => item?.src && item?.alt) || page?.publishedJson?.mediaManifest?.find((item) => item?.src && item?.alt);
}

function normalizePageJson(pageJson, pathName, label) {
  const json = clone(pageJson);
  json.pageType = "standard-content";
  json.version = 1;
  json.seo = { ...(json.seo || {}), canonicalPath: pathName, canonical: `https://www.mydreamshoots.com${pathName}`, index: true, follow: true, robots: { ...(json.seo?.robots || {}), index: true, follow: true, maxImagePreview: "large" }, title: json.seo?.title || `AI ${label} Photos and Videos | myDreamshoots`, description: json.seo?.description || `Create ${label} photos and videos with AI from approved source images.` };
  json.relatedLinks = [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/holidays-events/save-the-date" }];
  json.contentContract = { ...(json.contentContract || {}), schema: "editorial-page-v1", pageKey: pathName === "/holidays-events/halloween" ? "halloween" : "save_date", mediaCount: json.mediaManifest?.length || 11, faqCount: json.contentContract?.faqCount || 4, requiredSections: json.contentContract?.requiredSections || json.sectionsOrder.map((id) => json.sections[id]?.settings?.anchor || id), sectionTypes: json.contentContract?.sectionTypes || json.sectionsOrder.map((id) => json.sections[id]?.type) };
  return json;
}

try {
  const record = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: { orderBy: { slug: "asc" } }, settings: true, domains: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  if (!record) throw new Error(`Site not found: ${siteId}`);
  const previousPublication = record.activePublication?.publication?.version
    ? await prisma.themePublication.findFirst({ where: { siteId, version: { lt: record.activePublication.publication.version } }, orderBy: { version: "desc" } })
    : undefined;
  const previousPages = new Map((previousPublication?.snapshot?.pages || []).map((page) => [page.slug, page.publishedJson]));
  const sourcePage = record.pages.find((page) => page.slug === "/holidays-events/save-the-date") || record.pages.find((page) => page.slug === "/holidays-events/engagement");
  if (!sourcePage) throw new Error("Missing source Save the Date page");
  const sourceJson = sourcePage.publishedJson?.sectionsOrder?.length ? sourcePage.publishedJson : sourcePage.draftJson;
  const pageWrites = new Map();
  for (const pathName of [...validPathSet]) {
    const existing = record.pages.find((page) => page.slug === pathName);
    if (existing) continue;
    const label = routeLabel.get(pathName);
    const json = normalizePageJson(sourceJson, pathName, label);
    const pageId = `page_${siteId}_${pathName.slice(1).replace(/[^a-z0-9]+/gi, "_")}`;
    pageWrites.set(pathName, { id: pageId, siteId, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: pathName, title: `AI ${label} | myDreamshoots`, draftJson: json, publishedJson: {} });
  }
  const allPages = [...record.pages, ...pageWrites.values()];
  const settings = clone(record.settings?.draftJson || record.settings?.publishedJson || {});
  const itemFor = (pathName, sortOrder) => {
    const page = allPages.find((candidate) => candidate.slug === pathName);
    const json = page?.draftJson || page?.publishedJson;
    const media = firstMedia(page);
    return { label: routeLabel.get(pathName) || pathName, slug: pathName.split("/").pop(), href: pathName, status: "published", sortOrder, description: String(json?.seo?.description || `Create ${routeLabel.get(pathName)} photos and videos with AI.`).replace(/^#\s*/, "").trim(), ...(media ? { imageUrl: media.src, imageAlt: media.alt } : {}) };
  };
  settings.saveTheDateNavigation = {
    menuLabel: "Save the Date",
    groups: [
      { label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: lovePaths.map(itemFor) },
      { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: seasonalPaths.map(itemFor) }
    ]
  };
  if (apply) await prisma.$transaction(async (tx) => {
    for (const page of pageWrites.values()) await tx.themePage.create({ data: page });
    for (const page of allPages.filter((candidate) => validPathSet.has(candidate.slug))) {
      const nextJson = pageWrites.has(page.slug)
        ? pageWrites.get(page.slug).draftJson
        : ["/holidays-events/wedding-invitation", "/holidays-events/wedding-anniversary", "/holidays-events/halloween"].includes(page.slug)
          ? normalizePageJson(page.draftJson?.sectionsOrder?.length ? page.draftJson : page.publishedJson, page.slug, routeLabel.get(page.slug))
          : clone(previousPages.get(page.slug) || (page.draftJson?.sectionsOrder?.length ? page.draftJson : page.publishedJson));
      const contractSections = nextJson.sectionsOrder.map((id) => nextJson.sections[id]).filter(Boolean);
      const faqSection = contractSections.find((section) => section.type === "faq");
      nextJson.contentContract = {
        ...(nextJson.contentContract || {}),
        schema: "editorial-page-v1",
        pageKey: page.slug === "/holidays-events/halloween" ? "halloween" : (nextJson.contentContract?.pageKey || page.slug.slice(1).replace(/[^a-z0-9]+/gi, "_")),
        requiredSections: contractSections.map((section) => section.settings?.anchor || "section"),
        sectionTypes: contractSections.map((section) => section.type),
        faqCount: faqSection?.blocks?.length || nextJson.contentContract?.faqCount || 4,
        mediaCount: nextJson.mediaManifest?.length || nextJson.contentContract?.mediaCount || 11
      };
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: nextJson } });
      for (const item of nextJson.mediaManifest || []) {
        await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: item.src } }, create: { id: `media_${siteId}_${Buffer.from(item.src).toString("hex").slice(0, 24)}`, siteId, label: item.src.split("/").pop() || item.src, storageKey: item.src, mimeType: "image/jpeg", usageType: "theme", sourceType: "save-the-date-repair", previewUrl: item.src, originUrl: item.src, altText: item.alt, notes: item.caption || "" }, update: { altText: item.alt, notes: item.caption || "", previewUrl: item.src, originUrl: item.src } });
      }
    }
    for (const page of allPages.filter((candidate) => /cookie/i.test(candidate.slug) || /cookie policy/i.test(candidate.title))) {
      const json = clone(page.draftJson?.sectionsOrder?.length ? page.draftJson : page.publishedJson);
      json.seo = { ...(json.seo || {}), canonicalPath: page.slug, canonical: `https://www.mydreamshoots.com${page.slug}`, index: false, follow: true, title: json.seo?.title || "Cookie Policy | myDreamshoots", description: json.seo?.description || "Learn how myDreamshoots uses cookies and similar technologies on this website." };
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: json } });
    }
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: settings, publishedJson: {} }, update: { draftJson: settings } });
  });
  const jiti = (await import("jiti")).default(import.meta.url);
  const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, siteId, mode: apply ? "draft-only" : "dry-run", manifestHash: manifest.manifestHash, newPages: [...pageWrites.keys()], navigation: settings.saveTheDateNavigation, publicationRequired: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
