#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, parseDatabaseUrl } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const productionConfirmed = process.argv.includes("--confirm-production");
const target = String(process.env.DATABASE_TARGET ?? "").trim().toLowerCase();
assertDatabaseTarget({ expectedTarget: "remote" });
if (target !== "remote" || !productionConfirmed) throw new Error("Production homepage publication requires DATABASE_TARGET=remote and --confirm-production.");
if (!apply) throw new Error("Use --apply to publish the approved MyDreamShoots homepage video-first baseline.");

const SEO = {
  title: "AI Video & Photo Generator | myDreamshoots",
  description: "Create AI videos from your photos, professional AI headshots, portraits, and themed photo sets. Make personalized Save the Date videos with myDreamshoots.",
  keywords: "AI video generator, AI photo generator, AI headshot generator, Save the Date video, AI photo packages",
  canonicalPath: "/",
  index: true,
  follow: true,
  robots: { index: true, follow: true }
};
const VIDEO_INTRO = "Turn your photos into AI videos for social media, storytelling, product marketing, and creative projects. Explore talking photo, cinematic video, social video, product video, and other supported workflows.";
const SAVE_THE_DATE_INTRO = "Create personalized Save the Date videos from your photos for engagements, proposals, wedding invitations, anniversaries, and special celebrations.";
const PHOTO_INTRO = "Create professional AI headshots, portraits, couple photos, travel images, seasonal photos, and creative photo sets from your uploaded photos.";
const HOW_IT_WORKS_SUBTITLE = "Choose what you want to create, upload your photos, review examples and credit costs, then generate and download your AI video or photo.";
const HOW_IT_WORKS_SUPPORTING_COPY = "Use the Upload Your Photos flow for supported AI Video, Save the Date, headshot, portrait, couple, seasonal, and creative photo workflows.";
const PRICING_DESCRIPTION = "Use credits across eligible AI photo and video workflows. The required credit cost is shown before generation.";
const HERO_SUBHEADLINE = "Upload your photos and choose what you want to create—from AI videos and personalized Save the Date videos to professional AI headshots, portraits, couple photos, seasonal images, and creative photo sets. Review examples and credit costs before generation, then access your finished results in your workspace.";
const PHOTO_SUBTITLES = new Map([
  ["world-cup-fan-photos", "Create match-day fan portraits and photos"],
  ["christmas-couple", "Create festive Christmas couple photos"],
  ["christmas-photos", "Create seasonal Christmas portraits"],
  ["creator-portraits", "Create professional portraits for creators"],
  ["gala-photos", "Create formal event and gala portraits"],
  ["holiday", "Create seasonal and holiday photo sets"],
  ["professional-headshots", "Create professional AI headshots from your photos"],
  ["cyberpunk", "Create neon cyberpunk AI portraits"]
]);

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
const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
}
function projectionRevision(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 20);
}

function applySeo(json, homePageId) {
  const next = clone(json) ?? {};
  next.seo = { ...(next.seo ?? {}), ...SEO, robots: { ...SEO.robots } };
  if (next.seo.pages && homePageId) next.seo.pages[homePageId] = { ...(next.seo.pages[homePageId] ?? {}), ...SEO, robots: { ...SEO.robots } };
  return next;
}

function updateFaq(section) {
  const next = clone(section) ?? { type: "faq", blocks: [] };
  next.settings = { ...(next.settings ?? {}), subtitle: "Answers to AI video, Save the Date, photo creation, pricing, privacy, uploads, credits, and refunds." };
  const blocks = Array.isArray(next.blocks) ? next.blocks : [];
  const required = [
    ["faq_photo_to_video", "Can I turn a photo into an AI video?", "Yes. Choose a supported image-to-video workflow, upload your photo, review the example and credit cost, and generate your AI video in your workspace."],
    ["faq_video_types", "What types of AI videos can I create?", "You can create talking photos, cinematic videos, social media videos, product videos, promotional videos, and other supported AI video styles. Explore AI Video Generation to see the available workflows."],
    ["faq_save_the_date", "Can I create a Save the Date video from my photos?", "Yes. Choose a Save the Date style, upload your photos and event details, review the example and credit cost, and generate a personalized Save the Date video to share."]
  ];
  for (const [id, question, answer] of required) {
    const existing = blocks.find((block) => block.id === id || block.settings?.question === question);
    if (existing) existing.settings = { ...(existing.settings ?? {}), question, answer };
    else blocks.push({ id, type: "faq_item", settings: { question, answer } });
  }
  next.blocks = blocks;
  return next;
}

