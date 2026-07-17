#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const execFileAsync = promisify(execFile);
const rootDir = process.cwd();
const localStateFile = path.join(rootDir, "data", "platform-state.json");
const model = process.env.CATEGORY_COVER_MODEL ?? "gpt-image-2";
const size = process.env.CATEGORY_COVER_SIZE ?? "1024x1024";
const quality = process.env.CATEGORY_COVER_QUALITY ?? "low";
const requestTimeoutMs = Number(process.env.CATEGORY_COVER_TIMEOUT_MS ?? 300_000);
const requestRetries = Math.max(1, Number(process.env.CATEGORY_COVER_RETRIES ?? 2));
const forceGenerate = process.argv.includes("--force-generate");
const dryRun = process.argv.includes("--dry-run");
const siteSlugs = argValue("--site-slugs", "mydreamshoots,aidreamshoots")
  .split(",")
  .map((item) => item.trim())
  .filter(Boolean);

const childGalleryBase = "/assets/dreamshoot/generated/pack-galleries";
const generatedBase = "/assets/dreamshoot/generated/category-covers";

const coverDirections = {
  creator: "a premium creator lifestyle portrait scene with a camera, laptop, and polished personal-brand studio mood",
  avatar: "a stylized avatar and profile identity portrait scene, playful but polished, character-profile energy",
  wedding: "an elegant wedding-inspired portrait scene with soft ceremony light, romantic styling, and refined album mood",
  cultural: "a respectful Indian and Desi wedding-inspired portrait scene with rich textiles, jewelry, and festive editorial light",
  couple: "a romantic couple portrait scene for engagement, date-night, Valentine, and relationship keepsakes",
  creative: "a cinematic themed portrait scene blending noir, cyberpunk, gala, and editorial world-building energy",
  beauty: "a soft-glam beauty portrait scene focused on hairstyle previews, try-on styling, and polished makeup light",
  sports: "a soccer fan portrait scene in a lively stadium atmosphere, match-day energy, no official logos",
  video: "a cinematic image-to-video concept scene with a phone previewing motion-ready portrait frames, no readable UI text",
  utility: "a clean AI photo enhancement workspace showing sharper portrait preparation, upscaling, and download-ready image polish",
  headshots: "a crisp professional headshot portrait scene for LinkedIn, founder bios, resumes, and team profiles",
  seasonal: "a warm seasonal portrait scene with festive lights, holiday-card mood, and polished private album styling",
  "retratos-y-perfiles": "a polished portrait and profile image collection scene with headshots, avatar mood, and social profile styling",
  "pareja-y-boda": "a romantic couple and wedding portrait scene with proposal, ceremony, and elegant album styling",
  "estilo-y-fantasia": "a cinematic style and fantasy portrait scene with dramatic light, fashion, noir, and cyberpunk mood",
  "belleza-y-editorial": "a refined beauty and fashion editorial portrait scene with hair, makeup, wardrobe, and magazine lighting",
  "temporada-y-deporte": "a seasonal and sports portrait scene with festive atmosphere plus stadium fan-photo energy, no official logos",
  "video-y-utilidades": "a video and utility image-prep scene with a phone, camera desk, motion frames, and clean AI enhancement mood"
};

