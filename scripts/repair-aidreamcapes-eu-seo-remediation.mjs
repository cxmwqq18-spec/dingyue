#!/usr/bin/env node

// Scoped Aidreamcapes EU SEO data remediation.
//
// The default mode is read-only. Apply mode archives or isolates records but
// never deletes historical data. Production writes require both an explicit
// target and a confirmation token so a copied local command cannot mutate the
// wrong database.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const SITE_DOMAIN = "aidreamcapes.eu";
const CONFIRMATION = "aidreamcapes-eu-seo-remediation";
const RETIRED_PATHS = new Set([
  "/ai-save-the-date/easter",
  "/ai-save-the-date/wedding-anniversary",
  "/ai-image-generation/estilo-y-fantasia",
  "/ai-image-generation/urbano",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo",
  "/tools/image-studio",
  "/tools/seasonal-celebration-album-maker"
]);
const IMAGE_MIME = /^image\//i;
const VIDEO_MIME = /^(?:video\/|audio\/)/i;
const MEDIA_ISOLATION_SOURCE = "aidreamcapes-eu-seo-isolated";
const applyLocal = hasArgument("--apply-local") || (hasArgument("--apply") && !hasArgument("--apply-production"));
const applyProduction = hasArgument("--apply-production");
const targetArgument = argumentValue("--target");
const apply = applyLocal || applyProduction;
const target = applyProduction || targetArgument === "production" ? "production" : "local";
const productionConfirmed = argumentValue("--confirm") === CONFIRMATION;
const backupDirArgument = argumentValue("--backup-dir");
const reportRoot = path.resolve(".tmp", "aidreamcapes-eu-seo-remediation");

if (applyProduction && !productionConfirmed) {
  throw new Error(`Production apply requires --confirm=${CONFIRMATION}.`);
}
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: applyProduction,
  productionConfirmed
});
if (applyLocal) assertNonProductionWriteTarget();

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function replaceEuBrandText(value) {
  if (typeof value === "string") {
    // Do not rewrite hostnames inside URLs. This targets the visible legacy
    // brand token in copy such as a legal contact heading or paragraph.
    return value.replace(/(?<![/.])aidreamcapes\.com\b/gi, "Aidreamcapes EU");
  }
  if (Array.isArray(value)) return value.map(replaceEuBrandText);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceEuBrandText(item)]));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function routeForVideoTheme(theme) {
  const slug = compact(theme.slug).replace(/^\/+/, "");
  return [`/ai-video-generation/${slug}`, `/ai-save-the-date/${slug}`];
}

function hasPublicPageForVideoTheme(theme, livePages) {
  const pageSlugs = new Set(livePages.map((page) => page.slug));
  return routeForVideoTheme(theme).some((route) => pageSlugs.has(route));
}

function isMissing(value) {
  return !compact(value);
}

function isImageAsset(asset) {
  return IMAGE_MIME.test(compact(asset.mimeType)) && !VIDEO_MIME.test(compact(asset.mimeType));
}

function storageExtension(asset) {
  return compact(asset.storageKey).split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || "";
}

function hasKnownMimeMismatch(asset) {
  const extension = storageExtension(asset);
  return extension === "svg" && compact(asset.mimeType).toLowerCase() !== "image/svg+xml";
}

