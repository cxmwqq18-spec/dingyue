#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import { validateAidreamcapesImageThemePages } from "./lib/aidreamcapes-image-theme-pages.mjs";
import { argumentValue, assertDatabaseTarget, buildTunneledDatabaseUrl, hasArgument, parseDatabaseUrl } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SITE_SLUG = "aidreamcapes";
const CONFIRMATION = "aidreamcapes-seo-quality";
const BACKUP_ROOT = path.resolve("releases/backups/aidreamcapes");
const POLICY_PATHS = new Set(["/content", "/children-privacy", "/cookies", "/digital-delivery", "/state-privacy", "/refunds"]);
const CONTACT_PATH = "/contact-us";
const FAQ_PATH = "/faq";

const SEO_REPLACEMENTS = new Map([
  ["/marketing", { title: "AI Marketing Workflows for Ecommerce | Aidreamcapes" }],
  ["/ai-image-generation/professional-headshot", { description: "Create a polished professional headshot for LinkedIn, resumes, team pages, and creator profiles from an approved photo. Review the result before sharing." }],
  ["/ai-image-generation/ecommerce-main-image", { description: "Create a clean ecommerce main image from one product reference. Keep it clear and centered for Shopify, marketplace, and DTC store pages with Aidreamcapes." }],
  ["/ai-image-generation/lifestyle-scene", { description: "Create natural lifestyle product photos with real-world settings, clear context, and focus on what you sell for Shopify, marketplaces, and online stores." }],
  ["/ai-image-generation/fashion-editorial", { description: "Create AI fashion editorial images for lookbooks, product launches, campaigns, and social content with guided styling and review-ready outputs." }],
  ["/ai-image-generation/feed-ad-still", { description: "Create AI feed ad images for product launches, paid social, and ecommerce campaigns with a clear hook, product proof, and review-ready framing." }],
  ["/ai-image-generation/jewelry-positioning", { description: "Create AI jewelry positioning images for ecommerce, catalogs, and social campaigns with controlled placement and review-ready product detail." }],
  ["/ai-image-generation/colorway-variations", { description: "Create AI product color variations for ecommerce listings, catalogs, and campaigns while keeping the product shape, materials, and details ready for review." }],
  ["/ai-image-generation/carousel-set", { description: "Create AI carousel ad images for ecommerce and social campaigns with a consistent product story, clear sequence, and review-ready visuals for every slide." }],
  ["/ai-image-generation/enhance-upscale", { description: "Enhance soft, dark, or compressed product and portrait images with AI before using them in listings, profiles, campaigns, or private creative workflows." }],
  ["/ai-image-generation/packaging-mockup", { description: "Create AI packaging mockups for product launches, ecommerce pages, and campaign concepts with clear proportions, readable structure, and review-ready visuals." }],
  ["/ai-image-generation/bundle-sets", { description: "Create AI product bundle images for ecommerce listings, promotions, and catalogs with clear item grouping, consistent scale, and review-ready composition." }],
  ["/ai-image-generation/on-model-generation", { description: "Create AI on-model product images for ecommerce, fashion campaigns, and social content with guided styling, clear product placement, and review-ready results." }],
  ["/ai-image-generation/background-remove-replace", { description: "Remove or replace photo backgrounds with AI for products, portraits, listings, and campaigns while preserving subject edges, scale, and review-ready detail." }],
  ["/ai-image-generation/commercial-lighting", { description: "Create AI commercial lighting images for product pages, catalogs, and campaigns with controlled highlights, clear material detail, and review-ready composition." }],
  ["/ai-image-generation/story-ad-vertical", { description: "Create AI vertical story ad images for mobile campaigns, product launches, and social promotions with a clear hook, readable framing, and review-ready visuals." }],
  ["/ai-image-generation/macro-details", { description: "Create AI macro product detail images for ecommerce pages, catalogs, and campaigns with close-up material focus, controlled framing, and review-ready results." }],
  ["/ai-image-generation/team-directory", { description: "Create AI team directory portraits for company pages, staff profiles, and internal communications with consistent framing and review-ready results." }],
  ["/ai-video-generation/founder-update", { description: "Create AI founder update videos from an approved portrait, product image, or short message with clear pacing, reviewable claims, and a publishing workflow." }],
  ["/ai-video-generation/how-to-video", { description: "Create AI how-to videos from approved images and steps for tutorials, demonstrations, and training with clear sequencing and review before publishing." }],
  ["/ai-video-generation/local-service-ad", { description: "Create AI local service ad videos with an offer, service area, proof, and CTA while keeping contact details and claims under your control before publishing." }],
  ["/ai-video-generation/multilingual-video", { description: "Create AI multilingual videos from approved source material with reviewable pronunciation, subtitles, timing, names, and final messaging for each audience." }],
  ["/ai-video-generation/home-organization", { description: "Create AI home organization videos that show a space, the change, and useful steps with clear continuity, practical context, and review before sharing." }],
  ["/blog/ai-talking-photo-video-guide", { description: "Use this AI talking photo guide to plan portraits, scripts, consent, disclosure, review steps, and publishing choices before sharing a generated video." }]
]);

