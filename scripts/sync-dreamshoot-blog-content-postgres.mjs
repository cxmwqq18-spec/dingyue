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

async function syncSite(state, site) {
  const blogPages = site.pages.filter((page) => page.slug === "/blog" || page.slug.startsWith("/blog/"));
  const retainedBlogSlugs = blogPages.map((page) => page.slug);
  const retainedBlogPageIds = blogPages.map((page) => page.id);
  const transactionResult = await prisma.$transaction(async (tx) => {
    const existingSettings = await tx.themeSettings.findUnique({ where: { siteId: site.id }, select: { siteId: true } });
    if (!existingSettings) throw new Error(`ThemeSettings ${site.id} must exist before draft content can be imported.`);
    await tx.themeSettings.update({ where: { siteId: site.id }, data: { draftJson: clone(site.themeSettings.draftJson) } });

    for (const page of blogPages) {
      const existing = await tx.themePage.findUnique({ where: { id: page.id }, select: { id: true } });
      if (!existing) throw new Error(`ThemePage ${site.id}:${page.slug} must exist before draft content can be imported.`);
      await tx.themePage.update({
        where: { id: page.id },
        data: {
          pageType: page.pageType,
          templateKey: page.templateKey ?? null,
          slug: page.slug,
          title: page.title,
          draftJson: clone(page.draftJson),
          draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined
        }
      });
    }

    for (const theme of (state.siteThemes ?? []).filter((item) => item.siteId === site.id)) {
      await upsertSiteTheme(tx, theme);
    }

    return {
      publicationWrites: 0
    };
  }, { timeout: syncTransactionTimeoutMs });

  return { siteId: site.id, blogPages: blogPages.map((page) => page.slug), ...transactionResult };
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
    ...documentState.themePublications.filter((publication) => !targetIds.has(publication.siteId) || publication.siteId === "site_dreamshoot"),
    ...state.themePublications.filter((publication) => targetIds.has(publication.siteId) && publication.siteId !== "site_dreamshoot").map(clone)
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
