import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.join(process.cwd(), "data/platform-state.json");
const cacheFile = path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json");
const targetSiteIds = new Set(["site_dreamshoot", "site_aidreamcapes"]);
const syncTransactionTimeoutMs = Number.parseInt(process.env.BLOG_CONTENT_SYNC_TX_TIMEOUT_MS ?? "180000", 10);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
}

function sectionCountForSite(site) {
  return site.pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0);
}

async function upsertSiteTheme(tx, theme) {
  await tx.siteTheme.upsert({
    where: { id: theme.id },
    create: {
      id: theme.id,
      siteId: theme.siteId,
      name: theme.name,
      themeId: theme.themeId,
      themeKey: theme.themeKey,
      status: theme.status,
      templates: clone(theme.templates),
      settings: clone(theme.settings),
      source: theme.source ?? "site",
      createdBy: theme.createdBy ?? "site_admin_demo",
      createdAt: theme.createdAt ? new Date(theme.createdAt) : undefined
    },
    update: {
      name: theme.name,
      themeId: theme.themeId,
      themeKey: theme.themeKey,
      status: theme.status,
      templates: clone(theme.templates),
      settings: clone(theme.settings),
      source: theme.source ?? "site",
      createdBy: theme.createdBy ?? "site_admin_demo"
    }
  });
}

async function upsertPublication(tx, site, publication) {
  await tx.themePublication.upsert({
    where: { id: publication.id },
    create: {
      id: publication.id,
      siteId: publication.siteId,
      version: publication.version,
      snapshot: clone(publication.snapshot),
      pageCount: publication.snapshot?.pages?.length ?? site.pages.length,
      sectionCount: sectionCountForSite(site),
      snapshotBytes: jsonSize(publication.snapshot),
      publishedBy: publication.publishedBy ?? "site_admin_demo",
      publishedAt: publication.publishedAt ? new Date(publication.publishedAt) : undefined
    },
    update: {
      snapshot: clone(publication.snapshot),
      pageCount: publication.snapshot?.pages?.length ?? site.pages.length,
      sectionCount: sectionCountForSite(site),
      snapshotBytes: jsonSize(publication.snapshot)
    }
  });
}

async function syncSite(state, site) {
  const blogPages = site.pages.filter((page) => page.slug === "/blog" || page.slug.startsWith("/blog/"));
  await prisma.$transaction(async (tx) => {
    await tx.themeSettings.upsert({
      where: { siteId: site.id },
      create: {
        id: `settings_${site.id}`,
        siteId: site.id,
        draftJson: clone(site.themeSettings.draftJson),
        publishedJson: clone(site.themeSettings.publishedJson)
      },
      update: {
        draftJson: clone(site.themeSettings.draftJson),
        publishedJson: clone(site.themeSettings.publishedJson)
      }
    });

    for (const page of blogPages) {
      await tx.themePage.upsert({
        where: { id: page.id },
        create: {
          id: page.id,
          siteId: site.id,
          pageType: page.pageType,
          templateKey: page.templateKey ?? null,
          slug: page.slug,
          title: page.title,
          draftJson: clone(page.draftJson),
          publishedJson: clone(page.publishedJson),
          draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined
        },
        update: {
          pageType: page.pageType,
          templateKey: page.templateKey ?? null,
          slug: page.slug,
          title: page.title,
          draftJson: clone(page.draftJson),
          publishedJson: clone(page.publishedJson),
          draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined
        }
      });
    }

    for (const theme of (state.siteThemes ?? []).filter((item) => item.siteId === site.id)) {
      await upsertSiteTheme(tx, theme);
    }

    for (const publication of (state.themePublications ?? []).filter((item) => item.siteId === site.id)) {
      await upsertPublication(tx, site, publication);
    }
  }, { timeout: syncTransactionTimeoutMs });

  return { siteId: site.id, blogPages: blogPages.map((page) => page.slug) };
}

async function syncPlatformStateDocument(state, targetSites) {
  const current = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
  const documentState = current?.state && typeof current.state === "object" ? clone(current.state) : clone(state);
  documentState.sites ??= [];
  documentState.siteThemes ??= [];
  documentState.themePublications ??= [];

  const targetIds = new Set(targetSites.map((site) => site.id));
  for (const site of targetSites) {
    const existingIndex = documentState.sites.findIndex((item) => item.id === site.id);
    if (existingIndex >= 0) documentState.sites[existingIndex] = clone(site);
    else documentState.sites.push(clone(site));
  }
  documentState.siteThemes = [
    ...documentState.siteThemes.filter((theme) => !targetIds.has(theme.siteId)),
    ...state.siteThemes.filter((theme) => targetIds.has(theme.siteId)).map(clone)
  ];
  documentState.themePublications = [
    ...documentState.themePublications.filter((publication) => !targetIds.has(publication.siteId)),
    ...state.themePublications.filter((publication) => targetIds.has(publication.siteId)).map(clone)
  ];

  await prisma.platformStateDocument.upsert({
    where: { id: "platform" },
    create: { id: "platform", state: documentState },
    update: { state: documentState }
  });
}

async function main() {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const targetSites = state.sites.filter((site) => targetSiteIds.has(site.id));
  if (targetSites.length !== targetSiteIds.size) throw new Error(`Expected ${targetSiteIds.size} target sites, found ${targetSites.length}`);
  const results = [];
  for (const site of targetSites) results.push(await syncSite(state, site));
  await syncPlatformStateDocument(state, targetSites);
  if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  console.log(JSON.stringify({ ok: true, results, platformStateDocument: "merged", cacheCleared: cacheFile }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
