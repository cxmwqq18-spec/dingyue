#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesMarketingDirectoryContent } from "./lib/aidreamcapes-marketing-directory-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "aidreamcapes_marketing_directory_v1";
const PAGE_SLUG = "/marketing";
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
const apply = applyLocal || applyProduction;
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const requestedPageId = argumentValue("--page-id") ?? PAGE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");

assert.equal(!(applyLocal && applyProduction), true, "Choose exactly one database apply target.");
assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assert.equal(requestedPageId, PAGE_ID, `This migration requires the exact page ID ${PAGE_ID}.`);
assertDatabaseTarget({
  expectedTarget: applyProduction ? "production" : "local",
  requireProductionConfirmation: applyProduction,
  productionConfirmed: confirmation === "production"
});
const copy = validateAidreamcapesMarketingDirectoryContent();

function hashJson(value) {
  const stable = (current) => {
    if (Array.isArray(current)) return current.map(stable);
    if (current && typeof current === "object") return Object.fromEntries(Object.keys(current).sort().map((key) => [key, stable(current[key])]));
    return current;
  };
  return createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function pageContent() {
  return {
    version: 1,
    pageType: "ai_tool_directory",
    seo: copy.seo,
    sections: {
      marketing_directory_1: {
        type: "dreamshoot_tool_collection",
        blocks: [],
        settings: {
          anchor: "marketing-directory",
          layout: "aidreamcapes_marketing_directory",
          title: copy.title,
          subtitle: copy.subtitle,
          headingLevel: "h1",
          marketingCopy: copy
        }
      }
    },
    sectionsOrder: ["marketing_directory_1"],
    mediaManifest: [],
    contentContract: {
      schema: "marketing-directory-v1",
      siteId: SITE_ID,
      source: "LivePage.contentJson",
      navSource: "ThemeSettings.publishedJson.aidreamcapesZipNavigation.marketing",
      expectedGroupCount: 5
    }
  };
}

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const navigation = next.aidreamcapesZipNavigation;
  assert(navigation?.marketing?.collection, "Aidreamcapes marketing navigation collection is missing.");
  const previous = navigation.marketing.collection.href;
  navigation.marketing.collection.href = PAGE_SLUG;
  navigation.marketing.collection.label = "Open Marketing Hub →";
  return { next, changed: previous !== PAGE_SLUG ? 1 : 0 };
}

const prisma = new PrismaClient();
try {
  const [site, page, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true, updatedAt: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  assert(!page || page.siteId === SITE_ID, `${PAGE_ID}: page belongs to another site`);
  if (page) assert.equal(page.slug, PAGE_SLUG, `${PAGE_ID}: page slug is not ${PAGE_SLUG}`);

  const existingSlugPage = await prisma.livePage.findFirst({ where: { siteId: SITE_ID, slug: PAGE_SLUG }, select: { id: true, slug: true } });
  assert(!existingSlugPage || existingSlugPage.id === PAGE_ID, `${PAGE_SLUG}: existing page has unexpected ID ${existingSlugPage?.id}`);
  const nextContent = pageContent();
  const draftNavigation = updateNavigation(settings.draftJson);
  const publishedNavigation = updateNavigation(settings.publishedJson);
  const report = {
    siteId: SITE_ID,
    pageId: PAGE_ID,
    slug: PAGE_SLUG,
    action: page ? "UPDATE" : "CREATE",
    oldHash: page ? hashJson(page.contentJson) : null,
    newHash: hashJson(nextContent),
    navigationChanges: draftNavigation.changed + publishedNavigation.changed
  };

  if (!apply) {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", page: report, applyCommand: `node scripts/migrate-aidreamcapes-marketing-directory.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --page-id=${PAGE_ID}` }, null, 2));
  } else {
    assert.equal(confirmation, applyProduction ? "production" : SITE_ID, `Applying requires --confirm=${applyProduction ? "production" : SITE_ID}.`);
    if (applyLocal) assertNonProductionWriteTarget();
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `marketing-directory-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, page, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      await tx.livePage.upsert({
        where: { id: PAGE_ID },
        create: { id: PAGE_ID, siteId: SITE_ID, pageType: "ai_tool_directory", templateKey: "aidreamcapes-marketing-directory", slug: PAGE_SLUG, title: copy.seo.title, contentJson: nextContent },
        update: { pageType: "ai_tool_directory", templateKey: "aidreamcapes-marketing-directory", slug: PAGE_SLUG, title: copy.seo.title, contentJson: nextContent }
      });
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: draftNavigation.next, publishedJson: publishedNavigation.next } });
    });
    const readback = await prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { id: true, siteId: true, slug: true, contentJson: true } });
    assert(readback, `${PAGE_ID}: readback returned no page`);
    assert.equal(readback.siteId, SITE_ID);
    assert.equal(readback.slug, PAGE_SLUG);
    assert.equal(hashJson(readback.contentJson), report.newHash, `${PAGE_ID}: content hash readback`);
    const settingsReadback = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } });
    const checkDraft = updateNavigation(settingsReadback?.draftJson);
    const checkPublished = updateNavigation(settingsReadback?.publishedJson);
    assert.equal(checkDraft.changed, 0, "Draft navigation readback drift");
    assert.equal(checkPublished.changed, 0, "Published navigation readback drift");
    console.log(JSON.stringify({ ok: true, mode: applyProduction ? "production-applied" : "applied", backupPath, page: { ...report, readback: "PASS" } }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
