#!/usr/bin/env node
import "./load-runtime-env.mjs";
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

function normalizePath(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "index") return "/";
  const withSlash = text.startsWith("/") ? text : `/${text}`;
  return withSlash.replace(/\/+$/g, "") || "/";
}

function generatedTemplatesForStore(store) {
  return dreamshootAiStudioTemplatesForSite(store.siteSeed);
}

function templateFaq(templates, key) {
  const faq = templates?.[key]?.sections?.faq_1;
  return faq?.type === "faq" ? clone(faq) : null;
}

function desiredFaqForSlug(templates, page) {
  const slug = normalizePath(page?.slug);
  const pageType = String(page?.pageType ?? "");
  const templateKey = String(page?.templateKey ?? "");
  if (
    pageType === "policy" ||
    ["/about-us", "/contact-us", "/workflow", "/privacy", "/privacy-policy", "/policies/privacy", "/refunds", "/policies/refunds", "/content", "/policies/content", "/terms", "/terms-of-service", "/cookies", "/policies/cookies"].includes(slug)
  ) {
    return null;
  }
  if (slug === "/") return templateFaq(templates, "home");
  if (slug === "/pricing") return templateFaq(templates, "pricing");
  if (slug === "/tools") return templateFaq(templates, "tools");
  if (slug === "/collections") return templateFaq(templates, "packages");
  if (slug === "/faq" || slug === "/help") return templateFaq(templates, "help");
  if (slug === "/best-packages") return templateFaq(templates, "best-packages");
  if (slug === "/best-ai-image") return templateFaq(templates, "best-ai-image");
  if (slug === "/best-ai-video") return templateFaq(templates, "best-ai-video");
  if (/^\/tools\/[^/]+$/.test(slug) || pageType === "ai_tool" || templateKey === "tool-detail" || templateKey === "product") return templateFaq(templates, "tool-detail");
  return null;
}

function desiredFaqForTemplateKey(templates, key) {
  const normalized = String(key ?? "");
  const mapped = {
    index: "home",
    home: "home",
    page: "pricing",
    pricing: "pricing",
    tools: "tools",
    collection: "packages",
    packages: "packages",
    help: "help",
    "best-packages": "best-packages",
    "best-ai-image": "best-ai-image",
    "best-ai-video": "best-ai-video",
    product: "tool-detail",
    "tool-detail": "tool-detail"
  }[normalized];
  if (mapped) return templateFaq(templates, mapped);
  if (["workflow", "contact-us", "about-us", "policy", "privacy", "refunds", "content", "terms", "cookies", "package-detail"].includes(normalized)) return null;
  return undefined;
}

function faqSectionIds(pageJson) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return [];
  const orderedIds = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections);
  const ids = new Set();
  for (const id of orderedIds) {
    if (id === "faq_1" || pageJson.sections[id]?.type === "faq") ids.add(id);
  }
  for (const [id, section] of Object.entries(pageJson.sections)) {
    if (id === "faq_1" || section?.type === "faq") ids.add(id);
  }
  return [...ids];
}

function insertFaqId(pageJson, preferredIndex) {
  const order = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections ?? {});
  const withoutFaq = order.filter((id) => id !== "faq_1" && pageJson.sections?.[id]?.type !== "faq");
  const conversionIndex = withoutFaq.indexOf("conversion_1");
  const insertionIndex = preferredIndex >= 0
    ? Math.min(preferredIndex, withoutFaq.length)
    : conversionIndex >= 0
      ? conversionIndex
      : withoutFaq.length;
  withoutFaq.splice(insertionIndex, 0, "faq_1");
  pageJson.sectionsOrder = withoutFaq;
}

function syncFaqSection(pageJson, desiredFaq) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return 0;
  const before = clone(pageJson);
  const ids = faqSectionIds(pageJson);
  const order = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections);
  const firstIndex = ids.length ? order.findIndex((id) => ids.includes(id)) : -1;
  for (const id of ids) delete pageJson.sections[id];
  pageJson.sectionsOrder = order.filter((id) => !ids.includes(id));
  if (desiredFaq) {
    pageJson.sections.faq_1 = clone(desiredFaq);
    insertFaqId(pageJson, firstIndex);
  }
  return changed(before, pageJson) ? 1 : 0;
}

