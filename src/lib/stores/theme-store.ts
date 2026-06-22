import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import type { MediaAsset, Site, SiteTheme, ThemeDraftMeta, ThemePage, ThemePublication, ThemeSettings } from "@/lib/types";

import {
  addAuditLogRelational,
  assertThemeDraftVersion,
  cloneJson,
  draftJsonWithMeta,
  getPlatformDocumentState,
  makeThemeDraftMeta,
  RelationalStoreError,
  toMediaAsset,
  toSite,
  toSiteTheme,
  toThemePage,
  toThemePublication,
  uid,
  type PrismaLike
} from "./prisma-mappers";

type ThemeState = {
  site: Site;
  mediaAssets: MediaAsset[];
  publications: ThemePublication[];
  siteThemes: SiteTheme[];
};

async function getSiteWithThemeRecords(db: PrismaLike, siteId: string) {
  const site = await db.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true
    }
  });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  return site;
}

function buildPublicationSnapshot(site: Site, siteTheme?: SiteTheme): ThemePublication["snapshot"] {
  return {
    pages: site.pages.map((page) => ({
      id: page.id,
      slug: page.slug,
      publishedJson: cloneJson(page.publishedJson)
    })),
    themeSettings: cloneJson(site.themeSettings.publishedJson),
    saasTheme: siteTheme
      ? {
          name: siteTheme.name,
          themeId: siteTheme.themeId,
          themeKey: siteTheme.themeKey,
          status: siteTheme.status,
          templates: cloneJson(siteTheme.templates),
          settings: cloneJson(siteTheme.settings),
          updatedAt: siteTheme.updatedAt
        }
      : undefined
  };
}

function activeThemeFromDraft(siteId: string, draftTheme: SiteTheme | undefined, actor: string): SiteTheme {
  const now = new Date().toISOString();
  return {
    id: `theme_${siteId}_active`,
    siteId,
    name: draftTheme?.name ?? "Active theme",
    themeId: draftTheme?.themeId ?? `${siteId}_active`,
    themeKey: draftTheme?.themeKey ?? "theme1",
    status: "active",
    templates: cloneJson(draftTheme?.templates ?? {}),
    settings: cloneJson(draftTheme?.settings ?? {}),
    source: draftTheme?.source ?? "site",
    createdBy: draftTheme?.createdBy ?? actor,
    createdAt: draftTheme?.createdAt ?? now,
    updatedAt: now
  };
}

export async function getSiteThemeStateRelational(siteId: string): Promise<ThemeState> {
  const [siteRecord, mediaAssets, publications, siteThemes] = await Promise.all([
    getSiteWithThemeRecords(prisma, siteId),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { createdAt: "desc" } }),
    prisma.themePublication.findMany({ where: { siteId }, orderBy: [{ version: "desc" }, { publishedAt: "desc" }] }),
    prisma.siteTheme.findMany({ where: { siteId }, orderBy: [{ status: "asc" }, { updatedAt: "desc" }] })
  ]);
  return {
    site: toSite(siteRecord),
    mediaAssets: mediaAssets.map(toMediaAsset),
    publications: publications.map(toThemePublication),
    siteThemes: siteThemes.map(toSiteTheme)
  };
}

export async function saveThemePageDraftRelational(params: {
  siteId: string;
  pageId: string;
  draftJson: ThemePage["draftJson"];
  title?: string;
  actor?: string;
  expected?: { expectedRevision?: number; expectedEtag?: string };
}): Promise<{ page: ThemePage; draftVersion: ThemeDraftMeta }> {
  const pageRecord = await prisma.themePage.findFirst({ where: { siteId: params.siteId, id: params.pageId } });
  if (!pageRecord) throw new RelationalStoreError("theme_page_not_found", 404);
  const page = toThemePage(pageRecord);
  assertThemeDraftVersion(page, params.expected);
  page.draftJson = cloneJson(params.draftJson);
  page.draftMeta = makeThemeDraftMeta(page);
  if (params.title !== undefined) page.title = params.title.trim() || page.title;
  const updated = await prisma.themePage.update({
    where: { id: page.id },
    data: {
      title: page.title,
      draftJson: draftJsonWithMeta(page)
    }
  });
  return { page: toThemePage(updated), draftVersion: page.draftMeta };
}

