#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import createJiti from "jiti";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const stores = [
  {
    key: "mydreamshoots",
    siteId: "site_dreamshoot",
    siteSlug: "mydreamshoots",
    siteSeed: undefined
  },
  {
    key: "aidreamcapes",
    siteId: "site_aidreamcapes",
    siteSlug: "aidreamcapes",
    siteSeed: {
      slug: "aidreamcapes",
      name: "Aidreamcapes",
      primaryDomain: "www.aidreamcapes.com",
      branding: { logoText: "Aidreamcapes" }
    }
  }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function faqSectionForStore(store) {
  const templates = dreamshootAiStudioTemplatesForSite(store.siteSeed);
  const faq = templates?.home?.sections?.faq_1;
  assert.equal(faq?.type, "faq", `${store.key} should expose a FAQ template`);
  assert.equal(faq?.settings?.layout, "visual_faq", `${store.key} should use visual_faq`);
  assert.ok(Array.isArray(faq?.blocks) && faq.blocks.length >= 15, `${store.key} should expose a rich FAQ set`);
  return clone(faq);
}

function replaceFaqSections(pageJson, faqSection) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return 0;
  let updates = 0;
  for (const [sectionId, section] of Object.entries(pageJson.sections)) {
    if (sectionId !== "faq_1" && section?.type !== "faq") continue;
    pageJson.sections[sectionId] = clone(faqSection);
    updates += 1;
  }
  return updates;
}

function replaceFaqInTemplates(templates, faqSection) {
  if (!templates || typeof templates !== "object") return 0;
  let updates = 0;
  for (const template of Object.values(templates)) {
    if (!template || typeof template !== "object") continue;
    updates += replaceFaqSections(template, faqSection);
    if (Array.isArray(template.pages)) {
      for (const page of template.pages) updates += replaceFaqSections(page?.draftJson, faqSection) + replaceFaqSections(page?.publishedJson, faqSection);
    }
  }
  return updates;
}

function replaceFaqInSnapshot(snapshot, faqSection) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  let updates = 0;
  for (const page of Array.isArray(snapshot.pages) ? snapshot.pages : []) {
    updates += replaceFaqSections(page?.draftJson, faqSection);
    updates += replaceFaqSections(page?.publishedJson, faqSection);
  }
  updates += replaceFaqSections(snapshot.draftJson, faqSection);
  updates += replaceFaqSections(snapshot.publishedJson, faqSection);
  return updates;
}

function updatePageJsonPair(page, faqSection) {
  const beforeDraft = page?.draftJson;
  const beforePublished = page?.publishedJson;
  const draftJson = clone(beforeDraft);
  const publishedJson = clone(beforePublished);
  const updates = replaceFaqSections(draftJson, faqSection) + replaceFaqSections(publishedJson, faqSection);
  return {
    changed: updates > 0 && (changed(beforeDraft, draftJson) || changed(beforePublished, publishedJson)),
    updates,
    draftJson,
    publishedJson
  };
}

function updateSiteState(state, store, faqSection) {
  const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
  if (!site) throw new Error(`missing_site:${store.key}`);
  const report = { pages: 0, faqSections: 0, siteThemes: 0, themePublications: 0 };

  for (const page of site.pages ?? []) {
    const result = updatePageJsonPair(page, faqSection);
    if (!result.changed) continue;
    page.draftJson = result.draftJson;
    page.publishedJson = result.publishedJson;
    report.pages += 1;
    report.faqSections += result.updates;
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== store.siteId) continue;
    const templates = clone(theme.templates);
    const updates = replaceFaqInTemplates(templates, faqSection);
    if (!updates || !changed(theme.templates, templates)) continue;
    theme.templates = templates;
    report.siteThemes += 1;
    report.faqSections += updates;
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== store.siteId) continue;
    const snapshot = clone(publication.snapshot);
    const updates = replaceFaqInSnapshot(snapshot, faqSection);
    if (!updates || !changed(publication.snapshot, snapshot)) continue;
    publication.snapshot = snapshot;
    publication.pageCount = Array.isArray(snapshot.pages) ? snapshot.pages.length : publication.pageCount;
    publication.sectionCount = Array.isArray(snapshot.pages)
      ? snapshot.pages.reduce((count, page) => count + Object.keys(page?.publishedJson?.sections ?? {}).length, 0)
      : publication.sectionCount;
    publication.snapshotBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8");
    report.themePublications += 1;
    report.faqSections += updates;
  }

  return report;
}

function removeStateCaches() {
  return Promise.all(
    [".next", ".next-dev", ".next-3002", ".next-docx-verify"].map(async (dir) => {
      const cacheFile = path.join(repoRoot, dir, "cache/platform-state-postgres.json");
      await fs.rm(cacheFile, { force: true });
    })
  );
}

async function updateDatabase(faqByStore) {
  const prisma = new PrismaClient();
  const report = { pages: 0, siteThemes: 0, themePublications: 0, faqSections: 0 };
  try {
    for (const store of stores) {
      const faqSection = faqByStore.get(store.siteId);
      for (const page of await prisma.themePage.findMany({ where: { siteId: store.siteId } })) {
        const result = updatePageJsonPair(page, faqSection);
        if (!result.changed) continue;
        await prisma.themePage.update({
          where: { id: page.id },
          data: { draftJson: result.draftJson, publishedJson: result.publishedJson }
        });
        report.pages += 1;
        report.faqSections += result.updates;
      }

      for (const theme of await prisma.siteTheme.findMany({ where: { siteId: store.siteId } })) {
        const templates = clone(theme.templates);
        const updates = replaceFaqInTemplates(templates, faqSection);
        if (!updates || !changed(theme.templates, templates)) continue;
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates } });
        report.siteThemes += 1;
        report.faqSections += updates;
      }

      for (const publication of await prisma.themePublication.findMany({ where: { siteId: store.siteId } })) {
        const snapshot = clone(publication.snapshot);
        const updates = replaceFaqInSnapshot(snapshot, faqSection);
        if (!updates || !changed(publication.snapshot, snapshot)) continue;
        await prisma.themePublication.update({
          where: { id: publication.id },
          data: {
            snapshot,
            pageCount: Array.isArray(snapshot.pages) ? snapshot.pages.length : publication.pageCount,
            sectionCount: Array.isArray(snapshot.pages)
              ? snapshot.pages.reduce((count, page) => count + Object.keys(page?.publishedJson?.sections ?? {}).length, 0)
              : publication.sectionCount,
            snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8")
          }
        });
        report.themePublications += 1;
        report.faqSections += updates;
      }
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const faqByStore = new Map(stores.map((store) => [store.siteId, faqSectionForStore(store)]));
  const report = {};
  for (const store of stores) report[store.key] = updateSiteState(state, store, faqByStore.get(store.siteId));

  if (!dryRun) {
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
    await removeStateCaches();
  }
  const dbReport = updateDb && !dryRun ? await updateDatabase(faqByStore) : undefined;
  console.log(JSON.stringify({ ok: true, dryRun, report, dbReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
