#!/usr/bin/env node

// Repair the French Aidreamcapes public media projection from current
// relational content. This is intentionally scoped to one EU site: it does
// not touch MyDreamShoots or the Spanish storefront, and it never calls an
// image provider or deletes an asset.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  argumentValue,
  assertDatabaseTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
  assertNonProductionWriteTarget
} from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const DOMAIN = "https://aidreamcapes.eu";
const ASSET_SITE = "site_aidreamcapes_eu";
const ASSET_ROOT_URL = `/assets/sites/${ASSET_SITE}`;
const IMAGE_PACK_ROOT_URL = `${ASSET_ROOT_URL}/generated/recovered/aidreamcapes-eu-image-pack-4k-20260916-v1`;
const IMAGE_PACK_ROOT_PATH = path.resolve("public", IMAGE_PACK_ROOT_URL.slice(1));
const PROVIDER_ROOT_URL = `${ASSET_ROOT_URL}/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1/reused-local`;
const PROVIDER_ROOT_PATH = path.resolve("public", PROVIDER_ROOT_URL.slice(1));
const VERSION = "20260928eusemantic1";
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-media-semantic");
const LOCAL_CONFIRMATION = "--confirm=aidreamcapes-eu-media-semantic-local";
const PRODUCTION_CONFIRMATION = "--confirm=aidreamcapes-eu-media-semantic-production";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") || hasArgument("--apply-local");
const databaseUrl = target === "production"
  ? buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 })
  : process.env.DATABASE_URL;

const PAGE_PACK_BY_SLUG = {
  "valentines-day": "valentines-photo",
  engagement: "engagement-photo",
  "wedding-ceremony": "wedding-photo",
  christmas: "christmas-photo",
  halloween: "halloween-photo",
  thanksgiving: "thanksgiving-photo",
  "new-year": "holiday",
  "mothers-day": "thanksgiving-photo",
  "fathers-day": "rich-lifestyle"
};

const PAGE_PATHS = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/wedding-invitation",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];

const DIRECT_PROVIDER_FILES = {
  "save-the-date": /^.+-save-the-date-(\d+)\.(?:webp|jpg)$/i,
  "wedding-invitation": /^.+-wedding-invitation-(\d+)\.webp$/i
};

const TUTORIALS = {
  image: {
    url: `${ASSET_ROOT_URL}/visuals/tutorial/aidreamcapes-ai-image-tutorial-20260814.mp4`,
    source: path.resolve("public/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4"),
    poster: `${PROVIDER_ROOT_URL}/888247afeeb1-aidreamcapes-ai-image-tutorial-20260814.jpg`
  },
  video: {
    url: `${ASSET_ROOT_URL}/visuals/tutorial/aidreamcapes-ai-video-tutorial-20260814.mp4`,
    source: path.resolve("public/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4"),
    poster: `${PROVIDER_ROOT_URL}/2c28e43c18e0-aidreamcapes-ai-video-tutorial-20260814.jpg`
  }
};

const IMAGE_KEYS = /^(?:src|imageUrl|imageOriginalUrl|poster|posterUrl|thumbnail|thumbnailUrl|cover|coverUrl|heroImage|backgroundImage|beforeImage|resultImageUrl)$/i;
const ALT_KEYS = /^(?:alt|imageAlt|ogImageAlt|twitterImageAlt)$/i;
const IMAGE_VALUE = /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i;

