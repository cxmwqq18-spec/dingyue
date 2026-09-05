#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  assertNonProductionWriteTarget,
  buildTunneledDatabaseUrl,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite(process.env.VALENTINES_VIDEO_SITE_ID || "site_dreamshoot");
assert.equal(SITE_ID, "site_dreamshoot", "This scoped sync only supports the MyDreamShoots storefront.");

const PAGE_SLUG = "/ai-save-the-date/valentines-day";
const VIDEO_URL = "/assets/dreamshoot/save-the-date/valentines-day/valentines-day-save-the-date.mp4";
const VIDEO_FILE = path.join(process.cwd(), "public", VIDEO_URL.replace(/^\/+/, ""));
const target = String(argumentValue("--target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-valentines-day-video";

if (target === "production") {
  process.env.DINGYUE_ENV = "production";
  process.env.DATABASE_TARGET = "production";
  process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, {
    port: Number(process.env.REMOTE_DB_LOCAL_PORT || 15434)
  });
}
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production" && apply,
  productionConfirmed
});
if (apply && target !== "production") assertNonProductionWriteTarget();
assert(fs.existsSync(VIDEO_FILE), `Missing Valentine hero video: ${VIDEO_FILE}`);

const clone = (value) => structuredClone(value);

function updateHeroJson(source) {
  const next = clone(source);
  const hero = next?.sections?.save_date_hero;
  assert(hero, `${PAGE_SLUG} hero section is required`);
  const changed = hero.settings?.videoUrl !== VIDEO_URL;
  hero.settings = { ...(hero.settings || {}), videoUrl: VIDEO_URL };
  if (changed) next.version = Number(next.version || 0) + 1;
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const [livePage, themePage] = await Promise.all([
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } },
      select: { id: true, contentJson: true, updatedAt: true }
    }),
    prisma.themePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } },
      select: { id: true, draftJson: true, publishedJson: true, updatedAt: true }
    })
  ]);
  assert(livePage, `${PAGE_SLUG} LivePage is required`);
  assert(themePage, `${PAGE_SLUG} ThemePage is required`);

  const live = updateHeroJson(livePage.contentJson);
  const draft = updateHeroJson(themePage.draftJson);
  const published = updateHeroJson(themePage.publishedJson);
  const mediaAsset = {
    id: `media_${SITE_ID}_valentines_day_save_the_date_video`,
    siteId: SITE_ID,
    label: "Valentine's Day Save the Date hero video",
    storageKey: VIDEO_URL,
    mimeType: "video/mp4",
    usageType: "theme",
    sourceType: "valentines-day-hero-video",
    previewUrl: VIDEO_URL,
    originUrl: VIDEO_URL,
    altText: "Romantic Valentine's Day Save the Date video featuring an engaged couple in evening light."
  };
  const changed = {
    livePage: live.changed,
    themePageDraft: draft.changed,
    themePagePublished: published.changed
  };
  const backupPath = path.join(
    process.cwd(),
    "releases",
    "backups",
    target,
    `mydreamshoots-valentines-day-video-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );

  if (apply) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(`${backupPath}`, `${JSON.stringify({ createdAt: new Date().toISOString(), target, livePage, themePage }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: live.next, updatedAt: new Date() } });
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: draft.next, publishedJson: published.next, updatedAt: new Date() } });
      await tx.mediaAsset.upsert({
        where: { siteId_storageKey: { siteId: SITE_ID, storageKey: VIDEO_URL } },
        create: mediaAsset,
        update: {
          label: mediaAsset.label,
          mimeType: mediaAsset.mimeType,
          usageType: mediaAsset.usageType,
          sourceType: mediaAsset.sourceType,
          previewUrl: mediaAsset.previewUrl,
          originUrl: mediaAsset.originUrl,
          altText: mediaAsset.altText
        }
      });
    }, { timeout: 120_000 });

    const [liveReadback, assetReadback] = await Promise.all([
      prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } }),
      prisma.mediaAsset.findUnique({ where: { siteId_storageKey: { siteId: SITE_ID, storageKey: VIDEO_URL } }, select: { storageKey: true, mimeType: true, altText: true } })
    ]);
    assert.equal(liveReadback?.contentJson?.sections?.save_date_hero?.settings?.videoUrl, VIDEO_URL, "LivePage hero video readback failed");
    assert.equal(assetReadback?.storageKey, VIDEO_URL, "video media asset readback failed");
    assert.equal(assetReadback?.mimeType, "video/mp4", "video media asset mime type readback failed");
  }

  console.log(JSON.stringify({
    ok: true,
    target,
    siteId: SITE_ID,
    page: PAGE_SLUG,
    mode: apply ? "applied" : "dry-run",
    videoUrl: VIDEO_URL,
    changed,
    backupPath: apply ? backupPath : null,
    publicationRequired: false
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
