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
const coverRoot = path.resolve(process.cwd(), args.get("cover-out") ?? "public/assets/dreamshoot/generated/pack-covers");
const coverPublicPrefix = args.get("cover-public-prefix") ?? "/assets/dreamshoot/generated/pack-covers";
const publicVersion = args.get("version") ?? process.env.THEME_GALLERY_VERSION ?? "20260715b";
const coverPublicVersion = args.get("cover-version") ?? process.env.THEME_COVER_VERSION ?? publicVersion;
const coverPublicVersionBySlug = {
  engagement: process.env.THEME_ENGAGEMENT_COVER_VERSION ?? "20260805uncropped1"
};
const force = flags.has("force") || process.env.THEME_GALLERY_FORCE === "1";
const dryRun = flags.has("dry-run");
const saveSheets = flags.has("save-sheets") || process.env.THEME_GALLERY_SAVE_SHEETS === "1";
const concurrency = Math.max(1, Math.min(3, Number(args.get("concurrency") ?? process.env.THEME_GALLERY_CONCURRENCY ?? "1") || 1));
const limit = Math.max(0, Number(args.get("limit") ?? process.env.THEME_GALLERY_LIMIT ?? "0") || 0);
const timeoutMs = Math.max(30_000, Number(args.get("timeout-ms") ?? process.env.THEME_GALLERY_TIMEOUT_MS ?? "240000") || 240_000);
const maxAttempts = 1;
const maxPaidCreates = Math.max(1, Number(args.get("max-paid-creates") ?? process.env.THEME_GALLERY_MAX_PAID_CREATES ?? "30") || 30);
const manifestPath = args.get("manifest") ? path.resolve(process.cwd(), args.get("manifest")) : "";
const requestSalt = args.get("request-salt") ?? process.env.THEME_GALLERY_REQUEST_SALT ?? "20260815";
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
  holiday: "seasonal holiday portraits for Christmas, Thanksgiving, Halloween, winter cards, family-style celebration albums, greeting-card compositions, warm home interiors, festive lights, gifts, harvest tables, tasteful costume-party details, and private album mood; no beach, tropical resort, summer vacation, or generic travel imagery",
  "thanksgiving-group-photos": "Thanksgiving group portraits with warm dinner-table atmosphere, harvest colors, cozy home interiors, gratitude cards, family and friend gathering energy, card-ready compositions, and private seasonal album mood",
  "halloween-party-photos": "Halloween party portraits with costume-party energy, dramatic colored lighting, playful spooky decor, group-friendly card framing, cinematic VIP party mood, and seasonal private album images",
  "christmas-couple": "Christmas couple portraits with cozy sweaters, warm lights, tree decor, snow-window mood, greeting-card compositions, and romantic holiday energy",
  "christmas-photos": "solo Christmas portraits with festive lights, tree decor, snow mood, warm sweaters, holiday cards, and seasonal profile images",
  "ai-video-add-ons": "motion-ready AI video starter frames, cinematic storyboard stills, dynamic poses, timeline-like visual rhythm, and short clip preview energy",
  "magic-upscaler": "image upscaling and enhancement preview visuals, crisp portrait details, before-after clarity, magnified texture, sparkle-clean high-resolution delivery",
  "only-fans": "fully clothed adult creator lifestyle portraits with confident poses, premium studio or lounge settings, fashion-forward styling, tasteful editorial lighting, and no explicit sexual content",
  "singles-awareness-day": "warm solo celebration portraits for adults with expressive styling, flowers, date-night color, confident social-ready poses, and a polished personal gallery mood",
  bikini: "fully clothed resort swimwear-inspired fashion portraits for adults with tasteful editorial styling, bright coastal light, confident poses, and no nudity or explicit content",
  swimsuit: "fully clothed resort swimwear fashion previews for adults with lookbook styling, poolside light, wardrobe detail, confident poses, and no nudity or explicit content",
  "background-remover": "clean portrait and product-isolation scenes with crisp subject edges, neutral studio backdrops, transparent-background preparation, and polished catalog framing",
  "magic-eraser": "before-and-after photo cleanup scenes showing believable object removal, tidy backgrounds, crisp portrait detail, and natural-looking image restoration",
  "portrait-retouch": "natural professional portrait retouching previews with balanced skin texture, clean eyes, subtle lighting polish, realistic detail, and no plastic-skin effect",
  "unblur-image": "photo clarity restoration previews with readable facial detail, natural sharpening, recovered focus, believable texture, and clean before-and-after visual direction",
  "color-correction": "professional photo color correction previews with balanced skin tones, recovered highlights, natural contrast, accurate wardrobe color, and polished editorial grading",
  "old-photo-restoration": "respectful restoration previews for vintage family portraits with repaired scratches, recovered contrast, natural facial detail, archival warmth, and no invented text"
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

