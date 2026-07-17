#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const args = new Map();
const flags = new Set();

const rawArgs = process.argv.slice(2);
for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
  } else if (rawArgs[index + 1] && !rawArgs[index + 1].startsWith("--")) {
    args.set(key, rawArgs[index + 1]);
    index += 1;
  } else {
    flags.add(key);
  }
}

const siteId = args.get("site-id") ?? process.env.THEME_GALLERY_SITE_ID ?? "site_dreamshoot";
const model = args.get("model") ?? process.env.THEME_GALLERY_MODEL ?? "gpt-image-2";
const imageSize = args.get("size") ?? process.env.THEME_GALLERY_SIZE ?? "1024x1024";
const imageQuality = args.get("quality") ?? process.env.THEME_GALLERY_QUALITY ?? "low";
const outRoot = path.resolve(process.cwd(), args.get("out") ?? "public/assets/dreamshoot/generated/pack-galleries");
const publicPrefix = args.get("public-prefix") ?? "/assets/dreamshoot/generated/pack-galleries";
const publicVersion = args.get("version") ?? process.env.THEME_GALLERY_VERSION ?? "20260715b";
const force = flags.has("force") || process.env.THEME_GALLERY_FORCE === "1";
const saveSheets = flags.has("save-sheets") || process.env.THEME_GALLERY_SAVE_SHEETS === "1";
const concurrency = Math.max(1, Math.min(3, Number(args.get("concurrency") ?? process.env.THEME_GALLERY_CONCURRENCY ?? "1") || 1));
const limit = Math.max(0, Number(args.get("limit") ?? process.env.THEME_GALLERY_LIMIT ?? "0") || 0);
const timeoutMs = Math.max(30_000, Number(args.get("timeout-ms") ?? process.env.THEME_GALLERY_TIMEOUT_MS ?? "240000") || 240_000);
const maxAttempts = Math.max(1, Number(args.get("attempts") ?? process.env.THEME_GALLERY_ATTEMPTS ?? "3") || 3);
const onlySlugs = new Set(String(args.get("slugs") ?? process.env.THEME_GALLERY_SLUGS ?? "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean));

const themeDirections = {
  "professional-headshots": "premium professional headshot portraits for LinkedIn, resumes, founders, and team pages; clean business wardrobe, office or studio backgrounds, believable lighting",
  "world-cup-fan-photos": "generic football fan portraits and match-day poster scenes in stadium light; scarves, jerseys, cheering poses, football energy; no real players, no celebrity likeness, no FIFA or team logos",
  hairstyle: "AI hairstyle preview portraits focused on haircuts, color, bangs, curls, bob cuts, salon lighting, and beauty planning; hair is the visual hero",
  cyberpunk: "neon cyberpunk city portraits with futuristic wardrobe, rain reflections, colored rim light, and cinematic night streets",
  "gala-photos": "formal gala and red-carpet portraits with black-tie wardrobe, evening gowns, polished event lighting, and luxury venue mood",
  mafia: "cinematic noir character portraits with tailored suits, moody interiors, vintage city streets, shadows, and dramatic film-still lighting",
  nature: "outdoor adventure portraits in mountains, forests, lakes, cliffs, trails, and golden-hour natural light; no city or studio scenes",
  "travel-scene-pack": "destination travel portraits across beaches, city walks, scenic overlooks, cafes, luggage moments, and vacation editorial scenes",
  "virtual-try-on": "private fashion try-on previews with outfits, styling mirrors, wardrobe racks, garment details, and lookbook poses",
  "profile-cards": "clean social profile card portraits, avatar crops, bio images, personal landing page visuals, and identity-card compositions",
  "creator-portraits": "creator portraits for newsletters, thumbnails, media kits, studio lights, desk setups, microphones, cameras, and personal-brand scenes",
  "fashion-editorial": "fashion editorial portraits with magazine lighting, runway energy, wardrobe styling, refined poses, and high-end campaign mood",
  "anime-avatar": "anime-inspired avatar portraits and stylized character profile images; playful, polished, original characters only, no copyrighted characters",
  "product-style": "creator-led product lifestyle scenes, product tables, package mockups, softbox lighting, social commerce visuals, and clean catalog compositions",
  "social-cards": "share-ready social announcement cards, story crops, creator banners, clean graphic portrait layouts, and polished social visuals",
  "wedding-portraits": "wedding-inspired portraits with ceremony light, veils, suits, flowers, soft romantic venue scenes, and save-the-date mood",
  "indian-wedding": "Indian wedding-inspired portraits with respectful saree, lehenga, sherwani, jewelry, mandap, warm ceremony light, and rich textiles",
  "desi-wedding": "Desi wedding celebration portraits with festive styling, rich colors, jewelry, family celebration mood, ceremony decor, and private album feel",
  "valentine-photos": "romantic Valentine portraits and couple card scenes with warm light, date-night mood, tasteful hearts, flowers, and gift-ready images",
  engagement: "engagement-style portraits with proposal scenes, ring detail moments, couple announcements, romantic outdoor light, and polished keepsake mood",
  boudoir: "tasteful fully clothed confidence portraits for adults in elegant studio lighting; satin robe-inspired outerwear, slip-dress-inspired fashion, soft bedroom-studio decor, refined beauty styling, no nudity, no lingerie focus, no sexual pose",
  holiday: "holiday travel and seasonal portraits with warm vacation scenes, winter cards, festive but tasteful styling, and private album mood",
  "christmas-couple": "Christmas couple portraits with cozy sweaters, warm lights, tree decor, snow-window mood, greeting-card compositions, and romantic holiday energy",
  "christmas-photos": "solo Christmas portraits with festive lights, tree decor, snow mood, warm sweaters, holiday cards, and seasonal profile images",
  "ai-video-add-ons": "motion-ready AI video starter frames, cinematic storyboard stills, dynamic poses, timeline-like visual rhythm, and short clip preview energy",
  "magic-upscaler": "image upscaling and enhancement preview visuals, crisp portrait details, before-after clarity, magnified texture, sparkle-clean high-resolution delivery"
};

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").replace(/\/+$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json ??
    body?.data?.[0]?.image_base64 ??
    body?.output?.[0]?.b64_json ??
    body?.output?.[0]?.image_base64 ??
    body?.image_base64;
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function galleryPaths(slug) {
  return Array.from({ length: 12 }, (_, index) => {
    const slot = String(index + 1).padStart(2, "0");
    return {
      slot,
      publicPath: `${publicPrefix}/${slug}/${slug}-${slot}.webp?v=${publicVersion}`,
      filePath: path.join(outRoot, slug, `${slug}-${slot}.webp`)
    };
  });
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function buildPrompt(pack, slug, sheetIndex) {
  const direction = themeDirections[slug] ?? pack.description ?? pack.headline ?? pack.name;
  const variationFocus = [
    "Include close portraits, half-body crops, and clean hero-card framing.",
    "Include alternate lighting, wardrobe, environment, and profile/banner-ready crops.",
    "Include expressive poses, detail shots, and stronger editorial compositions while staying in the same theme."
  ][sheetIndex] ?? "Include distinct but on-theme gallery examples.";
  return [
    "Use case: photorealistic-natural",
    "Asset type: source contact sheet for a customer-facing AI photo package gallery",
    `Primary request: create one square contact sheet for the MyDreamShoots package named "${pack.name}".`,
    `Theme direction: ${direction}.`,
    `Batch: ${sheetIndex + 1} of 3. ${variationFocus}`,
    "Layout: exactly four distinct image examples arranged as a clean 2 column by 2 row grid inside one square image.",
    "Each grid tile must be a separate finished gallery example for this same package theme, with different poses, crops, lighting, wardrobe, settings, or compositions.",
    "All four tiles must stay on the requested theme. Do not include unrelated themes, generic stock headshots, football players outside the fan-photo theme, wedding scenes outside wedding/couple themes, or travel/nature scenes outside travel/nature/holiday themes.",
    "Style: premium realistic editorial photography or polished original avatar art when the theme is anime avatar; high-quality AI photo subscription aesthetic.",
    "Constraints: no text, no captions, no logos, no watermarks, no UI, no celebrity likeness, no copyrighted characters, no brand marks, no distorted faces, no duplicated tiles."
  ].join("\n");
}

async function loadProvider() {
  const preferEnv = flags.has("env-provider") || process.env.THEME_GALLERY_USE_ENV_PROVIDER === "1";
  const envBaseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
  const envApiKey = process.env.IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (preferEnv && envBaseUrl && envApiKey) return { label: "environment", baseUrl: envBaseUrl, apiKey: envApiKey, model };
  const provider = await prisma.platformAiProvider.findFirst({
    where: { modelType: model },
    orderBy: [{ preferred: "desc" }, { priority: "desc" }, { createdAt: "asc" }]
  });
  if (!provider?.apiKey) throw new Error(`No configured platform AI provider found for ${model}`);
  return {
    label: provider.label,
    baseUrl: normalizeBaseUrl(provider.aiUrl),
    apiKey: provider.apiKey,
    model: provider.modelType
  };
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateContactSheet({ pack, slug, provider, sheetIndex }) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${provider.baseUrl}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: provider.model,
          prompt: buildPrompt(pack, slug, sheetIndex),
          size: imageSize,
          quality: imageQuality,
          response_format: "b64_json"
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${slug}: provider failed ${response.status} ${JSON.stringify(body).slice(0, 600)}`);
      }
      const b64 = imageBase64(body);
      if (!b64) throw new Error(`${slug}: provider returned an empty image payload`);
      return Buffer.from(b64, "base64");
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      console.log(`${slug}: attempt ${attempt} failed, retrying... ${error instanceof Error ? error.message : String(error)}`);
      await sleep(10_000 * attempt);
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${slug}: provider generation failed`);
}

async function cropContactSheet(buffer, slug, sheetIndex) {
  const sharp = (await import("sharp")).default;
  const source = sharp(buffer);
  const metadata = await source.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const cols = 2;
  const rows = 2;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const insetX = Math.max(6, Math.floor(cellW * 0.025));
  const insetY = Math.max(6, Math.floor(cellH * 0.025));
  const outputs = galleryPaths(slug).slice(sheetIndex * 4, sheetIndex * 4 + 4);
  await fs.mkdir(path.join(outRoot, slug), { recursive: true });
  for (let index = 0; index < outputs.length; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const left = Math.min(width - 1, col * cellW + insetX);
    const top = Math.min(height - 1, row * cellH + insetY);
    const extractWidth = Math.max(64, Math.min(cellW - insetX * 2, width - left));
    const extractHeight = Math.max(64, Math.min(cellH - insetY * 2, height - top));
    await sharp(buffer)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(1024, 1024, { fit: "cover" })
      .webp({ quality: 90 })
      .toFile(outputs[index].filePath);
  }
}

async function generatePack(pack, provider) {
  const slug = pack.categoryRecord?.slug ?? slugify(pack.category || pack.name);
  const outputs = galleryPaths(slug);
  const complete = await Promise.all(outputs.map((output) => fileExists(output.filePath)));
  if (!force && complete.every(Boolean)) {
    return { slug, name: pack.name, skipped: true, imageUrl: outputs[0].publicPath };
  }
  for (let sheetIndex = 0; sheetIndex < 3; sheetIndex += 1) {
    console.log(`generating ${slug}: ${pack.name} sheet ${sheetIndex + 1}/3`);
    const buffer = await generateContactSheet({ pack, slug, provider, sheetIndex });
    if (saveSheets) {
      const sheetDir = path.join(outRoot, "_sheets");
      await fs.mkdir(sheetDir, { recursive: true });
      await fs.writeFile(path.join(sheetDir, `${slug}-${sheetIndex + 1}.png`), buffer);
    }
    await cropContactSheet(buffer, slug, sheetIndex);
  }
  return { slug, name: pack.name, skipped: false, imageUrl: outputs[0].publicPath };
}

async function mapLimit(items, workerCount, mapper) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(workerCount, items.length) }, () => worker()));
  return results;
}

async function main() {
  const provider = await loadProvider();
  console.log(`using platform AI provider: ${provider.label} (${provider.model})`);
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    include: { categoryRecord: true },
    orderBy: { createdAt: "asc" }
  });
  const selected = packs
    .filter((pack) => {
      const slug = pack.categoryRecord?.slug ?? slugify(pack.category || pack.name);
      return themeDirections[slug] && (!onlySlugs.size || onlySlugs.has(slug));
    })
    .slice(0, limit || undefined);
  if (!selected.length) throw new Error("No matching active theme packs found");
  const results = await mapLimit(selected, concurrency, (pack) => generatePack(pack, provider));
  console.log(JSON.stringify({ ok: true, count: results.length, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
