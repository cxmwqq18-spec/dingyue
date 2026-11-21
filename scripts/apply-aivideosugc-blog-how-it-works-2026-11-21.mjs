#!/usr/bin/env node
// AIVideosUGC blog article apply — 2026-11-21.
// Adds the /blog/how-aivideosugc-works article for site_aidreamcapes from the
// owner-provided page copy: creates the article LivePage row (layout
// blog-engineering) and appends its card to the /blog hub's article list.
// Field-level, idempotent, site-scoped.
//   dry run:  node scripts/apply-aivideosugc-blog-how-it-works-2026-11-21.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-blog-how-it-works-2026-11-21.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-blog-how-it-works-2026-11-21";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-blog-how-it-works-2026-11-21.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
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

const { article, hub } = manifest;
assert.match(article.slug, /^\/blog\/[a-z0-9-]+$/, "Article slug must be a /blog/ path.");
assert.equal(article.pageType, "article", "Article pageType must be article.");
assert.equal(article.contentJson.sections?.v2_main?.settings?.layout, "blog-engineering", "Article layout must be blog-engineering.");
assert.ok(article.contentJson.sections?.v2_main?.settings?.data?.h1, "Article data shape missing h1.");
assert.ok(hub.card?.href === article.slug, "Hub card must point at the article slug.");

const db = new PrismaClient();
try {
  const existing = await db.livePage.findFirst({ where: { siteId, slug: article.slug }, select: { id: true, contentJson: true, pageType: true } });
  const hubRow = await db.livePage.findFirst({ where: { siteId, slug: hub.slug }, select: { id: true, contentJson: true } });
  assert(hubRow, `Blog hub row ${hub.slug} does not exist on ${target}.`);
  const hubData = hubRow.contentJson.sections?.v2_main?.settings?.data;
  assert(Array.isArray(hubData?.articles), "Blog hub articles list is missing.");

  const alreadyCarded = hubData.articles.some((card) => card?.href === hub.card.href);
  const articleExists = Boolean(existing);

  const nextHub = JSON.parse(JSON.stringify(hubRow.contentJson));
  if (!alreadyCarded) nextHub.sections.v2_main.settings.data.articles.push(hub.card);
  assert.equal(nextHub.sections.v2_main.settings.data.articles.filter((card) => card?.href === hub.card.href).length, 1, "Hub card must appear exactly once.");
  const hubChanged = hash(nextHub) !== hash(hubRow.contentJson);

  if (existing) {
    assert.equal(existing.pageType, article.pageType, "Existing row pageType mismatch; investigate before updating.");
    if (hash(existing.contentJson) === hash(article.contentJson) && !hubChanged) {
      console.log(`[blog-how-it-works] ${article.slug} already matches the manifest; no changes.`);
      process.exit(0);
    }
    if (argumentValue("--base-hash-article")) {
      assert.equal(hash(existing.contentJson), argumentValue("--base-hash-article"), "Article row changed since the reviewed dry run; refusing to apply.");
    }
  }

  console.log(`[blog-how-it-works] target=${target} site=${siteId}`);
  console.log(existing ? `[blog-how-it-works] align article ${article.slug} (id ${article.id})` : `[blog-how-it-works] create article ${article.slug} (id ${article.id})`);
  console.log(`[blog-how-it-works] hub card ${alreadyCarded ? "already listed" : "append"}; hub base-hash=${hash(hubRow.contentJson)} next-hash=${hash(nextHub)}`);
  if (!apply) {
    console.log("[blog-how-it-works] dry run — no writes. Production apply:");
    console.log(`[blog-how-it-works]   --apply --confirm=${CONFIRM_NAME} --base-hash-hub=<hash>${existing ? " --base-hash-article=<hash>" : ""}`);
  } else {
    if (argumentValue("--base-hash-hub")) {
      assert.equal(hash(hubRow.contentJson), argumentValue("--base-hash-hub"), "Blog hub changed since the reviewed dry run; refusing to apply.");
    }
    await db.$transaction(async (tx) => {
      if (existing) {
        await tx.livePage.update({ where: { id: existing.id }, data: { title: article.title, pageType: article.pageType, contentJson: article.contentJson } });
      } else {
        await tx.livePage.create({
          data: {
            id: article.id,
            siteId,
            slug: article.slug,
            title: article.title,
            pageType: article.pageType,
            contentJson: article.contentJson
          }
        });
      }
      if (hubChanged) await tx.livePage.update({ where: { id: hubRow.id }, data: { contentJson: nextHub } });
    });
    const created = await db.livePage.findFirst({ where: { siteId, slug: article.slug }, select: { contentJson: true, pageType: true } });
    assert(created, "Readback: article row missing.");
    assert.equal(hash(created.contentJson), hash(article.contentJson), "Readback: article contentJson mismatch.");
    const hubReadback = await db.livePage.findFirst({ where: { siteId, slug: hub.slug }, select: { contentJson: true } });
    const cards = hubReadback.contentJson.sections.v2_main.settings.data.articles;
    assert.equal(cards.filter((card) => card?.href === hub.card.href).length, 1, "Readback: hub card missing or duplicated.");
    console.log(`[blog-how-it-works] applied; hub cards=${cards.length}; readback verified.`);
  }
} finally {
  await db.$disconnect();
}
