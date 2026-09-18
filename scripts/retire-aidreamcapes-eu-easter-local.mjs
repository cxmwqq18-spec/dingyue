#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const RETIRED_PATH = "/ai-save-the-date/easter";
const RETIRED_CANONICAL = `https://aidreamcapes.eu${RETIRED_PATH}`;
const apply = hasArgument("--apply") && !hasArgument("--dry-run");

assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

const exactRouteValues = new Set([RETIRED_PATH, RETIRED_CANONICAL]);
const linkObjectKeys = new Set(["href", "path", "route", "url", "canonicalPath"]);

function clone(value) {
  return structuredClone(value ?? null);
}

function isExactRoute(value) {
  return typeof value === "string" && exactRouteValues.has(value.trim());
}

function isRetiredLinkObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).some(([key, child]) => linkObjectKeys.has(key) && isExactRoute(child));
}

function stripRouteReferences(value) {
  if (Array.isArray(value)) {
    let removed = 0;
    const next = [];
    for (const child of value) {
      if (isExactRoute(child) || isRetiredLinkObject(child)) {
        removed += 1;
        continue;
      }
      const rewritten = stripRouteReferences(child);
      removed += rewritten.removed;
      next.push(rewritten.value);
    }
    return { value: next, removed };
  }
  if (!value || typeof value !== "object") return { value, removed: 0 };
  let removed = 0;
  const next = {};
  for (const [key, child] of Object.entries(value)) {
    if (linkObjectKeys.has(key) && isExactRoute(child)) {
      removed += 1;
      continue;
    }
    const rewritten = stripRouteReferences(child);
    removed += rewritten.removed;
    next[key] = rewritten.value;
  }
  return { value: next, removed };
}

function countExactRoute(value) {
  if (isExactRoute(value)) return 1;
  if (Array.isArray(value)) return value.reduce((sum, child) => sum + countExactRoute(child), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce((sum, child) => sum + countExactRoute(child), 0);
}

function changed(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: SITE_ID },
    select: { id: true, slug: true, primaryDomain: true }
  });
  if (!site || site.slug !== SITE_SLUG || site.primaryDomain !== "aidreamcapes.eu") {
    throw new Error(`Refusing retirement: target site identity is not ${SITE_ID}/${SITE_SLUG}/aidreamcapes.eu.`);
  }

  const [themePage, livePage, allThemePages, allLivePages, themeSettings] = await Promise.all([
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: RETIRED_PATH } } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: RETIRED_PATH } } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } })
  ]);

  const liveUpdates = allLivePages.filter((row) => row.slug !== RETIRED_PATH).map((row) => {
    const rewritten = stripRouteReferences(row.contentJson);
    return { row, contentJson: rewritten.value, removed: rewritten.removed };
  }).filter(({ row, contentJson }) => changed(row.contentJson, contentJson));
  const themeUpdates = allThemePages.filter((row) => row.slug !== RETIRED_PATH).map((row) => {
    const draft = stripRouteReferences(row.draftJson);
    const published = stripRouteReferences(row.publishedJson);
    return { row, draftJson: draft.value, publishedJson: published.value, removed: draft.removed + published.removed };
  }).filter(({ row, draftJson, publishedJson }) => changed(row.draftJson, draftJson) || changed(row.publishedJson, publishedJson));
  const settingsUpdate = themeSettings ? {
    row: themeSettings,
    draftJson: stripRouteReferences(themeSettings.draftJson).value,
    publishedJson: stripRouteReferences(themeSettings.publishedJson).value,
    removed: stripRouteReferences(themeSettings.draftJson).removed + stripRouteReferences(themeSettings.publishedJson).removed
  } : null;
  const settingsChanged = Boolean(settingsUpdate && (changed(settingsUpdate.row.draftJson, settingsUpdate.draftJson) || changed(settingsUpdate.row.publishedJson, settingsUpdate.publishedJson)));
  const referenceCount = liveUpdates.reduce((sum, item) => sum + item.removed, 0) + themeUpdates.reduce((sum, item) => sum + item.removed, 0) + (settingsChanged ? settingsUpdate.removed : 0);
  const changedRecordCount = (themePage ? 1 : 0) + (livePage ? 1 : 0) + liveUpdates.length + themeUpdates.length + (settingsChanged ? 1 : 0);
  const report = {
    ok: true,
    mode: apply ? "apply-local" : "dry-run",
    siteId: SITE_ID,
    siteSlug: SITE_SLUG,
    retiredPath: RETIRED_PATH,
    themePagePresent: Boolean(themePage),
    livePagePresent: Boolean(livePage),
    removedReferences: referenceCount,
    changedReferenceRecords: {
      livePages: liveUpdates.map(({ row }) => row.slug),
      themePages: themeUpdates.map(({ row }) => row.slug),
      themeSettings: settingsChanged
    },
    deletedThemePages: themePage ? [themePage.slug] : [],
    deletedLivePages: livePage ? [livePage.slug] : [],
    changedRecordCount,
    backupPath: null,
    resourcesDeleted: 0,
    providerCalls: 0
  };

  if (apply && changedRecordCount > 0) {
    const backupPath = path.resolve("reports", `aidreamcapes-eu-easter-retirement-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(backupPath, {
      createdAt: new Date().toISOString(),
      site,
      retiredPath: RETIRED_PATH,
      themePage,
      livePage,
      liveUpdates: liveUpdates.map(({ row }) => row),
      themeUpdates: themeUpdates.map(({ row }) => row),
      themeSettings: settingsChanged ? settingsUpdate.row : null,
      resourcesDeleted: 0
    });
    await prisma.$transaction(async (tx) => {
      for (const item of liveUpdates) await tx.livePage.update({ where: { id: item.row.id }, data: { contentJson: item.contentJson } });
      for (const item of themeUpdates) await tx.themePage.update({ where: { id: item.row.id }, data: { draftJson: item.draftJson, publishedJson: item.publishedJson } });
      if (settingsChanged) await tx.themeSettings.update({ where: { id: settingsUpdate.row.id }, data: { draftJson: settingsUpdate.draftJson, publishedJson: settingsUpdate.publishedJson } });
      if (themePage) await tx.themePage.delete({ where: { id: themePage.id } });
      if (livePage) await tx.livePage.delete({ where: { id: livePage.id } });
    }, { timeout: 120_000 });
    report.backupPath = backupPath;

    const [themeReadback, liveReadback, settingsReadback] = await Promise.all([
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, draftJson: true, publishedJson: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, contentJson: true } }),
      prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
    ]);
    assert.equal(themeReadback.some((row) => row.slug === RETIRED_PATH), false, "ThemePage readback retained retired Easter route");
    assert.equal(liveReadback.some((row) => row.slug === RETIRED_PATH), false, "LivePage readback retained retired Easter route");
    assert.equal(themeReadback.reduce((sum, row) => sum + countExactRoute(row.draftJson) + countExactRoute(row.publishedJson), 0), 0, "ThemePage readback retained Easter URL reference");
    assert.equal(liveReadback.reduce((sum, row) => sum + countExactRoute(row.contentJson), 0), 0, "LivePage readback retained Easter URL reference");
    if (settingsReadback) assert.equal(countExactRoute(settingsReadback.draftJson) + countExactRoute(settingsReadback.publishedJson), 0, "ThemeSettings readback retained Easter URL reference");
    report.readback = { themePagePresent: false, livePagePresent: false, remainingExactReferences: 0 };
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
