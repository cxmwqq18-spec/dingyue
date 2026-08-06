import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const statePath = path.join(process.cwd(), "data", "platform-state.json");
const siteId = process.env.SYNC_SITE_ID ?? "site_dreamshoot";
const dryRun = process.argv.includes("--dry-run");
const cacheFiles = [
  path.join(process.cwd(), ".next", "cache", "platform-state-postgres.json"),
  path.join(process.cwd(), ".next-build", "cache", "platform-state-postgres.json")
];

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

function sitePages(state, targetSiteId) {
  return asArray(state.sites)
    .find((site) => site.id === targetSiteId)
    ?.pages ?? [];
}

function siteThemeSettings(state, targetSiteId) {
  const settings = asArray(state.sites).find((site) => site.id === targetSiteId)?.themeSettings;
  if (!settings) return undefined;
  return {
    id: `settings_${targetSiteId}`,
    siteId: targetSiteId,
    draftJson: json(settings.draftJson),
    publishedJson: json(settings.publishedJson)
  };
}

function flattenPrices(state, targetSiteId) {
  return asArray(state.products).flatMap((product) =>
    asArray(product.prices)
      .filter((price) => (price.siteId ?? product.siteId) === targetSiteId)
      .map((price) => ({
        ...price,
        siteId: price.siteId ?? product.siteId,
        productId: price.productId ?? product.id
      }))
  );
}

function contentRecords(state, targetSiteId) {
  const site = asArray(state.sites).find((item) => item.id === targetSiteId);
  if (!site) throw new Error(`site ${targetSiteId} not found in ${statePath}`);

  return {
    site,
    pages: sitePages(state, targetSiteId),
    settings: siteThemeSettings(state, targetSiteId),
    aiApps: asArray(state.aiApps),
    siteAiApps: asArray(state.siteAiApps).filter((item) => item.siteId === targetSiteId),
    products: asArray(state.products).filter((item) => item.siteId === targetSiteId),
    prices: flattenPrices(state, targetSiteId),
    creativePackCategories: asArray(state.creativePackCategories).filter((item) => item.siteId === targetSiteId),
    creativePacks: asArray(state.creativePacks).filter((item) => item.siteId === targetSiteId),
    mediaAssets: asArray(state.mediaAssets).filter((item) => item.siteId === targetSiteId),
    toolCategories: asArray(state.toolCategories).filter((item) => item.siteId === targetSiteId),
    toolMenuItems: asArray(state.toolMenuItems).filter((item) => item.siteId === targetSiteId),
    videoThemeCategories: asArray(state.videoThemeCategories).filter((item) => item.siteId === targetSiteId),
    videoThemes: asArray(state.videoThemes).filter((item) => item.siteId === targetSiteId),
    siteThemes: asArray(state.siteThemes).filter((item) => item.siteId === targetSiteId),
    themePublications: asArray(state.themePublications).filter((item) => item.siteId === targetSiteId)
  };
}

function productData(product) {
  return {
    id: product.id,
    siteId: product.siteId,
    name: product.name,
    type: product.type,
    status: product.status
  };
}

function priceData(price) {
  return {
    id: price.id,
    siteId: price.siteId,
    productId: price.productId,
    label: price.label ?? price.id,
    stripePriceId: price.stripePriceId,
    currency: price.currency,
    amountCents: price.amountCents,
    interval: price.interval,
    creditsGranted: price.creditsGranted
  };
}

function aiAppData(app) {
  return {
    id: app.id,
    slug: app.slug,
    name: app.name,
    description: app.description,
    appType: app.appType,
    parameterSchema: json(app.parameterSchema, [])
  };
}

function siteAiAppData(app) {
  return {
    id: app.id,
    siteId: app.siteId,
    aiAppId: app.aiAppId ?? app.aiApp?.id,
    enabled: app.enabled ?? true,
    creditCost: app.creditCost ?? 0,
    routeKey: app.routeKey
  };
}

function creativePackCategoryData(category) {
  return {
    id: category.id,
    siteId: category.siteId,
    parentId: category.parentId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    heroTitle: category.heroTitle,
    heroSubtitle: category.heroSubtitle,
    icon: category.icon ?? category.iconName,
    sortOrder: category.sortOrder ?? 0,
    status: category.status ?? "active",
    imageUrl: category.imageUrl,
    createdAt: toDate(category.createdAt)
  };
}