const FAQ_RELATED_LINKS = [
  { label: "Explore AI image generation", href: "/ai-image-generation" },
  { label: "Explore AI video generation", href: "/ai-video-generation" },
  { label: "Read the safe AI content guide", href: "/blog/ai-content-disclosure-safe-usage" }
];

const CONTACT_INTRO_BODY = `Aidreamcapes support can help with account access, billing questions, generation failures, copyright and permission concerns, and privacy requests. When you contact us, include the email on your account, the page or workflow you were using, and a short description of what happened. Do not send passwords, payment card numbers, or private material that support does not need to review.`;

const CONTACT_DETAILS_BODY = `<h2>How to contact Aidreamcapes</h2><p>Email <a href="mailto:support@aidreamcapes.com">support@aidreamcapes.com</a> for account, billing, generation, rights, or privacy support. We aim to reply within two business days. A reply may take longer when we need to verify account ownership, inspect a failed job, or coordinate a request involving uploaded content.</p><h2>What to include</h2><p>For a failed generation, share the workflow name, approximate time, and a description of the result. For a billing question, include the account email and transaction date, but never send full card details. For a copyright, portrait, or logo concern, explain what you own or what permission you have and identify the affected upload or result. For a privacy request, use the account email so we can confirm the request safely.</p><h2>Before you upload</h2><p>Only upload images, audio, text, logos, and other material that you own or have permission to use. Get consent from people shown in portraits or videos, and check whether a generated result needs disclosure before publishing it. Review every result for inaccurate faces, hands, labels, claims, contact details, and unwanted changes before sharing.</p><h2>Support boundaries</h2><p>Support can help explain an account or workflow, but it cannot approve rights for you or guarantee that an AI output is accurate. Keep original source files, prompt notes, permissions, and the final approval record for projects you publish. If a result includes a person, brand, product label, or claim, check the intended use and correct errors before distribution. Tell us promptly if content should be removed or access should be restricted.</p><p>Read the <a href="/privacy">Privacy Policy</a>, <a href="/terms">Terms of Service</a>, <a href="/refunds">Refund Policy</a>, and <a href="/content">Content Policy</a> for the rules that apply to your use of Aidreamcapes.</p>`;

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function hash(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function writeBackup(payload) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_ROOT, `seo-quality-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(file, 0o600);
  return file;
}

function ensureProductionTunnel() {
  const target = String(process.env.DATABASE_TARGET ?? "").trim().toLowerCase();
  if (target !== "production") return;
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if ((current.database === "dingyue_local" || current.port === 15433) && process.env.REMOTE_DB_DATABASE_URL) {
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  const connected = parseDatabaseUrl(process.env.DATABASE_URL);
  assert(["127.0.0.1", "localhost", "::1"].includes(connected.host) && connected.port === 15432, `Production quality repair must use the protected SSH tunnel; received ${connected.host}:${connected.port}.`);
}

function pageContent(page) {
  const slug = page.seo.canonicalPath.split("/").pop();
  const sectionId = `ai_image_theme_landing_${slug.replace(/[^a-z0-9]+/g, "_")}`;
  const images = [page.hero.productImage, page.hero.outputImage, ...page.examples.items.map((item) => item.image)];
  return {
    seo: { ...page.seo, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
    version: 1,
    pageType: "ai_tool",
    sections: {
      [sectionId]: { type: "ai_image_theme_landing", blocks: [], settings: { anchor: slug, contentKey: slug, content: page } }
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
      pageKey: `aidreamcapes/image-theme/${slug}`,
      faqCount: page.faq.items.length,
      mediaCount: images.length,
      sectionTypes: ["ai_image_theme_landing"],
      sourceRevision: slug === "ecommerce-main-image" ? "aidreamcapes-ecommerce-main-image-v4-seo-quality" : "aidreamcapes-image-themes-v3-seo-quality",
      requiredSections: [sectionId]
    }
  };
}

function applySeoReplacement(seo, slug) {
  const replacement = SEO_REPLACEMENTS.get(slug);
  return replacement ? { ...(seo && typeof seo === "object" ? seo : {}), ...replacement } : seo;
}

function applyThemeSeo(page) {
  const replacement = SEO_REPLACEMENTS.get(page.seo.canonicalPath);
  if (!replacement) return page;
  return { ...page, seo: { ...page.seo, ...replacement, twitterDescription: replacement.description ?? page.seo.twitterDescription } };
}

function updatePolicyBodies(value) {
  if (Array.isArray(value)) return value.map(updatePolicyBodies);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "body" && typeof child === "string" ? child.replace(/<h3\b/gi, "<h2").replace(/<\/h3>/gi, "</h2>") : updatePolicyBodies(child)
  ]));
}

function updateContactJson(json) {
  const next = clone(json) ?? {};
  for (const [sectionId, section] of Object.entries(next.sections ?? {})) {
    if (!section || typeof section !== "object") continue;
    const settings = section.settings && typeof section.settings === "object" ? section.settings : {};
    if (section.type === "rich_text" && /contact_intro/i.test(sectionId)) settings.body = CONTACT_INTRO_BODY;
    if (section.type === "policy_content" && /contact_details/i.test(sectionId)) settings.body = CONTACT_DETAILS_BODY;
    section.settings = settings;
  }
  return next;
}

function updateArticleSummary(json, description) {
  const next = clone(json) ?? {};
  for (const section of Object.values(next.sections ?? {})) {
    if (!section || typeof section !== "object" || section.type !== "blog_article") continue;
    section.settings = { ...(section.settings ?? {}), summary: description };
  }
  return next;
}

function updateSpecialJson(json, slug) {
  let next = clone(json) ?? {};
  if (SEO_REPLACEMENTS.has(slug)) {
    const replacement = SEO_REPLACEMENTS.get(slug);
    next.seo = applySeoReplacement(next.seo, slug);
    if (replacement.description && slug === "/blog/ai-talking-photo-video-guide") next = updateArticleSummary(next, replacement.description);
  }
  if (slug === FAQ_PATH) {
    const intro = next.sections?.intro_1;
    if (intro && typeof intro === "object") {
      intro.settings = { ...(intro.settings ?? {}), relatedLinks: FAQ_RELATED_LINKS };
    }
  }
  if (slug === CONTACT_PATH) next = updateContactJson(next);
  if (POLICY_PATHS.has(slug)) next = updatePolicyBodies(next);
  return next;
}

async function otherSiteSentinel(prisma) {
  const livePages = await prisma.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true } });
  const themePages = await prisma.themePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } });
  const themeSettings = await prisma.themeSettings.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { siteId: "asc" }, select: { id: true, siteId: true, draftJson: true, publishedJson: true } });
  return { livePages, themePages, themeSettings, hash: hash({ livePages, themePages, themeSettings }) };
}

function validateSeoQualityMap() {
  for (const [slug, replacement] of SEO_REPLACEMENTS) {
    if (replacement.title) assert(replacement.title.length >= 45 && replacement.title.length <= 60, `${slug}: title length is outside 45-60.`);
    if (replacement.description) assert(replacement.description.length >= 140 && replacement.description.length <= 160, `${slug}: description length is outside 140-160.`);
  }
}

function prepareRegularRow(row) {
  const contentJson = updateSpecialJson(row.contentJson, row.slug);
  const replacement = SEO_REPLACEMENTS.get(row.slug);
  const title = replacement?.title ?? row.title;
  return { ...row, title, contentJson };
}

function prepareThemeRow(row, generatedBySlug) {
  const generated = generatedBySlug.get(row.slug);
  if (generated) {
    const contentJson = pageContent(generated);
    return { ...row, title: generated.seo.title, draftJson: contentJson, publishedJson: contentJson };
  }
  const draftJson = updateSpecialJson(row.draftJson, row.slug);
  const publishedJson = updateSpecialJson(row.publishedJson, row.slug);
  const replacement = SEO_REPLACEMENTS.get(row.slug);
  return { ...row, title: replacement?.title ?? row.title, draftJson, publishedJson };
}

function changed(before, after, fields) {
  return fields.some((field) => field === "title" ? before[field] !== after[field] : hash(before[field]) !== hash(after[field]));
}

async function main() {
  ensureProductionTunnel();
  const target = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
  const apply = hasArgument("--apply");
  const confirmation = argumentValue("--confirm") || "";
  assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply && target === "production", productionConfirmed: confirmation === CONFIRMATION });
  if (apply) assert.equal(confirmation, CONFIRMATION, `Applying requires --confirm=${CONFIRMATION}.`);
  validateSeoQualityMap();

  const pages = validateAidreamcapesImageThemePages({ requireAssets: false }).map(applyThemeSeo);
  const generatedBySlug = new Map(pages.map((page) => [page.seo.canonicalPath, page]));
  const explicitSlugs = new Set([...SEO_REPLACEMENTS.keys(), ...generatedBySlug.keys(), CONTACT_PATH, FAQ_PATH, ...POLICY_PATHS]);
  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, status: true } });
    assert(site, `${SITE_ID}: site not found.`);
    assert.equal(site.slug, SITE_SLUG, `${SITE_ID}: unexpected site slug.`);
    assert.equal(site.primaryDomain.toLowerCase(), "www.aidreamcapes.com", `${SITE_ID}: unexpected site primary domain.`);
    const livePages = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...explicitSlugs] } }, orderBy: { slug: "asc" }, select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true } });
    const themePages = await prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...explicitSlugs] } }, orderBy: { slug: "asc" }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true, updatedAt: true } });
    const beforeOtherSites = await otherSiteSentinel(prisma);
    const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
    const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
    for (const slug of explicitSlugs) {
      assert(liveBySlug.has(slug), `${slug}: explicit LivePage row not found.`);
    }
    // The current image-theme renderer is LivePage-backed. Existing ThemePage
    // rows are synchronized when present, but this repair never creates a
    // second page record just to satisfy the quality pass.

    const preparedLive = livePages.map((row) => generatedBySlug.has(row.slug)
      ? { ...row, title: generatedBySlug.get(row.slug).seo.title, contentJson: pageContent(generatedBySlug.get(row.slug)) }
      : prepareRegularRow(row));
    const preparedTheme = themePages.map((row) => prepareThemeRow(row, generatedBySlug));
    const changedLive = preparedLive.filter((row) => changed(liveBySlug.get(row.slug), row, ["title", "contentJson"]));
    const changedTheme = preparedTheme.filter((row) => changed(themeBySlug.get(row.slug), row, ["title", "draftJson", "publishedJson"]));
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target: { siteId: SITE_ID, siteSlug: SITE_SLUG, databaseTarget: target },
      explicitRouteCount: explicitSlugs.size,
      imageThemeCount: generatedBySlug.size,
      changedLivePageCount: changedLive.length,
      changedLiveSlugs: changedLive.map((row) => row.slug).sort(),
      changedThemePageCount: changedTheme.length,
      changedThemeSlugs: changedTheme.map((row) => row.slug).sort(),
      otherSiteSentinelHash: beforeOtherSites.hash,
      sharedMedia: "unchanged"
    };
    if (!apply) {
      console.log(JSON.stringify({ ...summary, applyCommand: `DATABASE_TARGET=production DINGYUE_ENV=production node scripts/repair-aidreamcapes-seo-quality.mjs --apply --confirm=${CONFIRMATION}` }, null, 2));
      return;
    }

    const backupPath = writeBackup({ createdAt: new Date().toISOString(), site, explicitSlugs: [...explicitSlugs].sort(), livePages, themePages, otherSiteSentinel: beforeOtherSites });
    await prisma.$transaction(async (tx) => {
      for (const row of changedLive) await tx.livePage.update({ where: { id: row.id }, data: { title: row.title, contentJson: row.contentJson } });
      for (const row of changedTheme) await tx.themePage.update({ where: { id: row.id }, data: { title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson } });
    }, { maxWait: 10000, timeout: 120000 });

    const afterOtherSites = await otherSiteSentinel(prisma);
    assert.equal(afterOtherSites.hash, beforeOtherSites.hash, "A non-target site changed; quality repair is not considered safe.");
    const readLive = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...explicitSlugs] } }, select: { id: true, slug: true, title: true, contentJson: true } });
    const readTheme = await prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...explicitSlugs] } }, select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true } });
    const readLiveBySlug = new Map(readLive.map((row) => [row.slug, row]));
    const readThemeBySlug = new Map(readTheme.map((row) => [row.slug, row]));
    for (const row of preparedLive) {
      const actual = readLiveBySlug.get(row.slug);
      assert(actual, `${row.slug}: LivePage readback missing.`);
      assert.equal(actual.title, row.title, `${row.slug}: LivePage title readback mismatch.`);
      assert.equal(hash(actual.contentJson), hash(row.contentJson), `${row.slug}: LivePage content readback mismatch.`);
    }
    for (const row of preparedTheme) {
      const actual = readThemeBySlug.get(row.slug);
      assert(actual, `${row.slug}: ThemePage readback missing.`);
      assert.equal(actual.title, row.title, `${row.slug}: ThemePage title readback mismatch.`);
      assert.equal(hash(actual.draftJson), hash(row.draftJson), `${row.slug}: ThemePage draft readback mismatch.`);
      assert.equal(hash(actual.publishedJson), hash(row.publishedJson), `${row.slug}: ThemePage published readback mismatch.`);
    }
    console.log(JSON.stringify({ ...summary, mode: "applied", backupPath, afterOtherSiteSentinelHash: afterOtherSites.hash }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