function updateHomepage(page, homePageId) {
  const next = clone(page) ?? {};
  next.seo = { ...(next.seo ?? {}), ...SEO, robots: { ...SEO.robots } };
  next.sections ??= {};
  if (next.sections.hero_1) {
    const hero = next.sections.hero_1;
    hero.settings = {
      ...(hero.settings ?? {}),
      eyebrow: "AI Video & Photo Creation",
      heroBadge: "AI Video & Photo Creation",
      headline: "Create AI Videos, Professional AI Headshots & Photo Sets from Your Images",
      subheadline: HERO_SUBHEADLINE,
      authButtonLabel: "Start Creating with Email",
      imageBadge: "AI video & photo workflows",
      imageCaption: "Create AI videos and photo sets for social content, Save the Date moments, professional profiles, portraits, couple photos, seasonal images, and creative projects."
    };
    hero.blocks = (hero.blocks ?? []).map((block) => {
      if (block.id === "hero_cta_secondary") return { ...block, settings: { ...(block.settings ?? {}), label: "Explore AI Video", href: "/ai-video-generation" } };
      if (block.id === "hero_stat_packs") return { ...block, settings: { ...(block.settings ?? {}), value: "Video + Photo", label: "AI video & photo workflows" } };
      return block;
    });
  }
  const showcase = next.sections.generation_showcase_1;
  if (showcase) {
    showcase.settings = {
      ...(showcase.settings ?? {}),
      trustedLogoTitle: "Empowering creators worldwide",
      aboutTitle: "What is myDreamshoots?",
      aboutBody: "myDreamshoots is an AI video and photo generation platform that turns your images into AI videos, personalized Save the Date videos, professional AI headshots, portraits, couple photos, and themed photo sets.",
      subtitle: "These examples use materials customers created in private accounts. Scan the theme labels to choose a direction for your own set.",
      imageTitle: "Featured AI Photo Generators",
      videoTitle: "Featured AI Video Generators",
      videoIntro: VIDEO_INTRO,
      saveTheDateTitle: "AI Save the Date Videos",
      saveTheDateIntro: SAVE_THE_DATE_INTRO,
      photoIntro: PHOTO_INTRO,
      videoAllHref: "/ai-video-generation",
      saveTheDateAllHref: "/ai-save-the-date/save-the-date",
      saveTheDateItemLimit: 6,
      imageItemLimit: 8
    };
    delete showcase.settings.imageSlugs;
    delete showcase.settings.videoSlugs;
  }
  if (next.sections.faq_1) next.sections.faq_1 = updateFaq(next.sections.faq_1);
  if (next.sections.tutorial_video_1) {
    next.sections.tutorial_video_1.settings = {
      ...(next.sections.tutorial_video_1.settings ?? {}),
      title: "How It Works",
      subtitle: HOW_IT_WORKS_SUBTITLE,
      supportingCopy: HOW_IT_WORKS_SUPPORTING_COPY
    };
  }
  if (next.sections.package_catalog_1) {
    next.sections.package_catalog_1.settings = {
      ...(next.sections.package_catalog_1.settings ?? {}),
      subtitle: "Browse active AI photo themes and review the visible credit cost before starting a private photo package."
    };
  }
  if (next.sections.pricing_1) {
    next.sections.pricing_1.settings = {
      ...(next.sections.pricing_1.settings ?? {}),
      description: PRICING_DESCRIPTION
    };
  }
  if (next.sections.conversion_1) {
    next.sections.conversion_1.settings = {
      ...(next.sections.conversion_1.settings ?? {}),
      eyebrow: "AI VIDEO + PHOTO CREATION",
      title: "Ready to try myDreamshoots?",
      subtitle: "Create AI videos, personalized Save the Date videos, and professional photo sets from your images—all in one private workspace.",
      primaryCta: "Create Now",
      primaryHref: "/app/create"
    };
  }
  return next;
}

