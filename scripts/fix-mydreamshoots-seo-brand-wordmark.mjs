#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const SEO_BRAND = "MyDreamShoots";
const SEO_BRAND_RE = /(?:myᕲreamshoots|ʍʏƉʀɛǟʍֆhoots|MyÐreãm\$hoots)/g;
const prisma = new PrismaClient();

function normalizeSeoText(value) {
  return typeof value === "string" ? value.replace(SEO_BRAND_RE, SEO_BRAND) : value;
}

function normalizeSeoObject(seo) {
  if (!seo || typeof seo !== "object") return 0;
  const before = JSON.stringify(seo);

  seo.siteTitle = normalizeSeoText(seo.siteTitle);
  seo.siteDescription = normalizeSeoText(seo.siteDescription);
  seo.siteKeywords = normalizeSeoText(seo.siteKeywords);
  seo.titleTemplate = normalizeSeoText(seo.titleTemplate);

  for (const pageSeo of Object.values(seo.pages ?? {})) {
    if (!pageSeo || typeof pageSeo !== "object") continue;
    pageSeo.title = normalizeSeoText(pageSeo.title);
    pageSeo.description = normalizeSeoText(pageSeo.description);
    pageSeo.keywords = normalizeSeoText(pageSeo.keywords);
  }

  return JSON.stringify(seo) === before ? 0 : 1;
}

function _normalizeThemeJson(value) {
  if (!value || typeof value !== "object") return 0;
  let changes = 0;
  changes += normalizeSeoObject(value.seo);
  if (value.themeSettings && typeof value.themeSettings === "object") {
    changes += _normalizeThemeJson(value.themeSettings.draftJson);
    changes += _normalizeThemeJson(value.themeSettings.publishedJson);
  }
  if (value.snapshot && typeof value.snapshot === "object") {
    changes += _normalizeThemeJson(value.snapshot.themeSettings);
  }
  return changes;
}

function normalizeSeoObjectsDeep(value) {
  if (!value || typeof value !== "object") return 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + normalizeSeoObjectsDeep(item), 0);

  let changes = 0;
  for (const [key, child] of Object.entries(value)) {
    if (key === "seo") {
      changes += normalizeSeoObject(child);
      continue;
    }
    changes += normalizeSeoObjectsDeep(child);
  }
  return changes;
}

const state = await readPlatformStateFromSql();
let changeCount = 0;

for (const site of state.sites ?? []) {
  if (site.id !== "site_dreamshoot" && site.slug !== "mydreamshoots") continue;
  changeCount += normalizeSeoObjectsDeep(site);
}

for (const theme of state.siteThemes ?? []) {
  if (theme.siteId !== "site_dreamshoot") continue;
  changeCount += normalizeSeoObjectsDeep(theme);
}

for (const page of state.themePages ?? []) {
  if (page.siteId !== "site_dreamshoot") continue;
  changeCount += normalizeSeoObjectsDeep(page);
}

await writePlatformStateToSql(state);
console.log(`Fixed MyDreamShoots SEO brand wordmark fields in PostgreSQL platform state: ${changeCount} object(s) updated.`);

function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

async function fixPrismaJson() {
  const sites = await prisma.site.findMany({
    where: {
      OR: [
        { id: "site_dreamshoot" },
        { slug: "mydreamshoots" },
        { primaryDomain: { in: ["mydreamshoots.com", "www.mydreamshoots.com"] } }
      ]
    },
    select: { id: true }
  });

  const result = { themeSettings: 0, themePages: 0, siteThemes: 0, themePublications: 0 };

  for (const site of sites) {
    const settings = await prisma.themeSettings.findUnique({ where: { siteId: site.id } });
    if (settings) {
      const draftJson = cloneJson(settings.draftJson);
      normalizeSeoObjectsDeep(draftJson);
      if (changed(settings.draftJson, draftJson)) {
        await prisma.themeSettings.update({ where: { siteId: site.id }, data: { draftJson } });
        result.themeSettings += 1;
      }
    }

    for (const page of await prisma.themePage.findMany({ where: { siteId: site.id } })) {
      const draftJson = cloneJson(page.draftJson);
      normalizeSeoObjectsDeep(draftJson);
      if (changed(page.draftJson, draftJson)) {
        await prisma.themePage.update({ where: { id: page.id }, data: { draftJson } });
        result.themePages += 1;
      }
    }

    for (const theme of await prisma.siteTheme.findMany({ where: { siteId: site.id } })) {
      const templates = cloneJson(theme.templates);
      const settingsJson = cloneJson(theme.settings);
      normalizeSeoObjectsDeep(templates);
      normalizeSeoObjectsDeep(settingsJson);
      if (changed(theme.templates, templates) || changed(theme.settings, settingsJson)) {
        await prisma.siteTheme.update({ where: { id: theme.id }, data: { templates, settings: settingsJson } });
        result.siteThemes += 1;
      }
    }

    // Historical publications are immutable. SEO changes require a new publication.
  }

  console.log(`Fixed MyDreamShoots SEO brand wordmark fields in Prisma: ${JSON.stringify(result)}`);
}

fixPrismaJson()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
