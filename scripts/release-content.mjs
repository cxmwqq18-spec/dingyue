#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  hasArgument
} from "./lib/database-target.mjs";

const repoRoot = process.cwd();
const mode = argumentValue("--mode");
const defaultSiteId = argumentValue("--site-id") || process.env.RELEASE_SITE_ID || "site_dreamshoot";
const manifestPathArgument = argumentValue("--manifest");
const manifestRoot = path.join(repoRoot, "releases", "manifests");
const backupRoot = path.join(repoRoot, "releases", "backups");
const supportedTables = [
  "toolCategories",
  "toolMenuItems",
  "creativePackCategories",
  "creativePacks",
  "videoThemeCategories",
  "videoThemes",
  "themePages",
  "themeSettings",
  "siteThemes",
  "themePublications",
  "mediaAssets",
  "products",
  "prices"
];
const replaceTables = new Set(["toolCategories", "toolMenuItems", "videoThemeCategories", "videoThemes"]);
const protectedSpecs = [
  { key: "customers", model: "customer", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "customerSessions", model: "customerSession", fields: { id: true, createdAt: true, expiresAt: true } },
  { key: "subscriptions", model: "subscription", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "orders", model: "order", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "paymentEvents", model: "paymentEvent", fields: { id: true, processedAt: true } },
  { key: "creditBalances", model: "creditBalance", fields: { id: true, updatedAt: true } },
  { key: "creditLedger", model: "creditLedger", fields: { id: true, createdAt: true } },
  { key: "generationJobs", model: "generationJob", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "customerModels", model: "customerModel", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "assetUploads", model: "assetUpload", fields: { id: true, createdAt: true, updatedAt: true } },
  { key: "albums", model: "album", fields: { id: true, createdAt: true, updatedAt: true } }
];
const dateFields = new Set(["createdAt", "updatedAt", "publishedAt", "appliedAt", "expiresAt", "processedAt", "effectiveFrom", "effectiveTo", "providerVerifiedAt"]);
const secretKeyPattern = /api.?key|secret|password|authorization|access.?token|private.?key/i;

function fail(message) {
  throw new Error(message);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
}

function hashValue(value) {
  return createHash("sha256").update(stableValue(value)).digest("hex");
}

function sanitize(value, key = "") {
  if (secretKeyPattern.test(key)) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => sanitize(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    const next = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const sanitized = sanitize(childValue, childKey);
      if (sanitized !== undefined) next[childKey] = sanitized;
    }
    return next;
  }
  return value;
}

function normalizeSnapshot(snapshot) {
  const next = {};
  for (const table of supportedTables) {
    next[table] = asArray(snapshot[table])
      .map((row) => sanitize(row))
      .sort((left, right) => stableValue(left).localeCompare(stableValue(right)));
  }
  return next;
}

