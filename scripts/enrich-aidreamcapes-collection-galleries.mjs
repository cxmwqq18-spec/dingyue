#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const workspaceRoot = process.cwd();
const siteId = "site_aidreamcapes";
const assetRoot = path.join(workspaceRoot, "public", "assets", "sites", siteId, "creative-packs");
const galleryRoot = path.join(assetRoot, "pack-galleries");
const publicPrefix = "/assets/sites/site_aidreamcapes/creative-packs/pack-galleries";
const publicVersion = "20260715a";
const gallerySize = 1024;
const galleryCount = 12;

const sourceProfiles = {
  "route-portrait-albums": ["route-portrait-albums-cover", "route-portrait-albums-category", "destination-story", "mountain-trails", "old-quarter-walks-cover", "scenic-overlooks-cover"],
  "coastal-light-sets": ["coastal-light-sets-cover", "coastal-light-sets-category", "coastal-getaways-v2", "lagoon-route-studies-cover", "island-resort-scenes-cover"],
  "old-quarter-walks": ["old-quarter-walks-cover", "old-quarter-walks-category", "cafe-street-stories-cover", "market-morning-walks-cover", "rainy-city-breaks-cover", "rooftop-city-nights-cover"],
  "island-resort-scenes": ["island-resort-scenes-cover", "island-resort-scenes-category", "island-resort-scenes-v2", "private-villa-stays-cover", "lagoon-route-studies-cover", "coastal-light-sets-cover"],
  "cafe-street-stories": ["cafe-street-stories-cover", "cafe-street-stories-category", "cafe-street-story-studio", "market-morning-walks-cover", "old-quarter-walks-cover", "rainy-city-breaks-cover"],
  "scenic-overlooks": ["scenic-overlooks-cover", "scenic-overlooks-category", "scenic-overlooks-v2", "golden-hour-route-stories-cover", "route-portrait-albums-cover", "coastal-light-sets-cover"],
  "alpine-trail-frames": ["alpine-trail-frames-cover", "alpine-trail-frames-category", "mountain-trails", "snow-lodge-escapes-cover", "lake-house-weekends-cover", "road-trip-frames-cover"],
  "road-trip-frames": ["road-trip-frames-cover", "road-trip-frames-category", "road-trip-frames-v2", "desert-road-stories-cover", "mountain-trails", "golden-hour-route-stories-cover"],
  "route-moodboards": ["route-moodboards-cover", "route-moodboards-category", "itinerary-moodboards-v2", "travel-journal-covers-cover", "postcard-story-sets-cover", "destination-story"],
  "postcard-story-sets": ["postcard-story-sets-cover", "postcard-story-sets-category", "postcard-social-sets-v2", "postcard-journey", "travel-journal-covers-cover", "solo-traveler-profiles-cover"],
  "lagoon-route-studies": ["lagoon-route-studies-cover", "lagoon-route-studies-category", "coastal-light-sets-cover", "coastal-getaways-v2", "island-resort-scenes-cover", "private-villa-stays-cover"],
  "private-villa-stays": ["private-villa-stays-cover", "private-villa-stays-category", "island-resort-scenes-cover", "wellness-retreat-scenes-cover", "lagoon-route-studies-cover", "destination-story"],
  "rooftop-city-nights": ["rooftop-city-nights-cover", "rooftop-city-nights-category", "old-quarter-walks-cover", "scenic-overlooks-cover", "golden-hour-route-stories-cover", "rainy-city-breaks-cover"],
  "market-morning-walks": ["market-morning-walks-cover", "market-morning-walks-category", "cafe-street-stories-cover", "old-quarter-walks-cover", "cafe-street-story-studio", "postcard-story-sets-cover"],
  "rainy-city-breaks": ["rainy-city-breaks-cover", "rainy-city-breaks-category", "old-quarter-walks-cover", "rooftop-city-nights-cover", "cafe-street-stories-cover", "scenic-overlooks-cover"],
  "desert-road-stories": ["desert-road-stories-cover", "desert-road-stories-category", "road-trip-frames-cover", "road-trip-frames-v2", "golden-hour-route-stories-cover", "mountain-trails"],
  "lake-house-weekends": ["lake-house-weekends-cover", "lake-house-weekends-category", "alpine-trail-frames-cover", "wellness-retreat-scenes-cover", "family-travel-keepsakes-cover", "shared-route-albums-cover"],
  "snow-lodge-escapes": ["snow-lodge-escapes-cover", "snow-lodge-escapes-category", "alpine-trail-frames-cover", "lake-house-weekends-cover", "wellness-retreat-scenes-cover", "mountain-trails"],
  "rail-journey-portraits": ["rail-journey-portraits-cover", "rail-journey-portraits-category", "travel-journal-covers-cover", "route-moodboards-cover", "old-quarter-walks-cover", "postcard-story-sets-cover"],
  "travel-journal-covers": ["travel-journal-covers-cover", "travel-journal-covers-category", "postcard-story-sets-cover", "route-moodboards-cover", "solo-traveler-profiles-cover", "editorial-getaways"],
  "solo-traveler-profiles": ["solo-traveler-profiles-cover", "solo-traveler-profiles-category", "editorial-getaways", "storybook-headshots", "route-portrait-albums-cover", "travel-journal-covers-cover"],
  "shared-route-albums": ["shared-route-albums-cover", "shared-route-albums-category", "golden-hour-route-stories-cover", "coastal-light-sets-cover", "scenic-overlooks-cover", "rooftop-city-nights-cover"],
  "family-travel-keepsakes": ["family-travel-keepsakes-cover", "family-travel-keepsakes-category", "shared-route-albums-cover", "lake-house-weekends-cover", "island-resort-scenes-cover", "postcard-story-sets-cover"],
  "golden-hour-route-stories": ["golden-hour-route-stories-cover", "golden-hour-route-stories-category", "scenic-overlooks-cover", "desert-road-stories-cover", "road-trip-frames-cover", "shared-route-albums-cover"],
  "wellness-retreat-scenes": ["wellness-retreat-scenes-cover", "wellness-retreat-scenes-category", "private-villa-stays-cover", "lake-house-weekends-cover", "island-resort-scenes-cover", "lagoon-route-studies-cover"]
};

