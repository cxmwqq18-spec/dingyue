const argv = process.argv.slice(2);
const args = new Set(argv);
const target = argv.find((value) => value.startsWith("--target="))?.slice("--target=".length) ?? "local";
const storage = argv.find((value) => value.startsWith("--storage="))?.slice("--storage=".length) ?? "prisma";
const apply = args.has("--apply");

if (!["local", "test"].includes(target)) throw new Error("This migration only permits --target=local|test; production is intentionally blocked.");
if (storage !== "prisma") throw new Error("JSON storefront migration is retired; use --storage=prisma so PostgreSQL remains the only data source.");
if (apply && !args.has("--confirm=storefront-single-source")) throw new Error("--apply requires --confirm=storefront-single-source");

const clean = (value) => typeof value === "string" && value.trim() ? value.trim() : undefined;
const jsonValue = (value) => JSON.parse(JSON.stringify(value));

function migrateSeo(page, legacy, field, changes, conflicts) {
  const current = page[field]?.seo ?? {};
  const next = {
    ...current,
    ...(clean(current.title) ? {} : clean(legacy?.title) ? { title: legacy.title } : {}),
    ...(clean(current.description) ? {} : clean(legacy?.description) ? { description: legacy.description } : {}),
    ...(clean(current.keywords) ? {} : clean(legacy?.keywords) ? { keywords: legacy.keywords } : {}),
    ...(clean(current.canonicalPath) || clean(current.canonical) ? {} : clean(legacy?.canonicalPath) ? { canonicalPath: legacy.canonicalPath } : {}),
    ...(current.ogImage || legacy?.ogImage ? { ogImage: current.ogImage ?? legacy.ogImage } : {})
  };
  if (JSON.stringify(current) !== JSON.stringify(next)) {
    page[field] = { ...page[field], seo: next };
    changes.push({
      type: "page_seo",
      pageId: page.id,
      slug: page.slug,
      target: `ThemePage.${field}.seo`,
      source: `ThemeSettings.${field}.seo.pages`,
      value: next
    });
  }
  for (const key of ["title", "description", "keywords", "canonicalPath", "ogImage"]) {
    if (clean(current[key]) && clean(legacy?.[key]) && current[key] !== legacy[key]) {
      conflicts.push({ type: `seo_${key}`, pageId: page.id, field, kept: current[key], ignored: legacy[key] });
    }
  }
}

function migratedProductMetadata(product) {
  const metadata = product.metadata ?? {};
  const priceMetadata = product.prices?.find((price) => price.metadata)?.metadata ?? {};
  const features = typeof priceMetadata.featuresText === "string"
    ? priceMetadata.featuresText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : metadata.features;
  const capabilities = Object.fromEntries(
    ["generatedPhotos", "destinationCount", "deliveryDays", "revisions", "editingLabel"]
      .filter((key) => priceMetadata[key] !== undefined && priceMetadata[key] !== "")
      .map((key) => [key, priceMetadata[key]])
  );
  return {
    ...metadata,
    ...(!clean(metadata.summary) && clean(priceMetadata.planSubtitle) ? { summary: priceMetadata.planSubtitle } : {}),
    ...(!(metadata.features?.length) && features?.length ? { features } : {}),
    ...(Object.keys(capabilities).length ? { capabilities: { ...capabilities, ...(metadata.capabilities ?? {}) } } : {}),
    ...(!clean(metadata.badgeLabel) && clean(priceMetadata.badgeLabel) ? { badgeLabel: priceMetadata.badgeLabel } : {}),
    ...(!clean(metadata.buttonLabel) && clean(priceMetadata.buttonLabel) ? { buttonLabel: priceMetadata.buttonLabel } : {})
  };
}

function offerOnlyMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return metadata;
  const {
    planSubtitle: _planSubtitle,
    featuresText: _featuresText,
    generatedPhotos: _generatedPhotos,
    destinationCount: _destinationCount,
    deliveryDays: _deliveryDays,
    revisions: _revisions,
    editingLabel: _editingLabel,
    badgeLabel: _badgeLabel,
    buttonLabel: _buttonLabel,
    sidePanelEyebrow: _sidePanelEyebrow,
    sidePanelTitle: _sidePanelTitle,
    sidePanelBody: _sidePanelBody,
    sidePanelItemsText: _sidePanelItemsText,
    ...offerMetadata
  } = metadata;
  return offerMetadata;
}

function migrateGraph(input) {
  const source = structuredClone(input);
  const changes = [];
  const conflicts = [];
  const unresolved = [];
  const site = source.sites.find((item) => item.id === "site_dreamshoot" || /mydreamshoots/i.test(`${item.slug} ${item.name}`));
  if (!site) throw new Error("myDreamshoots site not found");

  const draftPageSeo = site.themeSettings?.draftJson?.seo?.pages ?? {};
  const publishedPageSeo = site.themeSettings?.publishedJson?.seo?.pages ?? {};
  for (const page of site.pages ?? []) {
    migrateSeo(page, draftPageSeo[page.id] ?? draftPageSeo[page.slug], "draftJson", changes, conflicts);
    migrateSeo(page, publishedPageSeo[page.id] ?? publishedPageSeo[page.slug], "publishedJson", changes, conflicts);
  }

  const footer = site.themeSettings?.draftJson?.globalSections?.footer?.settings ?? {};
  const existingProfile = site.storefrontProfile ?? {};
  const existingDraft = existingProfile.draftJson ?? { identity: {}, policyFacts: {} };
  const previousIdentity = existingDraft.identity ?? {};
  const candidateSameAs = ["instagramUrl", "facebookUrl", "threadsUrl", "pinterestUrl", "youtubeUrl", "xUrl", "twitterUrl", "tiktokUrl"]
    .map((key) => clean(footer[key]))
    .filter((value) => value?.startsWith("https://"));
  const profile = {
    identity: {
      ...previousIdentity,
      legalName: clean(previousIdentity.legalName),
      entityType: clean(previousIdentity.entityType),
      address: previousIdentity.address ?? (clean(footer.contactAddress)
        ? { line1: footer.contactAddress.trim(), city: "", region: "", postalCode: "", country: "US" }
        : undefined),
      supportEmail: clean(previousIdentity.supportEmail) ?? clean(footer.contactEmail),
      phone: clean(previousIdentity.phone) ?? clean(footer.contactPhone),
      sameAs: Array.from(new Set([...(previousIdentity.sameAs ?? []), ...candidateSameAs])).filter((value) => /^https:\/\//i.test(value))
    },
    policyFacts: { ...(existingDraft.policyFacts ?? {}) }
  };
  site.storefrontProfile = {
    id: existingProfile.id ?? `profile_${site.id}`,
    siteId: site.id,
    draftJson: profile,
    publishedJson: existingProfile.publishedJson ?? { identity: { sameAs: [] }, policyFacts: {} },
    draftMeta: existingProfile.draftMeta ?? { revision: 1, updatedAt: new Date().toISOString(), etag: "migration" }
  };
  changes.push({
    type: "storefront_profile",
    source: "ThemeSettings.footer candidate fields",
    target: "StorefrontProfile.draftJson",
    value: profile,
    unconfirmed: ["legalName", "entityType", "structuredAddress", "policyFacts"]
  });

  const siteProducts = source.products.filter((item) => item.siteId === site.id);
  for (const product of siteProducts) {
    const nextMetadata = migratedProductMetadata(product);
    if (JSON.stringify(nextMetadata) !== JSON.stringify(product.metadata ?? {})) {
      product.metadata = nextMetadata;
      changes.push({ type: "product_metadata", productId: product.id, source: "Price.metadata", target: "Product.metadata", value: nextMetadata });
    }
    for (const price of product.prices ?? []) {
      price.metadata = offerOnlyMetadata(price.metadata);
      const providerPriceId = /^price_[a-zA-Z0-9_]+$/.test(price.stripePriceId ?? "");
      const alreadyVerified = price.status === "active" && providerPriceId && Boolean(price.providerVerifiedAt && price.providerFingerprint);
      price.status = alreadyVerified ? "active" : "draft";
      price.effectiveFrom = alreadyVerified ? price.effectiveFrom : undefined;
      price.effectiveTo = alreadyVerified ? price.effectiveTo : undefined;
      price.providerVerifiedAt = alreadyVerified ? price.providerVerifiedAt : undefined;
      price.providerFingerprint = alreadyVerified ? price.providerFingerprint : undefined;
      changes.push({
        type: "price_lifecycle",
        priceId: price.id,
        source: alreadyVerified ? "existing verified lifecycle" : providerPriceId ? "unverified provider ID" : "manual provider placeholder",
        target: `Price.status=${price.status}`,
        publishable: alreadyVerified
      });
      if (!alreadyVerified) unresolved.push(`price.${price.id}.providerVerification`);
    }
  }

  const prices = siteProducts.flatMap((product) => product.prices ?? []);
  for (const order of (source.orders ?? []).filter((item) => item.siteId === site.id && !item.priceId)) {
    const candidates = prices.filter((price) =>
      price.interval === "one_time" &&
      price.amountCents === order.amountCents &&
      String(price.currency).toLowerCase() === String(order.currency).toLowerCase() &&
      price.creditsGranted === order.credits
    );
    if (candidates.length === 1) {
      order.priceId = candidates[0].id;
      changes.push({ type: "historical_order_price", orderId: order.id, source: "Order commercial facts", target: "Order.priceId", value: candidates[0].id });
    } else {
      unresolved.push(`order.${order.id}.priceId`);
      conflicts.push({ type: "historical_order_price", orderId: order.id, candidates: candidates.map((price) => price.id) });
    }
  }

  if (!profile.identity.legalName) unresolved.unshift("storefrontProfile.identity.legalName");
  if (!profile.identity.entityType) unresolved.push("storefrontProfile.identity.entityType");
  if (!profile.identity.address?.city || !profile.identity.address?.region || !profile.identity.address?.postalCode) unresolved.push("storefrontProfile.identity.address");
  for (const key of ["usesCustomerMediaForTraining", "sourceMediaRetentionDays", "refundReviewRequired", "refundWindowDays", "effectiveDate"]) {
    if (profile.policyFacts[key] === undefined || profile.policyFacts[key] === "") unresolved.push(`storefrontProfile.policyFacts.${key}`);
  }
  for (const key of ["reserve", "consume", "release"]) {
    if (!profile.policyFacts.creditLifecycle?.[key]) unresolved.push(`storefrontProfile.policyFacts.creditLifecycle.${key}`);
  }
  for (const key of ["transportClaimKey", "storageClaimKey"]) {
    if (!profile.policyFacts.security?.[key]) unresolved.push(`storefrontProfile.policyFacts.security.${key}`);
  }
  return { source, site, changes, conflicts, unresolved: Array.from(new Set(unresolved)) };
}

function databaseUrlForTarget() {
  return target === "test" ? process.env.STOREFRONT_TEST_DATABASE_URL : process.env.STOREFRONT_LOCAL_DATABASE_URL;
}

function assertNonProductionDatabaseUrl(rawUrl) {
  if (!rawUrl) throw new Error(`--storage=${storage} requires ${target === "test" ? "STOREFRONT_TEST_DATABASE_URL" : "STOREFRONT_LOCAL_DATABASE_URL"}`);
  const url = new URL(rawUrl);
  const databaseName = url.pathname.replace(/^\//, "").toLowerCase();
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (/prod|production/.test(databaseName)) throw new Error("Production-looking database names are blocked.");
  if (target === "local" && !localHost) throw new Error("The local target only permits a localhost database.");
  if (target === "test" && !localHost && !/test|staging|ci/.test(databaseName)) throw new Error("The test target requires a localhost or test/staging/ci database name.");
  return rawUrl;
}

async function migratePrisma(databaseUrl, shouldApply) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const row = await prisma.site.findFirst({
      where: { OR: [{ id: "site_dreamshoot" }, { slug: { contains: "mydreamshoots", mode: "insensitive" } }, { name: { contains: "mydreamshoots", mode: "insensitive" } }] },
      include: { pages: true, settings: true, storefrontProfile: true, products: { include: { prices: true } }, orders: true }
    });
    if (!row) throw new Error("myDreamshoots Prisma site not found");
    const graph = migrateGraph({
      sites: [{ ...row, themeSettings: { draftJson: row.settings?.draftJson ?? {}, publishedJson: row.settings?.publishedJson ?? {} }, pages: row.pages, storefrontProfile: row.storefrontProfile }],
      products: row.products,
      orders: row.orders
    });
    if (shouldApply) {
      await prisma.$transaction(async (tx) => {
        for (const page of graph.site.pages) {
          await tx.themePage.update({ where: { id: page.id }, data: { draftJson: jsonValue(page.draftJson), publishedJson: jsonValue(page.publishedJson) } });
        }
        await tx.storefrontProfile.upsert({
          where: { siteId: graph.site.id },
          create: { id: graph.site.storefrontProfile.id, siteId: graph.site.id, draftJson: jsonValue(graph.site.storefrontProfile.draftJson), publishedJson: jsonValue(graph.site.storefrontProfile.publishedJson), draftMeta: jsonValue(graph.site.storefrontProfile.draftMeta) },
          update: { draftJson: jsonValue(graph.site.storefrontProfile.draftJson), draftMeta: jsonValue(graph.site.storefrontProfile.draftMeta) }
        });
        for (const product of graph.source.products) {
          await tx.product.update({ where: { id: product.id }, data: { metadata: jsonValue(product.metadata ?? {}) } });
          for (const price of product.prices ?? []) {
            await tx.price.update({
              where: { id: price.id },
              data: {
                metadata: jsonValue(price.metadata ?? {}),
                status: price.status,
                effectiveFrom: price.effectiveFrom ? new Date(price.effectiveFrom) : null,
                effectiveTo: price.effectiveTo ? new Date(price.effectiveTo) : null,
                providerVerifiedAt: price.providerVerifiedAt ? new Date(price.providerVerifiedAt) : null,
                providerFingerprint: price.providerFingerprint ?? null
              }
            });
          }
        }
        for (const order of graph.source.orders ?? []) {
          if (order.priceId) await tx.order.update({ where: { id: order.id }, data: { priceId: order.priceId } });
        }
      }, { maxWait: 10000, timeout: 120000 });
    }
    return { status: shouldApply ? "applied" : "dry-run", siteId: graph.site.id, changes: graph.changes, conflicts: graph.conflicts, unresolved: graph.unresolved };
  } finally {
    await prisma.$disconnect();
  }
}

