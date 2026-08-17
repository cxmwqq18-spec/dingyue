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

const workspaceRoot = process.cwd();
const statePath = path.join(workspaceRoot, "data", "platform-state.json");
const siteId = args.get("site-id") ?? process.env.AIDREAMCAPES_GALLERY_SITE_ID ?? "site_aidreamcapes";
const model = args.get("model") ?? process.env.AIDREAMCAPES_GALLERY_MODEL ?? "gpt-image-2";
const imageSize = args.get("size") ?? process.env.AIDREAMCAPES_GALLERY_SIZE ?? "1024x1024";
const imageQuality = args.get("quality") ?? process.env.AIDREAMCAPES_GALLERY_QUALITY ?? "medium";
const outRoot = path.resolve(workspaceRoot, args.get("out") ?? "public/assets/sites/site_aidreamcapes/creative-packs/pack-galleries");
const publicPrefix = args.get("public-prefix") ?? "/assets/sites/site_aidreamcapes/creative-packs/pack-galleries";
const publicVersion = args.get("version") ?? process.env.AIDREAMCAPES_GALLERY_VERSION ?? "20260715ai";
const force = flags.has("force") || process.env.AIDREAMCAPES_GALLERY_FORCE === "1";
const saveSheets = flags.has("save-sheets") || process.env.AIDREAMCAPES_GALLERY_SAVE_SHEETS === "1";
const concurrency = Math.max(1, Math.min(3, Number(args.get("concurrency") ?? process.env.AIDREAMCAPES_GALLERY_CONCURRENCY ?? "1") || 1));
const limit = Math.max(0, Number(args.get("limit") ?? process.env.AIDREAMCAPES_GALLERY_LIMIT ?? "0") || 0);
const timeoutMs = Math.max(30_000, Number(args.get("timeout-ms") ?? process.env.AIDREAMCAPES_GALLERY_TIMEOUT_MS ?? "300000") || 300_000);
const maxAttempts = Math.max(1, Number(args.get("attempts") ?? process.env.AIDREAMCAPES_GALLERY_ATTEMPTS ?? "3") || 3);
const onlySlugs = new Set(String(args.get("slugs") ?? process.env.AIDREAMCAPES_GALLERY_SLUGS ?? "")
  .split(",")
  .map((slug) => slug.trim())
  .filter(Boolean));
const providerLabel = args.get("provider-label") ?? process.env.AIDREAMCAPES_GALLERY_PROVIDER_LABEL ?? "";

