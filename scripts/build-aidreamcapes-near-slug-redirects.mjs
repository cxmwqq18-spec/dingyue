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
//   - an address that two public pages claim keeps the first claimant
//     (sorted), so every non-live near address still answers.

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
  const paths = [...xml.matchAll(/<loc>\s*https?:\/\/[^/]+([^<]*?)\s*<\/loc>/g)].map((match) => {
    // Sitemap rows may carry a query (the indexable /templates?kind= catalogs).
    // The near slug table and the middleware match pathnames only, so every
    // address is normalized to its pathname here — a query row folds into the
    // page that answers it, and never becomes a source or a target.
    const raw = match[1] || "/";
    const withoutFragment = raw.split("#")[0];
    const queryIndex = withoutFragment.indexOf("?");
    return (queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex)) || "/";
  });
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
  const allPageSlugs = new Set(rows.map((row) => row.slug));

  // Media cards answer under their own slug even though they are not public
  // pages. Their addresses must never become a redirect source. Every alias
  // in a publicAliases array counts — a first-element-only capture used to
  // leak the remaining aliases into this table as 301 sources, which took
  // the address away from the detail resolver's permanent 308.
  const cardSlugs = new Set();
  const cardAliases = new Set();
  const detailCards = new Map();
  const collectCards = (value) => {
    if (Array.isArray(value)) {
      for (const item of value) collectCards(item);
      return;
    }
    if (!value || typeof value !== "object") return;
    if (typeof value.publicSlug === "string") cardSlugs.add(value.publicSlug);
    if (Array.isArray(value.publicAliases)) {
      for (const alias of value.publicAliases) {
        if (typeof alias === "string") cardAliases.add(alias);
      }
    }
    if (
      typeof value.publicSlug === "string"
      && /^[a-z0-9][a-z0-9-]*$/.test(value.publicSlug)
      && (value.kind === "photo" || value.kind === "video" || value.kind === "clip" || value.kind === "scene")
      && !value.detailAliasOf
      && value.image && typeof value.image.src === "string" && value.image.src
      && (typeof value.label === "string" ? value.label : typeof value.title === "string" ? value.title : "")
    ) {
      // Mirrors mediaKindOf: photo stays photo; video, clip and scene are all
      // video detail pages.
      detailCards.set(value.publicSlug, value.kind === "photo" ? "photo" : "video");
    }
    for (const child of Object.values(value)) collectCards(child);
  };
  for (const row of rows) collectCards(row.contentJson);
  for (const match of fs.readFileSync("src/lib/aidreamcapes-site-v2-redirects.json", "utf8").matchAll(/\[\s*"([^"]+)"/g)) {
    // An address that already redirects is handled by the exact table.
    cardAliases.add(match[1].split("/").pop() ?? match[1]);
  }

  // Media detail pages are card projections: they answer 200 under
  // /ai-video-generation/<slug> and /ai-image-generation/<slug> and submit to
  // the sitemap even though they have no LivePage row of their own. Enumerate
  // them from the same card data so their case variants become redirect
  // sources. Alias slugs redirect permanently to their canonical detail page,
  // so they are targets for the exact redirect table, never near addresses.
  const DETAIL_ROOTS = { video: "/ai-video-generation/", photo: "/ai-image-generation/" };
  for (const [slug, kind] of detailCards) {
    if (!cardAliases.has(slug)) publicPaths.add(`${DETAIL_ROOTS[kind]}${slug}`);
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
      // A page outside the sitemap still answers. The table must never take
      // an address away from a page that exists.
      if (allPageSlugs.has(candidate.path)) {
        skipped.push({ source: candidate.path, reason: "existing-page" });
        continue;
      }
      const segments = candidate.path.split("/");
      const last = segments.pop() ?? "";
      const root = segments.join("/");
      // Only an address that answers today must stay a redirect source away:
      // the card lookup is case-sensitive (the middleware matches exact
      // paths), so a case variant of a card address is safe to redirect.
      if ((root === "/ai-video-generation" || root === "/ai-image-generation") && (cardSlugs.has(last) || cardAliases.has(last))) {
        skipped.push({ source: candidate.path, reason: "media-card-address" });
        continue;
      }
      const existing = claims.get(candidate.path);
      if (existing && existing !== path) {
        // Two public pages generate the same near address. The table carries
        // one entry per source, so keep the first claimant (the paths iterate
        // sorted, which makes the choice deterministic) and record the other
        // claimants. The SEO contract requires every non-live candidate to
        // answer: a redirect to one of the pages the visitor may have meant
        // beats a 404.
        skipped.push({ source: candidate.path, reason: `ambiguous-kept:${existing}`, alsoClaimedBy: path });
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
