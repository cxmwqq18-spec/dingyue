#!/usr/bin/env node
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";
import { buildSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";

const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
assert.equal(target, "production", "This content update is production-only.");
const apply = hasArgument("--apply");
const confirmed = hasArgument("--confirm=site_aidreamcapes-about-livepage");
assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: confirmed
});
if (apply) assert(confirmed, "Production update requires the explicit Aidreamcapes About page confirmation.");

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const generated = buildSiteV2().pages.find((page) => page.slug === "/about-us");
assert(generated, "Aidreamcapes About page source is missing.");
assert.equal(generated.id, "about");
assert.equal(generated.contentJson.sections?.v2_main?.settings?.layout, "about");
const db = new PrismaClient();
try {
  const current = await db.livePage.findFirst({
    where: { siteId, slug: "/about-us" },
    select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true }
  });
  assert(current, "Production LivePage /about-us does not exist.");
  const baseHash = hash(current);
  const expectedHash = argumentValue("--base-hash");
  if (apply) assert.equal(expectedHash, baseHash, "Production About page changed since the reviewed dry run; create a new plan.");

  const nextContentJson = structuredClone(current.contentJson ?? {});
  nextContentJson.sections = { ...(nextContentJson.sections ?? {}), v2_main: generated.contentJson.sections.v2_main };
  nextContentJson.sectionsOrder = generated.contentJson.sectionsOrder;
  nextContentJson.seo = generated.contentJson.seo;
  nextContentJson.mediaManifest = generated.contentJson.mediaManifest;
  nextContentJson.contentContract = generated.contentJson.contentContract;
  const next = {
    ...current,
    title: generated.title,
    pageType: generated.pageType,
    templateKey: generated.templateKey,
    contentJson: nextContentJson
  };
  const changedFields = [
    ...(current.title === next.title ? [] : ["title"]),
    ...(current.pageType === next.pageType ? [] : ["pageType"]),
    ...(current.templateKey === next.templateKey ? [] : ["templateKey"]),
    ...(stable(current.contentJson?.sections) === stable(nextContentJson.sections) ? [] : ["contentJson.sections.v2_main"]),
    ...(stable(current.contentJson?.sectionsOrder) === stable(nextContentJson.sectionsOrder) ? [] : ["contentJson.sectionsOrder"]),
    ...(stable(current.contentJson?.seo) === stable(nextContentJson.seo) ? [] : ["contentJson.seo"]),
    ...(stable(current.contentJson?.mediaManifest) === stable(nextContentJson.mediaManifest) ? [] : ["contentJson.mediaManifest"]),
    ...(stable(current.contentJson?.contentContract) === stable(nextContentJson.contentContract) ? [] : ["contentJson.contentContract"])
  ];
  const result = {
    ok: true,
    mode: apply ? "applied" : "plan",
    target,
    siteId,
    slug: current.slug,
    liveDataOwner: "LivePage.contentJson",
    baseHash,
    nextHash: hash(next),
    changedFields,
    publicCopySections: generated.contentJson.sections.v2_main.settings.data.sections.length,
    publicFaqItems: generated.contentJson.sections.v2_main.settings.data.faq.length,
    writes: apply && changedFields.length ? 1 : 0,
    derivedCache: "not written; public SSR reads the relational LivePage directly"
  };

  if (apply && changedFields.length) {
    const update = await db.livePage.updateMany({
      where: { id: current.id, siteId, slug: current.slug, updatedAt: current.updatedAt },
      data: {
        title: next.title,
        pageType: next.pageType,
        templateKey: next.templateKey,
        contentJson: next.contentJson
      }
    });
    assert.equal(update.count, 1, "Production About page changed during apply; no row was updated.");
    const readback = await db.livePage.findFirst({
      where: { siteId, slug: "/about-us" },
      select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true }
    });
    assert(readback && hash({ ...readback, updatedAt: current.updatedAt }) === hash(next), "Production About LivePage readback did not match the planned content.");
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.$disconnect();
}
