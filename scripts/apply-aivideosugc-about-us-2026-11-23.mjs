#!/usr/bin/env node
// AIVideosUGC /about-us redesign apply — 2026-11-23.
// Replaces the published about page with the reviewed
// about-aivideosugc-integrated.html design: one v2 about-company section,
// company/team/partner copy in LivePage.contentJson, and the matching
// Organization/Service/FAQ/AboutPage/Breadcrumb JSON-LD. The public header and
// footer stay in the shared storefront shell; only the page section changes.
// The slug, canonical URL, and indexability stay exactly where they are
// (google-indexed-url-safety: content-only change, no route move).
//
//   dry run:  node scripts/apply-aivideosugc-about-us-2026-11-23.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-about-us-2026-11-23.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name and the
//   base hash printed by a fresh production dry run.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-about-us-2026-11-23";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-about-us-2026-11-23.json", import.meta.url);
const ROLLBACK_PATH = new URL("./manifests/aivideosugc-about-us-2026-11-23.rollback.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const rollback = hasArgument("--rollback");
const rollbackManifest = rollback ? JSON.parse(fs.readFileSync(ROLLBACK_PATH, "utf8")) : undefined;
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function assertManifestShape() {
  const data = manifest.data;
  assert.equal(manifest.slug, "/about-us");
  assert.equal(manifest.layout, "about-company");
  assert.ok(data && typeof data === "object", "Manifest data is missing.");
  assert.ok(Array.isArray(data.nav) && data.nav.length > 0, "Manifest nav is missing.");
  assert.ok(Array.isArray(data.team?.groups) && data.team.groups.length === 3, "Manifest must carry all three team groups.");
  assert.equal(data.team.groups.reduce((count, group) => count + group.members.length, 0), 9, "Manifest must carry all nine team members.");
  assert.ok(Array.isArray(data.faq?.items) && data.faq.items.length === 8, "Manifest must carry the eight FAQ entries.");
  assert.ok(Array.isArray(manifest.mediaManifest) && manifest.mediaManifest.length === 11, "Manifest must declare all eleven images.");
  for (const media of manifest.mediaManifest) {
    assert.ok(media.alt && media.alt.trim().length >= 12, `Image ${media.src} needs a descriptive alt.`);
    const assetPath = media.src.startsWith("/") ? path.join(process.cwd(), "public", media.src) : undefined;
    assert.ok(assetPath && fs.existsSync(assetPath), `Image ${media.src} is not present in public/.`);
  }
  const urls = JSON.stringify(manifest.seo?.jsonLd ?? {});
  assert.ok(urls.includes("https://www.aivideosugc.com/about-us"), "JSON-LD must point at the published /about-us URL.");
  assert.ok(manifest.seo?.description?.length >= 80, "SEO description is too short.");
}

function nextContentJson(current) {
  const base = current && typeof current === "object" ? current : {};
  const sections = base.sections && typeof base.sections === "object" ? base.sections : {};
  const main = sections.v2_main && typeof sections.v2_main === "object" ? sections.v2_main : {};
  return {
    ...base,
    seo: manifest.seo,
    mediaManifest: manifest.mediaManifest,
    contentContract: manifest.contentContract,
    sectionsOrder: ["v2_main"],
    sections: {
      ...sections,
      v2_main: {
        ...main,
        type: "aidreamcapes_v2_page",
        blocks: [],
        settings: {
          ...(main.settings && typeof main.settings === "object" ? main.settings : {}),
          layout: manifest.layout,
          data: manifest.data
        }
      }
    }
  };
}

if (rollback) {
  assert.equal(rollbackManifest.siteId, siteId);
  assert.equal(rollbackManifest.slug, "/about-us");
  assert.equal(hash(rollbackManifest.contentJson), rollbackManifest.baseHash, "Rollback payload does not match the reviewed original hash.");
} else {
  assertManifestShape();
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: manifest.slug },
    select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true }
  });
  assert.equal(rows.length, 1, `Expected exactly one ${siteId} LivePage at ${manifest.slug} on ${target}; found ${rows.length}.`);
  const row = rows[0];
  assert.equal(row.siteId, siteId, "Refusing to write outside site_aidreamcapes.");

  const currentHash = hash(row.contentJson);
  const next = rollback ? rollbackManifest.contentJson : nextContentJson(row.contentJson);
  const nextTitle = rollback ? rollbackManifest.title : manifest.title;
  const nextLayout = rollback ? next?.sections?.v2_main?.settings?.layout : manifest.layout;
  const nextHash = hash(next);
  const currentLayout = row.contentJson?.sections?.v2_main?.settings?.layout;
  const alreadyApplied = nextHash === currentHash;

  console.log(`[about-us] mode: ${rollback ? "rollback" : "apply"}; target: ${target}`);
  console.log(`[about-us] row: ${row.id} (${row.slug})`);
  console.log(`[about-us] current layout: ${currentLayout ?? "(none)"}; title: ${row.title}`);
  console.log(`[about-us] base hash: ${currentHash}`);
  console.log(`[about-us] next hash: ${nextHash}${rollback ? " (restoring saved contentJson)" : ""}`);
  if (!rollback) console.log(`[about-us] images: ${manifest.mediaManifest.length}; team members: ${manifest.data.team.groups.reduce((count, group) => count + group.members.length, 0)}`);

  if (argumentValue("--base-hash")) {
    assert.equal(currentHash, argumentValue("--base-hash"), `${manifest.slug} changed since the reviewed dry run; refusing to apply.`);
  }

  if (alreadyApplied) {
    console.log("[about-us] already in the planned state; nothing to write.");
  } else if (!apply) {
    console.log("[about-us] dry run only. Re-run with --apply to write the relational LivePage row.");
  } else {
    const updated = await db.livePage.update({
      where: { id: row.id },
      data: {
        title: nextTitle,
        contentJson: next
      }
    });
    const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, title: true } });
    assert.equal(hash(readback.contentJson), nextHash, "Readback content hash does not match the planned payload.");
    assert.equal(readback.contentJson?.sections?.v2_main?.settings?.layout, nextLayout);
    assert.equal(readback.title, nextTitle);
    console.log(`[about-us] wrote ${row.id} at ${updated.updatedAt.toISOString()}; readback verified.`);
  }
} finally {
  await db.$disconnect();
}
