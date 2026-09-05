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

const assetReplacements = new Map([
  [
    "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03-20260830.webp",
    "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-03.webp"
  ],
  [
    "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02-20260830.webp",
    "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-02.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/christmas-holiday-card-couple-photo.webp",
    "/assets/dreamshoot/generated/pack-galleries/christmas-couple/christmas-couple-02.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/private-photo-gallery-review.webp",
    "/assets/dreamshoot/generated/20260622-homepage-unique/flow-private-album-workspace.png"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/fresh-social-content-creator-scene.webp",
    "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-01.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/polished-professional-headshot.webp",
    "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-02.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/jordan-k-team-profile-avatar.webp",
    "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-01.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/team-page-professional-portrait.webp",
    "/assets/dreamshoot/generated/pack-galleries/gala-photos/gala-photos-01.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/riley-w-social-content-avatar.webp",
    "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-02.webp"
  ],
  [
    "/assets/dreamshoot/generated/20260830-homepage-review-replacements/instagram-social-content-creator-photo.webp",
    "/assets/dreamshoot/generated/pack-galleries/creator-portraits/creator-portraits-02.webp"
  ]
]);

const textReplacements = [
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
    let next = assetReplacements.get(value) ?? value;
    for (const [from, to] of textReplacements) next = next.replaceAll(from, to);
    return next;
  }
  if (Array.isArray(value)) return value.map(mapStrings);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, mapStrings(child)]));
}

function updatePageJson(value, slug) {
  const next = mapStrings(clone(value) ?? {});
  if (slug === "/") {
    const home = next.sections?.tutorial_video_1;
    if (home) home.settings = { ...(home.settings ?? {}), showEyebrow: false };
    if (next.sections?.package_catalog_1) delete next.sections.package_catalog_1;
    if (Array.isArray(next.sectionsOrder)) next.sectionsOrder = next.sectionsOrder.filter((id) => id !== "package_catalog_1");
    for (const block of next.sections?.proof_1?.blocks ?? []) {
      const replacement = assetReplacements.get(block?.settings?.resultImageUrl);
      if (replacement) block.settings = { ...(block.settings ?? {}), resultImageUrl: replacement };
    }
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
    draftJson: mapStrings(themeSettings.draftJson),
    publishedJson: mapStrings(themeSettings.publishedJson)
  };
  const nextSiteThemes = siteThemes.map((row) => ({ ...row, templates: mapStrings(row.templates), settings: mapStrings(row.settings) }));
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
    for (const [id, expected] of assetReplacements) {
      if (!id.includes("20260830") || !expected) continue;
      assert(!JSON.stringify(home?.contentJson).includes(id), `stale homepage asset remains: ${id}`);
    }
    const trust = pricing?.contentJson?.sections?.trust_1?.blocks ?? [];
    assert.equal(trust.find((block) => block.id === "trust_refund")?.settings?.value, "Results-based refund review", "pricing refund trust readback failed");
    assert.equal(trust.find((block) => block.id === "trust_encryption")?.settings?.value, "AES-256 encryption at rest · TLS encryption in transit", "pricing encryption trust readback failed");
    report.readback = { homeEyebrow: home?.contentJson?.sections?.tutorial_video_1?.settings?.showEyebrow, packageCatalog: home?.contentJson?.sections?.package_catalog_1 ?? null, pricingTrust: trust.filter((block) => ["trust_refund", "trust_encryption"].includes(block.id)).map((block) => ({ id: block.id, value: block.settings?.value, label: block.settings?.label })) };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
