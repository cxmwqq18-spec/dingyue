// Build the reviewed deletion manifest for Aidreamcapes LivePage rows that the
// runtime never renders.
//
// Two row groups qualify:
//
//   A1 redirect-source rows: `slug` is a source in
//   `src/lib/aidreamcapes-site-v2-redirects.json`. The middleware
//   `aidreamcapesV2Redirect()` answers those addresses with a 301 before any
//   page row is read, so the stored row is invisible.
//
//   A2 retired rows: `slug` is retired for the Aidreamcapes storefront by
//   `isRetiredAidreamcapesPublicPath()` / `AIDREAMCAPES_GONE_PUBLIC_PATHS` in
//   `src/lib/aidreamcapes-image-theme-routes.ts`. Those addresses answer 404
//   (retired) or 410 (gone) and never read the row.
//
//   A3 legacy gallery rows: `slug` is a source of
//   `AIDREAMCAPES_LEGACY_GALLERY_REDIRECTS`, which the middleware answers
//   with a 301 before any page row is read.
//
//   A4 legacy Save The Date video rows: `slug` is an
//   `/ai-video-generation/{slug}` alias listed in
//   `AIDREAMCAPES_LEGACY_VIDEO_SAVE_THE_DATE_SLUGS`. For Aidreamcapes the
//   middleware answers those addresses 404, so the row is never read.
//
// The manifest records the fields a compare-and-set delete needs plus the
// pre-cleanup HTTP status of every address. It never carries a snapshot that
// could be restored as a publication: the rollback manifest produced by the
// apply script is a field-level inverse against current relational rows.
//
// Usage:
//   node scripts/build-aidreamcapes-retired-rows-manifest.mjs \
//     --target=production \
//     --http-probe=/tmp/ac-probe-report.json \
//     --out=scripts/manifests/aidreamcapes-retired-rows-production-2026-10-23.json

import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";
import { aidreamcapesAuditLoader } from "./lib/aidreamcapes-typescript-audit-loader.mjs";

const CONTRACT = "aidreamcapes-retired-rows-v1";
const SITE_ID = "site_aidreamcapes";
const target = argumentValue("--target") || "production";
const httpProbePath = argumentValue("--http-probe");
const outPath = argumentValue("--out");
const groupsArgument = argumentValue("--groups");
assert(["local", "production"].includes(target), "Unsupported target");
assert(outPath, "--out is required");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: false });

// A1 = v2 redirect source, A2 = retired public path, A3 = legacy gallery
// redirect source, A4 = legacy Save The Date video alias.
const ALL_GROUPS = ["A1", "A2", "A3", "A4"];
const groups = groupsArgument ? groupsArgument.split(",").map((value) => value.trim()).filter(Boolean) : ALL_GROUPS;
for (const group of groups) assert(ALL_GROUPS.includes(group), `Unknown group ${group}`);

const hash = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");

// ---------------------------------------------------------------------------
// Runtime classification. Read the real route modules so the manifest cannot
// drift away from the code that serves these addresses.
// ---------------------------------------------------------------------------
const load = aidreamcapesAuditLoader();
const routeModules = load("src/lib/aidreamcapes-image-theme-routes.ts");
const saveTheDateRoutes = load("src/lib/save-the-date-routes.ts");
const redirectTable = JSON.parse(fs.readFileSync("src/lib/aidreamcapes-site-v2-redirects.json", "utf8"));
const redirectSources = new Map(redirectTable.map(([from, to]) => [from, to]));

function classify(slug) {
  if (redirectSources.has(slug)) {
    return { group: "A1", reason: `redirect-source:${slug}->${redirectSources.get(slug)}` };
  }
  // The retired set is site-scoped: MyDreamShoots and the EU storefront keep
  // their own Save The Date and image-tool routes.
  if (routeModules.isRetiredAidreamcapesPublicPath("aidreamcapes", slug)) {
    const gone = routeModules.isAidreamcapesGonePublicPath("aidreamcapes", slug);
    return { group: "A2", reason: gone ? "retired-gone-410" : "retired-404" };
  }
  // Legacy catalogue gallery aliases answer 301 before any page row is read.
  const galleryTarget = routeModules.aidreamcapesLegacyGalleryRedirectForPath("aidreamcapes", slug);
  if (galleryTarget) {
    return { group: "A3", reason: `legacy-gallery-redirect:${slug}->${galleryTarget}` };
  }
  // Legacy /ai-video-generation/{slug} Save The Date aliases resolve to a
  // retired /ai-save-the-date/{slug} address and answer 404 for Aidreamcapes.
  if (saveTheDateRoutes.aidreamcapesLegacyVideoSaveTheDatePath(slug)) {
    return { group: "A4", reason: "retired-legacy-video-save-the-date-404" };
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Read the current relational rows.
// ---------------------------------------------------------------------------
const db = new PrismaClient();
let rows = [];
try {
  // Read the cheap columns first so classification never depends on a large
  // content payload, then load contentJson only for the rows that qualify.
  rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, slug: true, pageType: true, templateKey: true, title: true, createdAt: true, updatedAt: true },
  });
} finally {
  await db.$disconnect();
}

