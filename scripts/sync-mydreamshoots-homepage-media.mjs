#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const TARGET_SLUGS = ["/", "/pricing"];
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-homepage-media";

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed
});
if (apply && target !== "production") assertNonProductionWriteTarget();
if (target === "production" && apply && !productionConfirmed) {
  throw new Error("Production homepage media sync requires --confirm-production --confirm=mydreamshoots-homepage-media.");
}

const homepageReviewAssets = {
  review_ava: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03-20260830.webp",
  review_lucas: "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02-20260830.webp",
  review_mia: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/christmas-holiday-card-couple-photo.webp",
  review_noah: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/private-photo-gallery-review.webp",
  review_chloe: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/fresh-social-content-creator-scene.webp",
  review_eli: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/polished-professional-headshot.webp",
  review_jordan: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/team-page-professional-portrait.webp",
  review_riley: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/instagram-social-content-creator-photo.webp"
};

const homepageReviewAvatars = {
  review_jordan: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/jordan-k-team-profile-avatar.webp",
  review_riley: "/assets/dreamshoot/generated/20260830-homepage-review-replacements/riley-w-social-content-avatar.webp"
};

const canonicalSocialLinks = {
  instagramUrl: "https://www.instagram.com/mydreamshoots/",
  facebookUrl: "https://www.facebook.com/mydreamshoots/",
  threadsUrl: "https://www.threads.com/@mydreamshoots",
  pinterestUrl: "https://www.pinterest.com/myDreamshoots/",
  youtubeUrl: "https://www.youtube.com/@myDreamshoots",
  xUrl: "https://x.com/myDreamshoots",
  tiktokUrl: "https://www.tiktok.com/@mydreamshoots"
};

const textReplacements = [
  ["https://www.instagram.com/blydey_inc", "https://www.instagram.com/mydreamshoots/"],
  ["https://www.facebook.com/blydeyinc", "https://www.facebook.com/mydreamshoots/"],
  ["https://www.threads.com/@blydey_inc", "https://www.threads.com/@mydreamshoots"],
  ["https://www.pinterest.com/Blydeyinc", "https://www.pinterest.com/myDreamshoots/"],
  ["https://www.youtube.com/@blydey-inc", "https://www.youtube.com/@myDreamshoots"],
  ["100% money-back guarantee", "Results-based refund review"],
  ["Money-back guarantee", "Results-based refund review"],
  ["money-back guarantee review", "results-based refund review"],
  ["If the shoot doesn't look like you, refund.", "Results-based refund review is available under the Refund Policy."],
  ["AES-256 at rest · TLS 256-bit in transit", "AES-256 encryption at rest · TLS encryption in transit"],
  ["TLS 256-bit in transit", "TLS encryption in transit"],
  ["AES-256 at rest", "AES-256 encryption at rest"],
  ["generated portraits", "generated images and videos"],
  ["AI photo services", "AI photo and video services"],
  ["AI photo service", "AI photo and video service"],
  ["COPPA-aware", "COPPA-related"],
  ["myDreamshoots KIDS Act", "Children's Privacy Notice | myDreamshoots"],
  ["Children's Privacy Notice (KIDS Act)", "Children's Privacy Notice"],
  ["KIDS Act", "Children's Privacy"]
];

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function mapStrings(value) {
  if (typeof value === "string") {
    let next = value;
    for (const [from, to] of textReplacements) next = next.replaceAll(from, to);
    return next;
  }
  if (Array.isArray(value)) return value.map(mapStrings);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapStrings(child)]));
}

function applyHomepageReviewMedia(next) {
  for (const block of next?.sections?.proof_1?.blocks ?? []) {
    const resultImageUrl = homepageReviewAssets[block?.id];
    const avatarUrl = homepageReviewAvatars[block?.id];
    if (resultImageUrl || avatarUrl) block.settings = { ...(block.settings ?? {}), ...(resultImageUrl ? { resultImageUrl } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
  }
  return next;
}

function rewriteNestedHomepageReviewMedia(value) {
  if (Array.isArray(value)) return value.map(rewriteNestedHomepageReviewMedia);
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteNestedHomepageReviewMedia(child)]));
  return next.sections?.proof_1 ? applyHomepageReviewMedia(next) : next;
}

function updatePageJson(value, slug) {
  const next = mapStrings(clone(value) ?? {});
  if (slug === "/") {
    const home = next.sections?.tutorial_video_1;
    if (home) home.settings = { ...(home.settings ?? {}), showEyebrow: false };
    if (next.sections?.package_catalog_1) delete next.sections.package_catalog_1;
    if (Array.isArray(next.sectionsOrder)) next.sectionsOrder = next.sectionsOrder.filter((id) => id !== "package_catalog_1");
    applyHomepageReviewMedia(next);
  }
  if (slug === "/pricing") {
    const trust = next.sections?.trust_1?.blocks ?? [];
    const refund = trust.find((block) => block?.id === "trust_refund");
    if (refund) refund.settings = {
      ...(refund.settings ?? {}),
      value: "Results-based refund review",
      label: "Results-based refund review is available under the Refund Policy."
    };
    const encryption = trust.find((block) => block?.id === "trust_encryption");
    if (encryption) encryption.settings = {
      ...(encryption.settings ?? {}),
      value: "AES-256 encryption at rest · TLS encryption in transit"
    };
  }
  return next;
}