const wantsJson = false;
const wantsPrisma = true;
const databaseUrl = wantsPrisma && apply ? assertNonProductionDatabaseUrl(databaseUrlForTarget()) : databaseUrlForTarget();
const jsonMigration = undefined;
let prismaMigration;
if (wantsPrisma && databaseUrl) {
  try {
    assertNonProductionDatabaseUrl(databaseUrl);
    prismaMigration = await migratePrisma(databaseUrl, apply);
  } catch (error) {
    if (apply) throw error;
    prismaMigration = { status: "unavailable", error: error instanceof Error ? error.message : String(error) };
  }
} else if (wantsPrisma) {
  prismaMigration = { status: "not_configured", requiredEnvironment: target === "test" ? "STOREFRONT_TEST_DATABASE_URL" : "STOREFRONT_LOCAL_DATABASE_URL" };
}

const report = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  target,
  storage,
  json: jsonMigration ? { siteId: jsonMigration.site.id, changes: jsonMigration.changes, conflicts: jsonMigration.conflicts, unresolved: jsonMigration.unresolved } : undefined,
  prisma: prismaMigration,
  writes: apply
    ? [
        ...(prismaMigration?.status === "applied" ? [`prisma:${target}`] : [])
      ]
    : []
};
console.log(JSON.stringify(report, null, 2));
