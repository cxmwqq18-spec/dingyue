#!/usr/bin/env node
// /pricing is a SaaS credit-package page, not a physical product listing.
// The three Product nodes cannot truthfully carry image, shippingDetails,
// return policy, rating or review, so Google's product-snippet checks report
// them as incomplete. Remove only those Product nodes; WebPage, FAQPage,
// BreadcrumbList and Organization stay untouched.
//
//   dry run:  node scripts/apply-aivideosugc-pricing-remove-product-jsonld-2026-11-25.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-pricing-remove-product-jsonld-2026-11-25.mjs --target=production --apply --confirm=aivideosugc-pricing-remove-product-jsonld-2026-11-25
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-pricing-remove-product-jsonld-2026-11-25";
const SLUG = "/pricing";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument(`--confirm=${CONFIRM_NAME}`) });
if (apply && target === "production") assert(hasArgument(`--confirm=${CONFIRM_NAME}`), `Production update requires --confirm=${CONFIRM_NAME}`);

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
  assert(row, `Pricing row ${SLUG} not found on ${target}.`);
  const graph = row.contentJson?.seo?.jsonLd?.["@graph"];
  assert(Array.isArray(graph), "Pricing JSON-LD graph is missing.");
  const products = graph.filter((node) => node && typeof node === "object" && node["@type"] === "Product");
  const next = structuredClone(row.contentJson);
  next.seo.jsonLd["@graph"] = next.seo.jsonLd["@graph"].filter((node) => !(node && typeof node === "object" && node["@type"] === "Product"));
  const changed = products.length > 0;
  const report = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    confirm: CONFIRM_NAME,
    page: SLUG,
    removed: products.map((node) => ({ "@id": node["@id"], name: node.name })),
    beforeNodes: graph.map((node) => node?.["@type"]),
    afterNodes: next.seo.jsonLd["@graph"].map((node) => node?.["@type"]),
    changed,
    baseHash: hash(row.contentJson),
    nextHash: hash(next)
  };
  if (apply && changed) {
    const update = await db.livePage.updateMany({
      where: { id: row.id, siteId, slug: SLUG, updatedAt: row.updatedAt },
      data: { contentJson: next }
    });
    assert.equal(update.count, 1, "Pricing row changed during apply.");
    const readback = await db.livePage.findFirst({ where: { id: row.id, siteId }, select: { contentJson: true } });
    assert.equal(hash(readback?.contentJson), hash(next), "Readback mismatch on /pricing.");
    report.applied = true;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await db.$disconnect();
}