function gitValue(args) {
  try {
    return execFileSync("git", args, { cwd: repoRoot, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function gitStatusDirty() {
  return Boolean(gitValue(["status", "--porcelain"]));
}

function parseSchemaMigrations() {
  return String(argumentValue("--schema-migrations") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function targetForMode() {
  const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
  if (!target) fail(`${mode} requires --target=local|test|production.`);
  assertDatabaseTarget({
    expectedTarget: target,
    requireProductionConfirmation: target === "production",
    productionConfirmed: hasArgument("--confirm-production")
  });
  return target;
}

function assertManifestShape(manifest) {
  if (!manifest || manifest.formatVersion !== 1) fail("Unsupported or missing release manifest formatVersion.");
  if (!manifest.releaseId || !manifest.codeCommit || !manifest.manifestHash) fail("Release manifest is missing release identity fields.");
  if (!Array.isArray(manifest.sites) || manifest.sites.length !== 1) fail("Each content manifest must target exactly one site.");
  assertAllowedSite(manifest.sites[0]);
  if (!Array.isArray(manifest.scope) || !manifest.scope.includes("public-content")) fail("Release manifest must declare public-content scope.");
  for (const key of Object.keys(manifest.tables || {})) {
    if (!supportedTables.includes(key)) fail(`Release manifest contains unsupported table ${key}.`);
  }
  const { manifestHash: _hash, createdAt: _createdAt, ...hashable } = manifest;
  if (hashValue(hashable) !== manifest.manifestHash) fail("Release manifest hash does not match its content.");
}

function manifestFilePath(releaseIdOverride) {
  if (manifestPathArgument) return path.resolve(repoRoot, manifestPathArgument);
  const releaseId = releaseIdOverride || argumentValue("--release-id");
  if (!releaseId) fail("--manifest or --release-id is required.");
  return path.join(manifestRoot, `${releaseId}.json`);
}

function readManifest() {
  const filePath = manifestFilePath();
  if (!fs.existsSync(filePath)) fail(`Release manifest not found: ${filePath}`);
  const manifest = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assertManifestShape(manifest);
  return { filePath, manifest };
}

async function readContentSnapshot(prisma, siteId) {
  const [
    toolCategories,
    toolMenuItems,
    creativePackCategories,
    creativePacks,
    videoThemeCategories,
    videoThemes,
    themePages,
    themeSettings,
    siteThemes,
    themePublications,
    mediaAssets,
    products,
    prices
  ] = await Promise.all([
    prisma.toolCategory.findMany({ where: { siteId } }),
    prisma.toolMenuItem.findMany({ where: { siteId } }),
    prisma.creativePackCategory.findMany({ where: { siteId } }),
    prisma.creativePack.findMany({ where: { siteId } }),
    prisma.videoThemeCategory.findMany({ where: { siteId } }),
    prisma.videoTheme.findMany({ where: { siteId } }),
    prisma.themePage.findMany({ where: { siteId } }),
    prisma.themeSettings.findUnique({ where: { siteId } }),
    prisma.siteTheme.findMany({ where: { siteId } }),
    prisma.themePublication.findMany({ where: { siteId } }),
    prisma.mediaAsset.findMany({ where: { siteId } }),
    prisma.product.findMany({ where: { siteId } }),
    prisma.price.findMany({ where: { siteId } })
  ]);
  return normalizeSnapshot({
    toolCategories,
    toolMenuItems,
    creativePackCategories,
    creativePacks,
    videoThemeCategories,
    videoThemes,
    themePages,
    themeSettings: themeSettings ? [themeSettings] : [],
    siteThemes,
    themePublications,
    mediaAssets,
    products,
    prices
  });
}

function buildManifest(snapshot, siteId) {
  const releaseId = argumentValue("--release-id") || `${gitValue(["rev-parse", "--short", "HEAD"]) || "local"}-content-${Date.now()}`;
  const codeCommit = gitValue(["rev-parse", "HEAD"]) || "unknown";
  const contentMigrations = [`${releaseId}:public-content`];
  const base = {
    formatVersion: 1,
    releaseId,
    codeCommit,
    workingTreeDirty: gitStatusDirty(),
    sites: [siteId],
    scope: ["public-content", "navigation", "video-themes"],
    schemaMigrations: parseSchemaMigrations(),
    contentMigrations,
    replaceTables: [...replaceTables],
    protectedTables: protectedSpecs.map((item) => item.key),
    tables: snapshot
  };
  return {
    ...base,
    createdAt: new Date().toISOString(),
    manifestHash: hashValue(base)
  };
}

function ensureParent(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

async function exportManifest() {
  const target = targetForMode();
  if (target !== "local") fail("Content export must run from the isolated local database.");
  const siteId = assertAllowedSite(defaultSiteId);
  const prisma = new PrismaClient();
  try {
    const snapshot = await readContentSnapshot(prisma, siteId);
    const manifest = buildManifest(snapshot, siteId);
    const filePath = manifestFilePath(manifest.releaseId);
    ensureParent(filePath);
    fs.writeFileSync(filePath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({
      ok: true,
      mode,
      target,
      filePath,
      releaseId: manifest.releaseId,
      codeCommit: manifest.codeCommit,
      workingTreeDirty: manifest.workingTreeDirty,
      siteId,
      manifestHash: manifest.manifestHash,
      counts: Object.fromEntries(Object.entries(snapshot).map(([key, rows]) => [key, rows.length]))
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function rowIdentity(table, row) {
  if (["toolCategories", "toolMenuItems", "creativePackCategories", "creativePacks", "videoThemeCategories", "videoThemes", "themePages"].includes(table)) {
    return `${row.siteId}:${row.slug}`;
  }
  if (table === "themeSettings") return row.siteId;
  if (table === "siteThemes") return `${row.siteId}:${row.themeId}`;
  if (table === "themePublications") return `${row.siteId}:${row.version}`;
  if (table === "mediaAssets") return `${row.siteId}:${row.storageKey}`;
  return row.id;
}

function diffSnapshots(source, target) {
  const changes = {};
  for (const table of supportedTables) {
    const sourceRows = new Map(asArray(source[table]).map((row) => [rowIdentity(table, row), stableValue(row)]));
    const targetRows = new Map(asArray(target[table]).map((row) => [rowIdentity(table, row), stableValue(row)]));
    const added = [...sourceRows.keys()].filter((key) => !targetRows.has(key));
    const removed = [...targetRows.keys()].filter((key) => !sourceRows.has(key));
    const changed = [...sourceRows.keys()].filter((key) => targetRows.has(key) && sourceRows.get(key) !== targetRows.get(key));
    if (added.length || removed.length || changed.length) changes[table] = { added, removed, changed };
  }
  return changes;
}

async function protectedFingerprint(client, siteId) {
  const result = {};
  for (const spec of protectedSpecs) {
    const rows = await client[spec.model].findMany({
      where: { siteId },
      select: spec.fields,
      orderBy: { id: "asc" }
    });
    result[spec.key] = {
      count: rows.length,
      hash: hashValue(rows)
    };
  }
  return result;
}

async function planManifest() {
  const target = targetForMode();
  const { filePath, manifest } = readManifest();
  const siteId = manifest.sites[0];
  const prisma = new PrismaClient();
  try {
    const targetSnapshot = await readContentSnapshot(prisma, siteId);
    const changes = diffSnapshots(manifest.tables, targetSnapshot);
    console.log(JSON.stringify({
      ok: true,
      mode,
      target,
      manifest: filePath,
      releaseId: manifest.releaseId,
      siteId,
      manifestHash: manifest.manifestHash,
      changes,
      changedTableCount: Object.keys(changes).length,
      protected: await protectedFingerprint(prisma, siteId)
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

function dateValue(value) {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) fail(`Invalid date in release manifest: ${value}`);
  return date;
}

function preparedData(row, { update = false, omit = [] } = {}) {
  const data = {};
  for (const [key, value] of Object.entries(row)) {
    if (omit.includes(key)) continue;
    if (dateFields.has(key) && value) {
      data[key] = dateValue(value);
    } else {
      data[key] = clone(value);
    }
  }
  if (update) {
    delete data.id;
    delete data.siteId;
    delete data.createdAt;
  }
  return data;
}

function uniqueWhere(table, row) {
  if (["toolCategories", "toolMenuItems", "creativePackCategories", "creativePacks", "videoThemeCategories", "videoThemes", "themePages"].includes(table)) {
    return { siteId_slug: { siteId: row.siteId, slug: row.slug } };
  }
  if (table === "themeSettings") return { siteId: row.siteId };
  if (table === "siteThemes") return { siteId_themeId: { siteId: row.siteId, themeId: row.themeId } };
  if (table === "themePublications") return { siteId_version: { siteId: row.siteId, version: row.version } };
  if (table === "mediaAssets") return { siteId_storageKey: { siteId: row.siteId, storageKey: row.storageKey } };
  return { id: row.id };
}

async function upsertRows(tx, table, rows, transform = (row) => row) {
  const modelByTable = {
    toolCategories: "toolCategory",
    toolMenuItems: "toolMenuItem",
    creativePackCategories: "creativePackCategory",
    creativePacks: "creativePack",
    videoThemeCategories: "videoThemeCategory",
    videoThemes: "videoTheme",
    themePages: "themePage",
    themeSettings: "themeSettings",
    siteThemes: "siteTheme",
    themePublications: "themePublication",
    mediaAssets: "mediaAsset",
    products: "product",
    prices: "price"
  };
  const delegate = tx[modelByTable[table]];
  if (!delegate) fail(`Missing Prisma delegate for ${table}.`);
  for (const rawRow of asArray(rows)) {
    const row = transform(rawRow);
    const create = preparedData(row);
    const update = preparedData(row, { update: true });
    await delegate.upsert({ where: uniqueWhere(table, row), create, update });
  }
}

async function replaceRows(tx, table, siteId) {
  const modelByTable = {
    toolCategories: "toolCategory",
    toolMenuItems: "toolMenuItem",
    videoThemeCategories: "videoThemeCategory",
    videoThemes: "videoTheme"
  };
  const delegate = tx[modelByTable[table]];
  if (delegate) await delegate.deleteMany({ where: { siteId } });
}

async function targetCategoryMap(tx, table, siteId) {
  const model = table === "toolCategories" ? "toolCategory" : table === "creativePackCategories" ? "creativePackCategory" : "videoThemeCategory";
  const rows = await tx[model].findMany({ where: { siteId }, select: { id: true, slug: true } });
  return new Map(rows.map((row) => [row.slug, row.id]));
}

function remapCategoryId(row, sourceCategories, targetIds) {
  if (!row.categoryId) return row;
  const sourceCategory = sourceCategories.find((category) => category.id === row.categoryId);
  return sourceCategory ? { ...row, categoryId: targetIds.get(sourceCategory.slug) || null } : row;
}

async function applySnapshot(tx, siteId, tables, replacements) {
  const replaceSet = new Set(replacements);
  for (const table of ["toolMenuItems", "toolCategories", "videoThemes", "videoThemeCategories"]) {
    if (replaceSet.has(table)) await replaceRows(tx, table, siteId);
  }

  for (const [table, categoryTable] of [
    ["toolCategories", "toolCategories"],
    ["creativePackCategories", "creativePackCategories"],
    ["videoThemeCategories", "videoThemeCategories"]
  ]) {
    const supportsParents = table !== "videoThemeCategories";
    // Video theme categories are a flat public taxonomy. Clear historical parent
    // references before upserting so old relational rows cannot violate the FK.
    const rows = asArray(tables[table]).map((row) => ({ ...row, ...(supportsParents ? { parentId: null } : { parentId: null }) }));
    await upsertRows(tx, table, rows);
    const targetIds = await targetCategoryMap(tx, categoryTable, siteId);
    if (supportsParents) {
      const sourceById = new Map(asArray(tables[table]).map((row) => [row.id, row]));
      const model = table === "toolCategories" ? "toolCategory" : "creativePackCategory";
      for (const sourceRow of asArray(tables[table])) {
        const parent = sourceById.get(sourceRow.parentId);
        const targetId = targetIds.get(sourceRow.slug);
        if (targetId) {
          await tx[model].update({
            where: { id: targetId },
            data: { parentId: parent ? targetIds.get(parent.slug) || null : null }
          });
        }
      }
    }
  }

  const toolCategoryIds = await targetCategoryMap(tx, "toolCategories", siteId);
  const creativeCategoryIds = await targetCategoryMap(tx, "creativePackCategories", siteId);
  const videoCategoryIds = await targetCategoryMap(tx, "videoThemeCategories", siteId);
  const toolCategories = asArray(tables.toolCategories);
  const creativeCategories = asArray(tables.creativePackCategories);
  const videoCategories = asArray(tables.videoThemeCategories);

  await upsertRows(tx, "toolMenuItems", tables.toolMenuItems, (row) => remapCategoryId(row, toolCategories, toolCategoryIds));
  await upsertRows(tx, "creativePacks", tables.creativePacks, (row) => remapCategoryId(row, creativeCategories, creativeCategoryIds));
  await upsertRows(tx, "videoThemes", tables.videoThemes, (row) => remapCategoryId(row, videoCategories, videoCategoryIds));

  // Products must exist before prices because Price.productId is a required relation.
  for (const table of ["products", "prices", "themeSettings", "themePages", "siteThemes", "themePublications", "mediaAssets"]) {
    await upsertRows(tx, table, tables[table]);
  }
}

async function applyManifest() {
  const target = targetForMode();
  if (!hasArgument("--apply") || argumentValue("--confirm") !== "release-content-apply") {
    fail("Content apply is dry-run by default. Add --apply --confirm=release-content-apply.");
  }
  const { filePath, manifest } = readManifest();
  const siteId = manifest.sites[0];
  if (target === "production" && siteId !== "site_dreamshoot") fail("Production content releases must target site_dreamshoot.");
  if (target === "test" && siteId !== "site_grownstride_test") fail("Test content releases must target site_grownstride_test.");

  const prisma = new PrismaClient();
  const backupPath = path.join(backupRoot, target, siteId, `${manifest.releaseId}.json`);
  try {
    const beforeSnapshot = await readContentSnapshot(prisma, siteId);
    const beforeProtected = await protectedFingerprint(prisma, siteId);
    ensureParent(backupPath);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, snapshot: beforeSnapshot }, null, 2)}\n`);

    const changes = diffSnapshots(manifest.tables, beforeSnapshot);
    const result = await prisma.$transaction(async (tx) => {
      await applySnapshot(tx, siteId, manifest.tables, manifest.replaceTables || [...replaceTables]);
      const afterProtected = await protectedFingerprint(tx, siteId);
      if (stableValue(beforeProtected) !== stableValue(afterProtected)) {
        throw new Error("Protected production data changed during content apply; transaction will be rolled back.");
      }
      const record = await tx.deploymentRelease.upsert({
        where: {
          environment_siteId_releaseId: {
            environment: target,
            siteId,
            releaseId: manifest.releaseId
          }
        },
        create: {
          id: `release_${target}_${siteId}_${manifest.releaseId}`,
          releaseId: manifest.releaseId,
          environment: target,
          siteId,
          codeCommit: manifest.codeCommit,
          manifestHash: manifest.manifestHash,
          schemaMigrations: manifest.schemaMigrations || [],
          contentMigrations: manifest.contentMigrations || [],
          scope: manifest.scope || [],
          status: "applied",
          details: { changes, backupPath: path.relative(repoRoot, backupPath) },
          appliedAt: new Date()
        },
        update: {
          codeCommit: manifest.codeCommit,
          manifestHash: manifest.manifestHash,
          schemaMigrations: manifest.schemaMigrations || [],
          contentMigrations: manifest.contentMigrations || [],
          scope: manifest.scope || [],
          status: "applied",
          details: { changes, backupPath: path.relative(repoRoot, backupPath) },
          appliedAt: new Date()
        }
      });
      return { recordId: record.id, afterProtected };
    });

    console.log(JSON.stringify({
      ok: true,
      mode,
      target,
      manifest: filePath,
      releaseId: manifest.releaseId,
      siteId,
      manifestHash: manifest.manifestHash,
      backupPath,
      changes,
      protected: result.afterProtected
    }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (mode === "export") {
  await exportManifest();
} else if (mode === "plan") {
  await planManifest();
} else if (mode === "apply") {
  await applyManifest();
} else {
  fail("Usage: node scripts/release-content.mjs --mode=export|plan|apply");
}
