import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const sourceSiteId = process.env.GROWNSTRIDE_SOURCE_SITE_ID || "site_dreamshoot";
const targetSiteId = process.env.GROWNSTRIDE_TARGET_SITE_ID || "site_grownstride_test";
const targetSlug = process.env.GROWNSTRIDE_TARGET_SLUG || "grownstride";
const targetName = process.env.GROWNSTRIDE_TARGET_NAME || "MyDreamShoots Test";
const targetPrimaryDomain = process.env.GROWNSTRIDE_PRIMARY_DOMAIN || "test.grownstride.com";
const targetLegacyWwwDomain = process.env.GROWNSTRIDE_LEGACY_WWW_DOMAIN || "www.grownstride.com";
const targetApexDomain = process.env.GROWNSTRIDE_APEX_DOMAIN || "grownstride.com";
const targetAdminEmail = process.env.GROWNSTRIDE_ADMIN_EMAIL || "owner@grownstride.localhost";
const targetAdminPassword = process.env.GROWNSTRIDE_ADMIN_PASSWORD || "grownstride123";
const shouldNoIndex = !["0", "false", "off", "no"].includes(String(process.env.GROWNSTRIDE_TEST_NOINDEX ?? "1").toLowerCase());
const statePath = path.join(process.cwd(), "data", "platform-state.json");
const resetFlag = "--reset-test-from-production";
const resetConfirmPhrase = "reset-grownstride-test";

const prisma = new PrismaClient();
const targetDomainIds = new Map([
  [targetPrimaryDomain, "dom_grownstride_test"],
  [targetLegacyWwwDomain, "dom_grownstride_primary"],
  [targetApexDomain, "dom_grownstride_apex"]
]);
const targetDomains = Array.from(targetDomainIds.keys());

function usage() {
  console.log(
    "Usage: node scripts/sync-grownstride-test-store.mjs --reset-test-from-production --confirm reset-grownstride-test [--json] [--database] [--all]\n" +
      "High-risk bootstrap/reset only. This copies site_dreamshoot into site_grownstride_test and must not be used for routine promotion."
  );
}

function wants(flag) {
  return process.argv.includes(flag);
}

