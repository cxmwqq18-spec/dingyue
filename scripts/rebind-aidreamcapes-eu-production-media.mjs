#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const DOMAIN = "aidreamcapes.eu";
const PUBLIC_ROOT = path.resolve("public");
const REPORT_PATH = path.resolve(process.argv.find((arg) => arg.startsWith("--map="))?.slice(6) || "reports/aidreamcapes-eu-production-media-map.json");
const CONFIRM = process.argv.find((arg) => arg.startsWith("--confirm="))?.slice(10) || "";
const APPLY = process.argv.includes("--apply");
const MODELS = [
  ["livePage", ["contentJson"]],
  ["themePage", ["draftJson", "publishedJson", "draftMeta"]],
  ["themeSettings", ["draftJson", "publishedJson"]],
  ["storefrontProfile", ["draftJson", "publishedJson", "draftMeta"]],
  ["site", ["branding"]],
  ["videoTheme", ["imageUrl", "galleryImages"]],
  ["videoThemeExample", ["imageUrl", "galleryImages"]],
  ["videoThemeCategory", ["imageUrl"]],
  ["creativePackCategory", ["imageUrl"]],
  ["creativePack", ["imageUrl", "galleryImages"]]
];

function stripQuery(value) { return String(value || "").split(/[?#]/)[0]; }
function changed(before, after) { return JSON.stringify(before) !== JSON.stringify(after); }
function rewrite(value, replacements) {
  if (typeof value === "string") {
    const clean = stripQuery(value);
    const replacement = replacements.get(clean);
    if (!replacement) return value;
    const suffix = value.slice(clean.length);
    return `${replacement}${suffix}`;
  }
  if (Array.isArray(value)) return value.map((item) => rewrite(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item, replacements)]));
}
function localFileForUrl(url) {
  const clean = stripQuery(url);
  assert(clean.startsWith("/assets/"), `Replacement is not a local asset URL: ${url}`);
  const filePath = path.resolve(PUBLIC_ROOT, clean.slice(1));
  assert(filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Replacement escapes public root: ${url}`);
  return filePath;
}
async function findManyOptional(client, modelName, args) {
  try { return await client[modelName].findMany(args); }
  catch (error) { if (error?.code === "P2021") return []; throw error; }
}
async function updateJsonModel(tx, modelName, rows, fields, replacements) {
  let writes = 0;
  for (const row of rows) {
    const data = {};
    for (const field of fields) {
      if (!(field in row) || row[field] === null || row[field] === undefined) continue;
      const next = rewrite(row[field], replacements);
      if (changed(row[field], next)) data[field] = next;
    }
    if (Object.keys(data).length) { await tx[modelName].update({ where: { id: row.id }, data }); writes += 1; }
  }
  return writes;
}

assert.equal(CONFIRM, "aidreamcapes-eu-production-media", "Production media rebind requires --confirm=aidreamcapes-eu-production-media.");
const report = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
assert.deepEqual({ siteId: report.siteId, siteSlug: report.siteSlug, primaryDomain: report.primaryDomain }, { siteId: SITE_ID, siteSlug: SITE_SLUG, primaryDomain: DOMAIN });
assert.equal(report.policy.providerCalls, 0);
assert.equal(report.policy.copiedFromSiteAidreamshoots, 0);
assert.equal(report.policy.derivativesUsedAsOriginal, 0);
const replacements = new Map();
for (const item of report.replacements || []) {
  assert(item.from.startsWith("/assets/sites/site_aidreamcapes_eu/"), `Source URL is outside EU: ${item.from}`);
  assert(item.to.startsWith("/assets/sites/site_aidreamcapes_eu/restored/"), `Target URL is not restored EU original: ${item.to}`);
  assert(!item.to.includes("site_aidreamshoots"));
  const destination = localFileForUrl(item.to);
  if (APPLY) assert(fs.existsSync(destination), `Missing uploaded replacement asset: ${destination}`);
  replacements.set(stripQuery(item.from), stripQuery(item.to));
}
assert(replacements.size > 0, "No production replacements were provided.");
if (!APPLY) {
  console.log(JSON.stringify({ mode: "dry-run", siteId: SITE_ID, replacements: replacements.size, unresolved: report.unresolvedUrls || 0, providerCalls: 0, databaseWrites: 0 }, null, 2));
  process.exit(0);
}
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: true });
const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  assert.deepEqual(site, { id: SITE_ID, slug: SITE_SLUG, primaryDomain: DOMAIN });
  const result = await prisma.$transaction(async (tx) => {
    const counts = {};
    for (const [modelName, fields] of MODELS) {
      counts[modelName] = await updateJsonModel(tx, modelName, await findManyOptional(tx, modelName, { where: modelName === "site" ? { id: SITE_ID } : { siteId: SITE_ID } }), fields, replacements);
    }
    const mediaRows = await tx.mediaAsset.findMany({ where: { siteId: SITE_ID } });
    let mediaWrites = 0;
    for (const media of mediaRows) {
      const current = `/${String(media.storageKey || "").replace(/^\/+/, "")}`;
      const replacement = replacements.get(stripQuery(current));
      if (!replacement) continue;
      await tx.mediaAsset.update({ where: { id: media.id }, data: {
        storageKey: stripQuery(replacement).replace(/^\/+/, ""),
        previewUrl: replacement,
        originUrl: replacement,
        sourceType: "aidreamcapes-eu-production-original-no-crop",
        notes: `${media.notes ? `${media.notes} ` : ""}Production EU media rebind: byte-for-byte restored local original; no resize or crop.`
      } });
      mediaWrites += 1;
    }
    for (const item of report.replacements || []) {
      const storageKey = stripQuery(item.to).replace(/^\/+/, "");
      const existing = await tx.mediaAsset.findUnique({ where: { siteId_storageKey: { siteId: SITE_ID, storageKey } } });
      if (existing) continue;
      await tx.mediaAsset.create({ data: {
        id: `media_${SITE_ID}_production_original_${crypto.createHash("sha256").update(storageKey).digest("hex").slice(0, 24)}`,
        siteId: SITE_ID,
        label: path.basename(storageKey),
        storageKey,
        mimeType: "image/webp",
        usageType: "theme",
        sourceType: "aidreamcapes-eu-production-original-no-crop",
        previewUrl: item.to,
        originUrl: item.to,
        altText: null,
        notes: "Production EU media rebind: byte-for-byte restored local original; no resize or crop."
      } });
      mediaWrites += 1;
    }
    counts.mediaAsset = mediaWrites;
    return counts;
  }, { isolationLevel: "RepeatableRead" });
  fs.writeFileSync(REPORT_PATH.replace(/\.json$/i, ".applied.json"), `${JSON.stringify({ ...report, policy: { ...report.policy, databaseWrites: 1 }, database: result }, null, 2)}\n`);
  console.log(JSON.stringify({ mode: "apply", siteId: SITE_ID, replacements: replacements.size, providerCalls: 0, databaseWrites: result }, null, 2));
} finally { await prisma.$disconnect(); }
