#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Agent } from "undici";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const siteId = "site_aidreamcapes";
const publicAssetBase = "/assets/sites/site_aidreamcapes/fan-holiday-theme";
const localAssetRoot = path.join(repoRoot, "public", "assets", "sites", "site_aidreamcapes", "fan-holiday-theme");

const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();
for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index];
  if (!raw.startsWith("--")) continue;
  const [key, ...rest] = raw.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
    continue;
  }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    flags.add(key);
  }
}

const dryRun = flags.has("dry-run");
const force = flags.has("force");
const savePrompts = flags.has("save-prompts");
const saveSheets = flags.has("save-sheets");
const compactPrompts = flags.has("compact-prompts") || process.env.AIDREAMCAPES_FAN_HOLIDAY_COMPACT_PROMPTS === "1";
const useEditEndpoint = flags.has("edit-reference") || args.get("mode") === "edit" || process.env.AIDREAMCAPES_FAN_HOLIDAY_USE_EDIT_REFERENCE === "1";
const model = String(args.get("model") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_MODEL ?? "gpt-image-2");
const imageSize = String(args.get("size") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_SIZE ?? "1024x1024");
const imageQuality = String(args.get("quality") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_QUALITY ?? "medium");
const timeoutMs = boundedNumber(args.get("timeout-ms") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_TIMEOUT_MS, 300_000, 30_000, 900_000);
const fetchDispatcher = new Agent({
  headersTimeout: timeoutMs + 60_000,
  bodyTimeout: timeoutMs + 60_000
});
const maxAttempts = boundedNumber(args.get("attempts") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_ATTEMPTS, 1, 1, 2);
const concurrency = boundedNumber(args.get("concurrency") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_IMAGE_CONCURRENCY, 1, 1, 2);
const packLimit = boundedNumber(args.get("limit") ?? args.get("pack-limit") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_PACK_LIMIT, 0, 0, Number.POSITIVE_INFINITY);
const maxPaidCreates = boundedNumber(args.get("max-paid-creates") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_MAX_PAID_CREATES, 1, 0, Number.POSITIVE_INFINITY);
const providerLabel = String(args.get("provider-label") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_PROVIDER_LABEL ?? "").trim();
const requestSalt = String(args.get("request-salt") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_REQUEST_SALT ?? "20260731relevance1").replace(/[^a-zA-Z0-9_.:-]+/g, "-").slice(0, 80);
const selectedSlugs = csvSet(args.get("slugs") ?? args.get("slug") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_SLUGS);
const selectedAssetTypes = csvSet(args.get("asset-types") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_ASSET_TYPES);
const selectedGallerySheets = csvNumberSet(args.get("sheets") ?? args.get("gallery-sheets") ?? process.env.AIDREAMCAPES_FAN_HOLIDAY_GALLERY_SHEETS, 1, 3);
const enabledAssetTypes = selectedAssetTypes.size
  ? selectedAssetTypes
  : new Set(["categories", "covers", "gallery", "posters", "showcase"]);

const compliancePrompt = [
  "Do not depict or imitate a real celebrity, real athlete, public figure, or protected character.",
  "Do not include official team logos, event marks, uniforms with recognizable marks, brand logos, trademarks, captions, text, watermarks, UI, or readable signage.",
  "Use only original fictional people and original non-branded settings."
].join(" ");

const packVariationNotes = [
  "Sheet 1: one close portrait, one half-body portrait, one two-person moment, and one wider environment frame.",
  "Sheet 2: change every subject identity, wardrobe, background, light direction, pose, and camera distance.",
  "Sheet 3: use a new palette and setting mix with distinct solo, pair, group, and album-cover compositions."
];

