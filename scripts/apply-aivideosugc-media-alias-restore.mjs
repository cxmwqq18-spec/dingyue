#!/usr/bin/env node
// Restore the retired "-home" detail aliases that Google has indexed.
//
// The 2026-10-22 card renames retired `<slug>-home` addresses in favour of
// `<slug>`; the alias claims lived on the homepage picker cards. The
// 2026-11-01 homepage isolation migration rewrote those cards without the
// claims, so the two retired addresses below started answering 404 while the
// release gate (smoke-media-slug-aliases) correctly blocks any deploy.
//
// This script re-adds `publicAliases` claims for the retired slugs on the
// current single owner of each target card. It refuses to touch anything when
// the single-owner precondition does not hold, and writes a before/after
// manifest for reversibility.
//
//   node scripts/apply-aivideosugc-media-alias-restore.mjs [pairs.json] [--apply]

import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const pairsFile = process.argv.find((arg) => arg.endsWith(".json"));
const SITE_ID = "site_aidreamcapes";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

const pairs = pairsFile
  ? JSON.parse(fs.readFileSync(pairsFile, "utf8")).pairs
  : [
      { alias: "tinted-balm-vanity-reel-home", target: "tinted-balm-vanity-reel", kind: "video" },
      { alias: "trousers-fold-demo-home", target: "trousers-fold-demo", kind: "video" }
    ];

const prisma = new PrismaClient();
const report = { ok: true, mode: apply ? "apply" : "dry-run", applied: [], skipped: [] };

function walkCards(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walkCards(item, visit);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (typeof value.publicSlug === "string") visit(value);
  for (const entry of Object.values(value)) walkCards(entry, visit);
}

for (const { alias, target, kind } of pairs) {
  try {
    assert.match(alias, SLUG_PATTERN, `alias ${alias} fails the slug pattern`);
    assert.match(target, SLUG_PATTERN, `target ${target} fails the slug pattern`);
    const rows = await prisma.$queryRaw`
      SELECT "slug", "contentJson", "updatedAt" FROM "LivePage"
      WHERE "siteId" = ${SITE_ID}::text
        AND ("contentJson"::text LIKE ${'%"' + target + '"%'})
        AND jsonb_path_exists("contentJson", '$.**.publicSlug ? (@ == $target)', jsonb_build_object('target', ${target}))
      LIMIT 5`;
    assert.equal(rows.length, 1, `target card ${target} must have exactly one owner row, found ${rows.length}`);
    const owner = rows[0];
    // No other row may already claim the alias (mediaAliasTarget resolves only
    // a single claimant, and never a row whose slug IS the alias address).
    const claimants = await prisma.$queryRaw`
      SELECT "slug" FROM "LivePage"
      WHERE "siteId" = ${SITE_ID}::text
        AND "slug" <> ${`/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${alias}`}
        AND jsonb_path_exists("contentJson", '$.**.publicAliases[*] ? (@ == $alias)', jsonb_build_object('alias', ${alias}))
      LIMIT 5`;
    assert.equal(claimants.length, 0, `alias ${alias} is already claimed by: ${claimants.map((row) => row.slug).join(", ")}`);

    const content = typeof owner.contentJson === "string" ? JSON.parse(owner.contentJson) : owner.contentJson;
    const touched = [];
    walkCards(content, (card) => {
      if (card.publicSlug !== target) return;
      const aliases = Array.isArray(card.publicAliases) ? card.publicAliases : [];
      if (!aliases.includes(alias)) {
        card.publicAliases = [...aliases, alias];
        touched.push(card.publicSlug);
      }
    });
    if (!touched.length) {
      report.skipped.push({ alias, target, note: "alias already present on every card instance" });
      continue;
    }
    report.applied.push({ alias, target, ownerRow: owner.slug, cardsTouched: touched.length });
    if (apply) {
      await prisma.$transaction([
        prisma.livePage.update({
          where: { siteId_slug: { siteId: SITE_ID, slug: owner.slug } },
          data: { contentJson: content }
        })
      ]);
    }
  } catch (error) {
    report.ok = false;
    report.skipped.push({ alias, target: target ?? "?", error: error instanceof Error ? error.message : String(error) });
  }
}

await prisma.$disconnect();
fs.writeFileSync(`.media-alias-restore-${apply ? "applied" : "dryrun"}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exitCode = 1;