function creativePackData(pack) {
  return {
    id: pack.id,
    siteId: pack.siteId,
    name: pack.name,
    headline: pack.headline,
    description: pack.description,
    prompt: pack.prompt,
    category: pack.category,
    categoryId: pack.categoryId,
    aiAppSlug: pack.aiAppSlug,
    status: pack.status,
    creditCost: pack.creditCost ?? 0,
    outputCount: pack.outputCount ?? 0,
    trainingRequired: Boolean(pack.trainingRequired),
    generationCount: pack.generationCount ?? 0,
    conversionRate: pack.conversionRate ?? 0,
    imageUrl: pack.imageUrl,
    galleryImages: json(pack.galleryImages, undefined),
    createdAt: toDate(pack.createdAt)
  };
}

function orderedCreativePackCreatedAt(pack, index, offsetsBySourceDate) {
  const sourceDate = toDate(pack.createdAt) ?? new Date("2026-01-01T00:00:00.000Z");
  const sourceKey = sourceDate.toISOString();
  const offset = offsetsBySourceDate.get(sourceKey) ?? 0;
  offsetsBySourceDate.set(sourceKey, offset + 1);
  return new Date(sourceDate.getTime() + offset);
}

function mediaAssetData(asset) {
  return {
    id: asset.id,
    siteId: asset.siteId,
    label: asset.label,
    storageKey: asset.storageKey,
    mimeType: asset.mimeType ?? "image/png",
    usageType: asset.usageType ?? asset.usage ?? "theme",
    createdAt: toDate(asset.createdAt)
  };
}

function videoThemeCategoryData(category) {
  return {
    id: category.id,
    siteId: category.siteId,
    slug: category.slug,
    label: category.label,
    description: category.description,
    imageUrl: category.imageUrl,
    sortOrder: category.sortOrder ?? 0,
    status: category.status ?? "active",
    createdAt: toDate(category.createdAt)
  };
}

function videoThemeData(theme, categoryId) {
  return {
    id: theme.id,
    siteId: theme.siteId,
    categoryId,
    slug: theme.slug,
    name: theme.name,
    headline: theme.headline,
    description: theme.description,
    prompt: theme.prompt,
    status: theme.status ?? "draft",
    creditCost: theme.creditCost ?? 0,
    modelPricing: json(theme.modelPricing, undefined),
    durationSeconds: theme.durationSeconds ?? 6,
    maxFrames: theme.maxFrames ?? 30,
    generationCount: theme.generationCount ?? 0,
    imageUrl: theme.imageUrl,
    galleryImages: json(theme.galleryImages, undefined),
    createdAt: toDate(theme.createdAt)
  };
}

function siteThemeData(theme) {
  return {
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
  };
}

function publicationData(publication, site) {
  return {
    id: publication.id,
    siteId: publication.siteId,
    version: publication.version,
    snapshot: json(publication.snapshot),
    pageCount: publication.snapshot?.pages?.length ?? site.pages.length,
    sectionCount: site.pages.reduce((sum, page) => sum + Object.keys(page.publishedJson?.sections ?? {}).length, 0),
    snapshotBytes: Buffer.byteLength(JSON.stringify(publication.snapshot ?? {}), "utf8"),
    publishedBy: publication.publishedBy,
    publishedAt: toDate(publication.publishedAt)
  };
}

function mergeBySiteId(existing, incoming, targetSiteId) {
  return [
    ...asArray(existing).filter((item) => item.siteId !== targetSiteId),
    ...incoming.map(clone)
  ];
}

async function backup(tx, records) {
  const [
    pages,
    settings,
    siteThemes,
    publications,
    packs,
    categories,
    products,
    siteAiApps,
    mediaAssets,
    toolCategories,
    toolMenuItems,
    videoThemeCategories,
    videoThemes,
    document
  ] = await Promise.all([
    tx.themePage.findMany({ where: { siteId } }),
    tx.themeSettings.findUnique({ where: { siteId } }),
    tx.siteTheme.findMany({ where: { siteId } }),
    tx.themePublication.findMany({ where: { siteId } }),
    tx.creativePack.findMany({ where: { siteId } }),
    tx.creativePackCategory.findMany({ where: { siteId } }),
    tx.product.findMany({ where: { siteId }, include: { prices: true } }),
    tx.siteAiApp.findMany({ where: { siteId }, include: { aiApp: true } }),
    tx.mediaAsset.findMany({ where: { siteId } }),
    tx.toolCategory.findMany({ where: { siteId } }),
    tx.toolMenuItem.findMany({ where: { siteId } }),
    tx.videoThemeCategory.findMany({ where: { siteId } }),
    tx.videoTheme.findMany({ where: { siteId }, include: { category: true } }),
    tx.platformStateDocument.findUnique({ where: { id: "platform" } })
  ]);
  return {
    createdAt: new Date().toISOString(),
    siteId,
    pages,
    settings,
    siteThemes,
    publications,
    packs,
    categories,
    products,
    siteAiApps,
    mediaAssets,
    toolCategories,
    toolMenuItems,
    videoThemeCategories,
    videoThemes,
    platformStateSite: document?.state?.sites?.find((item) => item.id === siteId),
    platformStateSiteThemes: document?.state?.siteThemes?.filter((item) => item.siteId === siteId),
    platformStatePublications: document?.state?.themePublications?.filter((item) => item.siteId === siteId)
  };
}