function updatePageJsonPair(page, templates) {
  const beforeDraft = page?.draftJson;
  const beforePublished = page?.publishedJson;
  const draftJson = clone(beforeDraft);
  const publishedJson = clone(beforePublished);
  const desiredFaq = desiredFaqForSlug(templates, page);
  const updates = syncFaqSection(draftJson, desiredFaq) + syncFaqSection(publishedJson, desiredFaq);
  return {
    changed: updates > 0 && (changed(beforeDraft, draftJson) || changed(beforePublished, publishedJson)),
    updates,
    draftJson,
    publishedJson
  };
}

function syncFaqInTemplates(themeTemplates, generatedTemplates) {
  if (!themeTemplates || typeof themeTemplates !== "object") return 0;
  let updates = 0;
  for (const [key, template] of Object.entries(themeTemplates)) {
    if (!template || typeof template !== "object") continue;
    const desiredFaq = desiredFaqForTemplateKey(generatedTemplates, key);
    if (desiredFaq === undefined) continue;
    updates += syncFaqSection(template, desiredFaq);
    if (Array.isArray(template.pages)) {
      for (const page of template.pages) {
        const pageDesired = desiredFaqForSlug(generatedTemplates, page);
        updates += syncFaqSection(page?.draftJson, pageDesired) + syncFaqSection(page?.publishedJson, pageDesired);
      }
    }
  }
  return updates;
}

function syncFaqInSnapshot(snapshot, generatedTemplates) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  let updates = 0;
  for (const page of Array.isArray(snapshot.pages) ? snapshot.pages : []) {
    const desiredFaq = desiredFaqForSlug(generatedTemplates, page);
    updates += syncFaqSection(page?.draftJson, desiredFaq);
    updates += syncFaqSection(page?.publishedJson, desiredFaq);
  }
  return updates;
}

function updateSiteState(state, store, generatedTemplates) {
  const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
  if (!site) throw new Error(`missing_site:${store.key}`);
  const report = { pages: 0, faqSections: 0, siteThemes: 0, themePublications: 0 };

  for (const page of site.pages ?? []) {
    const result = updatePageJsonPair(page, generatedTemplates);
    if (!result.changed) continue;
    page.draftJson = result.draftJson;
    page.publishedJson = result.publishedJson;
    report.pages += 1;
    report.faqSections += result.updates;
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== store.siteId) continue;
    const templates = clone(theme.templates);
    const updates = syncFaqInTemplates(templates, generatedTemplates);
    if (!updates || !changed(theme.templates, templates)) continue;
    theme.templates = templates;
    report.siteThemes += 1;
    report.faqSections += updates;
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== store.siteId) continue;
    const snapshot = clone(publication.snapshot);
    const updates = syncFaqInSnapshot(snapshot, generatedTemplates);
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

async function updateDatabase(generatedTemplatesByStore) {
  const prisma = new PrismaClient();
  const report = { pages: 0, siteThemes: 0, themePublications: 0, faqSections: 0 };
  try {
    for (const store of stores) {
      const generatedTemplates = generatedTemplatesByStore.get(store.siteId);
      for (const page of await prisma.themePage.findMany({ where: { siteId: store.siteId } })) {
        const result = updatePageJsonPair(page, generatedTemplates);
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
        const updates = syncFaqInTemplates(templates, generatedTemplates);
        if (!updates || !changed(theme.templates, templates)) continue;
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates } });
        report.siteThemes += 1;
        report.faqSections += updates;
      }

      for (const publication of await prisma.themePublication.findMany({ where: { siteId: store.siteId } })) {
        const snapshot = clone(publication.snapshot);
        const updates = syncFaqInSnapshot(snapshot, generatedTemplates);
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
  const generatedTemplatesByStore = new Map(stores.map((store) => [store.siteId, generatedTemplatesForStore(store)]));
  const report = {};
  for (const store of stores) report[store.key] = updateSiteState(state, store, generatedTemplatesByStore.get(store.siteId));

  if (!dryRun) {
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
    await removeStateCaches();
  }
  const dbReport = updateDb && !dryRun ? await updateDatabase(generatedTemplatesByStore) : undefined;
  console.log(JSON.stringify({ ok: true, dryRun, report, dbReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