function updateSettings(json, homePageId) {
  const next = clone(json) ?? {};
  next.seo = { ...(next.seo ?? {}), siteDescription: SEO.description, siteKeywords: SEO.keywords };
  next.seo.pages = { ...(next.seo.pages ?? {}), [homePageId]: { ...(next.seo.pages?.[homePageId] ?? {}), ...SEO, robots: { ...SEO.robots } } };
  next.navigation ??= {};
  const existingFooterLinks = Array.isArray(next.navigation.footerLinks) ? next.navigation.footerLinks : [];
  const productFooterLinks = [
    ["AI Video Generation", "/ai-video-generation"],
    ["AI Save the Date", "/ai-save-the-date/save-the-date"],
    ["AI Image Generation", "/ai-image-generation"],
    ["AI Photo Packages", "/best-packages"],
    ["Pricing", "/pricing"]
  ].map(([label, href], index) => ({ id: `footer_nav_product_${index + 1}`, label, href, group: "product" }));
  next.navigation.footerLinks = [
    ...productFooterLinks,
    ...existingFooterLinks.filter((link) => link?.group !== "product")
  ];
  const header = next.globalSections?.header;
  if (header) header.settings = { ...(header.settings ?? {}), ctaLabel: "Start Creating", ctaHref: "/app/create" };
  if (header?.blocks) {
    header.blocks = header.blocks
      .filter((block) => block.settings?.label !== "Best Packages")
      .map((block) => block.settings?.label === "Save the Date"
        ? { ...block, settings: { ...(block.settings ?? {}), label: "AI Save the Date", href: "/ai-save-the-date/save-the-date" } }
        : block);
    const saveDateHeaderIndex = header.blocks.findIndex((block) => block.settings?.href === "/ai-save-the-date/save-the-date");
    if (saveDateHeaderIndex < 0) header.blocks.splice(1, 0, { id: "dreamshoot_header_save_the_date", type: "menu_link", settings: { label: "AI Save the Date", href: "/ai-save-the-date/save-the-date" } });
  }
  const footer = next.globalSections?.footer;
  if (footer?.blocks) {
    footer.blocks = footer.blocks.map((block) => block.settings?.label === "Best Packages"
      ? { ...block, settings: { ...(block.settings ?? {}), label: "AI Photo Packages", href: "/best-packages" } }
      : block);
    const hasSaveTheDate = footer.blocks.some((block) => block.settings?.href === "/ai-save-the-date/save-the-date");
    if (!hasSaveTheDate) footer.blocks.splice(2, 0, { id: "dreamshoot_footer_save_the_date", type: "menu_link", settings: { label: "AI Save the Date", href: "/ai-save-the-date/save-the-date", group: "product" } });
  }
  const announce = next.saasSettingsCurrent?.sections?.header_plus;
  if (announce) announce.settings = { ...(announce.settings ?? {}), announce_title: "Turn your photos into AI videos, personalized Save the Date videos, professional headshots, and themed photo sets." };
  const footerSettings = next.globalSections?.footer?.settings;
  if (footerSettings) footerSettings.tagline = "AI videos, Save the Date moments, photo sets, and private album delivery with visible credit costs";
  if (footerSettings) footerSettings.socialBody = "myDreamshoots helps you turn your own photos into AI videos, Save the Date moments, private AI headshots, portraits, and themed albums.";
  if (footerSettings) footerSettings.body = "Upload your photos, choose a video, Save the Date, or photo workflow, review the credit cost, and download private results.";
  if (footerSettings) footerSettings.bottomLine = "Credits, AI video and photo projects, private albums, and checkout stay inside your account.";
  return next;
}

