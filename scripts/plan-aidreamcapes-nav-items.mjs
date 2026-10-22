#!/usr/bin/env node
// Read-only plan for Aidreamcapes header navigation items.
//
// The public header navigation is one object: the root page's
// `LivePage.contentJson.siteNavigation`. The runtime reads it from
// `src/components/theme-renderer.tsx`, so a menu row is a single reviewed field
// on one relational row.
//
// This plan removes a menu row that is reviewed as redundant. It never adds
// internal notes, never touches the footer, and never changes a page body.
//
// Usage:
//   node --env-file=.env scripts/plan-aidreamcapes-nav-items.mjs --target=production --write-manifest
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-nav-item-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-nav-items-${target}-2026-10-22.json`
);

/** Reviewed removals. Each entry names one menu row that is dropped. */
const REMOVALS = [
  {
    menu: "Resources",
    group: "Learn and get help",
    label: "Templates",
    href: "/templates",
    reason: "The header already carries a dedicated Templates menu and the footer keeps the templates link, so the Resources dropdown does not need a second templates row."
  }
];

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
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
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

assertDatabaseTarget({ expectedTarget: target });

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: "/" } },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    }
  });
  assert(row, `No root LivePage for ${SITE_ID}.`);
  const navigation = record(record(row.contentJson)?.siteNavigation);
  assert(navigation, "The root page has no siteNavigation object.");
  assert.equal(navigation.version, 2, "The root navigation is not the reviewed v2 shape.");

  const before = structuredClone(navigation);
  const after = structuredClone(navigation);
  const removed = [];
  for (const removal of REMOVALS) {
    const menu = (after.menus ?? []).find((entry) => entry?.label === removal.menu);
    assert(menu, `Menu ${removal.menu} is missing from the root navigation.`);
    const group = (menu.groups ?? []).find((entry) => entry?.label === removal.group);
    assert(group, `Group ${removal.group} is missing from ${removal.menu}.`);
    const items = Array.isArray(group.items) ? group.items : [];
    const index = items.findIndex((item) => item?.label === removal.label && item?.href === removal.href);
    if (index < 0) {
      const alreadyGone = !(before.menus ?? [])
        .find((entry) => entry?.label === removal.menu)
        ?.groups?.find((entry) => entry?.label === removal.group)
        ?.items?.some((item) => item?.label === removal.label && item?.href === removal.href);
      if (alreadyGone) {
        removed.push({ ...removal, state: "already removed" });
        continue;
      }
      throw new Error(`Menu row ${removal.label} (${removal.href}) is not in ${removal.menu} / ${removal.group}.`);
    }
    assert.equal(items.filter((item) => item?.href === removal.href).length, 1, `Menu row ${removal.href} is not unique in ${removal.menu}.`);
    group.items = items.filter((_, itemIndex) => itemIndex !== index);
    removed.push({ ...removal, state: "removed", index });
  }

  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    page: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      pageType: row.pageType,
      templateKey: row.templateKey,
      baseHash: pageHash(row)
    },
    removals: removed,
    before,
    after
  };
  const manifest = {
    ok: true,
    mode: "plan",
    ...body,
    generatedAt: new Date().toISOString(),
    owner: "LivePage.contentJson.siteNavigation",
    rules: {
      scope: "the header navigation only; the footer and every page body stay untouched",
      rollback: "the manifest carries the reviewed navigation object before the removal"
    },
    summary: {
      livePageRowsScanned: 1,
      removals: removed.length,
      menuRowsBefore: (before.menus ?? []).reduce((total, menu) => total + (menu?.groups ?? []).reduce((sum, group) => sum + (group?.items ?? []).length, 0), 0),
      menuRowsAfter: (after.menus ?? []).reduce((total, menu) => total + (menu?.groups ?? []).reduce((sum, group) => sum + (group?.items ?? []).length, 0), 0)
    },
    planHash: hash(body)
  };

  if (writeManifest) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: manifest.ok,
    contract: CONTRACT,
    target,
    planHash: manifest.planHash,
    outPath: writeManifest ? outPath : null,
    summary: manifest.summary,
    removals: removed
  }, null, 2));
} finally {
  await db.$disconnect();
}