function argValue(name) {
  const equalPrefix = `${name}=`;
  const equalArg = process.argv.find((arg) => arg.startsWith(equalPrefix));
  if (equalArg) return equalArg.slice(equalPrefix.length);
  const index = process.argv.indexOf(name);
  if (index >= 0 && index + 1 < process.argv.length) return process.argv[index + 1];
  return undefined;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256Password(password) {
  return `sha256:${crypto.createHash("sha256").update(password).digest("hex")}`;
}

function cleanId(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

function mappedId(id, fallbackPrefix = "grownstride") {
  if (!id) return `${fallbackPrefix}_${targetSlug}`;
  const raw = String(id);
  const next = raw
    .replaceAll("site_dreamshoot", targetSiteId)
    .replaceAll("mydreamshoots", targetSlug)
    .replaceAll("dreamshoot", targetSlug);
  return cleanId(next === raw ? `${raw}_${targetSlug}` : next);
}

const textRewrites = [
  ["https://www.mydreamshoots.com", "https://test.grownstride.com"],
  ["https://mydreamshoots.com", "https://test.grownstride.com"],
  ["http://www.mydreamshoots.com", "https://test.grownstride.com"],
  ["http://mydreamshoots.com", "https://test.grownstride.com"],
  ["www.mydreamshoots.com", "test.grownstride.com"],
  ["mydreamshoots.com", "test.grownstride.com"],
  ["/site/mydreamshoots", "/site/grownstride"],
  ["site_dreamshoot", "site_grownstride_test"],
  ["/assets/dreamshoot/", "/assets/sites/site_grownstride_test/"],
  ["sites/site_dreamshoot/", "sites/site_grownstride_test/"]
];

function createIdMap(source) {
  const idMap = new Map([[source.id, targetSiteId]]);
  const add = (id, fallbackPrefix) => {
    if (id) idMap.set(id, mappedId(id, fallbackPrefix));
  };
  for (const page of source.pages ?? []) add(page.id, `${targetSiteId}_page`);
  for (const product of source.products ?? []) {
    add(product.id, "prod");
    for (const price of product.prices ?? []) add(price.id, "price");
  }
  for (const row of source.siteAiApps ?? []) add(row.id, "sai");
  for (const row of source.aiGatewayGroups ?? []) add(row.id, "gw");
  for (const row of source.creativePackCategories ?? []) add(row.id, "cpc");
  for (const row of source.creativePacks ?? []) add(row.id, "pack");
  for (const row of source.mediaAssets ?? []) add(row.id, "media");
  for (const row of source.siteThemes ?? []) {
    add(row.id, "theme");
    add(row.themeId, "theme_id");
  }
  for (const row of source.themeCopies ?? []) add(row.id, "theme_copy");
  for (const row of source.themePublications ?? []) add(row.id, "pub");
  for (const row of source.toolCategories ?? []) add(row.id, "tool_cat");
  for (const row of source.toolMenuItems ?? []) add(row.id, "tool");
  for (const row of source.videoThemeCategories ?? []) add(row.id, "video_cat");
  for (const row of source.videoThemes ?? []) add(row.id, "video");
  return idMap;
}

function remapString(value, idMap) {
  if (typeof value !== "string") return value;
  let next = value;
  const idEntries = [...idMap.entries()].sort(([a], [b]) => String(b).length - String(a).length);
  for (const [from, to] of idEntries) {
    if (from && to) next = next.split(String(from)).join(String(to));
  }
  for (const [from, to] of textRewrites) {
    next = next.split(from).join(to);
  }
  return next;
}

function remapExactJson(value, idMap) {
  if (Array.isArray(value)) return value.map((item) => remapExactJson(item, idMap));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        remapString(idMap.get(key) ?? key, idMap),
        remapExactJson(item, idMap)
      ])
    );
  }
  if (typeof value === "string") return remapString(idMap.get(value) ?? value, idMap);
  return value;
}

function markSeoNoIndex(json) {
  if (!shouldNoIndex || !json || typeof json !== "object" || Array.isArray(json)) return json;
  const seo = json.seo;
  if (!seo || typeof seo !== "object" || Array.isArray(seo)) return json;
  seo.index = false;
  seo.follow = seo.follow ?? true;
  seo.robots = {
    ...(seo.robots && typeof seo.robots === "object" && !Array.isArray(seo.robots) ? seo.robots : {}),
    index: false,
    follow: seo.robots?.follow ?? seo.follow ?? true
  };
  if (seo.pages && typeof seo.pages === "object" && !Array.isArray(seo.pages)) {
    for (const pageSeo of Object.values(seo.pages)) {
      if (!pageSeo || typeof pageSeo !== "object" || Array.isArray(pageSeo)) continue;
      pageSeo.index = false;
      pageSeo.follow = pageSeo.follow ?? true;
      pageSeo.robots = {
        ...(pageSeo.robots && typeof pageSeo.robots === "object" && !Array.isArray(pageSeo.robots) ? pageSeo.robots : {}),
        index: false,
        follow: pageSeo.robots?.follow ?? pageSeo.follow ?? true
      };
    }
  }
  return json;
}

function remapThemeJson(value, idMap) {
  return markSeoNoIndex(remapExactJson(clone(value), idMap));
}

