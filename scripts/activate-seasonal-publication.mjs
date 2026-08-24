#!/usr/bin/env node
import "./load-runtime-env.mjs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";
import { buildTunneledDatabaseUrl, assertDatabaseTarget } from "./lib/database-target.mjs";

if (process.env.DATABASE_TARGET !== "production" || process.env.DINGYUE_ENV !== "production" || process.env.CONFIRM_SEASONAL_PUBLICATION !== "1") throw new Error("Set production target and CONFIRM_SEASONAL_PUBLICATION=1 to activate a publication snapshot.");
const siteId = "site_dreamshoot";
const repoRoot = process.cwd();
process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { port: 15433 });
assertDatabaseTarget({ expectedTarget: "production", env: process.env, requireProductionConfirmation: true, productionConfirmed: true });
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...args) { if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts"); const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request; const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased; return originalResolve.call(this, resolved, ...args); };
const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
try {
  const record = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  if (!record) throw new Error(`Site not found: ${siteId}`);
  const site = toSite(record);
  const [packs, products] = await Promise.all([prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } }), prisma.product.findMany({ where: { siteId }, include: { prices: true } })]);
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") {
    throw new Error(`Publication snapshot invalid: ${integrity}`);
  }
  const pageIds = record.pages.filter((page) => ["/holidays-events/mothers-day", "/holidays-events/fathers-day"].includes(page.slug)).map((page) => page.id);
  const published = await publishSeoSnapshotRelational({ siteId, snapshot, actor: "seasonal-remediation-release", scope: { type: "site", pageIds, includeThemeSettings: true, includeStorefrontProfile: false } });
  console.log(JSON.stringify({ ok: true, siteId, snapshotHash: snapshot.snapshotHash, pageIds, publicationId: published?.publication?.id || published?.id || null }, null, 2));
} finally { await prisma.$disconnect(); }
