#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes/public-editorial/20260918-v1";
const APPLY = process.argv.includes("--apply");
const PRODUCTION_CONFIRMATION = "--confirm-production-aidreamcapes-public-editorial-images";
const APPLY_PRODUCTION = process.argv.includes(PRODUCTION_CONFIRMATION);

const assets = {
  login: {
    url: `${ASSET_ROOT}/login-private-studio.png`,
    alt: "Dark creative studio desk with abstract photo prints, a notebook, and a glass prism.",
    secondaryUrl: `${ASSET_ROOT}/creators-channel-studio.png`,
    secondaryAlt: "Creator studio with a camera, photo proofs, and color swatches."
  },
  pricing: {
    url: `${ASSET_ROOT}/pricing-credit-atlas.png`,
    alt: "Abstract glass markers and a blank ledger representing transparent credit planning."
  },
  workflow: {
    url: `${ASSET_ROOT}/workflow-source-to-gallery.png`,
    alt: "Creative studio desk showing photo prints moving toward a private gallery box."
  },
  creators: {
    url: `${ASSET_ROOT}/creators-channel-studio.png`,
    alt: "Creator studio with a camera, photo proofs, and color swatches."
  },
  blog: {
    url: `${ASSET_ROOT}/blog-upload-prep.png`,
    alt: "Editorial desk with an open notebook, photo proofs, and a warm studio lamp."
  },
  article: {
    url: `${ASSET_ROOT}/article-motion-frames.png`,
    alt: "Motion-ready photo prints with a translucent acrylic frame in a dark studio."
  },
  contact: {
    url: `${ASSET_ROOT}/contact-support-studio.png`,
    alt: "Support workspace with a notebook, organized photo prints, and a warm desk lamp."
  },
  aboutPrivate: {
    url: `${ASSET_ROOT}/about-private-workspace.png`,
    alt: "Private creative workspace with abstract photo prints, a blank monitor, and organized studio materials."
  },
  aboutStory: {
    url: `${ASSET_ROOT}/about-studio-story.png`,
    alt: "Editorial studio table with framed abstract prints, a camera, and warm late-afternoon light."
  }
};

