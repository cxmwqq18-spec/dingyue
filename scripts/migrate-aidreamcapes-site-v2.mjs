#!/usr/bin/env node
// Writes the Aidreamcapes.com v2 storefront (LivePage rows + ThemeSettings v2 navigation)
// for site_aidreamcapes only. Dry-run by default.
//   Local:      node scripts/migrate-aidreamcapes-site-v2.mjs --apply-local --confirm=site_aidreamcapes
//   Production: DINGYUE_ENV=production DATABASE_TARGET=production node scripts/migrate-aidreamcapes-site-v2.mjs --apply-production --confirm=production
// Before any write the current site row, every affected LivePage and ThemeSettings are backed up.
// After the write every page is read back and compared by content hash.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { AIDREAMCAPES_SITE_ID, applyProductPatch, applyUtilityPagePatch, buildSiteV2, loadProductPatches, loadUtilityPagePatches, validateSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = AIDREAMCAPES_SITE_ID;
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert(!(applyLocal && applyProduction), "Choose one database write target.");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
// A dry run may read production (DINGYUE_ENV/DATABASE_TARGET=production) to preview the
// change; it never writes.
const productionDryRun = !apply && String(process.env.DATABASE_TARGET || "").trim().toLowerCase() === "production";
if (applyProduction) {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: confirmation === "production" });
  assert.equal(confirmation, "production", "Production apply requires --confirm=production.");
} else if (productionDryRun) {
  assertDatabaseTarget({ expectedTarget: "production" });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) {
    assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
    assertNonProductionWriteTarget();
  }
}

