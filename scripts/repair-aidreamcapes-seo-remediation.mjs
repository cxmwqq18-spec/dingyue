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
const GONE_PUBLIC_PATHS = new Set([
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-image-generation/unblur-image"
]);

// These descriptions are intentionally written per route. They are not a
// generic fallback and do not replace the 30 image-theme content contracts.
const SEO_REPLACEMENTS = new Map([
  ["/", {
    description: "Create AI images and videos for products, portraits, ads, and private visual stories. Upload a reference, choose a workflow, and review results before sharing."
  }],
  ["/about-us", {
    title: "About Aidreamcapes: AI Creation Studio | Aidreamcapes",
    description: "Learn how Aidreamcapes turns photos into AI images, videos, and private visual stories. Explore guided creation, secure uploads, and results ready for review."
  }],
  ["/ai-image-generation", {
    title: "AI Image Generation Tools for Product Teams | Aidreamcapes",
    description: "Explore AI image tools for ecommerce, lifestyle, portraits, ads, packaging, and product details. Start with a reference and review results before publishing."
  }],
  ["/ai-image-generation/professional-headshot", {
    description: "Create a polished professional headshot for LinkedIn, resumes, team pages, and creator profiles from an approved photo. Review the result before sharing."
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
  ["/ai-video-generation", {
    title: "AI Video Generation Tools for Creators | Aidreamcapes",
    description: "Explore Aidreamcapes video tools for image-to-video clips, creator intros, product teasers, fashion reels, animated portraits, and private stories."
  }],
  ["/ai-video-generation/cinematic-video", {
    title: "AI Cinematic Video Generator for Brands | Aidreamcapes",
    description: "Create cinematic video scenes with mood, lighting, pacing, and camera movement for short films, product launches, music visuals, and brand stories."
  }],
  ["/ai-video-generation/music-video", {
    title: "AI Music Video Generator for Creators | Aidreamcapes",
    description: "Create music video visuals from text or images for performances, artist promos, dance, and sequences. Review continuity and use licensed audio."
  }],
  ["/ai-video-generation/product-video", {
    title: "AI Product Video Generator for Stores | Aidreamcapes",
    description: "Turn product photos into videos that show scale, materials, features, real-world use, packaging, and the details shoppers need before they decide to buy."
  }],
  ["/ai-video-generation/promo-video", {
    title: "AI Promo Video Generator for Campaigns | Aidreamcapes",
    description: "Create promotional videos for launches, events, seasonal campaigns, and product updates. Keep offers, claims, terms, and calls to action under your control."
  }],
  ["/ai-video-generation/ugc-ad-video", {
    title: "AI UGC Ad Video Generator for Brands | Aidreamcapes",
    description: "Create creator-style product ads with clear hooks, product-in-use scenes, voiceover, and calls to action. Check every claim against approved product assets."
  }],
  ["/ai-save-the-date/proposal", {
    title: "AI Proposal Video Maker for Couples | Aidreamcapes",
    description: "Create a proposal video from approved photos and a clear story, with room for the setup, reveal, reaction, and final message before sharing."
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

const OG_IMAGE_REPLACEMENTS = new Map([
  ["/ai-video-generation", "/assets/sites/site_aidreamcapes/homepage-seo/ai-product-image-to-video-ugc-creator-smartwatch.webp"],
  ["/ai-video-generation/ugc-ad-video", "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-hook.webp"],
  ["/marketing", "/assets/sites/site_aidreamcapes/ads-testing/url-to-ad-workflow-generated.webp"],
  ["/ai-video-generation/product-ad-video", "/assets/sites/site_aidreamcapes/ugc-ad-v4/ugc-ad-video-demo.webp"],
  ["/best-ai-video", "/assets/sites/site_aidreamcapes/homepage-seo/ai-video-hook-variants-smartwatch.webp"],
  ["/blog/ai-talking-photo-video-guide", "/assets/sites/site_aidreamcapes/homepage-seo/ai-talking-photo-presenter-portrait.webp"],
  ["/blog/ai-video-review-checklist", "/assets/sites/site_aidreamcapes/homepage-seo/ai-ad-hook-variants-testing.webp"]
]);

// Replace only public route references in the Aidreamcapes content payload.
// Asset filenames and ordinary prose are intentionally left untouched. The
// target pages are the only rows passed through this function, so other
// storefronts cannot inherit these route changes.
const LEGACY_ROUTE_REPLACEMENTS = new Map([
  ["/ai-image-generation/rich-lifestyle", "/ai-image-generation/lifestyle-scene"],
  ["/ai-image-generation/social-cards", "/ai-image-generation/carousel-set"],
  ["/ai-image-generation/black-friday", "/ai-image-generation/sale-campaign-key-visual"],
  ["/ai-image-generation/street-style", "/ai-image-generation/fashion-editorial"],
  ["/ai-image-generation/hairstyle-generator", "/ai-image-generation/hair-makeup-preview"],
  ["/ai-image-generation/edit-by-prompt", "/ai-image-generation/enhance-upscale"],
  ["/ai-image-generation/background-remover", "/ai-image-generation/background-remove-replace"],
  ["/ai-image-generation/photo-enhancer", "/ai-image-generation/enhance-upscale"],
  ["/ai-image-generation/old-photo-restoration", "/ai-image-generation/old-photo-restore"],
  ["/ai-image-generation/headshot", "/ai-image-generation/professional-headshot"],
  ["/ai-image-generation/avatar", "/ai-image-generation/creator-portrait"],
  ["/ai-image-generation/portrait-photo", "/ai-image-generation/social-profile-photo"],
  ["/tools/product-reverie", "/ai-image-generation/ecommerce-main-image"],
  ["/tools/permission-safe-photo-planner", "/workflow"],
  ["/ai-image-generation/background-changer", "/ai-image-generation"],
  ["/ai-image-generation/bikini", "/ai-image-generation"],
  ["/ai-image-generation/boudoir", "/ai-image-generation"],
  ["/ai-image-generation/cannes", "/ai-image-generation"],
  ["/ai-image-generation/christmas-photo", "/ai-image-generation"],
  ["/ai-image-generation/color-correction", "/ai-image-generation"],
  ["/ai-image-generation/cyberpunk", "/ai-image-generation"],
  ["/ai-image-generation/engagement-photo", "/ai-image-generation"],
  ["/ai-image-generation/gala-photo", "/ai-image-generation"],
  ["/ai-image-generation/halloween-photo", "/ai-image-generation"],
  ["/ai-image-generation/holiday", "/ai-image-generation"],
  ["/ai-image-generation/mafia", "/ai-image-generation"],
  ["/ai-image-generation/magic-eraser", "/ai-image-generation"],
  ["/ai-image-generation/nightlife", "/ai-image-generation"],
  ["/ai-image-generation/only-fans", "/ai-image-generation"],
  ["/ai-image-generation/portrait-retouch", "/ai-image-generation"],
  ["/ai-image-generation/singles-awareness-day", "/ai-image-generation"],
  ["/ai-image-generation/soccer", "/ai-image-generation"],
  ["/ai-image-generation/swimsuit", "/ai-image-generation"],
  ["/ai-image-generation/thanksgiving-photo", "/ai-image-generation"],
  ["/ai-image-generation/travel", "/ai-image-generation"],
  ["/ai-image-generation/unblur-image", "/ai-image-generation"],
  ["/ai-image-generation/urban", "/ai-image-generation"],
  ["/ai-image-generation/valentines-photo", "/ai-image-generation"],
  ["/ai-image-generation/wedding-photo", "/ai-image-generation"],
  ["/ai-image-generation/premiere-style-portraits", "/ai-image-generation/fashion-editorial"]
]);

const LEGACY_IMAGE_SLUG_REPLACEMENTS = new Map([
  ["rich-lifestyle", "lifestyle-scene"],
  ["social-cards", "carousel-set"],
  ["black-friday", "sale-campaign-key-visual"],
  ["street-style", "fashion-editorial"],
  ["hairstyle-generator", "hair-makeup-preview"],
  ["edit-by-prompt", "enhance-upscale"],
  ["background-remover", "background-remove-replace"],
  ["photo-enhancer", "enhance-upscale"],
  ["old-photo-restoration", "old-photo-restore"],
  ["headshot", "professional-headshot"],
  ["avatar", "creator-portrait"],
  ["portrait-photo", "social-profile-photo"],
  ["motion-generator", ""],
  ["background-changer", ""],
  ["bikini", ""],
  ["boudoir", ""],
  ["cannes", ""],
  ["christmas-photo", ""],
  ["color-correction", ""],
  ["cyberpunk", ""],
  ["engagement-photo", ""],
  ["gala-photo", ""],
  ["halloween-photo", ""],
  ["holiday", ""],
  ["mafia", ""],
  ["magic-eraser", ""],
  ["nightlife", ""],
  ["only-fans", ""],
  ["portrait-retouch", ""],
  ["singles-awareness-day", ""],
  ["soccer", ""],
  ["swimsuit", ""],
  ["thanksgiving-photo", ""],
  ["travel", ""],
  ["unblur-image", ""],
  ["urban", ""],
  ["valentines-photo", ""],
  ["wedding-photo", ""],
  ["premiere-style-portraits", "fashion-editorial"]
]);

const LEGACY_IMAGE_LABEL_REPLACEMENTS = new Map([
  ["rich-lifestyle", "lifestyle scene"],
  ["social-cards", "carousel ad"],
  ["black-friday", "sale campaign"],
  ["street-style", "fashion editorial"],
  ["hairstyle-generator", "hair and makeup preview"],
  ["edit-by-prompt", "image enhancement"],
  ["background-remover", "background remove and replace"],
  ["photo-enhancer", "image enhancer"],
  ["old-photo-restoration", "old photo restore"],
  ["headshot", "professional headshot"],
  ["avatar", "creator portrait"],
  ["portrait-photo", "social profile photo"]
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
  return value.replace(/https:\/\/www\.aidreamcapes\.com(?=\/|$)/gi, "https://aidreamcapes.com");
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

function updateRouteReferenceValue(value, key) {
  if (typeof value !== "string") return value;
  if (key === "imageSlugs") {
    return value
      .split("|")
      .map((slug) => slug.trim().toLowerCase())
      .map((slug) => LEGACY_IMAGE_SLUG_REPLACEMENTS.has(slug) ? LEGACY_IMAGE_SLUG_REPLACEMENTS.get(slug) : slug)
      .filter(Boolean)
      .filter((slug, index, values) => values.indexOf(slug) === index)
      .join("|");
  }
  if (/(?:meta|label)/i.test(key)) {
    const replacement = LEGACY_IMAGE_LABEL_REPLACEMENTS.get(value.trim().toLowerCase());
    if (replacement) return replacement;
  }
  if (!/(?:href|url|canonical|path|target|link|collectionSlug|categorySlug|rootSlug|themeSlug)/i.test(key)) return value;
  let next = value;
  const segmentReplacement = LEGACY_IMAGE_SLUG_REPLACEMENTS.get(next.trim().toLowerCase());
  if (segmentReplacement !== undefined) return segmentReplacement;
  for (const [from, to] of LEGACY_ROUTE_REPLACEMENTS) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    next = next.replace(new RegExp(`(^|https?:\\/\\/[^\\s/]+|[\\s])${escaped}(?=$|[?#\\s])`, "gi"), `$1${to}`);
  }
  return next;
}

function updateContentValue(value, key = "") {
  if (Array.isArray(value)) return value.map((item) => updateContentValue(item, key));
  if (!value || typeof value !== "object") {
    const routeUpdated = normalizeAidreamcapesOrigin(updateRouteReferenceValue(value, key));
    if (typeof routeUpdated !== "string") return routeUpdated;
    if (/(?:href|url|canonical|path|target|link|asset|src|slug)/i.test(key) || /^https?:\/\//i.test(routeUpdated) || routeUpdated.includes("/assets/")) return routeUpdated;
    return routeUpdated.replace(/\bmydreamshoots\b/gi, "Aidreamcapes");
  }
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [
    childKey,
    updateContentValue(child, childKey)
  ]));
}

function isLinkLikeKey(key) {
  return /(?:href|url|canonical|path|target|link|route|slug|@id)/i.test(key);
}

function isGoneRouteReference(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed, "https://aidreamcapes.com");
    return GONE_PUBLIC_PATHS.has(parsed.pathname);
  } catch {
    return false;
  }
}

function containsGoneRouteReference(value, key = "") {
  if (typeof value === "string") return isLinkLikeKey(key) && isGoneRouteReference(value);
  if (Array.isArray(value)) return value.some((item) => containsGoneRouteReference(item, key));
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([childKey, child]) => containsGoneRouteReference(child, childKey));
}

// Remove retired routes from navigation/link structures while leaving prose
// and the retired pages' own stored content intact for a future re-publish.
function removeGoneRouteReferences(value, key = "") {
  if (Array.isArray(value)) {
    return value
      .filter((item) => !containsGoneRouteReference(item, key))
      .map((item) => removeGoneRouteReferences(item, key));
  }
  if (!value || typeof value !== "object") {
    return isLinkLikeKey(key) && isGoneRouteReference(value) ? undefined : value;
  }
  const next = {};
  for (const [childKey, child] of Object.entries(value)) {
    if (isLinkLikeKey(childKey) && isGoneRouteReference(child)) continue;
    const cleaned = removeGoneRouteReferences(child, childKey);
    if (cleaned !== undefined) next[childKey] = cleaned;
  }
  return next;
}

function nextPage(row) {
  let contentJson = updateContentValue(clone(row.contentJson) ?? {});
  if (!GONE_PUBLIC_PATHS.has(row.slug)) contentJson = removeGoneRouteReferences(contentJson);
  const seo = updateSeoValue(contentJson.seo ?? {});
  const replacement = SEO_REPLACEMENTS.get(row.slug);
  if (replacement) Object.assign(seo, replacement);
  const ogImage = OG_IMAGE_REPLACEMENTS.get(row.slug);
  if (ogImage) {
    seo.ogImage = ogImage;
    seo.twitterImage = ogImage;
  }
  contentJson.seo = seo;
  const title = replacement?.title ?? (typeof row.title === "string" ? row.title.replace(/\bmydreamshoots\b/gi, "Aidreamcapes") : row.title);
  return { ...row, title, contentJson };
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
    const [site, livePages, themePages, themeSettings, allLivePages, beforeOtherSites] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true, status: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, siteId: true, pageType: true, templateKey: true, slug: true, title: true, contentJson: true, updatedAt: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true, updatedAt: true } }),
      prisma.themeSettings.findMany({ where: { siteId: SITE_ID }, select: { id: true, siteId: true, draftJson: true, publishedJson: true, updatedAt: true } }),
      prisma.livePage.findMany({ select: { id: true, siteId: true, slug: true, contentJson: true } }),
      otherSiteSentinel(prisma)
    ]);
    assert(site, `${SITE_ID}: site not found.`);
    assert.equal(site.slug, SITE_SLUG, `${SITE_ID}: unexpected site slug.`);
    assert.equal(site.primaryDomain.toLowerCase(), "www.aidreamcapes.com", `${SITE_ID}: unexpected primary domain.`);

    const staleRows = livePages.filter((row) => row.slug === STALE_SLUG);
    assert(staleRows.length <= 1, `${SITE_ID}${STALE_SLUG}: found more than one stale LivePage row.`);
    const stale = staleRows[0];
    if (stale) {
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
    }

    const prepared = livePages.filter((row) => !stale || row.id !== stale.id).map(nextPage);
    const changes = prepared.filter((row) => {
      const before = livePages.find((candidate) => candidate.id === row.id);
      return before && (before.title !== row.title || hash(before.contentJson) !== hash(row.contentJson));
    });
    const preparedThemePages = themePages.map((row) => {
      const shouldRemoveGoneRoutes = !GONE_PUBLIC_PATHS.has(row.slug);
      const draftJson = shouldRemoveGoneRoutes
        ? removeGoneRouteReferences(updateContentValue(clone(row.draftJson) ?? {}))
        : updateContentValue(clone(row.draftJson) ?? {});
      const publishedJson = shouldRemoveGoneRoutes
        ? removeGoneRouteReferences(updateContentValue(clone(row.publishedJson) ?? {}))
        : updateContentValue(clone(row.publishedJson) ?? {});
      const replacement = SEO_REPLACEMENTS.get(row.slug);
      const ogImage = OG_IMAGE_REPLACEMENTS.get(row.slug);
      const draftSeo = draftJson.seo && typeof draftJson.seo === "object" ? draftJson.seo : {};
      const publishedSeo = publishedJson.seo && typeof publishedJson.seo === "object" ? publishedJson.seo : {};
      if (replacement) {
        Object.assign(draftSeo, replacement);
        Object.assign(publishedSeo, replacement);
      }
      if (ogImage) {
        draftSeo.ogImage = ogImage;
        draftSeo.twitterImage = ogImage;
        publishedSeo.ogImage = ogImage;
        publishedSeo.twitterImage = ogImage;
      }
      draftJson.seo = draftSeo;
      publishedJson.seo = publishedSeo;
      const title = replacement?.title ?? (typeof row.title === "string" ? row.title.replace(/\bmydreamshoots\b/gi, "Aidreamcapes") : row.title);
      return { ...row, title, draftJson, publishedJson };
    });
    const changedThemePages = preparedThemePages.filter((row) => {
      const before = themePages.find((candidate) => candidate.id === row.id);
      return before && (before.title !== row.title || hash(before.draftJson) !== hash(row.draftJson) || hash(before.publishedJson) !== hash(row.publishedJson));
    });
    const preparedThemeSettings = themeSettings.map((row) => ({
      ...row,
      draftJson: removeGoneRouteReferences(updateContentValue(clone(row.draftJson) ?? {})),
      publishedJson: removeGoneRouteReferences(updateContentValue(clone(row.publishedJson) ?? {}))
    }));
    const changedThemeSettings = preparedThemeSettings.filter((row) => {
      const before = themeSettings.find((candidate) => candidate.id === row.id);
      return before && (hash(before.draftJson) !== hash(row.draftJson) || hash(before.publishedJson) !== hash(row.publishedJson));
    });
    const changedSlugs = changes.map((row) => row.slug).sort();
    const changedThemePageSlugs = changedThemePages.map((row) => row.slug).sort();
    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target: { siteId: SITE_ID, siteSlug: SITE_SLUG, databaseTarget: target },
      staleDeletion: stale
        ? { id: stale.id, slug: stale.slug, templateKey: stale.templateKey }
        : { id: null, slug: STALE_SLUG, status: "already-clean" },
      beforeLivePageCount: livePages.length,
      afterLivePageCount: prepared.length,
      changedLivePageCount: changes.length,
      changedSlugs,
      beforeThemePageCount: themePages.length,
      changedThemePageCount: changedThemePages.length,
      changedThemePageSlugs,
      beforeThemeSettingsCount: themeSettings.length,
      changedThemeSettingsCount: changedThemeSettings.length,
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
      targetThemePages: themePages,
      targetThemeSettings: themeSettings,
      otherSiteSentinel: beforeOtherSites
    });
    await prisma.$transaction(async (tx) => {
      for (const row of changes) {
        await tx.livePage.update({ where: { id: row.id }, data: { title: row.title, contentJson: row.contentJson } });
      }
      for (const row of changedThemePages) {
        await tx.themePage.update({ where: { id: row.id }, data: { title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson } });
      }
      for (const row of changedThemeSettings) {
        await tx.themeSettings.update({ where: { id: row.id }, data: { draftJson: row.draftJson, publishedJson: row.publishedJson } });
      }
      if (stale) await tx.livePage.delete({ where: { id: stale.id } });
    }, { maxWait: 10000, timeout: 120000 });

    const [afterPages, afterThemePages, afterThemeSettings, afterOtherSites, deletedRow] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, slug: true, title: true, contentJson: true } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
      prisma.themeSettings.findMany({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } }),
      otherSiteSentinel(prisma),
      stale ? prisma.livePage.findUnique({ where: { id: stale.id }, select: { id: true } }) : null
    ]);
    assert.equal(deletedRow, null, `${STALE_ID}: stale row still exists after migration.`);
    assert.equal(afterPages.length, livePages.length - (stale ? 1 : 0), `${SITE_ID}: unexpected LivePage count after migration.`);
    assert.equal(afterOtherSites.hash, beforeOtherSites.hash, "A non-target site's data changed; migration is not considered safe.");
    const afterById = new Map(afterPages.map((row) => [row.id, row]));
    for (const row of prepared) {
      const actual = afterById.get(row.id);
      assert(actual, `${row.slug}: updated LivePage missing after migration.`);
      assert.equal(actual.title, row.title, `${row.slug}: title readback mismatch.`);
      assert.equal(hash(actual.contentJson), hash(row.contentJson), `${row.slug}: content readback mismatch.`);
    }
    const afterThemePageById = new Map(afterThemePages.map((row) => [row.id, row]));
    for (const row of preparedThemePages) {
      const actual = afterThemePageById.get(row.id);
      assert(actual, `${row.slug}: updated ThemePage missing after migration.`);
      assert.equal(actual.title, row.title, `${row.slug}: ThemePage title readback mismatch.`);
      assert.equal(hash(actual.draftJson), hash(row.draftJson), `${row.slug}: ThemePage draft readback mismatch.`);
      assert.equal(hash(actual.publishedJson), hash(row.publishedJson), `${row.slug}: ThemePage published readback mismatch.`);
    }
    const afterThemeSettingsById = new Map(afterThemeSettings.map((row) => [row.id, row]));
    for (const row of preparedThemeSettings) {
      const actual = afterThemeSettingsById.get(row.id);
      assert(actual, `${row.id}: updated ThemeSettings missing after migration.`);
      assert.equal(hash(actual.draftJson), hash(row.draftJson), `${row.id}: ThemeSettings draft readback mismatch.`);
      assert.equal(hash(actual.publishedJson), hash(row.publishedJson), `${row.id}: ThemeSettings published readback mismatch.`);
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
