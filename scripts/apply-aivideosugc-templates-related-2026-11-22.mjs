#!/usr/bin/env node
// AIVideosUGC directory recommendations — 2026-11-22.
// The /templates gallery had no in-content category recommendations, and the
// category pages it points at did not link back. This adds one reviewed set:
// /templates -> platform/occasion hubs + three representative categories, and
// each of those five pages -> /templates. Existing links stay, duplicates and
// self-links are removed. Field-level, idempotent, site-scoped.
//
//   dry run:  node scripts/apply-aivideosugc-templates-related-2026-11-22.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-templates-related-2026-11-22.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-templates-related-2026-11-22";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-templates-related-2026-11-22.json", import.meta.url);
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

const PATCHES = [
  {
    slug: "/templates",
    links: [
      { label: "Browse by platform", href: "/platforms" },
      { label: "Browse by occasion", href: "/occasions" },
      { label: "Beauty & Skincare", href: "/industries/beauty-skincare" },
      { label: "E-commerce", href: "/industries/e-commerce" },
      { label: "TikTok Ads", href: "/platforms/tiktok-ads" }
    ]
  },
  { slug: "/platforms", links: [
    { label: "All examples", href: "/templates" },
    { label: "Browse by industry", href: "/industries" },
    { label: "Browse by occasion", href: "/occasions" },
    { label: "TikTok Ads", href: "/platforms/tiktok-ads" },
    { label: "Instagram Ads", href: "/platforms/instagram-ads" }
  ] },
  { slug: "/occasions", links: [
    { label: "All examples", href: "/templates" },
    { label: "Browse by industry", href: "/industries" },
    { label: "Browse by platform", href: "/platforms" },
    { label: "Black Friday", href: "/occasions/black-friday" },
    { label: "Sale & Discount", href: "/occasions/sale-discount" }
  ] },
  { slug: "/industries", links: [
    { label: "Browse by platform", href: "/platforms" },
    { label: "Browse by occasion", href: "/occasions" },
    { label: "Beauty & Skincare", href: "/industries/beauty-skincare" },
    { label: "E-commerce", href: "/industries/e-commerce" }
  ], ensureBlockOrderRelated: true },
  { slug: "/industries/beauty-skincare", links: [{ label: "All examples", href: "/templates" }] },
  { slug: "/industries/e-commerce", links: [{ label: "All examples", href: "/templates" }] },
  { slug: "/platforms/tiktok-ads", links: [{ label: "All examples", href: "/templates" }] }
];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function nextLinks(current, additions, slug) {
  const out = [];
  const seen = new Set();
  for (const link of [...(Array.isArray(current) ? current : []), ...additions]) {
    const href = typeof link?.href === "string" ? link.href.trim() : "";
    const label = typeof link?.label === "string" ? link.label.trim() : "";
    if (!href || !label || href === slug || seen.has(href)) continue;
    seen.add(href);
    out.push({ label, href });
  }
  return out;
}

const db = new PrismaClient();
try {
  const plans = [];
  for (const patch of PATCHES) {
    const row = await db.livePage.findFirst({
      where: { siteId, slug: patch.slug },
      select: { id: true, contentJson: true, updatedAt: true, pageType: true }
    });
    assert(row, `LivePage ${patch.slug} does not exist on ${target}.`);
    const next = structuredClone(row.contentJson);
    const data = next.sections?.v2_main?.settings?.data;
    assert(data && typeof data === "object", `${patch.slug}: section data missing.`);
    const current = Array.isArray(data.relatedLinks) ? data.relatedLinks : [];
    const links = nextLinks(current, patch.links, patch.slug);
    assert.equal(links.length, links.filter((link, index) => links.findIndex((other) => other.href === link.href) === index).length, `${patch.slug}: duplicate href remained.`);
    assert(!links.some((link) => link.href === patch.slug), `${patch.slug}: self link remained.`);
    data.relatedLinks = links;
    if (patch.ensureBlockOrderRelated && Array.isArray(data.blockOrder) && !data.blockOrder.includes("related")) {
      const faqAt = data.blockOrder.indexOf("faq");
      data.blockOrder.splice(faqAt >= 0 ? faqAt : data.blockOrder.length, 0, "related");
    }
    plans.push({
      slug: patch.slug,
      row,
      next,
      added: links.length - current.length,
      changed: hash(next) !== hash(row.contentJson)
    });
  }

  const provided = argumentValue("--base-hashes")?.split(",").map((value) => value.trim());
  if (apply && provided) {
    assert.equal(provided.length, plans.length, `--base-hashes needs ${plans.length} hashes in patch order.`);
    plans.forEach((plan, index) => assert.equal(hash(plan.row.contentJson), provided[index], `${plan.slug} changed since the reviewed dry run; refusing to apply.`));
  }

  if (apply) {
    for (const plan of plans) {
      if (!plan.changed) continue;
      const update = await db.livePage.updateMany({
        where: { id: plan.row.id, siteId, slug: plan.slug, updatedAt: plan.row.updatedAt },
        data: { contentJson: plan.next }
      });
      assert.equal(update.count, 1, `Row changed during apply: ${plan.slug}.`);
    }
    const readback = await db.livePage.findMany({
      where: { siteId, slug: { in: PATCHES.map((patch) => patch.slug) } },
      select: { slug: true, contentJson: true }
    });
    const bySlug = new Map(readback.map((row) => [row.slug, row.contentJson]));
    for (const plan of plans) assert.equal(hash(bySlug.get(plan.slug)), hash(plan.next), `Readback mismatch on ${plan.slug}.`);
  }

  fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
  const manifest = {
    date: "2026-11-22",
    siteId,
    target,
    mode: apply ? "applied" : "plan",
    confirm: CONFIRM_NAME,
    pages: plans.map((plan) => ({
      slug: plan.slug,
      action: plan.changed ? "update" : "unchanged",
      addedLinks: plan.added,
      baseHash: hash(plan.row.contentJson),
      nextHash: hash(plan.next),
      links: plan.next.sections.v2_main.settings.data.relatedLinks
    })),
    note: "Adds /templates category recommendations and reciprocal /templates links from the five recommended pages. Existing links are preserved; duplicates and self-links are removed."
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    mode: manifest.mode,
    target,
    manifest: MANIFEST_PATH.pathname,
    pages: manifest.pages.map(({ slug, action, addedLinks, baseHash }) => ({ slug, action, addedLinks, baseHash }))
  }, null, 2));
} finally {
  await db.$disconnect();
}