const classifiedRows = rows
  .map((row) => ({ row, classification: classify(row.slug) }))
  .filter((entry) => entry.classification)
  .filter((entry) => groups.includes(entry.classification.group))
  .sort((a, b) => (a.row.slug < b.row.slug ? -1 : 1));

const contentDb = new PrismaClient();
const contentById = new Map();
try {
  for (const entry of classifiedRows) {
    const full = await contentDb.livePage.findFirst({
      where: { id: entry.row.id, siteId: SITE_ID },
      select: { contentJson: true },
    });
    assert(full, `Row ${entry.row.id} disappeared while building the manifest`);
    contentById.set(entry.row.id, full.contentJson);
  }
} finally {
  await contentDb.$disconnect();
}

const candidates = classifiedRows.map((entry) => ({
  ...entry,
  row: { ...entry.row, contentJson: contentById.get(entry.row.id) },
}));

// HTTP readback of every address, from the release machine.
let probe = undefined;
if (httpProbePath) {
  probe = JSON.parse(fs.readFileSync(httpProbePath, "utf8"));
  const byPath = new Map(probe.results.map((entry) => [entry.path, entry]));
  for (const entry of candidates) {
    const observed = byPath.get(entry.row.slug);
    assert(observed, `No HTTP probe result for ${entry.row.slug}`);
    const expected = entry.classification.group === "A1" || entry.classification.group === "A3" ? 301
      : entry.classification.group === "A2" && entry.classification.reason === "retired-gone-410" ? 410
        : 404;
    assert.equal(observed.status, expected, `${entry.row.slug} answered ${observed.status}, expected ${expected}`);
    entry.http = observed;
  }
  assert.equal(probe.inSitemap.length, 0, "Retired addresses must not be in the sitemap");
}

const manifestRows = candidates.map(({ row, classification, http }) => ({
  pageId: row.id,
  pageSlug: row.slug,
  updatedAt: new Date(row.updatedAt).toISOString(),
  contentJsonSha256: hash(row.contentJson),
  reason: classification.reason,
  group: classification.group,
  httpStatus: http ? http.status : null,
  httpBodySha256: http ? http.bodySha256 : null,
  httpLocation: http ? http.location : null,
  pageType: row.pageType,
  templateKey: row.templateKey,
  title: row.title,
  createdAt: new Date(row.createdAt).toISOString(),
}));

const planHash = hash({ contract: CONTRACT, siteId: SITE_ID, target, rows: manifestRows });
const manifest = {
  ok: true,
  mode: "plan",
  contract: CONTRACT,
  siteId: SITE_ID,
  target,
  generatedAt: new Date().toISOString(),
  sourceOfTruth: "PostgreSQL LivePage for site_aidreamcapes; runtime classification read from src/lib/aidreamcapes-site-v2-redirects.json, src/lib/aidreamcapes-image-theme-routes.ts and src/lib/save-the-date-routes.ts",
  httpProbeOrigin: probe ? probe.origin : null,
  sitemapLocCountAtPlan: probe ? probe.sitemapLocCount : null,
  groupCounts: {
    A1: manifestRows.filter((row) => row.group === "A1").length,
    A2: manifestRows.filter((row) => row.group === "A2").length,
    A3: manifestRows.filter((row) => row.group === "A3").length,
    A4: manifestRows.filter((row) => row.group === "A4").length,
  },
  rowCount: manifestRows.length,
  rows: manifestRows,
  planHash,
};

fs.mkdirSync(outPath.replace(/\/[^/]+$/, ""), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify({
  out: outPath,
  rowCount: manifest.rowCount,
  groupCounts: manifest.groupCounts,
  httpStatusCounts: manifestRows.reduce((acc, row) => { acc[row.httpStatus] = (acc[row.httpStatus] || 0) + 1; return acc; }, {}),
  planHash,
}, null, 2));
