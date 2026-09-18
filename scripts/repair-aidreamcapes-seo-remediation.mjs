#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
  parseDatabaseUrl
} from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SITE_SLUG = "aidreamcapes";
const STALE_SLUG = "/ai-image-generation/headshot";
const STALE_ID = "aidreamcapes_mirror_page_dc81ade5b57414c4";
const CONFIRMATION = "aidreamcapes-seo-remediation";
const BACKUP_ROOT = path.resolve("releases/backups/aidreamcapes");

// These descriptions are intentionally written per route. They are not a
// generic fallback and do not replace the 30 image-theme content contracts.
const SEO_REPLACEMENTS = new Map([
  ["/about-us", {
    title: "About Aidreamcapes: AI Creation Studio | Aidreamcapes",
    description: "Learn how Aidreamcapes turns photos into AI images, videos, and private visual stories. Explore guided creation, secure uploads, and results ready for review."
  }],
  ["/ai-image-generation", {
    title: "AI Image Generation Tools for Product Teams | Aidreamcapes",
    description: "Explore AI image tools for ecommerce, lifestyle, portraits, ads, packaging, and product details. Start with a reference and review results before publishing."
  }],
  ["/ai-image-generation/ecommerce-main-image", {
    description: "Create a clean ecommerce main image from one product reference. Keep it clear and centered for Shopify, marketplace, and DTC store pages with Aidreamcapes."
  }],
  ["/ai-image-generation/lifestyle-scene", {
    description: "Create natural lifestyle product photos with real-world settings, clear context, and focus on what you sell for Shopify, marketplaces, and online stores."
  }],
  ["/ai-save-the-date/new-year", {
    title: "AI New Year Photo & Video Maker | Aidreamcapes",
    description: "Create a polished New Year photo or video from approved images, with room for your date, message, and review before sharing with friends, family, or guests."
  }],
  ["/ai-save-the-date/thanksgiving", {
    title: "AI Thanksgiving Photo & Video Maker | Aidreamcapes",
    description: "Create a warm Thanksgiving photo or video from approved images, with a clear story and room for your message before sharing with family and friends."
  }],
  ["/ai-video-generation/social-media-video", {
    title: "AI Social Media Video Generator | Aidreamcapes",
    description: "Create social media videos from approved photos and ideas, then review pacing, faces, hands, captions, and framing before posting to the platforms you use."
  }],
  ["/ai-video-generation/story-video", {
    title: "AI Story Video Generator for Creators | Aidreamcapes",
    description: "Turn a short idea and approved images into a story video with a clear beginning, middle, and ending. Review each scene before sharing the final cut."
  }],
  ["/ai-video-generation/talking-head-video", {
    title: "AI Talking Head Video Generator | Aidreamcapes"
  }],
  ["/ai-video-generation/talking-photo", {
    title: "AI Talking Photo Creator Tool for Stories | Aidreamcapes",
    description: "Animate an approved portrait into a talking photo with a clear voice and natural movement. Check the face, mouth, timing, and audio before you share the result."
  }],
  ["/ai-video-generation/tiktok-video", {
    title: "AI TikTok Video Generator for Creators | Aidreamcapes",
    description: "Create vertical TikTok video ideas from approved photos and clips, with a strong opening and clear framing. Review faces, timing, and music before posting."
  }],
  ["/ai-video-generation/home-organization", {
    title: "AI Home Organization Video Maker | Aidreamcapes",
    description: "Create a clear home organization video that shows a space, the change, and useful steps. Review object placement, continuity, and the message before sharing."
  }],
  ["/ai-video-generation/local-service-ad", {
    title: "AI Local Service Ad Video Generator | Aidreamcapes",
    description: "Create a local service ad video with a clear offer area, useful context, and room for your own contact details. Review every claim and scene before publishing."
  }],
  ["/ai-video-generation/founder-update", {
    title: "AI Founder Update Video Generator | Aidreamcapes",
    description: "Create a founder update video from an approved portrait, message, or product image. Keep it direct, then review the face, voice, timing, and wording."
  }],
  ["/ai-video-generation/multilingual-video", {
    title: "AI Multilingual Video Generator | Aidreamcapes",
    description: "Create a video for more than one language from approved source material. Check pronunciation, subtitles, timing, names, and the final message before publishing."
  }],
  ["/ai-video-generation/brand-video", {
    title: "AI Brand Video Generator for Teams | Aidreamcapes",
    description: "Create a brand video from approved images, product details, and a clear message. Keep brand claims and final copy under your control before publishing."
  }],
  ["/ai-video-generation/explainer-video", {
    title: "AI Explainer Video Generator for Teams | Aidreamcapes"
  }],
  ["/ai-video-generation/fashion-video", {
    title: "AI Fashion Video Generator for Brands | Aidreamcapes",
    description: "Create a fashion video with clear clothing details, movement, and a deliberate visual mood. Review the outfit, hands, fabric, and final framing before sharing."
  }],
  ["/ai-video-generation/how-to-video", {
    title: "AI How-To Video Generator for Guides | Aidreamcapes",
    description: "Create a helpful how-to video from approved images and steps, with a sequence viewers can follow. Review each action and the instructions before sharing."
  }],
  ["/ai-video-generation/instagram-reels", {
    title: "AI Instagram Reels Generator for Creators | Aidreamcapes",
    description: "Create an Instagram Reels concept from approved photos and clips with a clear opening and useful pacing. Review the final result before posting."
  }],
  ["/ai-video-generation/meme-video", {
    title: "AI Meme Video Generator for Creators | Aidreamcapes",
    description: "Create a meme video from an approved image or idea while keeping the joke, timing, and wording under your control. Review it before sharing publicly."
  }],
  ["/ai-video-generation/motion-generator", {
    title: "AI Motion Generator for Product Ideas | Aidreamcapes",
    description: "Create a short motion concept from an approved image and direction. Review movement, edges, objects, faces, and timing before using the result in a project."
  }],
  ["/ai-video-generation/pet-video", {
    title: "AI Pet Video Generator for Stories | Aidreamcapes",
    description: "Create a playful pet video from approved photos while keeping the animal recognizable. Review movement, body shape, background, and framing before sharing."
  }],
  ["/ai-video-generation/product-ad-video", {
    title: "AI Product Ad Video Generator for Stores | Aidreamcapes",
    description: "Create a product ad video from an approved reference with a clear product focus and space for your offer. Check claims, timing, and copy before publishing."
  }],
  ["/ai-video-generation/video-ad", {
    title: "AI Video Ad Generator for Campaigns | Aidreamcapes",
    description: "Create a campaign-ready video ad from approved images and a clear brief. Keep pricing, terms, claims, and copy under your control, then review every scene."
  }],
  ["/ai-video-generation/youtube-video", {
    title: "AI YouTube Video Generator for Creators | Aidreamcapes",
    description: "Create a YouTube video concept from approved images, clips, and a clear outline. Review the opening, pacing, voice, and captions before publishing."
  }],
  ["/collections", {
    title: "AI Image Collections for Online Stores | Aidreamcapes",
    description: "Browse AI collections for product pages, campaigns, ads, portraits, packaging, and lifestyle scenes. Choose a workflow and review examples before creating."
  }],
  ["/pricing", {
    title: "Aidreamcapes Pricing: AI Image & Video Credits",
    description: "Review Aidreamcapes plans, credits, and image and video workflows before you create. See what each option includes and check the cost before generation."
  }],
  ["/refunds", {
    title: "Aidreamcapes Refund Policy | Credits and Failed Jobs",
    description: "Read the Aidreamcapes refund policy for credits, failed jobs, duplicate charges, and support requests. Keep receipts and contact support with account details."
  }],
  ["/policies/refunds", {
    title: "Aidreamcapes Refund Policy | Credits and Failed Jobs",
    description: "Read the Aidreamcapes refund policy for credits, failed jobs, duplicate charges, and support requests. Keep receipts and contact support with account details."
  }],
  ["/creators-circle", {
    title: "Aidreamcapes Creator Circle | AI Content Tools",
    description: "Explore the Aidreamcapes Creator Circle for practical ideas, product updates, and workflows that help creators plan, review, and share AI projects."
  }],
  ["/children-privacy", {
    title: "Aidreamcapes Children’s Privacy Policy | Safety",
    description: "Learn how Aidreamcapes handles children’s information, age limits, privacy choices, and support requests. Do not upload content without permission."
  }],
  ["/policies/children-privacy", {
    title: "Aidreamcapes Children’s Privacy Policy | Safety",
    description: "Learn how Aidreamcapes handles children’s information, age limits, privacy choices, and support requests. Do not upload content without permission."
  }],
  ["/content", {
    title: "Aidreamcapes Content Policy | Safe AI Uploads",
    description: "Review the Aidreamcapes content policy for approved uploads, prohibited material, impersonation, rights, safety, and responsible use of AI image tools."
  }],
  ["/policies/content", {
    title: "Aidreamcapes Content Policy | Safe AI Uploads",
    description: "Review the Aidreamcapes content policy for approved uploads, prohibited material, impersonation, rights, safety, and responsible use of AI tools."
  }],
  ["/privacy", {
    title: "Aidreamcapes Privacy Policy | Data and AI Uploads",
    description: "Read how Aidreamcapes handles account details, uploaded images, generated results, payments, cookies, and privacy requests when you use the service."
  }],
  ["/policies/privacy", {
    title: "Aidreamcapes Privacy Policy | Data and AI Uploads",
    description: "Read how Aidreamcapes handles account details, uploaded images, generated results, payments, cookies, and privacy requests when you use the service."
  }],
  ["/privacy-policy", {
    title: "Aidreamcapes Privacy Policy | Data and AI Uploads",
    description: "Read how Aidreamcapes handles account details, uploaded images, generated results, payments, cookies, and privacy requests when you use the service."
  }],
  ["/terms", {
    title: "Aidreamcapes Terms of Service | Use of AI Tools",
    description: "Read the Aidreamcapes terms for accounts, uploads, generated content, credits, payments, acceptable use, intellectual property, and service limitations."
  }],
  ["/policies/terms", {
    title: "Aidreamcapes Terms of Service | Use of AI Tools",
    description: "Read the Aidreamcapes terms for accounts, uploads, generated content, credits, payments, acceptable use, intellectual property, and service limitations."
  }],
  ["/terms-of-service", {
    title: "Aidreamcapes Terms of Service | Use of AI Tools",
    description: "Read the Aidreamcapes terms for accounts, uploads, generated content, credits, payments, acceptable use, intellectual property, and service limitations."
  }],
  ["/state-privacy", {
    title: "Aidreamcapes State Privacy Notice | U.S. Residents",
    description: "Review state privacy rights for eligible U.S. residents, including access, correction, deletion, and requests related to Aidreamcapes accounts and uploads."
  }],
  ["/tools", {
    title: "Aidreamcapes AI Tools | Image and Video Workflows",
    description: "Explore Aidreamcapes tools for creating and improving AI images and videos. Choose a workflow, review requirements, and check results before sharing."
  }]
]);

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