const themeDirections = {
  "route-portrait-albums": "cohesive cinematic travel portrait albums across coastal roads, old city lanes, resort mornings, scenic lookouts, notebooks, luggage, and destination-story framing",
  "coastal-light-sets": "warm seaside portraits with beach walks, white island towns, cliffside paths, sailboat docks, linen outfits, and soft coastal light",
  "old-quarter-walks": "old city travel portraits in stone lanes, cafe corners, plazas, museum steps, boutique hotel entrances, and warm street textures",
  "island-resort-scenes": "relaxed island resort portraits with white terraces, poolside light, balconies, breakfast tables, palms, linen textures, and vacation warmth",
  "cafe-street-stories": "natural cafe and street portraits for slow mornings, crosswalks, flower shops, espresso tables, city corners, and editorial travel memories",
  "scenic-overlooks": "scenic overlook portraits with sea cliffs, terraces, ridge paths, panoramic railings, wide skies, and open destination atmosphere",
  "alpine-trail-frames": "outdoor alpine trail portraits with lakes, cabins, mountain paths, hiking layers, pine roads, and crisp adventure light",
  "road-trip-frames": "roadside escape portraits with open roads, motel colors, car-window memories, gas station stops, sunlit highways, and weekend route mood",
  "route-moodboards": "travel planning moodboard portraits with outfit notes, itinerary objects, map tables, destination references, seasonal styling, and concept-board compositions",
  "postcard-story-sets": "postcard-ready travel portraits with story crops, memory-card compositions, profile banners, title-space images, and bright shareable scenes",
  "lagoon-route-studies": "clear-water lagoon portraits with boat decks, pale blue resort scenes, quiet coves, linen styling, and breezy private-album warmth",
  "private-villa-stays": "quiet luxury villa portraits with courtyard pools, garden breakfasts, sunlit rooms, arched doors, tiled patios, and private retreat feeling",
  "rooftop-city-nights": "blue-hour rooftop city portraits with skyline terraces, evening dinners, polished travel outfits, soft neon distance, and city-break elegance",
  "market-morning-walks": "market morning travel portraits with flower stalls, local produce, linen outfits, early city color, textured awnings, and candid editorial warmth",
  "rainy-city-breaks": "moody rainy city portraits with umbrellas, wet-street reflections, museum steps, hotel awnings, tram stops, and soft cinematic atmosphere",
  "desert-road-stories": "desert road portraits with sunset dust, warm motel color, open landscapes, roadside viewpoints, vintage route styling, and dry golden light",
  "lake-house-weekends": "calm lake house portraits with docks, canoes, pine roads, porch light, weekend sweaters, family-friendly warmth, and quiet water scenes",
  "snow-lodge-escapes": "snow lodge portraits with alpine villages, warm fireplaces, winter trails, wool coats, chalet windows, and cozy mountain travel light",
  "rail-journey-portraits": "slow travel portraits with train windows, station platforms, luggage moments, overnight routes, compartment light, and itinerary storytelling",
  "travel-journal-covers": "editorial travel journal cover portraits with title-space crops, story opener images, notebook details, maps, elegant negative space, and magazine framing",
  "solo-traveler-profiles": "confident solo traveler profile portraits for creators and founders, scenic backdrops, natural smiles, travel journals, personal-brand polish, and private gallery delivery",
  "shared-route-albums": "paired shared getaway portraits with coastal walks, city dinners, balcony moments, overlooks, natural interaction, and private album continuity",
  "family-travel-keepsakes": "gentle family travel portraits for resorts, old towns, lake weekends, outlooks, memory cards, soft group connection, and polished keepsake scenes",
  "golden-hour-route-stories": "warm golden hour route portraits with sunset roads, overlook paths, city terraces, soft rim light, travel outfits, and scenic late-day atmosphere",
  "wellness-retreat-scenes": "serene wellness retreat portraits with spa decks, yoga mornings, mineral pools, garden paths, calm robes, restorative light, and quiet destination mood",
  "nature-portrait-studio": "quiet botanical portraits with glasshouse light, garden paths, soft green textures, linen styling, calm adult subjects, realistic skin texture, and editorial personal-atlas framing",
  "city-light-night-walks": "lively night city route portraits with rainy street reflections, skyline color, polished travel outfits, confident adult poses, and destination-world atmosphere",
  "evening-route-portraits": "shadow-led evening travel portraits with blue-hour streets, hotel awnings, lounge light, polished eveningwear, moody city interiors, and elegant dramatic contrast",
  "boudoir-editorial-portraits": "modest indoor editorial portraits with soft hotel-window light, elegant wardrobe, seated room compositions, refined magazine framing, privacy-first tone, and graceful adult confidence",
  "hairstyle-try-on-stories": "hair look study portraits showing varied haircuts, color ideas, salon light, beauty-editorial framing, clean face composition, realistic hair texture, and private planning crops",
  "professional-headshot-studio": "credible professional portraits with clean studio lighting, business-casual wardrobe, neutral architectural backdrops, warm confidence, and crisp facial detail for public bios",
  "milestone-postcard-sets": "personal milestone postcard portraits with destination notes, keepsake captions, soft floral settings, elegant solo or shared styling, and polished announcement-style crops",
  "holiday-couple-cards": "festive couple card portraits with warm interiors, winter light, tasteful seasonal decor, cozy formal outfits, atmospheric card composition, and private keepsake warmth",
  "gala-night-portraits": "formal gala night portraits with hotel-lobby glow, banquet halls, black-tie styling, evening gowns, warm glass light, polished event photography, and luxury keepsake framing",
  "heritage-celebration-portraits": "respectful heritage celebration portraits with rich textiles, traditional attire, jewelry, warm gathering atmosphere, destination-inspired backgrounds, vibrant color, and elegant solo or shared compositions"
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
  const response = await fetch(url);
  if (!response.ok) throw new Error(`image URL fetch failed ${response.status}`);
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

const galleryAltScenes = [
  "close travel portrait with clear facial detail",
  "half-body editorial frame in destination light",
  "wide scene showing the route setting and mood",
  "candid lifestyle moment for a private album",
  "detail crop with travel objects and polished composition",
  "vertical profile crop for mobile sharing",
  "scenic overlook portrait with atmospheric background",
  "soft evening frame with cinematic destination color",
  "album cover style image with strong subject focus",
  "download-ready keepsake frame from the route",
  "event-style portrait with polished vacation styling",
  "finished gallery example with a distinct pose"
];

function galleryImageAltForPack(pack, slug, index) {
  const direction = themeDirections[slug] ?? pack.description ?? pack.headline ?? pack.name;
  const subject = String(direction).split(";")[0].replace(/\s+/g, " ").trim() || `${pack.name} travel portrait album`;
  const scene = galleryAltScenes[index % galleryAltScenes.length];
  return `${subject}, ${scene}, ${pack.name} gallery example for AIdreamcapes.`;
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
    "Show distinct close portraits, half-body portraits, and album-ready square crops.",
    "Change the environment, wardrobe, travel props, light direction, season, and subject identity across all four tiles.",
    "Push stronger editorial variety with different camera distance, pose, background, palette, and composition while staying inside the same theme."
  ][sheetIndex] ?? "Create distinct but on-theme gallery examples.";
  return [
    "Use case: photorealistic-natural",
    "Asset type: source contact sheet for an Aidreamcapes customer-facing AI travel portrait package gallery",
    `Primary request: create one square contact sheet for the Aidreamcapes package named \"${pack.name}\".`,
    `Theme direction: ${direction}.`,
    `Batch: ${sheetIndex + 1} of 3. ${variationFocus}`,
    "Layout: exactly four distinct finished image examples arranged as a clean 2 column by 2 row grid inside one square image.",
    "Each grid tile must be a separate, clear, high-resolution travel portrait example for this same package theme.",
    "Every tile must use a different subject identity, scene, pose, crop, lighting setup, wardrobe, travel object, and background composition.",
    "Style: premium realistic editorial travel photography, crisp focus on the subject, natural skin texture, believable faces, clean hands, clear destination details.",
    "Constraints: no text, no captions, no logos, no watermarks, no UI, no celebrity likeness, no brand marks, no distorted faces, no repeated tile, no blurred subject, no generic stock-photo look."
  ].join("\n");
}