const build = buildSiteV2();
const errors = validateSiteV2(build);
if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}
const fallbackPageId = (page) => `aidreamcapes_v2_${page.id.replace(/[^a-z0-9]+/gi, "_")}`;

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  assert(site, `Site not found: ${SITE_ID}`);
  const slugs = build.pages.map((page) => page.slug);
  const existingPages = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } } });
  const settings = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID } });
  assert(settings, `ThemeSettings not found for ${SITE_ID}`);
  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  const nextPages = build.pages.map((page) => {
    const existing = existingBySlug.get(page.slug);
    return {
      id: existing?.id ?? fallbackPageId(page),
      siteId: SITE_ID,
      pageType: existing?.pageType ?? page.pageType,
      templateKey: existing?.templateKey ?? page.templateKey,
      slug: page.slug,
      title: page.title,
      contentJson: page.contentJson
    };
  });
  const nextSettings = (json) => ({ ...(json ?? {}), aidreamcapesV2Navigation: build.navigation });
  const navigationChanged = hashJson(settings.publishedJson?.aidreamcapesV2Navigation ?? null) !== hashJson(build.navigation)
    || hashJson(settings.draftJson?.aidreamcapesV2Navigation ?? null) !== hashJson(build.navigation);
  // Utility pages keep their sections; only the named copy fields change (see utility-pages.json).
  const utilityPatches = loadUtilityPagePatches();
  const utilityRows = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: utilityPatches.map((patch) => patch.slug) } } });
  const utilityResults = utilityPatches.map((patch) => {
    const row = utilityRows.find((candidate) => candidate.slug === patch.slug);
    if (!row) return { slug: patch.slug, missing: true, applied: [], conflicts: [] };
    const result = applyUtilityPagePatch(row.contentJson, patch.changes);
    return { slug: patch.slug, id: row.id, next: result.next, applied: result.applied, unchanged: result.unchanged.length, conflicts: result.conflicts };
  });
  const utilityReport = utilityResults.map(({ next, ...item }) => item);
  // Subscription plan summaries and features (shown on cart, account and checkout).
  const productPatches = loadProductPatches();
  const productRows = await prisma.product.findMany({ where: { siteId: SITE_ID, id: { in: productPatches.map((patch) => patch.id) } } });
  const productResults = productPatches.map((patch) => {
    const row = productRows.find((candidate) => candidate.id === patch.id);
    if (!row) return { id: patch.id, missing: true, applied: [], conflicts: [] };
    const result = applyProductPatch(row.metadata, patch);
    return { id: patch.id, name: row.name, next: result.next, applied: result.applied, conflicts: result.conflicts };
  });
  const productReport = productResults.map(({ next, ...item }) => item);
  const report = nextPages.map((page) => ({
    id: page.id,
    slug: page.slug,
    action: existingBySlug.has(page.slug) ? "UPDATE" : "CREATE",
    contentHash: hashJson(page.contentJson).slice(0, 16),
    previousHash: existingBySlug.has(page.slug) ? hashJson(existingBySlug.get(page.slug).contentJson).slice(0, 16) : null
  }));

  if (!apply) {
    // Every other page of this site, so each one can be checked against the v2 redirects.
    const otherPages = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { notIn: slugs } }, select: { slug: true, title: true, pageType: true }, orderBy: { slug: "asc" } });
    console.log(JSON.stringify({ ok: true, mode: productionDryRun ? "production-dry-run" : "dry-run", siteId: SITE_ID, domain: site.primaryDomain, pages: report.length,
      creates: report.filter((item) => item.action === "CREATE").length, updates: report.filter((item) => item.action === "UPDATE").length,
      navigationChanged, report, utilityPages: utilityReport, products: productReport, otherPages }, null, 2));
  } else {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `site-v2-${applyProduction ? "production" : "local"}-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, JSON.stringify({ site, existingPages, utilityPages: utilityRows, products: productRows, settings }, null, 2) + "\n", "utf8");
    await prisma.$transaction(async (tx) => {
      for (const page of nextPages) {
        await tx.livePage.upsert({
          where: { id: page.id },
          create: page,
          update: { pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson }
        });
      }
      for (const item of utilityResults) {
        if (!item.missing && item.applied.length) await tx.livePage.update({ where: { id: item.id }, data: { contentJson: item.next } });
      }
      for (const item of productResults) {
        if (!item.missing && item.applied.length) await tx.product.update({ where: { id: item.id }, data: { metadata: item.next } });
      }
      if (navigationChanged) {
        await tx.themeSettings.update({
          where: { siteId: SITE_ID },
          data: { draftJson: nextSettings(settings.draftJson), publishedJson: nextSettings(settings.publishedJson) }
        });
      }
    }, { maxWait: 30000, timeout: 180000 });
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { id: true, slug: true, contentJson: true } });
    assert.equal(readback.length, nextPages.length, "LivePage readback count");
    const readbackBySlug = new Map(readback.map((page) => [page.slug, page]));
    for (const page of nextPages) assert.equal(hashJson(readbackBySlug.get(page.slug)?.contentJson), hashJson(page.contentJson), `${page.slug}: content hash readback`);
    for (const item of utilityResults.filter((candidate) => !candidate.missing && candidate.applied.length)) {
      const row = await prisma.livePage.findUnique({ where: { id: item.id }, select: { contentJson: true } });
      assert.equal(hashJson(row?.contentJson), hashJson(item.next), `${item.slug}: utility page readback`);
    }
    for (const item of productResults.filter((candidate) => !candidate.missing && candidate.applied.length)) {
      const row = await prisma.product.findUnique({ where: { id: item.id }, select: { metadata: true } });
      assert.equal(hashJson(row?.metadata), hashJson(item.next), `${item.id}: product readback`);
    }
    const settingsReadback = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true, draftJson: true } });
    assert.equal(hashJson(settingsReadback.publishedJson.aidreamcapesV2Navigation), hashJson(build.navigation), "published navigation readback");
    assert.equal(hashJson(settingsReadback.draftJson.aidreamcapesV2Navigation), hashJson(build.navigation), "draft navigation readback");
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "local-applied", siteId: SITE_ID, backupPath,
      pages: report.length, creates: report.filter((item) => item.action === "CREATE").length, updates: report.filter((item) => item.action === "UPDATE").length,
      navigationChanged, utilityPages: utilityReport, products: productReport, readback: "PASS" }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
