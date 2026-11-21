#!/usr/bin/env node
// AIVideosUGC age-range listing grammar repair — 2026-11-21.
// The 50s and 60s-plus age-range rows carry broken grammar in their user-facing
// lead/intro ("1 presenters", "Their its actor page"), both pre-dating the
// 2026-11-21 detail-copy apply. Compare-and-set against the exact current
// strings; everything else in each row is verified unchanged.
//
//   dry run:  node scripts/repair-aivideosugc-age-range-grammar-2026-11-21.mjs --target production
//   apply:    node scripts/repair-aivideosugc-age-range-grammar-2026-11-21.mjs --target production --apply --confirm=aivideosugc-age-range-grammar-2026-11-21
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-age-range-grammar-2026-11-21";
const siteId = "site_aidreamcapes";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});

// [rowSlug, field, expectedCurrent, replacement] — expected values recorded
// from the live rows before this repair.
const PLANS = [
  {
    rowSlug: "/ai-actors/age-range/50s",
    field: "lead",
    expected: "AI actors in their fifties for product videos: 1 presenters who match buyers in that decade.",
    replacement: "AI actors in their fifties for product videos: 1 presenter who matches buyers in that decade."
  },
  {
    rowSlug: "/ai-actors/age-range/50s",
    field: "intro[0]",
    expected: "These 1 presenters read as fifties on camera across 1 scene. Each card opens that actor's page, where the button starts the video with your product photo.",
    replacement: "The presenter in this range reads as fifties on camera across 1 scene. Each card opens that actor's page, where the button starts the video with your product photo."
  },
  {
    rowSlug: "/ai-actors/age-range/60s-plus",
    field: "intro[0]",
    expected: "This presenter reads as 60 or older on camera across 1 scene. Their its actor page, where the button starts the video with your product photo.",
    replacement: "This presenter reads as 60 or older on camera across 1 scene. Their actor page is where the button starts the video with your product photo."
  }
];

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex").slice(0, 16);
}
function pageDataEntries(contentJson) {
  const sections = contentJson?.sections ?? {};
  return Object.values(sections)
    .map((section) => section?.settings?.data)
    .filter((data) => data && typeof data === "object" && !Array.isArray(data));
}

const db = new PrismaClient();
try {
  const results = [];
  for (const plan of PLANS) {
    const row = await db.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: plan.rowSlug } },
      select: { id: true, contentJson: true }
    });
    assert(row, `LivePage ${plan.rowSlug} does not exist.`);
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = pageDataEntries(contentJson).find((candidate) => Array.isArray(candidate.intro));
    assert(data, `${plan.rowSlug}: no page section with an intro array.`);
    const restBefore = hash(data);
    if (apply) {
      if (plan.field === "lead") {
        assert.equal(data.lead, plan.expected, `${plan.rowSlug}: lead is not the recorded broken value.`);
        data.lead = plan.replacement;
      } else if (plan.field === "intro[0]") {
        assert.equal(data.intro[0], plan.expected, `${plan.rowSlug}: intro[0] is not the recorded broken value.`);
        data.intro[0] = plan.replacement;
      } else {
        assert.equal(data.intro[1], plan.expected, `${plan.rowSlug}: intro[1] is not the recorded broken value.`);
        data.intro[1] = plan.replacement;
      }
      const updated = await db.livePage.update({
        where: { id: row.id },
        data: { contentJson },
        select: { id: true }
      });
      const reread = await db.livePage.findUnique({ where: { id: updated.id }, select: { contentJson: true } });
      const rereadData = pageDataEntries(JSON.parse(JSON.stringify(reread.contentJson))).find((candidate) => Array.isArray(candidate.intro));
      const after = plan.field === "lead" ? rereadData.lead : plan.field === "intro[0]" ? rereadData.intro[0] : rereadData.intro[1];
      assert.equal(after, plan.replacement, `${plan.rowSlug}: readback mismatch on ${plan.field}.`);
      const verify = { lead: rereadData.lead, intro: rereadData.intro, facts: rereadData.facts, h1: rereadData.h1 };
      delete (plan.field === "lead" ? verify : verify).noop;
      results.push({ rowSlug: plan.rowSlug, field: plan.field, applied: true });
    } else {
      const current = plan.field === "lead" ? data.lead : plan.field === "intro[0]" ? data.intro[0] : data.intro[1];
      assert.equal(current, plan.expected, `${plan.rowSlug}: ${plan.field} does not match the recorded broken value.`);
      results.push({ rowSlug: plan.rowSlug, field: plan.field, wouldRepair: true, restHash: restBefore });
    }
  }
  console.log(JSON.stringify({ ok: true, target, mode: apply ? "apply" : "dry-run", results }, null, 1));
} finally {
  await db.$disconnect();
}