export async function saveThemeSettingsDraftRelational(params: {
  siteId: string;
  draftJson: ThemeSettings;
  actor?: string;
}): Promise<{ site: Site }> {
  await prisma.themeSettings.upsert({
    where: { siteId: params.siteId },
    create: {
      id: `settings_${params.siteId}`,
      siteId: params.siteId,
      draftJson: cloneJson(params.draftJson) as unknown as Prisma.InputJsonValue,
      publishedJson: cloneJson(params.draftJson) as unknown as Prisma.InputJsonValue
    },
    update: {
      draftJson: cloneJson(params.draftJson) as unknown as Prisma.InputJsonValue
    }
  });
  return { site: toSite(await getSiteWithThemeRecords(prisma, params.siteId)) };
}

export async function publishDraftPageRelational(
  siteId: string,
  pageId: string,
  actor = "site_admin_demo",
  expected?: { expectedRevision?: number; expectedEtag?: string }
): Promise<{ site: Site; draftVersion?: ThemeDraftMeta; publication: ThemePublication; publishedVersion: number }> {
  return prisma.$transaction(async (tx) => {
    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    const targetPage = site.pages.find((page) => page.id === pageId);
    if (!targetPage) throw new RelationalStoreError("theme_page_not_found", 404);
    assertThemeDraftVersion(targetPage, expected);

    const currentMax = Math.max(0, ...site.pages.map((page) => page.publishedJson.version ?? 0));
    const publishedVersion = currentMax + 1;
    let draftVersion: ThemeDraftMeta | undefined;

    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue,
        publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue
      },
      update: {
        publishedJson: cloneJson(site.themeSettings.draftJson) as unknown as Prisma.InputJsonValue
      }
    });
    site.themeSettings.publishedJson = cloneJson(site.themeSettings.draftJson);

    for (const page of site.pages) {
      page.publishedJson = cloneJson(page.draftJson);
      page.publishedJson.version = publishedVersion;
      page.draftJson.version = publishedVersion;
      page.draftMeta = makeThemeDraftMeta(page);
      if (page.id === pageId) draftVersion = page.draftMeta;
      await tx.themePage.update({
        where: { id: page.id },
        data: {
          draftJson: draftJsonWithMeta(page),
          publishedJson: cloneJson(page.publishedJson) as unknown as Prisma.InputJsonValue
        }
      });
    }

    const draftThemeRecord = await tx.siteTheme.findFirst({
      where: { siteId, status: "draft" },
      orderBy: { updatedAt: "desc" }
    });
    const draftTheme = draftThemeRecord ? toSiteTheme(draftThemeRecord) : undefined;
    await tx.siteTheme.updateMany({ where: { siteId, status: "active" }, data: { status: "draft" } });
    const nextActive = activeThemeFromDraft(siteId, draftTheme, actor);
    const activeThemeRecord = await tx.siteTheme.upsert({
      where: { id: nextActive.id },
      create: {
        id: nextActive.id,
        siteId,
        name: nextActive.name,
        themeId: nextActive.themeId,
        themeKey: nextActive.themeKey,
        status: "active",
        templates: cloneJson(nextActive.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(nextActive.settings) as unknown as Prisma.InputJsonValue,
        source: nextActive.source,
        createdBy: nextActive.createdBy
      },
      update: {
        name: nextActive.name,
        themeId: nextActive.themeId,
        themeKey: nextActive.themeKey,
        status: "active",
        templates: cloneJson(nextActive.templates) as unknown as Prisma.InputJsonValue,
        settings: cloneJson(nextActive.settings) as unknown as Prisma.InputJsonValue,
        source: nextActive.source,
        createdBy: nextActive.createdBy
      }
    });
    const activeTheme = toSiteTheme(activeThemeRecord);

    const publicationRecord = await tx.themePublication.create({
      data: {
        id: `pub_${siteId}_${Date.now().toString(36)}`,
        siteId,
        version: publishedVersion,
        snapshot: buildPublicationSnapshot(site, activeTheme) as unknown as Prisma.InputJsonValue,
        publishedBy: actor
      }
    });
    const publication = toThemePublication(publicationRecord);
    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_published",
      targetType: "theme",
      targetId: siteId,
      metadata: { version: publishedVersion, pageId }
    });
    return { site, draftVersion, publication, publishedVersion };
  });
}

