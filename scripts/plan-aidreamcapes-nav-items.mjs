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

/**
 * Reviewed additions. Each entry is one customer-facing row that is appended
 * to the end of a menu group.
 *
 * The row copy is written for a customer: it says what the check does and
 * which public page answers the question. Production notes (script codes,
 * internal asset registries, delivery package state) stay in the internal
 * release documents and never reach the public menu.
 */
const ADDITIONS = [
  {
    menu: "Resources",
    group: "Learn and get help",
    label: "Video Review Checklist",
    href: "/blog/ai-video-review-checklist",
    description: "Check every clip against the script, the reference image and the asset library, so a scene never ships with the wrong wardrobe or props.",
    reason: "Customers ask how a delivered video is checked against the brief; the review checklist answers that."
  },
  {
    menu: "Resources",
    group: "Learn and get help",
    label: "Delivery Checks",
    href: "/digital-delivery",
    description: "Five checks run before a file is delivered: release readiness, pre-shoot checks, a delivery pass, a second delivery pass, and a brand-visual cross-check against the template.",
    reason: "The delivery policy explains the checkpoints that run before a file is handed over."
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
  const added = [];
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

  for (const addition of ADDITIONS) {
    const menu = (after.menus ?? []).find((entry) => entry?.label === addition.menu);
    assert(menu, `Menu ${addition.menu} is missing from the root navigation.`);
    const group = (menu.groups ?? []).find((entry) => entry?.label === addition.group);
    assert(group, `Group ${addition.group} is missing from ${addition.menu}.`);
    const items = Array.isArray(group.items) ? group.items : [];
    const existingIndex = items.findIndex((item) => item?.href === addition.href);
    if (existingIndex >= 0) {
      const existing = items[existingIndex];
      if (existing?.label === addition.label && Object.keys(existing).length === 2) {
        added.push({ ...addition, state: "already present" });
        continue;
      }
      // The row exists but carries a reviewed shape change, for example a
      // description that would render it as a rich card. Replace it in place.
      group.items = items.map((item, itemIndex) => (itemIndex === existingIndex
        ? { label: addition.label, href: addition.href }
        : item));
      added.push({ ...addition, state: "updated", index: existingIndex });
      continue;
    }
    assert(
      !items.some((item) => item?.label === addition.label),
      `A row named ${addition.label} already exists in ${addition.menu} / ${addition.group}.`
    );
    // No description: a row with a description renders as a rich card, and the
    // Resources dropdown lists every other row as a plain link.
    group.items = [...items, { label: addition.label, href: addition.href }];
    added.push({ ...addition, state: "added", index: group.items.length - 1 });
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
    additions: added,
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
      additions: added.length,
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
    removals: removed,
    additions: added
  }, null, 2));
} finally {
  await db.$disconnect();
}