function sourceCollectionsFromState(state) {
  const source = state.sites?.find((site) => site.id === sourceSiteId);
  if (!source) throw new Error(`source site not found in JSON state: ${sourceSiteId}`);
  return {
    ...clone(source),
    siteDomains: (state.siteDomains ?? []).filter((row) => row.siteId === sourceSiteId),
    siteAiApps: (state.siteAiApps ?? []).filter((row) => row.siteId === sourceSiteId),
    aiGatewayGroups: (state.aiGatewayGroups ?? []).filter((row) => row.siteId === sourceSiteId),
    creativePackCategories: (state.creativePackCategories ?? []).filter((row) => row.siteId === sourceSiteId),
    creativePacks: (state.creativePacks ?? []).filter((row) => row.siteId === sourceSiteId),
    mediaAssets: (state.mediaAssets ?? []).filter((row) => row.siteId === sourceSiteId),
    siteThemes: (state.siteThemes ?? []).filter((row) => row.siteId === sourceSiteId),
    themeCopies: (state.themeCopies ?? []).filter((row) => row.siteId === sourceSiteId),
    themePublications: (state.themePublications ?? []).filter((row) => row.siteId === sourceSiteId),
    toolCategories: (state.toolCategories ?? []).filter((row) => row.siteId === sourceSiteId),
    toolMenuItems: (state.toolMenuItems ?? []).filter((row) => row.siteId === sourceSiteId),
    videoThemeCategories: (state.videoThemeCategories ?? []).filter((row) => row.siteId === sourceSiteId),
    videoThemes: (state.videoThemes ?? []).filter((row) => row.siteId === sourceSiteId),
    products: (state.products ?? []).filter((row) => row.siteId === sourceSiteId)
  };
}

function buildJsonRows(source, idMap) {
  const pageId = (id) => idMap.get(id) ?? mappedId(id, `${targetSiteId}_page`);
  const categoryId = (id) => id ? idMap.get(id) ?? mappedId(id, "category") : undefined;
  const productId = (id) => idMap.get(id) ?? mappedId(id, "prod");
  const priceId = (id) => idMap.get(id) ?? mappedId(id, "price");

  const site = {
    ...source,
    id: targetSiteId,
    name: targetName,
    slug: targetSlug,
    status: "active",
    primaryDomain: targetPrimaryDomain,
    branding: clone(source.branding),
    connect: {
      ...(source.connect ? clone(source.connect) : {}),
      stripeAccountId: "acct_demo_grownstride_test"
    },
    themeSettings: {
      draftJson: remapThemeJson(source.themeSettings?.draftJson ?? {}, idMap),
      publishedJson: remapThemeJson(source.themeSettings?.publishedJson ?? {}, idMap)
    },
    pages: (source.pages ?? []).map((page) => ({
      ...clone(page),
      id: pageId(page.id),
      siteId: targetSiteId,
      draftJson: remapThemeJson(page.draftJson, idMap),
      publishedJson: remapThemeJson(page.publishedJson, idMap)
    }))
  };

  return {
    site,
    siteDomains: [
      { id: targetDomainIds.get(targetPrimaryDomain), siteId: targetSiteId, domain: targetPrimaryDomain, isPrimary: true, status: "active", createdAt: new Date().toISOString() },
      { id: targetDomainIds.get(targetApexDomain), siteId: targetSiteId, domain: targetApexDomain, isPrimary: false, status: "active", createdAt: new Date().toISOString() }
    ],
    siteAdmins: [
      {
        id: "admin_grownstride_owner",
        siteId: targetSiteId,
        email: targetAdminEmail,
        passwordHash: sha256Password(targetAdminPassword),
        displayName: "Grownstride Test Owner",
        role: "owner",
        createdAt: new Date().toISOString()
      }
    ],
    products: (source.products ?? []).map((product) => ({
      ...remapExactJson(clone(product), idMap),
      id: productId(product.id),
      siteId: targetSiteId,
      prices: (product.prices ?? []).map((price) => ({
        ...remapExactJson(clone(price), idMap),
        id: priceId(price.id),
        siteId: targetSiteId,
        productId: productId(product.id)
      }))
    })),
    siteAiApps: (source.siteAiApps ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "sai"),
      siteId: targetSiteId
    })),
    aiGatewayGroups: (source.aiGatewayGroups ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "gw"),
      siteId: targetSiteId,
      usedQuota: 0
    })),
    creativePackCategories: (source.creativePackCategories ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: categoryId(row.id),
      siteId: targetSiteId,
      parentId: categoryId(row.parentId)
    })),
    creativePacks: (source.creativePacks ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "pack"),
      siteId: targetSiteId,
      categoryId: categoryId(row.categoryId)
    })),
    mediaAssets: (source.mediaAssets ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "media"),
      siteId: targetSiteId
    })),
    siteThemes: (source.siteThemes ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "theme"),
      siteId: targetSiteId,
      themeId: idMap.get(row.themeId) ?? mappedId(row.themeId, "theme_id")
    })),
    themeCopies: (source.themeCopies ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "theme_copy"),
      siteId: targetSiteId
    })),
    themePublications: (source.themePublications ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "pub"),
      siteId: targetSiteId,
      snapshot: markSeoNoIndex(remapExactJson(clone(row.snapshot), idMap))
    })),
    toolCategories: (source.toolCategories ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: categoryId(row.id),
      siteId: targetSiteId,
      parentId: categoryId(row.parentId)
    })),
    toolMenuItems: (source.toolMenuItems ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "tool"),
      siteId: targetSiteId,
      categoryId: categoryId(row.categoryId)
    })),
    videoThemeCategories: (source.videoThemeCategories ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: categoryId(row.id),
      siteId: targetSiteId
    })),
    videoThemes: (source.videoThemes ?? []).map((row) => ({
      ...remapExactJson(clone(row), idMap),
      id: idMap.get(row.id) ?? mappedId(row.id, "video"),
      siteId: targetSiteId,
      categoryId: categoryId(row.categoryId)
    }))
  };
}