async function loadProvider() {
  const preferEnv = flags.has("env-provider") || process.env.AIDREAMCAPES_GALLERY_USE_ENV_PROVIDER === "1";
  const envBaseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
  const envApiKey = process.env.IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (preferEnv && envBaseUrl && envApiKey) return { label: "environment", baseUrl: envBaseUrl, apiKey: envApiKey, model };
  const provider = await prisma.platformAiProvider.findFirst({
    where: providerLabel ? { modelType: model, label: providerLabel } : { modelType: model },
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
      if (b64) return Buffer.from(b64, "base64");
      const url = imageUrl(body);
      if (url) return await imageBufferFromUrl(String(url));
      throw new Error(`${slug}: provider returned an empty image payload`);
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
  const insetX = Math.max(8, Math.floor(cellW * 0.03));
  const insetY = Math.max(8, Math.floor(cellH * 0.03));
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
      .sharpen({ sigma: 0.45 })
      .webp({ quality: 92, smartSubsample: true })
      .toFile(outputs[index].filePath);
  }
}

async function generatePack(pack, provider) {
  const slug = pack.categoryRecord?.slug ?? pack.category ?? slugify(pack.name);
  const outputs = galleryPaths(slug);
  const complete = await Promise.all(outputs.map((output) => fileExists(output.filePath)));
  if (!force && complete.every(Boolean)) {
    return { id: pack.id, slug, name: pack.name, skipped: true, galleryImages: outputs.map((output) => output.publicPath), galleryImageAlts: galleryImageAltsForPack(pack, slug, outputs.length) };
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
  return { id: pack.id, slug, name: pack.name, skipped: false, galleryImages: outputs.map((output) => output.publicPath), galleryImageAlts: galleryImageAltsForPack(pack, slug, outputs.length) };
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

async function updateState(results) {
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const resultById = new Map(results.map((result) => [result.id, result]));
  const resultBySlug = new Map(results.map((result) => [result.slug, result]));
  let updated = 0;
  state.creativePacks = (state.creativePacks ?? []).map((pack) => {
    const result = resultById.get(pack.id) ?? resultBySlug.get(pack.category);
    if (!result) return pack;
    updated += 1;
    return { ...pack, galleryImages: result.galleryImages, galleryImageAlts: result.galleryImageAlts };
  });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return updated;
}

async function updatePrisma(results) {
  let updated = 0;
  for (const result of results) {
    const response = await prisma.creativePack.updateMany({
      where: { siteId, OR: [{ id: result.id }, { category: result.slug }] },
      data: { galleryImages: result.galleryImages, galleryImageAlts: result.galleryImageAlts }
    });
    updated += response.count;
  }
  return updated;
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
      const slug = pack.categoryRecord?.slug ?? pack.category ?? slugify(pack.name);
      return !onlySlugs.size || onlySlugs.has(slug);
    })
    .slice(0, limit || undefined);
  if (!selected.length) throw new Error("No matching Aidreamcapes theme packs found");
  const results = await mapLimit(selected, concurrency, async (pack) => {
    const result = await generatePack(pack, provider);
    await updateState([result]);
    await updatePrisma([result]);
    return result;
  });
  console.log(JSON.stringify({ ok: true, count: results.length, stateUpdated: results.length, prismaUpdated: results.length, results }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
