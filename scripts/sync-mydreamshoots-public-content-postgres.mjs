#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.join(process.cwd(), "data", "platform-state.json");
const siteId = process.env.SYNC_SITE_ID ?? "site_dreamshoot";
const rawArgs = process.argv.slice(2);
const flags = new Set(rawArgs.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split("=")[0]));
const forceContentOverwrite = flags.has("force-content-overwrite");
const dbRequested = flags.has("db");
const dryRun = flags.has("dry-run") || !(forceContentOverwrite && dbRequested);
const transactionTimeoutMs = Number(process.env.SYNC_TRANSACTION_TIMEOUT_MS ?? 600000);
const cacheFiles = [
  path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json"),
  path.join(process.cwd(), ".next-build", "cache", "platform-state-postgres.json")
];

function contentOverwriteGuardPayload() {
  return {
    writeEnabled: !dryRun,
    requiredFlags: ["--db", "--force-content-overwrite"],
    dbRequested,
    scope: ["ThemeSettings.draftJson", "ThemePage.draftJson", "SiteTheme.draft/templates"],
    note: dryRun
      ? "No database rows were overwritten. Re-run with --db --force-content-overwrite to import the scoped content records."
      : "Scoped content overwrite was explicitly enabled for this run."
  };
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function json(value, fallback = {}) {
  return value === undefined ? fallback : value;
}

function toDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function scopedRecords(state) {
  const site = asArray(state.sites).find((item) => item.id === siteId);
  if (!site) throw new Error(`site ${siteId} not found in ${statePath}`);
  if (!site.themeSettings) throw new Error(`site ${siteId} is missing themeSettings in ${statePath}`);

  return {
    site,
    settings: {
      id: `settings_${siteId}`,
      siteId,
      draftJson: json(site.themeSettings.draftJson)
    },
    pages: asArray(site.pages),
    siteThemes: asArray(state.siteThemes).filter((item) => item.siteId === siteId && item.status === "draft")
  };
}

function pageData(page) {
  return stripUndefined({
    id: page.id,
    siteId,
    pageType: page.pageType,
    templateKey: page.templateKey ?? null,
    slug: page.slug,
    title: page.title,
    draftJson: json(page.draftJson),
    draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined,
    updatedAt: toDate(page.updatedAt)
  });
}

function siteThemeData(theme) {
  return stripUndefined({
    id: theme.id,
    siteId: theme.siteId,
    name: theme.name,
    themeId: theme.themeId,
    themeKey: theme.themeKey,
    status: theme.status,
    templates: json(theme.templates),
    settings: json(theme.settings),
    source: theme.source,
    createdBy: theme.createdBy,
    createdAt: toDate(theme.createdAt),
    updatedAt: toDate(theme.updatedAt)
  });
}

async function backupScopedContent(tx) {
  const [pages, settings, siteThemes] = await Promise.all([
    tx.themePage.findMany({ where: { siteId } }),
    tx.themeSettings.findUnique({ where: { siteId } }),
    tx.siteTheme.findMany({ where: { siteId } })
  ]);
  return {
    createdAt: new Date().toISOString(),
    siteId,
    scope: ["ThemeSettings.draftJson", "ThemePage.draftJson", "SiteTheme.draft/templates"],
    pages,
    settings,
    siteThemes
  };
}

async function writeScopedContent(tx, records) {
  const existingSettings = await tx.themeSettings.findUnique({ where: { siteId }, select: { siteId: true } });
  if (!existingSettings) throw new Error(`ThemeSettings ${siteId} must exist before draft content can be imported.`);
  await tx.themeSettings.update({
    where: { siteId },
    data: { draftJson: records.settings.draftJson }
  });

  for (const page of records.pages) {
    const existing = await tx.themePage.findUnique({ where: { id: page.id }, select: { id: true } });
    if (!existing) throw new Error(`ThemePage ${page.id} must exist before draft content can be imported.`);
    const data = pageData(page);
    await tx.themePage.update({
      where: { id: data.id },
      data: {
        pageType: data.pageType,
        templateKey: data.templateKey,
        slug: data.slug,
        title: data.title,
        draftJson: data.draftJson,
        draftMeta: data.draftMeta,
        updatedAt: data.updatedAt
      }
    });
  }

  for (const theme of records.siteThemes) {
    const data = siteThemeData(theme);
    await tx.siteTheme.upsert({ where: { id: data.id }, create: data, update: data });
  }

  // ThemePublication rows are deliberately excluded. A changed source state requires an explicit publish service.
}

function removeStateCaches() {
  for (const cacheFile of cacheFiles) {
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

async function main() {
  if (!fs.existsSync(statePath)) throw new Error(`state file not found: ${statePath}`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const records = scopedRecords(state);
  const summary = {
    settings: 1,
    pages: records.pages.length,
    siteThemes: records.siteThemes.length,
    themePublications: 0
  };

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      mode: "dry-run",
      siteId,
      contentOverwriteGuard: contentOverwriteGuardPayload(),
      summary
    }, null, 2));
    return;
  }

  const backupDir = process.env.SYNC_BACKUP_DIR ?? path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-scoped-content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const timeout = Number.isFinite(transactionTimeoutMs) && transactionTimeoutMs > 0 ? transactionTimeoutMs : 600000;
  const result = await prisma.$transaction(async (tx) => {
    const before = await backupScopedContent(tx);
    fs.writeFileSync(backupPath, `${JSON.stringify(before, null, 2)}\n`, { mode: 0o600 });
    await writeScopedContent(tx, records);
    return {
      backupPath,
      beforeSummary: {
        settings: before.settings ? 1 : 0,
        pages: before.pages.length,
        siteThemes: before.siteThemes.length,
        themePublications: 0
      }
    };
  }, { timeout });

  removeStateCaches();
  console.log(JSON.stringify({
    ok: true,
    mode: "scoped-content-upsert",
    siteId,
    contentOverwriteGuard: contentOverwriteGuardPayload(),
    summary,
    ...result
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