function updateHomepageShowcases(snapshot, sourceSnapshot) {
  const next = clone(snapshot);
  const rows = Array.isArray(sourceSnapshot?.publishedHomepageShowcases)
    ? sourceSnapshot.publishedHomepageShowcases
    : Array.isArray(next.publishedHomepageShowcases) ? next.publishedHomepageShowcases : [];
  const photoPriority = [
    ["/ai-image-generation/soccer", "World Cup Fan Photos", "Create match-day fan portraits and photos"],
    ["/ai-image-generation/christmas-photo", "Christmas Couple", "Create festive Christmas couple photos"],
    ["/ai-image-generation/holiday", "Christmas Photos", "Create seasonal Christmas portraits"],
    ["/ai-image-generation/portrait-photo", "Creator Portraits", "Create professional portraits for creators"],
    ["/ai-image-generation/gala-photo", "Gala Photos", "Create formal event and gala portraits"],
    ["/ai-image-generation/nightlife", "Holiday", "Create seasonal and holiday photo sets"],
    ["/ai-image-generation/headshot", "Professional Headshots", "Create professional AI headshots from your photos"],
    ["/ai-image-generation/cyberpunk", "Cyberpunk", "Create neon cyberpunk AI portraits"]
  ];
  const photos = rows.filter((item) => item.kind === "photo");
  const selectedPhotos = photoPriority
    .map(([path]) => photos.find((item) => item.canonicalPath === path))
    .filter(Boolean);
  const photoRows = selectedPhotos.map((item, index) => ({
    ...item,
    title: photoPriority[index][1],
    subtitle: photoPriority[index][2],
    sortOrder: index + 1
  }));
  const saveDatePriority = ["/ai-save-the-date/valentines-day", "/ai-save-the-date/engagement", "/ai-save-the-date/proposal", "/ai-save-the-date/save-the-date"];
  const saveDates = rows.filter((item) => item.kind === "save_the_date");
  const selectedSaveDates = saveDatePriority
    .map((path) => saveDates.find((item) => item.canonicalPath === path))
    .filter(Boolean);
  const saveDateRows = selectedSaveDates.slice(0, 6);
  const otherRows = rows.filter((item) => item.kind === "video");
  next.publishedHomepageShowcases = [...otherRows, ...saveDateRows, ...photoRows];
  return next;
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: true, settings: true, activePublication: { include: { publication: true } } } });
  assert(site?.settings, "MyDreamShoots site and settings are required");
  const home = site.pages.find((page) => page.slug === "/");
  assert(home, "MyDreamShoots homepage is required");
  const active = site.activePublication?.publication;
  assert(active?.snapshot && typeof active.snapshot === "object", "active publication snapshot is required");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-homepage-video-first-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), target, database: parseDatabaseUrl(), home, settings: site.settings, activePublication: active }, null, 2)}\n`, { mode: 0o600 });
  const nextPublished = updateHomepage(applySeo(home.publishedJson, home.id), home.id);
  const nextDraft = updateHomepage(applySeo(home.draftJson, home.id), home.id);
  const nextSettings = updateSettings(applySeo(site.settings.publishedJson, home.id), home.id);
  const nextDraftSettings = updateSettings(applySeo(site.settings.draftJson, home.id), home.id);
  await prisma.$transaction(async (tx) => {
    await tx.themePage.update({ where: { id: home.id }, data: { draftJson: nextDraft, updatedAt: new Date() } });
    await tx.themeSettings.update({ where: { siteId }, data: { draftJson: nextDraftSettings, updatedAt: new Date() } });
  }, { timeout: 120_000 });
  const previousPublications = await prisma.themePublication.findMany({ where: { siteId, version: { lt: active.version } }, orderBy: { version: "desc" } });
  const sourcePublication = previousPublications.sort((left, right) => {
    const leftRows = Array.isArray(left.snapshot?.publishedHomepageShowcases) ? left.snapshot.publishedHomepageShowcases.length : 0;
    const rightRows = Array.isArray(right.snapshot?.publishedHomepageShowcases) ? right.snapshot.publishedHomepageShowcases.length : 0;
    return rightRows - leftRows || right.version - left.version;
  })[0];
  const snapshot = updateHomepageShowcases(active.snapshot, sourcePublication?.snapshot);
  const snapshotHome = snapshot.pages.find((page) => page.id === home.id || page.slug === "/");
  assert(snapshotHome, "active publication homepage is required");
  snapshotHome.publishedJson = nextPublished;
  snapshot.themeSettings = nextSettings;
  snapshot.revisions = { ...(snapshot.revisions ?? {}), homepageShowcaseRevision: projectionRevision(snapshot.publishedHomepageShowcases ?? []) };
  snapshot.snapshotHash = "";
  snapshot.revisions = { ...(snapshot.revisions ?? {}), snapshotHash: "" };
  snapshot.snapshotHash = publicationSnapshotHash(snapshot);
  snapshot.revisions.snapshotHash = snapshot.snapshotHash;
  assert.equal(publicationSnapshotIntegrity(snapshot), "valid", "updated homepage publication snapshot must be valid");
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, target, mode: "draft-only", manifestHash: manifest.manifestHash, publicationRequired: true, backupPath, seo: SEO }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
