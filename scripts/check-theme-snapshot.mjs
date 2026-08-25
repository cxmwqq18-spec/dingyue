#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
const originalResolveFilename = Module._resolveFilename;

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
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const prisma = new PrismaClient();

try {
  const raw = await prisma.site.findUnique({
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
  if (!raw?.activePublication?.publication) throw new Error("active_publication_required");

  const active = raw.activePublication.publication;
  const integrity = publicationSnapshotIntegrity(active.snapshot);
  const snapshot = active.snapshot;
  const pages = new Map(snapshot.publishedPageEntities.map((entity) => [entity.pageEntityId, entity]));
  const badEntities = snapshot.publishedPageEntities
    .filter((entity) => !entity.content.relatedLinkEntityIds?.length || entity.content.relatedLinkEntityIds.length < 2)
    .map((entity) => ({ id: entity.pageEntityId, path: entity.canonicalPath, related: entity.content.relatedLinkEntityIds }));
  const badLinks = snapshot.publishedLinkRefs.filter((link) => {
    const owner = pages.get(link.ownerPageEntityId);
    const target = link.targetType === "published_render" ? pages.get(link.targetPageEntityId) : undefined;
    return !owner ||
      (link.kind === "cta" && owner.content.ctaLinkEntityId !== link.linkEntityId) ||
      (link.kind === "related" && !owner.content.relatedLinkEntityIds.includes(link.linkEntityId)) ||
      (link.targetType === "published_render"
        ? target?.canonicalPath !== link.href || target.status !== "published" || !target.indexable || !target.sitemapEligible
        : !(link.kind === "cta" && /^\/app\/create(?:[/?]|$)/.test(link.href)));
  });

  console.log(JSON.stringify({
    integrity,
    activePublication: {
      id: active.id,
      version: active.version,
      snapshotHash: active.snapshot.snapshotHash,
      buildId: active.snapshot.buildId
    },
    historicalLatestVersion: raw.publications?.[0]?.version ?? null,
    badEntities,
    badLinks: badLinks.slice(0, 20),
    standardMedia: snapshot.publishedStandardPageMedia.map((item) => ({ path: item.canonicalPath, status: item.status }))
  }, null, 2));
} finally {
  await prisma.$disconnect();
  Module._load = originalLoad;
  Module._resolveFilename = originalResolveFilename;
}