async function writeContent(tx, records) {
  if (records.settings) {
    await tx.themeSettings.upsert({
      where: { siteId },
      create: records.settings,
      update: {
        draftJson: records.settings.draftJson,
        publishedJson: records.settings.publishedJson
      }
    });
  }

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
    await tx.themePage.upsert({
      where: { id: page.id },
      create: {
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
      },
      update: {
        pageType: page.pageType,
        templateKey: page.templateKey ?? null,
        slug: page.slug,
        title: page.title,
        draftJson: json(page.draftJson),
        publishedJson: json(page.publishedJson),
        draftMeta: page.draftMeta ? clone(page.draftMeta) : undefined,
        updatedAt: toDate(page.updatedAt)
      }
    });
  }

  for (const app of records.aiApps) {
    await tx.aiApp.upsert({
      where: { id: app.id },
      create: aiAppData(app),
      update: aiAppData(app)
    });
  }
  for (const app of records.siteAiApps) {
    const data = siteAiAppData(app);
    if (!data.aiAppId) continue;
    await tx.siteAiApp.upsert({ where: { id: data.id }, create: data, update: data });
  }
  if (records.siteAiApps.length) {
    await tx.siteAiApp.updateMany({
      where: { siteId, id: { notIn: records.siteAiApps.map((app) => app.id) } },
      data: { enabled: false }
    });
  }
  for (const product of records.products) {
    const data = productData(product);
    await tx.product.upsert({ where: { id: data.id }, create: data, update: data });
  }
  for (const price of records.prices) {
    const data = priceData(price);
    await tx.price.upsert({ where: { id: data.id }, create: data, update: data });
  }
  const creativePackCategoryIds = new Map();
  for (const category of [...records.creativePackCategories].sort((left, right) => {
    const leftRoot = left.parentId ? 1 : 0;
    const rightRoot = right.parentId ? 1 : 0;
    return leftRoot - rightRoot || left.sortOrder - right.sortOrder;
  })) {
    const sourceData = creativePackCategoryData(category);
    const data = stripUndefined({
      ...sourceData,
      parentId: category.parentId ? creativePackCategoryIds.get(category.parentId) : undefined
    });
    const existing = await tx.creativePackCategory.findUnique({
      where: { siteId_slug: { siteId: data.siteId, slug: data.slug } }
    });
    if (existing) {
      await tx.creativePackCategory.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
      creativePackCategoryIds.set(category.id, existing.id);
    } else {
      const created = await tx.creativePackCategory.create({ data });
      creativePackCategoryIds.set(category.id, created.id);
    }
  }
  if (creativePackCategoryIds.size) {
    await tx.creativePackCategory.updateMany({
      where: { siteId, id: { notIn: [...creativePackCategoryIds.values()] } },
      data: { status: "archived" }
    });
  }
  const creativePackIds = new Set();
  const creativePackCreatedAtOffsets = new Map();
  for (const [index, pack] of records.creativePacks.entries()) {
    const data = stripUndefined({
      ...creativePackData(pack),
      categoryId: pack.categoryId ? creativePackCategoryIds.get(pack.categoryId) : undefined,
      createdAt: orderedCreativePackCreatedAt(pack, index, creativePackCreatedAtOffsets)
    });
    const existing = await tx.creativePack.findFirst({
      where: { siteId, name: pack.name }
    });
    if (existing) {
      await tx.creativePack.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
      creativePackIds.add(existing.id);
    } else {
      const created = await tx.creativePack.create({ data });
      creativePackIds.add(created.id);
    }
  }
  if (creativePackIds.size) {
    await tx.creativePack.updateMany({
      where: { siteId, id: { notIn: [...creativePackIds] } },
      data: { status: "archived" }
    });
  }
  for (const asset of records.mediaAssets) {
    const data = stripUndefined(mediaAssetData(asset));
    const existing = await tx.mediaAsset.findUnique({
      where: {
        siteId_storageKey: {
          siteId: data.siteId,
          storageKey: data.storageKey
        }
      }
    });
    if (existing) {
      await tx.mediaAsset.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
    } else {
      await tx.mediaAsset.create({ data });
    }
  }
  if (records.mediaAssets.length) {
    await tx.mediaAsset.updateMany({
      where: { siteId, storageKey: { notIn: records.mediaAssets.map((asset) => asset.storageKey) } },
      data: { usageType: "legacy" }
    });
  }
  await tx.toolMenuItem.deleteMany({ where: { siteId } });
  await tx.toolCategory.deleteMany({ where: { siteId } });
  const videoThemeCategoryIds = new Map();
  for (const category of [...records.videoThemeCategories].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const data = stripUndefined(videoThemeCategoryData(category));
    const existing = await tx.videoThemeCategory.findUnique({
      where: { siteId_slug: { siteId: data.siteId, slug: data.slug } }
    });
    if (existing) {
      await tx.videoThemeCategory.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
      videoThemeCategoryIds.set(category.id, existing.id);
    } else {
      const created = await tx.videoThemeCategory.create({ data });
      videoThemeCategoryIds.set(category.id, created.id);
    }
  }
  await tx.videoTheme.deleteMany({
    where: {
      siteId,
      slug: { notIn: records.videoThemes.map((theme) => theme.slug) }
    }
  });
  for (const theme of records.videoThemes) {
    const data = stripUndefined(videoThemeData(theme, videoThemeCategoryIds.get(theme.categoryId) ?? theme.categoryId));
    const existing = await tx.videoTheme.findUnique({
      where: { siteId_slug: { siteId: data.siteId, slug: data.slug } }
    });
    if (existing) {
      await tx.videoTheme.update({ where: { id: existing.id }, data: { ...data, id: existing.id } });
    } else {
      await tx.videoTheme.create({ data });
    }
  }
  await tx.videoThemeCategory.deleteMany({
    where: {
      siteId,
      slug: { notIn: records.videoThemeCategories.map((category) => category.slug) }
    }
  });
  for (const theme of records.siteThemes) {
    const data = stripUndefined(siteThemeData(theme));
    await tx.siteTheme.upsert({ where: { id: data.id }, create: data, update: data });
  }
  for (const publication of records.themePublications) {
    const data = stripUndefined(publicationData(publication, records.site));
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

  const document = await tx.platformStateDocument.findUnique({ where: { id: "platform" } });
  const nextState = document?.state && typeof document.state === "object" ? clone(document.state) : {};
  nextState.sites = asArray(nextState.sites);
  const siteIndex = nextState.sites.findIndex((item) => item.id === siteId);
  if (siteIndex >= 0) nextState.sites[siteIndex] = clone(records.site);
  else nextState.sites.push(clone(records.site));
  for (const key of [
    "siteAiApps",
    "products",
    "creativePackCategories",
    "creativePacks",
    "mediaAssets",
    "toolCategories",
    "toolMenuItems",
    "videoThemeCategories",
    "videoThemes",
    "siteThemes",
    "themePublications"
  ]) {
    nextState[key] = mergeBySiteId(nextState[key], records[key], siteId);
  }
  await tx.platformStateDocument.upsert({
    where: { id: "platform" },
    create: { id: "platform", state: nextState },
    update: { state: nextState }
  });
}