const fallbackSources = [
  "route-portrait-albums-cover",
  "route-portrait-albums-category",
  "destination-story",
  "mountain-trails",
  "coastal-light-sets-cover",
  "old-quarter-walks-cover",
  "scenic-overlooks-cover",
  "postcard-story-sets-cover"
];

const cropPositions = [
  "centre",
  "north",
  "south",
  "east",
  "west",
  "northeast",
  "northwest",
  "southeast",
  "southwest",
  "centre",
  "north",
  "south"
];

const modulations = [
  { brightness: 1, saturation: 1.02 },
  { brightness: 1.03, saturation: 1 },
  { brightness: 0.98, saturation: 1.05 },
  { brightness: 1.01, saturation: 0.98 },
  { brightness: 1.04, saturation: 1.04 },
  { brightness: 0.99, saturation: 1.01 }
];

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
  const subject = String(pack.description || pack.headline || pack.name)
    .replace(/\s+/g, " ")
    .trim() || `${pack.name} travel portrait album`;
  return `${subject}, ${galleryAltScenes[index % galleryAltScenes.length]}, ${pack.name} gallery example for AIdreamcapes.`;
}

function galleryImageAltsForPack(pack, slug, count) {
  return Array.from({ length: count }, (_, index) => galleryImageAltForPack(pack, slug, index));
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function galleryPublicPaths(slug) {
  return Array.from({ length: galleryCount }, (_, index) => {
    const slot = String(index + 1).padStart(2, "0");
    return `${publicPrefix}/${slug}/${slug}-${slot}.webp?v=${publicVersion}`;
  });
}

async function firstExistingSource(stem) {
  for (const ext of [".webp", ".png", ".jpg", ".jpeg"]) {
    const filePath = path.join(assetRoot, `${stem}${ext}`);
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile() && stat.size > 0) return filePath;
    } catch {
      // Try the next extension.
    }
  }
  return "";
}

