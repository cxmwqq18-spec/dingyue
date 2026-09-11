#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite(process.env.CHRISTMAS_VIDEO_SITE_ID || "site_dreamshoot");
const VIDEO_URL = "/assets/dreamshoot/seasonal/christmas/christmas-hero-family-gift.mp4";
const VIDEO_POSTER_URL = "/assets/dreamshoot/seasonal/christmas/hero-ai-christmas-family-gift.jpg";
const VIDEO_TITLE = "Family opening a glowing Christmas gift together beside a decorated tree and fireplace";
const VIDEO_DESCRIPTION = "A family opens a glowing Christmas gift together beside a decorated tree and fireplace.";
const VIDEO_UPLOAD_DATE = "2026-09-05T02:29:04.000Z";
const VIDEO_DURATION_SECONDS = 15;
const VIDEO_FILE = path.join(process.cwd(), "public", VIDEO_URL.replace(/^\/+/, ""));
const APPLY = process.argv.includes("--apply");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const productionConfirmed = process.argv.includes("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-christmas-video";

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed
});
if (target === "production" && APPLY && !productionConfirmed) {
  throw new Error("Production Christmas video sync requires --confirm-production --confirm=mydreamshoots-christmas-video.");
}
assert(fs.existsSync(VIDEO_FILE), `Missing Christmas hero video: ${VIDEO_FILE}`);

const clone = (value) => JSON.parse(JSON.stringify(value));

function updateHeroJson(source) {
  const next = clone(source);
  const hero = next?.sections?.christmas_hero;
  assert(hero, "Christmas hero section is required");
  const firstVisual = hero.blocks?.find((block) => block.id === "christmas-hero-1") || hero.blocks?.[0];
  assert(firstVisual, "Christmas hero visual block is required");
  const changed = hero.settings?.videoUrl !== VIDEO_URL ||
    hero.settings?.videoPosterUrl !== VIDEO_POSTER_URL ||
    hero.settings?.videoTitle !== VIDEO_TITLE ||
    hero.settings?.videoDescription !== VIDEO_DESCRIPTION ||
    hero.settings?.videoUploadDate !== VIDEO_UPLOAD_DATE ||
    hero.settings?.videoDurationSeconds !== VIDEO_DURATION_SECONDS ||
    firstVisual.settings?.videoUrl !== VIDEO_URL;
  hero.settings = {
    ...hero.settings,
    videoUrl: VIDEO_URL,
    videoPosterUrl: VIDEO_POSTER_URL,
    videoTitle: VIDEO_TITLE,
    videoDescription: VIDEO_DESCRIPTION,
    videoUploadDate: VIDEO_UPLOAD_DATE,
    videoDurationSeconds: VIDEO_DURATION_SECONDS
  };
  firstVisual.settings = { ...firstVisual.settings, videoUrl: VIDEO_URL };
  if (changed) next.version = Number(next.version || 0) + 1;
  return { next, changed };
}

function updateNavigationJson(source) {
  const next = clone(source);
  let found = false;
  for (const group of next?.saveTheDateNavigation?.groups || []) {
    for (const item of group.items || []) {
      if (item.href !== "/ai-save-the-date/christmas") continue;
      item.videoUrl = VIDEO_URL;
      found = true;
    }
  }
  assert(found, "Christmas Save the Date navigation item is required");
  return next;
}

const prisma = new PrismaClient();
try {
  const [livePage, themePage, settings] = await Promise.all([
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-save-the-date/christmas" } }, select: { id: true, contentJson: true } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/ai-save-the-date/christmas" } }, select: { id: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } })
  ]);
  assert(livePage, "Christmas LivePage is required");
  assert(themePage, "Christmas ThemePage is required");
  assert(settings, "MyDreamShoots ThemeSettings is required");

  const live = updateHeroJson(livePage.contentJson);
  const draft = updateHeroJson(themePage.draftJson);
  const published = updateHeroJson(themePage.publishedJson);
  const settingsDraft = updateNavigationJson(settings.draftJson);
  const settingsPublished = updateNavigationJson(settings.publishedJson);
  const mediaAsset = {
    id: `media_${SITE_ID}_christmas_hero_family_gift_video`,
    siteId: SITE_ID,
    label: "Christmas hero family gift video",
    storageKey: VIDEO_URL,
    mimeType: "video/mp4",
    usageType: "theme",
    sourceType: "christmas-hero-video",
    previewUrl: VIDEO_URL,
    originUrl: VIDEO_URL,
    altText: "Christmas hero video of a family opening a glowing gift beside a decorated tree."
  };

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: live.next } });
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: draft.next, publishedJson: published.next } });
      await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: settingsDraft, publishedJson: settingsPublished } });
      await tx.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId: SITE_ID, storageKey: VIDEO_URL } },
        create: mediaAsset,
        update: { label: mediaAsset.label, mimeType: mediaAsset.mimeType, usageType: mediaAsset.usageType, sourceType: mediaAsset.sourceType, previewUrl: mediaAsset.previewUrl, originUrl: mediaAsset.originUrl, altText: mediaAsset.altText }
      });
    });
  }

  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    target,
    mode: APPLY ? `applied-${target}` : "dry-run",
    videoUrl: VIDEO_URL,
    changed: { livePage: live.changed, themePageDraft: draft.changed, themePagePublished: published.changed, themeSettings: JSON.stringify(settingsDraft) !== JSON.stringify(settings.draftJson) },
    publicationRequired: true
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