function themeSafetyNote(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  const notes = [];
  if (/\b(thanksgiving|friendsgiving|gratitude|autumn host|autumn)\b/.test(text)) {
    notes.push("Every image must read as an autumn Thanksgiving or Friendsgiving keepsake: dinner table, turkey or harvest meal, pumpkins, candles, fall leaves, gratitude cards, warm home hosting, or family/friend memory-album review. Do not create weddings, bridal fashion, saris, mandaps, ceremonial stages, formal gala scenes, scenic travel, beaches, mountains, horses, Christmas trees, Halloween costumes, or generic portraits without Thanksgiving context.");
  }
  if (/\b(halloween|haunted|spooky|costume)\b/.test(text)) {
    notes.push("Use fictional adults only, visually 25+. Keep it modest and normal: friendly porch parties, pumpkin decor, simple non-revealing original costumes, cozy autumn styling, and greeting-card compositions. No children, teens, childlike faces, school uniforms, fairy wings, magic wands, capes that resemble protected fantasy characters, branded cosplay, vampires, monsters, ghosts, skull makeup, horror gore, sensual posing, revealing outfits, nightclub mood, birthday parties, Christmas rooms, or unrelated family portraits.");
  }
  if (/\b(fan-scene|backstage|supporter|fan letter|fan keepsake|creator supporter|photo wall)\b/.test(text)) {
    notes.push("Keep the image anchored to a permission-safe fan or supporter memory: meet-and-greet ambience, signed-photo table, backstage lounge, creator fan wall, concert-adjacent arrival, or private album review. Do not create scenic travel, beaches, mountains, generic fashion portraits, wedding or bridal looks, unrelated music-performance portraits, pets, Christmas rooms, or children.");
  }
  if (/\b(game-day|stadium|watch party|championship|tunnel entrance)\b/.test(text)) {
    notes.push("Keep the image anchored to game-day energy: stadium tunnel, watch-party sofa, arena lights, supporter group, team-color outfits without logos, scarves, snacks, confetti, or cheering friends. Do not create Halloween, gothic portraits, generic nightlife, weddings, travel scenes, official team logos, or readable jerseys.");
  }
  if (/\b(premiere|vip|award night|spotlight)\b/.test(text)) {
    notes.push("Keep the image anchored to premiere or VIP arrival language: red carpet, flashbulbs, eveningwear, velvet rope, award-night table, gala lobby, step-and-repeat without logos, or polished couple arrival. Do not create beaches, scenic travel, Christmas home scenes, casual sweaters, musicians with instruments, stadium crowds, Halloween/goth costumes, or generic portraits without event context.");
  }
  if (/\b(birthday|new year|countdown|family occasion|seasonal celebration|milestone)\b/.test(text)) {
    notes.push("Keep the image anchored to the named celebration: birthday cake, balloons, wrapped gifts, party table, New Year sparklers, countdown lights, family milestone dinner, or private celebration album review. Do not create scenic travel, beaches, mountains, generic portraits, fashion shoots, guitars, unrelated reading scenes, or lonely landscapes.");
  }
  if (/\b(seasonal|birthday|new year|countdown|family occasion|milestone)\b/.test(text)) {
    notes.push("Keep it centered on birthdays, New Year countdowns, family milestones, greeting-card moments, home gatherings, studio backdrops, and celebration tables; avoid scenic travel, destination landmarks, mountain adventure, beaches, resorts, and itinerary imagery.");
  }
  return notes.join(" ");
}

function relevanceInstruction(label) {
  return [
    `Theme relevance gate: the finished image must clearly match "${label}" before it looks beautiful.`,
    "If a subject, prop, wardrobe, location, or culture cue would make the tile read as another theme, remove it.",
    "Prefer a simpler on-theme home, event, fan wall, stadium, red-carpet, or celebration scene over any impressive but unrelated image."
  ].join(" ");
}

function csvSet(value) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function csvNumberSet(value, min, max) {
  return new Set(
    String(value ?? "")
      .split(",")
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isInteger(item) && item >= min && item <= max)
  );
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function stripVersion(value) {
  return String(value ?? "").split("?")[0].split("#")[0];
}

function localPathFromPublicUrl(value) {
  const clean = stripVersion(value);
  if (!clean.startsWith("/assets/")) throw new Error(`not_public_asset_url:${value}`);
  return path.join(repoRoot, "public", clean.replace(/^\/+/, ""));
}

function optionalLocalPathFromPublicUrl(value) {
  const clean = stripVersion(value);
  if (!clean || !clean.startsWith("/assets/")) return undefined;
  return path.join(repoRoot, "public", clean.replace(/^\/+/, ""));
}