function replaceSiteRows(state, key, rows) {
  if (!Array.isArray(state[key])) state[key] = [];
  state[key] = [...state[key].filter((row) => row?.siteId !== targetSiteId), ...rows];
}

function syncJsonState(state) {
  const source = sourceCollectionsFromState(state);
  const idMap = createIdMap(source);
  const rows = buildJsonRows(source, idMap);
  rows.site.siteDomains = clone(rows.siteDomains);
  rows.site.siteAdmins = clone(rows.siteAdmins);
  rows.site.products = clone(rows.products);
  rows.site.siteAiApps = clone(rows.siteAiApps);
  rows.site.aiGatewayGroups = clone(rows.aiGatewayGroups);
  rows.site.creativePackCategories = clone(rows.creativePackCategories);
  rows.site.creativePacks = clone(rows.creativePacks);
  rows.site.mediaAssets = clone(rows.mediaAssets);
  rows.site.siteThemes = clone(rows.siteThemes);
  rows.site.themeCopies = clone(rows.themeCopies);
  rows.site.themePublications = clone(rows.themePublications);
  rows.site.toolCategories = clone(rows.toolCategories);
  rows.site.toolMenuItems = clone(rows.toolMenuItems);
  rows.site.videoThemeCategories = clone(rows.videoThemeCategories);
  rows.site.videoThemes = clone(rows.videoThemes);
  const sourceIndex = state.sites.findIndex((site) => site.id === sourceSiteId);
  state.sites = state.sites.filter((site) => site.id !== targetSiteId && site.slug !== targetSlug);
  state.sites.splice(sourceIndex >= 0 ? sourceIndex + 1 : state.sites.length, 0, rows.site);
  state.siteDomains = (state.siteDomains ?? []).filter((row) => row.siteId !== targetSiteId && !targetDomains.includes(row.domain));
  state.siteDomains.push(...rows.siteDomains);
  replaceSiteRows(state, "siteAdmins", rows.siteAdmins);
  replaceSiteRows(state, "products", rows.products);
  replaceSiteRows(state, "siteAiApps", rows.siteAiApps);
  replaceSiteRows(state, "aiGatewayGroups", rows.aiGatewayGroups);
  replaceSiteRows(state, "creativePackCategories", rows.creativePackCategories);
  replaceSiteRows(state, "creativePacks", rows.creativePacks);
  replaceSiteRows(state, "mediaAssets", rows.mediaAssets);
  replaceSiteRows(state, "siteThemes", rows.siteThemes);
  replaceSiteRows(state, "themeCopies", rows.themeCopies);
  replaceSiteRows(state, "themePublications", rows.themePublications);
  replaceSiteRows(state, "toolCategories", rows.toolCategories);
  replaceSiteRows(state, "toolMenuItems", rows.toolMenuItems);
  replaceSiteRows(state, "videoThemeCategories", rows.videoThemeCategories);
  replaceSiteRows(state, "videoThemes", rows.videoThemes);
  state.auditLogs = [
    ...(state.auditLogs ?? []).filter((row) => row.id !== "audit_grownstride_test_store_synced"),
    {
      id: "audit_grownstride_test_store_synced",
      siteId: targetSiteId,
      actorType: "system",
      actorId: "sync-grownstride-test-store",
      action: "test_store_synced",
      targetType: "site",
      targetId: targetSiteId,
      createdAt: new Date().toISOString(),
      metadata: { sourceSiteId, primaryDomain: targetPrimaryDomain }
    }
  ];
  return {
    state,
    summary: {
      pages: rows.site.pages.length,
      products: rows.products.length,
      creativePacks: rows.creativePacks.length,
      creativePackCategories: rows.creativePackCategories.length,
      mediaAssets: rows.mediaAssets.length,
      siteThemes: rows.siteThemes.length,
      themePublications: rows.themePublications.length,
      videoThemes: rows.videoThemes.length
    }
  };
}

