#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { assertAidreamcapesEuHomepageJsonContract } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";
import { argumentValue, assertDatabaseTarget, buildTunneledDatabaseUrl, hasArgument, parseDatabaseUrl } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const HOME_SLUG = "/";
const CONFIRMATION = "aidreamcapes-eu-homepage-drift";
const BACKUP_ROOT = path.resolve("releases/backups/aidreamcapes-eu");
const VIDEO_UPLOAD_DATE_PATH = ["sections", "tutorial_video_1", "settings", "videoUploadDate"];

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getAt(value, keys) {
  return keys.reduce((current, key) => current?.[key], value);
}

function setAt(value, keys, nextValue) {
  const next = clone(value);
  let cursor = next;
  for (const key of keys.slice(0, -1)) {
    assert(cursor && typeof cursor === "object", `Cannot update missing JSON path before ${key}`);
    cursor = cursor[key];
  }
  const finalKey = keys.at(-1);
  assert(cursor && typeof cursor === "object" && finalKey in cursor, `Cannot update missing JSON path: ${keys.join(".")}`);
  cursor[finalKey] = nextValue;
  return next;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function ensureProductionTunnel() {
  assert.equal(String(process.env.DATABASE_TARGET || "").trim().toLowerCase(), "production", "EU homepage drift repair requires DATABASE_TARGET=production.");
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if ((current.database === "dingyue_local" || current.port === 15433) && process.env.REMOTE_DB_DATABASE_URL) {
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  const connected = parseDatabaseUrl(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost", "::1"].includes(connected.host) && connected.port === 15432, `Production EU homepage repair must use the protected SSH tunnel; received ${connected.host}:${connected.port}.`);
}

function writeBackup(value) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o700 });
  const backupPath = path.join(BACKUP_ROOT, `homepage-drift-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(backupPath, 0o600);
  return backupPath;
}

function updateLiveFromCanonical(liveJson, canonicalDate) {
  assertAidreamcapesEuHomepageJsonContract(liveJson, "LivePage homepage");
  assert.equal(typeof canonicalDate, "string", "canonical videoUploadDate is missing");
  return setAt(liveJson, VIDEO_UPLOAD_DATE_PATH, canonicalDate);
}

function assertCanonicalThemePages(draftJson, publishedJson) {
  assertAidreamcapesEuHomepageJsonContract(draftJson, "ThemePage draft homepage");
  assertAidreamcapesEuHomepageJsonContract(publishedJson, "ThemePage published homepage");
  assert.equal(getAt(draftJson, VIDEO_UPLOAD_DATE_PATH), getAt(publishedJson, VIDEO_UPLOAD_DATE_PATH), "ThemePage draft/published videoUploadDate diverged; refusing to choose a source.");
}

async function otherSiteSentinel(prisma) {
  const livePages = await prisma.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, title: true, contentJson: true } });
  const themePages = await prisma.themePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } });
  return { livePages, themePages, hash: hash({ livePages, themePages }) };
}

ensureProductionTunnel();
const target = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "").trim().toLowerCase();
const apply = hasArgument("--apply");
const confirmation = argumentValue("--confirm") || "";
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmation === CONFIRMATION });
if (apply) assert.equal(confirmation, CONFIRMATION, `Applying requires --confirm=${CONFIRMATION}.`);

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  const livePage = await prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } }, select: { id: true, contentJson: true, updatedAt: true } });
  const themePage = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } }, select: { id: true, draftJson: true, publishedJson: true, updatedAt: true } });
  const beforeOtherSites = await otherSiteSentinel(prisma);
  assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: "aidreamcapes.eu" }, "Unexpected Aidreamcapes EU site identity.");
  assert(livePage, "Aidreamcapes EU LivePage homepage is missing.");
  assert(themePage, "Aidreamcapes EU ThemePage homepage is missing.");
  assertCanonicalThemePages(themePage.draftJson, themePage.publishedJson);

  const canonicalDate = getAt(themePage.draftJson, VIDEO_UPLOAD_DATE_PATH);
  const currentLiveDate = getAt(livePage.contentJson, VIDEO_UPLOAD_DATE_PATH);
  assert.notEqual(canonicalDate, undefined, "ThemePage canonical videoUploadDate is missing.");
  const nextLiveJson = updateLiveFromCanonical(clone(livePage.contentJson), canonicalDate);
  const changed = currentLiveDate !== canonicalDate;
  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    target: { siteId: SITE_ID, siteSlug: SITE_SLUG, pageSlug: HOME_SLUG, databaseTarget: target },
    field: VIDEO_UPLOAD_DATE_PATH.join("."),
    currentLiveDate,
    canonicalDate,
    changed,
    otherSiteSentinelHash: beforeOtherSites.hash,
    sharedMedia: "unchanged"
  };

  if (apply && changed) {
    const backupPath = writeBackup({ createdAt: new Date().toISOString(), site, livePage, themePage, otherSiteSentinel: beforeOtherSites });
    await prisma.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLiveJson, updatedAt: new Date() } });
    report.backupPath = backupPath;
    const readback = await prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } });
    const afterOtherSites = await otherSiteSentinel(prisma);
    assert.equal(getAt(readback?.contentJson, VIDEO_UPLOAD_DATE_PATH), canonicalDate, "LivePage videoUploadDate readback mismatch.");
    assert.equal(afterOtherSites.hash, beforeOtherSites.hash, "A non-target site changed; EU repair is not considered safe.");
    report.afterOtherSiteSentinelHash = afterOtherSites.hash;
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
