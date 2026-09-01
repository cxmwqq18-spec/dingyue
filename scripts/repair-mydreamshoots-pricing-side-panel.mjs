#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import Module from "node:module";
import path from "node:path";
import { extname } from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
const siteId = target === "test" ? "site_grownstride_test" : target === "local" || target === "production" ? "site_dreamshoot" : "";
const apply = hasArgument("--apply");
const mode = argumentValue("--mode") || "restore";
if (!["local", "test", "production"].includes(target)) throw new Error("--target=local|test|production is required");
if (!["restore", "clear"].includes(mode)) throw new Error("--mode=restore|clear is required");
if (target === "production" && !hasArgument("--confirm-production")) throw new Error("Production repair requires --confirm-production");
if (apply && !hasArgument("--confirm=repair-mydreamshoots-pricing-side-panel")) throw new Error("--apply requires an explicit confirmation phrase");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed: hasArgument("--confirm-production") });

const restoredSidePanelItems = [
  ["Private photo albums", "Create and keep finished photo sets in your private account gallery."],
  ["AI photo editor with prompts", "Refine approved images with guided prompt-based edits before delivery."],
  ["Special AI photo filters", "Apply supported styles and filters to build a consistent photo set."],
  ["Prompt-based photo creation", "Start a new image direction from a short prompt in seconds."],
  ["AI video generation", "Turn supported photos and prompts into short motion results."],
  ["Magic Upscaler", "Upscale approved images when you need a larger, sharper export."],
  ["No watermark", "Download finished results without a platform watermark."],
  ["4K Ultra-High quality outputs", "Premium exports support higher-resolution delivery where available."]
];
const sidePanelItems = mode === "clear" ? [] : restoredSidePanelItems;

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
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
  const aliasedRequest = request.startsWith("@/") ? resolved : request;
  const resolvedRequest = request.startsWith("@/") && !extname(aliasedRequest) ? `${aliasedRequest}.ts` : aliasedRequest;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { buildPublicationSnapshot, prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { mapProduct, toSite } = jiti("../src/lib/stores/prisma-mappers.ts");

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

async function readSite() {
  return prisma.site.findUnique({
    where: { id: siteId },
    include: {
      pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true,
      siteThemes: { orderBy: [{ status: "asc" }, { updatedAt: "desc" }] }, themeCopies: { orderBy: { updatedAt: "desc" } },
      creativePackCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] },
      creativePacks: { include: { categoryRecord: true }, orderBy: { createdAt: "asc" } }, mediaAssets: { orderBy: { storageKey: "asc" } },
      toolCategories: { orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { slug: "asc" }] }, toolMenuItems: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      videoThemeCategories: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] }, videoThemes: { orderBy: [{ sortOrder: "asc" }, { slug: "asc" }] },
      products: { include: { prices: true }, orderBy: { name: "asc" } }
    }
  });
}

try {
  const before = await readSite();
  assert(before, `site ${siteId} not found`);
  const subscriptions = before.products.filter((product) => product.type === "subscription");
  assert.equal(subscriptions.length, 3, "expected exactly three subscription products");
  const needsUpdate = subscriptions.filter((product) => mode === "clear"
    ? JSON.stringify(product.metadata?.features ?? null) !== "[]" || JSON.stringify(product.metadata?.sidePanelItems ?? null) !== "[]"
    : JSON.stringify(product.metadata?.sidePanelItems ?? null) !== JSON.stringify(sidePanelItems));
  console.log(JSON.stringify({ target, siteId, operation: mode, mode: apply ? "apply" : "dry-run", affectedProducts: needsUpdate.map((product) => product.name), featureCount: mode === "clear" ? 0 : undefined, sidePanelItemCount: sidePanelItems.length }, null, 2));
  if (!apply || !needsUpdate.length) {
    // Dry-run and already-repaired environments need no write or publication.
  } else {
    await prisma.$transaction(async (tx) => {
    for (const product of needsUpdate) {
      await tx.product.update({
        where: { id: product.id },
        data: {
          metadata: {
            ...(product.metadata ?? {}),
            ...(mode === "clear" ? { features: [], sidePanelItems: [] } : { sidePanelItems: clone(sidePanelItems) })
          }
        }
      });
    }
    }, { timeout: 30_000 });

    const fresh = await readSite();
    assert(fresh, "site readback failed");
    const targetSite = toSite(fresh);
    const normalizedPacks = fresh.creativePacks.map((pack) => ({
    id: pack.id, status: ["active", "draft", "paused"].includes(pack.status) ? pack.status : "draft",
    creditCost: Number(pack.creditCost ?? 0), outputCount: Number(pack.outputCount ?? 0),
    category: pack.category ?? undefined, categoryRecord: pack.categoryRecord?.slug ? { slug: pack.categoryRecord.slug } : null,
    imageUrl: typeof pack.imageUrl === "string" ? pack.imageUrl : undefined,
    galleryImages: Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((value) => typeof value === "string") : [],
    galleryImageAlts: Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts.filter((value) => typeof value === "string") : []
    }));
    const snapshot = buildPublicationSnapshot(targetSite, undefined, normalizedPacks, fresh.products.map(mapProduct));
    const manifest = await prepareDraftPublishManifestRelational(siteId);
    console.log(JSON.stringify({ ok: true, mode: "draft-only", manifestHash: manifest.manifestHash, publicationRequired: true }, null, 2));
  }
} finally {
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
