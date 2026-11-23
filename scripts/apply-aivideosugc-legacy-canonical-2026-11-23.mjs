#!/usr/bin/env node
// AIVideosUGC legacy canonical cleanup — 2026-11-23.
// A dozen old policy/help rows still store a stale canonical (some point at
// aidreamcapes.com or at the alias itself). Their routes already answer 308 to
// the canonical page, so this only cleans the stored field: the public HTML and
// redirects do not change. Field-level, idempotent, site-scoped.
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-legacy-canonical-2026-11-23";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-legacy-canonical-2026-11-23.json", import.meta.url);
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const CANONICAL = {
  "/policies/privacy": "/privacy",
  "/privacy-policy": "/privacy",
  "/policies/cookies": "/cookies",
  "/cookie-policy": "/cookies",
  "/policies/terms": "/terms",
  "/terms-of-service": "/terms",
  "/policies/children-privacy": "/children-privacy",
  "/policies/content": "/content",
  "/policies/refunds": "/refunds",
  "/policies/shipping": "/digital-delivery",
  "/policies/state-privacy": "/state-privacy",
  "/help": "/faq"
};
const ORIGIN = "https://www.aivideosugc.com";

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: Object.keys(CANONICAL) } },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  const plans = rows.map((row) => {
    const next = structuredClone(row.contentJson);
    const seo = next?.seo;
    assert(seo && typeof seo === "object", `${row.slug}: seo block missing.`);
    const canonicalPath = CANONICAL[row.slug];
    const canonical = `${ORIGIN}${canonicalPath}`;
    seo.canonical = canonical;
    seo.canonicalPath = canonicalPath;
    return { slug: row.slug, row, next, changed: hash(next) !== hash(row.contentJson) };
  });
  const changed = plans.filter((plan) => plan.changed);
  if (apply) {
    for (const plan of changed) {
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: { contentJson: plan.next }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
    }
    const readback = await db.livePage.findMany({ where: { siteId, slug: { in: plans.map((plan) => plan.slug) } }, select: { slug: true, contentJson: true } });
    const bySlug = new Map(readback.map((row) => [row.slug, row.contentJson]));
    for (const plan of plans) assert.equal(hash(bySlug.get(plan.slug)), hash(plan.next), `Readback mismatch on ${plan.slug}.`);
  }
  fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
  const manifest = {
    date: "2026-11-23",
    siteId,
    target,
    mode: apply ? "applied" : "plan",
    confirm: CONFIRM_NAME,
    pages: plans.map((plan) => ({ slug: plan.slug, canonical: plan.next.seo.canonical, canonicalPath: plan.next.seo.canonicalPath, changed: plan.changed })),
    note: "Stored canonical cleanup only; routes already 308 to these canonical pages."
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, mode: manifest.mode, target, changed: changed.length, total: plans.length, manifest: MANIFEST_PATH.pathname, pages: manifest.pages }, null, 2));
} finally {
  await db.$disconnect();
}
