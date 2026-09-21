#!/usr/bin/env node

import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { validateAidreamcapesImageThemePages } from "./lib/aidreamcapes-image-theme-pages.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SOURCE_REVISION = "aidreamcapes-image-themes-v2-4k-independent";
const applyLocal = hasArgument("--apply-local");
const applyProduction = hasArgument("--apply-production");
assert(!(applyLocal && applyProduction), "Choose one database write target.");
const apply = applyLocal || applyProduction;
const navigationOnly = hasArgument("--navigation-only");
// Page availability is independent from provider media delivery. This flag
// lets local staging publish the database-backed page contracts before all
// independently generated images are ready.
const allowPendingAssets = hasArgument("--allow-pending-assets");
const requestedSiteId = argumentValue("--site-id") ?? SITE_ID;
const confirmation = argumentValue("--confirm") ?? "";
const backupRoot = argumentValue("--backup-dir") ?? path.resolve("releases/backups/aidreamcapes");
const selectedSlugs = new Set(String(argumentValue("--slugs") ?? "").split(",").map((value) => value.trim()).filter(Boolean));

assert.equal(requestedSiteId, SITE_ID, `This migration is restricted to ${SITE_ID}.`);
if (applyProduction) {
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: true, productionConfirmed: confirmation === "production" });
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
}
const allPages = validateAidreamcapesImageThemePages({ requireAssets: apply && !navigationOnly && !allowPendingAssets });
const pages = allPages.filter((page) => !selectedSlugs.size || selectedSlugs.has(page.seo.canonicalPath.split("/").filter(Boolean).pop()));
assert(pages.length > 0, "No matching image theme pages.");

const imageHrefByLabel = new Map([
  ["Ecommerce Main Image", "/ai-image-generation/ecommerce-main-image"],
  ["Main Image", "/ai-image-generation/ecommerce-main-image"],
  ["Lifestyle Scene", "/ai-image-generation/lifestyle-scene"],
  ["Packshot Multi-angle", "/ai-image-generation/packshot-multi-angle"],
  ["Packshot", "/ai-image-generation/packshot-multi-angle"],
  ["Macro Details", "/ai-image-generation/macro-details"],
  ["Bundle Sets", "/ai-image-generation/bundle-sets"],
  ["Size Reference", "/ai-image-generation/size-reference"],
  ["Feature Infographic", "/ai-image-generation/feature-infographic"],
  ["Comparison Chart", "/ai-image-generation/comparison-chart"],
  ["Feed Ad Still", "/ai-image-generation/feed-ad-still"],
  ["Feed / Story Static Ad", "/ai-image-generation/feed-ad-still"],
  ["UGC Still Ad", "/ai-image-generation/ugc-still-ad"],
  ["Story 9:16 Ad", "/ai-image-generation/story-ad-vertical"],
  ["Carousel Set", "/ai-image-generation/carousel-set"],
  ["Sale / BF Key Visual", "/ai-image-generation/sale-campaign-key-visual"],
  ["Lookbook Cover", "/ai-image-generation/lookbook-cover"],
  ["On-Model Generation", "/ai-image-generation/on-model-generation"],
  ["Virtual Try-On", "/ai-image-generation/virtual-try-on"],
  ["Hair / Makeup Preview", "/ai-image-generation/hair-makeup-preview"],
  ["Jewelry Positioning", "/ai-image-generation/jewelry-positioning"],
  ["Ghost Mannequin", "/ai-image-generation/ghost-mannequin"],
  ["Colorway Variations", "/ai-image-generation/colorway-variations"],
  ["Background Remove / Replace", "/ai-image-generation/background-remove-replace"],
  ["Enhance / Upscale", "/ai-image-generation/enhance-upscale"],
  ["Old Photo Restore", "/ai-image-generation/old-photo-restore"],
  ["Commercial Lighting", "/ai-image-generation/commercial-lighting"],
  ["Packaging Mockup", "/ai-image-generation/packaging-mockup"],
  ["Professional Headshot", "/ai-image-generation/professional-headshot"],
  ["Creator Portrait", "/ai-image-generation/creator-portrait"],
  ["Team Directory", "/ai-image-generation/team-directory"],
  ["Social / Dating Profile", "/ai-image-generation/social-profile-photo"],
  ["Fashion Editorial", "/ai-image-generation/fashion-editorial"]
]);

const marketingHrefByLabel = new Map([
  ["Main Image", "/ai-image-generation/ecommerce-main-image"],
  ["Ecommerce Main Image", "/ai-image-generation/ecommerce-main-image"],
  ["Lifestyle Scene", "/ai-image-generation/lifestyle-scene"],
  ["Packshot Multi-angle", "/ai-image-generation/packshot-multi-angle"],
  ["Packshot", "/ai-image-generation/packshot-multi-angle"],
  ["Feed Ad Still", "/ai-image-generation/feed-ad-still"],
  ["Feed / Story Static Ad", "/ai-image-generation/feed-ad-still"],
  ["Story 9:16 Ad", "/ai-image-generation/story-ad-vertical"],
  ["On-Model Generation", "/ai-image-generation/on-model-generation"],
  ["Virtual Try-On", "/ai-image-generation/virtual-try-on"],
  ["Black Friday", "/ai-image-generation/sale-campaign-key-visual"],
  ["Sale / BF Key Visual", "/ai-image-generation/sale-campaign-key-visual"]
]);

