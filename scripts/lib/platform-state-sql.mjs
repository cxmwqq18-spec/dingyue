import "../load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

/**
 * Transitional SQL adapter for offline checks that still need the aggregate
 * platform shape. It reads PostgreSQL JSONB only; no filesystem fallback is
 * permitted here.
 */
export async function readPlatformStateFromSql(existingPrisma) {
  const prisma = existingPrisma ?? new PrismaClient();
  const ownsClient = !existingPrisma;
  try {
    const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
    if (!document?.state || typeof document.state !== "object" || Array.isArray(document.state)) {
      throw new Error("missing_platform_state_document:platform");
    }
    const state = structuredClone(document.state);
    const [siteRows, domains, pages, settings, profiles, packs, packCategories, mediaAssets, products, siteThemes, themePublications, toolCategories, toolMenuItems, videoCategories, videoThemes, siteAiApps] = await Promise.all([
      prisma.site.findMany({
        orderBy: { createdAt: "asc" },
        include: { activePublication: { include: { publication: true } } }
      }),
      prisma.siteDomain.findMany({ orderBy: [{ siteId: "asc" }, { isPrimary: "desc" }, { createdAt: "asc" }] }),
      prisma.themePage.findMany({ orderBy: [{ siteId: "asc" }, { slug: "asc" }] }),
      prisma.themeSettings.findMany(),
      prisma.storefrontProfile.findMany(),
      prisma.creativePack.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.creativePackCategory.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.mediaAsset.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.product.findMany({ include: { prices: true }, orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.siteTheme.findMany({ orderBy: [{ siteId: "asc" }, { createdAt: "asc" }] }),
      prisma.themePublication.findMany({ orderBy: [{ siteId: "asc" }, { version: "desc" }] }),
      prisma.toolCategory.findMany({ orderBy: [{ siteId: "asc" }, { parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }] }),
      prisma.toolMenuItem.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { title: "asc" }] }),
      prisma.videoThemeCategory.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }),
      prisma.videoTheme.findMany({ orderBy: [{ siteId: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }] }),
      prisma.siteAiApp.findMany({ orderBy: [{ siteId: "asc" }, { routeKey: "asc" }] })
    ]);
    const plain = (value) => {
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) return value.map(plain);
      if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plain(item)]));
      return value;
    };
    const categoryById = new Map(packCategories.map((category) => [category.id, plain(category)]));
    state.creativePackCategories = packCategories.map((category) => {
      const row = plain(category);
      return { ...row, parent: category.parentId ? categoryById.get(category.parentId) : undefined };
    });
    state.creativePacks = packs.map((pack) => ({
      ...plain(pack),
      categoryRecord: pack.categoryId ? categoryById.get(pack.categoryId) : undefined
    }));
    state.mediaAssets = mediaAssets.map(plain);
    state.products = products.map(plain);
    state.siteThemes = siteThemes.map(plain);
    state.themePublications = themePublications.map(plain);
    state.toolCategories = toolCategories.map(plain);
    state.toolMenuItems = toolMenuItems.map(plain);
    state.videoThemeCategories = videoCategories.map(plain);
    state.videoThemes = videoThemes.map(plain);
    state.siteAiApps = siteAiApps.map(plain);
    state.siteDomains = domains.map(plain);
    const settingsBySiteId = new Map(settings.map((setting) => [setting.siteId, plain(setting)]));
    const profileBySiteId = new Map(profiles.map((profile) => [profile.siteId, plain(profile)]));
    const pagesBySiteId = new Map();
    for (const page of pages) {
      const list = pagesBySiteId.get(page.siteId) ?? [];
      list.push(plain(page));
      pagesBySiteId.set(page.siteId, list);
    }
    state.sites = siteRows.map((siteRow) => {
      const existing = state.sites?.find((site) => site.id === siteRow.id) ?? {};
      const site = { ...existing, ...plain(siteRow) };
      const activePublication = siteRow.activePublication?.publication;
      const latestPublication = themePublications.find((publication) => publication.siteId === siteRow.id);
      if (activePublication) site.latestPublication = plain(activePublication);
      else if (latestPublication) site.latestPublication = plain(latestPublication);
      const siteDomains = domains.filter((domain) => domain.siteId === siteRow.id);
      site.primaryDomain = siteDomains.find((domain) => domain.isPrimary)?.domain ?? siteDomains[0]?.domain ?? site.primaryDomain;
      site.pages = pagesBySiteId.get(siteRow.id) ?? existing.pages ?? [];
      site.mediaAssets = mediaAssets.filter((asset) => asset.siteId === siteRow.id).map(plain);
      const themeSettings = settingsBySiteId.get(siteRow.id);
      if (themeSettings) site.themeSettings = themeSettings;
      const storefrontProfile = profileBySiteId.get(siteRow.id);
      if (storefrontProfile) site.storefrontProfile = storefrontProfile;
      return site;
    });
    return state;
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}

export async function writePlatformStateToSql(state, existingPrisma) {
  const prisma = existingPrisma ?? new PrismaClient();
  const ownsClient = !existingPrisma;
  try {
    await prisma.platformStateDocument.upsert({
      where: { id: "platform" },
      create: { id: "platform", state },
      update: { state }
    });
  } finally {
    if (ownsClient) await prisma.$disconnect();
  }
}