export async function restoreDraftThemeFromPublicationRelational(
  siteId: string,
  publicationId: string,
  actor = "site_admin_demo"
): Promise<{ site: Site; publication: ThemePublication }> {
  return prisma.$transaction(async (tx) => {
    const publicationRecord = await tx.themePublication.findFirst({ where: { siteId, id: publicationId } });
    if (!publicationRecord) throw new RelationalStoreError("theme_publication_not_found", 404);
    const publication = toThemePublication(publicationRecord);
    const snapshotPages = new Map(publication.snapshot.pages.map((page) => [page.id, page.publishedJson]));

    const siteRecord = await getSiteWithThemeRecords(tx, siteId);
    const site = toSite(siteRecord);
    for (const page of site.pages) {
      const snapshotPage = snapshotPages.get(page.id);
      if (!snapshotPage) continue;
      page.draftJson = cloneJson(snapshotPage);
      page.draftMeta = makeThemeDraftMeta(page);
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: draftJsonWithMeta(page) }
      });
    }
    await tx.themeSettings.upsert({
      where: { siteId },
      create: {
        id: `settings_${siteId}`,
        siteId,
        draftJson: cloneJson(publication.snapshot.themeSettings) as unknown as Prisma.InputJsonValue,
        publishedJson: cloneJson(publication.snapshot.themeSettings) as unknown as Prisma.InputJsonValue
      },
      update: {
        draftJson: cloneJson(publication.snapshot.themeSettings) as unknown as Prisma.InputJsonValue
      }
    });
    site.themeSettings.draftJson = cloneJson(publication.snapshot.themeSettings);

    const draftTheme = await tx.siteTheme.findFirst({ where: { siteId, status: "draft" }, orderBy: { updatedAt: "desc" } });
    if (draftTheme && publication.snapshot.saasTheme && typeof publication.snapshot.saasTheme === "object") {
      const record = publication.snapshot.saasTheme as Partial<SiteTheme>;
      await tx.siteTheme.update({
        where: { id: draftTheme.id },
        data: {
          templates: cloneJson(record.templates ?? draftTheme.templates) as unknown as Prisma.InputJsonValue,
          settings: cloneJson(record.settings ?? draftTheme.settings) as unknown as Prisma.InputJsonValue,
          themeKey: record.themeKey ?? draftTheme.themeKey
        }
      });
    }

    await addAuditLogRelational(tx, {
      siteId,
      actorType: "site_admin",
      actorId: actor,
      action: "theme_draft_restored_from_publication",
      targetType: "theme_publication",
      targetId: publication.id,
      metadata: { version: publication.version }
    });

    return { site, publication };
  });
}

export async function upsertThemeMediaAssetRelational(params: {
  siteId: string;
  assetId?: string;
  label: string;
  storageKey: string;
  mimeType: string;
  usage: MediaAsset["usage"];
  sourceType?: MediaAsset["sourceType"];
  previewUrl?: string;
  originUrl?: string;
  altText?: string;
  notes?: string;
}): Promise<{ asset: MediaAsset; created: boolean }> {
  const site = await prisma.site.findUnique({ where: { id: params.siteId }, select: { id: true } });
  if (!site) throw new RelationalStoreError("site_not_found", 404);
  const label = params.label.trim();
  const storageKey = params.storageKey.trim();
  const mimeType = params.mimeType.trim();
  if (label.length < 2) throw new RelationalStoreError("media_label_required", 400);
  if (!storageKey.startsWith(`sites/${params.siteId}/`)) throw new RelationalStoreError("media_storage_key_must_be_site_scoped", 400);
  if (!mimeType.includes("/")) throw new RelationalStoreError("invalid_mime_type", 400);

  const existing = params.assetId
    ? await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } })
    : null;
  const record = existing
    ? await prisma.mediaAsset.update({
        where: { id: existing.id },
        data: { label, storageKey, mimeType, usageType: params.usage }
      })
    : await prisma.mediaAsset.create({
        data: {
          id: params.assetId ?? uid("media"),
          siteId: params.siteId,
          label,
          storageKey,
          mimeType,
          usageType: params.usage
        }
      });
  return { asset: toMediaAsset(record), created: !existing };
}

export async function deleteThemeMediaAssetRelational(params: {
  siteId: string;
  assetId: string;
}): Promise<{ asset: MediaAsset }> {
  const existing = await prisma.mediaAsset.findFirst({ where: { siteId: params.siteId, id: params.assetId } });
  if (!existing) throw new RelationalStoreError("theme_media_not_found", 404);
  await prisma.mediaAsset.delete({ where: { id: existing.id } });
  return { asset: toMediaAsset(existing) };
}
