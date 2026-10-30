#!/usr/bin/env node
// Plan the Aidreamcapes mega-menu group hubHref fields (Step 2 of
// docs/aivideosugc-template-cases-navigation-plan.md).
//
// Adds hubHref to the three Templates menu groups on the homepage
// LivePage siteNavigation: By industry -> /industries, By platform ->
// /platforms, By occasion -> /occasions. Field-level change on one row;
// every other menu, group, and link is untouched.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-nav-hub-hrefs.mjs --target=local
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-nav-hub-hrefs-2026-10-30-v1";
const MENU_LABEL = "Templates";
const HUB_HREFS = {
  "By industry": "/industries",
  "By platform": "/platforms",
  "By occasion": "/occasions"
};
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] || "local";
assert.ok(["local", "production"].includes(target), "--target must be local or production");

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const home = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: "/" } },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert(home, "Homepage LivePage row is missing");
  const menus = home.contentJson?.siteNavigation?.menus;
  assert(Array.isArray(menus), "siteNavigation.menus is missing on the homepage row");
  const menu = menus.find((entry) => entry?.label === MENU_LABEL);
  assert(menu, `The ${MENU_LABEL} menu is missing from siteNavigation.menus`);

  const operations = [];
  for (const group of menu.groups ?? []) {
    const hubHref = HUB_HREFS[group?.label];
    if (!hubHref) continue;
    const before = group.hubHref ?? null;
    operations.push({
      groupLabel: group.label,
      hubHref,
      before,
      beforeHash: hash(before),
      afterHash: hash(hubHref)
    });
  }
  assert.equal(operations.length, Object.keys(HUB_HREFS).length, `Expected ${Object.keys(HUB_HREFS).length} target groups, found ${operations.length}: ${operations.map((op) => op.groupLabel).join(", ")}`);

  // The referenced hub pages must exist before the titles can link to them.
  const hubRows = await db.livePage.findMany({
    where: { siteId: SITE_ID, slug: { in: Object.values(HUB_HREFS) } },
    select: { slug: true }
  });
  const missingHubs = Object.values(HUB_HREFS).filter((slug) => !hubRows.some((entry) => entry.slug === slug));
  assert.equal(missingHubs.length, 0, `Missing hub pages: ${missingHubs.join(", ")}. Apply the /occasions hub (Step 1) first.`);

  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    page: { slug: home.slug, baseHash: pageHash(home) },
    jsonPath: `siteNavigation.menus[label=${MENU_LABEL}].groups[].hubHref`,
    operations
  };
  manifest.planHash = hash({ page: manifest.page, operations: manifest.operations });

  const manifestPath = path.resolve(process.cwd(), `scripts/manifests/aidreamcapes-nav-hub-hrefs-${target}-2026-10-30.json`);
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ ok: true, manifestPath, planHash: manifest.planHash, operations: operations.length }, null, 2));
} finally {
  await db.$disconnect();
}