function clone(value) { return structuredClone(value); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function stripQuery(value) { return clean(value).split(/[?#]/)[0]; }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function sha(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function pageSlug(pagePath) { return pagePath.split("/").filter(Boolean).at(-1) ?? ""; }
function urlForFile(rootUrl, file) { return `${rootUrl}/${file}?v=${VERSION}`; }
function localFileForUrl(url) { return path.resolve("public", stripQuery(url).replace(/^\//, "")); }

function assertTarget() {
  if (target === "local") {
    assertDatabaseTarget({ expectedTarget: "local" });
    if (apply) {
      assertNonProductionWriteTarget();
      assert(hasArgument(LOCAL_CONFIRMATION), `Apply requires ${LOCAL_CONFIRMATION}.`);
    }
    return;
  }
  if (target === "production") {
    const env = { ...process.env, DATABASE_TARGET: "production", DINGYUE_ENV: "production", DATABASE_URL: databaseUrl };
    assertDatabaseTarget({
      expectedTarget: "production",
      env,
      requireProductionConfirmation: apply,
      productionConfirmed: hasArgument(PRODUCTION_CONFIRMATION)
    });
    if (apply) assert(hasArgument(PRODUCTION_CONFIRMATION), `Apply requires ${PRODUCTION_CONFIRMATION}.`);
    return;
  }
  throw new Error(`Unsupported target ${target}; use --target=local or --target=production.`);
}

function packFiles(packSlug) {
  const root = path.join(IMAGE_PACK_ROOT_PATH, packSlug);
  assert(fs.existsSync(root), `Missing EU image pack: ${root}`);
  const files = fs.readdirSync(root)
    .filter((file) => /\.(?:jpe?g|png|webp|avif)$/i.test(file))
    .sort((left, right) => {
      const leftCover = /\/|^cover[-.]/i.test(left) ? 0 : 1;
      const rightCover = /\/|^cover[-.]/i.test(right) ? 0 : 1;
      if (leftCover !== rightCover) return leftCover - rightCover;
      return left.localeCompare(right, undefined, { numeric: true });
    });
  assert(files.length >= 11, `${packSlug} image pack has fewer than 11 images.`);
  return files.slice(0, 11).map((file) => urlForFile(`${IMAGE_PACK_ROOT_URL}/${packSlug}`, file));
}

function providerFiles(pattern) {
  const files = fs.readdirSync(PROVIDER_ROOT_PATH)
    .filter((file) => pattern.test(file))
    .sort((left, right) => Number(left.match(pattern)?.[1] ?? 0) - Number(right.match(pattern)?.[1] ?? 0));
  assert.equal(files.length, 11, `Expected 11 provider images for ${pattern}, found ${files.length}.`);
  return files.map((file) => urlForFile(PROVIDER_ROOT_URL, file));
}

function proposalFiles() {
  const preferred = [
    "9e3422f49f8f-ai-engagement-proposal-moment.jpg",
    "04c2ebd5c41f-ai-engagement-sunset-beach-portrait.jpg",
    "78b2cf189878-ai-engagement-couple-city-walk.jpg",
    "341d8bab3154-hero-ai-engagement-ring-announcement.jpg",
    "fdb58f235d6d-hero-ai-engagement-couple-sunset.jpg",
    "ac96640e90af-ai-engagement-save-the-date-planning.jpg",
    "b096e7b86e74-ai-engagement-video-shoot.jpg",
    "d2829fea4b59-ai-engagement-beach-walk.jpg",
    "ede687ab7ac4-ai-engagement-garden-portrait.jpg",
    "fe161ba3b004-ai-engagement-ring-closeup.jpg",
    "8d94a890f858-hero-ai-engagement-video-recording.jpg"
  ];
  for (const file of preferred) assert(fs.existsSync(path.join(PROVIDER_ROOT_PATH, file)), `Missing proposal asset: ${file}`);
  return preferred.map((file) => urlForFile(PROVIDER_ROOT_URL, file));
}

function manifestForPage(pagePath) {
  const slug = pageSlug(pagePath);
  const urls = slug === "proposal"
    ? proposalFiles()
    : DIRECT_PROVIDER_FILES[slug]
      ? providerFiles(DIRECT_PROVIDER_FILES[slug])
      : packFiles(PAGE_PACK_BY_SLUG[slug]);
  const topicLabel = {
    "valentines-day": "la Saint-Valentin",
    engagement: "les fiançailles",
    proposal: "la demande en mariage",
    "save-the-date": "l’annonce de date",
    "wedding-ceremony": "la cérémonie de mariage",
    "wedding-invitation": "l’invitation de mariage",
    christmas: "Noël",
    halloween: "Halloween",
    thanksgiving: "Thanksgiving",
    "new-year": "le Nouvel An",
    "mothers-day": "la fête des mères",
    "fathers-day": "la fête des pères"
  }[slug] ?? "Aidreamcapes";
  return urls.map((src, index) => ({
    src,
    width: 3840,
    height: 2160,
    format: "WEBP",
    alt: index === 0 ? `Image principale pour ${topicLabel}.` : `Scène ${index} pour ${topicLabel}.`,
    role: index === 0 ? "hero" : "content",
    loading: index === 0 ? "eager" : "lazy",
    fetchPriority: index === 0 ? "high" : "auto",
    source: "Aidreamcapes EU semantic media inventory"
  }));
}

function isImageUrl(key, value) { return IMAGE_KEYS.test(key) && typeof value === "string" && IMAGE_VALUE.test(value); }

function rewriteMedia(value, manifest, altByUrl, state, key = "") {
  if (Array.isArray(value)) return value.map((item) => rewriteMedia(item, manifest, altByUrl, state, key));
  if (!value || typeof value !== "object") {
    if (isImageUrl(key, value)) {
      const base = stripQuery(value);
      const exact = manifest.find((item) => stripQuery(item.src) === base);
      return (exact ?? manifest[state.cursor++ % manifest.length]).src;
    }
    return value;
  }
  const next = {};
  for (const [childKey, childValue] of Object.entries(value)) next[childKey] = rewriteMedia(childValue, manifest, altByUrl, state, childKey);
  const imageValue = [next.imageUrl, next.src, next.poster, next.cover, next.thumbnail, next.heroImage].find((candidate) => typeof candidate === "string" && IMAGE_VALUE.test(candidate));
  const imageAlt = imageValue ? altByUrl.get(stripQuery(imageValue)) : undefined;
  if (imageAlt) for (const childKey of Object.keys(next)) if (ALT_KEYS.test(childKey)) next[childKey] = imageAlt;
  return next;
}

function preparePageJson(rawJson, pagePath) {
  const manifest = manifestForPage(pagePath);
  const altByUrl = new Map(manifest.map((item) => [stripQuery(item.src), item.alt]));
  const next = clone(rawJson ?? {});
  next.mediaManifest = manifest;
  next.seo = {
    ...(next.seo ?? {}),
    canonical: `${DOMAIN}${pagePath}`,
    canonicalPath: pagePath,
    ogImage: manifest[0].src,
    twitterImage: manifest[0].src,
    ogImageAlt: manifest[0].alt,
    twitterImageAlt: manifest[0].alt
  };
  const rewritten = rewriteMedia(next, manifest, altByUrl, { cursor: 0 });
  rewritten.mediaManifest = manifest;
  rewritten.seo = next.seo;
  return rewritten;
}

function prepareTutorialJson(rawJson, pagePath) {
  const next = clone(rawJson ?? {});
  const sections = next.sections ?? {};
  if (pagePath === "/") {
    const section = sections.tutorial_video_1;
    assert(section, "Homepage tutorial_video_1 is missing.");
    section.settings = { ...(section.settings ?? {}), videoUrl: TUTORIALS.image.url, imageUrl: TUTORIALS.image.poster };
  }
  if (pagePath === "/workflow") {
    const imageSection = sections.tutorial_video_1;
    const videoSection = sections.tutorial_image_video_1;
    assert(imageSection && videoSection, "Workflow tutorial sections are incomplete.");
    imageSection.settings = { ...(imageSection.settings ?? {}), videoUrl: TUTORIALS.image.url, imageUrl: TUTORIALS.image.poster };
    videoSection.settings = { ...(videoSection.settings ?? {}), videoUrl: TUTORIALS.video.url, imageUrl: TUTORIALS.video.poster };
  }
  return next;
}

function storageKey(url) { return stripQuery(url).replace(/^\//, ""); }
function mimeType(url) { return /\.mp4$/i.test(stripQuery(url)) ? "video/mp4" : "image/jpeg"; }
function mediaRow(url, alt, kind = "image") {
  const key = storageKey(url);
  return {
    id: `media_${SITE_ID}_${sha(key).slice(0, 16)}`,
    siteId: SITE_ID,
    label: `Aidreamcapes EU ${kind} semantic media`,
    storageKey: key,
    mimeType: mimeType(url),
    usageType: kind === "video" ? "video" : "theme",
    sourceType: "aidreamcapes-eu-semantic-media-repair",
    previewUrl: url,
    originUrl: url,
    altText: alt
  };
}

function ensureTutorialFiles() {
  const results = [];
  for (const tutorial of Object.values(TUTORIALS)) {
    const targetPath = localFileForUrl(tutorial.url);
    const sourceExists = fs.existsSync(tutorial.source);
    assert(sourceExists, `Missing tutorial source: ${tutorial.source}`);
    if (target === "local" && apply && !fs.existsSync(targetPath)) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.copyFileSync(tutorial.source, targetPath);
    }
    const targetExists = fs.existsSync(targetPath);
    if (apply || target === "production") assert(targetExists, `Missing direct tutorial target asset: ${targetPath}`);
    results.push({ url: tutorial.url, source: tutorial.source, target: targetPath, sourceExists, targetExists, action: targetExists ? "verified" : "planned" });
  }
  return results;
}

async function main() {
  assertTarget();
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const [site, livePages, themePages, settings] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...PAGE_PATHS, "/", "/workflow"] } }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...PAGE_PATHS, "/", "/workflow"] } }, orderBy: { slug: "asc" } }),
      prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } })
    ]);
    assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: "aidreamcapes.eu" });
    assert(PAGE_PATHS.every((slug) => livePages.some((page) => page.slug === slug)), "Expected every active Save the Date LivePage.");
    assert(settings, "Aidreamcapes EU ThemeSettings are missing.");

    const pageBySlug = new Map(livePages.map((page) => [page.slug, page]));
    const themeBySlug = new Map(themePages.map((page) => [page.slug, page]));
    const pageChanges = PAGE_PATHS.map((slug) => {
      const live = pageBySlug.get(slug);
      const theme = themeBySlug.get(slug);
      assert(live && theme, `Missing current page rows for ${slug}.`);
      const nextLive = preparePageJson(live.contentJson, slug);
      const nextDraft = preparePageJson(theme.draftJson, slug);
      const nextPublished = preparePageJson(theme.publishedJson, slug);
      return { slug, live, theme, nextLive, nextDraft, nextPublished };
    });

    const tutorialPages = ["/", "/workflow"].map((slug) => {
      const live = livePages.find((page) => page.slug === slug) ?? null;
      const theme = themeBySlug.get(slug) ?? null;
      return {
        slug,
        live,
        theme,
        nextLive: live ? prepareTutorialJson(live.contentJson, slug) : null,
        nextDraft: theme ? prepareTutorialJson(theme.draftJson, slug) : null,
        nextPublished: theme ? prepareTutorialJson(theme.publishedJson, slug) : null
      };
    });
    const nextSettingsDraft = clone(settings.draftJson);
    const nextSettingsPublished = clone(settings.publishedJson);
    for (const json of [nextSettingsDraft, nextSettingsPublished]) {
      const groups = json?.saveTheDateNavigation?.groups ?? [];
      for (const item of groups.flatMap((group) => group.items ?? [])) {
        const page = pageChanges.find((candidate) => candidate.slug === item.href);
        if (!page) continue;
        item.imageUrl = page.nextLive.mediaManifest[0].src;
        item.imageAlt = page.nextLive.mediaManifest[0].alt;
      }
    }

    const tutorialAssets = ensureTutorialFiles();
    const manifestRows = pageChanges.flatMap((row) => row.nextLive.mediaManifest.map((item) => mediaRow(item.src, item.alt)));
    const tutorialRows = [
      mediaRow(TUTORIALS.image.url, "Aidreamcapes image creation tutorial video.", "video"),
      mediaRow(TUTORIALS.video.url, "Aidreamcapes video creation tutorial video.", "video"),
      mediaRow(TUTORIALS.image.poster, "Aidreamcapes image creation tutorial poster."),
      mediaRow(TUTORIALS.video.poster, "Aidreamcapes video creation tutorial poster.")
    ];
    const mediaRows = [...new Map([...manifestRows, ...tutorialRows].map((row) => [row.storageKey, row])).values()];
    const changedLive = pageChanges.filter((row) => JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextLive)).length + tutorialPages.filter((row) => row.live && JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextLive)).length;
    const changedTheme = pageChanges.filter((row) => JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextDraft) || JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextPublished)).length + tutorialPages.filter((row) => row.theme && (JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextDraft) || JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextPublished))).length;
    const settingsChanged = JSON.stringify(settings.draftJson) !== JSON.stringify(nextSettingsDraft) || JSON.stringify(settings.publishedJson) !== JSON.stringify(nextSettingsPublished);
    const report = {
      ok: true,
      mode: apply ? `apply-${target}` : "dry-run",
      target,
      siteId: SITE_ID,
      pageCount: PAGE_PATHS.length,
      changedLivePages: changedLive,
      changedThemePages: changedTheme,
      settingsChanged,
      plannedMediaAssets: mediaRows.length,
      tutorialAssets,
      providerCalls: 0,
      oldResourcesDeleted: 0
    };

    if (apply) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(REPORT_ROOT, `backup-${target}-${stamp}.json`);
      writeJson(backupPath, {
        createdAt: new Date().toISOString(),
        target,
        siteId: SITE_ID,
        livePages: [...livePages, ...tutorialPages.filter((row) => row.live && !livePages.some((page) => page.id === row.live.id)).map((row) => row.live)].map((page) => ({ id: page.id, slug: page.slug, contentJson: page.contentJson })),
        themePages: themePages.map((page) => ({ id: page.id, slug: page.slug, draftJson: page.draftJson, publishedJson: page.publishedJson })),
        themeSettings: { id: settings.id, draftJson: settings.draftJson, publishedJson: settings.publishedJson }
      });
      report.backupPath = backupPath;
      const updates = [
        ...pageChanges.flatMap((row) => [
          prisma.livePage.update({ where: { id: row.live.id }, data: { contentJson: row.nextLive, title: row.nextLive.seo?.title || row.live.title } }),
          prisma.themePage.update({ where: { id: row.theme.id }, data: { draftJson: row.nextDraft, publishedJson: row.nextPublished } })
        ]),
        ...tutorialPages.flatMap((row) => row.live && row.theme ? [
          prisma.livePage.update({ where: { id: row.live.id }, data: { contentJson: row.nextLive } }),
          prisma.themePage.update({ where: { id: row.theme.id }, data: { draftJson: row.nextDraft, publishedJson: row.nextPublished } })
        ] : []),
        prisma.themeSettings.update({ where: { id: settings.id }, data: { draftJson: nextSettingsDraft, publishedJson: nextSettingsPublished } }),
        ...mediaRows.map((row) => prisma.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: row.storageKey } },
          create: row,
          update: { label: row.label, mimeType: row.mimeType, usageType: row.usageType, sourceType: row.sourceType, previewUrl: row.previewUrl, originUrl: row.originUrl, altText: row.altText }
        }))
      ];
      await prisma.$transaction(updates);
    }

    const readback = await Promise.all(PAGE_PATHS.map(async (slug) => {
      const expected = pageChanges.find((row) => row.slug === slug).nextLive.mediaManifest.map((item) => item.src);
      const row = apply ? await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug } }, select: { contentJson: true } }) : { contentJson: pageChanges.find((item) => item.slug === slug).nextLive };
      assert.deepEqual(row.contentJson.mediaManifest.map((item) => item.src), expected, `Media manifest readback mismatch: ${slug}`);
      assert.equal(new Set(expected).size, 11, `Media manifest must contain 11 unique images: ${slug}`);
      assert(expected.every((url) => url.startsWith(`${ASSET_ROOT_URL}/`) && !url.includes("/mirror/")), `Foreign or mirror media in ${slug}`);
      return { slug, hero: expected[0], count: expected.length };
    }));
    report.readback = readback;
    const reportPath = path.join(REPORT_ROOT, `report-${target}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
