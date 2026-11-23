#!/usr/bin/env node
// Give the six document blog pages a hero cover in their content data.
// The cover already exists as the page's SEO image (the same poster used by
// the blog card); the new article layout reads `data.cover`, so this adds that
// one field without changing any copy. Field-level, idempotent, site-scoped.
//
//   dry run:  node scripts/apply-aivideosugc-blog-cover-2026-11-23.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-blog-cover-2026-11-23.mjs --target=production --apply --confirm=aivideosugc-blog-cover-2026-11-23
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-blog-cover-2026-11-23";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

const SLUGS = [
  "/blog/aivideosugc-launches-ai-ugc-video-generator",
  "/blog/aivideosugc-company-knowledge-base",
  "/blog/ai-actor-ads-generator-for-kids-and-toy-brands",
  "/blog/ai-generated-ugc-ads-platform-for-health-and-fitness",
  "/blog/ai-ugc-ad-generator-for-ecommerce-jewelry-and-accessories",
  "/blog/ai-ugc-ad-generator-no-watermark-for-financial-services"
];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
const hash = (value) => crypto.createHash("sha256").update(stable(value)).digest("hex");

const db = new PrismaClient();
try {
  const plans = [];
  for (const slug of SLUGS) {
    const row = await db.livePage.findFirst({
      where: { siteId, slug },
      select: { id: true, slug: true, contentJson: true, updatedAt: true }
    });
    assert(row, `Missing blog row ${slug} on ${target}.`);
    const ogImage = row.contentJson?.seo?.ogImage;
    const ogImageAlt = row.contentJson?.seo?.ogImageAlt;
    assert(typeof ogImage === "string" && ogImage.trim(), `${slug} has no SEO cover image.`);
    const data = row.contentJson?.sections?.v2_main?.settings?.data;
    assert(data && typeof data === "object", `${slug} has no document data.`);
    const next = structuredClone(row.contentJson);
    const nextData = next.sections.v2_main.settings.data;
    nextData.cover = {
      src: ogImage,
      alt: typeof ogImageAlt === "string" && ogImageAlt.trim() ? ogImageAlt : nextData.h1
    };
    const changed = hash(next) !== hash(row.contentJson);
    plans.push({ slug, row, next, changed, baseHash: hash(row.contentJson), nextHash: hash(next) });
  }

  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM_NAME,
    pages: plans.map((plan) => ({ slug: plan.slug, action: plan.changed ? "update" : "unchanged", changed: plan.changed, baseHash: plan.baseHash, nextHash: plan.nextHash }))
  };

  if (apply) {
    for (const plan of plans) {
      if (!plan.changed) continue;
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: { contentJson: plan.next }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
    }
    const readback = await db.livePage.findMany({ where: { siteId, slug: { in: SLUGS } }, select: { slug: true, contentJson: true } });
    for (const plan of plans) {
      const row = readback.find((candidate) => candidate.slug === plan.slug);
      assert(row && hash(row.contentJson) === plan.nextHash, `Readback mismatch on ${plan.slug}.`);
    }
    report.applied = true;
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
