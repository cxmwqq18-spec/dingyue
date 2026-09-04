#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-retired-public-routes";
const retiredCategorySlugs = ["ai-avatar-video", "corporate-video", "fitness-video"];
const retiredRoutePaths = ["/ai-video-generation/ai-avatar-video", "/corporate-video", "/fitness-video", "/partner-registration"];
const replacement = "/creators-circle#partner-application";

assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed });
if (apply && target !== "production") assertNonProductionWriteTarget();
if (target === "production" && apply && !productionConfirmed) {
  throw new Error("Production route retirement requires --confirm-production --confirm=mydreamshoots-retired-public-routes.");
}

function clone(value) {
  return structuredClone(value ?? {});
}

function rewrite(value) {
  if (typeof value === "string") return value === "/partner-registration" ? replacement : value;
  if (Array.isArray(value)) return value.map(rewrite);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewrite(child)]));
}

function countExact(value, needle) {
  if (typeof value === "string") return value === needle ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, child) => sum + countExact(child, needle), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce((sum, child) => sum + countExact(child, needle), 0);
}

function changed(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

const prisma = new PrismaClient();
try {
  const [livePages, themePages, themeSettings, siteThemes, themeCopies, categories] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } }),
    prisma.siteTheme.findMany({ where: { siteId: SITE_ID }, select: { id: true, templates: true, settings: true } }),
    prisma.themeCopy.findMany({ where: { siteId: SITE_ID }, select: { id: true, templates: true, settings: true } }),
    prisma.videoThemeCategory.findMany({ where: { siteId: SITE_ID, slug: { in: retiredCategorySlugs } }, select: { id: true, slug: true, status: true } })
  ]);

  const liveUpdates = livePages.map((row) => ({ row, next: rewrite(row.contentJson) })).filter(({ row, next }) => changed(row.contentJson, next));
  const themeUpdates = themePages.map((row) => ({ row, draftJson: rewrite(row.draftJson), publishedJson: rewrite(row.publishedJson) }))
    .filter(({ row, draftJson, publishedJson }) => changed(row.draftJson, draftJson) || changed(row.publishedJson, publishedJson));
  const settingsUpdate = themeSettings
    ? { row: themeSettings, draftJson: rewrite(themeSettings.draftJson), publishedJson: rewrite(themeSettings.publishedJson) }
    : undefined;
  const settingsChanged = Boolean(settingsUpdate && (changed(settingsUpdate.row.draftJson, settingsUpdate.draftJson) || changed(settingsUpdate.row.publishedJson, settingsUpdate.publishedJson)));
  const siteThemeUpdates = siteThemes.map((row) => ({ row, templates: rewrite(row.templates), settings: rewrite(row.settings) }))
    .filter(({ row, templates, settings }) => changed(row.templates, templates) || changed(row.settings, settings));
  const themeCopyUpdates = themeCopies.map((row) => ({ row, templates: rewrite(row.templates), settings: rewrite(row.settings) }))
    .filter(({ row, templates, settings }) => changed(row.templates, templates) || changed(row.settings, settings));
  const categoryUpdates = categories.filter((row) => row.status === "active");
  const changedRecordCount = liveUpdates.length + themeUpdates.length + (settingsChanged ? 1 : 0) + siteThemeUpdates.length + themeCopyUpdates.length + categoryUpdates.length;

  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    retiredRoutePaths,
    replacement,
    livePagesChanged: liveUpdates.map(({ row }) => row.slug),
    themePagesChanged: themeUpdates.map(({ row }) => row.slug),
    themeSettingsChanged: settingsChanged,
    siteThemesChanged: siteThemeUpdates.map(({ row }) => row.id),
    themeCopiesChanged: themeCopyUpdates.map(({ row }) => row.id),
    categoriesPaused: categoryUpdates.map((row) => row.slug),
    changedRecordCount,
    backupPath: null
  };

  if (apply && changedRecordCount > 0) {
    const backupDir = path.join(process.cwd(), "releases", "backups");
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-retired-routes-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, livePages: liveUpdates.map(({ row }) => row), themePages: themeUpdates.map(({ row }) => row), themeSettings: settingsUpdate?.row ?? null, siteThemes: siteThemeUpdates.map(({ row }) => row), themeCopies: themeCopyUpdates.map(({ row }) => row), categories: categoryUpdates }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const { row, next } of liveUpdates) await tx.livePage.update({ where: { id: row.id }, data: { contentJson: next } });
      for (const { row, draftJson, publishedJson } of themeUpdates) await tx.themePage.update({ where: { id: row.id }, data: { draftJson, publishedJson } });
      if (settingsChanged && settingsUpdate) await tx.themeSettings.update({ where: { id: settingsUpdate.row.id }, data: { draftJson: settingsUpdate.draftJson, publishedJson: settingsUpdate.publishedJson } });
      for (const { row, templates, settings } of siteThemeUpdates) await tx.siteTheme.update({ where: { id: row.id }, data: { templates, settings } });
      for (const { row, templates, settings } of themeCopyUpdates) await tx.themeCopy.update({ where: { id: row.id }, data: { templates, settings } });
      for (const row of categoryUpdates) await tx.videoThemeCategory.update({ where: { id: row.id }, data: { status: "paused" } });
    }, { timeout: 120_000 });
    report.backupPath = backupPath;
    const [liveReadback, themeReadback, categoryReadback] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, draftJson: true, publishedJson: true } }),
      prisma.videoThemeCategory.findMany({ where: { siteId: SITE_ID, slug: { in: retiredCategorySlugs } }, select: { slug: true, status: true } })
    ]);
    assert.equal(liveReadback.reduce((sum, row) => sum + countExact(row.contentJson, "/partner-registration"), 0), 0, "LivePage readback retained a retired partner route");
    assert.equal(themeReadback.reduce((sum, row) => sum + countExact(row.draftJson, "/partner-registration") + countExact(row.publishedJson, "/partner-registration"), 0), 0, "ThemePage readback retained a retired partner route");
    assert.equal(categoryReadback.filter((row) => row.status === "active").length, 0, "retired video categories remained active");
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
