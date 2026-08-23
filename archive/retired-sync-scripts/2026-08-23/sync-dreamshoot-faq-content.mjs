#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import createJiti from "jiti";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { dreamshootAiStudioTemplatesForSite } = jiti("../src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const { dreamshootToolDetailFaqBlocks, dreamshootToolDetailFaqSectionSettings } = jiti("../src/lib/dreamshoot-tool-faq.ts");

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const siteFilterArg = process.argv.slice(2).find((arg) => arg.startsWith("--site="))?.split("=").slice(1).join("=");
const siteFilters = new Set(
  (siteFilterArg ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
);
const allStores = [
  {
    key: "mydreamshoots",
    siteId: "site_dreamshoot",
    siteSlug: "mydreamshoots",
    siteSeed: undefined
  },
  {
    key: "grownstride-test",
    siteId: "site_grownstride_test",
    siteSlug: "grownstride",
    siteSeed: {
      slug: "grownstride",
      name: "MyDreamShoots Test",
      primaryDomain: "test.grownstride.com",
      branding: { logoText: "myDreamshoots" }
    }
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
const stores = siteFilters.size
  ? allStores.filter((store) => siteFilters.has(store.key) || siteFilters.has(store.siteId.toLowerCase()) || siteFilters.has(store.siteSlug.toLowerCase()))
  : allStores;

if (siteFilters.size && !stores.length) {
  throw new Error(`no_matching_store_filter:${[...siteFilters].join(",")}`);
}

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
  return isFaqSection(faq) ? clone(faq) : null;
}

function templateSection(templates, key, sectionId) {
  const template = templates?.[key];
  const section = template?.sections?.[sectionId];
  return section ? clone(section) : null;
}

function generatedOrderForTemplateKey(generatedTemplates, key) {
  const template = generatedTemplates?.[key];
  const order = Array.isArray(template?.sectionsOrder)
    ? template.sectionsOrder
    : Array.isArray(template?.content_for_page)
      ? template.content_for_page
      : [];
  return order.filter(Boolean);
}

function templateKeyForPublicSlug(page) {
  const slug = normalizePath(page?.slug);
  if (slug === "/best-packages") return "best-packages";
  if (slug === "/best-ai-image") return "best-ai-image";
  if (slug === "/best-ai-video") return "best-ai-video";
  return "";
}

function syncOrderFromGenerated(pageJson, generatedTemplates, key) {
  if (!["best-packages", "best-ai-image", "best-ai-video"].includes(key)) return 0;
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return 0;
  const desiredOrder = generatedOrderForTemplateKey(generatedTemplates, key);
  if (!desiredOrder.length) return 0;
  const existingIds = new Set(Object.keys(pageJson.sections));
  const orderedKnownIds = desiredOrder.filter((id) => existingIds.has(id));
  const existingOrder = Array.isArray(pageJson.sectionsOrder)
    ? pageJson.sectionsOrder
    : Array.isArray(pageJson.content_for_page)
      ? pageJson.content_for_page
      : Object.keys(pageJson.sections);
  const rest = existingOrder.filter((id) => !desiredOrder.includes(id) && existingIds.has(id));
  const nextOrder = [...orderedKnownIds, ...rest];
  const before = clone(pageJson);
  pageJson.sectionsOrder = nextOrder;
  if (Array.isArray(pageJson.content_for_page)) pageJson.content_for_page = nextOrder;
  return changed(before, pageJson) ? 1 : 0;
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromSlug(value) {
  return cleanText(value)
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((word) => (word.length <= 3 && word === word.toUpperCase() ? word : `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

function slugFromPath(value) {
  const slug = normalizePath(value);
  return slug.split("/").filter(Boolean).pop() ?? "";
}

function shortDescription(value) {
  const text = cleanText(value);
  if (!text) return "";
  const firstSentence = text.match(/^(.+?[.!?])(?:\s|$)/)?.[1];
  return cleanText(firstSentence ?? text);
}

function sentenceWithoutBrandRepeats(value, brand) {
  return cleanText(value)
    .replace(new RegExp(`\\s*${brand}\\s+does not recreate[^.]*\\.`, "ig"), " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toolContextForPage(store, site, state, page) {
  const toolSlug = slugFromPath(page?.slug);
  const menuItems = [
    ...(site?.toolMenuItems ?? []),
    ...((state.toolMenuItems ?? []).filter((item) => item.siteId === store.siteId))
  ];
  const menuItem = menuItems.find((item) => item.slug === toolSlug || normalizePath(item.href) === normalizePath(page?.slug));
  const sections = page?.publishedJson?.sections ?? page?.draftJson?.sections ?? {};
  const banner = sections.tool_banner_1?.settings ?? {};
  const entry = sections.entry_1?.settings ?? {};
  const label = cleanText(menuItem?.title) || cleanText(page?.title) || cleanText(entry.title) || cleanText(banner.title) || titleFromSlug(toolSlug);
  const rawDescription =
    cleanText(menuItem?.description) ||
    cleanText(page?.publishedJson?.seo?.description) ||
    cleanText(entry.subtitle) ||
    cleanText(banner.subtitle) ||
    `${label} helps customers create private AI photo results from approved source photos.`;
  const brand = store.key === "aidreamcapes" ? "Aidreamcapes" : "myDreamshoots";
  const category = cleanText(menuItem?.category?.label) || cleanText(menuItem?.category) || "";
  const toolDescription = sentenceWithoutBrandRepeats(shortDescription(rawDescription), brand);
  return {
    brand,
    label,
    slug: toolSlug || label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    category,
    description: toolDescription || `${label} helps customers create private AI photo results from approved source photos.`,
    aiAppSlug: cleanText(entry.aiAppSlug) || cleanText(menuItem?.aiAppSlug)
  };
}

function toolDetailFaqForPage(store, site, state, page) {
  const context = toolContextForPage(store, site, state, page);
  const faqInput = {
    site,
    toolSlug: context.slug,
    label: context.label,
    description: context.description,
    category: context.category,
    workflow: [],
    useCases: []
  };
  return {
    type: "faq",
    settings: dreamshootToolDetailFaqSectionSettings(faqInput),
    blocks: dreamshootToolDetailFaqBlocks(faqInput, `${store.key}_${context.slug}_faq`)
  };
}

function desiredFaqForSlug(templates, page, context = {}) {
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
  if (/^\/tools\/[^/]+$/.test(slug) || pageType === "ai_tool" || templateKey === "tool-detail" || templateKey === "product") {
    if (context.store && context.site && context.state) return toolDetailFaqForPage(context.store, context.site, context.state, page);
    return templateFaq(templates, "tool-detail");
  }
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

function isFaqSection(section) {
  return section?.type === "faq" || section?.type === "dreamshoot_theme_faq";
}

function faqSectionIds(pageJson) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return [];
  const orderedIds = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections);
  const ids = new Set();
  for (const id of orderedIds) {
    if (id === "faq_1" || isFaqSection(pageJson.sections[id])) ids.add(id);
  }
  for (const [id, section] of Object.entries(pageJson.sections)) {
    if (id === "faq_1" || isFaqSection(section)) ids.add(id);
  }
  return [...ids];
}

function insertFaqId(pageJson, preferredIndex) {
  const order = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections ?? {});
  const withoutFaq = order.filter((id) => id !== "faq_1" && !isFaqSection(pageJson.sections?.[id]));
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

function syncBestPackagesIntro(pageJson, generatedTemplates) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return 0;
  const before = clone(pageJson);
  const desiredIntro = templateSection(generatedTemplates, "best-packages", "intro_1");
  if (!desiredIntro) return 0;
  pageJson.sections.intro_1 = desiredIntro;
  const order = Array.isArray(pageJson.sectionsOrder) ? pageJson.sectionsOrder : Object.keys(pageJson.sections);
  const normalizedOrder = [
    "intro_1",
    ...order.filter((id) => id !== "intro_1")
  ];
  pageJson.sectionsOrder = normalizedOrder;
  return changed(before, pageJson) ? 1 : 0;
}

function syncSeoAdditionsForSlug(pageJson, page, generatedTemplates) {
  const key = templateKeyForPublicSlug(page);
  let updates = normalizePath(page?.slug) === "/best-packages" ? syncBestPackagesIntro(pageJson, generatedTemplates) : 0;
  if (key) updates += syncOrderFromGenerated(pageJson, generatedTemplates, key);
  return updates;
}

function updatePageJsonPair(page, templates, context = {}) {
  const beforeDraft = page?.draftJson;
  const draftJson = clone(beforeDraft);
  const desiredFaq = desiredFaqForSlug(templates, page, context);
  const updates =
    syncSeoAdditionsForSlug(draftJson, page, templates) +
    syncFaqSection(draftJson, desiredFaq) +
    syncSeoAdditionsForSlug(draftJson, page, templates);
  return {
    changed: updates > 0 && changed(beforeDraft, draftJson),
    updates,
    draftJson
  };
}

function syncFaqInTemplates(themeTemplates, generatedTemplates, context = {}) {
  if (!themeTemplates || typeof themeTemplates !== "object") return 0;
  let updates = 0;
  for (const [key, template] of Object.entries(themeTemplates)) {
    if (!template || typeof template !== "object") continue;
    const desiredFaq = desiredFaqForTemplateKey(generatedTemplates, key);
    if (desiredFaq === undefined) continue;
    if (key === "best-packages") updates += syncBestPackagesIntro(template, generatedTemplates);
    updates += syncFaqSection(template, desiredFaq);
    updates += syncOrderFromGenerated(template, generatedTemplates, key);
    if (Array.isArray(template.pages)) {
      for (const page of template.pages) {
        updates += syncSeoAdditionsForSlug(page?.draftJson, page, generatedTemplates);
        const pageDesired = desiredFaqForSlug(generatedTemplates, page, context);
        updates += syncFaqSection(page?.draftJson, pageDesired);
        updates += syncSeoAdditionsForSlug(page?.draftJson, page, generatedTemplates);
      }
    }
  }
  return updates;
}

function syncFaqInSnapshot(snapshot, generatedTemplates, context = {}) {
  if (!snapshot || typeof snapshot !== "object") return 0;
  let updates = 0;
  updates += syncFaqInTemplates(snapshot.saasTheme?.templates, generatedTemplates, context);
  updates += syncFaqInTemplates(snapshot.theme?.templates, generatedTemplates, context);
  for (const page of Array.isArray(snapshot.pages) ? snapshot.pages : []) {
    updates += syncSeoAdditionsForSlug(page?.draftJson, page, generatedTemplates);
    const desiredFaq = desiredFaqForSlug(generatedTemplates, page, context);
    updates += syncFaqSection(page?.draftJson, desiredFaq);
    updates += syncSeoAdditionsForSlug(page?.draftJson, page, generatedTemplates);
  }
  return updates;
}

function updateSiteState(state, store, generatedTemplates) {
  const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
  if (!site) throw new Error(`missing_site:${store.key}`);
  const report = { pages: 0, faqSections: 0, siteThemes: 0, themePublications: 0 };

  for (const page of site.pages ?? []) {
    const result = updatePageJsonPair(page, generatedTemplates, { store, site, state });
    if (!result.changed) continue;
    page.draftJson = result.draftJson;
    report.pages += 1;
    report.faqSections += result.updates;
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== store.siteId) continue;
    const templates = clone(theme.templates);
    const updates = syncFaqInTemplates(templates, generatedTemplates, { store, site, state });
    if (!updates || !changed(theme.templates, templates)) continue;
    theme.templates = templates;
    report.siteThemes += 1;
    report.faqSections += updates;
  }

  for (const theme of site.siteThemes ?? []) {
    const templates = clone(theme.templates);
    const updates = syncFaqInTemplates(templates, generatedTemplates, { store, site, state });
    if (!updates || !changed(theme.templates, templates)) continue;
    theme.templates = templates;
    report.siteThemes += 1;
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
      const dbSite = await prisma.site.findUnique({
        where: { id: store.siteId },
        include: {
          toolMenuItems: { include: { category: { include: { parent: true } } } }
        }
      });
      const siteContext = dbSite
        ? { ...dbSite, branding: dbSite.branding && typeof dbSite.branding === "object" ? dbSite.branding : store.siteSeed?.branding ?? {}, toolMenuItems: dbSite.toolMenuItems }
        : { id: store.siteId, slug: store.siteSlug, name: store.siteSeed?.name ?? store.siteSlug, primaryDomain: store.siteSeed?.primaryDomain ?? "", branding: store.siteSeed?.branding ?? {}, toolMenuItems: [] };
      const dbContext = { store, site: siteContext, state: { toolMenuItems: siteContext.toolMenuItems ?? [] } };
      for (const page of await prisma.themePage.findMany({ where: { siteId: store.siteId } })) {
        const result = updatePageJsonPair(page, generatedTemplates, dbContext);
        if (!result.changed) continue;
        await prisma.themePage.update({
          where: { id: page.id },
          data: { draftJson: result.draftJson }
        });
        report.pages += 1;
        report.faqSections += result.updates;
      }

      for (const theme of await prisma.siteTheme.findMany({ where: { siteId: store.siteId } })) {
        const templates = clone(theme.templates);
        const updates = syncFaqInTemplates(templates, generatedTemplates, dbContext);
        if (!updates || !changed(theme.templates, templates)) continue;
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates } });
        report.siteThemes += 1;
        report.faqSections += updates;
      }

      // Historical publications are immutable. FAQ changes require a new publication.
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = await readPlatformStateFromSql();
  const generatedTemplatesByStore = new Map(stores.map((store) => [store.siteId, generatedTemplatesForStore(store)]));
  const report = {};
  for (const store of stores) report[store.key] = updateSiteState(state, store, generatedTemplatesByStore.get(store.siteId));

  if (!dryRun) {
    await writePlatformStateToSql(state);
    await removeStateCaches();
  }
  const dbReport = updateDb && !dryRun ? await updateDatabase(generatedTemplatesByStore) : undefined;
  console.log(JSON.stringify({ ok: true, dryRun, report, dbReport }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
