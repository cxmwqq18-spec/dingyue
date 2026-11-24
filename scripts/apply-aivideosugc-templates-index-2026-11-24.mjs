#!/usr/bin/env node
// /templates becomes a landing page: live counts, two entrances and a short
// sample row. This manifest only sets the reviewed copy; counts, samples and
// the page composition are rendered from the current catalog.
//
//   dry run:  node scripts/apply-aivideosugc-templates-index-2026-11-24.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-templates-index-2026-11-24.mjs --target=production --apply --confirm=aivideosugc-templates-index-2026-11-24
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-templates-index-2026-11-24";
const SLUG = "/templates";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

const LEAD = "Every example is a reusable template. Choose video for short-form UGC ads and product demos, or photo for clean product images — each one opens to the finished result and the prompt behind it.";

const TEMPLATES_INDEX = {
  entries: {
    video: {
      label: "Video templates",
      title: "Short-form UGC, demos and ads",
      description: "UGC product ads, presenter walkthroughs and launch clips. 9:16 and 16:9, with the prompt, settings and finished example behind every result.",
      cta: "Browse video templates"
    },
    photo: {
      label: "Photo templates",
      title: "White background, lifestyle and on-model",
      description: "Clean product photos, styled scenes and on-model shots. Keep the product exact and swap in your own reference images.",
      cta: "Browse photo templates"
    }
  },
  samples: {
    title: "Start with a few",
    lead: "Recently added examples from both catalogs. Open any card to see the prompt and settings behind it."
  },
  cta: {
    title: "Pick a template, add your product",
    lead: "Every example carries its prompt and settings. Start from a result you like and make your own version.",
    label: "Open the workspace",
    href: "/app/create/ai-video-generation"
  }
};

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const hash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

const db = new PrismaClient();
try {
  const row = await db.livePage.findFirst({ where: { siteId, slug: SLUG }, select: { id: true, contentJson: true, updatedAt: true } });
  assert(row, `Templates row ${SLUG} not found on ${target}.`);
  const data = row.contentJson?.sections?.v2_main?.settings?.data;
  assert(data && typeof data === "object", "Templates row has no page data.");
  const next = structuredClone(row.contentJson);
  const nextData = next.sections.v2_main.settings.data;
  nextData.lead = LEAD;
  nextData.templatesIndex = TEMPLATES_INDEX;
  const changed = hash(next) !== hash(row.contentJson);
  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM_NAME,
    page: { slug: SLUG, action: changed ? "update" : "unchanged", changed, baseHash: hash(row.contentJson), nextHash: hash(next) }
  };
  if (apply && changed) {
    const update = await db.livePage.updateMany({
      where: { id: row.id, siteId, slug: SLUG, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(update.count, 1, "Templates row changed during apply.");
    const readback = await db.livePage.findFirst({ where: { id: row.id, siteId }, select: { contentJson: true } });
    assert.equal(hash(readback?.contentJson), hash(next), "Readback mismatch on /templates.");
    report.applied = true;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
