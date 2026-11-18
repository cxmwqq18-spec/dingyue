#!/usr/bin/env node
// AIVideosUGC navigation thumbnail alt text — 2026-11-18.
// The public footer/nav images were rendering with alt="". This manifest adds
// a reviewed, image-specific alt to each of the 19 menu thumbnails and changes
// nothing else in the navigation or the homepage content.
//   dry run: node scripts/apply-aivideosugc-navigation-image-alts-2026-11-18.mjs --target=production
//   apply:   ... --target=production --confirm=aivideosugc-navigation-image-alts-2026-11-18 --apply
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-navigation-image-alts-2026-11-18";
const manifest = JSON.parse(fs.readFileSync(new URL("./manifests/aivideosugc-navigation-image-alts-2026-11-18.json", import.meta.url), "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const page = manifest.page;
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHash = argumentValue("--base-hash");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);

assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
assert(Array.isArray(manifest.entries) && manifest.entries.length > 0, "Manifest has no alt entries.");

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
// Compare the navigation and the rest of the page without any `alt` fields, so
// a successful write can only differ by the reviewed alt additions.
function withoutNavigationAlt(value) {
  if (Array.isArray(value)) return value.map(withoutNavigationAlt);
  if (!value || typeof value !== "object") return value;
  const copy = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "alt") continue;
    copy[key] = withoutNavigationAlt(entry);
  }
  return copy;
}
function contentRestHash(contentJson) {
  const copy = structuredClone(contentJson);
  if (copy.siteNavigation) copy.siteNavigation = withoutNavigationAlt(copy.siteNavigation);
  return hash(copy);
}
function navigationLinks(navigation) {
  const links = [];
  for (const menu of navigation?.menus ?? []) {
    for (const group of menu.groups ?? []) {
      for (const item of group.items ?? []) if (item && typeof item === "object") links.push(item);
    }
    for (const item of menu.popular ?? []) if (item && typeof item === "object") links.push(item);
  }
  return links;
}

const db = new PrismaClient();
try {
  const row = await db.livePage.findUnique({
    where: { siteId_slug: { siteId, slug: page.slug } },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert(row, `LivePage ${page.slug} does not exist on ${target}.`);
  assert.equal(row.id, page.id, `LivePage ${page.slug} id changed; refusing to apply.`);
  if (baseHash) assert.equal(hash(row.contentJson), baseHash, `${page.slug} contentJson changed since the reviewed dry run; refusing to apply.`);

  const contentJson = structuredClone(row.contentJson);
  const navigation = contentJson.siteNavigation;
  assert(navigation && navigation.version === 2, "Homepage navigation is missing or not v2.");
  const links = navigationLinks(navigation);
  const restHashBefore = contentRestHash(row.contentJson);

  const changes = [];
  for (const entry of manifest.entries) {
    const matches = links.filter((link) => link.href === entry.href);
    assert.equal(matches.length, 1, `Expected exactly one navigation link for ${entry.href}; found ${matches.length}.`);
    const link = matches[0];
    assert.equal(link.label, entry.label, `Label changed for ${entry.href}; refusing to apply.`);
    assert.equal(link.image, entry.image, `Image changed for ${entry.href}; refusing to apply.`);
    if (link.alt === entry.alt) continue;
    assert(!link.alt || link.alt === entry.alt, `Unexpected existing alt on ${entry.href}; refusing to overwrite.`);
    link.alt = entry.alt;
    changes.push({ href: entry.href, alt: entry.alt });
  }

  if (!changes.length) {
    console.log(JSON.stringify({ ok: true, slug: page.slug, noop: true, contentRestHash: restHashBefore }, null, 2));
    process.exit(0);
  }

  if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      slug: page.slug,
      baseHash: hash(row.contentJson),
      plannedChanges: changes,
      contentRestHash: restHashBefore
    }, null, 2));
    process.exit(0);
  }

  const updated = await db.livePage.update({
    where: { id: row.id },
    data: { contentJson },
    select: { id: true, slug: true, updatedAt: true }
  });
  const reread = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true } });
  const after = reread?.contentJson;
  assert(after, "Readback returned no row.");
  assert.equal(contentRestHash(after), restHashBefore, "Fields other than the reviewed alts changed; refusing to report success.");

  const afterLinks = navigationLinks(after.siteNavigation);
  for (const entry of manifest.entries) {
    const matches = afterLinks.filter((link) => link.href === entry.href);
    assert.equal(matches.length, 1, `Readback lost ${entry.href}.`);
    assert.equal(matches[0].alt, entry.alt, `Readback alt mismatch on ${entry.href}.`);
    assert.equal(matches[0].label, entry.label, `Readback changed label on ${entry.href}.`);
    assert.equal(matches[0].image, entry.image, `Readback changed image on ${entry.href}.`);
  }

  console.log(JSON.stringify({
    ok: true,
    applied: true,
    slug: page.slug,
    updatedAt: updated.updatedAt,
    changedCount: changes.length,
    contentRestHash: restHashBefore,
    nextContentHash: hash(after)
  }, null, 2));
} finally {
  await db.$disconnect();
}
