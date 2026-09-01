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
  ["/ai-save-the-date/engagement", "Engagement"],
  ["/ai-save-the-date/proposal", "Proposal"],
  ["/ai-save-the-date/save-the-date", "Save the Date"],
  ["/ai-save-the-date/wedding-invitation", "Wedding Invitation"],
  ["/ai-save-the-date/wedding-ceremony", "Wedding Ceremony"],
  ["/ai-save-the-date/christmas", "Christmas"],
  ["/ai-save-the-date/thanksgiving", "Thanksgiving"],
  ["/ai-save-the-date/new-year", "New Year"],
  ["/ai-save-the-date/easter", "Easter"],
  ["/ai-save-the-date/mothers-day", "Mother's Day"],
  ["/ai-save-the-date/fathers-day", "Father's Day"],
  ["/ai-save-the-date/halloween", "Halloween"]
]);
const lovePaths = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation",
  "/ai-save-the-date/wedding-ceremony"
];
const seasonalPaths = [
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];
const validPathSet = new Set([...lovePaths, ...seasonalPaths]);

function firstMedia(page) {
  const json = page?.contentJson;
  const direct = json?.mediaManifest?.find((item) => item?.src && item?.alt);
  if (direct) return direct;
  const topic = Object.values(json?.sections || {}).find((section) => section?.type === "ai_video_topic_landing")?.settings?.content;
  return topic?.hero?.image?.src && topic?.hero?.image?.alt
    ? { src: topic.hero.image.src, alt: topic.hero.image.alt }
    : undefined;
}

function pageForPath(pages, pathName) {
  const sourcePath = pathName === "/ai-save-the-date/wedding-invitation"
    ? "/ai-video-generation/wedding-invitation"
    : pathName;
  return pages.find((page) => page.slug === pathName || page.slug === sourcePath
    || page.contentJson?.seo?.canonicalPath === pathName
    || page.contentJson?.seo?.canonical === pathName);
}

function normalizePageJson(pageJson, pathName, label) {
  const json = clone(pageJson);
  json.pageType = "standard-content";
  json.version = 1;
  json.seo = { ...(json.seo || {}), canonicalPath: pathName, canonical: `https://www.mydreamshoots.com${pathName}`, index: true, follow: true, robots: { ...(json.seo?.robots || {}), index: true, follow: true, maxImagePreview: "large" }, title: json.seo?.title || `AI ${label} Photos and Videos | myDreamshoots`, description: json.seo?.description || `Create ${label} photos and videos with AI from approved source images.` };
  json.relatedLinks = [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/ai-save-the-date/save-the-date" }];
  json.contentContract = { ...(json.contentContract || {}), schema: "editorial-page-v1", pageKey: pathName === "/ai-save-the-date/halloween" ? "halloween" : "save_date", mediaCount: json.mediaManifest?.length || 11, faqCount: json.contentContract?.faqCount || 4, requiredSections: json.contentContract?.requiredSections || json.sectionsOrder.map((id) => json.sections[id]?.settings?.anchor || id), sectionTypes: json.contentContract?.sectionTypes || json.sectionsOrder.map((id) => json.sections[id]?.type) };
  return json;
}

try {
  const record = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: { orderBy: { slug: "asc" } }, livePages: { orderBy: { slug: "asc" } }, settings: true, domains: true, storefrontProfile: true, mediaAssets: true, connect: true } });
  if (!record) throw new Error(`Site not found: ${siteId}`);
  const livePages = record.livePages || [];
  const sourcePage = livePages.find((page) => page.slug === "/ai-save-the-date/save-the-date") || livePages.find((page) => page.slug === "/ai-save-the-date/engagement");
  if (!sourcePage) throw new Error("Missing source Save the Date page");
  const sourceJson = sourcePage.contentJson;
  const pageWrites = new Map();
  for (const pathName of [...validPathSet]) {
    const existing = pageForPath(record.pages, pathName);
    if (existing) continue;
    const label = routeLabel.get(pathName);
    const json = normalizePageJson(sourceJson, pathName, label);
    const pageId = `page_${siteId}_${pathName.slice(1).replace(/[^a-z0-9]+/gi, "_")}`;
    pageWrites.set(pathName, { id: pageId, siteId, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: pathName, title: `AI ${label} | myDreamshoots`, draftJson: json, publishedJson: {} });
  }
  const allPages = [...record.pages, ...pageWrites.values()];
  const settings = clone(record.settings?.draftJson || {});
  const itemFor = (pathName, sortOrder) => {
    const page = pageForPath(livePages, pathName);
    const json = page?.contentJson;
    const topic = Object.values(json?.sections || {}).find((section) => section?.type === "ai_video_topic_landing")?.settings?.content;
    const media = firstMedia(page);
    return { label: routeLabel.get(pathName) || pathName, slug: pathName.split("/").pop(), href: pathName, status: "published", sortOrder, description: String(topic?.seo?.description || json?.seo?.description || `Create ${routeLabel.get(pathName)} photos and videos with AI.`).replace(/^#\s*/, "").trim(), ...(media ? { imageUrl: media.src, imageAlt: media.alt } : {}) };
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
          : ["/ai-save-the-date/halloween"].includes(page.slug)
          ? normalizePageJson(page.draftJson, page.slug, routeLabel.get(page.slug))
          : clone(page.draftJson);
      const contractSections = nextJson.sectionsOrder.map((id) => nextJson.sections[id]).filter(Boolean);
      const faqSection = contractSections.find((section) => section.type === "faq");
      nextJson.contentContract = {
        ...(nextJson.contentContract || {}),
        schema: "editorial-page-v1",
        pageKey: page.slug === "/ai-save-the-date/halloween" ? "halloween" : (nextJson.contentContract?.pageKey || page.slug.slice(1).replace(/[^a-z0-9]+/gi, "_")),
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
      const json = clone(page.draftJson);
      json.seo = { ...(json.seo || {}), canonicalPath: page.slug, canonical: `https://www.mydreamshoots.com${page.slug}`, index: false, follow: true, title: json.seo?.title || "Cookie Policy | myDreamshoots", description: json.seo?.description || "Learn how myDreamshoots uses cookies and similar technologies on this website." };
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson: json } });
    }
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: settings, publishedJson: {} }, update: { draftJson: settings } });
  }, { maxWait: 15_000, timeout: 120_000 });
  const jiti = (await import("jiti")).default(import.meta.url);
  const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, siteId, mode: apply ? "draft-only" : "dry-run", manifestHash: manifest.manifestHash, newPages: [...pageWrites.keys()], navigation: settings.saveTheDateNavigation, publicationRequired: true }, null, 2));
} finally {
  await prisma.$disconnect();
}
