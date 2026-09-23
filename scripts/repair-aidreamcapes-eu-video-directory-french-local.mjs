#!/usr/bin/env node

// Repair only the EU video-generation directory copy. The topic pages are
// rebuilt from the English source by repair-aidreamcapes-eu-video-french-local;
// this directory has a different section type and therefore needs its own
// bounded, canonical French copy.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const SLUG = "/ai-video-generation";
const TARGET_DOMAIN = "aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const target = process.argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length) ?? "local";
const productionConfirmation = "--confirm=aidreamcapes-eu-video-directory-production";
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-video-french-copy");

const CANONICAL_COPY = Object.freeze({
  pageTitle: "Génération de vidéos avec l’IA",
  seoTitle: "Génération de vidéos avec l’IA | Aidreamcapes",
  seoDescription: "Découvrez Aidreamcapes pour créer des vidéos avec l’IA à partir d’images, des mouvements de profil, des présentations de créateurs, des teasers de produits, des avatars animés, des vidéos de mode et des histoires d’albums privés.",
  sectionTitle: "Génération de vidéos avec l’IA",
  sectionSubtitle: "Parcourez tous les thèmes vidéo publics avec l’IA et ouvrez le guide dédié à la direction de votre choix."
});

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function directorySection(pageJson) {
  const sections = pageJson?.sections ?? {};
  return Object.entries(sections).find(([, section]) =>
    section?.type === "video_theme_directory" || section?.type === "video_theme_grid" || section?.type === "dreamshoot_tool_collection"
  );
}

function repairPageJson(pageJson) {
  const next = clone(pageJson);
  assert(next && typeof next === "object", "target directory page JSON is missing");
  const sectionEntry = directorySection(next);
  assert(sectionEntry, "target video directory section is missing");
  const [sectionId, section] = sectionEntry;
  next.seo = {
    ...(next.seo ?? {}),
    title: CANONICAL_COPY.seoTitle,
    description: CANONICAL_COPY.seoDescription,
    canonicalPath: next.seo?.canonicalPath ?? SLUG,
    canonical: next.seo?.canonical ?? `https://${TARGET_DOMAIN}${next.seo?.canonicalPath ?? SLUG}`
  };
  next.sections[sectionId] = {
    ...section,
    settings: {
      ...(section.settings ?? {}),
      title: CANONICAL_COPY.sectionTitle,
      subtitle: CANONICAL_COPY.sectionSubtitle
    }
  };
  return next;
}

async function main() {
  const production = target === "production";
  assertDatabaseTarget({
    expectedTarget: target,
    requireProductionConfirmation: apply && production,
    productionConfirmed: process.argv.includes(productionConfirmation)
  });
  if (apply && production && !process.argv.includes(productionConfirmation)) {
    throw new Error(`Production Aidreamcapes writes require ${productionConfirmation}.`);
  }
  if (apply && !production) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [sourceLive, targetLive, sourceTheme, targetTheme] = await Promise.all([
      prisma.livePage.findFirst({ where: { siteId: SOURCE_SITE_ID, slug: SLUG } }),
      prisma.livePage.findFirst({ where: { siteId: TARGET_SITE_ID, slug: SLUG } }),
      prisma.themePage.findFirst({ where: { siteId: SOURCE_SITE_ID, slug: SLUG } }),
      prisma.themePage.findFirst({ where: { siteId: TARGET_SITE_ID, slug: SLUG } })
    ]);
    assert(sourceLive && targetLive && sourceTheme && targetTheme, "source or target video directory page is missing");
    assert.equal(sourceLive.title, "AI Video Generation", "unexpected English source directory title");
    assert(directorySection(sourceLive.contentJson), "English source directory section is missing");
    assert(directorySection(sourceTheme.publishedJson), "English source theme directory section is missing");

    const repairedLive = repairPageJson(targetLive.contentJson);
    const repairedDraft = repairPageJson(targetTheme.draftJson);
    const repairedPublished = repairPageJson(targetTheme.publishedJson);
    const report = {
      ok: true,
      mode: apply ? `apply-${target}` : "dry-run",
      databaseTarget: target,
      sourceSiteId: SOURCE_SITE_ID,
      targetSiteId: TARGET_SITE_ID,
      slug: SLUG,
      sourceTitle: sourceLive.title,
      sourceBasis: "site_dreamshoot English directory semantics",
      copy: CANONICAL_COPY,
      changedLivePage: targetLive.title !== CANONICAL_COPY.pageTitle || JSON.stringify(targetLive.contentJson) !== JSON.stringify(repairedLive),
      changedThemePage: targetTheme.title !== CANONICAL_COPY.pageTitle || JSON.stringify(targetTheme.draftJson) !== JSON.stringify(repairedDraft) || JSON.stringify(targetTheme.publishedJson) !== JSON.stringify(repairedPublished)
    };
    if (apply) {
      const backupPath = path.join(BACKUP_ROOT, `backup-before-video-directory-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        livePage: { id: targetLive.id, title: targetLive.title, contentJson: targetLive.contentJson },
        themePage: { id: targetTheme.id, title: targetTheme.title, draftJson: targetTheme.draftJson, publishedJson: targetTheme.publishedJson }
      });
      await prisma.$transaction(async (tx) => {
        await tx.livePage.update({ where: { id: targetLive.id }, data: { title: CANONICAL_COPY.pageTitle, contentJson: repairedLive } });
        await tx.themePage.update({ where: { id: targetTheme.id }, data: { title: CANONICAL_COPY.pageTitle, draftJson: repairedDraft, publishedJson: repairedPublished } });
      }, { maxWait: 20_000, timeout: 60_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(BACKUP_ROOT, `report-video-directory-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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
