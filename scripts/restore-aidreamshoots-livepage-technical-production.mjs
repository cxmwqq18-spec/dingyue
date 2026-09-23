#!/usr/bin/env node

/**
 * Restore production-only LivePage technical metadata after a scoped copy.
 *
 * This intentionally reads and writes only LivePage rows for the Spanish
 * Aidreamshoots site. It preserves the current LivePage copy and restores
 * intrinsic image dimensions plus the production media manifest from the
 * pre-copy backup.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const PRODUCTION_CONFIRMATION = "aidreamshoots-livepage-technical-restore-production";
const DEFAULT_BACKUP_PATH = path.resolve(
  "releases/backups/production/aidreamshoots-livepage-copy-2026-09-22T02-05-21-580Z.json"
);

const apply = process.argv.includes("--apply");
const confirmation = `--confirm=${PRODUCTION_CONFIRMATION}`;
const backupArgument = process.argv.find((argument) => argument.startsWith("--backup="));
const backupPath = path.resolve(backupArgument ? backupArgument.slice("--backup=".length) : DEFAULT_BACKUP_PATH);

if (apply && !process.argv.includes(confirmation)) {
  throw new Error(`Production apply requires ${confirmation}`);
}

const remoteDatabaseUrl = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, {
  host: "127.0.0.1",
  port: 15432
});

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)])
    );
  }
  return value;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value)) ?? "undefined").digest("hex").slice(0, 16);
}

function isObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function restoreDimensions(current, backup, stats, pathLabel = "$") {
  if (Array.isArray(backup)) {
    if (!Array.isArray(current)) return current;
    return current.map((value, index) => restoreDimensions(value, backup[index], stats, `${pathLabel}[${index}]`));
  }

  if (!isObject(backup) || !isObject(current)) return current;

  const next = { ...current };
  if (Number.isFinite(backup.width) && Number.isFinite(backup.height)) {
    if (next.width !== backup.width || next.height !== backup.height) {
      next.width = backup.width;
      next.height = backup.height;
      stats.dimensionChanges.push({
        path: pathLabel,
        from: [current.width, current.height],
        to: [backup.width, backup.height]
      });
    }
  }

  for (const key of Object.keys(backup)) {
    if (key in current) {
      next[key] = restoreDimensions(current[key], backup[key], stats, `${pathLabel}.${key}`);
    }
  }
  return next;
}

function restoreTechnicalMetadata(currentContent, backupContent, stats) {
  const next = restoreDimensions(currentContent, backupContent, stats);
  if (backupContent && backupContent.mediaManifest !== undefined) {
    if (digest(next.mediaManifest) !== digest(backupContent.mediaManifest)) {
      stats.mediaManifestChanges += 1;
      next.mediaManifest = clone(backupContent.mediaManifest);
    }
  }
  return next;
}

function readBackup() {
  if (!fs.existsSync(backupPath)) throw new Error(`Backup file does not exist: ${backupPath}`);
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8"));
  if (backup.siteId !== SITE_ID) throw new Error(`Backup site mismatch: ${backup.siteId || "(missing)"}`);
  if (!Array.isArray(backup.rows)) throw new Error("Backup does not contain LivePage rows.");
  return backup;
}

function createSafetyBackup(rows) {
  const directory = path.resolve("releases/backups/production");
  fs.mkdirSync(directory, { recursive: true });
  const outputPath = path.join(
    directory,
    `aidreamshoots-livepage-technical-restore-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({
      createdAt: new Date().toISOString(),
      purpose: "aidreamshoots-production-livepage-technical-restore-before-write",
      siteId: SITE_ID,
      rows
    }, null, 2)}\n`,
    { mode: 0o600 }
  );
  return outputPath;
}

async function readProductionRows() {
  const prisma = new PrismaClient({ datasources: { db: { url: remoteDatabaseUrl } } });
  try {
    return await prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } });
  } finally {
    await prisma.$disconnect();
  }
}

function buildPlan(backup, productionRows) {
  const backupBySlug = new Map(backup.rows.map((row) => [row.slug, row]));
  const stats = { dimensionChanges: [], mediaManifestChanges: 0 };
  const changes = [];

  for (const row of productionRows) {
    const backupRow = backupBySlug.get(row.slug);
    if (!backupRow) continue;
    const restored = restoreTechnicalMetadata(row.contentJson, backupRow.contentJson, stats);
    if (digest(restored) !== digest(row.contentJson)) {
      changes.push({
        slug: row.slug,
        id: row.id,
        beforeHash: digest(row.contentJson),
        afterHash: digest(restored)
      });
    }
  }

  return {
    siteId: SITE_ID,
    backupPath,
    productionCount: productionRows.length,
    backupCount: backup.rows.length,
    changedRows: changes.length,
    dimensionChanges: stats.dimensionChanges.length,
    mediaManifestChanges: stats.mediaManifestChanges,
    sampleDimensionChanges: stats.dimensionChanges.slice(0, 20),
    sampleRows: changes.slice(0, 20),
    changes,
    backupBySlug,
    stats
  };
}

async function applyPlan(productionRows, plan) {
  const prisma = new PrismaClient({ datasources: { db: { url: remoteDatabaseUrl } } });
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of productionRows) {
        const backupRow = plan.backupBySlug.get(row.slug);
        if (!backupRow) continue;
        const restored = restoreTechnicalMetadata(row.contentJson, backupRow.contentJson, plan.stats);
        if (digest(restored) === digest(row.contentJson)) continue;
        await tx.livePage.update({
          where: { id: row.id },
          data: { contentJson: restored }
        });
      }
    }, { timeout: 1800000, maxWait: 20000 });

    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID } });
    const readbackBySlug = new Map(readback.map((row) => [row.slug, row]));
    for (const change of plan.changes) {
      const row = readbackBySlug.get(change.slug);
      const backupRow = plan.backupBySlug.get(change.slug);
      const expected = restoreTechnicalMetadata(row.contentJson, backupRow.contentJson, { dimensionChanges: [], mediaManifestChanges: 0 });
      if (digest(row.contentJson) !== digest(expected)) {
        throw new Error(`LivePage technical metadata readback mismatch: ${change.slug}`);
      }
    }
    return { appliedRows: plan.changes.length };
  } finally {
    await prisma.$disconnect();
  }
}

const backup = readBackup();
const productionRows = await readProductionRows();
const plan = buildPlan(backup, productionRows);
const output = {
  ok: true,
  mode: apply ? "applied" : "dry-run",
  siteId: SITE_ID,
  backupPath,
  productionCount: plan.productionCount,
  backupCount: plan.backupCount,
  changedRows: plan.changedRows,
  dimensionChanges: plan.dimensionChanges,
  mediaManifestChanges: plan.mediaManifestChanges,
  sampleDimensionChanges: plan.sampleDimensionChanges,
  sampleRows: plan.sampleRows
};

if (apply) {
  output.safetyBackupPath = createSafetyBackup(productionRows);
  Object.assign(output, await applyPlan(productionRows, plan));
}
console.log(JSON.stringify(output, null, 2));
