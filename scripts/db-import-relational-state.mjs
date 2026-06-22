import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const documentId = "platform";
const batchSize = 50;

function usage() {
  console.log(
    "Usage: node scripts/db-import-relational-state.mjs [--source data/platform-state.json] [--dry-run] [--verify]\n" +
      "       node scripts/verify-relational-state.mjs [--source data/platform-state.json]"
  );
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function toDate(value, fallback = undefined) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function json(value, fallback = {}) {
  return value === undefined ? fallback : value;
}

function stripUndefined(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function delegateFor(model) {
  return prisma[model];
}

function uniqueById(items) {
  const seen = new Set();
  const unique = [];
  const duplicates = [];
  for (const item of items) {
    if (!item?.id) {
      duplicates.push({ id: null, reason: "missing_id" });
      continue;
    }
    if (seen.has(item.id)) {
      duplicates.push({ id: item.id, reason: "duplicate_id" });
      continue;
    }
    seen.add(item.id);
    unique.push(item);
  }
  return { unique, duplicates };
}

function flattenPrices(state) {
  return asArray(state.products).flatMap((product) =>
    asArray(product.prices).map((price) => ({
      ...price,
      siteId: price.siteId ?? product.siteId,
      productId: price.productId ?? product.id
    }))
  );
}

function customerBalances(state) {
  return asArray(state.customers)
    .filter((customer) => customer.balance)
    .map((customer) => ({
      id: `balance_${customer.id}`,
      siteId: customer.siteId,
      customerId: customer.id,
      balance: customer.balance.available ?? 0,
      reserved: customer.balance.reserved ?? 0
    }));
}

function sitePages(state) {
  return asArray(state.sites).flatMap((site) =>
    asArray(site.pages).map((page) => ({
      ...page,
      siteId: page.siteId ?? site.id
    }))
  );
}

function siteThemeSettings(state) {
  return asArray(state.sites)
    .filter((site) => site.themeSettings)
    .map((site) => ({
      id: `settings_${site.id}`,
      siteId: site.id,
      draftJson: site.themeSettings.draftJson,
      publishedJson: site.themeSettings.publishedJson
    }));
}

function stripeConnectAccounts(state) {
  return asArray(state.sites)
    .filter((site) => site.connect?.stripeAccountId)
    .map((site) => ({
      id: `connect_${site.id}`,
      siteId: site.id,
      stripeAccountId: site.connect.stripeAccountId,
      onboardingStatus: site.connect.status ?? "not_started",
      chargesEnabled: Boolean(site.connect.chargesEnabled),
      payoutsEnabled: Boolean(site.connect.payoutsEnabled)
    }));
}

function siteAiApps(state) {
  return asArray(state.siteAiApps).map((siteAiApp) => ({
    ...siteAiApp,
    aiAppId: siteAiApp.aiAppId ?? siteAiApp.aiApp?.id
  }));
}

function summaryCounts(state) {
  return {
    sites: asArray(state.sites).length,
    domains: asArray(state.siteDomains).length,
    admins: asArray(state.siteAdmins).length,
    customers: asArray(state.customers).length,
    creditBalances: customerBalances(state).length,
    products: asArray(state.products).length,
    prices: flattenPrices(state).length,
    subscriptions: asArray(state.subscriptions).length,
    orders: asArray(state.orders).length,
    paymentEvents: asArray(state.paymentEvents).length,
    aiApps: asArray(state.aiApps).length,
    siteAiApps: asArray(state.siteAiApps).length,
    gatewayGroups: asArray(state.aiGatewayGroups).length,
    creativePacks: asArray(state.creativePacks).length,
    mediaAssets: asArray(state.mediaAssets).length,
    themePages: sitePages(state).length,
    themeSettings: siteThemeSettings(state).length,
    stripeConnectAccounts: stripeConnectAccounts(state).length,
    themePublications: asArray(state.themePublications).length,
    siteThemes: asArray(state.siteThemes).length,
    themeCopies: asArray(state.themeCopies).length,
    customerModels: asArray(state.customerModels).length,
    albums: asArray(state.albums).length,
    auditLogs: asArray(state.auditLogs).length,
    jobs: asArray(state.jobs).length,
    assetUploads: asArray(state.assetUploads).length,
    ledger: asArray(state.ledger).length
  };
}

const specs = [
  {
    key: "sites",
    model: "site",
    items: (state) => asArray(state.sites),
    data: (site) => ({
      id: site.id,
      name: site.name,
      slug: site.slug,
      status: site.status,
      timezone: site.timezone ?? "UTC",
      currency: site.currency ?? "usd",
      branding: json(site.branding),
      createdAt: toDate(site.createdAt),
      updatedAt: toDate(site.updatedAt)
    })
  },
  {
    key: "domains",
    model: "siteDomain",
    items: (state) => asArray(state.siteDomains),
    data: (domain) => ({
      id: domain.id,
      siteId: domain.siteId,
      domain: domain.domain,
      isPrimary: Boolean(domain.isPrimary),
      status: domain.status ?? "pending"
    })
  },
  {
    key: "admins",
    model: "siteAdmin",
    items: (state) => asArray(state.siteAdmins),
    data: (admin) => ({
      id: admin.id,
      siteId: admin.siteId,
      email: admin.email,
      displayName: admin.displayName,
      role: admin.role
    })
  },
  {
    key: "customers",
    model: "customer",
    items: (state) => asArray(state.customers),
    data: (customer) => ({
      id: customer.id,
      siteId: customer.siteId,
      email: customer.email,
      name: customer.name,
      status: customer.status,
      createdAt: toDate(customer.createdAt)
    })
  },
  {
    key: "creditBalances",
    model: "creditBalance",
    items: customerBalances,
    data: (balance) => balance
  },
  {
    key: "products",
    model: "product",
    items: (state) => asArray(state.products),
    data: (product) => ({
      id: product.id,
      siteId: product.siteId,
      name: product.name,
      type: product.type,
      status: product.status
    })
  },
  {
    key: "prices",
    model: "price",
    items: flattenPrices,
    data: (price) => ({
      id: price.id,
      siteId: price.siteId,
      productId: price.productId,
      stripePriceId: price.stripePriceId,
      currency: price.currency,
      amountCents: price.amountCents,
      interval: price.interval,
      creditsGranted: price.creditsGranted
    })
  },
  {
    key: "subscriptions",
    model: "subscription",
    items: (state) => asArray(state.subscriptions),
    data: (subscription) => ({
      id: subscription.id,
      siteId: subscription.siteId,
      customerId: subscription.customerId,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      status: subscription.status,
      currentPeriodStart: toDate(subscription.currentPeriodStart, toDate(subscription.createdAt, new Date(0))),
      currentPeriodEnd: toDate(subscription.currentPeriodEnd)
    })
  },
  {
    key: "orders",
    model: "order",
    items: (state) => asArray(state.orders),
    data: (order) => ({
      id: order.id,
      siteId: order.siteId,
      customerId: order.customerId,
      status: order.status,
      amountCents: order.amountCents,
      currency: order.currency,
      credits: order.credits
    })
  },
  {
    key: "paymentEvents",
    model: "paymentEvent",
    items: (state) => asArray(state.paymentEvents),
    data: (event) => ({
      id: event.id,
      siteId: event.siteId,
      provider: event.provider,
      providerEventId: event.providerEventId,
      eventType: event.eventType,
      processedAt: toDate(event.processedAt),
      payload: json(event.payload)
    })
  },
  {
    key: "aiApps",
    model: "aiApp",
    items: (state) => asArray(state.aiApps),
    data: (app) => ({
      id: app.id,
      slug: app.slug,
      name: app.name,
      description: app.description,
      appType: app.appType,
      parameterSchema: json(app.parameterSchema, [])
    })
  },
  {
    key: "siteAiApps",
    model: "siteAiApp",
    items: siteAiApps,
    data: (app) => ({
      id: app.id,
      siteId: app.siteId,
      aiAppId: app.aiAppId,
      enabled: app.enabled ?? true,
      creditCost: app.creditCost ?? 0,
      routeKey: app.routeKey
    })
  },
  {
    key: "gatewayGroups",
    model: "aiGatewayGroup",
    items: (state) => asArray(state.aiGatewayGroups),
    data: (group) => ({
      id: group.id,
      siteId: group.siteId,
      name: group.name,
      status: group.status,
      modelAllowlist: json(group.modelAllowlist, []),
      monthlyQuota: group.monthlyQuota ?? 0,
      usedQuota: group.usedQuota ?? 0,
      retryStatusCodes: json(group.retryStatusCodes, []),
      rateLimitPerMinute: group.rateLimitPerMinute ?? 0,
      accountPoolMode: group.accountPoolMode,
      unavailableReason: group.unavailableReason
    })
  },
  {
    key: "creativePacks",
    model: "creativePack",
    items: (state) => asArray(state.creativePacks),
    data: (pack) => ({
      id: pack.id,
      siteId: pack.siteId,
      name: pack.name,
      headline: pack.headline,
      description: pack.description,
      category: pack.category,
      aiAppSlug: pack.aiAppSlug,
      status: pack.status,
      creditCost: pack.creditCost ?? 0,
      outputCount: pack.outputCount ?? 0,
      trainingRequired: Boolean(pack.trainingRequired),
      generationCount: pack.generationCount ?? 0,
      conversionRate: pack.conversionRate ?? 0,
      createdAt: toDate(pack.createdAt)
    })
  },
  {
    key: "mediaAssets",
    model: "mediaAsset",
    items: (state) => asArray(state.mediaAssets),
    data: (asset) => ({
      id: asset.id,
      siteId: asset.siteId,
      label: asset.label,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      usageType: asset.usageType ?? asset.usage,
      createdAt: toDate(asset.createdAt)
    })
  },
  {
    key: "themePages",
    model: "themePage",
    items: sitePages,
    data: (page) => ({
      id: page.id,
      siteId: page.siteId,
      pageType: page.pageType,
      slug: page.slug,
      title: page.title,
      draftJson: json(page.draftJson),
      publishedJson: json(page.publishedJson),
      updatedAt: toDate(page.updatedAt)
    })
  },
  {
    key: "themeSettings",
    model: "themeSettings",
    items: siteThemeSettings,
    data: (settings) => ({
      id: settings.id,
      siteId: settings.siteId,
      draftJson: json(settings.draftJson),
      publishedJson: json(settings.publishedJson)
    })
  },
  {
    key: "stripeConnectAccounts",
    model: "stripeConnectAccount",
    items: stripeConnectAccounts,
    data: (account) => account
  },
  {
    key: "themePublications",
    model: "themePublication",
    items: (state) => asArray(state.themePublications),
    data: (publication) => ({
      id: publication.id,
      siteId: publication.siteId,
      version: publication.version,
      snapshot: json(publication.snapshot),
      publishedBy: publication.publishedBy,
      publishedAt: toDate(publication.publishedAt)
    })
  },
  {
    key: "siteThemes",
    model: "siteTheme",
    items: (state) => asArray(state.siteThemes),
    data: (theme) => ({
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
    })
  },
  {
    key: "themeCopies",
    model: "themeCopy",
    items: (state) => asArray(state.themeCopies),
    data: (copy) => ({
      id: copy.id,
      siteId: copy.siteId,
      name: copy.name,
      themeKey: copy.themeKey,
      source: copy.source,
      templates: json(copy.templates),
      settings: json(copy.settings),
      createdBy: copy.createdBy,
      createdAt: toDate(copy.createdAt),
      updatedAt: toDate(copy.updatedAt)
    })
  },
  {
    key: "customerModels",
    model: "customerModel",
    items: (state) => asArray(state.customerModels),
    data: (model) => ({
      id: model.id,
      siteId: model.siteId,
      customerId: model.customerId,
      label: model.label,
      modelType: model.modelType,
      status: model.status,
      inputAssetCount: model.inputAssetCount ?? 0,
      minInputAssets: model.minInputAssets ?? 0,
      providerModelId: model.providerModelId,
      trainingJobId: model.trainingJobId,
      failureReason: model.failureReason,
      createdAt: toDate(model.createdAt),
      updatedAt: toDate(model.updatedAt)
    })
  },
  {
    key: "albums",
    model: "album",
    items: (state) => asArray(state.albums),
    data: (album) => ({
      id: album.id,
      siteId: album.siteId,
      customerId: album.customerId,
      title: album.title,
      sourceJobId: album.sourceJobId,
      creativePackId: album.creativePackId,
      status: album.status,
      outputCount: album.outputCount ?? 0,
      coverAssetId: album.coverAssetId,
      createdAt: toDate(album.createdAt),
      updatedAt: toDate(album.updatedAt)
    })
  },
  {
    key: "auditLogs",
    model: "adminAuditLog",
    items: (state) => asArray(state.auditLogs),
    data: (log) => ({
      id: log.id,
      siteId: log.siteId,
      actorType: log.actorType,
      actorId: log.actorId,
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      metadata: json(log.metadata),
      createdAt: toDate(log.createdAt)
    })
  },
  {
    key: "jobs",
    model: "generationJob",
    items: (state) => asArray(state.jobs),
    data: (job) => ({
      id: job.id,
      siteId: job.siteId,
      customerId: job.customerId,
      aiAppId: job.aiAppId,
      status: job.status,
      creditsReserved: job.creditsReserved ?? 0,
      requestJson: json(job.requestJson),
      resultJson: job.resultJson,
      createdAt: toDate(job.createdAt),
      updatedAt: toDate(job.updatedAt)
    })
  },
  {
    key: "assetUploads",
    model: "assetUpload",
    items: (state) => asArray(state.assetUploads),
    data: (asset) => ({
      id: asset.id,
      siteId: asset.siteId,
      customerId: asset.customerId,
      storageKey: asset.storageKey,
      visibility: asset.visibility,
      reviewStatus: asset.reviewStatus,
      deletedAt: toDate(asset.deletedAt)
    })
  },
  {
    key: "ledger",
    model: "creditLedger",
    items: (state) => asArray(state.ledger),
    data: (entry) => ({
      id: entry.id,
      siteId: entry.siteId,
      customerId: entry.customerId,
      amount: entry.amount,
      type: entry.type,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      expiresAt: toDate(entry.expiresAt),
      createdAt: toDate(entry.createdAt)
    })
  }
];

async function loadState() {
  const sourceArg = argValue("--source");
  if (sourceArg) {
    const source = path.resolve(sourceArg);
    if (!fs.existsSync(source)) throw new Error(`state file not found: ${source}`);
    return { state: JSON.parse(fs.readFileSync(source, "utf8")), source };
  }
  const document = await prisma.platformStateDocument.findUnique({ where: { id: documentId } });
  if (!document?.state) throw new Error(`PlatformStateDocument(${documentId}) not found`);
  return { state: document.state, source: `PlatformStateDocument(${documentId})` };
}

function buildPlan(state) {
  const counts = summaryCounts(state);
  const plan = specs.map((spec) => {
    const items = spec.items(state);
    const { unique, duplicates } = uniqueById(items);
    return {
      key: spec.key,
      model: spec.model,
      sourceCount: items.length,
      uniqueCount: unique.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.slice(0, 20)
    };
  });
  return { counts, plan };
}

async function importSpec(spec, state) {
  const delegate = delegateFor(spec.model);
  const items = spec.items(state);
  const { unique, duplicates } = uniqueById(items);
  if (!delegate?.upsert) {
    return {
      key: spec.key,
      model: spec.model,
      sourceCount: items.length,
      upserted: 0,
      duplicateCount: duplicates.length,
      skipped: items.length,
      skipReason: "missing_prisma_model",
      duplicates: duplicates.slice(0, 20)
    };
  }

  let upserted = 0;
  for (let index = 0; index < unique.length; index += batchSize) {
    const batch = unique.slice(index, index + batchSize);
    const operations = batch.map((item) => {
      const data = stripUndefined(spec.data(item, state));
      return delegate.upsert({
        where: { id: item.id },
        create: data,
        update: data
      });
    });
    await prisma.$transaction(operations);
    upserted += batch.length;
  }

  return {
    key: spec.key,
    model: spec.model,
    sourceCount: items.length,
    upserted,
    duplicateCount: duplicates.length,
    skipped: duplicates.length,
    skipReason: duplicates.length ? "duplicate_or_missing_id" : undefined,
    duplicates: duplicates.slice(0, 20)
  };
}

async function verifyState(state) {
  const checks = [];
  for (const spec of specs) {
    const delegate = delegateFor(spec.model);
    const sourceCount = spec.items(state).length;
    if (!delegate?.count) {
      checks.push({
        key: spec.key,
        model: spec.model,
        sourceCount,
        tableCount: null,
        ok: false,
        skipReason: "missing_prisma_model"
      });
      continue;
    }
    const tableCount = await delegate.count();
    checks.push({
      key: spec.key,
      model: spec.model,
      sourceCount,
      tableCount,
      ok: sourceCount === tableCount
    });
  }
  return {
    ok: checks.every((check) => check.ok),
    checks
  };
}

async function main() {
  if (process.argv.includes("--help")) {
    usage();
    return;
  }

  const dryRun = process.argv.includes("--dry-run");
  const verifyOnly = path.basename(process.argv[1] ?? "") === "verify-relational-state.mjs";
  const shouldVerify = verifyOnly || process.argv.includes("--verify");
  const { state, source } = await loadState();
  const plan = buildPlan(state);

  if (verifyOnly) {
    const verify = await verifyState(state);
    console.log(JSON.stringify({ ok: verify.ok, mode: "verify", source, counts: plan.counts, verify }, null, 2));
    if (!verify.ok) process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", source, ...plan }, null, 2));
    return;
  }

  const results = [];
  for (const spec of specs) {
    results.push(await importSpec(spec, state));
  }

  const output = {
    ok: true,
    mode: "import",
    source,
    counts: plan.counts,
    results
  };

  if (shouldVerify) {
    output.verify = await verifyState(state);
    output.ok = output.verify.ok;
  }

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