async function syncJsonFile() {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const result = syncJsonState(state);
  fs.writeFileSync(statePath, `${JSON.stringify(result.state, null, 2)}\n`);
  return result.summary;
}

function asInputJson(value) {
  return value === undefined ? undefined : clone(value);
}

function toDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function syncDatabase() {
  const source = await prisma.site.findUnique({
    where: { id: sourceSiteId },
    include: {
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      connect: true,
      products: { include: { prices: true }, orderBy: { createdAt: "asc" } },
      aiApps: { include: { aiApp: true }, orderBy: { routeKey: "asc" } },
      gatewayGroups: { orderBy: { name: "asc" } },
      creativePackCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
      creativePacks: { orderBy: { createdAt: "asc" } },
      mediaAssets: { orderBy: { createdAt: "asc" } },
      siteThemes: { orderBy: { updatedAt: "asc" } },
      themeCopies: { orderBy: { updatedAt: "asc" } },
      publications: { orderBy: { version: "asc" } },
      toolCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
      toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemeCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemes: { orderBy: [{ createdAt: "asc" }, { slug: "asc" }] }
    }
  });
  if (!source) throw new Error(`source site not found in database: ${sourceSiteId}`);

  const sourceForRows = {
    ...source,
    themeSettings: source.settings ? { draftJson: source.settings.draftJson, publishedJson: source.settings.publishedJson } : undefined,
    siteAiApps: source.aiApps,
    aiGatewayGroups: source.gatewayGroups,
    themePublications: source.publications
  };
  const idMap = createIdMap(sourceForRows);
  const rows = buildJsonRows(sourceForRows, idMap);

  await prisma.$transaction(async (tx) => {
    await tx.siteDomain.deleteMany({ where: { domain: { in: targetDomains }, siteId: { not: targetSiteId } } });
    await tx.site.deleteMany({ where: { OR: [{ id: targetSiteId }, { slug: targetSlug }] } });

    await tx.site.create({
      data: {
        id: targetSiteId,
        name: targetName,
        slug: targetSlug,
        status: "active",
        primaryDomain: targetPrimaryDomain,
        timezone: source.timezone,
        currency: source.currency,
        signupCreditGrant: source.signupCreditGrant,
        branding: asInputJson(source.branding),
        createdAt: new Date()
      }
    });

    await tx.siteDomain.createMany({
      data: rows.siteDomains.map((domain) => ({
        id: domain.id,
        siteId: targetSiteId,
        domain: domain.domain,
        isPrimary: domain.isPrimary,
        status: domain.status
      }))
    });

    await tx.siteAdmin.create({
      data: {
        id: "admin_grownstride_owner",
        siteId: targetSiteId,
        email: targetAdminEmail,
        passwordHash: sha256Password(targetAdminPassword),
        displayName: "Grownstride Test Owner",
        role: "owner"
      }
    });

    if (source.settings) {
      await tx.themeSettings.create({
        data: {
          id: `settings_${targetSiteId}`,
          siteId: targetSiteId,
          draftJson: rows.site.themeSettings.draftJson,
          publishedJson: rows.site.themeSettings.publishedJson
        }
      });
    }

    if (source.connect) {
      await tx.stripeConnectAccount.create({
        data: {
          id: `connect_${targetSiteId}`,
          siteId: targetSiteId,
          stripeAccountId: "acct_demo_grownstride_test",
          onboardingStatus: source.connect.onboardingStatus,
          chargesEnabled: source.connect.chargesEnabled,
          payoutsEnabled: source.connect.payoutsEnabled
        }
      });
    }

    for (const page of rows.site.pages) {
      await tx.themePage.create({
        data: {
          id: page.id,
          siteId: targetSiteId,
          pageType: page.pageType,
          templateKey: page.templateKey,
          slug: page.slug,
          title: page.title,
          draftJson: asInputJson(page.draftJson),
          publishedJson: asInputJson(page.publishedJson),
          draftMeta: asInputJson(page.draftMeta),
          updatedAt: toDate(page.updatedAt)
        }
      });
    }

    for (const product of rows.products) {
      await tx.product.create({
        data: {
          id: product.id,
          siteId: targetSiteId,
          name: product.name,
          type: product.type,
          status: product.status,
          createdAt: toDate(product.createdAt)
        }
      });
      for (const price of product.prices ?? []) {
        await tx.price.create({
          data: {
            id: price.id,
            siteId: targetSiteId,
            productId: product.id,
            label: price.label ?? price.id,
            amountCents: price.amountCents,
            currency: price.currency,
            interval: price.interval,
            creditsGranted: price.creditsGranted,
            stripePriceId: price.stripePriceId,
            metadata: asInputJson(price.metadata),
            createdAt: toDate(price.createdAt)
          }
        });
      }
    }

    for (const app of rows.siteAiApps) {
      await tx.siteAiApp.create({
        data: {
          id: app.id,
          siteId: targetSiteId,
          aiAppId: app.aiAppId ?? app.aiApp?.id,
          enabled: app.enabled,
          creditCost: app.creditCost,
          routeKey: app.routeKey,
          workflowConfig: asInputJson(app.workflowConfig),
          providerConfig: asInputJson(app.providerConfig)
        }
      });
    }

    for (const group of rows.aiGatewayGroups) {
      await tx.aiGatewayGroup.create({
        data: {
          id: group.id,
          siteId: targetSiteId,
          name: group.name,
          status: group.status,
          modelAllowlist: group.modelAllowlist ?? [],
          monthlyQuota: group.monthlyQuota ?? 0,
          usedQuota: 0,
          retryStatusCodes: group.retryStatusCodes ?? [],
          rateLimitPerMinute: group.rateLimitPerMinute ?? 0,
          accountPoolMode: group.accountPoolMode,
          unavailableReason: group.unavailableReason
        }
      });
    }

    for (const category of rows.creativePackCategories) {
      await tx.creativePackCategory.create({
        data: {
          id: category.id,
          siteId: targetSiteId,
          slug: category.slug,
          label: category.label,
          description: category.description,
          heroTitle: category.heroTitle,
          heroSubtitle: category.heroSubtitle,
          icon: category.icon ?? category.iconName,
          imageUrl: category.imageUrl,
          sortOrder: category.sortOrder ?? 0,
          status: category.status ?? "active",
          createdAt: toDate(category.createdAt)
        }
      });
    }
    for (const category of rows.creativePackCategories.filter((item) => item.parentId)) {
      await tx.creativePackCategory.update({ where: { id: category.id }, data: { parentId: category.parentId } });
    }

    for (const pack of rows.creativePacks) {
      await tx.creativePack.create({
        data: {
          id: pack.id,
          siteId: targetSiteId,
          categoryId: pack.categoryId,
          name: pack.name,
          headline: pack.headline,
          description: pack.description,
          prompt: pack.prompt,
          category: pack.category,
          aiAppSlug: pack.aiAppSlug,
          status: pack.status,
          creditCost: pack.creditCost ?? 0,
          outputCount: pack.outputCount ?? 0,
          trainingRequired: Boolean(pack.trainingRequired),
          generationCount: pack.generationCount ?? 0,
          conversionRate: pack.conversionRate ?? 0,
          imageUrl: pack.imageUrl,
          galleryImages: asInputJson(pack.galleryImages),
          createdAt: toDate(pack.createdAt)
        }
      });
    }

    for (const asset of rows.mediaAssets) {
      await tx.mediaAsset.create({
        data: {
          id: asset.id,
          siteId: targetSiteId,
          label: asset.label,
          storageKey: asset.storageKey,
          mimeType: asset.mimeType ?? "image/png",
          usageType: asset.usageType ?? asset.usage ?? "theme",
          sourceType: asset.sourceType,
          previewUrl: asset.previewUrl,
          originUrl: asset.originUrl,
          altText: asset.altText,
          notes: asset.notes,
          createdAt: toDate(asset.createdAt)
        }
      });
    }

    for (const category of rows.toolCategories) {
      await tx.toolCategory.create({
        data: {
          id: category.id,
          siteId: targetSiteId,
          slug: category.slug,
          label: category.label,
          description: category.description,
          icon: category.icon ?? category.iconName,
          sortOrder: category.sortOrder ?? 0,
          status: category.status ?? "active",
          createdAt: toDate(category.createdAt)
        }
      });
    }
    for (const category of rows.toolCategories.filter((item) => item.parentId)) {
      await tx.toolCategory.update({ where: { id: category.id }, data: { parentId: category.parentId } });
    }

    for (const item of rows.toolMenuItems) {
      await tx.toolMenuItem.create({
        data: {
          id: item.id,
          siteId: targetSiteId,
          categoryId: item.categoryId,
          slug: item.slug,
          title: item.title,
          description: item.description,
          badge: item.badge,
          icon: item.icon,
          imageUrl: item.imageUrl,
          href: item.href,
          detailJson: asInputJson(item.detailJson),
          sortOrder: item.sortOrder ?? 0,
          status: item.status ?? "active",
          createdAt: toDate(item.createdAt)
        }
      });
    }

    for (const category of rows.videoThemeCategories) {
      await tx.videoThemeCategory.create({
        data: {
          id: category.id,
          siteId: targetSiteId,
          slug: category.slug,
          label: category.label,
          description: category.description,
          imageUrl: category.imageUrl,
          sortOrder: category.sortOrder ?? 0,
          status: category.status ?? "active",
          createdAt: toDate(category.createdAt)
        }
      });
    }

    for (const theme of rows.videoThemes) {
      await tx.videoTheme.create({
        data: {
          id: theme.id,
          siteId: targetSiteId,
          categoryId: theme.categoryId,
          slug: theme.slug,
          name: theme.name,
          headline: theme.headline,
          description: theme.description,
          prompt: theme.prompt,
          status: theme.status,
          creditCost: theme.creditCost ?? 0,
          modelPricing: asInputJson(theme.modelPricing),
          durationSeconds: theme.durationSeconds ?? 6,
          maxFrames: theme.maxFrames ?? 30,
          generationCount: theme.generationCount ?? 0,
          imageUrl: theme.imageUrl,
          galleryImages: asInputJson(theme.galleryImages),
          createdAt: toDate(theme.createdAt)
        }
      });
    }

    for (const theme of rows.siteThemes) {
      await tx.siteTheme.create({
        data: {
          id: theme.id,
          siteId: targetSiteId,
          name: theme.name,
          themeId: theme.themeId,
          themeKey: theme.themeKey,
          status: theme.status,
          templates: asInputJson(theme.templates),
          settings: asInputJson(theme.settings),
          source: theme.source,
          createdBy: theme.createdBy,
          createdAt: toDate(theme.createdAt),
          updatedAt: toDate(theme.updatedAt)
        }
      });
    }

    for (const copyRecord of rows.themeCopies) {
      await tx.themeCopy.create({
        data: {
          id: copyRecord.id,
          siteId: targetSiteId,
          name: copyRecord.name,
          themeKey: copyRecord.themeKey,
          source: copyRecord.source,
          templates: asInputJson(copyRecord.templates),
          settings: asInputJson(copyRecord.settings),
          createdBy: copyRecord.createdBy,
          createdAt: toDate(copyRecord.createdAt),
          updatedAt: toDate(copyRecord.updatedAt)
        }
      });
    }

    for (const publication of rows.themePublications) {
      await tx.themePublication.create({
        data: {
          id: publication.id,
          siteId: targetSiteId,
          version: publication.version,
          snapshot: asInputJson(publication.snapshot),
          pageCount: publication.pageCount,
          sectionCount: publication.sectionCount,
          snapshotBytes: publication.snapshotBytes,
          publishedBy: publication.publishedBy,
          publishedAt: toDate(publication.publishedAt)
        }
      });
    }

    await tx.auditLog.create({
      data: {
        id: `audit_${targetSiteId}_${Date.now()}`,
        siteId: targetSiteId,
        actorType: "system",
        actorId: "sync-grownstride-test-store",
        action: "test_store_synced",
        targetType: "site",
        targetId: targetSiteId,
        metadata: { sourceSiteId, primaryDomain: targetPrimaryDomain }
      }
    });
  }, { timeout: 60_000 });

  const document = await prisma.platformStateDocument.findUnique({ where: { id: "platform" } });
  if (document?.state && typeof document.state === "object") {
    const next = syncJsonState(clone(document.state)).state;
    await prisma.platformStateDocument.update({
      where: { id: "platform" },
      data: { state: next }
    });
  }

  return {
    pages: rows.site.pages.length,
    products: rows.products.length,
    creativePacks: rows.creativePacks.length,
    creativePackCategories: rows.creativePackCategories.length,
    mediaAssets: rows.mediaAssets.length,
    siteThemes: rows.siteThemes.length,
    themePublications: rows.themePublications.length,
    videoThemes: rows.videoThemes.length
  };
}

