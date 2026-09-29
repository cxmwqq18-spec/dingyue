#!/usr/bin/env node

/**
 * Retire the legacy Aidreamcapes video routes that are no longer part of the
 * current 35-item product directory.
 *
 * Public Aidreamcapes content is owned by LivePage and ThemeSettings. ThemePage
 * is read here only to remove the matching legacy records; it is never used as
 * the source for the replacement content.
 */

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { PrismaClient } from "@prisma/client";
import ts from "typescript";
import {
  argumentValue,
  assertDatabaseTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
  parseDatabaseUrl
} from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SITE_SLUG = "aidreamcapes";
const HOME_SLUG = "/";
const LEGACY_SLUGS = [
  "brand-video",
  "explainer-video",
  "fashion-video",
  "instagram-reels",
  "meme-video",
  "motion-generator",
  "pet-video",
  "product-ad-video",
  "social-media-video",
  "story-video",
  "talking-head-video",
  "talking-photo",
  "tiktok-video",
  "video-ad",
  "youtube-video"
];
const LEGACY_PATHS = LEGACY_SLUGS.map((slug) => `/ai-video-generation/${slug}`);
const RETIRED_ROUTE_REPLACEMENTS = new Map([
  ["/ai-video-generation/brand-video", "/ai-video-generation/founder-update"],
  ["/ai-video-generation/explainer-video", "/ai-video-generation/how-to-video"],
  ["/ai-video-generation/fashion-video", "/ai-video-generation/fashion-try-on-reel"],
  ["/ai-video-generation/instagram-reels", "/ai-video-generation/tiktok-reels-shorts"],
  ["/ai-video-generation/meme-video", "/ai-video-generation/hook-lab"],
  ["/ai-video-generation/motion-generator", "/ai-video-generation/cinematic-video"],
  ["/ai-video-generation/pet-video", "/ai-video-generation/ugc-ad-video"],
  ["/ai-video-generation/product-ad-video", "/ai-video-generation/ugc-ad-video"],
  ["/ai-video-generation/social-media-video", "/ai-video-generation/tiktok-reels-shorts"],
  ["/ai-video-generation/story-video", "/ai-video-generation/promo-video"],
  ["/ai-video-generation/video-ad", "/ai-video-generation/hook-lab"],
  ["/ai-video-generation/talking-photo", "/ai-video-generation/talking-photo-recs"],
  ["/ai-video-generation/talking-head-video", "/ai-video-generation/ai-actor-product-ads"],
  ["/ai-video-generation/tiktok-video", "/ai-video-generation/tiktok-reels-shorts"],
  ["/ai-video-generation/youtube-video", "/ai-video-generation/cinematic-video"]
]);

const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
const productionMode = applyProduction || hasArgument("--production");
assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one database apply target.");
const apply = applyLocal || applyProduction;
const confirmation = argumentValue("--confirm") ?? "";