// Navigation is shared site data, so an unfinished image batch must never make
// its menu items disappear. Keep the canonical groups here so a rerun can also
// repair a settings row that was emptied by the old readiness filter.
const canonicalImageGroupDefinitions = [
  {
    label: "Listing / Store",
    items: [
      "Ecommerce Main Image",
      "Lifestyle Scene",
      "Packshot Multi-angle",
      "Macro Details",
      "Bundle Sets",
      "Size Reference",
      "Feature Infographic",
      "Comparison Chart"
    ]
  },
  {
    label: "Static Ads / Feed",
    items: [
      "Feed Ad Still",
      "UGC Still Ad",
      "Story 9:16 Ad",
      "Carousel Set",
      "Sale / BF Key Visual",
      "Lookbook Cover"
    ]
  },
  {
    label: "Model / Try-On",
    items: [
      "On-Model Generation",
      "Virtual Try-On",
      "Hair / Makeup Preview",
      "Jewelry Positioning",
      "Ghost Mannequin",
      "Colorway Variations"
    ]
  },
  {
    label: "AI Tools",
    items: [
      "Background Remove / Replace",
      "Enhance / Upscale",
      "Old Photo Restore",
      "Commercial Lighting",
      "Packaging Mockup"
    ]
  },
  {
    label: "Portrait / Brand",
    items: [
      "Professional Headshot",
      "Creator Portrait",
      "Team Directory",
      "Social / Dating Profile",
      "Fashion Editorial"
    ]
  }
];

const canonicalMarketingGroupDefinitions = [
  {
    label: "Listing Stills",
    items: ["Main Image", "Lifestyle Scene", "Packshot", "Feed / Story Static Ad"]
  },
  {
    label: "Promo",
    items: ["Launch / Sale", "Black Friday", "Drop Campaign"]
  },
  {
    label: "Catalog / Try-On",
    items: ["On-Model", "Virtual Try-On", "App / SaaS Ads"]
  }
];

const retiredAidreamcapesNavigationPaths = new Set([
  "/ai-image-generation/rich-lifestyle",
  "/ai-image-generation/social-cards",
  "/ai-image-generation/black-friday",
  "/ai-image-generation/street-style",
  "/ai-image-generation/hairstyle-generator",
  "/ai-image-generation/edit-by-prompt",
  "/ai-image-generation/background-remover",
  "/ai-image-generation/photo-enhancer",
  "/ai-image-generation/old-photo-restoration",
  "/ai-image-generation/headshot",
  "/ai-image-generation/avatar",
  "/ai-image-generation/portrait-photo",
  "/tools/product-reverie",
  "/tools/permission-safe-photo-planner"
]);

function pageIdFor(page) {
  return `aidreamcapes_image_theme_${page.seo.canonicalPath.split("/").filter(Boolean).pop().replace(/[^a-z0-9]+/g, "_")}`;
}