async function main() {
  if (wants("--help") || wants("-h")) {
    usage();
    return;
  }
  const resetRequested = wants(resetFlag);
  const confirmationOk = argValue("--confirm") === resetConfirmPhrase;
  if (!resetRequested || !confirmationOk) {
    usage();
    console.log(JSON.stringify({
      ok: false,
      mode: "blocked",
      sourceSiteId,
      targetSiteId,
      targetSlug,
      resetRequested,
      confirmationOk,
      required: {
        flag: resetFlag,
        confirm: resetConfirmPhrase
      },
      note: "Refusing to refresh the grownstride test store from production without the explicit high-risk reset guard."
    }, null, 2));
    process.exitCode = 1;
    return;
  }
  const runJson = wants("--json") || wants("--all") || (!wants("--database") && !wants("--all"));
  const runDatabase = wants("--database") || wants("--all");
  const results = {};
  if (runJson) results.json = await syncJsonFile();
  if (runDatabase) results.database = await syncDatabase();
  console.log(JSON.stringify({
    ok: true,
    mode: "reset-test-from-production",
    guard: {
      resetRequested,
      confirmationOk,
      requiredConfirm: resetConfirmPhrase
    },
    sourceSiteId,
    targetSiteId,
    targetSlug,
    targetDomains,
    shouldNoIndex,
    results
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