function updateThemeSettings(value) {
  const next = mapStrings(value);
  const footer = next?.globalSections?.footer;
  if (footer?.settings && typeof footer.settings === "object") footer.settings = { ...footer.settings, ...canonicalSocialLinks };
  return next;
}

function changedJson(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, themeSettings, siteThemes] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: TARGET_SLUGS } }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: TARGET_SLUGS } }, orderBy: { slug: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } }),
    prisma.siteTheme.findMany({ where: { siteId: SITE_ID }, orderBy: { id: "asc" } })
  ]);
  assert.equal(themePages.length, TARGET_SLUGS.length, "homepage and pricing ThemePage rows are required");
  assert.equal(livePages.length, TARGET_SLUGS.length, "homepage and pricing LivePage rows are required");
  assert(themeSettings, "MyDreamShoots ThemeSettings row is required");

  const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const nextThemePages = themePages.map((row) => ({
    ...row,
    draftJson: updatePageJson(row.draftJson, row.slug),
    publishedJson: updatePageJson(row.publishedJson, row.slug)
  }));
  const nextLivePages = livePages.map((row) => ({ ...row, contentJson: updatePageJson(row.contentJson, row.slug) }));
  const nextThemeSettings = {
    ...themeSettings,
    draftJson: updateThemeSettings(themeSettings.draftJson),
    publishedJson: updateThemeSettings(themeSettings.publishedJson)
  };
  const nextSiteThemes = siteThemes.map((row) => ({ ...row, templates: rewriteNestedHomepageReviewMedia(mapStrings(row.templates)), settings: mapStrings(row.settings) }));
  const changed = {
    themePages: nextThemePages.filter((row) => changedJson(row.draftJson, themeBySlug.get(row.slug)?.draftJson) || changedJson(row.publishedJson, themeBySlug.get(row.slug)?.publishedJson)).map((row) => row.slug),
    livePages: nextLivePages.filter((row) => changedJson(row.contentJson, liveBySlug.get(row.slug)?.contentJson)).map((row) => row.slug),
    themeSettings: changedJson(nextThemeSettings.draftJson, themeSettings.draftJson) || changedJson(nextThemeSettings.publishedJson, themeSettings.publishedJson),
    siteThemes: nextSiteThemes.filter((row, index) => changedJson(row.templates, siteThemes[index]?.templates) || changedJson(row.settings, siteThemes[index]?.settings)).map((row) => row.id)
  };
  const backupPath = path.join(process.cwd(), "releases", "backups", target, `mydreamshoots-homepage-media-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const report = { ok: true, mode: apply ? "apply" : "dry-run", target, siteId: SITE_ID, changed, skipped: { platformStateDocument: "legacy 5GB snapshot; public SSR uses LivePage" }, backupPath: apply ? backupPath : null };
  if (apply) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, themePages, livePages, themeSettings, siteThemes }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const row of nextThemePages) await tx.themePage.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson, updatedAt: new Date() } });
      for (const row of nextLivePages) await tx.livePage.update({ where: { id: row.id }, data: { contentJson: row.contentJson, updatedAt: new Date() } });
      await tx.themeSettings.update({ where: { id: themeSettings.id }, data: { draftJson: nextThemeSettings.draftJson, publishedJson: nextThemeSettings.publishedJson, updatedAt: new Date() } });
      for (const row of nextSiteThemes) await tx.siteTheme.update({ where: { id: row.id }, data: { templates: row.templates, settings: row.settings, updatedAt: new Date() } });
    }, { timeout: 120_000 });
    const [home, pricing] = await Promise.all([
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select: { contentJson: true } }),
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/pricing" } }, select: { contentJson: true } })
    ]);
    assert.equal(home?.contentJson?.sections?.tutorial_video_1?.settings?.showEyebrow, false, "LivePage homepage eyebrow readback failed");
    assert.equal(home?.contentJson?.sections?.package_catalog_1, undefined, "LivePage homepage package catalog readback failed");
    for (const expected of Object.values(homepageReviewAssets)) assert(JSON.stringify(home?.contentJson).includes(expected), `homepage review asset readback failed: ${expected}`);
    const trust = pricing?.contentJson?.sections?.trust_1?.blocks ?? [];
    assert.equal(trust.find((block) => block.id === "trust_refund")?.settings?.value, "Results-based refund review", "pricing refund trust readback failed");
    assert.equal(trust.find((block) => block.id === "trust_encryption")?.settings?.value, "AES-256 encryption at rest · TLS encryption in transit", "pricing encryption trust readback failed");
    const settingsFooter = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } });
    for (const settings of [settingsFooter?.draftJson, settingsFooter?.publishedJson]) {
      for (const [key, expected] of Object.entries(canonicalSocialLinks)) assert.equal(settings?.globalSections?.footer?.settings?.[key], expected, `footer social readback failed: ${key}`);
    }
    report.readback = { homeEyebrow: home?.contentJson?.sections?.tutorial_video_1?.settings?.showEyebrow, packageCatalog: home?.contentJson?.sections?.package_catalog_1 ?? null, pricingTrust: trust.filter((block) => ["trust_refund", "trust_encryption"].includes(block.id)).map((block) => ({ id: block.id, value: block.settings?.value, label: block.settings?.label })), social: canonicalSocialLinks };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
