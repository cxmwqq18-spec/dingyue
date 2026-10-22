#!/usr/bin/env node
// Build the near slug redirect table for the Aidreamcapes storefront.
//
// A visitor or a link can arrive at a public address that is one character
// away from the real one: a wrong case, a plural instead of a singular, or a
// missing `-ads` suffix. Those addresses answer 404 today and the visit is
// lost. The table maps the near address to the canonical one with a 301.
//
// The table is a static file on purpose: the middleware answers redirects
// without touching the database.
//
//   node scripts/build-aidreamcapes-near-slug-redirects.mjs --apply
//
// The rules keep the table safe:
//   - a source is never an address that answers today;
//   - a target is always an address that answers today;
//   - a source is never a media card address, so no live detail page is
//     redirected away;
//   - an address that two public pages claim is left alone.

import fs from "node:fs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { nearSlugCandidates } from "./lib/aidreamcapes-near-slug-rules.mjs";

const target = argumentValue("--target") || "local";
const apply = hasArgument("--apply");
const outputPath = argumentValue("--out") || "src/lib/aidreamcapes-site-v2-near-slugs.json";
const reportPath = argumentValue("--report") || "reports/aidreamcapes-near-slug-redirects.json";
assertDatabaseTarget({ expectedTarget: target });

const SITE_ID = "site_aidreamcapes";
// Only these directories hold directory pages. The video and image tool roots
// are excluded because media detail pages live there under their own slugs.
async function publicPathSet() {
  const pathsFile = argumentValue("--paths-file");
  if (pathsFile) {
    return new Set(JSON.parse(fs.readFileSync(pathsFile, "utf8")).map((value) => String(value)));
  }
  const sitemapUrl = argumentValue("--sitemap-url") || "https://www.aivideosugc.com/sitemap.xml";
  const response = await fetch(sitemapUrl, {
    headers: { accept: "application/xml,text/xml", "user-agent": "aidreamcapes-audit/1.0 (+https://www.aivideosugc.com)" }
  });
  assert(response.ok, `Sitemap request failed with ${response.status}`);
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>\s*https?:\/\/[^/]+([^<]*?)\s*<\/loc>/g)].map((match) => match[1] || "/");
  assert(paths.length > 0, "Sitemap held no locations");
  return new Set(paths);
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { slug: true, contentJson: true }
  });
  const publicPaths = await publicPathSet();

  // Media cards answer under their own slug even though they are not public
  // pages. Their addresses must never become a redirect source.
  const cardSlugs = new Set();
  const cardAliases = new Set();
  for (const row of rows) {
    const json = JSON.stringify(row.contentJson);
    for (const match of json.matchAll(/"publicSlug"\s*:\s*"([a-z0-9-]+)"/g)) cardSlugs.add(match[1]);
    for (const match of json.matchAll(/"publicAliases"\s*:\s*\[[^\]]*?"([a-z0-9-]+)"/g)) cardAliases.add(match[1]);
  }
  for (const match of fs.readFileSync("src/lib/aidreamcapes-site-v2-redirects.json", "utf8").matchAll(/\[\s*"([^"]+)"/g)) {
    // An address that already redirects is handled by the exact table.
    cardAliases.add(match[1].split("/").pop() ?? match[1]);
  }

  const claims = new Map();
  const skipped = [];
  for (const path of [...publicPaths].sort()) {
    const candidates = nearSlugCandidates(path).map((value) => ({ path: value }));
    for (const candidate of candidates) {
      if (candidate.path === path) continue;
      if (publicPaths.has(candidate.path)) {
        skipped.push({ source: candidate.path, reason: "already-public" });
        continue;
      }
      const last = candidate.path.split("/").pop() ?? "";
      if (cardSlugs.has(last) || cardAliases.has(last)) {
        skipped.push({ source: candidate.path, reason: "media-card-address" });
        continue;
      }
      const existing = claims.get(candidate.path);
      if (existing && existing !== path) {
        skipped.push({ source: candidate.path, reason: `ambiguous:${existing}` });
        claims.delete(candidate.path);
        continue;
      }
      claims.set(candidate.path, path);
    }
  }

  const table = [...claims.entries()].map(([from, to]) => [from, to]).sort((a, b) => a[0].localeCompare(b[0]));
  const report = {
    contract: "aidreamcapes-near-slugs-v1",
    siteId: SITE_ID,
    target,
    publicPathCount: publicPaths.size,
    mediaCardAddressCount: cardSlugs.size + cardAliases.size,
    entries: table.length,
    planHash: crypto.createHash("sha256").update(JSON.stringify({ contract: "aidreamcapes-near-slugs-v1", siteId: SITE_ID, table })).digest("hex"),
    table,
    skipped: skipped.slice(0, 200),
    skippedCount: skipped.length,
    generatedAt: new Date().toISOString()
  };

  if (apply) {
    fs.mkdirSync("src/lib", { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(table, null, 2)}\n`);
  }
  fs.mkdirSync("reports", { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    publicPathCount: report.publicPathCount,
    entries: report.entries,
    skipped: report.skippedCount,
    planHash: report.planHash,
    output: apply ? outputPath : null,
    report: reportPath
  }, null, 2));
} finally {
  await db.$disconnect();
}
