#!/usr/bin/env node

import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesEcommerceMainImageContent } from "./lib/aidreamcapes-ecommerce-main-image-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "aidreamcapes_image_theme_ecommerce_main_image";
const PAGE_SLUG = "/ai-image-generation/ecommerce-main-image";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");
const apply = hasArgument("--apply-local");
const allowPendingAssets = hasArgument("--allow-pending-assets");
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
assertDatabaseTarget({ expectedTarget: "local" });
// Page availability is independent from media delivery. In local staging we
// may publish the correct page contract before the provider has finished every
// image; the browser can then render the page while missing media is tracked
// separately. The default remains strict for normal release runs.
const content = validateAidreamcapesEcommerceMainImageContent({ requireAssets: !allowPendingAssets });

function pageContent() {
  const images = [content.hero.productImage, content.hero.outputImage, ...content.examples.items.map((item) => item.image)];
  return {
    seo: { ...content.seo, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
    version: 1,
    pageType: "ai_tool",
    sections: {
      ai_image_theme_landing_1: {
        type: "ai_image_theme_landing",
        blocks: [],
        settings: { anchor: "ecommerce-main-image", contentKey: "ecommerce-main-image", content }
      }
    },
    mediaManifest: images.map((image, index) => ({
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
      role: index < 2 ? "hero" : "content",
      loading: image.loading,
      fetchPriority: image.fetchPriority,
      sizes: image.sizes
    })),
    sectionsOrder: ["ai_image_theme_landing_1"],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: "aidreamcapes/image-theme/ecommerce-main-image",
      faqCount: content.faq.items.length,
      mediaCount: images.length,
      sectionTypes: ["ai_image_theme_landing"],
      sourceRevision: "aidreamcapes-ecommerce-main-image-v1",
      requiredSections: ["ai_image_theme_landing_1"]
    }
  };
}

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  const groups = [
    next.aidreamcapesZipNavigation?.image?.groups,
    next.image?.groups,
    next.aidreamcapesZipNavigation?.marketing?.groups,
    next.marketing?.groups
  ].filter(Array.isArray);
  let changed = 0;
  for (const groupList of groups) {
    for (const group of groupList) {
      if (!Array.isArray(group.items)) continue;
      for (const item of group.items) {
        const isTarget = item.label === "Ecommerce Main Image" || item.label === "Main Image";
        if (!isTarget) continue;
        assert.equal(typeof item.href, "string", `${item.label}: current navigation item has no href`);
        if (item.label === "Ecommerce Main Image" || group.label === "Listing Stills") {
          if (item.href !== PAGE_SLUG) { item.href = PAGE_SLUG; changed += 1; }
        }
      }
    }
  }
  const getStarted = next.aidreamcapesZipNavigation?.actions?.getStarted;
  if (getStarted && getStarted.href !== "/app/create?tool_id=image_generator") {
    getStarted.href = "/app/create?tool_id=image_generator";
    changed += 1;
  }
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const [site, existingBySlug, existingById, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true } }),
    prisma.livePage.findUnique({ where: { id: PAGE_ID }, select: { id: true, siteId: true, slug: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  if (existingBySlug) assert.equal(existingBySlug.id, PAGE_ID, `${PAGE_SLUG}: existing route has an unexpected page ID`);
  if (existingById) {
    assert.equal(existingById.siteId, SITE_ID, `${PAGE_ID}: existing page belongs to another site`);
    assert.equal(existingById.slug, PAGE_SLUG, `${PAGE_ID}: existing page has an unexpected slug`);
  }

  const nextPage = {
    id: PAGE_ID,
    siteId: SITE_ID,
    pageType: "ai_tool",
    templateKey: "ai-image-theme-ecommerce-main-image",
    slug: PAGE_SLUG,
    title: content.seo.title,
    contentJson: pageContent()
  };
  const draftNavigation = updateNavigation(settings.draftJson);
  const publishedNavigation = updateNavigation(settings.publishedJson);
  const report = {
    id: PAGE_ID,
    slug: PAGE_SLUG,
    action: existingBySlug ? "UPDATE" : "CREATE",
    media: nextPage.contentJson.mediaManifest.length,
    faq: nextPage.contentJson.contentContract.faqCount,
    navigationChanges: draftNavigation.changed + publishedNavigation.changed,
    allowPendingAssets
  };

  if (apply) {
    assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
    assertNonProductionWriteTarget();
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `ecommerce-main-image-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, existingBySlug, existingById, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      await tx.livePage.upsert({
        where: { id: PAGE_ID },
        create: nextPage,
        update: { pageType: nextPage.pageType, templateKey: nextPage.templateKey, slug: nextPage.slug, title: nextPage.title, contentJson: nextPage.contentJson }
      });
      await tx.themeSettings.update({ where: { siteId: SITE_ID }, data: { draftJson: draftNavigation.next, publishedJson: publishedNavigation.next } });
    });
    console.log(JSON.stringify({ ok: true, mode: "applied", siteId: SITE_ID, backupPath, page: report, mediaRelease: allowPendingAssets ? "pending-assets-allowed" : "complete-assets-required" }, null, 2));
  } else {
    const pendingFlag = allowPendingAssets ? " --allow-pending-assets" : "";
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, page: report, applyCommand: `node scripts/migrate-aidreamcapes-ecommerce-main-image.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID}${pendingFlag}` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
