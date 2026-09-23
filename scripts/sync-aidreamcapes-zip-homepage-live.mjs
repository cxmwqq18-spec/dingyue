#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const HOME_SLUG = "/";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes/homepage-seo/";
const EXPECTED_SECTION_IDS = [
  "aidreamcapes_hero",
  "aidreamcapes_video_grid",
  "aidreamcapes_ad_testing",
  "aidreamcapes_photo_grid",
  "aidreamcapes_scenarios",
  "aidreamcapes_how",
  "aidreamcapes_credits",
  "pricing_1",
  "proof_1",
  "faq_1",
  "conversion_1",
];

const applyLocal = hasArgument("--apply");
const applyProduction = hasArgument("--apply-production");
assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one homepage live apply target.");
const apply = applyLocal || applyProduction;
const confirmation = argumentValue("--confirm") ?? "";
const clone = (value) => JSON.parse(JSON.stringify(value));
function validateHomepage(contentJson) {
  assert(contentJson && typeof contentJson === "object", "homepage JSON is required");
  assert.deepEqual(contentJson.sectionsOrder, EXPECTED_SECTION_IDS, "homepage section order is not the ZIP order");
  for (const id of EXPECTED_SECTION_IDS) assert(contentJson.sections?.[id], `missing homepage section: ${id}`);
  assert.equal(contentJson.sections?.aidreamcapes_hero?.type, "aidreamcapes_home_hero");
  assert.equal(contentJson.sections?.aidreamcapes_video_grid?.type, "aidreamcapes_video_grid");
  assert.equal(contentJson.sections?.aidreamcapes_ad_testing?.type, "aidreamcapes_ad_testing");
  assert.equal(contentJson.sections?.aidreamcapes_photo_grid?.type, "aidreamcapes_photo_grid");
  assert.equal(contentJson.sections?.aidreamcapes_scenarios?.type, "aidreamcapes_scenario_grid");
  assert.equal(contentJson.seo?.canonical, "https://www.aidreamcapes.com/");
  assert.equal(contentJson.seo?.title, "AI UGC Ads, Product Videos & Ecommerce Photos | Aidreamcapes");
  assert.equal(contentJson.seo?.description, "Create UGC ad concepts, product videos and ecommerce image sets from product images or URLs in one private workspace.");
  assert.equal(contentJson.seo?.ogImageAlt, "Product page transforming into several vertical UGC ad concepts");
  const serialized = JSON.stringify(contentJson);
  assert(serialized.includes(ASSET_ROOT), "homepage does not reference the Aidreamcapes ZIP asset root");
  assert.equal(contentJson.mediaManifest?.length, 22, "homepage media manifest must contain the 22 ZIP assets");
  for (const item of contentJson.mediaManifest) assert(String(item.src).startsWith(ASSET_ROOT), `asset escaped Aidreamcapes root: ${item.src}`);
}

const prisma = new PrismaClient();
try {
  if (apply) {
    assertDatabaseTarget({
      expectedTarget: applyProduction ? "production" : "local",
      requireProductionConfirmation: applyProduction,
      productionConfirmed: confirmation === "production"
    });
    assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
  }
  const [site, themePage, livePage] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } }, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } }, select: { id: true, siteId: true, slug: true, pageType: true, templateKey: true, title: true, contentJson: true } }),
  ]);
  assert(site, `site not found: ${SITE_ID}`);
  assert.equal(site.slug, "aidreamcapes");
  assert(themePage, "Aidreamcapes homepage ThemePage is required");
  assert(livePage, "Aidreamcapes homepage LivePage is required");

  const nextContent = clone(themePage.draftJson);
  validateHomepage(nextContent);
  const changed = JSON.stringify(livePage.contentJson) !== JSON.stringify(nextContent);
  const report = {
    ok: true,
    mode: applyProduction ? "production-apply" : applyLocal ? "apply" : "dry-run",
    scope: { siteId: SITE_ID, siteSlug: site.slug, domain: site.primaryDomain, slug: HOME_SLUG },
    source: { themePageId: themePage.id, source: "ThemePage.draftJson" },
    target: { livePageId: livePage.id, target: "LivePage.contentJson" },
    changed,
    before: { title: livePage.title, sections: livePage.contentJson?.sectionsOrder ?? [], assetRoot: JSON.stringify(livePage.contentJson ?? {}).includes(ASSET_ROOT) },
    after: { title: "AI UGC Ads, Product Videos & Ecommerce Photos", sections: nextContent.sectionsOrder, imageCount: nextContent.mediaManifest.length, assetRoot: ASSET_ROOT },
    backupPath: null,
  };

  if (apply && changed) {
    const backupPath = path.join(process.cwd(), "releases", "backups", "aidreamcapes", `homepage-live-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, themePage, livePage }, null, 2)}\n`, { mode: 0o600 });
    report.backupPath = backupPath;
    await prisma.$transaction((tx) => tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextContent, title: "AI UGC Ads, Product Videos & Ecommerce Photos", updatedAt: new Date() } }));
    const readback = await prisma.livePage.findUnique({ where: { id: livePage.id }, select: { siteId: true, slug: true, title: true, contentJson: true } });
    assert.equal(readback?.siteId, SITE_ID);
    assert.equal(readback?.slug, HOME_SLUG);
    assert.deepEqual(readback?.contentJson?.sectionsOrder, EXPECTED_SECTION_IDS);
    validateHomepage(readback?.contentJson);
    report.readback = { title: readback.title, sections: readback.contentJson.sectionsOrder, imageCount: readback.contentJson.mediaManifest.length };
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