async function main() {
  if (!fs.existsSync(statePath)) throw new Error(`state file not found: ${statePath}`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const records = contentRecords(state, siteId);
  const summary = Object.fromEntries(Object.entries(records).map(([key, value]) => [key, Array.isArray(value) ? value.length : Boolean(value)]));
  if (dryRun) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId, summary }, null, 2));
    return;
  }

  const backupDir = process.env.SYNC_BACKUP_DIR ?? path.join(process.cwd(), "backups");
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const backupPath = path.join(backupDir, `mydreamshoots-public-content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  const result = await prisma.$transaction(async (tx) => {
    const before = await backup(tx, records);
    const backupPayload = JSON.stringify(before, null, 2);
    fs.writeFileSync(backupPath, `${backupPayload}\n`, { mode: 0o600 });
    await writeContent(tx, records);
    return {
      backupPath,
      beforeSummary: {
        pages: before.pages.length,
        packs: before.packs.length,
        categories: before.categories.length,
        products: before.products.length,
        mediaAssets: before.mediaAssets.length,
        toolCategories: before.toolCategories.length,
        toolMenuItems: before.toolMenuItems.length,
        videoThemeCategories: before.videoThemeCategories.length,
        videoThemes: before.videoThemes.length
      }
    };
  }, { timeout: 180000 });
  for (const cacheFile of cacheFiles) {
    if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
  }
  console.log(JSON.stringify({ ok: true, mode: "content-only-upsert", siteId, summary, ...result }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