function publicUrl(folder, slug, ext = "webp") {
  return `${publicAssetBase}/${folder}/${slug}.${ext}`;
}

function localAsset(folder, slug, ext = "webp") {
  return path.join(localAssetRoot, folder, `${slug}.${ext}`);
}

function fileSlugFromPublicUrl(value) {
  const basename = path.basename(stripVersion(value));
  return basename.replace(/\.(?:png|jpe?g|webp|avif|svg|mp4)$/i, "");
}

function packSlug(pack) {
  const coverSlug = fileSlugFromPublicUrl(pack.imageUrl ?? "");
  if (coverSlug) return coverSlug;
  return String(pack.id ?? pack.name ?? "pack")
    .replace(/^pack_aidreamcapes_/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function readState() {
  return readPlatformStateFromSql();
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function imageBase64(body) {
  return body?.data?.[0]?.b64_json ??
    body?.data?.[0]?.image_base64 ??
    body?.output?.[0]?.b64_json ??
    body?.output?.[0]?.image_base64 ??
    body?.image_base64;
}

function imageUrlFromBody(body) {
  return body?.data?.[0]?.url ??
    body?.data?.[0]?.image_url ??
    body?.output?.[0]?.url ??
    body?.output?.[0]?.image_url ??
    body?.output?.image_url ??
    body?.url ??
    body?.image_url;
}

function providerRecoveryBody(body, url) {
  return JSON.parse(JSON.stringify({
    createdAt: new Date().toISOString(),
    url,
    body
  }, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

async function saveProviderRecovery(key, body, url) {
  const recoveryDir = path.join(localAssetRoot, "_provider-results");
  await fs.mkdir(recoveryDir, { recursive: true });
  await fs.writeFile(path.join(recoveryDir, `${key}.json`), `${JSON.stringify(providerRecoveryBody(body, url), null, 2)}\n`);
}

async function imageBufferFromUrl(url) {
  if (url.startsWith("data:")) {
    const [, payload = ""] = url.split(",", 2);
    return Buffer.from(payload, url.includes(";base64,") ? "base64" : "utf8");
  }
  const response = await fetch(url, { cache: "no-store", dispatcher: fetchDispatcher });
  if (!response.ok) throw new Error(`image_url_fetch_failed:${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadProvider() {
  const preferEnv = flags.has("env-provider") || process.env.AIDREAMCAPES_FAN_HOLIDAY_USE_ENV_PROVIDER === "1";
  const envBaseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
  const envApiKey = process.env.IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";
  if (preferEnv && envBaseUrl && envApiKey) {
    return { label: "environment", baseUrl: envBaseUrl, apiKey: envApiKey, model };
  }

  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findFirst({
      where: providerLabel ? { modelType: model, label: providerLabel, enabled: true } : { modelType: model, enabled: true },
      orderBy: [{ preferred: "desc" }, { priority: "asc" }, { updatedAt: "desc" }]
    });
    if (!provider?.apiKey || !provider.aiUrl) throw new Error(`No configured platform AI provider found for ${model}`);
    return {
      label: provider.label,
      baseUrl: normalizeBaseUrl(provider.aiUrl),
      apiKey: provider.apiKey,
      model: provider.modelType
    };
  } finally {
    await prisma.$disconnect();
  }
}

function categoryPrompt(category) {
  const extraSafety = themeSafetyNote(category.slug, category.label, category.description, category.heroSubtitle);
  const relevance = relevanceInstruction(category.label);
  if (compactPrompts) {
    return [
      "Photorealistic premium storefront category cover for Aidreamcapes.",
      `Theme: ${category.label}. ${category.description ?? category.heroSubtitle ?? ""}`,
      relevance,
      extraSafety,
      "Create one clear original fan-scene or holiday private-album photo with believable adults, clean faces, natural hands, and strong card readability.",
      "No text, logos, watermarks, official team marks, brand marks, public figures, celebrity likenesses, protected characters, or readable signage."
    ].filter(Boolean).join("\n");
  }
  const parentLabel = category.parent?.label ? ` Parent group: ${category.parent.label}.` : "";
  return [
    "Use case: photorealistic-natural",
    "Asset type: single storefront category hero and card cover for Aidreamcapes.",
    `Primary request: create one premium finished image for the Aidreamcapes category "${category.label}".`,
    `Category description: ${category.description ?? category.heroSubtitle ?? ""}.${parentLabel}`,
    relevance,
    extraSafety,
    "Composition: one complete editorial photo, clear human subjects, strong thumbnail readability, polished fan-scene or holiday atmosphere, no collage grid.",
    "Style: realistic premium private-album photography with clean faces, natural hands, believable lighting, and a modern storefront-ready crop.",
    compliancePrompt
  ].filter(Boolean).join("\n");
}

function packCoverPrompt(pack, category) {
  const extraSafety = themeSafetyNote(pack.slug, pack.name, pack.description, pack.headline, category?.slug, category?.label);
  const relevance = relevanceInstruction(pack.name);
  if (compactPrompts) {
    return [
      "Photorealistic premium Aidreamcapes package cover.",
      `Package: ${pack.name}. ${pack.description ?? pack.headline ?? ""}`,
      category?.label ? `Category: ${category.label}.` : "",
      relevance,
      extraSafety,
      "Create one original private-album cover image with clear adults, polished fan-scene or holiday atmosphere, clean faces, natural hands, and no collage.",
      "No text, logos, watermarks, official team marks, brand marks, public figures, celebrity likenesses, protected characters, or readable signage."
    ].filter(Boolean).join("\n");
  }
  return [
    "Use case: photorealistic-natural",
    "Asset type: single Aidreamcapes photo-package cover image.",
    `Primary request: create one distinctive cover image for the package "${pack.name}".`,
    `Package direction: ${pack.headline ?? pack.description ?? pack.name}.`,
    category?.label ? `Category: ${category.label}.` : "",
    relevance,
    extraSafety,
    "Composition: one finished image, not a grid, not a UI, clear focal subject or group, album-cover crop, premium fan-scene or holiday mood.",
    "Style: realistic editorial photography, sharp subject, natural skin texture, clean hands, tasteful color, strong first-card visual.",
    compliancePrompt
  ].filter(Boolean).join("\n");
}

function gallerySheetPrompt(pack, category, sheetIndex) {
  const extraSafety = themeSafetyNote(pack.slug, pack.name, pack.description, pack.headline, category?.slug, category?.label);
  const relevance = relevanceInstruction(pack.name);
  if (compactPrompts) {
    return [
      "Photorealistic premium Aidreamcapes gallery contact sheet.",
      `Package: ${pack.name}. ${pack.description ?? pack.headline ?? ""}`,
      category?.label ? `Category: ${category.label}.` : "",
      `${packVariationNotes[sheetIndex] ?? "Make all four tiles visibly different."}`,
      relevance,
      extraSafety,
      "Make exactly four distinct complete photos in a clean 2x2 square grid. Each tile must clearly stay on the exact package theme and must have a different fictional subject, pose, crop, background, wardrobe, light, and color palette.",
      "No text, logos, watermarks, UI, official marks, brand marks, real public figures, celebrity likenesses, protected characters, repeated faces, distorted anatomy, or readable signage."
    ].filter(Boolean).join("\n");
  }
  return [
    "Use case: photorealistic-natural",
    "Asset type: source contact sheet for cropping into four Aidreamcapes package gallery examples.",
    `Primary request: create one square 2x2 contact sheet for "${pack.name}".`,
    `Package direction: ${pack.description ?? pack.headline ?? pack.name}.`,
    category?.label ? `Category: ${category.label}.` : "",
    packVariationNotes[sheetIndex] ?? "Create four visibly different finished examples.",
    relevance,
    extraSafety,
    "Layout: exactly four distinct finished image examples arranged as a clean 2 column by 2 row grid inside one square image.",
    "Each tile must be a different complete photo: different fictional subject identity, pose, crop, environment, clothing, light, color palette, and composition.",
    "The four tiles must not repeat the same face, same background, same body pose, same outfit, or same camera angle.",
    "Style: premium realistic editorial fan-scene, game-day, premiere, holiday, or seasonal private-album photography with clear faces and normal anatomy.",
    compliancePrompt
  ].filter(Boolean).join("\n");
}

function posterPrompt(theme) {
  const extraSafety = themeSafetyNote(theme.slug, theme.name, theme.description, theme.headline, theme.prompt);
  const relevance = relevanceInstruction(theme.name);
  if (compactPrompts) {
    return [
      "Photorealistic square Aidreamcapes motion-theme poster.",
      `Theme: ${theme.name}. ${theme.description ?? theme.headline ?? theme.prompt ?? ""}`,
      relevance,
      extraSafety,
      "Create one original private-album preview image with clean faces, natural hands, polished fan-scene or holiday mood, and subtle motion-ready depth.",
      "No text, logos, watermarks, UI, official marks, brand marks, public figures, celebrity likenesses, protected characters, or readable signage."
    ].filter(Boolean).join("\n");
  }
  return [
    "Use case: photorealistic-natural",
    "Asset type: square motion-theme poster image for Aidreamcapes.",
    `Primary request: create one poster image for the motion theme "${theme.name}".`,
    `Motion direction: ${theme.prompt ?? theme.description ?? theme.headline ?? theme.name}.`,
    relevance,
    extraSafety,
    "Composition: one finished square image with subtle motion-ready depth, no video controls, no UI, no text, polished private-album preview mood.",
    "Style: realistic editorial photography, clear subject, tasteful atmosphere, clean hands, natural faces, premium storefront poster crop.",
    compliancePrompt
  ].filter(Boolean).join("\n");
}

function buildSelection(state) {
  const allCategories = (state.creativePackCategories ?? [])
    .filter((category) => category.siteId === siteId && category.status !== "inactive")
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
  const categoryById = new Map(allCategories.map((category) => [category.id, category]));
  const categories = allCategories.map((category) => ({
    ...category,
    parent: category.parent ?? (category.parentId ? categoryById.get(category.parentId) : undefined)
  }));
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const childSlugsByParentSlug = new Map();
  for (const category of categories) {
    const parentSlug = category.parent?.slug;
    if (!parentSlug) continue;
    const childSlugs = childSlugsByParentSlug.get(parentSlug) ?? [];
    childSlugs.push(category.slug);
    childSlugsByParentSlug.set(parentSlug, childSlugs);
  }

  const allPacks = (state.creativePacks ?? [])
    .filter((pack) => pack.siteId === siteId && pack.status !== "inactive")
    .map((pack) => ({ ...pack, slug: packSlug(pack) }))
    .sort((left, right) => (left.createdAt ?? "").localeCompare(right.createdAt ?? ""));
  const packBySlug = new Map(allPacks.map((pack) => [pack.slug, pack]));

  let categorySlugs = new Set(categories.map((category) => category.slug));
  let packSlugs = new Set(allPacks.map((pack) => pack.slug));
  if (selectedSlugs.size) {
    categorySlugs = new Set();
    packSlugs = new Set();
    for (const slug of selectedSlugs) {
      const category = categoryBySlug.get(slug);
      const pack = packBySlug.get(slug);
      if (category) {
        categorySlugs.add(category.slug);
        const childSlugs = childSlugsByParentSlug.get(category.slug) ?? [];
        childSlugs.forEach((childSlug) => categorySlugs.add(childSlug));
        for (const candidate of allPacks) {
          if (candidate.category === category.slug || childSlugs.includes(candidate.category)) packSlugs.add(candidate.slug);
        }
      }
      if (pack) {
        packSlugs.add(pack.slug);
        if (pack.category) {
          categorySlugs.add(pack.category);
          const categoryRow = categoryBySlug.get(pack.category);
          if (categoryRow?.parent?.slug) categorySlugs.add(categoryRow.parent.slug);
        }
      }
    }
  }

  const selectedPacks = allPacks.filter((pack) => packSlugs.has(pack.slug)).slice(0, packLimit || undefined);
  for (const pack of selectedPacks) {
    if (!pack.category) continue;
    categorySlugs.add(pack.category);
    const category = categoryBySlug.get(pack.category);
    if (category?.parent?.slug) categorySlugs.add(category.parent.slug);
  }
  const selectedCategories = categories.filter((category) => categorySlugs.has(category.slug));
  const selectedVideoThemes = (state.videoThemes ?? [])
    .filter((theme) => theme.siteId === siteId && theme.status !== "inactive")
    .filter((theme) => !selectedSlugs.size || selectedSlugs.has(theme.slug) || selectedPacks.some((pack) => String(theme.prompt ?? "").includes(pack.name) || theme.imageUrl?.includes(pack.slug)));

  return { categories: selectedCategories, packs: selectedPacks, videoThemes: selectedVideoThemes, categoryBySlug };
}

async function prepareReferenceImage(filePath) {
  if (!filePath || !await fileExists(filePath)) throw new Error(`missing_reference_image:${filePath || "none"}`);
  const buffer = await fs.readFile(filePath);
  return await sharp(buffer)
    .rotate()
    .resize(1024, 1024, { fit: "cover" })
    .png()
    .toBuffer();
}

async function generateImageBuffer(provider, prompt, key, referenceImagePath) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = useEditEndpoint
        ? await fetch(`${provider.baseUrl}/images/edits`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${provider.apiKey}`,
              "Idempotency-Key": `aidreamcapes:${siteId}:${key}:${requestSalt}`.slice(0, 180)
            },
            dispatcher: fetchDispatcher,
            signal: controller.signal,
            body: await imageEditForm(prompt, referenceImagePath)
          })
        : await fetch(`${provider.baseUrl}/images/generations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${provider.apiKey}`,
              "Idempotency-Key": `aidreamcapes:${siteId}:${key}:${requestSalt}`.slice(0, 180)
            },
            dispatcher: fetchDispatcher,
            signal: controller.signal,
            body: JSON.stringify({
              model: provider.model,
              prompt,
              size: imageSize,
              quality: imageQuality,
              response_format: "b64_json"
            })
          });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`${key}:provider_failed:${response.status}:${JSON.stringify(body).slice(0, 600)}`);
      }
      const b64 = imageBase64(body);
      if (b64) return Buffer.from(b64, "base64");
      const url = imageUrlFromBody(body);
      if (url) {
        await saveProviderRecovery(key, body, String(url));
        return await imageBufferFromUrl(String(url));
      }
      throw new Error(`${key}:empty_image_payload`);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts) break;
      console.warn(`${key}: paid create attempt ${attempt} failed; retrying once because --attempts=${maxAttempts}`);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${key}:provider_generation_failed`);
}

async function imageEditForm(prompt, referenceImagePath) {
  const reference = await prepareReferenceImage(referenceImagePath);
  const form = new FormData();
  form.append("model", model);
  form.append("prompt", [
    prompt,
    "Reference image use: use the uploaded image only as a loose style and theme anchor. Replace any off-theme subject, prop, setting, age cue, or composition. The final image must satisfy the written theme relevance gate."
  ].join("\n"));
  form.append("size", imageSize);
  form.append("quality", imageQuality);
  form.append("response_format", "b64_json");
  form.append("image", new Blob([reference], { type: "image/png" }), `${path.basename(referenceImagePath, path.extname(referenceImagePath))}.png`);
  return form;
}

async function writeWebp(filePath, buffer, { width = 1280, height = 960 } = {}) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await sharp(buffer)
    .rotate()
    .resize(width, height, { fit: "cover" })
    .sharpen({ sigma: 0.35 })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(filePath);
}

async function cropContactSheet(buffer, outputFiles) {
  const source = sharp(buffer);
  const metadata = await source.metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;
  const cols = 2;
  const rows = 2;
  const cellW = Math.floor(width / cols);
  const cellH = Math.floor(height / rows);
  const insetX = Math.max(10, Math.floor(cellW * 0.035));
  const insetY = Math.max(10, Math.floor(cellH * 0.035));
  for (let index = 0; index < outputFiles.length; index += 1) {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const left = Math.min(width - 1, col * cellW + insetX);
    const top = Math.min(height - 1, row * cellH + insetY);
    const extractWidth = Math.max(96, Math.min(cellW - insetX * 2, width - left));
    const extractHeight = Math.max(96, Math.min(cellH - insetY * 2, height - top));
    await fs.mkdir(path.dirname(outputFiles[index]), { recursive: true });
    await sharp(buffer)
      .extract({ left, top, width: extractWidth, height: extractHeight })
      .resize(1280, 960, { fit: "cover" })
      .sharpen({ sigma: 0.35 })
      .webp({ quality: 92, smartSubsample: true })
      .toFile(outputFiles[index]);
  }
}

async function savePrompt(task) {
  if (!savePrompts) return;
  const promptDir = path.join(localAssetRoot, "_prompts");
  await fs.mkdir(promptDir, { recursive: true });
  await fs.writeFile(path.join(promptDir, `${task.key}.txt`), task.prompt);
}

function categoryTask(category) {
  return {
    kind: "single",
    assetType: "categories",
    key: `category-${category.slug}`,
    output: localPathFromPublicUrl(category.imageUrl || publicUrl("categories", category.slug)),
    referenceImage: optionalLocalPathFromPublicUrl(category.imageUrl),
    prompt: categoryPrompt(category),
    width: 1280,
    height: 960
  };
}

function packCoverTask(pack, category) {
  return {
    kind: "single",
    assetType: "covers",
    key: `cover-${pack.slug}`,
    output: localPathFromPublicUrl(pack.imageUrl || publicUrl("covers", pack.slug)),
    referenceImage: optionalLocalPathFromPublicUrl(category?.imageUrl) ?? optionalLocalPathFromPublicUrl(pack.imageUrl),
    prompt: packCoverPrompt(pack, category),
    width: 1280,
    height: 960
  };
}

function gallerySheetTask(pack, category, sheetIndex) {
  const start = sheetIndex * 4;
  const outputFiles = Array.from({ length: 4 }, (_, index) => {
    const galleryUrl = pack.galleryImages?.[start + index] || publicUrl("gallery", `${pack.slug}-${String(start + index + 1).padStart(2, "0")}`);
    return localPathFromPublicUrl(galleryUrl);
  });
  return {
    kind: "gallery-sheet",
    assetType: "gallery",
    key: `gallery-${pack.slug}-sheet-${sheetIndex + 1}`,
    outputFiles,
    referenceImage: optionalLocalPathFromPublicUrl(category?.imageUrl) ?? optionalLocalPathFromPublicUrl(pack.imageUrl),
    prompt: gallerySheetPrompt(pack, category, sheetIndex),
    sheetPath: path.join(localAssetRoot, "_sheets", `${pack.slug}-sheet-${sheetIndex + 1}.png`)
  };
}

function posterTask(theme) {
  return {
    kind: "single",
    assetType: "posters",
    key: `poster-${theme.slug}`,
    output: localPathFromPublicUrl(theme.imageUrl || publicUrl("posters", theme.slug)),
    referenceImage: optionalLocalPathFromPublicUrl(theme.imageUrl),
    prompt: posterPrompt(theme),
    width: 960,
    height: 960
  };
}

function copyTask(source, target, key) {
  return { kind: "copy", assetType: "showcase", key, source, target };
}

async function taskNeedsPaidCreate(task) {
  if (task.kind === "copy") return false;
  if (force) return true;
  if (task.kind === "gallery-sheet") {
    const existing = await Promise.all(task.outputFiles.map((filePath) => fileExists(filePath)));
    return !existing.every(Boolean);
  }
  return !(await fileExists(task.output));
}

async function runPaidTask(task, provider) {
  await savePrompt(task);
  const buffer = await generateImageBuffer(provider, task.prompt, task.key, task.referenceImage);
  if (task.kind === "gallery-sheet") {
    if (saveSheets) {
      await fs.mkdir(path.dirname(task.sheetPath), { recursive: true });
      await fs.writeFile(task.sheetPath, buffer);
    }
    await cropContactSheet(buffer, task.outputFiles);
    return task.outputFiles;
  }
  await writeWebp(task.output, buffer, { width: task.width, height: task.height });
  return [task.output];
}

async function runCopyTask(task) {
  if (!force && await fileExists(task.target)) {
    return { skipped: true, files: [task.target] };
  }
  if (!await fileExists(task.source)) throw new Error(`copy_source_missing:${task.source}`);
  await fs.mkdir(path.dirname(task.target), { recursive: true });
  await fs.copyFile(task.source, task.target);
  return { skipped: false, files: [task.target] };
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
  await Promise.all(Array.from({ length: Math.min(workerCount, Math.max(1, items.length)) }, () => worker()));
  return results;
}

async function buildTasks() {
  const state = await readState();
  const selection = buildSelection(state);
  const tasks = [];
  if (enabledAssetTypes.has("categories")) {
    for (const category of selection.categories) tasks.push(categoryTask(category));
  }
  if (enabledAssetTypes.has("covers")) {
    for (const pack of selection.packs) tasks.push(packCoverTask(pack, selection.categoryBySlug.get(pack.category)));
  }
  if (enabledAssetTypes.has("gallery")) {
    for (const pack of selection.packs) {
      const category = selection.categoryBySlug.get(pack.category);
      const sheetNumbers = selectedGallerySheets.size ? Array.from(selectedGallerySheets).sort((left, right) => left - right) : [1, 2, 3];
      for (const sheetNumber of sheetNumbers) tasks.push(gallerySheetTask(pack, category, sheetNumber - 1));
    }
  }
  if (enabledAssetTypes.has("posters")) {
    for (const theme of selection.videoThemes) tasks.push(posterTask(theme));
  }
  if (enabledAssetTypes.has("showcase")) {
    for (const category of selection.categories.filter((item) => !item.parentId)) {
      const source = localPathFromPublicUrl(category.imageUrl || publicUrl("categories", category.slug));
      tasks.push(copyTask(source, localAsset("images", category.slug), `image-copy-${category.slug}`));
      tasks.push(copyTask(source, localAsset("showcase", category.slug), `showcase-copy-${category.slug}`));
    }
  }
  return { tasks, selection };
}

async function main() {
  const { tasks, selection } = await buildTasks();
  const payable = [];
  for (const task of tasks) {
    if (await taskNeedsPaidCreate(task)) payable.push(task);
  }
  console.log(JSON.stringify({
    dryRun,
    force,
    selected: {
      categories: selection.categories.length,
      packs: selection.packs.length,
      videoThemes: selection.videoThemes.length
    },
    assetTypes: Array.from(enabledAssetTypes),
    tasks: tasks.length,
    paidCreatesNeeded: payable.length,
    maxPaidCreates,
    concurrency,
    attemptsPerPaidCreate: maxAttempts,
    providerModel: model,
    providerEndpoint: useEditEndpoint ? "images/edits" : "images/generations",
    imageSize,
    imageQuality
  }, null, 2));
  if (dryRun) return;
  if (payable.length > maxPaidCreates) {
    throw new Error(`paid_create_cap_exceeded:needed=${payable.length}:cap=${maxPaidCreates}. Re-run with an explicit --max-paid-creates cap after reviewing the count.`);
  }

  const provider = payable.length ? await loadProvider() : undefined;
  if (provider) {
    console.log(`paid provider plan: POST ${provider.baseUrl}/${useEditEndpoint ? "images/edits" : "images/generations"} model=${provider.model} quality=${imageQuality} size=${imageSize} maxPaidCreates=${maxPaidCreates} attemptsPerCreate=${maxAttempts} stopOnFirstError=true`);
    console.log(`using platform AI provider: ${provider.label} (${provider.model})`);
  }

  let paidCreates = 0;
  let skipped = 0;
  const generatedFiles = [];
  const providerTasks = tasks.filter((task) => task.kind !== "copy");
  const copyTasks = tasks.filter((task) => task.kind === "copy");
  await mapLimit(providerTasks, concurrency, async (task) => {
    if (!await taskNeedsPaidCreate(task)) {
      skipped += 1;
      return;
    }
    if (!provider) throw new Error("provider_not_loaded_for_paid_task");
    paidCreates += 1;
    console.log(`generating ${task.key} (${paidCreates}/${payable.length})`);
    generatedFiles.push(...await runPaidTask(task, provider));
  });
  for (const task of copyTasks) {
    const result = await runCopyTask(task);
    if (result.skipped) skipped += 1;
    generatedFiles.push(...result.files);
  }

  console.log(JSON.stringify({
    ok: true,
    paidCreates,
    skipped,
    generatedFiles: generatedFiles.length
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
