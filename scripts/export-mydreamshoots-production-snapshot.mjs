#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = process.env.MYDREAMSHOOTS_EXPORT_SITE_ID?.trim() || "site_dreamshoot";
const args = new Map(process.argv.slice(2).filter((arg) => arg.startsWith("--")).map((arg) => {
  const [key, ...rest] = arg.slice(2).split("=");
  return [key, rest.join("=") || "true"];
}));
const remoteUrl = process.env.REMOTE_DB_READONLY_DATABASE_URL?.trim();
if (!remoteUrl) throw new Error("REMOTE_DB_READONLY_DATABASE_URL is required; refusing to inspect production without an explicit read-only DSN.");
if (process.env.DATABASE_TARGET !== "remote-readonly" || process.env.DINGYUE_ENV !== "remote-readonly") {
  throw new Error("Set DATABASE_TARGET=remote-readonly and DINGYUE_ENV=remote-readonly for a production snapshot export.");
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

const secretKey = /api.?key|secret|password|authorization|access.?token|private.?key/i;
function sanitize(value, key = "") {
  if (secretKey.test(key)) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitize(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    const next = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const safe = sanitize(childValue, childKey);
      if (safe !== undefined) next[childKey] = safe;
    }
    return next;
  }
  return value;
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

const outPath = path.resolve(args.get("out") || path.join("releases", "remote-snapshots", `mydreamshoots-${new Date().toISOString().replace(/[:.]/g, "-")}.json`));
const prisma = new PrismaClient({ datasources: { db: { url: remoteUrl } } });
try {
  const [site, products, packs, packCategories, videoThemes, videoCategories, mediaAssets] = await Promise.all([
    prisma.site.findUnique({
      where: { id: siteId },
      include: {
        domains: true,
        pages: { orderBy: { slug: "asc" } },
        settings: true,
        storefrontProfile: true,
        activePublication: { include: { publication: true } }
      }
    }),
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } }),
    prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true }, orderBy: { id: "asc" } }),
    prisma.creativePackCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId }, include: { category: true }, orderBy: { slug: "asc" } }),
    prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.mediaAsset.findMany({ where: { siteId, usageType: { in: ["theme", "package", "sample", "legacy"] } }, orderBy: { storageKey: "asc" } })
  ]);
  if (!site) throw new Error(`site ${siteId} was not found in the read-only database`);
  const snapshot = sanitize({
    formatVersion: 1,
    source: {
      siteId,
      exportedAt: new Date().toISOString(),
      publicationId: site.activePublication?.publication?.id ?? null,
      publicationVersion: site.activePublication?.publication?.version ?? null,
      publicationPublishedAt: site.activePublication?.publication?.publishedAt ?? null,
      publicationSnapshotHash: site.activePublication?.publication?.snapshot?.snapshotHash ?? null
    },
    site,
    products,
    creativePacks: packs,
    creativePackCategories: packCategories,
    videoThemes,
    videoThemeCategories: videoCategories,
    mediaAssets
  });
  const payload = { ...snapshot, snapshotHash: hash(snapshot) };
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({
    ok: true,
    mode: "read-only-production-export",
    outPath,
    snapshotHash: payload.snapshotHash,
    source: payload.source,
    counts: {
      pages: site.pages.length,
      products: products.length,
      prices: products.reduce((sum, product) => sum + product.prices.length, 0),
      creativePacks: packs.length,
      creativePackCategories: packCategories.length,
      videoThemes: videoThemes.length,
      videoThemeCategories: videoCategories.length,
      mediaAssets: mediaAssets.length
    }
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