function imageUrl(body) {
  return body?.data?.[0]?.url ??
    body?.data?.[0]?.image_url ??
    body?.output?.[0]?.url ??
    body?.output?.[0]?.image_url ??
    body?.url ??
    body?.image_url;
}

async function imageBufferFromUrl(url) {
  if (url.startsWith("data:")) {
    const [, payload = ""] = url.split(",", 2);
    return Buffer.from(payload, url.includes(";base64,") ? "base64" : "utf8");
  }
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`image_url_fetch_failed_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
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

function coverPath(slug) {
  const version = coverPublicVersionBySlug[slug] ?? coverPublicVersion;
  return {
    publicPath: `${coverPublicPrefix}/${slug}/${slug}-cover.webp?v=${version}`,
    filePath: path.join(coverRoot, slug, `${slug}-cover.webp`)
  };
}

const galleryAltScenes = [
  "close portrait framing with clear facial detail",
  "half-body editorial pose with balanced crop",
  "group-friendly composition with space around the subjects",
  "wide environmental scene with contextual background",
  "candid social-style expression with natural posture",
  "detail portrait crop with polished styling",
  "vertical profile crop with clean framing",
  "cinematic color contrast with directional light",
  "album-cover style crop with strong subject focus",
  "lifestyle portrait framing with natural setting cues",
  "event-style portrait under polished light",
  "distinct themed pose with refined styling"
];

function galleryImageAltForPack(pack, slug, index) {
  const direction = themeDirections[slug] ?? pack.description ?? pack.headline ?? pack.name;
  const subject = String(direction)
    .split(";")[0]
    .replace(/\b(?:private|package|gallery|customer-facing|AI photo subscription aesthetic)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim() || "Portrait with polished editorial styling";
  const scene = galleryAltScenes[index % galleryAltScenes.length];
  return `${subject}, ${scene}.`;
}

function galleryImageAltsForPack(pack, slug, count) {
  return Array.from({ length: count }, (_, index) => galleryImageAltForPack(pack, slug, index));
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
    "All four tiles must stay on the requested theme. Do not include unrelated themes, generic stock headshots, football players outside the fan-photo theme, wedding scenes outside wedding/couple themes, travel/nature scenes outside travel/nature/travel packages, or beach/tropical resort scenes inside seasonal holiday packages.",
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

async function generateContactSheet({ pack, slug, provider, sheetIndex }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestId = `mydreamshoots-theme-gallery:${requestSalt}:${slug}:${sheetIndex + 1}`.slice(0, 180);
  try {
    const response = await fetch(`${provider.baseUrl}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": requestId,
        "X-Client-Request-Id": requestId
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
      throw new Error(`${slug}: provider failed ${response.status} request=${requestId} ${JSON.stringify(body).slice(0, 600)}`);
    }
    const b64 = imageBase64(body);
    if (b64) return Buffer.from(b64, "base64");
    const url = imageUrl(body);
    if (url) return await imageBufferFromUrl(String(url));
    throw new Error(`${slug}: provider returned an empty image payload request=${requestId}`);
  } finally {
    clearTimeout(timeout);
  }
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

async function createCoverFromGallery(slug, sourceFilePath) {
  const sharp = (await import("sharp")).default;
  const cover = coverPath(slug);
  await fs.mkdir(path.dirname(cover.filePath), { recursive: true });
  const overlay = Buffer.from(
    `<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#05070E" stop-opacity="0.18" offset="0"/><stop stop-color="#16dcf0" stop-opacity="0.12" offset="0.45"/><stop stop-color="#ff9f43" stop-opacity="0.16" offset="1"/></linearGradient></defs><rect width="1280" height="960" fill="url(#g)"/></svg>`
  );
  const background = await sharp(sourceFilePath)
    .resize(1280, 960, { fit: "cover", position: "centre" })
    .blur(26)
    .modulate({ brightness: 0.7, saturation: 1.05, hue: 4 })
    .composite([{ input: overlay, blend: "overlay" }])
    .toBuffer();
  const foreground = await sharp(sourceFilePath)
    .resize(900, 900, { fit: "inside" })
    .toBuffer();
  const foregroundMeta = await sharp(foreground).metadata();
  await sharp(background)
    .composite([{
      input: foreground,
      left: Math.max(0, Math.floor((1280 - (foregroundMeta.width ?? 900)) / 2)),
      top: Math.max(0, Math.floor((960 - (foregroundMeta.height ?? 900)) / 2))
    }])
    .sharpen({ sigma: 0.42 })
    .webp({ quality: 90 })
    .toFile(cover.filePath);
  return cover.publicPath;
}