function normalizeAidreamcapesOrigin(value) {
  if (typeof value !== "string") return value;
  return value.replace(/^https:\/\/www\.aidreamcapes\.com(?=\/|$)/i, "https://aidreamcapes.com");
}

function updateSeoValue(value) {
  if (Array.isArray(value)) return value.map(updateSeoValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    key === "canonical" || key === "canonicalUrl" || key === "ogUrl"
      ? normalizeAidreamcapesOrigin(child)
      : updateSeoValue(child)
  ]));
}

function nextPage(row) {
  const contentJson = clone(row.contentJson) ?? {};
  const seo = updateSeoValue(contentJson.seo ?? {});
  const replacement = SEO_REPLACEMENTS.get(row.slug);
  if (replacement) Object.assign(seo, replacement);
  contentJson.seo = seo;
  return { ...row, title: replacement?.title ?? row.title, contentJson };
}

function collectStringReferences(value, needle, result = []) {
  if (typeof value === "string") {
    if (value.includes(needle)) result.push(value);
    return result;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectStringReferences(item, needle, result));
    return result;
  }
  if (value && typeof value === "object") Object.values(value).forEach((item) => collectStringReferences(item, needle, result));
  return result;
}

async function otherSiteSentinel(prisma) {
  const [livePages, themePages, themeSettings] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, title: true, pageType: true, templateKey: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }], select: { id: true, siteId: true, slug: true, draftJson: true, publishedJson: true } }),
    prisma.themeSettings.findMany({ where: { siteId: { not: SITE_ID } }, orderBy: { siteId: "asc" }, select: { id: true, siteId: true, draftJson: true, publishedJson: true } })
  ]);
  return { livePages, themePages, themeSettings, hash: hash({ livePages, themePages, themeSettings }) };
}

