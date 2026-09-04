#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const {
  MYDREAMSHOOTS_P1_CHILDREN_PRIVACY,
  MYDREAMSHOOTS_P1_CONTACT,
  MYDREAMSHOOTS_P1_GALLERY_H1,
  MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS,
  MYDREAMSHOOTS_P1_STATE_PRIVACY,
  stripMydreamshootsP1ChristmasQualityDuplicates,
  stripMydreamshootsP1SeasonalDuplicateText
} = createJiti(import.meta.url)("../src/lib/mydreamshoots-seo-p1-manifest.ts");

const siteId = "site_dreamshoot";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-seo-audit-2026-09-04";
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed });
if (target === "production" && apply && !productionConfirmed) throw new Error("Production remediation requires --confirm-production --confirm=mydreamshoots-seo-audit-2026-09-04.");

const targetSlugs = [...new Set([
  ...Object.keys(MYDREAMSHOOTS_P1_SEASONAL_DUPLICATE_TARGETS),
  "/children-privacy",
  "/state-privacy",
  "/contact-us",
  "/cookies",
  "/best-ai-image",
  "/best-ai-video"
])];
const clone = (value) => structuredClone(value ?? {});
const stable = (value) => JSON.stringify(value);

function replaceAll(value, replacements) {
  if (typeof value === "string") return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
  if (Array.isArray(value)) return value.map((item) => replaceAll(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceAll(item, replacements)]));
}

function updatePage(slug, source) {
  let next = clone(source);
  if (slug === "/children-privacy") {
    next.title = MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h1;
    next.seo = { ...(next.seo ?? {}), title: MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.seoTitle };
    assert(next.sections?.intro_1?.settings, "children privacy intro section is required");
    assert(next.sections?.policy_1?.settings, "children privacy policy section is required");
    next.sections.intro_1.settings.title = MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h2;
    next.sections.intro_1.settings.body = MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.intro;
    next.sections.policy_1.settings.title = MYDREAMSHOOTS_P1_CHILDREN_PRIVACY.h2;
  }
  if (slug === "/state-privacy") {
    assert(next.sections?.intro_1?.settings, "state privacy intro section is required");
    next.sections.intro_1.settings.body = MYDREAMSHOOTS_P1_STATE_PRIVACY.intro;
    next = replaceAll(next, [["8 THE GREEN STE B,DOVER,DE 19901", MYDREAMSHOOTS_P1_STATE_PRIVACY.address]]);
  }
  if (slug === "/contact-us") next = replaceAll(next, [[MYDREAMSHOOTS_P1_CONTACT.oldAddress, MYDREAMSHOOTS_P1_CONTACT.address]]);
  if (slug === "/cookies") next = replaceAll(next, [["/policies/privacy", "/privacy"], ["/policies/terms", "/terms"]]);
  if (slug === "/best-ai-image" || slug === "/best-ai-video") {
    const sectionId = slug === "/best-ai-image" ? "best_ai_image_1" : "best_ai_video_1";
    const title = slug === "/best-ai-image" ? MYDREAMSHOOTS_P1_GALLERY_H1.image : MYDREAMSHOOTS_P1_GALLERY_H1.video;
    assert(next.sections?.[sectionId]?.settings, `${slug} gallery section is required`);
    next.sections[sectionId].settings.title = title;
    next.title = title;
  }
  stripMydreamshootsP1SeasonalDuplicateText(next, slug);
  stripMydreamshootsP1ChristmasQualityDuplicates(next, slug);
  return next;
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId, slug: { in: targetSlugs } }, select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId, slug: { in: targetSlugs } }, select: { id: true, slug: true, title: true, contentJson: true }, orderBy: { slug: "asc" } })
  ]);
  assert.equal(themePages.length, targetSlugs.length, "all targeted ThemePage rows must exist");
  assert.equal(livePages.length, targetSlugs.length, "all targeted LivePage rows must exist");
  const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
  const updates = themePages.flatMap((theme) => {
    const live = liveBySlug.get(theme.slug);
    assert(live, `missing LivePage: ${theme.slug}`);
    const draftJson = updatePage(theme.slug, theme.draftJson);
    const publishedJson = updatePage(theme.slug, theme.publishedJson);
    const contentJson = updatePage(theme.slug, live.contentJson);
    const title = contentJson.title || theme.title;
    const changed = stable(draftJson) !== stable(theme.draftJson) || stable(publishedJson) !== stable(theme.publishedJson) || stable(contentJson) !== stable(live.contentJson) || title !== theme.title || title !== live.title;
    return changed ? [{ slug: theme.slug, theme, live, draftJson, publishedJson, contentJson, title }] : [];
  });
  const report = { ok: true, mode: apply ? "apply" : "dry-run", target, siteId, pagesChecked: targetSlugs.length, changedPages: updates.map((item) => item.slug), backupPath: null };
  if (apply && updates.length) {
    const backupDir = path.join(process.cwd(), "releases", "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-seo-audit-2026-09-04-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, pages: updates.map(({ theme, live }) => ({ theme, live })) }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.themePage.update({ where: { id: update.theme.id }, data: { title: update.title, draftJson: update.draftJson, publishedJson: update.publishedJson } });
        await tx.livePage.update({ where: { id: update.live.id }, data: { title: update.title, contentJson: update.contentJson } });
      }
    }, { timeout: 120_000 });
    report.backupPath = backupPath;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
