#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const syncVideo = process.argv.includes("--sync-video");
const snapshotPath = process.argv.find((value) => value.startsWith("--snapshot="))?.slice("--snapshot=".length)
  || "releases/remote-snapshots/mydreamshoots-production-2026-08-22.json";
const resolvedSnapshotPath = path.resolve(snapshotPath);
if (!fs.existsSync(resolvedSnapshotPath)) throw new Error(`production snapshot not found: ${resolvedSnapshotPath}`);

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const parsed = new URL(databaseUrl);
assert(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
assert(parsed.port === "15433", `production snapshot sync must use local port 15433 (received ${parsed.port})`);

const snapshot = JSON.parse(fs.readFileSync(resolvedSnapshotPath, "utf8"));
assert.equal(snapshot.source?.siteId, siteId, "snapshot site does not match MyDreamShoots");
assert.equal(snapshot.source?.publicationVersion, 6, "unexpected production publication version; export a fresh snapshot and pass it explicitly");

const repoRoot = process.cwd();
const backupDir = path.join(repoRoot, "releases", "backups");
const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotHash, publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]));
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function projectionRevision(value) {
  return digest(value).slice(0, 20);
}

function date(value) {
  return value ? new Date(value) : undefined;
}

function omitUndefined(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

function backupShape(site, products, packs, packCategories, videos, videoCategories, mediaAssets) {
  return {
    createdAt: new Date().toISOString(),
    sourceSnapshot: {
      path: resolvedSnapshotPath,
      hash: snapshot.snapshotHash,
      publicationId: snapshot.source.publicationId,
      publicationVersion: snapshot.source.publicationVersion
    },
    site: {
      id: site.id,
      settings: site.settings,
      storefrontProfile: site.storefrontProfile,
      pages: site.pages,
      activePublication: site.activePublication
    },
    products,
    creativePacks: packs,
    creativePackCategories: packCategories,
    videoThemes: videos,
    videoThemeCategories: videoCategories,
    mediaAssets
  };
}

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      activePublication: { include: { publication: true } }
    }
  });
  assert(site?.settings, "local site and settings are required");
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } });
  const localProductById = new Map(products.map((product) => [product.id, product]));
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true }, orderBy: { id: "asc" } });
  const packCategories = await prisma.creativePackCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } });
  const videos = await prisma.videoTheme.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
  const videoCategories = await prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] });
  const mediaAssets = await prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { storageKey: "asc" } });
  const backup = backupShape(site, products, packs, packCategories, videos, videoCategories, mediaAssets);
  const backupPath = path.join(backupDir, `mydreamshoots-production-sync-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  const sourcePages = Array.isArray(snapshot.site.pages) ? snapshot.site.pages : [];
  const sourcePageSlugs = new Set(sourcePages.map((page) => page.slug));
  const sourcePackIds = new Set((snapshot.creativePacks ?? []).map((pack) => pack.id));
  const sourceVideoIds = new Set((snapshot.videoThemes ?? []).map((theme) => theme.id));
  const sourceCounts = {
    pages: sourcePages.length,
    products: snapshot.products?.length ?? 0,
    prices: (snapshot.products ?? []).reduce((sum, product) => sum + (product.prices?.length ?? 0), 0),
    creativePacks: snapshot.creativePacks?.length ?? 0,
    creativePackCategories: snapshot.creativePackCategories?.length ?? 0,
    videoThemes: snapshot.videoThemes?.length ?? 0,
    videoThemeCategories: snapshot.videoThemeCategories?.length ?? 0,
    mediaAssets: snapshot.mediaAssets?.length ?? 0
  };
  const localCounts = {
    pages: site.pages.length,
    products: products.length,
    prices: products.reduce((sum, product) => sum + product.prices.length, 0),
    creativePacks: packs.length,
    creativePackCategories: packCategories.length,
    videoThemes: videos.length,
    videoThemeCategories: videoCategories.length,
    mediaAssets: mediaAssets.length
  };
  const diff = {
    pageSlugsToUpdate: sourcePages.filter((page) => site.pages.some((local) => local.slug === page.slug)).length,
    productionOnlyPages: sourcePages.filter((page) => !site.pages.some((local) => local.slug === page.slug)).map((page) => page.slug),
    localOnlyPacksToArchive: packs.filter((pack) => pack.status === "active" && pack.aiAppSlug === "image_generator" && !sourcePackIds.has(pack.id)).map((pack) => pack.id),
    productionOnlyPacks: (snapshot.creativePacks ?? []).filter((pack) => !packs.some((local) => local.id === pack.id)).map((pack) => pack.id),
    localVideoRowsPreserved: syncVideo ? 0 : videos.filter((video) => !sourceVideoIds.has(video.id)).map((video) => video.slug)
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", snapshot: snapshot.source, sourceCounts, localCounts, diff, wouldWriteBackup: backupPath }, null, 2));
  } else {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });

    await prisma.$transaction(async (tx) => {
      const localPages = await tx.themePage.findMany({ where: { siteId }, select: { id: true, slug: true, publishedJson: true } });
      const localPageBySlug = new Map(localPages.map((page) => [page.slug, page]));
      for (const page of sourcePages) {
        const current = localPageBySlug.get(page.slug);
        let publishedJson = page.publishedJson;
        // The production publication is the source of truth for the public
        // showcase, copy, pricing and footer. The local video topic pages are
        // newer product work, so keep their relational page JSON intact while
        // still syncing the surrounding production content.
        if (current && (page.slug === "/ai-video-generation" || page.slug.startsWith("/ai-video-generation/"))) {
          publishedJson = current.publishedJson;
        }
        if (page.slug === "/best-ai-video" && publishedJson && typeof publishedJson === "object") {
          const localSection = current?.publishedJson?.sections?.best_ai_video_1;
          const sourceSection = publishedJson.sections?.best_ai_video_1;
          if (sourceSection && typeof sourceSection === "object") {
            const localVideoSlugs = String(localSection?.settings?.videoSlugs ?? "").split("|").filter(Boolean);
            const productionVideoSlugs = (snapshot.videoThemes ?? [])
              .filter((theme) => (theme.galleryImages ?? []).some((url) => /\.(?:mp4|webm)(?:\?|#|$)/i.test(url)))
              .map((theme) => theme.slug);
            const videoSlugs = localVideoSlugs.length ? localVideoSlugs : productionVideoSlugs;
            publishedJson = {
              ...publishedJson,
              sections: {
                ...publishedJson.sections,
                best_ai_video_1: {
                  ...sourceSection,
                  settings: {
                    ...sourceSection.settings,
                    kind: "video",
                    title: "Best Video Generator",
                    videoSlugs: videoSlugs.join("|"),
                    imageSlugs: "",
                    fullGallery: false
                  }
                }
              }
            };
          }
        }
        const data = {
          siteId,
          pageType: page.pageType,
          templateKey: page.templateKey ?? null,
          slug: page.slug,
          title: page.title,
          draftJson: page.draftJson ?? publishedJson,
          publishedJson,
          draftMeta: page.draftMeta ?? null,
          updatedAt: date(page.updatedAt) ?? new Date()
        };
        if (current) await tx.themePage.update({ where: { id: current.id }, data });
        else await tx.themePage.create({ data: { id: page.id, ...data, createdAt: date(page.createdAt) ?? new Date() } });
      }

      const settings = snapshot.site.settings;
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson: settings.draftJson, publishedJson: settings.publishedJson, updatedAt: new Date() } });
      if (snapshot.site.storefrontProfile) {
        const profile = snapshot.site.storefrontProfile;
        await tx.storefrontProfile.upsert({
          where: { siteId },
          create: { id: profile.id, siteId, draftJson: profile.draftJson, publishedJson: profile.publishedJson, draftMeta: profile.draftMeta ?? null, createdAt: date(profile.createdAt) ?? new Date(), updatedAt: date(profile.updatedAt) ?? new Date() },
          update: { draftJson: profile.draftJson, publishedJson: profile.publishedJson, draftMeta: profile.draftMeta ?? null, updatedAt: new Date() }
        });
      }

      for (const product of snapshot.products ?? []) {
        const localProduct = localProductById.get(product.id);
        await tx.product.upsert({
          where: { id: product.id },
          create: { id: product.id, siteId, name: product.name, type: product.type, status: product.status, metadata: product.metadata ?? null, createdAt: date(product.createdAt) ?? new Date(), updatedAt: date(product.updatedAt) ?? new Date() },
          // Production's older publication does not carry the local subscription
          // presentation metadata. Keep the verified local copy when production
          // sends null so the pricing cards do not lose their feature lists.
          update: { name: product.name, type: product.type, status: product.status, metadata: product.metadata ?? localProduct?.metadata ?? null, updatedAt: new Date() }
        });
        for (const price of product.prices ?? []) {
          const localPrice = localProduct?.prices.find((candidate) => candidate.id === price.id);
          const preserveVerifiedCheckout = Boolean(
            localPrice?.status === "active" &&
            localPrice.providerVerifiedAt &&
            localPrice.providerFingerprint &&
            /^price_[A-Za-z0-9_]+$/.test(localPrice.stripePriceId ?? "")
          );
          const checkoutFields = preserveVerifiedCheckout
            ? {
                stripePriceId: localPrice.stripePriceId,
                status: localPrice.status,
                effectiveFrom: localPrice.effectiveFrom,
                effectiveTo: localPrice.effectiveTo,
                replacesPriceId: localPrice.replacesPriceId,
                providerVerifiedAt: localPrice.providerVerifiedAt,
                providerFingerprint: localPrice.providerFingerprint
              }
            : {
                stripePriceId: price.stripePriceId ?? null,
                status: price.status,
                effectiveFrom: date(price.effectiveFrom),
                effectiveTo: date(price.effectiveTo),
                replacesPriceId: price.replacesPriceId ?? null,
                providerVerifiedAt: date(price.providerVerifiedAt),
                providerFingerprint: price.providerFingerprint ?? null
              };
          const priceMetadata = price.metadata ?? localPrice?.metadata ?? null;
          await tx.price.upsert({
            where: { id: price.id },
            create: omitUndefined({ id: price.id, siteId, productId: product.id, label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: priceMetadata, ...checkoutFields, createdAt: date(price.createdAt) ?? new Date(), updatedAt: date(price.updatedAt) ?? new Date() }),
            // Amount/interval/credits are the public production baseline. Stripe
            // identity and provider verification stay local when already valid,
            // because the read-only production export intentionally has no secrets
            // or checkout-provider state.
            update: omitUndefined({ label: price.label, amountCents: price.amountCents, currency: price.currency, interval: price.interval, creditsGranted: price.creditsGranted, metadata: priceMetadata, ...checkoutFields, updatedAt: new Date() })
          });
        }
      }

      // Keep local-only photo packs recoverable but out of the active storefront;
      // the local video taxonomy remains untouched unless --sync-video is passed.
      await tx.creativePack.updateMany({ where: { siteId, status: "active", aiAppSlug: "image_generator", id: { notIn: [...sourcePackIds] } }, data: { status: "archived", updatedAt: new Date() } });
      for (const category of snapshot.creativePackCategories ?? []) {
        await tx.creativePackCategory.upsert({
          where: { siteId_slug: { siteId, slug: category.slug } },
          create: { id: category.id, siteId, parentId: null, slug: category.slug, label: category.label, description: category.description ?? null, heroTitle: category.heroTitle ?? null, heroSubtitle: category.heroSubtitle ?? null, icon: category.icon ?? null, imageUrl: category.imageUrl ?? null, sortOrder: category.sortOrder, status: category.status, createdAt: date(category.createdAt) ?? new Date(), updatedAt: date(category.updatedAt) ?? new Date() },
          update: { label: category.label, description: category.description ?? null, heroTitle: category.heroTitle ?? null, heroSubtitle: category.heroSubtitle ?? null, icon: category.icon ?? null, imageUrl: category.imageUrl ?? null, sortOrder: category.sortOrder, status: category.status, updatedAt: new Date() }
        });
      }
      for (const category of snapshot.creativePackCategories ?? []) {
        await tx.creativePackCategory.update({ where: { siteId_slug: { siteId, slug: category.slug } }, data: { parentId: category.parentId ?? null } });
      }
      const localPackCategories = await tx.creativePackCategory.findMany({ where: { siteId }, select: { id: true, slug: true } });
      const localPackCategoryIds = new Map(localPackCategories.map((category) => [category.slug, category.id]));
      for (const pack of snapshot.creativePacks ?? []) {
        const categorySlug = pack.categoryRecord?.slug ?? (snapshot.creativePackCategories ?? []).find((category) => category.id === pack.categoryId)?.slug;
        const categoryId = categorySlug ? localPackCategoryIds.get(categorySlug) : null;
        await tx.creativePack.upsert({
          where: { id: pack.id },
          create: { id: pack.id, siteId, categoryId, name: pack.name, headline: pack.headline, description: pack.description, prompt: pack.prompt ?? null, category: pack.category, aiAppSlug: pack.aiAppSlug, status: pack.status, creditCost: pack.creditCost, outputCount: pack.outputCount, trainingRequired: pack.trainingRequired, generationCount: pack.generationCount, conversionRate: pack.conversionRate, imageUrl: pack.imageUrl ?? null, galleryImages: pack.galleryImages ?? null, galleryImageAlts: pack.galleryImageAlts ?? null, createdAt: date(pack.createdAt) ?? new Date(), updatedAt: date(pack.updatedAt) ?? new Date() },
          update: { categoryId, name: pack.name, headline: pack.headline, description: pack.description, prompt: pack.prompt ?? null, category: pack.category, aiAppSlug: pack.aiAppSlug, status: pack.status, creditCost: pack.creditCost, outputCount: pack.outputCount, trainingRequired: pack.trainingRequired, generationCount: pack.generationCount, conversionRate: pack.conversionRate, imageUrl: pack.imageUrl ?? null, galleryImages: pack.galleryImages ?? null, galleryImageAlts: pack.galleryImageAlts ?? null, updatedAt: new Date() }
        });
      }

      if (syncVideo) {
        for (const category of snapshot.videoThemeCategories ?? []) {
          await tx.videoThemeCategory.upsert({ where: { siteId_slug: { siteId, slug: category.slug } }, create: { id: category.id, siteId, parentId: null, slug: category.slug, label: category.label, description: category.description ?? null, icon: category.icon ?? null, accentColor: category.accentColor ?? null, imageUrl: category.imageUrl ?? null, sortOrder: category.sortOrder, status: category.status, createdAt: date(category.createdAt) ?? new Date(), updatedAt: date(category.updatedAt) ?? new Date() }, update: { label: category.label, description: category.description ?? null, icon: category.icon ?? null, accentColor: category.accentColor ?? null, imageUrl: category.imageUrl ?? null, sortOrder: category.sortOrder, status: category.status, updatedAt: new Date() } });
        }
        for (const category of snapshot.videoThemeCategories ?? []) await tx.videoThemeCategory.update({ where: { siteId_slug: { siteId, slug: category.slug } }, data: { parentId: category.parentId ?? null } });
        const localVideoCategories = await tx.videoThemeCategory.findMany({ where: { siteId }, select: { id: true, slug: true } });
        const localVideoCategoryIds = new Map(localVideoCategories.map((category) => [category.slug, category.id]));
        for (const theme of snapshot.videoThemes ?? []) {
          const categorySlug = theme.category?.slug ?? (snapshot.videoThemeCategories ?? []).find((category) => category.id === theme.categoryId)?.slug;
          const categoryId = categorySlug ? localVideoCategoryIds.get(categorySlug) : null;
          await tx.videoTheme.upsert({ where: { id: theme.id }, create: { id: theme.id, siteId, categoryId, slug: theme.slug, name: theme.name, headline: theme.headline, description: theme.description, prompt: theme.prompt, status: theme.status, creditCost: theme.creditCost, modelPricing: theme.modelPricing ?? null, durationSeconds: theme.durationSeconds, maxFrames: theme.maxFrames, generationCount: theme.generationCount, sortOrder: theme.sortOrder, imageUrl: theme.imageUrl ?? null, galleryImages: theme.galleryImages ?? null, createdAt: date(theme.createdAt) ?? new Date(), updatedAt: date(theme.updatedAt) ?? new Date() }, update: { categoryId, name: theme.name, headline: theme.headline, description: theme.description, prompt: theme.prompt, status: theme.status, creditCost: theme.creditCost, modelPricing: theme.modelPricing ?? null, durationSeconds: theme.durationSeconds, maxFrames: theme.maxFrames, generationCount: theme.generationCount, sortOrder: theme.sortOrder, imageUrl: theme.imageUrl ?? null, galleryImages: theme.galleryImages ?? null, updatedAt: new Date() } });
        }
      }
      for (const asset of snapshot.mediaAssets ?? []) await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: asset.storageKey } }, create: { id: asset.id, siteId, label: asset.label, storageKey: asset.storageKey, mimeType: asset.mimeType, usageType: asset.usageType, sourceType: asset.sourceType ?? null, previewUrl: asset.previewUrl ?? null, originUrl: asset.originUrl ?? null, altText: asset.altText ?? null, notes: asset.notes ?? null, createdAt: date(asset.createdAt) ?? new Date(), updatedAt: date(asset.updatedAt) ?? new Date() }, update: { label: asset.label, mimeType: asset.mimeType, usageType: asset.usageType, sourceType: asset.sourceType ?? null, previewUrl: asset.previewUrl ?? null, originUrl: asset.originUrl ?? null, altText: asset.altText ?? null, notes: asset.notes ?? null, updatedAt: new Date() } });
    }, { timeout: 120_000, maxWait: 20_000 });

    const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, activePublication: { include: { publication: true } }, products: { include: { prices: true } } } });
    assert(fresh?.activePublication?.publication, "local active publication readback failed");
    const currentSnapshot = clone(fresh.activePublication.publication.snapshot);
    assert.equal(publicationSnapshotIntegrity(currentSnapshot), "valid", "local active publication must be valid before import");
    const sourcePageBySlug = new Map(sourcePages.map((page) => [page.slug, page]));
    currentSnapshot.pages = currentSnapshot.pages.map((page) => {
      const source = sourcePageBySlug.get(page.slug);
      return source ? { ...page, title: source.title, templateKey: source.templateKey ?? page.templateKey, publishedJson: clone(source.publishedJson) } : page;
    });
    currentSnapshot.themeSettings = clone(snapshot.site.settings.publishedJson);
    currentSnapshot.storefrontProfile = snapshot.site.storefrontProfile?.publishedJson ? clone(snapshot.site.storefrontProfile.publishedJson) : currentSnapshot.storefrontProfile;
    const productsById = new Map(fresh.products.map((product) => [product.id, product]));
    currentSnapshot.publishedOffers = (currentSnapshot.publishedOffers ?? []).map((offer) => {
      const product = productsById.get(offer.productId);
      const price = product?.prices.find((candidate) => candidate.id === offer.priceId);
      return product && price ? { ...offer, productMetadata: clone(product.metadata), priceMetadata: clone(price.metadata), amountCents: price.amountCents, creditsGranted: price.creditsGranted, priceLabel: price.label, interval: price.interval } : offer;
    });
    currentSnapshot.revisions = { ...currentSnapshot.revisions, offerRevision: projectionRevision(currentSnapshot.publishedOffers) };
    currentSnapshot.snapshotHash = "";
    currentSnapshot.revisions = { ...currentSnapshot.revisions, snapshotHash: "" };
    currentSnapshot.snapshotHash = publicationSnapshotHash(currentSnapshot);
    currentSnapshot.revisions.snapshotHash = currentSnapshot.snapshotHash;
    assert.equal(publicationSnapshotIntegrity(currentSnapshot), "valid", "imported publication must be valid");
    const published = await publishSeoSnapshotRelational({ siteId, snapshot: currentSnapshot, actor: "sync:mydreamshoots-production-snapshot" });
    const readback = await prisma.themePublication.findUnique({ where: { id: published.publication.id }, select: { id: true, version: true, snapshot: true } });
    console.log(JSON.stringify({ ok: true, mode: "applied", source: snapshot.source, sourceSnapshotHash: snapshot.snapshotHash, backupPath, publicationId: readback?.id, version: readback?.version, localSnapshotHash: readback?.snapshot?.snapshotHash, sourceCounts, localCounts, diff, syncVideo }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
