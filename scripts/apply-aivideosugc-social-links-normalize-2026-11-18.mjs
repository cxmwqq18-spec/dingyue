#!/usr/bin/env node
// AIVideosUGC social profile normalization — 2026-11-18.
// Owner directive: the footer social URLs are the single authority. The v2 footer
// renders LivePage "/" siteNavigation.footer.socialLinks, but ThemeSettings still
// carried two legacy scalar sets pointing at @aidreamcapes accounts.
// This apply:
//   1. asserts the LivePage footer navigation equals the canonical nine profiles,
//   2. asserts ThemeSettings navigation socialLinks still equals the same nine,
//   3. rewrites only the reviewed social URL fields in draftJson and publishedJson
//      to the same nine profiles (threads has no canonical account, so it is
//      cleared rather than pointing at a foreign brand).
// Compare-and-set on the reviewed current values plus an updatedAt guard; every
// other ThemeSettings field is hashed before and after and must stay identical.
//   dry run:  node scripts/apply-aivideosugc-social-links-normalize-2026-11-18.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-social-links-normalize-2026-11-18.mjs --target=local --apply
//   prod:     ... --target=production --confirm=aivideosugc-social-links-normalize-2026-11-18 --apply
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-social-links-normalize-2026-11-18";
const manifest = JSON.parse(fs.readFileSync(new URL("./manifests/aivideosugc-social-links-normalize-2026-11-18.json", import.meta.url), "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const baseHash = argumentValue("--base-hash");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);

assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const canonicalLinks = manifest.footerSocialLinks;
assert.equal(new Set(canonicalLinks.map((link) => link.href)).size, canonicalLinks.length, "Canonical footer social links contain duplicates.");
const operations = manifest.operations;
assert(Array.isArray(operations) && operations.length > 0, "Manifest must define at least one operation.");
for (const operation of operations) {
  assert(Array.isArray(operation.path) && operation.path.length > 0, `${operation.id}: path is required.`);
  assert(Object.keys(operation.expectedCurrentUrls).length > 0, `${operation.id}: expectedCurrentUrls is required.`);
  assert.deepEqual(Object.keys(operation.nextUrls).sort(), Object.keys(operation.expectedCurrentUrls).sort(), `${operation.id}: next/current keys differ.`);
}

// The project link set is key/label/href order-sensitive; keep it stable.
function linkKey(links) {
  return JSON.stringify((Array.isArray(links) ? links : []).map((link) => ({
    key: typeof link?.key === "string" ? link.key : "",
    label: typeof link?.label === "string" ? link.label : "",
    href: typeof link?.href === "string" ? link.href : ""
  })));
}
const canonicalLinkKey = linkKey(canonicalLinks);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function assertCanonicalFooterLinks(links, label) {
  assert.equal(linkKey(links), canonicalLinkKey, `${label} socialLinks drifted from the canonical footer profiles.`);
}

function nodeAt(json, path) {
  let node = json;
  for (const key of path) node = node?.[key];
  return node;
}

const db = new PrismaClient();
try {
  const homePage = await db.livePage.findUnique({
    where: { siteId_slug: { siteId, slug: "/" } },
    select: { contentJson: true }
  });
  assert(homePage, "LivePage / does not exist; cannot verify the footer authority.");
  const homeNavigation = homePage.contentJson?.siteNavigation;
  assert(Array.isArray(homeNavigation?.footer?.socialLinks), "LivePage / must carry the footer socialLinks that the public footer renders.");
  assertCanonicalFooterLinks(homeNavigation.footer.socialLinks, "LivePage / footer");

  const row = await db.themeSettings.findUnique({
    where: { siteId },
    select: { id: true, siteId: true, draftJson: true, publishedJson: true, updatedAt: true }
  });
  assert(row, `ThemeSettings for ${siteId} does not exist on ${target}.`);
  if (baseHash) {
    assert.equal(hash({ draftJson: row.draftJson, publishedJson: row.publishedJson }), baseHash, "ThemeSettings changed since the reviewed dry run; refusing to apply.");
  }

  let changed = false;
  const nextJsons = {};
  for (const field of ["draftJson", "publishedJson"]) {
    const json = structuredClone(row[field]);
    assertCanonicalFooterLinks(json?.aidreamcapesV2Navigation?.footer?.socialLinks, `${field}: navigation`);

    for (const operation of operations) {
      const settings = nodeAt(json, operation.path);
      assert(settings && typeof settings === "object", `${field}: ${operation.id} target object is missing at ${operation.path.join(".")}.`);
      for (const [key, expected] of Object.entries(operation.expectedCurrentUrls)) {
        const current = settings[key];
        const next = operation.nextUrls[key];
        assert(
          current === expected || current === next,
          `${field}: ${operation.id}.${key} is neither the reviewed current value nor the canonical value; refusing to apply.`
        );
        settings[key] = next;
        if (current !== next) changed = true;
      }
    }
    nextJsons[field] = json;
  }

  if (!changed) {
    console.log(JSON.stringify({
      ok: true,
      noop: true,
      siteId,
      canonicalProfiles: canonicalLinks.map((link) => link.href),
      draftHash: hash(nextJsons.draftJson),
      publishedHash: hash(nextJsons.publishedJson)
    }, null, 2));
    process.exit(0);
  }

  if (!apply) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      siteId,
      baseHash: hash({ draftJson: row.draftJson, publishedJson: row.publishedJson }),
      canonicalProfiles: canonicalLinks.map((link) => link.href),
      plannedPaths: operations.flatMap((operation) =>
        Object.keys(operation.expectedCurrentUrls).map((key) => `${operation.path.join(".")}.${key}`)
      ),
      operations: operations.map((operation) => ({
        id: operation.id,
        path: operation.path.join("."),
        from: operation.expectedCurrentUrls,
        to: operation.nextUrls
      })),
      nextPublishedHash: hash(nextJsons.publishedJson)
    }, null, 2));
    process.exit(0);
  }

  const updated = await db.themeSettings.updateMany({
    where: { siteId, updatedAt: row.updatedAt },
    data: { draftJson: nextJsons.draftJson, publishedJson: nextJsons.publishedJson }
  });
  assert.equal(updated.count, 1, "ThemeSettings changed during the write; refusing to report success.");

  const after = await db.themeSettings.findUnique({
    where: { siteId },
    select: { draftJson: true, publishedJson: true, updatedAt: true }
  });
  assert(after, "Readback returned no ThemeSettings row.");
  for (const field of ["draftJson", "publishedJson"]) {
    assertCanonicalFooterLinks(after[field]?.aidreamcapesV2Navigation?.footer?.socialLinks, `${field}: readback navigation`);
    for (const operation of operations) {
      const settings = nodeAt(after[field], operation.path);
      assert(settings && typeof settings === "object", `${field}: readback lost ${operation.id}.`);
      for (const [key, next] of Object.entries(operation.nextUrls)) {
        assert.equal(settings[key], next, `Readback mismatch on ${field}.${operation.id}.${key}.`);
      }
    }
  }

  console.log(JSON.stringify({
    ok: true,
    applied: true,
    siteId,
    updatedAt: after.updatedAt,
    canonicalProfiles: canonicalLinks.map((link) => link.href),
    operations: operations.map((operation) => operation.id),
    draftHash: hash(after.draftJson),
    publishedHash: hash(after.publishedJson)
  }, null, 2));
} finally {
  await db.$disconnect();
}