const curatedRootCovers = {
  beauty: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-beauty.png",
  sports: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-sports.png",
  video: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-video.png",
  utility: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-upscale.png",
  headshots: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-business.png",
  seasonal: "/assets/dreamshoot/holiday-card-gpt2.png",
  "retratos-y-perfiles": "/assets/dreamshoot/generated/20260622-homepage-unique/proof-business-founder.png",
  "pareja-y-boda": "/assets/dreamshoot/generated/20260622-homepage-unique/proof-couple-engagement.png",
  "estilo-y-fantasia": "/assets/dreamshoot/generated/20260622-homepage-unique/proof-cinematic-worlds.png",
  "belleza-y-editorial": "/assets/dreamshoot/generated/20260622-homepage-unique/proof-beauty-hair.png",
  "temporada-y-deporte": "/assets/dreamshoot/generated/20260622-homepage-unique/proof-worldcup-gallery.png",
  "video-y-utilidades": "/assets/dreamshoot/generated/20260622-homepage-unique/hero-credit-studio-card.png"
};

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function normalizeBaseUrl(url) {
  const trimmed = String(url || "").replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function publicAssetPath(publicUrl) {
  const clean = String(publicUrl || "").split("?")[0];
  if (!clean.startsWith("/assets/")) return "";
  return path.join(rootDir, "public", clean.replace(/^\//, ""));
}

async function fileExists(filePath) {
  if (!filePath) return false;
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function localPublicAssetExists(publicUrl) {
  return fileExists(publicAssetPath(publicUrl));
}

function dreamshootOptimizedWebpPath(publicUrl) {
  const clean = String(publicUrl || "").split("?")[0];
  if (!clean.startsWith("/assets/dreamshoot/") || !/\.png$/i.test(clean)) return "";
  return publicAssetPath(clean.replace(/\.png$/i, ".webp"));
}

async function ensureDreamshootOptimizedWebp(publicUrl) {
  const sourcePath = publicAssetPath(publicUrl);
  const webpPath = dreamshootOptimizedWebpPath(publicUrl);
  if (!webpPath || !(await fileExists(sourcePath)) || (await fileExists(webpPath))) return;
  await execFileAsync("cwebp", ["-quiet", "-q", "82", sourcePath, "-o", webpPath]);
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function promptForCategory(siteSlug, category) {
  const direction = coverDirections[category.slug] ?? `${category.label} AI photo package category cover`;
  return [
    "Use case: photorealistic-natural",
    "Asset type: square storefront theme-category cover image",
    `Primary request: create a unique premium cover image for the MyDreamShoots theme category \"${category.label}\" on ${siteSlug}.`,
    category.description ? `Category description: ${category.description}` : "",
    `Visual direction: ${direction}.`,
    "Composition: one clear editorial photography scene, strong thumbnail readability, human-centered where appropriate, generous safe space, no collage grid.",
    "Style: realistic premium AI photo subscription storefront imagery, polished commercial lighting, modern, tasteful, image-led.",
    "Constraints: no text, no captions, no watermarks, no brand logos, no official sports marks, no minors, no explicit nudity.",
    "Avoid: distorted faces, extra limbs, duplicated subjects, unreadable UI, generic gradients, unrelated scenery."
  ].filter(Boolean).join("\n");
}

async function preferredProvider() {
  const provider = await prisma.platformAiProvider.findFirst({
    where: { modelType: model },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }, { createdAt: "asc" }]
  });
  const baseUrl = normalizeBaseUrl(provider?.aiUrl ?? process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
  const apiKey = provider?.apiKey || process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || "";
  if (!baseUrl || !apiKey) throw new Error(`missing_image_provider:${model}`);
  return { baseUrl, apiKey, label: provider?.label ?? "env" };
}

async function generateCategoryCover(siteSlug, category, publicUrl, provider) {
  const outPath = publicAssetPath(publicUrl);
  const prompt = promptForCategory(siteSlug, category);
  if (dryRun) return { generated: false, outPath };
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  if (!forceGenerate && await fileExists(outPath)) return { generated: false, outPath };

  console.log(`generating category cover: ${siteSlug}/${category.slug}`);
  let body = {};
  for (let attempt = 1; attempt <= requestRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        body: JSON.stringify({
          model,
          prompt,
          size,
          quality,
          response_format: "b64_json"
        })
      });
      body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${category.slug}: image_generation_failed:${response.status}:${JSON.stringify(body).slice(0, 500)}`);
      }
      break;
    } catch (error) {
      const finalAttempt = attempt === requestRetries;
      const message = error instanceof Error ? error.message : String(error);
      if (finalAttempt) throw new Error(`${category.slug}: image_generation_failed_after_${attempt}_attempts:${message}`);
      console.warn(`retrying category cover: ${siteSlug}/${category.slug} after ${message}`);
      await sleep(1500 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  const b64 = imagePayload(body);
  if (!b64) throw new Error(`${category.slug}: empty_image_payload`);
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
  await ensureDreamshootOptimizedWebp(publicUrl);
  console.log(`generated category cover: ${siteSlug}/${category.slug} -> ${publicUrl}`);
  return { generated: true, outPath };
}

function normalizedUrl(url) {
  return String(url || "").trim().split("?")[0];
}

function categoryNeedsGeneratedCover(category) {
  return !category.parentId && (coverDirections[category.slug] || !category.imageUrl);
}

async function directPackImageForCategory(category, packs) {
  const pack = packs.find((item) => item.categoryRecord?.id === category.id || item.categoryRecord?.slug === category.slug);
  if (!pack) return "";
  const galleryCover = `${childGalleryBase}/${category.slug}/${category.slug}-01.webp`;
  if (await localPublicAssetExists(galleryCover)) return galleryCover;
  const firstGallery = Array.isArray(pack.galleryImages) ? pack.galleryImages.find((item) => typeof item === "string" && item.trim()) : "";
  if (firstGallery) return firstGallery;
  return pack.imageUrl || "";
}

async function coverUrlForCategory(site, category, packs, provider) {
  const directPackUrl = await directPackImageForCategory(category, packs);
  if (directPackUrl) return { imageUrl: directPackUrl, source: "pack-gallery" };

  if (categoryNeedsGeneratedCover(category)) {
    const imageUrl = `${generatedBase}/${site.slug}/${category.slug}-cover.png`;
    if (await localPublicAssetExists(imageUrl)) {
      if (!dryRun) await ensureDreamshootOptimizedWebp(imageUrl);
      return { imageUrl, source: "generated-existing" };
    }
    const curated = curatedRootCovers[category.slug];
    if (curated && await localPublicAssetExists(curated)) return { imageUrl: curated, source: "curated-generated" };
    const result = await generateCategoryCover(site.slug, category, imageUrl, provider);
    return { imageUrl, source: result.generated ? "generated" : "generated-existing" };
  }

  if (category.imageUrl) return { imageUrl: category.imageUrl, source: "existing" };
  const imageUrl = `${generatedBase}/${site.slug}/${category.slug}-cover.png`;
  const result = await generateCategoryCover(site.slug, category, imageUrl, provider);
  return { imageUrl, source: result.generated ? "generated" : "generated-existing" };
}

async function assertUniqueCategoryImages(siteId) {
  const categories = await prisma.creativePackCategory.findMany({
    where: { siteId, status: "active" },
    select: { slug: true, label: true, imageUrl: true }
  });
  const missing = categories.filter((category) => !category.imageUrl);
  const imageMap = new Map();
  for (const category of categories) {
    const key = normalizedUrl(category.imageUrl);
    if (!key) continue;
    imageMap.set(key, [...(imageMap.get(key) ?? []), category]);
  }
  const duplicates = [...imageMap.entries()].filter(([, group]) => group.length > 1);
  if (missing.length || duplicates.length) {
    throw new Error(JSON.stringify({ missing, duplicates: duplicates.map(([imageUrl, group]) => ({ imageUrl, categories: group.map((item) => item.slug) })) }, null, 2));
  }
}

async function clearPostgresStateCache() {
  const cacheFile = path.join(rootDir, ".next", "cache", "platform-state-postgres.json");
  await fs.rm(cacheFile, { force: true }).catch(() => undefined);
}

async function syncLocalPreviewState(sites) {
  let raw = "";
  try {
    raw = await fs.readFile(localStateFile, "utf8");
  } catch {
    return { updated: 0, skipped: true };
  }
  const state = JSON.parse(raw);
  const updates = new Map();
  for (const site of sites) {
    const categories = await prisma.creativePackCategory.findMany({
      where: { siteId: site.id, status: "active" },
      select: { siteId: true, slug: true, imageUrl: true }
    });
    for (const category of categories) {
      if (category.imageUrl) updates.set(`${category.siteId}:${category.slug}`, category.imageUrl);
    }
  }
  let updated = 0;
  for (const category of state.creativePackCategories ?? []) {
    const nextImageUrl = updates.get(`${category.siteId}:${category.slug}`);
    if (!nextImageUrl || normalizedUrl(category.imageUrl) === normalizedUrl(nextImageUrl)) continue;
    category.imageUrl = nextImageUrl;
    updated += 1;
  }
  if (updated > 0 && !dryRun) {
    await fs.writeFile(localStateFile, `${JSON.stringify(state, null, 2)}\n`);
  }
  return { updated, skipped: false };
}

async function fixSite(site, provider) {
  const categories = await prisma.creativePackCategory.findMany({
    where: { siteId: site.id, status: "active" },
    include: { parent: true },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { label: "asc" }]
  });
  const packs = await prisma.creativePack.findMany({
    where: { siteId: site.id, status: "active" },
    include: { categoryRecord: { include: { parent: true } } },
    orderBy: [{ createdAt: "asc" }]
  });

  const updates = [];
  for (const category of categories) {
    const next = await coverUrlForCategory(site, category, packs, provider);
    if (normalizedUrl(next.imageUrl) !== normalizedUrl(category.imageUrl)) {
      updates.push({ category, ...next });
      if (!dryRun) await prisma.creativePackCategory.update({ where: { id: category.id }, data: { imageUrl: next.imageUrl } });
    }
  }

  if (!dryRun) await assertUniqueCategoryImages(site.id);
  return { site: site.slug, categories: categories.length, updates: updates.map((item) => ({ slug: item.category.slug, imageUrl: item.imageUrl, source: item.source })) };
}

async function main() {
  const provider = await preferredProvider();
  const sites = await prisma.site.findMany({ where: { slug: { in: siteSlugs } }, orderBy: { slug: "asc" } });
  if (sites.length !== siteSlugs.length) throw new Error(`missing_sites:${siteSlugs.filter((slug) => !sites.some((site) => site.slug === slug)).join(",")}`);
  const results = [];
  console.log(`using image provider: ${provider.label} (${model})`);
  for (const site of sites) {
    results.push(await fixSite(site, provider));
  }
  const localPreviewState = await syncLocalPreviewState(sites);
  if (!dryRun) await clearPostgresStateCache();
  console.log(JSON.stringify({ ok: true, dryRun, localPreviewState, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
