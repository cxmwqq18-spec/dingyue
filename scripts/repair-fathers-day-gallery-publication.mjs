#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = assertAllowedSite(process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot");
const pagePath = "/ai-save-the-date/fathers-day";
const apply = process.argv.includes("--apply");
const databaseTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();
const productionConfirmed = process.env.CONFIRM_FATHERS_DAY_PRODUCTION === "1";

assertDatabaseTarget({
  expectedTarget: databaseTarget,
  env: process.env,
  requireProductionConfirmation: databaseTarget === "production",
  productionConfirmed
});
if (databaseTarget === "production" && !productionConfirmed) {
  throw new Error("Production repair requires CONFIRM_FATHERS_DAY_PRODUCTION=1.");
}

const clone = (value) => JSON.parse(JSON.stringify(value));

function repairGalleryOrder(value, owner) {
  const json = clone(value);
  const requiredSections = json.contentContract?.requiredSections ?? [];
  const sectionTypes = json.contentContract?.sectionTypes ?? [];
  const galleryIndex = requiredSections.indexOf("gallery");
  assert.notEqual(galleryIndex, -1, `${owner}: gallery is missing from contentContract.requiredSections`);
  assert.equal(requiredSections.length, sectionTypes.length, `${owner}: content contract arrays differ in length`);

  const galleryEntry = Object.entries(json.sections ?? {}).find(([, section]) => section?.settings?.anchor === "gallery");
  assert.ok(galleryEntry, `${owner}: gallery section content is missing`);
  const [galleryId, gallerySection] = galleryEntry;
  assert.equal(gallerySection.type, sectionTypes[galleryIndex], `${owner}: gallery section type differs from its contract`);

  const sectionsOrder = Array.isArray(json.sectionsOrder) ? json.sectionsOrder.filter((id) => id !== galleryId) : [];
  sectionsOrder.splice(galleryIndex, 0, galleryId);
  json.sectionsOrder = sectionsOrder;

  assert.equal(json.sectionsOrder.length, requiredSections.length, `${owner}: section order length differs from its contract`);
  json.sectionsOrder.forEach((sectionId, index) => {
    const section = json.sections?.[sectionId];
    assert.ok(section, `${owner}: ordered section ${sectionId} is missing`);
    assert.equal(section.settings?.anchor, requiredSections[index], `${owner}: ${sectionId} anchor differs from its contract`);
    assert.equal(section.type, sectionTypes[index], `${owner}: ${sectionId} type differs from its contract`);
  });
  return json;
}

const prisma = new PrismaClient();
try {
  const page = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: pagePath } } });
  assert.ok(page, `${siteId}${pagePath}: ThemePage is missing`);

  const draftJson = repairGalleryOrder(page.draftJson, "draftJson");
  const publishedJson = repairGalleryOrder(page.publishedJson, "publishedJson");
  const before = {
    draft: page.draftJson.sectionsOrder,
    published: page.publishedJson.sectionsOrder
  };
  const after = {
    draft: draftJson.sectionsOrder,
    published: publishedJson.sectionsOrder
  };
  const changed = JSON.stringify(before) !== JSON.stringify(after);

  if (apply && changed) {
    await prisma.themePage.update({
      where: { id: page.id },
      data: { draftJson, publishedJson }
    });
    const readback = await prisma.themePage.findUnique({ where: { id: page.id } });
    assert.deepEqual(readback?.draftJson?.sectionsOrder, draftJson.sectionsOrder, "draft gallery repair readback mismatch");
    assert.deepEqual(readback?.publishedJson?.sectionsOrder, publishedJson.sectionsOrder, "published gallery repair readback mismatch");
  }

  console.log(JSON.stringify({
    ok: true,
    siteId,
    pagePath,
    mode: apply ? "applied" : "dry-run",
    changed,
    before,
    after,
    publicOwner: "ThemePage.publishedJson"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
