#!/usr/bin/env node

// Enable the three existing Aidreamshoots EU video-theme entities that were
// deliberately noindexed, so the source-parity manifest can expose them.
// This script is local-only and never writes the MyDreamShoots source site.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const TARGET_SITE_ID = "site_mydreamshoots_xby";
const REQUIRED_SLUGS = Object.freeze([
  "/ai-video-generation/explainer-video",
  "/ai-video-generation/how-to-video",
  "/ai-video-generation/talking-head-video"
]);
const APPLY_LOCAL = process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "eu-source-parity-pages");

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function enableSeo(json) {
  const next = clone(json) ?? {};
  next.seo = {
    ...(next.seo ?? {}),
    index: true,
    follow: true,
    robots: {
      ...(next.seo?.robots ?? {}),
      index: true,
      follow: true
    }
  };
  return next;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const rows = await prisma.themePage.findMany({
      where: { siteId: TARGET_SITE_ID, slug: { in: REQUIRED_SLUGS } }
    });
    assert.equal(rows.length, REQUIRED_SLUGS.length, "All Aidreamshoots EU parity ThemePage rows must exist.");
    const bySlug = new Map(rows.map((row) => [row.slug, row]));
    const changes = rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      before: {
        publishedJson: row.publishedJson,
        draftJson: row.draftJson
      },
      after: {
        publishedJson: enableSeo(row.publishedJson),
        draftJson: enableSeo(row.draftJson)
      }
    }));
    for (const slug of REQUIRED_SLUGS) assert.ok(bySlug.has(slug), `Missing ThemePage: ${slug}`);

    const report = {
      ok: true,
      mode: APPLY_LOCAL ? "apply-local" : "dry-run",
      sourceWrites: 0,
      targetSiteId: TARGET_SITE_ID,
      pages: changes.map(({ id, slug, before, after }) => ({
        id,
        slug,
        before: before.publishedJson?.seo,
        after: after.publishedJson?.seo
      }))
    };
    if (APPLY_LOCAL) {
      const backupPath = path.join(REPORT_ROOT, `backup-before-aidreamshoots-parity-seo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, { targetSiteId: TARGET_SITE_ID, rows: changes.map(({ id, slug, before }) => ({ id, slug, ...before })) });
      await prisma.$transaction(async (tx) => {
        for (const change of changes) {
          await tx.themePage.update({
            where: { id: change.id },
            data: {
              publishedJson: change.after.publishedJson,
              draftJson: change.after.draftJson
            }
          });
        }
      }, { maxWait: 20_000, timeout: 60_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(REPORT_ROOT, `report-aidreamshoots-parity-seo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