if (productionMode) {
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if ((current.database === "dingyue_local" || current.port === 15433) && process.env.REMOTE_DB_DATABASE_URL) {
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  process.env.DINGYUE_ENV = "production";
  process.env.DATABASE_TARGET = "production";
}

assertDatabaseTarget({
  expectedTarget: productionMode ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
if (apply) assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);

function clone(value) {
  return structuredClone(value ?? {});
}

function loadCurrentNavigation() {
  const sourcePath = path.join(process.cwd(), "src/lib/aidreamcapes-navigation.ts");
  const source = fs.readFileSync(sourcePath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const moduleRecord = { exports: {} };
  vm.runInNewContext(compiled, { module: moduleRecord, exports: moduleRecord.exports });
  const value = moduleRecord.exports;
  const navigation = {
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
  const videoItems = navigation.video.groups.flatMap((group) => group.items);
  assert.equal(videoItems.length, 35, "current Aidreamcapes video navigation must contain 35 entries");
  assert.equal(new Set(videoItems.map((item) => item.href)).size, 35, "current Aidreamcapes video navigation must not contain duplicates");
  assert.equal(videoItems.some((item) => LEGACY_PATHS.includes(item.href)), false, "current video navigation contains a retired route");
  assert.equal(countExact(navigation, LEGACY_PATHS), 0, "current navigation contains a retired route");
  return navigation;
}

function rewriteRetiredRoutes(value) {
  if (typeof value === "string") return RETIRED_ROUTE_REPLACEMENTS.get(value) ?? value;
  if (Array.isArray(value)) return value.map(rewriteRetiredRoutes);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    RETIRED_ROUTE_REPLACEMENTS.get(key) ?? key,
    rewriteRetiredRoutes(child)
  ]));
}

function replaceSettings(value, navigation) {
  const next = clone(value);
  if (next.seo?.pages && typeof next.seo.pages === "object" && !Array.isArray(next.seo.pages)) {
    next.seo.pages = Object.fromEntries(Object.entries(next.seo.pages).filter(([route]) => !LEGACY_PATHS.includes(route)));
  }
  const rewritten = rewriteRetiredRoutes(next);
  rewritten.aidreamcapesZipNavigation = clone(navigation);
  return rewritten;
}

function countExact(value, needles) {
  const targets = new Set(needles);
  let count = 0;
  const visit = (current) => {
    if (typeof current === "string") {
      if (targets.has(current)) count += 1;
      return;
    }
    if (Array.isArray(current)) {
      current.forEach(visit);
      return;
    }
    if (!current || typeof current !== "object") return;
    for (const [key, child] of Object.entries(current)) {
      if (targets.has(key)) count += 1;
      visit(child);
    }
  };
  visit(value);
  return count;
}

function compactPage(row, jsonKey) {
  return {
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    pageType: row.pageType,
    templateKey: row.templateKey,
    title: row.title,
    updatedAt: row.updatedAt,
    [jsonKey]: row[jsonKey]
  };
}

function backupPath() {
  return path.join(process.cwd(), "releases/backups/aidreamcapes", `legacy-video-retirement-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
}

const navigation = loadCurrentNavigation();
const prisma = new PrismaClient();
try {
  const legacyRouteSlugs = LEGACY_PATHS;
  const [site, livePages, themePages, allLivePages, allThemePages, settings, homepage] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } }, orderBy: { slug: "asc" } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } } })
  ]);

  assert(site, `${SITE_ID}: site not found`);
  assert.equal(site.slug, SITE_SLUG);
  assert.equal(site.primaryDomain.toLowerCase(), "www.aidreamcapes.com");
  assert(settings, `${SITE_ID}: ThemeSettings is required`);
  assert(homepage, `${SITE_ID}: homepage LivePage is required`);

  const nextHomepage = rewriteRetiredRoutes(homepage.contentJson);
  const nextDraftSettings = replaceSettings(settings.draftJson, navigation);
  const nextPublishedSettings = replaceSettings(settings.publishedJson, navigation);
  const nextLivePages = allLivePages.map((row) => ({ row, contentJson: rewriteRetiredRoutes(row.contentJson) }));
  const nextThemePages = allThemePages.map((row) => ({
    row,
    draftJson: rewriteRetiredRoutes(row.draftJson),
    publishedJson: rewriteRetiredRoutes(row.publishedJson)
  }));
  const changedLivePages = nextLivePages.filter(({ row, contentJson }) => JSON.stringify(row.contentJson) !== JSON.stringify(contentJson));
  const changedThemePages = nextThemePages.filter(({ row, draftJson, publishedJson }) =>
    JSON.stringify(row.draftJson) !== JSON.stringify(draftJson) || JSON.stringify(row.publishedJson) !== JSON.stringify(publishedJson)
  );
  const allLiveLegacyRefs = allLivePages.reduce((sum, row) => sum + countExact(row.contentJson, LEGACY_PATHS), 0);
  const allThemeLegacyRefs = allThemePages.reduce((sum, row) => sum + countExact(row.draftJson, LEGACY_PATHS) + countExact(row.publishedJson, LEGACY_PATHS), 0);
  const expectedCurrentHrefs = navigation.video.groups.flatMap((group) => group.items).map((item) => item.href);

  const report = {
    ok: true,
    mode: applyProduction ? "production-apply" : applyLocal ? "local-apply" : "dry-run",
    site: { id: SITE_ID, slug: site.slug, primaryDomain: site.primaryDomain },
    retiredPaths: LEGACY_PATHS,
    before: {
      livePageCount: livePages.length,
      themePageCount: themePages.length,
      publishedJsonLegacyRefs: allLiveLegacyRefs + allThemeLegacyRefs,
      homepageLegacyRefs: countExact(homepage.contentJson, LEGACY_PATHS),
      settingsLegacyRefs: countExact(settings.draftJson, LEGACY_PATHS) + countExact(settings.publishedJson, LEGACY_PATHS),
      currentVideoEntryCount: expectedCurrentHrefs.length
    },
    after: {
      livePageCount: 0,
      themePageCount: 0,
      publishedJsonLegacyRefs: countExact(nextHomepage, LEGACY_PATHS) +
        countExact(nextDraftSettings, LEGACY_PATHS) + countExact(nextPublishedSettings, LEGACY_PATHS) +
        nextLivePages.reduce((sum, item) => sum + countExact(item.contentJson, LEGACY_PATHS), 0) +
        nextThemePages.reduce((sum, item) => sum + countExact(item.draftJson, LEGACY_PATHS) + countExact(item.publishedJson, LEGACY_PATHS), 0),
      homepageLegacyRefs: countExact(nextHomepage, LEGACY_PATHS),
      actorTargetRefs: countExact(nextHomepage, ["/ai-video-generation/ai-actor-product-ads"]),
      settingsLegacyRefs: countExact(nextDraftSettings, LEGACY_PATHS) + countExact(nextPublishedSettings, LEGACY_PATHS),
      currentVideoEntryCount: expectedCurrentHrefs.length,
      currentVideoEntries: expectedCurrentHrefs
    },
    changed: livePages.length > 0 || themePages.length > 0 || changedLivePages.length > 0 || changedThemePages.length > 0 || JSON.stringify(homepage.contentJson) !== JSON.stringify(nextHomepage) || JSON.stringify(settings.draftJson) !== JSON.stringify(nextDraftSettings) || JSON.stringify(settings.publishedJson) !== JSON.stringify(nextPublishedSettings),
    backupPath: null
  };

  assert.equal(report.after.homepageLegacyRefs, 0, "homepage still contains a retired video route");
  assert(report.after.actorTargetRefs > 0, "homepage AI Actor Product Ads target was not written");
  assert.equal(report.after.settingsLegacyRefs, 0, "replacement settings still contain a retired video route");

  if (apply && report.changed) {
    const file = backupPath();
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      siteId: SITE_ID,
      retiredPaths: LEGACY_PATHS,
      livePages: livePages.map((row) => compactPage(row, "contentJson")),
      themePages: themePages.map((row) => compactPage(row, "draftJson")),
      themePagesPublishedJson: themePages.map((row) => ({ id: row.id, slug: row.slug, publishedJson: row.publishedJson })),
      rewrittenLivePages: changedLivePages.map(({ row }) => compactPage(row, "contentJson")),
      rewrittenThemePages: changedThemePages.map(({ row }) => ({ ...compactPage(row, "draftJson"), publishedJson: row.publishedJson })),
      homepage,
      settings
    }, null, 2)}\n`, { mode: 0o600 });
    report.backupPath = file;

    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: homepage.id }, data: { contentJson: nextHomepage, updatedAt: new Date() } });
      await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: nextDraftSettings, publishedJson: nextPublishedSettings, updatedAt: new Date() } });
      for (const { row, contentJson } of changedLivePages) {
        await tx.livePage.update({ where: { id: row.id }, data: { contentJson, updatedAt: new Date() } });
      }
      for (const { row, draftJson, publishedJson } of changedThemePages) {
        await tx.themePage.update({ where: { id: row.id }, data: { draftJson, publishedJson, updatedAt: new Date() } });
      }
      await tx.livePage.deleteMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } } });
      await tx.themePage.deleteMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } } });
    }, { timeout: 120_000 });

    const [liveReadback, themeReadback, settingsReadback, homeReadback, allLiveReadback, allThemeReadback] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } }, select: { slug: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: legacyRouteSlugs } }, select: { slug: true } }),
      prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { id: homepage.id }, select: { contentJson: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
    ]);
    assert.equal(liveReadback.length, 0, "legacy LivePage rows remain after retirement");
    assert.equal(themeReadback.length, 0, "legacy ThemePage rows remain after retirement");
    assert.equal(countExact(settingsReadback?.draftJson, LEGACY_PATHS) + countExact(settingsReadback?.publishedJson, LEGACY_PATHS), 0, "legacy SEO/navigation refs remain in ThemeSettings");
    assert.equal(countExact(homeReadback?.contentJson, LEGACY_PATHS), 0, "legacy homepage refs remain after retirement");
    const remainingPublishedJsonLegacyRefs = allLiveReadback.reduce((sum, row) => sum + countExact(row.contentJson, LEGACY_PATHS), 0) +
      allThemeReadback.reduce((sum, row) => sum + countExact(row.draftJson, LEGACY_PATHS) + countExact(row.publishedJson, LEGACY_PATHS), 0);
    assert.equal(remainingPublishedJsonLegacyRefs, 0, "legacy route references remain in published JSON");
    report.readback = {
      legacyLivePages: liveReadback.length,
      legacyThemePages: themeReadback.length,
      settingsLegacyRefs: countExact(settingsReadback?.draftJson, LEGACY_PATHS) + countExact(settingsReadback?.publishedJson, LEGACY_PATHS),
      homepageLegacyRefs: countExact(homeReadback?.contentJson, LEGACY_PATHS),
      publishedJsonLegacyRefs: remainingPublishedJsonLegacyRefs,
      rewrittenLivePages: changedLivePages.length,
      rewrittenThemePages: changedThemePages.length
    };
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