async function generatePack(pack, provider) {
  const slug = pack.categoryRecord?.slug ?? slugify(pack.category || pack.name);
  const outputs = galleryPaths(slug);
  const complete = await Promise.all(outputs.map((output) => fileExists(output.filePath)));
  const cover = coverPath(slug);
  if (!force && complete.every(Boolean)) {
    if (!(await fileExists(cover.filePath))) await createCoverFromGallery(slug, outputs[0].filePath);
    return { slug, name: pack.name, skipped: true, imageUrl: cover.publicPath, galleryImages: outputs.map((output) => output.publicPath), galleryImageAlts: galleryImageAltsForPack(pack, slug, outputs.length) };
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
  await createCoverFromGallery(slug, outputs[0].filePath);
  return { slug, name: pack.name, skipped: false, imageUrl: cover.publicPath, galleryImages: outputs.map((output) => output.publicPath), galleryImageAlts: galleryImageAltsForPack(pack, slug, outputs.length) };
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

async function activeThemePacksForSite() {
  const databasePacks = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    include: { categoryRecord: true },
    orderBy: { createdAt: "asc" }
  });
  if (databasePacks.length) return { source: "database", packs: databasePacks };

  const statePath = path.join(process.cwd(), "data", "platform-state.json");
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const categories = (state.creativePackCategories ?? []).filter((category) => category.siteId === siteId && category.status === "active");
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const parentById = new Map(categories.filter((category) => category.parentId).map((category) => [category.id, categoryById.get(category.parentId)]));
  const packs = (state.creativePacks ?? [])
    .filter((pack) => pack.siteId === siteId && pack.status === "active")
    .sort((left, right) => String(left.createdAt ?? "").localeCompare(String(right.createdAt ?? "")))
    .map((pack) => {
      const category = categoryById.get(pack.categoryId);
      return {
        ...pack,
        categoryRecord: category
          ? {
              ...category,
              parent: parentById.get(category.id)
            }
          : undefined
      };
    });
  return { source: "platform-state", packs };
}

async function main() {
  const packSource = await activeThemePacksForSite();
  const packs = packSource.packs;
  const selected = packs
    .filter((pack) => {
      const slug = pack.categoryRecord?.slug ?? slugify(pack.category || pack.name);
      return themeDirections[slug] && (!onlySlugs.size || onlySlugs.has(slug));
    })
    .slice(0, limit || undefined);
  if (!selected.length) throw new Error("No matching active theme packs found");
  const plannedCreates = selected.length * 3;
  if (plannedCreates > maxPaidCreates) {
    throw new Error(`Refusing to exceed paid-create cap: planned=${plannedCreates}, cap=${maxPaidCreates}`);
  }
  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      siteId,
      source: packSource.source,
      model,
      selectedSlugs: selected.map((pack) => pack.categoryRecord?.slug ?? slugify(pack.category || pack.name)),
      plannedCreates,
      maxPaidCreates,
      maxAttempts
    }, null, 2));
    return;
  }
  const provider = await loadProvider();
  console.log(`using ${packSource.source} theme data; platform AI provider: ${provider.label} (${provider.model}); paid create cap=${maxPaidCreates}; attempts per create=${maxAttempts}`);
  const results = await mapLimit(selected, concurrency, (pack) => generatePack(pack, provider));
  const manifest = {
    ok: true,
    siteId,
    model: provider.model,
    paidCreateCap: maxPaidCreates,
    paidCreateAttempts: plannedCreates,
    results
  };
  if (manifestPath) {
    await fs.mkdir(path.dirname(manifestPath), { recursive: true });
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
  console.log(JSON.stringify(manifest, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
