#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import Module from "node:module";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
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
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split("=")[0]));
const siteArg = rawArgs.find((arg) => arg.startsWith("--site="))?.split("=").slice(1).join("=") ?? "all";
const apply = flags.has("apply");
const updateDb = flags.has("db");
const stores = [
  { key: "mydreamshoots", siteId: "site_dreamshoot", siteSlug: "mydreamshoots" },
  { key: "aidreamcapes", siteId: "site_aidreamcapes", siteSlug: "aidreamcapes" }
].filter((store) => siteArg === "all" || [store.key, store.siteId, store.siteSlug].includes(siteArg));
const copiedSettingKeys = [
  "showTrustedLogoIntro",
  "trustedLogoTitle",
  "trustedLogoSplitIndex",
  "aboutTitle",
  "aboutBody",
  "embeddedPricingSectionId"
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function templateSeed(site, store) {
  return {
    id: site?.id ?? store.siteId,
    slug: site?.slug ?? store.siteSlug,
    name: site?.name ?? (store.key === "aidreamcapes" ? "Aidreamcapes" : "MyDreamShoots"),
    primaryDomain: site?.primaryDomain ?? `www.${store.siteSlug}.com`,
    branding: site?.branding ?? { logoText: store.key === "aidreamcapes" ? "Aidreamcapes" : "MyDreamShoots" }
  };
}

function desiredSection(site, store) {
  const section = dreamshootAiStudioTemplatesForSite(templateSeed(site, store)).home?.sections?.generation_showcase_1;
  if (!section) throw new Error(`missing_template_generation_showcase:${store.siteId}`);
  return clone(section);
}

function replaceLogoBlocks(currentBlocks, desiredBlocks) {
  const trustedLogos = desiredBlocks.filter((block) => block?.type === "logo").map(clone);
  const nextBlocks = [];
  let inserted = false;
  for (const block of currentBlocks ?? []) {
    if (block?.type !== "logo") {
      nextBlocks.push(block);
      continue;
    }
    if (!inserted) {
      nextBlocks.push(...trustedLogos);
      inserted = true;
    }
  }
  if (!inserted) nextBlocks.push(...trustedLogos);
  return nextBlocks;
}

function findGenerationSection(pageJson) {
  if (!pageJson?.sections) return undefined;
  return pageJson.sections.generation_showcase_1 ??
    Object.values(pageJson.sections).find((section) => section?.type === "dreamshoot_generation_showcase");
}

function applyTrustedLogoIntro(pageJson, sourceSection) {
  const section = findGenerationSection(pageJson);
  if (!section) return { found: false, changed: false, logoCount: 0 };
  const before = clone(section);
  section.settings = { ...(section.settings ?? {}) };
  for (const key of copiedSettingKeys) {
    if (key in (sourceSection.settings ?? {})) section.settings[key] = clone(sourceSection.settings[key]);
  }
  section.settings.showTrustedLogoIntro = true;
  section.blocks = replaceLogoBlocks(section.blocks, sourceSection.blocks ?? []);
  return {
    found: true,
    changed: !isDeepStrictEqual(before, section),
    logoCount: section.blocks.filter((block) => block?.type === "logo").length
  };
}

function applyToPublicationSnapshot(snapshot, sourceSection) {
  const nextSnapshot = clone(snapshot);
  const results = [];
  const homePage = nextSnapshot?.pages?.find((page) => page?.slug === "/" || page?.pageType === "home");
  if (homePage?.draftJson) results.push(applyTrustedLogoIntro(homePage.draftJson, sourceSection));
  if (homePage?.publishedJson) results.push(applyTrustedLogoIntro(homePage.publishedJson, sourceSection));
  if (nextSnapshot?.saasTheme?.templates?.index) {
    results.push(applyTrustedLogoIntro(nextSnapshot.saasTheme.templates.index, sourceSection));
  }
  return {
    snapshot: nextSnapshot,
    found: results.some((result) => result.found),
    changed: results.some((result) => result.changed),
    logoCounts: results.filter((result) => result.found).map((result) => result.logoCount)
  };
}

function publicationMetrics(snapshot) {
  const pages = Array.isArray(snapshot?.pages) ? snapshot.pages : [];
  return {
    pageCount: pages.length,
    sectionCount: pages.reduce((count, page) => count + Object.keys((page?.publishedJson ?? page?.draftJson)?.sections ?? {}).length, 0),
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8")
  };
}

function summarizePublicationResult(result) {
  return {
    found: result.found,
    changed: result.changed,
    logoCounts: result.logoCounts
  };
}

function applyToState(state) {
  const report = [];
  for (const store of stores) {
    const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
    if (!site) throw new Error(`missing_state_site:${store.siteId}`);
    const sourceSection = desiredSection(site, store);
    const homePage = (site.pages ?? []).find((page) => page.slug === "/" || page.pageType === "home");
    const pageResults = [];
    if (homePage?.draftJson) pageResults.push(applyTrustedLogoIntro(homePage.draftJson, sourceSection));
    const themeResults = [];
    for (const theme of (state.siteThemes ?? []).filter((item) => item.siteId === store.siteId)) {
      themeResults.push(applyTrustedLogoIntro(theme.templates?.index, sourceSection));
    }
    report.push({ siteId: store.siteId, pageResults, themeResults, publicationResults: [] });
  }
  return report;
}

async function updateDatabase() {
  const prisma = new PrismaClient();
  const report = [];
  const backup = { createdAt: new Date().toISOString(), stores: [] };
  const contexts = [];
  let backupPath;
  try {
    if (apply) {
      const stamp = new Date().toISOString().replaceAll(/[:.]/g, "-");
      backupPath = path.join(repoRoot, ".codex", "backups", `trusted-logo-intro-db-${stamp}.json`);
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
    }
    for (const store of stores) {
      const site = await prisma.site.findUnique({
        where: { id: store.siteId },
        select: { id: true, slug: true, name: true, primaryDomain: true, branding: true }
      });
      if (!site) throw new Error(`missing_database_site:${store.siteId}`);
      const sourceSection = desiredSection(site, store);
      const page = await prisma.themePage.findUnique({
        where: { siteId_slug: { siteId: store.siteId, slug: "/" } },
        select: { id: true, draftJson: true, publishedJson: true }
      });
      const themes = await prisma.siteTheme.findMany({
        where: { siteId: store.siteId },
        select: { id: true, templates: true }
      });
      const publications = await prisma.themePublication.findMany({
        where: { siteId: store.siteId },
        select: { id: true, snapshot: true }
      });
      backup.stores.push({ siteId: store.siteId, page, themes, publications });
      contexts.push({ store, sourceSection, page, themes, publications });
    }

    if (apply) {
      await fs.writeFile(backupPath, `${JSON.stringify(backup, null, 2)}\n`);
    }

    const writeOperations = [];
    for (const { store, sourceSection, page, themes, publications } of contexts) {
      const pageResults = [];
      if (page) {
        const draftJson = clone(page.draftJson);
        pageResults.push(applyTrustedLogoIntro(draftJson, sourceSection));
        if (apply && pageResults.some((result) => result.changed)) {
          writeOperations.push((tx) => tx.themePage.update({ where: { id: page.id }, data: { draftJson } }));
        }
      }

      const themeResults = [];
      for (const theme of themes) {
        const templates = clone(theme.templates);
        const result = applyTrustedLogoIntro(templates?.index, sourceSection);
        themeResults.push({ id: theme.id, ...result });
        if (apply && result.changed) {
          writeOperations.push((tx) => tx.siteTheme.update({ where: { id: theme.id }, data: { templates } }));
        }
      }

      // Historical publications are immutable. Logo changes require a new publication.
      report.push({ siteId: store.siteId, pageResults, themeResults, publicationResults: [] });
    }

    if (apply && writeOperations.length) {
      await prisma.$transaction(async (tx) => {
        for (const operation of writeOperations) await operation(tx);
      }, { timeout: 120_000 });
    }
    return { report, backupPath };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  if (!stores.length) throw new Error(`unknown_site:${siteArg}`);
  const state = await readPlatformStateFromSql();
  const stateReport = applyToState(state);
  if (apply) await writePlatformStateToSql(state);
  const database = updateDb ? await updateDatabase() : undefined;
  console.log(JSON.stringify({ ok: true, apply, updateDb, stores: stores.map((store) => store.siteId), stateReport, database }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