function writeBackup(payload) {
  fs.mkdirSync(BACKUP_ROOT, { recursive: true, mode: 0o700 });
  const file = path.join(BACKUP_ROOT, `seo-remediation-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
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
  assert(["127.0.0.1", "localhost", "::1"].includes(connected.host) && connected.port === 15432,
    `Production remediation must use the protected local SSH tunnel; received ${connected.host}:${connected.port}.`);
}

function validateReplacement(slug, replacement) {
  if (!replacement) return;
  if (replacement.title) assert(replacement.title.length >= 45 && replacement.title.length <= 60, `${slug}: title length ${replacement.title.length} is outside 45-60.`);
  if (replacement.description) assert(replacement.description.length >= 140 && replacement.description.length <= 160, `${slug}: description length ${replacement.description.length} is outside 140-160.`);
}

async function main() {
  ensureProductionTunnel();
  const target = String(argumentValue("--db-target") || process.env.DATABASE_TARGET || "local").trim().toLowerCase();
  const apply = hasArgument("--apply");
  const confirmation = argumentValue("--confirm") || "";
  assertDatabaseTarget({
    expectedTarget: target,
    requireProductionConfirmation: apply && target === "production",
    productionConfirmed: confirmation === CONFIRMATION
  });
  if (apply) assert.equal(confirmation, CONFIRMATION, `Applying requires --confirm=${CONFIRMATION}.`);
  for (const [slug, replacement] of SEO_REPLACEMENTS) validateReplacement(slug, replacement);

  const prisma = new PrismaClient();
  try {
    const [site, livePages, allLivePages, beforeOtherSites] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, status: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true } }),
      prisma.livePage.findMany({ select: { id: true, siteId: true, slug: true, contentJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert(site, `${SITE_ID}: site not found.`);
    assert.equal(site.slug, SITE_SLUG, `${SITE_ID}: unexpected site slug.`);
    assert.equal(site.primaryDomain.toLowerCase(), "www.aidreamcapes.com", `${SITE_ID}: unexpected primary domain.`);

    const staleRows = livePages.filter((row) => row.slug === STALE_SLUG);
    assert.equal(staleRows.length, 1, `${SITE_ID}${STALE_SLUG}: expected exactly one stale LivePage row.`);
    const stale = staleRows[0];
    assert.equal(stale.id, STALE_ID, `${STALE_SLUG}: stale row id changed; refusing deletion.`);
    assert.equal(stale.siteId, SITE_ID, `${STALE_SLUG}: stale row belongs to another site.`);
    assert.equal(stale.templateKey, "product", `${STALE_SLUG}: unexpected template key; refusing deletion.`);
    assert.equal(stale.contentJson?.contentContract, undefined, `${STALE_SLUG}: content contract exists; refusing deletion.`);
    assert.equal(stale.contentJson?.mediaManifest, undefined, `${STALE_SLUG}: media manifest exists; refusing deletion.`);
    const staleMediaReferences = [...new Set(collectStringReferences(stale.contentJson, "/assets/"))];
    for (const mediaReference of staleMediaReferences) {
      const shared = allLivePages.some((row) => row.id !== stale.id && collectStringReferences(row.contentJson, mediaReference).length > 0);
      assert(shared, `${STALE_SLUG}: page-specific media reference ${mediaReference}; refusing deletion.`);
    }
    const references = allLivePages.filter((row) => row.id !== stale.id && collectStringReferences(row.contentJson, STALE_ID).length > 0);
    assert.equal(references.length, 0, `${STALE_ID}: referenced by another LivePage; refusing deletion.`);

    const prepared = livePages.filter((row) => row.id !== stale.id).map(nextPage);
    const changes = prepared.filter((row) => {
      const before = livePages.find((candidate) => candidate.id === row.id);
      return before && (before.title !== row.title || hash(before.contentJson) !== hash(row.contentJson));
    });
    const changedSlugs = changes.map((row) => row.slug).sort();
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target: { siteId: SITE_ID, siteSlug: SITE_SLUG, databaseTarget: target },
      staleDeletion: { id: stale.id, slug: stale.slug, templateKey: stale.templateKey },
      beforeLivePageCount: livePages.length,
      afterLivePageCount: prepared.length,
      changedLivePageCount: changes.length,
      changedSlugs,
      canonicalPolicy: "https://aidreamcapes.com",
      mediaRegeneration: "skipped",
      pageSpeed: "skipped",
      otherSiteSentinelHash: beforeOtherSites.hash
    };
    if (!apply) {
      console.log(JSON.stringify({ ...summary, applyCommand: `node scripts/repair-aidreamcapes-seo-remediation.mjs --db-target=${target} --apply --confirm=${CONFIRMATION}` }, null, 2));
      return;
    }

    const backupPath = writeBackup({
      createdAt: new Date().toISOString(),
      site,
      stale,
      targetLivePages: livePages,
      otherSiteSentinel: beforeOtherSites
    });
    await prisma.$transaction(async (tx) => {
      for (const row of changes) {
        await tx.livePage.update({ where: { id: row.id }, data: { title: row.title, contentJson: row.contentJson } });
      }
      await tx.livePage.delete({ where: { id: stale.id } });
    }, { maxWait: 10000, timeout: 120000 });

    const [afterPages, afterOtherSites, deletedRow] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, slug: true, title: true, contentJson: true } }),
      otherSiteSentinel(prisma),
      prisma.livePage.findUnique({ where: { id: stale.id }, select: { id: true } })
    ]);
    assert.equal(deletedRow, null, `${STALE_ID}: stale row still exists after migration.`);
    assert.equal(afterPages.length, livePages.length - 1, `${SITE_ID}: unexpected LivePage count after migration.`);
    assert.equal(afterOtherSites.hash, beforeOtherSites.hash, "A non-target site's data changed; migration is not considered safe.");
    const afterById = new Map(afterPages.map((row) => [row.id, row]));
    for (const row of prepared) {
      const actual = afterById.get(row.id);
      assert(actual, `${row.slug}: updated LivePage missing after migration.`);
      assert.equal(actual.title, row.title, `${row.slug}: title readback mismatch.`);
      assert.equal(hash(actual.contentJson), hash(row.contentJson), `${row.slug}: content readback mismatch.`);
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