const pagePlans = {
  "/login": (json) => patchSections(json, {
    login_1: { imageUrl: assets.login.url, imageAlt: assets.login.alt, secondaryImageUrl: assets.login.secondaryUrl, secondaryImageAlt: assets.login.secondaryAlt },
    plan_rules_1: { imageUrl: assets.pricing.url, imageAlt: assets.pricing.alt }
  }),
  "/pricing": (json) => patchSections(json, {
    pricing_intro_1: { imageUrl: assets.pricing.url, imageAlt: assets.pricing.alt },
    pricing_1: { backgroundImage: assets.pricing.url },
    plan_rules_1: { imageUrl: assets.pricing.url, imageAlt: assets.pricing.alt }
  }),
  "/workflow": (json) => patchSections(json, {
    workflow_intro_1: { imageUrl: assets.workflow.url, imageAlt: assets.workflow.alt },
    tutorial_video_1: { imageUrl: assets.article.url, imageAlt: assets.article.alt },
    tutorial_image_video_1: { imageUrl: assets.blog.url, imageAlt: assets.blog.alt },
    workflow_1: { imageUrl: assets.workflow.url, imageAlt: assets.workflow.alt },
    plan_rules_1: { imageUrl: assets.pricing.url, imageAlt: assets.pricing.alt }
  }),
  "/creators-circle": (json) => patchSections(json, {
    creators_intro_1: { imageUrl: assets.creators.url, imageAlt: assets.creators.alt },
    creators_fit_1: { imageUrl: assets.creators.url, imageAlt: "Creator workspace with photo proofs, a camera, and color swatches for a channel review." },
    partner_form_1: { imageUrl: assets.creators.url, imageAlt: "Creator workspace with organized photo proofs and a camera ready for collaboration." },
    partner_expectations_1: { imageUrl: assets.creators.url, imageAlt: "Editorial creator desk with photo proofs and a camera for a private collaboration brief." },
    pricing_1: { backgroundImage: assets.pricing.url }
  }),
  "/blog": (json) => patchSections(json, {
    blog_intro_1: { imageUrl: assets.blog.url, imageAlt: assets.blog.alt },
    packages_strip_1: {},
  }, {
    packages_strip_1: [
      { imageUrl: assets.blog.url, imageAlt: "Editorial desk with an open notebook, photo proofs, and a warm studio lamp." },
      { imageUrl: assets.article.url, imageAlt: assets.article.alt },
      { imageUrl: assets.pricing.url, imageAlt: assets.pricing.alt },
      { imageUrl: assets.workflow.url, imageAlt: assets.workflow.alt }
    ]
  }),
  "/blog/video-photo-package-guide": (json) => patchSections(json, {
    blog_detail_1: { imageUrl: assets.article.url, imageAlt: assets.article.alt }
  }),
  "/about-us": (json) => patchSections(json, {
    about_intro_1: { imageUrl: assets.aboutPrivate.url, imageAlt: assets.aboutPrivate.alt },
    about_values_1: { imageUrl: assets.aboutPrivate.url, imageAlt: "Private creative workspace with abstract photo prints and organized materials for a focused workflow." },
    about_company_1: { imageUrl: assets.aboutStory.url, imageAlt: assets.aboutStory.alt }
  }),
  "/contact-us": (json) => patchSections(json, {
    contact_intro_1: { imageUrl: assets.contact.url, imageAlt: assets.contact.alt }
  })
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patchSections(json, sectionPatches, blockPatches = {}) {
  const next = clone(json);
  assert(next && typeof next === "object", "page JSON must be an object");
  for (const [sectionId, settingsPatch] of Object.entries(sectionPatches)) {
    const section = next.sections?.[sectionId];
    // Production and local publications can legitimately have different
    // optional editorial slots. Keep the migration additive and let the
    // renderer hide slots that are absent from SQL instead of inventing one.
    if (!section) continue;
    section.settings = { ...(section.settings ?? {}), ...settingsPatch };
  }
  for (const [sectionId, patches] of Object.entries(blockPatches)) {
    const section = next.sections?.[sectionId];
    if (!section || !Array.isArray(section.blocks)) continue;
    patches.forEach((patch, index) => {
      if (!section.blocks[index]) return;
      section.blocks[index].settings = { ...(section.blocks[index].settings ?? {}), ...patch };
    });
  }
  return next;
}

async function assertLocalDatabase() {
  const value = process.env.DATABASE_URL;
  assert(value, "DATABASE_URL is required");
  const hostname = new URL(value).hostname;
  assert(["127.0.0.1", "localhost", "::1"].includes(hostname), `Refusing non-local database: ${hostname}`);
}

async function assertDatabaseTarget(prisma) {
  if (!APPLY_PRODUCTION) {
    await assertLocalDatabase();
    return;
  }
  assert(APPLY, `${PRODUCTION_CONFIRMATION} requires --apply`);
  assert.equal(process.env.DINGYUE_ENV, "production", "Production migration requires DINGYUE_ENV=production");
  assert.equal(process.env.DATABASE_TARGET, "production", "Production migration requires DATABASE_TARGET=production");
  const site = await prisma.site.findUnique({
    where: { id: SITE_ID },
    select: { primaryDomain: true, domains: { select: { domain: true, status: true } } }
  });
  assert(site, `Missing site: ${SITE_ID}`);
  assert.equal(site.primaryDomain?.toLowerCase(), "www.aidreamcapes.com", "Production migration target is not www.aidreamcapes.com");
  assert(site.domains.some((domain) => domain.domain.toLowerCase() === "www.aidreamcapes.com" && domain.status === "active"), "Active Aidreamcapes production domain mapping is missing");
}

async function assertAssets() {
  const refs = Object.values(assets).flatMap((asset) => [asset.url, asset.secondaryUrl]).filter(Boolean);
  for (const ref of refs) {
    assert(ref.startsWith(ASSET_ROOT), `asset escaped Aidreamcapes editorial root: ${ref}`);
    const filePath = path.resolve(process.cwd(), `public${ref}`);
    await fs.access(filePath);
  }
}

function validateImageAlt(value, label) {
  assert(typeof value === "string" && value.trim().length >= 12, `${label}: imageAlt is required`);
  assert(!/[\u4e00-\u9fff]/.test(value), `${label}: imageAlt must be English`);
}

function validatePublicJson(json, pageSlug) {
  for (const sectionId of json.sectionsOrder ?? []) {
    const section = json.sections?.[sectionId];
    if (!section) continue;
    const settings = section.settings ?? {};
    if (settings.imageUrl) validateImageAlt(settings.imageAlt, `${pageSlug}:${sectionId}`);
    if (settings.secondaryImageUrl) validateImageAlt(settings.secondaryImageAlt, `${pageSlug}:${sectionId}:secondary`);
    for (const [index, block] of (section.blocks ?? []).entries()) {
      if (block.settings?.imageUrl) validateImageAlt(block.settings.imageAlt, `${pageSlug}:${sectionId}:${index}`);
    }
  }
}

const prisma = new PrismaClient();
try {
  if (APPLY) {
    await assertDatabaseTarget(prisma);
    await assertAssets();
  } else {
    const missing = [];
    for (const ref of Object.values(assets).flatMap((asset) => [asset.url, asset.secondaryUrl]).filter(Boolean)) {
      try { await fs.access(path.resolve(process.cwd(), `public${ref}`)); } catch { missing.push(ref); }
    }
    if (missing.length) console.log(JSON.stringify({ warning: "supplier_assets_not_generated_yet", missing }, null, 2));
  }

  const slugs = Object.keys(pagePlans);
  const [themePages, livePages] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { id: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { id: true, slug: true, contentJson: true } })
  ]);
  assert.equal(themePages.length, slugs.length, "not all target ThemePage rows exist");
  assert.equal(livePages.length, slugs.length, "not all target LivePage rows exist");

  const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const updates = slugs.map((slug) => {
    const theme = themeBySlug.get(slug);
    const live = liveBySlug.get(slug);
    const update = pagePlans[slug];
    const draftJson = update(theme.draftJson);
    const publishedJson = update(theme.publishedJson);
    const liveJson = update(live.contentJson);
    validatePublicJson(draftJson, slug);
    validatePublicJson(publishedJson, slug);
    validatePublicJson(liveJson, slug);
    return { slug, theme, live, draftJson, publishedJson, liveJson };
  });

  const report = {
    ok: true,
    mode: APPLY ? "apply" : "dry-run",
    siteId: SITE_ID,
    assetRoot: ASSET_ROOT,
    pages: updates.map((item) => ({ slug: item.slug, themePageId: item.theme.id, livePageId: item.live.id, changed: JSON.stringify(item.live.contentJson) !== JSON.stringify(item.liveJson) }))
  };

  if (APPLY) {
    const backupPath = path.join(process.cwd(), "releases/backups/aidreamcapes", `public-editorial-images-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.mkdir(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    await fs.writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, themePages, livePages }, null, 2)}\n`, { mode: 0o600 });
    report.backupPath = backupPath;
    await prisma.$transaction(async (tx) => {
      for (const item of updates) {
        await tx.themePage.update({ where: { id: item.theme.id }, data: { draftJson: item.draftJson, publishedJson: item.publishedJson, updatedAt: new Date() } });
        await tx.livePage.update({ where: { id: item.live.id }, data: { contentJson: item.liveJson, updatedAt: new Date() } });
      }
    });
    report.readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: slugs } }, select: { slug: true, contentJson: true } }).then((rows) => rows.map((row) => ({ slug: row.slug, valid: (validatePublicJson(row.contentJson, row.slug), true) })));
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
