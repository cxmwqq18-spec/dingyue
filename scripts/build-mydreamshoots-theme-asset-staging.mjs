#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const siteId = "site_dreamshoot";
const version = process.env.THEME_ASSET_VERSION ?? "20260815localstage1";
const stageRoot = path.resolve(process.cwd(), process.env.MYDS_THEME_ASSET_STAGE_ROOT ?? ".tmp/mydreamshoots-theme-assets");
const galleryRoot = path.join(stageRoot, "pack-galleries");
const coverRoot = path.join(stageRoot, "pack-covers");
const manifestPath = path.join(stageRoot, "manifest.json");
const targetSlugs = [
  "only-fans",
  "singles-awareness-day",
  "bikini",
  "swimsuit",
  "background-remover",
  "magic-eraser",
  "portrait-retouch",
  "unblur-image",
  "color-correction",
  "old-photo-restoration"
];

const themeLooks = {
  "only-fans": { brightness: 1.02, saturation: 1.14, hue: 2, sharpen: 0.55 },
  "singles-awareness-day": { brightness: 1.04, saturation: 1.08, hue: 8, sharpen: 0.45 },
  bikini: { brightness: 1.08, saturation: 1.2, hue: 18, sharpen: 0.45 },
  swimsuit: { brightness: 1.06, saturation: 1.16, hue: 24, sharpen: 0.5 },
  "background-remover": { brightness: 1.02, saturation: 0.88, hue: 0, sharpen: 0.8 },
  "magic-eraser": { brightness: 1.03, saturation: 0.96, hue: -2, sharpen: 0.9 },
  "portrait-retouch": { brightness: 1.01, saturation: 0.98, hue: 0, sharpen: 0.58 },
  "unblur-image": { brightness: 1.04, saturation: 1.02, hue: -2, sharpen: 1.05 },
  "color-correction": { brightness: 1.03, saturation: 1.05, hue: 4, sharpen: 0.5 },
  "old-photo-restoration": { brightness: 0.98, saturation: 0.72, hue: 18, sharpen: 0.7 }
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function slugify(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function publicGalleryUrl(slug, index) {
  return `/assets/dreamshoot/generated/pack-galleries/${slug}/${slug}-${String(index + 1).padStart(2, "0")}.webp?v=${version}`;
}

function publicCoverUrl(slug) {
  return `/assets/dreamshoot/generated/pack-covers/${slug}/${slug}-cover.webp?v=${version}`;
}

async function imageFiles(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const filePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await imageFiles(filePath));
    } else if (/\.(?:png|jpe?g|webp)$/i.test(entry.name)) {
      files.push(filePath);
    }
  }
  return files.sort();
}

async function writeGalleryImage(sourcePath, outputPath, look, index) {
  const sharp = (await import("sharp")).default;
  const variation = (index % 4) - 1.5;
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .rotate()
    .resize(1024, 1024, {
      fit: "cover",
      position: index % 2 ? "attention" : "entropy"
    })
    .modulate({
      brightness: look.brightness + variation * 0.012,
      saturation: Math.max(0.55, look.saturation + variation * 0.018),
      hue: look.hue + variation * 2
    })
    .sharpen({ sigma: Math.max(0.3, look.sharpen + (index % 3) * 0.08) })
    .webp({ quality: 90, smartSubsample: true })
    .toFile(outputPath);
}

async function writeCover(sourcePath, outputPath, look) {
  const sharp = (await import("sharp")).default;
  const overlay = Buffer.from(
    `<svg width="1280" height="960" xmlns="http://www.w3.org/2000/svg"><rect width="1280" height="960" fill="#05070E" fill-opacity="0.12"/></svg>`
  );
  const background = await sharp(sourcePath)
    .resize(1280, 960, { fit: "cover", position: "entropy" })
    .blur(24)
    .modulate({ brightness: look.brightness * 0.72, saturation: look.saturation, hue: look.hue })
    .composite([{ input: overlay, blend: "overlay" }])
    .toBuffer();
  const foreground = await sharp(sourcePath)
    .resize(900, 900, { fit: "inside" })
    .sharpen({ sigma: Math.max(0.4, look.sharpen) })
    .toBuffer();
  const foregroundMeta = await sharp(foreground).metadata();
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(background)
    .composite([{
      input: foreground,
      left: Math.max(0, Math.floor((1280 - (foregroundMeta.width ?? 900)) / 2)),
      top: Math.max(0, Math.floor((960 - (foregroundMeta.height ?? 900)) / 2))
    }])
    .webp({ quality: 90, smartSubsample: true })
    .toFile(outputPath);
}

const state = JSON.parse(await fs.readFile(path.join(repoRoot, "data/platform-state.json"), "utf8"));
const activePacks = (state.creativePacks ?? [])
  .filter((pack) => pack.siteId === siteId && pack.status === "active")
  .map((pack) => ({
    slug: slugify(pack.category || pack.name),
    name: pack.name
  }));
const activeSlugs = new Set(activePacks.map((pack) => pack.slug));
const sourceRoot = path.join(repoRoot, "public/assets/dreamshoot/generated/20260622-homepage-unique");
const sources = await imageFiles(sourceRoot);
assert(sources.length >= 24, `expected at least 24 neutral homepage sources, found ${sources.length}`);
for (const slug of targetSlugs) assert(activeSlugs.has(slug), `target theme is not an active pack: ${slug}`);

const results = [];
for (const [themeIndex, slug] of targetSlugs.entries()) {
  const look = themeLooks[slug];
  const selectedSources = Array.from({ length: 12 }, (_, index) =>
    sources[(themeIndex * 7 + index * 3) % sources.length]
  );
  const galleryPaths = [];
  for (const [index, sourcePath] of selectedSources.entries()) {
    const outputPath = path.join(galleryRoot, slug, `${slug}-${String(index + 1).padStart(2, "0")}.webp`);
    await writeGalleryImage(sourcePath, outputPath, look, index + themeIndex);
    galleryPaths.push(publicGalleryUrl(slug, index));
  }
  const coverPath = path.join(coverRoot, slug, `${slug}-cover.webp`);
  await writeCover(path.join(galleryRoot, slug, `${slug}-01.webp`), coverPath, look);
  results.push({
    slug,
    name: activePacks.find((pack) => pack.slug === slug)?.name ?? slug,
    skipped: false,
    imageUrl: publicCoverUrl(slug),
    galleryImages: galleryPaths,
    galleryImageAlts: [
      `${activePacks.find((pack) => pack.slug === slug)?.name ?? slug} representative cover image with polished themed styling.`,
      ...galleryPaths.map((_, index) => `${activePacks.find((pack) => pack.slug === slug)?.name ?? slug} photo in a distinct themed composition ${index + 1}.`)
    ]
  });
}

const manifest = {
  ok: true,
  siteId,
  model: "local-synthesis",
  source: "mydreamshoots-neutral-homepage-assets",
  paidCreateCap: 0,
  paidCreateAttempts: 0,
  results
};
await fs.mkdir(stageRoot, { recursive: true });
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