function frenchAssetAlt(asset) {
  const label = compact(asset.label || asset.storageKey)
    .replace(/\.(?:jpe?g|png|webp|avif|svg|mp4|webm)$/i, "")
    .replace(/[\\/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (/logo/i.test(label)) return "Logo Aidreamcapes";
  if (/portrait|headshot|avatar/i.test(label)) return `Portrait visuel Aidreamcapes : ${label}`;
  if (/christmas|noel/i.test(label)) return `Visuel de Noël Aidreamcapes : ${label}`;
  if (/wedding|mariage|save the date/i.test(label)) return `Visuel Save the Date Aidreamcapes : ${label}`;
  return `Visuel Aidreamcapes : ${label || "création originale"}`;
}

function isolatedNotes(asset, reasons) {
  const marker = `[${MEDIA_ISOLATION_SOURCE}]`;
  const existing = compact(asset.notes);
  const detail = `${marker} Exclu des ressources publiques EU : ${reasons.join(", ")}. Enregistrement historique conservé.`;
  return existing.includes(marker) ? existing : [existing, detail].filter(Boolean).join("\n");
}

function noindexJson(rawJson, route) {
  const json = clone(rawJson ?? {});
  const currentSeo = json && typeof json.seo === "object" && !Array.isArray(json.seo) ? json.seo : {};
  const { auditNote: _auditNote, sitemapEligible: _sitemapEligible, ...seoWithoutAudit } = currentSeo;
  json.seo = {
    ...seoWithoutAudit,
    index: false,
    follow: false,
    robots: {
      ...(currentSeo.robots && typeof currentSeo.robots === "object" && !Array.isArray(currentSeo.robots) ? currentSeo.robots : {}),
      index: false,
      follow: false
    }
  };
  return json;
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: SITE_ID },
    select: { id: true, slug: true, primaryDomain: true, status: true }
  });
  assert(site, `Target site not found: ${SITE_ID}`);
  assert.equal(site.slug, SITE_SLUG, `Refusing non-EU site slug: ${site.slug}`);
  assert.equal(site.primaryDomain, SITE_DOMAIN, `Refusing unexpected EU domain: ${site.primaryDomain}`);

  const [livePages, themePages, videoThemes, mediaAssets, toolMenuItems] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, orderBy: { storageKey: "asc" } }),
    prisma.toolMenuItem.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } })
  ]);

  const orphanActiveVideoThemes = videoThemes.filter((theme) => theme.status === "active" && !hasPublicPageForVideoTheme(theme, livePages));
  const retiredLiveUpdates = livePages
    .filter((page) => RETIRED_PATHS.has(page.slug))
    .map((page) => ({ row: page, contentJson: noindexJson(page.contentJson, page.slug) }))
    .filter((item) => JSON.stringify(item.row.contentJson) !== JSON.stringify(item.contentJson));
  const retiredThemeUpdates = themePages
    .filter((page) => RETIRED_PATHS.has(page.slug))
    .map((page) => ({ row: page, draftJson: noindexJson(page.draftJson, page.slug), publishedJson: noindexJson(page.publishedJson, page.slug) }))
    .filter((item) => JSON.stringify(item.row.draftJson) !== JSON.stringify(item.draftJson) || JSON.stringify(item.row.publishedJson) !== JSON.stringify(item.publishedJson));
  const brandLiveUpdates = livePages
    .map((page) => ({ row: page, contentJson: replaceEuBrandText(page.contentJson) }))
    .filter((item) => JSON.stringify(item.row.contentJson) !== JSON.stringify(item.contentJson));
  const brandThemeUpdates = themePages
    .map((page) => ({ row: page, draftJson: replaceEuBrandText(page.draftJson), publishedJson: replaceEuBrandText(page.publishedJson) }))
    .filter((item) => JSON.stringify(item.row.draftJson) !== JSON.stringify(item.draftJson) || JSON.stringify(item.row.publishedJson) !== JSON.stringify(item.publishedJson));

  const mediaUpdates = mediaAssets.map((asset) => {
    const reasons = [];
    const missingAlt = isMissing(asset.altText);
    const missingUrls = isMissing(asset.previewUrl) && isMissing(asset.originUrl);
    if (missingUrls) reasons.push("preview/origin URL missing");
    if (missingAlt && !isImageAsset(asset)) reasons.push("non-image MIME or video asset");
    if (hasKnownMimeMismatch(asset)) reasons.push("SVG MIME corrected");
    const altText = missingAlt ? (isImageAsset(asset) ? frenchAssetAlt(asset) : `Ressource média Aidreamcapes non publiée : ${compact(asset.label || asset.storageKey)}`) : asset.altText;
    const isolate = reasons.some((reason) => reason !== "SVG MIME corrected");
    const mimeType = hasKnownMimeMismatch(asset) ? "image/svg+xml" : asset.mimeType;
    const sourceType = isolate ? MEDIA_ISOLATION_SOURCE : asset.sourceType;
    const notes = isolate ? isolatedNotes(asset, reasons) : asset.notes;
    const changed = altText !== asset.altText || mimeType !== asset.mimeType || sourceType !== asset.sourceType || notes !== asset.notes;
    return { row: asset, altText, mimeType, sourceType, notes, changed, missingAlt, missingUrls, isolate, reasons };
  }).filter((item) => item.changed);

  const inactiveTools = toolMenuItems.filter((item) => item.status !== "active");
  const report = {
    ok: true,
    mode: apply ? (applyProduction ? "apply-production" : "apply-local") : "dry-run",
    target,
    site: { id: site.id, slug: site.slug, primaryDomain: site.primaryDomain, status: site.status },
    counts: {
      livePages: livePages.length,
      themePages: themePages.length,
      videoThemes: videoThemes.length,
      activeVideoThemes: videoThemes.filter((theme) => theme.status === "active").length,
      orphanActiveVideoThemes: orphanActiveVideoThemes.length,
      mediaAssets: mediaAssets.length,
      mediaUpdates: mediaUpdates.length,
      missingAltAssets: mediaUpdates.filter((item) => item.missingAlt).length,
      missingUrlAssets: mediaUpdates.filter((item) => item.missingUrls).length,
      isolatedMediaAssets: mediaUpdates.filter((item) => item.isolate).length,
      inactiveTools: inactiveTools.length,
      retiredLiveUpdates: retiredLiveUpdates.length,
      retiredThemeUpdates: retiredThemeUpdates.length,
      brandLiveUpdates: brandLiveUpdates.length,
      brandThemeUpdates: brandThemeUpdates.length,
      pageOwnedVideoPages: ["/ai-video-generation/explainer-video", "/ai-video-generation/how-to-video", "/ai-video-generation/talking-head-video"].filter((route) => livePages.some((page) => page.slug === route))
    },
    archiveVideoThemes: orphanActiveVideoThemes.map((theme) => ({ id: theme.id, slug: theme.slug, status: theme.status, candidateRoutes: routeForVideoTheme(theme) })),
    isolateMediaAssets: mediaUpdates.map((item) => ({ id: item.row.id, storageKey: item.row.storageKey, mimeType: item.row.mimeType, missingAlt: item.missingAlt, missingUrls: item.missingUrls, isolate: item.isolate, reasons: item.reasons })),
    retiredRoutes: [...new Set([...retiredLiveUpdates.map((item) => item.row.slug), ...retiredThemeUpdates.map((item) => item.row.slug)])].sort(),
    backupPath: null
  };

  if (apply) {
    const backupDir = path.resolve(backupDirArgument || path.join(reportRoot, "backups"));
    const backupPath = path.join(backupDir, `aidreamcapes-eu-seo-before-${timestamp()}.json`);
    writeJson(backupPath, {
      createdAt: new Date().toISOString(),
      target,
      site,
      livePages: retiredLiveUpdates.map((item) => item.row),
      themePages: retiredThemeUpdates.map((item) => item.row),
      brandLivePages: brandLiveUpdates.map((item) => item.row),
      brandThemePages: brandThemeUpdates.map((item) => item.row),
      videoThemes: orphanActiveVideoThemes,
      mediaAssets: mediaUpdates.map((item) => item.row),
      toolMenuItems: inactiveTools
    });
    await prisma.$transaction(async (tx) => {
      for (const theme of orphanActiveVideoThemes) {
        await tx.videoTheme.update({ where: { id: theme.id }, data: { status: "archived" } });
      }
      for (const item of mediaUpdates) {
        await tx.mediaAsset.update({ where: { id: item.row.id }, data: { mimeType: item.mimeType, altText: item.altText, sourceType: item.sourceType, notes: item.notes } });
      }
      for (const item of retiredLiveUpdates) {
        await tx.livePage.update({ where: { id: item.row.id }, data: { contentJson: item.contentJson } });
      }
      for (const item of retiredThemeUpdates) {
        await tx.themePage.update({ where: { id: item.row.id }, data: { draftJson: item.draftJson, publishedJson: item.publishedJson } });
      }
      for (const item of brandLiveUpdates) {
        await tx.livePage.update({ where: { id: item.row.id }, data: { contentJson: item.contentJson } });
      }
      for (const item of brandThemeUpdates) {
        await tx.themePage.update({ where: { id: item.row.id }, data: { draftJson: item.draftJson, publishedJson: item.publishedJson } });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
    report.backupPath = backupPath;
    report.applied = {
      archivedVideoThemes: orphanActiveVideoThemes.length,
      updatedMediaAssets: mediaUpdates.length,
      noindexedLivePages: retiredLiveUpdates.length,
      noindexedThemePages: retiredThemeUpdates.length,
      updatedBrandLivePages: brandLiveUpdates.length,
      updatedBrandThemePages: brandThemeUpdates.length,
      hardDeletedRecords: 0
    };
  }

  const reportPath = path.join(reportRoot, `report-${timestamp()}.json`);
  writeJson(reportPath, report);
  console.log(JSON.stringify({ ...report, reportPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
