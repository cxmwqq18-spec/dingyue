#!/usr/bin/env node
import fs from "fs/promises";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });
loadEnv();

const prisma = new PrismaClient();
const siteId = process.env.PACK_IMAGE_SITE_ID ?? "site_dreamshoot";
const outDir = process.env.PACK_IMAGE_OUT_DIR ?? "public/assets/dreamshoot/generated/packs";
const publicPrefix = process.env.PACK_IMAGE_PUBLIC_PREFIX ?? "/assets/dreamshoot/generated/packs";
const model = process.env.PACK_IMAGE_MODEL ?? "gpt-image-2";
const size = process.env.PACK_IMAGE_SIZE ?? "1024x1024";
const quality = process.env.PACK_IMAGE_QUALITY ?? "low";
const limit = Number(process.env.PACK_IMAGE_LIMIT ?? 8);
const force = process.env.PACK_IMAGE_FORCE === "true";
const preferPlatformProvider = process.env.PACK_IMAGE_USE_PLATFORM_PROVIDER !== "false";
let baseUrl = normalizeBaseUrl(process.env.IMAGE_API_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "");
let apiKey = process.env.IMAGE_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

const categoryDirections = {
  headshots: "premium professional headshot portrait, refined studio lighting, clean business styling",
  sports: "football fan portrait in a stadium, match-day atmosphere, energetic sports editorial",
  beauty: "beauty portrait with polished hair styling, soft editorial lighting, refined makeup",
  creative: "cinematic themed portrait, dramatic fashion styling, premium editorial scene",
  creator: "creator lifestyle portrait for social profile and personal brand",
  avatar: "stylized avatar portrait, polished character look, social profile ready",
  wedding: "romantic wedding-inspired portrait, soft ceremony light, elegant styling",
  couple: "couple portrait with cinematic lifestyle lighting",
  travel: "destination travel portrait, scenic background, premium vacation editorial",
  seasonal: "seasonal portrait scene with tasteful festive styling",
  video: "motion-ready cinematic portrait frame, dynamic composition",
  utility: "clean utility preview image for AI photo tools",
  fashion: "fashion editorial portrait, magazine lighting, refined wardrobe",
  boudoir: "tasteful intimate portrait, elegant private studio mood",
  cultural: "cultural celebration portrait, respectful styling and rich textiles",
  copy: "conceptual image for AI copy and creative planning tools"
};

function normalizeBaseUrl(url) {
  const trimmed = url.replace(/\/$/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`;
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function promptForPack(pack) {
  const direction = categoryDirections[pack.category] ?? categoryDirections.creative;
  const themePrompt = pack.prompt?.trim()
    ? pack.prompt
        .replace(/^Using the uploaded reference photo,?\s*/i, "")
        .replace(/^Using the uploaded reference photo or finished package image,?\s*/i, "")
        .replace(/^Enhance the uploaded image while\s*/i, "Create an image that visually communicates enhanced image quality while ")
        .trim()
    : "";
  return [
    "Use case: photorealistic-natural",
    "Asset type: square product catalogue cover image for an AI photo package card",
    `Primary request: create a premium cover image for the DreamShootAI package named \"${pack.name}\".`,
    `Package description: ${pack.description}`,
    themePrompt ? `Theme prompt reference: ${themePrompt}` : "",
    `Visual direction: ${direction}.`,
    "Composition: one photorealistic human-centered portrait or lifestyle scene, strong thumbnail readability, subject framed with generous safe space, polished premium AI photo subscription aesthetic.",
    "Style: realistic editorial photography, high-end commercial quality, tasteful, modern, no collage, no UI, no logos.",
    "Avoid: text, captions, watermarks, distorted hands, extra limbs, uncanny faces, over-saturated generic gradients, duplicated subjects."
  ].filter(Boolean).join("\n");
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json ?? body?.data?.[0]?.image_base64 ?? body?.output?.[0]?.b64_json ?? body?.output?.[0]?.image_base64 ?? body?.image_base64;
}

async function generateImage(pack, outPath) {
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      prompt: promptForPack(pack),
      size,
      quality,
      response_format: "b64_json"
    })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${pack.name}: image generation failed ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  }
  const b64 = imagePayload(body);
  if (!b64) throw new Error(`${pack.name}: empty image payload`);
  await fs.writeFile(outPath, Buffer.from(b64, "base64"));
}

async function exists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function main() {
  await loadPreferredProviderWhenNeeded();
  if (!baseUrl || !apiKey) throw new Error("Missing IMAGE_API_BASE_URL/IMAGE_API_KEY, OPENAI_BASE_URL/OPENAI_API_KEY, and preferred platform AI provider");
  await fs.mkdir(outDir, { recursive: true });
  const packs = await prisma.creativePack.findMany({
    where: { siteId, status: "active" },
    orderBy: { createdAt: "asc" }
  });
  const selected = packs
    .filter((pack) => force || !pack.imageUrl)
    .slice(0, Math.max(1, limit));
  const results = [];
  for (const pack of selected) {
    const filename = `${slugify(pack.name)}-${pack.id.replace(/^pack_/, "")}.png`;
    const outPath = path.join(outDir, filename);
    const publicPath = `${publicPrefix}/${filename}`;
    const skipped = !force && (await exists(outPath));
    if (!skipped) {
      console.log(`generating: ${pack.name}`);
      await generateImage(pack, outPath);
    }
    if (!(await exists(outPath))) {
      throw new Error(`${pack.name}: local image was not created, refusing to write database URL`);
    }
    await prisma.creativePack.update({
      where: { id: pack.id },
      data: { imageUrl: publicPath }
    });
    results.push({ id: pack.id, name: pack.name, imageUrl: publicPath, skipped });
    console.log(`${skipped ? "linked" : "generated"}: ${pack.name} -> ${publicPath}`);
  }
  console.log(JSON.stringify({ count: results.length, results }, null, 2));
}

async function loadPreferredProviderWhenNeeded() {
  if (!preferPlatformProvider && baseUrl && apiKey) return;
  const provider = await prisma.platformAiProvider.findFirst({
    where: { modelType: model },
    orderBy: [{ preferred: "desc" }, { priority: "asc" }, { createdAt: "asc" }]
  });
  if (!provider) return;
  baseUrl = normalizeBaseUrl(provider.aiUrl) || baseUrl;
  apiKey = provider.apiKey ?? apiKey;
  if (baseUrl && apiKey) {
    console.log(`using platform AI provider: ${provider.label} (${provider.modelType})`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
