#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "site_aidreamcapes_about_us";
const PAGE_PATH = "/about-us";
const PREVIOUS_DESCRIPTION = "AIVideosUGC helps shop owners create product photos, short video ads, and presenter-led videos from a product image or page. Learn who operates the service and how it helps.";
const NEXT_DESCRIPTION = "Learn who operates AIVideosUGC and how shop owners create product photos, short video ads, and presenter-led videos from a product image or page.";
const CONFIRMATION = "site_aidreamcapes-about-description";
const args = new Set(process.argv.slice(2));
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");

assert.equal(NEXT_DESCRIPTION.length, 145, "Approved About description length changed unexpectedly.");
assert(["local", "production"].includes(target), `Unsupported target: ${target}`);
if (target === "production") {
  const confirmed = argumentValue("--confirm") === CONFIRMATION;
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, `Use --confirm=${CONFIRMATION}.`);
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function withoutDescription(contentJson) {
  const copy = structuredClone(contentJson);
  if (copy.seo && typeof copy.seo === "object") delete copy.seo.description;
  return copy;
}

const db = new PrismaClient();
try {
  const page = await db.livePage.findUnique({
    where: { id: PAGE_ID },
    select: { id: true, siteId: true, slug: true, title: true, updatedAt: true, contentJson: true }
  });
  assert(page && page.siteId === SITE_ID && page.slug === PAGE_PATH, "Aidreamcapes About Us LivePage was not found.");
  const previous = page.contentJson?.seo?.description;
  assert(
    previous === PREVIOUS_DESCRIPTION || previous === NEXT_DESCRIPTION,
    "About Us description differs from the reviewed value; refusing to overwrite a newer edit."
  );
  const nextContent = structuredClone(page.contentJson);
  nextContent.seo = { ...(nextContent.seo ?? {}), description: NEXT_DESCRIPTION };
  const nonTargetHash = hash(withoutDescription(page.contentJson));
  assert.equal(hash(withoutDescription(nextContent)), nonTargetHash, "Only seo.description may change.");

  const plan = {
    target,
    siteId: SITE_ID,
    owner: `LivePage:${PAGE_ID}`,
    publicPath: PAGE_PATH,
    targetField: "contentJson.seo.description",
    priorLength: String(previous).length,
    nextLength: NEXT_DESCRIPTION.length,
    description: NEXT_DESCRIPTION,
    baseUpdatedAt: page.updatedAt,
    nonTargetContentHash: nonTargetHash,
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(plan, null, 2));

  if (apply && previous !== NEXT_DESCRIPTION) {
    const result = await db.livePage.updateMany({
      where: { id: PAGE_ID, siteId: SITE_ID, slug: PAGE_PATH, updatedAt: page.updatedAt },
      data: { contentJson: nextContent }
    });
    assert.equal(result.count, 1, "About Us LivePage changed concurrently; no update was applied.");
  }
  if (apply) {
    const readback = await db.livePage.findUnique({
      where: { id: PAGE_ID },
      select: { id: true, siteId: true, slug: true, title: true, updatedAt: true, contentJson: true }
    });
    assert.equal(readback.contentJson?.seo?.description, NEXT_DESCRIPTION, "About Us description readback failed.");
    assert.equal(hash(withoutDescription(readback.contentJson)), nonTargetHash, "A non-target About Us field changed.");
    console.log(JSON.stringify({ result: "applied-and-read-back", siteId: readback.siteId, livePageId: readback.id, publicPath: readback.slug, updatedAt: readback.updatedAt, nonTargetContentUnchanged: true }, null, 2));
  }
} finally {
  await db.$disconnect();
}
