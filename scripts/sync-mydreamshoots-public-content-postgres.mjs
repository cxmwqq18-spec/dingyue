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
    scope: ["ThemeSettings", "ThemePage", "SiteTheme", "ThemePublication"],
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
      draftJson: json(site.themeSettings.draftJson),
      publishedJson: json(site.themeSettings.publishedJson)
    },
    pages: asArray(site.pages),
    siteThemes: asArray(state.siteThemes).filter((item) => item.siteId === siteId),
    themePublications: asArray(state.themePublications).filter((item) => item.siteId === siteId)
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
    publishedJson: json(page.publishedJson),
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

function publicationData(publication, site, siteThemes = []) {
  const activeTheme = siteThemes.find((theme) => theme.status === "active") ?? siteThemes[0];
  const sourceSnapshot = json(publication.snapshot);
  const snapshot = {
    ...clone(sourceSnapshot),
    pages: asArray(site.pages).map((page) => ({
      id: page.id,
      siteId,
      pageType: page.pageType,
      templateKey: page.templateKey ?? null,
      slug: page.slug,
      title: page.title,
      draftJson: json(page.draftJson),
      publishedJson: json(page.publishedJson),
      draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined,
      updatedAt: page.updatedAt
    })),
    themeSettings: json(site.themeSettings.publishedJson)
  };

  if (activeTheme) {
    snapshot.saasTheme = {
      ...(sourceSnapshot.saasTheme ?? {}),
      name: activeTheme.name,
      themeId: activeTheme.themeId,
      themeKey: activeTheme.themeKey,
      status: activeTheme.status,
      templates: json(activeTheme.templates),
      settings: json(activeTheme.settings),
      updatedAt: activeTheme.updatedAt
    };
  }

  return stripUndefined({
    id: publication.id,
    siteId: publication.siteId,
    version: publication.version,
    snapshot,
    pageCount: snapshot.pages.length,
    sectionCount: site.pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0),
    snapshotBytes: Buffer.byteLength(JSON.stringify(snapshot), "utf8"),
    publishedBy: publication.publishedBy,
    publishedAt: toDate(publication.publishedAt)
  });
}

async function backupScopedContent(tx) {
  const [pages, settings, siteThemes, publications] = await Promise.all([
    tx.themePage.findMany({ where: { siteId } }),
    tx.themeSettings.findUnique({ where: { siteId } }),
    tx.siteTheme.findMany({ where: { siteId } }),
    tx.themePublication.findMany({ where: { siteId } })
  ]);
  return {
    createdAt: new Date().toISOString(),
    siteId,
    scope: ["ThemeSettings", "ThemePage", "SiteTheme", "ThemePublication"],
    pages,
    settings,
    siteThemes,
    publications
  };
}

async function writeScopedContent(tx, records) {
  await tx.themeSettings.upsert({
    where: { siteId },
    create: records.settings,
    update: {
      draftJson: records.settings.draftJson,
      publishedJson: records.settings.publishedJson
    }
  });

  const pageIds = new Set(records.pages.map((page) => page.id));
  const pageSlugs = records.pages.map((page) => page.slug);
  await tx.themePage.deleteMany({
    where: {
      siteId,
      slug: { in: pageSlugs },
      id: { notIn: [...pageIds] }
    }
  });
  for (const page of records.pages) {
    const data = pageData(page);
    await tx.themePage.upsert({
      where: { id: data.id },
      create: data,
      update: {
        pageType: data.pageType,
        templateKey: data.templateKey,
        slug: data.slug,
        title: data.title,
        draftJson: data.draftJson,
        publishedJson: data.publishedJson,
        draftMeta: data.draftMeta,
        updatedAt: data.updatedAt
      }
    });
  }

  for (const theme of records.siteThemes) {
    const data = siteThemeData(theme);
    await tx.siteTheme.upsert({ where: { id: data.id }, create: data, update: data });
  }

  for (const publication of records.themePublications) {
    const data = publicationData(publication, records.site, records.siteThemes);
    const existing = await tx.themePublication.findUnique({
      where: {
        siteId_version: {
          siteId: data.siteId,
          version: data.version
        }
      }
    });
    if (existing) {
      await tx.themePublication.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
    } else {
      await tx.themePublication.create({ data });
    }
  }

  const sourcePublication = [...records.themePublications]
    .sort((left, right) => Number(right.version ?? 0) - Number(left.version ?? 0))[0];
  const latestDatabasePublication = await tx.themePublication.findFirst({
    where: { siteId },
    orderBy: [{ version: "desc" }]
  });
  if (sourcePublication && latestDatabasePublication) {
    const sourceData = publicationData(sourcePublication, records.site, records.siteThemes);
    await tx.themePublication.update({
      where: { id: latestDatabasePublication.id },
      data: {
        snapshot: sourceData.snapshot,
        pageCount: sourceData.pageCount,
        sectionCount: sourceData.sectionCount,
        snapshotBytes: sourceData.snapshotBytes
      }
    });
  }
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
    themePublications: records.themePublications.length
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
        themePublications: before.publications.length
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
