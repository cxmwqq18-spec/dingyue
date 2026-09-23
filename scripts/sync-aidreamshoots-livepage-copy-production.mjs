#!/usr/bin/env node

/**
 * Copy the local Spanish storefront LivePage content to the Aidreamshoots
 * production LivePage rows. This script intentionally does not read or write
 * any other public-content table and preserves the production route set.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const PRODUCTION_DOMAIN = "aidreamshoots.eu";
const PRODUCTION_CONFIRMATION = "aidreamshoots-livepage-copy-production";
const BACKUP_DIRECTORY = path.resolve("releases/backups/production");

const apply = process.argv.includes("--apply");
const confirmation = `--confirm=${PRODUCTION_CONFIRMATION}`;

if (apply && !process.argv.includes(confirmation)) {
  throw new Error(`Production apply requires ${confirmation}`);
}

const localDatabaseUrl = process.env.DATABASE_URL;
const remoteDatabaseUrl = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, {
  host: "127.0.0.1",
  port: 15432
});

if (!localDatabaseUrl) throw new Error("DATABASE_URL is required for the local source database.");

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stable(child)]));
  }
  return value;
}

function digest(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex").slice(0, 16);
}

function serializeDate(value) {
  return value instanceof Date ? value.toISOString() : value;
}

function backupName() {
  return path.join(BACKUP_DIRECTORY, `aidreamshoots-livepage-copy-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
}

function rowSnapshot(row) {
  return {
    id: row.id,
    siteId: row.siteId,
    pageType: row.pageType,
    templateKey: row.templateKey,
    slug: row.slug,
    title: row.title,
    contentJson: row.contentJson,
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt)
  };
}

async function readRows(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await prisma.livePage.findMany({
      where: { siteId: SITE_ID },
      orderBy: { slug: "asc" }
    });
  } finally {
    await prisma.$disconnect();
  }
}

function buildPlan(sourceRows, targetRows) {
  const sourceBySlug = new Map(sourceRows.map((row) => [row.slug, row]));
  const targetBySlug = new Map(targetRows.map((row) => [row.slug, row]));
  const sourceOnly = sourceRows.filter((row) => !targetBySlug.has(row.slug)).map((row) => row.slug);
  const targetOnly = targetRows.filter((row) => !sourceBySlug.has(row.slug)).map((row) => row.slug);
  const changes = [];

  for (const source of sourceRows) {
    const target = targetBySlug.get(source.slug);
    if (!target) continue;
    const sourceHash = digest({ pageType: source.pageType, templateKey: source.templateKey, title: source.title, contentJson: source.contentJson });
    const targetHash = digest({ pageType: target.pageType, templateKey: target.templateKey, title: target.title, contentJson: target.contentJson });
    if (sourceHash !== targetHash) {
      changes.push({
        slug: source.slug,
        targetId: target.id,
        sourceUpdatedAt: source.updatedAt.toISOString(),
        targetUpdatedAt: target.updatedAt.toISOString(),
        sourceHash,
        targetHash
      });
    }
  }

  return {
    siteId: SITE_ID,
    domain: PRODUCTION_DOMAIN,
    sourceCount: sourceRows.length,
    targetCount: targetRows.length,
    sharedCount: sourceRows.length - sourceOnly.length,
    changedCount: changes.length,
    unchangedCount: sourceRows.length - sourceOnly.length - changes.length,
    sourceOnly,
    targetOnly,
    changes
  };
}

async function createBackup(targetRows) {
  fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true });
  const backupPath = backupName();
  fs.writeFileSync(
    backupPath,
    `${JSON.stringify({
      createdAt: new Date().toISOString(),
      purpose: "aidreamshoots-production-livepage-copy",
      siteId: SITE_ID,
      domain: PRODUCTION_DOMAIN,
      rows: targetRows.map(rowSnapshot)
    }, null, 2)}\n`,
    { mode: 0o600 }
  );
  return backupPath;
}

async function applyPlan(sourceRows, targetRows) {
  const sourceBySlug = new Map(sourceRows.map((row) => [row.slug, row]));
  const targetBySlug = new Map(targetRows.map((row) => [row.slug, row]));
  const changedRows = sourceRows.filter((source) => {
    const target = targetBySlug.get(source.slug);
    if (!target) return false;
    return digest({ pageType: source.pageType, templateKey: source.templateKey, title: source.title, contentJson: source.contentJson })
      !== digest({ pageType: target.pageType, templateKey: target.templateKey, title: target.title, contentJson: target.contentJson });
  });

  const prisma = new PrismaClient({ datasources: { db: { url: remoteDatabaseUrl } } });
  try {
    await prisma.$transaction(async (tx) => {
      for (const source of changedRows) {
        const target = targetBySlug.get(source.slug);
        await tx.livePage.update({
          where: { id: target.id },
          data: {
            pageType: source.pageType,
            templateKey: source.templateKey,
            title: source.title,
            contentJson: source.contentJson
          }
        });
      }
    }, { timeout: 1800000, maxWait: 20000 });

    const readback = await txReadback(prisma, changedRows.map((row) => row.slug));
    for (const source of changedRows) {
      const target = readback.get(source.slug);
      if (!target) throw new Error(`Missing LivePage after write: ${source.slug}`);
      const sourcePayload = { pageType: source.pageType, templateKey: source.templateKey, title: source.title, contentJson: source.contentJson };
      const targetPayload = { pageType: target.pageType, templateKey: target.templateKey, title: target.title, contentJson: target.contentJson };
      if (digest(sourcePayload) !== digest(targetPayload)) throw new Error(`LivePage readback mismatch: ${source.slug}`);
    }
    return { changedRows: changedRows.length };
  } finally {
    await prisma.$disconnect();
  }
}

async function txReadback(prisma, slugs) {
  const rows = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } } });
  return new Map(rows.map((row) => [row.slug, row]));
}

const sourceRows = await readRows(localDatabaseUrl);
const targetRows = await readRows(remoteDatabaseUrl);
const plan = buildPlan(sourceRows, targetRows);

if (!apply) {
  console.log(JSON.stringify({ ok: true, mode: "dry-run", ...plan }, null, 2));
  process.exit(0);
}

const backupPath = await createBackup(targetRows);
const applied = await applyPlan(sourceRows, targetRows);
console.log(JSON.stringify({ ok: true, mode: "applied", ...plan, backupPath, ...applied }, null, 2));