async function sourceFilesForPack(pack) {
  const slug = pack.category || slugify(pack.name);
  const stems = unique([
    `${slug}-cover`,
    `${slug}-category`,
    slug,
    ...(sourceProfiles[slug] ?? []),
    ...fallbackSources
  ]);
  const files = [];
  for (const stem of stems) {
    const filePath = await firstExistingSource(stem);
    if (filePath) files.push(filePath);
  }
  return unique(files);
}

async function generateGalleryForPack(pack) {
  const sharp = (await import("sharp")).default;
  const slug = pack.category || slugify(pack.name);
  const sources = await sourceFilesForPack(pack);
  if (!sources.length) throw new Error(`${pack.id}: no source images found for ${slug}`);
  const outputDir = path.join(galleryRoot, slug);
  await fs.mkdir(outputDir, { recursive: true });

  for (let index = 0; index < galleryCount; index += 1) {
    const slot = String(index + 1).padStart(2, "0");
    const sourcePath = sources[index % sources.length];
    const modulation = modulations[index % modulations.length];
    await sharp(sourcePath, { animated: false })
      .resize(gallerySize, gallerySize, {
        fit: "cover",
        position: cropPositions[index % cropPositions.length]
      })
      .modulate(modulation)
      .sharpen({ sigma: 0.6 })
      .webp({ quality: 92, smartSubsample: true })
      .toFile(path.join(outputDir, `${slug}-${slot}.webp`));
  }

	  return {
	    id: pack.id,
	    name: pack.name,
	    slug,
	    sourceCount: sources.length,
	    galleryImages: galleryPublicPaths(slug),
	    galleryImageAlts: galleryImageAltsForPack(pack, slug, galleryCount)
	  };
	}

async function updateStateFile(resultsById) {
  const state = await readPlatformStateFromSql();
  let updated = 0;
  state.creativePacks = (state.creativePacks ?? []).map((pack) => {
    const result = resultsById.get(pack.id);
    if (!result) return pack;
    updated += 1;
	    return {
	      ...pack,
	      galleryImages: result.galleryImages,
	      galleryImageAlts: result.galleryImageAlts
	    };
  });
  await writePlatformStateToSql(state);
  return updated;
}

async function updatePrisma(resultsById) {
  const prisma = new PrismaClient();
  try {
    let updated = 0;
    for (const result of resultsById.values()) {
      const response = await prisma.creativePack.updateMany({
        where: { id: result.id, siteId },
	        data: { galleryImages: result.galleryImages, galleryImageAlts: result.galleryImageAlts }
      });
      updated += response.count;
    }
    return updated;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const state = await readPlatformStateFromSql();
  const packs = (state.creativePacks ?? [])
    .filter((pack) => pack.siteId === siteId && pack.status === "active")
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  if (!packs.length) throw new Error(`No active creative packs found for ${siteId}`);

  const results = [];
  for (const pack of packs) {
    const result = await generateGalleryForPack(pack);
    results.push(result);
    console.log(`${result.slug}: wrote ${result.galleryImages.length} images from ${result.sourceCount} sources`);
  }

  const resultsById = new Map(results.map((result) => [result.id, result]));
  const stateUpdated = await updateStateFile(resultsById);
  let prismaUpdated = 0;
  try {
    prismaUpdated = await updatePrisma(resultsById);
  } catch (error) {
    console.warn(`Prisma update skipped: ${error instanceof Error ? error.message : String(error)}`);
  }

  console.log(JSON.stringify({
    ok: true,
    siteId,
    packs: results.length,
    stateUpdated,
    prismaUpdated,
    galleryRoot,
    publicVersion
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