function pageContent(page) {
  const slug = page.seo.canonicalPath.split("/").pop();
  const sectionId = slug === "ecommerce-main-image" ? "ai_image_theme_landing_1" : `ai_image_theme_landing_${slug.replace(/[^a-z0-9]+/g, "_")}`;
  const sourceRevision = slug === "ecommerce-main-image" ? "aidreamcapes-ecommerce-main-image-v3-native-1880-independent" : SOURCE_REVISION;
  const images = [page.hero.productImage, page.hero.outputImage, ...page.examples.items.map((item) => item.image)];
  return {
    seo: { ...page.seo, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
    version: 1,
    pageType: "ai_tool",
    sections: {
      [sectionId]: {
        type: "ai_image_theme_landing",
        blocks: [],
        settings: { anchor: slug, contentKey: slug, content: page }
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
    sectionsOrder: [sectionId],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: `aidreamcapes/image-theme/${page.seo.canonicalPath.split("/").pop()}`,
      faqCount: page.faq.items.length,
      mediaCount: images.length,
      sectionTypes: ["ai_image_theme_landing"],
      sourceRevision,
      requiredSections: [sectionId]
    }
  };
}

function canonicalizeGroups(groups, definitions, hrefByLabel) {
  if (!Array.isArray(groups)) return;
  const before = JSON.stringify(groups);
  const existingByLabel = new Map(groups.map((group) => [group.label, group]));
  for (const definition of definitions) {
    const group = existingByLabel.get(definition.label) ?? { label: definition.label, items: [] };
    const existingItems = Array.isArray(group.items) ? group.items : [];
    group.items = definition.items.map((label) => {
      const href = hrefByLabel.get(label);
      const existing = existingItems.find((item) => item?.label === label || (href && item?.href === href));
      return {
        ...(existing && typeof existing === "object" ? existing : {}),
        label,
        href: href ?? existing?.href ?? ""
      };
    });
    if (!existingByLabel.has(definition.label)) groups.push(group);
  }
  return before === JSON.stringify(groups) ? 0 : 1;
}

function updateNavigation(source) {
  const next = structuredClone(source ?? {});
  let changed = 0;
  const visitGroups = (groups, map) => {
    if (!Array.isArray(groups)) return;
    for (const group of groups) {
      if (!Array.isArray(group.items)) continue;
      const retainedItems = [];
      for (const item of group.items) {
        if (retiredAidreamcapesNavigationPaths.has(item.href)) {
          changed += 1;
          continue;
        }
        const target = map.get(item.label);
        if (target && typeof item.href === "string" && item.href !== target) {
          item.href = target;
          changed += 1;
        }
        retainedItems.push(item);
      }
      group.items = retainedItems;
    }
  };
  const zip = next.aidreamcapesZipNavigation ?? {};
  changed += canonicalizeGroups(zip.image?.groups, canonicalImageGroupDefinitions, imageHrefByLabel) ?? 0;
  changed += canonicalizeGroups(zip.marketing?.groups, canonicalMarketingGroupDefinitions, marketingHrefByLabel) ?? 0;
  visitGroups(zip.image?.groups, imageHrefByLabel);
  visitGroups(zip.marketing?.groups, marketingHrefByLabel);
  visitGroups(next.image?.groups, imageHrefByLabel);
  visitGroups(next.marketing?.groups, marketingHrefByLabel);
  return { next, changed };
}

const prisma = new PrismaClient();
try {
  const [site, existingPages, settings] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: pages.map((page) => page.seo.canonicalPath) } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(site, `${SITE_ID}: site not found`);
  assert(settings, `${SITE_ID}: theme settings not found`);
  const existingBySlug = new Map(existingPages.map((page) => [page.slug, page]));
  const nextPages = pages.map((page) => ({
    id: existingBySlug.get(page.seo.canonicalPath)?.id ?? pageIdFor(page),
    siteId: SITE_ID,
    pageType: "ai_tool",
    templateKey: `ai-image-theme-${page.seo.canonicalPath.split("/").pop()}`,
    slug: page.seo.canonicalPath,
    title: page.seo.title,
    contentJson: pageContent(page)
  }));
  const activeThemePaths = new Set(
    pages
      .filter((page) => {
        const images = [page.hero.productImage, page.hero.outputImage, ...page.examples.items.map((item) => item.image)];
        return [...images, { src: page.seo.ogImage }].every((image) => {
          try {
            return statSync(path.resolve(`public${image.src}`)).isFile();
          } catch {
            return false;
          }
        });
      })
      .map((page) => page.seo.canonicalPath)
  );
  // Asset readiness is reported for release planning only. It must not mutate
  // shared navigation: the menu is database-backed and should remain complete
  // while provider-generated assets are being prepared.
  const draftNavigation = updateNavigation(settings.draftJson);
  const publishedNavigation = updateNavigation(settings.publishedJson);
  const report = nextPages.map((page) => ({
    id: page.id,
    slug: page.slug,
    action: existingBySlug.has(page.slug) ? "UPDATE" : "CREATE",
    media: page.contentJson.mediaManifest.length,
    faq: page.contentJson.contentContract.faqCount,
    allowPendingAssets
  }));

  if (apply) {
    if (applyProduction) {
      assert.equal(confirmation, "production", "Production apply requires --confirm=production.");
    } else {
      assert.equal(confirmation, SITE_ID, `Applying requires --confirm=${SITE_ID}.`);
      assertNonProductionWriteTarget();
    }
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
    const backupPath = path.resolve(backupRoot, `image-theme-pages-${stamp}.json`);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, `${JSON.stringify({ site, existingPages, settings }, null, 2)}\n`, "utf8");
    await prisma.$transaction(async (tx) => {
      if (!navigationOnly) {
        for (const page of nextPages) {
          await tx.livePage.upsert({
            where: { id: page.id },
            create: page,
            update: { pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson }
          });
        }
      }
      await tx.themeSettings.update({
        where: { siteId: SITE_ID },
        data: { draftJson: draftNavigation.next, publishedJson: publishedNavigation.next }
      });
    });
    console.log(JSON.stringify({ ok: true, mode: navigationOnly ? "navigation-applied" : "applied", siteId: SITE_ID, backupPath, navigationChanges: draftNavigation.changed + publishedNavigation.changed, activeThemeCount: activeThemePaths.size, expectedThemeCount: pages.length, allowPendingAssets, pages: navigationOnly ? [] : report }, null, 2));
  } else {
    console.log(JSON.stringify({ ok: true, mode: "dry-run", siteId: SITE_ID, existingPageCount: existingPages.length, navigationChanges: draftNavigation.changed + publishedNavigation.changed, pages: report, applyCommand: navigationOnly
      ? `node scripts/migrate-aidreamcapes-image-theme-pages.mjs --apply-local --navigation-only --site-id=${SITE_ID} --confirm=${SITE_ID}`
      : `node scripts/migrate-aidreamcapes-image-theme-pages.mjs --apply-local --site-id=${SITE_ID} --confirm=${SITE_ID} --allow-pending-assets` }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
