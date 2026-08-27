#!/usr/bin/env node
import "./load-runtime-env.mjs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const sourceRoot = path.join(process.cwd(), "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolveFilename.call(this, resolved, ...args);
};

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const pagePath = "/ai-save-the-date/engagement";
const apply = process.argv.includes("--apply");
const sceneImageFilenames = [
  "ai-engagement-proposal-moment.jpg",
  "ai-engagement-save-the-date-planning.jpg",
  "ai-engagement-garden-portrait.jpg",
  "ai-engagement-sunset-beach-portrait.jpg",
  "ai-engagement-couple-city-walk.jpg",
  "ai-engagement-ring-closeup.jpg",
  "ai-engagement-beach-walk.jpg",
  "ai-engagement-video-shoot.jpg"
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const prisma = new PrismaClient();
const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");

try {
  const page = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: pagePath } } });
  if (!page) throw new Error(`Page not found: ${siteId}${pagePath}`);
  const pageJson = clone(page.publishedJson || page.draftJson || {});
  const manifest = Array.isArray(pageJson.mediaManifest) ? pageJson.mediaManifest : [];
  const byFilename = new Map(manifest.map((asset) => [asset.filename, asset]));
  const sectionId = pageJson.sectionsOrder?.find((id) => pageJson.sections?.[id]?.type === "editorial_scene_grid");
  const section = sectionId ? pageJson.sections[sectionId] : undefined;
  if (!section) throw new Error("Engagement scene grid section not found");
  const missing = sceneImageFilenames.filter((filename) => !byFilename.has(filename));
  if (missing.length) throw new Error(`Manifest is missing scene assets: ${missing.join(", ")}`);
  const before = section.blocks.filter((block) => block.settings?.imageUrl).length;
  section.blocks.forEach((block, index) => {
    if (index === 0) return;
    const asset = byFilename.get(sceneImageFilenames[index - 1]);
    block.settings = {
      ...block.settings,
      imageUrl: asset.src,
      imageAlt: asset.alt,
      imageWidth: asset.width,
      imageHeight: asset.height,
      imageLoading: asset.loading || "lazy",
      imageFetchPriority: asset.fetchPriority || "auto"
    };
  });
  const after = section.blocks.filter((block) => block.settings?.imageUrl).length;
  const report = { siteId, pagePath, sectionId, before, after, expected: sceneImageFilenames.length, apply };
  if (!apply) {
    console.log(JSON.stringify(report, null, 2));
    process.exit(0);
  }

  await prisma.themePage.update({
    where: { siteId_slug: { siteId, slug: pagePath } },
    data: { draftJson: pageJson }
  });
  const fresh = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      domains: true,
      pages: { orderBy: { slug: "asc" } },
      settings: true,
      storefrontProfile: true,
      mediaAssets: true,
      activePublication: { include: { publication: true } },
      publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 },
      connect: true
    }
  });
  if (!fresh) throw new Error(`Site not found after update: ${siteId}`);
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid" && process.env.MYDREAMSHOOTS_SNAPSHOT_DEBUG === "1") {
    console.error(JSON.stringify({
      standardMedia: snapshot.publishedStandardPageMedia.map((item) => ({ path: item.canonicalPath, status: item.status, pageId: item.pageId })),
      standardRoutes: snapshot.publishedRoutes.filter((item) => item.routeKind === "standard-content").map((item) => ({ path: item.canonicalPath, status: item.status }))
    }, null, 2));
  }
  if (integrity !== "valid" && process.env.ALLOW_PREEXISTING_SNAPSHOT_DRIFT !== "1") {
    throw new Error(`Publication snapshot is invalid: ${integrity}`);
  }
  if (integrity !== "valid") console.warn(`Publishing targeted media repair with pre-existing snapshot status: ${integrity}`);
  if (integrity !== "valid") {
    console.log(JSON.stringify({ ...report, persisted: true, published: false, reason: "existing_snapshot_integrity_gate" }, null, 2));
    process.exit(0);
  }
  console.log(JSON.stringify({
    ...report,
    mode: "draft-only",
    changedPageIds: [page.id],
    candidateSnapshotHash: snapshot.snapshotHash,
    publicationRequired: true
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
