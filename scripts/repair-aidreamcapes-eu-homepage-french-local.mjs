#!/usr/bin/env node

// Local-only homepage copy repair for site_aidreamcapes_xby.
// This script makes no provider calls, deletes no assets, and never writes a
// remote database. LivePage and ThemePage stay synchronized for SSR and admin.
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { applyAidreamcapesEuGlobalCopy, applyAidreamcapesEuHomepageCopy, applyAidreamcapesEuThemeSettingsCopy } from "./lib/aidreamcapes-eu-homepage-copy.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-homepage-french-copy");
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");

assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function nonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length);
}

function replaceBrokenHomepageMedia(value) {
  if (Array.isArray(value)) return value.map(replaceBrokenHomepageMedia);
  if (typeof value === "string") {
    return value.replace(
      /\/assets\/sites\/site_aidreamcapes_eu\/homepage-showcase\/videos\/scenic-overlook-pan\.mp4(?:\?[^\s"']*)?/g,
      "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4"
    );
  }
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceBrokenHomepageMedia(child)]));
}

const prisma = new PrismaClient();
try {
  const [theme, live, settings] = await Promise.all([
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } })
  ]);
  if (!theme && !live) throw new Error("missing_aidreamcapes_eu_homepage");

  const source = clone(live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson);
  const nextPage = replaceBrokenHomepageMedia(applyAidreamcapesEuHomepageCopy(source));
  const sourceDraft = clone(theme?.draftJson ?? nextPage);
  const nextDraft = replaceBrokenHomepageMedia(applyAidreamcapesEuHomepageCopy(sourceDraft));
  const settingsDraft = clone(settings?.draftJson ?? {});
  const settingsPublished = clone(settings?.publishedJson ?? settingsDraft);
  applyAidreamcapesEuThemeSettingsCopy(settingsDraft);
  applyAidreamcapesEuThemeSettingsCopy(settingsPublished);
  applyAidreamcapesEuGlobalCopy(settingsDraft);
  applyAidreamcapesEuGlobalCopy(settingsPublished);

  const report = {
    ok: true,
    mode: apply ? "apply-local" : "dry-run",
    siteId: SITE_ID,
    pagePath: "/",
    changedThemePage: Boolean(theme && JSON.stringify(theme.publishedJson) !== JSON.stringify(nextPage)),
    changedLivePage: Boolean(live && JSON.stringify(live.contentJson) !== JSON.stringify(nextPage)),
    changedThemeSettings: Boolean(settings && (JSON.stringify(settings.draftJson) !== JSON.stringify(settingsDraft) || JSON.stringify(settings.publishedJson) !== JSON.stringify(settingsPublished))),
    providerCalls: 0,
    oldResourcesDeleted: 0,
    seo: nextPage.seo,
    faqCount: Array.isArray(nextPage.sections?.faq_1?.blocks) ? nextPage.sections.faq_1.blocks.length : 0,
    backup: null
  };

  if (apply) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(REPORT_ROOT, `backup-${stamp}.json`);
    writeJson(backupPath, {
      themePage: theme ? { id: theme.id, slug: theme.slug, draftJson: theme.draftJson, publishedJson: theme.publishedJson } : null,
      livePage: live ? { id: live.id, slug: live.slug, contentJson: live.contentJson } : null,
      themeSettings: settings ? { id: settings.id, draftJson: settings.draftJson, publishedJson: settings.publishedJson } : null
    });
    report.backup = backupPath;
    await prisma.$transaction(async (tx) => {
      if (theme) {
        await tx.themePage.update({ where: { id: theme.id }, data: { draftJson: nextDraft, publishedJson: nextPage } });
      }
      if (live) {
        await tx.livePage.update({ where: { id: live.id }, data: { contentJson: nextPage } });
      }
      if (settings) {
        await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: settingsDraft, publishedJson: settingsPublished } });
      }
    });
  }

  const reportPath = path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeJson(reportPath, report);
  console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
